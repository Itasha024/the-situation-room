// The old pins swept with the merge's rules (Round 31, 11 Oct): a reader read each flagged pin (rs/sweep/flags.jsonl,
// lines {fp, rule, verdict: drop|move|keep|hold, to: {place, lat, lng}, why}) and the verdicts apply here.
// A place named "district, city" must stand within 40 km of that city: a district the gazetteer found far away is a
// namesake, so the pin goes on the city's own point (named in `why` as "<city> (city|ADM2) is at lat,lng").
// A moved pin joins one already at its new place that day; the others become its sources.
// Usage: node place-sweep.cjs <baseline.json> <flags.jsonl>
const fs = require('fs');
const [BASE, FLAGS] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const km = (a, b) => { const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r; return 6371 * Math.hypot(x, y); };
const byFp = new Map(base.map((p) => [p.fp, p]));
const drop = new Set(); const moved = new Set(); let guarded = 0;
for (const f of fs.readFileSync(FLAGS, 'utf8').split('\n').filter(Boolean).map(JSON.parse)) {
  const p = byFp.get(f.fp);
  if (!p) continue;
  if (f.verdict === 'drop') { drop.add(p); continue; }
  if (f.verdict !== 'move' || !f.to) continue;
  let to = { lat: +f.to.lat, lng: +f.to.lng };
  const city = /([^"]+?) \((?:city|ADM2)\) is at (-?[\d.]+),(-?[\d.]+)/.exec(f.why || '');
  if (city && /,/.test(f.to.place || p.place)) {
    const c = { lat: +city[2], lng: +city[3] };
    if (km(c, to) > 40) { to = c; guarded++; }
  }
  p.lat = +to.lat.toFixed(4); p.lng = +to.lng.toFixed(4);
  if (f.to.place && f.rule !== 'place-far-from-name') { if (p.label.includes(p.place)) p.label = p.label.replace(p.place, f.to.place); p.place = f.to.place; }
  moved.add(p);
}
const keep = new Map();
for (const p of base) if (!drop.has(p) && !moved.has(p)) keep.set(`${p.day}|${p.place}`, keep.get(`${p.day}|${p.place}`) ?? p);
let folded = 0;
for (const p of moved) {
  const k = `${p.day}|${p.place}`; const q = keep.get(k);
  if (q && q !== p) {
    q.also = [...(q.also ?? []), { source: p.source, url: p.url }, ...(p.also ?? [])].filter((a, i, all) => a.url !== q.url && all.findIndex((b) => b.url === a.url) === i);
    drop.add(p); folded++;
  } else keep.set(k, p);
}
const out = base.filter((p) => !drop.has(p));
fs.writeFileSync(BASE, JSON.stringify(out));
console.log({ dropped: drop.size - folded, moved: moved.size, to_city_point: guarded, folded, pins: out.length });
