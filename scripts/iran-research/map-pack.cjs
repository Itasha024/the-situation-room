// The map's pin files (user, 11 Oct: the map comes up as fast as it can), from the baseline:
// iran-map-pins.json, what drawing needs (day, side, point, time), small enough to come first;
// iran-map-notes.json, what a pin's note shows (place, label, source, link, its first three
// second sources), read right after. Row i of one is row i of the other. Runs before every build.
// Usage: node map-pack.cjs
const fs = require('fs');
const path = require('path');
const pub = path.join(__dirname, '..', '..', 'public');
const base = JSON.parse(fs.readFileSync(path.join(pub, 'iran-strikes-baseline.json'), 'utf8'));
const year = base[0] ? base[0].day.slice(0, 4) : '2026';
if (base.some((p) => p.day.slice(0, 4) !== year)) throw new Error('map-pack: pins from more than one year');
// Air defence fire, interceptions, sirens and blasts heard over Iran are not Iran's attacks (user, 12 Oct):
// with no attacker named they are "not stated". The same rule serves the live pins (iran-places.ts ownSkyOnly).
const DEFENCE = /intercept|air[- ]?defen[cs]e|shot down|shoots? down|downed|sirens?\b|explosions? (?:were |was )?(?:heard|reported)|blasts? heard|sounds? of explosions|red alert|anti-?aircraft|alert sounded/i;
const ATTACKER = /\b(?:Israel|Israeli|US|U\.S\.|American|CENTCOM|IDF|Mossad)\b/;
const IRAN = JSON.parse(fs.readFileSync(path.join(pub, 'iran-countries.geojson'), 'utf8')).features.find((f) => f.properties.name === 'Iran');
const ring = (r, x, y) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inIran = (lat, lng) => { const g = IRAN.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; return polys.some((p) => ring(p[0], lng, lat) && !p.slice(1).some((h) => ring(h, lng, lat))); };
let unstated = 0;
const actorOf = (p) => (p.actor === 'iran' && DEFENCE.test(p.label || '') && !ATTACKER.test(p.label || '') && inIran(p.lat, p.lng) ? (unstated++, 'unclear') : p.actor);
// At sea or on land, for the map's filter (user, 12 Oct): a ship, a boat or "off" a place is at sea; so is a
// point off the coast by more than 3 km (public/iran-land.json, from adm-pack.cjs). A coastal town's point
// can sit a little off the drawn coast; it stays on land. The page reads the live pins the same way (iranAtSea).
const LAND = JSON.parse(fs.readFileSync(path.join(pub, 'iran-land.json'), 'utf8')).polys;
const SEA_WORDS = /\b(?:ships?|vessels?|tankers?|freighters?|boats?|dhows?|frigates?|destroyers?|warships?|carriers?|submarines?|corvettes?|IRIS|USS|HMS|UKMTO|JMIC|at sea|offshore)\b/i;
const onLand = (lat, lng) => LAND.some((p) => lng >= p.b[0] && lng <= p.b[2] && lat >= p.b[1] && lat <= p.b[3] && ring(p.r[0], lng, lat) && !p.r.slice(1).some((h) => ring(h, lng, lat)));
function coastKm(lat, lng) {
  const k = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const p of LAND) {
    if (lng < p.b[0] - 0.1 || lng > p.b[2] + 0.1 || lat < p.b[1] - 0.1 || lat > p.b[3] + 0.1) continue;
    for (const r of p.r) for (let i = 1; i < r.length; i++) {
      const ax = (r[i - 1][0] - lng) * k, ay = r[i - 1][1] - lat, bx = (r[i][0] - lng) * k, by = r[i][1] - lat;
      const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy) * 111);
    }
  }
  return best;
}
const atSea = (p) => SEA_WORDS.test(String(p.label || '').replace(/anti-ship|KC-\d+\s+tankers?|tanker (?:aircraft|planes?)|refuel+ing tankers?/gi, '')) || /^off /i.test(p.place || '') || (!onLand(p.lat, p.lng) && coastKm(p.lat, p.lng) > 3);
let seaN = 0;
// [MM-DD, actor, lat, lng, HH:MM (UTC) or 0, 1 at sea or 0]
const pins = base.map((p) => [p.day.slice(5), actorOf(p), p.lat, p.lng, p.at ? new Date(p.at).toISOString().slice(11, 16) : 0, atSea(p) ? (seaN++, 1) : 0]);
// A note's words (user, 12 Oct): no ", X reports" (the source is linked under it), no "Its attackers
// say they struck", no "attack claim", and the country, not "Gulf", where it is known.
const GULF = { 'bf-2026-07-29-gulf-bartella': 'Saudi', 'rs-2026-07-29-gulf-kirkuk': 'Saudi', 'rs-2026-07-29-gulf-khalis-diyala': 'Saudi', 'rs-2026-07-29-gulf-amerli': 'Saudi', 'rs-2026-07-29-gulf-wasit': 'Saudi' };
const WITH = { drones: 'Drone strike', missiles: 'Missile strike', 'missiles and drones': 'Missile and drone strike', rockets: 'Rocket fire' };
function relabel(p) {
  let l = String(p.label || '').trim();
  l = l.replace(/,\s+[^,]{2,90}?\s+reports?$/i, '');
  l = l.replace(/\s+—\s+(?:attack )?claim$/i, '').replace(/\s+(?:area\s+)?strike report$/i, '');
  l = l.replace(/^Its attackers say they struck (.+?)(?: with (drones|missiles|missiles and drones|rockets))?$/, (m, x, w) => `${w ? WITH[w] : 'Strike'} on ${x}`);
  if (GULF[p.fp]) l = l.replace(/^Gulf strike/, `${GULF[p.fp]} strike`);
  else l = l.replace(/^Gulf strike on/, 'Strike on');
  // A country with no place named: "struck targets in Iraq", not "struck Iraq".
  const country = /^(.+?) \(place not stated\)$/.exec(p.place || '') || /\b(?:on|struck)\s+(?:the\s+)?([A-Z][\w ]+?) \(place not stated\)/.exec(l);
  if (country) l = l.replace(new RegExp(String.raw`\b(struck|strike on|attack on|attacks on)\s+(?:the\s+)?${country[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\b`), (m, v) => (v === 'struck' ? 'struck targets in ' : v.replace(/ on$/, ' in ')) + country[1]);
  // "heard at the airport", not "in" it.
  l = l.replace(/\b(heard|Sirens|Interceptions)\s+in\s+(?=[^,]*\b(?:base|school|airport|port|hospital|building|depot|refinery|camp|station|plant|facility|HQ|headquarters|barracks|complex|pier)\b)/gi, '$1 at ');
  return seaWords(l).replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}
// The sea in plain English (Stage C, 12 Oct): "attacked in Off the coast of Oman" is "attacked off the coast of
// Oman", "struck Gulf of Oman" is "struck a target in the Gulf of Oman", and a sea or strait takes "the".
const SEA = String.raw`(?:Strait of Hormuz|Gulf of Oman|Persian Gulf|Arabian Sea|Red Sea|Gulf of Aden|Arabian Gulf)`;
function seaWords(l) {
  return String(l || '')
    .replace(/\s+(?:in|at|on)\s+(?:the\s+)?off\b/gi, ' off')
    .replace(/\b(struck|hit|targeted)\s+off\b/gi, '$1 a target off')
    .replace(/\b(struck|hit|targeted)\s+near\b/gi, '$1 a target near')
    .replace(new RegExp(String.raw`\b(struck|hit|targeted)\s+(?:the\s+)?(${SEA}\s+coast)`, 'g'), '$1 the $2')
    .replace(new RegExp(String.raw`\b(struck|hit|targeted)\s+(?:the\s+)?((?:(?:northern|southern|eastern|western|central)\s+)?${SEA})(?!\s+coast)`, 'g'), '$1 a target in the $2')
    .replace(new RegExp(String.raw`\bfalls\s+on\s+(?:the\s+)?(${SEA})`, 'g'), 'falls into the $1')
    .replace(new RegExp(String.raw`\b(strikes?|attacks?)\s+on\s+(?:the\s+)?(${SEA})`, 'g'), '$1 in $2')
    .replace(new RegExp(String.raw`\b(in|over|near|across|into)\s+(${SEA})`, 'g'), '$1 the $2')
    .replace(/\s+(?:in|on|at)\s+(?:the\s+)?(\d+\s*(?:NM|nm|nautical miles?)\s)/g, ' $1')
    .replace(/\s+—\s+M\/[TV]\s+([^,—]+)/g, (m, n) => ` (${n.trim().replace(/\b(\w)(\w*)/g, (w, a, b) => a + b.toLowerCase())})`)
    .replace(/\s+—\s+(?:the\s+)?(.+?)\s+attack claim$/i, ' ($1)')
    .replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').replace(/[.,]\s*$/, '').trim();
}
const notes = base.map((p) => [p.fp, seaWords(p.place).replace(/^the /, ''), relabel(p), p.source, p.url, (p.also || []).slice(0, 3).map((a) => [a.source, a.url])]);
fs.writeFileSync(path.join(pub, 'iran-map-pins.json'), JSON.stringify({ year, n: pins.length, pins }));
fs.writeFileSync(path.join(pub, 'iran-map-notes.json'), JSON.stringify({ n: notes.length, notes }));
console.log('[map-pack]', pins.length, 'pins,', seaN, 'at sea;', unstated, "of Iran's own air defence and alarms shown as not stated");
