/*
 * The audit of 20 Oct (user: "remove southern forces color", "return the gulf states as a side in purple ... and add
 * their pins", "go over latest reports see mistakes in reports like putting the guardian report from today 13:00 on
 * map"): each mistake found on the live desks, as the rule that now stops it.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import { GULF_ATTACK, gulfAttack, iranPinAllowed } from "./iran-places.ts";
import { cardsOnTheirPins, serveIranPins, serveYemenPins } from "./serve-map-pins.ts";
import { longAgo, notEvent } from "./yemen-pins.ts";
import { yemenPinSide } from "./dev-marks.ts";

const require = createRequire(import.meta.url);
const rules = require("../../../scripts/iran-research/pin-rules.cjs");

test("Gulf states: a strike a Gulf state makes, alone or with the US, is theirs; their air defence is not", () => {
  // The researched pins' rule and the live pins' rule are the same words.
  assert.equal(rules.GULF_ATTACK.source, GULF_ATTACK.source);
  for (const l of [
    "US and Saudi jets strike Iran-aligned militia logistics and weapons sites across eastern Iraq (CENTCOM)",
    "US and Saudi airstrikes hit PMF bases in Baghdad and six other provinces, killing 20",
    "US-Saudi strikes hit PMF positions in Bartella",
    "Strike hits Lavan Island, later attributed to the UAE",
    "Gulf strike on Amerli, Sabereen reports",
    "Emirati warplanes strike targets on Abu Musa island",
    "Saudi air strikes kill three Iranian experts and four Houthi missile personnel west of Sanaa",
  ]) assert.ok(gulfAttack(l) && rules.gulfAttack(l), l);
  for (const l of [
    "Saudi Arabia downs 11 drones over Al-Kharj",
    "Kuwait's National Guard shoots down a drone",
    "British maritime agency reports two Saudi oil tankers attacked off Jubail coast",
    "IRGC Persian Gulf naval forces strike a tanker",
    "Iranian drones hit Saudi air base at Al-Kharj",
    "Drone attack on Kuwait Airport's fuel tanks",
  ]) assert.ok(!gulfAttack(l) && !rules.gulfAttack(l), l);
});

test("Gulf states: the researched pins of their strikes are drawn as theirs", () => {
  const base = [
    { fp: "a", day: "2026-07-28", actor: "us", place: "eastern Iraq", lat: 33.8, lng: 45.2, label: "US and Saudi jets strike Iran-aligned militia logistics and weapons sites across eastern Iraq (CENTCOM)", source: "CENTCOM", url: "https://x/1" },
    { fp: "b", day: "2026-07-29", actor: "us", place: "Karbala", lat: 32.6, lng: 44.0, label: "US and Saudi strike on PMF fighters in Karbala", source: "x", url: "https://x/2" },
    { fp: "c", day: "2026-03-16", actor: "unclear", place: "Al-Kharj", lat: 24.15, lng: 47.3, label: "Saudi Arabia downs 11 drones over Al-Kharj", source: "x", url: "https://x/3" },
  ];
  const out = rules.fixBase(base);
  assert.deepEqual(out.map((p: { actor: string }) => p.actor), ["gulf", "gulf", "unclear"]);
});

test("Gulf states: the live Iran map draws them purple, a Yemen desk pin's coalition strike too; the legend says Gulf states", () => {
  const [p] = serveIranPins([{ fp: "y1", at: "2026-10-15T16:00:02Z", type: "strike", lat: 15.35, lng: 44.15, place: "Sanaa", label: "Saudi air strikes kill three Iranian experts and four Houthi missile personnel west of Sanaa", desks: ["yemen", "iran"] }]);
  assert.equal((p as { actor?: string } | undefined)?.actor, "gulf");
  const app = fs.readFileSync(new URL("../../../public/app.js", import.meta.url), "utf8");
  assert.match(app, /\['gulf', '#a855f7', 'Gulf states'\]/);
  // Purple is the Gulf states' alone on the countries too: the others hit are grey.
  const geo = JSON.parse(fs.readFileSync(new URL("../../../public/iran-countries.geojson", import.meta.url), "utf8"));
  const gulf = geo.features.filter((f: { properties: { side: string } }) => f.properties.side === "gulf").map((f: { properties: { name: string } }) => f.properties.name).sort();
  assert.deepEqual(gulf, ["Bahrain", "Kuwait", "Oman", "Qatar", "Saudi Arabia", "United Arab Emirates"]);
});

test("not on the map: a refugee story, a toll that rose, a threat over, repairs, slogans, a 'could', a convoy of food (20 Oct)", () => {
  for (const label of [
    // The Guardian, 20 Oct 13:00: a story of families fleeing, the fighting near Mocha its background.
    "Yemeni families flee across Bab al-Mandab to Djibouti as Houthi forces battle government troops near Mocha",
    "Death toll from Houthi attack on security training centre in Shabwa rises to 67",
    "Shabwa local authority: death toll from Houthi missile attack on training centre exceeds 53",
    "Houthi Health Ministry: toll from Saudi air strike on home in Sahar district rises to 33 killed and wounded",
    "Saudi Civil Defense: threat to Riyadh has passed",
    "Yemeni public works minister orders repair of Haija al-Abd culvert damaged in Houthi strike",
    "Soldiers stranded in desert after leaving Al-Alam camp in Shabwa towards Ataq following strike",
    "Anti-Houthi slogans reading 'Down with the Houthi' spread across five districts in Sanaa",
    "Houthi commander threatens Amjad Khaled over contacts with Taiz figures",
    "Food convoys arrive for army and resistance fighters as ongoing clashes occur between Yemeni government forces and Houthi fighters in Al-Aqroud front in Taiz",
    "Mokhber: an atomic bomb kills tens of thousands, but controlling the Strait of Hormuz can affect the lives of billions",
  ]) assert.ok(notEvent({ label }), label);
  for (const label of [
    // A toll told with a new attack, and the attack itself, stay.
    "Death toll from Houthi strike on Shabwa training camp rises to 60 as coalition intercepts ballistic missile aimed at Riyadh",
    "Houthi ballistic missile attack on Al-Alam camp in Jardan district of Shabwa kills between 20 and 53 people",
    "Houthi forces advance to Al-Qubaysah in Al-Subayhah; families displaced from Batan, Haqrah, Marwis, Amalibiyah and Mafrukhiyah",
    "Houthi missile may have hit a fuel depot in Marib",
  ]) assert.ok(!notEvent({ label }), label);
});

test("not on the map: an event the words date days before the report (20 Oct)", () => {
  assert.ok(longAgo("US forces destroyed Iranian-affiliated dhow conducting surveillance on US Navy ships in Gulf of Oman on 6 October", "2026-10-14T19:41:00Z"));
  assert.ok(longAgo('Iran targets a "non-compliant" vessel in the Strait of Hormuz on 9 October', "2026-10-18T13:57:00Z"));
  assert.ok(!longAgo("Houthi missile hits Marib on 20 October", "2026-10-20T13:00:00Z"));
  assert.ok(!longAgo("Houthi missile hits Marib on October 19", "2026-10-20T08:00:00Z"));
  assert.ok(notEvent({ at: "2026-10-12T21:06:51Z", label: "Coalition air strike on 8 October hits Houthi intelligence directorate in Sanaa, killing technicians including Iranian experts" }));
});

test("not on the Iran map: helicopters or jets seen, airspace crossed, ships transiting, drills, an accident at an arms depot (20 Oct)", () => {
  const iran = { country: "Iran" }, iraq = { country: "Iraq" };
  assert.ok(!iranPinAllowed("unclear", iran, "Helicopter activity reported over central and north-west Tehran"));
  assert.ok(!iranPinAllowed("unclear", iran, "Warplanes reported in skies over Abadan outskirts, south-west Iran"));
  assert.ok(!iranPinAllowed("us", iraq, "Iraqi Islamic Resistance: six US MQ-9 Reaper drones violated Iraqi airspace over Anbar, Baghdad, Karbala and Salahuddin provinces"));
  assert.ok(!iranPinAllowed("other", { country: "sea" }, "Commercial vessels still transiting Strait of Hormuz despite Singapore ship sinking"));
  assert.ok(!iranPinAllowed("unclear", iran, "Two unknown explosions reported in Mashhad, Iran, likely missile fire during ongoing drills"));
  assert.ok(!iranPinAllowed("iraqi_militias", iraq, "Five members of Iraq's Popular Mobilization Forces injured in ammunition blast at Baghdad facility"));
  assert.ok(!iranPinAllowed("iraqi_militias", iraq, "Badr Organisation insists Baghdad Popular Mobilisation Forces blast was US attack; official sources say accidental"));
  // An attack stays.
  assert.ok(iranPinAllowed("us", iran, "Iran accuses US of striking Konarak Naval Base with two light projectiles, wounding two soldiers"));
});

test("not on the Iran map: Israeli fire moved to Syria's Quneitra, where the map shows none (20 Oct)", () => {
  const out = serveIranPins([{ fp: "q1", at: "2026-10-18T12:56:00Z", type: "strike", lat: 33.481, lng: 35.4011, place: "Qnaitra", actor: "israel", label: "Israeli forces shell Tal al-Ahmar area in Quneitra countryside, south-west Syria", desks: ["iran"] }]);
  assert.equal(out.length, 0);
});

test("sides: a Houthi named only as the dead is not who acted; Apaches and the Popular Resistance have a side (20 Oct)", () => {
  const at = { place: "Taiz", lat: 13.58, lng: 44.02 };
  assert.equal(yemenPinSide({ ...at, label: "Houthi intelligence chief Abdul-Hakim al-Khiwani killed in Sanaa strike", actor: "houthi" }), "unclear");
  assert.equal(yemenPinSide({ ...at, label: "Defense Line: Houthi commander reported killed in air strike in Al-Jawf", actor: "houthi" }), "saudi");
  assert.equal(yemenPinSide({ ...at, label: "Apache helicopters strike Houthi targets in Al-Jawf", actor: "unclear" }), "saudi");
  assert.equal(yemenPinSide({ ...at, label: "Popular Resistance ambush kills seven Houthi fighters in Taiz", actor: "unclear" }), "government");
  // The Houthis' own attack stays theirs.
  assert.equal(yemenPinSide({ ...at, label: "Houthi artillery shell kills ambulance driver and wounds accompanying doctor in Taiz", actor: "houthi" }), "houthi");
  // The served Yemen map has no Southern forces' side.
  const served = serveYemenPins([{ fp: "s1", at: "2026-10-19T05:43:00Z", type: "strike", place: "Harib", lat: 15.03, lng: 45.45, label: "Shabwa Defense Forces: drones strike Houthi positions in Ayn, Harib, Bayhan and Marakha Al-Olaya fronts", actor: "stc" }]);
  assert.equal(served[0]?.actor, "government");
});

test("a card shows the place its pin is served on (20 Oct: Jubail stored as Byblos)", () => {
  const cards: Record<string, unknown>[] = [{ fp: "j", place: "Byblos", lat: 34.12, lng: 35.65, summary: "Oil tanker hit by projectile near Jubail, Saudi Arabia" }, { fp: "k", place: "Tehran" }];
  cardsOnTheirPins(cards, [{ fp: "j", place: "Jubail", lat: 27.02, lng: 49.6755 }]);
  assert.deepEqual([cards[0].place, cards[0].lat, cards[1].place], ["Jubail", 27.02, "Tehran"]);
});
