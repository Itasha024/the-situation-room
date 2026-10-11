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
// [MM-DD, actor, lat, lng, HH:MM (UTC) or 0]
const pins = base.map((p) => [p.day.slice(5), p.actor, p.lat, p.lng, p.at ? new Date(p.at).toISOString().slice(11, 16) : 0]);
const notes = base.map((p) => [p.fp, p.place, p.label, p.source, p.url, (p.also || []).slice(0, 3).map((a) => [a.source, a.url])]);
fs.writeFileSync(path.join(pub, 'iran-map-pins.json'), JSON.stringify({ year, n: pins.length, pins }));
fs.writeFileSync(path.join(pub, 'iran-map-notes.json'), JSON.stringify({ n: notes.length, notes }));
console.log('[map-pack]', pins.length, 'pins');
