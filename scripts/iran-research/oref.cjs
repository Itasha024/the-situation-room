// The Home Front Command's alerts (oref/salvos.json, from oref-salvos.cjs) -> hand events, one per salvo and region.
// Who fired: an Israeli channel's post naming the launch origin within 25 minutes before to 20 after the first
// alert ("שיגורים מאיראן", "מלבנון", "מתימן", "מעיראק"); else Lebanon's own warning ("איום מלבנון"); else a
// short-range alert in the north with no long-range warning before it is Lebanon's; else not stated.
// Yemen's (the Houthis', the Yemen desk's) and Gaza's are left off this map.
const fs = require('fs');
const S = JSON.parse(fs.readFileSync('oref/salvos.json', 'utf8'));
const posts = ['N12chat', 'hazfon1', 'israel1'].flatMap((c) => fs.existsSync(`tg/${c}.jsonl`) ? fs.readFileSync(`tg/${c}.jsonl`, 'utf8').trim().split('\n').map(JSON.parse).map((p) => ({ ...p, ch: c, t: Date.parse(p.at) })) : []);
const ORIGIN = /(שיגור|שיגורים|שוגר|שוגרו|טיל|טילים|רקט|כטב"ם|כטב״ם|כטבם|כטב"מים|מל"ט|רחפן|נפץ)[^\n.]{0,50}?(מאיראן|מאירן|מתימן|מעיראק|מלבנון|מעזה)|(מאיראן|מאירן|מתימן|מעיראק|מלבנון|מעזה)[^\n.]{0,25}?(שיגור|טיל|רקט|כטב)/;
const ACTOR = { מאיראן: 'iran', מאירן: 'iran', מתימן: 'houthi', מעיראק: 'iraqi_militias', מלבנון: 'hezbollah', מעזה: 'gaza' };
const FROM = { iran: 'Iran', houthi: 'Yemen', iraqi_militias: 'Iraq', hezbollah: 'Lebanon' };
// Only a flash naming the origin in its opening words: not a round-up of the day that names Iran further down,
// and not a doubt ("נבדק אם טיל שוגר מעיראק", checking whether a missile came from Iraq).
const HEDGE = /נבדק|נבדקת|בודקים|האם |ייתכן|יתכן|לא ברור|לא ידוע|סיכום/;
// A flash about launches at another country (Saudi Arabia, Jordan, the Gulf) names no origin of an attack on Israel.
const ELSEWHERE = /סעודיה|ירדן|עקבה|המפרץ|כווית|קטאר|קטר|האמירויות|אמירויות|בחריין|עומאן|עיראק:|ארביל/;
const said = posts.filter((p) => ORIGIN.test(p.text.slice(0, 160)) && !HEDGE.test(p.text.slice(0, 160)) && !ELSEWHERE.test(p.text.slice(0, 160))).map((p) => { const m = p.text.slice(0, 160).match(ORIGIN); return { t: p.t, actor: ACTOR[m[2] || m[3]], url: `https://t.me/${p.ch}/${p.id}`, ch: p.ch }; }).sort((a, b) => a.t - b.t);
const NAME = { N12chat: 'N12', hazfon1: 'Hazfon 1', israel1: 'Israel 1' };
const NORTH = new Set(['north', 'galilee', 'haifa', 'valleys']);
// Israel's day: UTC+2 until the clocks went forward on 27 March, +3 after.
const ilDay = (iso) => new Date(Date.parse(iso) + (iso < '2026-03-27T00:00' ? 2 : 3) * 3600e3).toISOString().slice(0, 10);
const out = [], tally = {};
for (const s of S) {
  const t = Date.parse(s.salvo);
  // The origin post nearest the salvo's first alert.
  // The flashes around it vote; a tie goes to the one nearest the first alert.
  const near = said.filter((p) => p.t - t >= -25 * 60e3 && p.t - t <= 20 * 60e3);
  const votes = {};
  for (const p of near) votes[p.actor] = (votes[p.actor] || 0) + 1;
  const top = Math.max(0, ...Object.values(votes));
  const best = near.filter((p) => votes[p.actor] === top).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0] || null;
  let actor = best?.actor, how = best ? 'post' : '';
  // Iran's missiles are announced minutes ahead ("בדקות הקרובות"): a short-range attack on the north without
  // that warning is Lebanon's, whatever a flash about Iran at the same time says.
  if (actor === 'iran' && !s.longWarn && NORTH.has(s.region)) actor = undefined;
  // A short-range attack on the north with no long-range warning is Lebanon's, whatever a post about another front says.
  if (s.lebWarn || (!s.longWarn && NORTH.has(s.region) && (!actor || actor === 'gaza'))) { actor = 'hezbollah'; how = how || 'north'; }
  if (!actor && s.region === 'gaza' && !s.longWarn) { actor = 'gaza'; how = 'gaza'; }
  if (!actor) { actor = 'unclear'; how = 'none'; }
  const k = `${s.at.slice(0, 7)} ${actor}`; tally[k] = (tally[k] || 0) + 1;
  if (actor === 'houthi' || actor === 'gaza') continue;
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
