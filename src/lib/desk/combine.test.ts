import assert from "node:assert/strict";
import test from "node:test";
import { actorOf, combineGroups, combineProblem, members, pickLead, placesOf, planWaves, waveKey, type Group } from "./combine.ts";
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
  const { groups, written } = await combineGroups(plans, ask, rank);
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

test("different areas, different sides, clashes and cards hours apart are never one wave", () => {
  const marib = card("m", "Saba", "Saudi air strike hits Marib", "Marib", 5);
  const taiz = card("t", "Al-Mihwar", "Houthi shelling hits Taiz", "Taiz", 5);
  const clash = card("k", "Al-Mihwar", "Clashes in Sirwah", "Sirwah", 6, "combat");
  const late = card("l", "Al-Masirah", "Houthi missile targets Jazan", "Jazan", 200);
  assert.equal(waveKey(clash), null);
  assert.equal(actorOf(taiz), "houthi");
  assert.equal(actorOf(card("x", "Saba", "Houthis say Saudi shelling hits Marib", "Marib")), "saudi");
  const plans = planWaves([wave[0], marib, taiz, clash, late].map(one));
  assert.equal(plans.length, 5);
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
