import { test } from "node:test";
import assert from "node:assert/strict";
import { cameFrom } from "./traffic-geo.ts";

// 22 Oct: where a ship came from, from the ship monitor's history (a fix each half hour).
const h = 1800;
test("a moving ship came from its last stop behind it", () => {
  const fixes = [
    { lat: 25.0, lon: 55.0, t: 0, speed: 0 }, { lat: 25.0, lon: 55.0, t: h, speed: 0.1 }, { lat: 25.0, lon: 55.0, t: 2 * h, speed: 0 },
    { lat: 25.2, lon: 55.4, t: 3 * h, speed: 11 }, { lat: 25.6, lon: 56.0, t: 4 * h, speed: 12 },
  ];
  assert.deepEqual(cameFrom(fixes), { lat: 25, lon: 55, arrived: 0, left: 2 * h });
});
test("a ship lying still came from the stop before this one", () => {
  const fixes = [
    { lat: 12.6, lon: 43.4, t: 0, speed: 0 }, { lat: 12.6, lon: 43.4, t: h, speed: 0 },
    { lat: 14, lon: 42.5, t: 2 * h, speed: 12 },
    { lat: 21.5, lon: 39.1, t: 3 * h, speed: 0 }, { lat: 21.5, lon: 39.1, t: 4 * h, speed: 0 },
  ];
  assert.equal(cameFrom(fixes)?.left, h);
});
test("one slow fix is not a stop, and no stop gives nothing", () => {
  assert.equal(cameFrom([{ lat: 25, lon: 55, t: 0, speed: 0.2 }, { lat: 25.5, lon: 56, t: h, speed: 12 }]), null);
  assert.equal(cameFrom([]), null);
});
