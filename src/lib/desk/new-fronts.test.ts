import assert from "node:assert/strict";
import test from "node:test";
import { updateExtraFronts, whereOf, type ExtraFront } from "./new-fronts.ts";
import { cleanProse } from "./prose.ts";

const now = new Date("2026-09-22T00:00:00Z");
const r = (i: number, source: string, place = "Al-Bayda", lat = 13.99, lng = 45.57, hoursAgo = 3) =>
  ({ fp: `f${i}`, source, place, lat, lng, type: "combat", summary: `clash ${i}`, text: "", url: "u", at: new Date(now.getTime() - hoursAgo * 3600_000).toISOString() }) as never;

test("a cluster of fighting no tracked front covers opens a front", () => {
  const reports = [r(1, "A"), r(2, "B"), r(3, "A", "Al-Bayda", 14.02, 45.6), r(4, "C")];
  const out = updateExtraFronts(reports, [], () => false, now);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Al-Bayda");
  assert.equal(out[0].id, "x-al-bayda");
});

test("too few reports, one outlet, or a covered place opens nothing", () => {
  assert.equal(updateExtraFronts([r(1, "A"), r(2, "B"), r(3, "A")], [], () => false, now).length, 0);
  assert.equal(updateExtraFronts([r(1, "A"), r(2, "A"), r(3, "A"), r(4, "A")], [], () => false, now).length, 0);
  assert.equal(updateExtraFronts([r(1, "A"), r(2, "B"), r(3, "A"), r(4, "C")], [], () => true, now).length, 0);
});

test("an opened front closes after a quiet week", () => {
  const old: ExtraFront = { id: "x-al-bayda", name: "Al-Bayda", spot: [13.99, 45.57], places: ["Al-Bayda"], openedAt: "2026-09-01T00:00:00Z", lastActiveAt: "2026-09-14T00:00:00Z" };
  assert.equal(updateExtraFronts([], [old], () => false, now).length, 0);
  assert.equal(updateExtraFronts([r(1, "A")], [old], () => false, now)[0].lastActiveAt > old.lastActiveAt, true);
});

test("prose that mentions the desk or logging is thrown out", () => {
  assert.equal(cleanProse("The desk logged 12 strikes in the 12 hours to midnight across the fronts.", 5), "");
  assert.ok(cleanProse("Saudi jets struck Houthi positions in Al-Jawf, the Houthis said. Fighting continued west of Taiz.", 5).startsWith("Saudi jets"));
});

test("prose names people by role", () => {
  const t = cleanProse("Houthi spokesperson Brigadier General Yahya Saree said Saudi forces carried out 157 strikes. Abdul Malik al-Houthi said the war would widen.", 5);
  assert.equal(t, "The Houthi military spokesperson said Saudi forces carried out 157 strikes. The Houthi leader said the war would widen.");
});

test("the prose never writes about what was not reported; the rest of the paragraph stands", () => {
  const t = cleanProse("No new fighting was reported on the Taiz front. Government forces hold the city's western approaches after last week's advance.", 4);
  assert.equal(t, "Government forces hold the city's western approaches after last week's advance.");
  assert.equal(cleanProse("No fighting was reported in Marib over the period in question at all.", 4), "");
  assert.equal(cleanProse("One. Two strikes hit Saada. Three were reported. Four more. Five here.", 3).split(". ").length, 3);
});

test("two clusters in one governorate are one front with two spots; in two governorates, two fronts", () => {
  // Saada: Razih (16.93, 43.25) and Kitaf (17.02, 44.02), ~80 km apart.
  const razih = [r(1, "A", "Razih", 16.93, 43.25), r(2, "B", "Razih", 16.94, 43.26), r(3, "A", "Razih", 16.92, 43.24), r(4, "C", "Razih", 16.93, 43.25)];
  const kitaf = [r(5, "A", "Kitaf", 17.02, 44.02), r(6, "B", "Kitaf", 17.03, 44.03), r(7, "C", "Kitaf", 17.01, 44.01), r(8, "A", "Kitaf", 17.02, 44.02)];
  const one = updateExtraFronts([...razih, ...kitaf], [], () => false, now);
  assert.equal(one.length, 1);
  assert.equal(one[0].spots?.length, 2);
  assert.equal(one[0].name, "Saada");
  assert.deepEqual(one[0].places.sort(), ["Kitaf", "Razih"]);
  // Al-Bayda's cluster is another governorate: its own front.
  const two = updateExtraFronts([...razih, r(9, "A"), r(10, "B"), r(11, "A", "Al-Bayda", 14.02, 45.6), r(12, "C")], [], () => false, now);
  assert.equal(two.length, 2);
  // Fronts stored before merging, two in Saada, become one.
  const stored = updateExtraFronts([], [
    { id: "x-razih", name: "Razih", spot: [16.93, 43.25], places: ["Razih"], openedAt: "2026-09-20T00:00:00Z", lastActiveAt: "2026-09-21T00:00:00Z" },
    { id: "x-kitaf", name: "Kitaf", spot: [17.02, 44.02], places: ["Kitaf"], openedAt: "2026-09-21T00:00:00Z", lastActiveAt: "2026-09-21T12:00:00Z" },
  ], () => false, now);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].spots?.length, 2);
});

test("an opened front says where it is, as the hand-written fronts do", () => {
  const f: ExtraFront = { id: "x-al-dhaher", name: "Saada", spot: [16.95, 43.6], gov: "YE-SD", places: ["Al-Dhaher", "Razih", "Saada"], openedAt: "", lastActiveAt: "" };
  assert.equal(whereOf(f), "Saada governorate, the Houthis' northern heartland on the Saudi border: around Al-Dhaher and Razih");
  assert.equal(whereOf({ ...f, gov: "YE-XX", places: ["Brom"] }), "Around Brom");
});
