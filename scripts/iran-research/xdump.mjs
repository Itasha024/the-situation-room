// An X account's history through FxTwitter's public timeline (cursor pages), back to a date. Writes x/<handle>.jsonl {id, at, text, url}.
import fs from 'fs';
const [h, stop = '2026-02-27'] = process.argv.slice(2);
const out = `x/${h}.jsonl`; const seen = new Set();
if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) if (l) seen.add(JSON.parse(l).id);
let cur = '', n = 0, empty = 0;
for (;;) {
  const u = `https://api.fxtwitter.com/2/profile/${h}/statuses` + (cur ? `?cursor=${encodeURIComponent(cur)}` : '');
  let j;
  for (let i = 0; i < 5; i++) { try { const r = await fetch(u); if (r.status === 429) { await new Promise(s => setTimeout(s, 15000 * (i + 1))); continue; } j = await r.json(); break; } catch { await new Promise(s => setTimeout(s, 5000)); } }
  if (!j || !j.results) { console.log('stop: no page', j && j.code); break; }
  let oldest = '9';
  for (const r of j.results) {
    const at = new Date(r.created_at).toISOString();
    if (r.reposted_by) continue;
    if (at < oldest) oldest = at;
    if (seen.has(r.id)) continue; seen.add(r.id); n++;
    const text = (r.raw_text?.text || r.text || '') + (r.article ? '\n' + (r.article.title || '') + '\n' + (r.article.preview_text || '') : '') + (r.quote ? '\n[quote ' + r.quote.author?.screen_name + '] ' + r.quote.text : '');
    fs.appendFileSync(out, JSON.stringify({ id: r.id, at, text, url: r.url, media: (r.media?.photos || []).map(p => p.url) }) + '\n');
  }
  if (!j.results.length) { if (++empty > 2) break; } else empty = 0;
  if (oldest < stop) break;
  const next = j.cursor?.bottom; if (!next || next === cur) break; cur = next;
  await new Promise(s => setTimeout(s, 1200));
}
console.log(h, 'new', n, 'total', seen.size);
