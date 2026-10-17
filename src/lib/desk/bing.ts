/**
 * An article's own address from Bing News, server-only: the fallback when
 * Google will not resolve its link.
 *
 * Google sends the server to its robot check on every look-up once it has
 * asked too many (18 Oct: every article page answered with google.com/sorry),
 * and the desk never gets past a robot check. Bing News's public RSS search
 * names each item's article in its link (`apiclick.aspx?…&url=<article>`), so
 * one search of the headline gives the address with no further request. Only
 * an item on the outlet's own site whose headline matches is taken.
 */

import { BROWSER_UA } from "./gnews.ts";

/** Bing searches a half hour: a public page, asked sparingly. */
export const BING_LIMIT = 20;
const WINDOW_MS = 30 * 60_000;
/** After a refusal, no search for an hour. */
const REST_MS = 60 * 60_000;
const spentAt: number[] = [];
let restUntil = 0;

export function bingLeft(now = Date.now()): number {
  while (spentAt.length && now - spentAt[0] > WINDOW_MS) spentAt.shift();
  return now < restUntil ? 0 : BING_LIMIT - spentAt.length;
}

/** Tests: an empty budget. */
export function resetBing(): void {
  spentAt.length = 0;
  restUntil = 0;
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[ً-ْـ]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((w) => w.length >= 3),
  );

/** How much of the shorter headline the other carries (0–1). */
export function headlineOverlap(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common += 1;
  return common / Math.min(x.size, y.size);
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Bing's items: the headline and the article address its link carries. */
export function parseBingRss(xml: string): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  for (const it of xml.split("<item>").slice(1)) {
    const title = (/<title>([\s\S]*?)<\/title>/.exec(it)?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const link = (/<link>([\s\S]*?)<\/link>/.exec(it)?.[1] ?? "").replace(/&amp;/g, "&");
    const enc = /[?&]url=([^&]+)/.exec(link)?.[1];
    if (!enc) continue;
    let url = "";
    try {
      url = decodeURIComponent(enc);
    } catch {
      continue;
    }
    if (/^https?:\/\//.test(url)) out.push({ title, url });
  }
  return out;
}

/** The item on `site` whose headline is this one, from Bing's answer. */
export function pickBing(items: { title: string; url: string }[], title: string, site: string): string {
  const want = site.toLowerCase().replace(/^www\./, "");
  let best = "";
  let score = 0.6;
  for (const i of items) {
    const h = hostOf(i.url);
    if (!(h === want || h.endsWith(`.${want}`) || want.endsWith(`.${h}`))) continue;
    const s = headlineOverlap(i.title, title);
    if (s >= score) {
      best = i.url;
      score = s;
    }
  }
  return best;
}

/** The article on `site` carrying this headline, or "" (none found, or no search left). */
export async function bingResolve(title: string, site: string, fetcher: typeof fetch = fetch): Promise<string> {
  const clean = title.replace(/\s+-\s+[^-]{2,40}$/, "").trim();
  if (!clean || !site || bingLeft() <= 0) return "";
  spentAt.push(Date.now());
  try {
    const res = await fetcher(`https://www.bing.com/news/search?q=${encodeURIComponent(clean)}&format=rss`, {
      headers: { "user-agent": BROWSER_UA },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429 || res.status === 403) restUntil = Date.now() + REST_MS;
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return "";
    }
    const xml = await res.text();
    // A challenge page in place of the feed is a refusal too.
    if (!xml.includes("<rss")) {
      restUntil = Date.now() + REST_MS;
      return "";
    }
    return pickBing(parseBingRss(xml), clean, site);
  } catch {
    return "";
  }
}
