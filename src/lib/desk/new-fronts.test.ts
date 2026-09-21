import assert from "node:assert/strict";
import test from "node:test";
import { updateExtraFronts, type ExtraFront } from "./new-fronts.ts";
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
