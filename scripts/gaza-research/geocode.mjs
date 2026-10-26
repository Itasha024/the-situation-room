/**
 * The places the readers named that the gazetteer does not have ("NEW:<English>|<Arabic>|<near town>"), looked up once in
 * OpenStreetMap's Nominatim (free, one request a second), kept only when within 25 km of the town the reader named.
 *
 *   node scripts/gaza-research/geocode.mjs <folder of read batches> <cache.json>
 *
 * pins-build.mts reads the cache: {"<NEW string>": [lat, lng] | null}.
 */
import fs from "node:fs";
import path from "node:path";

const [dir, cacheFile] = process.argv.slice(2);
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
const want = new Set();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  try { for (const e of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) if (String(e.place || "").startsWith("NEW:")) want.add(e.place); } catch { /* a batch still being written */ }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Gaza and Judea and Samaria, with Jerusalem.
const VIEWBOX = "34.2,32.6,35.6,31.2";
async function look(q) {
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=5&bounded=1&viewbox=${VIEWBOX}&countrycodes=ps,il&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { "User-Agent": "TheSituationRoom-research/1.0 (thesituationroom.live)", "Accept-Language": "en" } });
  await sleep(1100);
  return r.ok ? r.json() : [];
}
let n = 0;
for (const s of want) {
  if (s in cache) continue;
  const [en = "", nat = "", near = ""] = s.slice(4).split("|").map((x) => x.trim());
  let hit = null;
  for (const q of [nat && near ? `${nat}` : "", `${en}, ${near}`, en, nat].filter(Boolean)) {
    const res = await look(q);
    if (res.length) { hit = res; break; }
  }
  cache[s] = hit ? hit.map((h) => [+(+h.lat).toFixed(5), +(+h.lon).toFixed(5)]) : null;
  if (++n % 20 === 0) fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 0));
}
fs.writeFileSync(cacheFile, JSON.stringify(cache));
console.log(`places ${want.size}, looked up ${n}, found ${Object.values(cache).filter(Boolean).length}`);
