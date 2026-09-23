// The map categories, from pins the desk got wrong on 19-23 September 2026.
import assert from "node:assert/strict";
import test from "node:test";

import { classifyForMap } from "./lib/map-classify.mjs";

test("a strike stays a strike, whatever boats or Aramco it mentions", () => {
  const kamaran = "Houthi media: Saudi air strikes on Kamaran Island kill 3 citizens and destroy fuel station\nKAMARAN — Three citizens were wounded and a fuel station supplying fishermen's boats was destroyed as a result of three air strikes by Saudi coalition aircraft on Kamaran Island.";
  assert.equal(classifyForMap(kamaran, "strike"), "strike");
  assert.equal(classifyForMap("Two Aramco fuel tanks north of Riyadh hit and on fire following attack", "strike"), "strike");
  assert.equal(classifyForMap("RIYADH — Houthi forces executed two military operations targeting sensitive sites in Riyadh and Aramco in Yanbu using missiles and drones.", "strike"), "strike");
});

test("a port that was itself hit is a port attack", () => {
  assert.equal(classifyForMap("Mocha — strike on the port and city before the weekend wave", "missile"), "port");
  assert.equal(classifyForMap("Mocha — shelling of the port continues", "missile"), "port");
});

test("a ship pin is an attack on a ship; traffic and cargo are not events", () => {
  assert.equal(classifyForMap("Ministry official: 316 ships cross Bab al-Mandab strait", "vessel"), null);
  assert.equal(classifyForMap("Houthi forces offload cargo of 12 wooden ships in Hodeidah", "vessel"), null);
  assert.equal(classifyForMap("Carriers shift more containerships through Red Sea, despite Houthi gains", "vessel"), null);
  assert.equal(classifyForMap("UKMTO: merchant vessel hit by a projectile west of Hodeidah", "vessel"), "vessel");
  assert.equal(classifyForMap("Houthi forces seize a tanker off Hodeidah", ""), "vessel");
});
