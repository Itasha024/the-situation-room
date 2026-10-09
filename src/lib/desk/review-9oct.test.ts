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
