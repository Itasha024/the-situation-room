// The Home Front Command's alerts (oref/salvos.json, from oref-salvos.cjs) -> hand events, one per salvo and region.
// Who fired: an Israeli channel's post naming the launch origin within 25 minutes before to 20 after the first
// alert ("שיגורים מאיראן", "מלבנון", "מתימן", "מעיראק"); else Lebanon's own warning ("איום מלבנון"); else a
// short-range alert in the north with no long-range warning before it is Lebanon's; else not stated.
// Gaza's are left off this map (not this war's); Yemen's at Israel are on it (user, 9 Oct).
const fs = require('fs');
const S = JSON.parse(fs.readFileSync('oref/salvos.json', 'utf8'));
const posts = ['N12chat', 'hazfon1', 'israel1'].flatMap((c) => fs.existsSync(`tg/${c}.jsonl`) ? fs.readFileSync(`tg/${c}.jsonl`, 'utf8').trim().split('\n').map(JSON.parse).map((p) => ({ ...p, ch: c, t: Date.parse(p.at) })) : []);
const ORIGIN = /(שיגור|שיגורים|שוגר|שוגרו|טיל|טילים|רקט|כטב\S{0,4}|כלי טיס|מל"ט|רחפן|נפץ)[^\n.]{0,50}?(מאיראן|מאירן|מתימן|מעיראק|מלבנון|מעזה|משטח איראן|משטח תימן|משטח עיראק|משטח לבנון)|(מאיראן|מאירן|מתימן|מעיראק|מלבנון|מעזה|משטח איראן|משטח תימן|משטח עיראק|משטח לבנון)[^\n.]{0,25}?(שיגור|טיל|רקט|כטב)/;
const ACTOR = { מאיראן: 'iran', מאירן: 'iran', מתימן: 'houthi', מעיראק: 'iraqi_militias', מלבנון: 'hezbollah', מעזה: 'gaza', 'משטח איראן': 'iran', 'משטח תימן': 'houthi', 'משטח עיראק': 'iraqi_militias', 'משטח לבנון': 'hezbollah' };
const FROM = { iran: 'Iran', houthi: 'Yemen', iraqi_militias: 'Iraq', hezbollah: 'Lebanon' };
// Only a flash naming the origin in its opening words: not a round-up of the day that names Iran further down,
// and not a doubt ("נבדק אם טיל שוגר מעיראק", checking whether a missile came from Iraq).
const HEDGE = /נבדק|נבדקת|בודקים|האם |ייתכן|יתכן|לא ברור|לא ידוע|סיכום/;
// A flash about launches at another country (Saudi Arabia, Jordan, the Gulf) names no origin of an attack on Israel.
const ELSEWHERE = /סעודיה|ירדן|עקבה|המפרץ|כווית|קטאר|קטר|האמירויות|אמירויות|בחריין|עומאן|עיראק:|ארביל/;
const said = posts.filter((p) => ORIGIN.test(p.text.slice(0, 160)) && !HEDGE.test(p.text.slice(0, 160)) && !ELSEWHERE.test(p.text.slice(0, 160))).map((p) => { const m = p.text.slice(0, 160).match(ORIGIN); return { t: p.t, actor: ACTOR[m[2] || m[3]], url: `https://t.me/${p.ch}/${p.id}`, ch: p.ch, head: p.text.slice(0, 160) }; }).sort((a, b) => a.t - b.t);
const NAME = { N12chat: 'N12', hazfon1: 'Hazfon 1', israel1: 'Israel 1' };
const NORTH = new Set(['north', 'galilee', 'haifa', 'valleys']);
// A flash naming where the alerts sound, or the same weapon, outweighs one that doesn't: a drone from Yemen at
// Eilat while missiles from Iran fall on the centre.
const WHERE = { north: /צפון|גליל|קריית שמונה|מטולה/, galilee: /צפון|גליל|גולן|טבריה/, haifa: /חיפה|קריות|מפרץ/, valleys: /עמקים|עפולה|צפון/, sharon: /שרון|מרכז|נתניה/, telaviv: /מרכז|תל אביב|גוש דן/, jerusalem: /ירושלים|יהודה/, samaria: /שומרון|מרכז|ירושלים/, ashdod: /דרום|אשדוד|אשקלון|לכיש/, gaza: /עוטף|דרום/, negev: /דרום|נגב|באר שבע|ים המלח|דימונה/, eilat: /אילת|ערבה/ };
const UAV = /כטב|כלי טיס|מל"ט|רחפן/;
const BACK = /בהמשך להתרעות|ההתרעות ש|על ההתרעות/;
// The IDF's or the Home Front Command's own word, a correction included ("צה"ל: כל השיגורים היו מאיראן"), outweighs both.
// Its word, with the colon: not a clip of the IDF foiling a launch ("תיעוד: צה"ל מסכל שיגורים מלבנון").
const OFFICIAL = /^[^\n]{0,40}?(?:צה"ל|צה״ל|דובר צה"ל|דובר צה״ל|פיקוד העורף)\s*:/;
const weight = (p, s) => 1 + (OFFICIAL.test(p.head) ? 3 : 0) + (WHERE[s.region]?.test(p.head) ? 2 : 0) + (UAV.test(p.head) === (s.kind === 'uav') ? 1 : 0);
// Israel's day: UTC+2 until the clocks went forward on 27 March, +3 after.
const ilDay = (iso) => new Date(Date.parse(iso) + (iso < '2026-03-27T00:00' ? 2 : 3) * 3600e3).toISOString().slice(0, 10);
const out = [], tally = {};
for (const s of S) {
  const t = Date.parse(s.salvo);
  // The origin post nearest the salvo's first alert.
  // The flashes around it vote; a tie goes to the one nearest the first alert.
  // The IDF's word on the alerts after them ("בהמשך להתרעות שהופעלו ...") may come up to an hour later.
  let around = said.filter((p) => p.t - t >= -25 * 60e3 && p.t - t <= (BACK.test(p.head) ? 60 : 20) * 60e3);
  // The long-range warning ("בדקות הקרובות") is given for launches from Iran and Yemen, not Lebanon: where it
  // sounded, a flash about Lebanon in the same minutes is about the north.
  if (s.longWarn && !s.lebWarn && around.some((p) => p.actor !== 'hezbollah')) around = around.filter((p) => p.actor !== 'hezbollah');
  // Flashes naming both this place and this weapon decide alone ("a drone from Yemen sets off alerts in Eilat"
  // amid a dozen about Iran's missiles).
  const exact = around.filter((p) => WHERE[s.region]?.test(p.head) && UAV.test(p.head) === (s.kind === 'uav'));
  const near = exact.length ? exact : around;
  const votes = {};
  for (const p of near) votes[p.actor] = (votes[p.actor] || 0) + weight(p, s);
  const top = Math.max(0, ...Object.values(votes));
  const best = near.filter((p) => votes[p.actor] === top).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0] || null;
  let actor = best?.actor, how = best ? 'post' : '';
  // Iran's missiles are announced minutes ahead ("בדקות הקרובות"): a short-range attack on the north without
  // that warning is Lebanon's, whatever a flash about Iran at the same time says.
  // Yemen's missiles and drones never reach the north (Hezbollah's front).
  if (((actor === 'iran' && !s.longWarn) || actor === 'houthi') && NORTH.has(s.region)) actor = undefined;
  // A short-range attack on the north with no long-range warning is Lebanon's, whatever a post about another front says.
  if (s.lebWarn || (!s.longWarn && NORTH.has(s.region) && (!actor || actor === 'gaza'))) { actor = 'hezbollah'; how = how || 'north'; }
  // A short-range alert on the Gaza border is Gaza's, unless a flash names the south and that weapon.
  if ((!actor || !exact.length) && s.region === 'gaza' && !s.longWarn) { actor = 'gaza'; how = 'gaza'; }
  if (!actor) { actor = 'unclear'; how = 'none'; }
  const k = `${s.at.slice(0, 7)} ${actor}`; tally[k] = (tally[k] || 0) + 1;
  if (actor === 'gaza') continue;
  const what = s.kind === 'uav' ? (actor === 'unclear' ? 'Hostile aircraft' : `Drone from ${FROM[actor]}`) : actor === 'hezbollah' && !s.longWarn ? 'Rockets from Lebanon' : actor === 'unclear' ? 'Rockets or missiles, origin not stated,' : `Missiles from ${FROM[actor]}`;
  // "Beer Sheva - South", "Tel Aviv - City Center": the city.
  const city = (n) => n.replace(/\s+-\s+.*$/, '');
  s.sample = [...new Set(s.sample.map(city))]; s.place = city(s.place);
  const names = s.sample.slice(0, 3).join(', ') + (s.n > 3 ? ` and ${s.n - 3} more` : '');
  const label = `${what} at ${s.regionEn}: alerts in ${s.n === 1 ? s.sample[0] : `${s.n} places (${names})`}`;
  const text = `Home Front Command alerts, ${s.kind === 'uav' ? 'hostile aircraft' : 'rockets and missiles'}, from ${s.at}: ${s.sample.join(', ')}${s.n > s.sample.length ? ` and ${s.n - s.sample.length} more` : ''}. ${s.he}`;
  out.push({ day: ilDay(s.at), at: s.at, actor, said: s.he, country: 'Israel', label, source: 'Home Front Command', url: 'https://www.oref.org.il/heb/alerts-history', text, en: s.place, lat: s.lat, lng: s.lng, also: best && best.actor === actor ? [{ source: NAME[best.ch], url: best.url }] : [] });
}
fs.writeFileSync('oref-events.jsonl', out.map((e) => JSON.stringify(e)).join('\n'));
console.log(out.length, 'events'); console.log(tally);
