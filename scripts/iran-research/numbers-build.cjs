#!/usr/bin/env node
/*
 * Builds public/iran-numbers.json (the Iran desk's numbers panel) from the
 * research files: S/n3r/*.json first, then S/n2/*.json for what n3r lacks.
 * Every figure is picked by an explicit match (source + date) on a research
 * entry and carries that entry's own url and date. Nothing is estimated here:
 * the only arithmetic is a change in % between two published figures, a sum
 * the research itself names, or a count of the rows of a list.
 *
 * Usage: node scripts/iran-research/numbers-build.cjs [scratchpadDir]
 * (default S = $IRAN_RESEARCH_DIR or the session scratchpad below).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const S = process.argv[2] || process.env.IRAN_RESEARCH_DIR ||
  'C:\\Users\\itama\\AppData\\Local\\Temp\\claude\\C--Users-itama-Desktop-The-Desk\\cd9b0682-4089-4b2c-8718-bc944064b440\\scratchpad';
const OUT = path.join(__dirname, '..', '..', 'public', 'iran-numbers.json');
const AS_OF = '2026-10-11';
const WAR = '2026-02-28';

const load = (rel) => JSON.parse(fs.readFileSync(path.join(S, rel), 'utf8'));
const R = {
  casIL: load('n3r/cas-iran-lebanon.json'),
  casIG: load('n3r/cas-iraq-gulf-us.json'),
  casISR: load('n3r/cas-israel.json'),
  mar3: load('n3r/maritime.json'),
  en3: load('n3r/energy.json'),
  eco3: load('n3r/iran-economy.json'),
  mkt3: load('n3r/markets-nuclear.json'),
  mar1: load('n2/maritime.json'),
  mar2: load('n2/maritime2.json'),
  en2: load('n2/energy-numbers.json'),
  sites2: load('n2/energy-sites2.json'),
  eco1: load('n2/economy.json'),
  eco2: load('n2/economy2.json'),
  ns2: load('n2/nuclear-sanctions.json'),
  boi: load('n2/boi.json'),
};

/* ---------- helpers ---------- */
const problems = [];
function fail(msg) { throw new Error(msg); }
/** One entry of a research array, matched by source text and date; throws when absent. */
function pick(arr, { src, date, unit, val } = {}, label = '') {
  const hits = (arr || []).filter((e) => e
    && (!src || src.test(String(e.source || '')))
    && (!date || String(e.as_of || e.date || '').startsWith(date))
    && (!unit || unit.test(String(e.unit || '')))
    && (val === undefined || JSON.stringify(e.value) === JSON.stringify(val)));
  if (hits.length !== 1) fail(`pick ${label}: ${hits.length} matches for ${src} ${date || ''}`);
  return hits[0];
}
const isoRe = /^\d{4}-\d{2}-\d{2}$/;
function iso(d) {
  const m = String(d || '').match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const mm = String(d || '').match(/^(\d{4})-(\d{2})$/);
  if (mm) return monthEnd(d);
  fail(`no date in ${d}`);
}
function monthEnd(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, '0')}`;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (d) => { const [, m, day] = d.split('-'); return `${+day} ${MON[+m - 1]}`; };
const dmy = (d) => { const [y, m, day] = d.split('-'); return `${+day} ${MON[+m - 1]} ${y}`; };
function fmtN(n, dp = 0) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
/** Change in % of a against b, as "+51%" / "−6.5%". */
function chg(a, b) {
  const p = (a / b - 1) * 100;
  const s = Math.abs(p) >= 10 ? Math.round(Math.abs(p)).toString() : Math.abs(p).toFixed(1);
  return `${p >= 0 ? '+' : '−'}${s}%`;
}
const range = (s) => String(s).replace(/(\d)-(\d)/g, '$1–$2');
/** A cell. */
function C(v, k, src, url, date, extra = {}) {
  if (v === null || v === undefined) fail(`null value for ${src}`);
  const c = { v: String(v) };
  if (extra.q) c.q = extra.q;
  c.k = k; c.src = src;
  if (url) c.url = url;
  c.date = iso(date);
  if (extra.note) c.note = extra.note;
  return c;
}
const off = (v, src, url, date, extra) => C(v, 'off', src, url, date, extra);
const unoff = (v, src, url, date, extra) => C(v, 'unoff', src, url, date, extra);
const pts = (arr, dKey = 'date', vKey = 'value') => arr.map((p) => (Array.isArray(p) ? { d: p[0], v: +p[1] } : { d: iso(p[dKey]), v: +p[vKey] })).filter((p) => isoRe.test(p.d) && Number.isFinite(p.v)).sort((a, b) => a.d.localeCompare(b.d));
/** The last point on or before d minus 7 days. */
function weekBefore(series, d) {
  const lim = new Date(Date.parse(d) - 7 * 864e5).toISOString().slice(0, 10);
  const c = series.filter((p) => p.d <= lim);
  if (!c.length) fail(`no week-earlier point before ${lim}`);
  return c[c.length - 1];
}
const cap = (s) => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
/** Dates in research strings: "2026-03-07..12", "2026-03-23/24", "2026-03-01; 2026-04-06", "2026-03", "2026-03-20..04-03; 06-11". */
function parseDates(str) {
  const out = [];
  let year = '2026', month = null;
  for (const part of String(str).split(/;\s*/)) {
    const m = part.trim().match(/^(?:(\d{4})-)?(\d{2})(?:-(\d{2}))?(?:(?:\.\.|\/)(?:(\d{2})-)?(\d{2}))?$/);
    if (!m) fail(`date ${str}`);
    if (m[1]) year = m[1];
    month = m[2];
    if (!m[3]) { out.push({ from: `${year}-${month}`, to: `${year}-${month}`, monthOnly: true }); continue; }
    const from = `${year}-${month}-${m[3]}`;
    const to = m[5] ? `${year}-${m[4] || month}-${m[5]}` : from;
    out.push({ from, to });
  }
  return out;
}
function showDates(str) {
  return parseDates(str).map((p) => {
    if (p.monthOnly) return MON[+p.from.slice(5, 7) - 1];
    if (p.from === p.to) return dm(p.from);
    return p.from.slice(5, 7) === p.to.slice(5, 7) ? `${+p.from.slice(8)}–${dm(p.to)}` : `${dm(p.from)} – ${dm(p.to)}`;
  }).join(', ');
}
const lastDate = (str) => { const p = parseDates(str); const t = p[p.length - 1].to; return t.length === 7 ? `${t}-01` : t; };

/* ======================================================================
 * Casualties
 * ==================================================================== */
function casualties() {
  const IL = R.casIL, IG = R.casIG, IS = R.casISR;
  const irK = IL.Iran.killed, irC = IL.Iran.civilians, irM = IL.Iran.military, irI = IL.Iran.injured;
  const fom = pick(irK.official, { src: /Foundation of Martyrs and Veterans/, date: '2026-08-22' }, 'FoM');
  const hrana = pick(irK.unofficial, { src: /HRANA, day-39/, date: '2026-04-07' }, 'HRANA');
  const hengaw = pick(irK.unofficial, { src: /Hengaw tenth/, date: '2026-04-08' }, 'Hengaw');
  const w1 = R.casIL.Iran.waves.series.find((e) => e.date === '2026-07-24');
  const w2 = R.casIL.Iran.waves.series.find((e) => e.date === '2026-09-02' && e.injured === 142);
  const civMoH = pick(irC.official, { src: /OCHA/, date: '2026-04-07' }, 'civ MoH');
  const civFoM = pick(irC.official, { src: /Foundation of Martyrs/, date: '2026-04-26' }, 'civ FoM');
  const civHR = pick(irC.unofficial, { src: /^HRANA day 39/, date: '2026-04-07' }, 'civ HRANA');
  const milFoM = pick(irM.official, { src: /Foundation of Martyrs/, date: '2026-04-26' }, 'mil FoM');
  const milHen = pick(irM.unofficial, { src: /Hengaw/, date: '2026-04-08' }, 'mil Hengaw');
  const milHR = pick(irM.unofficial, { src: /^HRANA$/, date: '2026-04-07' }, 'mil HRANA');
  const injMoH = pick(irI.official, { src: /Ministry of Health \(Kermanpour\)/, date: '2026-05-13' }, 'inj MoH');
  const injII = pick(irI.unofficial, { src: /Iran International/, date: '2026-03-31' }, 'inj II');

  const lbK = pick(IL.Lebanon.killed.official, { src: /Health Emergency Operations Centre/, date: '2026-10-11' }, 'LB k');
  const lbI = pick(IL.Lebanon.injured.official, { src: /El Nashra/, date: '2026-10-11' }, 'LB i');
  const hzb = pick(IL.Lebanon.killed.unofficial, { src: /Asharq Al-Awsat: Hezbollah stopped/, date: '2026-04-17' }, 'Hzb');
  const idfClaim = pick(IL.Lebanon.killed.claims_by_party, { src: /Effie Defrin/, date: '2026-05-28' }, 'IDF claim');

  const isSold = pick(IS.soldiers_killed.official, { src: /^Count of IDF announcements/, date: '2026-10-08' }, 'IDF k');
  const isCiv = pick(IS.civilians_killed.official, { src: /third-anniversary/, date: '2026-10-04' }, 'NII');
  const isW = pick(IS.soldiers_wounded.official, { src: /idf\.il\/160590.*21 Jul and 23 Sep/, date: '2026-07-06' }, 'IDF w');
  const isH = pick(IS.hospital_evacuations_all.official, { src: /MOHreport Telegram/, date: '2026-04-17' }, 'MoH evac');
  if (isSold.value + isCiv.value !== 82) fail('Israel sum');

  const us = IG['US troops'];
  const usK = pick(us.official, { src: /DCAS public API/, date: '2026-10-09' }, 'US k');
  const usW = pick(us.official, { src: /^DCAS: Epic Fury 417/, date: '2026-10-09' }, 'US w');
  const usKu = pick(us.unofficial, { src: /Washington Post/, date: '2026-09-18' }, 'US k u');
  const usWu = pick(us.unofficial, { src: /Intercept/, date: '2026-08-04' }, 'US w u');
  const iq = IG.Iraq;
  const iqH = pick(iq.official, { src: /Iraqi health authorities, as cited by Airwars/, date: '2026-06-19' }, 'IQ');
  const iqP = pick(iq.official, { src: /^PMF Commission statements as posted on Naya/, date: '2026-07-29' }, 'PMF');
  const krg = pick(iq.official, { src: /KRG Department of Media/, date: '2026-04-20' }, 'KRG');
  const rudaw = pick(iq.unofficial, { src: /^Rudaw tracking/, date: '2026-09-15' }, 'Rudaw');

  const gulf = (name, offSrc, offDate, label) => {
    const o = pick(IG[name].official, { src: offSrc, date: offDate }, `${name} off`);
    const a = pick(IG[name].unofficial, { src: /^Airwars/, date: '2026-10-11' }, `${name} airwars`);
    return { name: label || name, o, a };
  };
  const G = [
    gulf('UAE', /Ministry of Defence cumulative/, '2026-05-10'),
    gulf('Kuwait', /^Sum of Kuwaiti ministry statements/, '2026-07-30'),
    gulf('Saudi Arabia', /Saudi Civil Defence and Ministry of Energy statements in 'incidents'/, '2026-04-09'),
    gulf('Oman', /Oman News Agency/, '2026-05-04'),
    gulf('Bahrain', /Bahrain Interior Ministry/, '2026-06-11'),
    gulf('Qatar', /Qatar Ministry of Interior/, '2026-07-17'),
  ];
  const kwMil = pick(IG.Kuwait.official, { src: /^Ministry of Defence statements/, date: '2026-03-29' }, 'KW mil');
  const kwCiv = pick(IG.Kuwait.official, { src: /^Sum of MoH \/ KNPC/, date: '2026-07-18' }, 'KW civ');
  const jo = pick(IG.Jordan.official, { src: /Jordanian security officials/, date: '2026-04-06' }, 'JO');
  const joA = pick(IG.Jordan.unofficial, { src: /^Airwars/, date: '2026-10-11' }, 'JO a');
  const syK = pick(IG.Syria.official, { src: /^SANA/, date: '2026-02-28' }, 'SY k');
  const syI = pick(IG.Syria.official, { src: /Syrian state media via AFP/, date: '2026-03-26' }, 'SY i');
  const syA = pick(IG.Syria.unofficial, { src: /^Airwars/, date: '2026-10-11' }, 'SY a');
  const FN = IG['Foreign nationals'].official;
  const fIn = pick(FN, { src: /^India, Ministry of External Affairs/, date: '2026-07-30' }, 'IN');
  const fBd = pick(FN, { src: /^Bangladesh Expatriates/, date: '2026-07-09' }, 'BD');
  const fPh = pick(FN, { src: /^Department of Migrant Workers/ }, 'PH');
  const fNp = pick(FN, { src: /^Nepal Ministry of Foreign Affairs/, date: '2026-07-31' }, 'NP');

  const sumNote = "sum of the ministry's announcements";
  const airNote = "civilians only, sum of Airwars' published incidents";
  const killed = [
    { label: 'Iran', off: off(fmtN(fom.value), 'Foundation of Martyrs and Veterans Affairs, via Shahrara News', fom.url, fom.as_of, { note: `People buried, the war of 28 Feb to 8 Apr. The Health Ministry counted ${w1.value} more killed on 27 Jun – 24 Jul and ${w2.value} on 30 Aug – 2 Sep.` }),
      unoff: unoff(fmtN(hrana.value), 'HRANA', hrana.url, hrana.as_of, { q: 'at least', note: `To 7 Apr. Hengaw counts at least ${fmtN(hengaw.value)} (8 Apr).` }) },
    { label: 'Iran: civilians', off: off(fmtN(civMoH.value), 'Ministry of Health, via UN OCHA', civMoH.url, civMoH.as_of, { q: 'at least', note: `To 7 Apr. The Foundation of Martyrs counts ${fmtN(civFoM.value)} (26 Apr).` }),
      unoff: unoff(fmtN(civHR.value), 'HRANA', civHR.url, civHR.as_of, { q: 'at least', note: 'Including 254 children' }) },
    { label: 'Iran: military', off: off(fmtN(milFoM.value), 'Foundation of Martyrs, via Defa Press', milFoM.url, milFoM.as_of),
      unoff: unoff(fmtN(milHen.value), 'Hengaw', milHen.url, milHen.as_of, { note: `Military and security forces. HRANA counts ${fmtN(milHR.value)} military and 714 not classified (7 Apr).` }) },
    { label: 'Lebanon', off: off(fmtN(lbK.value), 'Lebanese Health Ministry, via El Nashra', lbK.url, lbK.as_of, { note: 'Since 2 Mar' }), unoff: null },
    { label: 'Israel', off: off('82', 'IDF announcements and the National Insurance Institute', isSold.url, '2026-10-08', { note: '46 soldiers (IDF announcements, to 8 Oct) and 36 civilians (National Insurance Institute, 4 Oct): our sum of the two official counts' }), unoff: null },
    { label: 'Iraq', off: off(fmtN(iqH.value), 'Iraqi health authorities, via Airwars', iqH.url, iqH.as_of, { q: 'at least' }),
      unoff: unoff(fmtN(101), 'PMF statements, posted on Naya', 'https://t.me/naya_foriraq/86119', iqP.as_of, { note: 'PMF fighters only: our count of PMF statements. They are inside the national figure.' }) },
    { label: 'Iraq: Kurdistan Region', off: off(fmtN(krg.value), 'Kurdistan Regional Government', krg.url, krg.as_of, { note: 'Civilians, 28 Feb – 20 Apr' }),
      unoff: unoff(fmtN(rudaw.value), 'Rudaw', rudaw.url, rudaw.as_of, { note: 'Including Peshmerga and Iranian Kurdish opposition members' }) },
    { label: 'US troops', off: off(fmtN(usK.value), 'Pentagon, Defense Casualty Analysis System', usK.url, usK.as_of, { note: '11 in hostile action. 3 US contractors also died (a US official, 18 Sep).' }),
      unoff: unoff(fmtN(usKu.value), 'Washington Post / AP, six US officials', usKu.url, usKu.as_of, { q: 'at least' }) },
  ];
  for (const g of G) {
    const k = g.o.value.killed !== undefined ? g.o.value.killed : g.o.value;
    killed.push({ label: g.name,
      off: off(fmtN(k), g.name === 'UAE' ? 'UAE Ministry of Defence' : `${g.name}: official statements`, g.o.url, g.o.as_of, { note: g.name === 'UAE' ? 'Ministry total; no update after 10 May' : sumNote }),
      unoff: unoff(String(g.a.value.killed), 'Airwars', g.a.url, g.a.as_of, { note: airNote }) });
  }
  killed.push(
    { label: 'Jordan', off: off('0', 'Jordanian security statements', jo.url, jo.as_of), unoff: unoff(String(joA.value.killed), 'Airwars', joA.url, joA.as_of, { note: airNote }) },
    { label: 'Syria', off: off(String(syK.value.killed), 'SANA, via Reuters', syK.url, syK.as_of, { note: 'Suwayda, 28 Feb' }), unoff: unoff(String(syA.value.killed), 'Airwars', syA.url, syA.as_of, { note: airNote }) },
    { label: 'India', sub: 'foreign nationals', off: off(String(fIn.value.killed), 'Indian Ministry of External Affairs', fIn.url, fIn.as_of, { note: '10 of them seafarers' }), unoff: null },
    { label: 'Bangladesh', sub: 'foreign nationals', off: off(String(fBd.value.killed), 'Bangladesh Expatriates\' Welfare Minister', fBd.url, fBd.as_of), unoff: null },
    { label: 'Philippines', sub: 'foreign nationals', off: off('6', 'Philippine Department of Migrant Workers', fPh.url, '2026-09-22', { note: '5 seafarers at Hormuz and a caregiver in Tel Aviv; 1 more missing. Our sum of its statements.' }), unoff: null },
    { label: 'Nepal', sub: 'foreign nationals', off: off(String(fNp.value.killed), 'Nepal Ministry of Foreign Affairs', fNp.url, fNp.as_of), unoff: null },
  );

  const injured = [
    { label: 'Iran', off: off(fmtN(injMoH.value), 'Ministry of Health', injMoH.url, injMoH.as_of, { q: 'about', note: `The war of 28 Feb to 8 Apr. ${w1.injured} more on 27 Jun – 24 Jul and ${w2.injured} on 30 Aug – 2 Sep.` }), unoff: null },
    { label: 'Iran: military', off: null, unoff: unoff(fmtN(injII.value), 'Iran International, unnamed sources', injII.url, injII.as_of, { note: 'IRGC, Basij and police' }) },
    { label: 'Lebanon', off: off(fmtN(lbI.value), 'Lebanese Health Ministry, via El Nashra', lbI.url, lbI.as_of, { note: 'Since 2 Mar' }), unoff: null },
    { label: 'Israel: soldiers', off: off(fmtN(isW.value), 'IDF', isW.url, isW.as_of, { note: "The IDF's last published figure" }), unoff: null },
    { label: 'Israel: taken to hospital', off: off(fmtN(isH.value), 'Ministry of Health', isH.url, isH.as_of, { note: 'Soldiers and civilians, including people hurt on the way to shelter and anxiety cases' }), unoff: null },
    { label: 'Iraq', off: null, unoff: unoff('302', 'PMF statements, posted on Naya', 'https://t.me/naya_foriraq/86119', iqP.as_of, { q: 'at least', note: 'PMF fighters only: our count of PMF statements' }) },
    { label: 'Iraq: Kurdistan Region', off: off('123', 'Kurdistan Regional Government', krg.url, krg.as_of, { note: 'Civilians, 28 Feb – 20 Apr' }), unoff: unoff('154', 'Rudaw', rudaw.url, rudaw.as_of, { q: 'about' }) },
    { label: 'US troops', off: off(fmtN(usW.value), 'Pentagon, Defense Casualty Analysis System', usW.url, usW.as_of), unoff: unoff(fmtN(usWu.value), 'The Intercept', usWu.url, usWu.as_of, { note: 'Its own count, before the Pentagon raised its figure' }) },
  ];
  for (const g of G) {
    let o;
    if (g.name === 'Kuwait') o = off(String(kwMil.value + kwCiv.value), 'Kuwaiti ministry statements', kwCiv.url, kwCiv.as_of, { q: 'at least', note: `${kwMil.value} military and ${kwCiv.value} civilians: ${sumNote}` });
    else o = off(fmtN(g.o.value.injured), g.name === 'UAE' ? 'UAE Ministry of Defence' : `${g.name}: official statements`, g.o.url, g.o.as_of, { note: g.name === 'UAE' ? 'Ministry total; no update after 10 May' : sumNote });
    injured.push({ label: g.name, off: o, unoff: unoff(range(g.a.value.injured), 'Airwars', g.a.url, g.a.as_of, { note: airNote }) });
  }
  injured.push(
    { label: 'Jordan', off: off(String(jo.value.injured), 'Jordanian security statements', jo.url, jo.as_of, { q: 'at least', note: 'Hurt by falling debris, to April' }), unoff: unoff(String(joA.value.injured), 'Airwars', joA.url, joA.as_of, { note: airNote }) },
    { label: 'Syria', off: off(String(syI.value.injured), 'Syrian state media, via AFP', syI.url, syI.as_of, { q: 'at least' }), unoff: unoff(String(syA.value.injured), 'Airwars', syA.url, syA.as_of, { note: airNote }) },
    { label: 'India', sub: 'foreign nationals', off: off(String(fIn.value.injured), 'Indian Ministry of External Affairs', fIn.url, fIn.as_of), unoff: null },
    { label: 'Nepal', sub: 'foreign nationals', off: off('21', 'Nepal Ministry of Foreign Affairs', 'https://english.khabarhub.com/2026/03/542470/', '2026-04-05', { note: 'By early April' }), unoff: null },
  );
  // A row nobody counted is left out of the Injured box (Bangladesh, Philippines have no injured figure).
  return {
    key: 'cas', name: 'Casualties',
    boxes: [
      { type: 'claims', title: 'Killed', rows: killed,
        note: `Lebanon: ${fmtN(8954)} killed since 8 Oct 2023 (Health Ministry). Hezbollah fighters: more than ${fmtN(hzb.value)} by 17 Apr (sources close to Hezbollah); about ${fmtN(idfClaim.value)} by 28 May (the IDF). Saudi Arabia leaves out the Houthi strikes on Riyadh and Abha airports of 6–11 Oct, the Yemen front.` },
      { type: 'claims', title: 'Injured', rows: injured,
        note: 'Israel: the Ministry of Health counts everyone taken to hospital, not only the wounded; its daily count stopped on 17 Apr.' },
    ],
  };
}

/* ======================================================================
 * Maritime
 * ==================================================================== */
function maritime() {
  const inc = R.mar2.incidents;
  const IMO_URL = inc.imo_official.url;
  const n2inc = R.mar1.incidents;
  const titleShip = (s) => s;
  // IMO entries, enriched from the first-pass list where it names the ship.
  const byKey = new Map(n2inc.map((e) => [`${e.date} ${e.ship}`, e]));
  const addedByImo = new Map(inc.added.filter((a) => a.imo_number).map((a) => [a.imo_number, a]));
  const rows = [];
  for (const e of inc.imo_full_list) {
    let ref = null;
    if (typeof e.in_maritime_json === 'string') {
      const k = e.in_maritime_json.replace(/ \(.*\)$/, '');
      ref = byKey.get(k) || null;
    }
    const add = addedByImo.get(e.imo_number);
    const flag = (ref && ref.flag) || (add && add.flag) || null;
    const name = ref ? ref.ship : e.ship;
    const ship = flag && !/unknown|none/i.test(flag) ? `${name} (${flag})` : name;
    rows.push({ d: e.date, k: 'off', src: 'IMO, confirmed incidents', url: IMO_URL, ship, loc: e.location, what: cap(e.what.replace('Damanged', 'Damaged')) });
  }
  // The first-pass entries the IMO has not listed, less those an IMO entry names.
  const namedByImo = new Set(['2026-10-02|Strait of Hormuz, outbound', '2026-10-02|east of Oman', '2026-09-29|Strait of Hormuz', '2026-09-28|Strait of Hormuz', '2026-09-09|off Port Rashid, Dubai', '2026-04-01|17 nm N of Ras Laffan, Qatar']);
  const notImo = new Set(inc.maritime_json_not_on_imo_list);
  let dropped = 0;
  for (const e of n2inc) {
    if (!notImo.has(`${e.date} | ${e.ship} | ${e.location}`)) continue;
    if (e.ship.startsWith('unknown') && namedByImo.has(`${e.date}|${e.location}`)) { dropped++; continue; }
    const flag = e.flag && !/unknown|none/i.test(e.flag) ? ` (${e.flag})` : '';
    const ship = e.ship === 'unknown' ? cap(e.type || 'ship') : e.ship;
    rows.push({ d: e.date, k: 'unoff', src: e.source, url: e.url, ship: `${ship}${flag}`, loc: e.location, what: cap(e.what) });
  }
  if (dropped !== 6) fail(`expected 6 IMO-named duplicates, got ${dropped}`);
  for (const e of inc.added_post_imo_list) rows.push({ d: e.date, k: 'unoff', src: e.source, url: e.url, ship: e.ship, loc: e.location, what: cap(e.what) });
  for (const e of inc.windward_only_not_on_imo_list) {
    if (/likely the IMO/.test(e.what)) continue; // the same event as an IMO entry
    rows.push({ d: e.date, k: 'unoff', src: 'Windward', url: e.url, ship: e.flag ? `${e.ship} (${e.flag})` : e.ship, loc: '', what: cap(e.what) });
  }
  rows.sort((a, b) => b.d.localeCompare(a.d) || (a.k === 'off' ? -1 : 1));
  const w7 = new Date(Date.parse(AS_OF) - 6 * 864e5).toISOString().slice(0, 10);
  const nToday = rows.filter((r) => r.d === AS_OF).length;
  const n7 = rows.filter((r) => r.d >= w7).length;
  const nAll = rows.filter((r) => r.d >= WAR).length;
  const nImo = rows.filter((r) => r.k === 'off').length;
  if (nImo !== inc.imo_official.value) fail('IMO count');
  const cnt = (n, label) => unoff(String(n), 'Our count of the list below', IMO_URL, AS_OF, { note: label });
  const incidents = {
    type: 'incidents', title: 'Incidents', cls: 'ships',
    cols: [['Date', 'd'], ['Ship', 'l'], ['Location', 'l'], ['What happened', 'l w']],
    rows: rows.map((r) => [C(dm(r.d), r.k, r.src, r.url, r.d), r.ship, r.loc, r.what]),
    stats: [[cnt(nToday, 'Ships attacked or seized on 11 Oct'), 'Today'], [cnt(n7, '5–11 Oct'), 'Last 7 days'], [cnt(nAll, `${nImo} confirmed by the IMO`), 'Since 28 Feb']],
    note: `${nImo} incidents confirmed by the IMO (to 6 Oct; 24 seafarers killed, 3 missing) and ${nAll - nImo} reported by trackers and the media. Houthi attacks in the Red Sea are left out.`,
  };

  // Ships through the Strait.
  const T = R.mar2.transits;
  const imoD = T.imo.daily_series;
  const imoWeek = { d: '2026-09-30', v: imoD['2026-09'][29] };
  const ww = R.mar3.transits.series.filter((p) => p.source === 'Windward');
  const wwLatest = ww.find((p) => p.date === '2026-10-10');
  const wwWeek = ww.find((p) => p.date === '2026-10-03');
  const wwBase = R.mar3.transits.baselines.find((b) => b.source === 'Windward');
  const kp = T.kpler.latest;
  const kpBase = T.kpler.before;
  if (wwLatest.value !== T.windward.latest.value) fail('Windward latest');
  const ships = {
    type: 'table', title: 'Ships through the Strait of Hormuz', unit: 'ships a day',
    cols: ['', 'Latest', 'A week earlier', 'Before conflict'],
    rows: [
      { label: 'IMO', sub: 'all ships, an average of several sources', cells: [off(String(T.imo.latest.value), 'IMO', T.imo.latest.url, T.imo.latest.date), off(String(imoWeek.v), 'IMO', 'https://www.imo.org/en/mediacentre/hottopics/pages/strait-of-hormuz-middle-east-data.aspx', imoWeek.d), null] },
      { label: 'Windward', sub: 'including dark ships', cells: [unoff(String(wwLatest.value), 'Windward', wwLatest.url, wwLatest.date), unoff(String(wwWeek.value), 'Windward', wwWeek.url, wwWeek.date), unoff('130', 'Windward', wwBase.url, '2026-02-27', { q: 'about' })] },
      { label: 'Kpler', sub: 'ships it can track only', cells: [unoff(String(kp.value), 'Kpler, via Alhurra', kp.url, kp.date), null, unoff('130–140', 'Kpler, via SANA', kpBase.url, '2026-02-27')] },
    ],
    note: 'Each counts differently: the IMO averages several sources; Windward adds ships with their transponders off, found by satellite; Kpler sees only ships that broadcast their position. The IMO gives no figure for before the war; Clarksons put it at about 125 a day.',
    series: pts(ww), seriesUnit: 'Windward, ships a day',
  };

  // Crude oil through the Strait: TankerTrackers periods (crude only, all origins incl. Iran).
  const tt = R.mar2.crude_through_hormuz.tankertrackers;
  const per = (p) => tt.periods.find((x) => x.period.startsWith(p));
  const kpC = R.mar2.crude_through_hormuz.kpler;
  const ttc = (p, label, sub, pre) => { const x = per(p); return { label, sub, n: x.value, c: unoff(String(x.value), 'TankerTrackers', tt.url, tt.date, { note: x.period }), ...(pre ? { pre: true } : {}) }; };
  const crude = {
    type: 'bars', title: 'Crude oil through the Strait of Hormuz', unit: 'million barrels a day',
    why: 'Crude oil only, from every country on the Gulf, Iran included',
    bars: [
      ttc('2026-01-01', 'Before conflict', '1 Jan – 28 Feb', true),
      ttc('2026-02-28', '28 Feb – 13 Apr', 'the first weeks'),
      ttc('2026-04-13', '13 Apr – 18 Jun', 'first US blockade'),
      ttc('2026-06-18', '18 Jun – 14 Jul', 'the June deal'),
      ttc('2026-07-14', '14 Jul – 2 Sep', 'second US blockade'),
    ],
    note: `TankerTrackers has published nothing newer. Kpler, which counts differently (about 13.5 before the war), put it at ${kpC[2].value} in the week to 7 Oct, about 40% below.`,
    series: kpC.map((x) => ({ d: iso(x.date), v: x.value })), seriesUnit: 'Kpler, 7-day average',
  };

  // LNG through the Strait: Kpler cargo counts.
  const lng = R.mar1.lng;
  const lB = lng.before.find((x) => /Kpler/.test(x.source));
  const lM = (d) => lng.months.find((x) => x.date === d);
  const lMar = lM('2026-03'), lJun = lM('2026-06'), lSep = lM('2026-09');
  const lngBox = {
    type: 'bars', title: 'LNG through the Strait of Hormuz', unit: 'gas carriers leaving, a month',
    bars: [
      { label: 'Before conflict', sub: 'a month', n: 86, c: unoff('86', 'Kpler, via Business Today', lB.url, '2026-02-27', { q: 'about' }), pre: true },
      { label: 'March', n: 0, c: unoff('0', 'Kpler, via Business Today', lMar.url, '2026-03-31') },
      { label: 'June', n: 15, c: unoff('15', 'Kpler, via Business Today', lJun.url, '2026-06-30', { q: 'about' }) },
      { label: 'September', n: 21, c: unoff('21', 'Kpler', lSep.url, '2026-09-30', { note: 'S&P Global counts 19; Bloomberg, about 17' }) },
    ],
    note: 'Kpler counted single figures in April and May, and fewer than in June in July and August. The US EIA put LNG through the Strait at 10.5 billion cubic feet a day before the war (late 2025) and 0.8 in April – June.',
  };

  // War-risk insurance.
  const ins = R.mar3.insurance;
  const iL = pick(ins.unofficial, { src: /^Fortune/, date: '2026-10-10' }, 'ins latest');
  const iW = pick(ins.unofficial, { src: /^TBS News/, date: '2026-10-07' }, 'ins week');
  const iB = pick(ins.unofficial, { src: /^Marsh \(Marcus Baker\)/, date: '2026-09-28' }, 'ins before');
  const insurance = {
    type: 'span3', title: 'War-risk insurance for a Gulf voyage', unit: "of a ship's hull value, per voyage",
    latest: unoff('6–10%', 'Fortune', iL.url, iL.as_of, { note: 'no broker named' }),
    week: unoff('6–10%', 'TBS News', iW.url, iW.as_of, { note: 'no broker named' }),
    before: unoff('0.15–0.25%', 'Marsh, via Insurance Business', iB.url, iB.as_of),
    beforeSpan: 'before 28 Feb', beforeNote: 'Marsh',
    note: 'Neither figure names a broker, and no broker quote dated October was found. The highest a broker has put a name to: 7.5–10% (Marsh, 22 Jul) and about 10% (BRS).',
  };

  // Stranded.
  const st = R.mar3.stranded;
  const sImo = pick(st.official, { src: /^IMO Secretary-General statement/, date: '2026-08-28' }, 'IMO stranded');
  const sNyt = pick(st.official, { src: /New York Times/, date: '2026-08-04' }, 'IMO start');
  const sIn = pick(st.official, { src: /^India MEA spokesperson/, date: '2026-09-29' }, 'India');
  const sWw = pick(st.unofficial, { src: /^Windward 'Fleet Composition'/, date: '2026-10-10' }, 'Windward fleet');
  const stranded = {
    type: 'table', title: 'Ships and crews stranded in the Gulf',
    cols: ['', 'Latest', 'When the war began'],
    rows: [
      { label: 'Ships unable to leave', cells: [off('up to 400', 'IMO', sImo.url, sImo.as_of), off('1,500', 'IMO, via the New York Times', sNyt.url, '2026-02-28', { q: 'about' })] },
      { label: 'Seafarers unable to leave', cells: [off('6,000', 'IMO', sImo.url, sImo.as_of, { q: 'about' }), off('20,000', 'IMO, via the New York Times', sNyt.url, '2026-02-28', { q: 'about' })] },
      { label: 'Indian seafarers on ships in the Gulf', cells: [off('4,500', 'Indian Ministry of External Affairs', sIn.url, sIn.as_of, { q: 'more than' }), null] },
      { label: 'Cargo ships and tankers in the Gulf', sub: 'all ships there, not only stranded ones', cells: [unoff('1,035', 'Windward', sWw.url, sWw.as_of), null] },
    ],
    note: 'The IMO has published no count newer than 28 Aug.',
  };
  return { key: 'sea', name: 'Maritime', boxes: [incidents, ships, crude, lngBox, insurance, stranded] };
}

/* ======================================================================
 * Energy
 * ==================================================================== */
function energy() {
  const E2 = R.sites2, U = R.en3.energy_sites_unknown.list;
  const upd = new Map(U.map((u) => [`${u.site}|${u.attacked}`, u]));
  const rows = [];
  for (const s of E2.sites) {
    const site = s.site.replace('Khondab power plant', 'Khondab heavy-water plant');
    const country = s.country && !site.includes(s.country) ? `, ${s.country}` : '';
    const by = s.attacker && s.attacker !== 'unknown' ? `${cap(s.attacker)}; ${s.weapon}` : `Unknown; ${s.weapon}`;
    const u = upd.get(`${s.site}|${s.date}`);
    let st, stK, stUrl, stDate, stNote;
    if (u) { st = u.status; stK = u.official ? 'off' : 'unoff'; stUrl = u.url; stDate = u.as_of || s.date; stNote = u.source; }
    else { st = s.status; stK = s.status_official ? 'off' : 'unoff'; stUrl = (s.status_urls && s.status_urls[0]) || s.attack_url; stDate = s.status_date || s.date; stNote = s.status_detail; }
    const short = cap(String(st).replace(/\s*\(.*$/, ''));
    const aUrl = s.attack_url || (s.attack_urls && s.attack_urls[0]) || stUrl;
    const sd = /^\d{4}-\d{2}$/.test(stDate) ? `${stDate}-01` : stDate;
    rows.push({ key: lastDate(s.date), first: parseDates(s.date)[0].from,
      cells: [C(showDates(s.date), s.attack_official ? 'off' : 'unoff', s.attack_official ? 'Confirmed by the operator or a government' : 'Reported by the media', aUrl, lastDate(s.date)),
        `${site}${country}`, by,
        C(short, stK, stK === 'off' ? 'Operator or government' : 'Media report', stUrl, iso(sd) , { note: stNote })] });
  }
  // A claim's link is its map pin's (matched by fp; else a pin of the same day and place); no pin, no row.
  const PINS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'iran-strikes-baseline.json'), 'utf8'));
  const pinByFp = new Map(PINS.map((p) => [p.fp, p]));
  let claimsKept = 0;
  for (const c of E2.claims) {
    const fp0 = c.map_fps[0];
    let pin = pinByFp.get(fp0);
    if (!pin) {
      const m = fp0.match(/^[a-z]+-(\d{4}-\d{2}-\d{2})-[a-z_]+-(.+)$/);
      if (m) pin = PINS.find((p) => p.day === m[1] && String(p.place || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[2]);
    }
    if (!pin || !pin.url) { problems.push(`claim without a pin: ${c.site}`); continue; }
    claimsKept++;
    const country = c.country && !c.site.includes(c.country) ? `, ${c.country}` : '';
    rows.push({ key: lastDate(c.date), first: parseDates(c.date)[0].from,
      cells: [C(showDates(c.date), 'unoff', pin.source, pin.url, pin.day, { note: 'Claim; no confirmation from the operator or a government' }),
        `${c.site}${country}`, `Claimed by ${c.claimed_by}`, C('Claim', 'unoff', pin.source, pin.url, pin.day, { note: c.note || undefined })] });
  }
  if (claimsKept !== E2.claims.length) { console.warn(problems.splice(0).join('\n')); }
  rows.sort((a, b) => b.key.localeCompare(a.key) || b.first.localeCompare(a.first));
  const w7 = new Date(Date.parse(AS_OF) - 6 * 864e5).toISOString().slice(0, 10);
  const nT = rows.filter((r) => r.key === AS_OF).length, n7 = rows.filter((r) => r.key >= w7).length;
  const nC = claimsKept, nS = E2.sites.length;
  const sc = (n, note) => unoff(String(n), 'Our count of the list below', null, AS_OF, { note: note ? `count of the list below: ${note}` : 'count of the list below' });
  const attacks = {
    type: 'list', title: 'Attacks on energy sites', cls: 'sites',
    cols: [['Date', 'd'], ['Site', 'l'], ['By, weapon', 'l'], ['Status', 'l w']],
    rows: rows.map((r) => r.cells),
    stats: [[sc(nT), 'Today'], [sc(n7), 'Last 7 days'], [sc(nS + nC, `${nS} attacks and ${nC} claims`), 'Since 28 Feb']],
    note: 'Not every attack: ministries reported many more strikes on energy sites without naming them. No attack on an energy site on land was found from 4 to 11 Oct. Ships are in the Maritime set; the Houthi front is left out.',
  };

  // Iran's crude oil production.
  const op = R.en2.iran_crude_production.unofficial.opec_secondary_sources;
  const eia = R.en2.iran_crude_production.unofficial.eia_steo;
  const MN = { '2026-02': 'Before conflict', '2026-03': 'March', '2026-04': 'April', '2026-05': 'May', '2026-06': 'June', '2026-07': 'July', '2026-08': 'August', '2026-09': 'September' };
  const prodBars = op.series.filter((x) => x.period >= '2026-02').map((x) => ({ label: MN[x.period], ...(x.period === '2026-02' ? { sub: 'February', pre: true } : {}), n: x.value,
    c: unoff(String(x.value), 'OPEC secondary sources', x.url, monthEnd(x.period), x.caveat ? { note: 'As reported; the OPEC report itself was not read' } : {}) }));
  const eSep = eia.series.find((x) => x.period === '2026-09');
  prodBars.push({ label: 'September', n: eSep.value, c: off(String(eSep.value), 'US Energy Information Administration', eSep.url, '2026-09-30') });
  const prod = {
    type: 'bars', title: "Iran's crude oil production", unit: 'million barrels a day', bars: prodBars,
    note: 'Iran has reported no output to OPEC since the war began. These are outside estimates: OPEC\'s secondary sources to August, the US EIA for September. OPEC\'s September figure is due on 13 Oct.',
    series: op.series.map((x) => ({ d: monthEnd(x.period), v: x.value })), seriesUnit: 'OPEC secondary sources',
  };

  // Iran's gas.
  const g = R.en3.iran_natural_gas;
  const gLost = pick(g.official, { src: /NIGC integrated planning manager/, date: '2026-09-22' }, 'gas lost');
  const gBack = pick(g.official, { src: /^NIGC CEO/, date: '2026-10-05' }, 'gas back');
  const gMin = pick(g.official, { src: /Oil ministry deputy for planning/ }, 'gas 50%');
  const gas = {
    type: 'table', title: "Iran's gas", unit: 'million cubic metres a day',
    cols: ['', "Iran's own figure"],
    rows: [
      { label: 'Processing capacity knocked out', sub: 'South Pars refineries 3–6, hit on 18 Mar', cells: [off('230', 'National Iranian Gas Company, via Mehr / Tehran Times', gLost.url, gLost.as_of, { note: 'About a third of national output' })] },
      { label: 'Back in service', cells: [off('100', 'National Iranian Gas Company, via Mehr', gBack.url, gBack.as_of, { q: 'about' })] },
    ],
    note: `The oil ministry said 50% of the damaged capacity was back by 22 Sep. No independent figure exists.`,
  };
  void gMin;

  // Iran's crude oil exports.
  const ie = R.en3.iran_crude_exports;
  const s = (d) => ie.series.find((x) => x.date === d);
  const xB = s('Jan-Feb 2026');
  const xb = (d, label, sub, src) => { const x = s(d); const dd = /\//.test(d) ? `2026-04-${d.split('/')[1]}` : monthEnd(d); return { label, ...(sub ? { sub } : {}), n: x.value, c: unoff(String(x.value), src, x.url, dd) }; };
  const exportsBox = {
    type: 'bars', title: "Iran's crude oil exports", unit: 'million barrels a day',
    bars: [
      { label: 'Before conflict', sub: 'January – February', n: xB.value, c: unoff(String(xB.value), 'TankerTrackers, via Iran International', xB.url, '2026-09-06'), pre: true },
      xb('2026-03', 'March', null, 'Kpler'),
      xb('2026-04-01/13', '1–13 Apr', null, 'Kpler'),
      xb('2026-04-14/23', '14–23 Apr', 'US blockade', 'Kpler'),
      xb('2026-05', 'May', null, 'Kpler'),
      xb('2026-06', 'June', 'TankerTrackers, after the blockade lifted', 'TankerTrackers'),
      xb('2026-07', 'July', null, 'Kpler'),
      xb('2026-08', 'August', null, 'Kpler'),
      xb('2026-09', 'September', null, 'Kpler and Vortexa, via CNBC'),
    ],
    note: 'Loadings at Iranian terminals, counted by trackers. Iran\'s only official word: "we are not exporting oil" (the central bank governor, 19 Aug).',
    series: ['2026-03', '2026-05', '2026-07', '2026-08', '2026-09'].map((d) => ({ d: monthEnd(d), v: s(d).value })), seriesUnit: 'Kpler',
  };

  // Gulf crude oil exports (Vortexa).
  const gc = R.en3.gulf_crude_exports;
  const vB = pick(gc.unofficial, { src: /^Vortexa via Reuters \(seven Arab/ }, 'vortexa before');
  const vS = pick(gc.unofficial, { src: /^Vortexa via Reuters: 91%/, date: '2026-09' }, 'vortexa sep');
  const gulfBars = {
    type: 'bars', title: 'Gulf crude oil exports', unit: 'million barrels a day',
    why: 'Crude and condensate shipped by sea from Saudi Arabia, Iraq, the UAE, Kuwait, Qatar, Bahrain and Oman, by every route including Yanbu and Fujairah; Iran left out',
    bars: [
      { label: 'Before conflict', sub: 'the year to 28 Feb', n: vB.value, c: unoff(String(vB.value), 'Vortexa, via Reuters', vB.url, '2026-02-27'), pre: true },
      { label: 'September', n: vS.value, c: unoff(String(vS.value), 'Vortexa, via Reuters', vS.url, '2026-09-30', { note: '91% of the level before the war' }) },
    ],
    note: 'Vortexa has published no monthly figure for March to August. TankerTrackers, counting Middle East crude with Iran, put the low in May at 67% below January – February and August at 39% below.',
  };
  const BC = gc.by_country;
  const jodi = (arr, d) => arr.find((x) => x.date === d);
  const tt = (arr) => arr.find((x) => /^TankerTrackers via Aletihad/.test(x.source));
  const ttCell = (x) => unoff(x.value.replace(/^-/, '−').replace(/ vs Jan-Feb$/, ''), 'TankerTrackers, via Aletihad', x.url, '2026-08-31', { note: 'August against January – February' });
  const sa = BC.saudi_arabia, iq = BC.iraq, kw = BC.kuwait, ua = BC.uae, qa = BC.qatar, om = BC.oman, bh = BC.bahrain;
  const saJ = jodi(sa.official, '2026-07'), saF = jodi(sa.official, '2026-02');
  const iqA = jodi(iq.official, '2026-08'), iqF = jodi(iq.official, '2026-02');
  const kwJ = jodi(kw.official, '2026-07'), kwF = jodi(kw.official, '2026-02');
  const omA = jodi(om.official, '2026-08');
  const bhJ = jodi(bh.official, '2026-06'), bhF = jodi(bh.official, '2026-02');
  const byCountry = {
    type: 'table', title: 'Gulf crude oil exports by country', unit: 'million barrels a day',
    cols: ['', 'Latest month', 'February', 'Change by August'],
    rows: [
      { label: 'Saudi Arabia', sub: 'latest: July', cells: [off(String(saJ.value), 'Saudi Arabia, via JODI', saJ.url, '2026-07-31'), off(String(saF.value), 'Saudi Arabia, via JODI', saF.url, '2026-02-28'), ttCell(tt(sa.unofficial))] },
      { label: 'Iraq', sub: 'latest: August', cells: [off(String(iqA.bpd_computed.toFixed(2)), 'Iraqi Oil Ministry, preliminary', iqA.url, '2026-08-31', { note: '70 million barrels in August' }), off(String(iqF.bpd), 'Iraqi Oil Ministry', iqF.url, '2026-02-28'), ttCell(tt(iq.unofficial))] },
      { label: 'UAE', cells: [null, null, ttCell(tt(ua.unofficial))] },
      { label: 'Kuwait', sub: 'latest: July', cells: [off(String(kwJ.value), 'Kuwait, via JODI', kwJ.url, '2026-07-31'), off(String(kwF.value), 'Kuwait, via JODI', kwF.url, '2026-02-28'), ttCell(tt(kw.unofficial))] },
      { label: 'Qatar', cells: [null, null, ttCell(tt(qa.unofficial))] },
      { label: 'Oman', sub: 'latest: August', cells: [off(String(omA.bpd_computed), 'National Centre for Statistics and Information', omA.url, '2026-08-31', { note: '27.1 million barrels in August' }), null, null] },
      { label: 'Bahrain', sub: 'latest: June', cells: [off(String(bhJ.value), 'Bahrain, via JODI', bhJ.url, '2026-06-30'), off(String(bhF.value), 'Bahrain, via JODI', bhF.url, '2026-02-28'), null] },
    ],
    note: 'Official: each government\'s own monthly figure (JODI, the Iraqi Oil Ministry, Oman\'s statistics centre). The UAE and Qatar publish none for 2026. Unofficial: TankerTrackers, change in August against January – February.',
  };

  // Crude oil price.
  const b = R.en3.brent;
  const fut = pts(b.futures_daily.series);
  const fL = fut[fut.length - 1];
  if (fL.d !== b.latest.futures.date || fL.v !== b.latest.futures.value) fail('brent latest');
  const fW = weekBefore(fut, fL.d);
  const dated = b.latest.dated;
  const brent = {
    type: 'span3', title: 'Crude oil price', unit: 'Brent futures, dollars a barrel',
    latest: unoff(`$${fL.v.toFixed(2)}`, 'ICE Brent front month, via Yahoo Finance', b.futures_daily.url, fL.d),
    week: unoff(`$${fW.v.toFixed(2)}`, 'ICE Brent front month, via Yahoo Finance', b.futures_daily.url, fW.d),
    before: unoff(`$${b.prewar.futures.value.toFixed(2)}`, 'ICE Brent front month, via Yahoo Finance', b.futures_daily.url, '2026-02-27', { note: `Average of ${b.prewar.futures.n} closes, 28 Jan – 27 Feb` }),
    change: chg(fL.v, b.prewar.futures.value),
    note: `Dated Brent, the price of cargoes loading in the next weeks, was $${dated.value.toFixed(2)} on ${dm(dated.date)} (US EIA), against $${b.prewar.dated.value.toFixed(2)} before the war. It runs above the futures because ships that can load now are scarce, while the futures price delivery months ahead (EIA).`,
    series: fut.filter((p) => p.d >= '2026-01-28'), seriesUnit: 'Brent futures',
  };

  // Petrol prices at the pump.
  const P = R.en2.petrol_pump_prices, PP = R.en3.pump_prices;
  const us = P.us.official, eu = P.eu.official, il = P.israel.official;
  const uae = PP.uae.series, qat = PP.qatar.series, sau = PP.saudi_arabia.series[0];
  const uF = uae.find((x) => x.date === '2026-02'), uO = uae.find((x) => x.date === '2026-10');
  const qF = qat.find((x) => x.date === '2026-02'), qO = qat.find((x) => x.date === '2026-10');
  const pump = {
    type: 'table', title: 'Petrol prices at the pump',
    cols: ['', 'Latest', 'Before conflict'],
    rows: [
      { label: 'US', sub: 'dollars a gallon, regular', cells: [off(`$${us.latest.value.toFixed(2)}`, 'US EIA, weekly', us.latest.url, us.latest.date, { note: `${chg(us.latest.value, us.before.value)} vs before conflict` }), off(`$${us.before.value.toFixed(2)}`, 'US EIA', us.before.url, '2026-02-23', { note: 'Average of the four February weeks' })] },
      { label: 'EU', sub: 'euros a litre, 95 octane, average', cells: [off(`€${eu.latest.value.toFixed(2)}`, 'European Commission, Weekly Oil Bulletin', eu.latest.url, eu.latest.date, { note: `${chg(eu.latest.value, eu.before.value)} vs before conflict` }), off(`€${eu.before.value.toFixed(2)}`, 'European Commission, Weekly Oil Bulletin', eu.before.url, '2026-02-23', { note: 'Average of the four February bulletins' })] },
      { label: 'Israel', sub: 'shekels a litre, 95 octane', cells: [off(`₪${il.latest.value.toFixed(2)}`, 'Ministry of Energy', il.latest.url, il.latest.date, { note: `${chg(il.latest.value, il.before.value)} vs before conflict` }), off(`₪${il.before.value.toFixed(2)}`, 'Ministry of Energy', il.before.url, '2026-02-28', { note: 'February price' })] },
      { label: 'UAE', sub: 'dirhams a litre, Special 95', cells: [off(`AED ${uO.special95.toFixed(2)}`, 'UAE Fuel Price Committee, via Khaleej Times', uO.url, '2026-10-01', { note: `${chg(uO.special95, uF.special95)} vs before conflict` }), off(`AED ${uF.special95.toFixed(2)}`, 'UAE Fuel Price Committee', uF.url, '2026-02-01', { note: 'February price' })] },
      { label: 'Qatar', sub: 'riyals a litre, Super 95', cells: [off(`QAR ${qO.super95.toFixed(2)}`, 'QatarEnergy, via QNA', qO.url, '2026-10-01', { note: `${chg(qO.super95, qF.super95)} vs before conflict` }), off(`QAR ${qF.super95.toFixed(2)}`, 'QatarEnergy, via The Peninsula', qF.url, '2026-02-01', { note: 'February price' })] },
      { label: 'Saudi Arabia', sub: 'riyals a litre, 95 octane', cells: [off(`SAR ${sau.gasoline95.toFixed(2)}`, 'Saudi Aramco monthly review, via Al-Muraba', sau.url, '2026-09-01', { note: 'Unchanged all year; the October review was not found' }), off(`SAR ${sau.gasoline95.toFixed(2)}`, 'Saudi Aramco monthly review, via Al-Muraba', sau.url, '2026-02-01')] },
    ],
    note: 'Before conflict: the February price. Saudi Arabia and Oman cap their prices, so the war has not moved them.',
    series: pts(us.weekly), seriesUnit: 'US, dollars a gallon',
  };
  return { key: 'energy', name: 'Energy', boxes: [attacks, prod, gas, exportsBox, gulfBars, byCountry, brent, pump] };
}

/* ======================================================================
 * Economy
 * ==================================================================== */
function economy() {
  const E = R.eco1, M = R.mkt3.markets, X = R.eco3;
  const span3 = (title, unit, why, s, opts = {}) => {
    const latest = s.latest, week = s.week, before = s.before;
    return { type: 'span3', title, unit, ...(why ? { why } : {}), latest, week, before, change: chg(+opts.lv, +opts.bv), ...(opts.beforeNote ? { beforeNote: opts.beforeNote } : {}), ...(opts.beforeSpan ? { beforeSpan: opts.beforeSpan } : {}), ...(opts.series ? { series: opts.series, seriesUnit: opts.seriesUnit } : {}), ...(opts.note ? { note: opts.note } : {}) };
  };
  // Shekel.
  const sh = E.shekel_per_dollar;
  const boiPts = pts(R.boi);
  const boiUrl = sh.series[0].url;
  const shL = boiPts[boiPts.length - 1];
  if (shL.d !== sh.latest.date || shL.v !== sh.latest.value) fail('shekel latest');
  const shW = weekBefore(boiPts, shL.d);
  const shekel = span3("The shekel's rate", 'shekels to the dollar', null, {
    latest: off(shL.v.toFixed(3), 'Bank of Israel', sh.latest.url, shL.d),
    week: off(shW.v.toFixed(3), 'Bank of Israel', sh.latest.url, shW.d),
    before: off(sh.before.value.toFixed(3), 'Bank of Israel', sh.before.url, '2026-02-27', { note: 'Average of 23 days, 28 Jan – 27 Feb' }),
  }, { lv: shL.v, bv: sh.before.value, series: boiPts.filter((p) => p.d >= '2026-01-28').map((p) => ({ d: p.d, v: p.v })), seriesUnit: 'shekels to the dollar', note: 'A lower number is a stronger shekel.' });
  void boiUrl;

  // Markets, from the daily series of the research.
  const mk = (m, src) => {
    const p = pts(m.series_daily.points);
    const L = p[p.length - 1];
    const lat = m.unofficial[0];
    if (L.d !== lat.as_of || Math.abs(L.v - lat.value) > 1e-6) fail(`${m.index} latest ${L.d} ${lat.as_of}`);
    const W = weekBefore(p, L.d);
    return { p, L, W, lat, src };
  };
  const t = mk(M.israel_ta35);
  const ta = span3('Tel Aviv Stock Exchange', 'TA-35 index, in points', 'The 35 biggest companies in Tel Aviv', {
    latest: unoff(fmtN(t.L.v, 2), 'Yahoo Finance (TASE feed)', t.lat.url, t.L.d),
    week: unoff(fmtN(t.W.v, 2), 'Yahoo Finance (TASE feed)', M.israel_ta35.series_daily.url, t.W.d),
    before: unoff(fmtN(M.israel_ta35.prewar_avg_28jan_27feb.value, 2), 'Yahoo Finance (TASE feed)', M.israel_ta35.prewar_avg_28jan_27feb.url, '2026-02-27', { note: `Average of ${M.israel_ta35.prewar_avg_28jan_27feb.n_closes} closes` }),
  }, { lv: t.L.v, bv: M.israel_ta35.prewar_avg_28jan_27feb.value, series: t.p, seriesUnit: 'TA-35' });

  const gcc = M.sp_gcc_composite; const gq = mk(gcc);
  const gulf = span3('Gulf stock markets', 'S&P GCC index, in points', 'The biggest companies in the six Gulf states, in dollars', {
    latest: unoff(fmtN(gq.L.v, 2), 'S&P Dow Jones Indices, via FT Markets', gq.lat.url, gq.L.d),
    week: unoff(fmtN(gq.W.v, 2), 'S&P Dow Jones Indices, via FT Markets', gcc.series_daily.url, gq.W.d),
    before: unoff(fmtN(gcc.prewar_avg_28jan_27feb.value, 2), 'S&P Dow Jones Indices, via FT Markets', gcc.prewar_avg_28jan_27feb.url, '2026-02-27', { note: `Average of ${gcc.prewar_avg_28jan_27feb.n_closes} closes` }),
  }, { lv: gq.L.v, bv: gcc.prewar_avg_28jan_27feb.value, series: gq.p, seriesUnit: 'S&P GCC' });

  const ex = [['Saudi Arabia', 'Tadawul All Share', M.saudi_tasi], ['Qatar', 'QE Index', M.qatar_qe], ['Dubai', 'DFM General', M.dubai_dfmgi], ['Abu Dhabi', 'FTSE ADX General', M.abu_dhabi_fadgi], ['Kuwait', 'Premier Market', M.kuwait_premier], ['Bahrain', 'All Share', M.bahrain_all_share], ['Oman', 'MSX 30', M.muscat_msx30]];
  const exRows = ex.map(([name, idx, m]) => {
    const lat = m.unofficial[0], pre = m.last_prewar_close;
    const srcL = lat.source.replace(/ \(.*\)$/, ''), srcP = pre.source.replace(/ \(.*\)$/, '');
    const c = chg(lat.value, pre.value);
    if (Math.abs(((lat.value / pre.value - 1) * 100) - m.change_vs_last_prewar_pct) > 0.06) fail(`${name} change`);
    return { label: name, sub: idx, cells: [unoff(fmtN(lat.value, 2), srcL, lat.url, lat.as_of), unoff(fmtN(pre.value, 2), srcP, pre.url, pre.date, { note: `Close of ${dm(pre.date)}` }), unoff(c, `Our calculation from ${srcL}`, lat.url, lat.as_of)] };
  });
  const exchanges = {
    type: 'table', title: 'Gulf exchanges', unit: 'index points',
    cols: ['', 'Latest', 'Last close before the war', 'Change'], rows: exRows,
    note: 'Change from each exchange\'s last close before 28 Feb (24 Feb in Kuwait; 26 Feb in Saudi Arabia, Qatar, Bahrain and Oman; 27 Feb in Dubai and Abu Dhabi) to its latest close.',
  };

  // The rial.
  const rt = E.rial_open_market.tgju, rb = E.rial_open_market.bonbast;
  const tgPts = pts(rt.series).filter((p) => p.d >= '2026-01-28' && !(p.d >= '2026-02-28' && p.d <= '2026-03-14'));
  const rial = {
    type: 'table', title: "The rial's open-market rate", unit: 'rials to the dollar',
    cols: ['', 'Latest', '7 days earlier', 'Before conflict'],
    rows: [
      { label: 'bonbast', cells: [unoff(fmtN(rb.latest.value * 10), 'bonbast.com', rb.latest.url, '2026-10-11', { note: `${fmtN(rb.latest.value)} tomans; ${chg(rb.latest.value, rb.before.value)} vs before conflict` }), unoff(fmtN(rb.week_earlier.value * 10), 'bonbast.com archive', rb.week_earlier.url, rb.week_earlier.date), unoff(fmtN(Math.round(rb.before.value * 10)), 'bonbast.com archive', rb.before.url, '2026-02-27', { note: 'Average of 31 days, 28 Jan – 27 Feb' })] },
      { label: 'tgju', cells: [unoff(fmtN(rt.latest.value), 'tgju.org', rt.latest.url, rt.latest.date, { note: `${chg(rt.latest.value, rt.before.value)} vs before conflict` }), unoff(fmtN(rt.week_earlier.value), 'tgju.org', rt.week_earlier.url, rt.week_earlier.date), unoff(fmtN(Math.round(rt.before.value)), 'tgju.org', rt.before.url, '2026-02-27', { note: 'Average of 24 days, 28 Jan – 27 Feb' })] },
    ],
    note: 'The street rate, sell side. bonbast quotes tomans (10 rials); shown here in rials. tgju printed an unchanged rate from 28 Feb to 14 Mar, during the internet blackout; the line leaves those days out.',
    series: tgPts, seriesUnit: 'tgju, rials to the dollar',
  };

  // Gold coin.
  const ct = E.emami_coin.tgju, cb = E.emami_coin.bonbast;
  const mil = (v) => fmtN(v / 1e6, 1);
  const coin = {
    type: 'table', title: 'Gold coin in Tehran', unit: 'million rials for one Emami coin',
    why: 'A coin of 8.1 g of gold, which Iranians buy to keep their savings from the falling rial',
    cols: ['', 'Latest', '7 days earlier', 'Before conflict'],
    rows: [
      { label: 'bonbast', cells: [unoff(mil(cb.latest.value * 10), 'bonbast.com', cb.latest.url, '2026-10-11', { note: `${chg(cb.latest.value, cb.before.value)} vs before conflict` }), unoff(mil(cb.week_earlier.value * 10), 'bonbast.com archive', cb.week_earlier.url, cb.week_earlier.date), unoff(mil(cb.before.value * 10), 'bonbast.com archive', cb.before.url, '2026-02-27', { note: 'Average of 31 days, 28 Jan – 27 Feb' })] },
      { label: 'tgju', cells: [unoff(mil(ct.latest.value), 'tgju.org', ct.latest.url, ct.latest.date, { note: `${chg(ct.latest.value, ct.before.value)} vs before conflict` }), unoff(mil(ct.week_earlier.value), 'tgju.org', ct.week_earlier.url, ct.week_earlier.date), unoff(mil(ct.before.value), 'tgju.org', ct.before.url, '2026-02-27', { note: 'Average of 24 days, 28 Jan – 27 Feb' })] },
    ],
    note: 'tgju printed an unchanged price from 28 Feb to 14 Mar, during the internet blackout; the line leaves those days out.',
    series: pts(ct.series).filter((p) => p.d >= '2026-01-28' && !(p.d >= '2026-02-28' && p.d <= '2026-03-14')).map((p) => ({ d: p.d, v: p.v / 1e6 })), seriesUnit: 'tgju, million rials',
  };

  // Inflation (general CPI, point to point).
  const inf = X.inflation;
  const IM = [['Bahman 1404', 'Before conflict', '21 Jan – 19 Feb', '2026-02-19'], ['Esfand 1404', 'Esfand', '20 Feb – 20 Mar', '2026-03-20'], ['Farvardin 1405', 'Farvardin', '21 Mar – 20 Apr', '2026-04-20'], ['Ordibehesht 1405', 'Ordibehesht', '21 Apr – 21 May', '2026-05-21'], ['Khordad 1405', 'Khordad', '22 May – 21 Jun', '2026-06-21'], ['Tir 1405', 'Tir', '22 Jun – 22 Jul', '2026-07-22'], ['Mordad 1405', 'Mordad', '23 Jul – 22 Aug', '2026-08-22'], ['Shahrivar 1405', 'Shahrivar', '23 Aug – 22 Sep', '2026-09-22']];
  const infBars = IM.map(([m, label, sub, end], i) => {
    const x = inf.series_sci.find((e) => e.month.startsWith(m));
    if (!x) fail(`inflation ${m}`);
    return { label, sub, n: x.point_to_point, c: off(`${x.point_to_point}%`, 'Statistical Centre of Iran, as reported', x.url, end), ...(i === 0 ? { pre: true } : {}) };
  });
  const cbiS = inf.series_cbi.find((e) => e.month === 'Shahrivar 1405');
  const inflation = {
    type: 'bars', title: "Iran's inflation", unit: 'how much higher prices are than in the same month a year earlier', bars: infBars,
    note: `Consumer prices for all households, by Iranian month. The central bank, which counts urban households only, puts Shahrivar at ${cbiS.point_to_point}%. The figure for Mehr (to 22 Oct) is not out yet.`,
    series: IM.map(([m, , , end]) => ({ d: end, v: inf.series_sci.find((e) => e.month.startsWith(m)).point_to_point })), seriesUnit: '%',
  };

  // Gasoline.
  const ga = X.gasoline;
  const gBefore = pick(ga.official, { src: /cabinet decision of 2 Azar/ }, 'gas before');
  const gNow = pick(ga.official, { src: /Mohajerani/, date: '2026-09-08' }, 'gas now');
  const bm = pick(ga.unofficial, { src: /^Iran International, viewers/, date: '2026-05-22' }, 'black market');
  const gasoline = {
    type: 'table', title: 'Gasoline prices in Iran', unit: 'tomans a litre',
    cols: ['Tier', 'Now', 'Before conflict'],
    rows: [
      { label: 'Subsidised quota', sub: 'first 60 litres a month', cells: [off(fmtN(gNow.value.tier1_60L_month), 'Government spokeswoman, via Digiato', gNow.url, gNow.as_of), off(fmtN(gBefore.value.tier1_60L_month), 'Cabinet decision, via Nabz-e Bourse', gBefore.url, '2026-02-27')] },
      { label: 'Second tier', sub: 'the next litres of the monthly allowance', cells: [off(fmtN(gNow.value.tier2), 'Government spokeswoman, via Digiato', gNow.url, gNow.as_of), off(fmtN(gBefore.value.tier2), 'Cabinet decision, via Nabz-e Bourse', gBefore.url, '2026-02-27')] },
      { label: 'Above the quota', sub: 'from 8 Sep', cells: [off(fmtN(gNow.value.tier3), 'Government spokeswoman, via Digiato', gNow.url, gNow.as_of, { note: `${chg(gNow.value.tier3, gBefore.value.tier3_station_card_or_above_quota)} vs before conflict` }), off(fmtN(gBefore.value.tier3_station_card_or_above_quota), 'Cabinet decision, via Nabz-e Bourse', gBefore.url, '2026-02-27')] },
    ],
    note: 'From 21 Mar the second-tier allowance for private cars was cut from 100 to 70 litres and banked fuel was capped. In the shortages of May, gasoline sold outside the stations at 80,000–200,000 tomans a litre in the south and east (Iran International, from viewers); no black-market price for Tehran was found.',
  };
  void bm;

  // Food prices.
  const F = X.food_prices.items;
  const u = (arr, re, d) => pick(arr, { src: re, date: d });
  const MEHR_B = /Mehr News weekly.*chain stores/, MEHR_N = /Mehr News weekly.*municipality/;
  const sec = (item, d) => F[item].second_unofficial_column.find((x) => x.as_of === d);
  const fc = (v, k, src, url, date, note) => C(range(v), k, src, url, date, note ? { note } : {});
  const ch = F.chicken, eg = F.eggs_tray_30, mi = F.milk, oi = F.cooking_oil, ri = F.rice, me = F.red_meat, po = F.potatoes, on = F.onions, to = F.tomatoes, br = F.bread;
  const chB = u(ch.unofficial, MEHR_B, '2026-02-22'), chN = u(ch.unofficial, MEHR_N, '2026-10-09'), chS = sec('chicken', '2026-05-20');
  const egB = u(eg.unofficial, MEHR_B, '2026-02-22'), egN = u(eg.unofficial, MEHR_N, '2026-10-09'), egS = sec('eggs_tray_30', '2026-09-14');
  const miB = u(mi.unofficial, MEHR_B, '2026-02-22'), miN = u(mi.unofficial, MEHR_N, '2026-10-09'), miS = sec('milk', '2026-09-14');
  const oiB = pick(oi.unofficial, { src: /Mehr News weekly/, date: '2026-02-01' }), oiN = u(oi.unofficial, MEHR_N, '2026-10-09'), oiS = sec('cooking_oil', '2026-05-20');
  const riB = u(ri.unofficial, MEHR_B, '2026-02-22'), riN = u(ri.unofficial, MEHR_N, '2026-10-09');
  const meB = u(me.unofficial, MEHR_B, '2026-02-22'), meN = u(me.unofficial, MEHR_N, '2026-10-09');
  const poB = pick(po.official, { src: /rate sheet \(nerkh-nameh\)/, date: '2026-02-22' }), poN = pick(po.official, { src: /rate sheet, as listed by IRNA/ }), poS = sec('potatoes', '2026-09-14');
  const onB = pick(on.official, { src: /rate sheet \(via Shargh/, date: '2026-02-22' }), onN = pick(on.official, { src: /Eghtesad Online/, date: '2026-10-10' });
  const toB = pick(to.official, { src: /rate sheet \(via Shargh/, date: '2026-02-22' }), toN = pick(to.official, { src: /Eghtesad Online/, date: '2026-10-10' });
  const brB = pick(br.official, { src: /Hamshahri daily/, val: { lavash: 1400, sangak: 7400, barbari: 5300, taftoon: 2300 } }), brN = pick(br.official, { src: /^same \(Hamshahri\)/ });
  const MEHR = 'Mehr News market survey', IP = 'Independent Persian, field survey', RATE = 'Tehran municipality rate sheet';
  const food = {
    type: 'table', title: 'Food prices in Iran', unit: 'tomans (1 toman = 10 rials)',
    cols: ['Item', 'Before conflict', 'Now', 'Shops'],
    rows: [
      { label: 'Chicken', sub: 'a kilo', cells: [fc(chB.value, 'unoff', MEHR, chB.url, '2026-02-22'), fc(fmtN(chN.value), 'unoff', MEHR, chN.url, '2026-10-09'), fc('450,000', 'unoff', IP, chS.url, chS.as_of, 'Tehran shops, 20 May')] },
      { label: 'Eggs', sub: 'a tray of 30', cells: [fc(egB.value, 'unoff', MEHR, egB.url, '2026-02-22'), fc(egN.value, 'unoff', MEHR, egN.url, '2026-10-09'), fc('600,000-750,000', 'unoff', IP, egS.url, egS.as_of, 'South Tehran shops, 14 Sep')] },
      { label: 'Milk', sub: 'a bottle of 946 g, low-fat', cells: [fc(fmtN(miB.value), 'unoff', MEHR, miB.url, '2026-02-22'), fc(miN.value, 'unoff', MEHR, miN.url, '2026-10-09'), fc('110,000', 'unoff', IP, miS.url, miS.as_of, 'Low-fat, south Tehran shops, 14 Sep')] },
      { label: 'Cooking oil', sub: 'a bottle of 810 g', cells: [fc(fmtN(oiB.value), 'unoff', MEHR, oiB.url, '2026-02-01', 'Survey of 1 Feb'), fc(oiN.value.cooking_810g, 'unoff', MEHR, oiN.url, '2026-10-09'), fc('520,000', 'unoff', IP, oiS.url, oiS.as_of, 'Ghoncheh liquid oil, 810 g, Tehran shops, 20 May')] },
      { label: 'Rice, imported', sub: 'a kilo', cells: [fc(riB.value.foreign, 'unoff', MEHR, riB.url, '2026-02-22'), fc(riN.value.foreign, 'unoff', MEHR, riN.url, '2026-10-09'), null] },
      { label: 'Frozen veal', sub: 'a kilo', cells: [fc(meB.value.frozen_veal, 'unoff', MEHR, meB.url, '2026-02-22'), fc(fmtN(meN.value.frozen_veal), 'unoff', MEHR, meN.url, '2026-10-09'), null] },
      { label: 'Potatoes', sub: 'a kilo, official rate', cells: [fc(fmtN(poB.value), 'off', RATE, poB.url, '2026-02-22'), fc(fmtN(poN.value), 'off', RATE, poN.url, '2026-10-10', '1–10 Oct'), fc('115,000', 'unoff', IP, poS.url, poS.as_of, 'South Tehran shops, 14 Sep')] },
      { label: 'Onions', sub: 'a kilo, yellow, official rate', cells: [fc(fmtN(onB.value.yellow), 'off', RATE, onB.url, '2026-02-22'), fc(fmtN(onN.value.yellow), 'off', RATE, onN.url, '2026-10-10'), null] },
      { label: 'Tomatoes', sub: 'a kilo, greenhouse, official rate; seasonal', cells: [fc(fmtN(toB.value.greenhouse), 'off', RATE, toB.url, '2026-02-22'), fc(fmtN(toN.value.greenhouse), 'off', RATE, toN.url, '2026-10-10'), null] },
      { label: 'Bread', sub: 'a lavash, official Tehran rate', cells: [fc(fmtN(brB.value.lavash), 'off', 'Tehran bakers\' guild, via Hamshahri', brB.url, '2026-02-27', 'Sangak 7,400'), fc(fmtN(brN.value.lavash), 'off', 'Tehran bakers\' guild, via Hamshahri', brN.url, '2026-10-04', 'Sangak 15,000; since late June'), null] },
    ],
    note: 'Mehr News\'s weekly survey priced chain stores and supermarkets until May, and the cheaper Tehran municipal markets since then, so the rise is understated: the central bank says those markets sell 8–27% below city shops. Shops: independent field checks in ordinary Tehran shops.',
  };

  // Wages.
  const wg = X.wages;
  const w04 = pick(wg.official, { src: /1404 decision/ }), w05 = pick(wg.official, { src: /Ekhtebar/ });
  const wages = {
    type: 'bars', title: 'Wages in Iran', unit: 'tomans a month, minimum base pay',
    bars: [
      { label: '1404', sub: '21 Mar 2025 – 20 Mar 2026', n: 10390968, c: off(fmtN(10390968), 'Supreme Labour Council, via Iran Estekhdam', w04.url, '2025-03-21', { note: `${fmtN(w04.value)} rials a day` }), pre: true },
      { label: '1405', sub: 'from 21 Mar 2026', n: 16625550, c: off(fmtN(16625550), 'Supreme Labour Council, via Ekhtebar', w05.url, '2026-03-15', { note: `${fmtN(w05.value)} rials a day; +60%` }) },
    ],
    note: 'The base pay rose 60%, while prices rose 89.8% in the year to Shahrivar (Statistical Centre). Workers\' representatives put a family\'s monthly living costs at 33–38 million tomans (Dey 1404).',
  };

  // Trade.
  const tr = X.trade.official[0];
  const trade = {
    type: 'table', title: "Iran's trade", unit: 'dollars, non-oil',
    cols: ['', '21 Mar – 16 Aug 2026', 'Change on a year earlier'],
    rows: [
      { label: 'Exports', cells: [off(`$${tr.value.exports}bn`, 'Iran Customs (IRICA) head, via Nabz-e Gheymat', tr.url, '2026-08-16'), off(`−${Math.abs(tr.value.exports_yoy_pct)}%`, 'Iran Customs (IRICA) head, via Nabz-e Gheymat', tr.url, '2026-08-16')] },
      { label: 'Imports', cells: [off(`$${tr.value.imports}bn`, 'Iran Customs (IRICA) head, via Nabz-e Gheymat', tr.url, '2026-08-16'), off(`−${Math.abs(tr.value.imports_yoy_pct)}%`, 'Iran Customs (IRICA) head, via Nabz-e Gheymat', tr.url, '2026-08-16')] },
    ],
    note: 'The first five months of the Iranian year. Customs has published no newer total.',
  };

  // TEDPIX.
  const tp = M.iran_tedpix;
  const tpPts = pts(tp.series_daily.points).filter((p) => p.d !== '2026-05-06');
  const tL = tpPts[tpPts.length - 1];
  if (tL.d !== tp.unofficial[0].as_of || tL.v !== tp.unofficial[0].value) fail('tedpix latest');
  const tW = weekBefore(tpPts, tL.d);
  const closure = X.tedpix.closures[0];
  const tedpix = span3('Tehran Stock Exchange', 'TEDPIX index, in points', 'Every company on the Tehran exchange, in rials', {
    latest: unoff(fmtN(tL.v), 'Nabz-e Bourse', tp.unofficial[0].url, tL.d),
    week: unoff(fmtN(Math.round(tW.v)), 'tgju.org', tp.series_daily.url, tW.d),
    before: unoff(fmtN(Math.round(tp.prewar_avg_28jan_27feb.value)), 'tgju.org', tp.prewar_avg_28jan_27feb.url, '2026-02-27', { note: `Average of ${tp.prewar_avg_28jan_27feb.n_closes} closes` }),
  }, { lv: tL.v, bv: tp.prewar_avg_28jan_27feb.value, series: tpPts.filter((p) => p.d >= '2026-01-28'), seriesUnit: 'TEDPIX',
    note: `The exchange was shut from 28 Feb and reopened on 19 May (Al Jazeera). The index is in rials: much of its rise reflects the falling rial.` });
  void closure;

  // Internet.
  const it = X.internet;
  const bo = pick(it.unofficial, { src: /^NetBlocks$/, date: '2026-05-26' }, 'blackout');
  const ap = pick(it.unofficial, { src: /^IODA \(Georgia Tech\)/, date: '2026-10-10' }, 'ioda');
  const gs = pick(it.unofficial, { src: /^IODA \(Google/, date: '2026-10-10' }, 'google');
  const internet = {
    type: 'table', title: 'Internet in Iran',
    cols: ['', 'Figure'],
    rows: [
      { label: 'Blackout', sub: '28 Feb – 26 May, at about 1% of normal', cells: [unoff('88 days', 'NetBlocks', bo.url, bo.as_of, { note: '2,093 hours, the longest nationwide shutdown on record' })] },
      { label: 'Networks answering now', sub: '% of the level before the war', cells: [unoff(`${ap.value}%`, 'IODA (Georgia Tech)', ap.url, ap.as_of)] },
      { label: 'Google searches from Iran now', sub: '% of the level before the war', cells: [unoff(`${gs.value}%`, 'IODA, Google data', gs.url, gs.as_of)] },
    ],
    note: 'Since 26 May the international internet is back but heavily filtered: WhatsApp and app stores are restricted, and traffic remains well below its level before January.',
    series: it.series_ioda.points.map((p) => ({ d: p.date, v: p.active_probing_pct })), seriesUnit: 'IODA, % of networks answering',
  };
  return { key: 'econ', name: 'Economy', boxes: [shekel, ta, gulf, exchanges, rial, coin, inflation, gasoline, food, wages, trade, tedpix, internet] };
}

/* ======================================================================
 * Nuclear
 * ==================================================================== */
function nuclear() {
  const N = R.mkt3, NS = R.ns2;
  const u60 = pick(N.uranium_stock_60pct.official, { src: /^IAEA GOV\/2026\/8/, date: '2025-06-13' }, 'u60');
  const uk = pick(N.uranium_stock_60pct.official, { src: /^UK Government/, date: '2026-09-08' }, 'uk');
  const esl = N.fate_of_60pct_stock.official.find((e) => /Eslami/.test(e.source) && e.as_of === '2026-10-08');
  if (!esl) fail('Eslami');
  const uranium = {
    type: 'stat', title: 'Uranium enriched to 60%',
    value: off('440.9 kg', 'IAEA', u60.url, u60.as_of, { note: '432.9 kg of it verified' }),
    caption: 'last measured by the IAEA, 13 Jun 2025',
    note: `Nobody has verified it since. The UK government said "over 400 kg" on 8 Sep 2026. On 8 Oct the head of Iran's atomic energy organisation, Mohammad Eslami, said Iran would not hand it over.`,
  };
  void uk;
  const sites = NS.sites_struck.slice().sort((a, b) => lastDate(b.date).localeCompare(lastDate(a.date)));
  const sitesBox = {
    type: 'list', title: 'Nuclear sites struck', cls: 'nuke',
    cols: [['Date', 'd'], ['Site', 'l'], ['By', 'l'], ['What happened', 'l w']],
    rows: sites.map((s) => [C(showDates(s.date), s.official ? 'off' : 'unoff', s.source || 'Media report', s.url, lastDate(s.date)), s.site, cap(s.by), cap(s.detail)]),
    note: 'No strike on a nuclear site was reported in September or October.',
  };
  const li = NS.last_inspection;
  const days = Math.round((Date.parse(AS_OF) - Date.parse(li.date)) / 864e5);
  if (days !== li.days_since_as_of_2026_10_11) fail(`days ${days}`);
  const vote = pick(N.iaea_access.official, { src: /Arms Control Association/, date: '2026-09-09' }, 'vote');
  const iaea = {
    type: 'stat', title: 'IAEA inspectors in Iran',
    value: off(`${days} days`, 'IAEA June report, via AP', li.url, li.date),
    caption: 'since the last IAEA inspection: Bushehr, 1–3 Jun 2026',
    note: `No later visit was found. The sites bombed in June 2025 have had no inspection since, and Iran's parliament has barred access to them. On 9 Sep the IAEA Board voted 23 to 3, with 8 abstentions, to report Iran to the UN Security Council.`,
  };
  void vote;
  return { key: 'nuke', name: 'Nuclear', boxes: [uranium, sitesBox, iaea] };
}

/* ======================================================================
 * Sanctions
 * ==================================================================== */
function sanctions() {
  const N = R.mkt3, NS = R.ns2;
  const d = N.us_treasury_designations;
  const all = pick(d.unofficial, { val: 721 }, '721'), fury = pick(d.unofficial, { val: 469 }, '469'), outc = pick(d.unofficial, { val: 236 }, '236');
  const us = NS.us_sanctions.slice().sort((a, b) => b.date.localeCompare(a.date));
  const usBox = {
    type: 'list', title: 'US sanctions on Iran and Hezbollah', cls: 'sanc',
    cols: [['Date', 'd'], ['Who', 'l'], ['Why', 'l w']],
    rows: us.map((s) => [C(dm(s.date), s.official ? 'off' : 'unoff', 'US Treasury', s.url, s.date), s.who, s.why]),
    stats: [[unoff(String(all.value), 'Our count of OFAC notices', all.url, all.as_of), 'Since 28 Feb'], [unoff(String(fury.value), 'Our count of OFAC notices', fury.url, fury.as_of, { note: '15 Apr – 23 Aug' }), 'Economic Fury'], [unoff(String(outc.value), 'Our count of OFAC notices', outc.url, outc.as_of, { note: '24 Aug – 8 Oct' }), 'Economic Outcast']],
    note: 'People, firms, ships and aircraft added to the US blacklist, by our count of OFAC notices. The Treasury\'s last own total, on 1 May: more than 1,000 since February 2025.',
  };
  const ef = NS.economic_fury;
  const meas = ef.measures.filter((m) => !/naval blockade/.test(m.kind) && m.date >= '2026-04-13');
  const rows = meas.map((m) => ({ d: m.date.length === 7 ? `${m.date}-01` : m.date, show: m.date.length === 7 ? MON[+m.date.slice(5, 7) - 1] : dm(m.date), k: m.official ? 'off' : 'unoff', url: m.url, text: m.measure }));
  rows.push({ d: '2026-04-15', show: '15 Apr', k: 'off', url: 'https://home.treasury.gov/news/press-releases/sb0443', text: 'Economic Fury: the first sanctions under the name (the Shamkhani oil-shipping network)' });
  rows.push({ d: ef.successor.start, show: dm(ef.successor.start), k: 'off', url: ef.successor.url, text: 'Operation Economic Outcast launched' });
  rows.sort((a, b) => b.d.localeCompare(a.d) || (/launched/.test(a.text) ? -1 : 1));
  const outcast = {
    type: 'list', title: 'Economic Outcast', cls: 'sanc',
    cols: [['Since', 'd'], ['Measure', 'l w']],
    rows: rows.map((r) => [C(r.show, r.k, r.k === 'off' ? 'US Treasury' : 'Media report', r.url, r.d), cap(r.text)]),
    note: 'The Treasury\'s two pressure campaigns: Economic Fury from 15 Apr and Operation Economic Outcast from 24 Aug. The sanctions on named people, firms and ships are in the box before.',
  };
  const eu = N.eu_sanctions.official, uk = N.uk_sanctions.official;
  const e = (d) => pick(eu, { date: d, unit: /listings/ }, `eu ${d}`);
  const e16 = e('2026-03-16'), e8 = e('2026-06-08'), e24 = e('2026-07-24'), e30 = e('2026-07-30'), eT = pick(eu, { val: 30 }, 'eu total');
  const u11 = pick(uk, { date: '2026-05-11' }), u13 = pick(uk, { date: '2026-07-13', val: 1 }), uT = pick(uk, { val: 13 });
  const euuk = {
    type: 'table', title: 'EU and UK listings since 28 Feb', unit: 'people and firms',
    cols: ['', 'New listings'],
    rows: [
      { label: 'EU, 16 Mar', sub: 'human rights', cells: [off('19', 'Council of the EU', e16.url, e16.as_of)] },
      { label: 'EU, 8 Jun', sub: 'Strait of Hormuz', cells: [off('3', 'Council of the EU', e8.url, e8.as_of)] },
      { label: 'EU, 24 Jul', sub: 'human rights', cells: [off('6', 'Council of the EU', e24.url, e24.as_of)] },
      { label: 'EU, 30 Jul', sub: 'nuclear: MAPNA Group and Ali Ansari', cells: [off('2', 'EU Official Journal', e30.url, e30.as_of)] },
      { label: 'EU, total', cells: [off(String(eT.value), 'Our sum of the Council\'s releases', eT.url, eT.as_of, { note: 'None since August' })] },
      { label: 'UK, 11 May', sub: '3 firms and 9 people', cells: [off(String(u11.value), 'UK Foreign Office', u11.url, u11.as_of)] },
      { label: 'UK, 13 Jul', sub: 'a criminal group linked to Iran', cells: [off(String(u13.value), 'UK Foreign Office', u13.url, u13.as_of)] },
      { label: 'UK, total', cells: [off(String(uT.value), 'UK sanctions list', uT.url, uT.as_of)] },
    ],
    note: 'On 13 Jul the UK also listed the IRGC under its State Threats Act, and on 8 Sep it laid sector bans on energy, shipping, banking, gold and more, and barred Iranian aircraft from landing.',
  };
  const old = NS.older_sanctions.slice().sort((a, b) => b.date.localeCompare(a.date));
  const older = {
    type: 'list', title: 'Older sanctions on Iran still in force', cls: 'sanc',
    cols: [['Since', 'd'], ['Measure', 'l w'], ['By', 'l']],
    rows: old.map((o) => [C(`${MON[+o.date.slice(5, 7) - 1]} ${o.date.slice(0, 4)}`, o.official ? 'off' : 'unoff', o.by, o.url, o.date), o.measure, o.by]),
  };
  return { key: 'sanc', name: 'Sanctions', boxes: [usBox, outcast, euuk, older] };
}

/* ---------- build, check, write ---------- */
const out = { asOf: AS_OF, sets: [casualties(), maritime(), energy(), economy(), nuclear(), sanctions()] };

const KS = new Set(['off', 'unoff']), QS = new Set(['at least', 'about', 'more than']);
let nCells = 0, noUrl = [];
function checkCell(c, where) {
  if (c === null) return;
  nCells++;
  if (typeof c.v !== 'string' || !c.v) problems.push(`${where}: v`);
  if (!KS.has(c.k)) problems.push(`${where}: k`);
  if (!isoRe.test(c.date || '')) problems.push(`${where}: date ${c.date}`);
  if (c.q && !QS.has(c.q)) problems.push(`${where}: q ${c.q}`);
  if (!c.url) noUrl.push(`${where}: ${c.src}`);
  if (!c.src) problems.push(`${where}: src`);
}
for (const s of out.sets) for (const b of s.boxes) {
  const w = `${s.key}/${b.title}`;
  if (b.type === 'claims') b.rows.forEach((r) => { checkCell(r.off, `${w}/${r.label}/off`); checkCell(r.unoff, `${w}/${r.label}/unoff`); });
  else if (b.type === 'span3') ['latest', 'week', 'before'].forEach((k) => checkCell(b[k], `${w}/${k}`));
  else if (b.type === 'table') b.rows.forEach((r) => { if (r.cells.length !== b.cols.length - 1) problems.push(`${w}/${r.label}: cells`); r.cells.forEach((c, i) => checkCell(c, `${w}/${r.label}/${i}`)); });
  else if (b.type === 'bars') b.bars.forEach((x) => { if (!Number.isFinite(x.n)) problems.push(`${w}/${x.label}: n`); checkCell(x.c, `${w}/${x.label}`); });
  else if (b.type === 'stat') checkCell(b.value, w);
  else if (b.type === 'list' || b.type === 'incidents') {
    b.rows.forEach((r, i) => { if (r.length !== b.cols.length) problems.push(`${w}/${i}: cols`); r.forEach((c, j) => { if (c && typeof c === 'object') checkCell(c, `${w}/${i}/${j}`); }); });
    (b.stats || []).forEach(([c, l]) => checkCell(c, `${w}/stat ${l}`));
  } else problems.push(`${w}: type ${b.type}`);
  if (b.series) b.series.forEach((p) => { if (!isoRe.test(p.d) || !Number.isFinite(p.v)) problems.push(`${w}: series point ${JSON.stringify(p)}`); });
  const pointsN = (b.series || []).length;
  if (b.series && pointsN < 3) problems.push(`${w}: series has ${pointsN} points`);
}
// Food prices in thousands of tomans: six-digit prices broke across lines on a phone.
for (const s of out.sets) for (const b of s.boxes) {
  if (!/^Food prices in Iran/.test(b.title)) continue;
  b.unit = 'thousand tomans (1 toman = 10 rials)';
  for (const r of b.rows) for (const c of r.cells) if (c && c.v != null) c.v = String(c.v).replace(/\d{1,3}(?:,\d{3})+|\d{4,}/g, (n) => { const x = Number(n.replace(/,/g, '')) / 1000; return x >= 1000 ? x.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(+x.toFixed(1)); });
}
// The user's pass of 11 Oct: one rate source for the rial and the coin (tgju, which updates through the
// trading day), no wages box, inflation read by its calendar months, the food and sanctions boxes
// explained, and notes kept to what is needed to read a figure (no "nothing newer was published").
const NOTES = {
  'Killed': '',
  'Injured': '',
  'Incidents': '',
  'Ships through the Strait of Hormuz': 'Each counts differently: the IMO averages several sources; Windward adds ships with their transponders off; Kpler sees only ships that broadcast their position. Before the war: about 125 a day (Clarksons).',
  'Crude oil through the Strait of Hormuz': 'Kpler, which counts differently, put it at 8.5 in the week to 7 Oct, against 13.5 before the war.',
  'LNG through the Strait of Hormuz': 'The US EIA: 10.5 billion cubic feet a day before the war (late 2025), 0.8 in April – June.',
  'War-risk insurance for a Gulf voyage': 'The highest quote a broker put its name to: 7.5–10% (Marsh, 22 Jul).',
  'Ships and crews stranded in the Gulf': '',
  'Attacks on energy sites': 'Ministries reported more strikes on energy sites without naming them. Attacks on ships are under Maritime.',
  "Iran's crude oil production": 'Iran has reported no output to OPEC since the war began: these are outside estimates (OPEC\'s secondary sources, the US EIA).',
  "Iran's gas": 'The oil ministry said half the damaged capacity was back by 22 Sep.',
  "Iran's crude oil exports": 'Loadings at Iranian terminals, counted by trackers. Iran\'s only word: "we are not exporting oil" (the central bank governor, 19 Aug).',
  'Gulf crude oil exports': 'TankerTrackers put May at 67% below January – February, and August at 39% below.',
  'Gulf crude oil exports by country': 'Official: each government\'s monthly figure (JODI, Iraq\'s oil ministry, Oman\'s statistics centre); the UAE and Qatar publish none for 2026. Unofficial: TankerTrackers, August against January – February.',
  'Crude oil price': 'Dated Brent, the price of cargoes loading in the next weeks: $125.44 on 6 Oct (US EIA), against $70.95 before the war.',
  'Petrol prices at the pump': 'Saudi Arabia and Oman cap their prices.',
  'Gulf exchanges': 'Change since each exchange\'s last close before the war.',
  "The rial's open-market rate": '',
  'Gold coin in Tehran': '',
  "Iran's inflation": 'The central bank, which counts towns only, puts the latest month at 83.8%.',
  'Gasoline prices in Iran': '',
  'Food prices in Iran': 'Since May, Mehr has priced the cheaper municipal markets (8–27% below shops, the central bank says), so "Now" is below what shops charge.',
  "Iran's trade": '',
  'Tehran Stock Exchange': 'Shut from 28 Feb to 19 May. The index is in rials: much of its rise is the falling rial.',
  'Internet in Iran': 'Since 26 May the international internet is back, heavily filtered.',
  'Uranium enriched to 60%': 'Not verified since. Iran\'s atomic energy chief, Mohammad Eslami, said on 8 Oct that Iran would not hand it over.',
  'Nuclear sites struck': '',
  'IAEA inspectors in Iran': 'The sites bombed in June 2025 have had no inspection since. On 9 Sep the IAEA Board voted to report Iran to the UN Security Council.',
  'US sanctions on Iran and Hezbollah': 'People, firms, ships and aircraft added to the US blacklist, by our count of OFAC notices.',
  'Economic Outcast': 'The Treasury\'s two campaigns: Economic Fury from 15 Apr and Operation Economic Outcast from 24 Aug.',
  'EU and UK listings since 28 Feb': 'The UK also listed the IRGC under its State Threats Act (13 Jul) and banned trade with Iran in energy, shipping, banking and gold (8 Sep).',
};
for (const s of out.sets) {
  s.boxes = s.boxes.filter((b) => b.title !== 'Wages in Iran');
  for (const b of s.boxes) {
    if (b.title in NOTES) { if (NOTES[b.title]) b.note = NOTES[b.title]; else delete b.note; }
    // The Houthi front is the Yemen desk's (user, 12 Oct): the casualty boxes link to its casualties, and
    // Saudi Arabia's row and the link carry one asterisk.
    if (b.title === 'Killed' || b.title === 'Injured') b.link = { text: 'Saudi casualties in the Yemen conflict', href: '/yemen-conflict-desk#n=cas', mark: '*', on: ['Saudi Arabia'] };
    if (b.title === "The rial's open-market rate" || b.title === 'Gold coin in Tehran') {
      const [latest, week, before] = b.rows.find((r) => r.label === 'tgju').cells;
      const change = String(latest.note || '').replace(/ vs before conflict$/, '');
      Object.assign(b, { type: 'span3', why: b.why || 'The open-market rate, sell side (tgju.org)', latest: { ...latest, note: undefined }, week, before: { ...before, note: undefined }, change, beforeNote: 'average' });
      delete b.rows; delete b.cols;
    }
    if (b.title === "The rial's open-market rate") b.seriesUnit = 'rials to the dollar';
    if (b.title === 'Gold coin in Tehran') b.seriesUnit = 'million rials';
    if (b.title === "Iran's inflation") {
      b.title = "Iran's inflation, year on year";
      b.unit = 'consumer prices against the same month a year before';
      b.why = 'Each bar is one Iranian month: 89.8% means what cost 100 a year earlier cost 189.8 (Statistical Centre of Iran)';
      b.bars = b.bars.map((x) => ({ ...x, label: x.pre ? 'Before the war' : x.sub, sub: x.pre ? `${x.sub} (Bahman)` : x.label }));
    }
    if (b.title === 'Food prices in Iran') {
      b.cols = ['Item', 'Before the war', 'Now', 'Shop check'];
      b.why = 'Tehran prices. Before the war (22 Feb) and Now (9–10 Oct): Mehr News\'s weekly market survey, or the city\'s official rate where marked. Shop check: what Independent Persian\'s reporters paid in ordinary Tehran shops, on the date in the row';
    }
    if (b.title === 'EU and UK listings since 28 Feb') {
      b.title = 'EU and UK sanctions since 28 Feb';
      b.unit = 'people and firms put under sanctions';
      b.why = 'Each row is one decision: the people and firms it named have their assets frozen and may not travel to the EU or the UK';
      b.cols = ['', 'Named'];
    }
  }
}
// The older sanctions in two columns, each measure in a line or two (user, 11 Oct: too dense).
const OLDER = [
  ['EU', 'The IRGC on the EU terrorist list'],
  ['EU', 'All EU nuclear sanctions back: the central bank and big banks frozen, oil, gas, gold and diamonds trade banned'],
  ['UK', 'UN sanctions back in UK law: 121 people and firms'],
  ['UN', 'UN "snapback": the arms embargo, the enrichment ban, asset freezes and travel bans back in force'],
  ['US', '"Maximum pressure" restored, to drive Iran\'s oil exports to zero'],
  ['US', 'Sanctions on whole sectors (construction, mining, manufacturing, textiles, later oil and petrochemicals)'],
  ['US', 'Sanctions on the Supreme Leader and his office'],
  ['US', 'The IRGC listed as a terrorist organisation'],
  ['US', 'All US nuclear sanctions back: oil, banking, shipping'],
  ['US', 'The US leaves the nuclear deal'],
  ['US', 'Hezbollah listed as a terrorist organisation'],
];
for (const s of out.sets) for (const b of s.boxes) {
  if (b.title !== 'Older sanctions on Iran still in force') continue;
  if (b.rows.length !== OLDER.length) problems.push('Older sanctions: rows changed, update OLDER');
  b.cols = [['Since', 'd'], ['By', 'l'], ['Measure', 'l w']];
  b.rows = b.rows.map((r, i) => [r[0], OLDER[i][0], OLDER[i][1]]);
}
// The weapon on every attack, and an energy site's present working state, not who reported it or that
// it was a claim (user, 12 Oct). Read row by row from S/n4 (energy-*.out.json, ships-*.out.json), each
// row matched by its date and site as dumped in S/n4/*-rows.json.
{
  const n4 = (f) => (fs.existsSync(path.join(S, 'n4', f)) ? load(`n4/${f}`) : []);
  // Each row with its research, [row, finding], by its place in the list (its date and site checked).
  const research = (kind, list) => {
    const dumped = n4(`${kind}-rows.json`);
    const byI = new Map([...n4(`${kind}-a.out.json`), ...n4(`${kind}-b.out.json`)].map((o) => [o.i, o]));
    return list.map((r, i) => {
      const d = dumped[i];
      if (!d || (d.first && d.first.date) !== (r[0] && r[0].date) || d.site !== r[1]) { problems.push(`${kind}: row ${i} is not the row researched`); return [r, undefined]; }
      return [r, byI.get(i)];
    });
  };
  const lc = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());
  const ATT = { 'US/Israel': 'US and Israel', 'Iraqi militias': 'Iraqi militias' };
  // Both halves of a box's research, or none of it.
  const ready = (kind) => ['a', 'b'].every((h) => fs.existsSync(path.join(S, 'n4', `${kind}-${h}.out.json`)));
  for (const s of out.sets) for (const b of s.boxes) {
    if (b.title === 'Attacks on energy sites' && ready('energy')) {
      const R4 = research('energy', b.rows);
      let miss = 0;
      b.cols = [['Date', 'd'], ['Site', 'l'], ['By', 'l'], ['Weapon', 'l'], ['Current state', 'l w']];
      // A row the readers found was no attack (Ras Tanura, 28 Jun: a helicopter crash), or an unconfirmed claim of the Houthi front (the Yemen desk's), leaves the list.
      b.rows = R4.filter(([, o]) => !(o && o.confirmed === false && /helicopter crash|not an attack|Yemeni|Houthi/i.test(o.note || ''))).map(([r, o]) => {
        if (!o) { miss++; return [r[0], r[1], String(r[2]).replace(/^Claimed by .*/, 'Not stated').split(';')[0], 'Not stated', { ...r[3], note: undefined }]; }
        const date = o.confirmed === false ? { ...r[0], note: 'Reported by one source only' } : { ...r[0], note: undefined };
        const by = o.attacker && !/^unknown/i.test(o.attacker) ? ATT[o.attacker] || o.attacker : 'Not stated';
        const st = C(lc(o.status), 'unoff', hostOf(o.status_url), o.status_url || null, o.status_date || r[0].date);
        return [date, r[1], by, lc(o.weapon) || 'Not stated', st];
      });
      if (miss) problems.push(`energy: ${miss} rows without research`);
      // The counts over the list as it now stands, with no attacks-and-claims split.
      const w7 = new Date(Date.parse(AS_OF) - 6 * 864e5).toISOString().slice(0, 10);
      const cnt = (f, l) => [unoff(String(b.rows.filter(f).length), 'Our count of the list below', null, AS_OF, { note: 'count of the list below' }), l];
      b.stats = [cnt((r) => r[0].date === AS_OF, 'Today'), cnt((r) => r[0].date >= w7, 'Last 7 days'), cnt(() => true, 'Since 28 Feb')];
    }
    if (b.title === 'Incidents' && ready('ships')) {
      const R4 = research('ships', b.rows);
      let miss = 0;
      b.cols = [['Date', 'd'], ['Ship', 'l'], ['Location', 'l'], ['Weapon', 'l'], ['What happened', 'l w']];
      // A row the readers found was another row's attack (a Windward cargo ship that was CAPE DAO) leaves the list.
      b.rows = R4.filter(([r, o]) => !(o && r[0].k === 'unoff' && /\bsame (?:attack|incident) as\b/i.test(o.fix || ''))).map(([r, o]) => {
        if (!o) { miss++; return [r[0], r[1], r[2], 'Not stated', r[3]]; }
        return [r[0], r[1], r[2], lc(o.weapon) || 'Not stated', o.fix ? lc(o.fix) : r[3]];
      });
      if (miss) problems.push(`ships: ${miss} rows without research`);
      const w7 = new Date(Date.parse(AS_OF) - 6 * 864e5).toISOString().slice(0, 10);
      const cnt = (f, l, note) => [unoff(String(b.rows.filter(f).length), 'Our count of the list below', b.stats[2][0].url, AS_OF, { note }), l];
      b.stats = [cnt((r) => r[0].date === AS_OF, 'Today', b.stats[0][0].note), cnt((r) => r[0].date >= w7, 'Last 7 days', b.stats[1][0].note), cnt(() => true, 'Since 28 Feb', b.stats[2][0].note)];
    }
  }
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'Source'; } }
const ships = out.sets[1].boxes[1];
if (ships.rows.some((r) => /Hormuz/.test(r.label))) problems.push('Ships rows name Hormuz');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
console.log(`wrote ${OUT}: ${out.sets.map((s) => `${s.key} ${s.boxes.length}`).join(', ')}; ${nCells} cells`);
console.log(`cells without a url (${noUrl.length}):\n  ${noUrl.slice(0, 40).join('\n  ')}`);
