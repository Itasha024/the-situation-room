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
  assert.deepEqual(names("Israeli forces raid Jenin camp, arrest five", "قوات الاحتلال تقتحم مخيم جنين"), ["Jenin"]);
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
