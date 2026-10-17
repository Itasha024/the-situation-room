import { test } from "node:test";
import assert from "node:assert/strict";
import { countryPin, districtPin, notEvent, onePinPerEvent, pinType, servePins } from "./yemen-pins.ts";

// Taiz and Saada as stored on 17 Oct: every pin on the city's centre.
const TAIZ = { lat: 13.58, lng: 44.02, place: "Taiz" };
const SAADA = { lat: 16.94, lng: 43.76, place: "Saada" };

test("a pin on Taiz moves to the district its label names, however it is spelt", () => {
  assert.equal(districtPin({ ...TAIZ, label: "Houthi shelling and sniping in Sabr Al-Mawadim district in Taiz kill woman, wound 5" })?.name, "Sabir Al Mawadim");
  assert.equal(districtPin({ ...TAIZ, label: "Landmine explosion kills woman and wounds three family members in Al-Shamaitin district of Taiz" })?.name, "Ash Shamayatayn");
  assert.equal(districtPin({ ...TAIZ, label: "Air strike targets Hisn Saif in Sameh district of Taiz" })?.name, "Sami'");
  assert.equal(districtPin({ ...SAADA, label: "Saudi forces shell residential villages in Shada district, Saada" })?.name, "Shada'a");
  assert.equal(districtPin({ ...SAADA, label: "Saudi airstrikes hit Sahar district in Saada" })?.name, "Sahar");
});

test("a pin that names no district, or sits on a village already, stays", () => {
  assert.equal(districtPin({ ...TAIZ, label: "16 Houthi fighters killed in Taiz battles" }), null);
  assert.equal(districtPin({ lat: 13.47, lng: 43.89, place: "Jabal Habashi", label: "Saudi air strike on Jabal Habashi district in Taiz" }), null);
});

test("'at sea' with no ship is a strike; analysis and visits are no events", () => {
  assert.equal(pinType({ type: "vessel", label: "Houthi missile strikes Saudi forces command headquarters in Badr camp in Aden" }), "strike");
  assert.equal(pinType({ type: "vessel", label: "French frigate shoots down drone heading for container ship in Bab al-Mandab" }), "vessel");
  assert.ok(notEvent({ label: "Houthis close in on key Yemen city of Taiz: Why a global trade route is at risk" }));
  assert.ok(notEvent({ label: "Aden governor inspects airport after Houthi missile strike, confirms flights continue" }));
  assert.ok(!notEvent({ label: "2 missiles hit airport in Yemen's port city of Aden, officials say" }));
});

test("one event told twice is one pin; two attackers are two", () => {
  const at = "2026-10-17T08:00:00Z";
  const pins = [
    { ...SAADA, at, type: "combat", label: "Saudi fire wounds two citizens in Shada district in Saada" },
    { ...SAADA, at, type: "combat", label: "Saudi forces fire on Shada district in Saada, wounding two Yemeni citizens" },
    { ...TAIZ, at, type: "combat", label: "Houthi shelling and sniping kill one civilian, injure five in Taiz" },
    { ...TAIZ, at, type: "combat", label: "Saudi shelling kills civilian in Taiz" },
  ];
  assert.equal(onePinPerEvent(pins).length, 3);
  assert.equal(servePins(pins).length, 3);
});

test("a pin on a whole country's centre goes; the same label twice on one spot is one pin", () => {
  assert.ok(countryPin({ place: "Saudi Arabia", label: "UKMTO: Tanker struck by unknown projectile off Saudi Arabia on Friday" }));
  assert.ok(!countryPin({ place: "Riyadh" }));
  const at = "2026-10-17T06:00:00Z";
  const z = { at, type: "strike", lat: 33.32, lng: 35.47, label: "Israeli warplane drops bomb on roof of a building in Zoutar al-Sharqiya, south Lebanon" };
  assert.equal(onePinPerEvent([z, { ...z, lat: 33.321 }]).length, 1);
});

test("one card's district pin and its own pin on the same named place are one pin; footage is not an event", () => {
  const at = "2026-10-17T07:33:14.000Z";
  const label = "Houthi shelling on residential areas in south-east Taiz kills one person and wounds 5 others";
  const out = servePins([
    { fp: "a-pin-x", at, type: "combat", lat: 13.47, lng: 43.89, place: "Jabal Habashi", label },
    { fp: "a", at, type: "combat", lat: 13.475, lng: 43.873, place: "Jabal Habashi", label },
    { fp: "b", at, type: "strike", lat: 13.0, lng: 44.9, place: "Al-Mudaribah", label: "Southern Giants Brigades publish footage of targeting a Houthi vehicle" },
  ]);
  assert.equal(out.length, 1);
});

test("one ship attack told three ways is one pin; aftermath and an alert lifted are no pins (17 Oct)", () => {
  const pins = onePinPerEvent([
    { fp: "a", at: "2026-10-17T14:37:43Z", type: "vessel", lat: 12.89, lng: 50.84, place: "Al-Mukalla", label: "UKMTO reports small boat fires two shots at LNG tanker 140 miles southeast of Al-Mukalla" },
    { fp: "b", at: "2026-10-17T13:21:31Z", type: "vessel", lat: 12.79, lng: 45.02, place: "Aden", label: "UKTMO: LNG tanker fired on by boat off Hadramawt coast" },
    { fp: "c", at: "2026-10-17T13:20:25Z", type: "vessel", lat: 12.79, lng: 45.02, place: "Aden", label: "Attack on a ship in the Gulf of Aden" },
    { fp: "d", at: "2026-10-16T11:42:00Z", type: "vessel", lat: 12.7, lng: 43.47, place: "Bab al-Mandab", label: "French frigate shoots down drone targeting container ship" },
  ]);
  assert.deepEqual(pins.map((p) => p.fp), ["a", "d"]);
  assert.equal(notEvent({ label: "Eyewitnesses: 250 bodies of Houthi fighters removed from Al-Dhabab front in Taiz" }), true);
  assert.equal(notEvent({ label: "Saudi Civil Defense: Emergency alert lifted in Jazan" }), true);
  assert.equal(notEvent({ label: "Houthi shelling in Al-Masrakh district of Taiz wounds three children" }), false);
});
