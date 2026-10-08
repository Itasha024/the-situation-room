/**
 * Where a speaker said it: the interview, the outlet he sat down with. Server-only.
 *
 * Relays post a leader's lines without saying where they come from: Clash
 * Report and four Iranian channels carried Hegseth on Iran on 8 Oct, none
 * naming the venue, and the desk's search of the big US outlets for the words
 * found nothing, because the interview was Jack Posobiec's for Human Events,
 * which no news index carried (user, 8 Oct: "it doesn't think like an OSINT
 * researcher"). A researcher asks where he spoke today: "Hegseth tells",
 * "Hegseth interview", "Hegseth exclusive" over the past day. The answer is an
 * outlet's headline or post naming him and the interview, from the hours
 * before the relays. That outlet's interview leads the card as its exclusive.
 */

import { BROWSER_UA } from "./gnews.ts";
import type { Speaker } from "./speakers.ts";

export type WebResult = { url: string; title: string };
export type Venue = { url: string; source: string; title: string; told: true };

/** Headline words that say the speaker gave this outlet the words himself. */
const INTERVIEW = /\b(?:tells|told|interview(?:ed|s)?|exclusive|sits? down with|sat down with|speaks? to|spoke to|in conversation with|joins)\b/i;
/** Where his words are only retold. */
const RELAY_HOST = /(?:^|\.)(?:jfeed\.com|godlikeproductions\.com|tigerdroppings\.com|reddit\.com|msn\.com|yahoo\.com|bsky\.app|forth\.news|podcasts\.apple\.com|radio\.net|einnews\.com|wikipedia\.org)$/i;
/** Outlets' names by their sites, where a post links them. */
const OUTLET_OF: Record<string, string> = {
  "humanevents.com": "Human Events",
  "foxnews.com": "Fox News",
  "nypost.com": "NY Post",
  "dailycaller.com": "Daily Caller",
  "breitbart.com": "Breitbart",
  "washingtonexaminer.com": "Washington Examiner",
  "justthenews.com": "Just the News",
  "newsmax.com": "Newsmax",
  "cbsnews.com": "CBS",
  "nbcnews.com": "NBC News",
  "abcnews.go.com": "ABC",
  "cnn.com": "CNN",
  "axios.com": "Axios",
  "politico.com": "Politico",
  "foxbusiness.com": "Fox Business",
};

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};
const surname = (sp: Pick<Speaker, "name">) => sp.name.split(" ").slice(-1)[0];

/** The date a site's address carries ("/2026/10/08/"), as a day key, or "". */
export function urlDay(url: string): string {
  const m = /\/(20\d\d)[/-](\d\d)[/-](\d\d)(?:\/|-|$)/.exec(url);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The results that may be where he spoke: the headline names him and an
 * interview, the site is not a relay or an Israeli outlet, and the address
 * is from the report's day (or the day before). Posts on X are checked by
 * their own time afterwards.
 */
export function venueCandidates(results: WebResult[], sp: Pick<Speaker, "name">, reportAt: number, isIsraeli: (host: string) => boolean): WebResult[] {
  const name = new RegExp(`\\b${surname(sp)}\\b`, "i");
  const days = new Set([dayOf(reportAt), dayOf(reportAt - 24 * 3600_000)]);
  return results.filter((r) => {
    const host = hostOf(r.url);
    if (!host || RELAY_HOST.test(host) || isIsraeli(host)) return false;
    if (!name.test(r.title) || !INTERVIEW.test(r.title)) return false;
    if (/(?:^|\.)(?:x|twitter)\.com$/.test(host)) return /\/status\/\d+/.test(r.url);
    return days.has(urlDay(r.url));
  });
}

/** One page of DuckDuckGo's plain results for the past day. Empty on any refusal. */
let restUntil = 0;
export async function searchWeb(q: string): Promise<WebResult[]> {
  if (Date.now() < restUntil) return [];
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: { "user-agent": BROWSER_UA, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ q, df: "d" }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    const html = res.ok ? await res.text() : "";
    // A challenge page, not results: the search waits an hour (never bypassed).
    if (!res.ok || !/result__a/.test(html)) {
      if (!res.ok || /anomaly|captcha|challenge/i.test(html)) restUntil = Date.now() + 3600_000;
      return [];
    }
    const dec = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").trim();
    const out: WebResult[] = [];
    for (const m of html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      let url = m[1];
      const u = /[?&]uddg=([^&]+)/.exec(url);
      if (u) url = decodeURIComponent(u[1]);
      if (url.startsWith("//")) url = `https:${url}`;
      out.push({ url, title: dec(m[2]) });
    }
    return out;
  } catch {
    return [];
  }
}

type Fx = { created_timestamp?: number; text?: string; author?: { name?: string; screen_name?: string }; raw_text?: { facets?: { type?: string; replacement?: string }[] } };

/** A post on X: its time, author, and the article it links, through FxTwitter. */
async function xPost(url: string): Promise<{ at: number; author: string; link: string; text: string } | null> {
  const id = /\/status\/(\d+)/.exec(url)?.[1];
  if (!id) return null;
  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${id}`, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)" } });
    if (!res.ok) return null;
    const t = ((await res.json()) as { tweet?: Fx }).tweet;
    if (!t) return null;
    const text = String(t.text ?? "");
    const link = (text.match(/https?:\/\/\S+/g) ?? []).map((l) => l.replace(/[).,]+$/, "")).find((l) => !/(?:x|twitter)\.com|t\.co\//.test(l)) ?? "";
    return { at: Number(t.created_timestamp) * 1000, author: String(t.author?.name ?? t.author?.screen_name ?? ""), link: link.replace(/[?&]utm_[^&]*/g, "").replace(/\?$/, ""), text };
  } catch {
    return null;
  }
}

/** Found venues by speaker and day, so his other relays cost no search. */
const found = new Map<string, { v: Venue | null; at: number }>();

/**
 * The interview the speaker gave on the report's day, or null. A post on X
 * counts from 12 hours before the relay to an hour after; the article it
 * links leads, under its outlet's name, else the post under its author's.
 */
export async function findVenue(
  sp: Pick<Speaker, "name">,
  reportAt: number,
  isIsraeli: (host: string) => boolean,
  search: (q: string) => Promise<WebResult[]> = searchWeb,
): Promise<Venue | null> {
  const key = `${sp.name}|${dayOf(reportAt)}`;
  const was = found.get(key);
  if (was && (was.v || Date.now() - was.at < 30 * 60_000)) return was.v;
  const name = surname(sp);
  let v: Venue | null = null;
  for (const q of [`${name} tells`, `${name} exclusive`, `${name} interview`]) {
    for (const c of venueCandidates(await search(q), sp, reportAt, isIsraeli)) {
      if (/(?:^|\.)(?:x|twitter)\.com$/.test(hostOf(c.url))) {
        const p = await xPost(c.url);
        if (!p || p.at < reportAt - 12 * 3600_000 || p.at > reportAt + 3600_000) continue;
        const outlet = p.link ? OUTLET_OF[hostOf(p.link)] : undefined;
        v = outlet ? { url: p.link, source: outlet, title: c.title, told: true } : { url: c.url, source: p.author || name, title: c.title, told: true };
      } else {
        v = { url: c.url, source: OUTLET_OF[hostOf(c.url)] ?? hostOf(c.url), title: c.title, told: true };
      }
      break;
    }
    if (v) break;
  }
  found.set(key, { v, at: Date.now() });
  return v;
}
