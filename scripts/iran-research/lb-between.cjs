// One strike between two villages is one attack (user, 10 Oct: "make sure each is a separate event"). A report of
// "غارة بين بلدتي فرون والغندورية" (a strike between Froun and Ghanduriyah), or of one strike, shelling or drone
// strike on "the outskirts of the two villages", was read as two places and pinned twice. Here the second pin of
// that report folds into the first, which is labelled "between A and B". Strikes in the plural on two villages
// ("غارات على بلدتي X وY", "بغارتين") stay two. A folded pin that another report also holds stays, that report's.
//   node lb-between.cjs <baseline> <osm-lb.json> <event files...>
const fs = require('fs');
const [BASEF, GAZF, ...EVF] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(BASEF, 'utf8'));
const norm = (s) => s.normalize('NFC').replace(/[ً-ْـ​-‏]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة(?=\s|$)/g, 'ه').replace(/\s+/g, '');
const gaz = new Map();
for (const e of JSON.parse(fs.readFileSync(GAZF, 'utf8')).elements)
  for (const n of [e.tags['name:ar'], e.tags.name, e.tags.alt_name, e.tags['alt_name:ar'], e.tags.old_name].filter(Boolean).flatMap((x) => x.split(';'))) {
    const k = norm(n);
    if (!gaz.has(k) || e.lat < gaz.get(k).lat) gaz.set(k, { lat: e.lat, lng: e.lon });
  }
const geo = (w) => gaz.get(norm(w)) || gaz.get(norm(w.replace(/^ال/, ''))) || gaz.get(norm('ال' + w));
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const text = new Map();
for (const f of EVF) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { if (!l) continue; try { const e = JSON.parse(l); if (e.url && e.text) text.set(e.url, e.head || e.text); } catch {} }

// The pair: "بين (بلدتي) A وB", or one strike's "(أطراف|محيط|خراج) بلدتي A وB". A name is one to three words.
const W = String.raw`([^\s،,.]+(?:\s+[^\s،,.و][^\s،,.]*){0,2}?)`;
const BETWEEN = new RegExp(String.raw`(?:المنطقة الواقعة |المنطقة |الوادي |منطقة )?بين\s+(?:بلدتي\s+|بلدات\s+|بلدة\s+)?` + W + String.raw`\s+و(?:بلدة\s+)?` + W + String.raw`(?=[\s،,.]|$)`, 'g');
const TWO = new RegExp(String.raw`(?:أطراف|اطراف|محيط|خراج)\s+بلدتي\s+` + W + String.raw`\s+و` + W + String.raw`(?=[\s،,.]|$)`, 'g');
const PLURAL = /غارات|غارتين|غارتان|بغارتين|قذائف|ضربات|استهدافات|اعتداءات|ملخص/;

const byUrl = new Map();
const alsoOf = new Map();
for (const p of base) if (/, Lebanon$/.test(p.label)) {
  byUrl.set(p.url, [...(byUrl.get(p.url) || []), p]);
  for (const a of p.also) alsoOf.set(a.url, [...(alsoOf.get(a.url) || []), p]);
}
const drop = new Set();
let folded = 0, kept = 0;
const ex = [];
for (const [url, pins] of byUrl) {
  // The report's second place may be a pin of its own or another report's pin that holds it as a second source.
  const held = alsoOf.get(url) || [];
  if (pins.length + held.length < 2) continue;
  const t = text.get(url);
  if (!t) continue;
  const pairs = [...t.matchAll(BETWEEN)].map((m) => [m[1], m[2]]);
  if (!PLURAL.test(t)) pairs.push(...[...t.matchAll(TWO)].map((m) => [m[1], m[2]]));
  for (const [a0, b0] of pairs) {
    // The longest name the gazetteer knows, from the start of each side ("برج رحال والعباسية" is Burj Rahhal).
    const known = (s) => { const w = s.split(/\s+/); for (let n = w.length; n >= 1; n--) { const g = geo(w.slice(0, n).join(' ')); if (g) return g; } return null; };
    const ga = known(a0), gb = known(b0);
    if (!ga || !gb) continue;
    const A = pins.find((p) => !drop.has(p) && km(p, ga) < 0.6), B = [...pins, ...held].find((p) => !drop.has(p) && p !== A && km(p, gb) < 0.6);
    if (!A || !B) continue;
    A.label = A.label.replace(/ (?:on|of) (.+), Lebanon$/, ` between $1 and ${B.place}, Lebanon`);
    if (B.url !== url) { B.also = B.also.filter((x) => x.url !== url); kept++; }
    else if (B.also.length) {
      // Another report holds B's place that day: it stays, that report's pin.
      const [first, ...rest] = B.also;
      Object.assign(B, { source: first.source, url: first.url, also: rest });
      kept++;
    } else { drop.add(B); folded++; }
    if (ex.length < 12) ex.push(`${A.day} ${A.label} | ${t.slice(0, 90)}`);
  }
}
const out = base.filter((p) => !drop.has(p));
fs.writeFileSync(BASEF, JSON.stringify(out));
console.log('folded', folded, 'kept as another report\'s', kept, 'pins', base.length, '->', out.length);
console.log(ex.join('\n'));
