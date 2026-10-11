/**
 * The Iran desk's pins (Round 30 stage 6): only places the source names, the
 * landing place not the launch site, a ship at sea or in port, no common
 * words taken for places.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { heardInside, iranPins, iranPlacesIn } from "./iran-places.ts";

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
  // "العديد من" is "many of" (IDF Arabic, 9 Oct research): the base only by name.
  assert.deepEqual(iranPlacesIn("دمرت قوات الفرقة العديد من البنى التحتية في جنوب لبنان").map((p) => p.name), []);
  assert.deepEqual(iranPlacesIn("صواريخ نحو قاعدة العديد في قطر").map((p) => p.name), ["Al Udeid Air Base"]);
  assert.deepEqual(iranPlacesIn("الذي شغل منصب القائم بأعمال قائد فيلق لبنان").map((p) => p.name), []);
});

test("a province is no pin, and a count over days is no one attack (9 Oct dry run)", async () => {
  const { tallyNotEvent } = await import("./iran-places.ts");
  // The town is a pin (the wider list knows it), never the province.
  assert.deepEqual(iranPins("Gunmen kill police officer in Faryab, Kerman province", "Faryab, Kerman province", false).map((p) => p.name), ["Faryab"]);
  assert.deepEqual(iranPins("Gunmen kill police officer in Kerman", "in Kerman city", false).map((p) => p.name), ["Kerman"]);
  assert.equal(tallyNotEvent("10 oil tankers targeted in Strait of Hormuz in week to October 4, highest weekly tally on record"), true);
  assert.equal(tallyNotEvent("Joint Maritime Information Center: five confirmed attacks in the Strait of Hormuz in the past four days"), true);
  assert.equal(tallyNotEvent("Record attacks on tankers and gas carriers in Strait of Hormuz since war began"), true);
  assert.equal(tallyNotEvent("Ship targeted in Strait of Hormuz, fire breaks out on board"), false);
});

test("the map's scope (user, 9 Oct): who acted, where it landed, and never a fly-over, a round-up or Iran's own unrest", async () => {
  const { iranPinAllowed } = await import("./iran-places.ts");
  const at = (country: string) => ({ country });
  // The axis anywhere outside Iran, the Kurds in Iraq and Israel from Syria too.
  assert.equal(iranPinAllowed("iran", at("Iraq"), "Iranian drones strike terrorist targets in Rizgary, Erbil, Iraqi Kurdistan"), true);
  assert.equal(iranPinAllowed("iraqi_militias", at("Israel"), "Militia drone from Syria hits Eilat"), true);
  assert.equal(iranPinAllowed("hezbollah", at("Lebanon"), "Hezbollah rockets hit Israeli troops in Khiam"), true);
  // Inside Iran: no internal clash; its air defence at work, yes.
  assert.equal(iranPinAllowed("iran", at("Iran"), "IRGC kills militants in clash near Zahedan"), false);
  assert.equal(iranPinAllowed("iran", at("Iran"), "Iran's air defence intercepts drones over Tabriz"), true);
  assert.equal(iranPinAllowed("unclear", at("Iran"), "Roadside bomb explodes on police vehicle route in Zahedan"), false);
  assert.equal(iranPinAllowed("unclear", at("Iran"), "Explosions heard in Bandar Abbas between 0900 and 0910 local time"), true);
  // The US, Israel and the Gulf: Iran, Iraq, the seas; Israel in Lebanon too, never Syria or Gaza.
  assert.equal(iranPinAllowed("israel", at("Lebanon"), "Israeli strike hits Mansouri in Tyre district, south Lebanon"), true);
  assert.equal(iranPinAllowed("israel", at("Syria"), "Israeli strike hits Damascus"), false);
  assert.equal(iranPinAllowed("us", at("Iraq"), "US strike hits Kataib Hezbollah at Jurf al-Sakhar"), true);
  assert.equal(iranPinAllowed("houthi", at("sea"), "Houthis strike a tanker"), false);
  assert.equal(iranPinAllowed("houthi", at("Israel"), "Missile from Yemen at Eilat"), true);
  assert.equal(iranPinAllowed("iran", { country: "Saudi Arabia", lat: 16.89, lng: 42.56 }, "Drone attack on the Jizan refinery"), false);
  assert.equal(iranPinAllowed("unclear", { country: "sea", lat: 13.2, lng: 43.13 }, "Ship attacked off Mokha"), false);
  assert.equal(iranPinAllowed("iran", { country: "Saudi Arabia", lat: 21.46, lng: 40.53 }, "Iranian missiles hit King Fahd Air Base in Taif"), true);
  // Sirens are pinned (user, 10 Oct), but not Israel's: its alerts come from the Home Front Command.
  assert.equal(iranPinAllowed("unclear", at("Kuwait"), "Sirens sound in Kuwait City, Sabereen reports"), true);
  assert.equal(iranPinAllowed("unclear", at("Israel"), "Sirens sound in Tel Aviv"), false);
  // Not an attack, or no one attack.
  assert.equal(iranPinAllowed("israel", at("Lebanon"), "Israeli drones fly low over Beirut and suburbs"), false);
  assert.equal(iranPinAllowed("unclear", at("Iran"), "Jet activity reported over western Tehran"), false);
  assert.equal(iranPinAllowed("unclear", at("sea"), "Multiple tanker attacks reported in Strait of Hormuz and Red Sea"), false);
  assert.equal(iranPinAllowed("iran", at("Iran"), "Tehran emergency says 10 wounded in air incidents on 8 October"), false);
  assert.equal(iranPinAllowed("iran", at("Cyprus"), "Paphos International Airport evacuated upon detection of unidentified object"), false);
  assert.equal(iranPinAllowed("unclear", at("sea"), "Ship targeted in Strait of Hormuz, fire breaks out on board"), true);
  assert.equal(iranPinAllowed("iran", at("sea"), "Iran attacks tankers beyond Strait of Hormuz as Tehran tries to maintain leverage over strait"), false);
  const { iranEventAllowed } = await import("./iran-places.ts");
  assert.equal(iranEventAllowed({ actor: "unclear", place: "the Red Sea", label: "Tanker hit in the Red Sea" }), false);
  assert.equal(iranEventAllowed({ actor: "iran", place: "Strait of Hormuz", label: "IRGC Navy targets a non-compliant vessel in the Strait of Hormuz" }), true);
});

test("the wider list (user, 11 Oct): villages the hand list missed, named in the source's script and the copy's English", async () => {
  const { iranPins } = await import("./iran-places.ts");
  const names = (copy: string, src: string) => iranPins(copy, src, false).map((p) => p.name);
  assert.deepEqual(names("Israeli air strike hits Talousa in Marjayoun district, south Lebanon", "غارة معادية على بلدة طلوسة في قضاء مرجعيون"), ["Tallousa"]);
  assert.deepEqual(names("Israeli warplane strikes Kfar Tibnit in south Lebanon", "غارة للطيران المعادي على كفرتبنيت"), []);
  assert.deepEqual(names("Israeli warplane strikes Kfar Tibnit in south Lebanon", "غارة للطيران المعادي على كفر تبنيت"), ["Kafr Tibnit"]);
  assert.deepEqual(names("Israeli air strike hits Qantara, south Lebanon", "غارة إسرائيلية على بلدة القنطرة"), ["Qantara"]);
  // A spelling no list has, when the source names the place in Arabic: it sounds the same.
  assert.deepEqual(names("Israeli warplane strikes Kfar Tebneet in south Lebanon", "غارة للطيران المعادي على كفر تبنيت"), ["Kafr Tibnit"]);
  assert.deepEqual(names("Israeli air strike hits Tellouseh, south Lebanon", "غارة معادية على بلدة طلوسة"), ["Tallousa"]);
  assert.deepEqual(names("US strike hits Dayr al-Zawr", "غارة أمريكية على دير الزور"), ["Deir ez-Zor"]);
  assert.deepEqual(names("Army spokesman tells of a strike in south Lebanon", "غارة معادية على بلدة طلوسة"), []);
  // The source must name it: the copy alone is no pin.
  assert.deepEqual(names("Israeli air strike hits Qantara, south Lebanon", "غارة إسرائيلية في الجنوب"), []);
  // A common word in the copy is no village the source never named.
  assert.deepEqual(names("Spokesman tells reporters of strike on Tyre", "Spokesman tells reporters of a strike on Tyre"), ["Tyre"]);
});

test("a name inside a longer place's name is not that place: Bint Jbeil is not Byblos", () => {
  const names = (s: string) => iranPlacesIn(s).map((p) => p.name);
  assert.ok(!names("Israeli artillery strikes Kafra in Bint Jbeil district, south Lebanon").includes("Byblos"));
  assert.ok(!names("قصف مدفعي على أطراف كفرا في قضاء بنت جبيل").includes("Byblos"));
  assert.ok(iranPins("An Israeli strike hit a car near Jbeil", "غارة على سيارة قرب جبيل", false).some((p) => p.name === "Byblos"));
  const pins = iranPins("Israeli artillery strikes outskirts of Kafra and Beit Lif in Bint Jbeil district, south Lebanon", "قصف مدفعي إسرائيلي على أطراف كفرا وبيت ليف في قضاء بنت جبيل", false);
  assert.ok(!pins.some((p) => p.name === "Byblos"), pins.map((p) => p.name).join());
});

test("a stored pin heard inside a longer place's name moves to that place as it is served", () => {
  assert.equal(heardInside({ place: "Byblos", label: "Israeli artillery strikes outskirts of Kafra and Beit Lif in Bint Jbeil district, south Lebanon" })?.name, "Bint Jbeil");
  assert.equal(heardInside({ place: "Byblos", label: "Israeli strike on a car near Jbeil" }), null);
  assert.equal(heardInside({ place: "Nabatieh", label: "Israeli artillery strikes Nabatieh al-Fawqa in south Lebanon" }), null);
});
