import { test } from "node:test";
import assert from "node:assert/strict";
import { type RatedCard, blend, groupOf, laterCandidates, rateSources, ratingsDue, reportScore, startOf, withSeed } from "./source-rating.ts";

const NOW = Date.parse("2026-10-02T06:00:00Z");
const old = "2026-09-20T10:00:00Z";
const card = (source: string, also: string[] = [], over: Partial<RatedCard> = {}): RatedCard => ({
  fp: `${source}-${also.join("-")}-${over.at ?? old}`,
  at: old,
  source,
  type: "strike",
  also: also.map((s) => ({ source: s })),
  ...over,
});
const g = (n: string) => groupOf(n);

test("three groups, by lean first, then by name", () => {
  assert.equal(groupOf("Al-Mihwar", "houthi"), "houthi");
  assert.equal(groupOf("South24", "south"), "gov");
  assert.equal(groupOf("Reuters"), "nonaligned");
  assert.equal(groupOf("Almashhad"), "gov");
  assert.equal(groupOf("UKMTO", "intl"), "nonaligned");
});

test("starts: wires and officials 4, non-aligned 3.5, a side's outlet 3", () => {
  assert.equal(startOf("Reuters", "nonaligned"), 4);
  assert.equal(startOf("Yahya Saree", "houthi"), 4);
  assert.equal(startOf("Al Jazeera", "nonaligned"), 3.5);
  assert.equal(startOf("Al-Mihwar", "houthi"), 3);
  assert.equal(startOf("Fares al-Hemyari", "gov"), 3);
});

test("the other side or a wire confirms; a non-aligned paper only adds weight", () => {
  assert.equal(reportScore(card("Al-Masirah", ["Al Arabiya"]), "Al-Masirah", g, undefined, NOW, 3)?.score, 5);
  assert.equal(reportScore(card("Al-Masirah", ["Reuters"]), "Al-Masirah", g, undefined, NOW, 3)?.score, 5);
  assert.equal(reportScore(card("Al-Masirah", ["Al Jazeera"]), "Al-Masirah", g, undefined, NOW, 3)?.score, 3.5);
});

test("same-side outlets add weight, more of them more, up to 4.5", () => {
  assert.equal(reportScore(card("Al-Masirah", ["Ali Bk"]), "Al-Masirah", g, undefined, NOW, 3)?.score, 3.5);
  assert.equal(reportScore(card("Al-Masirah", ["Ali Bk", "Naya"]), "Al-Masirah", g, undefined, NOW, 3)?.score, 4);
  assert.equal(reportScore(card("Al-Masirah", ["Ali Bk", "Naya", "Al-Mihwar", "Sabereen News"]), "Al-Masirah", g, undefined, NOW, 3)?.score, 4.5);
});

test("a lone report leaves the source where it was", () => {
  assert.equal(reportScore(card("Reuters"), "Reuters", g, undefined, NOW, 4)?.score, 4);
  assert.equal(reportScore(card("Al-Masirah"), "Al-Masirah", g, undefined, NOW, 3)?.score, 3);
});

test("a non-aligned outlet is confirmed by both sides or a wire", () => {
  assert.equal(reportScore(card("Al Jazeera", ["Al-Masirah"]), "Al Jazeera", g, undefined, NOW, 3.5)?.score, 3.5);
  assert.equal(reportScore(card("Al Jazeera", ["Al-Masirah", "Al Arabiya"]), "Al Jazeera", g, undefined, NOW, 3.5)?.score, 5);
});

test("a report counts for every outlet on the card, the 'Also' ones too", () => {
  const out = rateSources(Array.from({ length: 12 }, (_, i) => card("Al-Masirah", ["Al Arabiya"], { fp: `c${i}` })), [], {}, NOW);
  const arabiya = out.find((s) => s.name === "Al Arabiya");
  assert.ok(arabiya && arabiya.n === 12 && arabiya.rating > 3.9);
});

test("a false report scores 1 and counts three times; a duplicate removal is no verdict", () => {
  const v = { verdict: "false" as const, reason: "old picture", at: old };
  assert.deepEqual(reportScore(card("Ali Bk"), "Ali Bk", g, v, NOW, 3), { score: 1, weight: 3 });
  assert.equal(blend(3, [{ score: 1, weight: 3 }]), 2.5);
  // Not in the verdicts: a duplicate or an out-of-scope removal never counts against anyone.
  assert.equal(reportScore(card("Ali Bk"), "Ali Bk", g, undefined, NOW, 3)?.score, 3);
});

test("a removed card still counts through its verdict", () => {
  const out = rateSources([], [{ name: "Ali Bk", url: "https://t.me/Alibk3", lean: "houthi", platform: "Telegram" }], { gone: { verdict: "false", reason: "x", at: old, card: card("Ali Bk") } }, NOW);
  assert.equal(out[0].n, 3);
  assert.ok(out[0].rating < 3);
});

test("too new or a statement: not scored; a denied statement is", () => {
  assert.equal(reportScore(card("Al-Masirah", [], { at: "2026-10-01T12:00:00Z" }), "Al-Masirah", g, undefined, NOW, 3), null);
  assert.equal(reportScore(card("Al-Masirah", [], { type: "statement" }), "Al-Masirah", g, undefined, NOW, 3), null);
  assert.equal(reportScore(card("Almashhad", [], { type: "statement" }), "Almashhad", g, { verdict: "denied", reason: "the minister denied it", at: old }, NOW, 3)?.score, 1);
});

test("borne out later scores 5", () => {
  assert.equal(reportScore(card("Al-Masirah"), "Al-Masirah", g, { verdict: "confirmed-later", reason: "", at: old }, NOW, 3)?.score, 5);
});

test("later candidates: same place and kind, from outside the side, within a week", () => {
  const early = card("Al-Masirah", [], { fp: "e", lat: 15.35, lng: 44.2 });
  const later = card("Al Arabiya", [], { fp: "l", at: "2026-09-22T10:00:00Z", lat: 15.36, lng: 44.21 });
  const far = card("Al Arabiya", [], { fp: "f", at: "2026-09-22T10:00:00Z", lat: 13, lng: 45 });
  assert.deepEqual(laterCandidates([early, later], () => undefined, {}, NOW).map((p) => p.later.fp), ["l"]);
  assert.equal(laterCandidates([early, far], () => undefined, {}, NOW).length, 0);
});

test("the sources the desk stopped reading are not listed", () => {
  const out = rateSources(Array.from({ length: 5 }, (_, i) => card("Taha Saleh", [], { fp: `t${i}` })), [], {}, NOW);
  assert.equal(out.length, 0);
});

test("once a day, and the seed's errors are in", () => {
  assert.equal(ratingsDue(null), true);
  assert.equal(ratingsDue({ day: "2026-10-02", updatedAt: "", sources: [] }, new Date(NOW)), false);
  assert.equal(ratingsDue({ day: "2026-10-01", updatedAt: "", sources: [] }, new Date(NOW)), true);
  assert.equal(withSeed(null)["live-t-me-alibk3-37482"].verdict, "false");
});

test("a later non-aligned paper passing on the claim does not bear it out; too-new reports wait", () => {
  const early = card("Al-Masirah", [], { fp: "e", lat: 15.35, lng: 44.2 });
  const relay = card("Al Jazeera", [], { fp: "j", at: "2026-09-21T10:00:00Z", lat: 15.35, lng: 44.2 });
  assert.equal(laterCandidates([early, relay], () => undefined, {}, NOW).length, 0);
  const fresh = card("Al-Masirah", [], { fp: "n", at: "2026-10-01T20:00:00Z", lat: 15.35, lng: 44.2 });
  const other = card("Al Arabiya", [], { fp: "o", at: "2026-10-01T22:00:00Z", lat: 15.35, lng: 44.2 });
  assert.equal(laterCandidates([fresh, other], () => undefined, {}, NOW).length, 0);
  assert.equal(laterCandidates([early, card("Al Arabiya", [], { fp: "l", at: "2026-09-21T10:00:00Z", lat: 15.35, lng: 44.2 })], () => undefined, {}, NOW, { e: "2026-10-01T00:00:00Z" }).filter((p) => p.early.fp === "e").length, 0);
});

test("the EU, the GCC and any foreign office start as official bodies; the GCC is Government-aligned", () => {
  assert.equal(startOf("EU", "nonaligned"), 4);
  assert.equal(startOf("Pakistan Foreign Office", "nonaligned"), 4);
  assert.equal(groupOf("GCC"), "gov");
  assert.equal(groupOf("Sheba Intelligence", "gov"), "nonaligned");
});
