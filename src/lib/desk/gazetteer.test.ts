/**
 * The place locator.
 *
 * The desk glosses an unfamiliar place so a reader who does not know the Yemeni
 * map can follow the copy. The failure this file guards against is glossing at
 * length: "Taiz, a city and governorate in south-western Yemen" reads as
 * padding on every mention, and inside a list of targets it destroys the
 * sentence — the reader cannot tell where the description ends and the next
 * target begins.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { PLACES, PLACE_BY_NAME, placesIn, shortWhere, withLocator } from "./gazetteer.ts";

test("a locator is the place and where it is, and nothing else", () => {
  assert.equal(withLocator(PLACE_BY_NAME["Taiz"]), "Taiz in south-west Yemen");
  assert.equal(withLocator(PLACE_BY_NAME["Kahbub"]), "Kahbub in Lahj governorate");
});

test("a locator never describes what kind of place it is", () => {
  for (const p of PLACES) {
    const line = withLocator(p);
    assert.doesNotMatch(
      line,
      /\b(?:a|an)\s+(?:city|town|governorate|district|island|hill|ridge|valley|area|front|square|site|camp|crossing|facility|port)\b/i,
      `"${line}" describes the kind of place rather than locating it`,
    );
  }
});

test("a locator is an appositive-free phrase, so it cannot break a list", () => {
  // The bug: "hit positions in Taiz, a city and governorate in south-western
  // Yemen, Al-Jawf and Marib" — two commas that read as list separators.
  for (const p of PLACES) {
    assert.doesNotMatch(withLocator(p), /,/, `"${withLocator(p)}" would break a list of places`);
  }
});

test("a locator stays short enough to sit mid-sentence", () => {
  for (const p of PLACES) {
    const where = shortWhere(p);
    assert.ok(where.length <= 40, `"${p.name}" locator is too long: "${where}"`);
  }
});

test("well-known places are never glossed", () => {
  for (const name of ["Sanaa", "Aden", "Riyadh", "Hodeidah", "Bab al-Mandab"]) {
    const p = PLACE_BY_NAME[name];
    if (!p) continue;
    assert.equal(withLocator(p), p.name, `${name} should never carry a locator`);
    assert.equal(shortWhere(p), "");
  }
});

test("a locator that carries its own preposition does not get a second one", () => {
  // "Mocha in on Yemen's Red Sea coast" and "Wadi Dhanah in west of Marib city"
  // are the two ways this goes wrong.
  for (const p of PLACES) {
    const line = withLocator(p);
    assert.doesNotMatch(line, /\bin\s+(?:on|off|beside|near|inside|overlooking|between)\b/i, line);
    assert.doesNotMatch(line, /\bin\s+(?:north|south|east|west)[a-z-]*\s+of\b/i, line);
  }
});

test("a bare compass region still takes its preposition", () => {
  // The opposite failure: "Taiz south-west Yemen".
  assert.match(withLocator(PLACE_BY_NAME["Taiz"]), /\bin south-west Yemen$/);
  assert.match(withLocator(PLACE_BY_NAME["Hajjah"]), /\bin north-west Yemen$/);
});

test("compound compass points lose the -ern, single ones keep it", () => {
  // "south-west Yemen" is how the desk writes it; "north Sanaa" is not English.
  assert.equal(shortWhere(PLACE_BY_NAME["Taiz"]), "south-west Yemen");
  assert.equal(shortWhere(PLACE_BY_NAME["Azal"]), "northern Sanaa");
});

test("pins sit on the named place, inside the governorate the text names (29 Sep)", async () => {
  const { pinPlace } = await import("./editor.ts");
  const { governorateAt } = await import("./adm1.ts");
  const at = (t: string) => {
    const p = pinPlace(placesIn(t));
    return p && `${p.name} ${governorateAt(p.lat, p.lng)}`;
  };
  assert.equal(at("اشتباكات في الأغبرة بلحج"), "Al-Aghbara YE-LA");
  assert.equal(at("قصف حوثي على المضاربة في لحج"), "Al-Mudaribah YE-LA");
  assert.equal(at("غارات على كهبوب"), "Kahbub YE-LA");
  assert.equal(at("قصف على الوازعية في تعز"), "Al-Wazi'iyah YE-TA");
  // A spot outside the governorate named is no pin, not the governorate's centre.
  const lahj = placesIn("لحج")[0];
  assert.equal(pinPlace([{ ...PLACE_BY_NAME["Al-Barh"] }, lahj]), undefined);
});

test("prose places: a month never starts a place, and a district resolves by its own name", async () => {
  const { placeNamesIn, districtAt, placeKey } = await import("./prose-places.ts");
  assert.deepEqual(placeNamesIn("Strikes went on through September as Saudi Arabia pressed on."), []);
  assert.deepEqual(districtAt(placeKey("Majz"), null), [17.117, 43.511]);
  assert.equal(districtAt(placeKey("Majz"), "YE-MA"), null);
});
