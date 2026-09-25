/**
 * A site's whole list of recent articles, server-only.
 *
 * The desk used to find a website's articles through a Google News keyword
 * search, `site:X (Yemen OR Houthi OR …)`, and never saw an article whose
 * headline lacked those words: "Saudi oil detour", "Bin Salman advised
 * Washington…". A site's own listing — its RSS feed, or the news sitemap it
 * keeps for search engines — names every article it published, and the desk
 * judges each one (triage.ts) rather than a keyword judging for it.
 *
 * One parser reads the three shapes a listing comes in: RSS `<item>`, Atom
 * `<entry>` and a news sitemap's `<url>` with `news:title`.
 */

export type Listed = { url: string; title: string; desc: string; at: number };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘")
    .replace(/&#822[01];/g, '"').replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? decode(m[1]) : "";
}

/** Every article a listing names, in the order it names them. */
export function parseListing(xml: string): Listed[] {
  const out: Listed[] = [];
  if (/<urlset[\s>]/i.test(xml)) {
    for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
      const b = m[1];
      const url = tag(b, "loc");
      const title = tag(b, "news:title") || tag(b, "image:title");
      const at = Date.parse(tag(b, "news:publication_date") || tag(b, "lastmod"));
      if (url && title) out.push({ url, title, desc: "", at });
    }
    return out;
  }
  const atom = !/<item[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks = xml.split(atom ? /<entry[\s>]/i : /<item[\s>]/i).slice(1);
  for (const b of blocks) {
    const title = tag(b, "title");
    const href = atom ? (/<link[^>]+href=["']([^"']+)["']/i.exec(b) || [])[1] || "" : "";
    const url = decode(href || tag(b, "link") || tag(b, "guid")).trim();
    const desc = tag(b, "description") || tag(b, "summary");
    const at = Date.parse(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"));
    if (url && /^https?:\/\//i.test(url) && title) out.push({ url, title, desc: desc.slice(0, 600), at });
  }
  return out;
}

/**
 * The listing's text. A `.xml.gz` sitemap arrives as a gzip file rather than
 * a gzip-encoded response, so fetch does not unpack it: that is done here.
 * `ua` is the site's own: Al-Araby's feed answers a browser 403 and a plain
 * client 200.
 */
export async function fetchListing(url: string, ua = "YemenDesk/2.0 (OSINT desk)", ms = 10_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": ua, accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*" },
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) {
      // An unread body left open can trip undici when the socket closes.
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await new Response(stream).text();
    }
    return new TextDecoder().decode(buf);
  } catch {
    return null;
  }
}

/** A short, stable id for a URL: the seen-set keeps these, not the URLs. */
export function urlKey(u: string): string {
  // An article id in the query ("news_details.php?sid=33503") is the article;
  // any other query (Google's "?oc=5", tracking) is not.
  const id = /[?&]((?:s|n|p)?id|article|story)=(\d+)/i.exec(u);
  const s = u.replace(/^https?:\/\/(?:www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "") + (id ? `?${id[1].toLowerCase()}=${id[2]}` : "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** A headline reduced to its words, to know one article under two addresses. */
export function titleKey(t: string): string {
  return t
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .slice(0, 14)
    .join(" ");
}

/**
 * A site with no feed, listed from its own section pages (Sheba Intelligence,
 * Al-Akhbar's English edition): every link to an article, its headline the
 * longest text linked to it. A date in the link text ("31.07.2026") is kept;
 * otherwise the article is undated and is new when the desk has not seen it.
 */
export function parseHtmlListing(html: string, base: string, article: RegExp): Listed[] {
  const byUrl = new Map<string, { texts: string[]; at: number }>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: string;
    try {
      url = new URL(decode(m[1]), base).toString();
    } catch {
      continue;
    }
    if (!article.test(url)) continue;
    const text = decode(m[2]);
    const d = /\b(\d{1,2})\.(\d{1,2})\.(20\d\d)\b/.exec(text);
    const e = byUrl.get(url) ?? { texts: [], at: NaN };
    if (d) e.at = Date.UTC(+d[3], +d[2] - 1, +d[1], 12);
    // The headline without the section, author and date printed before it.
    if (text) e.texts.push(d ? text.slice(d.index + d[0].length).trim() || text : text);
    byUrl.set(url, e);
  }
  const out: Listed[] = [];
  for (const [url, e] of byUrl) {
    const title = e.texts.sort((a, b) => b.length - a.length)[0] ?? "";
    if (title.length >= 12) out.push({ url, title, desc: "", at: e.at });
  }
  return out;
}
