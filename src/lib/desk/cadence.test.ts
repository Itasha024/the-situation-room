import assert from "node:assert/strict";
import { test } from "node:test";
import { briefWindow, CADENCE_HOURS } from "./brief.ts";
import { battleFirst } from "./prose.ts";

test("updates fall at 00, 06, 12 and 18 on Israel's clock, and move with it on 25 Oct", () => {
  assert.equal(CADENCE_HOURS, 6);
  assert.deepEqual(briefWindow(new Date("2026-09-30T12:05:00Z")), {
    updatedAt: "2026-09-30T12:00:00+03:00",
    nextUpdateAt: "2026-09-30T18:00:00+03:00",
    startedAt: "2026-09-30T06:00:00+03:00",
  });
  // Just before midnight in Yemen, and across the day line.
  assert.deepEqual(briefWindow(new Date("2026-09-30T20:59:00Z")), {
    updatedAt: "2026-09-30T18:00:00+03:00",
    nextUpdateAt: "2026-10-01T00:00:00+03:00",
    startedAt: "2026-09-30T12:00:00+03:00",
  });
  assert.equal(briefWindow(new Date("2026-09-30T21:00:00Z")).updatedAt, "2026-10-01T00:00:00+03:00");
  // After Israel leaves summer time (25 Oct) the updates stay at 00/06/12/18 on its clock.
  assert.deepEqual(briefWindow(new Date("2026-11-02T04:30:00Z")), {
    updatedAt: "2026-11-02T06:00:00+02:00",
    nextUpdateAt: "2026-11-02T12:00:00+02:00",
    startedAt: "2026-11-02T00:00:00+02:00",
  });
  // The night the clock goes back: 00:00 is still summer time, 06:00 is winter time.
  assert.deepEqual(briefWindow(new Date("2026-10-24T22:30:00Z")), {
    updatedAt: "2026-10-25T00:00:00+03:00",
    nextUpdateAt: "2026-10-25T06:00:00+02:00",
    startedAt: "2026-10-24T18:00:00+03:00",
  });
});

test("the overview puts the battle first and politics in its own paragraph", () => {
  const mixed = "The UN envoy called for talks in Muscat. Houthi forces pressed on the Marib front.\n\nSaudi air defences intercepted a drone over Jazan.";
  assert.equal(
    battleFirst(mixed),
    "Houthi forces pressed on the Marib front.\n\nSaudi air defences intercepted a drone over Jazan.\n\nThe UN envoy called for talks in Muscat.",
  );
  // Already in order: unchanged.
  const ok = "Fighting was reported in western Taiz.\n\nThe government's envoy met Saudi officials in Riyadh.";
  assert.equal(battleFirst(ok), ok);
  // A political fact belonging to a battle sentence stays with it.
  assert.equal(battleFirst("Houthi forces launched an offensive on Marib after a mobilisation call."), "Houthi forces launched an offensive on Marib after a mobilisation call.");
  assert.equal(battleFirst(""), "");
});
