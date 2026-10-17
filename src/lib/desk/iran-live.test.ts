import assert from "node:assert/strict";
import test from "node:test";

import { type Box, type Cell, emptyLive, ft, IRAN_LIVE_KEY, type IranLive, imoIncidents, liveNumbers, type NumbersFile, parseEia, parseImo, parseTgju, pct, recount, refreshIranLive, span3From, ukAdds, ukSanctions } from "./iran-live.ts";
import { applyAnswer, type Doc, slotsOf, statesValue } from "./iran-live-model.ts";
import { EIA_17OCT, FT_GCC_17OCT, IMO_17OCT, TGJU_RIAL_17OCT, UK_17OCT } from "./iran-live-fixtures.ts";
import NUMBERS from "../../../public/iran-numbers.json" with { type: "json" };

const FILE = NUMBERS as unknown as NumbersFile;
const box = (title: string) => structuredClone(FILE.sets.flatMap((s) => s.boxes).find((b) => b.title === title)!) as Box;
const NOW = new Date("2026-10-17T12:00:00Z");

// The misses (user, 17 Oct): the panel was a file of 11 Oct that nothing moved.
test("IMO: the confirmed count, the seafarers killed and each ship, from the page itself", () => {
  const p = parseImo(IMO_17OCT, NOW)!;
  assert.equal(p.asAt, "2026-10-14");
  assert.equal(p.confirmed, 113);
  assert.equal(p.deaths, 24);
  assert.deepEqual(p.rows[0], { date: "2026-10-13", ship: "GFS PRIDE", imo: "9349045", where: "Strait of Hormuz", what: "Sunk. No pollution." });
});

test("IMO: the ships the panel missed after 9 Oct join the list, and the stats move", () => {
  const b = imoIncidents(box("Incidents"), parseImo(IMO_17OCT, NOW)!, NOW);
  const names = (b.rows as [Cell, string][]).map((r) => r[1]);
  for (const ship of ["GFS Pride", "GFS Giselle", "Al Saadiyat", "Petro Dolphin", "Valthera", "Ever Vict", "Kition M", "DP World Kaveri", "Al Maqam", "Angola Prosperity"]) {
    assert.ok(names.some((n) => n.toLowerCase() === ship.toLowerCase()), ship);
  }
  assert.equal((b.rows as unknown[]).length, 148);
  assert.match(String(b.note), /IMO confirms 113 incidents to 14 Oct, with 24 seafarers killed/);
  const stats = Object.fromEntries((b.stats as [Cell, string][]).map(([c, l]) => [l, c.v]));
  assert.equal(stats["Since 28 Feb"], "148");
  // Newest first, as the list reads.
  assert.equal((b.rows as [Cell][])[0][0].date, "2026-10-13");
});

test("IMO: a ship a report already put on the list is not listed twice, and becomes official", () => {
  const b = box("Incidents");
  (b.rows as unknown[]).unshift([{ v: "13 Oct", k: "unoff", src: "Iran International", url: "x", date: "2026-10-13" }, "M/T GFS Pride", "Strait of Hormuz", "Projectile", "Sank"]);
  const out = imoIncidents(b, parseImo(IMO_17OCT, NOW)!, NOW);
  const pride = (out.rows as [Cell, string][]).filter((r) => /pride/i.test(r[1]));
  assert.equal(pride.length, 1);
  assert.equal(pride[0][0].k, "off");
});

test("UK: the 12 Oct designations of two Iranians, from GOV.UK's list, and the UK total", () => {
  const adds = ukAdds(UK_17OCT);
  assert.deepEqual(adds.map((a) => [a.date, a.n]), [["2026-10-12", 2], ["2026-07-13", 1], ["2026-05-11", 12]]);
  assert.match(adds[0].url, /assets\.publishing\.service\.gov\.uk/);
  const b = ukSanctions(box("EU and UK sanctions since 28 Feb"), adds)!;
  const rows = Object.fromEntries((b.rows as { label: string; cells: Cell[] }[]).map((r) => [r.label, r.cells[0].v]));
  assert.equal(rows["UK, 12 Oct"], "2");
  assert.equal(rows["UK, total"], "15");
  assert.equal(rows["EU, total"], "30");
  assert.equal(ukSanctions(b, adds), null, "nothing new the second time");
});

test("prices: the rial from tgju's table, the closing rate of each day", () => {
  const pts = parseTgju(TGJU_RIAL_17OCT);
  assert.ok(pts.some((p) => p.d === "2026-10-10" && p.v === 2651000));
  const b = span3From(box("The rial's open-market rate"), pts, { src: "tgju.org", fmt: (v) => v.toLocaleString("en-US") }, "u")!;
  assert.equal((b.latest as Cell).date, pts.map((p) => p.d).sort().pop());
  assert.match(String(b.change), /^\+\d+%$/);
});

test("prices: a 7-days-earlier figure and the change against before the war", () => {
  const b = box("Crude oil price");
  const out = span3From(b, [{ d: "2026-10-16", v: 109.86 }], { src: "Yahoo", fmt: (v) => `$${v.toFixed(2)}` }, "u")!;
  assert.equal((out.latest as Cell).v, "$109.86");
  assert.equal((out.week as Cell).date, "2026-10-09", "the series' own point a week before");
  assert.equal(out.change, pct(109.86, 69.48));
  const late = span3From(out, [{ d: "2026-10-01", v: 1 }], { src: "Yahoo", fmt: (v) => `$${v.toFixed(2)}` }, "u")!;
  assert.deepEqual([(late.latest as Cell).v, (late.latest as Cell).date], ["$109.86", "2026-10-16"], "an old point never takes Latest");
});

test("prices: FT's history and the EIA's weekly pump price", async () => {
  const pts = await ft("598752535", NOW, async () => FT_GCC_17OCT);
  assert.deepEqual(pts[0], { d: "2026-10-16", v: 141.84 });
  const eia = parseEia(EIA_17OCT);
  assert.deepEqual(eia[eia.length - 1], { d: "2026-10-12", v: 4.331 });
});

test("lists: Today and the last 7 days are counted from the rows, on the day", () => {
  const b = box("Attacks on energy sites");
  (b.rows as unknown[]).unshift([{ v: "16 Oct", k: "off", src: "x", url: "x", date: "2026-10-16" }, "Site", "By", "Drone", "Hit"]);
  const s = Object.fromEntries((recount(b, NOW).stats as [Cell, string][]).map(([c, l]) => [l, c.v]));
  assert.equal(s["Last 7 days"], "1");
  assert.equal(s.Today, "0");
});

test("the clock: each reader on its own schedule; a failing source leaves its box", async () => {
  const mem = new Map<string, unknown>();
  const store = { getJson: async (k: string) => mem.get(k) ?? null, putJson: async (k: string, v: unknown) => void mem.set(k, v) } as never;
  const g = async (url: string) => {
    if (url.includes("imo.org")) return IMO_17OCT;
    if (url.includes("gov.uk")) return UK_17OCT;
    throw new Error("down");
  };
  const live = (await refreshIranLive(store, FILE, NOW, g))!;
  assert.ok(live.boxes.Incidents && live.boxes["EU and UK sanctions since 28 Feb"]);
  assert.ok(!live.boxes["Crude oil price"], "Yahoo down: the researched box stands");
  const again = (await refreshIranLive(store, FILE, new Date(NOW.getTime() + 60_000), async () => { throw new Error("must not be asked"); }))!;
  assert.equal(again.boxes.Incidents, live.boxes.Incidents);
  assert.equal((mem.get(IRAN_LIVE_KEY) as IranLive).updatedAt, NOW.toISOString());
  const n = liveNumbers(again)!;
  assert.ok(n.boxes.some((b) => b.title === "Incidents"));
});

/* ---------------- the reports' reader ---------------- */

const docs: Doc[] = [
  { id: 0, at: "2026-10-12T13:42:00Z", source: "LBCI", url: "https://lbc/1", text: "Lebanon's Health Ministry says Israeli attacks since 2 March have killed 4,389 people and wounded 12,424." },
  { id: 1, at: "2026-10-13T11:00:00Z", source: "Akhbar-e Fori", url: "https://ak/1", text: "13 killed and 66 wounded in the fire at Ras Laffan's Barzan gas plant in June, Qatar says." },
  { id: 2, at: "2026-10-15T17:11:00Z", source: "CENTCOM", url: "https://centcom/1", text: "CENTCOM says an IRGC projectile hit and sank the container ship GFS Pride in the Strait of Hormuz on 13 October." },
  { id: 3, at: "2026-10-14T10:00:00Z", source: "Khabar", url: "https://kh/1", text: "Fighting goes on." },
];
const boxes = FILE.sets.flatMap((s) => s.boxes) as Box[];
const slot = (boxTitle: string, label: string, col: string) => slotsOf(boxes).find((s) => s.box === boxTitle && s.label.startsWith(label) && s.col === col)!.id;

test("reports: a figure the cited report states replaces an older one", () => {
  const out = applyAnswer(boxes, { updates: [{ slot: slot("Killed", "Lebanon", "Official"), value: "4,389", official: true, source: "Lebanese Health Ministry", doc: 0 }] }, docs, NOW);
  const row = (out[0].rows as { label: string; off: Cell }[]).find((r) => r.label === "Lebanon")!;
  assert.deepEqual([row.off.v, row.off.date, row.off.url], ["4,389", "2026-10-12", "https://lbc/1"]);
});

test("reports: no figure from a report that does not hold it, or from an unofficial body into the official column", () => {
  const s = slot("Killed", "Lebanon", "Official");
  assert.equal(applyAnswer(boxes, { updates: [{ slot: s, value: "4,390", official: true, doc: 3 }] }, docs, NOW).length, 0);
  assert.equal(applyAnswer(boxes, { updates: [{ slot: s, value: "4,389", official: false, doc: 0 }] }, docs, NOW).length, 0);
});

test("reports: an official count does not drop on another body's lower figure", () => {
  const s = slot("Killed", "Lebanon", "Official");
  const d: Doc[] = [{ id: 0, at: "2026-10-14T00:00:00Z", source: "X", url: "u", text: "Some 1,200 killed in Lebanon." }];
  assert.equal(applyAnswer(boxes, { updates: [{ slot: s, value: "1,200", official: true, source: "Some outlet", doc: 0 }] }, d, NOW).length, 0);
});

test("reports: a new attack is listed once, and an old one retold (the June Ras Laffan fire) is not", () => {
  const out = applyAnswer(boxes, {
    events: [
      { list: "ships", date: "2026-10-13", site: "GFS Pride", place: "Strait of Hormuz", by: "IRGC (per CENTCOM)", weapon: "Projectile", what: "Sank", official: true, doc: 2 },
      { list: "energy", date: "2026-06-20", site: "Barzan gas plant, Ras Laffan", place: "Qatar", what: "Fire", doc: 1 },
    ],
  }, docs, NOW);
  assert.deepEqual(out.map((b) => b.title), ["Incidents"]);
  const top = (out[0].rows as [Cell, string][])[0];
  assert.deepEqual([top[0].v, top[1]], ["13 Oct", "GFS Pride"]);
  // The IMO's row for the same ship and day: no second row.
  const withImo = imoIncidents(box("Incidents"), parseImo(IMO_17OCT, NOW)!, NOW);
  const again = applyAnswer([withImo], { events: [{ list: "ships", date: "2026-10-13", site: "M/V GFS Pride", place: "Strait of Hormuz", doc: 2 }] }, docs, NOW);
  assert.equal(again.length, 0);
});

test("reports: every number of a value must be in the text", () => {
  assert.ok(statesValue("insurance now 6% to 10% of hull value", "6–10%"));
  assert.ok(!statesValue("insurance now 6% of hull value", "6–10%"));
  assert.ok(statesValue("pump price rose to $4.35 a gallon", "$4.35"));
  assert.ok(!statesValue("pump price rose to $4.355 a gallon", "$4.35"));
  assert.ok(statesValue("۴٬۳۸۹ کشته", "4,389") || statesValue("4389 killed", "4,389"));
});

test("the page gets every box a reader made, the sanctions boxes on top", () => {
  const live: IranLive = { ...emptyLive(), boxes: { Incidents: box("Incidents") }, at: { Incidents: "2026-10-17T10:00:00Z" } };
  const n = liveNumbers(live, [box("US sanctions on Iran and Hezbollah")])!;
  assert.deepEqual(n.boxes.map((b) => b.title), ["Incidents", "US sanctions on Iran and Hezbollah"]);
  assert.equal(n.through, "2026-10-17T10:00:00Z");
});
