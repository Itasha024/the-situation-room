import assert from "node:assert/strict";
import test from "node:test";

import { checkLinks, judgeLinks, linkOk, speakerKey, speakersOf } from "./links.ts";
import type { LiveReport } from "./types.ts";

type Fx = { at: string; source: string; type: string; summary: string; place?: string; lat?: number; lng?: number };

// Live pairs of 24 and 25 September: child first, the card it was linked to second.
const WRONG: [Fx, Fx][] = [
  // 7
  [{"at":"2026-09-24T21:30:16.000Z","source":"Almashhad","type":"combat","summary":"Houthi artillery shelling hits Wadi Khar in Beihan, Shabwah"},
   {"at":"2026-09-24T21:17:09.000Z","source":"Almashhad","type":"combat","summary":"Yemeni government forces thwart Houthi infiltration and secure Wadi Al-Muqatrah in Haifan","place":"Hayfan","lat":13.29,"lng":44.27}],
  // 10
  [{"at":"2026-09-24T21:20:37.000Z","source":"Almashhad","type":"combat","summary":"A security source denies a woman's death in clashes in Dofas, Abyan","place":"Jwla Dwfs","lat":13.0618,"lng":45.3422},
   {"at":"2026-09-24T21:17:06.000Z","source":"Almashhad","type":"statement","summary":"Taiz governor: Security of Taiz and dignity of its people are a red line"}],
  // 25
  [{"at":"2026-09-24T15:25:34.000Z","source":"Almashhad","type":"strike","summary":"Airstrike in Majzar district in Marib kills 4 Houthi field commanders including bodyguard of Houthi leader's brother","place":"Marib","lat":15.47,"lng":45.32},
   {"at":"2026-09-24T15:17:34.000Z","source":"Almashhad","type":"statement","summary":"Yemen's president: ceasefire would rearm Houthis, calls Taiz, Marib, Al‑Dhale and Lahj militia graves"}],
  // 61
  [{"at":"2026-09-24T01:45:12.000Z","source":"Bloomberg","type":"economy","summary":"Houthis expand secret procurement network in China for missile and drone manufacturing parts","place":"Aden","lat":12.79,"lng":45.02},
   {"at":"2026-09-24T01:30:55.000Z","source":"Almashhad","type":"strike","summary":"Houthi ballistic missile falls in Khamir, Amran governorate, after launch failure"}],
  // 32
  [{"at":"2026-09-24T14:49:02.000Z","source":"Al Hadath","type":"diplomacy","summary":"Yemen's president calls on international community to apply arms embargo against Houthis"},
   {"at":"2026-09-24T14:09:05.000Z","source":"Al-Masirah","type":"statement","summary":"National Human Rights Commission: condemns Saudi attacks on homes and shops in Razeh and Qataber, Saada"}],
  // 34
  [{"at":"2026-09-24T14:47:01.000Z","source":"Al Hadath","type":"statement","summary":"Yemen's president expresses confidence in armed forces"},
   {"at":"2026-09-24T14:09:05.000Z","source":"Al-Masirah","type":"statement","summary":"National Human Rights Commission: condemns Saudi attacks on homes and shops in Razeh and Qataber, Saada"}],
  // 117
  [{"at":"2026-09-23T15:25:12.000Z","source":"Al-Masirah","type":"combat","summary":"Saudi artillery shelling hits border areas in Hajjah","place":"Hajjah","lat":15.69,"lng":43.6},
   {"at":"2026-09-23T15:25:04.000Z","source":"Al-Masirah","type":"strike","summary":"Saudi air strike hits Mustaba district in Hajjah","place":"Hajjah","lat":15.69,"lng":43.6}],
  // 118
  [{"at":"2026-09-23T15:25:04.000Z","source":"Al-Masirah","type":"strike","summary":"Saudi air strike hits Mustaba district in Hajjah","place":"Hajjah","lat":15.69,"lng":43.6},
   {"at":"2026-09-23T15:24:56.000Z","source":"Al-Masirah","type":"combat","summary":"Saudi artillery shelling hits border areas in Shada district","place":"Shada'a district","lat":16.8939,"lng":43.1875}],
  // 119
  [{"at":"2026-09-23T15:24:56.000Z","source":"Al-Masirah","type":"combat","summary":"Saudi artillery shelling hits border areas in Shada district","place":"Shada'a district","lat":16.8939,"lng":43.1875},
   {"at":"2026-09-23T15:24:42.000Z","source":"Al-Masirah","type":"combat","summary":"Saudi shelling damages homes and farms in Razih district","place":"Razih district","lat":16.937,"lng":43.2608}],
  // 120
  [{"at":"2026-09-23T15:24:42.000Z","source":"Al-Masirah","type":"combat","summary":"Saudi shelling damages homes and farms in Razih district","place":"Razih district","lat":16.937,"lng":43.2608},
   {"at":"2026-09-23T15:22:08.000Z","source":"Al-Masirah","type":"strike","summary":"Saudi air strike hits Al-Aboos sub-district in Haifan","place":"Hayfan","lat":13.29,"lng":44.27}],
  // 54
  [{"at":"2026-09-24T07:46:14.000Z","source":"Ali Bk","type":"strike","summary":"Houthi missile salvo launched towards targets"},
   {"at":"2026-09-24T01:12:54.000Z","source":"Ali Bk","type":"strike","summary":"Houthi missile salvo launched towards targets"}],
  // 60
  [{"at":"2026-09-24T02:05:44.000Z","source":"Ali Bk","type":"strike","summary":"Flights halted at Riyadh airport and aircraft avoid landing","place":"Riyadh","lat":24.7136,"lng":46.6753},
   {"at":"2026-09-22T21:57:27.000Z","source":"Al-Mihwar","type":"strike","summary":"Air traffic halted at Riyadh airport","place":"Riyadh","lat":24.7136,"lng":46.6753}],
  // 27
  [{"at":"2026-09-24T15:14:16.000Z","source":"The Cube","type":"combat","summary":"Houthi attempts to control Jabal Balaq in Marib fail, satellite imagery shows","place":"Balaq","lat":15.35,"lng":45.15},
   {"at":"2026-09-24T15:08:55.000Z","source":"The Cube","type":"combat","summary":"Houthi forces control Jabal khaboub as southern giant forces move to positions","place":"Kahbub","lat":12.85,"lng":43.55}],
  // 55
  [{"at":"2026-09-24T07:19:52.000Z","source":"Al-Masirah","type":"combat","summary":"Saudi rocket shelling in Razih wounds a girl and severs her hand"},
   {"at":"2026-09-23T22:47:25.000Z","source":"Al-Masirah","type":"combat","summary":"Woman killed and child wounded by Saudi artillery shelling in Razih district"}],
  // 5
  [{"at":"2026-09-24T23:33:23.000Z","source":"Arab News","type":"diplomacy","summary":"Yemen vice president urges global action to restore state and secure Bab al-Mandab"},
   {"at":"2026-09-24T23:24:47.000Z","source":"Al-Araby Al-Jadeed","type":"statement","summary":"Kuwait's crown prince: Kuwait, GCC states and Jordan are not parties to the regional conflict"}],
  // 146
  [{"at":"2026-09-23T07:22:43.000Z","source":"Almashhad","type":"combat","summary":"Houthi leader abducts sick child to recruit him for frontlines, father says"},
   {"at":"2026-09-23T07:11:11.000Z","source":"Almashhad","type":"strike","summary":"Four Houthi officers close to Houthi leader's brother killed in Marib air strike","place":"Marib","lat":15.47,"lng":45.32}],
  // 140
  [{"at":"2026-09-23T10:47:44.000Z","source":"AFP","type":"strike","summary":"Fighting between Houthis and Saudi-backed forces kills 154 in two days","place":"Mocha","lat":13.32,"lng":43.25},
   {"at":"2026-09-23T10:44:05.000Z","source":"Al-Mihwar","type":"statement","summary":"Yemeni official: we will target all US interests in the region if it backs Saudi Arabia"}],
  // 25 Sep: two speakers' words that share only a city.
  [{"at":"2026-09-25T08:28:23.000Z","source":"Al-Aqsa TV","type":"diplomacy","summary":"French President Emmanuel Macron: France will send soldiers and defense systems to Saudi Arabia to protect Yanbu facility"},
   {"at":"2026-09-24T20:41:00.000Z","source":"SPA","type":"diplomacy","summary":"Muslim World League condemns Houthi missile attacks on Taif and Yanbu"}],
];

const RIGHT: [Fx, Fx][] = [
  // 9
  [{"at":"2026-09-24T21:20:40.000Z","source":"Almashhad","type":"combat","summary":"Yemeni government forces recapture Jabal Qurfan in Taiz and kill 5 Houthi fighters","place":"Taiz","lat":13.58,"lng":44.02},
   {"at":"2026-09-24T21:04:25.000Z","source":"Almashhad","type":"combat","summary":"Yemeni government forces foil Houthi attacks and recapture Jabal Qurfan in Taiz","place":"Kahbub","lat":12.85,"lng":43.55}],
  // 43
  [{"at":"2026-09-24T10:43:02.000Z","source":"Al Hadath","type":"diplomacy","summary":"Saudi Civil Defense: Danger cleared in Makkah"},
   {"at":"2026-09-24T10:40:02.000Z","source":"Al Hadath","type":"statement","summary":"Saudi Civil Defense: Danger cleared in Makkah, Jeddah, Yanbu, Taif and Tabuk"}],
  // 44
  [{"at":"2026-09-24T10:40:02.000Z","source":"Al Hadath","type":"statement","summary":"Saudi Civil Defense: Danger cleared in Makkah, Jeddah, Yanbu, Taif and Tabuk"},
   {"at":"2026-09-24T10:30:02.000Z","source":"Al Hadath","type":"strike","summary":"Saudi Civil Defense: Early warning issued in Jeddah","place":"Jeddah","lat":21.4858,"lng":39.1925}],
  // 46
  [{"at":"2026-09-24T10:37:49.000Z","source":"Al-Aqsa TV","type":"statement","summary":"Alert status lifted across all regions of Saudi Arabia"},
   {"at":"2026-09-24T10:27:53.000Z","source":"Al-Araby TV","type":"strike","summary":"Saudi Civil Defense: Warning alerts issued for Makkah, Taif, Jeddah, Yanbu and Tabuk","place":"Mecca","lat":21.3891,"lng":39.8579}],
  // 56
  [{"at":"2026-09-24T05:45:11.000Z","source":"Al-Akhbar","type":"combat","summary":"Houthi forces advance in Kahbub front in Lahj governorate, south-west Yemen, after Giants Brigades forces withdraw","place":"Kahbub","lat":12.85,"lng":43.55},
   {"at":"2026-09-24T05:03:23.000Z","source":"Al-Akhbar","type":"combat","summary":"Houthi forces capture Kahbub mountains to secure the eastern side of Bab al-Mandab","place":"Kahbub","lat":12.85,"lng":43.55}],
  // 147
  [{"at":"2026-09-23T06:33:35.000Z","source":"Almashhad","type":"combat","summary":"Giants Brigades forces advance in Kahbub and Bab al-Mandab","place":"Kahbub","lat":12.85,"lng":43.55},
   {"at":"2026-09-23T04:31:01.000Z","source":"Almashhad","type":"combat","summary":"National Resistance forces clash with Houthi forces in Kahbub, Al-Wazi'iyah and Bab al-Mandab","place":"Kahbub","lat":12.85,"lng":43.55}],
  // 49
  [{"at":"2026-09-24T09:33:33.000Z","source":"Reuters","type":"combat","summary":"Yemeni government forces repel Houthi push on key Taiz-Aden route","place":"Taiz","lat":13.58,"lng":44.02},
   {"at":"2026-09-24T02:07:02.000Z","source":"Al Arabiya","type":"combat","summary":"Yemeni armed forces: Repelled Houthi attack trying to reach Aden-Lahj-Taiz road","place":"Aden","lat":12.79,"lng":45.02}],
  // 57
  [{"at":"2026-09-24T05:33:46.000Z","source":"Sabereen News","type":"combat","summary":"Houthi forces reopen Haijat al-Abd on the Taiz-Aden road after securing it","place":"Taiz","lat":13.58,"lng":44.02},
   {"at":"2026-09-24T02:07:02.000Z","source":"Al Arabiya","type":"combat","summary":"Yemeni armed forces: Repelled Houthi attack trying to reach Aden-Lahj-Taiz road","place":"Aden","lat":12.79,"lng":45.02}],
  // 59
  [{"at":"2026-09-24T02:07:02.000Z","source":"Al Arabiya","type":"combat","summary":"Yemeni armed forces: Repelled Houthi attack trying to reach Aden-Lahj-Taiz road","place":"Aden","lat":12.79,"lng":45.02},
   {"at":"2026-09-23T23:29:13.000Z","source":"Naya","type":"combat","summary":"Houthi forces take full control of the Taiz-Aden road after routing pro-Saudi forces","place":"Taiz","lat":13.58,"lng":44.02}],
  // 106
  [{"at":"2026-09-23T16:40:35.000Z","source":"Al-Araby Al-Jadeed","type":"diplomacy","summary":"Rubio: US will fulfill commitments to Saudi Arabia and agreement with Iran requires effort"},
   {"at":"2026-09-23T16:39:47.000Z","source":"AP","type":"diplomacy","summary":"Rubio: US will live up to defense commitments to Saudi Arabia"}],
  // 107
  [{"at":"2026-09-23T16:39:47.000Z","source":"AP","type":"diplomacy","summary":"Rubio: US will live up to defense commitments to Saudi Arabia"},
   {"at":"2026-09-23T16:28:58.000Z","source":"aa.com.tr","type":"diplomacy","summary":"US Secretary of State Marco Rubio: US will live up to defense commitments to Saudi Arabia"}],
  // 126
  [{"at":"2026-09-23T14:51:19.000Z","source":"Naya","type":"diplomacy","summary":"Rubio: we will fulfil our commitments set out in the defence agreement with Saudi Arabia"},
   {"at":"2026-09-23T14:51:02.000Z","source":"Al Hadath","type":"statement","summary":"Rubio: Houthi militias attacked diplomatic headquarters and are an evil force in the region"}],
  // 127
  [{"at":"2026-09-23T14:51:02.000Z","source":"Al Hadath","type":"statement","summary":"Rubio: Houthi militias attacked diplomatic headquarters and are an evil force in the region"},
   {"at":"2026-09-23T14:40:01.000Z","source":"Al Hadath","type":"statement","summary":"Rubio: what is happening with the Houthis in Yemen is a deep problem"}],
  // 121
  [{"at":"2026-09-23T14:55:56.000Z","source":"Al-Mihwar","type":"statement","summary":"US Secretary of State: Trump has many options on Houthi attacks on Saudi Arabia"},
   {"at":"2026-09-23T14:35:52.000Z","source":"Al Jazeera","type":"statement","summary":"US Secretary of State: consensus that Houthi actions in Yemen pose serious problem"}],
  // 129
  [{"at":"2026-09-23T14:35:52.000Z","source":"Al Jazeera","type":"statement","summary":"US Secretary of State: consensus that Houthi actions in Yemen pose serious problem"},
   {"at":"2026-09-23T14:35:27.000Z","source":"Al Jazeera","type":"statement","summary":"Consensus with Gulf states on keeping straits open"}],
  // 12
  [{"at":"2026-09-24T20:51:02.000Z","source":"Al Arabiya","type":"statement","summary":"Kuwaiti crown prince: Houthi militia threatens navigation in Bab al-Mandab"},
   {"at":"2026-09-24T20:50:01.000Z","source":"Al Arabiya","type":"statement","summary":"Kuwait's crown prince: We condemn Houthi militia attacks on civilian targets in Saudi Arabia"}],
  // 28
  [{"at":"2026-09-24T15:07:36.000Z","source":"Arab News","type":"statement","summary":"UN human rights chief Volker Turk: 125 civilians killed or wounded in Yemen since Houthi offensive last month"},
   {"at":"2026-09-24T13:27:43.000Z","source":"Reuters","type":"statement","summary":"UN human rights chief: Civilians bear the brunt of surging violence in Yemen"}],
  // 78
  [{"at":"2026-09-23T19:41:28.000Z","source":"Al-Masirah","type":"statement","summary":"Al-Lama Mftah: Maritime navigation in Bab al-Mandab is safe and not threatened by us"},
   {"at":"2026-09-23T19:40:09.000Z","source":"Al-Masirah","type":"statement","summary":"Al-Lama Mftah: If Saudi Arabia insists on painful escalation against Yemen, we have a crushing escalation"}],
  // 79
  [{"at":"2026-09-23T19:40:09.000Z","source":"Al-Masirah","type":"statement","summary":"Al-Lama Mftah: If Saudi Arabia insists on painful escalation against Yemen, we have a crushing escalation"},
   {"at":"2026-09-23T19:39:57.000Z","source":"Al-Masirah","type":"statement","summary":"Al-Lama Mftah: We have the capability to confront escalation and inflict pain on Saudi forces"}],
  // 143
  [{"at":"2026-09-23T10:09:35.000Z","source":"Al-Masirah","type":"strike","summary":"Saudi air raids target communication towers and radio building in Hodeidah","place":"Hodeidah","lat":14.8,"lng":42.95},
   {"at":"2026-09-23T09:13:20.000Z","source":"Al-Masirah","type":"strike","summary":"Saudi air raids target communication towers in Hodeidah","place":"Hodeidah","lat":14.8,"lng":42.95}],
  // 98
  [{"at":"2026-09-23T18:16:35.000Z","source":"Al-Masirah","type":"statement","summary":"National Human Rights Commission branch in Taiz: Saudi raids destroy Al-Najdain school in Haifan"},
   {"at":"2026-09-23T17:01:28.000Z","source":"Al-Masirah","type":"strike","summary":"Saudi air strikes destroy Al-Najdain school in Haifan, Taiz","place":"Hayfan","lat":13.29,"lng":44.27}],
];

let n = 0;
const card = (f: Fx) => ({ ...f, fp: `c${(n += 1)}`, url: "u", text: "", live: true }) as unknown as LiveReport;

test("the wrong live links break the rules", () => {
  for (const [c, p] of WRONG.map((x) => x.map(card))) assert.equal(linkOk(c, p, speakersOf([c, p])), false, `${c.summary}  <-  ${p.summary}`);
});

test("the right live links pass them", () => {
  for (const [c, p] of RIGHT.map((x) => x.map(card))) assert.equal(linkOk(c, p, speakersOf([c, p])), true, `${c.summary}  <-  ${p.summary}`);
});

test("a link never points forward in time", () => {
  const [c, p] = RIGHT[0];
  assert.equal(linkOk(card(p), card(c)), false);
});

test("one speaker by any of his titles", () => {
  assert.equal(speakerKey("Kuwaiti crown prince"), speakerKey("Kuwait's crown prince"));
  assert.equal(speakerKey("UN human rights chief Volker Turk"), speakerKey("UN human rights chief"));
  assert.equal(speakerKey("Houthi military spokesperson"), "saree");
});

test("checkLinks removes what breaks the rules and keeps the rest", () => {
  const [wc, wp] = WRONG[0].map(card);
  const [rc, rp] = RIGHT[0].map(card);
  wc.replyTo = wp.fp;
  rc.replyTo = rp.fp;
  const cut = checkLinks([wc, rc], [wp, rp]);
  assert.deepEqual(cut, [wc]);
  assert.equal(wc.replyTo, undefined);
  assert.equal(rc.replyTo, rp.fp);
});

test("the judge picks among what the rules allow, clears on an empty answer, and adds a missing link", async () => {
  // Kahbub advance with its capture (allowed), a Taiz-Aden road card (allowed
  // for the road card below), and The Cube's Marib card (never a candidate).
  const capture = card({ at: "2026-09-24T10:00:00Z", source: "Al-Akhbar", type: "combat", summary: "Houthi forces capture Kahbub mountains to secure the eastern side of Bab al-Mandab" });
  const advance = card({ at: "2026-09-24T10:40:00Z", source: "Al-Akhbar", type: "combat", summary: "Houthi forces advance in Kahbub front in Lahj governorate" });
  const repelled = card({ at: "2026-09-24T11:00:00Z", source: "Al Arabiya", type: "combat", summary: "Yemeni armed forces: Repelled Houthi attack trying to reach Aden-Lahj-Taiz road" });
  const road = card({ at: "2026-09-24T12:00:00Z", source: "Reuters", type: "combat", summary: "Yemeni government forces repel Houthi push on key Taiz-Aden route" });
  const balaq = card({ at: "2026-09-24T12:05:00Z", source: "The Cube", type: "combat", summary: "Houthi attempts to control Jabal Balaq in Marib fail, satellite imagery shows" });
  balaq.replyTo = capture.fp;
  road.replyTo = capture.fp;
  let asked = "";
  const ask = async (_s: string, user: string) => {
    asked = user;
    const reports = JSON.parse(user).reports as { id: string; headline: string; earlier: { ref: string; headline: string }[] }[];
    return {
      links: reports.map((r) => ({
        id: r.id,
        follows: r.headline.includes("Kahbub") ? r.earlier.find((e) => e.headline.includes("capture"))?.ref ?? "" : "",
      })),
    };
  };
  // The rules run first, as in the scan: Balaq's link to Kahbub goes.
  checkLinks([balaq, road], [capture, advance, repelled]);
  assert.equal(balaq.replyTo, undefined);
  const changed = await judgeLinks([advance, road, balaq], [capture, repelled], ask);
  assert.equal(advance.replyTo, capture.fp, "a missing link is added");
  assert.equal(road.replyTo, undefined, "an empty answer clears");
  assert.ok(changed.includes(advance));
  assert.ok(!JSON.parse(asked).reports.some((r: { headline: string }) => r.headline.includes("Balaq")), "a card nothing may follow is not asked about");
});

test("no model, no change", async () => {
  const a = card(RIGHT[0][1]);
  const b = card(RIGHT[0][0]);
  b.replyTo = a.fp;
  assert.deepEqual(await judgeLinks([b], [a], async () => null), []);
  assert.equal(b.replyTo, a.fp);
});

test("two cards of the same second never follow each other", () => {
  const a = card({ at: "2026-09-24T18:00:00Z", source: "Yahya Saree", type: "strike", summary: "Houthi military spokesperson: Houthi forces carry out extensive missile and drone operation targeting Jizan" });
  const b = card({ at: "2026-09-24T18:00:00Z", source: "Al-Masirah", type: "strike", summary: "Houthi forces launch missile and drone strikes on military targets in Jizan" });
  assert.equal(linkOk(a, b) && linkOk(b, a), false);
});

test("a pact meeting does not follow a missile strike on the city the pact is named for", () => {
  const strike = card({ at: "2026-09-24T20:00:00Z", source: "Al Arabiya", type: "strike", summary: "Houthi missiles target Taif, Yanbu, Jizan and Riyadh; Saudi air defences intercept" });
  const pact = card({ at: "2026-09-24T21:00:00Z", source: "Al-Mihwar", type: "diplomacy", summary: "Saudi Arabia, Turkey and Pakistan to hold urgent chiefs of staff meeting on Riyadh defense pact" });
  assert.equal(linkOk(pact, strike), false);
});
