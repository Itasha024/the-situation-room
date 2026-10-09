/**
 * The Iran desk's map from 28 Feb 2026 (Round 30 stage 8): every attack the
 * war's day-by-day record names at a place, each pinned on its own cited
 * outlet's report.
 *
 * The record: Wikipedia's timelines of the 2026 Iran war, the 2026 Lebanon war
 * and the Iraqi insurgency, read line by line with each line's own citations.
 * Wikipedia is the list; the pin's source is the outlet it cites. Which lines
 * tell one attack at a named place, who acted and where it landed was read by
 * hand (no model quota); code keeps a pin only when
 * - the place is written in the line itself (grounded),
 * - OpenStreetMap finds it as a town, site, base, port or island in the named
 *   country, never a province or a country (or it is on the desk's own list),
 * - it is inside the map's scope (iranPinAllowed: who acted, where it landed,
 *   no round-up, no fly-over, no tally, no unrest inside Iran),
 * - and the line cites an outlet.
 * One pin per actor, place and day.
 *
 *   node iran-backfill.mjs --dump segments.tsv
 *   node iran-backfill.mjs --events events.jsonl [--from …] [--to …] [--out file.json]
 */
import fs from "node:fs";
import { iranPinAllowed, iranPlacesIn, tallyNotEvent } from "../src/lib/desk/iran-places.ts";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const FROM = arg("--from", "2026-02-28");
const TO = arg("--to", "2026-12-31");
const OUT = arg("--out", "iran-backfill.json");
const CACHE = arg("--cache", "iran-backfill-cache.json");
const UA = "TheSituationRoomDesk/1.0 (research backfill; itamarshaashua@gmail.com)";

// The day-by-day timelines (a heading per day), the lists (a table row per
// attack) and the pages on each front (prose, each attack with its date).
const PAGES: [string, "timeline" | "table" | "prose"][] = [
  ["Timeline_of_the_2026_Iran_war", "timeline"],
  ["Timeline_of_the_2026_Lebanon_war", "timeline"],
  ["List_of_attacks_during_the_2026_Iran_war", "table"],
  ["List_of_ships_attacked_during_the_2026_Iran_war", "table"],
  ["2026_Iranian_strikes_on_Israel", "prose"],
  ["2026_Iranian_strikes_on_Qatar", "prose"],
  ["2026_Iranian_strikes_on_Jordan", "prose"],
  ["2026_Iranian_strikes_on_Oman", "prose"],
  ["2026_Iranian_strikes_on_the_Kurdistan_Region", "prose"],
  ["2026_Iranian_strikes_on_Arab_countries", "prose"],
  ["2026_Iranian_strike_on_Azerbaijan", "prose"],
  ["United_Arab_Emirates_in_the_2026_Iran_war", "prose"],
  ["Kuwait_in_the_2026_Iran_war", "prose"],
  ["Bahrain_in_the_2026_Iran_war", "prose"],
  ["Saudi_Arabia_in_the_2026_Iran_war", "prose"],
  ["Iraq_in_the_2026_Iran_war", "prose"],
  ["2026_United_States-led_conflict_with_pro-Iranian_Iraqi_militias", "prose"],
  ["2026_strikes_on_Akrotiri_and_Dhekelia", "prose"],
  ["2026_Strait_of_Hormuz_campaign", "prose"],
  ["2026_United_States_naval_blockade_of_Iran", "prose"],
  ["September_2026_United_States_strikes_on_Iran", "prose"],
  ["2026_Larak_Island_attack", "prose"],
  ["2026_Lavan_Island_attack", "prose"],
];
// Sections of a front's page that tell no attack.
const NOT_ATTACKS = /background|prelude|reaction|response by|impact|see also|reference|notes|analysis|aftermath|international|domestic|econom|legal|casualties|number of|arrest|airspace|evacuation|diplomac|relations|disruption|market|aviation|travel|media|propaganda|misinformation|cyber|protest/i;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Ref = { url: string; title: string; site: string; date: string };
type Seg = { id: string; text: string; refs: Ref[] };
type Para = { page: string; day: string; theatre: string; segs: Seg[] };

const cache: { geo: Record<string, unknown>; ai: Record<string, unknown> } = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : { geo: {}, ai: {} };
const save = () => fs.writeFileSync(CACHE, JSON.stringify(cache));

/* ---------- Wikitext ---------- */
async function wikitext(page: string): Promise<string> {
  const res = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&redirects=1&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2`, { headers: { "user-agent": UA } });
  const j = (await res.json()) as { parse?: { wikitext?: string } };
  return j.parse?.wikitext ?? "";
}
function field(t: string, names: string[]): string {
  for (const n of names) {
    const m = new RegExp(`\\|\\s*${n}\\s*=\\s*([^|}]*)`, "i").exec(t);
    if (m && m[1].trim()) return m[1].trim();
  }
  return "";
}
function parseRef(body: string): Ref | null {
  const url = field(body, ["url"]).replace(/\s+/g, "");
  if (!/^https?:\/\//.test(url) || /wikipedia\.org|archive\.org|archive\.ph|archive\.today/.test(url)) return null;
  // "[[Liveuamap|…]]" is cut at its bar by field(): the name without the link's brackets.
  const site = clean(field(body, ["website", "work", "newspaper", "publisher", "agency", "magazine"]).replace(/^\[\[/, "")) || new URL(url).hostname.replace(/^www\./, "");
  return { url, title: clean(field(body, ["title", "trans-title", "script-title"])).replace(/^[a-z]{2}:/, ""), site, date: field(body, ["date"]) };
}
function clean(s: string): string {
  let t = String(s || "");
  t = t.replace(/<!--[\s\S]*?-->/g, "");
  for (let i = 0; i < 3; i++) t = t.replace(/\[\[(?:File|Image):(?:[^[\]]|\[\[[^\]]*\]\])*\]\]/gi, "");
  t = t.replace(/\{\{\s*(?:lang|transliteration|transl|nowrap|nobr)\s*\|(?:[^|{}]*\|)*([^|{}]*)\}\}/gi, "$1");
  t = t.replace(/\{\{\s*convert\s*\|\s*([\d.,]+)\s*\|\s*([^|{}]+)[^{}]*\}\}/gi, "$1 $2");
  for (let i = 0; i < 6; i++) t = t.replace(/\{\{[^{}]*\}\}/g, "");
  t = t.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1");
  t = t.replace(/'''?/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t;
}
function namedRefs(wt: string): Map<string, Ref> {
  const named = new Map<string, Ref>();
  for (const m of wt.matchAll(/<ref\s+name\s*=\s*"?([^">/]+?)"?\s*>([\s\S]*?)<\/ref>/gi)) {
    const r = parseRef(m[2]);
    if (r) named.set(m[1].trim(), r);
  }
  return named;
}
/** A line's text cut at its citations: each piece of text with the refs that follow it. */
function segmentsOf(line: string, named: Map<string, Ref>, id: string): Seg[] {
  const segs: Seg[] = [];
  let text = "";
  let refs: Ref[] = [];
  const flush = () => {
    const t = clean(text);
    if (t.length > 12 && refs.length) segs.push({ id: `${id}s${segs.length}`, text: t, refs });
    else if (t.length > 12 && segs.length) segs[segs.length - 1].text += " " + t;
    text = "";
    refs = [];
  };
  const re = /<ref\s+name\s*=\s*"?([^">/]+?)"?\s*\/>|<ref(?:\s+name\s*=\s*"?([^">/]+?)"?)?\s*>([\s\S]*?)<\/ref>/gi;
  let last = 0;
  for (const m of line.matchAll(re)) {
    const before = line.slice(last, m.index);
    if (before.trim() && refs.length) flush();
    text += before;
    const r = m[1] ? named.get(m[1].trim()) : parseRef(m[3] ?? "") ?? (m[2] ? named.get(m[2].trim()) : undefined);
    if (r) refs.push(r);
    last = (m.index ?? 0) + m[0].length;
  }
  text += line.slice(last);
  flush();
  return segs;
}
const dayOf = (s: string): string => {
  const d = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+2026)?\b/.exec(s) || /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/.exec(s);
  if (!d) return /\b(2026-\d{2}-\d{2})\b/.exec(s)?.[1] ?? "";
  const [dd, mm] = /^\d/.test(d[1]) ? [d[1], d[2]] : [d[2], d[1]];
  return `2026-${String(MONTHS.indexOf(mm) + 1).padStart(2, "0")}-${dd.padStart(2, "0")}`;
};
function paragraphs(page: string, wt: string, kind: "timeline" | "table" | "prose"): Para[] {
  const named = namedRefs(wt);
  const out: Para[] = [];
  let day = "";
  let section = "";
  let skip = false;
  let n = 0;
  const lines = wt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const h = /^(=+)\s*(.*?)\s*=+$/.exec(line);
    if (h) {
      const title = clean(h[2]);
      const lvl = h[1].length;
      if (MONTHS.includes(title)) { day = ""; section = ""; continue; }
      const d = kind === "timeline" ? /^(\d{1,2})(?:\s*[–-]\s*\d{1,2})?\s+([A-Z][a-z]+)/.exec(title) : null;
      if (d && MONTHS.includes(d[2])) {
        day = `2026-${String(MONTHS.indexOf(d[2]) + 1).padStart(2, "0")}-${d[1].padStart(2, "0")}`;
        section = "";
        continue;
      }
      if (kind === "timeline") {
        if (lvl >= 3 && day) section = title;
        else if (lvl <= 2) { day = ""; section = ""; }
      } else {
        section = title;
        skip = NOT_ATTACKS.test(title);
      }
      continue;
    }
    // A table: a row per attack, the date column carried down a rowspan.
    if (kind === "table" && line.startsWith("{|")) {
      const heads: string[] = [];
      const span: { v: string; left: number }[] = [];
      let cells: string[] = [];
      const row = () => {
        if (!cells.length) return;
        const full: string[] = [];
        let c = 0;
        for (let col = 0; col < Math.max(heads.length, cells.length + span.length); col++) {
          if (span[col] && span[col].left > 0) { full[col] = span[col].v; span[col].left--; continue; }
          if (c >= cells.length) break;
          const raw = cells[c++];
          const rs = /rowspan\s*=\s*"?(\d+)"?[^|]*\|(?!\|)/i.exec(raw);
          const v = rs ? raw.slice(rs.index + rs[0].length) : raw.replace(/^\s*(?:style|class|colspan|align)\s*=[^|]*\|(?!\|)/i, "");
          full[col] = v;
          if (rs) span[col] = { v, left: +rs[1] - 1 };
        }
        cells = [];
        const dateCol = heads.findIndex((x) => /date/i.test(x));
        const rowDay = dayOf(clean(full[dateCol] ?? "")) || dayOf(clean(full.join(" ")));
        if (!rowDay || skip) return;
        const text = full.map((v, k) => `${heads[k] ? clean(heads[k]) + ": " : ""}${v}`).join(". ");
        const segs = segmentsOf(text, named, `t${n++}`);
        // A row's citations are the whole row's.
        const refs = segs.flatMap((s) => s.refs);
        if (refs.length) out.push({ page, day: rowDay, theatre: section, segs: [{ id: `t${n}`, text: clean(text.replace(/<ref[\s\S]*?(?:<\/ref>|\/>)/gi, "")), refs }] });
      };
      for (i++; i < lines.length && !lines[i].trim().startsWith("|}"); i++) {
        const l = lines[i].trim();
        if (l.startsWith("!")) heads.push(...l.slice(1).split("!!").map((x) => clean(x.replace(/^[^|]*\|(?!\|)/, (m) => (/=/.test(m) ? "" : m)))));
        else if (l.startsWith("|-")) row();
        else if (l.startsWith("|")) cells.push(...l.slice(1).split("||"));
        else if (cells.length) cells[cells.length - 1] += " " + l;
      }
      row();
      continue;
    }
    if (!line || /^[{|!]/.test(line) || /^\[\[(?:File|Image):/i.test(line)) continue;
    if (kind === "timeline" && !day) continue;
    if (kind === "prose" && (skip || !dayOf(clean(line)))) continue;
    if (kind === "table") continue;
    const segs = segmentsOf(line, named, `p${n++}`);
    if (segs.length) out.push({ page, day: kind === "timeline" ? day : "", theatre: section, segs });
  }
  return out;
}

/* ---------- The reading ----------
 * Done by hand, once (user, 9 Oct: the site's models are for the live
 * reports): --dump writes every cited line, one per row; the attacks read
 * from them go in a JSON-lines file, one per attack:
 *   {"k":"<page>:<segment id>","actor":"israel","town":"Sanandaj","site":"","country":"Iran","day":"","headline":"…"}
 * and --events reads them back through the checks below.
 */
/** The text writes this day ("3 March", "March 3", "2026-03-03"). */
function mentions(text: string, day: string): boolean {
  const [, m, d] = day.split("-").map(Number);
  const mon = MONTHS[m - 1];
  return new RegExp(`\\b${d}\\s+${mon}\\b|\\b${mon}\\s+${d}\\b|${day}`).test(text);
}
type AiEvent = { seg: string; actor: string; day?: string; town?: string; site?: string; country: string; headline: string };
/** "Tehran", "Al Udeid Air Base", "Nabatieh al-Fawqa": a name, never "oil refinery" or "southern Lebanon". */
const SMALL = new Set(["al", "el", "an", "ar", "ad", "as", "ash", "az", "ez", "es", "ed", "of", "the", "de", "bin", "bint", "ibn", "abu", "and"]);
function properName(x: string): boolean {
  if (/^(?:southern|northern|eastern|western|central|south|north|east|west|greater|upper|lower)\b/i.test(x)) return false;
  if (/\b(?:province|governorate|region|district|valley|airspace|coast|border|areas?)\b/i.test(x) && !/\bisland\b/i.test(x)) return false;
  const words = x.split(/[\s-]+/).filter((w) => w.length > 1 && !SMALL.has(w.toLowerCase()));
  return words.length > 0 && words.every((w) => /^[\p{Lu}\d'’]/u.test(w));
}
/* ---------- Where ---------- */
type Geo = { lat: number; lng: number; country: string; kind: string; name: string } | null;
const COUNTRY: Record<string, string> = { "United Arab Emirates": "UAE", "Palestinian Territory": "Palestine", "State of Palestine": "Palestine", "Palestinian Territories": "Palestine" };
const ISO: Record<string, string> = { Iran: "ir", Israel: "il", Lebanon: "lb", Iraq: "iq", Syria: "sy", Jordan: "jo", UAE: "ae", "United Arab Emirates": "ae", Qatar: "qa", Bahrain: "bh", Kuwait: "kw", Oman: "om", "Saudi Arabia": "sa", Cyprus: "cy", Yemen: "ye", Azerbaijan: "az", Turkey: "tr", Pakistan: "pk", Palestine: "ps" };
const OK_TYPE = /^(city|town|village|hamlet|suburb|neighbourhood|quarter|city_district|borough|municipality|island|islet|aerodrome|military|industrial|port|harbour|man_made|amenity|building|aeroway|locality|isolated_dwelling|square|district)$/;
let lastCall = 0;
async function geocode(place: string, country: string): Promise<Geo> {
  const own = iranPlacesIn(place)[0];
  if (own) return { lat: own.lat, lng: own.lng, country: own.country, kind: own.kind, name: own.name };
  if (country === "sea" || /\b(?:sea|gulf|strait)\b/i.test(place)) return null;
  const key = `${place}|${country}`;
  if (key in cache.geo) return cache.geo[key] as Geo;
  const cc = ISO[country];
  if (!cc) return (cache.geo[key] = null);
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en&addressdetails=1&countrycodes=${cc}&q=${encodeURIComponent(place)}`;
  let g: Geo = null;
  try {
    const j = (await (await fetch(u, { headers: { "user-agent": UA } })).json()) as { lat: string; lon: string; addresstype?: string; name?: string; address?: { country?: string } }[];
    // The first answer that is a town or a site, never the province or county of the same name.
    const r = j.find((x) => OK_TYPE.test(String(x.addresstype || "")));
    if (r && OK_TYPE.test(String(r.addresstype || ""))) {
      const c = String(r.address?.country || country);
      g = { lat: +(+r.lat).toFixed(4), lng: +(+r.lon).toFixed(4), country: COUNTRY[c] ?? c, kind: String(r.addresstype), name: place };
    }
  } catch {
    return null;
  }
  cache.geo[key] = g;
  save();
  return g;
}

/* ---------- Which outlet ---------- */
// Each country's news from its own sources (user's rule): the line's outlet from the place's country first.
const OWN: Record<string, RegExp> = {
  Lebanon: /nna-leb|lorientlejour|naharnet|almanar|al-akhbar|almayadeen|lbcgroup|mtv\.com\.lb|annahar|aljadeed|dailystar\.com\.lb/,
  Israel: /timesofisrael|jpost|ynetnews|haaretz|i24news|israelhayom|kan\.org|mako|maariv|idf\.il|gov\.il/,
  Iran: /irna|tasnim|farsnews|presstv|mehrnews|isna|ifpnews|tehrantimes|iribnews|khamenei|iranintl|en-hrana|iranwire|radiofarda/,
  Iraq: /rudaw|kurdistan24|shafaq|ina\.iq|alsumaria|thenewregion/,
};
function pickRef(refs: Ref[], country: string): Ref {
  const own = OWN[country];
  return (own && refs.find((r) => own.test(r.url))) || refs[0];
}

/* ---------- Run ---------- */
const all: Para[] = [];
for (const [page, kind] of PAGES) {
  const wt = await wikitext(page);
  const ps = paragraphs(page, wt, kind).filter((p) => !p.day || (p.day >= FROM && p.day <= TO));
  console.log(`${page}: ${ps.length} paragraphs, ${ps.reduce((a, p) => a + p.segs.length, 0)} cited segments`);
  all.push(...ps);
}
if (process.argv.includes("--parse-only")) {
  for (const p of all.filter((x) => process.argv.includes("--show") ? x.page.startsWith(arg("--show", "")) : true).slice(0, 6)) console.log(p.day, p.theatre, JSON.stringify(p.segs.map((s) => [s.text.slice(0, 140), s.refs.map((r) => r.site)])));
  process.exit(0);
}
const segById = new Map<string, { seg: Seg; para: Para }>();
for (const p of all) for (const s of p.segs) segById.set(`${p.page}:${s.id}`, { seg: s, para: p });

if (process.argv.includes("--dump")) {
  const rows = all.flatMap((p) => p.segs.map((x) => `${p.page}:${x.id}\t${p.day}\t${p.theatre}\t${x.text.slice(0, 1800)}`));
  fs.writeFileSync(arg("--dump", "segments.tsv"), rows.join("\n"));
  console.log(`${rows.length} cited lines written`);
  process.exit(0);
}
const events: (AiEvent & { k: string })[] = fs.readFileSync(arg("--events", "events.jsonl"), "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

type Pin = { fp: string; day: string; actor: string; place: string; lat: number; lng: number; country: string; label: string; text: string; source: string; url: string; also: { source: string; url: string }[] };
const pins = new Map<string, Pin>();
const dropped: Record<string, number> = {};
const drop = (why: string) => { dropped[why] = (dropped[why] ?? 0) + 1; if (process.env.BF_DEBUG) console.log(`drop: ${why} | ${JSON.stringify(current)}`); };
let current: unknown = null;
for (const e of events) {
  current = e;
  {
    const hit = segById.get(e.k);
    if (!hit || !(e.site || e.town) || !e.headline) { drop("no segment"); continue; }
    const { seg, para } = hit;
    // The day: the timeline's heading, a table row's date, or a date the line itself writes.
    const day = para.day || (/^2026-\d{2}-\d{2}$/.test(String(e.day ?? "")) ? String(e.day) : "");
    if (!day || (!para.day && !mentions(seg.text + " " + para.segs.map((x) => x.text).join(" "), day)) || day < FROM || day > TO) { drop("no day in the text"); continue; }
    // Grounded: the place is written in the line (or a sentence of its paragraph), a proper name.
    const paraText = `${para.theatre} ${para.segs.map((s) => s.text).join(" ")}`.toLowerCase();
    const names = [e.site, e.town].map((x) => String(x || "").trim()).filter((x) => x && properName(x));
    const grounded = names.filter((x) => paraText.includes(x.toLowerCase()));
    if (!grounded.length) { drop(names.length ? "place not in the text" : "no proper place name"); continue; }
    if (tallyNotEvent(e.headline) || /\b\d+\s+(?:provinces|cities|locations|sites|targets)\b/i.test(e.headline)) { drop("round-up"); continue; }
    let g: Geo = null;
    for (const x of grounded) if ((g = await geocode(x, String(e.country || "")))) break;
    if (!g) { drop("not found as a town or site"); continue; }
    const country = g.kind === "sea" ? "sea" : g.country;
    if (!iranPinAllowed(e.actor, { country }, e.headline)) { drop("outside the map's scope"); continue; }
    const ref = pickRef(seg.refs, country);
    const k = `${day}|${g.lat},${g.lng}`;
    const prev = pins.get(k);
    if (prev) {
      if (!prev.also.some((a) => a.url === ref.url) && prev.url !== ref.url) prev.also.push({ source: ref.site, url: ref.url });
      continue;
    }
    pins.set(k, {
      fp: `bf-${day}-${e.actor}-${g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      day,
      actor: e.actor,
      place: g.name,
      lat: g.lat,
      lng: g.lng,
      country,
      label: String(e.headline).trim(),
      text: seg.text,
      source: ref.site,
      url: ref.url,
      also: [],
    });
  }
}
const out = [...pins.values()].sort((a, b) => a.day.localeCompare(b.day));
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
const byMonth: Record<string, number> = {};
for (const p of out) byMonth[p.day.slice(0, 7)] = (byMonth[p.day.slice(0, 7)] ?? 0) + 1;
console.log(`${out.length} pins`, byMonth, "dropped:", dropped);
process.exit(0);
