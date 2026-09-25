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
