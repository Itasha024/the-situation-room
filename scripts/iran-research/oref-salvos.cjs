// Home Front Command alerts (28 Feb on) -> salvos: alerts of one kind chained within 5 minutes,
// then split by region; each (salvo, region) is one attack pin at the alerted place nearest the region's alerted centre.
const fs = require('fs');
const C = require('./oref/cities.json');
const REGION = { 6: 'north', 1: 'north', 28: 'north', 16: 'galilee', 4: 'galilee', 10: 'galilee', 19: 'haifa', 22: 'haifa', 34: 'valleys', 25: 'valleys', 15: 'valleys', 5: 'valleys', 9: 'sharon', 18: 'telaviv', 20: 'telaviv', 23: 'telaviv', 32: 'jerusalem', 3: 'jerusalem', 14: 'jerusalem', 11: 'samaria', 29: 'samaria', 7: 'ashdod', 21: 'ashdod', 13: 'gaza', 17: 'gaza', 24: 'negev', 2: 'negev', 12: 'negev', 26: 'eilat', 27: 'eilat' };
const REGION_EN = { north: 'the Upper Galilee and the border', galilee: 'the Galilee and the Golan', haifa: 'Haifa and the Bay', valleys: 'the valleys', sharon: 'the Sharon', telaviv: 'Tel Aviv and the centre', jerusalem: 'Jerusalem and the Judean hills', samaria: 'the West Bank', ashdod: 'Ashdod, Ashkelon and Lachish', gaza: 'the Gaza border', negev: 'the Negev', eilat: 'Eilat and the Arava' };
// "חיפה - כרמל", "אשדוד -יא,יב": a city's quarter is the city.
const city = (n) => C.cities[n] || C.cities[n.split(/\s+-\s*|\s*-\s+/)[0]] || null;
const rows = [];
for (const l of fs.readFileSync('oref/israel-alerts.csv', 'utf8').split('\n')) {
  const m = l.match(/^"?(.*?)"?,\d\d\.\d\d\.2026,[\d:]+,(2026-[\d-]+T[\d:]+),(\d+),(.*?),\d+,\d+$/);
  if (!m || m[2] < '2026-02-28') continue;
  for (const n of m[1].split(', ')) rows.push({ name: n, t: Date.parse(m[2] + '+02:00') /* fixed below */, iso: m[2], cat: +m[3], desc: m[4] });
}
// Israel time: +02:00 until 27 Mar 2026 02:00, +03:00 until 25 Oct.
for (const r of rows) r.t = Date.parse(r.iso + (r.iso < '2026-03-27T02:00' ? '+02:00' : '+03:00'));
rows.sort((a, b) => a.t - b.t);
const warn = rows.filter((r) => r.cat === 14);
const alerts = rows.filter((r) => r.cat === 1 || r.cat === 2);
// A salvo ends with a quiet of 5 minutes, or sooner when a place already alerted in it is warned or alerted
// again 3 minutes or more later, or after its "event over": that is the next launch (two salvos minutes apart
// are two attacks).
const salvos = [];
for (const kind of [1, 2]) {
  let cur = null;
  const ended = new Set();
  for (const r of rows) {
    if (r.cat === 13) { if (cur?.names.has(r.name)) ended.add(r.name); continue; }
    const again = cur && cur.names.has(r.name) && (ended.has(r.name) || r.t - cur.names.get(r.name) >= 3 * 60e3);
    if (r.cat === 14) { if (again) cur.split = true; continue; }
    if (r.cat !== kind) continue;
    if (!cur || r.t - cur.last > 5 * 60e3 || again || cur.split) { cur = { kind, start: r.t, last: r.t, names: new Map() }; salvos.push(cur); ended.clear(); }
    cur.last = r.t; if (!cur.names.has(r.name)) cur.names.set(r.name, r.t);
  }
}
const out = [];
for (const s of salvos) {
  const byReg = {};
  let unknown = 0;
  for (const [n, t] of s.names) { const c = city(n); if (!c) { unknown++; continue; } const g = REGION[c.area] || 'other'; (byReg[g] ||= []).push({ n, t, c }); }
  for (const [g, xs] of Object.entries(byReg)) {
    const lat = xs.reduce((a, x) => a + x.c.lat, 0) / xs.length, lng = xs.reduce((a, x) => a + x.c.lng, 0) / xs.length;
    const at = xs.reduce((a, x) => Math.min(a, x.t), Infinity);
    // The place named: the region's biggest-known city if alerted, else the alerted place nearest the centre.
    const pin = xs.reduce((a, x) => (Math.hypot(x.c.lat - lat, x.c.lng - lng) < Math.hypot(a.c.lat - lat, a.c.lng - lng) ? x : a));
    const names = new Set(xs.map((x) => x.n));
    // Warnings before it in the same places: Lebanon's ("איום מלבנון") or the long-range one ("בדקות הקרובות").
    const w = warn.filter((x) => x.t <= at && at - x.t < 20 * 60e3 && names.has(x.name));
    const lebWarn = w.some((x) => /לבנון/.test(x.desc)), longWarn = w.some((x) => /בדקות הקרובות/.test(x.desc));
    out.push({ kind: s.kind === 1 ? 'missile' : 'uav', region: g, regionEn: REGION_EN[g] || g, at: new Date(at).toISOString(), salvo: new Date(s.start).toISOString(), n: xs.length, place: pin.c.en, he: pin.n, lat: pin.c.lat, lng: pin.c.lng, sample: xs.slice(0, 6).map((x) => x.c.en), lebWarn, longWarn });
  }
}
fs.writeFileSync('oref/salvos.json', JSON.stringify(out));
const m = {};
for (const o of out) { const k = o.at.slice(0, 7) + ' ' + o.kind + ' ' + (o.lebWarn ? 'leb' : o.longWarn ? 'long' : ['north', 'galilee', 'haifa'].includes(o.region) ? 'short-north' : o.region === 'gaza' ? 'gaza' : 'short-other'); m[k] = (m[k] || 0) + 1; }
console.log(salvos.length, 'salvos', out.length, 'region pins', m);
