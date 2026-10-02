import { test } from "node:test";
import assert from "node:assert/strict";
import { mergedControl, sideNow, tookWhole, updateControlLive } from "./control-live.ts";

const card = (fp: string, source: string, summary: string, lat: number, lng: number, extra: Record<string, unknown> = {}) =>
  ({ fp, source, summary, lat, lng, live: true, text: "", type: "combat", url: `https://x/${fp}`, at: "2026-09-24T05:00:00Z", ...extra }) as never;
const NOW = new Date("2026-09-24T12:00:00Z");

test("the whole district taken, told by outlets from both sides, changes hands", () => {
  const live = updateControlLive(null, [
    card("a", "Al Arabiya", "Government forces take full control of Al-Hazm district after heavy fighting", 16.2, 44.8),
    card("b", "Al-Masirah", "Army of the government drives Houthi forces out of Al-Hazm district", 16.21, 44.84),
  ], NOW);
  assert.equal(sideNow("al-hazm", "YE-JA", null), "houthi");
  assert.equal(live.districts["al-hazm"].side, "plc");
  assert.equal(live.changes[0].from, "houthi");
  assert.equal(live.districts["al-hazm"].src.length, 2);
});

test("whole-district wording, and a town or centre that is not the district", () => {
  assert.equal(tookWhole("Government forces take full control of Bayhan", "Bayhan"), true);
  assert.equal(tookWhole("Government forces take Bayhan in full", "Bayhan"), true);
  assert.equal(tookWhole("Houthis seize the whole of Hays district", "Hays"), true);
  assert.equal(tookWhole("Houthis expel government forces from Hays district", "Hays"), true);
  assert.equal(tookWhole("Houthis take Hays district", "Hays"), true);
  assert.equal(tookWhole("Houthis take Hays", "Hays"), false);
  assert.equal(tookWhole("Houthis take Al-Hazm town", "Al-Hazm"), false);
  assert.equal(tookWhole("Government forces seize the district centre of Hays", "Hays"), false);
  assert.equal(tookWhole("Houthis take full control of Al-Hazm city", "Al-Hazm"), false);
});

test("one side's claim, or a town or ground short of the district, makes a district contested", () => {
  const oneSide = updateControlLive(null, [
    card("a", "Al Arabiya", "Government forces take full control of Al-Hazm district", 16.2, 44.8),
    card("b", "Al Arabiya", "Government forces enter and take the whole of Al-Hazm district", 16.21, 44.84),
  ], NOW);
  assert.equal(oneSide.districts["al-hazm"].side, "contested");
  // A wire confirms, but only the town was taken: contested, not lost.
  const town = updateControlLive(null, [card("t", "Reuters", "Government forces take Al-Hazm town", 16.2, 44.8, { side: "agency" })], NOW);
  assert.equal(town.districts["al-hazm"].side, "contested");
  // Already contested by hand: one side's claim changes nothing.
  const already = updateControlLive(null, [card("e", "Al-Masirah", "Houthi forces take Hayjat al-Abd and cut the Taiz-Aden road", 13.134, 44.147)], NOW);
  assert.equal(already.districts["al-maqatirah"], undefined);
  const positions = updateControlLive(null, [card("c", "Reuters", "Houthi forces capture positions near Harib", 14.9, 45.4)], NOW);
  assert.equal(sideNow("harib", "YE-MA", null), "houthi");
  assert.equal(positions.districts.harib, undefined, "the captor already holds it");
  const gov = updateControlLive(null, [card("d", "Reuters", "Government forces capture positions near Harib", 14.9, 45.4)], NOW);
  assert.equal(gov.districts.harib.side, "contested");
});

test("a contested district stays so until one side's full control is confirmed", () => {
  const both = updateControlLive(null, [
    card("a", "Al Arabiya", "Government forces take Al-Hazm town", 16.2, 44.8),
    card("b", "Al-Masirah", "Houthi forces retake Al-Hazm town", 16.2, 44.8),
  ], NOW);
  assert.equal(both.districts["al-hazm"].side, "contested");
  // Silence, a town, or one side's word: still contested.
  assert.equal(updateControlLive(both, [], NOW).districts["al-hazm"].side, "contested");
  const town = updateControlLive(both, [card("c", "Reuters", "Houthi forces take Al-Hazm town, the provincial capital", 16.2, 44.8, { side: "agency" })], NOW);
  assert.equal(town.districts["al-hazm"].side, "contested");
  const one = updateControlLive(both, [card("d", "Al-Masirah", "Houthi forces take full control of Al-Hazm district", 16.2, 44.8)], NOW);
  assert.equal(one.districts["al-hazm"].side, "contested");
  const back = updateControlLive(both, [card("e", "Reuters", "Houthi forces take full control of Al-Hazm district", 16.2, 44.8, { side: "agency" })], NOW);
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
  const live = updateControlLive(null, [card("a", "Reuters", "Government forces take full control of Al-Hazm district", 16.2, 44.8, { side: "agency" })], NOW);
  const rows = mergedControl(live);
  assert.equal(rows.find((r) => r.id === "al-hazm")?.side, "plc");
  assert.equal(rows.find((r) => r.id === "al-makha")?.side, "houthi");
});

test("a building seized is no ground taken, and a governorate's name is not its capital's district", () => {
  const card = { fp: "h", at: "2026-09-28T16:10:55Z", source: "Al-Yemen Now", url: "https://x.com/a/status/1", type: "combat", summary: "Houthi forces seize Al-Juba hospital in Marib for military use", place: "Marib", lat: 15.46, lng: 45.32 } as never;
  const live = updateControlLive(null, [card], new Date("2026-09-29T00:00:00+03:00"));
  assert.equal(live.changes.length, 0);
});
