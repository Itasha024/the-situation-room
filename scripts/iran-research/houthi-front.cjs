// The Houthi war is the Yemen desk's map (user, 11 Oct). Two general rules on the Iran map's pins:
// 1. Saudi places a geocoder put near Yemen (Al-Jawf, the Eastern Province, Prince Sultan Air Base, Shaybah, the
//    East-West pipeline) go back to where they are; a Saudi report naming no place goes at the country's middle,
//    and only on a day with no other Saudi pin.
// 2. Nothing south of 20.3°N (Taif is the Iran war's) between the Red Sea and Oman: southern Saudi Arabia (Jizan, Najran, Asir), Yemen,
//    the southern Red Sea, Bab al-Mandab and the Gulf of Aden. The Houthis' launches at Israel stay (user, 9 Oct).
// Usage: node houthi-front.cjs <baseline.json> [--dry]
const fs = require('fs');
const countryAt = require('./country-at.cjs');
const BASE = process.argv[2];
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const MIDDLE = [24, 45];
const MOVE = [
  [/^Al-J(?:aw|ou)f\b/i, (p) => p.lat < 25, [29.97, 40.2]],
  [/^Eastern Province/i, (p) => p.lat < 24, [26.3, 49.9]],
  [/^Prince Sultan Air Base/i, (p) => Math.abs(p.lat - 24.06) > 0.3 || Math.abs(p.lng - 47.58) > 0.5, [24.06, 47.58]],
  [/^Shaybah/i, (p) => p.lng < 50, [22.51, 53.97]],
  [/East-West oil pipeline/i, (p) => p.lat < 20, [24.3, 42.0]],
  [/^Riyadh Province$/i, (p) => p.lat > 25.5, [24.6, 45.5]],
  [/^Aramco site$|^Aramco oil facilities, Saudi Arabia$/i, () => true, MIDDLE],
];
const moved = [];
for (const p of base) for (const [re, bad, to] of MOVE) if (re.test(p.place) && countryAt(p.lat, p.lng) === 'Saudi Arabia' && bad(p)) {
  moved.push(`${p.day} ${p.place} ${p.lat},${p.lng} -> ${to}`); [p.lat, p.lng] = to; break;
}
const saudiDays = new Set(base.filter((p) => countryAt(p.lat, p.lng) === 'Saudi Arabia' && !(p.lat === MIDDLE[0] && p.lng === MIDDLE[1])).map((p) => p.day));
const gone = {};
const keep = base.filter((p) => {
  const why = p.lat < 20.3 && p.lng > 32 && p.lng < 52 ? 'the Houthi front (the Yemen desk)'
    : p.lat === MIDDLE[0] && p.lng === MIDDLE[1] && saudiDays.has(p.day) ? 'Saudi Arabia in general, a day with places'
    : null;
  if (why) (gone[why] ??= []).push(`${p.day} ${p.actor} ${p.place} | ${p.label.slice(0, 80)}`);
  return !why;
});
console.log('moved', moved.length, '\n  ' + moved.join('\n  '));
for (const [k, v] of Object.entries(gone)) console.log(k, v.length, '\n  ' + v.join('\n  '));
console.log(base.length, '->', keep.length);
if (!process.argv.includes('--dry')) fs.writeFileSync(BASE, JSON.stringify(keep));
