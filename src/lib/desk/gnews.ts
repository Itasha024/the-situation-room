/**
 * Google News helpers, server-only. Google News RSS links are opaque redirects;
 * `resolveGoogleNews` turns one into the publisher's own article address, and
 * `searchGoogleNews` runs a site-limited search and returns its items.
 */

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
/** The article's own address: tracking parameters and fragment dropped. */
export function cleanUrl(u: string): string {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) {
      if (/^(?:utm_.*|smid|smtyp|ref|oc|fbclid|gclid|cmpid|mod|taid|traffic_source)$/i.test(k)) url.searchParams.delete(k);
    }
    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

/** A section, topic or home page rather than one article. */
export function isSectionFront(u: string): boolean {
  try {
    const path = new URL(u).pathname.replace(/\/+$/, "");
    return !path || /^\/(?:spotlight|topics?|tags?|section|category|author|hub|live-news)(?:\/|$)/i.test(path) || (!/[/-]\w+[/-]/.test(path) && !/\d{4,}/.test(path));
  } catch {
    return true;
  }
}

/** After Google answers 429, links are not resolved for half an hour. */
const REST_MS = 30 * 60_000;
let restUntil = 0;
let resolves = 0;
let searches = 0;
/** Searches run since the process started. */
export const searchCount = () => searches;
export const resolverResting = () => Date.now() < restUntil;
/** Links resolved since the process started: the trace spends against it per tick. */
export const resolveCount = () => resolves;

export const isGnews = (u: string) => /^https:\/\/news\.google\.com\/rss\/articles\//.test(u);

/**
 * Google answers about thirty look-ups a half hour, then 429 and a half-hour
 * rest. The scan alone asked thirty a tick, the Iran desk ten and the origin
 * search fifteen (18 Oct): Google rested most of the day, and most links were
 * never resolved. Every caller now spends from one budget, the most needed
 * first: an article about to be read ("lead"), then a relay's original
 * ("trace"), then a stored card's link ("card"), then old cards ("backlog").
 * Each need leaves the needs above it that many look-ups.
 */
export const RESOLVE_WINDOW_MS = 30 * 60_000;
export const RESOLVE_LIMIT = 26;
export type ResolveNeed = "lead" | "trace" | "card" | "backlog";
const RESERVE: Record<ResolveNeed, number> = { lead: 0, trace: 4, card: 6, backlog: 14 };
const spentAt: number[] = [];
/** Each Google id's article, once found: one link seen by both desks and on every tick costs once. */
const found = new Map<string, string>();
const FOUND_MAX = 3000;

/** Look-ups left in the current half hour. */
export function resolvesLeft(now = Date.now()): number {
  while (spentAt.length && now - spentAt[0] > RESOLVE_WINDOW_MS) spentAt.shift();
  return RESOLVE_LIMIT - spentAt.length;
}

/** May a look-up for this need go out now? */
export function canResolve(need: ResolveNeed = "lead", now = Date.now()): boolean {
  return now >= restUntil && resolvesLeft(now) > RESERVE[need];
}

/** The article already found for this Google link, or "". Costs nothing. */
export function knownResolve(link: string): string {
  const id = /\/articles\/([^?/]+)/.exec(link)?.[1];
  return (id && found.get(id)) || "";
}

/** Tests: an empty budget and cache. */
export function resetResolver(): void {
  spentAt.length = 0;
  found.clear();
  restUntil = 0;
}

/**
 * The article a Google News link stands for. The link carries an opaque id;
 * Google's own page gives a signature for it, and its batchexecute endpoint
 * trades id + signature for the publisher's URL. "" when that fails, or when
 * the budget has nothing left for this need.
 */
export async function resolveGoogleNews(link: string, need: ResolveNeed = "lead"): Promise<string> {
  const id = /\/articles\/([^?/]+)/.exec(link)?.[1];
  if (!id) return "";
  const had = found.get(id);
  if (had) return had;
  if (!canResolve(need)) return "";
  spentAt.push(Date.now());
  resolves += 1;
  try {
    const page = await fetch(`https://news.google.com/articles/${id}`, {
      headers: { "user-agent": BROWSER_UA },
      signal: AbortSignal.timeout(8000),
    }).then((r) => {
      // Too many: Google asks for a rest, and gets one, rather than a retry.
      if (r.status === 429) restUntil = Date.now() + REST_MS;
      if (r.ok) return r.text();
      // An unread body left open can trip undici when the socket closes.
      return r.body ? r.body.cancel().then(() => "", () => "") : "";
    });
    const sg = /data-n-a-sg="([^"]+)"/.exec(page)?.[1];
    const ts = /data-n-a-ts="([^"]+)"/.exec(page)?.[1];
    if (!sg || !ts) return "";
    const inner = JSON.stringify([
      "garturlreq",
      [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      id,
      Number(ts),
      sg,
    ]);
    const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": BROWSER_UA },
      body: "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]])),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) restUntil = Date.now() + REST_MS;
    const text = await res.text();
    const url = /garturlres\\",\\"(https?:[^"\\]+)/.exec(text)?.[1] ?? "";
    const real = /^https?:\/\/(?!news\.google\.)/.test(url) && !isSectionFront(url) ? url : "";
    if (real) {
      if (found.size >= FOUND_MAX) found.delete(found.keys().next().value as string);
      found.set(id, real);
    }
    return real;
  } catch {
    return "";
  }
}

/** An item, with the outlet's name and its home page as Google gives them. */
export type GnewsItem = { title: string; link: string; at: number; outlet: string; site: string };

/**
 * The editions a search can run in. An outlet's own headlines are found in its
 * own language's edition: `site:repubblica.it Taif` finds la Repubblica's
 * stories in the Italian edition and nothing in the American one.
 */
const EDITIONS = {
  en: "hl=en-US&gl=US&ceid=US:en",
  ar: "hl=ar&gl=SA&ceid=SA:ar",
  gb: "hl=en-GB&gl=GB&ceid=GB:en",
  it: "hl=it&gl=IT&ceid=IT:it",
  fr: "hl=fr&gl=FR&ceid=FR:fr",
  de: "hl=de&gl=DE&ceid=DE:de",
  es: "hl=es-419&gl=ES&ceid=ES:es",
  tr: "hl=tr&gl=TR&ceid=TR:tr",
  ru: "hl=ru&gl=RU&ceid=RU:ru",
} as const;
export type Edition = keyof typeof EDITIONS;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&amp;/g, "&");
}

/** A Google News RSS search. `lang` picks the edition the query is run in. */
export async function searchGoogleNews(query: string, lang: Edition = "en"): Promise<GnewsItem[]> {
  // Google asked for a rest: its search waits it out with the link resolver.
  if (resolverResting()) return [];
  searches += 1;
  const ed = EDITIONS[lang] ?? EDITIONS.en;
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${ed}`, {
      headers: { "user-agent": BROWSER_UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return [];
    }
    const xml = await res.text();
    const out: GnewsItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const pick = (tag: string) => decode((m[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || "");
      const outlet = pick("source");
      const title = pick("title");
      // Google appends " - Outlet" to every title.
      const suffix = ` - ${outlet}`;
      out.push({
        title: (outlet && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title).trim(),
        link: pick("link").trim(),
        at: Date.parse(pick("pubDate")),
        outlet,
        site: /<source[^>]*\burl="([^"]*)"/.exec(m[1])?.[1] ?? "",
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Hosts whose outlet's name is not its domain's. */
const HOST_NAMES: Record<string, string> = {
  "shafaq.com": "Shafaq News",
  "moneycontrol.com": "Moneycontrol",
  "malaymail.com": "Malay Mail",
  "indiatoday.in": "India Today",
  "news.cn": "Xinhua",
  "xinhuanet.com": "Xinhua",
  "aa.com.tr": "Anadolu Ajansı",
  "timesofindia.indiatimes.com": "Times of India",
  "thehindu.com": "The Hindu",
  "dawn.com": "Dawn",
  "rudaw.net": "Rudaw",
  "kurdistan24.net": "Kurdistan24",
  "presstv.ir": "Press TV",
  "tehrantimes.com": "Tehran Times",
  "irna.ir": "IRNA",
  "al-monitor.com": "Al-Monitor",
  "timesofisrael.com": "Times of Israel",
  "jpost.com": "Jerusalem Post",
  "bostonglobe.com": "The Boston Globe",
  "aljazeera.com": "Al Jazeera",
  "aljazeera.net": "Al Jazeera",
  "alarabiya.net": "Al Arabiya",
  "aawsat.com": "Asharq Al-Awsat",
  "apnews.com": "AP",
  "eremnews.com": "Erem News",
  "al-akhbar.com": "Al-Akhbar",
  "almodon.com": "Al-Modon",
  "nidaalwatan.com": "Nidaa al-Watan",
  "addiyar.com": "Ad-Diyar",
  "lebanondebate.com": "Lebanon Debate",
  "elnashra.com": "Elnashra",
  "aljoumhouria.com": "Al-Joumhouria",
};

/**
 * The outlet behind a Google News item whose title named none (9 Oct: Shafaq
 * News' Parvizkhan story went out under "Google News"). Google is never the
 * teller: the article's own site is.
 */
export function outletFromHost(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^(?:www|en|english|m|amp|news)\./, "");
  } catch {
    return "";
  }
  if (!host || /(?:^|\.)google\./.test(host)) return "";
  for (const [h, name] of Object.entries(HOST_NAMES)) if (host === h || host.endsWith(`.${h}`)) return name;
  const stem = host.split(".").slice(-2)[0] ?? "";
  return stem.length >= 3 ? stem[0].toUpperCase() + stem.slice(1) : "";
}
