// The merge rules of 11 Oct, applied to the pins already on the map (src-merge.cjs only filters new reports).
// Each pin is judged by its lead post's text, from the readers' candidate file.
// - Hezbollah's claim on an Israeli post "opposite" a Lebanese village: the post is in Israel, no Lebanon pin.
// (The rule on launches "toward" a place is not swept: in a whole post the word is mostly forces advancing toward a town.)
// - Jordan's anti-smuggling raids: not the war.
// Usage: node sweep-rules.cjs <baseline.json> <src-cands.jsonl> [--dry]
const fs = require('fs');
const [BASE, CANDS] = process.argv.slice(2);
const text = new Map();
for (const l of fs.readFileSync(CANDS, 'utf8').split('\n')) if (l) { const c = JSON.parse(l); text.set(c.ref, c.text); for (const a of c.also) text.set(a, c.text); }
const countryAt = require('./country-at.cjs');
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const gone = {};
const keep = base.filter((p) => {
  const ref = (p.url.match(/t\.me\/(?:s\/)?([^?#]+)/) || [])[1];
  const t = `${(ref && text.get(ref)) || ''} ${p.label}`;
  const c = countryAt(p.lat, p.lng);
  const why =
    c === 'Lebanon' && /^Hezbollah says/.test(p.label) && /(?:موقع|مستعمرة|ثكنة)[^.،]{0,40}(?:مقابل|قبالة)|post opposite|روبروی/i.test(t) ? 'Hezbollah claim on a post in Israel'
    : c === 'Jordan' && /مخدر|تهريب|مهرب|smuggl|narcotic|drug/i.test(t) ? 'Jordan, an anti-smuggling raid'
    : null;
  if (why) (gone[why] ??= []).push(`${p.day} ${p.place} | ${p.label}`);
  return !why;
});
for (const [k, v] of Object.entries(gone)) console.log(k, v.length, '\n  ' + v.slice(0, 4).join('\n  '));
if (!process.argv.includes('--dry')) fs.writeFileSync(BASE, JSON.stringify(keep));
