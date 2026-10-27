import { test } from "node:test";
import assert from "node:assert/strict";
import { townKey } from "./yemen-pins.ts";
import { serveGazaPins, serveIranPins } from "./serve-map-pins.ts";
import { gazaNotAPin } from "./gaza-pin-side.ts";
import { type AllBrief, allBriefPoints, rankedDesk, readRanking, sameWording } from "./all-brief.ts";

const pin = (fp: string, at: string, place: string, lat: number, lng: number, label: string, actor = "israel", type = "combat") => ({ fp, at, place, lat, lng, label, actor, type, source: fp.split("-")[0], url: `https://x.com/${fp}` });

test("one village in two spellings is one place (27 Oct)", () => {
  assert.equal(townKey("Meiss Ej Jabal"), townKey("Meiss al-Jabal"));
  assert.notEqual(townKey("Madama"), townKey("Azmut"));
});

test("one explosion told by two outlets in one village is one pin on the Iran map (27 Oct)", () => {
  const pins = serveIranPins([
    pin("manar-1", "2026-10-27T12:26:37Z", "Meiss al-Jabal", 33.17, 35.52, "Israeli forces carried out an explosion in Mays al-Jabal and burned some homes in Hula", "israel", "strike"),
    pin("mayadeen-1", "2026-10-27T12:26:18Z", "Meiss Ej Jabal", 33.18, 35.52, "Israeli forces carry out explosion in Mays al-Jabal, southern Lebanon"),
  ]);
  assert.equal(pins.length, 1);
});

test("Gaza map: a night's raid told three times is one pin; the next village's raid in the same words is its own (27 Oct)", () => {
  const out = serveGazaPins([
    pin("a-1", "2026-10-26T21:20:00Z", "Jaba'", 32.32, 35.22, "Israeli forces raid Jaba town south of Jenin"),
    pin("b-1", "2026-10-26T22:47:00Z", "Jaba'", 32.32, 35.22, "Israeli forces raid Jaba and Meithalun south of Jenin"),
    pin("c-1", "2026-10-27T02:22:00Z", "Jaba'", 32.32, 35.22, "Israeli forces raid Jaba town south of Jenin"),
    pin("d-1", "2026-10-27T01:31:00Z", "Rujayb", 32.19, 35.29, "Israeli forces demolish people killed' monument in Rujeib village east of Nablus"),
    pin("e-1", "2026-10-27T02:06:00Z", "Madama", 32.17, 35.23, "Israeli forces demolish people killed' monument in Madama village south of Nablus"),
  ]);
  assert.deepEqual(out.map((e) => e.fp), ["a-1", "d-1", "e-1"]);
});

test("Gaza map: a wounding or a death after gunfire in one place is its own pin (27 Oct)", () => {
  const out = serveGazaPins([
    pin("a-1", "2026-10-27T05:27:00Z", "Al Mawasi", 31.35, 34.27, "Israeli drone strike wounds one near yellow line in Al-Mawasi", "israel", "strike"),
    pin("b-1", "2026-10-27T06:33:00Z", "Al Mawasi", 31.35, 34.27, "One killed in Israeli drone strike on Al-Mawasi, Rafah", "israel", "strike"),
  ]);
  assert.equal(out.length, 2);
});

test("Gaza map: a roundup's extra pin on a village another report pins goes (27 Oct)", () => {
  const out = serveGazaPins([
    pin("q-1", "2026-10-27T08:00:00Z", "Qabatiyah", 32.41, 35.28, "Israeli forces raid Qabatiya town south of Jenin, search several homes"),
    pin("r-1", "2026-10-27T14:18:00Z", "Jenin", 32.46, 35.3, "Israeli forces impose tight restrictions across Jenin governorate, raid towns and villages"),
    pin("r-1-pin-Qabatiyah", "2026-10-27T14:18:00Z", "Qabatiyah", 32.41, 35.28, "Israeli forces impose tight restrictions across Jenin governorate, raid towns and villages"),
  ]);
  assert.deepEqual(out.map((e) => e.fp), ["q-1", "r-1"]);
  assert.ok(gazaNotAPin("Wall and Settlement Resistance Commission: 13 Israeli extremist and army attacks on olive pickers across Judea and Samaria"));
  assert.ok(!gazaNotAPin("2 people wounded in attacks by Israeli extremists in Sinjil"));
});

test("every desk's points in one order: unknown ids out, every point placed, the weak ones cut (user, 27 Oct)", () => {
  const points = {
    iran: ["Iran's navy: a tanker hit a mine in Hormuz [[1]].", "Israeli forces conduct explosions in southern Lebanon [[2]]."],
    yemen: ["A coalition strike in Sanaa killed a senior Houthi commander [[1]]."],
    gaza: ["A 6-year-old died of wounds in Khan Younis [[1]].", "A drone flew low over western Jabalia camp [[2]].", "Gaza kitchens struggle as aid shrinks [[3]]."],
  };
  const r = readRanking({ scores: { i1: 9, y1: 8, g1: 7, x9: 10, i2: 5, g2: 2, g3: 2 }, cut: ["g2", "g3"], fixed: { i2: "Israeli forces conducted explosions in southern Lebanon [[2]].", g1: "Something else entirely [[1]]." } }, points);
  const all: AllBrief = { key: "k", updatedAt: "", points, ...r };
  assert.deepEqual(allBriefPoints(all).map((p) => `${p.desk}${p.i}`), ["iran0", "yemen0", "gaza0", "iran1"]);
  assert.equal(allBriefPoints(all)[3].text, "Israeli forces conducted explosions in southern Lebanon [[2]].");
  assert.equal(allBriefPoints(all)[2].text, points.gaza[0]);
  // A desk keeps two points at least; a desk whose points changed since keeps its own order.
  assert.deepEqual(rankedDesk("gaza", points.gaza, all), [points.gaza[0], points.gaza[1]]);
  assert.deepEqual(rankedDesk("gaza", ["New point [[1]]."], all), ["New point [[1]]."]);
  assert.ok(!sameWording("A [[1]] b c.", "A b c."));
});

test("Lebanese channels' own scoops and Lebanon's politics reach the reader; known figures get their role (audit of 27 Oct)", async () => {
  const { passesLebaneseMediaGate } = await import("./iran-reader.ts");
  const { speakerByRole } = await import("./copy-rules.ts");
  assert.ok(passesLebaneseMediaGate("مصادر سياسية للجديد: حالة حذر وتخوف تسود الأوساط السياسية جراء تسريبات واشنطن"));
  assert.ok(passesLebaneseMediaGate("مصادر لـ MTV: سلام يحاول ترطيب الأجواء مع القوات"));
  assert.ok(!passesLebaneseMediaGate("غرق الشوارع الرئيسية والفرعية في زحلة جراء الأمطار الغزيرة"));
  assert.equal(speakerByRole("Jumblatt: no one in Lebanon was consulted"), "Druze leader Walid Jumblatt: no one in Lebanon was consulted");
  assert.equal(speakerByRole("Kataeb Party: refer Hezbollah to the Judicial Council"), "Lebanon's Kataeb Party: refer Hezbollah to the Judicial Council");
});
