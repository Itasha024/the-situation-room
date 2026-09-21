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
