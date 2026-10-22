/**
 * An article's whole text when its own page will not open to the server
 * (user, 22 Oct: "you are afraid of making full reports … find a way").
 *
 * The server's address is refused by most of the big papers and by some
 * governments' sites: its log had 123 WSJ reads in a row come back empty, and
 * state.gov answers it 403 while it opens to anyone at home. Two routes that
 * force nothing:
 *
 * - **MSN's copy.** The WSJ, Bloomberg, Reuters, the NY Post and many others
 *   publish their articles on MSN under licence, in full. Bing News finds the
 *   copy by its headline, and MSN's own content service gives its text. The
 *   copy counts only when MSN names the same outlet as its provider.
 * - **A reading service** (r.jina.ai, free, a few a minute) that opens a page
 *   from its own browser: government and agency pages that refuse a data
 *   centre. A page behind a robot check stays closed; it is never solved.
 */

import { bingResolve } from "./bing.ts";
import { BROWSER_UA } from "./gnews.ts";
import { sameOutlet } from "./originals.ts";

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Outlets whose articles MSN carries in full, by their own host. */
export const ON_MSN: Record<string, string[]> = {
  "wsj.com": ["Wall Street Journal", "WSJ"],
  "bloomberg.com": ["Bloomberg"],
  "reuters.com": ["Reuters"],
  "nypost.com": ["New York Post", "NY Post"],
  "foxnews.com": ["Fox News"],
  "foxbusiness.com": ["Fox Business"],
  "cnbc.com": ["CNBC"],
  "apnews.com": ["Associated Press", "AP"],
  "telegraph.co.uk": ["Telegraph"],
  "independent.co.uk": ["Independent"],
  "newsweek.com": ["Newsweek"],
  "washingtonexaminer.com": ["Washington Examiner"],
  "thehill.com": ["The Hill"],
  "usatoday.com": ["USA TODAY"],
  "cbsnews.com": ["CBS News"],
  "nbcnews.com": ["NBC News"],
  "abcnews.go.com": ["ABC News"],
  "barrons.com": ["Barron's"],
  "marketwatch.com": ["MarketWatch"],
  "businessinsider.com": ["Business Insider"],
  "dailymail.co.uk": ["Daily Mail"],
  "theguardian.com": ["Guardian"],
  "politico.com": ["Politico"],
  "axios.com": ["Axios"],
};

/** The MSN names an outlet goes by, from its host or its name ("WSJ"), or null when MSN does not carry it. */
export function msnNames(url: string, source = ""): string[] | null {
  const h = hostOf(url);
  for (const [site, names] of Object.entries(ON_MSN)) if (h === site || h.endsWith(`.${site}`)) return names;
  const s = source.trim().toLowerCase();
  if (!s) return null;
  for (const names of Object.values(ON_MSN)) if (names.some((n) => n.toLowerCase() === s || (n.length > 4 && s.includes(n.toLowerCase())))) return names;
  return null;
}

/** "…/ar-AA2fLQ3m" → "AA2fLQ3m". */
export function msnId(url: string): string {
  return /\/ar-([A-Za-z0-9]{6,})(?:[?#/]|$)/.exec(url)?.[1] ?? "";
}

/** MSN's article: its provider and its paragraphs, as article HTML. */
export function msnArticle(json: string): { provider: string; title: string; html: string } | null {
  try {
    const j = JSON.parse(json) as { provider?: { name?: string }; title?: string; body?: string };
    if (!j.body) return null;
    return { provider: j.provider?.name ?? "", title: j.title ?? "", html: j.body };
  } catch {
    return null;
  }
}

/** Does MSN's provider name this outlet? "The Wall Street Journal" for wsj.com. */
export function sameProvider(provider: string, names: string[]): boolean {
  const p = provider.toLowerCase();
  return names.some((n) => p.includes(n.toLowerCase()));
}

/**
 * The outlet's article as MSN carries it, as article HTML, or "". `get` is the
 * page reader (tests pass their own).
 */
export async function msnCopy(url: string, title: string, source = "", get: (u: string) => Promise<string> = page): Promise<string> {
  const names = msnNames(url, source);
  if (!names || !title.trim()) return "";
  const copy = await bingResolve(title, "msn.com");
  const id = msnId(copy);
  if (!id) return "";
  const a = msnArticle(await get(`https://assets.msn.com/content/view/v2/Detail/en-us/${id}`));
  return a && sameProvider(a.provider, names) ? a.html : "";
}

/** Reading-service calls in the last ten minutes: its free tier takes 20 a minute, the desk asks far fewer. */
const READS_MAX = 12;
const READS_WINDOW_MS = 10 * 60_000;
const readAt: number[] = [];
export function readerLeft(now = Date.now()): number {
  while (readAt.length && now - readAt[0] > READS_WINDOW_MS) readAt.shift();
  return READS_MAX - readAt.length;
}
export function resetReader(): void {
  readAt.length = 0;
}

/** A robot check or a refusal, not the page. */
const CHALLENGE = /requiring CAPTCHA|security check to access|Just a moment|Access Denied|are you a robot|verify you are human/i;

/** The page as the reading service opens it, as HTML, or "". */
export async function readerService(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (!/^https?:\/\//.test(url) || readerLeft() <= 0) return "";
  readAt.push(Date.now());
  try {
    const res = await fetcher(`https://r.jina.ai/${url}`, {
      headers: { "x-return-format": "html", "user-agent": BROWSER_UA },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return "";
    }
    const html = await res.text();
    return CHALLENGE.test(html.slice(0, 3000)) ? "" : html;
  } catch {
    return "";
  }
}

async function page(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(10_000) });
    if (res.ok) return await res.text();
    await res.body?.cancel().catch(() => {});
    return "";
  } catch {
    return "";
  }
}

/** Hosts that only forward to the article: nyti.ms, on.wsj.com, trib.al, t.co … */
const SHORT_HOST = /^(?:t\.co|nyti\.ms|on\.wsj\.com|reut\.rs|bloom\.bg|trib\.al|bit\.ly|ow\.ly|buff\.ly|dlvr\.it|cnn\.it|wapo\.st|politi\.co|apne\.ws|nbcnews\.to|cbsn\.ws|abcn\.ws|on\.ft\.com|econ\.st|ti\.me|fxn\.ws|tinyurl\.com|is\.gd|lnkd\.in|aje\.io|aje\.news|bbc\.in|trt\.global|shorturl\.at|goo\.gl|rb\.gy|j\.mp|amp\.gs|ift\.tt|share\.google|g\.co)$/i;
export const isShortLink = (url: string) => SHORT_HOST.test(hostOf(url));

/**
 * Where a short link lands, without opening the article: each hop's Location,
 * up to five; t.co answers with a page whose refresh names the address.
 */
export async function unshorten(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  let u = url;
  for (let i = 0; i < 5 && isShortLink(u); i += 1) {
    try {
      const res = await fetcher(u, { redirect: "manual", headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(6000) });
      const loc = res.headers.get("location");
      const body = loc ? "" : await res.text().catch(() => "");
      if (loc) await res.body?.cancel().catch(() => {});
      const next = loc || /URL=([^"'>\s]+)/i.exec(body)?.[1] || /<title>(https?:\/\/[^<]+)<\/title>/i.exec(body)?.[1] || "";
      if (!next) break;
      u = new URL(next.replace(/&amp;/g, "&"), u).toString();
    } catch {
      break;
    }
  }
  return u;
}

export const isPostUrl = (u: string) => /^https?:\/\/(?:t\.me|x\.com|twitter\.com|mobile\.twitter\.com|www\.instagram\.com|www\.facebook\.com|youtu\.be|www\.youtube\.com|eitaa\.com|ble\.ir|rubika\.ir|splus\.ir)\//i.test(u);
/** Links that are never an article: a channel's own pages, its other apps, a picture. */
const NOT_A_STORY = /^https?:\/\/(?:[^/]*\.)?(?:t\.me|x\.com|twitter\.com|instagram\.com|facebook\.com|youtube\.com|youtu\.be|eitaa\.com|ble\.ir|rubika\.ir|splus\.ir|pbs\.twimg\.com|video\.twimg\.com|whatsapp\.com|tiktok\.com|linktr\.ee)\b|\/(?:fa\/)?livetv\b|^https?:\/\/[^/]+\/?$/i;
/** The first link in a post that may be a story: an outlet's article or a short link to one. */
export function articleLink(text: string): string {
  for (const m of String(text || "").matchAll(/https?:\/\/[^\s<>"'\])‌]+/g)) {
    const u = m[0].replace(/[.,;:!?…]+$/, "");
    if (!NOT_A_STORY.test(u)) return u;
  }
  return "";
}

/** The outlet posting its own story: "NY Post" and nypost.com, "WSJ" and wsj.com. */
export function ownStory(url: string, outlet: string, source: string): boolean {
  const compact = (x: string) => x.toLowerCase().replace(/^thes+/, "").replace(/[^a-z0-9]+/g, "");
  let stem = "";
  try {
    stem = compact(new URL(url).hostname.replace(/^(?:www|en|english|m|amp)./, "").split(".").slice(-2)[0] ?? "");
  } catch {
    return false;
  }
  const src = compact(source);
  if (src.length < 3 || stem.length < 3) return false;
  return (!!outlet && sameOutlet(outlet, source)) || src === stem || src.startsWith(stem) || stem.startsWith(src);
}
