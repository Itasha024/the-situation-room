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

import { createHash } from "node:crypto";
import { type Place } from "./desk/gazetteer.ts";
import { digest } from "./desk/digest.ts";
import { NOISE_REASONS, type Outcome } from "./desk/relevance.ts";
import { refreshBrief } from "./desk/brief-store.ts";
import { backupDaily } from "./desk/backup.ts";
import { type Candidate, confidenceOf, editCandidates, onRadar, queueForReading } from "./desk/editor.ts";
import { dbMeter, getStore, migrateBlob, resetDbMeter } from "./desk/store.ts";
import { cleanUrl, isGnews, resolveGoogleNews } from "./desk/gnews.ts";
import { type ReRead, findCitation, keywords, readOriginal, stripAttribution, traceOrigins } from "./desk/origin.ts";
import { alertCities, citiesOverlap, countedOrNamed, numbersClash, sameCount, sameGround, sameHeadline, sameStory, sameWords } from "./desk/copies.ts";
import { type OutletSide, homeOutlet, outletSide } from "./desk/credibility.ts";
import type { LiveReport, Media, RawScanHit, ScanPayload, ScanState, SourceStatus } from "./desk/types.ts";
import { pgSafe } from "./desk/store.pg.ts";
import { type Listed, fetchListing, parseHtmlListing, parseListing, titleKey, urlKey } from "./desk/sitemap.ts";
import { type Learned, loadLearned } from "./desk/originals.ts";
import { OWN_ONLY, isExclusive, ownInformation } from "./desk/exclusive.ts";
import { attachMedia, tgMedia, xMedia } from "./desk/media.ts";
import { triage } from "./desk/triage.ts";
import { askChain } from "./desk/models.ts";
import { combineGroups, members, pickLead, planWaves } from "./desk/combine.ts";
import { checkLinks, judgeLinks, linkOk, namedSpeaker, speakerKey, speakersOf } from "./desk/links.ts";
import { TRIAGE_MODELS } from "./desk/triage.ts";

export { checkLinks, namedSpeaker, speakerKey };

// The wire types moved to ./desk/types.ts so the store and the scanner can
// share them without importing each other. Re-exported so existing imports
// (brief.ts, the API routes) keep working unchanged.
export type { LiveReport, RawScanHit, ScanPayload, SourceStatus } from "./desk/types.ts";

type Channel = { id: string; name: string; lean: "houthi" | "gov" | "south" | "intl" };
type Cadence = { everyMin: number } | { everyHours: number } | { atHours: number[] } | { atHour: number };
type ChannelScan = Channel & { cadence: Cadence };
/** `whole`: the site's own listing of everything, triaged by a model. */
/** `html`: no feed; the site's section page is read and every link matching this pattern is an article. */
type RssFeed = { url: string; name: string; id: string; cadence: Cadence; whole?: boolean; ua?: string; site?: string; lang?: "ar"; html?: RegExp };

const C5: Cadence = { everyMin: 5 };
const C15: Cadence = { everyMin: 15 };
/**
 * Websites are read every half hour.
 *
 * They used to be read every 90 minutes or every three hours, and two of them
 * only at fixed times of day, on the reasoning that a newspaper is not a
 * breaking channel. That was wrong about what these sites are: aawsat.com,
 * al-akhbar.com, reuters.com and the rest post through the day, and the pieces
 * worth having — the interview, the exclusive, the despatch with a byline —
 * are exactly the ones that do not arrive on anyone's Telegram. A three-hour
 * gap meant the desk met them cold, hours late, or not at all once they had
 * slipped off the feed's first page.
 *
 * The fetch itself is one request per site, so the cost of this is small; what
 * it buys is the desk seeing an article while it is still news.
 */
const C30: Cadence = { everyMin: 30 };
/** The weeklies and the quieter sections: hourly is still six times a day. */
const C1H: Cadence = { everyHours: 1 };

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
  { id: "AlarabyTvBrk", name: "Al-Araby TV", lean: "intl", cadence: C5 },
  { id: "shajab_news", name: "Shajab News", lean: "houthi", cadence: C5 },
  { id: "bin_1saeed", name: "Bin Saeed", lean: "gov", cadence: C5 },
  { id: "AjaNews", name: "Al Jazeera", lean: "intl", cadence: C5 },
  { id: "alhadath_brk", name: "Al Hadath", lean: "gov", cadence: C5 },
  { id: "alarabiyaBr", name: "Al Arabiya", lean: "gov", cadence: C5 },
  { id: "SabaNewsyeMedia", name: "Saba", lean: "houthi", cadence: C5 },
  { id: "army21ye", name: "Yahya Saree", lean: "houthi", cadence: C5 },
  { id: "abdulsalamsalah", name: "Mohammed Abdulsalam", lean: "houthi", cadence: C5 },
  { id: "almasirah2", name: "Al-Masirah", lean: "houthi", cadence: C5 },
  { id: "alagsa3agel", name: "Al-Aqsa TV", lean: "houthi", cadence: C5 },
  // Their sites refuse automated readers (403); their channels post each
  // story's headline and first line, minutes after publication.
  { id: "Alakhbar_News", name: "Al-Akhbar", lean: "houthi", cadence: C15 },
  { id: "eremnews", name: "Erem News", lean: "gov", cadence: C15 },
];

/**
 * X accounts, read through FxTwitter's public API (api.fxtwitter.com, the
 * open-source embed service): an account's latest 20 posts as JSON, no login,
 * no key. x.com itself serves nothing without one, the Nitter mirrors are
 * down or behind bot checks, and Twitter's syndication endpoint answers 429 —
 * all tried on 24 September. Public posts only, read at a polite interval.
 */
type XAccount = { handle: string; name: string; lean: Channel["lean"]; cadence: Cadence; only?: RegExp };
const C10: Cadence = { everyMin: 10 };
const X = (handle: string, name: string, lean: Channel["lean"], cadence: Cadence, only?: RegExp): XAccount => ({ handle, name, lean, cadence, ...(only ? { only } : {}) });
/**
 * Sky News Arabia's breaking account posts about 150 times a day, most of it
 * other agencies' news. Only what its own sources told it goes on: "مصادر
 * لسكاي نيوز عربية", "لـ«سكاي نيوز عربية»", "خاص", "told Sky News Arabia".
 */
export const SKY_OWN = /لـ?\s*[«"“]?\s*سكاي\s*نيوز\s*عربية|علمت\s*[«"“]?\s*سكاي|(?:^|[\s|:«"(])(?:خاص|حصري|حصريا|حصرياً)(?=[\s|:»")]|$)|(?:told|to|tells)\s+Sky\s+News\s+Arabia|Sky\s+News\s+Arabia\s+(?:has\s+)?learned|exclusive/i;
/**
 * Read by tier, to spare the processor and FxTwitter's goodwill: the accounts
 * that break news every 10 minutes, the officials and the slower channels
 * every half hour. Only posts newer than the last one read go on.
 */
const X_ACCOUNTS: XAccount[] = [
  X("war_cube", "The Cube", "intl", C5),
  // Every 10 minutes: the military spokesmen, the ministries, the reporters on the fronts.
  X("Yah_Saree", "Yahya Saree", "houthi", C10),
  X("abdusalamsalah", "Mohammed Abdulsalam", "houthi", C10),
  X("spokespersonyem", "Yemeni Army spokesman", "gov", C10),
  X("Yem_army_media", "Yemeni Army Media", "gov", C10),
  X("YemenMOD", "Yemen Defence Ministry", "gov", C10),
  X("CJFCSpox", "Coalition spokesman", "gov", C10),
  X("modgovksa", "Saudi Defence Ministry", "gov", C10),
  X("KSAMOFA", "Saudi Foreign Ministry", "gov", C10),
  X("maldhabyani", "Mohammed al-Dhabyani", "gov", C10),
  X("taha_saleh_taiz", "Taha Saleh", "gov", C10),
  X("BashaReport", "Basha Report", "gov", C10),
  X("SaudiNews50", "Saudi News", "gov", C10),
  X("2decnews", "2 December News", "gov", C10),
  X("South24_net", "South24", "gov", C10),
  X("yementvyem", "Yemen TV", "gov", C10),
  X("SkyNewsArabia_B", "Sky News Arabia", "intl", C10, SKY_OWN),
  // Every 30 minutes: the leaders, the ministries' other voices, the parties.
  X("PresidentRashad", "Rashad al-Alimi", "gov", C30),
  X("ERYANIM", "Muammar al-Eryani", "gov", C30),
  X("AbuZar3a", "Abu Zaraa al-Mahrami", "gov", C30),
  X("ALalimiBawzer", "Abdullah al-Alimi", "gov", C30),
  X("Shaya_Zindani", "Shaya al-Zindani", "gov", C30),
  X("afrah_alzouba", "Afrah al-Zouba", "gov", C30),
  X("tarikyemen", "Tareq Saleh", "gov", C30),
  X("yemen_mofa", "Yemen Foreign Ministry", "gov", C30),
  X("nrfyemen", "National Resistance", "gov", C30),
  X("P_B_N_R", "National Resistance Political Bureau", "gov", C30),
  X("diralwatan", "Nation's Shield", "gov", C30),
  X("STCSouthArabia", "Southern Transitional Council", "gov", C30),
  X("AidrosAlzubidi", "Aidarous al-Zubaidi", "gov", C30),
  X("Alsakaniali", "Ali al-Sakani", "gov", C30),
  X("South24E", "South24 English", "gov", C30),
  X("GCCSG", "GCC Secretariat", "gov", C30),
  X("FaresALhemyari", "Fares al-Hemyari", "gov", C30),
  X("alrougui", "Malik al-Rougui", "gov", C30),
  X("yemenmofa2025", "Sanaa Foreign Ministry", "houthi", C30),
  X("hezamalasad", "Hezam al-Asad", "houthi", C30),
  X("hussinalezzi5", "Hussein al-Ezzi", "houthi", C30),
  X("Moh_Alhouthi", "Mohammed Ali al-Houthi", "houthi", C30),
];

/** Newer than the last post read: X ids grow with time. A pinned post is old and falls out here. */
export function newerX(id: string, seen: string | undefined): boolean {
  if (!/^\d+$/.test(id)) return false;
  if (!seen) return true;
  return id.length !== seen.length ? id.length > seen.length : id > seen;
}

type FxStatus = {
  url?: string;
  id?: string;
  text?: string;
  raw_text?: { text?: string };
  created_timestamp?: number;
  replying_to?: { screen_name?: string } | null;
  reposted_by?: unknown;
  author?: { screen_name?: string };
  media?: Parameters<typeof xMedia>[0];
};

/** One account's own posts as raw items: reposts and replies to others left out. */
export function parseFxStatuses(json: unknown, acct: XAccount): RawHit[] {
  const list = (json as { results?: FxStatus[] })?.results;
  if (!Array.isArray(list)) return [];
  const own = acct.handle.toLowerCase();
  const out: RawHit[] = [];
  for (const s of list) {
    if (s.reposted_by || String(s.author?.screen_name ?? own).toLowerCase() !== own) continue;
    // A reply to someone else is a conversation; a reply to itself is a thread.
    const to = s.replying_to?.screen_name?.toLowerCase();
    if (to && to !== own) continue;
    const text = decodeEntities(String(s.raw_text?.text ?? s.text ?? "")).trim();
    const url = s.url || (s.id ? `https://x.com/${acct.handle}/status/${s.id}` : "");
    if (!url || text.length < 12) continue;
    if (acct.only && !acct.only.test(text)) continue;
    const media = xMedia(s.media, url);
    const ms = Number(s.created_timestamp) * 1000;
    out.push({
      source: acct.name,
      url,
      text,
      at: jerusalemIso(Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date()),
      lean: acct.lean,
      // A post, whole as it stands: no article to fetch behind it.
      fromTg: true,
      ...(media ? { media } : {}),
    });
  }
  return out;
}

function gnews(q: string, hl = "en-US", gl = "US", ceid = "US:en") {
  const enc = encodeURIComponent(q);
  return `https://news.google.com/rss/search?q=${enc}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

const YE_AR = "(اليمن OR الحوث OR الحوثي OR صنعاء OR السعودية OR باب المندب)";
const YE_EN = "(Yemen OR Houthi OR Houthis OR \"Red Sea\" OR \"Bab el-Mandeb\" OR Saudi)";

/**
 * Every website is read WHOLE: the listing a site keeps of all it published —
 * its RSS feed, or the news sitemap it gives search engines — and a model picks
 * from the headlines (triage.ts) which articles to open. A keyword search
 * (`site:X (Yemen OR Houthi …)`) used to stand in for the site, and never saw
 * an article whose headline lacked those words.
 *
 * The sites that refuse any automated reader (Cloudflare: Asharq Al-Awsat,
 * Erem, Al-Akhbar) and the ones with no working listing (the WSJ's Dow Jones
 * feeds stopped in January 2025; SPA) are listed through Google News with
 * `site:` alone and no keywords — every article Google has of theirs in the
 * window, not the ones that happen to say "Yemen". Nothing is bypassed.
 *
 * `site` is the domain an outlet hint (a channel citing it) reads early.
 */
const RSS: RssFeed[] = [
  { id: "almashhad", lang: "ar", url: "https://www.almashhad.news/feed", name: "Almashhad", cadence: C5, whole: true, site: "almashhad.news" },
  // A browser's user agent is refused (403); a plain client is served.
  { id: "alaraby", lang: "ar", url: "https://www.alaraby.co.uk/rss.xml", ua: "curl/8.5.0", name: "Al-Araby Al-Jadeed", cadence: C30, whole: true, site: "alaraby.co.uk" },
  // The TV channel's own site (alaraby.com), not the paper's: its interviews
  // with officials are posted there and not on the breaking channel.
  { id: "alaraby-tv", lang: "ar", url: "https://www.alaraby.com/rss.xml", name: "Al-Araby TV", cadence: C30, whole: true, site: "alaraby.com" },
  { id: "aawsat", lang: "ar", url: gnews("site:aawsat.com when:1h", "ar", "SA", "SA:ar"), name: "Asharq Al-Awsat", cadence: C30, whole: true, site: "aawsat.com" },
  // Hourly, a day wide: the paper's site is behind Cloudflare, and its channel
  // (every 15 minutes) carries each story's headline as it is published.
  { id: "akhbar", lang: "ar", url: gnews("site:al-akhbar.com when:1d", "ar", "LB", "LB:ar"), name: "Al-Akhbar", cadence: C1H, whole: true, site: "al-akhbar.com" },
  { id: "erem", lang: "ar", url: gnews("site:eremnews.com when:2h", "ar", "AE", "AE:ar"), name: "Erem News", cadence: C30, whole: true, site: "eremnews.com" },
  { id: "alhurra", lang: "ar", url: "https://www.alhurra.com/rss", name: "Alhurra", cadence: C30, whole: true, site: "alhurra.com" },
  { id: "arabnews", url: "https://www.arabnews.com/rss.xml", name: "Arab News", cadence: C30, whole: true, site: "arabnews.com" },
  { id: "reuters", url: "https://www.reuters.com/arc/outboundfeeds/news-sitemap/?outputType=xml", name: "Reuters", cadence: C30, whole: true, site: "reuters.com" },
  { id: "wsj", url: gnews("site:wsj.com when:1h"), name: "WSJ", cadence: C30, whole: true, site: "wsj.com" },
  { id: "wapo", url: "https://feeds.washingtonpost.com/rss/world", name: "Washington Post", cadence: C30, whole: true, site: "washingtonpost.com" },
  { id: "wapo-nat", url: "https://feeds.washingtonpost.com/rss/national", name: "Washington Post", cadence: C30, whole: true },
  { id: "wapo-pol", url: "https://feeds.washingtonpost.com/rss/politics", name: "Washington Post", cadence: C30, whole: true },
  { id: "nyt", url: "https://www.nytimes.com/sitemaps/new/news.xml.gz", name: "NYT", cadence: C30, whole: true, site: "nytimes.com" },
  { id: "nypost", url: "https://nypost.com/feed/", name: "NY Post", cadence: C30, whole: true, site: "nypost.com" },
  { id: "axios", url: "https://api.axios.com/feed/", name: "Axios", cadence: C30, whole: true, site: "axios.com" },
  { id: "cnn", url: "https://edition.cnn.com/sitemap/news.xml", name: "CNN", cadence: C30, whole: true, site: "cnn.com" },
  { id: "abc", url: "https://abcnews.go.com/abcnews/internationalheadlines", name: "ABC", cadence: C30, whole: true, site: "abcnews.go.com" },
  { id: "cbs", url: "https://www.cbsnews.com/latest/rss/world", name: "CBS", cadence: C30, whole: true, site: "cbsnews.com" },
  { id: "fox", url: "https://moxie.foxnews.com/google-publisher/world.xml", name: "Fox News", cadence: C30, whole: true, site: "foxnews.com" },
  { id: "fox-pol", url: "https://moxie.foxnews.com/google-publisher/politics.xml", name: "Fox News", cadence: C30, whole: true },
  { id: "spa", lang: "ar", url: gnews("site:spa.gov.sa when:1h", "ar", "SA", "SA:ar"), name: "SPA", cadence: C5, whole: true, site: "spa.gov.sa" },
  // Sheba Intelligence: exclusives on the Houthis, the Red Sea and the Horn,
  // from its section pages (no feed; its sitemap re-dates old articles).
  ...["news", "reports", "investigations", "politics", "daily-news-brief"].map((sec): RssFeed => ({
    id: `sheba-${sec}`,
    url: `https://shebaintelligence.uk/${sec}`,
    name: "Sheba Intelligence",
    cadence: C1H,
    whole: true,
    site: "shebaintelligence.uk",
    html: /^https:\/\/shebaintelligence\.uk\/[a-z0-9-]{25,}$/,
  })),
  // Suhail: the government-aligned channel's site, every item it publishes.
  { id: "suhail", lang: "ar", url: "https://suhail.net/news_rss.php?lang=arabic&top=0", name: "Suhail", cadence: C30, whole: true, site: "suhail.net" },
  // Al-Akhbar's English edition carries the paper's pieces in full (the
  // Arabic site refuses every reader): its Yemen and Arabian Peninsula pages.
  ...["yemen", "peninsula"].map((sec): RssFeed => ({
    id: `akhbar-en-${sec}`,
    url: `https://en.al-akhbar.com/category/${sec}`,
    name: "Al-Akhbar",
    cadence: C1H,
    whole: true,
    site: "en.al-akhbar.com",
    html: /^https:\/\/en\.al-akhbar\.com\/news\/[a-z0-9-]{20,}/,
  })),
  // Safety nets: one keyword search across each language's sites, hourly. A
  // listing can drop an article (a sitemap's cap, an edited URL); these catch it.
  {
    id: "net-ar",
    url: gnews(`(site:aawsat.com OR site:alaraby.co.uk OR site:alaraby.com OR site:al-akhbar.com OR site:eremnews.com OR site:alhurra.com) ${YE_AR} when:1d`, "ar", "SA", "SA:ar"),
    name: "Arabic press",
    cadence: C1H,
  },
  {
    id: "us-talk",
    url: gnews(`(site:reuters.com OR site:wsj.com OR site:washingtonpost.com OR site:nytimes.com OR site:nypost.com OR site:axios.com OR site:cnn.com OR site:abcnews.go.com OR site:cbsnews.com OR site:foxnews.com OR site:arabnews.com) ${YE_EN} when:1d`),
    name: "US media",
    cadence: C1H,
  },
];

const LEARNED_NAME = "Learned outlets";

/**
 * Outlets where the origin search found an original the desk had not been
 * reading (originals.ts): each is listed hourly from then on, through Google
 * News, several sites to a query and one query per language.
 */
function learnedFeeds(learned: Learned[]): RssFeed[] {
  const eds: Record<string, [string, string, string]> = { ar: ["ar", "SA", "SA:ar"], fr: ["fr", "FR", "FR:fr"], en: ["en-US", "US", "US:en"] };
  const byEd = new Map<string, string[]>();
  for (const l of learned) {
    if (l.kind !== "site") continue;
    const ed = l.lang === "Arabic" ? "ar" : l.lang === "French" ? "fr" : "en";
    byEd.set(ed, [...(byEd.get(ed) ?? []), l.site]);
  }
  const out: RssFeed[] = [];
  for (const [ed, sites] of byEd) {
    for (let i = 0; i < sites.length; i += 8) {
      const q = `(${sites.slice(i, i + 8).map((x) => `site:${x}`).join(" OR ")}) when:2h`;
      out.push({ id: `learned-${ed}-${i / 8}`, url: gnews(q, ...eds[ed]), name: LEARNED_NAME, cadence: C1H, whole: true, ...(ed === "ar" ? { lang: "ar" as const } : {}) });
    }
  }
  return out;
}

/** Does the desk read this host (a site listing) or this X account ("x:handle") already? */
function readsHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www./, "");
  if (h.startsWith("x:")) return X_ACCOUNTS.some((a) => `x:${a.handle.toLowerCase()}` === h);
  if (h === "t.me") return true;
  return RSS.some((f) => {
    const site = f.site ?? (/news.google.com/.test(f.url) ? "" : new URL(f.url).hostname.replace(/^www./, ""));
    return !!site && (h === site || h.endsWith(`.${site}`) || site.endsWith(`.${h}`));
  });
}

/** An outlet's own recent articles, from the listing the desk reads it by; one fetch per site per tick. */
const listingMemo = new Map<string, { at: number; items: Promise<Listed[]> }>();
function siteListing(site: string): Promise<Listed[]> {
  const hit = listingMemo.get(site);
  if (hit && Date.now() - hit.at < 4 * 60_000) return hit.items;
  const feeds = RSS.filter((f) => f.whole && (f.site === site || (f.site ?? "").endsWith(`.${site}`) || (!!f.site && site.endsWith(`.${f.site}`))));
  const items = (async () => {
    const lists = await Promise.all(feeds.map(async (f) => {
      const body = await fetchListing(f.url, f.ua);
      // A site with no feed (Sheba, Al-Akhbar English) is listed from its section pages.
      return body ? (f.html ? parseHtmlListing(body, f.url, f.html) : parseListing(body)) : [];
    }));
    return lists.flat();
  })();
  listingMemo.set(site, { at: Date.now(), items });
  return items;
}

/* ------------------------------------------------------------------ *
 * Cadence bookkeeping
 * ------------------------------------------------------------------ */

function cadenceLabel(c: Cadence): string {
  if ("everyMin" in c) return `every ${c.everyMin} min`;
  if ("everyHours" in c) return `every ${c.everyHours} h`;
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
  return /israel|jpost|haaretz|ynet|walla\.co|maariv|kan\.org|\.inn\.co|israelnationalnews|timesofisrael|i24news|jfeed|\bjns\.org|allisrael|debka|\.il\//i.test(
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
    if (!res.ok) {
      // An unread body left open can trip undici when the socket closes.
      await res.body?.cancel().catch(() => {});
      return null;
    }
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * The article's own body, as the publisher ships it to anyone who asks.
 *
 * Nearly every news site carries a `<script type="application/ld+json">`
 * NewsArticle block for search engines, and for a great many of them —
 * including most Arabic outlets and the wires — its `articleBody` is the whole
 * story, sitting in the same HTML whose visible paragraphs are a teaser. That
 * is why a WSJ-style report used to come out three lines long: the desk was
 * reading the teaser and never looked at the block underneath it.
 *
 * JSON-LD is allowed to nest (`@graph`, arrays of types), so this walks the
 * parsed object rather than pattern-matching the text.
 */
function jsonLdBody(html: string): string {
  let best = "";
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue; // a malformed block is one site's bug, not a reason to stop
    }
    const walk = (v: unknown, depth = 0) => {
      if (!v || depth > 6) return;
      if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
      if (typeof v !== "object") return;
      const o = v as Record<string, unknown>;
      const body = o.articleBody ?? o.text;
      if (typeof body === "string" && body.length > best.length) best = body;
      for (const x of Object.values(o)) walk(x, depth + 1);
    };
    walk(parsed);
  }
  return best ? decodeEntities(best) : "";
}

/** The AMP copy of this article, which publishers serve unpaywalled and clean. */
export function amphtmlOf(html: string, pageUrl: string): string {
  const href =
    (html.match(/<link[^>]+rel=["']amphtml["'][^>]*href=["']([^"']+)["']/i) || [])[1] ||
    (html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']amphtml["']/i) || [])[1] ||
    "";
  if (!href) return "";
  try {
    return new URL(decodeEntities(href), pageUrl).toString();
  } catch {
    return "";
  }
}

/**
 * As much of the article as the page will give up, best source first.
 *
 * The paragraph harvest used to stop at five, which is a teaser by
 * construction: a report about a Saudi oil facility that runs eleven
 * paragraphs was reaching the desk as its first two. The cap is now on
 * characters, not paragraphs, so a long piece arrives long and a short one
 * stays short.
 */
export function extractLead(html: string): string {
  const meta = (p: string) =>
    (html.match(new RegExp(`(?:property|name)=["']${p}["'][^>]*content=["']([^"']{40,})["']`, "i")) || [])[1] ||
    (html.match(new RegExp(`content=["']([^"']{40,})["'][^>]*(?:property|name)=["']${p}["']`, "i")) || [])[1] ||
    "";
  const og = decodeEntities(meta("og:description") || meta("description") || "");
  // The body Google is shown. When the page has one it is the article itself.
  const ld = jsonLdBody(html);
  // Stylesheets and scripts come out before the paragraphs are read: stripping
  // tags alone leaves their contents behind, and a site that styles its links
  // inline puts a `<style>` block inside its first paragraph.
  const body = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // A Next.js page (en.al-akhbar.com) carries its article in the script
  // payload, the tags escaped: "<p>Egyptian sources told …".
  const payload = html.includes("\\u003cp")
    ? html.replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&").replace(/\\"/g, '"').replace(/\\n/g, " ")
    : "";
  const paras = [...`${body} ${payload}`.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1]))
    .filter((p) => p.length > 50 && !/copyright|subscribe|cookie|javascript|sign in|all rights reserved/i.test(p));
  const parts: string[] = [];
  if (og) parts.push(og);
  if (ld.length > og.length) parts.push(ld);
  for (const p of paras) {
    if (parts.join(" ").length >= ARTICLE_CHARS) break;
    if (!parts.some((x) => x.includes(p.slice(0, 50)))) parts.push(p);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, ARTICLE_CHARS);
}

/* ------------------------------------------------------------------ *
 * Volume. The feed is meant to be a stream: these bound one cycle's work,
 * they are not an editorial filter. Anything relevant that arrives inside
 * them reaches the store, which accumulates.
 * ------------------------------------------------------------------ */

/** Items read from one RSS feed per cycle. Google News lists up to 100. */
const RSS_ITEMS = 100;

/** Every source the clock reads, with its lastScanAt key: the status page's list. */
export function sourceList(): { key: string; name: string }[] {
  return [
    ...TG.map((c) => ({ key: `tg:${c.id}`, name: c.name })),
    ...X_ACCOUNTS.map((a) => ({ key: `x:${a.handle}`, name: a.name })),
    ...RSS.map((f) => ({ key: `web:${f.id}`, name: f.name })),
  ];
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
const BODY_FETCHES = 90;
/**
 * How much of one article the desk keeps. Only web articles reach this — a
 * Telegram post is already its whole text — so the reader's token bill grows
 * by the handful of articles in a cycle, not by every item in it. A wire story
 * runs 2–4k characters; below that the desk was reading a teaser and writing a
 * three-line report from it.
 */
const ARTICLE_CHARS = 5000;
/** An article's text plus the feed's own title and teaser above it. */
const ITEM_CHARS = 5600;
/** Reports kept in the cycle payload (the scan box and carry-forward). */
const PAYLOAD_REPORTS = 300;
/**
 * Raw items kept in the cycle payload for the scan box: the last three hours,
 * at most 150. Every tick re-reads the payload and every visitor downloads it.
 */
const PAYLOAD_RAW_HITS = 150;
const RAW_HITS_MS = 3 * 3600 * 1000;

/** The old whole-cache blob, moved into rows once. */
const LEAD_CACHE_KEY = "lead-cache";
const LEAD_PREFIX = "lead";
/** Well past the oldest item a listing is read for (MAX_ITEM_AGE_MS): never looked up again. */
const LEAD_KEEP_MS = 7 * 24 * 3600 * 1000;
/** url → the lead paragraph pulled from it ("" when the page had none). */
type LeadCache = Record<string, { lead: string; at: number; real?: string; tries?: number }>;
/** Google News links resolved to their article per cycle (two requests each). */
const GNEWS_RESOLVES = 30;
/** A Google News item waits this many cycles for its article's address. */
const GNEWS_HOLD_TRIES = 3;
/** Below this many characters an article page has given the desk a teaser. */
const AMP_RETRY_UNDER = 700;
/** Below this, the page is walled or empty and the story is looked for elsewhere. */
const WALLED_UNDER = 500;
/** Walled articles chased through other outlets per cycle: a search and up to three pages each. */
const WALLED_RESCUES = 4;

type RawHit = {
  source: string;
  url: string;
  text: string;
  at: string;
  lean: string;
  fromTg: boolean;
  /** The channel post this one replies to, on Telegram. */
  replyUrl?: string;
  /** The feed's own headline, kept apart from the blob so a walled article can
   *  be looked for under it elsewhere. */
  title?: string;
  /** From a whole site's listing, picked by triage. */
  picked?: boolean;
  /** The post's picture or video (X, Telegram): a candidate for the card, looked at before it is shown. */
  media?: Media;
};

/* ------------------------------------------------------------------ *
 * Whole-site listings: what the desk has already judged
 * ------------------------------------------------------------------ */

const SEEN_KEY = "site-seen";
/** A listed article older than this is not looked at (judged before, or stale). */
const SEEN_WINDOW_MS = 30 * 3600_000;
/** The first read of a site takes only its last few hours, as a channel's does. */
const FIRST_SIGHT_MS = 4 * 3600_000;
/** Judged articles remembered per site: more than any listing holds in the window. */
const SEEN_MAX = 1500;
/** feed id → article key → 1 picked by triage, 0 not ours. */
type Seen = Record<string, Record<string, 0 | 1>>;

async function loadSeen(): Promise<Seen> {
  try {
    return (await (await getStore()).getJson<Seen>(SEEN_KEY)) ?? {};
  } catch {
    return {};
  }
}

async function saveSeen(seen: Seen): Promise<void> {
  for (const id of Object.keys(seen)) {
    const keys = Object.keys(seen[id]);
    for (const k of keys.slice(0, Math.max(0, keys.length - SEEN_MAX))) delete seen[id][k];
  }
  try {
    await (await getStore()).putJson(SEEN_KEY, seen);
  } catch {
    // Unsaved, the same headlines are judged again next tick: a cost, not a loss.
  }
}

/** One listed article as a raw item. Google News titles carry " - Outlet". */
function listedHit(it: Listed, feed: RssFeed): RawHit | null {
  let title = decodeEntities(it.title);
  let source = feed.name;
  if (isGnews(it.url)) ({ title, source } = outletFromGoogleTitle(title, feed.name));
  const url = it.url.trim();
  if (title.length < 12 || !/^https?:\/\//i.test(url) || isIsraeliSource(source, url)) return null;
  const desc = decodeEntities(it.desc);
  const at = Number.isFinite(it.at) ? jerusalemIso(new Date(it.at)) : jerusalemIso();
  return { source, url, text: `${title} ${desc}`.trim().slice(0, 1200), at, lean: "", fromTg: false, title };
}

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
    : /new york times/i.test(outlet) ? "NYT"
    : /washington post/i.test(outlet) ? "Washington Post"
    : /new york post/i.test(outlet) ? "NY Post"
    : /^axios/i.test(outlet) ? "Axios"
    : /^cnn\b/i.test(outlet) ? "CNN"
    : /^abc news/i.test(outlet) ? "ABC"
    : /^cbs news/i.test(outlet) ? "CBS"
    : /arab news/i.test(outlet) ? "Arab News"
    : /saudi press agency|^spa$/i.test(outlet) ? "SPA"
    : fallback === "US media" || fallback === LEARNED_NAME ? outlet.replace(/\s+/g, " ").slice(0, 28)
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
    items.push({ source: src, url, text: blob, at, lean: "", fromTg: false, title });
  }
  return items;
}

/** The post number in a t.me/<channel>/<n> URL, or 0. */
function tgPostNo(url: string): number {
  const m = /\/(\d+)(?:\?|$)/.exec(url);
  return m ? Number(m[1]) : 0;
}

/** The newest post number on a channel page, without parsing its posts. */
export function newestTgPost(html: string, channel: string): number {
  const own = channel.toLowerCase();
  let max = 0;
  for (const m of html.matchAll(/data-post="([^"/]+)\/(\d+)"/g)) {
    if (m[1].toLowerCase() === own) max = Math.max(max, Number(m[2]));
  }
  return max;
}

/**
 * A newspaper posts its edition as one message: a cover, then a dozen
 * headlines from a dozen different sections, sometimes with a link each.
 *
 * Judged whole, such a post is whatever most of it is about — Al-Akhbar's
 * daily edition reads as Lebanese politics and is thrown out as another
 * theatre, taking any Yemen story in it down with it. The desk was losing the
 * paper it was told to read, in the one message that carries it.
 *
 * So a digest is cut into its headlines and only the ones that name this war
 * go forward, each judged on its own. Anything that is not a digest, and any
 * digest with nothing of ours in it, is left exactly as it was.
 */
/** Words that place a piece in this war: an exclusive about something else is not forced in. */
const THIS_WAR = /اليمن|يمني|الحوث|صنعاء|عدن|تعز|مأرب|الحديدة|السعودي|البحر الأحمر|باب المندب|أنصار الله|Yemen|Houthi|Sanaa|Sana'a|Aden|Taiz|Marib|Hodeidah|Saudi|Red Sea|Bab al-Mandab|Ansar Allah/i;

const DIGEST_MARK = /[◼⬛⬜🖋]️?/gu;
const OURS = /اليمن|يمني|الحوث|صنعاء|السعود|عدن|تعز|مأرب|الحديدة|Yemen|Houthi|Saudi|Sanaa|Aden|Taiz|Marib/i;

/** The edition's footer ("اقرأ عدد اليوم عبر الرابط"), not a story. */
const DIGEST_FOOTER = /اقرأ عدد اليوم|ـــــ/;
/** A teaser post: two or three paragraphs, then "read the whole piece" and its link. */
const TEASER = /لقراءة\s+(?:الموضوع|المقال|الخبر|التقرير|الحوار|المقابلة)?\s*كامل/;

export function splitDigest(text: string, links: string[]): { text: string; href?: string }[] {
  const parts = text.split(DIGEST_MARK).map((t) => t.trim()).filter((t) => t.length >= 25 && !DIGEST_FOOTER.test(t));
  if (parts.length < 3) return [];
  const ours = parts.filter((t) => OURS.test(t));
  if (!ours.length || ours.length === parts.length) return [];
  return ours.map((t) => {
    const i = parts.indexOf(t);
    return { text: t, href: links.length === parts.length ? links[i] : undefined };
  });
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
    const media = tgMedia(p, url);
    const base = { source: ch.name, at, lean: ch.lean, fromTg: true, ...(replyUrl && replyUrl !== url ? { replyUrl } : {}), ...(media ? { media } : {}) };
    // An edition post carries a dozen stories; each of ours becomes its own
    // candidate so one is never judged by the other eleven.
    const outside = [...p.matchAll(/href="(https?:\/\/[^"]+)"/gi)]
      .map((m) => decodeEntities(m[1]))
      .filter((h) => !/t\.me\//.test(h));
    // A teaser (Al-Akhbar's morning pieces): its text is the story's opening,
    // its link the article; the card is the article's, not the channel post's.
    if (TEASER.test(text) && outside.length) {
      items.push({ ...base, url: outside[outside.length - 1].trim(), text });
      continue;
    }
    // An edition's story links, when the post lists one per headline.
    const articles = outside.filter((h) => /\/NewspaperArticles\//i.test(h));
    const pieces = splitDigest(text, articles.length ? articles : outside);
    if (pieces.length) {
      pieces.forEach((piece, n) => {
        items.push({ ...base, url: piece.href || `${url}#${n + 1}`, text: piece.text });
      });
      continue;
    }
    items.push({ ...base, url, text });
  }
  // A digest headline and its teaser name one article: the fuller text stays.
  const byUrl = new Map<string, RawHit>();
  for (const it of items) {
    const was = byUrl.get(it.url);
    if (!was || it.text.length > was.text.length) byUrl.set(it.url, it);
  }
  return [...byUrl.values()];
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

/** A channel's side by its name; outlets not on the list are international. */
function sideOfSource(name: string): OutletSide {
  return outletSide(name, TG.find((c) => c.name === name)?.lean ?? "intl");
}

const FIELD_TYPES = new Set(["combat", "strike", "economy", "vessel", "port"]);
/** Copies of one event arrive within this long of each other. */
const COPY_WINDOW_MS = 30 * 60 * 1000;

function storyKey(r: LiveReport): string {
  const s = r.summary;
  // An alert is keyed by the city it names, and folds only within a burst.
  const cities = alertCities(r);
  if (cities) return `${nightYmd(r.at)}|alert|${cities[0] ?? "ksa"}`;
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
 * How far back an identical headline folds. Relays run a minute or two behind
 * the first channel, so this is generous by their standard and deliberately
 * mean by the day's: two strikes on one district three hours apart are two
 * strikes, and must stay two cards.
 */
const SAME_HEADLINE_WINDOW_MS = 45 * 60_000;
/** Sirens across outlets within this long are one alert. */
const ALERT_BURST_MS = 8 * 60_000;
/** Two outlets on one field event, in different words, on one spot. */
const GROUND_WINDOW_MS = 20 * 60_000;
/** An identical headline carrying a figure or a named object does not happen twice in a night. */
const SAME_HEADLINE_COUNTED_MS = 8 * 3600_000;
/** One claim repeated with its figure by other outlets. */
const CLAIM_WINDOW_MS = 30 * 60_000;
/** The reader's "same event as": no further back than this. */
const DUPLICATE_WINDOW_MS = 6 * 3600_000;

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
    // Held to the code's own test: within hours, and no casualty figures that
    // disagree (UNICEF's 15 children killed was folded into a card on 693
    // Houthi deaths from the night before).
    let home = r.duplicateOf
      ? homes.find(
          (o) =>
            open(o) && o.fp === r.duplicateOf && Math.abs(t - Date.parse(o.at)) <= DUPLICATE_WINDOW_MS &&
            !numbersClash(`${o.summary} ${o.text ?? ""}`, `${r.summary} ${r.text ?? ""}`),
        )
      : undefined;
    // The same post forwarded by another channel, seen in a later scan.
    if (!home && r.copyKey) home = homes.find((o) => open(o) && o.copyKey === r.copyKey && Date.parse(o.at) <= t);
    // One event, two outlets, and the reader wrote both up in the same words.
    // The story test below runs only on statements, so a strike or a clash
    // relayed a minute later went out as a second card with an identical
    // headline. The same channel posting its own line twice folds here too.
    if (!home) {
      home = homes.find(
        (o) => open(o) && Date.parse(o.at) <= t && t - Date.parse(o.at) <= SAME_HEADLINE_WINDOW_MS && sameHeadline(o, r),
      );
    }
    const before = (o: LiveReport, ms: number) => Date.parse(o.at) <= t && t - Date.parse(o.at) <= ms;
    // The same headline from another outlet hours later, when it carries a
    // figure or a named object: "22 vessels", "a Wing Loong II". A plain
    // "strike on Haifan" twice in a day is two strikes and never folds here.
    if (!home && countedOrNamed(r.summary)) {
      home = homes.find(
        (o) => open(o) && o.source !== r.source && before(o, SAME_HEADLINE_COUNTED_MS) && nightYmd(o.at) === nightYmd(r.at) && sameHeadline(o, r),
      );
    }
    // One siren burst told by several outlets, city by city: one alert.
    const cities = alertCities(r);
    if (!home && cities) {
      home = homes.find((o) => {
        const oc = open(o) && before(o, ALERT_BURST_MS) ? alertCities(o) : null;
        return !!oc && citiesOverlap(oc, cities);
      });
    }
    // One field event, two outlets, no words in common: the same kind of
    // event on the same spot within minutes, and no casualty figures that
    // disagree. Two strikes on one district hours apart stay two cards.
    if (!home && FIELD_TYPES.has(r.type)) {
      home = homes.find(
        (o) =>
          open(o) && o.source !== r.source && o.type === r.type && before(o, GROUND_WINDOW_MS) &&
          sameGround(o, r) && !numbersClash(`${o.summary} ${o.text ?? ""}`, `${r.summary} ${r.text ?? ""}`),
      );
    }
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
    // One claim repeated with its figure — Saree's 52 strikes, from Saree, Naya
    // and Saba — whatever type each reader gave it.
    if (!home) {
      home = homes.find(
        (o) =>
          open(o) && o.source !== r.source && before(o, CLAIM_WINDOW_MS) && sameCount(o.summary, r.summary) &&
          sameStory(o, r) && !numbersClash(o.summary, r.summary),
      );
    }
    if (!home) continue;
    gone.add(r);
    // The movement's own outlet carrying a statement a sympathetic paper
    // reported first: the statement is the movement's, and the paper was
    // relaying it. The card keeps its place in the feed and its identity, and
    // changes hands — the relay moving to "Also" rather than being dropped.
    if (
      homeOutlet(r.source) &&
      !homeOutlet(home.source) &&
      sideOfSource(r.source) === sideOfSource(home.source) &&
      scoreReport(r) >= scoreReport(home)
    ) {
      const relayed = { source: home.source, url: home.url, summary: home.summary };
      home.summary = r.summary;
      home.text = r.text;
      home.url = r.url;
      home.source = r.source;
      home.tier = r.tier;
      home.alsoReportedBy = [relayed, ...(home.alsoReportedBy ?? [])].slice(0, 8);
      home.tags = [...new Set([...(home.tags ?? []), "lead-swap"])];
      if (home.side) home.confidence = confidenceOf(home, home.alsoReportedBy.map((a) => sideOfSource(a.source)));
      touched.add(home);
      continue;
    }
    // A card written from the original source needs no "Also": the others
    // only relay it.
    if (isOriginal(home) || r.citing === home.source) continue;
    const also = [...(home.alsoReportedBy ?? []), ...(r.alsoReportedBy ?? []), { source: r.source, url: r.url, summary: r.summary }];
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
    out.push({ id, url: gnews(`"${name}" (Yemen OR Houthi OR Houthis OR Saudi OR "Red Sea") when:1d`), name: "US media", cadence: C30 });
  }
  return out;
}

/** A follow-up this soon after the same outlet's card on the same story replies to it. */
const FOLLOW_MS = 15 * 60_000;

/**
 * "Fighting on Jabal Qurfan" then, minutes later from the same outlet, "Jabal
 * Qurfan recaptured": the second follows the first. Same source, within 15
 * minutes, and the rules of links.ts — a shared place or named thing, or one
 * speaker's lines. A word in common is not enough: "control", "wadi",
 * "missile" tied Kahbub to Marib and Beihan to Haifan.
 */
export function linkFollowUps(fresh: LiveReport[], pool: LiveReport[]): void {
  const who = speakersOf([...pool, ...fresh]);
  for (const r of fresh) {
    if (r.replyTo) continue;
    const t = Date.parse(r.at);
    const prev = pool
      .filter((x) => x.fp !== r.fp && x.source === r.source && Date.parse(x.at) < t && t - Date.parse(x.at) <= FOLLOW_MS)
      .filter((x) => linkOk(r, x, who))
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
    const site = feed.site;
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
/** A speakerless line and its channel's named line this close are one speaker's. */
const NEIGHBOUR_MS = 3 * 60_000;
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
  // A foreign minister's lines are typed diplomacy as often as statement.
  const talk = all
    .filter((r) => r.type === "statement" || r.type === "diplomacy")
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  // A line that names no speaker ("our forces will respond") is the speaker's
  // whose line the same channel posted within three minutes of it.
  const speaker = new Map<LiveReport, string>();
  for (const r of talk) {
    let who = namedSpeaker(r.summary);
    if (!who) {
      const t = Date.parse(r.at);
      const next = talk.find((o) => o !== r && o.source === r.source && Math.abs(Date.parse(o.at) - t) <= NEIGHBOUR_MS && namedSpeaker(o.summary));
      if (next) who = namedSpeaker(next.summary);
    }
    if (who) speaker.set(r, who);
  }
  const lines = talk.filter((r) => speaker.has(r));
  const byFp = new Map(lines.map((r) => [r.fp, r]));
  const last = new Map<string, LiveReport>();
  const touched: LiveReport[] = [];
  for (const r of lines) {
    const who = speaker.get(r)!;
    const prev = last.get(who);
    last.set(who, r);
    // Another outlet posting lines of the speech after it ended (Saba's summary,
    // hours later) still belongs to it.
    const gap = prev && prev.source !== r.source && who === "houthi leader" ? LATE_RELAY_MS : SPEECH_GAP_MS;
    if (!prev || Date.parse(r.at) - Date.parse(prev.at) > gap || r.replyTo === prev.fp) continue;
    // A reply to something else than this speech stays; one to an earlier
    // line of it moves to the line now just before it.
    const to = r.replyTo ? byFp.get(r.replyTo) : undefined;
    if (r.replyTo && !(to && speaker.get(to) === who && Date.parse(to.at) < Date.parse(prev.at))) continue;
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
/** Official bodies' own outlets: the original of their statements. */
const OFFICIAL_OUTLETS = new Set(["SPA", "Saba"]);

/**
 * Which account of an event leads its card: the speaker's own channel, then
 * an official body's own outlet for its statement, the original a relay
 * cited, an agency, then the best-written account.
 */
export function leadRank(r: LiveReport): number {
  const spoken = r.type === "statement" || r.type === "diplomacy";
  return (
    (OWN_CHANNELS.has(r.source) ? 4000 : 0) +
    (spoken && OFFICIAL_OUTLETS.has(r.source) ? 2000 : 0) +
    (isOriginal(r) ? 1000 : 0) +
    (r.tier === "agency" ? 500 : 0) +
    scoreReport(r)
  );
}

/* ------------------------------------------------------------------ *
 * Persist to the desk snapshot
 * ------------------------------------------------------------------ */

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
    return (await store.recentDesk(150, undefined, { events: false })).reports
      .filter((r) => Date.parse(String(r.at)) >= since)
      .map((r) => ({ ...(r as unknown as LiveReport), text: String((r as { text?: string }).text ?? ""), live: true as const }));
  } catch {
    return [];
  }
}

/** A lead's row id: its URL, hashed (URLs run long). */
const leadId = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 24);
let leadMigrated = false;
let leadPrunedAt = 0;

/**
 * The leads of these URLs only, one row each. The cache was one 9.5 MB blob,
 * read and written whole every tick: most of the database egress that ran out
 * the free plan.
 */
async function loadLeadCache(urls: string[]): Promise<LeadCache> {
  try {
    const store = await getStore();
    if (!leadMigrated) {
      await migrateBlob(store, LEAD_CACHE_KEY, LEAD_PREFIX, leadId);
      leadMigrated = true;
    }
    const rows = await store.getMany<LeadCache[string]>(LEAD_PREFIX, urls.map(leadId));
    const out: LeadCache = {};
    for (const u of urls) if (rows[leadId(u)]) out[u] = rows[leadId(u)];
    return out;
  } catch {
    return {};
  }
}

/** Only the entries this tick set are written; entries a week old are dropped. */
async function saveLeadCache(cache: LeadCache, changed: Set<string>): Promise<void> {
  try {
    const store = await getStore();
    await store.putMany(LEAD_PREFIX, Object.fromEntries([...changed].filter((u) => cache[u]).map((u) => [leadId(u), cache[u]])));
    if (Date.now() - leadPrunedAt > 3600_000) {
      leadPrunedAt = Date.now();
      await store.prune(LEAD_PREFIX, LEAD_KEEP_MS);
    }
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
  let learned: Learned[] = [];
  try {
    learned = await loadLearned(await getStore());
  } catch {
    // Unread, the learned outlets wait for the next tick.
  }
  const dueRss = [
    ...RSS.filter((feed) => hinted(feed.id) || cadenceDue(state, `web:${feed.id}`, feed.cadence, now)),
    ...learnedFeeds(learned).filter((feed) => cadenceDue(state, `web:${feed.id}`, feed.cadence, now)),
    ...speakerSearches(prev?.reports ?? [], state, now),
  ];
  let sourcesOk = 0;
  const hits: RawHit[] = [];
  const status: SourceStatus[] = [];
  const jobs: Promise<void>[] = [];

  // X accounts an original was found at join the half-hourly tier.
  const learnedX = learned.filter((l) => l.kind === "x" && !X_ACCOUNTS.some((x) => x.handle.toLowerCase() === l.site)).map((l) => X(l.site, l.name, "intl", C30));
  for (const acct of [...X_ACCOUNTS, ...learnedX].filter((a) => cadenceDue(state, `x:${a.handle}`, a.cadence, now))) {
    jobs.push(
      (async () => {
        let rows: RawHit[] = [];
        let ok = false;
        try {
          const res = await fetch(`https://api.fxtwitter.com/2/profile/${acct.handle}/statuses`, {
            headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)", accept: "application/json" },
            signal: AbortSignal.timeout(10_000),
          });
          if (res.ok) {
            const all = parseFxStatuses(await res.json(), acct);
            // Only what is new since the last read; on first sight, the last few hours.
            const seenId = state.lastXPost?.[acct.handle];
            const idOf = (u: string) => /\/status\/(\d+)/.exec(u)?.[1] ?? "";
            rows = all.filter((r) => newerX(idOf(r.url), seenId) && (seenId || Date.parse(r.at) > now - FIRST_SIGHT_MS));
            const newest = all.map((r) => idOf(r.url)).reduce((m, id) => (newerX(id, m || undefined) ? id : m), seenId ?? "");
            if (newest) (state.lastXPost ??= {})[acct.handle] = newest;
            ok = true;
          } else await res.body?.cancel().catch(() => {});
        } catch {
          // Unread this tick; the status says so.
        }
        if (ok) sourcesOk += 1;
        hits.push(...rows);
        state.lastScanAt[`x:${acct.handle}`] = Date.now();
        status.push({ id: acct.handle, name: acct.name, kind: "x", ok, cadence: cadenceLabel(acct.cadence), hits: rows.length });
      })(),
    );
  }
  for (const ch of dueTg) {
    jobs.push(
      (async () => {
        const html = await fetchText(`https://t.me/s/${ch.id}`);
        const ok = !!(html && html.includes("tgme_widget_message"));
        const seen = state.lastTgPost?.[ch.id] ?? 0;
        // Nothing posted since the last read: the page is not parsed at all
        // (most ticks, for most channels; Vercel bills the processor time).
        const replaying = REPLAY.channels.has(ch.id) && now < REPLAY.until && !state.lastScanAt[`replay5:${ch.id}`];
        const quiet = ok && seen > 0 && !replaying && newestTgPost(html as string, ch.id) <= seen;
        const rows = ok && !quiet ? parseTelegram(html as string, ch) : [];
        // A busy channel can post more between two scans than its first page
        // holds. Page back until we reach the last post already read, so a
        // burst never leaves a gap. First sight of a channel: no backfill.
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
        const newest = Math.max(seen, ok ? newestTgPost(html as string, ch.id) : 0, ...rows.map((r) => tgPostNo(r.url)));
        if (newest > 0) (state.lastTgPost ??= {})[ch.id] = newest;
        if (ok) sourcesOk += 1;
        hits.push(...rows);
        state.lastScanAt[`tg:${ch.id}`] = Date.now();
        status.push({ id: ch.id, name: ch.name, kind: "tg", ok, cadence: cadenceLabel(ch.cadence), hits: rows.length });
      })(),
    );
  }
  // What each whole site listed that the desk had not judged before: its
  // headlines go to triage together, after every listing is in.
  const seen = await loadSeen();
  const unjudged: { feed: RssFeed; hit: RawHit; key: string }[] = [];
  for (const feed of dueRss) {
    jobs.push(
      (async () => {
        // What we had already read from this feed, before this read moves it on.
        const lastRead = state.lastScanAt[`web:${feed.id}`] ?? 0;
        if (feed.whole) {
          let body = await fetchListing(feed.url, feed.ua);
          let listed = body ? (feed.html ? parseHtmlListing(body, feed.url, feed.html) : parseListing(body)) : [];
          // A site whose own listing fails today (Arab News answers some
          // readers 403) is listed through Google News for this read instead.
          if (!listed.length && feed.site && !/news.google.com/.test(feed.url)) {
            body = await fetchListing(feed.lang === "ar" ? gnews(`site:${feed.site} when:1d`, "ar", "SA", "SA:ar") : gnews(`site:${feed.site} when:1d`));
            listed = body ? parseListing(body) : [];
          }
          const ok = listed.length > 0;
          const mine = (seen[feed.id] ??= {});
          const firstSight = Object.keys(mine).length === 0;
          // A listing reaches back days (a sitemap, Axios); what is older than
          // this was judged before, or is not news any more. On first sight
          // only the last few hours are read, as a channel is.
          const window = firstSight ? FIRST_SIGHT_MS : SEEN_WINDOW_MS;
          const rows: RawHit[] = [];
          let fresh = 0;
          for (const it of listed) {
            // An undated article on a section page: on first sight the whole
            // page is what was there before; only what appears later is new.
            if (!Number.isFinite(it.at) && firstSight) {
              mine[`u${urlKey(it.url)}`] = 0;
              continue;
            }
            if (Number.isFinite(it.at) && now - it.at > window) {
              // Older than a first read reaches: set aside unjudged, so the
              // next read does not take the whole day back as new.
              if (firstSight && now - it.at <= SEEN_WINDOW_MS) mine[`u${urlKey(it.url)}`] = 0;
              continue;
            }
            const hit = listedHit(it, feed);
            if (!hit) continue;
            const key = `u${urlKey(it.url)}`;
            const verdict = mine[key];
            if (verdict === 1) rows.push({ ...hit, picked: true });
            else if (verdict === undefined) {
              fresh += 1;
              unjudged.push({ feed, hit, key });
            }
          }
          if (ok) sourcesOk += 1;
          hits.push(...rows);
          // Every article in the window is new to the desk: the listing may
          // have filled up since the last read and dropped some unseen.
          const inWindow = listed.filter((it) => !Number.isFinite(it.at) || now - it.at <= window).length;
          const rolled = !firstSight && !!lastRead && inWindow >= 20 && fresh === inWindow;
          state.lastScanAt[`web:${feed.id}`] = Date.now();
          status.push({ id: feed.id, name: feed.name, kind: "web", ok, cadence: cadenceLabel(feed.cadence), hits: rows.length, rolled, listed: listed.length, fresh });
          return;
        }
        const body = await fetchText(feed.url, 8000);
        let rows: RawHit[] = [];
        const ok = !!(body && /<item[\s>]/i.test(body));
        if (ok && body) rows = parseRss(body, feed.name);
        if (ok) sourcesOk += 1;
        hits.push(...rows);
        // A feed answers with one page. If everything on that page was
        // published since the last read, the page filled up in between and
        // whatever fell off the bottom was never seen. Telegram pages back to
        // the post it last saw; a feed URL has no such handle, so the honest
        // thing is to make the possibility visible rather than assume it away.
        const times = rows.map((r) => Date.parse(r.at)).filter(Number.isFinite);
        const rolled = !!lastRead && times.length > 0 && Math.min(...times) > lastRead;
        state.lastScanAt[`web:${feed.id}`] = Date.now();
        status.push({ id: feed.id, name: feed.name, kind: "web", ok, cadence: cadenceLabel(feed.cadence), hits: rows.length, rolled });
      })(),
    );
  }
  await Promise.allSettled(jobs);
  state.scannedOnce = true;

  // A model reads the new headlines and picks what could be this war's; the
  // rest are remembered as judged and never fetched. Headlines no model got to
  // (a spent quota) are judged by keyword now and asked about again next tick.
  if (unjudged.length) {
    const { picked, judged } = await triage(
      unjudged.map((u, i) => ({ id: String(i), title: u.hit.title ?? "", desc: u.hit.text.slice((u.hit.title ?? "").length).trim(), source: u.feed.name })),
    );
    const pickedBy: Record<string, number> = {};
    unjudged.forEach((u, i) => {
      const id = String(i);
      // An exclusive on this war is always read, whatever the triage made of it.
      const forced = !picked.has(id) && isExclusive(u.hit.text, u.feed.name) && THIS_WAR.test(u.hit.text);
      if (judged.has(id) || forced) seen[u.feed.id][u.key] = picked.has(id) || forced ? 1 : 0;
      if (!picked.has(id) && !forced) return;
      hits.push({ ...u.hit, picked: true });
      pickedBy[u.feed.id] = (pickedBy[u.feed.id] ?? 0) + 1;
    });
    for (const s of status) if (s.listed !== undefined) s.picked = pickedBy[s.id] ?? 0;
  }
  for (const s of status) {
    if (s.listed === undefined) continue;
    (state.sites ??= {})[s.id] = { at: now, ok: s.ok, listed: s.listed, fresh: s.fresh ?? 0, picked: s.picked ?? 0, rolled: !!s.rolled };
  }
  await saveSeen(seen);

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
  const leadable = (h: RawHit) => !(h.fromTg || (h.text.length >= 500 && !isGnews(h.url)) || /\.pdf(\?|$)/i.test(h.url));
  const leadCache = await loadLeadCache(hits.filter(leadable).map((h) => h.url));
  const leadChanged = new Set<string>();
  const addLead = (h: RawHit, lead: string) => {
    if (lead.length > 80) h.text = `${h.text}\n${lead}`.slice(0, ITEM_CHARS);
  };
  const toFetch: RawHit[] = [];
  for (const h of hits) {
    // A Google News item is resolved to its article even with a long teaser:
    // Google's redirect sends readers to a robot check.
    if (!leadable(h)) continue;
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
  let rescues = 0;
  // What triage picked from a whole site is opened first.
  toFetch.sort((a, b) => Number(!!b.picked) - Number(!!a.picked));
  const fetchable = toFetch.filter((h) => !isGnews(h.url) || resolves++ < GNEWS_RESOLVES).slice(0, BODY_FETCHES);
  await Promise.allSettled(
    fetchable.map(async (h) => {
      const key = h.url;
      const real = isGnews(key) ? await resolveGoogleNews(key) : "";
      if (isGnews(key) && !real) {
        leadCache[key] = { lead: "", at: now, tries: (leadCache[key]?.tries ?? 0) + 1 };
        leadChanged.add(key);
        return; // retried next cycle
      }
      const page = real || key;
      const html = await fetchText(page, 6000);
      if (!html && !real) return; // not cached: a failed fetch is retried next cycle
      // A paywalled article still yields its address; its lead may be empty.
      let lead = html ? extractLead(html) : "";
      // Still a teaser. If the publisher offers an AMP copy — which they serve
      // openly, for readers arriving from search — read that instead: it is the
      // same article without the subscription wall drawn over it. One extra
      // request, only for the articles that came back short.
      if (html && lead.length < AMP_RETRY_UNDER) {
        const amp = amphtmlOf(html, page);
        if (amp && amp !== page) {
          const ampHtml = await fetchText(amp, 6000);
          const ampLead = ampHtml ? extractLead(ampHtml) : "";
          if (ampLead.length > lead.length) lead = ampLead;
        }
      }
      // The article will not open at all, or opens on a teaser. Measured today:
      // wsj.com answers 401 to every reader, and arabnews.com, aawsat.com and
      // al-akhbar.com answer 403 — to any header, so there is nothing to be
      // gained by dressing the desk up as a browser, and it does not.
      //
      // What a desk does instead is find the story elsewhere. `readOriginal`
      // already knows how: the same headline searched on Google News, the copies
      // that carry it read in full, and a Wayback capture if no copy will open.
      // The card still says WSJ, because WSJ is who reported it; only the words
      // the desk had to read come from wherever it could read them.
      if (lead.length < WALLED_UNDER && h.title && rescues < WALLED_RESCUES) {
        rescues += 1;
        const lang = /[؀-ۿ]/.test(h.title) ? "ar" : "en";
        // Last, the story as other outlets told it: the WSJ's own paywalled
        // item is written up by others within hours.
        const cover = { name: h.source, keys: keywords(h.title, lang, h.source), at: Date.parse(h.at) };
        const full = await readOriginal({ url: page, source: h.source, title: h.title }, lang, undefined, cover);
        if (full.length > lead.length) lead = full.replace(/\s+/g, " ").trim().slice(0, ARTICLE_CHARS);
      }
      leadCache[key] = { lead, at: now, ...(real ? { real } : {}) };
      leadChanged.add(key);
      addLead(h, lead);
      if (real) h.url = cleanUrl(real);
    }),
  );
  await saveLeadCache(leadCache, leadChanged);
  // One article under two addresses — Google's redirect and the outlet's own
  // link, from two listings — is one item: the WSJ's China story went out as
  // two cards. An unresolved Google item takes the address its outlet's own
  // copy of the same headline has.
  const direct = new Map<string, string>();
  for (const h of hits) if (h.title && !isGnews(h.url)) direct.set(`${h.source}|${titleKey(h.title)}`, h.url);
  for (const h of hits) {
    const own = h.title && isGnews(h.url) ? direct.get(`${h.source}|${titleKey(h.title)}`) : undefined;
    if (own) h.url = own;
  }
  const oneEach = new Map<string, RawHit>();
  for (const h of hits) {
    const k = h.fromTg ? h.url : cleanUrl(h.url);
    const had = oneEach.get(k);
    if (!had || h.text.length > had.text.length) oneEach.set(k, had ? { ...h, picked: h.picked || had.picked } : h);
  }
  hits.length = 0;
  hits.push(...oneEach.values());
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
    // A whole site's article that triage picked goes to the reader even when
    // no keyword matched it: that is what reading the site whole is for.
    const picked = h.picked && !["excluded-source", "no-article", "bad-url"].includes(c.reason);
    if (c.outcome === "exclude" && !picked) continue;
    // Erem, Asharq Al-Awsat, Al-Araby, Al-Akhbar, Alhurra, Arab News: only what
    // they have on their own. An original a relay pointed to is read regardless.
    if (!h.fromTg && OWN_ONLY.has(h.source) && !ownInformation(h.text, h.source)) continue;
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
      if (isExclusive(h.text, h.source)) v.report.flags = [...new Set([...(v.report.flags ?? []), "exclusive"])];
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
    const held = new Set<string>();
    late = await traceOrigins(await getStore(), reports, new Map(hits.map((h) => [h.url, h.text])), now, reread, {
      held,
      listingOf: siteListing,
      knownHost: readsHost,
    });
    // A relay whose original is still being looked for is not published yet.
    for (let i = reports.length - 1; i >= 0; i -= 1) if (held.has(reports[i].fp)) reports.splice(i, 1);
    if (held.size) console.log(`[origin] ${held.size} relay(s) held while their original is looked for`);
    // Originals read in full go to the reader next cycle; the card is then
    // rewritten from the original's text under the same fp.
    await queueForReading(await getStore(), reread, now);
  } catch {
    // Untraced reports keep their relay as source; nothing else changes.
  }
  hintOutlets(state, hits, now);
  // An outlet does not open a headline, nor close it ("…, WSJ says"): the
  // source line says who reported it. Only after tracing, which reads the name.
  for (const r of reports) r.summary = stripAttribution(r.summary, [r.source, r.citing]);
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
      const alertRule = sk.includes("|alert|");
      const copyRule = FIELD_TYPES.has(r.type) && !alertRule;
      if (copyRule || alertRule || sk.includes("|stmt|")) {
        const t = Date.parse(r.at);
        const apart = (g: { lead: LiveReport }) => Math.abs(Date.parse(g.lead.at) - t);
        // Same words; or, for a field event, another outlet on the same spot
        // within minutes with no clashing figures; an alert, within its burst.
        const fits = (g: { lead: LiveReport }) =>
          alertRule
            ? apart(g) <= ALERT_BURST_MS
            : copyRule
              ? (apart(g) <= COPY_WINDOW_MS && sameWords(g.lead.summary, r.summary)) ||
                (apart(g) <= GROUND_WINDOW_MS && g.lead.source !== r.source && sameGround(g.lead, r) &&
                  !numbersClash(`${g.lead.summary} ${g.lead.text ?? ""}`, `${r.summary} ${r.text ?? ""}`))
              : sameWords(g.lead.summary, r.summary);
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

  // One card per event: the most fitting account leads, a wave of strikes on
  // one area is one card, and the group is written once from every account
  // (combine.ts). The other outlets are "Also", as links only.
  const earlier = new Set((prev?.reports ?? []).map((r) => r.fp));
  const isNew = (r: LiveReport) => !earlier.has(r.fp);
  const { groups, written: combined, tried: combineTried } = await combineGroups(
    planWaves(
      [...byStory.values()].map((g) => pickLead(members(g), leadRank)),
      isNew,
    ),
    async (system, user) => (await askChain("combine", system, user, { temperature: 0.1, timeoutMs: 15_000 }))?.json ?? null,
    leadRank,
    await getStore(),
    isNew,
  );
  for (const { lead, others } of groups) {
    if (!others.length) continue;
    // Distinct outlets only: three posts from one channel is one account.
    const outlets = new Map<string, { source: string; url: string }>();
    for (const o of others) if (o.source !== lead.source && o.citing !== lead.source) outlets.set(o.source, { source: o.source, url: o.url });
    if (isOriginal(lead)) outlets.clear();
    if (outlets.size) {
      lead.alsoReportedBy = [...outlets.values()].slice(0, 6);
    }
    // Corroboration moves the trust figure — counted by side inside
    // `credibility`, so five channels of one side count once.
    if (lead.side) {
      const sides = others.filter((o) => o.source !== lead.source).map((o) => o.side ?? "neutral");
      lead.confidence = confidenceOf(lead, sides);
    }
  }
  const uniqReports = groups.map((g) => g.lead).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

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
  const newCards = uniqReports.filter((r) => !published.has(r.fp));
  // A new card from a post with a picture or video that shows the event
  // carries it (media.ts): a merged card takes the first of its accounts'.
  try {
    const mediaByUrl = new Map(hits.filter((h) => h.media).map((h) => [h.url, { media: h.media as Media, postText: h.text }]));
    if (mediaByUrl.size) {
      const used = new Set([...stored, ...uniqReports].map((r) => r.media?.thumb).filter((t): t is string => !!t));
      const cands = newCards.flatMap((r) => {
        const own = mediaByUrl.get(r.url) ?? (r.alsoReportedBy ?? []).map((a) => mediaByUrl.get(a.url)).find(Boolean);
        return own && !r.media ? [{ r, ...own }] : [];
      });
      const given = await attachMedia(await getStore(), cands, used);
      if (given) console.log(`[media] ${given} card(s) given a picture or video`);
    }
  } catch (err) {
    console.error("[media] failed:", err instanceof Error ? err.message : err);
  }
  linkFollowUps(newCards, [...stored, ...uniqReports]);
  const touched = [...foldIntoPublished(uniqReports, published, stored), ...threadSpeeches(uniqReports, published, stored)];
  // Every link, whatever made it, passes the rules of links.ts; then one
  // model call picks, among the cards the rules allow, the one each new card
  // develops — or none — which also finds the links nobody made.
  checkLinks([...uniqReports, ...touched], [...stored, ...uniqReports]);
  try {
    const judged = await judgeLinks(
      newCards.filter((r) => uniqReports.includes(r)),
      [...stored, ...uniqReports],
      async (system, user) => (await askChain("links", system, user, { temperature: 0, models: TRIAGE_MODELS.slice(0, 2), timeoutMs: 12_000 }))?.json ?? null,
    );
    if (judged.length) console.log(`[links] judge changed ${judged.length} link(s)`);
  } catch (err) {
    console.error("[links] judge failed:", err instanceof Error ? err.message : err);
  }
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
    // Only sources that still exist. Carrying every id forward kept a feed
    // deleted two days earlier on the status page, still advertising the
    // daily 07:00 read it was dropped for failing — the page went on
    // describing a capability the desk no longer had.
    const real = new Set([...TG.map((c) => c.id), ...RSS.map((f) => f.id), ...learnedFeeds(learned).map((f) => f.id)]);
    for (const s of prev.sourceStatus) {
      if (s?.id && !haveS.has(s.id) && real.has(s.id)) status.push(s);
    }
  }

  const tried = status.length;
  const skipped = Math.max(0, TG.length + X_ACCOUNTS.length + RSS.length - tried);
  const cycleNote = skipped
    ? `${tried} sources this cycle; ${skipped} on a slower schedule (dailies and agencies).`
    : `All ${tried} sources scanned this cycle.`;
  // Say plainly when the reader could not run: a quiet feed must not look
  // like a quiet war.
  const readerNote = (modelNote ? ` Reader: ${modelNote}.` : "") + (combineTried ? ` Combined ${combined} of ${combineTried} groups into one card each.` : "");

  return {
    ok: true,
    scannedAt: jerusalemIso(),
    reports: uniqReports.slice(0, PAYLOAD_REPORTS),
    ...(touched.length ? { touched } : {}),
    sourcesTried: tried,
    sourcesOk,
    // Newest-seen first: what the scanner just pulled sits at the top of the box.
    rawHits: rawHits
      .filter((h) => !(now - Date.parse(h.seenAt || h.at) > RAW_HITS_MS))
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
  usage?: TickUsage;
  error?: string;
};

/**
 * One scan cycle: fetch every due source, compose, persist, report honestly.
 *
 * This is the only thing that scans. It is idempotent with respect to cadence
 * — calling it more often than the schedule simply finds fewer sources due —
 * so an over-eager clock costs nothing.
 */
/**
 * Node 24's fetch (undici) now and then throws an assertion from a socket that
 * closes while its response is paused — about one tick in ten, measured locally,
 * on no one request. Uncaught, it ended the whole tick. That one error is logged
 * and let go: the request it belonged to still ends at its own timeout. Every
 * other uncaught error ends the process as before.
 */
let undiciGuard = false;
function guardUndici(): void {
  if (undiciGuard || typeof process === "undefined" || typeof process.on !== "function") return;
  undiciGuard = true;
  process.on("uncaughtException", (err: Error & { code?: string }) => {
    if (err?.code === "ERR_ASSERTION" && /undici/.test(err.stack ?? "")) {
      console.error("[tick] undici assertion let go:", err.message.slice(0, 80));
      return;
    }
    throw err;
  });
}

/** The last ticks' database traffic and CPU, for the status page. */
export const TICK_USAGE_KEY = "tick-usage";
export type TickUsage = { at: string; tookMs: number; cpuMs: number; dbReadKB: number; dbWrittenKB: number; queries: number };

export async function runScanCycle(): Promise<TickResult> {
  guardUndici();
  resetDbMeter();
  const started = Date.now();
  const cpu0 = typeof process !== "undefined" && process.cpuUsage ? process.cpuUsage() : null;
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

  // What this tick cost: Supabase bills egress, Vercel bills CPU.
  const cpu = cpu0 ? process.cpuUsage(cpu0) : null;
  const usage: TickUsage = {
    at: new Date().toISOString(),
    tookMs: Date.now() - started,
    cpuMs: cpu ? Math.round((cpu.user + cpu.system) / 1000) : 0,
    dbReadKB: Math.round(dbMeter.read / 1024),
    dbWrittenKB: Math.round(dbMeter.written / 1024),
    queries: dbMeter.queries,
  };
  try {
    const log = (await store.getJson<TickUsage[]>(TICK_USAGE_KEY)) ?? [];
    await store.putJson(TICK_USAGE_KEY, [usage, ...log].slice(0, 48));
  } catch {
    /* the meter must never cost the tick */
  }

  return {
    ok: !error,
    usage,
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
