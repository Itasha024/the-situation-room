import { test } from "node:test";
import assert from "node:assert/strict";
import { mergedControl, sideNow, updateControlLive } from "./control-live.ts";

const card = (fp: string, source: string, summary: string, lat: number, lng: number, extra: Record<string, unknown> = {}) =>
  ({ fp, source, summary, lat, lng, live: true, text: "", type: "combat", url: `https://x/${fp}`, at: "2026-09-24T05:00:00Z", ...extra }) as never;
const NOW = new Date("2026-09-24T12:00:00Z");

test("a town taken, told by outlets from both sides, changes hands", () => {
  const live = updateControlLive(null, [
    card("a", "Al Arabiya", "Government forces take Al-Hazm town after heavy fighting", 16.2, 44.8),
    card("b", "Al-Masirah", "Army of the government seize Al-Hazm city, Houthi forces withdraw", 16.21, 44.84),
  ], NOW);
  assert.equal(sideNow("al-hazm", "YE-JA", null), "houthi");
  assert.equal(live.districts["al-hazm"].side, "plc");
  assert.equal(live.changes[0].from, "houthi");
  assert.equal(live.districts["al-hazm"].src.length, 2);
});

test("one side's claim, or ground short of the town, makes a district contested", () => {
  const oneSide = updateControlLive(null, [
    card("a", "Al Arabiya", "Government forces take Al-Hazm town", 16.2, 44.8),
    card("b", "Al Arabiya", "Government forces enter and take Al-Hazm city", 16.21, 44.84),
  ], NOW);
  assert.equal(oneSide.districts["al-hazm"].side, "contested");
  // Already contested by hand: one side's claim changes nothing.
  const already = updateControlLive(null, [card("e", "Al-Masirah", "Houthi forces take Hayjat al-Abd and cut the Taiz-Aden road", 13.134, 44.147)], NOW);
  assert.equal(already.districts["al-maqatirah"], undefined);
  // A wire confirms, but only positions were taken: contested, not lost.
  const positions = updateControlLive(null, [card("c", "Reuters", "Houthi forces capture positions near Harib", 14.9, 45.4)], NOW);
  assert.equal(sideNow("harib", "YE-MA", null), "houthi");
  assert.equal(positions.districts.harib, undefined, "the captor already holds it");
  const gov = updateControlLive(null, [card("d", "Reuters", "Government forces capture positions near Harib", 14.9, 45.4)], NOW);
  assert.equal(gov.districts.harib.side, "contested");
});

test("both sides claiming ground makes it contested; a contested district goes back under the taken rule", () => {
  const both = updateControlLive(null, [
    card("a", "Al Arabiya", "Government forces take Al-Hazm town", 16.2, 44.8),
    card("b", "Al-Masirah", "Houthi forces retake Al-Hazm town", 16.2, 44.8),
  ], NOW);
  assert.equal(both.districts["al-hazm"].side, "contested");
  const back = updateControlLive(both, [card("c", "Reuters", "Houthi forces take Al-Hazm town, the provincial capital", 16.2, 44.8, { side: "agency" })], NOW);
  assert.equal(back.districts["al-hazm"].side, "houthi");
  assert.equal(back.changes.length, 2);
});

test("a merged card's other outlets count, and a repelled attack changes nothing", () => {
  const merged = updateControlLive(null, [
    card("a", "Naya", "Houthi forces take Al-Khukhah town", 13.84, 43.34, { alsoReportedBy: [{ source: "Al Arabiya", url: "u" }] }),
  ], NOW);
  assert.equal(sideNow("al-khukhah", "YE-HU", null), "houthi");
  assert.equal(merged.districts["al-khukhah"], undefined);
  const repelled = updateControlLive(null, [card("b", "Al Arabiya", "Government forces repel a Houthi attempt to take Al-Ashbut", 13.134, 44.147)], NOW);
  assert.deepEqual(repelled.districts, {});
});

test("the writers get the baseline with the live layer over it", () => {
  const live = updateControlLive(null, [card("a", "Reuters", "Government forces take Al-Hazm town", 16.2, 44.8, { side: "agency" })], NOW);
  const rows = mergedControl(live);
  assert.equal(rows.find((r) => r.id === "al-hazm")?.side, "plc");
  assert.equal(rows.find((r) => r.id === "al-makha")?.side, "houthi");
});
