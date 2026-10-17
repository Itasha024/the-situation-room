/**
 * The Iran desk's numbers, kept current by readers (user, 17 Oct: "everything
 * should be automatic"). public/iran-numbers.json is the researched start, as
 * of 11 Oct; each reader here takes a box from it (or its own last version) and
 * returns the box as its source now stands. The page shows the stored box in
 * place of the file's, by title.
 *
 * Two kinds of reader:
 * - a source's own data, read on a clock: prices and rates (Yahoo Finance, the
 *   Bank of Israel, tgju, CNBC, FT), IODA's internet signals, the US EIA's
 *   pump price, the IMO's list of confirmed ship attacks, the UK's list of
 *   Iran designations. The figure is the source's, never a model's;
 * - the desk's own reports, read by a model every 6 hours (iran-live-model.ts),
 *   for the boxes no source publishes as data: casualties, attacks on energy
 *   and nuclear sites, the ships and crews stranded, prices in Iran. A figure
 *   is kept only when the report it cites states it.
 *
 * Server-only fetch, pure parsing. A reader that fails leaves its box as it was.
 */

import type { DeskStore } from "./store.ts";

export const IRAN_LIVE_KEY = "iran:live";

export type Cell = { v: string; q?: string; k: "off" | "unoff"; src: string; url: string; date: string; note?: string };
export type Point = { d: string; v: number };
/** A box of public/iran-numbers.json: loosely typed, as the page reads it. */
export type Box = { type: string; title: string; [k: string]: unknown };
export type NumbersFile = { asOf: string; sets: { key: string; name: string; boxes: Box[] }[] };
export type IranLive = {
  /** Each box as its reader last made it, by title. */
  boxes: Record<string, Box>;
  /** When each box last changed. */
  at: Record<string, string>;
  /** When each reader last ran, and what it needs to keep (a baseline). */
  tried: Record<string, string>;
  meta: Record<string, unknown>;
  updatedAt: string;
};
export const emptyLive = (): IranLive => ({ boxes: {}, at: {}, tried: {}, meta: {}, updatedAt: "" });

export type Get = (url: string) => Promise<string>;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
export const get: Get = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`${res.status} ${url}`);
  }
  return res.text();
};

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const MINUS = "−";

/** "+51%", "−1.5%": one decimal under 10%. */
export function pct(now: number, before: number): string {
  const p = ((now - before) / before) * 100;
  const a = Math.abs(p);
  const s = a < 10 ? a.toFixed(1) : String(Math.round(a));
  return `${p < 0 ? MINUS : "+"}${s}%`;
}
/** A figure as the page writes it: "3.055", "4,061.71", "2,651,000". */
export const num = (v: number, dp = 0) => v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
/** The number in a cell's text: "$104.72" → 104.72, "4,132.20" → 4132.2, "−3.3%" → null for a range. */
export function cellNum(c: Cell | null | undefined): number | null {
  if (!c || c.v == null) return null;
  const m = String(c.v).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/* ---------------- series sources ---------------- */

/** Daily closes from Yahoo Finance's chart API. */
export async function yahoo(symbol: string, g: Get = get): Promise<Point[]> {
  const j = JSON.parse(await g(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`));
  const r = j?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const cl: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
  // The exchange's own day: its open is the date, whatever the UTC hour.
  const off = Number(r?.meta?.gmtoffset) || 0;
  return ts.map((t, i) => ({ d: isoDay((t + off) * 1000), v: cl[i] as number })).filter((p) => Number.isFinite(p.v));
}
export const yahooUrl = (symbol: string) => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;

/** CNBC's one-year chart data (the Gulf exchanges Yahoo lacks). */
export async function cnbc(symbol: string, g: Get = get): Promise<Point[]> {
  const j = JSON.parse(await g(cnbcUrl(symbol)));
  const bars: { close: string; tradeTime: string }[] = j?.barData?.priceBars ?? [];
  return bars.map((b) => ({ d: `${b.tradeTime.slice(0, 4)}-${b.tradeTime.slice(4, 6)}-${b.tradeTime.slice(6, 8)}`, v: Number(b.close) })).filter((p) => Number.isFinite(p.v));
}
export const cnbcUrl = (symbol: string) => `https://ts-api.cnbc.com/harmony/app/charts/1Y.json?symbol=${encodeURIComponent(symbol)}`;

/** FT Markets' price history (an HTML fragment in JSON): the S&P GCC index, Abu Dhabi. */
export async function ft(symbol: string, now: Date, g: Get = get): Promise<Point[]> {
  const j = JSON.parse(await g(ftUrl(symbol, now)));
  const out: Point[] = [];
  for (const m of String(j?.html ?? "").matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const date = /mod-ui-hide-small-below">([A-Za-z]+, [A-Za-z]+ \d{1,2}, \d{4})</.exec(m[1]);
    const tds = [...m[1].matchAll(/<td>([\d,.]+)<\/td>/g)].map((x) => Number(x[1].replace(/,/g, "")));
    if (!date || tds.length < 4) continue;
    const ms = Date.parse(`${date[1].replace(/^[A-Za-z]+, /, "")} UTC`);
    if (Number.isFinite(ms) && Number.isFinite(tds[3])) out.push({ d: isoDay(ms), v: tds[3] });
  }
  return out;
}
export function ftUrl(symbol: string, now: Date): string {
  const d = (ms: number) => isoDay(ms).replace(/-/g, "/");
  return `https://markets.ft.com/data/equities/ajax/get-historical-prices?startDate=${d(now.getTime() - 60 * DAY)}&endDate=${d(now.getTime())}&symbol=${symbol}`;
}

/** The Bank of Israel's representative rate, from its statistics API. */
export async function boi(now: Date, g: Get = get): Promise<Point[]> {
  const csv = await g(boiUrl(now));
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0].split(",");
  const iD = head.indexOf("TIME_PERIOD"), iV = head.indexOf("OBS_VALUE");
  return lines.slice(1).map((l) => l.split(",")).map((c) => ({ d: c[iD], v: Number(c[iV]) })).filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.d) && Number.isFinite(p.v));
}
export const boiUrl = (now: Date) => `https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS?startperiod=${isoDay(now.getTime() - 60 * DAY)}&format=csv`;

/** tgju.org's history table: the closing price (the fourth column) of each day. */
export function parseTgju(html: string): Point[] {
  const out: Point[] = [];
  const body = html.slice(html.indexOf('id="table-list"'));
  for (const m of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const tds = [...m[1].matchAll(/<td>\s*([^<]*?)\s*<\/td>/g)].map((x) => x[1]);
    const day = tds.find((t) => /^20\d\d\/\d\d\/\d\d$/.test(t));
    if (!day || tds.length < 4) continue;
    const v = Number(tds[3].replace(/,/g, ""));
    if (Number.isFinite(v)) out.push({ d: day.replace(/\//g, "-"), v });
  }
  return out;
}
export const tgjuUrl = (item: string) => `https://www.tgju.org/profile/${item}/history`;

/** Old points kept, new ones added or corrected, in date order. */
export function mergeSeries(old: Point[] | undefined, fresh: Point[]): Point[] {
  const by = new Map((old ?? []).map((p) => [p.d, p.v]));
  for (const p of fresh) by.set(p.d, p.v);
  return [...by].map(([d, v]) => ({ d, v })).sort((a, b) => a.d.localeCompare(b.d));
}
/** The last point on or before a day. */
export function atOrBefore(pts: Point[], day: string): Point | undefined {
  let hit: Point | undefined;
  for (const p of pts) if (p.d <= day) hit = p;
  return hit;
}

type SeriesSpec = { fetch: (g: Get, now: Date) => Promise<Point[]>; src: string; url: (now: Date) => string; fmt: (v: number) => string; scale?: number };

/** A "Latest / 7 days earlier / Before conflict" box from its series. */
export function span3From(box: Box, fresh: Point[], spec: Pick<SeriesSpec, "src" | "fmt">, url: string): Box | null {
  const scaled = fresh;
  if (!scaled.length) return null;
  const series = mergeSeries(box.series as Point[] | undefined, scaled);
  const last = series[series.length - 1];
  const old = box.latest as Cell | undefined;
  if (old && old.date && last.d < old.date) return null;
  const weekPt = atOrBefore(series, isoDay(Date.parse(last.d) - 7 * DAY));
  const k = old?.k ?? "off";
  const cell = (p: Point): Cell => ({ v: spec.fmt(p.v), k, src: spec.src, url, date: p.d });
  const before = cellNum(box.before as Cell);
  const next: Box = { ...box, series, latest: cell(last), ...(weekPt ? { week: cell(weekPt) } : {}) };
  if (before != null && box.change !== undefined) next.change = pct(last.v, before);
  return next;
}

const SERIES: Record<string, SeriesSpec> = {
  "Crude oil price": { fetch: (g) => yahoo("BZ=F", g), src: "ICE Brent front month, via Yahoo Finance", url: () => yahooUrl("BZ=F"), fmt: (v) => `$${v.toFixed(2)}` },
  "The shekel's rate": { fetch: (g, now) => boi(now, g), src: "Bank of Israel", url: boiUrl, fmt: (v) => v.toFixed(3) },
  "Tel Aviv Stock Exchange": { fetch: (g) => yahoo("TA35.TA", g), src: "Yahoo Finance (TASE feed)", url: () => yahooUrl("TA35.TA"), fmt: (v) => num(v, 2) },
  "Gulf stock markets": { fetch: (g, now) => ft("598752535", now, g), src: "S&P Dow Jones Indices, via FT Markets", url: (now) => ftUrl("598752535", now), fmt: (v) => num(v, 2) },
  "The rial's open-market rate": { fetch: async (g) => parseTgju(await g(tgjuUrl("price_dollar_rl"))), src: "tgju.org", url: () => tgjuUrl("price_dollar_rl"), fmt: (v) => num(v) },
  // tgju gives rials; the box counts millions.
  "Gold coin in Tehran": { fetch: async (g) => parseTgju(await g(tgjuUrl("sekee"))).map((p) => ({ d: p.d, v: Math.round(p.v / 1e5) / 10 })), src: "tgju.org", url: () => tgjuUrl("sekee"), fmt: (v) => num(v, 1) },
};

/* ---------------- Gulf exchanges ---------------- */

const GULF: Record<string, { fetch: (g: Get, now: Date) => Promise<Point[]>; src: string; url: (now: Date) => string }> = {
  "Saudi Arabia": { fetch: (g) => yahoo("^TASI.SR", g), src: "Yahoo Finance ^TASI.SR", url: () => yahooUrl("^TASI.SR") },
  Qatar: { fetch: (g) => yahoo("^GNRI.QA", g), src: "Yahoo Finance ^GNRI.QA", url: () => yahooUrl("^GNRI.QA") },
  Kuwait: { fetch: (g) => yahoo("^BKP.KW", g), src: "Yahoo Finance ^BKP.KW", url: () => yahooUrl("^BKP.KW") },
  Dubai: { fetch: (g) => cnbc(".DFMGI", g), src: "CNBC chart data", url: () => cnbcUrl(".DFMGI") },
  Bahrain: { fetch: (g) => cnbc(".BAX", g), src: "CNBC chart data", url: () => cnbcUrl(".BAX") },
  Oman: { fetch: (g) => cnbc(".MSX30", g), src: "CNBC chart data", url: () => cnbcUrl(".MSX30") },
  "Abu Dhabi": { fetch: (g, now) => ft("962958418", now, g), src: "FTSE Russell via FT Markets data", url: (now) => ftUrl("962958418", now) },
};

type Row = { label: string; sub?: string; cells: (Cell | null)[] };
/** One at a time: FT and CNBC turn away a burst. */
async function seq<T, U>(xs: T[], f: (x: T) => Promise<U>): Promise<U[]> {
  const out: U[] = [];
  for (const x of xs) out.push(await f(x));
  return out;
}

async function gulfExchanges(box: Box, g: Get, now: Date): Promise<Box | null> {
  const rows = box.rows as Row[];
  let moved = false;
  const next = await seq(
    rows, (async (r) => {
      const spec = GULF[r.label];
      if (!spec) return r;
      try {
        const pts = await spec.fetch(g, now);
        const last = pts[pts.length - 1];
        const old = r.cells[0];
        if (!last || (old?.date && last.d <= old.date)) return r;
        const before = cellNum(r.cells[1]);
        const url = spec.url(now);
        moved = true;
        const cells: (Cell | null)[] = [{ v: num(last.v, 2), k: old?.k ?? "off", src: spec.src, url, date: last.d }, r.cells[1]];
        cells.push(before != null ? { v: pct(last.v, before), k: old?.k ?? "off", src: `Our calculation from ${spec.src}`, url, date: last.d } : r.cells[2] ?? null);
        return { ...r, cells };
      } catch {
        return r;
      }
    }),
  );
  return moved ? { ...box, rows: next } : null;
}

/* ---------------- internet (IODA) ---------------- */

const IODA = "https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/country/IR";
export const iodaUrl = (from: number, until: number, ds: string) => `${IODA}?from=${Math.floor(from / 1000)}&until=${Math.floor(until / 1000)}&datasource=${ds}`;
/** The mean of a signal's values in a span: "ping-slash24" (networks answering) or "gtr" (Google searches). */
export function iodaMean(json: string, ds: string): number | null {
  const j = JSON.parse(json);
  const list = (Array.isArray(j?.data?.[0]) ? j.data[0] : j?.data) ?? [];
  const s = list.find((x: { datasource: string }) => x.datasource === ds);
  const vs: number[] = (s?.values ?? []).filter((v: unknown) => typeof v === "number" && Number.isFinite(v));
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
}
/** The month before the war: the level "now" is measured against. */
const PREWAR = [Date.parse("2026-01-28T00:00:00Z"), Date.parse("2026-02-27T00:00:00Z")];

async function internet(box: Box, g: Get, now: Date, live: IranLive): Promise<Box | null> {
  const rows = box.rows as Row[];
  const base = (live.meta.iodaBase ?? {}) as Record<string, number>;
  const until = now.getTime(), from = until - DAY;
  let moved = false;
  const series = [...((box.series as Point[]) ?? [])];
  const next = await seq(
    rows, (async (r) => {
      const ds = r.label === "Networks answering now" ? "ping-slash24" : r.label === "Google searches from Iran now" ? "gtr" : "";
      if (!ds) return r;
      try {
        if (!base[ds]) {
          const b = iodaMean(await g(iodaUrl(PREWAR[0], PREWAR[1], ds)), ds);
          if (!b) return r;
          base[ds] = b;
        }
        const m = iodaMean(await g(iodaUrl(from, until, ds)), ds);
        if (m == null) return r;
        const p = Math.round((m / base[ds]) * 100);
        const day = isoDay(until);
        moved = true;
        if (ds === "ping-slash24") series.splice(0, series.length, ...mergeSeries(series, [{ d: day, v: p }]));
        return { ...r, cells: [{ ...(r.cells[0] as Cell), v: `${p}%`, url: iodaUrl(from, until, ds), date: day }] };
      } catch {
        return r;
      }
    }),
  );
  live.meta.iodaBase = base;
  return moved ? { ...box, rows: next, series } : null;
}

/* ---------------- US pump price (EIA) ---------------- */

const EIA = "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=pet&s=emm_epmr_pte_nus_dpg&f=w";
/** The EIA's weekly table: rows "2026-Oct" with "10/05" date and price pairs. */
export function parseEia(html: string): Point[] {
  const out: Point[] = [];
  for (const m of html.matchAll(/<td class='B6'>(?:&nbsp;)*\s*(\d{4})-[A-Za-z]{3}<\/td>([\s\S]*?)<\/tr>/g)) {
    for (const c of m[2].matchAll(/<td class='B5'>(\d\d)\/(\d\d)(?:&nbsp;)*<\/td>\s*<td class='B3'>([\d.]+)/g)) out.push({ d: `${m[1]}-${c[1]}-${c[2]}`, v: Number(c[3]) });
  }
  return out;
}
async function pumpPrices(box: Box, g: Get): Promise<Box | null> {
  const pts = parseEia(await g(EIA));
  const last = pts[pts.length - 1];
  const rows = box.rows as Row[];
  const us = rows.findIndex((r) => r.label === "US");
  const old = rows[us]?.cells[0];
  if (!last || us < 0 || (old?.date && last.d <= old.date)) return null;
  const nextRows = rows.map((r, i) => (i === us ? { ...r, cells: [{ v: `$${last.v.toFixed(2)}`, k: "off" as const, src: "US EIA, weekly", url: EIA, date: last.d }, ...r.cells.slice(1)] } : r));
  return { ...box, rows: nextRows, series: mergeSeries(box.series as Point[], pts.filter((p) => p.d >= "2026-01-01")) };
}

/* ---------------- ship attacks (IMO) ---------------- */

export const IMO_INCIDENTS = "https://www.imo.org/en/mediacentre/hottopics/pages/middle-east-highlighted-incidents.aspx";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const clean = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/&#58;/g, ":").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
export type ImoRow = { date: string; ship: string; imo: string; where: string; what: string };
export type ImoPage = { asAt: string; confirmed: number; deaths: number | null; rows: ImoRow[] };

/** "13 October" in the war's year (the page gives no year; a month after today is last year's). */
function imoDay(s: string, now: Date): string {
  const m = /(\d{1,2})\s+([A-Za-z]+)/.exec(s);
  if (!m) return "";
  const mon = MONTHS.indexOf(m[2].toLowerCase());
  if (mon < 0) return "";
  let y = now.getUTCFullYear();
  if (mon > now.getUTCMonth()) y -= 1;
  return `${y}-${String(mon + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
export function parseImo(html: string, now: Date): ImoPage | null {
  const t = clean(html);
  const head = /confirmed incidents as at (\d{1,2} [A-Za-z]+ \d{4}):\s*(\d+)/i.exec(t);
  if (!head) return null;
  const deaths = /confirmed seafarer fatalities:\s*(\d+)/i.exec(t);
  const rows: ImoRow[] = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => clean(x[1]));
    if (tds.length < 4) continue;
    const date = imoDay(tds[0], now);
    if (!date) continue;
    const sm = /^(.*?)\s*\(IMO\s*(\d{7})\)/i.exec(tds[1]);
    rows.push({ date, ship: (sm ? sm[1] : tds[1]).trim(), imo: sm ? sm[2] : "", where: tds[2], what: tds[3] });
  }
  const [d, mo, y] = head[1].split(" ");
  const asAt = `${y}-${String(MONTHS.indexOf(mo.toLowerCase()) + 1).padStart(2, "0")}-${d.padStart(2, "0")}`;
  return { asAt, confirmed: Number(head[2]), deaths: deaths ? Number(deaths[1]) : null, rows };
}
/** "GFS PRIDE" and "GFS Pride (Liberia)" are one ship. */
export const shipKey = (s: string) =>
  String(s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/^(?:m [tv]|mt|mv|the|vlcc|tanker|container ship) /, "");
/** "M/T Valthera" → "Valthera": the ship's name as the IMO writes it. */
export const shipName = (s: string) => String(s || "").replace(/^(?:M\/?[TV]|MT|MV)\.?\s+/i, "").trim();
/** One ship, one incident: its name, within three days. */
export function sameShip(a: string, aDay: string, b: string, bDay: string): boolean {
  const x = shipKey(a), y = shipKey(b);
  if (!x || !y || !(x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `))) return false;
  return Math.abs(Date.parse(aDay) - Date.parse(bDay)) <= 3 * DAY;
}
const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\b(Ii|Iii|Iv|Lng|Lpg|Vlcc|Gfs|Dp|Mt|Mv)\b/g, (w) => w.toUpperCase());
export const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MON3[Number(iso.slice(5, 7)) - 1]}`;

/** A list's rows: the first cell carries the date. */
type ListRow = [Cell, ...unknown[]];
const rowDay = (r: ListRow) => String(r?.[0]?.date || "");

/** Today, the last 7 days and since 28 Feb, counted from the list's own rows. */
export function recount(box: Box, now: Date): Box {
  const rows = box.rows as ListRow[];
  const today = isoDay(now.getTime()), week = isoDay(now.getTime() - 6 * DAY);
  const n = (f: (d: string) => boolean) => rows.filter((r) => f(rowDay(r))).length;
  const stats = box.stats as [Cell, string][] | undefined;
  if (!stats) return box;
  const counts: Record<string, number> = { Today: n((d) => d === today), "Last 7 days": n((d) => d >= week && d <= today), "Since 28 Feb": n((d) => d >= "2026-02-28") };
  return { ...box, stats: stats.map(([c, l]) => (l in counts ? [{ ...c, v: String(counts[l]), date: today }, l] : [c, l])) };
}
/** Newest first, as the researched lists are. */
export const byDayDesc = (rows: ListRow[]) => [...rows].sort((a, b) => rowDay(b).localeCompare(rowDay(a)));

export function imoIncidents(box: Box, page: ImoPage, now: Date): Box {
  const rows = [...(box.rows as ListRow[])];
  for (const r of page.rows) {
    if (r.date < "2026-02-28") continue;
    const imo: Cell = { v: dayLabel(r.date), k: "off", src: "IMO, confirmed incidents", url: IMO_INCIDENTS, date: r.date };
    const at = rows.findIndex((x) => sameShip(String(x[1]), rowDay(x), r.ship, r.date));
    if (at >= 0) {
      // A report's row the IMO now confirms: official, on the IMO's date.
      if (rows[at][0]?.k !== "off") rows[at] = [imo, ...rows[at].slice(1)] as ListRow;
      continue;
    }
    rows.push([imo, title(r.ship), r.where, "Not stated", r.what]);
  }
  const note = `The IMO confirms ${page.confirmed} incidents to ${dayLabel(page.asAt)}${page.deaths != null ? `, with ${page.deaths} seafarers killed` : ""}. The list also has attacks reported by UKMTO and others that the IMO has not confirmed.`;
  return recount({ ...box, rows: byDayDesc(rows), note }, now);
}

/* ---------------- UK sanctions (GOV.UK) ---------------- */

export const UK_LIST = "https://www.gov.uk/api/content/guidance/iran-list-of-designations-and-sanctions-notices";
export const UK_PAGE = "https://www.gov.uk/guidance/iran-list-of-designations-and-sanctions-notices";
type UkChange = { note: string; public_timestamp: string };
type UkAttach = { url?: string; title?: string };
/** Each "Added N new designations" line since the war began. */
export function ukAdds(json: string): { date: string; n: number; url: string }[] {
  const j = JSON.parse(json);
  const hist: UkChange[] = j?.details?.change_history ?? [];
  const att: UkAttach[] = j?.details?.attachments ?? [];
  const out: { date: string; n: number; url: string }[] = [];
  for (const h of hist) {
    const m = /Added (\d+) new designations?/i.exec(h.note || "");
    const date = String(h.public_timestamp || "").slice(0, 10);
    if (!m || date < "2026-02-28") continue;
    // The notice of that day, by the date in its title ("Sanctions Notice (Iran) 12 October 2026").
    const [y, mo, d] = date.split("-");
    const words = `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`;
    const pdf = att.find((a) => String(a.title || a.url || "").toLowerCase().replace(/_/g, " ").includes(words));
    out.push({ date, n: Number(m[1]), url: pdf?.url || UK_PAGE });
  }
  return out;
}
export function ukSanctions(box: Box, adds: { date: string; n: number; url: string }[]): Box | null {
  const rows = [...(box.rows as Row[])];
  const has = (label: string) => rows.some((r) => r.label === label);
  let moved = false;
  for (const a of adds) {
    const label = `UK, ${dayLabel(a.date)}`;
    if (has(label)) continue;
    const at = rows.findIndex((r) => r.label === "UK, total");
    rows.splice(at < 0 ? rows.length : at, 0, { label, cells: [{ v: String(a.n), k: "off", src: "UK Foreign Office (OFSI notice)", url: a.url, date: a.date }] });
    moved = true;
  }
  if (!moved) return null;
  const sum = rows.filter((r) => /^UK, \d/.test(r.label)).reduce((s, r) => s + (cellNum(r.cells[0]) ?? 0), 0);
  const last = adds.map((a) => a.date).sort().pop()!;
  return { ...box, rows: rows.map((r) => (r.label === "UK, total" ? { ...r, cells: [{ v: String(sum), k: "off" as const, src: "Our sum of the UK's notices", url: UK_PAGE, date: last }] } : r)) };
}

/* ---------------- IAEA: days without an inspection ---------------- */

/** "130 days" since the last inspection, counted to today; the model moves the date when inspectors return. */
export function daysSince(box: Box, now: Date): Box | null {
  const v = box.value as Cell;
  const from = String(box.since || "2026-06-03");
  const days = Math.floor((now.getTime() - Date.parse(`${from}T00:00:00Z`)) / DAY);
  if (!Number.isFinite(days) || v.v === `${days} days`) return null;
  return { ...box, since: from, value: { ...v, v: `${days} days`, note: `Counted to ${dayLabel(isoDay(now.getTime()))} from the IAEA's last reported inspection` } };
}

/* ---------------- the clock ---------------- */

type Reader = { id: string; box: string; every: number; run: (box: Box, g: Get, now: Date, live: IranLive) => Promise<Box | null> };
const H = 3600_000;
export const READERS: Reader[] = [
  ...Object.entries(SERIES).map(([title, spec]): Reader => ({
    id: `series:${title}`,
    box: title,
    every: 3 * H,
    run: async (box, g, now) => span3From(box, await spec.fetch(g, now), spec, spec.url(now)),
  })),
  { id: "gulf", box: "Gulf exchanges", every: 3 * H, run: (b, g, now) => gulfExchanges(b, g, now) },
  { id: "ioda", box: "Internet in Iran", every: 3 * H, run: (b, g, now, live) => internet(b, g, now, live) },
  { id: "eia", box: "Petrol prices at the pump", every: 12 * H, run: (b, g) => pumpPrices(b, g) },
  { id: "imo", box: "Incidents", every: 2 * H, run: async (b, g, now) => { const p = parseImo(await g(IMO_INCIDENTS), now); return p ? imoIncidents(b, p, now) : null; } },
  { id: "uk", box: "EU and UK sanctions since 28 Feb", every: 2 * H, run: async (b, g) => ukSanctions(b, ukAdds(await g(UK_LIST))) },
  { id: "iaea-days", box: "IAEA inspectors in Iran", every: 6 * H, run: async (b, _g, now) => daysSince(b, now) },
  // The lists' Today and Last 7 days move with the clock, new rows or not.
  { id: "recount-energy", box: "Attacks on energy sites", every: 6 * H, run: async (b, _g, now) => recount(b, now) },
  { id: "recount-sea", box: "Incidents", every: 6 * H, run: async (b, _g, now) => recount(b, now) },
];

/** A box as it now stands: the reader's last version, else the researched file's. */
export function boxNow(file: NumbersFile, live: IranLive, title: string): Box | null {
  if (live.boxes[title]) return live.boxes[title];
  for (const s of file.sets) for (const b of s.boxes) if (b.title === title) return b;
  return null;
}
/** Store a reader's box, and when it changed. */
export function putBox(live: IranLive, box: Box, now: Date) {
  const was = live.boxes[box.title];
  if (was && JSON.stringify(was) === JSON.stringify(box)) return;
  live.boxes[box.title] = box;
  live.at[box.title] = now.toISOString();
}

let running: Promise<IranLive | null> | null = null;
/** Run each reader that is due; called from the Iran desk's tick. */
export function refreshIranLive(store: DeskStore, file: NumbersFile, now = new Date(), g: Get = get): Promise<IranLive | null> {
  if (running) return running;
  running = (async () => {
    const live = { ...emptyLive(), ...((await store.getJson<IranLive>(IRAN_LIVE_KEY)) ?? {}) };
    let ran = 0;
    for (const r of READERS) {
      const last = Date.parse(live.tried[r.id] || "");
      if (Number.isFinite(last) && now.getTime() - last < r.every) continue;
      live.tried[r.id] = now.toISOString();
      ran++;
      const box = boxNow(file, live, r.box);
      if (!box) continue;
      try {
        const next = await r.run(box, g, now, live);
        if (next) putBox(live, next, now);
      } catch (err) {
        console.error(`[iran-live] ${r.id}:`, err instanceof Error ? err.message : err);
      }
    }
    if (!ran) return live;
    live.updatedAt = now.toISOString();
    await store.putJson(IRAN_LIVE_KEY, live);
    return live;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** What the page swaps in: every box a reader has made, and the newest day any of them reached. */
export function liveNumbers(live: IranLive | null, extra: Box[] = []): { boxes: Box[]; through: string } | null {
  const boxes = [...Object.values(live?.boxes ?? {}).filter((b) => !extra.some((x) => x.title === b.title)), ...extra];
  if (!boxes.length) return null;
  const through = Object.values(live?.at ?? {}).sort().pop() || "";
  return { boxes, through };
}
