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
  // 148 less the four unnamed press reports of 10 and 11 Oct the IMO's named ships take in (tidyShips).
  assert.equal((b.rows as unknown[]).length, 144);
  assert.match(String(b.note), /IMO confirms 113 incidents to 14 Oct, with 24 seafarers killed/);
  const stats = Object.fromEntries((b.stats as [Cell, string][]).map(([c, l]) => [l, c.v]));
  assert.equal(stats["Since 28 Feb"], "144");
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

// The audit of 18 Oct: every ship and energy row checked against its source.
import { officialBody, seaOf, shipNamed, stateOf, stateText, tellerOf, tidyList } from "./iran-live.ts";

test("lists: official only from an official body, never a channel (17 Oct: Akhbar-e Fori, Bin Saeed)", () => {
  assert.ok(officialBody("IMO, confirmed incidents"));
  assert.ok(officialBody("UKMTO"));
  assert.ok(officialBody("Saudi Energy Ministry (via Al Jazeera)"));
  assert.ok(officialBody("Confirmed by the operator or a government"));
  assert.ok(!officialBody("Akhbar-e Fori"));
  assert.ok(!officialBody("Bin Saeed"));
  assert.ok(!officialBody("OSINTdefender"));
});

test("lists: one mine blast told by three channels is one row; words that describe a ship name none (17 Oct)", () => {
  assert.equal(shipNamed("second oil tanker"), "");
  assert.equal(shipNamed("supertanker with over 2 million barrels"), "");
  assert.equal(shipNamed("another giant oil tanker"), "");
  assert.equal(shipNamed("GFS Pride"), "GFS Pride");
  assert.equal(shipNamed("Ocean Molika (Arika Sun) (Panama)"), "Ocean Molika");
  assert.equal(seaOf("Strait of Hormuz"), "hormuz");
  assert.equal(seaOf("northeast of Al Jubayl, Saudi Arabia"), "gulf");
  const c = (src: string, k: "off" | "unoff" = "off"): Cell => ({ v: "17 Oct", k, src, url: `https://t.me/${src}`, date: "2026-10-17" });
  const b = { ...box("Incidents"), rows: [
    [c("Sabereen News", "unoff"), "second oil tanker", "Strait of Hormuz", "naval mine", "explosion and fire after hitting mine"],
    [c("Akhbar-e Fori"), "supertanker with over 2 million barrels", "Strait of Hormuz", "mine", "hit a mine, causing explosion and fire"],
    [c("Bin Saeed"), "another giant oil tanker", "Strait of Hormuz", "sea mine", "exploded after hitting a sea mine"],
  ] } as Box;
  const out = tidyList(b).rows as [Cell, string][];
  assert.equal(out.length, 1);
  assert.equal(out[0][0].k, "unoff");
});

test("lists: the IMO's named ship takes in the unnamed report of it; an Iranian ship or a US strike stays its own", () => {
  const imo = (date: string, ship: string, where: string, what = "Damaged. No pollution."): unknown[] => [{ v: date, k: "off", src: "IMO, confirmed incidents", url: "https://www.imo.org/x", date }, ship, where, "Not stated", what];
  const rep = (date: string, ship: string, where: string, weapon: string, what: string): unknown[] => [{ v: date, k: "unoff", src: "The National (UKMTO)", url: "https://thenationalnews.com/x", date }, ship, where, weapon, what];
  const b = { ...box("Incidents"), rows: [
    imo("2026-10-10", "Valthera", "Strait of Hormuz - Oman TTW"),
    rep("2026-10-10", "Tanker", "Strait of Hormuz, outbound", "Projectile (type not stated)", "Unknown projectile, fire; crew safe"),
    rep("2026-10-11", "Tanker", "Gulf of Oman", "Not stated", "Incident between a tanker and military forces"),
    imo("2026-10-11", "Petro Dolphin", "Sohar Anchorage, Gulf of Oman", "Two seafarers missing."),
    imo("2026-09-12", "El Gaia (Panama)", "Strait of Hormuz"),
    rep("2026-09-12", "unknown Iranian commercial vessel (Iran)", "near Qeshm Island", "Projectile", "Struck; 1 killed"),
  ] } as Box;
  const rows = tidyList(b).rows as unknown[][];
  assert.equal(rows.length, 5);
  assert.equal(rows.find((r) => r[1] === "Valthera")![3], "Projectile (type not stated)", "the report's weapon where the IMO gives none");
  assert.ok(rows.some((r) => /military forces/.test(String(r[4]))), "a tanker and military forces is not the drone on Petro Dolphin");
  assert.ok(rows.some((r) => /Iranian/.test(String(r[1]))));
});

test("lists: each energy site's state first, as the Yemen ledger gives it, with its own source", () => {
  assert.equal(stateOf("Working: restarted after the 11 Sep shutdown"), "working");
  assert.equal(stateOf("Partly back: Phase 14 at about 70%"), "reduced");
  assert.equal(stateOf("Shut since 16 Mar pending assessment"), "down");
  assert.equal(stateOf("Explosion and smoke reported; no official word on damage (31 Aug)"), "unknown");
  assert.equal(stateOf("No report of status since attack"), "unknown");
  assert.equal(stateText("Back in service after repairs"), "Working: after repairs");
  assert.equal(stateText("Partly back: Phase 14 at about 70%"), "Partly working: Phase 14 at about 70%");
  assert.equal(stateText("Working normally"), "Working normally");
  assert.equal(stateText("Explosion and smoke reported"), "Not known: Explosion and smoke reported");
  // The teller by name, never a bare domain or a label.
  assert.equal(tellerOf({ v: "x", k: "unoff", src: "khaleejtimes.com", url: "https://www.khaleejtimes.com/business/x", date: "2026-10-06" }), "Khaleej Times");
  assert.equal(tellerOf({ v: "x", k: "unoff", src: "t.me", url: "https://t.me/farsna/459128", date: "2026-08-31" }), "Fars");
  assert.equal(tellerOf({ v: "x", k: "off", src: "Confirmed by the operator or a government", url: "https://www.aljazeera.com/news/x", date: "2026-09-10" }), "Al Jazeera (confirmed by the operator or a government)");
  const live = tidyList(box("Attacks on energy sites")).rows as unknown[][];
  for (const r of live) {
    const st = r[4] as Cell;
    assert.match(String(st?.v ?? st), /^(?:Working|Partly working|Shut|Not known)\b/, String(st?.v ?? st));
    if (st && typeof st === "object") assert.doesNotMatch(st.src, /^(?:t\.me|x\.com|[a-z0-9.-]+\.[a-z]{2,})$/i, st.src);
  }
});

test("reports: an energy site's state moves on a newer report, never on the attacker's own channel", () => {
  const b = { ...box("Attacks on energy sites"), rows: [
    [{ v: "4 Oct", k: "unoff", src: "CBS News", url: "u", date: "2026-10-04" }, "Shaybah oilfield, Saudi Arabia", "Houthis", "Drones", { v: "Not known: fire", k: "unoff", src: "CBS News", url: "u", date: "2026-10-04" }],
  ] } as Box;
  const d: Doc[] = [
    { id: 0, at: "2026-10-12T09:00:00Z", source: "Reuters", url: "https://reuters.com/a", text: "Aramco said output at Shaybah was back to normal." },
    { id: 1, at: "2026-10-13T09:00:00Z", source: "Al-Masirah", url: "https://t.me/almasirah/1", text: "Shaybah is out of service after the strike." },
  ];
  const now = new Date("2026-10-13T12:00:00Z");
  const one = applyAnswer([b], { events: [{ list: "energy", kind: "state", date: "2026-10-12", site: "Shaybah oilfield", status: "working", state: "output back to normal", official: true, source: "Aramco", doc: 0 }] }, d, now);
  const st = (one[0].rows as unknown[][])[0][4] as Cell;
  assert.equal(st.v, "Working: output back to normal");
  assert.equal(st.src, "Aramco (via Reuters)");
  assert.equal(st.k, "off");
  assert.equal((one[0].rows as unknown[]).length, 1, "a state is no new attack");
  const two = applyAnswer(one, { events: [{ list: "energy", kind: "state", date: "2026-10-13", site: "Shaybah oilfield", status: "down", doc: 1 }] }, d, now);
  assert.equal(two.length, 0);
});

test("reports: an official mark needs an official body; the model's word alone is not enough", () => {
  const d: Doc[] = [{ id: 0, at: "2026-10-17T09:00:00Z", source: "Akhbar-e Fori", url: "https://t.me/akhbarefori/699179", text: "A supertanker with over 2 million barrels hit a mine in the Strait of Hormuz." }];
  const out = applyAnswer([box("Incidents")], { events: [{ list: "ships", date: "2026-10-17", site: "tanker", place: "Strait of Hormuz", weapon: "mine", what: "hit a mine", official: true, doc: 0 }] }, d, NOW);
  const row = (out[0].rows as [Cell, string][]).find((r) => r[0].date === "2026-10-17")!;
  assert.equal(row[0].k, "unoff");
});

test("UKMTO's own warnings become rows by code, official; a channel's earlier row of the same tanker gives way (17 Oct)", async () => {
  const { ukmtoEvents } = await import("./iran-live-model.ts");
  const reports = [
    { at: "2026-10-17T06:21:00Z", source: "UKMTO", url: "https://x.com/UK_MTO/status/2111343387395919930", summary: "Tanker struck by unknown projectile 68NM northeast of Al Jubayl, Saudi Arabia", text: "" },
    { at: "2026-10-17T14:37:00Z", source: "UKMTO", url: "https://x.com/UK_MTO/status/2111452684075360751", summary: "UKMTO reports small boat fires two shots at LNG tanker 140 miles southeast of Al-Mukalla", text: "" },
    { at: "2026-10-17T07:36:00Z", source: "Iran International", url: "https://iranintl.com/x", summary: "Tanker attacked by RPG 78 nautical miles northeast of Al Jubayl", text: "" },
  ];
  const { docs, events } = ukmtoEvents(reports as never, Date.parse("2026-10-15T00:00:00Z"));
  assert.equal(events.length, 1, "the Gulf of Aden is the Yemen ledger's; Iran International is no UKMTO");
  assert.equal(events[0].place, "68NM northeast of Al Jubayl, Saudi Arabia");
  assert.equal(events[0].weapon, "Unknown projectile");
  const b = { ...box("Incidents"), rows: [
    [{ v: "17 Oct", k: "unoff", src: "OSINTdefender", url: "https://x.com/sentdefender/status/2111419831522070724", date: "2026-10-17" }, "tanker", "northeast of Al Jubayl, Saudi Arabia", "unknown projectile", "struck"],
  ] } as Box;
  const out = applyAnswer([b], { events }, docs, new Date("2026-10-17T12:00:00Z"));
  const rows = out[0].rows as [Cell, string][];
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0][0].k, rows[0][0].src, rows[0][0].url], ["off", "UKMTO", "https://x.com/UK_MTO/status/2111343387395919930"]);
});

test("the rows found wrong stay fixed: dropped, set right or added, in the file and the stored lists (18 Oct audit)", async () => {
  const { fixRows, LIST_FIXES } = await import("./iran-list-fixes.ts");
  const c = (date: string): Cell => ({ v: date, k: "unoff", src: "x", url: "u", date });
  const rows = [[c("2026-08-31"), "Al-Dura refinery, Baghdad", "Not stated", "Not stated", "smoke"], [c("2026-09-10"), "Pipeline", "By", "Drone", "Shut"]] as [Cell, ...unknown[]][];
  const out = fixRows("Attacks on energy sites", rows, [
    { list: "Attacks on energy sites", match: { date: "2026-08-31", site: "Al-Dura refinery, Baghdad" }, why: "smoke with no attack", drop: true },
    { list: "Attacks on energy sites", match: { date: "2026-09-10", site: "Pipeline" }, why: "state", set: { "4": "Working: back" } },
    { list: "Attacks on energy sites", why: "missing", add: [c("2026-10-01"), "New site", "By", "Drone", "Not known"] },
  ]);
  assert.deepEqual(out.map((r) => r[1]), ["Pipeline", "New site"]);
  assert.equal(out[0][4], "Working: back");
  // Once fixed, a second pass changes nothing.
  assert.deepEqual(fixRows("Attacks on energy sites", out, []), out);
  // The energy audit: 17 rows that were no attack, a duplicate or did not happen are gone from the researched list.
  const energy = tidyList(box("Attacks on energy sites")).rows as unknown[][];
  assert.equal(LIST_FIXES.filter((f) => f.list === "Attacks on energy sites" && f.drop).length, 17);
  assert.ok(!energy.some((r) => /Al-Dura refinery/.test(String(r[1]))));
  assert.ok(!JSON.stringify(energy).includes("wikipedia.org"));
});
