import assert from "node:assert/strict";
import test from "node:test";

import { PLACE_BY_NAME } from "./gazetteer.ts";
import { maritimeType, seaPlace } from "./maritime.ts";

// The live cards the reader typed maritime_attack, 20 to 24 September.
const cases: [string, string][] = [
  ["Planes unable to land at Taif airport after recent Houthi attack following potential strike", "strike"],
  ["Satellite images show damage to Italian Typhoon aircraft hangars at King Fahd Air Base in Saudi Arabia", "strike"],
  ["Saudi civil defence lifts security alert in Najran amid Yemen hostilities", "strike"],
  ["Yanbu port targeted", "port"],
  ["Satellite images show damage to Saudi port of Yanbu following potential Houthi attack", "port"],
  ["Kpler data: 3 vessels crossed Strait of Hormuz and 22 crossed Bab al-Mandab on Tuesday", "economy"],
  ["Carriers shift more containerships through Red Sea, despite Houthi gains", "economy"],
  ["Strait of Hormuz and Bab al-Mandab shipping slows amid tensions", "economy"],
  ["Houthi forces offload cargo of 12 wooden ships in Hodeidah", "economy"],
  ["Ministry official: 316 ships cross Bab al-Mandab strait", "economy"],
  ["Navy reinforces Red Sea presence amid Houthi threats", "statement"],
  ["27 crew evacuated from commercial vessel CAPE DAO after being targeted near Musandam", "vessel"],
  ["UKMTO: cargo ship security officer reports strike by unknown projectile", "vessel"],
  ["Togo-flagged oil tanker Trend targeted in Strait of Hormuz", "vessel"],
];

test("a ship attack must name a ship and what was done to it; the rest is typed by its copy", () => {
  for (const [text, want] of cases) assert.equal(maritimeType("vessel", text), want, text);
});

test("other types are left alone", () => {
  assert.equal(maritimeType("strike", "Air strike on a ship repair yard"), "strike");
});

test("a ship is pinned at sea or in port, never inland", () => {
  const p = (n: string) => PLACE_BY_NAME[n];
  assert.equal(seaPlace([p("Najran")].filter(Boolean)), undefined);
  assert.equal(seaPlace([p("Najran"), p("the Red Sea")].filter(Boolean))?.name, "the Red Sea");
  assert.equal(seaPlace([p("the Red Sea"), p("Hodeidah")].filter(Boolean))?.name, "Hodeidah");
});

test("a ship some way off a port is pinned at sea, not on the town", async () => {
  const { offsetFromText } = await import("./offshore.ts");
  const west = offsetFromText("Tanker Amzan hit about 63 nautical miles west of Yanbu", "Yanbu", 24.0231, 38.1899, true);
  assert.ok(west && west[1] < 37.1 && Math.abs(west[0] - 24.0231) < 0.01);
  const off = offsetFromText("Saree claims missile attack on tanker NCC Wafa off Yanbu", "Yanbu", 24.0231, 38.1899, true);
  assert.ok(off && off[1] < 38);
  // A land event a few km away stays on its place; without a direction it is not moved.
  assert.equal(offsetFromText("Houthis advance 5 km north of Hays", "Hays", 13.93, 43.48, false), null);
  assert.equal(offsetFromText("drone shot down 30 km from Al-Wadiah", "Al-Wadiah", 17.05, 47.12, false), null);
});
