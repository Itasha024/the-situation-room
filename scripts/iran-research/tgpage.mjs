// Fetch one t.me/s page and return posts {id, at, text}
export async function page(ch, before) {
  const u = `https://t.me/s/${ch}` + (before ? `?before=${before}` : '');
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130' } });
      if (r.status === 429) { await new Promise(s => setTimeout(s, 5000 * (i + 1))); continue; }
      const h = await r.text();
      const posts = [];
      const parts = h.split('tgme_widget_message_wrap').slice(1);
      for (const p of parts) {
        const id = (p.match(/data-post="[^\/]+\/(\d+)"/) || [])[1];
        const at = (p.match(/datetime="([^"]+)"/) || [])[1];
        const tm = p.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
        let text = tm ? tm[1].replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim() : '';
        if (id) posts.push({ id: +id, at, text });
      }
      return posts;
    } catch (e) { await new Promise(s => setTimeout(s, 3000)); }
  }
  return [];
}
