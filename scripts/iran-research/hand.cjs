// Attacks read by hand from Telegram channels (tg/<channel>.jsonl, dumped by tg-dump.mjs) -> research events.
// A line of the hand file: channel/post id|day|actor|place as the post writes it|lat,lng|label|country[|place in English[|at]]
// The post's text is kept with the event, so the place must be written in it (grounded). lat,lng: the place's
// own position, looked up by me (GeoNames, OpenStreetMap), or the area's middle when the post names only an
// area ("south-west Iran"). Lines starting with # are notes.
//   node hand.cjs hand-b.txt hand-b-events.jsonl
const fs = require('fs');
const NAME = {
  N12chat: 'N12', hazfon1: 'Hazfon 1', israel1: 'Israel 1', naya_foriraq: 'Naya', SabrenNewss: 'Sabereen', Alomhoar: 'Al-Mihwar',
  Alibk3: 'Ali Bk', elamharbi: 'Islamic Resistance in Iraq', muqawama_iraq: 'Islamic Resistance in Iraq', almanarnews: 'Al Manar',
  NNA_Leb: 'NNA', IDFSpokespersonArabic: 'IDF', idfinfarsi: 'IDF', alichoeib1970: 'Ali Shoaib',
};
const cache = new Map();
const post = (ch, id) => {
  if (!cache.has(ch)) cache.set(ch, new Map(fs.readFileSync(`tg/${ch}.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((p) => [String(p.id), p])));
  return cache.get(ch).get(String(id));
};
const out = [];
for (const l of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!l.trim() || l.startsWith('#')) continue;
  const [ref, day, actor, said, pos, label, country, en, at] = l.split('|');
  const [ch, id] = ref.split('/');
  const p = post(ch, id);
  if (!p) throw new Error('no post ' + ref);
  if (!p.text.includes(said)) throw new Error(`"${said}" not in ${ref}`);
  const [lat, lng] = pos.split(',').map(Number);
  out.push({ day, ...(at ? { at } : {}), actor, said, country, label, source: NAME[ch] || ch, url: `https://t.me/${ch}/${id}`, text: p.text, en: en || said, lat, lng });
}
fs.writeFileSync(process.argv[3], out.map((e) => JSON.stringify(e)).join('\n'));
console.log(out.length, 'hand events');
