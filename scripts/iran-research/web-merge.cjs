// Round 31 stage D: the user's research list (7 Oct: ISW, ACLED, Liveuamap, UKMTO, Windward, JINSA, CENTCOM, the
// IDF, Iran's state outlets, Al Jazeera, ISIS, Bellingcat...). Each site was read by a reader that saved every page
// it used as text (rs/web/<site>/<n>.txt, the URL on its first line) and wrote one event per place and day with a
// quote copied from that page. Here:
//   - grounded: the quote is in its saved page (whitespace aside), the place's words are in the quote;
//   - out: Israel, Gaza, Yemen, the Red Sea (the Yemen desk's), Saudi blasts of the Houthi front;
//   - the source is the site (Press TV, Nour News... by the page's host), the link the page.
// The events go to iran-research.mts, which places them (the page's own point when it gives one) and folds a
// report on a place pinned that day into that pin as its second source.
//   node web-merge.cjs <rs/web> <out.jsonl> <site>...
const fs = require('fs');
const path = require('path');
const [DIR, OUT, ...SITES] = process.argv.slice(2);
const HOST = { 'presstv.ir': 'Press TV', 'nournews.ir': 'Nour News', 'en.irna.ir': 'IRNA', 'irna.ir': 'IRNA', 'tasnimnews.com': 'Tasnim', 'tasnimnews.ir': 'Tasnim', 'en.mehrnews.com': 'Mehr', 'mehrnews.com': 'Mehr', 'isis-online.org': 'Institute for Science and International Security', 'bellingcat.com': 'Bellingcat', 'globalsecurity.org': 'GlobalSecurity', 'understandingwar.org': 'ISW', 'criticalthreats.org': 'ISW-CTP', 'acleddata.com': 'ACLED', 'liveuamap.com': 'Liveuamap', 'ukmto.org': 'UKMTO', 'windward.ai': 'Windward', 'jinsa.org': 'JINSA', 'centcom.mil': 'CENTCOM', 'defense.gov': 'US Department of Defense', 'idf.il': 'IDF', 'x.com': 'IDF', 'aljazeera.com': 'Al Jazeera', 'aljazeera.net': 'Al Jazeera', 'inss.org.il': 'INSS' };
const sourceOf = (url) => {
  const h = (String(url).replace(/^https?:\/\/(web\.archive\.org\/web\/\d+\w*\/)?(https?:\/\/)?/, '').split('/')[0] || '').replace(/^www\./, '');
  return HOST[h] || HOST[h.split('.').slice(-2).join('.')] || h;
};
// A Wayback copy links the page itself.
const pageUrl = (url) => String(url).replace(/^https?:\/\/web\.archive\.org\/web\/\d+\w*\//, '');
const GEN = { Iran: [32.4, 53.7], Iraq: [33.2, 43.7], Lebanon: [33.85, 35.86], Syria: [34.8, 38.99], Jordan: [31.25, 36.5], 'Saudi Arabia': [24, 45], 'United Arab Emirates': [23.9, 54.3], Qatar: [25.3, 51.2], Kuwait: [29.31, 47.48], Bahrain: [26.07, 50.55], Oman: [21.5, 57], Turkey: [39, 35], Azerbaijan: [40.3, 47.7], Cyprus: [35, 33.2], Egypt: [26.8, 30.8] };
const SEAS = [[/hormuz|هرمز/i, 'Strait of Hormuz', 26.55, 56.45], [/gulf of oman|خليج عمان|دریای عمان/i, 'Gulf of Oman', 24.9, 58.2], [/arabian sea|بحر العرب/i, 'Arabian Sea', 17.5, 60.5], [/gulf|الخليج|خلیج فارس/i, 'Persian Gulf', 27, 51.5]];
const CN = { UAE: 'United Arab Emirates', 'the UAE': 'United Arab Emirates', 'Iraqi Kurdistan': 'Iraq', Kurdistan: 'Iraq', Sea: 'sea', sea: 'sea', Maritime: 'sea' };
const OUTSIDE = /^(?:Israel|Gaza|Palestine|West Bank|Yemen|Sudan|Ukraine|Russia|Pakistan)$/i;
const RED_SEA = /red sea|bab al-?mandab|gulf of aden|البحر الأحمر|باب المندب|خليج عدن/i;
const HOUTHI_FRONT = /Abha|Asir|Jizan|Jazan|Najran|Khamis|Sharurah|Taif|Jeddah|Yanbu|Mecca|Makkah|Tabuk|Ula|Farasan/;
const ws = (s) => String(s || '').normalize('NFC').replace(/[​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
const w8 = (t) => { const m = /missile|صاروخ|موشک/i.test(t), d = /drone|مسير|پهپاد|UAV/i.test(t); return m && d ? 'missiles and drones' : m ? 'missiles' : d ? 'drones' : ''; };
const pages = new Map();
const page = (f) => { if (!pages.has(f)) { const p = path.join(DIR, f.replace(/\\/g, '/')); pages.set(f, fs.existsSync(p) ? ws(fs.readFileSync(p, 'utf8')) : null); } return pages.get(f); };
const out = new Map(), drop = {}, no = (k) => (drop[k] = (drop[k] || 0) + 1);
for (const site of SITES) for (const l of fs.readFileSync(path.join(DIR, `${site}-events.jsonl`), 'utf8').split('\n')) {
  if (!l.trim()) continue;
  let e; try { e = JSON.parse(l); } catch { no('bad line'); continue; }
  if (!/^2026-\d\d-\d\d$/.test(e.day || '') || e.day < '2026-02-28' || e.day > '2026-10-10') { no('no day'); continue; }
  const txt = e.file && page(e.file);
  if (!txt) { no('page not saved'); continue; }
  const quote = ws(e.quote);
  if (!quote || !txt.includes(quote)) { no('quote not in the page'); continue; }
  const country = CN[e.country] || e.country;
  if (!country || OUTSIDE.test(country) || RED_SEA.test(`${e.place} ${e.said}`)) { no('outside the map'); continue; }
  const gen = /place not stated/i.test(e.place || '') || !e.said;
  if (!gen && !quote.includes(ws(e.said))) { no('place not in the quote'); continue; }
  if (country === 'Saudi Arabia' && (e.actor || 'unclear') === 'unclear' && ['blast', 'sirens'].includes(e.kind) && (HOUTHI_FRONT.test(e.place || '') || e.day >= '2026-09-14')) { no('Saudi blast, the Houthi front'); continue; }
  const url = pageUrl(e.url || txt.split(' ')[0]);
  const source = sourceOf(url);
  let lat = Number.isFinite(+e.lat) && e.lat !== null && e.lat !== '' ? +e.lat : undefined, lng = lat != null ? +e.lng : undefined;
  let place = gen ? `${country === 'United Arab Emirates' ? 'the UAE' : country} (place not stated)` : String(e.place || e.said).replace(/\s*\(.*\)\s*$/, '');
  if (country === 'sea') { const s = SEAS.find(([re]) => re.test(`${e.place} ${e.said} ${quote}`)); if (!s && lat == null) { no('sea not named'); continue; } if (s) { place = s[1]; if (lat == null) [lat, lng] = [s[2], s[3]]; } }
  else if (gen) { if (!GEN[country]) { no('country not on the map'); continue; } [lat, lng] = GEN[country]; }
  const key = `${e.day}|${country}|${place.toLowerCase()}`;
  if (out.has(key)) { const o = out.get(key); if (o.source !== source && !o.also.some((a) => a.source === source) && o.also.length < 4) o.also.push({ source, url }); no('same place and day twice'); continue; }
  const actor = ['iran', 'iraqi_militias', 'unclear', 'us', 'israel', 'hezbollah', 'gulf'].includes(e.actor) ? e.actor : 'unclear';
  const say = `${source} reports`;
  const where = gen ? (country === 'United Arab Emirates' ? 'the UAE' : country) : country === 'sea' ? `the ${place}` : '{place}';
  const w = w8(quote), W = w ? w[0].toUpperCase() + w.slice(1) : '';
  const by = { israel: 'Israeli', us: 'US', iran: 'Iranian', iraqi_militias: "Iraqi factions'", hezbollah: 'Hezbollah', gulf: 'Gulf' }[actor];
  const from = actor === 'iran' ? ' from Iran' : actor === 'iraqi_militias' ? ', launched from Iraq,' : '';
  const label = e.claim
    ? `${{ iran: 'Iran says it', iraqi_militias: 'The Iraqi factions say they', hezbollah: 'Hezbollah says it', israel: 'Israel says it', us: 'The US says it' }[actor] || 'Its attackers say they'} struck ${where}${w ? ' with ' + w : ''}`
    : e.kind === 'sirens' ? `Sirens in ${where}, ${say}`
    : e.kind === 'blast' ? `Explosions heard in ${where}, ${say}`
    : e.kind === 'intercept' ? `${W ? W + from + ' intercepted' : 'Interceptions'} over ${where}, ${say}`
    : e.kind === 'debris' ? `Debris from ${w ? 'intercepted ' + w : 'an interception'}${from} falls on ${where}, ${say}`
    : e.kind === 'ship' ? `A ship attacked in ${where}, ${say}`
    : e.kind === 'clash' ? `Clashes at ${where}, ${say}`
    : e.kind === 'hit' ? `${W || 'An attack'}${from} hit ${where}, ${say}`
    : by && actor !== 'unclear' ? `${by} ${e.kind === 'strike' ? 'strike' : 'attack'} on ${where}, ${say}`
    : `Attack${from} on ${where}, ${say}`;
  const ev = { day: e.day, actor, country, label, source, url, text: quote, en: place, also: [] };
  if (lat != null && Number.isFinite(lat)) Object.assign(ev, { said: gen || country === 'sea' ? quote.slice(0, 40) : ws(e.said), lat, lng });
  else Object.assign(ev, { cands: [ws(e.said)].filter((n) => n && quote.includes(n)) });
  if (!ev.said && !ev.cands.length) { no('place not in the quote'); continue; }
  if (ev.said && !quote.includes(ev.said)) ev.said = quote.slice(0, 40);
  out.set(key, ev);
}
const L = [...out.values()];
fs.writeFileSync(OUT, L.map((e) => JSON.stringify(e)).join('\n') + '\n');
const by = {}; for (const e of L) by[e.source] = (by[e.source] || 0) + 1;
console.log(L.length, 'events', by, 'dropped', drop);
