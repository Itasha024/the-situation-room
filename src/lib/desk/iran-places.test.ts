/**
 * The Iran desk's pins (Round 30 stage 6): only places the source names, the
 * landing place not the launch site, a ship at sea or in port, no common
 * words taken for places.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { iranPins, iranPlacesIn } from "./iran-places.ts";

test("a place is pinned only when the source names it too, in any of its languages", () => {
  assert.deepEqual(iranPins("Israeli strikes hit Isfahan and Natanz", "حملات اسرائیل به اصفهان و نطنز", false).map((p) => p.name), ["Isfahan", "Natanz"]);
  assert.deepEqual(iranPins("Israeli strikes hit Isfahan and Natanz", "حملات اسرائیل به اصفهان", false).map((p) => p.name), ["Isfahan"]);
  assert.deepEqual(iranPins("Missiles hit Tel Aviv", "صواريخ إيرانية تضرب تل أبيب", false).map((p) => p.name), ["Tel Aviv"]);
  assert.deepEqual(iranPins("Rocket hits Haifa", "פגיעה בחיפה", false).map((p) => p.name), ["Haifa"]);
});

test("a ship is pinned at the port or sea named; a land strike not on the sea", () => {
  assert.deepEqual(iranPins("UKMTO: tanker hit 13 miles off Fujairah in the Gulf of Oman", "vessel hit 13NM east of Fujairah, Gulf of Oman", true).map((p) => p.name), ["Fujairah"]);
  assert.deepEqual(iranPins("Tanker struck in the Strait of Hormuz", "tanker struck in the Strait of Hormuz", true).map((p) => p.name), ["Strait of Hormuz"]);
  assert.deepEqual(iranPins("US strikes Bandar Abbas near the Strait of Hormuz", "US strikes on Bandar Abbas, Strait of Hormuz", false).map((p) => p.name), ["Bandar Abbas"]);
});

test("common words and the Quds Force are no places; a longer name is not also its shorter one", () => {
  assert.deepEqual(iranPlacesIn("نشر صور الهجوم، فيلق القدس").map((p) => p.name), []);
  assert.deepEqual(iranPlacesIn("Kharg Island oil terminal").map((p) => p.name), ["Kharg Island"]);
  assert.deepEqual(iranPlacesIn("Kermanshah base hit").map((p) => p.name), ["Kermanshah"]);
});

test("a province is no pin, and a count over days is no one attack (9 Oct dry run)", async () => {
  const { tallyNotEvent } = await import("./iran-places.ts");
  assert.deepEqual(iranPins("Gunmen kill police officer in Faryab, Kerman province", "Faryab, Kerman province", false), []);
  assert.deepEqual(iranPins("Gunmen kill police officer in Kerman", "in Kerman city", false).map((p) => p.name), ["Kerman"]);
  assert.equal(tallyNotEvent("10 oil tankers targeted in Strait of Hormuz in week to October 4, highest weekly tally on record"), true);
  assert.equal(tallyNotEvent("Joint Maritime Information Center: five confirmed attacks in the Strait of Hormuz in the past four days"), true);
  assert.equal(tallyNotEvent("Record attacks on tankers and gas carriers in Strait of Hormuz since war began"), true);
  assert.equal(tallyNotEvent("Ship targeted in Strait of Hormuz, fire breaks out on board"), false);
});
