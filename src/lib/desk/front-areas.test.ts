import assert from "node:assert/strict";
import { test } from "node:test";
import { frontIdsOf, inFrontArea } from "./brief.ts";
import { trackedAt, trackedOf } from "./front-areas.ts";
import { type ExtraFront, updateExtraFronts } from "./new-fronts.ts";
import type { LiveReport } from "./types.ts";

const card = (o: Partial<LiveReport>): LiveReport =>
  ({ fp: "t", at: "2026-09-30T08:00:00Z", source: "Test", type: "combat", summary: "", text: "", ...o }) as LiveReport;

test("a point's front is its district's area or its governorate's front", () => {
  assert.equal(trackedAt(12.94, 43.645), "bab"); // Kahbub, Dhubab district
  assert.equal(trackedAt(12.63, 44.1), "bab"); // the Lahj coast facing the strait
  assert.equal(trackedAt(12.65, 43.42), "bab"); // Perim, in the strait
  assert.equal(trackedAt(13.32, 43.25), "red-sea-coast"); // Mocha
  assert.equal(trackedAt(14.8, 42.95), "red-sea-coast"); // Hodeidah city
  assert.equal(trackedAt(14.5, 42.5), "red-sea-coast"); // the sea off Hodeidah
  assert.equal(trackedAt(13.174, 43.73), "west-taiz"); // Al-Wazi'iyah
  assert.equal(trackedAt(13.05, 44.88), "lahj"); // Tuban
  assert.equal(trackedAt(15.46, 45.32), "marib");
  assert.equal(trackedAt(16.89, 42.57), "saudi-home"); // Jazan
  assert.equal(trackedAt(16.94, 43.76), null); // Saada: no tracked front
});

test("a pinned card goes by its pin, not the governorates it names", () => {
  // 30 Sep: a Kahbub card naming Taiz and Lahj landed on the Marib and Al-Dhale maps.
  const r = card({ place: "Kahbub", lat: 12.94, lng: 43.645, summary: "Clashes on the Kahbub heights between Taiz and Lahj; reinforcements from Marib" });
  assert.equal(trackedOf(r), "bab");
  assert.deepEqual(frontIdsOf(r), ["bab"]);
});

test("a card with no sharp pin goes by the one front it names, or none", () => {
  assert.equal(trackedOf(card({ place: "Taiz", lat: 13.58, lng: 44.02, summary: "Houthi shelling on Mocha's outskirts, Taiz" })), "red-sea-coast");
  assert.equal(trackedOf(card({ summary: "Fighting in Marib and Al-Jawf" })), null);
  assert.equal(trackedOf(card({ summary: "Strikes reported in Al-Jawf" })), "jawf");
});

test("opened fronts are governorates, named after them", () => {
  const old: ExtraFront[] = [
    { id: "x-brom", name: "Brom", spot: [14.405, 49.018], places: ["Brom"], openedAt: "2026-09-23T00:00:00Z", lastActiveAt: "2026-09-29T00:00:00Z" },
    { id: "x-hayfan", name: "Hayfan", gov: "YE-TA", spot: [13.277, 44.256], places: ["Hayfan"], openedAt: "2026-09-25T00:00:00Z", lastActiveAt: "2026-09-29T00:00:00Z" },
    { id: "x-sanaa", name: "Sanaa", gov: "YE-SA", spot: [15.369, 44.191], places: ["Sanaa"], openedAt: "2026-09-25T00:00:00Z", lastActiveAt: "2026-09-29T00:00:00Z" },
  ];
  const next = updateExtraFronts([], old, (r) => trackedOf(r) !== null, new Date("2026-09-30T09:00:00Z"));
  assert.deepEqual(next.map((f) => [f.id, f.name]), [["x-hadramawt", "Hadramawt"], ["x-sanaa", "Sanaa"]]);
  // Any pin in Hadramawt joins it; Hayfan's reports are the Taiz front's.
  assert.deepEqual(frontIdsOf(card({ place: "Al-Mukalla", lat: 14.54, lng: 49.12 }), next), ["x-hadramawt"]);
  assert.deepEqual(frontIdsOf(card({ place: "Hayfan", lat: 13.277, lng: 44.256 }), next), ["west-taiz"]);
  assert.equal(inFrontArea([14.54, 49.12], "x-hadramawt", next), true);
  assert.equal(inFrontArea([15.46, 45.32], "x-hadramawt", next), false);
});
