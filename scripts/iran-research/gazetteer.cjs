// The live map's wider place list (user, 11 Oct: Qantara, Talousa, Hermel got no pin; the live map knew only the
// hand list in iran-places.ts). Every place a research pin stands on, outside Israel (its pins are the Home Front
// Command's), with the spellings the research's sources used for it (the geocode cache's names that landed there).
// A name two far-apart places share goes to the one with most pins, or to neither when it is close.
// Lebanon's villages from OpenStreetMap too (Arabic, English, French names), since its channels write in Arabic.
// Usage: node gazetteer.cjs <baseline.json> <iran-research-cache.json> <osm-lb.json> <out.ts>
const fs = require('fs');
const countryAt = require('./country-at.cjs');
const [BASE, CACHE, OSM, OUT] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const LATIN = /^[\x20-\x7e]+$/;
// Words that are no place's name, whatever a geocoder made of them.
const GENERIC = /^(?:north|south|east|west|central|border|area|region|city|town|village|base|camp|airport|port|the|a|al|el)$|^(?:شمال|جنوب|شرق|غرب|منطقة|مدينة|بلدة|قرية|الحدود|محيط|أطراف|اطراف|الجنوب|الشمال|منطقه|شهر|روستا)(?:\s|$)/i;

const spots = new Map(); // "lat,lng" -> { name, lat, lng, country, n, alt:Set }
for (const p of base) {
  if (!p.place || /place not stated/i.test(p.place)) continue;
  const country = countryAt(p.lat, p.lng);
  if (!country || country === 'Israel') continue;
  const k = p.lat.toFixed(3) + ',' + p.lng.toFixed(3);
  const s = spots.get(k) ?? spots.set(k, { name: p.place.split(/[,(]/)[0].trim(), lat: +p.lat.toFixed(4), lng: +p.lng.toFixed(4), country, n: 0, alt: new Set() }).get(k);
  s.n++;
}
for (const [i, e] of JSON.parse(fs.readFileSync(OSM, "utf8")).elements.entries()) {
  const t = e.tags ?? {};
  const latin = [t['name:en'], t['name:fr'], t['name:de'], ...String(t.alt_name ?? '').split(';')].filter((n) => n && LATIN.test(n));
  if (!latin.length || !t.name) continue;
  const k = "osm" + i;
  spots.set(k, { name: latin[0], lat: +e.lat.toFixed(4), lng: +e.lon.toFixed(4), country: 'Lebanon', n: 0, alt: new Set([...latin.slice(1), t.name, t['name:ar']].filter(Boolean)), osm: true });
}
const grid = new Map();
for (const s of spots.values()) { if (s.osm) continue; const g = Math.round(s.lat * 10) + ',' + Math.round(s.lng * 10); (grid.get(g) ?? grid.set(g, []).get(g)).push(s); }
const near = (pt) => { const gx = Math.round(pt.lat * 10), gy = Math.round(pt.lng * 10); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of grid.get(gx + i + ',' + (gy + j)) ?? []) if (km(pt, s) < 1) return s; };
for (const [key, v] of Object.entries(cache)) {
  if (!v || !Number.isFinite(v.lat)) continue;
  const s = near(v);
  if (!s) continue;
  for (const n of [key.split('|')[0], v.name]) if (n && n.length >= 4 && n.length <= 40 && !GENERIC.test(n.trim()) && !/\d/.test(n)) s.alt.add(n.trim());
}
// One spelling, one place.
const owners = new Map();
for (const s of spots.values()) for (const n of [s.name, ...s.alt]) { const k = n.toLowerCase(); (owners.get(k) ?? owners.set(k, []).get(k)).push(s); }
const owns = (n, s) => { const o = owners.get(n.toLowerCase()).filter((t) => km(t, s) > 20); return !o.length || (s.n > 0 && o.every((t) => s.n >= 3 * t.n)); };
// Capitalised words, and the article and joining words names use.
const PROPER = /^(?:(?:[A-Z][\w'’.-]*|al-[\w'’-]+|el-[\w'’-]+|al|el|ad|bin|bint|bani|of|de)(?:\s+|$)){1,4}$/;
const out = [];
for (const s of spots.values()) {
  // A research pin's place is sometimes a phrase ("two vessels on the southern transit route"): only names.
  if (s.name.length < 4 || !LATIN.test(s.name) || !PROPER.test(s.name) || !owns(s.name, s)) continue;
  const alt = [...s.alt].filter((n) => n !== s.name && owns(n, s) && (!LATIN.test(n) || PROPER.test(n)));
  out.push([s.name, s.lat, s.lng, s.country, [s.name, ...alt.filter((n) => LATIN.test(n))], alt.filter((n) => !LATIN.test(n))]);
}
// Same name, a few hundred metres apart: one place.
const seen = new Map();
const uniq = out.filter((r) => { const o = seen.get(r[0]); if (o && km({ lat: o[1], lng: o[2] }, { lat: r[1], lng: r[2] }) < 5) { o[4] = [...new Set([...o[4], ...r[4]])]; o[5] = [...new Set([...o[5], ...r[5]])]; return false; } seen.set(r[0], r); return true; });
fs.writeFileSync(OUT, `// Made by scripts/iran-research/gazetteer.cjs from the research pins and OpenStreetMap; do not edit.
// [name, lat, lng, country, Latin spellings, Arabic/Persian spellings]
export const IRAN_GAZ: [string, number, number, string, string[], string[]][] = ${JSON.stringify(uniq)};
`);
console.log('places', uniq.length, 'by country', Object.entries(uniq.reduce((m, r) => ((m[r[3]] = (m[r[3]] ?? 0) + 1), m), {})).map((e) => e.join(' ')).join(', '));
