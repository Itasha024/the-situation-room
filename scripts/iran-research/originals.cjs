// A pin's link goes to the original report, never to a compiler of others' reports (user, 11 Oct).
// 1. INSS: its map layers name, for each attack, the outlets it drew on ("Naharnet, 2026-06-23, https://…").
//    An INSS pin takes the first of them as its source, the rest and INSS as its "also".
// 2. Any pin: the best of its sources leads. Original reports (news outlets, officials, reporters) come
//    first, then channels that relay others' posts, then compilers (INSS, ISW, Liveuamap, ACLED, JINSA,
//    Windward) last.
// 3. --traced out.jsonl,…: compiler pins traced by hand to the report they drew on ({ fp, source, url }), or
//    found wrong by it ({ fp, wrong: true }: no attack there that day), which leave the map.
// Usage: node originals.cjs <baseline.json> <inss layer.json>... [--traced a.jsonl,b.jsonl] [--dry]
const fs = require('fs');
const [BASE, ...rest] = process.argv.slice(2);
const DRY = rest.includes('--dry');
const ti = rest.indexOf('--traced');
const traced = new Map(ti < 0 ? [] : rest[ti + 1].split(',').flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))).map((t) => [t.fp, t]));
const layers = rest.filter((a, i) => a !== '--dry' && a !== '--traced' && i !== ti + 1).flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).map((x) => x.attributes));

const COMPILER = /^(INSS|ISW|Liveuamap|ACLED|JINSA|Windward|Critical Threats|Long War Journal)$/i;
const COMPILER_URL = /inss\.org\.il|understandingwar\.org|liveuamap\.com|acleddata\.com|jinsa\.org|windward\.ai|criticalthreats\.org|longwarjournal\.org/i;
const RELAY = /^(Naya|Sabereen|Al-Mihwar|Ali Bk|Vahid Online|Akhbar-e Fori|Ilia|Alomhoar)$/i;
const rank = (s) => (COMPILER.test(s.source) || COMPILER_URL.test(s.url) ? 2 : RELAY.test(s.source) ? 1 : 0);

// "Associated Press – 2026-07-16 – https://…; The Guardian – … – https://…" or "Naharnet, 2026-06-23, https://…"
const parse = (src) => [...String(src).matchAll(/([^;]*?)(https?:\/\/[^\s;]+)/g)].map(([, pre, url]) => ({
  source: pre.replace(/[–—,-]?\s*\d{4}-\d{2}-\d{2}\s*[–—,-]?\s*$/, '').replace(/^[\s;,–—-]+|[\s,–—-]+$/g, '').trim() || new URL(url).hostname.replace(/^www\.|^today\./, ''),
  url: url.replace(/[.,)]+$/, ''),
}));
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));

const all = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const base = all.filter((p) => !traced.get(p.fp)?.wrong);
const n = { inssTraced: 0, inssLeft: 0, promoted: 0 };
for (const p of base) {
  const t = traced.get(p.fp);
  const srcs = [...(t?.url ? [{ source: t.source, url: t.url }] : []), { source: p.source, url: p.url }, ...p.also.filter((a) => a.url !== t?.url)];
  if (srcs.some((s) => s.source === 'INSS')) {
    const f = layers.filter((a) => a.Date === p.day && Number.isFinite(a.Latitude) && km(p, { lat: a.Latitude, lng: a.Longitude }) < 2)
      .sort((a, b) => km(p, { lat: a.Latitude, lng: a.Longitude }) - km(p, { lat: b.Latitude, lng: b.Longitude }))[0];
    const orig = f ? parse(f.Source) : [];
    if (orig.length) n.inssTraced++; else if (p.source === 'INSS') n.inssLeft++;
    for (const o of orig) if (!srcs.some((s) => s.url === o.url)) srcs.push(o);
  }
  // A stable sort: among equals, the order the sources came in.
  const best = srcs.map((s, i) => [s, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([s]) => s);
  if (best[0].url !== p.url) n.promoted++;
  p.source = best[0].source;
  p.url = best[0].url;
  // "…, INSS reports": the words name the source that now leads.
  if (rank(p) === 0) p.label = p.label.replace(/, (INSS|ISW|Liveuamap|ACLED|JINSA|Windward) reports$/, `, ${p.source} reports`);
  p.also = best.slice(1).filter((s, i, a) => s.url !== p.url && a.findIndex((t) => t.url === s.url) === i);
}
const lead = {};
for (const p of base) if (rank(p) > 0) lead[p.source] = (lead[p.source] ?? 0) + 1;
console.log(n, 'wrong, removed:', all.length - base.length, 'still led by a relay or a compiler:', lead);
if (!DRY) fs.writeFileSync(BASE, JSON.stringify(base));
