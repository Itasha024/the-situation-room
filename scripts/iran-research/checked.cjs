// Events the readers flagged, checked against other sources (11 Oct). Run after the merge.
// Usage: node checked.cjs <baseline.json>
const fs = require('fs');
const BASE = process.argv[2];
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const near = (p, lat, lng, r) => Math.hypot((p.lat - lat) * 111, (p.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180)) < r;
const out = new Set();
const fold = (from, into) => { if (!into) return; for (const p of from) { if (p === into) continue; for (const s of [{ source: p.source, url: p.url }, ...p.also]) if (s.url !== into.url && !into.also.some((a) => a.url === s.url)) into.also.push(s); out.add(p); } };

// Ras Laffan, 21 June: an accident during a gas restart, not an attack. Qatar's energy minister called it "an
// accident and not sabotage or hostile" (Khaleej Times, 24 June).
for (const p of base) if (near(p, 25.91, 51.55, 15) && p.day >= '2026-06-21' && p.day <= '2026-06-24') out.add(p);
// Damascus, 7 July: two planted bombs near the Tourism Ministry, an internal Syrian attack (SNHR, 9 July).
for (const p of base) if (near(p, 33.51, 36.29, 15) && p.day >= '2026-07-07' && p.day <= '2026-07-08') out.add(p);
// Barakah: one attack on 17 May (three drones from Iraq, the UAE's MoD); the 19 May reports retell it.
{ const b = base.filter((p) => near(p, 23.96, 52.26, 20) && p.day >= '2026-05-17' && p.day <= '2026-05-19'); fold(b, b.find((p) => p.day === '2026-05-17')); }
// Lavan island: struck on 8 April, hours after the ceasefire; IRNA's 12 May post retells it (WSJ and Bloomberg
// reported on 11 May that the UAE carried it out).
{ const l = base.filter((p) => near(p, 26.81, 53.36, 20) && (p.day === '2026-04-08' || p.day === '2026-05-12')); fold(l, l.find((p) => p.day === '2026-04-08')); }
// Mina al-Fahal, 5 June: a blast between the terminal's mooring buoys, a drone suspected (Reuters); Oman gave no cause.
for (const p of base) if (near(p, 23.63, 58.52, 8) && p.day === '2026-06-05') {
  p.label = 'Blast at the Mina al-Fahal oil terminal, a drone suspected, Reuters reports';
  const s = { source: 'The New Arab (citing Reuters)', url: 'https://www.newarab.com/news/what-we-know-about-reported-explosion-omans-oil-terminal' };
  if (!p.also.some((a) => a.url === s.url)) p.also.unshift(s);
}
console.log('checked: removed or folded', out.size);
fs.writeFileSync(BASE, JSON.stringify(base.filter((p) => !out.has(p))));
