// The researched pins' corrections (user, 17 Oct: every pin checked, no duplicate, each in its right place,
// side and day). Run by map-pack.cjs on the baseline before every build, so they are rules, not hand edits.
// Found by the audit of 17 Oct (side-session notes, iran-researched-audit.md).
const countryAt = require('./country-at.cjs');

const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));
const inLebanon = (p) => countryAt(p.lat, p.lng) === 'Lebanon';
/** A name's skeleton: "Al-Mansouri" and "Al Mansuri", "Zibqin" and "Zebqine", "Qasrdasht" and "Qasr-e Dasht" are one. */
function skeleton(name) {
  return String(name || '').split(',')[0].toLowerCase()
    .replace(/^(?:al|el|ad|as|ash|ar|at|az|an)[- ]/, '').replace(/[-\s'`’]+(?:e|al|el)[-\s]/g, '')
    .replace(/ou/g, 'u').replace(/q/g, 'k').replace(/[^a-z]/g, '').replace(/[aeiouy]/g, '').replace(/(.)\1+/g, '$1');
}
const SIDES_OK = (a, b) => !a || !b || a === 'unclear' || b === 'unclear' || a === b;
const tme = (u) => /^https?:\/\/t\.me\/(?:s\/)?([\w]+)\/(\d+)/i.exec(String(u || ''));

/** The usual point of each place name: the one most of its pins share. */
function usualPoints(base) {
  const m = new Map();
  for (const p of base) {
    const k = String(p.place || '').toLowerCase().trim();
    if (!k) continue;
    const at = `${p.lat},${p.lng}`;
    const c = m.get(k) || new Map();
    c.set(at, (c.get(at) || 0) + 1);
    m.set(k, c);
  }
  const out = new Map();
  for (const [k, c] of m) {
    const total = [...c.values()].reduce((s, n) => s + n, 0);
    const [at, n] = [...c].sort((a, b) => b[1] - a[1])[0];
    out.set(k, { lat: Number(at.split(',')[0]), lng: Number(at.split(',')[1]), n, total });
  }
  return out;
}

// Israeli troops' demolition charges (تفجير) Ali Shoaib's page reports, read as "Explosions heard" (157 pins, Jul–Oct).
const HEARD = /^(?:Explosions?|Blasts?|A blast|An explosion)\s+(?:heard|reported)\s+(?:in|at|near|on)\s+/i;
// Its own air defence downing another's drone is no strike by that other ("IRGC says it shot down a US drone").
const DOWNED = /\b(?:says it shot down|shoots? down|shot down|downs|downed|intercept\w*)\s+(?:an?\s+|the\s+|two\s+|\d+\s+)?(?:US|U\.S\.|American|Israeli|MQ-9|Hermes|Reaper)\b/i;
// What is no attack: footage, its aftermath, a crash, a seizure, a later report, a household blast.
const NOT_EVENT = /\b(?:footage|video|published (?:a )?video|effects of the (?:air ?)?strikes|fires? (?:continue|still)\s+(?:to\s+)?burn\w*|destroyed buildings (?:were )?seen|crashed|ship seized|seizes? (?:a |the )?(?:ship|tanker|vessel)|previous nights|gas cylinder|house blew up|domestic)\b/i;
/*
 * A Gulf state's own attack (user, 20 Oct: "return the gulf states as a side in purple ... and add their pins for
 * attacks they did"): a strike, a raid or jets a Gulf state flies, alone or beside the US ("US and Saudi jets strike
 * militia sites in eastern Iraq", "US-Saudi strikes hit PMF positions"), or a strike later laid at its door
 * ("attributed to the UAE"). Not its air defence: a missile it shoots down is the attacker's. The same words as
 * src/lib/desk/iran-places.ts GULF_ATTACK, which serves the live pins.
 */
const GULF_ATTACK = /\b(?:(?:US|U\.S\.|American)(?:\s+and\s+|-)(?:Saudi|Emirati|UAE|Qatari|Bahraini|Kuwaiti|Omani)|Saudi(?:[- ]led)?|Emirati|UAE|Qatari|Bahraini|Kuwaiti|Omani|(?<!Persian |Arabian )Gulf)\s+(?:(?:fighter|war|air|drone|naval)\s+)?(?:jets?|warplanes?|planes?|aircraft|air ?strikes?|strikes?|raids?|bombing|bombardment|artillery|shelling|helicopters?|drone strikes?|forces?\s+(?:strike|struck|hit|bomb\w*|attack\w*|shell\w*|raid\w*))\b|\b(?:attributed|blamed)\s+(?:on|to)\s+(?:the\s+)?(?:UAE|Emirates|Saudi Arabia|Saudis|Qatar|Bahrain|Kuwait|Oman)\b|\b(?:Saudi Arabia|the UAE|Emirates|Qatar|Bahrain|Kuwait|Oman)\s+(?:strikes|struck|bombs|bombed|shells|shelled|raids|raided|launch(?:es|ed)\s+(?:air ?)?strikes)\b/;
// Words before a name that make it the target: "strike on Saudi jets" is no Saudi strike.
const GULF_TARGET_BEFORE = /\b(?:on|at|against|targeting|targets?|hits?|hit|struck|over|into|toward|towards)\s+(?:the\s+|a\s+|an\s+)?$/i;
function gulfAttack(label) {
  const s = String(label || '');
  const m = GULF_ATTACK.exec(s);
  return !!m && !GULF_TARGET_BEFORE.test(s.slice(Math.max(0, m.index - 20), m.index));
}
// A country, a province or a region, and names any base or site may carry.
const AREA = /\b(?:iran|iraq|kuwait|saudi arabia|jordan|qatar|bahrain|oman|uae|emirates|syria|lebanon|israel|cyprus|turkey|province|governorate|region|district|plains?|valley|northern|southern|eastern|western|central|north|south|east|west|anbar|basra|nineveh|diyala|kirkuk|erbil|sulaymaniyah|kurdistan|bushehr|hormozgan|khuzestan|lorestan|kermanshah|fars|isfahan province|tehran province|bekaa)\b/i;
const GENERIC = /\b(?:target|base|site|camp|facility|headquarters|hq|gulf|sea|strait|place not stated|area)\b/i;
// قصف is bombing: far from the border, "shelling" of Beirut or Byblos was an air strike.
const SHELLING = /\bshelling\b/i;

/*
 * A pin outside the war's countries (user, 18 Oct: "Attack on Arsin, Trabzon", Turkey, no side named, Fars):
 * shown only when it names who attacked and hits a target of this war (a base, an embassy, a ship, an
 * airport, a port, missiles brought down). The war's countries: Iran, Iraq, Israel and the Palestinian areas,
 * Lebanon, Syria, the Gulf states, Jordan, Yemen; and the sea.
 */
const WAR_COUNTRIES = new Set(['Iran', 'Iraq', 'Israel', 'Lebanon', 'Syria', 'Saudi Arabia', 'Qatar', 'Oman', 'Kuwait', 'Jordan', 'United Arab Emirates', 'Bahrain']);
const AT_SEA = /\b(?:sea|gulf|strait|ocean|offshore|off the coast|coast of|ships?|tankers?|vessels?|nautical|NM)\b/i;
const WAR_TARGET = /\b(?:air ?bases?|bases?|RAF|NATO|Incirlik|K[uü]recik|Akrotiri|embass(?:y|ies)|consulates?|radars?|military|troops|airports?|airfields?|runways?|ports?|ships?|tankers?|vessels?|LNG|FSRU|gas storage|intercept\w*|downed|shot down|ballistic missiles?|debris from intercepted)\b/i;
function warPinAllowed(p) {
  const country = countryAt(p.lat, p.lng);
  const s = `${p.label || ''} ${p.place || ''}`;
  if (country ? WAR_COUNTRIES.has(country) : AT_SEA.test(s) || (p.lat > 10 && p.lat < 40 && p.lng > 30 && p.lng < 65)) return true;
  // Who attacked is the pin's side: one not stated is no named attacker.
  return !!p.actor && p.actor !== 'unclear' && p.actor !== 'other' && WAR_TARGET.test(s);
}

function fixBase(base, log = () => {}) {
  const usual = usualPoints(base);
  // The cities, by name: a name with ten pins or more on one point.
  const cities = [...usual].filter(([k, u]) => u.n >= 10 && !/[,(]/.test(k) && k.length >= 4).sort((a, b) => b[0].length - a[0].length);
  const n = { demolition: 0, downed: 0, gulf: 0, notEvent: 0, offWar: 0, offWarDropped: [], city: 0, stray: 0, shelling: 0, day: 0, twin: 0 };
  let rows = base.map((p) => ({ ...p }));

  // Days out of their channel's post order (a post of 2 May dated "2/4" put 38 pins on 2 April).
  const byCh = new Map();
  // Only Ali Shoaib's page: its daily summaries carry their own date, read day-for-month ("2/4" for 2 May);
  // another channel's later post is often a later report of an earlier attack, and keeps its day.
  for (const p of rows) { const m = tme(p.url); if (m && /^alichoeib1970$/i.test(m[1])) { const k = m[1].toLowerCase(); if (!byCh.has(k)) byCh.set(k, []); byCh.get(k).push({ id: Number(m[2]), p }); } }
  for (const list of byCh.values()) {
    const ids = [...new Map(list.map((x) => [x.id, x.p.day])).entries()].sort((a, b) => a[0] - b[0]);
    for (const x of list) {
      const i = ids.findIndex(([id]) => id === x.id);
      const before = ids.slice(Math.max(0, i - 3), i).map(([, d]) => d), after = ids.slice(i + 1, i + 4).map(([, d]) => d);
      if (before.length < 2 || after.length < 2) continue;
      const lo = before.sort()[0 + Math.floor(before.length / 2)], hi = after.sort()[Math.floor(after.length / 2)];
      const dlo = Date.parse(lo), dhi = Date.parse(hi), d = Date.parse(x.p.day);
      // Its neighbours agree (within two days) and it lies more than two days outside them.
      if (dhi - dlo > 2 * 864e5 || dhi < dlo) continue;
      // The day of the post just before it, or just after when that is the day both sides share.
      const prev = ids[i - 1][1], next = ids[i + 1][1];
      if (d < dlo - 2 * 864e5 || d > dhi + 2 * 864e5) { x.p.day = prev === next ? prev : next <= prev ? prev : next === hi ? next : prev; x.p.at = undefined; n.day++; }
    }
  }

  rows = rows.filter((p) => {
    const label = String(p.label || '');
    if (NOT_EVENT.test(label)) { n.notEvent++; return false; }
    if (!warPinAllowed(p)) { n.offWar++; n.offWarDropped.push(p.fp); return false; }
    return true;
  });
  for (const p of rows) {
    const label = String(p.label || '');
    if (/Ali Shoaib/i.test(String(p.source || '')) && HEARD.test(label) && inLebanon(p)) {
      p.label = `Israeli forces blow up buildings in ${String(p.place || '').split(',')[0]}`;
      p.actor = 'israel';
      n.demolition++;
    }
    if (DOWNED.test(label) && p.actor !== 'unclear' && /\b(?:Iran|IRGC|Iranian|Hezbollah|Houthi|Iraqi|Kuwait\w*|Saudi|Emirati|Bahrain\w*|Qatar\w*|Jordan\w*)\b/.test(label) && !/\b(?:strike|struck|attack\w*)\s+(?:on|in)\b/i.test(label)) { p.actor = 'unclear'; n.downed++; }
    // A Gulf state's own strike, alone or with the US, is the Gulf states' pin (user, 20 Oct).
    if (p.actor !== 'gulf' && gulfAttack(label)) { p.actor = 'gulf'; n.gulf++; }
    if (SHELLING.test(p.label) && inLebanon(p) && p.lat > 33.42 && !/\bartillery\b/i.test(p.label)) { p.label = p.label.replace(/\bshelling\b/i, 'strike'); n.shelling++; }
    // A place named after its city ("Bahonar port, Bandar Abbas", "Tehran District 22") sits within 40 km of that city.
    const place = String(p.place || '').toLowerCase();
    // (Not a country, a province or a region: "Dayyer, Bushehr" is in Bushehr province, 175 km from its city.)
    // The city after the last comma when there is one ("Karbala HQ, Ahvaz" is Ahvaz's); never "Camp Doha" (Kuwait's).
    const tail = place.includes(',') ? place.slice(place.lastIndexOf(',') + 1).trim() : place;
    const city = cities.find(([k]) => k !== place && !AREA.test(k) && !GENERIC.test(k) && new RegExp(String.raw`(?:^|[\s,(])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\s,)])`).test(tail) && !new RegExp(String.raw`\bcamp\s+${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\b`).test(place));
    if (city && !AREA.test(place) && km(p.lat, p.lng, city[1].lat, city[1].lng) > 250) {
      p.lat = city[1].lat; p.lng = city[1].lng; n.city++;
      continue;
    }
    // A name pinned away from where most of its pins stand, in the same country (Koya split 49 km apart);
    // not a generic name ("Missile Base"), not Lebanon's villages (many share a name), not beyond 80 km (a namesake).
    const u = usual.get(place);
    if (u && u.total >= 5 && u.n >= 0.6 * u.total && !AREA.test(place) && !GENERIC.test(place) && !inLebanon(p)) {
      const d = km(p.lat, p.lng, u.lat, u.lng);
      if (d > 30 && d <= 80 && countryAt(u.lat, u.lng) === countryAt(p.lat, p.lng)) { p.lat = u.lat; p.lng = u.lng; n.stray++; }
    }
  }

  // One event, one pin: a village two sources spell two ways, a few km apart; one post pinned twice at one place.
  const keep = [];
  const byDay = new Map();
  for (const p of rows) {
    const day = byDay.get(p.day) || [];
    const sk = skeleton(p.place);
    const twin = day.find((k) => SIDES_OK(k.actor, p.actor) && (
      (sk.length >= 3 && skeleton(k.place) === sk && km(k.lat, k.lng, p.lat, p.lng) <= 6 && String(k.place).toLowerCase() !== String(p.place).toLowerCase()) ||
      (k.url && k.url === p.url && skeleton(k.place) === sk && km(k.lat, k.lng, p.lat, p.lng) <= 6 && !(k.at && p.at && k.at !== p.at))
    ));
    if (twin) {
      twin.also = [...(twin.also || []), ...(p.source && p.url && p.url !== twin.url ? [{ source: p.source, url: p.url }] : []), ...(p.also || [])]
        .filter((a, i, all) => a && a.url && all.findIndex((b) => b.url === a.url) === i);
      if (!twin.at && p.at) twin.at = p.at;
      n.twin++;
      continue;
    }
    day.push(p);
    byDay.set(p.day, day);
    keep.push(p);
  }
  log(n);
  return keep;
}

/**
 * A ship attack told twice: a timed report and an untimed one at sea, the same day, under 30 km apart, are
 * one pin (58 such pairs: "Explosions at sea in the Strait of Hormuz" beside UKMTO's own report). Returns the
 * indexes to drop, the untimed ones, after their "also" goes to the timed one.
 */
function seaTwins(base, sea) {
  const drop = new Set();
  const timed = new Map();
  base.forEach((p, i) => { if (sea[i] && p.at) { const d = timed.get(p.day) || []; d.push(i); timed.set(p.day, d); } });
  base.forEach((p, i) => {
    if (!sea[i] || p.at) return;
    const near = (timed.get(p.day) || []).filter((j) => SIDES_OK(base[j].actor, p.actor) && km(base[j].lat, base[j].lng, p.lat, p.lng) < 30)
      .sort((a, b) => km(base[a].lat, base[a].lng, p.lat, p.lng) - km(base[b].lat, base[b].lng, p.lat, p.lng))[0];
    if (near === undefined) return;
    const t = base[near];
    t.also = [...(t.also || []), ...(p.url ? [{ source: p.source, url: p.url }] : []), ...(p.also || [])].filter((a, k, all) => a && a.url && a.url !== t.url && all.findIndex((b) => b.url === a.url) === k);
    drop.add(i);
  });
  return drop;
}

/*
 * A nuclear site hit: a named nuclear site, not the town it is near (user, 18 Oct: 143 of 219 "nuclear" pins
 * were Bushehr's air base, naval base, barracks or the town itself; Arak and Isfahan are cities too).
 * The same words as public/app.js IRAN_NUCLEAR_RE, which reads the live pins.
 */
const NUCLEAR_SITE = /\bnuclear (?:site|facilit|plant|power|reactor|complex|installation)|\b(?:fordow|natanz|khondab|heavy[- ]water|enrichment|uranium|yellowcake|ardakan|saghand|IR-40|tehran research reactor|(?:bushehr|arak|isfahan|karaj) (?:nuclear|reactor|power plant|npp|uranium|ucf))\b|محطة بوشهر النووية|نطنز|فوردو|نیروگاه اتمی بوشهر/i;

module.exports = { fixBase, seaTwins, skeleton, warPinAllowed, NUCLEAR_SITE, GULF_ATTACK, gulfAttack };
