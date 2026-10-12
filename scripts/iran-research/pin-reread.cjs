// The riskiest pins read again against their posts (user, 12 Oct): the 1,053 whose side was first "not
// stated" (their fp says unclear) and was set later from another report. Readers wrote one line per pin:
// fp, side, named, place_ok, event_ok, seen, fix_place, fix_note. Run once on the baseline:
//   node pin-reread.cjs <dir with in-*.jsonl and out-*.jsonl> <GeoNames dir> [--dry]
// - The side is the one the posts give; a pin whose posts could not be read keeps its side.
// - Not an event (a statement, footage, a denial): out.
// - A note the reader rewrote to say what the post says goes in.
// - A place the posts do not name moves to the one they do, when it is found (other pins' point on that
//   place, else GeoNames); else it stays and is listed.
const fs = require('fs');
const path = require('path');
const [dir, gnDir] = process.argv.slice(2);
const dry = process.argv.includes('--dry');
const pub = path.join(__dirname, '..', '..', 'public');
const file = path.join(pub, 'iran-strikes-baseline.json');
const base = JSON.parse(fs.readFileSync(file, 'utf8'));
const SIDES = new Set(['iran', 'israel', 'us', 'iraqi_militias', 'hezbollah', 'houthi', 'gulf', 'unclear']);

// One pin's reading, by fp, url and day (ten fps are on two pins).
const key = (p) => `${p.fp}|${p.url}|${p.day}`;
const read = new Map();
for (let k = 0; fs.existsSync(path.join(dir, `in-${k}.jsonl`)); k++) {
  const ins = fs.readFileSync(path.join(dir, `in-${k}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const outs = fs.readFileSync(path.join(dir, `out-${k}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  ins.forEach((p, i) => { if (outs[i] && outs[i].fp === p.fp) read.set(key(p), outs[i]); else throw new Error(`out-${k} line ${i + 1} is not ${p.fp}`); });
}

// Where a place is: the point most pins on it share, else GeoNames (a town, a base, an airport).
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(?:near|off|the)\s+/, '').trim();
const town = new Map();
for (const p of base) { const k = norm(p.place); const m = town.get(k) || new Map(); const at = `${p.lat},${p.lng}`; m.set(at, (m.get(at) || 0) + 1); town.set(k, m); }
const fromPins = (name) => { const m = town.get(norm(name)); return m ? [...m].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number) : null; };
const gn = new Map();
if (gnDir) for (const f of fs.readdirSync(gnDir).filter((f) => /^[A-Z]{2}\.txt$/.test(f))) {
  for (const line of fs.readFileSync(path.join(gnDir, f), 'utf8').split('\n')) {
    const c = line.split('\t');
    if (c.length < 15 || !/^(?:P|S)$/.test(c[6]) || !/^(?:PPL\w*|AIRB|AIRP|MILB|PRT)$/.test(c[7])) continue;
    const pop = Number(c[14]) || 0;
    for (const n of [c[1], c[2]]) { const k = norm(n); const had = gn.get(k); if (!had || pop > had.pop) gn.set(k, { lat: +c[4], lng: +c[5], pop }); }
  }
}
const SEA_AT = { 'strait of hormuz': [26.5667, 56.25], 'gulf of oman': [24.5, 58.5], 'persian gulf': [27, 51.5], 'central gulf waters': [27, 51.5] };
// The places the readers named that neither the pins nor GeoNames hold (OpenStreetMap).
const HAND = {
  'jebel ali port': [25.011, 55.061], 'al-saqr camp, south baghdad': [33.2405, 44.3936], 'rafic hariri airport, beirut': [33.8209, 35.4884],
  "bapco refinery, ma'ameer": [26.1386, 50.6203], 'kamal shahr, alborz': [35.8656, 50.8711], 'kurdish opposition camp near erbil': [36.1911, 44.0094],
  'al-amiya oil terminal, off al-faw': [29.7833, 48.8167],
  // Too vague to move a pin to: the pin keeps its point.
  'us base, jordan': null,
};
function where(name) {
  const first = String(name).split(',')[0].trim();
  if (norm(name) in HAND) return HAND[norm(name)];
  for (const n of [name, first]) {
    const s = SEA_AT[norm(n)]; if (s) return s;
    const p = fromPins(n); if (p) return p;
    const g = gn.get(norm(n)); if (g) return [g.lat, g.lng];
  }
  return null;
}

const n = { side: 0, note: 0, out: 0, moved: 0, kept: 0, blocked: 0 };
const unplaced = [];
const out = [];
for (const p of base) {
  const r = read.get(key(p));
  if (!r) { out.push(p); continue; }
  if (r.event_ok === false) { n.out++; continue; }
  if (r.seen && r.seen !== 'ok') { n.blocked++; out.push(p); continue; }
  const q = { ...p };
  if (SIDES.has(r.side) && r.side !== p.actor) { q.actor = r.side; n.side++; }
  if (r.fix_note && String(r.fix_note).trim()) { q.label = String(r.fix_note).trim(); n.note++; }
  if (r.place_ok === false && r.fix_place) {
    let at = where(r.fix_place);
    // A sea named for a point already in it: the point stands (it is more exact than the sea's middle).
    const sea = SEA_AT[norm(String(r.fix_place).split(',')[0])];
    if (sea && Math.hypot(p.lat - sea[0], (p.lng - sea[1]) * Math.cos((p.lat * Math.PI) / 180)) * 111 < 300) at = [p.lat, p.lng];
    if (at) { Object.assign(q, { place: r.fix_place, lat: at[0], lng: at[1] }); n.moved++; if (process.env.DBG) console.log("[move]", p.place, [p.lat, p.lng], "->", r.fix_place, at); }
    else { n.kept++; unplaced.push(`${p.fp}: ${p.place} -> ${r.fix_place}`); }
  }
  out.push(q);
}
console.log('[pin-reread]', read.size, 'readings;', n, 'pins', base.length, '->', out.length);
if (unplaced.length) console.log('not found, place kept:\n  ' + unplaced.join('\n  '));
if (!dry) fs.writeFileSync(file, JSON.stringify(out));
