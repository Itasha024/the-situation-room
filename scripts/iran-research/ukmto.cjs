// UKMTO's 2026 warnings (read by hand from its PDF archive and its incident list, ukmto/hand.txt) -> hand events.
// A line: number|UTC time|reference place|nautical miles|bearing|what happened|actor[|lat,lng from UKMTO's own list[|its X post]].
// Without UKMTO's position, the pin goes where the warning puts it: so many miles off the named place.
// Only the Gulf, Hormuz, the Gulf of Oman and the Arabian Sea: the Red Sea and the Gulf of Aden are the
// Yemen desk's, and piracy off Somalia and Yemen is no part of this war.
const fs = require('fs');
const REF = {
  Oman: [26.38, 56.4], Hormuz: [26.55, 56.3], Muscat: [23.61, 58.59], 'Mina Saqr': [25.97, 56.05], Sharjah: [25.36, 55.39],
  'Port of Bahrain': [26.2, 50.71], Fujairah: [25.12, 56.36], Dubai: [25.27, 55.3], 'Mubarak Al Kabeer': [29.18, 48.12],
  Jubail: [27.01, 49.66], 'Abu Dhabi': [24.47, 54.37], 'Ras al Khaimah': [25.79, 55.94], 'Al Basrah Oil Terminal': [29.68, 48.81],
  'Jebel Ali': [25.01, 55.06], 'Khor Fakkan': [25.34, 56.36], 'Ras Laffan': [25.91, 51.58], 'Ras Tanura': [26.64, 50.16],
  'Kish Island': [26.53, 53.98], 'Ras al Hadd': [22.53, 59.8], Sirik: [26.52, 57.1], Doha: [25.29, 51.53], 'Umm Qasr': [30.03, 47.95],
  Dahit: [26.17, 56.45], Limah: [25.95, 56.42], Qalhat: [22.7, 59.37], Khasab: [26.18, 56.25], Duqm: [19.67, 57.7], Kumzar: [26.33, 56.41],
  Dibba: [25.62, 56.27],
};
const BEAR = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
// Israel's day: UTC+2 until the clocks went forward on 27 March, +3 after.
const ilDay = (iso) => new Date(Date.parse(iso) + (iso < '2026-03-27T00:00' ? 2 : 3) * 3600e3).toISOString().slice(0, 10);
// Each warning's own PDF in UKMTO's archive (ukmto/pdfs.txt: number file), else its incidents page.
const URL = 'https://www.ukmto.org/recent-incidents';
const PDF = new Map(fs.existsSync('ukmto/pdfs.txt') ? fs.readFileSync('ukmto/pdfs.txt', 'utf8').trim().split('\n').map((l) => l.split(' ')).map(([n, f]) => [n, `https://sccd.royalnavy.mod.uk/-/media/ukmto/products/${f}`]) : []);
const out = [];
for (const l of fs.readFileSync(process.argv[2] || 'ukmto/hand.txt', 'utf8').trim().split('\n')) {
  // A ninth field: the warning's own post on UKMTO's X account, for the few the archive lacks (read off its picture).
  const [no, t, ref, nm, dir, what, actor, pos, url] = l.split('|');
  let lat, lng;
  if (pos) [lat, lng] = pos.split(',').map(Number);
  else {
    const r = REF[ref]; if (!r) throw new Error('no reference: ' + ref);
    const d = (+nm * 1.852) / 111, b = (BEAR[dir] * Math.PI) / 180;
    lat = r[0] + d * Math.cos(b); lng = r[1] + (d * Math.sin(b)) / Math.cos((r[0] * Math.PI) / 180);
  }
  const at = t + ':00Z';
  const where = +nm ? `${nm} nautical miles ${{ N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' }[dir]} of ${ref}` : ref === 'Hormuz' ? 'the Strait of Hormuz' : ref;
  const text = `UKMTO warning ${no}-26: ${what}, ${where}.`;
  out.push({ day: ilDay(at), at, actor, said: ref, country: 'sea', label: `${what[0].toUpperCase()}${what.slice(1)}, ${where} (UKMTO ${no}-26)`, source: 'UKMTO', url: url || PDF.get(no) || URL, text, en: ref === 'Hormuz' ? 'Strait of Hormuz' : `off ${ref}`, lat, lng });
}
fs.writeFileSync(process.argv[3] || 'ukmto-events.jsonl', out.map((e) => JSON.stringify(e)).join('\n'));
console.log(out.length, 'UKMTO events');
