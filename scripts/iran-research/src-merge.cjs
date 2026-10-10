// Round 31, the source-by-source pass (user, 10 Oct: "look for more events going source by source and in each source
// country by country... wide and deep research for every country in every source"). Every post of every channel
// with a word of war in any language was read, with no country or place asked first (src-cands.jsonl, batches by
// channel); each reading names the place as the post writes it ("said") and in English. Here they become hand
// events for iran-research.mts, which finds the place in its gazetteers (Lebanon's OSM villages, Nominatim), never
// a reader's guess of coordinates:
//   - grounded: the quote is in the post, the place's words are in the quote, the refs are candidates;
//   - one place a day: the same place and day read in two batches is one event, the other posts its sources;
//   - out: Israel (its alerts are the Home Front Command's), Gaza, Yemen, Saudi blasts of the Houthi front.
//   node src-merge.cjs <src-cands.jsonl> <out.jsonl> <readings...>
const fs = require('fs');
const [CANDS, OUT, ...EVF] = process.argv.slice(2);
const SRC = {
  AlHadath_Brk: 'Al Hadath', ajanews: 'Al Jazeera', AlArabiya: 'Al Arabiya', almayadeen: 'Al Mayadeen', petranews: 'Petra',
  naya_foriraq: 'Naya', SabrenNewss: 'Sabereen', Alomhoar: 'Al-Mihwar', Alibk3: 'Ali Bk', farsna: 'Fars', irna_1313: 'IRNA',
  akhbarefori: 'Akhbar-e Fori', iranintltv: 'Iran International', VahidOnline: 'Vahid Online', iliaen: 'Ilia', N12chat: 'N12',
  hazfon1: 'Hazfon', israel1: 'Israel1', Jfranews: 'Jfra News', CENTCOM: 'CENTCOM', NNA_Leb: 'NNA', almanarnews: 'Al-Manar',
  IDFSpokespersonArabic: 'IDF Arabic spokesman', idfinfarsi: 'IDF in Persian', alichoeib1970: 'Ali Shoaib', elamharbi: 'Islamic Resistance in Iraq',
  K24Arabic: 'Kurdistan 24', rudawarabic: 'Rudaw', baghdadtoday: 'Baghdad Today',
  KuwaitArmyGHQ: 'Kuwait Army General Staff', modgovksa: 'Saudi Ministry of Defence', MOD_Qatar: 'Qatar Ministry of Defence',
  BDF_Bahrain: 'Bahrain Defence Force', modgovae: 'UAE Ministry of Defence', DXBMediaOffice: 'Dubai Media Office',
  ADMediaOffice: 'Abu Dhabi Media Office', sharjahmedia: 'Sharjah Media Office', RAKMediaOffice: 'Ras Al Khaimah Media Office', ajmanmedia: 'Ajman Media Office',
};
const OWN = { modgovksa: 'Saudi Arabia', KuwaitArmyGHQ: 'Kuwait', MOD_Qatar: 'Qatar', BDF_Bahrain: 'Bahrain', modgovae: 'United Arab Emirates', DXBMediaOffice: 'United Arab Emirates', ADMediaOffice: 'United Arab Emirates', sharjahmedia: 'United Arab Emirates', RAKMediaOffice: 'United Arab Emirates', ajmanmedia: 'United Arab Emirates', petranews: 'Jordan', CENTCOM: '' };
// The country in general, and the seas, by their points.
const GEN = { Iran: [32.4, 53.7], Iraq: [33.2, 43.7], Lebanon: [33.85, 35.86], Syria: [34.8, 38.99], Jordan: [31.25, 36.5], 'Saudi Arabia': [24, 45], 'United Arab Emirates': [23.9, 54.3], Qatar: [25.3, 51.2], Kuwait: [29.31, 47.48], Bahrain: [26.07, 50.55], Oman: [21.5, 57], Turkey: [39, 35], Azerbaijan: [40.3, 47.7], Cyprus: [35, 33.2], Egypt: [26.8, 30.8] };
const SEAS = [[/hormuz|هرمز/i, 'Strait of Hormuz', 26.55, 56.45], [/gulf of oman|خليج عمان|دریای عمان/i, 'Gulf of Oman', 24.9, 58.2], [/arabian sea|بحر العرب/i, 'Arabian Sea', 17.5, 60.5], [/indian ocean/i, 'Indian Ocean', 5.6, 80.2], [/gulf|الخليج|خلیج فارس/i, 'Persian Gulf', 27, 51.5]];
const CN = { UAE: 'United Arab Emirates', 'the UAE': 'United Arab Emirates', 'Iraqi Kurdistan': 'Iraq', Kurdistan: 'Iraq', Sea: 'sea', sea: 'sea' };
const OUTSIDE = /^(?:Israel|Gaza|Palestine|West Bank|Yemen|Sudan|Ukraine|Russia)$/i;
const HOUTHI_FRONT = /Abha|Asir|Jizan|Jazan|Najran|Khamis|Sharurah|Taif|Jeddah|Yanbu|Mecca|Makkah|Tabuk|Ula|Farasan/;
const norm = (s) => String(s || '').normalize('NFC').replace(/[ً-ْـ​-‏‪-‮⁦-⁩]/g, '').replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim();
const cand = new Map();
for (const l of fs.readFileSync(CANDS, 'utf8').split('\n')) if (l) { const c = JSON.parse(l); cand.set(c.ref, c); for (const a of c.also) cand.set(a, { ...c, ref: a, url: 'https://t.me/' + a }); }
const w8 = (t) => { const m = /صاروخ|صواريخ|باليستي|موشک|טיל|missile/i.test(t), d = /مسير|مسيّر|پهپاد|כטב"ם|drone/i.test(t); return m && d ? 'missiles and drones' : m ? 'missiles' : d ? 'drones' : ''; };
const out = new Map(), drop = {}, no = (k) => (drop[k] = (drop[k] || 0) + 1);
for (const f of EVF) for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
  if (!l.trim()) continue;
  let e; try { e = JSON.parse(l); } catch { no('bad line'); continue; }
  const refs = (e.refs || []).filter((r) => cand.has(r));
  if (!refs.length || !/^2026-\d\d-\d\d$/.test(e.day || '')) { no('no candidate ref or day'); continue; }
  const k = refs.findIndex((r) => e.quote && norm(cand.get(r).text).includes(norm(e.quote)));
  if (k < 0) { no('quote not in the post'); continue; }
  refs.unshift(...refs.splice(k, 1));
  const country = CN[e.country] || e.country;
  if (!country || OUTSIDE.test(country)) { no('outside the map'); continue; }
  const gen = /place not stated/i.test(e.place || '') || !e.said;
  if (!gen && !norm(e.quote).includes(norm(e.said))) { no('place not in the quote'); continue; }
  if (country === 'Saudi Arabia' && (e.actor || 'unclear') === 'unclear' && ['blast', 'sirens'].includes(e.kind) && (HOUTHI_FRONT.test(e.place || '') || e.day >= '2026-09-14')) { no('Saudi blast, the Houthi front'); continue; }
  const lead = cand.get(refs[0]);
  const ch = refs[0].split('/')[0];
  const source = SRC[ch] || ch;
  let lat, lng, place = gen ? `${country === 'United Arab Emirates' ? 'the UAE' : country} (place not stated)` : String(e.place || e.said).replace(/\s*\(.*\)\s*$/, '');
  if (country === 'sea') { const s = SEAS.find(([re]) => re.test(`${e.place} ${e.said}`)); if (!s) { no('sea not named'); continue; } [, place, lat, lng] = s; }
  else if (gen) { if (!GEN[country]) { no('country not on the map'); continue; } [lat, lng] = GEN[country]; }
  const key = `${e.day}|${country}|${norm(place).toLowerCase()}`;
  const also = refs.slice(1).map((r) => ({ source: SRC[r.split('/')[0]] || r.split('/')[0], url: cand.get(r).url }));
  if (out.has(key)) { const o = out.get(key); for (const a of [{ source, url: lead.url }, ...also]) if (a.source !== o.source && !o.also.some((b) => b.source === a.source) && o.also.length < 4) o.also.push(a); no('same place and day twice'); continue; }
  const actor = ['iran', 'iraqi_militias', 'unclear', 'us', 'israel', 'hezbollah', 'gulf'].includes(e.actor) ? e.actor : 'unclear';
  const official = OWN[ch] === country;
  const say = official ? `${country === 'United Arab Emirates' ? 'the UAE' : country} says`.replace(/^t/, 'T') : `${source} reports`;
  const where = gen ? (country === 'United Arab Emirates' ? 'the UAE' : country) : '{place}';
  const w = w8(`${e.quote} ${lead.text.slice(0, 200)}`), W = w ? w[0].toUpperCase() + w.slice(1) : '';
  const by = { israel: 'Israeli', us: 'US', iran: 'Iranian', iraqi_militias: 'Iraqi factions\'', hezbollah: 'Hezbollah', gulf: 'Gulf' }[actor];
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
  const ev = { day: e.day, actor, country, label, source, url: lead.url, text: lead.text, en: place, also: also.filter((a, i, A) => a.source !== source && A.findIndex((b) => b.source === a.source) === i).slice(0, 4) };
  if (lat != null) Object.assign(ev, { said: e.quote, lat, lng });
  else Object.assign(ev, { said: undefined, cands: [e.said, place].filter((n) => n && lead.text.includes(n)).concat(lead.text.includes(e.said) ? [] : []) });
  if (!ev.said && !(ev.cands || []).length) { no('place not in the post'); continue; }
  out.set(key, ev);
}
const L = [...out.values()];
fs.writeFileSync(OUT, L.map((e) => JSON.stringify(e)).join('\n') + '\n');
const by = {}; for (const e of L) by[e.country] = (by[e.country] || 0) + 1;
console.log(L.length, 'events', by, 'dropped', drop);
