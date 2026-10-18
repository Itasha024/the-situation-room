/**
 * One event, one card (18 Oct review: about 150 surplus cards in the Iran
 * desk's latest 400, 95 in Yemen's). Real headlines from the review, through
 * the rules of fold-same.ts as the desk is read and as a new card is written.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { type Card, foldRule, foldServed, mirrorKey, remarksOwner, shipIncident, tollOf } from "./fold-same.ts";

let n = 0;
function card(at: string, source: string, summary: string, more: Partial<Card> = {}): Card {
  n += 1;
  return { fp: `f${n}`, at: `2026-10-${at}:00Z`, source, url: `https://example.com/${source.replace(/\W+/g, "")}/${n}`, type: "statement", summary, text: "", ...more };
}
const served = (cards: Card[]) => foldServed(cards).reports;

test("one official's remarks on one occasion are one card, every relay's line in it", () => {
  const cards = [
    card("17T10:32", "ILNA", "Araghchi says Iran will not negotiate under threat but is ready for talks based on mutual respect and credible guarantees"),
    card("17T10:47", "Al-Alam", "Araghchi: Insecurity in Hormuz due to US and Israeli attacks since war began"),
    card("17T11:26", "Abbas Araghchi", "Araghchi: Either we build regional security together, or we will bear insecurity together"),
    card("17T12:26", "Mehr News", "Araghchi: Either we build regional security together, or we will bear insecurity together"),
    card("17T12:29", "Al-Alam", "Iranian Foreign Minister Abbas Araghchi says Iran committed to international law, UN Charter and diplomacy, will not accept coercion, threats or intimidation, and will not relinquish sovereign rights under pressure"),
    card("17T13:07", "Al-Alam", "Araghchi: Iran will not accept coercion, threats or intimidation, and will not relinquish sovereign rights under pressure"),
  ];
  const out = served(cards);
  assert.equal(out.length, 1);
  // The speaker's own account leads; the relays' lines are in the card.
  assert.equal(out[0].source, "Abbas Araghchi");
  assert.match(String(out[0].text), /Insecurity in Hormuz/);
  assert.ok(out[0].alsoReportedBy!.some((a) => a.source === "Mehr News"));
});

test("another occasion the same day is another card (user, 18 Oct: an official talks several times a day)", () => {
  // The morning's remarks, then hours later a different thing: the Hormuz plan sent through Qatar.
  const morning = card("17T10:32", "ILNA", "Araghchi says Iran will not negotiate under threat but is ready for talks based on mutual respect and credible guarantees");
  const plan = card("17T14:43", "Abbas Araghchi", "Araghchi: Iran presented a seven-day plan to reopen the Strait of Hormuz to the US via Qatar", { type: "diplomacy" });
  assert.equal(foldRule(morning, plan), null);
  // Within the hour but on two named occasions: a call with Qatar, then a speech at the OIC.
  const call = card("17T09:00", "IRNA", "Araghchi in a phone call with Qatar's Al Thani: the region's security is indivisible");
  const oic = card("17T09:40", "Al-Alam", "Araghchi at the OIC meeting: Israel's attacks threaten the whole region");
  assert.equal(foldRule(call, oic), null);
  // The same words relayed late in the day still join their card.
  const early = card("17T08:10", "Al-Alam", "Khatibzadeh: Washington's path has reached a dead end on the Hormuz talks");
  const late = card("17T19:40", "Al Mayadeen", "Khatibzadeh: Washington's path on the Hormuz talks has reached a dead end");
  assert.equal(foldRule(early, late), "remarks");
  const late2 = card("17T19:45", "Tasnim", "Khatibzadeh: the talks on Hormuz reached a dead end because of Washington's path");
  assert.equal(foldRule(early, late2), "remarks");
});

test("a speaker known by a title is the same speaker: Khatibzadeh, the army spokesman, Ebnelreza", () => {
  assert.equal(remarksOwner({ type: "statement", summary: "Iran's deputy foreign minister: Iran is ready for various scenarios in case of a new military confrontation with the US" }), "khatibzadeh");
  assert.equal(remarksOwner({ type: "statement", summary: "Iran: Saeed Khatibzadeh says no importance given to US domestic politics" }), "khatibzadeh");
  assert.equal(remarksOwner({ type: "statement", summary: "Iranian army: We have new operational plans to force US warships to retreat further and leave the area" }), "iran army");
  assert.equal(remarksOwner({ type: "statement", summary: "Army spokesman: Iran's air defense capabilities far surpass pre-war and wartime levels" }), "iran army");
  assert.equal(remarksOwner({ type: "statement", summary: "Acting defence minister Sardar Ebnelreza: Iranian missiles determine the equation, not U.S. bombs" }), "ebnelreza");
  assert.equal(remarksOwner({ type: "statement", summary: "Iran's acting Defense Minister Majid Ebnolreza: Tehran's missile power has changed the equation" }), "ebnelreza");
  assert.equal(remarksOwner({ type: "statement", summary: "Iranian President Pezeshkian says Iran does not seek nuclear weapons" }), "pezeshkian");
  // The Houthi parliament speaker and the ministries.
  assert.equal(remarksOwner({ type: "statement", summary: "Houthi parliament speaker: we hope Cairo will take a brave stance and avoid being dragged by Saudi Arabia" }), "houthi parliament speaker");
  assert.equal(remarksOwner({ type: "statement", summary: "Houthi parliament speaker sends urgent message to Egyptian counterpart regarding potential intervention" }), "houthi parliament speaker");
  assert.equal(remarksOwner({ type: "statement", summary: "Houthi foreign ministry: Saudi crimes will not go unpunished" }), "houthi foreign ministry");
  // The government spokesman's count, typed combat, is still his words.
  assert.equal(remarksOwner({ type: "combat", summary: "Yemeni government forces spokesman: 1,417 targeting operations executed and about 800 Houthi elements neutralized in 24 hours" }), "gov spokesman");
  // A meeting is no remark, and remarks on two days are two cards.
  assert.equal(remarksOwner({ type: "diplomacy", summary: "Iranian Foreign Minister Araghchi met Iraqi Prime Minister Al-Sudani in Baghdad" }), "");
  const a = card("16T10:10", "Al-Alam", "Khatibzadeh: Iran has a full 7-day plan to open Strait of Hormuz");
  const b = card("17T10:10", "Al-Alam", "Khatibzadeh: Washington's path has reached a dead end");
  assert.equal(foldRule(a, b), null);
});

test("one channel's burst of one speaker's lines is one card (Al-Masirah, the parliament speaker's message)", () => {
  const out = served([
    card("17T22:28", "Al-Masirah", "Houthi official: We are concerned about potential Egyptian military involvement in Yemen", { type: "diplomacy" }),
    card("17T22:29", "Al-Masirah", "Houthi official: Saudi Arabia has waged war on Yemen for over 12 years"),
    card("17T22:29", "Al-Masirah", "Houthi official: Saudi Arabia has tightened the blockade on Yemen"),
    card("17T22:30", "Al-Masirah", "Houthi official: Saudi Arabia has ended the de-escalation phase"),
    card("17T22:31", "Al-Masirah", "Houthi official: We reject Egypt's involvement in the war on Yemen", { type: "diplomacy" }),
    card("17T22:33", "Al-Masirah", "Houthi official: We urge Cairo to distance itself from Saudi policies", { type: "diplomacy" }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(String(out[0].text).split("\n").length, 5);
});

test("one ship incident is one card for a day: the second supertanker on a mine", () => {
  const out = served([
    card("17T01:37", "Tasnim", "IRGC Navy: supertanker carrying over 2 million barrels hit a mine in Strait of Hormuz, declares strait closed", { type: "vessel" }),
    card("17T03:17", "ILNA", "IRGC Navy: giant oil tanker exploded after hitting naval mine in Strait of Hormuz", { type: "vessel" }),
    card("17T12:09", "Bin Saeed", "IRGC: another giant oil tanker exploded after hitting a sea mine", { type: "vessel" }),
    card("17T12:47", "Tehran Times", "IRGC Navy says second oil supertanker caught fire after striking naval mine in Strait of Hormuz", { type: "vessel" }),
    card("17T14:44", "gCaptain", "Iran’s Guards: two tankers hit mines in Strait of Hormuz", { type: "vessel" }),
    card("17T16:40", "Press TV", "IRGC Navy: a second supertanker caught fire after hitting a naval mine while attempting to illegally cross the Strait of Hormuz", { type: "economy" }),
  ]);
  assert.equal(out.length, 1);
});

test("the LNG tanker off Al-Mukalla is one card, however each outlet placed it", () => {
  const out = served([
    card("17T13:20", "Shajab News", "Attack on a ship in the Gulf of Aden", { type: "vessel" }),
    card("17T13:21", "Yemenat", "UKTMO: LNG tanker fired on by boat off Hadramawt coast", { type: "vessel" }),
    card("17T13:40", "ISNA", "Security incident in Gulf of Aden involving gunfire from boats towards a gas tanker", { type: "economy" }),
    card("17T13:43", "IRIB News", "UK Maritime Trade Operations reports maritime incident off Yemen's coast"),
    card("17T14:37", "UKMTO", "UKMTO reports small boat fires two shots at LNG tanker 140 miles southeast of Al-Mukalla", { type: "vessel" }),
    card("17T14:40", "Operativ Məlumat Mərkəzi", "Small boat fires at LNG tanker off Yemen", { type: "vessel" }),
    card("17T22:25", "Al-Ayyam", "Gas tanker attacked off the coast of Al-Mukalla", { type: "vessel" }),
  ]);
  assert.equal(out.length, 1);
});

test("a named ship is its own; a container ship is no tanker; a weekly tally is no incident", () => {
  assert.equal(shipIncident({ summary: "Indian shipping minister says projectile hit tanker MTST 3 with 15 Indian crew in Strait of Hormuz, no injuries" })?.name, "st3");
  assert.equal(shipIncident({ summary: "Indian shipping minister says oil tanker MT ST 3 with 15 Indian sailors attacked by projectile in Strait of Hormuz" })?.name, "st3");
  assert.equal(shipIncident({ summary: "UKMTO reports 12 attacks on commercial shipping around Strait of Hormuz in week ending October 16, with one vessel lost and two disabled" }), null);
  assert.equal(shipIncident({ summary: "Iran fires missiles at non-compliant ships in Strait of Hormuz" }), null);
  const box = card("17T05:57", "Khabar Fori", "IRGC: container ship sank after hitting naval mine in Strait of Hormuz", { type: "vessel" });
  const oil = card("17T06:36", "ISNA", "IRGC says super tanker carrying over 2 million barrels of crude oil exploded after hitting mine in Strait of Hormuz", { type: "vessel" });
  assert.equal(foldRule(box, oil), null);
  // A projectile's tanker and the next day's mine are two incidents.
  const st3 = card("16T17:49", "Al Arabiya", "Indian shipping minister says oil tanker MT ST 3 with 15 Indian sailors attacked by projectile in Strait of Hormuz", { type: "vessel" });
  assert.equal(foldRule(st3, oil), null);
  // A day apart, the same tanker kind and sea are two incidents.
  const late = card("18T07:00", "Tasnim", "IRGC Navy: oil tanker hit a mine in Strait of Hormuz", { type: "vessel" });
  assert.equal(foldRule(oil, late), null);
});

test("one district's dead, the count one apart, are one contested card when the sides blame each other", () => {
  const out = served([
    card("17T09:37", "Aden al-Ghad", "Taiz local authorities: Houthi shelling on Maqbanah kills 8 and wounds 6", { type: "combat" }),
    card("17T14:18", "Khabar Agency", "9 killed, including women and children, and 16 wounded in Saudi coalition air strikes in Maqbanah district in Taiz", { type: "strike", place: "Maqbanah" }),
    card("17T15:40", "Yemen Press Agency", "Nine killed, 16 injured in Saudi airstrikes on Taiz homes", { type: "strike", place: "Maqbanah" }),
    card("17T17:20", "Al-Masirah", "9 killed in Saudi airstrikes on Taiz"),
    card("17T14:15", "Almashhad", "14 killed or wounded in coalition air strikes in Maqbanah, Taiz", { type: "strike" }),
    card("17T22:45", "Al-Araby Al-Jadeed", "Houthi shelling of Maqbanah district in Taiz kills 8 civilians", { type: "combat", place: "Maqbanah" }),
  ]);
  assert.equal(out.length, 1);
  assert.ok(out[0].flags?.includes("contested"));
  assert.match(String(out[0].text), /Told otherwise by Khabar Agency/);
});

test("tolls are read as told: totals, the wounded, one shepherd; opposite dead are two events", () => {
  assert.deepEqual(tollOf("Houthi foreign ministry reports nine killed and 16 injured in Saudi airstrikes"), { dead: [9], hurt: [16], total: [] });
  assert.deepEqual(tollOf("Saudi air strikes kill and wound 25 in Maqbanah and three in Dhubab, Taiz"), { dead: [], hurt: [], total: [25] });
  assert.deepEqual(tollOf("Houthi mortar attack kills civilian shepherd in Al-Madaribah district of Lahj").dead, [1]);
  // Madaribah and Mudaribah are one district.
  const a = card("17T22:32", "Khabar Agency", "Houthi shelling kills shepherd in Al-Mudaribah district of Lahj", { type: "combat" });
  const b = card("17T23:40", "Khabar Agency", "Houthi mortar attack kills civilian shepherd in Al-Madaribah district of Lahj", { type: "combat" });
  assert.equal(foldRule(a, b), "dead");
  // Two civilians wounded in Shada, as Shadaa Directorate.
  assert.equal(foldRule(card("17T10:00", "South24", "Saudi fire wounds two citizens in Shada district in Saada", { type: "combat" }), card("17T11:00", "South24 English", "Two civilians injured in Saudi fire in Shadaa Directorate", { type: "combat" })), "dead");
  // Eight Houthi fighters and eight soldiers in one governorate are two events.
  const x = card("17T18:39", "Ali al-Sakani", "Al-Subayhah tribesmen kill 8 Houthi fighters in Lahj ambush", { type: "combat", place: "Lahj" });
  const y = card("18T01:04", "Anadolu Ajansı", "Eight Yemeni soldiers killed on al-Maqatirah front in Lahj province", { type: "combat", place: "Lahj" });
  assert.equal(foldRule(x, y), null);
  // More than twelve hours apart are two.
  assert.equal(foldRule(card("17T08:00", "A", "Houthi shelling of Maqbanah district in Taiz kills 8 civilians", { type: "combat" }), card("17T21:00", "B", "Houthi shelling on Maqbanah district in Taiz kills 8", { type: "combat" })), null);
});

test("one blast at a PMF depot in Baghdad is one card, whatever its toll", () => {
  const out = served([
    card("17T15:14", "Tasnim", "Explosion at Popular Mobilization Forces arms depot east of Baghdad causes no human casualties"),
    card("17T15:18", "Tasnim", "Explosion occurred in eastern Baghdad"),
    card("17T15:48", "Reuters", "Security sources for Reuters: One killed in explosion at weapons warehouse in Baghdad", { type: "combat" }),
    card("17T16:03", "LBCI", "One killed, four injured in explosion at Popular Mobilisation Forces headquarters in Iraq"),
    card("17T21:40", "Reuters", "Explosion at Iraqi paramilitary alliance base kills one member, sources say", { type: "combat" }),
  ]);
  assert.equal(out.length, 1);
});

test("one article on a mirror host is one card", () => {
  assert.equal(mirrorKey("https://ns1.khabaragency.net/news254459.html"), mirrorKey("https://en.khabaragency1.net/news254459.html"));
  assert.equal(mirrorKey("https://www.khabaragency.net/news254459.html"), "khabaragency/news254459.html");
  assert.equal(mirrorKey("https://www.khabaragency.net/"), "");
  assert.equal(mirrorKey("https://t.me/khabar/254459"), "");
  const out = served([
    card("17T15:18", "Khabar Agency", "Houthi shelling on Maqbanah district in Taiz kills 8 and wounds 6", { type: "combat", url: "https://ns1.khabaragency.net/news254459.html" }),
    card("17T15:18", "Khabar Agency", "Houthi shelling on Maqbanah district in Taiz kills 8 and wounds 6 people", { type: "combat", url: "https://en.khabaragency1.net/news254459.html" }),
  ]);
  assert.equal(out.length, 1);
});

test("one channel's same headline is dropped; another outlet's within hours joins", () => {
  const a = card("17T09:00", "Unews", "Israeli artillery shells Wadi al-Saluqi in south Lebanon", { type: "strike" });
  const b = card("17T15:00", "Unews", "Israeli artillery shells Wadi al-Saluqi in south Lebanon.", { type: "strike" });
  assert.equal(foldRule(a, b), "own-headline");
  const out = served([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0].alsoReportedBy, undefined);
  const c = card("17T10:00", "Saba (government)", "Taiz local authority condemns Houthi blockade on water tankers");
  const d = card("17T13:00", "Aden al-Ghad", "Taiz local authority condemns Houthi blockade on water tankers");
  assert.equal(foldRule(c, d), "headline");
});

test("one city site attacked is one card, not the flights resuming after", () => {
  const out = served([
    card("17T08:00", "Al-Ayyam", "Houthi forces fire two missiles at Aden International Airport", { type: "strike" }),
    card("17T08:20", "Asharq Al-Awsat", "Yemeni Transport Ministry: two Houthi ballistic missiles land inside Aden International Airport", { type: "strike" }),
    card("17T09:00", "Al Arabiya", "Aden airport resumes flights after temporary suspension from Houthi attack", { type: "economy" }),
  ]);
  assert.equal(out.length, 2);
});

test("one rare figure or sum told by several outlets is one card", () => {
  const out = served([
    card("17T04:50", "Crater Sky", "Yemeni government forces report 1,292 operations against Houthi forces in 24 hours", { type: "combat" }),
    card("17T22:25", "Al-Ayyam", "Yemeni government forces report 1,292 strikes against Houthi targets in 24 hours", { type: "strike" }),
    card("16T20:00", "Tasnim", "Iraq estimates economic losses from US-Iran escalation at USD 60 billion", { type: "economy" }),
    card("17T01:00", "IRNA", "Iraq lost $60 billion in US-Iran war", { type: "economy" }),
  ]);
  assert.equal(out.length, 2);
});

test("folding at read leaves the stored cards as they were", () => {
  const a = card("17T10:32", "ILNA", "Araghchi says Iran will not negotiate under threat");
  const b = card("17T10:47", "Al-Alam", "Araghchi: Insecurity in Hormuz due to US and Israeli attacks since war began");
  const out = foldServed([a, b]);
  assert.equal(out.reports.length, 1);
  assert.equal(out.into.get(b.fp), a.fp);
  assert.equal(a.text, "");
  assert.equal(a.alsoReportedBy, undefined);
});

test("a new card is folded as it is written: a relay of the speaker's remarks joins the stored card", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const base = { live: true, score: 1, tags: [] } as const;
  const home = { ...base, fp: "home", url: "https://t.me/alalam/1", source: "Al-Alam", at: "2026-10-16T17:36:00Z", type: "statement", summary: "Khatibzadeh: Washington's path has reached a dead end", text: "" };
  const relay = { ...base, fp: "relay", url: "https://t.me/mayadeen/2", source: "Al Mayadeen", at: "2026-10-16T17:50:00Z", type: "statement", summary: "Khatibzadeh: War proved US and its regional bases aim to protect Israel", text: "" };
  const reports = [relay] as never[];
  const touched = foldIntoPublished(reports, new Set(), [home] as never[]);
  assert.equal((reports as unknown[]).length, 0);
  assert.equal((touched[0] as { fp: string }).fp, "home");
  assert.match(home.text, /War proved US and its regional bases aim to protect Israel/);
  // And a ship incident told again an hour later by another outlet.
  const ship = { ...base, fp: "ship", url: "https://www.ukmto.org/1", source: "UKMTO", at: "2026-10-17T14:37:00Z", type: "vessel", summary: "UKMTO reports small boat fires two shots at LNG tanker 140 miles southeast of Al-Mukalla", text: "" };
  const again = { ...base, fp: "again", url: "https://t.me/sawt/3", source: "Sawt al-Asima", at: "2026-10-17T15:23:00Z", type: "economy", summary: "Armed men in small boat fire on LNG tanker off Hadramawt coast", text: "" };
  const fresh = [again] as never[];
  foldIntoPublished(fresh, new Set(), [ship] as never[]);
  assert.equal((fresh as unknown[]).length, 0);
});
