/**
 * The rules that stand between a model's reading and the published numbers.
 * No network: every update is hand-written.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TALLY_SEED, applyUpdates } from "./tally.ts";

const docs = [{ name: "IOM update #6", url: "https://reliefweb.int/x", date: "2026-09-19", text: "" }];
const now = new Date("2026-09-21T12:00:00Z");

test("a higher official figure replaces the old one and names its source", () => {
  const t = applyUpdates(TALLY_SEED, [{ field: "idp", value: 118086, source: "IOM", doc: 0 }], docs, now);
  assert.equal(t.idp, 118086);
  assert.equal(t.from.idp.url, "https://reliefweb.int/x");
});

test("a lower figure from a different body never pulls the count down", () => {
  const t = applyUpdates(TALLY_SEED, [{ field: "killed.houthi", value: 100, source: "Someone else", doc: 0 }], docs, now);
  assert.equal(t.killed.houthi, 278);
});

test("the body that issued a count may revise it down", () => {
  const t = applyUpdates(TALLY_SEED, [{ field: "killed.houthi", value: 270, source: "AFP", doc: 0 }], docs, now);
  assert.equal(t.killed.houthi, 270);
});

test("a whole-war total (tenfold jump) is refused", () => {
  const t = applyUpdates(TALLY_SEED, [{ field: "idp", value: 4_500_000, source: "IOM", doc: 0 }], docs, now);
  assert.equal(t.idp, 112000);
});

test("unknown fields, bad numbers and missing documents are ignored", () => {
  const t = applyUpdates(
    TALLY_SEED,
    [
      { field: "missing" as never, value: 5, source: "x", doc: 0 },
      { field: "refugees", value: Number.NaN, source: "x", doc: 0 },
      { field: "refugees", value: 5000, source: "x", doc: 9 },
    ],
    docs,
    now,
  );
  assert.equal(t.refugees, 3000);
  assert.equal(TALLY_SEED.idp, 112000, "the seed itself is never mutated");
});

test("an unsplit total never lands in Civilians; it goes to All sides", () => {
  const un = [{ name: "Almashhad", url: "u", date: "2026-09-21", text: "The United Nations reported that nearly 700 people were killed." }];
  const t = applyUpdates(
    TALLY_SEED,
    [
      { field: "killed.civilians", value: 700, source: "United Nations", doc: 0 },
      { field: "killed.total", value: 700, source: "United Nations", doc: 0 },
    ],
    un,
    now,
  );
  assert.equal(t.killed.civilians, 150);
  assert.equal(t.killed.total, 700);
});

import { CLAIMS_SEED, applyClaims } from "./tally.ts";

test("each side keeps its own figure for the same field", () => {
  const d = [
    { name: "Saba", url: "s", date: "2026-09-20", text: "Saree: 40 Saudi soldiers killed since the start of the round" },
    { name: "Coalition", url: "c", date: "2026-09-21", text: "The coalition says 1,200 Houthi fighters killed since July" },
  ];
  const c = applyClaims(
    CLAIMS_SEED,
    [
      { field: "killed.saudi", by: "houthi", value: 40, source: "Yahya Saree", doc: 0 },
      { field: "killed.houthi", by: "gov", value: 1200, source: "Coalition", doc: 1 },
    ],
    d,
    now,
  );
  assert.equal(c.fields["killed.saudi"]?.houthi?.value, 40);
  assert.equal(c.fields["killed.houthi"]?.gov?.value, 1200);
  assert.equal(c.fields["killed.houthi"]?.houthi, undefined);
  assert.deepEqual(CLAIMS_SEED.fields, {}, "the seed itself is never mutated");
});

test("a claim never goes down unless the same voice revises it, and a side must be named", () => {
  const d = [{ name: "x", url: "u", date: "2026-09-21", text: "" }];
  const one = applyClaims(CLAIMS_SEED, [{ field: "killed.gov", by: "houthi", value: 900, source: "Yahya Saree", doc: 0 }], d, now);
  const lower = applyClaims(one, [{ field: "killed.gov", by: "houthi", value: 500, source: "Al-Masirah", doc: 0 }], d, now);
  assert.equal(lower.fields["killed.gov"]?.houthi?.value, 900);
  const sideless = applyClaims(one, [{ field: "killed.gov", by: "un" as never, value: 950, source: "UN", doc: 0 }], d, now);
  assert.equal(sideless.fields["killed.gov"]?.houthi?.value, 900);
});
