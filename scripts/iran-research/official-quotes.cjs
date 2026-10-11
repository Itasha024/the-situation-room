// A relay that quotes an official statement gives way to the official's own post (user, 11 Oct): readers matched
// relay-led pins to the statement they quote; the official leads, the relay becomes a second source.
// Usage: node official-quotes.cjs <baseline.json> <out.jsonl> (lines {fp, quote, official, url})
const fs = require('fs');
const [BASE, OUT] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const NAME = { 'Hezbollah military media': "Hezbollah's military media", 'Hezbollah military media (Islamic Resistance)': "Hezbollah's military media" };
let n = 0;
for (const x of fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(JSON.parse)) {
  const p = base.find((q) => q.fp === x.fp);
  if (!x.quote || !x.url || !p || p.url === x.url) continue;
  const name = NAME[x.official] ?? x.official;
  p.also = [{ source: p.source, url: p.url }, ...(p.also ?? []).filter((a) => a.url !== x.url)];
  if (p.label.endsWith(`, ${p.source} reports`)) p.label = p.label.slice(0, -`${p.source} reports`.length) + `${name} reports`;
  p.source = name; p.url = x.url; n++;
}
fs.writeFileSync(BASE, JSON.stringify(base));
console.log('led by the official now:', n);
