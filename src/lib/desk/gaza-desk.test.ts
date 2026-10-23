import { test } from "node:test";
import assert from "node:assert/strict";
import { gazaWords } from "./gaza-words.ts";
import { GAZA_SYSTEM_PROMPT, gazaSide, isGazaDeskItem, passesGazaOwnGate } from "./gaza-reader.ts";
import { gazaPins } from "./gaza-places.ts";
import { DESKS, deskById } from "../desks.ts";
import { DESK_IDS, deskParam } from "./desk-route.ts";
import { GAZA_READER } from "./editor.ts";
import { serveCard } from "./copy-rules.ts";

// User, 23 Oct: the Gaza – Judea & Samaria desk, stage 1.

test("the desk's own words", () => {
  assert.equal(gazaWords("Settlers attacked olive pickers in the occupied West Bank"), "Israeli extremists attacked olive pickers in Judea and Samaria");
  assert.equal(gazaWords("UN warns of rising settler violence in the West Bank"), "UN warns of rising extremists' violence in Judea and Samaria");
  assert.equal(gazaWords("Hamas accuses Israel of ceasefire violations in Gaza"), "Hamas accuses Israel of attacks in Gaza");
  assert.equal(gazaWords("Settlers set up a new outpost"), "Israeli citizens set up a new outpost");
  assert.ok(!/West Bank/i.test(GAZA_SYSTEM_PROMPT.replace(/the territory others call the West Bank|never "West Bank"|nor "occupied West Bank"/g, "")));
  // A stored card is served in the desk's words.
  const card = { summary: "Settlers torch cars near Nablus in the West Bank", text: "", source: "WAFA", type: "combat", url: "https://t.me/WAFAgency/1" };
  assert.ok(serveCard(card, "gaza"));
  assert.equal(card.summary, "Israeli extremists torch cars near Nablus in Judea and Samaria");
});

test("the gate: the desk's words, not Iran's Abbas or an opened crossing elsewhere", () => {
  assert.ok(isGazaDeskItem("غارة إسرائيلية على خان يونس"));
  assert.ok(isGazaDeskItem("IDF raids Jenin camp"));
  assert.ok(isGazaDeskItem("פיגוע ירי ליד חברון"));
  assert.ok(!isGazaDeskItem("عباس عراقجي: لن نفاوض تحت التهديد"));
  assert.ok(!isGazaDeskItem("فتح مطار بيروت أمام الرحلات"));
  assert.ok(passesGazaOwnGate("اقتحام قوات الاحتلال بلدة"));
});

test("the sides as the model names them", () => {
  assert.equal(gazaSide("Israeli settlers"), "israeli_citizens");
  assert.equal(gazaSide("IDF"), "israel");
  assert.equal(gazaSide("Qassam Brigades"), "hamas");
  assert.equal(gazaSide("Saraya al-Quds"), "factions");
  assert.equal(gazaSide("PA security forces"), "pa");
  assert.equal(gazaSide("Popular Forces militia"), "clans");
});

test("pins on the places the copy and the source both name", () => {
  const names = (c: string, s: string) => gazaPins(c, s).map((p) => p.name);
  assert.deepEqual(names("Israeli forces raid Jenin camp, arrest five", "قوات الاحتلال تقتحم مخيم جنين"), ["Jenin Camp"]);
  assert.deepEqual(names("Israeli air strike kills three in Khan Younis", "غارة على خان يونس"), ["Khan Younis"]);
  assert.deepEqual(names("Israeli forces demolish home in Yatta, south of Hebron", "هدم منزل في يطا جنوب الخليل"), ["Yatta"]);
  assert.deepEqual(names("Israeli extremists attack Sinjil and Al-Mughayyir", "هجوم على سنجل والمغير"), ["Sinjil", "Al-Mughayyir"]);
  assert.deepEqual(names("Gunman opens fire in Kfar Saba", "ירי בכפר סבא"), []);
  assert.deepEqual(names("Hamas says talks in Cairo continue", "x"), []);
});

test("the desk is listed, hidden, and has its own reader", () => {
  assert.ok(DESK_IDS.includes("gaza"));
  assert.equal(deskParam("gaza"), "gaza");
  const d = deskById("gaza");
  assert.equal(d.path, "/gaza-judea-samaria-desk");
  assert.ok(d.hidden);
  assert.equal(DESKS.filter((x) => !x.hidden).length, 2);
  assert.equal(GAZA_READER.queueKey, "gaza:reader-queue");
  assert.equal(GAZA_READER.desk, "gaza");
});

// User, 23 Oct (round 2): the gate check's misses, the relay rule, the landmarks, one pool, the queue.
test("the gate check's misses now pass, unrelated news still does not", async () => {
  const ir = await import("./iran-reader.ts");
  const { WAR_ONLY } = await import("../yemen-scan.server.ts");
  assert.ok(ir.isIranDeskItem("مسؤول مطلع مقرب من البحرية التابعة لحرس الثورة الإسلامية: الإجراءات أكثر فتكا"));
  assert.ok(ir.isIranDeskItem("السفارة الأميركية تأمر جميع الموظفين الأميركيين وعائلاتهم بمغادرة الإمارات"));
  assert.ok(ir.isIranDeskItem("مصدر أميركي: اختتام اجتماعات تامبا بين لبنان وإسرائيل"));
  assert.ok(ir.passesIranOwnGate("مصادر لبنانية: قصف مدفعي معادي على بلدة كفرتبنيت"));
  assert.ok(passesGazaOwnGate("اطلاق نار من الزوارق في بحر مدينة خانيونس"));
  assert.ok(isGazaDeskItem("وزير الدفاع الإسرائيلي: المخربون ومن يرسلهم سيدفعون ثمنا باهظا"));
  assert.ok(isGazaDeskItem("ALERT: a drone is above the Freedom Flotilla"));
  assert.ok(isGazaDeskItem("مستعمرون يحرقون أشجار الزيتون في برقا"));
  assert.ok(WAR_ONLY.test("وزير الخارجية المصري: ندين الهجمات التي تستهدف السعودية"));
  for (const s of ["French police: one killed in shooting near Paris", "الشرطة الفرنسية: قتيل في إطلاق نار قرب باريس"]) {
    assert.ok(!ir.isIranDeskItem(s) && !isGazaDeskItem(s) && !WAR_ONLY.test(s), s);
  }
});

test("an Israeli outlet passed on by another is a relay on the Gaza and Iran desks", async () => {
  const { relayOf } = await import("./copy-rules.ts");
  assert.ok(relayOf({ headline: "Channel 14: Israel begins demolishing homes in Hebron", source: "Al Jazeera", desk: "gaza" }));
  assert.ok(relayOf({ headline: "Attackers changed target after reaching Hebron, Yedioth Ahronoth reports", source: "Al Jazeera", desk: "gaza" }));
  assert.equal(relayOf({ headline: "Israeli forces raid Jenin camp, arrest five", source: "WAFA", desk: "gaza" }), null);
  assert.equal(relayOf({ headline: "Channel 14: Israel begins demolishing homes", source: "Channel 14", desk: "gaza" }), null);
});

test("landmarks and the places that only say where they are", () => {
  const names = (c: string, s: string) => gazaPins(c, s).map((p) => p.name);
  assert.deepEqual(names("IDF carries out demolition at Kamal Adwan Hospital in northern Gaza", "هدم في مستشفى كمال عدوان شمال غزة"), ["Kamal Adwan Hospital"]);
  assert.deepEqual(names("Strike near Nasser Medical Complex in Khan Younis", "غارة قرب مجمع ناصر الطبي في خانيونس"), ["Nasser Medical Complex"]);
});

test("the Gaza desk's queue: official channels first, its colonists are Israeli citizens", async () => {
  const { gazaTierOf } = await import("./gaza-sources.ts");
  assert.equal(gazaTierOf("Hamas", () => false), 1);
  assert.equal(gazaTierOf("Safa", () => false), 2);
  assert.equal(gazaTierOf("Nuseirat News", () => false), 3);
  assert.equal(gazaTierOf("Egypt Foreign Ministry", () => true), 1);
  assert.equal(gazaTierOf("Al Jazeera", () => false), 2);
  assert.equal(GAZA_READER.nearCopies, true);
  assert.equal(gazaWords("Colonists burn olive trees in Burqa"), "Israeli extremists burn olive trees in Burqa");
});

test("the pin audit of 23 Oct: the place itself, not the town it is told by; no pin for a past day or a trend", () => {
  const names = (c: string) => gazaPins(c, "x").map((p) => p.name);
  assert.deepEqual(names("Israeli air strike destroys residential block in Nuseirat camp, central Gaza"), ["Nuseirat"]);
  assert.deepEqual(names("Israeli forces carry out demolition operation in Tal al-Zaatar, northern Gaza"), ["Tal al-Zaatar"]);
  assert.deepEqual(names("Gaza emergency services: Israeli drone strike on al-Nasr neighborhood west of Gaza City kills two, wounds others"), ["Al-Nasr"]);
  assert.deepEqual(names("Israeli air strike near Thai restaurant in al-Rimal, western Gaza City, kills two"), ["Remal"]);
  assert.deepEqual(names("Palestinian wounded by Israeli gunfire in al-Mintaqa al-Iqlimiyya, south of Mawasi, Khan Younis"), ["Al Mawasi"]);
  assert.deepEqual(names("Israeli forces demolish home in Yatta, south of Hebron"), ["Yatta"]);
  assert.deepEqual(names("Second Israeli drone strike on western Gaza City"), ["Gaza"]);
  assert.deepEqual(names("Elderly man unable to walk after severe wounds from Israeli air strikes on Gaza yesterday"), []);
  assert.deepEqual(names("Palestinian faction sources: infighting, defections and drone killings hit Israeli-backed armed gangs east of the Yellow Line"), []);
  const nasr = gazaPins("Gaza emergency services: Israeli drone strike on al-Nasr neighborhood west of Gaza City kills two", "x")[0];
  assert.ok(nasr.lat > 31.5, "Gaza City's al-Nasr, not the An Nasr near Rafah");
});

test("the whole Gaza Strip is no place for a pin", () => {
  assert.deepEqual(gazaPins("Israeli air strikes on Gaza Strip kill one, wound 13", "x"), []);
  assert.deepEqual(gazaPins("Second Israeli drone strike on western Gaza City", "x").map((p) => p.name), ["Gaza"]);
});

// User, 23 Oct: Israel from the Israeli sources, the Palestinians from their own channels, never Hamas from Iran's media.
test("whose account tells a Gaza card", async () => {
  const { gazaSourceRule, gazaLeadBonus } = await import("./gaza-sourcing.ts");
  const rule = (headline: string, source: string, type = "statement") => gazaSourceRule({ headline, type, source });
  assert.ok(rule("Netanyahu orders full lockdown of Judea and Samaria after Hebron shooting", "NBC News"));
  assert.equal(rule("Netanyahu orders full lockdown of Judea and Samaria after Hebron shooting", "N12"), null);
  assert.ok(rule("Smotrich orders demolition of many Palestinian buildings around Hebron attack site", "Al Jazeera"));
  assert.ok(rule("Israeli army says two gunmen killed in Hebron", "Al Jazeera", "combat"));
  assert.ok(rule("Islamic Jihad: the operation is a message sealed with pure blood", "Al Mayadeen"));
  assert.equal(rule("Islamic Jihad: the operation is a message sealed with pure blood", "Islamic Jihad"), null);
  assert.ok(rule("Hamas official: Hebron operation shows occupiers' crimes bring them no security", "IRNA"));
  // A field event is told by anyone on the spot; an outlet's own interview is its own.
  assert.equal(rule("Israeli forces demolish three homes in Jenin camp", "WAFA", "combat"), null);
  assert.equal(rule("Israeli air strike kills three in Khan Younis", "Al Jazeera", "strike"), null);
  assert.equal(gazaSourceRule({ headline: "Hamas official: talks stalled", type: "statement", source: "Al Jazeera", own: true }), null);
  assert.ok(gazaLeadBonus({ source: "IRNA", summary: "x" }) < gazaLeadBonus({ source: "Al Jazeera", summary: "x" }));
  assert.ok(gazaLeadBonus({ source: "Islamic Jihad", summary: "x", flags: ["actor:factions"] }) > gazaLeadBonus({ source: "Al Mayadeen", summary: "x", flags: ["actor:factions"] }));
  // The relays of Israeli outlets, at the head or the tail.
  const { relayOf } = await import("./copy-rules.ts");
  assert.ok(relayOf({ headline: "Smotrich orders demolition of many Palestinian buildings around Hebron attack site, Channel 12 reports", source: "Al Jazeera", desk: "gaza" }));
  assert.ok(relayOf({ headline: "Channel 14 reports Israeli soldier from rescue unit killed in Hebron operation", source: "Al-Alam", desk: "gaza" }));
});

test("one Palestinian group in the Gaza desk's source filter", async () => {
  const js = (await import("node:fs")).readFileSync(new URL("../../../public/app.js", import.meta.url), "utf8");
  const names = /const GAZA_GROUP_NAMES = (\{[^}]*\})/.exec(js)?.[1] ?? "";
  assert.ok(/palestinian: 'Palestinian'/.test(names) && !/\bpa:|factions:/.test(names), names);
});
