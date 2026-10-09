/**
 * The 9 Oct review of both desks' live cards: each rule here is a card that
 * broke one of the desk's rules, and the cards that must stay apart.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { desksOf } from "./desk-route.ts";
import { outletFromHost } from "./gnews.ts";
import { rivalRelay } from "./speaker-press.ts";
import { iranCopyProblem } from "./iran-reader.ts";
import { tidySpeaker } from "./reader.ts";
import { oneEventTwoTypes, ownRetelling, sameRareFigure, sameStrikeAbroad } from "./copies.ts";
import type { LiveReport } from "./types.ts";

const card = (o: Partial<LiveReport>): LiveReport => ({ fp: "x", at: "2026-10-09T01:21:00Z", source: "Yemen Monitor", url: "https://x/1", type: "statement", summary: "", text: "", live: true, ...o }) as LiveReport;

test("Iran's war alone is not kept by the Yemen reader; Iran in the body alone does not take a card to the Iran desk", () => {
  assert.deepEqual(desksOf(card({ summary: "US officials: US military preparing plans and options to resume large-scale combat operations against Iran", text: "Washington is weighing a wider campaign." })), []);
  assert.deepEqual(desksOf(card({ summary: "Egypt rules out military intervention in Yemen war", text: "Cairo keeps channels open with Iran and all sides." })), ["yemen"]);
  assert.deepEqual(desksOf(card({ summary: "Iran's foreign ministry condemns the strikes on Sanaa" })), ["yemen", "iran"]);
});

test("a Google News item is named by its article's site, never 'Google News'", () => {
  assert.equal(outletFromHost("https://shafaq.com/en/Kurdistan/Iran-KRI-seek-faster-trade"), "Shafaq News");
  assert.equal(outletFromHost("https://english.news.cn/20261009/x/c.html"), "Xinhua");
  assert.equal(outletFromHost("https://news.ssbcrack.com/us-military-suffers"), "Ssbcrack");
  assert.equal(outletFromHost("https://news.google.com/rss/articles/abc"), "");
});

test("Iran's outlets on what the US, Israel or Britain said are relays, whatever the verb", () => {
  assert.match(rivalRelay("US Embassy in Israel warns Americans in Western Asia of possible flight disruptions", "Tasnim", "axis") ?? "", /the US/);
  assert.match(rivalRelay("IDF confirms Maj. Elyav Haim Tzlafmos killed in helicopter crash in south Lebanon", "Al-Alam", "axis") ?? "", /Israel/);
  assert.match(rivalRelay("US Democratic lawmaker asks Congress to cut short recess, end war against Iran", "Press TV", "axis") ?? "", /the US/);
  assert.match(rivalRelay("UK Maritime Trade Organisation: at least 15 tankers targeted in Hormuz", "Fars News", "axis") ?? "", /Britain/);
  // Not a teller: Israel's shelling as Lebanon's sources tell it, Iran's own words.
  assert.equal(rivalRelay("Israeli artillery strikes Wadi Zibqin in south Lebanon", "Al-Alam", "axis"), null);
  assert.equal(rivalRelay("Iran's acting defence minister warns US against miscalculation", "Press TV", "axis"), null);
});

test("the Iran desk's economy is the war's economy, and a little-known speaker is named by job", () => {
  assert.match(iranCopyProblem({ headline: "French Power Prices Exceed €100 for First Time Since 2023", event_type: "economy" }, "") ?? "", /^not iran/);
  assert.match(iranCopyProblem({ headline: "Subsidy Management Organisation: 392 trillion rials paid to wheat farmers", event_type: "economy" }, "") ?? "", /^not iran/);
  assert.equal(iranCopyProblem({ headline: "Brent holds above $100 as Hormuz tanker traffic hits two-month low", event_type: "economy" }, ""), null);
  assert.match(iranCopyProblem({ headline: "Meade McLoughlin: Sanctions have always forced the Islamic Republic to the negotiating table", event_type: "statement", speaker_lead: "Meade McLoughlin" }, "") ?? "", /^unfamiliar name/);
  assert.equal(iranCopyProblem({ headline: "Abbas Araghchi: Iran will not negotiate under threat", event_type: "statement", speaker_lead: "Abbas Araghchi" }, ""), null);
});

test("the speaker is named once, by job when not widely known, and on the right side", () => {
  assert.equal(tidySpeaker("Iran MP Zanganeh: Iran MP rejects claim 110 hectares ceded to Afghanistan"), "Iran MP rejects claim 110 hectares ceded to Afghanistan");
  assert.equal(tidySpeaker("WHO representative in Yemen Dr. Syed Jaffar Hussain: WHO warns of critical funding gap"), "WHO warns of critical funding gap");
  assert.equal(tidySpeaker("Iraqi journalist Mustafa Kamil: secret talks under way on Houthi handover of Sanaa"), "Iraqi journalist: secret talks under way on Houthi handover of Sanaa");
  assert.equal(tidySpeaker("Military attaché in Jordan Brigadier General Yahya Abu Hatem: capturing Kahbub shows skill"), "Military attaché in Jordan: capturing Kahbub shows skill");
  assert.equal(tidySpeaker("Houthi Armed Forces spokesperson: Coalition intercepts three Houthi ballistic missiles"), "Coalition intercepts three Houthi ballistic missiles");
  // Left as they are.
  assert.equal(tidySpeaker("Iran's foreign ministry: Iranian people reject US pressure"), "Iran's foreign ministry: Iranian people reject US pressure");
  assert.equal(tidySpeaker("Houthi Armed Forces spokesperson: Houthi forces hit Riyadh airport"), "Houthi Armed Forces spokesperson: Houthi forces hit Riyadh airport");
  assert.equal(tidySpeaker("Giants Brigades commander Hamdi Shukri: forces advance in Taiz"), "Giants Brigades commander Hamdi Shukri: forces advance in Taiz");
});

test("one strike abroad told by many outlets is one card; a new strike or another striker is not", () => {
  const a = { type: "strike", summary: "Explosions heard at Iranian opposition sites in Erbil, Iraqi Kurdistan" };
  assert.ok(sameStrikeAbroad(a, { type: "strike", summary: "Two drones target Iranian Kurdish refugee camp in Erbil, Iraqi Kurdistan" }));
  assert.ok(sameStrikeAbroad(a, { type: "strike", summary: "Iranian drones strike terrorist targets in Rizgary, Erbil, Iraqi Kurdistan" }));
  assert.ok(!sameStrikeAbroad(a, { type: "strike", summary: "New drone attack hits Erbil airport" }));
  assert.ok(!sameStrikeAbroad({ type: "strike", summary: "Israeli strikes hit Tehran's Mehrabad airport" }, { type: "strike", summary: "US strikes hit Tehran oil depot" }));
  assert.ok(!sameStrikeAbroad(a, { type: "statement", summary: "Kurdish party condemns attack in Erbil" }));
});

test("an outlet telling its own story again is one card; its two statements on two things are two", () => {
  assert.ok(ownRetelling(
    { type: "statement", at: "2026-10-09T06:05:00Z", summary: "Iraqi security source: Popular Mobilisation Forces set up unit to take over armed groups' drones" },
    { type: "statement", at: "2026-10-09T07:21:00Z", summary: "Iraqi security source: PMF unit takes over armed factions' drones, three of five factions hand over heavy weapons" },
  ));
  assert.ok(ownRetelling(
    { type: "economy", at: "2026-10-09T03:30:00Z", summary: "UAE food retailers charter own vessels, shift sourcing to Asia to bypass Hormuz disruption" },
    { type: "economy", at: "2026-10-09T05:13:00Z", summary: "UAE food retailers build own supply chain to bypass Hormuz disruption" },
  ));
  assert.ok(!ownRetelling(
    { type: "statement", at: "2026-10-08T19:00:00Z", summary: "Houthi government spokesperson urges nations to avoid involvement in Yemen war" },
    { type: "statement", at: "2026-10-08T20:42:00Z", summary: "Houthi government spokesperson warns airlines to avoid Saudi airports" },
  ));
  assert.ok(!ownRetelling(
    { type: "statement", at: "2026-10-08T09:40:00Z", summary: "Navigation sources rank Riyadh airport first globally among most disrupted airports" },
    { type: "statement", at: "2026-10-08T09:44:00Z", summary: "Navigation sources report continued closure of Riyadh airport" },
  ));
  // A channel's strikes on one district two hours apart are two strikes.
  assert.ok(!ownRetelling(
    { type: "strike", at: "2026-10-08T09:00:00Z", summary: "Saudi air strikes hit Al-Safra district in Saada" },
    { type: "strike", at: "2026-10-08T11:00:00Z", summary: "Saudi air strikes hit Al-Safra district in Saada" },
  ));
});

test("one event two readers typed apart is one card; another place or a reaction is not", () => {
  assert.ok(oneEventTwoTypes(
    { type: "combat", summary: "Police commander killed in armed attack in Faryab, Kerman province" },
    { type: "statement", summary: "Kerman police chief: prevention police commander in Faryab killed in armed attack by terrorist elements" },
  ));
  assert.ok(!oneEventTwoTypes({ type: "statement", summary: "Missile launcher identified in Jabal Ras, Hodeidah" }, { type: "strike", summary: "Missile launcher spotted near Hays in Hodeidah" }));
  assert.ok(!oneEventTwoTypes(
    { type: "strike", summary: "Houthi missile attacks strike Riyadh airport and Abha airport" },
    { type: "statement", summary: "Algeria condemns Houthi missile attack on Abha airport that killed Algerian citizen" },
  ));
  assert.ok(!oneEventTwoTypes(
    { type: "statement", summary: "Trump says US will not attack Iran before November midterm elections" },
    { type: "economy", summary: "Oil prices ease after Trump rules out Iran attack before US midterms" },
  ));
});

test("one claim told again with its rare figure is one card", () => {
  assert.ok(sameRareFigure(
    { summary: "Yemeni government forces report 1,729 new targeting operations against Houthi positions" },
    { summary: "Yemeni government forces say they carried out 1,729 precision strikes against Houthi military targets" },
  ));
  assert.ok(!sameRareFigure({ summary: "86 flights cancelled at Riyadh airport" }, { summary: "86 flights cancelled at Jeddah airport" }));
  assert.ok(!sameRareFigure({ summary: "Brent closes at $104 as Hormuz traffic falls" }, { summary: "Gold rises to $2026 an ounce" }));
});

test("the reader's word that a report is a duplicate holds only when the words or the spot agree", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const home = { ...base, fp: "a", url: "https://almashhad.news/1", source: "Almashhad", at: "2026-10-09T04:00:00Z", type: "statement", summary: "Yemeni government forces report 1,729 operations against Houthi targets" };
  const other = { ...base, fp: "b", url: "https://yemenmonitor.com/2", source: "Yemen Monitor", at: "2026-10-09T05:00:00Z", type: "combat", summary: "Houthi forces execute teacher in Jabal Habashi district of Taiz", duplicateOf: "a" };
  const reports = [home, other] as never[];
  foldIntoPublished(reports, new Set(["a"]));
  assert.equal(reports.length, 2);
});

test("a card already saved is never folded again, so its headline never lands on another card", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const home = { ...base, fp: "a", url: "https://t.me/almasirah2/302281", source: "Al-Masirah", at: "2026-10-08T14:00:00Z", type: "statement", summary: "Harib tribes declare mobilisation against the Saudi blockade" };
  const saved = { ...base, fp: "b", url: "https://www.adngad.net/news/887370", source: "Aden al-Ghad", at: "2026-10-08T14:10:00Z", type: "statement", summary: "Arhab tribal leaders declare mobilisation to support government forces", flags: ["exclusive"] };
  const reports = [home, { ...saved }] as never[];
  foldIntoPublished(reports, new Set(["a"]), [saved] as never[]);
  assert.equal((home as { summary: string }).summary, "Harib tribes declare mobilisation against the Saudi blockade");
  assert.equal(reports.length, 2);
});

test("the Iran desk's share of the site scan: Gulf sea incidents, America's officials traced at home, a third country's aside out (user, 9 Oct evening)", async () => {
  const { isIranDeskItem, thirdCountryAside } = await import("./iran-reader.ts");
  const { speakerOf, speakerByName } = await import("./speakers.ts");
  // UKMTO's Hormuz-side warnings, as read off their pictures.
  assert.equal(isIranDeskItem("UKMTO WARNING 150-26 - ATTACK. UKMTO has received a report of an incident 13NM east of Fujairah, UAE. A vessel has been hit by an unknown projectile."), true);
  assert.equal(isIranDeskItem("UKMTO WARNING 151-26. The master reports a small craft approached the vessel 20NM north of Musandam, Oman."), true);
  assert.equal(isIranDeskItem("UKMTO WARNING 147-26 - ATTACK. UKMTO has received a report of an incident 40NM west of Hodeidah, Yemen."), false);
  // Bessent's words are looked for in America's own press; an unlisted official by his title too.
  assert.equal(speakerOf("Bessent: US running 'absolute isolation campaign' against Iran")?.name, "Scott Bessent");
  const sen = speakerOf("US Senator Jim Risch said Iran must end its blockade of Hormuz");
  assert.equal(sen?.name, "Jim Risch");
  assert.equal(sen?.country, "US");
  assert.equal(speakerByName("Jim Risch")?.name, "Jim Risch");
  // Erdogan on Israel, nothing of this war: out. His words on Iran: in.
  const erd = "Erdogan: Israel sees peace and regional security as a threat to itself";
  assert.equal(thirdCountryAside(erd, `${erd} Turkish President Recep Tayyip Erdogan said Israel sees peace as a threat.`), true);
  const erd2 = "Erdogan: Turkey will not allow an attack on Iran from its soil";
  assert.equal(thirdCountryAside(erd2, erd2), false);
  assert.equal(thirdCountryAside("Araghchi: talks are over", "Araghchi: talks are over"), false);
});

test("Iran's opposition outlets retelling America or Britain are relays; Al Mayadeen on Iran is not (user, 9 Oct evening)", () => {
  assert.match(rivalRelay("Bessent: US running 'absolute isolation campaign' against Iran", "Iran International", "opposition") ?? "", /relay/);
  assert.match(rivalRelay("UKMTO: vessel hit by unknown projectile 13 miles off UAE", "Iran International", "opposition") ?? "", /relay/);
  assert.equal(rivalRelay("IRGC: a tanker was seized in the Gulf of Oman", "Al Mayadeen", "axis"), null);
  assert.equal(rivalRelay("Araghchi: no talks under the blockade", "Al Mayadeen", "axis"), null);
});

test("a verdict on a claim names its teller, never the desk's (user, 9 Oct: Jabal Habashi)", async () => {
  const { attributeVerdict } = await import("./reader.ts");
  assert.equal(attributeVerdict("Houthi claims of controlling Jabal Habashi are false", "gov"), "Pro-government source: Houthi claims of controlling Jabal Habashi are false");
  assert.equal(attributeVerdict("Army spokesman: Houthi claims of controlling Jabal Habashi are false", "gov"), "Army spokesman: Houthi claims of controlling Jabal Habashi are false");
  assert.equal(attributeVerdict("Government denies Houthi claims of controlling Jabal Habashi", "gov"), "Government denies Houthi claims of controlling Jabal Habashi");
  assert.equal(attributeVerdict("Houthi forces take Jabal Habashi", "houthi"), "Houthi forces take Jabal Habashi");
});
