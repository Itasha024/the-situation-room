import assert from "node:assert/strict";
import test from "node:test";
import { actorOf, combineGroups, combineProblem, members, pickLead, placesOf, planWaves, toWritten, waveKey, type Group } from "./combine.ts";
import { PLACE_BY_NAME } from "./gazetteer.ts";
import type { LiveReport } from "./types.ts";

const at = (min: number) => new Date(Date.parse("2026-09-24T20:00:00Z") + min * 60_000).toISOString();
function card(fp: string, source: string, summary: string, place: string, min = 0, type: LiveReport["type"] = "strike"): LiveReport {
  const p = PLACE_BY_NAME[place];
  return { fp, source, summary, text: "", url: `https://t.me/${fp}`, at: at(min), type, live: true, place, lat: p?.lat, lng: p?.lng };
}
const one = (r: LiveReport): Group => ({ lead: r, others: [] });
const rank = (r: LiveReport) => (r.source === "Yahya Saree" ? 100 : 0) + r.summary.length / 1000;

const wave = [
  card("a", "Al-Masirah", "Houthi missile targets Jazan", "Jazan", 0),
  card("b", "Al Arabiya", "Saudi air defences intercept a missile over Najran", "Najran", 12),
  card("c", "Yahya Saree", "Houthis say they fired 2 drones at Yanbu", "Yanbu", 25),
];

test("a wave on Saudi Arabia from three outlets is one card: three places, the speaker's channel leads, two under Also", async () => {
  assert.equal(waveKey(wave[1]), "houthi|SA");
  const plans = planWaves(wave.map(one));
  assert.equal(plans.length, 1);
  assert.equal(plans[0].length, 3);
  const ask = async () => ({
    headline: "Houthis fire missiles and 2 drones at Jazan, Najran and Yanbu; Saudi air defences intercept one over Najran",
    body: "",
  });
  const { groups, written, tried } = await combineGroups(plans, ask, rank);
  assert.equal(tried, 1);
  assert.equal(written, 1);
  assert.equal(groups.length, 1);
  const [g] = groups;
  assert.equal(g.lead.source, "Yahya Saree");
  assert.deepEqual(g.others.map((o) => o.source).sort(), ["Al Arabiya", "Al-Masirah"]);
  assert.deepEqual(g.lead.places?.map((p) => p.name).sort(), ["Jazan", "Najran", "Yanbu"]);
  assert.ok(g.lead.tags?.includes("combined"));
});

test("no model, or a write-up that drops a place or a figure: the wave is split back into its cards", async () => {
  const plans = planWaves(wave.map(one));
  const none = await combineGroups(plans, async () => null, rank);
  assert.equal(none.groups.length, 3);
  const dropped = await combineGroups(plans, async () => ({ headline: "Houthis fire missiles at Jazan and Najran", body: "" }), rank);
  assert.equal(dropped.groups.length, 3);
  assert.match(combineProblem({ headline: "Houthis fire drones at Jazan, Najran and Yanbu", body: "" }, wave, placesOf(wave)), /figures left out: 2/);
});

test("different areas, different sides and clashes are never one wave", () => {
  const marib = card("m", "Saba", "Saudi air strike hits Marib", "Marib", 5);
  const taiz = card("t", "Al-Mihwar", "Houthi shelling hits Taiz", "Taiz", 5);
  const clash = card("k", "Al-Mihwar", "Clashes in Sirwah", "Sirwah", 6, "combat");
  assert.equal(waveKey(clash), null);
  assert.equal(actorOf(taiz), "houthi");
  assert.equal(actorOf(card("x", "Saba", "Houthis say Saudi shelling hits Marib", "Marib")), "saudi");
  const plans = planWaves([wave[0], marib, taiz, clash].map(one));
  assert.equal(plans.length, 4);
});

test("a wave is what one scan found, however far apart; a card an earlier scan published never joins", () => {
  const late = card("l", "Al-Masirah", "Houthi missile targets Najran", "Najran", 200);
  assert.equal(planWaves([wave[0], late].map(one)).length, 1);
  assert.equal(planWaves([wave[0], late].map(one), (r) => r.fp !== "a").length, 2);
});

test("a card an earlier scan published keeps its text: a later account of it is only Also", async () => {
  const a = card("p", "Al Jazeera", "Air strike hits Marib, killing 3", "Marib", 0);
  const b = card("q", "Al Arabiya", "Strike in Marib kills 3 and wounds 5", "Marib", 4);
  let calls = 0;
  const ask = async () => ((calls += 1), { headline: "Air strike in Marib kills 3 and wounds 5", body: "" });
  const { groups, written, tried } = await combineGroups([[{ lead: a, others: [b] }]], ask, rank, undefined, (r) => r.fp !== "p");
  assert.equal([calls, written, tried].join(), "0,0,0");
  assert.equal(groups[0].lead.summary, "Air strike hits Marib, killing 3");
  assert.equal(groups[0].others.length, 1);
});

test("the speaker's own channel leads over a relay of his words", () => {
  const relay = card("r", "Naya", "Yahya Saree: forces fired a ballistic missile at Jazan in a long quoted relay", "Jazan");
  const own = card("s", "Yahya Saree", "Forces fired a missile at Jazan", "Jazan", 1);
  const g = pickLead([relay, own], rank);
  assert.equal(g.lead.source, "Yahya Saree");
  assert.equal(members(g).length, 2);
});

test("one event from two outlets is written once; one outlet alone is left as it is", async () => {
  const a = card("p", "Al Jazeera", "Air strike hits Marib, killing 3", "Marib", 0);
  const b = card("q", "Al Arabiya", "Strike in Marib kills 3 and wounds 5", "Marib", 4);
  const alone = card("z", "Saba", "Statement on talks", "Marib", 0, "statement");
  const ask = async () => ({ headline: "Air strike in Marib kills 3 and wounds 5", body: "" });
  const { groups, written } = await combineGroups([[{ lead: a, others: [b] }], [one(alone)]], ask, rank);
  assert.equal(written, 1);
  assert.equal(groups.find((g) => g.lead.fp === "p")?.lead.summary, "Air strike in Marib kills 3 and wounds 5");
  assert.equal(groups.find((g) => g.lead.fp === "z")?.lead.summary, "Statement on talks");
});

test("a written headline that ends by naming an outlet loses the attribution", () => {
  const a = card("y", "Reuters", "War risk premiums rise for tankers in Yanbu", "Yanbu");
  const b = card("w", "Al-Masirah", "Insurance up for tankers docking in Yanbu", "Yanbu", 2);
  const w = toWritten({ headline: "War risk premiums for tankers docking in Yanbu rise to about 3%, says Al-Masirah", body: "" }, [a, b], placesOf([a, b]));
  assert.equal(w?.headline, "War risk premiums for tankers docking in Yanbu rise to about 3%");
});

test("a merged card of one-line posts is its headline, with no spelling notes (Kahbub, 25 Sep 08:34)", () => {
  const a = card("k1", "Ali Bk", "Fierce clashes between Houthi forces and pro-Saudi forces in the Kahbub mountains and on the Al-Aghabrah front", "Kahbub");
  const b = card("k2", "The Cube", "Heavy clashes continue between Houthi forces and government forces along Khaboub and Jabal Aghbar fronts", "Kahbub", 2);
  const w = toWritten(
    {
      headline: "Fierce clashes have broken out between Houthi forces and pro-Saudi forces in the Kahbub mountains and the Al-Aghabrah front between Taiz and Lahj governorates",
      body: "The fighting involved Houthi forces and Saudi-backed forces in the Kahbub mountains and the Al-Aghabrah front, which is also spelled Al-Aghbarah.",
    },
    [a, b],
    placesOf([a, b]),
  );
  assert.equal(w?.body, "");
});
