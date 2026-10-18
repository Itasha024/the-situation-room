/**
 * The Iran numbers no source publishes as data, read from the desk's own
 * reports every 6 hours (user, 17 Oct: "everything should be automatic"):
 * casualties, the stranded ships and crews, fuel and food prices in Iran,
 * oil production and exports, the uranium stock, and the lists of attacks on
 * energy sites, nuclear sites and ships.
 *
 * A model proposes; code keeps only what the cited report bears out:
 * - a figure's every number is written in that report's text;
 * - it is newer than the figure it replaces, and an official count only moves
 *   down when the same body revises it;
 * - an attack is news (dated within three days of its report), names its site
 *   or ship in the report, and is not already on the list.
 */

import { hasNumber } from "./tally.ts";
import { askChain, NUMBERS_MODELS } from "./models.ts";
import type { LiveReport } from "./types.ts";
import type { DeskStore } from "./store.ts";
import { type Box, boxNow, byDayDesc, type Cell, dayLabel, emptyLive, IRAN_LIVE_KEY, type IranLive, mergeSeries, type NumbersFile, type Point, officialBody, putBox, recount, sameShip, seaOf, shipKey, shipName, shipNamed, type SiteState, stateText, tidyList } from "./iran-live.ts";
import { outletSide } from "./digest.ts";

/** Boxes their own data readers keep (iran-live.ts): never the model's. */
export const DATA_BOXES = new Set([
  "Crude oil price", "The shekel's rate", "Tel Aviv Stock Exchange", "Gulf stock markets", "The rial's open-market rate",
  "Gold coin in Tehran", "Gulf exchanges", "Internet in Iran", "IAEA inspectors in Iran", "EU and UK sanctions since 28 Feb",
  "US sanctions on Iran and Hezbollah", "Economic Outcast", "Older sanctions on Iran still in force",
]);
/** Rows of a box a data reader keeps. */
const DATA_ROWS: Record<string, string[]> = { "Petrol prices at the pump": ["US"] };
/** The columns that hold today's figure; the others are history. */
const NOW_COL = /^(?:Latest|Now|Figure|Named|Iran's own figure|Latest month|Shop check)$/;

export type Doc = { id: number; at: string; source: string; url: string; text: string };
export type Slot = { id: string; box: string; label: string; col: string; unit?: string; now?: Cell | null };
export type FigureUpdate = { slot: string; value: string; q?: string; official?: boolean; source?: string; doc: number; period?: string };
/**
 * `kind` "state": no new attack, only an energy site's state now ("resumed", "shut");
 * `status` the site's state in a word, `state` the report's few words on it;
 * `source` the body that said it, when the report quotes one.
 */
export type EventUpdate = { list: "energy" | "nuclear" | "ships"; kind?: "attack" | "state"; date: string; site: string; place?: string; by?: string; weapon?: string; what?: string; status?: SiteState; state?: string; official?: boolean; source?: string; doc: number };
const STATES: SiteState[] = ["working", "reduced", "down"];
const STATE_WORD: Record<SiteState, string> = { working: "Working", reduced: "Partly working", down: "Shut", unknown: "Not known" };
export type ModelAnswer = { updates?: FigureUpdate[]; events?: EventUpdate[] };

const LISTS: Record<EventUpdate["list"], string> = { energy: "Attacks on energy sites", nuclear: "Nuclear sites struck", ships: "Incidents" };

/** Every figure the model may move, with its id. */
export function slotsOf(boxes: Box[]): Slot[] {
  const out: Slot[] = [];
  boxes.forEach((b, bi) => {
    if (DATA_BOXES.has(b.title)) return;
    const unit = typeof b.unit === "string" ? b.unit : undefined;
    if (b.type === "claims") {
      (b.rows as { label: string; off: Cell | null; unoff: Cell | null }[]).forEach((r, ri) => {
        out.push({ id: `${bi}.${ri}.off`, box: b.title, label: r.label, col: "Official", unit, now: r.off });
        out.push({ id: `${bi}.${ri}.unoff`, box: b.title, label: r.label, col: "Unofficial", unit, now: r.unoff });
      });
    } else if (b.type === "table") {
      const cols = b.cols as string[];
      (b.rows as { label: string; sub?: string; cells: (Cell | null)[] }[]).forEach((r, ri) => {
        if (DATA_ROWS[b.title]?.includes(r.label)) return;
        cols.forEach((c, j) => {
          if (j && NOW_COL.test(c)) out.push({ id: `${bi}.${ri}.${j - 1}`, box: b.title, label: r.sub ? `${r.label} (${r.sub})` : r.label, col: c, unit, now: r.cells[j - 1] });
        });
      });
    } else if (b.type === "stat") {
      out.push({ id: `${bi}.value`, box: b.title, label: String(b.caption || ""), col: "Figure", unit, now: b.value as Cell });
    } else if (b.type === "bars") {
      const bars = b.bars as { label: string; c: Cell }[];
      const last = bars[bars.length - 1];
      out.push({ id: `${bi}.bar`, box: b.title, label: `a new period after "${last?.label}"`, col: "New bar", unit, now: last?.c });
    }
  });
  return out;
}

/** Reports that may hold a figure or an attack: a number, or an attack word, and a subject of the boxes. */
const SUBJECT = /\bkill|dead|death|wound|injur|casualt|toll|martyr|tanker|ship|vessel|seafarer|crew|UKMTO|Hormuz|refiner|pipeline|oil|gas|LNG|energy|power (?:plant|station)|Aramco|ADNOC|South Pars|nuclear|uranium|IAEA|enrich|Fordow|Natanz|Isfahan|Bushehr|inflation|price|gasoline|petrol|bread|chicken|export|barrels?|bpd|strand|شهید|کشته|زخمی|قیمت|تورم|نفت|بنزین|شهيد|قتيل|جريح|ناقلة|نفط/i;
export function docsFrom(reports: LiveReport[], since: number, limit = 60): Doc[] {
  return reports
    .filter((r) => {
      const t = Date.parse(String(r.at || ""));
      const text = `${r.summary || ""} ${r.text || ""}`;
      return Number.isFinite(t) && t >= since && SUBJECT.test(text) && /\d|attack|strike|hit/i.test(text);
    })
    .sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))
    .slice(0, limit)
    .map((r, id) => ({ id, at: String(r.at), source: String(r.source || ""), url: String(r.url || ""), text: `${r.summary || ""}. ${r.text || ""}`.replace(/\s+/g, " ").slice(0, 900) }));
}

export const SYSTEM = `You keep the figures of a news desk's numbers panel on the Iran war (which began on 28 February 2026: Iran against Israel and the United States, Iran's strikes on the Gulf states, Israel and Hezbollah in Lebanon, militias in Iraq, the Strait of Hormuz).
You get SLOTS (each a figure on the panel, with the figure it shows now and its date) and REPORTS (each with an index, its time and its text).
Return "updates": a slot's NEW figure only when a report states it explicitly, newer than the figure shown, for exactly what the slot measures (same place, same thing, same unit, same start: casualties since 28 Feb or since 2 Mar for Lebanon, as the slot's figure is). Write the value as the panel writes it ("4,389", "$4.35", "6–10%", "up to 400"). "official": true only when a government, a ministry, an army, the UN, the IAEA, the IMO, OPEC or a national statistics body issued the figure. "source": that body or outlet. A "New bar" slot takes a figure for a period after the last bar's (a month's production, exports or inflation): give "period" ("October", "23 Sep – 22 Oct").
Return "events": attacks reported in the REPORTS that happened in the last three days before the report: "energy" (an oil or gas field, refinery, pipeline, terminal, power plant, fuel depot), "nuclear" (a nuclear site in Iran), "ships" (a ship hit, seized, or struck by a mine). Give the date (YYYY-MM-DD), the site or the ship's name as the report writes it, the place, who attacked as the report says ("Not stated" if it does not), the weapon, and what happened in a few words. Not the Houthis' war with Saudi Arabia and the Yemeni government on land (another desk counts it); Houthi attacks on ships do count. Not an old attack recalled, a threat, or a claim of damage with no attack. Piracy by unknown gunmen is not an attack of the war. A ship with no name in the report: "site" is "tanker", "LNG carrier" and so on, never words like "second" or "another".
For "energy", also give "status" when the report says how the site stands now: "working" (resumed, back in service, normal), "reduced" (partly, reduced rates) or "down" (halted, shut, out of service); and "state", the report's few words on it. A report that gives only a site's state after an earlier attack (an energy site resumed, still shut) is an event with "kind": "state" and the report's date.
"official": true only when an official body (a ministry, a government, an army or navy, CENTCOM, UKMTO, the IMO, the site's operator) said it; "source": that body.
Never estimate, never add numbers up, never take a figure from a different start or place. If nothing fits, return empty lists.
Return JSON {"updates":[{"slot":"3.4.off","value":"4,389","official":true,"source":"Lebanese Health Ministry","doc":12}],"events":[{"list":"ships","date":"2026-10-16","site":"GFS Pride","place":"Strait of Hormuz","by":"IRGC (per CENTCOM)","weapon":"Projectile","what":"Sank under tow","official":true,"doc":4}]}`;

export function userMessage(slots: Slot[], docs: Doc[]): string {
  return JSON.stringify({
    slots: slots.map((s) => ({ slot: s.id, box: s.box, row: s.label, column: s.col, unit: s.unit, now: s.now ? `${s.now.q ? `${s.now.q} ` : ""}${s.now.v} (${s.now.src}, ${s.now.date})` : "none" })),
    reports: docs.map((d) => ({ index: d.id, time: d.at.slice(0, 16), source: d.source, text: d.text })),
  });
}

/** Each number written in a value: "6–10%" → [6, 10]; "$4.35" → [4.35]. */
export function numbersIn(v: string): string[] {
  return [...String(v).replace(/(\d),(\d{3})/g, "$1$2").replace(/(\d),(\d{3})/g, "$1$2").matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
}
/** The report states every number of the value. */
export function statesValue(text: string, v: string): boolean {
  const ns = numbersIn(v);
  if (!ns.length) return false;
  const flat = text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  return ns.every((n) => (n.includes(".") ? new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?!\\d)`).test(flat) : hasNumber(flat, Number(n))));
}
const first = (v: string) => Number(numbersIn(v)[0]);
const day = (iso: string) => String(iso).slice(0, 10);

/** Apply the model's answer to the boxes. Pure, so the rules are testable. Returns the boxes that changed. */
export function applyAnswer(boxes: Box[], answer: ModelAnswer, docs: Doc[], now: Date): Box[] {
  const out = boxes.map((b) => structuredClone(b));
  const changed = new Set<number>();
  const slots = new Map(slotsOf(boxes).map((s) => [s.id, s]));
  for (const u of answer.updates ?? []) {
    const s = u && slots.get(String(u.slot));
    const doc = docs.find((d) => d.id === Number(u?.doc));
    if (!s || !doc || typeof u.value !== "string" || !statesValue(doc.text, u.value)) continue;
    const when = day(doc.at);
    if (s.now?.date && when < s.now.date) continue;
    if (s.now && String(s.now.v) === u.value) continue;
    const [bi, ri, col] = String(u.slot).split(".");
    const b = out[Number(bi)];
    const official = u.official === true;
    const cell: Cell = { v: u.value, ...(u.q ? { q: u.q } : {}), k: official ? "off" : "unoff", src: String(u.source || doc.source), url: doc.url, date: when };
    const was = s.now ? first(String(s.now.v)) : NaN, is = first(u.value);
    if (b.type === "claims") {
      // The official column takes only an official body's count.
      if ((col === "off") !== official) continue;
      // A count moves down only when its own body revises it; a tenfold jump is a different count.
      if (Number.isFinite(was) && is < was && s.now?.src !== cell.src) continue;
      if (Number.isFinite(was) && was > 50 && is > was * 10) continue;
      const row = (b.rows as Record<string, unknown>[])[Number(ri)];
      row[col] = cell;
    } else if (b.type === "table") {
      if (Number.isFinite(was) && was > 50 && (is > was * 10 || is < was / 10)) continue;
      const row = (b.rows as { cells: (Cell | null)[] }[])[Number(ri)];
      const j = Number(col);
      // "Latest" moves to "A week earlier" when it is that old.
      const cols = b.cols as string[];
      const wk = cols.indexOf("A week earlier") - 1;
      const old = row.cells[j];
      if (wk >= 0 && j === cols.indexOf("Latest") - 1 && old?.date && Date.parse(when) - Date.parse(old.date) >= 5 * 86_400_000) row.cells[wk] = old;
      row.cells[j] = cell;
    } else if (b.type === "stat") {
      b.value = { ...cell, ...((b.value as Cell)?.note ? { note: (b.value as Cell).note } : {}) };
    } else if (b.type === "bars") {
      const period = String(u.period || "").trim();
      const bars = b.bars as { label: string; n: number; c: Cell }[];
      if (!period || bars.some((x) => x.label.toLowerCase() === period.toLowerCase()) || !Number.isFinite(is)) continue;
      bars.push({ label: period, n: is, c: cell });
      if (Array.isArray(b.series)) b.series = mergeSeries(b.series as Point[], [{ d: when, v: is }]);
    } else continue;
    changed.add(Number(bi));
  }
  for (const e of answer.events ?? []) {
    const title = e && LISTS[e.list];
    const bi = out.findIndex((b) => b.title === title);
    const doc = docs.find((d) => d.id === Number(e?.doc));
    if (bi < 0 || !doc || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.date)) || !e.site) continue;
    // News, not history: within three days before its report (a June accident retold in October is not an attack).
    const lag = (Date.parse(day(doc.at)) - Date.parse(e.date)) / 86_400_000;
    if (!(lag >= 0 && lag <= 3)) continue;
    // The report names the site or ship: its own name, not words that describe it
    // (17 Oct: "second oil tanker" and "another giant oil tanker" passed as names).
    const words = (e.list === "ships" ? shipKey(shipNamed(e.site)) : shipKey(e.site)).split(" ").filter((w) => w.length >= 4 && !/^(?:ship|tanker|vessel|plant|site|field|facility|refinery|station|container|cargo|carrier)$/.test(w));
    const named = words.some((w) => doc.text.toLowerCase().includes(w));
    const b = out[bi];
    const rows = b.rows as [Cell, ...unknown[]][];
    // Already listed: the same ship or site within a day either side.
    const key = shipKey(e.site);
    const near = (r: [Cell, ...unknown[]]) => Math.abs(Date.parse(String(r[0]?.date || "")) - Date.parse(e.date)) <= 86_400_000;
    const same = (r: [Cell, ...unknown[]]) => {
      const k = shipKey(String(r[1]));
      return k === key || (words.length > 0 && words.some((w) => k.includes(w)));
    };
    // Official: an official body said it, read in the report (the ministry, via the outlet); never the outlet itself.
    const teller = String(e.source || "").trim();
    const off = e.official === true && (officialBody(doc.source) || officialBody(teller));
    const src = off && teller && !officialBody(doc.source) ? `${teller} (via ${doc.source})` : doc.source;
    // An energy site's state, from the newest report that gives it; never from the attacking side's own camp.
    if (e.list === "energy" && e.status && STATES.includes(e.status) && named) {
      const at = rows.filter(same).sort((x, y) => String(y[0]?.date).localeCompare(String(x[0]?.date)))[0];
      const old = at?.[4] as Cell | undefined;
      const own = /houthi|ansar|iran|irgc|islamic resistance|iraqi (?:militia|faction)|hezbollah/i.test(String(at?.[2] ?? "")) && outletSide(doc.source) === "Houthi-aligned";
      if (at && !own && (!old || typeof old !== "object" || day(doc.at) >= String(old.date || ""))) {
        at[4] = { v: stateText(`${STATE_WORD[e.status]}: ${e.state || e.what || ""}`.replace(/: $/, "")), k: off ? "off" : "unoff", src, url: doc.url, date: day(doc.at) };
        changed.add(bi);
      }
      if (e.kind === "state" || (at && near(at))) continue;
    }
    if (e.kind === "state") continue;
    // Already listed: an official teller takes the row over from a lesser one (17 Oct: the tanker off
    // Al Jubayl stood on OSINTdefender's post when UKMTO's own warning was on the desk).
    const listed = rows.find((r) => near(r) && same(r)) ?? (e.list === "ships" && !named ? rows.find((r) => String(r[0]?.date) === e.date && !shipNamed(String(r[1])) && seaOf(String(r[2])) && seaOf(String(r[2])) === seaOf(String(e.place || ""))) : undefined);
    if (listed) {
      if (off && listed[0]?.k !== "off") {
        listed[0] = { ...listed[0], k: "off", src, url: doc.url };
        changed.add(bi);
      }
      continue;
    }
    if (e.list === "ships") {
      e.site = shipName(e.site);
      if (rows.some((r) => sameShip(String(r[1]), String(r[0]?.date || ""), e.site, e.date))) continue;
    }
    // An unnamed ship ("a tanker") is kept only with its place, once a day there.
    if (!named) {
      if (e.list !== "ships" || !e.place || !doc.text.toLowerCase().includes(String(e.place).toLowerCase().split(/[ ,]/)[0])) continue;
      if (rows.some((r) => String(r[0]?.date) === e.date && shipKey(String(r[2])) === shipKey(e.place!) && !/[A-Z]{2,}|\b[A-Z][a-z]+ [A-Z]/.test(String(r[1])))) continue;
    }
    const first: Cell = { v: dayLabel(e.date), k: off ? "off" : "unoff", src, url: doc.url, date: e.date };
    const what = String(e.what || "Not stated");
    // A new attack's state: what the report says of the site, else not known.
    const state = stateText(e.status && STATES.includes(e.status) ? `${STATE_WORD[e.status]}: ${e.state || what}` : `Not known: ${e.state || what}`);
    const row = e.list === "energy"
      ? [first, `${e.site}${e.place ? `, ${e.place}` : ""}`, e.by || "Not stated", e.weapon || "Not stated", { v: state, k: first.k, src, url: doc.url, date: day(doc.at) }]
      : e.list === "nuclear"
        ? [first, e.site, e.by || "Not stated", what]
        : [first, e.site, e.place || "Not stated", e.weapon || "Not stated", what];
    rows.push(row as [Cell, ...unknown[]]);
    b.rows = byDayDesc(rows);
    changed.add(bi);
  }
  return [...changed].map((i) => (out[i].stats ? recount(tidyList(out[i]), now) : out[i]));
}

/**
 * UKMTO's own warnings on the desk, read by code, not a model (17 Oct: its
 * 16 Oct warning of a tanker struck off Al Jubayl waited on a model read and
 * came in on OSINTdefender's post): each attack in the Gulf, Hormuz or the Gulf
 * of Oman is a row, official, on its own words. The Red Sea and the Gulf of
 * Aden are the Yemen desk's ledger.
 */
const UKMTO_SRC = /^UKMTO\b|x\.com\/UK_MTO\//i;
export function ukmtoEvents(reports: LiveReport[], since: number): { docs: Doc[]; events: EventUpdate[] } {
  const docs: Doc[] = [], events: EventUpdate[] = [];
  for (const r of reports) {
    const t = Date.parse(String(r.at || ""));
    const line = String(r.summary || "").trim();
    if (!Number.isFinite(t) || t < since || !(UKMTO_SRC.test(String(r.source || "")) || UKMTO_SRC.test(String(r.url || "")))) continue;
    const verb = /^(.*?)\s+(?:was |were )?(struck|hit|attacked|targeted|boarded|seized|fired (?:on|at)|damaged|sunk)\b/i.exec(line.replace(/^UKMTO(?: reports| warns)?:?\s*/i, ""));
    if (!verb) continue;
    const place = /\b\d+\s?(?:NM|nautical miles|miles)\s+[a-z-]+\s+of\s+[A-Z][\w'-]*(?:\s[A-Z][\w'-]*)*(?:,\s?[A-Z][\w ]+)?|\b(?:Strait of Hormuz|Gulf of Oman|Arabian Gulf|Persian Gulf)\b|\boff\s+[A-Z][\w'-]+(?:,\s?[A-Z][\w]+)?/.exec(line)?.[0];
    if (!place || !/^(?:gulf|hormuz|oman-sea)$/.test(String(seaOf(place)))) continue;
    const id = docs.length;
    docs.push({ id, at: String(r.at), source: "UKMTO", url: String(r.url || ""), text: `${line}. ${r.text || ""}` });
    const weapon = /unknown projectile|projectiles?|rocket-propelled grenade|RPG|UAV|drones?|(?:sea |naval )?mines?|missiles?/i.exec(line)?.[0];
    events.push({ list: "ships", date: String(r.at).slice(0, 10), site: verb[1].replace(/^(?:a|an|the)\s+/i, "") || "Ship", place, weapon: weapon ? weapon[0].toUpperCase() + weapon.slice(1) : "Not stated", what: line, official: true, source: "UKMTO", doc: id });
  }
  return { docs, events };
}
const UKMTO_EVERY_MS = 30 * 60_000;
/** Every half hour: UKMTO's warnings of the last three days onto the ship list. */
export async function refreshUkmto(store: DeskStore, file: NumbersFile, now = new Date()): Promise<boolean> {
  const live: IranLive = { ...emptyLive(), ...((await store.getJson<IranLive>(IRAN_LIVE_KEY)) ?? {}) };
  const last = Date.parse(live.tried.ukmto || "");
  if (Number.isFinite(last) && now.getTime() - last < UKMTO_EVERY_MS) return false;
  live.tried.ukmto = now.toISOString();
  const { reports } = await store.recentDesk(400, undefined, { events: false, desk: "iran" });
  const { docs, events } = ukmtoEvents(reports as unknown as LiveReport[], now.getTime() - 3 * 86_400_000);
  const box = boxNow(file, live, "Incidents");
  const got = box && events.length ? applyAnswer([box], { events }, docs, now) : [];
  for (const b of got) putBox(live, b, now);
  await store.putJson(IRAN_LIVE_KEY, live);
  return got.length > 0;
}

export const MODEL_EVERY_MS = 6 * 3600_000;
/** After no model answered, the next try. */
const MODEL_RETRY_MS = 3600_000;

/** Every 6 hours: the reports since the last reading (at most a day and a half), read for the panel's figures. */
export async function refreshIranReports(store: DeskStore, file: NumbersFile, now = new Date()): Promise<Box[] | null> {
  const live: IranLive = { ...emptyLive(), ...((await store.getJson<IranLive>(IRAN_LIVE_KEY)) ?? {}) };
  const last = Date.parse(live.tried.model || "");
  if (Number.isFinite(last) && now.getTime() - last < MODEL_EVERY_MS) return null;
  const read = Date.parse(String(live.meta.modelRead || ""));
  const since = Math.max(Number.isFinite(read) ? read - 3600_000 : 0, now.getTime() - 36 * 3600_000);
  const { reports } = await store.recentDesk(1500, undefined, { events: false, desk: "iran" });
  const titles = file.sets.flatMap((s) => s.boxes.map((b) => b.title));
  const boxes = titles.map((t) => boxNow(file, live, t)).filter((b): b is Box => !!b);
  const got = await readReports(boxes, reports as unknown as LiveReport[], since, now);
  live.tried.model = new Date(got ? now.getTime() : now.getTime() - MODEL_EVERY_MS + MODEL_RETRY_MS).toISOString();
  if (got) {
    live.meta.modelRead = now.toISOString();
    for (const b of got) putBox(live, b, now);
    console.log(`[iran-numbers] ${got.length} boxes moved: ${got.map((b) => b.title).join(", ") || "none"}`);
  }
  live.updatedAt = now.toISOString();
  await store.putJson(IRAN_LIVE_KEY, live);
  return got;
}

/** Ask the model over the reports since `since`. Null when no model answered. */
export async function readReports(boxes: Box[], reports: LiveReport[], since: number, now: Date): Promise<Box[] | null> {
  const docs = docsFrom(reports, since);
  if (!docs.length) return [];
  const slots = slotsOf(boxes);
  const got = await askChain("iran-numbers", SYSTEM, userMessage(slots, docs), { temperature: 0, models: NUMBERS_MODELS, timeoutMs: 150_000 });
  if (!got) return null;
  return applyAnswer(boxes, got.json as ModelAnswer, docs, now);
}
