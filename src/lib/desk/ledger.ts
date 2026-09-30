/**
 * The Maritime and Energy numbers: ships attacked, Bab al-Mandab and Suez
 * traffic, the energy sites hit and how they stand, exports. Server-only.
 *
 * Kept like the casualty tally (tally.ts): a model reads the window's sea,
 * energy and strike cards every 6 hours and proposes entries; code keeps only
 * what the cited text itself says (the ship's name, the site's name, the
 * figure's digits must be in it). Ship traffic comes from IMF PortWatch's free
 * daily chokepoint counts (AIS, about 3 days behind), read directly.
 */

import type { LiveReport } from "./types.ts";
import { askChain, COMBINE_MODELS } from "./models.ts";
import type { DeskStore } from "./store.ts";

export const LEDGER_KEY = "ledger";
export const TRANSITS_KEY = "ledger-transits";

export type LedgerSource = { name: string; url: string; date: string };
export type ShipWhat = "attacked" | "hit" | "seized" | "sunk" | "near miss" | "suspicious approach";
export type ShipIncident = {
  id: string;
  date: string;
  ship?: string;
  flag?: string;
  type?: string;
  place: string;
  what: ShipWhat;
  attacker?: string;
  crew?: string;
  src: LedgerSource;
};
export type SiteStatus = "working" | "reduced" | "down" | "unknown";
export type EnergySite = {
  id: string;
  name: string;
  kind: string;
  country: "Saudi Arabia" | "Yemen";
  /** One per day it was hit, the first source that said so. */
  hits: LedgerSource[];
  status: SiteStatus;
  statusSrc?: LedgerSource;
};
/** Exports, output and other energy or shipping figures, each as its source gave it. */
export type LedgerFigure = { id: string; cat: "maritime" | "energy"; label: string; value: number; unit: string; src: LedgerSource };
/** A declared ban, a warning to shipping, a naval mission's move. */
export type LedgerNotice = { id: string; date: string; text: string; src: LedgerSource };
export type Ledger = { since: string; ships: ShipIncident[]; sites: EnergySite[]; figures: LedgerFigure[]; notices: LedgerNotice[]; updatedAt: string };

export const LEDGER_SEED: Ledger = { since: "2026-07-03", ships: [], sites: [], figures: [], notices: [], updatedAt: "2026-07-03T00:00:00+03:00" };

/* ------------------------------------------------------------------ *
 * The sites, by their names in the reports
 * ------------------------------------------------------------------ */

type KnownSite = { id: string; name: string; kind: string; country: EnergySite["country"]; re: RegExp };
/** Saudi and Yemeni energy sites, so one site is one row whatever a report calls it. */
export const KNOWN_SITES: KnownSite[] = [
  { id: "east-west-pipeline", name: "East-West pipeline (Petroline)", kind: "pipeline", country: "Saudi Arabia", re: /East[- ]West pipeline|Petroline|pump(?:ing)? station|خط (?:أنابيب )?شرق.?غرب|محطة (?:ضخ|الضخ)/i },
  { id: "yanbu", name: "Yanbu terminals and refineries", kind: "terminal", country: "Saudi Arabia", re: /Yanbu|SAMREF|YASREF|ينبع/i },
  { id: "jazan", name: "Jazan refinery and terminal", kind: "refinery", country: "Saudi Arabia", re: /Jazan|Jizan|جازان|جيزان/i },
  { id: "jeddah", name: "Jeddah bulk plant", kind: "terminal", country: "Saudi Arabia", re: /Jeddah|Jiddah|جدة/i },
  { id: "ras-tanura", name: "Ras Tanura", kind: "terminal", country: "Saudi Arabia", re: /Ras Tanura|رأس تنورة/i },
  { id: "abqaiq", name: "Abqaiq", kind: "processing plant", country: "Saudi Arabia", re: /Abqaiq|بقيق/i },
  { id: "riyadh-refinery", name: "Riyadh refinery", kind: "refinery", country: "Saudi Arabia", re: /Riyadh refinery|مصفاة الرياض/i },
  { id: "safer", name: "Safer (Marib)", kind: "oilfield", country: "Yemen", re: /Safer|صافر/i },
  { id: "ras-isa", name: "Ras Isa", kind: "terminal", country: "Yemen", re: /Ras Isa|رأس عيسى/i },
  { id: "aden-refinery", name: "Aden refinery", kind: "refinery", country: "Yemen", re: /Aden refinery|مصافي عدن|مصفاة عدن/i },
  { id: "balhaf", name: "Balhaf LNG", kind: "gas plant", country: "Yemen", re: /Balhaf|بلحاف/i },
  { id: "hodeidah-port", name: "Hodeidah port", kind: "port", country: "Yemen", re: /Hodeidah port|port of Hodeidah|ميناء الحديدة/i },
  { id: "dhabba", name: "Al-Dhabba terminal (Hadramawt)", kind: "terminal", country: "Yemen", re: /Dhabba|الضبة/i },
];

export function siteOf(name: string, kind?: string, country?: string): { id: string; name: string; kind: string; country: EnergySite["country"] } | null {
  const hit = KNOWN_SITES.find((s) => s.re.test(name));
  if (hit) return { id: hit.id, name: hit.name, kind: hit.kind, country: hit.country };
  const c = /saudi/i.test(String(country)) ? "Saudi Arabia" : /yemen/i.test(String(country)) ? "Yemen" : null;
  const clean = String(name || "").trim();
  if (!c || clean.length < 3) return null;
  return { id: slug(clean), name: clean, kind: String(kind || "site"), country: c };
}

const slug = (s: string) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);

/* ------------------------------------------------------------------ *
 * Checks: only what the text says
 * ------------------------------------------------------------------ */

/** The figure's digits are in the text: "1.2 million", "1,200,000", "1200000", "31". */
export function figureInText(text: string, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const t = String(text || "").replace(/(\d),(?=\d{3}\b)/g, "$1");
  const forms = new Set<string>([String(value)]);
  if (value >= 1e6) forms.add(String(+(value / 1e6).toFixed(2)));
  if (value >= 1e3) forms.add(String(+(value / 1e3).toFixed(1)));
  if (!Number.isInteger(value)) forms.add(value.toFixed(1));
  return [...forms].some((f) => new RegExp(`(?<![\\d.])${f.replace(".", "\\.")}(?![\\d]|\\.\\d)`).test(t));
}

/** A name the text writes (case and "al-" aside). */
export function nameInText(text: string, name: string): boolean {
  const norm = (s: string) => String(s || "").toLowerCase().replace(/\b(?:the|m\/?v|m\/?t)\b|[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  const n = norm(name);
  return n.length >= 3 && ` ${norm(text)} `.includes(` ${n} `);
}

const WHATS: ShipWhat[] = ["attacked", "hit", "seized", "sunk", "near miss", "suspicious approach"];
const STATUSES: SiteStatus[] = ["working", "reduced", "down", "unknown"];

type Doc = { name: string; url: string; date: string; text: string };
type ShipUpdate = { doc: number; date?: string; ship?: string; flag?: string; type?: string; place?: string; what?: string; attacker?: string; crew?: string };
type SiteUpdate = { doc: number; site?: string; kind?: string; country?: string; hit?: boolean; status?: string };
type FigureUpdate = { doc: number; cat?: string; label?: string; value?: number; unit?: string };
type NoticeUpdate = { doc: number; text?: string };
export type LedgerUpdates = { ships?: ShipUpdate[]; sites?: SiteUpdate[]; figures?: FigureUpdate[]; notices?: NoticeUpdate[] };

/** Two places off the same town: "40 nm west of Hodeidah" and "off Hodeidah". */
const sameTown = (a: string, b: string) => {
  const towns = (p: string) => new Set((String(p).match(/\b[A-Z][\w'-]{2,}/g) ?? []).map((w) => w.toLowerCase()));
  const x = towns(a);
  return [...towns(b)].some((w) => x.has(w));
};
const dayMs = (d: string) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);

/** Apply the model's proposals. Pure, so the rules are testable. */
export function applyLedger(current: Ledger, u: LedgerUpdates, docs: Doc[], now: Date): Ledger {
  const next: Ledger = structuredClone(current);
  const srcOf = (d: Doc): LedgerSource => ({ name: d.name, url: d.url, date: d.date });
  for (const s of u.ships ?? []) {
    const d = docs[s?.doc];
    if (!d || !WHATS.includes(s.what as ShipWhat) || !s.place) continue;
    if (s.ship && !nameInText(d.text, s.ship)) continue;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(s.date)) ? String(s.date) : d.date;
    // One incident, one row: the same ship within a day; a ship with no name
    // is the one off the same town that day.
    const same = next.ships.find((x) =>
      Math.abs(dayMs(x.date) - dayMs(date)) <= 86_400_000 &&
      (s.ship && x.ship ? nameInText(x.ship, s.ship) || nameInText(s.ship, x.ship) : sameTown(x.place, s.place as string)),
    );
    if (same) {
      same.ship ??= s.ship || undefined;
      // A later report can say more: hit beats attacked, sunk beats hit.
      if (WHATS.indexOf(s.what as ShipWhat) > WHATS.indexOf(same.what) && s.what !== "near miss" && s.what !== "suspicious approach") same.what = s.what as ShipWhat;
      same.flag ??= s.flag || undefined;
      same.type ??= s.type || undefined;
      same.attacker ??= s.attacker || undefined;
      same.crew ??= s.crew || undefined;
      continue;
    }
    next.ships.push({
      id: slug(`${date}-${s.ship || s.place}`),
      date,
      ...(s.ship ? { ship: s.ship } : {}),
      ...(s.flag ? { flag: s.flag } : {}),
      ...(s.type ? { type: s.type } : {}),
      place: s.place,
      what: s.what as ShipWhat,
      ...(s.attacker ? { attacker: s.attacker } : {}),
      ...(s.crew ? { crew: s.crew } : {}),
      src: srcOf(d),
    });
  }
  for (const s of u.sites ?? []) {
    const d = docs[s?.doc];
    if (!d || !s.site) continue;
    const known = siteOf(s.site, s.kind, s.country);
    // The site is named in the text, by the model's words or its known names.
    const k = KNOWN_SITES.find((x) => x.id === known?.id);
    if (!known || !(nameInText(d.text, s.site) || (k && k.re.test(d.text)))) continue;
    let row = next.sites.find((x) => x.id === known.id);
    if (!row) {
      row = { ...known, hits: [], status: "unknown" };
      next.sites.push(row);
    }
    if (s.hit && !row.hits.some((h) => h.date === d.date)) row.hits.push(srcOf(d));
    const status = STATUSES.includes(s.status as SiteStatus) ? (s.status as SiteStatus) : null;
    // The latest word on a site stands; an older report never overrides it.
    if (status && status !== "unknown" && (!row.statusSrc || dayMs(d.date) >= dayMs(row.statusSrc.date))) {
      row.status = status;
      row.statusSrc = srcOf(d);
    }
  }
  for (const f of u.figures ?? []) {
    const d = docs[f?.doc];
    if (!d || !f.label || typeof f.value !== "number" || !figureInText(d.text, f.value)) continue;
    const cat = f.cat === "maritime" ? "maritime" : "energy";
    const id = slug(`${cat}-${f.label}`);
    const prev = next.figures.find((x) => x.id === id);
    if (prev && dayMs(prev.src.date) > dayMs(d.date)) continue;
    const row: LedgerFigure = { id, cat, label: String(f.label).slice(0, 80), value: f.value, unit: String(f.unit || "").slice(0, 40), src: srcOf(d) };
    if (prev) Object.assign(prev, row);
    else next.figures.push(row);
  }
  for (const n of u.notices ?? []) {
    const d = docs[n?.doc];
    const text = String(n?.text || "").trim();
    if (!d || text.length < 12) continue;
    const id = slug(`${d.date}-${text.slice(0, 40)}`);
    if (next.notices.some((x) => x.id === id || (x.src.url && x.src.url === d.url))) continue;
    next.notices.push({ id, date: d.date, text: text.slice(0, 240), src: srcOf(d) });
  }
  next.ships.sort((a, b) => b.date.localeCompare(a.date));
  next.notices.sort((a, b) => b.date.localeCompare(a.date));
  next.notices = next.notices.slice(0, 40);
  next.updatedAt = now.toISOString();
  return next;
}

/* ------------------------------------------------------------------ *
 * The 6-hour read
 * ------------------------------------------------------------------ */

/** A card about the sea or energy. */
export const SEA_ENERGY = /\b(?:ships?|vessels?|tankers?|carriers?|freighters?|bulkers?|UKMTO|JMIC|Aspides|Atalanta|CMF|shipping|transits?|Bab (?:al|el)[- ]Mand[ae]b|Red Sea|Gulf of Aden|Suez|pipeline|pump(?:ing)? station|refiner(?:y|ies)|terminal|Aramco|oil|crude|exports?|barrels?|bpd|LNG|gas plant|power (?:station|plant)|desalination)\b|سفين|سفن|ناقلة|الملاحة|باب المندب|البحر الأحمر|أرامكو|مصفاة|خط أنابيب|محطة ضخ|النفط|صادرات|برميل/i;

function ledgerDocs(reports: LiveReport[]): Doc[] {
  return reports
    .filter((r) => SEA_ENERGY.test(`${r.summary || ""} ${r.text || ""}`))
    .sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))
    .slice(0, 30)
    .map((r) => ({
      name: String(r.source || "desk report"),
      url: String(r.url || ""),
      date: String(r.at || "").slice(0, 10),
      text: `${r.summary || ""}. ${r.text || ""}`.slice(0, 1400),
    }));
}

const SYSTEM = `You keep the Maritime and Energy ledger of the current round of the Yemen war (Houthis vs the Yemeni government and the Saudi-led coalition, since 3 July 2026).
You get NEW documents (news cards). Return only what a document itself states:
- ships: each attack on, hit on, seizure or sinking of a ship, a near miss, or a suspicious approach, in the Red Sea, Bab al-Mandab, the Gulf of Aden, the Arabian Sea off Yemen, or Saudi or Yemeni waters. Fields: date (YYYY-MM-DD, of the incident), ship (its name, only if the text names it), flag, type (tanker, bulk carrier, container ship...), place (as the text puts it, e.g. "40 nm west of Hodeidah"), what (one of: attacked, hit, seized, sunk, near miss, suspicious approach), attacker (only if the text says who), crew (hurt or missing, as the text says). Hormuz and the Gulf are out unless the text says the Houthis did it. Piracy by Somali or unknown gunmen is out.
- sites: each Saudi or Yemeni energy site the text says was hit, or whose state it gives (pipelines and pump stations, refineries, terminals, oilfields, gas and power plants, desalination plants). Fields: site (its name as the text writes it), kind, country (Saudi Arabia or Yemen), hit (true when the text reports it hit in this document's news), status (working, reduced or down, only when the text says so; "resumed", "back in service" = working; "halted", "shut" = down; "partly", "reduced" = reduced).
- figures: a number the text gives about shipping or energy in this war: ships crossing Bab al-Mandab or Suez, Saudi crude exports from Yanbu or in total, pipeline throughput, Yemen's exports, freight or insurance costs. Fields: cat (maritime or energy), label (short, e.g. "Saudi crude exports from Yanbu"), value (the number as written, e.g. 1.2 for "1.2 million"), unit (e.g. "million barrels a day").
- notices: a Houthi-declared ban or warning to shipping, a naval mission's announcement, a UKMTO or JMIC advisory for these waters. Field: text (one plain sentence).
Every item has doc (the document index). Never estimate, never add up, never use whole-war figures since 2014/2015. Nothing usable: empty lists.
Return JSON {"ships":[],"sites":[],"figures":[],"notices":[]}.`;

/** Refresh the stored ledger from the window's cards (and PortWatch, when due). */
export async function refreshLedger(store: DeskStore, windowReports: LiveReport[], now = new Date()): Promise<Ledger> {
  try {
    await refreshTransits(store, now);
  } catch (err) {
    console.error("[ledger] transits failed:", err instanceof Error ? err.message : err);
  }
  const current = (await store.getJson<Ledger>(LEDGER_KEY)) ?? LEDGER_SEED;
  const docs = ledgerDocs(windowReports);
  if (!docs.length) return current;
  const user = JSON.stringify({ documents: docs.map((d, i) => ({ index: i, source: d.name, date: d.date, text: d.text })) });
  const got = await askChain("ledger", SYSTEM, user, { temperature: 0, models: COMBINE_MODELS });
  if (!got) return current;
  const next = applyLedger(current, got.json as LedgerUpdates, docs, now);
  await store.putJson(LEDGER_KEY, next);
  return next;
}

export async function readLedger(store: DeskStore): Promise<Ledger> {
  return (await store.getJson<Ledger>(LEDGER_KEY)) ?? LEDGER_SEED;
}

/* ------------------------------------------------------------------ *
 * Ship traffic: IMF PortWatch
 * ------------------------------------------------------------------ */

export type TransitDay = { date: string; total: number; tanker: number; container: number; bulk: number };
export type TransitPoint = { id: "bab" | "suez"; name: string; baseline: { total: number; tanker: number; from: string; to: string }; days: TransitDay[] };
export type Transits = { points: TransitPoint[]; source: LedgerSource; updatedAt: string };

const PORTWATCH =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query";
const POINTS: { id: TransitPoint["id"]; name: string; portname: string }[] = [
  { id: "bab", name: "Bab al-Mandab", portname: "Bab el-Mandeb Strait" },
  { id: "suez", name: "Suez Canal", portname: "Suez Canal" },
];
/** Before the round: the month to 2 July 2026. */
const BASE_FROM = "2026-06-02";
const BASE_TO = "2026-07-02";

type PwRow = { date?: string; n_total?: number; n_tanker?: number; n_container?: number; n_dry_bulk?: number };

async function portwatch(portname: string, where: string, count: number): Promise<TransitDay[]> {
  const q = new URLSearchParams({
    where: `portname='${portname}' AND ${where}`,
    outFields: "date,n_total,n_tanker,n_container,n_dry_bulk",
    orderByFields: "date DESC",
    resultRecordCount: String(count),
    f: "json",
  });
  const res = await fetch(`${PORTWATCH}?${q}`, { headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return [];
  }
  const j = (await res.json()) as { features?: { attributes?: PwRow }[] };
  return (j.features ?? [])
    .map((f) => f.attributes ?? {})
    .filter((a) => a.date && Number.isFinite(a.n_total))
    .map((a) => ({ date: String(a.date).slice(0, 10), total: a.n_total ?? 0, tanker: a.n_tanker ?? 0, container: a.n_container ?? 0, bulk: a.n_dry_bulk ?? 0 }));
}

/** PortWatch's daily counts: read again when the stored ones are half a day old. */
export async function refreshTransits(store: DeskStore, now = new Date()): Promise<Transits | null> {
  const prev = await store.getJson<Transits>(TRANSITS_KEY);
  if (prev && now.getTime() - Date.parse(prev.updatedAt) < 12 * 3600_000) return prev;
  const points: TransitPoint[] = [];
  for (const p of POINTS) {
    const days = await portwatch(p.portname, "date >= DATE '2026-06-02'", 200);
    if (!days.length) return prev;
    const base = days.filter((d) => d.date >= BASE_FROM && d.date <= BASE_TO);
    const avg = (k: "total" | "tanker") => (base.length ? Math.round((base.reduce((s, d) => s + d[k], 0) / base.length) * 10) / 10 : 0);
    points.push({ id: p.id, name: p.name, baseline: { total: avg("total"), tanker: avg("tanker"), from: BASE_FROM, to: BASE_TO }, days: days.filter((d) => d.date > BASE_TO).sort((a, b) => a.date.localeCompare(b.date)) });
  }
  const next: Transits = { points, source: { name: "IMF PortWatch", url: "https://portwatch.imf.org/pages/chokepoints", date: points[0]?.days.at(-1)?.date ?? "" }, updatedAt: now.toISOString() };
  await store.putJson(TRANSITS_KEY, next);
  return next;
}

export async function readTransits(store: DeskStore): Promise<Transits | null> {
  return store.getJson<Transits>(TRANSITS_KEY);
}
