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
import { outletSide } from "./digest.ts";
import { LEDGER_BASELINE } from "./ledger-baseline.ts";
import { OFF_YEMEN_SEA } from "./desk-route.ts";
import { notNewEvent } from "./pin-rule.ts";

export const LEDGER_KEY = "ledger";
export const TRANSITS_KEY = "ledger-transits";

/**
 * `claim`: only the side that says it did it reports it (no word from the
 * target, a wire or a monitor). `tier`: the source is an official body
 * (UKMTO, a ministry, a state agency, JODI) or a wire (Reuters, AP, AFP,
 * Bloomberg); left out, it is read from the name (`sourceTier`).
 */
/** `weapon`: what was used, as the source says ("ballistic missile", "drones", "explosive boat"). */
export type LedgerSource = { name: string; url: string; date: string; claim?: boolean; tier?: "official" | "wire"; note?: string; weapon?: string };
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
  /** What was used, as the source says: "ballistic missile", "drones", "explosive boat". */
  weapon?: string;
  /** Where the sources disagree, in a line. */
  note?: string;
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
/**
 * Exports, output and other energy or shipping figures, each as its source
 * gave it. `group` is the box it shows in; `period` what it covers
 * ("September", "since 20 July"), so one month's figure never overwrites
 * another's.
 */
export type FigureGroup = "traffic" | "oil" | "cost" | "security" | "attacks" | "exports" | "pipeline" | "prices";
export const FIGURE_GROUPS: FigureGroup[] = ["traffic", "oil", "cost", "security", "attacks", "exports", "pipeline", "prices"];
/**
 * `series` + `month` (YYYY-MM) put a monthly figure on its chart: Saudi crude
 * exports ("saudi-exports"), all oil through Bab al-Mandab ("bab-oil"), Saudi
 * oil through it ("saudi-bab-oil").
 */
export type LedgerFigure = { id: string; cat: "maritime" | "energy"; group?: FigureGroup; label: string; value: number; unit: string; period?: string; series?: string; month?: string; span?: string; src: LedgerSource };
/** A declared ban, a warning to shipping, a naval mission's move. */
export type LedgerNotice = { id: string; date: string; text: string; src: LedgerSource };
/**
 * `wrong`: rows found to be wrong (old damage shown as new, a later report of
 * an earlier strike, a reaction), kept out for good. A site's hit: that one
 * link when `url` is set, else every hit of that day. A ship: its row by id.
 * `fixes`: a hit checked by hand, which stands over whatever the reads stored
 * for that site and day (user, 3 Oct: the 30 Sep and 1 Oct links).
 */
export type LedgerWrong = { site?: string; ship?: string; date?: string; why: string; url?: string };
export type LedgerFix = { site: string; hit: LedgerSource; why: string };
export type Ledger = { since: string; ships: ShipIncident[]; sites: EnergySite[]; figures: LedgerFigure[]; notices: LedgerNotice[]; updatedAt: string; wrong?: LedgerWrong[]; fixes?: LedgerFix[] };

/** The war began with the strike on Sanaa airport, 13 July 2026. */
export const WAR_START = "2026-07-13";
export const LEDGER_SEED: Ledger = { since: WAR_START, ships: [], sites: [], figures: [], notices: [], updatedAt: "2026-07-13T00:00:00+03:00" };

const OFFICIAL_SRC = /\b(?:UKMTO|JMIC|MARAD|Maritime Administration|CENTCOM|Aspides|EUNAVFOR|Atalanta|SPA|Saudi Press Agency|Ministry of (?:Energy|Defen[cs]e|Foreign Affairs|Interior)|(?:Energy|Defen[cs]e|Foreign|Interior) Ministry|coalition|Civil Defen[cs]e|JODI|Kpler|Aramco|IMF|PortWatch|EIA|Energy Information Administration)\b/i;
const WIRE_SRC = /\b(?:Reuters|AP|Associated Press|AFP|Agence France-Presse|Bloomberg)\b/;
export type SourceTier = "official" | "wire" | "other" | "claim";
/** Official body, then a wire, then anyone else; a claim is the attacking side's word alone. */
export function sourceTier(s: LedgerSource | undefined): SourceTier {
  if (!s) return "other";
  if (s.claim) return "claim";
  if (s.tier) return s.tier;
  if (OFFICIAL_SRC.test(s.name)) return "official";
  if (WIRE_SRC.test(s.name)) return "wire";
  return "other";
}
const RANK: Record<SourceTier, number> = { claim: 0, other: 1, wire: 2, official: 3 };
/** A report of the same event from a better source replaces the one we have. */
export const betterSource = (a: LedgerSource, b: LedgerSource | undefined) => !b || RANK[sourceTier(a)] > RANK[sourceTier(b)];

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** The chart a model figure belongs on, and its month, from its label and period. */
export function seriesOf(label: string, unit: string, period: string, year = 2026): { series: string; month: string } | null {
  if (!/barrels? a day|bpd|b\/d/i.test(`${unit} ${label}`)) return null;
  const m = MONTHS.findIndex((n) => new RegExp(`^${n}\\b`, "i").test(String(period).trim()));
  if (m < 0) return null;
  const month = `${year}-${String(m + 1).padStart(2, "0")}`;
  const l = String(label);
  if (/^Saudi (?:crude )?(?:oil )?exports?$/i.test(l.trim())) return { series: "saudi-exports", month };
  if (/Bab (?:al|el)[- ]Mand[ae]b/i.test(l)) return { series: /Saudi/i.test(l) ? "saudi-bab-oil" : "bab-oil", month };
  return null;
}

/* ------------------------------------------------------------------ *
 * The sites, by their names in the reports
 * ------------------------------------------------------------------ */

type KnownSite = { id: string; name: string; kind: string; country: EnergySite["country"]; re: RegExp };
/** Saudi and Yemeni energy sites, so one site is one row whatever a report calls it. */
export const KNOWN_SITES: KnownSite[] = [
  { id: "east-west-pipeline", name: "East-West pipeline (Petroline)", kind: "pipeline", country: "Saudi Arabia", re: /East[- ]West (?:oil )?pipeline|Petroline|pump(?:ing)? station|Saudi (?:oil|crude) (?:transport |export )?pipeline|خط (?:أنابيب )?(?:النفط )?(?:السعودي )?شرق.?غرب|خط تصدير النفط السعودي|[أا]نبوب نقل النفط السعودي|محطة (?:ضخ|الضخ)/i },
  { id: "rabigh", name: "Rabigh refinery", kind: "refinery", country: "Saudi Arabia", re: /Rabigh|Rabegh|رابغ/i },
  { id: "yanbu", name: "Yanbu terminals and refineries", kind: "terminal", country: "Saudi Arabia", re: /Yanbu|SAMREF|YASREF|Muajjiz|ينبع|المعجز/i },
  { id: "jazan", name: "Jazan refinery and terminal", kind: "refinery", country: "Saudi Arabia", re: /Jazan|Jizan|جازان|جيزان/i },
  { id: "jeddah", name: "Jeddah bulk plant", kind: "terminal", country: "Saudi Arabia", re: /Jeddah|Jiddah|جدة/i },
  { id: "ras-tanura", name: "Ras Tanura", kind: "terminal", country: "Saudi Arabia", re: /Ras Tanura|رأس تنورة/i },
  { id: "abqaiq", name: "Abqaiq", kind: "processing plant", country: "Saudi Arabia", re: /Abqaiq|بقيق/i },
  // The depot by King Khalid airport only when a report says depot or tanks and no refinery.
  { id: "riyadh-depot", name: "Riyadh fuel depot (King Khalid airport)", kind: "fuel depot", country: "Saudi Arabia", re: /^(?![\s\S]*(?:refiner|مصف))[\s\S]*(?:(?:fuel|oil|Aramco) (?:depot|tanks?|storage)[^.]{0,40}Riyadh|Riyadh[^.]{0,40}(?:fuel|oil|Aramco) (?:depot|tanks?|storage)|خزان[^.]{0,30}الرياض)/i },
  // Any other Aramco site in Riyadh is the refinery (user, 3 Oct: nine names, one attack).
  { id: "riyadh-refinery", name: "Aramco refinery, Riyadh", kind: "refinery", country: "Saudi Arabia", re: /Riyadh refinery|مصفاة الرياض|(?:Aramco|refiner(?:y|ies)|oil (?:site|facilit(?:y|ies)))[^.]{0,40}(?:Riyadh|Saudi capital)|(?:Riyadh|Saudi capital)[^.]{0,40}(?:Aramco|refiner)|أرامكو[^.]{0,30}(?:الرياض|العاصمة السعودية)|مصفا[ةى][^.]{0,20}بالرياض/i },
  { id: "khurais", name: "Khurais oilfield", kind: "oilfield", country: "Saudi Arabia", re: /Khurais|خريص/i },
  { id: "najran-aramco", name: "Aramco plant, Najran", kind: "bulk plant", country: "Saudi Arabia", re: /Aramco[^.]{0,40}Najran|Najran[^.]{0,40}Aramco|أرامكو[^.]{0,30}نجران|نجران[^.]{0,30}أرامكو/i },
  { id: "abha-aramco", name: "Aramco bulk plant, Abha", kind: "bulk plant", country: "Saudi Arabia", re: /Aramco[^.]{0,40}Abha|Abha[^.]{0,40}Aramco|أرامكو[^.]{0,30}أبها|أبها[^.]{0,30}أرامكو/i },
  { id: "jubail-gas", name: "Gas facilities, Jubail", kind: "gas plant", country: "Saudi Arabia", re: /Jubail|الجبيل/i },
  { id: "taibah-medina", name: "Taibah electricity station, Medina", kind: "power station", country: "Saudi Arabia", re: /Taibah|Taiba (?:power|electricity)|(?:Medina|Madinah)[^.]{0,30}(?:power|electricity) (?:station|plant)|(?:power|electricity) (?:station|plant)[^.]{0,20}(?:Medina|Madinah)|محطة (?:كهرباء )?طيبة|محطة كهرباء[^.]{0,20}المدينة/i },
  { id: "safer", name: "Safer (Marib)", kind: "oilfield", country: "Yemen", re: /Safer|صافر/i },
  { id: "ras-isa", name: "Ras Isa", kind: "terminal", country: "Yemen", re: /Ras Isa|رأس عيسى/i },
  { id: "aden-refinery", name: "Aden refinery", kind: "refinery", country: "Yemen", re: /Aden refinery|مصافي عدن|مصفاة عدن/i },
  { id: "balhaf", name: "Balhaf LNG", kind: "gas plant", country: "Yemen", re: /Balhaf|بلحاف/i },
  { id: "hodeidah-port", name: "Hodeidah port", kind: "port", country: "Yemen", re: /Hodeidah port|port of Hodeidah|ميناء الحديدة/i },
  { id: "dhabba", name: "Al-Dhabba terminal (Hadramawt)", kind: "terminal", country: "Yemen", re: /Dhabba|الضبة/i },
];

/**
 * Not an energy site: an airport, air base or camp (unless its fuel depot), or
 * a name with no place ("Aramco facilities", "power stations"). User, 3 Oct.
 */
export function notEnergySite(name: string): boolean {
  const n = String(name || "");
  if (/airport|air ?base|airbase|\bcamp\b|مطار|قاعدة|معسكر/i.test(n) && !/fuel|oil|depot|tanks?|storage|وقود|خزان/i.test(n)) return true;
  return !n.replace(/\b(?:the|saudi|arabia|aramco|company|companies|oil|gas|energy|power|electricity|facilit(?:y|ies)|sites?|stations?|plants?|refiner(?:y|ies)|in|of|and|at|its)\b|شركة|أرامكو|منشآت|منشأة|السعودية|[^\p{L}]/giu, "").trim();
}

export function siteOf(name: string, kind?: string, country?: string): { id: string; name: string; kind: string; country: EnergySite["country"] } | null {
  const hit = KNOWN_SITES.find((s) => s.re.test(name));
  if (hit) return { id: hit.id, name: hit.name, kind: hit.kind, country: hit.country };
  if (notEnergySite(name)) return null;
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

type Doc = { name: string; url: string; date: string; text: string; headline?: string };
/** `retold`: the document is about a strike reported before (a day-later claim, its aftermath, a reaction). */
type ShipUpdate = { doc: number; date?: string; ship?: string; flag?: string; type?: string; place?: string; what?: string; attacker?: string; crew?: string; weapon?: string; claimed?: boolean; retold?: boolean };
type SiteUpdate = { doc: number; site?: string; kind?: string; country?: string; date?: string; hit?: boolean; retold?: boolean; status?: string; weapon?: string; claimed?: boolean };
type FigureUpdate = { doc: number; cat?: string; group?: string; label?: string; value?: number; unit?: string; period?: string };
type NoticeUpdate = { doc: number; text?: string };
export type LedgerUpdates = { ships?: ShipUpdate[]; sites?: SiteUpdate[]; figures?: FigureUpdate[]; notices?: NoticeUpdate[] };

/** Two places off the same town: "40 nm west of Hodeidah" and "off Hodeidah". */
const sameTown = (a: string, b: string) => {
  const towns = (p: string) => new Set((String(p).match(/\b[A-Z][\w'-]{2,}/g) ?? []).map((w) => w.toLowerCase()));
  const x = towns(a);
  return [...towns(b)].some((w) => x.has(w));
};
const dayMs = (d: string) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);
/** The strike's own day as the model gives it: up to 7 days before the report, else the report's day. */
const strikeDay = (given: unknown, reported: string) => {
  const g = String(given ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) return reported;
  const back = dayMs(reported) - dayMs(g);
  return back >= 0 && back <= 7 * 86_400_000 ? g : reported;
};
/** A report of a strike already told: fires still burning, new footage, satellite heat, the aftermath, a reaction. */
export const RETOLD_RE = /\b(?:continu\w*|still (?:burn|ris|ablaze)\w*|new (?:footage|scenes|images|pictures|video)|more (?:footage|scenes)|aftermath|satellite|thermal|heat signature|condemn\w*|this weekend|days? after|yesterday'?s)\b|مشاهد جديدة|المزيد من مشاهد|صور (?:الأقمار|جديدة)|الأقمار الصناعية|استمرار|متواصل|لا تزال|تتواصل|يدين|تدين|أول من أمس/i;

/** The Houthis' own outlets and the channels of their camp (Fars, IRNA, Shajab, Ali Bk...). */
export const houthiOutlet = (name: string) => outletSide(String(name || "")) === "Houthi-aligned";

/** The box a figure goes in, when the model did not say. */
export function groupOf(cat: LedgerFigure["cat"], text: string): FigureGroup {
  const t = String(text);
  if (cat === "energy") {
    if (/pipeline|pump/i.test(t)) return "pipeline";
    if (/Brent|price|\$ ?a barrel|per barrel/i.test(t)) return "prices";
    return "exports";
  }
  if (/barrels?|bpd|crude|oil/i.test(t)) return "oil";
  if (/insurance|premium|freight|rates?|revenue|cost|\$|dollars?/i.test(t)) return "cost";
  if (/escort|warships?|Aspides|mission|protection/i.test(t)) return "security";
  if (/tankers? (?:targeted|attacked|hit)|attacks? on ships|diverted/i.test(t)) return "attacks";
  return "traffic";
}

/**
 * The research baseline (ledger-baseline.ts: what happened from 13 July to the
 * ledger's first run, each with its source) under what the 6-hour reads added.
 * A stored row wins over the baseline's row of the same event, unless the
 * baseline's source is better (official, then a wire).
 */
export function withBaseline(l: Ledger, base: Ledger = LEDGER_BASELINE): Ledger {
  const out: Ledger = structuredClone(l);
  // A strike their own camp alone reports stays their claim, rows stored before this rule too.
  for (const x of out.ships) if (houthiOutlet(x.src.name)) x.src.claim = true;
  for (const x of out.sites) for (const h of x.hits) if (houthiOutlet(h.name)) h.claim = true;
  // A site stored under another name before its known names were added ("Taibah power
  // plant") joins its known row.
  for (const x of [...out.sites]) {
    const k = KNOWN_SITES.find((s) => s.re.test(x.name));
    if (!k || k.id === x.id) continue;
    const row = out.sites.find((s) => s.id === k.id);
    if (!row) {
      Object.assign(x, { id: k.id, name: k.name });
      continue;
    }
    for (const h of x.hits) if (!row.hits.some((y) => y.date === h.date)) row.hits.push(h);
    out.sites.splice(out.sites.indexOf(x), 1);
  }
  // Airports, camps and placeless names are no energy sites (user, 3 Oct: "Abha airport", "power stations").
  const kept = new Set([...KNOWN_SITES.map((k) => k.id), ...base.sites.map((s) => s.id)]);
  out.sites = out.sites.filter((s) => kept.has(s.id) || !notEnergySite(s.name));
  for (const s of base.ships) {
    const row = out.ships.find((x) => x.id === s.id || (x.ship && s.ship && nameInText(x.ship, s.ship) && Math.abs(dayMs(x.date) - dayMs(s.date)) <= 86_400_000));
    if (!row) out.ships.push(structuredClone(s));
    else if (betterSource(s.src, row.src)) Object.assign(row, structuredClone(s), { id: row.id, weapon: s.weapon ?? row.weapon });
    else row.weapon ??= s.weapon;
    // The same row by id: the hand-checked words stand (user, 3 Oct: "two dhow boats").
    if (row && row.id === s.id) Object.assign(row, { ...(s.type ? { type: s.type } : {}), ...(s.note ? { note: s.note } : {}) });
  }
  for (const s of base.sites) {
    const row = out.sites.find((x) => x.id === s.id);
    if (!row) {
      out.sites.push(structuredClone(s));
      continue;
    }
    row.name = s.name;
    for (const h of s.hits) {
      const i = row.hits.findIndex((x) => x.date === h.date);
      if (i < 0) row.hits.push({ ...h });
      else if (betterSource(h, row.hits[i])) row.hits[i] = { ...h, weapon: h.weapon ?? row.hits[i].weapon };
      else row.hits[i].weapon ??= h.weapon;
    }
    row.hits.sort((a, b) => a.date.localeCompare(b.date));
    if (s.statusSrc && (!row.statusSrc || dayMs(s.statusSrc.date) > dayMs(row.statusSrc.date))) {
      row.status = s.status;
      row.statusSrc = { ...s.statusSrc };
    }
  }
  // Rows found to be wrong stay out, whoever adds them again, the baseline's own too.
  for (const w of base.wrong ?? []) {
    if (w.ship) out.ships = out.ships.filter((x) => x.id !== w.ship);
    const row = w.site ? out.sites.find((s) => s.id === w.site) : undefined;
    if (row) row.hits = row.hits.filter((h) => (w.url ? h.url !== w.url : h.date !== w.date));
  }
  // A hit checked by hand stands over what was stored for that site and day.
  for (const f of base.fixes ?? []) {
    let row = out.sites.find((s) => s.id === f.site);
    const k = KNOWN_SITES.find((x) => x.id === f.site);
    if (!row && k) out.sites.push((row = { id: k.id, name: k.name, kind: k.kind, country: k.country, hits: [], status: "unknown" }));
    if (!row) continue;
    row.hits = [...row.hits.filter((h) => h.date !== f.hit.date), { ...f.hit }].sort((a, b) => a.date.localeCompare(b.date));
  }
  out.sites = out.sites.filter((s) => s.hits.length || s.statusSrc);
  // Whether a report is a new hit or an earlier one told again is read from the
  // report itself (the model's `retold`, RETOLD_RE), never from the time between
  // them: one site can be hit twice in a day, or once in two months (user, 7 Oct).
  // One figure a month on each chart: the better source, then the newer.
  for (const f of base.figures) {
    const i = out.figures.findIndex((x) => x.id === f.id || (f.series && x.series === f.series && x.month === f.month));
    if (i < 0) out.figures.push({ ...f });
    else if (betterSource(f.src, out.figures[i].src)) out.figures[i] = { ...f };
  }
  for (const n of base.notices) if (!out.notices.some((x) => x.id === n.id)) out.notices.push({ ...n });
  out.ships.sort((a, b) => b.date.localeCompare(a.date));
  out.notices.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}

/** Apply the model's proposals. Pure, so the rules are testable. */
export function applyLedger(current: Ledger, u: LedgerUpdates, docs: Doc[], now: Date): Ledger {
  const next: Ledger = structuredClone(current);
  const srcOf = (d: Doc): LedgerSource => ({ name: d.name, url: d.url, date: d.date });
  // A strike on a ship or a site that only the Houthis' own outlets report,
  // or that the text gives only as one side's word, is a claim until the
  // target, a wire or a monitor says so.
  const hitSrc = (d: Doc, claimed?: boolean): LedgerSource => (claimed || houthiOutlet(d.name) ? { ...srcOf(d), claim: true } : srcOf(d));
  for (const s of u.ships ?? []) {
    const d = docs[s?.doc];
    if (!d || !WHATS.includes(s.what as ShipWhat) || !s.place) continue;
    if (s.ship && !nameInText(d.text, s.ship)) continue;
    // The Gulf, Hormuz and the Gulf of Oman are the Iran war's, not Yemen's,
    // unless the Houthis did it (8 Oct: the tanker Acers off Qatar counted here).
    if (OFF_YEMEN_SEA.test(s.place) && !/houthi|ansar ?allah|الحوثي|أنصار الله/i.test(s.attacker ?? "")) continue;
    const date = strikeDay(s.date, d.date);
    // One incident, one row: the same ship within a day; a ship with no name
    // is the one off the same town that day. A later report of an attack
    // already told adds nothing new (5 Oct: the 4 Oct tanker off Mocha told again as "Red Sea").
    const retold = s.retold === true;
    const same = next.ships.find((x) =>
      Math.abs(dayMs(x.date) - dayMs(date)) <= (retold ? 3 : 1) * 86_400_000 &&
      (retold || (s.ship && x.ship ? nameInText(x.ship, s.ship) || nameInText(s.ship, x.ship) : sameTown(x.place, s.place as string))),
    );
    if (retold && !same) continue;
    if (same) {
      same.ship ??= s.ship || undefined;
      // A later report can say more: hit beats attacked, sunk beats hit.
      if (WHATS.indexOf(s.what as ShipWhat) > WHATS.indexOf(same.what) && s.what !== "near miss" && s.what !== "suspicious approach") same.what = s.what as ShipWhat;
      same.flag ??= s.flag || undefined;
      same.type ??= s.type || undefined;
      same.attacker ??= s.attacker || undefined;
      same.crew ??= s.crew || undefined;
      same.weapon ??= s.weapon ? String(s.weapon).slice(0, 80) : undefined;
      const src = hitSrc(d, s.claimed);
      if (betterSource(src, same.src)) same.src = src;
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
      ...(s.weapon ? { weapon: String(s.weapon).slice(0, 80) } : {}),
      src: hitSrc(d, s.claimed),
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
    // A picture of old damage is not a new hit (pin-rule.ts), whatever the model says.
    // Nor is a later report of a strike told before: a day-later claim, fires
    // still burning, a reaction (user, 3 Oct). One side's word of that kind
    // within 7 days of a hit on the site is that hit. A hit is dated by the strike.
    const when = strikeDay(s.date, d.date);
    const headline = d.headline ?? d.text.split(". ")[0];
    const src = { ...hitSrc(d, s.claimed), date: when, ...(s.weapon ? { weapon: String(s.weapon).slice(0, 80) } : {}) };
    const told = !!src.claim && RETOLD_RE.test(headline) && row.hits.some((h) => h.date <= when && dayMs(when) - dayMs(h.date) <= 7 * 86_400_000);
    if (s.hit && !s.retold && !told && !notNewEvent(headline)) {
      const i = row.hits.findIndex((h) => h.date === when);
      if (i < 0) row.hits.push(src);
      else if (betterSource(src, row.hits[i])) row.hits[i] = src;
    }
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
    const period = String(f.period || "").trim().slice(0, 40);
    const id = slug(`${cat}-${f.label}-${period}`);
    const ser = seriesOf(String(f.label), String(f.unit || ""), period);
    // A month on a chart has one figure: a better source replaces it, an equal one only when newer.
    const prev = next.figures.find((x) => x.id === id || (ser && x.series === ser.series && x.month === ser.month));
    const sameRankNewer = prev && RANK[sourceTier(srcOf(d))] === RANK[sourceTier(prev.src)] && dayMs(d.date) >= dayMs(prev.src.date);
    if (prev && !betterSource(srcOf(d), prev.src) && !sameRankNewer) continue;
    const group = FIGURE_GROUPS.includes(f.group as FigureGroup) ? (f.group as FigureGroup) : groupOf(cat, `${f.label} ${f.unit}`);
    const row: LedgerFigure = { id: prev?.id ?? id, cat, group, label: String(f.label).slice(0, 80), value: f.value, unit: String(f.unit || "").slice(0, 40), ...(period ? { period } : {}), ...(ser ?? {}), src: srcOf(d) };
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
  next.notices = next.notices.slice(0, 60);
  next.figures = next.figures.slice(-120);
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
      headline: String(r.summary || ""),
      text: `${r.summary || ""}. ${r.text || ""}`.slice(0, 1400),
    }));
}

const SYSTEM = `You keep the Maritime and Energy ledger of the current round of the Yemen war (Houthis vs the Yemeni government and the Saudi-led coalition, since the strike on Sanaa airport on 13 July 2026).
You get NEW documents (news cards). Return only what a document itself states:
- ships: each attack on, hit on, seizure or sinking of a ship, a near miss, or a suspicious approach, in the Red Sea, Bab al-Mandab, the Gulf of Aden, the Arabian Sea off Yemen, or Saudi or Yemeni waters. Fields: date (YYYY-MM-DD, of the incident), ship (its name, only if the text names it), flag, type (tanker, bulk carrier, container ship...), place (as the text puts it, e.g. "40 nm west of Hodeidah"), what (one of: attacked, hit, seized, sunk, near miss, suspicious approach), attacker (only if the text says who), crew (hurt or missing, as the text says), weapon (what was used, as the text says, with its type when named: "ballistic missile", "two Palestine-2 ballistic missiles", "drones", "explosive boat", "cruise missiles and drones"; empty if the text does not say), claimed (true when the text gives the attack only as one side's word, e.g. "the Houthis said they targeted", with no word from the ship, its owner, UKMTO, a navy, the target country or witnesses), retold (true when the document is about an attack that happened before this document's news: a later report, a claim a day after, a round-up). Hormuz and the Gulf are out unless the text says the Houthis did it. Piracy by Somali or unknown gunmen is out.
- sites: each Saudi or Yemeni energy site the text says was hit, or whose state it gives (pipelines and pump stations, refineries, terminals, oilfields, gas and power plants, desalination plants). Airports, air bases and camps are not energy sites. A site needs its place: "Aramco facilities" or "power stations" with no town are not a site. Fields: site (its name as the text writes it, with its town), kind, country (Saudi Arabia or Yemen), date (YYYY-MM-DD of the strike itself, not of the report), hit (true when the text reports it hit in this document's news), retold (true when the document is about a strike reported before: the attacking side's claim of it a day later, fires still burning, new footage or satellite pictures of it, its damage, a condemnation or another reaction, a round-up of several days; then hit is false and only status may change), status (working, reduced or down, only when the text says so; "resumed", "back in service" = working; "halted", "shut" = down; "partly", "reduced" = reduced), weapon (as for ships), claimed (true when the hit is only one side's word, as for ships; a hit the target country's ministry, Aramco, civil defence or witnesses report is not a claim). Satellite pictures of damage from an earlier attack, or smoke seen with no attack reported, are not a new hit.
- figures: a number the text gives about shipping or energy in this war. Fields: cat (maritime or energy), group, label (short, e.g. "Saudi crude exports from Yanbu"), value (the number as written, e.g. 1.2 for "1.2 million"), unit (e.g. "million barrels a day"), period (what it covers, as the text says: "September", "22-26 Sep", "since 20 July", "Tuesday 22 Sep"; empty if it does not say). Groups:
  maritime: traffic (ships crossing Bab al-Mandab, Suez or around the Cape, escorts asked for), oil (barrels of oil through Bab al-Mandab, the Red Sea or Suez), cost (war-risk insurance, freight rates, Suez Canal revenue), security (warships, naval missions, escorts), attacks (a side's own count of ships it attacked or turned back);
  energy: exports (Saudi or Yemeni crude or fuel exports, from Yanbu, via Hormuz, in total; oil output), pipeline (East-West pipeline or other pipeline throughput and capacity), prices (Brent or other oil and gas prices).
- notices: a Houthi-declared ban or warning to shipping, a naval mission's announcement, a UKMTO or JMIC advisory for these waters. Field: text (one plain sentence).
Every item has doc (the document index). Never estimate, never add up, never use whole-war figures since 2014/2015. Nothing usable: empty lists.
Saudi crude exports in total for a month: label "Saudi crude exports", period the month's name ("September"). Oil through Bab al-Mandab for a month: label "Oil through Bab al-Mandab" (all exporters) or "Saudi oil through Bab al-Mandab".
A side's own figure (the Houthi transport ministry's ship count, the Houthis' count of tankers hit) is kept like any other; the source shows whose it is.
Return JSON {"ships":[],"sites":[],"figures":[],"notices":[]}.`;

/** Refresh the stored ledger from the window's cards (and PortWatch, when due). */
export async function refreshLedger(store: DeskStore, windowReports: LiveReport[], now = new Date()): Promise<Ledger> {
  try {
    await refreshTransits(store, now);
  } catch (err) {
    console.error("[ledger] transits failed:", err instanceof Error ? err.message : err);
  }
  const current = withBaseline((await store.getJson<Ledger>(LEDGER_KEY)) ?? LEDGER_SEED);
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
  const l = withBaseline((await store.getJson<Ledger>(LEDGER_KEY)) ?? LEDGER_SEED);
  // Before the first 6-hour read, the baseline's own date stands.
  if (l.updatedAt === LEDGER_SEED.updatedAt) l.updatedAt = LEDGER_BASELINE.updatedAt;
  return l;
}

/* ------------------------------------------------------------------ *
 * Ship traffic: IMF PortWatch
 * ------------------------------------------------------------------ */

export type TransitDay = { date: string; total: number; tanker: number; container: number; bulk: number };
export type TransitPoint = { id: "bab" | "suez" | "cape"; name: string; baseline: { total: number; tanker: number; from: string; to: string }; days: TransitDay[] };
/** Brent's daily spot price (US EIA, through FRED), about a week behind. */
export type PriceSeries = { name: string; unit: string; baseline: { value: number; from: string; to: string }; days: { date: string; value: number }[]; source: LedgerSource };
/** `v` 2: days from a month before the war (13 June), Bab al-Mandab and Suez only. */
export type Transits = { v?: number; points: TransitPoint[]; source: LedgerSource; updatedAt: string; brent?: PriceSeries };

const PORTWATCH =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query";
const POINTS: { id: TransitPoint["id"]; name: string; portname: string }[] = [
  { id: "bab", name: "Bab al-Mandab", portname: "Bab el-Mandeb Strait" },
  { id: "suez", name: "Suez Canal", portname: "Suez Canal" },
];
/** Before the war: the 30 days to 12 July 2026, the eve of the strike on Sanaa airport. */
const BASE_FROM = "2026-06-13";
const BASE_TO = "2026-07-12";

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

const FRED_BRENT = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU&cosd=2026-06-13";

/** FRED's CSV: "date,value" lines, "." on days with no price. */
export function parseFredCsv(csv: string): { date: string; value: number }[] {
  return String(csv || "")
    .split(/\r?\n/)
    .map((l) => l.split(","))
    .filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && Number.isFinite(Number(v)) && String(v).trim() !== "")
    .map(([d, v]) => ({ date: d, value: Number(v) }));
}

async function brent(): Promise<PriceSeries | null> {
  const res = await fetch(FRED_BRENT, { headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  const rows = parseFredCsv(await res.text());
  const base = rows.filter((d) => d.date >= BASE_FROM && d.date <= BASE_TO);
  if (!rows.length || !base.length) return null;
  return {
    name: "Brent crude",
    unit: "dollars a barrel",
    baseline: { value: Math.round((base.reduce((n, d) => n + d.value, 0) / base.length) * 100) / 100, from: BASE_FROM, to: BASE_TO },
    days: rows.filter((d) => d.date >= BASE_FROM),
    source: { name: "US EIA via FRED", url: "https://fred.stlouisfed.org/series/DCOILBRENTEU", date: rows.at(-1)?.date ?? "" },
  };
}

/** PortWatch's daily counts: read again at each 6-hour update (PortWatch itself adds days a few at a time). */
export async function refreshTransits(store: DeskStore, now = new Date()): Promise<Transits | null> {
  const prev = await store.getJson<Transits>(TRANSITS_KEY);
  if (prev && prev.v === 2 && prev.brent && now.getTime() - Date.parse(prev.updatedAt) < 5.5 * 3600_000) return prev;
  const points: TransitPoint[] = [];
  for (const p of POINTS) {
    const days = await portwatch(p.portname, `date >= DATE '${BASE_FROM}'`, 200);
    if (!days.length) return prev;
    const base = days.filter((d) => d.date >= BASE_FROM && d.date <= BASE_TO);
    const avg = (k: "total" | "tanker") => (base.length ? Math.round((base.reduce((s, d) => s + d[k], 0) / base.length) * 10) / 10 : 0);
    points.push({ id: p.id, name: p.name, baseline: { total: avg("total"), tanker: avg("tanker"), from: BASE_FROM, to: BASE_TO }, days: days.sort((a, b) => a.date.localeCompare(b.date)) });
  }
  let price: PriceSeries | null = null;
  try {
    price = await brent();
  } catch (err) {
    console.error("[ledger] Brent failed:", err instanceof Error ? err.message : err);
  }
  const next: Transits = {
    v: 2,
    points,
    source: { name: "IMF PortWatch", url: "https://portwatch.imf.org/pages/chokepoint4", date: points[0]?.days.at(-1)?.date ?? "" },
    updatedAt: now.toISOString(),
    ...(price ?? prev?.brent ? { brent: (price ?? prev?.brent) as PriceSeries } : {}),
  };
  await store.putJson(TRANSITS_KEY, next);
  return next;
}

export async function readTransits(store: DeskStore): Promise<Transits | null> {
  return store.getJson<Transits>(TRANSITS_KEY);
}
