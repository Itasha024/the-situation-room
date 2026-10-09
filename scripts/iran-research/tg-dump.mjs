import { page } from './tgpage.mjs';
import fs from 'fs';
const [ch, from, to] = [process.argv[2], +process.argv[3], +process.argv[4]];
const out = `tg/${ch}.jsonl`; const seen = new Set();
if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) if (l) seen.add(JSON.parse(l).id);
let before = to + 1;
while (before > from) {
  const ps = await page(ch, before);
  if (!ps.length) { before -= 20; continue; }
  for (const p of ps) if (!seen.has(p.id) && p.id >= from) { seen.add(p.id); fs.appendFileSync(out, JSON.stringify(p) + '\n'); }
  const min = Math.min(...ps.map(p => p.id));
  before = min >= before ? before - 20 : min;
  await new Promise(s => setTimeout(s, 450));
}
console.log(ch, 'done', seen.size);
