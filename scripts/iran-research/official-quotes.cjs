// A relay that quotes an official statement gives way to the official's own post (user, 11 Oct): readers matched
// relay-led pins to the statement they quote; the official leads, the relay becomes a second source.
// Where the official's text names another place than the relay, the pin follows the official (line's place/lat/lng/label);
// a relay reposting an old statement is the same event: one official post and place is one pin, on its first day.
// Usage: node official-quotes.cjs <baseline.json> <out.jsonl> (lines {fp, quote, official, url})
const fs = require('fs');
const [BASE, OUT] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const NAME = { 'Hezbollah military media': "Hezbollah's military media", 'Hezbollah military media (Islamic Resistance)': "Hezbollah's military media" };
let n = 0; const led = new Set(); const moved = new Set();
for (const x of fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(JSON.parse)) {
  const p = base.find((q) => q.fp === x.fp);
  if (!x.quote || !x.url || !p || p.url === x.url) continue;
  const name = NAME[x.official] ?? x.official;
  p.also = [{ source: p.source, url: p.url }, ...(p.also ?? []).filter((a) => a.url !== x.url)];
  if (p.label.endsWith(`, ${p.source} reports`)) p.label = p.label.slice(0, -`${p.source} reports`.length) + `${name} reports`;
  p.source = name; p.url = x.url; n++;
  led.add(p); if (x.place) { p.place = x.place; p.lat = x.lat; p.lng = x.lng; p.label = x.label; moved.add(p); }
}
// Only the pins this rule touched: one official post and place is one pin (the first day), and a moved pin joins one
// already at its new place that day; the others become its sources.
const keys = (p) => [led.has(p) && `${p.url}|${p.place}`, moved.has(p) && `${p.day}|${p.place}`].filter(Boolean);
const keep = new Map(); const drop = new Set();
for (const p of base) if (!led.has(p)) keep.set(`${p.day}|${p.place}`, keep.get(`${p.day}|${p.place}`) ?? p);
for (const p of [...base].filter((q) => led.has(q)).sort((a, b) => a.day.localeCompare(b.day))) {
  for (const k of keys(p)) {
    const q = keep.get(k);
    if (q && q !== p) { q.also = [...(q.also ?? []), { source: p.source, url: p.url }, ...(p.also ?? [])].filter((a, i, all) => a.url !== q.url && all.findIndex((b) => b.url === a.url) === i); drop.add(p); break; }
  }
  if (!drop.has(p)) for (const k of keys(p)) if (!keep.has(k)) keep.set(k, p);
}
for (let i = base.length - 1; i >= 0; i--) if (drop.has(base[i])) base.splice(i, 1);
console.log('merged into an earlier pin:', drop.size);
fs.writeFileSync(BASE, JSON.stringify(base));
console.log('led by the official now:', n);
