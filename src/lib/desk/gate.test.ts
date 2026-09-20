/**
 * The gate, measured against labelled real traffic.
 *
 * Asserting on aggregate scores rather than individual cases is deliberate:
 * the balance between "loses nothing" and "lets nothing in" is the thing that
 * matters, and it can only be judged in both directions at once. A change that
 * rescues dropped reports usually admits something too; this is what makes that
 * cost visible before it reaches the live desk.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GATE_FIXTURES } from "./gate-fixtures.ts";
import { formatReport, runReport } from "./gate-report.ts";
import { breadthOf, gate, normaliseArabic } from "./relevance.ts";

test("the gate loses nothing relevant and admits nothing irrelevant", () => {
  const r = runReport();
  const detail = formatReport(r);

  // Recall first: before this scorer the gate kept 25% of what it should have.
  assert.equal(r.lost.length, 0, `relevant items were excluded:\n${detail}`);
  // And the other half of the balance — noise must not reach the feed.
  assert.equal(r.leaked.length, 0, `noise reached the feed:\n${detail}`);
  assert.ok(r.exact >= 0.9, `feed/tray placement drifted:\n${detail}`);
});

test("normalisation makes an unlisted spelling of a listed word still match", () => {
  // Same word, four orthographies the sources actually use.
  const forms = ["صنعاء", "صنعاء", "صَنْعاء", "صنعآء"];
  const normalised = new Set(forms.map(normaliseArabic));
  assert.ok(normalised.size <= 2, `normalisation left too many variants: ${[...normalised]}`);

  // Hamza and ta-marbuta forms collapse, which is the point.
  assert.equal(normaliseArabic("أنصار الله"), normaliseArabic("انصار الله"));
  assert.equal(normaliseArabic("غارة"), normaliseArabic("غاره"));
});

test("source breadth sets the bar, so one item is judged differently by outlet", () => {
  assert.equal(breadthOf("Al-Masirah"), "focused");
  assert.equal(breadthOf("Al Jazeera"), "mixed");
  assert.equal(breadthOf("Reuters"), "wire");

  // A loosely-topical line from a Yemen-only channel is likelier to be ours
  // than the same line from a global wire.
  const text = "تحركات عسكرية جديدة قرب الحدود";
  const focused = gate({ text, source: "Al-Masirah", url: "u", agency: false, breadth: "focused" });
  const wire = gate({ text, source: "Reuters", url: "u", agency: true, breadth: "wire" });
  assert.ok(
    ["feed", "tray"].indexOf(focused.outcome) <= ["feed", "tray"].indexOf(wire.outcome) ||
      focused.outcome === wire.outcome,
    "a focused source must never be stricter than a wire on the same text",
  );
});

test("another theatre named BY a party, linking fronts, is ours — the same word is not", () => {
  // Gaza as the subject.
  const subject = gate({
    text: "الخارجية القطرية تدين استمرار القتل ومنع دخول المساعدات لغزة",
    source: "Al Jazeera",
    url: "u",
    agency: false,
  });
  assert.equal(subject.keep, false, "Gaza as the subject is not this desk's file");

  // Gaza invoked by a party to THIS war, tying the fronts together.
  const frame = gate({
    text: "قال قائد أنصار الله إن جبهات المقاومة موحدة وإن ما يجري في اليمن مرتبط بما يجري في غزة ولبنان",
    source: "Al-Masirah",
    url: "u",
    agency: false,
  });
  assert.equal(frame.keep, true, "a unity-of-fronts statement is about this war");
});

test("every fixture carries a label the report can score", () => {
  for (const f of GATE_FIXTURES) {
    assert.ok(["feed", "tray", "exclude"].includes(f.label), `${f.name}: bad label`);
    assert.ok(f.text.trim().length > 10, `${f.name}: fixture text too short to be meaningful`);
  }
});
