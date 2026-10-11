/**
 * The Iran map's research by hand (user, 9 Oct: "look in our sources, not just
 * Wikipedia"): attacks read from the desk's own sources' history — Lebanon's
 * outlets for Lebanon, the IDF for its own strikes, Iran's for Iran — merged
 * into public/iran-strikes-baseline.json beside the Wikipedia backfill.
 *
 * Each line of the events file is one attack I read and wrote myself (no model
 * quota): { day, actor, said, country, label, source, url, text }. `said` is
 * the place as the source writes it, in its own language. Code keeps a pin only
 * when
 * - the place is written in the source's text (grounded),
 * - OpenStreetMap finds it as a town or site in that country (never a province),
 * - it is inside the map's scope (iranPinAllowed),
 * and one pin per place and day: a second source of the same attack is its "also".
 *
 * A line may give `cands` instead of `said`: the names a headline may mean,
 * longest first ("النبي شيت", "النبي"); the first that is a town wins.
 *
 * `--gaz Lebanon=osm-lb.json`: a country's towns and villages from one
 * OpenStreetMap download (Overpass, place=*), matched by their Arabic names,
 * instead of a geocoder call per name.
 *
 * `--gn Iraq=IQ.txt`: a country's GeoNames dump, tried before the geocoder.
 *
 *   node iran-research.mts --events research.jsonl [--gaz Lebanon=osm-lb.json] [--gn Iraq=IQ.txt] [--base public/iran-strikes-baseline.json] [--dry]
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { iranPinAllowed, iranPlacesIn } from "../src/lib/desk/iran-places.ts";
const countryAt: (lat: number, lng: number) => string = createRequire(import.meta.url)("./iran-research/country-at.cjs");

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const EVENTS = arg("--events", "research.jsonl");
const BASE = arg("--base", "public/iran-strikes-baseline.json");
const CACHE = arg("--cache", "iran-research-cache.json");
const UA = "TheSituationRoomDesk/1.0 (research backfill; itamarshaashua@gmail.com)";

// `at` (ISO): the attack's own time, when the source gives it (sirens, UKMTO). `lat`/`lng`: a position the
// source gives itself (UKMTO's, a Home Front Command locality's), used instead of looking the name up.
type Hand = { day: string; at?: string; actor: string; said: string; cands?: string[]; country: string; label: string; source: string; url: string; text: string; en?: string; lat?: number; lng?: number; also?: { source: string; url: string }[] };
type Pin = { fp: string; day: string; at?: string; actor: string; place: string; lat: number; lng: number; label: string; source: string; url: string; also: { source: string; url: string }[] };
type Geo = { lat: number; lng: number; name: string } | null;

const ISO: Record<string, string> = { Iran: "ir", Israel: "il", Lebanon: "lb", Iraq: "iq", Syria: "sy", Jordan: "jo", UAE: "ae", Qatar: "qa", Bahrain: "bh", Kuwait: "kw", Oman: "om", "Saudi Arabia": "sa", Cyprus: "cy" };
// A town, a village or a site, never the province or district of the same name.
const OK_TYPE = /^(city|town|village|hamlet|suburb|neighbourhood|quarter|city_district|borough|municipality|island|islet|aerodrome|military|industrial|port|harbour|man_made|amenity|building|aeroway|locality|isolated_dwelling|square)$/;

// Arabic spellings that differ only in a letter's form or a space are one name ("كفرتبنيت", "كفر تبنيت").
const norm = (s: string) =>
  s.normalize("NFC").replace(/[ً-ْـ​-‏]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").replace(/\s+/g, "");
type OsmPlace = { lat: number; lon: number; tags: Record<string, string> };
const GAZ = new Map<string, Map<string, Geo>>();
for (const g of process.argv.flatMap((a, i) => (process.argv[i - 1] === "--gaz" ? [a] : []))) {
  const [country, file] = g.split("=");
  const byName = new Map<string, OsmPlace[]>();
  for (const e of (JSON.parse(fs.readFileSync(file, "utf8")) as { elements: OsmPlace[] }).elements) {
    for (const n of [e.tags["name:ar"], e.tags.name, e.tags.alt_name, e.tags["alt_name:ar"], e.tags.old_name].filter(Boolean).flatMap((x) => x.split(";"))) {
      const k = norm(n);
      byName.set(k, [...(byName.get(k) ?? []), e]);
    }
  }
  // A name several villages share: the southernmost, nearest where this war's strikes fall
  // (Aramoun of Aley, not of Keserwan; the Qsaibeh by Nabatieh, not the Metn's).
  const pick = (xs: OsmPlace[]) => xs.reduce((a, b) => (b.lat < a.lat ? b : a));
  const m = new Map<string, Geo>();
  for (const [k, xs] of byName) {
    const x = pick(xs);
    m.set(k, { lat: +x.lat.toFixed(4), lng: +x.lon.toFixed(4), name: x.tags["name:en"] || x.tags["name:fr"] || x.tags.name });
  }
  GAZ.set(country, m);
}

// `--gn Iraq=gn/IQ.txt`: a country's GeoNames dump (towns, villages, bases, airports, ports, islands), every
// name and other name of each, tried before Nominatim. A name several places share: the most populous town.
const GN_OK = /^(P\.|S\.(AIRB|AIRF|AIRP|AIRH|MILB|INSM|PRT|PO|OILR|OILT|PS|PSH|DAM|CMP|RSTN|BDG|PAL|UNIV|HSP|CTRR|FT|MSQE|STDM|SQR)|T\.(ISL|ISLS)|L\.(PRT|PRK|INDS|MILB))/;
const GN = new Map<string, Map<string, Geo & { pop: number; p: boolean }>>();
for (const g of process.argv.flatMap((a, i) => (process.argv[i - 1] === "--gn" ? [a] : []))) {
  const [country, file] = g.split("=");
  const m = new Map<string, Geo & { pop: number; p: boolean }>();
  for (const l of fs.readFileSync(file, "utf8").split("\n")) {
    const c = l.split("\t");
    if (c.length < 15 || !GN_OK.test(`${c[6]}.${c[7]}`)) continue;
    const v = { lat: +(+c[4]).toFixed(4), lng: +(+c[5]).toFixed(4), name: c[2] || c[1], pop: +c[14] || 0, p: c[6] === "P" };
    for (const n of [c[1], c[2], ...c[3].split(",")]) {
      if (!n || n.length < 3) continue;
      const k = norm(n), o = m.get(k);
      if (!o || (v.p && !o.p) || (v.p === o.p && v.pop > o.pop)) m.set(k, v);
    }
  }
  GN.set(country, m);
}

// `--places out-0.jsonl,out-1.jsonl`: the names the gazetteers missed, placed by hand ({ key: "country|said", level, en, lat, lng }).
// level "no": not a place. "country": only the country is known, so the pin goes at its middle, and only on a
// day with no other pin in that country (a report that names no place is most likely one already pinned).
type Placed = { level: string; en?: string; lat?: number; lng?: number };
const PLACES = new Map<string, Placed>();
for (const f of process.argv.flatMap((a, i) => (process.argv[i - 1] === "--places" ? a.split(",") : [])))
  for (const l of fs.readFileSync(f, "utf8").split("\n")) if (l.trim()) { const p = JSON.parse(l); PLACES.set(p.key, p); }
const GEN: Record<string, [number, number]> = { Iran: [32.4, 53.7], Iraq: [33.2, 43.7], Lebanon: [33.85, 35.86], Syria: [34.8, 38.99], Jordan: [31.25, 36.5], "Saudi Arabia": [24, 45], "United Arab Emirates": [23.9, 54.3], UAE: [23.9, 54.3], Qatar: [25.3, 51.2], Kuwait: [29.31, 47.48], Bahrain: [26.07, 50.55], Oman: [21.5, 57], Turkey: [39, 35], Azerbaijan: [40.3, 47.7], Cyprus: [35, 33.2], Egypt: [26.8, 30.8] };

const cache: Record<string, Geo> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
let lastCall = 0;
async function geocode(q: string, country: string): Promise<Geo> {
  // The desk's own list only for the whole name: "عدشيت - النبطية" is Adshit, not Nabatieh.
  const own = iranPlacesIn(q).find((p) => [p.name, ...(p.alt ?? [])].some((n) => norm(n) === norm(q)));
  if (own && own.kind !== "sea" && own.country === country) return { lat: own.lat, lng: own.lng, name: own.name };
  const gaz = GAZ.get(country);
  if (gaz) return gaz.get(norm(q)) ?? gaz.get(norm(q.replace(/^ال/, ""))) ?? gaz.get(norm("ال" + q)) ?? null;
  const gn = GN.get(country);
  const hit = gn && (gn.get(norm(q)) ?? gn.get(norm(q.replace(/^ال/, ""))) ?? gn.get(norm("ال" + q)));
  if (hit) return { lat: hit.lat, lng: hit.lng, name: hit.name };
  const key = `${q}|${country}`;
  if (key in cache) return cache[key];
  const cc = ISO[country];
  if (!cc) return null;
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  let g: Geo = null;
  try {
    const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en&countrycodes=${cc}&q=${encodeURIComponent(q)}`;
    const j = (await (await fetch(u, { headers: { "user-agent": UA } })).json()) as { lat: string; lon: string; addresstype?: string; name?: string }[];
    const r = j.find((x) => OK_TYPE.test(String(x.addresstype || "")));
    if (r) g = { lat: +(+r.lat).toFixed(4), lng: +(+r.lon).toFixed(4), name: String(r.name || q) };
  } catch {
    return null;
  }
  cache[key] = g;
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  return g;
}

// The same place on the same day: one pin, within a kilometre and a half.
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dy = (a.lat - b.lat) * 111;
  const dx = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

const base: Pin[] = JSON.parse(fs.readFileSync(BASE, "utf8"));
const before = base.length;
const hand: Hand[] = fs.readFileSync(EVENTS, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const dropped: Record<string, number> = {};
const drop = (why: string, e: Hand) => {
  dropped[why] = (dropped[why] ?? 0) + 1;
  if (process.env.BF_DEBUG) console.log(`drop: ${why} | ${e.day} ${e.said ?? e.cands?.join("/")} | ${e.label}`);
  // BF_DROPS=file: the dropped events, one JSON line each, with the reason (for a second look at the places not found).
  if (process.env.BF_DROPS) fs.appendFileSync(process.env.BF_DROPS, JSON.stringify({ why, ...e }) + "\n");
};
const added: Record<string, number> = {};
for (const e of hand) {
  if (!/^2026-\d{2}-\d{2}$/.test(e.day) || !(e.said || e.cands?.length) || !e.url || !e.label) { drop("incomplete", e); continue; }
  const names = (e.cands ?? [e.said]).filter((n) => e.text.includes(n));
  if (!names.length) { drop("place not in the text", e); continue; }
  let g: Geo = Number.isFinite(e.lat) && Number.isFinite(e.lng) ? { lat: +e.lat!.toFixed(4), lng: +e.lng!.toFixed(4), name: e.en || names[0] } : null;
  if (!g) for (const n of names) if ((g = await geocode(n, e.country))) break;
  if (!g && e.en) g = await geocode(e.en, e.country);
  if (!g) {
    const h = PLACES.get(`${e.country}|${e.cands ? e.cands.join(" / ") : e.said}`);
    if (h?.level === "no") { drop("not a place (checked by hand)", e); continue; }
    if (h?.level === "country") {
      const c = GEN[e.country];
      if (!c) { drop("country not on the map", e); continue; }
      const cn = e.country === "UAE" ? "United Arab Emirates" : e.country;
      if (base.some((p) => p.day === e.day && countryAt(p.lat, p.lng) === cn)) { drop("country in general, a day with places", e); continue; }
      g = { lat: c[0], lng: c[1], name: `${cn === "United Arab Emirates" ? "the UAE" : cn} (place not stated)` };
    } else if (h && Number.isFinite(h.lat) && Number.isFinite(h.lng)) {
      // A place in Israel: its attacks are the Home Front Command's pins, never another source's.
      if (countryAt(h.lat!, h.lng!) === "Israel") { drop("in Israel", e); continue; }
      g = { lat: +h.lat!.toFixed(4), lng: +h.lng!.toFixed(4), name: h.en || names[0] };
    }
  }
  if (!g) { drop("not found as a town or site", e); continue; }
  if (!iranPinAllowed(e.actor, { country: e.country }, e.label)) { drop("outside the map's scope", e); continue; }
  // One attack, one pin: a second source of it is its "also".
  // - Reports by the day alone: the same place that day (two of NNA's headlines on one village are one).
  // - Timed reports from one source are that many attacks (three tankers struck in Hormuz in ten minutes);
  //   a timed one and another source's: within two hours and 5 km, or that day and 1.5 km.
  // - A ship attack is told by the town it lies off ("137 nautical miles east of Muscat"), which one source
  //   pins at the town and another at sea, its day by report or by incident: another source's that day within
  //   30 km, or a day apart within 25 km or at the same distance off the same town.
  // A pin takes one report from each other source, so a second UKMTO warning beside it is a second attack;
  // of several that fit, the nearest in days, then in km.
  const SHIP = /\b(?:tanker|vessel|ship|carrier|tug|nautical miles)\b/i;
  const off = (s: string) => (s.match(/\b(\d+(?:\.\d+)?) (?:nautical miles|NM)\b[^,(]*?\bof ([A-Z][\w' -]+?)(?:,|\s\(|$)/) ?? []).slice(1).join(" ");
  const dayGap = (p: Pin) => Math.abs(Date.parse(p.day) - Date.parse(e.day)) / 864e5;
  const other = (p: Pin) => p.source !== e.source && p.also.every((a) => a.source !== e.source);
  // - The same place by name that day is that pin (sources place a town by different points), within 40 km.
  const sameName = (p: Pin) => !e.at && p.day === e.day && p.place.toLowerCase() === (e.en || g.name).toLowerCase() && km(p, g) < 40;
  const fits = (p: Pin) =>
    sameName(p) || !e.at && !p.at && p.day === e.day && km(p, g) < 1.5
    || other(p) && (
      SHIP.test(e.label) && SHIP.test(p.label) && (dayGap(p) === 0 ? km(p, g) < 30 : dayGap(p) === 1 && (km(p, g) < 25 || (!!off(e.label) && off(e.label) === off(p.label))))
      || (e.at && p.at ? Math.abs(Date.parse(p.at) - Date.parse(e.at)) <= 2 * 3600e3 && km(p, g) < 5 : p.day === e.day && km(p, g) < 1.5));
  const same = base.filter(fits).sort((a, b) => dayGap(a) - dayGap(b) || km(a, g) - km(b, g))[0];
  if (same) {
    if (same.actor === "unclear" && e.actor !== "unclear" && same.url !== e.url) {
      // The pin said no one; this report names who launched it (Kuwait's army: "the Iranian aggression"). It
      // takes the pin's side and words, and the first report stays as a second source.
      same.also = [{ source: same.source, url: same.url }, ...same.also.filter((a) => a.url !== e.url)];
      Object.assign(same, { actor: e.actor, label: e.label.replace("{place}", same.place), source: e.source, url: e.url });
      drop("already pinned that day; its side now named", e);
      continue;
    }
    if (same.url !== e.url && !same.also.some((a) => a.url === e.url)) same.also.push({ source: e.source, url: e.url });
    drop("already pinned that day", e);
    continue;
  }
  const place = e.en || g.name;
  base.push({
    fp: `rs-${e.at ? e.at.slice(0, 16).replace(/[^0-9]/g, "") : e.day}-${e.actor}-${place.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    day: e.day,
    ...(e.at ? { at: e.at } : {}),
    actor: e.actor,
    place,
    lat: g.lat,
    lng: g.lng,
    // "{place}" in a label I wrote over a list of villages: the place's name in English.
    label: e.label.replace("{place}", place),
    source: e.source,
    url: e.url,
    also: e.also ?? [],
  });
  added[e.day.slice(0, 7)] = (added[e.day.slice(0, 7)] ?? 0) + 1;
}
base.sort((a, b) => a.day.localeCompare(b.day));
if (!process.argv.includes("--dry")) fs.writeFileSync(BASE, JSON.stringify(base));
console.log(`${base.length - before} pins added (${base.length} in all)`, added, "dropped:", dropped);
process.exit(0);
