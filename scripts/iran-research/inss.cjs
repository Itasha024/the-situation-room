// Round 31 stage D (user, 10 Oct: "very important - all the sources i gave you just for the research (inss etc)"):
// INSS's war maps are public ArcGIS layers (GISINSS FeatureServer), each row a dated, placed attack with its point:
//   - IDF_US_Strikes_2026: the Israeli and US strikes in Iran, 28 Feb – spring (Israel's colour: joint strikes are
//     Israel's unless the US alone is named);
//   - IDF_Strikes_in_Iran_June_2026: its attacker named;
//   - Iran_Conflict_Verified_Map_Inputs: Iran's and the US's attacks in the Gulf, Jordan, Iraq, at sea, in Iran;
//   - Lebanon_Conflict_Verified_Map_Inputs: Israel's strikes in Lebanon, and the attacks on its troops there.
// Rows are hand events for iran-research.mts with INSS's own point. Out: Israel, Yemen, Pakistan; demolitions and
// stun grenades (no strike); rows before 28 Feb.
//   node inss.cjs <rs/web/inss> <out.jsonl>
const fs = require('fs');
const path = require('path');
const countryAt = require('./country-at.cjs');
const [DIR, OUT] = process.argv.slice(2);
const URL = 'https://www.inss.org.il/publication/lions-roar-map/';
const rows = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).map((x) => ({ ...x.attributes, x: x.geometry && x.geometry.x, y: x.geometry && x.geometry.y }));
const out = [], drop = {}, no = (k) => (drop[k] = (drop[k] || 0) + 1);
const SEA = (lat, lng) => (lng > 55.6 && lat > 25.6 && lat < 27.2 ? 'Strait of Hormuz' : lng > 56.5 && lat < 25.6 ? 'Gulf of Oman' : lat < 22.5 ? 'Arabian Sea' : 'Persian Gulf');
const NOSTRIKE = /demoli|bulldoz|stun grenade|sound bomb|flare|leaflet/i;
const short = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
function push(r, actor, kind, place, extra) {
  if (!r.Date || r.Date < '2026-02-28') return no('before 28 Feb');
  const lat = +(r.Latitude ?? r.latitude ?? r.y), lng = +(r.Longitude ?? r.longitude ?? r.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return no('no point');
  let country = countryAt(lat, lng);
  if (/^(Israel|Yemen|Pakistan|Palestine)$/.test(country || '') || /^(Israel|Yemen)/.test(r.Country || '') && !/Maritime/.test(r.Country || '')) return no('outside the map');
  let en = short(place);
  // A coast the coarse borders miss: the row's own country when it names one alone, else the sea.
  const named = String(r.Country || '').replace('UAE', 'United Arab Emirates');
  if (!country && /^(Iran|Iraq|Lebanon|Syria|Jordan|Kuwait|Bahrain|Qatar|Oman|Saudi Arabia|United Arab Emirates)$/.test(named)) country = named;
  if (!country) { if (!/Maritime|Oman|Gulf|Hormuz/i.test(`${r.Country} ${r.Location}`)) return no('no country'); country = 'sea'; en = SEA(lat, lng); }
  if (NOSTRIKE.test(`${r.Comments || ''} ${r.Notes || ''}`)) return no('no strike (demolition, stun grenade)');
  const by = { israel: 'Israeli', us: 'US', iran: 'Iranian', hezbollah: 'Hezbollah', joint: 'Israeli and US' }[actor];
  const where = country === 'sea' ? `the ${en}` : en;
  const label = kind === 'ship' ? `A ship attacked in the ${en}, INSS reports`
    : kind === 'intercept' ? `Interceptions over ${where}, INSS reports`
    : `${by} ${kind === 'strike' ? 'strike' : 'attack'} on ${where}, INSS reports`;
  const text = [r.Date, r.Location, r.TargetedSite, r.Target, r.Comments || r.Notes || r.BDA].filter(Boolean).join(' | ');
  out.push({ day: r.Date, actor: actor === 'joint' ? 'israel' : actor, said: short(r.Location) || en, country: country === 'sea' ? 'sea' : country, label, source: 'INSS', url: URL, text: text.includes(short(r.Location)) ? text : `${text} | ${en}`, en, lat: +lat.toFixed(4), lng: +lng.toFixed(4), also: [], ...extra });
}
for (const r of rows('layer-IDF_US_Strikes_2026.json')) push(r, 'joint', 'strike', r.TargetedSite && r.TargetedSite !== 'Unknown' ? `${r.TargetedSite}` : r.Location);
for (const r of rows('layer-IDF_Strikes_in_Iran_June_2026.json')) push(r, /US|United States|American/.test(r.Attacker) && !/Israel/.test(r.Attacker) ? 'us' : 'israel', 'strike', r.Location.split(/\s[–-]\s/)[0]);
for (const r of rows('layer-Iran_Conflict_Verified_Map_Inputs_As_of_2026_09_02.json')) {
  const c = r.Comments || '';
  const actor = /IRAN/.test(r.Striking_Actor) ? 'iran' : /\bIsrael/.test(c) && !/\bU\.?S\.|United States|American|CENTCOM/.test(c) ? 'israel' : 'us';
  const kind = /\b(tanker|vessel|ship|cargo|dhow)\b/i.test(c) && /Maritime/.test(r.Country) ? 'ship' : /\bintercept/i.test(c) && actor === 'iran' ? 'intercept' : actor === 'iran' ? 'attack' : 'strike';
  push(r, actor, kind, r.Location);
}
for (const r of rows('layer-Lebanon_Conflict_Verified_Map_Inputs_As_of_2026_09_07_2.json')) {
  if (r.Country !== 'Lebanon') { no('outside the map'); continue; }
  push(r, /ISRAEL/.test(r.Striking_Actor) ? 'israel' : 'hezbollah', /ISRAEL/.test(r.Striking_Actor) ? 'strike' : 'attack', r.Location);
}
fs.writeFileSync(OUT, out.map((e) => JSON.stringify(e)).join('\n') + '\n');
const by = {}; for (const e of out) by[e.country] = (by[e.country] || 0) + 1;
console.log(out.length, 'events', by, 'dropped', drop);
