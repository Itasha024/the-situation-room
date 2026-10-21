import assert from "node:assert/strict";
import { test } from "node:test";

import { shipInland } from "./ship-land.ts";

test("a ship deep inland is a false position; ports, the Suez Canal and the Shatt al-Arab are not (21 Oct)", () => {
  assert.ok(shipInland(27.1478, 30.7951)); // WESTLANDGRACHT at Asyut, Egypt
  assert.ok(shipInland(24.7, 46.7)); // Riyadh
  assert.ok(!shipInland(32.806, 35.03)); // Haifa marina
  assert.ok(!shipInland(24.99, 55.07)); // Jebel Ali
  assert.ok(!shipInland(30.58, 32.33)); // the Suez Canal at Ismailia
  assert.ok(!shipInland(30.45, 48.0)); // the Shatt al-Arab
  assert.ok(!shipInland(26.5, 56.3)); // Hormuz
  assert.ok(!shipInland(15, 68)); // outside the land outline: kept
});
