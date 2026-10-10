// Round 31, the reading method (user, 10 Oct: "search by words is not very smart... make more methods and use them
// all"). Beside the word readers, every post that names a country or its places and any word of war is a
// candidate (cands.cjs), and the candidates are read, post by post, by me (Claude readers, not the site's quota):
// each physical attack in the country, a place a day, with the posts that tell it and a quote copied from the
// first. This turns those readings into hand events for iran-research.mts:
//   - grounded: the quote must be in the post's own text, the refs must be candidates; else the event is dropped;
//   - a reading on a place pinned that day nearby (5 km, 40 for a city, any pin of the country that day for the
//     country in general) takes that pin's point, so the merge makes it a second source, not a new pin;
//   - its label is the map's: what happened, where, from whom, and who says it.
//   node read-merge.cjs <country> <cands.jsonl> <baseline> <out.jsonl> <events.jsonl...>
const fs = require('fs');
const countryAt = require('./country-at.cjs');
const [COUNTRY, CANDS, BASEF, OUT, ...EVF] = process.argv.slice(2);
const SRC = {
  AlHadath_Brk: 'Al Hadath', ajanews: 'Al Jazeera', AlArabiya: 'Al Arabiya', almayadeen: 'Al Mayadeen', petranews: 'Petra',
  naya_foriraq: 'Naya', SabrenNewss: 'Sabereen', Alomhoar: 'Al-Mihwar', Alibk3: 'Ali Bk', farsna: 'Fars', irna_1313: 'IRNA',
  akhbarefori: 'Akhbar-e Fori', iranintltv: 'Iran International', VahidOnline: 'Vahid Online', iliaen: 'Ilia', N12chat: 'N12',
  hazfon1: 'Hazfon', israel1: 'Israel1', Jfranews: 'Jfra News', royatv: 'Roya TV', CENTCOM: 'CENTCOM', NNA_Leb: 'NNA',
  almanarnews: 'Al-Manar', IDFSpokespersonArabic: 'IDF Arabic spokesman', muqawama_iraq: 'Islamic Resistance in Iraq',
  KuwaitArmyGHQ: 'Kuwait Army General Staff', modgovksa: 'Saudi Ministry of Defence', MOD_Qatar: 'Qatar Ministry of Defence',
  BDF_Bahrain: 'Bahrain Defence Force', modgovae: 'UAE Ministry of Defence', DXBMediaOffice: 'Dubai Media Office',
};
// A country's own official voice, when its forces speak through its agency.
const OFFICIAL = { Jordan: [/^Petra$/, /القوات المسلحة|الجيش العربي|الأمن العام|الامن العام|مديرية الأمن|مدير الإعلام العسكري|الحياري/] };
// A state's own accounts speak for it.
const OWN = { modgovksa: 'Saudi Arabia', KuwaitArmyGHQ: 'Kuwait', MOD_Qatar: 'Qatar', BDF_Bahrain: 'Bahrain', modgovae: 'United Arab Emirates', DXBMediaOffice: 'United Arab Emirates', ADMediaOffice: 'United Arab Emirates', sharjahmedia: 'United Arab Emirates', RAKMediaOffice: 'United Arab Emirates', ajmanmedia: 'United Arab Emirates' };
// The Gulf's place list: a place's country.
const PLACE_C = new Map();
if (fs.existsSync(require('path').join(require('path').dirname(CANDS), 'gulf-places.txt'))) for (const l of fs.readFileSync(require('path').join(require('path').dirname(CANDS), 'gulf-places.txt'), 'utf8').split('\n')) { const m = l.split(' | '); if (m.length === 4) PLACE_C.set(m[0].replace(/\s*\(.*\)\s*$/, ''), m[1] === 'UAE' ? 'United Arab Emirates' : m[1]); }
const norm = (s) => s.normalize('NFC').replace(/[ً-ْـ​-‏‪-‮⁦-⁩]/g, '').replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim();
const cand = new Map();
for (const l of fs.readFileSync(CANDS, 'utf8').split('\n')) if (l) { const c = JSON.parse(l); cand.set(c.ref, c); for (const a of c.also) cand.set(a, { ...c, ref: a, url: 'https://t.me/' + a }); }
const base = JSON.parse(fs.readFileSync(BASEF, 'utf8'));
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const GEN = /place not stated/;
const weapons = (t) => {
  const m = /صاروخ|صواريخ|باليستي|موشک|טיל|missile/i.test(t), d = /مسير|مسيّر|طائرة بدون|طائرات بدون|پهپاد|כטב"ם|רחפן|drone/i.test(t);
  return m && d ? 'missiles and drones' : m ? 'missiles' : d ? 'drones' : '';
};
const out = [], drop = {}, no = (k) => (drop[k] = (drop[k] || 0) + 1);
const seen = new Map();
for (const f of EVF) for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
  if (!l.trim()) continue;
  let e; try { e = JSON.parse(l); } catch { no('bad line'); continue; }
  const refs = (e.refs || []).filter((r) => cand.has(r));
  if (!refs.length || !/^2026-\d\d-\d\d$/.test(e.day || '') || !Number.isFinite(+e.lat)) { no('no candidate ref or day'); continue; }
  const first = cand.get(refs[0]);
  if (!e.quote || !norm(first.text).includes(norm(e.quote))) {
    // The quote may be from another of its refs: that one leads.
    const k = refs.findIndex((r) => e.quote && norm(cand.get(r).text).includes(norm(e.quote)));
    if (k < 0) { no('quote not in the post'); continue; }
    refs.unshift(...refs.splice(k, 1));
  }
  const lead = cand.get(refs[0]);
  const ch = refs[0].split('/')[0];
  const source = SRC[ch] || ch;
  // The Gulf is read as one set: each event names its state.
  // A reader that wrote a place's other name for its country: the country is the place list's.
  const known = (c) => ['Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'].includes(c);
  let CTRY = COUNTRY === 'Gulf' ? ({ UAE: 'United Arab Emirates', 'the UAE': 'United Arab Emirates' }[e.country] || e.country) : COUNTRY;
  if (COUNTRY === 'Gulf' && !known(CTRY)) CTRY = PLACE_C.get(String(e.place).replace(/\s*\(.*\)\s*$/, '')) || CTRY;
  if (COUNTRY === 'Gulf' && !known(CTRY)) { no('no country'); continue; }
  const CN = CTRY === 'United Arab Emirates' ? 'the UAE' : CTRY;
  const gen = GEN.test(e.place);
  // The list gives a place with its other names in brackets: the name alone.
  if (!gen) e.place = e.place.replace(/\s*\(.*\)\s*$/, '');
  let lat = +e.lat, lng = +e.lng;
  const at = countryAt(lat, lng);
  if (!gen && at !== CTRY && !(at === null && base.some((p) => km(p, { lat, lng }) < 25 && countryAt(p.lat, p.lng) === CTRY))) { no('point outside the country'); continue; }
  const key = `${e.day}|${CTRY}|${e.place}`;
  // The same place and day read twice (two batches, the siren pass): its posts are that pin's other sources.
  if (seen.has(key)) { const o = seen.get(key); for (const r of refs) { const src = SRC[r.split('/')[0]] || r.split('/')[0]; if (src !== o.source && !o.also.some((a) => a.source === src) && o.also.length < 4) o.also.push({ source: src, url: cand.get(r).url }); } no('same place and day twice'); continue; }
  // On a pin of that day: its point. The country in general: only on a day with none of its pins.
  const mine = base.filter((p) => p.day === e.day && !/alerts in/.test(p.label) && countryAt(p.lat, p.lng) === CTRY);
  // The country in general: its own pin of that day; a day with places pinned already holds it.
  if (gen && !mine.some((p) => GEN.test(p.label)) && mine.length) { no('country in general, a day with places'); continue; }
  const near = gen ? mine.find((p) => GEN.test(p.label)) : mine.filter((p) => km(p, { lat, lng }) < (/^(?:Amman|Irbid|Zarqa|Mafraq|Aqaba|Karak|Salt|Jerash|Ajloun|Madaba|Ma'an|Tafilah|Jordan Valley|Riyadh|Eastern Province|Dubai|Abu Dhabi|Sharjah|Fujairah|Ras al-Khaimah|Ajman|Umm al-Quwain|Al Ain|Doha|Manama|Muharraq|Ahmadi|Jahra|Muscat|Al-Ahsa|Qassim|Al-Jawf|Arar|Jeddah|Dammam|Tabuk)/.test(e.place) ? 40 : 5)).sort((a, b) => km(a, { lat, lng }) - km(b, { lat, lng }))[0];
  if (near) { lat = near.lat; lng = near.lng; }
  // Saudi Arabia's south, and from mid-September the whole kingdom, is the Houthis' front (the Yemen desk's): a
  // blast or siren there that names no launcher is theirs, not this war's.
  if (CTRY === 'Saudi Arabia' && e.actor === 'unclear' && ['blast', 'sirens'].includes(e.kind)
    && (/Abha|Asir|Jizan|Jazan|Najran|Khamis|Sharurah|Taif|Jeddah|Yanbu|Mecca|Makkah|Tabuk|Ula|Farasan/.test(e.place) || e.day >= '2026-09-14')) { no('Saudi blast, the Houthi front'); continue; }
  const official = OWN[ch] === CTRY || (OFFICIAL[CTRY] && OFFICIAL[CTRY][0].test(source) && OFFICIAL[CTRY][1].test(lead.text));
  const say = official ? `${CN} says` : `${source} reports`;
  const w = weapons(e.quote + ' ' + lead.text.slice(0, 200));
  const from = e.actor === 'iran' ? ' from Iran' : e.actor === 'iraqi_militias' ? ', launched from Iraq,' : '';
  const name = gen ? `${CN} (place not stated)` : e.place;
  const where = gen ? CN : (/Base|airport|Airport|crossing|zone|Tower|refinery|field|plant|Port|port|Camp|City|Island|Centre/.test(e.place) ? 'the ' : '') + e.place;
  const W = w ? w[0].toUpperCase() + w.slice(1) : '';
  const label = e.claim
    ? `${e.actor === 'iraqi_militias' ? 'The Iraqi factions say they' : e.actor === 'iran' ? 'Iran says it' : 'Its attackers say they'} struck ${where}${w ? ' with ' + w : ''}`
    : e.kind === 'intercept' ? (official ? `${say} it intercepted ${w || 'an attack'}${from} over ${where}` : `${W ? W + from + ' intercepted' : 'Interceptions'} over ${where}, ${say}`)
    : e.kind === 'debris' ? `Debris from ${w ? 'intercepted ' + w : 'an interception'}${from} falls on ${where}, ${say}`
    : e.kind === 'hit' ? `${W || 'An attack'}${from} hit ${where}, ${say}`
    : e.kind === 'blast' ? `Explosions heard in ${where}, ${say}`
    : e.kind === 'sirens' ? `Sirens in ${where}, ${say}`
    : `${w ? W.replace(/s\b/g, '') + ' attack' : 'Attack'}${from} on ${where}, ${say}`;
  const also = refs.slice(1).map((r) => ({ source: SRC[r.split('/')[0]] || r.split('/')[0], url: cand.get(r).url })).filter((a, i, A) => a.source !== source && A.findIndex((b) => b.source === a.source) === i).slice(0, 4);
  // "said" is the quote's place word for the merge's check: the quote itself is in the text.
  out.push({ day: e.day, actor: ['iran', 'iraqi_militias', 'unclear', 'us', 'israel'].includes(e.actor) ? e.actor : 'unclear', said: e.quote, country: CTRY, label, source, url: lead.url, text: lead.text, en: name, lat, lng, also, onPin: !!near });
  seen.set(key, out[out.length - 1]);
}
fs.writeFileSync(OUT, out.map(({ onPin, ...e }) => JSON.stringify(e)).join('\n') + '\n');
console.log(out.length, 'events,', out.filter((e) => !e.onPin).length, 'on no pin of that day; dropped', drop);
