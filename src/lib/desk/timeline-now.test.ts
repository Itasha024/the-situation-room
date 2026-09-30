import assert from "node:assert/strict";
import test from "node:test";
import { birdsEye, NOW_BASE, nowDue } from "./timeline-now.ts";

test("the Now box is rewritten once three days have passed", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  assert.equal(nowDue(null, now), true);
  assert.equal(nowDue({ summary: "x", detail: "y", asOf: "2026-09-23T12:00:00Z" }, now), false);
  assert.equal(nowDue({ summary: "x", detail: "y", asOf: "2026-09-22T11:00:00Z" }, now), true);
});

test("the Now box stays a bird's-eye view", () => {
  assert.ok(birdsEye(NOW_BASE.summary));
  assert.ok(birdsEye(NOW_BASE.detail));
  // Incident-level copy: clock times, a run of figures, a list of strikes.
  assert.equal(birdsEye("Missiles hit Jazan at 14:30 and Abha later."), false);
  assert.equal(birdsEye("Strikes killed 12 in Saada, 7 in Hajjah, 34 in Marib and 9 in Al-Jawf."), false);
  assert.equal(birdsEye("Strikes hit Saada, Hajjah, Marib, Al-Jawf, Amran, Sanaa, Hodeidah, Mocha and Hays, Taiz and Lahj."), false);
  assert.ok(birdsEye("The Houthis hold Mocha and press on Bab al-Mandab, while the government holds Taiz city."));
});

test("the three-day rewrite lands on its day: an hour of slack, stamped at the half-day", async () => {
  const { halfDayStart } = await import("./timeline-now.ts");
  // Written at 00:02 on 29 Sep (Jerusalem); the 00:00 run on 2 Oct is due.
  assert.equal(nowDue({ summary: "x", detail: "y", asOf: "2026-09-28T21:02:53Z" }, new Date("2026-10-01T21:00:40Z")), true);
  assert.equal(nowDue({ summary: "x", detail: "y", asOf: "2026-09-28T21:02:53Z" }, new Date("2026-10-01T09:01:00Z")), false);
  assert.equal(halfDayStart(new Date("2026-10-01T21:02:10Z")).toISOString(), "2026-10-01T21:00:00.000Z");
  assert.equal(halfDayStart(new Date("2026-10-01T09:04:59Z")).toISOString(), "2026-10-01T09:00:00.000Z");
});
