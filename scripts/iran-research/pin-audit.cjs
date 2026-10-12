// Stage C, the pin audit (user, 12 Oct): every researched pin checked by rule, not one by one.
//   node scripts/iran-research/pin-audit.cjs <GeoNames dir: IR.txt, IQ.txt, LB.txt ...> [--dry]
// 1. A part of a town named but pinned on the town's centre (many places on one point) moves to that part,
//    when GeoNames has it once within 30 km.
// 2. One event, one pin: two pins of one side (or one "not stated") are one when
//    - they carry one link on two days in a row, at one place (a post read on both sides of midnight), or
//    - they name the same place on one day, spelt otherwise (Omidiyeh, Omīdīyeh), within 15 km.
//    The pin kept is the one with its own time, else the one with a side named, else the plainer spelling;
//    the other's source becomes a second source.
// 3. A source named by its web address (x.com, t.me) takes the account's name.
// 4. Out: a place that is not one (an Arabic word read as a place), satellite pictures (a later look, not the attack).
const fs = require('fs');
const path = require('path');
const gnDir = process.argv[2];
const dry = process.argv.includes('--dry');
if (!gnDir) throw new Error('usage: pin-audit.cjs <GeoNames dir> [--dry]');
const file = path.join(__dirname, '..', '..', 'public', 'iran-strikes-baseline.json');
const base = JSON.parse(fs.readFileSync(file, 'utf8'));
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯʻʼ‘’`'ʿʾ]/g, '');
const norm = (s) => plain(s).toLowerCase()
  .replace(/\b(?:mahalleh-?ye|shahrak-?e|bandar-?e|kuy-?e|al|el|ad|as|ash|az|ar|an)\b[- ]?/g, '')
  .replace(/\b(?:square|sq|street|st|blvd|boulevard|avenue|ave|expressway|highway|area|district|quarter|neighbou?rhood|town|village|city|region|province|governorate|county|surroundings|outskirts)\b/g, '')
  .replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1').replace(/(?:iy|y)eh$|ie?h$|iya$|iyah$|ia$/, 'ie');
const log = { moved: 0, merged: 0, renamed: 0, removed: [] };

// 1. Parts of towns.
const COUNTRY = { IR: [24, 40, 44, 64], IQ: [29, 38, 38.5, 49], LB: [33, 34.8, 35, 36.7] };
const gn = new Map();
for (const cc of Object.keys(COUNTRY)) {
  const f = path.join(gnDir, cc + '.txt');
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const c = line.split('\t');
    if (c.length < 9 || !/^[PSL]$/.test(c[6])) continue;
    const names = new Set([c[1], c[2], ...String(c[3] || '').split(',')].filter((n) => /[A-Za-z]/.test(n)).map(norm).filter((n) => n.length >= 4));
    for (const n of names) {
      if (!gn.has(n)) gn.set(n, []);
      gn.get(n).push({ lat: +c[4], lng: +c[5], code: c[7] });
    }
  }
}
const stack = new Map();
for (const p of base) {
  const k = p.lat.toFixed(4) + ',' + p.lng.toFixed(4);
  if (!stack.has(k)) stack.set(k, new Set());
  stack.get(k).add(norm(p.place.split(',')[0]));
}
for (const p of base) {
  if (p.source === 'Home Front Command' || /^(?:off |near |north|south|east|west|central)/i.test(p.place)) continue;
  const k = p.lat.toFixed(4) + ',' + p.lng.toFixed(4);
  if (stack.get(k).size < 3) continue;
  // Only "part, town" (Gisha, Tehran): a town alone is where its own source put it.
  const [part0, town] = p.place.split(',').map((s) => s.trim());
  if (!town || /^(?:Lebanon|Iran|Iraq|Israel|Kuwait|Bahrain|Qatar|Oman|Jordan|Saudi Arabia|UAE)\b|Province|Governorate|District/i.test(town)) continue;
  const part = part0.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const n = norm(part);
  // A square or a street is not its quarter's namesake (Sepah Square, Mahallati Expressway).
  if (n.length < 4 || n === norm(town) || /\b(?:square|sq|street|st|blvd|boulevard|avenue|expressway|highway|road|bridge)\b/i.test(part)) continue;
  // A quarter (PPLX) or a base; a name that is also a town's (Qods, Shahr-e Qods) is left where it is.
  const all = gn.get(n) || [];
  if (all.some((g) => /^PPL(?:A|C)/.test(g.code))) continue;
  const near = all.filter((g) => /^(?:PPLX|AIRB|AIRP|MILB)$/.test(g.code) && km(g, p) < 25 && km(g, p) > 0.5);
  if (!near.length) continue;
  // One place, or several within 2 km of each other (one quarter mapped twice).
  if (near.some((g) => km(g, near[0]) > 2)) continue;
  if (process.env.DBG) fs.appendFileSync(process.env.DBG, `MOVE ${p.place} | ${p.label} | ${km(near[0], p).toFixed(1)} km ${near[0].code} (${near[0].lat},${near[0].lng})\n`);
  p.lat = Math.round(near[0].lat * 1e4) / 1e4;
  p.lng = Math.round(near[0].lng * 1e4) / 1e4;
  log.moved++;
}

// 3. Sources named by their address.
const HANDLE = {
  Vahid: 'Vahid Online', VahidOnline: 'Vahid Online', IranIntl: 'Iran International', IranIntlbrk: 'Iran International', iranintltv: 'Iran International',
  UK_MTO: 'UKMTO', IDFFarsi: 'IDF in Persian', IAFsite: 'Israeli Air Force', idfonline: 'IDF', CENTCOM: 'CENTCOM', KuwaitArmyGHQ: 'Kuwait Army General Staff',
  BDF_Bahrain: 'Bahrain Defence Force', mehrnews: 'Mehr', Tasnimnews: 'Tasnim', sepah_pasdaran: 'Sepah News (the IRGC)', Nournews_ir: 'Nour News',
  defapress_ir: 'Defa Press', MTVLebanoNews: 'MTV Lebanon', farsna: 'Fars', isna94: 'ISNA', TankerTrackers: 'TankerTrackers', Israel_Alma_org: 'Alma Center',
  mew_kwt: "Kuwait's Electricity and Water Ministry", army21ye: 'the Houthi forces', Kurdia_News: 'Kurdia News', TreyYingst: 'Trey Yingst (Fox News)',
  Shayan86: 'Shayan Sardarizadeh (BBC Verify)', mmirleb: 'Mohammad Mir (Lebanon)', kianmeli1: 'Kian Meli', MarioLeb79: 'Mario (Lebanon)',
};
for (const p of base) {
  const fix = (s, url) => {
    if (!/^(?:x\.com|t\.me|twitter\.com)$/i.test(s || '')) return s;
    const m = String(url).match(/(?:t\.me|x\.com|twitter\.com)\/(?:s\/)?(\w+)/);
    if (!m) return s;
    log.renamed++;
    return HANDLE[m[1]] || (/t\.me/.test(url) ? `${m[1]} (Telegram)` : `@${m[1]}`);
  };
  p.source = fix(p.source, p.url);
  for (const a of p.also || []) a.source = fix(a.source, a.url);
}

// 4. Not events, not places.
const OUT = (p) => (/^[؀-ۿ\s]+$/.test(p.place) && !/كورنيش/.test(p.place)) || /^Satellite (?:images|pictures) show/i.test(p.label) || /\bBlack Sea\b/.test(p.place);
for (let i = base.length - 1; i >= 0; i--) if (OUT(base[i])) log.removed.push(base.splice(i, 1)[0].fp);
for (const p of base) if (p.place === 'كورنيش المزرعه') { p.place = 'Mazraa Corniche, Beirut'; p.label = p.label.replace('كورنيش المزرعه', 'the Mazraa Corniche, Beirut'); }

// 2. One event, one pin.
const sides = (a, b) => a.actor === b.actor || a.actor === 'unclear' || b.actor === 'unclear';
const dayN = (d) => Date.parse(d + 'T00:00:00Z') / 864e5;
const score = (p) => (p.at ? 4 : 0) + (p.actor !== 'unclear' ? 2 : 0) + (plain(p.place) === p.place ? 1 : 0);
const gone = new Set();
const order = base.map((_, i) => i).sort((a, b) => base[a].day.localeCompare(base[b].day));
for (let x = 0; x < order.length; x++) {
  const P = base[order[x]];
  if (gone.has(P) || P.source === 'Home Front Command') continue;
  for (let y = x + 1; y < order.length; y++) {
    const Q = base[order[y]];
    if (dayN(Q.day) - dayN(P.day) > 1) break;
    if (gone.has(Q) || Q.source === 'Home Front Command' || !sides(P, Q)) continue;
    if (P.at && Q.at && Math.abs(Date.parse(P.at) - Date.parse(Q.at)) > 3 * 3600e3) continue;
    const d = km(P, Q);
    const sameName = norm(P.place.split(',')[0]) === norm(Q.place.split(',')[0]) && norm(P.place.split(',')[0]).length >= 4;
    // A sea, a strait or "off" a coast holds many attacks a day; a district is not its town (Tyre district, Tyre).
    const wide = (p) => /\b(?:Strait|Gulf|Sea|off|coast|place not stated)\b/i.test(p.place);
    // One page for many days' events (a map, a dataset) is not one post.
    const onePost = !/inss\.org|acleddata|understandingwar|liveuamap|oref\.org|reuters\.com\/graphics/.test(P.url);
    const oneLink = P.url === Q.url && onePost && P.day !== Q.day && sameName && !wide(P) && d < 10;
    const district = (p) => /\b(?:district|county)\b/i.test(p.place);
    const oneName = P.day === Q.day && d < 15 && sameName && !wide(P) && district(P) === district(Q);
    if (!oneLink && !oneName) continue;
    const [keep, drop] = score(Q) > score(P) ? [Q, P] : [P, Q];
    const also = [...(keep.also || []), { source: drop.source, url: drop.url }, ...(drop.also || [])];
    const seen = new Set([keep.url]);
    keep.also = also.filter((a) => !seen.has(a.url) && seen.add(a.url));
    if (keep.actor === 'unclear' && drop.actor !== 'unclear') keep.actor = drop.actor;
    gone.add(drop);
    log.merged++;
    if (process.env.DBG) fs.appendFileSync(process.env.DBG, `MERGE ${keep.day} ${keep.actor} ${keep.place} | ${keep.label} | ${keep.source}  <=  ${drop.day} ${drop.actor} ${drop.place} | ${drop.label} | ${drop.source} | ${d.toFixed(1)} km${oneLink ? ' link' : ''}\n`);
    if (drop === P) break;
  }
}
// 5. The link is the post the note was written from (the sample read, 12 Oct: "Drones from Iran hit Kuwait
//    airport, Sabereen reports" linked Al Araby's post, which names no attacker). A note "…, X reports" with X
//    among the second sources links X's post; an official's own word, or a map or a digest, stays second.
const OFFICIAL = /Ministry|Command|CENTCOM|IDF|UKMTO|Defence|Defense|Army|Media Office|Armed Forces|Home Front|Guard|IRGC|Navy|Air Force|government/i;
const DIGEST = /^(?:ISW|Liveuamap|INSS|ACLED|x\.com|t\.me)$/;
let swapped = 0;
for (const p of base) {
  if (gone.has(p)) continue;
  const m = /,\s+([^,]{2,90}?)\s+reports?$/.exec(p.label || '');
  if (!m || m[1] === p.source || DIGEST.test(m[1]) || OFFICIAL.test(p.source)) continue;
  const i = (p.also || []).findIndex((a) => a.source === m[1]);
  if (i < 0) continue;
  const a = p.also[i];
  p.also.splice(i, 1, { source: p.source, url: p.url });
  p.source = a.source;
  p.url = a.url;
  swapped++;
}
log.swapped = swapped;

// 6. Pins read against their posts (a random 120, 12 Oct): what the post says.
const READ = {
  'rs-2026-07-14-us-west-of-bandar-abbas': { actor: 'unclear' },
  'rs-2026-07-12-unclear-bandar-e-deyr': { actor: 'unclear' },
  'rs-2026-03-13-iran-isa-air-base': { actor: 'unclear' },
  'rs-2026-04-15-israel-es-saadiyat': { label: 'Israeli strike on a car in Es Saadiyat, Lebanon' },
  'rs-2026-09-01-unclear-gulf-of-oman': { place: 'off Oman', label: 'A ship attacked off Oman' },
  'rs-2026-08-03-unclear-gulf-of-oman': { place: 'off Oman', label: 'A ship attacked off Oman' },
  'rs-2026-03-31-us-hosseiniyeh-azam-zanjan': { actor: 'israel', label: 'Israeli and US strike on Hosseiniyeh Azam, Zanjan' },
  'rs-2026-02-28-unclear-ahvaz': { actor: 'israel', label: 'Israeli and US strikes on Ahvaz' },
  'rs-2026-08-31-israel-taybeh': { label: 'Israeli detonation between Taybeh and Qantara, Lebanon' },
  'rs-2026-02-28-unclear--byek': { label: 'Israeli and US strike on Abyek' },
  'rs-2026-03-17-unclear-kerman': { place: 'Sirjan, Kerman province', lat: 29.452, lng: 55.6814, label: 'Attack on Sirjan, Kerman province' },
  'rs-2026-04-01-unclear-andisheh': { place: 'Mianeh', lat: 37.4211, lng: 47.715, label: 'Explosions heard in Mianeh' },
  'rs-2026-04-14-hezbollah-maroun-al-ras': { label: 'Hezbollah bomb ambush on an Israeli force advancing from Maroun al-Ras' },
  'rs-2026-07-24-iran-kazna-erbil': { actor: 'unclear', label: 'A drone falls near Kazna, Erbil, starting a fire' },
  'rs-2026-03-18-hezbollah-tayyibe': { label: 'Hezbollah says it repelled an Israeli force advancing on Tayyibe' },
};
// Not in the post, or no attack: a place the post does not name, a satellite-seen fire, an embassy warning,
// a disputed claim of a raid, a mine accident, machine-gun fire alone.
const NOT = new Set(['rs-2026-05-19-israel-kafr-rumman', 'rs-2026-06-04-unclear-das-island', 'rs-2026-03-04-unclear-us-embassy-baghdad', 'rs-2026-03-07-unclear-aghdasiyeh-oil-depot-east-tehran', 'rs-2026-08-03-unclear-erbil', 'rs-2026-08-01-unclear-del-j-n', 'rs-2026-09-01-israel-aita-al-jabal']);
for (const p of base) if (READ[p.fp]) Object.assign(p, READ[p.fp]);
for (const p of base) if (NOT.has(p.fp)) { gone.add(p); log.removed.push(p.fp); }
const out = base.filter((p) => !gone.has(p));
console.log(`[pin-audit] ${log.moved} moved to their part of town, ${log.merged} folded into another pin, ${log.swapped} linked to the post their note is from, ${log.renamed} sources named, ${log.removed.length} out (${log.removed.join(', ')}); ${out.length} pins`);
if (!dry) fs.writeFileSync(file, JSON.stringify(out));
