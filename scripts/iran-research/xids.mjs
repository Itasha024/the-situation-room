// Read X posts by id through FxTwitter: node xids.mjs <handle> <idsfile> -> x/<handle>.jsonl
import fs from 'fs';
const [h, file] = process.argv.slice(2);
const out = `x/${h}.jsonl`; const seen = new Set();
if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) if (l) seen.add(JSON.parse(l).id);
const ids = fs.readFileSync(file, 'utf8').trim().split('\n').map((s) => s.replace(/\D/g, ''));
let n = 0;
for (const id of ids) {
  if (seen.has(id)) continue;
  let j;
  for (let i = 0; i < 4; i++) { try { const r = await fetch(`https://api.fxtwitter.com/${h}/status/${id}`); if (r.status === 429) { await new Promise(s => setTimeout(s, 20000)); continue; } j = await r.json(); break; } catch { await new Promise(s => setTimeout(s, 4000)); } }
  const t = j && j.tweet;
  if (t && t.author?.screen_name?.toLowerCase() === h.toLowerCase()) {
    const text = (t.raw_text?.text || t.text || '') + (t.article ? '\n' + (t.article.title || '') + '\n' + (t.article.preview_text || '') : '');
    fs.appendFileSync(out, JSON.stringify({ id, at: new Date(t.created_timestamp * 1000).toISOString(), text, url: t.url, media: (t.media?.photos || []).map((p) => p.url) }) + '\n'); n++;
  }
  seen.add(id);
  await new Promise(s => setTimeout(s, 700));
}
console.log(h, 'read', n);
