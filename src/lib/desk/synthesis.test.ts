/**
 * The derived panels' prose.
 *
 * The two things worth asserting are the ones a reader would notice and a
 * developer would not: that the status stays a bird's-eye read rather than a
 * rehash of one report, and that it stays within its line budget.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { EMPTY_COUNTS, type WindowCounts, composeFront, composeStatus, tempoOf } from "./synthesis.ts";

const counts = (over: Partial<WindowCounts> = {}): WindowCounts => ({ ...EMPTY_COUNTS, ...over });

const front = (id: string, name: string, over: Partial<WindowCounts> = {}) => ({
  ...counts(over),
  id,
  name,
});

function sentences(s: string): number {
  return s.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 1).length;
}

test("a quiet window says so plainly and stops", () => {
  const s = composeStatus({
    now: counts(),
    prev: counts({ strikes: 3 }),
    fronts: [],
    windowEnd: "12:00 on 20 Sept",
    hours: 12,
  });
  assert.equal(s.quiet, true);
  assert.match(s.line, /No fighting was reported/);
  assert.ok(sentences(s.line) <= 3, `too long: ${s.line}`);
});

test("the status stays within two to three sentences whatever the window", () => {
  const shapes: WindowCounts[] = [
    counts({ strikes: 1 }),
    counts({ strikes: 9, ground: 7, alerts: 3, maritime: 2, killed: 14, wounded: 30 }),
    counts({ ground: 2, killed: 1 }),
    counts({ maritime: 4 }),
    counts({ alerts: 6 }),
  ];
  for (const now of shapes) {
    const s = composeStatus({
      now,
      prev: counts({ strikes: 2, ground: 2 }),
      fronts: [front("marib", "Marib", { ground: 2 }), front("bab", "Bab al-Mandab", { strikes: 1 })],
      windowEnd: "00:00 on 21 Sept",
      hours: 12,
    });
    const n = sentences(s.line);
    assert.ok(n >= 1 && n <= 3, `${n} sentences: ${s.line}`);
  }
});

test("the status is a bird's-eye read, not a rehash of one report", () => {
  // If the status shares a long run of words with any single report, it is
  // repeating that report rather than summarising the window.
  const reportHeadlines = [
    "Reports of air strikes on Houthi positions in Marib and Al-Bayda",
    "Clashes between Houthi forces and Yemeni government forces in Taiz",
    "Reports of a ballistic missile launch towards Riyadh",
  ];
  const s = composeStatus({
    now: counts({ strikes: 2, ground: 1, alerts: 1 }),
    prev: counts({ strikes: 1 }),
    fronts: [front("marib", "Marib", { strikes: 2 })],
    windowEnd: "12:00 on 20 Sept",
    hours: 12,
  });

  const words = s.line.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/);
  for (const h of reportHeadlines) {
    const hw = h.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/);
    for (let i = 0; i + 5 <= hw.length; i += 1) {
      const gram = hw.slice(i, i + 5).join(" ");
      assert.ok(!words.join(" ").includes(gram), `status repeats a report: "${gram}"`);
    }
  }
});

test("tempo is coarse enough not to call small differences an escalation", () => {
  assert.equal(tempoOf(counts({ strikes: 5 }), counts({ strikes: 4 })), "steady");
  assert.equal(tempoOf(counts({ strikes: 12 }), counts({ strikes: 4 })), "sharply-up");
  assert.equal(tempoOf(counts({ strikes: 2 }), counts({ strikes: 10 })), "sharply-down");
  assert.equal(tempoOf(counts(), counts({ strikes: 3 })), "quiet");
});

test("a front's paragraph opens on what the front is and stays inside four lines", () => {
  const line = composeFront({
    front: front("marib", "Marib", { ground: 3, strikes: 2, killed: 4 }),
    prev: counts({ ground: 1 }),
    standing: "Marib holds Yemen's main oil and gas infrastructure.",
    windowEnd: "12:00 on 20 Sept",
    hours: 12,
    activeStreak: 4,
  });
  assert.match(line, /^Marib holds/);
  assert.ok(sentences(line) <= 4, `too long: ${line}`);
  assert.match(line, /three ground engagements/);
});

test("a quiet front says nothing was reported rather than inventing calm", () => {
  const line = composeFront({
    front: front("jawf", "Al-Jawf"),
    prev: null,
    standing: "Al-Jawf is the northern desert flank.",
    windowEnd: "12:00 on 20 Sept",
    hours: 12,
    activeStreak: 0,
  });
  assert.match(line, /Nothing was reported/);
  assert.doesNotMatch(line, /calm|quiet front|peace/i);
});
