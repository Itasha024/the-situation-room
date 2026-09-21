/**
 * Server-only live source scanner for the Yemen desk. Never import from client.
 *
 * Reads the operator's source catalogue on a per-source cadence, runs every raw
 * item through the interest gate and the English wire-style composer
 * (`src/lib/desk/*`), and keeps only what survives both.
 *
 * Two things this file deliberately records for every raw item, kept or dropped:
 *   seenAt — when THIS desk first saw it, which is what the scan box sorts on
 *   reason — why it was kept or dropped, so the operator can audit the judgement
 */

import { type Place } from "./desk/gazetteer.ts";
import { digest } from "./desk/digest.ts";
import { NOISE_REASONS, type Outcome } from "./desk/relevance.ts";
import { refreshBrief } from "./desk/brief-store.ts";
import { backupDaily } from "./desk/backup.ts";
import { type Candidate, confidenceOf, editCandidates, onRadar, queueForReading } from "./desk/editor.ts";
import { getStore } from "./desk/store.ts";
import { cleanUrl, isGnews, resolveGoogleNews } from "./desk/gnews.ts";
import { type ReRead, findCitation, traceOrigins } from "./desk/origin.ts";
import { sameStory, sameWords } from "./desk/copies.ts";
import { type OutletSide, outletSide } from "./desk/credibility.ts";
import type { LiveReport, RawScanHit, ScanPayload, ScanState, SourceStatus } from "./desk/types.ts";
import { pgSafe } from "./desk/store.pg.ts";

// The wire types moved to ./desk/types.ts so the store and the scanner can
// share them without importing each other. Re-exported so existing imports
// (brief.ts, the API routes) keep working unchanged.
export type { LiveReport, RawScanHit, ScanPayload, SourceStatus } from "./desk/types.ts";

type Channel = { id: string; name: string; lean: "houthi" | "gov" | "south" | "intl" };
type Cadence = { everyMin: number } | { everyHours: number } | { atHours: number[] } | { atHour: number };
type ChannelScan = Channel & { cadence: Cadence };
type RssFeed = { url: string; name: string; id: string; cadence: Cadence; mode?: "rss" | "homepage-pdf" | "homepage" };

const C5: Cadence = { everyMin: 5 };
const C15: Cadence = { everyMin: 15 };
const C3H: Cadence = { everyHours: 3 };
const C90: Cadence = { everyHours: 1.5 };
const C_AAWSAT: Cadence = { atHours: [17, 18, 20, 22] };
const C_AKHBAR: Cadence = { atHour: 7 };

/** Operator-supplied Telegram list — exclusive catalog. */
const TG: ChannelScan[] = [
  { id: "Alomhoar", name: "Al-Mihwar", lean: "houthi", cadence: C5 },
  { id: "Alibk3", name: "Ali Bk", lean: "houthi", cadence: C5 },
  { id: "SabrenNewss", name: "Sabereen News", lean: "houthi", cadence: C5 },
  { id: "naya_foriraq", name: "Naya", lean: "houthi", cadence: C5 },
  { id: "shin_persian", name: "Shin Persian", lean: "houthi", cadence: C5 },
  // The breaking-news channel, not the main one: the main channel posts
  // programme clips ("Marib and Taiz: the battle map") that read as live
  // fighting and were published as clashes happening now.
  { id: "AlarabyTvBrk", name: "Al-Araby TV (breaking)", lean: "intl", cadence: C5 },
  { id: "shajab_news", name: "Shajab News", lean: "houthi", cadence: C5 },
  { id: "bin_1saeed", name: "Bin Saeed", lean: "gov", cadence: C5 },
  { id: "AjaNews", name: "Al Jazeera", lean: "intl", cadence: C5 },
  { id: "alhadath_brk", name: "Al Hadath", lean: "gov", cadence: C5 },
  { id: "alarabiyaBr", name: "Al Arabiya Breaking", lean: "gov", cadence: C5 },
  { id: "SabaNewsyeMedia", name: "Saba", lean: "houthi", cadence: C5 },
  { id: "army21ye", name: "Yahya Saree", lean: "houthi", cadence: C5 },
  { id: "abdulsalamsalah", name: "Mohammed Abdulsalam", lean: "houthi", cadence: C5 },
  { id: "almasirah2", name: "Al-Masirah", lean: "houthi", cadence: C5 },
  { id: "alagsa3agel", name: "Al-Aqsa Breaking", lean: "houthi", cadence: C5 },
  // Their sites refuse automated readers (403); their channels post each
  // story's headline and first line, minutes after publication.
  { id: "Alakhbar_News", name: "Al-Akhbar", lean: "houthi", cadence: C15 },
  { id: "eremnews", name: "Erem News", lean: "gov", cadence: C15 },
];

function gnews(q: string, hl = "en-US", gl = "US", ceid = "US:en") {
  const enc = encodeURIComponent(q);
  return `https://news.google.com/rss/search?q=${enc}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

const YE_AR = "(اليمن OR الحوث OR الحوثي OR صنعاء OR السعودية OR باب المندب)";
const YE_EN = "(Yemen OR Houthi OR Houthis OR \"Red Sea\" OR \"Bab el-Mandeb\" OR Saudi)";
const US_TALK = "(Trump OR \"White House\" OR \"State Department\" OR Rubio OR Vance)";

const RSS: RssFeed[] = [
  { id: "almashhad", url: "https://www.almashhad.news/feed", name: "Almashhad", cadence: C5 },
  { id: "alaraby", url: gnews(`site:alaraby.co.uk ${YE_AR} when:3d`, "ar", "GB", "GB:ar"), name: "Al-Araby Al-Jadeed", cadence: C3H },
  { id: "alaraby-pol", url: gnews(`site:alaraby.co.uk/politics ${YE_AR} when:3d`, "ar", "GB", "GB:ar"), name: "Al-Araby Al-Jadeed", cadence: C3H },
  // The TV channel's own site (alaraby.com), not the paper's: its interviews
  // with officials are posted there and not on the breaking channel.
  { id: "alaraby-tv", url: gnews(`site:alaraby.com ${YE_AR} when:2d`, "ar", "QA", "QA:ar"), name: "Al-Araby TV", cadence: C90 },
  { id: "aawsat", url: gnews(`site:aawsat.com ${YE_AR} when:1d`, "ar", "SA", "SA:ar"), name: "Asharq Al-Awsat", cadence: C_AAWSAT },
  { id: "aawsat-me", url: gnews(`site:aawsat.com (الشرق الأوسط) ${YE_AR} when:1d`, "ar", "SA", "SA:ar"), name: "Asharq Al-Awsat", cadence: C_AAWSAT },
  { id: "akhbar", url: gnews(`site:al-akhbar.com ${YE_AR} when:2d`, "ar", "LB", "LB:ar"), name: "Al-Akhbar", cadence: C_AKHBAR },
  // No homepage/PDF source: al-akhbar.com answers every automated request with
  // a Cloudflare bot challenge (403), so Al-Akhbar comes through Google News.
  { id: "erem", url: gnews(`site:eremnews.com ${YE_AR} when:2d`, "ar", "AE", "AE:ar"), name: "Erem News", cadence: C3H },
  { id: "alhurra", url: gnews(`site:alhurra.com ${YE_AR} when:2d`, "ar", "US", "US:ar"), name: "Alhurra", cadence: C3H },
  { id: "arabnews", url: "https://www.arabnews.com/rss.xml", name: "Arab News", cadence: C3H },
  { id: "reuters", url: gnews(`site:reuters.com ${YE_EN} when:2d`), name: "Reuters", cadence: C90 },
  { id: "wsj", url: gnews(`site:wsj.com ${YE_EN} when:3d`), name: "WSJ", cadence: C90 },
  { id: "wapo", url: gnews(`site:washingtonpost.com ${YE_EN} when:3d`), name: "Washington Post", cadence: C90 },
  { id: "nyt", url: gnews(`site:nytimes.com ${YE_EN} when:3d`), name: "NYT", cadence: C90 },
  { id: "nypost", url: gnews(`site:nypost.com ${YE_EN} when:3d`), name: "NY Post", cadence: C90 },
  { id: "axios", url: gnews(`site:axios.com ${YE_EN} when:3d`), name: "Axios", cadence: C90 },
  { id: "cnn", url: gnews(`site:cnn.com ${YE_EN} when:3d`), name: "CNN", cadence: C90 },
  { id: "abc", url: gnews(`site:abcnews.go.com ${YE_EN} when:3d`), name: "ABC", cadence: C90 },
  { id: "cbs", url: gnews(`site:cbsnews.com ${YE_EN} when:3d`), name: "CBS", cadence: C90 },
  { id: "fox", url: gnews(`site:foxnews.com ${YE_EN} when:3d`), name: "Fox News", cadence: C90 },
  { id: "us-talk", url: gnews(`${US_TALK} ${YE_EN} (site:reuters.com OR site:wsj.com OR site:washingtonpost.com OR site:nytimes.com OR site:cnn.com OR site:axios.com OR site:state.gov) when:3d`), name: "US media", cadence: C90 },
  { id: "spa", url: gnews(`site:spa.gov.sa (Yemen OR Houthi OR Houthis OR اليمن OR الحوث) when:2d`, "en", "SA", "SA:en"), name: "SPA", cadence: C5 },
];

/* ------------------------------------------------------------------ *
 * Cadence bookkeeping
 * ------------------------------------------------------------------ */

function cadenceLabel(c: Cadence): string {
  if ("everyMin" in c) return `every ${c.everyMin} min`;
  if ("everyHours" in c) return c.everyHours === 1.5 ? "every 90 min" : `every ${c.everyHours} h`;
  if ("atHours" in c) return `at ${c.atHours.map((h) => `${String(h).padStart(2, "0")}:00`).join(" / ")}`;
  if ("atHour" in c) return `daily at ${String(c.atHour).padStart(2, "0")}:00`;
  return "";
}

function jerusalemClock(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), minute: Number(p.minute) };
}

/**
 * Is this source due?
 *
 * `state` comes from the store rather than module memory: a Vercel cold start
 * used to reset the cadence map, so the scanner either believed it had never
 * run (re-fetching all 38 sources every request) or lost the fact that it had.
 */
function cadenceDue(state: ScanState, id: string, cadence: Cadence, now: number): boolean {
  if (!state.scannedOnce) return true;
  const last = state.lastScanAt[id] || 0;
  const age = now - last;
  if ("everyMin" in cadence) return age >= cadence.everyMin * 60_000 - 20_000;
  if ("everyHours" in cadence) return age >= cadence.everyHours * 3_600_000 - 90_000;
  const { hour } = jerusalemClock(new Date(now));
  if ("atHours" in cadence) {
    if (!cadence.atHours.includes(hour)) return false;
    return age >= 45 * 60_000;
  }
  if ("atHour" in cadence) {
    if (hour !== cadence.atHour) return false;
    return age >= 45 * 60_000;
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Payload shapes
 * ------------------------------------------------------------------ */

function jerusalemIso(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+03:00`;
}

/* ------------------------------------------------------------------ *
 * Fetch / parse
 * ------------------------------------------------------------------ */

export function decodeEntities(s: string) {
  return pgSafe(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fpOf(url: string, title: string) {
  const slug = (url || title)
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .slice(0, 72);
  return "live-" + slug;
}

/** 1–5, the figure shown on the card. Derived from tier and gate score. */
function confidenceFrom(tier: string, score: number): number {
  const base = tier === "agency" ? 4 : tier === "claim" ? 2.8 : 2.2;
  const bump = Math.min(0.9, (score / 100) * 0.9);
  return Math.round((base + bump) * 10) / 10;
}

function isIsraeliSource(source: string, url: string): boolean {
  return /israel|jpost|haaretz|ynet|walla\.co|maariv|kan\.org|\.inn\.co|israelnationalnews|timesofisrael|i24news/i.test(
    `${source} ${url}`,
  );
}

function bestPlace(places: Place[]): Place | undefined {
  const land = places.find((p) => p.country !== "sea");
  return land || places[0];
}

type Composed = {
  report: LiveReport | null;
  outcome: Outcome;
  reason: string;
  note: string;
  note2?: string;
  tags: string[];
  topicality: number;
};

function toLiveReport(source: string, url: string, rawText: string, at: string, fpSeed: string, lean = "", officialDown = false): Composed {
  const no = (reason: string, note: string, outcome: Outcome = "exclude"): Composed => ({
    report: null,
    outcome,
    reason,
    note,
    tags: [],
    topicality: 0,
  });

  if (isIsraeliSource(source, url)) {
    return no("excluded-source", "Outlet excluded from this desk's catalogue.");
  }
  try {
    const u = new URL(url);
    if (!u.pathname || u.pathname === "/" || /^\/[a-z]{2}\/?$/.test(u.pathname)) {
      return no("no-article", "Link points at a section front, not a specific report.");
    }
  } catch {
    return no("bad-url", "Item had no usable link.");
  }

  const d = digest(source, rawText, lean, 0, officialDown);
  // A composition failure on a relevant item lands in the tray, not the bin:
  // the desk not being able to phrase something is not a reason to lose it.
  if (!d.ok) {
    // On the wide radar (an official speaking, an alert in Saudi Arabia): the
    // reader decides, not the keyword gate.
    if (d.outcome === "exclude" && onRadar(rawText)) {
      return { report: null, outcome: "tray", reason: "radar", note: "Official statement or alert: sent to the reader.", tags: [...d.tags, "radar"], topicality: 0 };
    }
    return { report: null, outcome: d.outcome, reason: d.reason, note: d.note, tags: d.tags, topicality: 0 };
  }

  const place = bestPlace(d.places);
  const row: LiveReport = {
    fp: fpOf(url, fpSeed),
    at,
    source,
    url,
    type: d.type,
    summary: d.headline,
    text: d.body,
    live: true,
    confidence: confidenceFrom(d.tier, d.score),
    score: d.score,
    tier: d.tier,
    tags: d.tags,
  };
  if (place) {
    row.place = place.name;
    row.lat = place.lat;
    row.lng = place.lng;
  }
  return {
    report: row,
    outcome: d.outcome,
    reason: d.reason,
    note: d.note,
    tags: d.tags,
    topicality: d.score,
  };
}

async function fetchText(url: string, ms = 8000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "YemenDesk/2.0 (OSINT desk)",
        accept: "text/html,application/rss+xml,application/xml,text/xml,*/*",
        "accept-language": "ar,en;q=0.8",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function extractLead(html: string): string {
  const og =
    (html.match(/property=["']og:description["'][^>]*content=["']([^"']{40,})["']/i) || [])[1] ||
    (html.match(/content=["']([^"']{40,})["'][^>]*property=["']og:description["']/i) || [])[1] ||
    "";
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1]))
    .filter((p) => p.length > 50 && !/copyright|subscribe|cookie|javascript/i.test(p));
  const parts: string[] = [];
  if (og) parts.push(decodeEntities(og));
  for (const p of paras.slice(0, 5)) {
    if (!parts.some((x) => x.includes(p.slice(0, 50)))) parts.push(p);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 2200);
}

/* ------------------------------------------------------------------ *
 * Volume. The feed is meant to be a stream: these bound one cycle's work,
 * they are not an editorial filter. Anything relevant that arrives inside
 * them reaches the store, which accumulates.
 * ------------------------------------------------------------------ */

/** Items read from one RSS feed per cycle. Google News lists up to 100. */
const RSS_ITEMS = 25;

/** Every source the clock reads, with its lastScanAt key: the status page's list. */
export function sourceList(): { key: string; name: string }[] {
  return [...TG.map((c) => ({ key: `tg:${c.id}`, name: c.name })), ...RSS.map((f) => ({ key: `web:${f.id}`, name: f.name }))];
}
/** Extra `?before=` pages read from one channel to reach the last post seen. */
const TG_BACKFILL_PAGES = 4;
/**
 * One-time replay: posts from the 21 September speech (from 15:00) folded or
 * dropped before the speech and grouping fixes, and the missed Haifan strikes;
 * earlier: posts from 21 September that were rejected before the
 * Arabic-place-name and scope fixes had already scrolled past the pages a
 * tick reads. Each listed channel pages back to the start of that day once;
 * already-published posts dedupe on insert. Inert after `until`.
 */
const REPLAY = {
  since: Date.parse("2026-09-21T15:00:00+03:00"),
  until: Date.parse("2026-09-23T00:00:00+03:00"),
  channels: new Set(["almasirah2", "alagsa3agel", "Alomhoar"]),
  pages: 10,
};
/** Nothing older than this is news for a live desk, however a feed lists it. */
const MAX_ITEM_AGE_MS = 72 * 3600 * 1000;
/** Article pages fetched per cycle to fill thin teasers. Cached by URL. */
const BODY_FETCHES = 40;
/** Reports kept in the cycle payload (the scan box and carry-forward). */
const PAYLOAD_REPORTS = 300;
/** Raw items kept in the cycle payload for the scan box. */
const PAYLOAD_RAW_HITS = 400;

const LEAD_CACHE_KEY = "lead-cache";
const LEAD_CACHE_MAX = 3000;
/** url → the lead paragraph pulled from it ("" when the page had none). */
type LeadCache = Record<string, { lead: string; at: number; real?: string; tries?: number }>;
/** Google News links resolved to their article per cycle (two requests each). */
const GNEWS_RESOLVES = 12;
/** A Google News item waits this many cycles for its article's address. */
const GNEWS_HOLD_TRIES = 3;

type RawHit = {
  source: string;
  url: string;
  text: string;
  at: string;
  lean: string;
  fromTg: boolean;
  /** The channel post this one replies to, on Telegram. */
  replyUrl?: string;
};

function outletFromGoogleTitle(title: string, fallback: string): { title: string; source: string } {
  const m = title.match(/^(.*)\s[-–—]\s+(.{3,48})$/);
  if (!m) return { title, source: fallback };
  const outlet = m[2].trim();
  const mapped =
    /fox news/i.test(outlet) ? "Fox News"
    : /alaraby|new arab|العربي الجديد/i.test(outlet) ? "Al-Araby Al-Jadeed"
    : /al[- ]?akhbar|الأخبار/i.test(outlet) ? "Al-Akhbar"
    : /aawsat|الشرق الأوسط|asharq al-awsat/i.test(outlet) ? "Asharq Al-Awsat"
    : /alhurra|الحرة/i.test(outlet) ? "Alhurra"
    : /erem|إرم/i.test(outlet) ? "Erem News"
    : /okaz|عكاظ/i.test(outlet) ? "Okaz"
    : /al-?watan|الوطن/i.test(outlet) ? "Al-Watan"
    : /reuters/i.test(outlet) ? "Reuters"
    : /associated press|^AP$/i.test(outlet) ? "AP"
    : /politico/i.test(outlet) ? "Politico"
    : /cnbc/i.test(outlet) ? "CNBC"
    : /wsj|wall street/i.test(outlet) ? "WSJ"
    : fallback === "US media" ? outlet.replace(/\s+/g, " ").slice(0, 28)
    : fallback;
  return { title: m[1].trim(), source: mapped };
}

function parseRss(xml: string, source: string): RawHit[] {
  const items: RawHit[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const b of blocks.slice(0, RSS_ITEMS)) {
    let title = decodeEntities((b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const desc = decodeEntities((b.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || "");
    const linkRaw =
      (b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] ||
      (b.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1] ||
      "";
    const guid = decodeEntities((b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || "");
    const dateRaw = (b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || "";
    let url = decodeEntities(linkRaw || guid).replace(/&amp;/g, "&").trim();
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    let src = source;
    if (/news\.google\.com/i.test(url)) {
      const g = outletFromGoogleTitle(title, source);
      title = g.title;
      src = g.source;
      // Keep Google's per-article link. <source url> is only the outlet's
      // homepage; swapping it in made every Google item a "section front".
    }
    if (title.length < 12) continue;
    if (isIsraeliSource(src, url)) continue;
    const blob = `${title} ${desc}`.slice(0, 1200);
    let at = jerusalemIso();
    const parsed = Date.parse(dateRaw);
    if (Number.isFinite(parsed)) at = jerusalemIso(new Date(parsed));
    items.push({ source: src, url, text: blob, at, lean: "", fromTg: false });
  }
  return items;
}

/** The post number in a t.me/<channel>/<n> URL, or 0. */
function tgPostNo(url: string): number {
  const m = /\/(\d+)(?:\?|$)/.exec(url);
  return m ? Number(m[1]) : 0;
}

export function parseTelegram(html: string, ch: Channel): RawHit[] {
  const items: RawHit[] = [];
  const parts = html.split("tgme_widget_message_wrap");
  // t.me/s lists a channel's latest ~20 posts OLDEST FIRST. Reading a prefix of
  // the page (as this once did, `slice(1, 16)`) kept the oldest posts and
  // silently dropped the newest ones — so every part is read.
  for (const p of parts.slice(1)) {
    const hrefs = [...p.matchAll(new RegExp(`href="(https://t\\.me/${ch.id}/\\d+)"`, "gi"))].map((m) => m[1]);
    const textHtml = (p.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
    const datetime = (p.match(/datetime="([^"]+)"/) || [])[1] || "";
    const text = decodeEntities(textHtml);
    if (!text || text.length < 12) continue;
    // The post's own link: a reply's first link is the post it replies to.
    const own = (p.match(/data-post="([^"]+)"/) || [])[1];
    const url = own ? `https://t.me/${own}` : (hrefs[0] || "").split("?")[0];
    if (!url) continue;
    const replyUrl = (p.match(/class="tgme_widget_message_reply[^"]*"[^>]*href="([^"?]+)/) || [])[1];
    let at = jerusalemIso();
    const parsed = Date.parse(datetime);
    if (Number.isFinite(parsed)) at = jerusalemIso(new Date(parsed));
    items.push({ source: ch.name, url, text, at, lean: ch.lean, fromTg: true, ...(replyUrl && replyUrl !== url ? { replyUrl } : {}) });
  }
  return items;
}

/* ------------------------------------------------------------------ *
 * Story clustering — one line per story per day
 * ------------------------------------------------------------------ */

function frontBucket(r: LiveReport): string {
  const s = `${r.place || ""} ${r.summary || ""} ${r.text || ""}`;
  if (/Kahbub|Bab al-Mandab|Mayun|Dhubab/i.test(s)) return "bab";
  if (/Al-Wazi'iyah|Al-Dharifah|Sharirah|Al-Alqamah/i.test(s)) return "waziyah";
  if (/Marib|Wadi Dhanah|East Balaq|Balaq/i.test(s)) return "marib";
  if (/Al-Jawf|Al-Hazm\b/i.test(s)) return "jawf";
  if (/Hodeidah|Al-Khokha|Hays/i.test(s)) return "hudaydah";
  if (/Lahj|Al-Aghbara|Al-Mudaribah|Aden/i.test(s)) return "lahj-south";
  if (/Sanaa|Azal/i.test(s)) return "sanaa";
  if (/Yanbu|Jeddah|Aramco|crude|oil|Suez|pipeline/i.test(s) || r.type === "economy") return "energy";
  if (/Jazan|Najran|Khamis|Abha|Taif|Mecca|Riyadh|Al-Kharj|Farasan|Al-Ula|Sharurah/i.test(s)) return "ksa-strike";
  return `${r.type || "x"}-other`;
}

/** Overnight sirens on both sides of midnight are one story. */
function nightYmd(at: string): string {
  const ymd = String(at || "").slice(0, 10);
  const hour = parseInt(String(at || "").slice(11, 13), 10);
  if (!ymd || !Number.isFinite(hour) || hour >= 5) return ymd;
  const d = Date.parse(at);
  if (!Number.isFinite(d)) return ymd;
  return jerusalemIso(new Date(d - 5 * 3600 * 1000)).slice(0, 10);
}

function hourOfIso(iso: string): number {
  const h = parseInt(String(iso || "").slice(11, 13), 10);
  return Number.isFinite(h) ? h : 0;
}

/**
 * The speaker a statement headline opens with — "Al-Mashat says …",
 * "Trump: …" — lowercased, or "" when there is none or it is generic. "A
 * spokesman" or "the official" in two posts are not known to be one person,
 * so they are never grouped on that alone.
 */
/** A channel's side by its name; outlets not on the list are international. */
function sideOfSource(name: string): OutletSide {
  return outletSide(name, TG.find((c) => c.name === name)?.lean ?? "intl");
}

/** One key per person, whatever the title: "US President Donald Trump" is "trump". */
export function speakerKey(who: string): string {
  const w = who.toLowerCase().replace(/^(?:the\s+)?(?:u\.?s\.?|us|american|former)\s+/, "");
  const known = /\b(trump|rubio|vance|hegseth|biden|netanyahu|khamenei|araghchi|guterres|grundberg)\b/.exec(w);
  if (known) return known[1];
  if (/bin salman|\bmbs\b|saudi crown prince/.test(w)) return "mbs";
  return w.replace(/^(?:president|secretary of state|secretary|minister|prime minister)\s+/, "");
}

export function namedSpeaker(summary: string): string {
  const m = /^(.{2,48}?)(?::\s|\s(?:says|said|tells|told|warns|warned|denies|denied)\b)/.exec(summary || "");
  if (!m) return "";
  const who = m[1].trim();
  if (/^(an?|the)\s/i.test(who)) return "";
  if (/^(spokes(?:man|woman|person)|officials?|sources?|commanders?|ministers?)$/i.test(who)) return "";
  return speakerKey(who);
}

const FIELD_TYPES = new Set(["combat", "strike", "economy", "vessel", "port"]);
/** Copies of one event arrive within this long of each other. */
const COPY_WINDOW_MS = 30 * 60 * 1000;

function storyKey(r: LiveReport): string {
  const s = r.summary;
  if (/air raid sirens|air defence alerts/i.test(s)) {
    const city = /Riyadh|Al-Kharj/i.test(s) ? "riyadh" : "ksa";
    return `${nightYmd(r.at)}|alert|${city}`;
  }
  if (/crude shipments|East-West pipeline|Yanbu loadings/i.test(s)) return "oil-cancel";
  if (/asked Syria for fighters/i.test(s)) return "syria-fighters";
  const ymd = String(r.at || "").slice(0, 10);
  const bucket = frontBucket(r);
  if (r.type === "combat" || r.type === "strike" || r.type === "economy" || r.type === "vessel" || r.type === "port") {
    return `${ymd}|${r.type}|${bucket}`;
  }
  if (r.type === "statement" || r.type === "diplomacy") {
    // One speech arrives as many posts, each quoting a different line. Keyed
    // on the headline those never matched, so one speech became six cards.
    // A NAMED speaker within a three-hour slot is one story.
    const who = namedSpeaker(s);
    if (who) return `${ymd}|stmt|${who}|${Math.floor(hourOfIso(r.at) / 3)}`;
    const stem = s.replace(/[^a-zA-Z]/g, "").slice(0, 28).toLowerCase();
    return `${ymd}|stmt|${stem || r.url.split("?")[0]}`;
  }
  return r.url.split("?")[0];
}

/** How far back a new statement is matched against cards already published. */
const STORY_WINDOW_MS = 18 * 3600 * 1000;

/**
 * A statement or diplomacy report that tells a story already on the desk, as
 * another outlet's take, is not a new card: its outlet joins that card's
 * "Also". Grouping inside one scan never saw the cards of earlier scans, so
 * one Reuters story became seven cards over half an hour. `published` are the
 * fps already on the desk; only reports not among them can fold. `stored` are
 * recent desk rows the payload no longer carries; the ones given a new "Also"
 * are returned, so the store can save it.
 */
export function foldIntoPublished(reports: LiveReport[], published: Set<string>, stored: LiveReport[] = []): LiveReport[] {
  const talk = (r: LiveReport) => r.type === "statement" || r.type === "diplomacy";
  const byTime = [...reports].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  // Cards already on the desk that this cycle's payload no longer carries.
  const inPayload = new Set(reports.map((r) => r.fp));
  const homes = [...byTime, ...stored.filter((s) => !inPayload.has(s.fp))];
  const gone = new Set<LiveReport>();
  const touched = new Set<LiveReport>();
  for (const r of byTime) {
    if (published.has(r.fp)) continue;
    const t = Date.parse(r.at);
    const open = (o: LiveReport) => o !== r && !gone.has(o) && o.fp !== r.fp;
    // The reader said it: this is another outlet on an event already published.
    let home = r.duplicateOf ? homes.find((o) => open(o) && o.fp === r.duplicateOf) : undefined;
    // The same post forwarded by another channel, seen in a later scan.
    if (!home && r.copyKey) home = homes.find((o) => open(o) && o.copyKey === r.copyKey && Date.parse(o.at) <= t);
    // Another outlet's "follow-up" that only retells the card it follows.
    if (!home && r.replyTo) {
      const p = homes.find((o) => open(o) && o.fp === r.replyTo);
      if (p && p.source !== r.source && sameStory(p, r)) home = p;
    }
    if (!home && talk(r)) {
      home = homes.find(
        (o) => open(o) && o.source !== r.source && talk(o) && Date.parse(o.at) <= t && t - Date.parse(o.at) <= STORY_WINDOW_MS && sameStory(o, r),
      );
    }
    if (!home) continue;
    gone.add(r);
    // A card written from the original source needs no "Also": the others
    // only relay it.
    if (isOriginal(home) || r.citing === home.source) continue;
    const also = [...(home.alsoReportedBy ?? []), ...(r.alsoReportedBy ?? []), { source: r.source, url: r.url }];
    const seen = new Set([home.source]);
    home.alsoReportedBy = also.filter((a) => !seen.has(a.source) && (seen.add(a.source), true)).slice(0, 8);
    // More outlets, more trust: counted by side, as in the cycle's own grouping.
    if (home.side) home.confidence = confidenceOf(home, home.alsoReportedBy.map((a) => sideOfSource(a.source)));
    if (!inPayload.has(home.fp)) touched.add(home);
  }
  for (let i = reports.length - 1; i >= 0; i -= 1) if (gone.has(reports[i])) reports.splice(i, 1);
  return [...touched];
}

/**
 * US officials whose remarks are looked for at their own sources — the White
 * House, State, the Pentagon, the wires, the TV networks — as soon as a card
 * quotes them: a relay carries one line, the original carries all of them.
 */
const SPEAKER_SEARCH: Record<string, string> = { trump: "Trump", vance: "Vance", rubio: "Rubio", hegseth: "Hegseth" };
const SPEAKER_SEARCH_GAP_MS = 60 * 60_000;
const SPEAKER_SEARCHES_PER_TICK = 2;

/** One Google News search per quoted official, read this tick alongside the feeds. */
export function speakerSearches(reports: LiveReport[], state: ScanState, now: number): RssFeed[] {
  const out: RssFeed[] = [];
  for (const r of reports) {
    if (out.length >= SPEAKER_SEARCHES_PER_TICK) break;
    if ((r.type !== "statement" && r.type !== "diplomacy") || now - Date.parse(r.at) > 3 * 3600_000) continue;
    const key = namedSpeaker(r.summary);
    const name = SPEAKER_SEARCH[key];
    const id = `spk-${key}`;
    if (!name || out.some((f) => f.id === id) || now - (state.lastScanAt[`web:${id}`] ?? 0) < SPEAKER_SEARCH_GAP_MS) continue;
    out.push({ id, url: gnews(`"${name}" (Yemen OR Houthi OR Houthis OR Saudi OR "Red Sea") when:1d`), name: "US media", cadence: C90 });
  }
  return out;
}

/** A follow-up this soon after the same outlet's card on the same story replies to it. */
const FOLLOW_MS = 15 * 60_000;
const FOLLOW_GENERIC = new Set(
  ("saudi houthi houthis forces yemen yemeni government says said sources source report reports strike strikes " +
    "raid raids attack attacks target targets targeted amid after over into with from their against new").split(" "),
);
const followWords = (s: string) =>
  new Set(
    String(s || "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 && !FOLLOW_GENERIC.has(w))
      .map((w) => w.replace(/(?:ing|ed|es|s)$/, "")),
  );

/**
 * "Fuel shortages in Sanaa" then, a minute later from the same outlet, "Houthis
 * allocate fuel to military operations": the second follows the first. Same
 * source, within 15 minutes, and a word of substance in common.
 */
export function linkFollowUps(fresh: LiveReport[], pool: LiveReport[]): void {
  for (const r of fresh) {
    if (r.replyTo || r.type === "statement") continue;
    const t = Date.parse(r.at);
    const mine = followWords(r.summary);
    const prev = pool
      .filter((x) => x.fp !== r.fp && x.source === r.source && Date.parse(x.at) < t && t - Date.parse(x.at) <= FOLLOW_MS)
      .filter((x) => [...followWords(x.summary)].some((w) => mine.has(w)))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    if (prev) r.replyTo = prev.fp;
  }
}

/** Outlet feeds read early per tick because a channel cited them. */
const HINTS_PER_TICK = 3;

/**
 * A channel relaying "the WSJ reports ..." hints that the outlet has a story:
 * the outlet's own feeds are read next tick instead of at their hour.
 */
export function hintOutlets(state: ScanState, hits: { text: string; source: string; url: string; fromTg?: boolean }[], now: number): string[] {
  const sites = new Set<string>();
  for (const h of hits) {
    if (!h.fromTg) continue;
    const c = findCitation(h.text, h.source, h.url);
    if (c) sites.add(c.site);
  }
  const out: string[] = [];
  for (const feed of RSS) {
    if (out.length >= HINTS_PER_TICK) break;
    const site = /site:([a-z0-9.-]+)/i.exec(decodeURIComponent(feed.url))?.[1];
    const last = state.lastScanAt[`web:${feed.id}`] ?? 0;
    // Already hinted, or read in the last ten minutes: nothing to add.
    if (!site || !sites.has(site) || (state.lastScanAt[`hint:web:${feed.id}`] ?? 0) > last || now - last < 10 * 60_000) continue;
    state.lastScanAt[`hint:web:${feed.id}`] = now;
    out.push(feed.id);
  }
  return out;
}

/** Written from the original source's own article: a relay's card moved to it. */
export function isOriginal(r: LiveReport): boolean {
  return !!r.tags?.includes("original") || (r.fp.startsWith("live-t-me-") && !r.url.startsWith("https://t.me/"));
}

/** A speaker silent this long has finished; the next line starts a new thread. */
const SPEECH_GAP_MS = 45 * 60 * 1000;
/** Lines of a speech another outlet posts after it ended, as long as this after its last line. */
const LATE_RELAY_MS = 6 * 3600 * 1000;

/**
 * A live speech arrives one line per post, and each newsworthy line is its own
 * card replying to the speaker's previous line, so the feed shows the speech
 * as one thread from its first line. A line that arrives late (a replay, a
 * slow scan) takes its place in time: the line after it is re-pointed to it.
 * `stored` are desk rows the payload no longer carries; the ones re-pointed
 * are returned, so the store can save them.
 */
export function threadSpeeches(reports: LiveReport[], _published: Set<string>, stored: LiveReport[] = []): LiveReport[] {
  const inPayload = new Set(reports.map((r) => r.fp));
  const all = [...reports, ...stored.filter((s) => !inPayload.has(s.fp))];
  const lines = all
    .filter((r) => r.type === "statement" && namedSpeaker(r.summary))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const byFp = new Map(lines.map((r) => [r.fp, r]));
  const last = new Map<string, LiveReport>();
  const touched: LiveReport[] = [];
  for (const r of lines) {
    const who = namedSpeaker(r.summary);
    const prev = last.get(who);
    last.set(who, r);
    // Another outlet posting lines of the speech after it ended (Saba's summary,
    // hours later) still belongs to it.
    const gap = prev && prev.source !== r.source && who === "houthi leader" ? LATE_RELAY_MS : SPEECH_GAP_MS;
    if (!prev || Date.parse(r.at) - Date.parse(prev.at) > gap || r.replyTo === prev.fp) continue;
    // A reply to something else than this speech stays; one to an earlier
    // line of it moves to the line now just before it.
    const to = r.replyTo ? byFp.get(r.replyTo) : undefined;
    if (r.replyTo && !(to && namedSpeaker(to.summary) === who && Date.parse(to.at) < Date.parse(prev.at))) continue;
    r.replyTo = prev.fp;
    if (!inPayload.has(r.fp)) touched.push(r);
  }
  return touched;
}

/** Which of two reports on the same story to keep. */
function scoreReport(x: LiveReport): number {
  return (
    (x.score || 0) * 2 +
    (x.tier === "agency" ? 60 : x.tier === "claim" ? 20 : 0) +
    String(x.summary || "").length +
    (x.place ? 25 : 0) +
    // A speaker's own channel is the original of his words.
    (OWN_CHANNELS.has(x.source) ? 120 : 0)
  );
}
const OWN_CHANNELS = new Set(["Yahya Saree", "Mohammed Abdulsalam"]);

/* ------------------------------------------------------------------ *
 * Persist to the desk snapshot
 * ------------------------------------------------------------------ */

function harvestHomepage(html: string, source: string): RawHit[] {
  const items: RawHit[] = [];
  const seen = new Set<string>();
  const abs = (href: string) => {
    const h = href.replace(/&amp;/g, "&").split("#")[0];
    if (/^https?:\/\//i.test(h)) return h;
    if (h.startsWith("//")) return "https:" + h;
    if (h.startsWith("/")) return "https://www.al-akhbar.com" + h;
    return "";
  };
  const push = (url: string, text: string) => {
    const u = abs(url);
    if (!u || seen.has(u)) return;
    seen.add(u);
    items.push({ source, url: u, text: text.slice(0, 800), at: jerusalemIso(), lean: "", fromTg: false });
  };
  for (const m of html.matchAll(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = decodeEntities(m[2] || "");
    if (title.length < 18) continue;
    if (!/اليمن|الحوث|السعود|صنعاء|Yemen|Houthi/i.test(title)) continue;
    push(m[1], title);
  }
  return items.slice(0, 12);
}

/* ------------------------------------------------------------------ *
 * One scan cycle
 * ------------------------------------------------------------------ */

/**
 * The last day of desk rows, as reports: a new outlet on a story whose card
 * has left the payload still folds into that card instead of becoming another.
 */
async function storedCards(): Promise<LiveReport[]> {
  try {
    const store = await getStore();
    const since = Date.now() - STORY_WINDOW_MS;
    return (await store.recentDesk(150)).reports
      .filter((r) => Date.parse(String(r.at)) >= since)
      .map((r) => ({ ...(r as unknown as LiveReport), text: String((r as { text?: string }).text ?? ""), live: true as const }));
  } catch {
    return [];
  }
}

async function loadLeadCache(): Promise<LeadCache> {
  try {
    const store = await getStore();
    return (await store.getJson<LeadCache>(LEAD_CACHE_KEY)) ?? {};
  } catch {
    return {};
  }
}

/** Keep the newest entries only, so the cache cannot grow without bound. */
async function saveLeadCache(cache: LeadCache): Promise<void> {
  const kept = Object.entries(cache)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, LEAD_CACHE_MAX);
  try {
    const store = await getStore();
    await store.putJson(LEAD_CACHE_KEY, Object.fromEntries(kept));
  } catch {
    /* a lost cache only costs refetches */
  }
}

async function scanOnce(state: ScanState, prev: ScanPayload | null): Promise<ScanPayload> {
  const now = Date.now();
  const cycleSeenAt = jerusalemIso(new Date(now));
  const dueTg = TG.filter((ch) => cadenceDue(state, `tg:${ch.id}`, ch.cadence, now));
  // A feed an outlet hint named (a channel citing the WSJ) is read now, not at its hour.
  const hinted = (id: string) => (state.lastScanAt[`hint:web:${id}`] ?? 0) > (state.lastScanAt[`web:${id}`] ?? 0);
  const dueRss = [
    ...RSS.filter((feed) => hinted(feed.id) || cadenceDue(state, `web:${feed.id}`, feed.cadence, now)),
    ...speakerSearches(prev?.reports ?? [], state, now),
  ];
  let sourcesOk = 0;
  const hits: RawHit[] = [];
  const status: SourceStatus[] = [];
  const jobs: Promise<void>[] = [];

  for (const ch of dueTg) {
    jobs.push(
      (async () => {
        const html = await fetchText(`https://t.me/s/${ch.id}`);
        const ok = !!(html && html.includes("tgme_widget_message"));
        const rows = ok ? parseTelegram(html as string, ch) : [];
        // A busy channel can post more between two scans than its first page
        // holds. Page back until we reach the last post already read, so a
        // burst never leaves a gap. First sight of a channel: no backfill.
        const seen = state.lastTgPost?.[ch.id] ?? 0;
        for (let page = 0; ok && seen && page < TG_BACKFILL_PAGES; page += 1) {
          const oldest = Math.min(...rows.map((r) => tgPostNo(r.url)).filter(Boolean));
          if (!Number.isFinite(oldest) || oldest <= seen + 1) break;
          const older = await fetchText(`https://t.me/s/${ch.id}?before=${oldest}`);
          const more = older ? parseTelegram(older, ch).filter((r) => tgPostNo(r.url) < oldest) : [];
          if (!more.length) break;
          rows.push(...more);
        }
        // Bumped to run once more after the geocoder landed, to pin what the
        // first pass published without a place.
        const replayKey = `replay5:${ch.id}`;
        if (ok && REPLAY.channels.has(ch.id) && now < REPLAY.until && !state.lastScanAt[replayKey]) {
          for (let page = 0; page < REPLAY.pages; page += 1) {
            const oldest = Math.min(...rows.map((r) => tgPostNo(r.url)).filter(Boolean));
            const oldestAt = Math.min(...rows.map((r) => Date.parse(r.at)).filter(Number.isFinite));
            if (!Number.isFinite(oldest) || oldestAt < REPLAY.since) break;
            const older = await fetchText(`https://t.me/s/${ch.id}?before=${oldest}`);
            const more = older ? parseTelegram(older, ch).filter((r) => tgPostNo(r.url) < oldest) : [];
            if (!more.length) break;
            rows.push(...more);
          }
          state.lastScanAt[replayKey] = now;
        }
        const newest = Math.max(seen, ...rows.map((r) => tgPostNo(r.url)));
        if (newest > 0) (state.lastTgPost ??= {})[ch.id] = newest;
        if (ok) sourcesOk += 1;
        hits.push(...rows);
        state.lastScanAt[`tg:${ch.id}`] = Date.now();
        status.push({ id: ch.id, name: ch.name, kind: "tg", ok, cadence: cadenceLabel(ch.cadence), hits: rows.length });
      })(),
    );
  }
  for (const feed of dueRss) {
    jobs.push(
      (async () => {
        const body = await fetchText(feed.url, feed.mode === "homepage-pdf" ? 10000 : 8000);
        let rows: RawHit[] = [];
        let ok = false;
        if (feed.mode === "homepage-pdf") {
          ok = !!body;
          if (body) rows = harvestHomepage(body, feed.name);
        } else {
          ok = !!(body && /<item[\s>]/i.test(body));
          if (ok && body) rows = parseRss(body, feed.name);
        }
        if (ok) sourcesOk += 1;
        hits.push(...rows);
        state.lastScanAt[`web:${feed.id}`] = Date.now();
        status.push({ id: feed.id, name: feed.name, kind: "web", ok, cadence: cadenceLabel(feed.cadence), hits: rows.length });
      })(),
    );
  }
  await Promise.allSettled(jobs);
  state.scannedOnce = true;

  // A feed that lists last week's articles is not reporting last week's news.
  const fresh = hits.filter((h) => {
    const t = Date.parse(h.at);
    return !Number.isFinite(t) || now - t <= MAX_ITEM_AGE_MS;
  });
  hits.length = 0;
  hits.push(...fresh);

  // Thin RSS teasers get their lead paragraph pulled so the gate has something
  // to judge. The same items reappear cycle after cycle, so leads are cached by
  // URL and each article page is fetched once.
  const leadCache = await loadLeadCache();
  const addLead = (h: RawHit, lead: string) => {
    if (lead.length > 80) h.text = `${h.text}\n${lead}`.slice(0, 2800);
  };
  const toFetch: RawHit[] = [];
  for (const h of hits) {
    // A Google News item is resolved to its article even with a long teaser:
    // Google's redirect sends readers to a robot check.
    if (h.fromTg || (h.text.length >= 500 && !isGnews(h.url)) ||/\.pdf(\?|$)/i.test(h.url)) continue;
    const cached = leadCache[h.url];
    // A Google News entry cached before links were resolved holds Google's
    // own page, not the article: it is fetched again.
    if (cached && !(isGnews(h.url) && !cached.real)) {
      addLead(h, cached.lead);
      // The card links the publisher's article, not Google's redirect.
      if (cached.real) h.url = cleanUrl(cached.real);
    } else toFetch.push(h);
  }
  // Google News items first need their article's address: a few per cycle,
  // since each costs two requests to Google.
  let resolves = 0;
  const fetchable = toFetch.filter((h) => !isGnews(h.url) || resolves++ < GNEWS_RESOLVES).slice(0, BODY_FETCHES);
  await Promise.allSettled(
    fetchable.map(async (h) => {
      const key = h.url;
      const real = isGnews(key) ? await resolveGoogleNews(key) : "";
      if (isGnews(key) && !real) {
        leadCache[key] = { lead: "", at: now, tries: (leadCache[key]?.tries ?? 0) + 1 };
        return; // retried next cycle
      }
      const html = await fetchText(real || key, 6000);
      if (!html && !real) return; // not cached: a failed fetch is retried next cycle
      // A paywalled article still yields its address; its lead may be empty.
      const lead = html ? extractLead(html) : "";
      leadCache[key] = { lead, at: now, ...(real ? { real } : {}) };
      addLead(h, lead);
      if (real) h.url = cleanUrl(real);
    }),
  );
  await saveLeadCache(leadCache);
  // An item still on Google's redirect waits a few cycles for its address,
  // then goes out as it is rather than be missed.
  const resolved = hits.filter((h) => !isGnews(h.url) || (leadCache[h.url]?.tries ?? 0) >= GNEWS_HOLD_TRIES);
  hits.length = 0;
  hits.push(...resolved);

  /**
   * Two stages. The keyword gate (via `toLiveReport`) is only a cheap
   * pre-filter: what it excludes never costs a model call. Everything else is
   * decided by the reader (`editCandidates`), and only its verdict publishes —
   * the keyword composer turned programme clips, other countries' wars and
   * launch bases into reports. `DESK_READER_REQUIRED=0` restores the old
   * composer as a fallback, for local work without a key.
   */
  // Leaders' words come from their own outlet; relays pass only when it was down.
  const officialDown = !status.some((s) => s.id === "almasirah2" && s.ok);
  // A post stamped in the future (a wrong clock or a misread date) is dated to
  // this scan instead of floating above the whole feed.
  for (const h of hits) if (Date.parse(h.at) > now + 10 * 60_000) h.at = cycleSeenAt;
  const pre = new Map<string, Composed>();
  const candidates: Candidate[] = [];
  for (const h of hits) {
    const c = toLiveReport(h.source, h.url, h.text, h.at, h.text.slice(0, 80), h.lean, officialDown);
    pre.set(h.url, c);
    if (c.outcome === "exclude") continue;
    candidates.push({
      source: h.source,
      url: h.url,
      text: h.text,
      at: h.at,
      lean: h.lean,
      fp: fpOf(h.url, h.text.slice(0, 80)),
      score: c.report?.score ?? c.topicality,
      tags: c.tags,
    });
  }
  const { verdicts, modelNote } = await editCandidates(await getStore(), candidates, now);
  const floor = process.env.DESK_READER_REQUIRED === "0";

  const reports: LiveReport[] = [];
  const rawHits: RawScanHit[] = [];
  for (const h of hits) {
    const c = pre.get(h.url) as Composed;
    const v = verdicts.get(h.url);
    let outcome: Outcome = c.outcome;
    let reason = c.reason;
    let note = c.note;
    let kept = false;
    if (v?.kind === "publish") {
      reports.push(v.report);
      [outcome, reason, note, kept] = ["feed", "kept", "", true];
    } else if (v?.kind === "reject") {
      [outcome, reason, note] = ["exclude", v.reason, v.note];
    } else if (v?.kind === "pending") {
      [outcome, reason, note] = ["tray", "pending", v.note];
      if (floor && c.report && c.outcome === "feed") {
        reports.push(c.report);
        kept = true;
      }
    }
    rawHits.push({
      source: h.source,
      url: h.url,
      snippet: h.text.replace(/\s+/g, " ").trim().slice(0, 280),
      at: h.at,
      seenAt: cycleSeenAt,
      kind: h.fromTg ? "tg" : "web",
      kept,
      outcome,
      topicality: c.topicality,
      reachable: true,
      reason,
      note,
      tags: c.tags,
    });
  }
  // Items read from the queue — seen in an earlier cycle, read only now.
  for (const [url, v] of verdicts) if (v.kind === "publish" && !pre.has(url)) reports.push(v.report);

  // A relayed report is traced to its original, which then replaces it as the
  // source; `late` are stored reports whose original turned up only now.
  let late: LiveReport[] = [];
  const reread: ReRead[] = [];
  try {
    late = await traceOrigins(await getStore(), reports, new Map(hits.map((h) => [h.url, h.text])), now, reread);
    // Originals read in full go to the reader next cycle; the card is then
    // rewritten from the original's text under the same fp.
    await queueForReading(await getStore(), reread, now);
  } catch {
    // Untraced reports keep their relay as source; nothing else changes.
  }
  hintOutlets(state, hits, now);
  // A card written from its original replaces the relay's version of it.
  const fromOriginal = new Set(reports.filter((r) => r.tags?.includes("original")).map((r) => r.fp));
  for (let i = reports.length - 1; i >= 0; i -= 1) {
    if (fromOriginal.has(reports[i].fp) && !reports[i].tags?.includes("original")) reports.splice(i, 1);
  }

  /**
   * One CARD per story, but every account kept.
   *
   * The desk used to keep the best-sourced report of a story and delete the
   * rest, which is the opposite of collecting everything in one place. Now the
   * best-sourced account leads the card and the others are attached to it, so
   * a card can say "3 sources" and open them — nothing is discarded for being
   * a second account of the same event.
   */
  const seenUrl = new Set<string>();
  const byStory = new Map<string, { lead: LiveReport; others: LiveReport[] }>();
  reports
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || scoreReport(b) - scoreReport(a))
    .forEach((r) => {
      const u = r.url.split("?")[0];
      if (seenUrl.has(u) || seenUrl.has(r.fp)) return;
      seenUrl.add(u);
      seenUrl.add(r.fp);
      // Field events group only as copies of one post: outlets relaying the
      // same event within minutes. A later development on the same front is
      // its own card (the reader may mark it a reply), never folded in.
      // Statements likewise: one speaker's separate lines are separate cards;
      // only two outlets' copies of the same line fold together.
      let sk = storyKey(r);
      const copyRule = FIELD_TYPES.has(r.type) && !sk.includes("|alert|");
      if (copyRule || sk.includes("|stmt|")) {
        const t = Date.parse(r.at);
        const fits = (g: { lead: LiveReport }) =>
          (!copyRule || Math.abs(Date.parse(g.lead.at) - t) <= COPY_WINDOW_MS) && sameWords(g.lead.summary, r.summary);
        let n = 0;
        while (byStory.has(`${sk}#${n}`) && !fits(byStory.get(`${sk}#${n}`)!)) n += 1;
        sk = `${sk}#${n}`;
      }
      const group = byStory.get(sk);
      if (!group) {
        byStory.set(sk, { lead: r, others: [] });
      } else if (scoreReport(r) > scoreReport(group.lead)) {
        group.others.push(group.lead);
        group.lead = r;
      } else {
        group.others.push(r);
      }
    });

  for (const { lead, others } of byStory.values()) {
    if (!others.length) continue;
    // Distinct outlets only: three posts from one channel is one account.
    const outlets = new Map<string, string>();
    for (const o of others) if (o.source !== lead.source && o.citing !== lead.source) outlets.set(o.source, o.url);
    if (isOriginal(lead)) outlets.clear();
    if (outlets.size) {
      lead.alsoReportedBy = [...outlets].map(([source, url]) => ({ source, url })).slice(0, 6);
    }
    // Corroboration moves the trust figure — counted by side inside
    // `credibility`, so five channels of one side count once.
    if (lead.side) {
      const sides = others.filter((o) => o.source !== lead.source).map((o) => o.side ?? "neutral");
      lead.confidence = confidenceOf(lead, sides);
    }
  }
  const uniqReports = [...byStory.values()].map((g) => g.lead).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // Carry forward what earlier cycles found, so a quiet cycle does not empty the desk.
  if (prev && Array.isArray(prev.reports)) {
    const have = new Set(uniqReports.map((r) => r.url.split("?")[0]));
    // By fp too: a report traced to its original has a new url, and its stale
    // relay copy must not ride along beside it.
    const haveFp = new Set(uniqReports.map((r) => r.fp));
    for (const r of prev.reports) {
      // Only reports the reader wrote are carried forward; the keyword
      // composer's output is not re-published.
      if (!r.side && !floor) continue;
      const u = String(r.url || "").split("?")[0];
      if (!u || have.has(u) || haveFp.has(r.fp)) continue;
      uniqReports.push(r);
      have.add(u);
      haveFp.add(r.fp);
    }
    uniqReports.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  // Originals found late replace the relay copy the payload carries; saving
  // them lets the store move the stored row to the original too.
  for (const r of late) {
    const i = uniqReports.findIndex((x) => x.fp === r.fp);
    if (i >= 0) uniqReports[i] = r;
    else uniqReports.push(r);
  }
  const published = new Set((prev?.reports ?? []).map((r) => r.fp));
  const stored = await storedCards();
  // A Telegram reply to a card on the desk is the same thread: it follows that card.
  const byUrl = new Map([...stored, ...uniqReports].map((r) => [r.url, r]));
  for (const h of hits) {
    const r = h.replyUrl ? uniqReports.find((x) => x.url === h.url) : undefined;
    const to = h.replyUrl ? byUrl.get(h.replyUrl) : undefined;
    if (r && to && to.fp !== r.fp && !r.replyTo && Date.parse(to.at) <= Date.parse(r.at)) r.replyTo = to.fp;
  }
  linkFollowUps(uniqReports.filter((r) => !published.has(r.fp)), [...stored, ...uniqReports]);
  const touched = [...foldIntoPublished(uniqReports, published, stored), ...threadSpeeches(uniqReports, published, stored)];
  if (prev && Array.isArray(prev.rawHits)) {
    const haveH = new Set(rawHits.map((h) => h.url.split("?")[0]));
    for (const h of prev.rawHits) {
      const u = String(h.url || "").split("?")[0];
      if (u && !haveH.has(u)) {
        rawHits.push({ ...h, seenAt: h.seenAt || h.at });
        haveH.add(u);
      }
    }
  }
  if (prev && Array.isArray(prev.sourceStatus)) {
    const haveS = new Set(status.map((s) => s.id));
    for (const s of prev.sourceStatus) {
      if (s?.id && !haveS.has(s.id)) status.push(s);
    }
  }

  const tried = dueTg.length + dueRss.length;
  const skipped = TG.length + RSS.length - tried;
  const cycleNote = skipped
    ? `${tried} sources this cycle; ${skipped} on a slower schedule (dailies and agencies).`
    : `All ${tried} sources scanned this cycle.`;
  // Say plainly when the reader could not run: a quiet feed must not look
  // like a quiet war.
  const readerNote = modelNote ? ` Reader: ${modelNote}.` : "";

  return {
    ok: true,
    scannedAt: jerusalemIso(),
    reports: uniqReports.slice(0, PAYLOAD_REPORTS),
    ...(touched.length ? { touched } : {}),
    sourcesTried: tried,
    sourcesOk,
    // Newest-seen first: what the scanner just pulled sits at the top of the box.
    rawHits: rawHits
      .sort((a, b) => Date.parse(b.seenAt || b.at) - Date.parse(a.seenAt || a.at) || Date.parse(b.at) - Date.parse(a.at))
      .slice(0, PAYLOAD_RAW_HITS),
    sourceStatus: status.sort((a, b) => a.name.localeCompare(b.name)),
    cycleNote: cycleNote + readerNote,
    reasons: NOISE_REASONS,
  };
}

/* ------------------------------------------------------------------ *
 * Reading, and running a cycle
 *
 * These are deliberately separate. Serving a page READS; only the tick
 * SCANS. Previously a page view could trigger a scan, which meant the desk
 * only advanced while someone was watching it — and on a read-only host the
 * results were thrown away afterwards.
 * ------------------------------------------------------------------ */

const EMPTY_PAYLOAD: ScanPayload = {
  ok: true,
  scannedAt: "",
  reports: [],
  sourcesTried: 0,
  sourcesOk: 0,
  rawHits: [],
  sourceStatus: [],
  cycleNote: "The desk has not completed a scan yet.",
  reasons: NOISE_REASONS,
};

/**
 * What the desk currently holds. Pure read — never fetches a source.
 * Returns an empty payload (not an error) before the first tick, so the page
 * renders its curated snapshot rather than an error state.
 */
export async function scanYemenSources(): Promise<ScanPayload> {
  try {
    const store = await getStore();
    return (await store.loadPayload()) ?? EMPTY_PAYLOAD;
  } catch {
    return EMPTY_PAYLOAD;
  }
}

export type TickResult = {
  ok: boolean;
  scannedAt: string;
  sourcesTried: number;
  sourcesOk: number;
  reportsInPayload: number;
  reportsAdded: number;
  eventsAdded: number;
  unplaced: { fp: string; summary: string; place?: string }[];
  store: string;
  cycleNote?: string;
  /** True when this tick closed a 12-hour window and composed its brief. */
  briefBuilt?: boolean;
  error?: string;
};

/**
 * One scan cycle: fetch every due source, compose, persist, report honestly.
 *
 * This is the only thing that scans. It is idempotent with respect to cadence
 * — calling it more often than the schedule simply finds fewer sources due —
 * so an over-eager clock costs nothing.
 */
export async function runScanCycle(): Promise<TickResult> {
  const store = await getStore();
  const state = await store.loadScanState();
  const prev = await store.loadPayload();

  const payload = await scanOnce(state, prev);

  // Persist in dependency order, and surface every failure. The old code
  // fire-and-forgot this and swallowed the error, which is why a read-only
  // host looked healthy while saving nothing.
  const merge = await store.mergeIntoDesk([...payload.reports, ...(payload.touched ?? [])]);
  delete payload.touched;
  // Carry the gazetteer misses into the payload so the scan box can show them.
  if (merge.unplaced.length) payload.unplaced = merge.unplaced.slice(0, 20);
  state.lastTickAt = Date.now();
  await store.saveScanState(state);

  let error = merge.error;
  try {
    await store.savePayload(payload);
  } catch (err) {
    error = err instanceof Error ? err.message : "payload write failed";
  }

  // The brief moves on the clock, not on page views: a no-op until a 12-hour
  // window closes, then composed from everything the desk logged in it.
  let briefBuilt = false;
  try {
    briefBuilt = (await refreshBrief(store)).built;
  } catch (err) {
    error ??= `brief: ${err instanceof Error ? err.message : "failed"}`;
  }

  // The first tick of each day snapshots the live tables; a failed backup
  // must not fail the scan, so it is logged, not surfaced.
  if (store.kind === "pg") {
    try {
      await backupDaily();
    } catch (err) {
      console.error("[desk] daily backup failed:", err instanceof Error ? err.message : err);
    }
  }

  return {
    ok: !error,
    scannedAt: payload.scannedAt,
    sourcesTried: payload.sourcesTried,
    sourcesOk: payload.sourcesOk,
    reportsInPayload: payload.reports.length,
    reportsAdded: merge.reportsAdded,
    eventsAdded: merge.eventsAdded,
    unplaced: merge.unplaced,
    store: store.kind,
    cycleNote: payload.cycleNote,
    briefBuilt,
    ...(error ? { error } : {}),
  };
}

export const SCAN_SOURCE_COUNT = TG.length + RSS.length;
export { digest };

/** A catalogue outlet's declared lean, by its published name ("" if unknown). */
export function sourceLean(name: string): string {
  return TG.find((c) => c.name === name)?.lean ?? "";
}
