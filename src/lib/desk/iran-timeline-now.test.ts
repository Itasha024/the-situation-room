import assert from "node:assert/strict";
import test from "node:test";
import { IRAN_NOW_BASE, iranNowDue, iranNowShape } from "./iran-timeline-now.ts";
import { nowDue } from "./timeline-now.ts";

test("the Iran Now box is rewritten every 36 hours; Yemen's keeps its three days", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  assert.equal(iranNowDue(null, now), true);
  assert.equal(iranNowDue({ summary: "x", detail: "y", asOf: "2026-10-10T12:00:00Z" }, now), false);
  assert.equal(iranNowDue({ summary: "x", detail: "y", asOf: "2026-10-10T00:30:00Z" }, now), true);
  assert.equal(nowDue({ summary: "x", detail: "y", asOf: "2026-10-10T00:30:00Z" }, now), false);
});

test("a rewrite stands only in the entry's shape: every front, the war's start, no clock time", () => {
  assert.ok(iranNowShape(IRAN_NOW_BASE.summary, IRAN_NOW_BASE.detail));
  const noLebanon = IRAN_NOW_BASE.detail.split(/\n\n/).filter((p) => !p.startsWith("Lebanon:")).join("\n\n");
  assert.equal(iranNowShape(IRAN_NOW_BASE.summary, noLebanon), false);
  assert.equal(iranNowShape(IRAN_NOW_BASE.summary, IRAN_NOW_BASE.detail.replace("28 February", "at 14:30 on 28 Feb")), false);
  assert.doesNotMatch(IRAN_NOW_BASE.detail, /Houthi|Bab al-Mandab/);
});
