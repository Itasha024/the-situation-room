/*
 * Round 4 of the 20 Oct review (evening): every report card published on 20 Oct on both desks, read
 * against its source. Each kind of mistake found, as the rule that now stops it, tested on the real card.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { bodyOffTopic, exclusiveUrl, exclusivesOut, idOrderTimes, notNews, postTimes, serveCard, wrongLink, wrongSource } from "./copy-rules.ts";
import { type Card, foldServed, interceptAt, kitDecision, remarksOwner, sameScoop } from "./fold-same.ts";
import { checkReading, thinExclusive, type Reading } from "./reader.ts";
import { crimeOrCoercion, notEvent, onePinPerEvent, oneEvent } from "./yemen-pins.ts";
import { IRAN_WAR_WORDS, isExclusiveCard, lateOtherStory } from "../yemen-scan.server.ts";

const card = (x: Partial<Card> & { fp: string; at: string; summary: string }): Card => ({ source: "x", url: `https://example.com/${x.fp}`, type: "statement", ...x }) as Card;

/* ------------------------------------------------------------------ *
 * Task 2: Al-Araby Al-Jadeed's exclusive on the Qatar–Pakistan proposal
 * ------------------------------------------------------------------ */

const ARABY_X = card({
  fp: "ir-live-t-me-akhbarefori-700071",
  at: "2026-10-20T13:22:15.000Z",
  source: "Al-Araby Al-Jadeed",
  url: "https://x.com/alaraby_ar/status/2112551784921108777",
  type: "diplomacy",
  summary: "Qatar and Pakistan propose middle-ground plan to meet US and Iranian demands, sources say",
  text: "",
  alsoReportedBy: [{ url: "https://t.me/akhbarefori/700071", source: "Akhbar-e Fori", summary: "Qatar and Pakistan propose Iran receive $6bn frozen-fund interest for secret IAEA visit" }],
});
const IRANINTL = card({
  fp: "ir-live-x-com-iranintlbrk-status-2112554605951197581",
  at: "2026-10-20T14:40:42.000Z",
  source: "Iran International",
  url: "https://x.com/IranIntlbrk/status/2112554605951197581",
  type: "diplomacy",
  summary: "Qatar and Pakistan propose US–Iran talks revival: Iran gets $6bn interest on frozen funds for secret IAEA visits, Al Araby Al Jadeed reports",
  text: "",
});
const NEWARAB = card({
  fp: "ir-live-x-com-iranintlbrk-status-2112554729872248957",
  at: "2026-10-20T14:41:11.000Z",
  source: "The New Arab",
  url: "https://www.newarab.com/news/exclusive-mediators-submit-new-peace-proposal-iran-us",
  type: "diplomacy",
  summary: "Qatar and Pakistan submit new peace proposal to Iran and US",
  text: "The proposal is described as a middle-ground plan addressing Iran's nuclear programme and the release of frozen assets. Sources state both Washington and Tehran have responded positively to the plan, which was delivered by Pakistan's army chief Asim Munir.",
  alsoReportedBy: [{ url: "https://x.com/IranIntlbrk/status/2112554729872248957", source: "Iran International", summary: "Qatar and Pakistan joint proposal for US–Iran talks return has US agreement and Iran's initial welcome, Al Araby Al Jadeed reports" }],
});

test("task 2: Al-Araby's exclusive, its New Arab article and Iran International's relay of it are one card, led by the article and labelled", () => {
  assert.ok(exclusiveUrl(NEWARAB.url));
  assert.ok(!exclusiveUrl("https://www.newarab.com/news/saudi-arabia-postpones-its-davos-desert-after-attacks"));
  assert.ok(sameScoop(ARABY_X, NEWARAB));
  assert.ok(sameScoop(ARABY_X, IRANINTL));
  // Two outlets' relays of one another are no scoop of Al-Araby's.
  assert.ok(!sameScoop(card({ fp: "a", at: ARABY_X.at, source: "Fars News", summary: "Pakistan army chief Asim Munir meets Pezeshkian in Tehran" }), IRANINTL));
  const { reports } = foldServed([ARABY_X, IRANINTL, NEWARAB]);
  assert.equal(reports.length, 1);
  const [one] = reports;
  assert.equal(one.source, "The New Arab");
  assert.equal(one.url, NEWARAB.url);
  assert.match(String(one.text), /Asim Munir/);
  assert.ok(one.flags?.includes("exclusive"));
  // An exclusive takes no "Also" of the posts that retell it.
  assert.ok(!(one.alsoReportedBy ?? []).some((a) => /Iran International|Akhbar-e Fori/.test(a.source)));
});

test("task 2: an exclusive is never another card's 'Also': The New Arab's 19 Oct scoop under Nour News's 'Munir to arrive' is shown as its own card", () => {
  const nour = {
    fp: "ir-live-www-aljazeera-com-news-2026-10-19-qatar-warns",
    at: "2026-10-19T09:18:24.000Z",
    source: "Nour News",
    url: "https://t.me/Nournews_ir/403410",
    type: "diplomacy",
    summary: "Pakistan's army chief Asim Munir to arrive in Tehran tomorrow",
    flags: ["arena:talks"],
    alsoReportedBy: [
      { url: "https://www.aljazeera.com/news/2026/10/19/qatar-warns-global-energy-shockwaves-from-iran-war-have-yet-to-peak", source: "Al Jazeera", summary: "Pakistan's army chief Asim Munir to visit Tehran on Tuesday" },
      { url: "https://www.newarab.com/news/exclusive-breakthrough-expected-us-iran-mediation-efforts", source: "The New Arab", summary: "Qatar and Pakistan push for mutual concessions to prevent renewed US–Iran war, sources say" },
    ],
  };
  const out = exclusivesOut([nour]);
  assert.equal(out.length, 2);
  assert.equal((out[0].alsoReportedBy as unknown[]).length, 1);
  assert.equal(out[1].source, "The New Arab");
  assert.deepEqual(out[1].flags, ["arena:talks", "exclusive"]);
});

test("task 2: an exclusive by its link is opened in full, forced past triage on either desk's war, and kept whole by the reader", () => {
  assert.ok(isExclusiveCard({ ...NEWARAB, flags: [] } as never));
  assert.ok(IRAN_WAR_WORDS.test("مقترح قطري باكستاني لإيران والولايات المتحدة"));
  assert.ok(IRAN_WAR_WORDS.test("Qatar and Pakistan submit new peace proposal to Iran and US"));
  const article =
    "Exclusive: Mediators submit new peace proposal to Iran, US. Qatari and Pakistani officials submitted a new peace proposal to Iran and the United States on Tuesday. " +
    "Sources described it as a middle-ground proposal that partly meets both sides' demands. Both Washington and Tehran responded positively, the sources said. " +
    "Pakistan's army chief Asim Munir delivered the proposal to Iranian officials in Tehran on Tuesday. The US insists Iran dismantle its nuclear programme. " +
    "Iran wants all its frozen foreign assets released immediately. Under the plan Iran would allow a secret IAEA inspection of its nuclear sites. " +
    "In return the US would let Tehran receive interest on $6 billion of frozen assets held in Qatar. The June ceasefire collapsed the following month. " +
    "Qatar and Pakistan brokered the June memorandum of understanding.";
  assert.ok(thinExclusive(article, NEWARAB.text ?? ""));
  assert.ok(!thinExclusive(article, "Pakistan's army chief Asim Munir delivered the proposal in Tehran on Tuesday. Iran would allow a secret IAEA inspection of its nuclear sites. In return the US would let Tehran receive interest on $6 billion of frozen assets held in Qatar."));
  const r = { publish: true, headline: "Qatar and Pakistan submit new peace proposal to Iran and US", body: NEWARAB.text, event_type: "diplomacy" } as unknown as Reading;
  assert.match(String(checkReading(r, article)), /points dropped: an outlet's exclusive/);
  // A loose second check lets it out rather than lose it.
  assert.equal(checkReading(r, article, false), null);
});

/* ------------------------------------------------------------------ *
 * Times
 * ------------------------------------------------------------------ */

test("times: a late post that took over another story's card is split off at its own time (Fox News, Netanyahu–Hegseth)", () => {
  const fox = {
    fp: "ir-live-www-alaraby-co-uk-politics-d8-aa-d8-b1-d8-a7-d9-85-d8-a8-d9-8a-d8-ab-d9-",
    at: "2026-10-19T22:12:04.000Z",
    source: "Fox News",
    url: "https://x.com/FoxNews/status/2112520669636223418",
    type: "diplomacy",
    summary: "Netanyahu meets Hegseth in Israel to discuss renewed strikes on Iran",
    text: "",
    alsoReportedBy: [
      { url: "https://www.alaraby.co.uk/politics/%D8%AA%D8%B1%D8%A7%D9%85%D8%A8-%D9%8A%D8%AB%D9%86%D9%8A", source: "Al-Araby Al-Jadeed", summary: "Trump praises Russia and China on Iran as Macron blames Hormuz closure and war for French fuel price rise" },
      { url: "https://t.me/farsna/469560", source: "Fars News", summary: "Macron blames Hormuz closure and Iran war for French fuel price rise" },
    ],
  };
  const out = postTimes([fox]);
  assert.equal(out.length, 2);
  assert.equal(out[0].source, "Al-Araby Al-Jadeed");
  assert.equal(out[0].at, fox.at);
  assert.equal(out[1].summary, fox.summary);
  assert.equal(String(out[1].at).slice(0, 16), "2026-10-20T12:25");
});

test("times: the late lead with no first account kept is shown at its own time; the same story told later keeps its card", () => {
  const mofa = {
    fp: "live-x-com-marebpress-status-2112310279816311103",
    at: "2026-10-19T22:29:50.000Z",
    source: "Yemen Foreign Ministry",
    url: "https://x.com/yemen_mofa/status/2112574210468196616",
    summary: "Saudi ambassador says Houthis tighten siege of Taiz and block roads, cite Sanaa airport incidents",
    alsoReportedBy: [{ url: "https://x.com/marebpress/status/2112314374765625404", source: "Mareb Press", summary: "Yemeni diaspora in Washington protests at White House and Congress, demands US action to lift Houthi siege of Taiz" }],
  };
  assert.equal(String(postTimes([mofa])[0].at).slice(0, 16), "2026-10-20T15:58");
  const amb = {
    fp: "ir-live-t-me-almayadeen-402681",
    at: "2026-10-20T07:36:42.000Z",
    source: "Iran International",
    url: "https://x.com/IranIntl_En/status/2112553021783654464",
    summary: "Iranian ambassador says agreement reached with Iraq to expel Kurdish separatist groups from Iraqi Kurdistan",
    alsoReportedBy: [{ url: "https://t.me/almayadeen/402681", source: "Al Mayadeen", summary: "Iran says it agreed with Iraq to expel or hand over Iranian Kurdish opposition groups from Kurdistan Region" }],
  };
  assert.deepEqual(postTimes([amb]), [amb]);
});

test("times: old news relayed late is shown at its post's time (Iran's foreign ministry on Egypt, 19 Oct 07:30, out on 20 Oct)", () => {
  const egypt = { fp: "live-t-me-khabar-fouri-552521", at: "2026-10-20T04:04:33.000Z", source: "Iran Foreign Ministry", url: "https://x.com/IRIMFA_EN/status/2112038581896200531", summary: "Iranian Foreign Ministry spokesperson warns Egypt against providing military support to Saudi Arabia regarding Yemen" };
  assert.equal(String(postTimes([egypt])[0].at).slice(0, 13), "2026-10-19T04");
});

test("times: a numbered article timed before the one numbered below it takes that one's time (Saba 154307 at 00:25)", () => {
  const rows = [
    { fp: "live-www-sabanew-net-viewstory-154306", at: "2026-10-20T11:37:00.000Z", url: "http://www.sabanew.net/viewstory/154306", summary: "Shabwa governor says death toll from Houthi camp attack rises to 73 with 14 missing" },
    { fp: "live-www-sabanew-net-viewstory-154307", at: "2026-10-19T21:25:00.000Z", url: "http://www.sabanew.net/viewstory/154307", summary: "Yemeni public works minister orders urgent technical assessment and repair of Houthi-targeted Hayjah al-Abd bridge" },
    { fp: "live-www-sabanew-net-viewstory-154308", at: "2026-10-20T12:23:00.000Z", url: "http://www.sabanew.net/viewstory/154308", summary: "Aden and Lahj governors discuss humanitarian response" },
  ];
  const out = idOrderTimes(rows);
  assert.equal(out[1].at, "2026-10-20T11:37:00.000Z");
  assert.equal(out[0], rows[0]);
  assert.equal(out[2], rows[2]);
});

test("times: at write, a post hours after a card with hardly a word of its story is no copy of it", () => {
  assert.ok(lateOtherStory({ at: "2026-10-19T22:12:04.000Z", summary: "Trump praises Russia and China on Iran as Macron blames Hormuz closure" }, { at: "2026-10-20T12:25:51.000Z", summary: "Netanyahu meets Hegseth in Israel to discuss renewed strikes on Iran" }));
  assert.ok(!lateOtherStory({ at: "2026-10-20T07:36:42.000Z", summary: "Iran says it agreed with Iraq to expel Iranian Kurdish opposition groups" }, { at: "2026-10-20T14:34:00.000Z", summary: "Iranian ambassador says agreement reached with Iraq to expel Kurdish separatist groups" }));
});

/* ------------------------------------------------------------------ *
 * Copies: one interception, one decision, one interview
 * ------------------------------------------------------------------ */

test("copies: one missile intercepted over Riyadh, five outlets in 45 minutes, is one card; a drone later is another", () => {
  const base = { type: "strike" };
  const cards = [
    card({ ...base, fp: "bs", at: "2026-10-20T08:41:00Z", source: "Bin Saeed", summary: "Saudi forces intercept ballistic missile fired from Yemen toward the capital Riyadh near King Khalid International Airport" }),
    card({ ...base, fp: "cs", at: "2026-10-20T09:01:00Z", source: "Crater Sky", summary: "Saudi-led coalition intercepts ballistic missile fired by Houthis toward Riyadh" }),
    card({ ...base, fp: "ag", at: "2026-10-20T09:05:00Z", source: "Aden al-Ghad", summary: "Saudi air defenses intercept and destroy Houthi ballistic missile targeting Riyadh" }),
    card({ ...base, fp: "an", at: "2026-10-20T13:58:00Z", source: "Arab News", summary: "Coalition intercepts and destroys drone over Riyadh region" }),
    card({ ...base, fp: "cs2", at: "2026-10-20T14:23:00Z", source: "Crater Sky", summary: "Saudi-led coalition intercepts and destroys drone over Riyadh region" }),
  ];
  assert.equal(interceptAt(cards[0]), "riyadh missile");
  assert.equal(foldServed(cards).reports.length, 2);
});

test("copies: Britain's Typhoons for Saudi Arabia, seven cards in 85 minutes, are one", () => {
  const lines = [
    "UK deploys RAF Typhoon jets to Saudi Arabia for defensive missions against Houthi attacks",
    "UK officials: UK Royal Air Force to deploy Typhoon fighter jets to protect Saudi Arabia from Houthi attacks",
    "British prime minister approves Typhoon jets and advisers to protect Saudi Arabia",
    "RAF Typhoon fighter jets will be deployed to defend Saudi cities and infrastructure against Houthi aerial attacks",
    "Typhoon warplanes will operate in a defensive role and launch no offensive strikes against Houthis in Saudi Arabia",
    "UK to send Typhoon jets to defend Saudi Arabia",
    "UK deploys RAF Typhoon jets and Atlas A400M transport aircraft to protect Saudi Arabia",
  ];
  const cards = lines.map((summary, i) => card({ fp: `t${i}`, at: new Date(Date.parse("2026-10-20T10:23:00Z") + i * 12 * 60_000).toISOString(), source: `S${i}`, type: i % 2 ? "statement" : "diplomacy", summary }));
  assert.ok(cards.every((c) => kitDecision(c) === "typhoon saudi"));
  assert.equal(foldServed(cards).reports.length, 1);
  // A field event is not a decision.
  assert.equal(kitDecision(card({ fp: "m", at: cards[0].at, type: "strike", summary: "IRGC says it intercepted and destroyed a US Army MQ-9 drone over the Strait of Hormuz" })), "");
});

test("copies: the Saudi ambassador's interview, twelve cards in an hour, is one card of his remarks", () => {
  for (const s of ["Saudi ambassador to Yemen: Houthis besiege Taiz civilians, block food and medicine", "Saudi ambassador Mohammed Al Jaber says Houthis trade on Yemenis' suffering", "Saudi ambassador to Yemen Mohammed Al Jaber: Houthis obtain $2 billion annually from smuggled oil alone"]) {
    assert.equal(remarksOwner({ summary: s, type: "statement" }), "saudi ambassador to yemen", s);
  }
});

/* ------------------------------------------------------------------ *
 * Copy
 * ------------------------------------------------------------------ */

test("copy: commentary, an editorial, sport and a statistics release are not reports (20 Oct)", () => {
  for (const [h, body, type] of [
    ["Former UK defence secretary Michael Fallon: Britain should consider strikes on Houthis to protect Gulf allies", "", "statement"],
    ["Former Iranian MP: 'Mother of all bombs' has no use against underground cities, targets big cities and infrastructure", "", "statement"],
    ["Sanaa Center head: Saudi recognition of Houthis could spur claims on Najran, Jazan, Asir", "", "statement"],
    ["Ahmed Abdullah al-Majidi: Saudi-Egyptian partnership is a pillar of Arab security", "Former ambassador and governor Ahmed Abdullah al-Majidi backed a call by former Arab League chief Amr Moussa.", "diplomacy"],
    ["Houthi crime in Shabwa with over 253 killed and wounded is a final alarm bell for all Yemenis", "The Saudi newspaper Okaz said in an editorial that the Houthi forces's actions in Shabwa province are not a passing assault.", "statement"],
    ["Yemen faces Saudi Arabia in Gulf U-17 clash in Doha", "", "statement"],
    ["Saudi Arabia's Operating Revenues Index rises 3% year on year in August", "", "economy"],
  ] as const) assert.ok(notNews(h, body, type), h);
  // News stays.
  assert.equal(notNews("Shabwa governor says death toll from Houthi camp attack rises to 73 with 14 missing", "", "strike"), null);
  assert.equal(notNews("Saudi stock market closes at lowest level since April 2021", "", "economy"), null);
});

test("copy: a field report's body about another event is not shown (Crater Sky, 20 Oct)", () => {
  assert.ok(bodyOffTopic("Saudi-led coalition intercepts and destroys drone over Riyadh region", "RIYADH — Government forces, backed by popular resistance, carried out a raid targeting Houthi forces in Al-Masrakh directorate. Heavy Houthi shelling reported on Jabal Sabr south of Taiz city.", "strike"));
  // A front's body naming its villages is the same fight.
  assert.ok(!bodyOffTopic("Yemeni government forces and resistance repel Houthi attacks in Sabr Al-Mawadim directorate in Taiz", "Clashes and artillery shelling took place across several fronts including Dahih, Kahlan, Al-Najadah, Al-Rahn and Al-Janahabi, resulting in dozens of Houthi casualties.", "combat"));
  assert.ok(!bodyOffTopic("Houthi shelling on Hajjah wounds two civilians and damages homes", "HAJJAH — The shelling in Al-Dair village in Hiran district wounded 29-year-old Samira Mohammed Ahmed Ibrahim in the neck and right leg.", "combat"));
  // A statement's body is the speaker's words, never judged so.
  assert.ok(!bodyOffTopic("Qatar: lack of public updates on US–Iran nuclear talks is a positive sign", "Majed al-Ansari told the Global Security Forum in Doha that mediators are working.", "diplomacy"));
  const r: Record<string, unknown> = { fp: "c", at: "2026-10-20T14:23:00Z", source: "Crater Sky", url: "https://crater-sky.com/posts/241542", type: "strike", summary: "Saudi-led coalition intercepts and destroys drone over Riyadh region", text: "RIYADH — Government forces, backed by popular resistance, carried out a raid targeting Houthi forces in Al-Masrakh directorate. Heavy Houthi shelling reported on Jabal Sabr south of Taiz city." };
  assert.ok(serveCard(r, "yemen"));
  assert.equal(r.text, "");
});

test("copy: a link whose own words tell another story is not the card's (Bloomberg's Typhoon card on a Starlink article)", () => {
  const h = "UK officials: UK Royal Air Force to deploy Typhoon fighter jets to protect Saudi Arabia from Houthi attacks";
  assert.ok(wrongLink(h, "", "https://www.bloomberg.com/news/articles/2026-10-20/how-musk-s-starlink-and-us-spy-satellites-support-ukraine-s-defense"));
  assert.ok(!wrongLink("Brent oil steady near five-month high as traders weigh Hormuz risk against Gulf crude flows", "", "https://www.bloomberg.com/news/articles/2026-10-19/latest-oil-market-news-and-analysis-for-oct-20?taid=1"));
  assert.ok(!wrongLink("German Foreign Ministry summons Iranian ambassador over IRGC Quds Force", "", "https://www.reuters.com/de/welt/auswrtiges-amt-bestellt-iranischen-botschafter-ein-2026-10-19/"));
  assert.ok(!wrongLink("Saudi Arabia postpones Future Investment Initiative conference following Houthi attacks", "", "https://www.newarab.com/news/saudi-arabia-postpones-its-davos-desert-after-attacks"));
  const r: Record<string, unknown> = { fp: "b", at: "2026-10-20T10:43:00Z", source: "Bloomberg", type: "diplomacy", summary: h, url: "https://www.bloomberg.com/news/articles/2026-10-20/how-musk-s-starlink-and-us-spy-satellites-support-ukraine-s-defense" };
  assert.equal(serveCard(r, "yemen"), false);
});

test("copy: a famous man's own post is not where another spoke of him (Rubio's post under Iran's judiciary spokesman)", () => {
  assert.ok(wrongSource("Iran judiciary spokesman Gholamhossein Mohseni-Ejei: Rubio's remarks in Greece are an attempt to distort history and promote warmongering", "Marco Rubio"));
  assert.equal(wrongSource("Rubio: Iran is the primary driver of instability and the main backer of the Houthis", "Marco Rubio"), null);
  assert.equal(wrongSource("Qatar's foreign ministry: Saudi Arabia and Iran must talk", "Sky News Arabia"), null);
});

/* ------------------------------------------------------------------ *
 * Pins (leftovers of the 20 Oct audit)
 * ------------------------------------------------------------------ */

test("pins: crime and coercion are not on the map", () => {
  for (const label of [
    "Houthi fighter kills brother in Taiz for refusing to add sectarian phrase to prayer call",
    "Houthi forces turn school and health unit in Mocha into military barracks and operations room",
    "Kholan bin Amer tribes mobilize in Jahanah district of Sanaa following killing of Sheikh Abdulqawi Ghunaim by Houthi forces",
    "Yemeni government forces foil Houthi operation targeting military and civilian facilities in Aden",
    "Houthi forces block hundreds of Yemeni Umrah pilgrims on Al-Bayda and Shabwa road",
    "Ibb resident calls on locals to block Houthi fighters heading to Taiz",
    "Dozens of charred bodies in Ataq General Hospital morgue following Houthi attack in Shabwa",
  ]) assert.ok(notEvent({ label }), label);
  assert.ok(crimeOrCoercion("Taiz activists accuse Islah Party militants of using civilians as human shields"));
  assert.ok(notEvent({ label: "Defense Line: Houthi commander reported killed in air strike in Al-Jawf", text: "The platform cited local sources saying the commander was killed in an air strike along with several aides several days ago." } as never));
  for (const label of [
    "Houthi artillery shell kills ambulance driver and wounds accompanying doctor in Taiz",
    "Yemeni government forces repel Houthi attacks in Sabr Al-Mawadim directorate in Taiz",
    "Houthi forces advance to Al-Qubaysah in Al-Subayhah; families displaced from Batan, Haqrah, Marwis, Amalibiyah and Mafrukhiyah",
  ]) assert.ok(!notEvent({ label }), label);
});

const SHABWA = [
  { fp: "live-crater-sky-com-posts-241434", at: "2026-10-19T08:13:00.000Z", type: "strike", actor: "houthi", place: "Jardan", lat: 14.985, lng: 46.971, label: "Houthi ballistic missile strike on Al-Camp camp in Jirdan district of Shabwa governorate kills 40 to 50 soldiers" },
  { fp: "live-www-reuters-com-world-least-18-killed", at: "2026-10-19T09:40:10.000Z", type: "strike", actor: "unclear", place: "Shabwa", lat: 14.55, lng: 46.83, label: "At least 18 killed in Houthi attack on military training camp in Shabwa" },
  { fp: "live-www-nytimes-com-2026-10-19", at: "2026-10-19T19:54:36.000Z", type: "strike", actor: "houthi", place: "Shabwa", lat: 14.541, lng: 46.862, label: "Houthi strikes kill dozens at military camp in Shabwa" },
  { fp: "live-t-me-shajab-news-69385", at: "2026-10-20T00:16:08.000Z", type: "strike", actor: "houthi", place: "Shabwa", lat: 14.55, lng: 46.83, label: "Houthi forces claim missile strike on Al-Alam camp in Shabwa" },
];

test("pins: the Shabwa camp strike, told in other words and claimed the next day, is one pin", () => {
  const out = onePinPerEvent(SHABWA);
  assert.equal(out.length, 1);
  assert.equal(out[0].fp, SHABWA[0].fp);
});

test("pins: the next day's new strike on the same camp is a new pin; a claim of it says 'another' or names a count only", () => {
  const day1 = { fp: "a", at: "2026-10-19T12:00:00Z", type: "strike", actor: "saudi", place: "Ibb", lat: 13.97, lng: 44.18, label: "Saudi air strikes on Al-Hamza camp in Ibb kill 3" };
  const day2 = { fp: "b", at: "2026-10-20T10:00:00Z", type: "strike", actor: "saudi", place: "Ibb", lat: 13.97, lng: 44.18, label: "Saudi air strikes on Al-Hamza camp in Ibb kill 5" };
  assert.ok(!oneEvent(day1, day2));
  assert.ok(!oneEvent(day1, { ...day2, label: "Houthi media claims another Saudi strike on Al-Hamza camp in Ibb" }));
});

test("pins: one landmine death told on Hodeidah and on its district is one pin", () => {
  const a = { fp: "k", at: "2026-10-19T20:18:00Z", type: "combat", actor: "houthi", place: "Hodeidah", lat: 14.8, lng: 42.95, label: "Houthi landmine kills child in Hodeidah" };
  const b = { fp: "d", at: "2026-10-19T20:52:00Z", type: "combat", actor: "houthi", place: "Al Jarrahi", lat: 14.07, lng: 43.43, label: "Houthi landmine kills child in Al-Jarrahi district of Hodeidah" };
  assert.ok(oneEvent(a, b));
});
