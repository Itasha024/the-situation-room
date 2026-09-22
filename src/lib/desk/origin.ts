/**
 * Following a report back to where it was first published. Server-only.
 *
 * Channels relay: "according to the New York Times ...", "the Saudi Defense
 * Ministry said ...". When a post names where its news came from, the desk
 * looks for that original — on the outlet's or the body's own site, whether or
 * not it is one of the desk's sources — and, when it finds it, the original
 * REPLACES the relaying post as the report's source and link. When it cannot,
 * the card credits the relay "citing" the original, and the search is retried
 * hourly for a day.
 *
 * Code finds the citation and checks the match; no model call is spent.
 */

import { BROWSER_UA, resolveGoogleNews, searchGoogleNews } from "./gnews.ts";
import { FULL_TEXT_MAX } from "./reader.ts";
import type { DeskStore } from "./store.ts";
import type { LiveReport } from "./types.ts";

export type Cited = { name: string; site: string; lang: "en" | "ar"; kind: "outlet" | "official" };

/**
 * Who a post may cite, how its name is written, and where its originals live.
 * Official bodies publish through their own sites; the Saudi Defense Ministry
 * and the coalition publish through SPA.
 */
const CITABLE: [RegExp, Cited][] = [
  [/نيويورك تايمز|New York Times|\bNYT\b/i, { name: "NYT", site: "nytimes.com", lang: "en", kind: "outlet" }],
  [/وول ستريت جورنال|Wall Street Journal|\bWSJ\b/i, { name: "WSJ", site: "wsj.com", lang: "en", kind: "outlet" }],
  [/واشنطن بوست|Washington Post/i, { name: "Washington Post", site: "washingtonpost.com", lang: "en", kind: "outlet" }],
  [/رويترز|Reuters/i, { name: "Reuters", site: "reuters.com", lang: "en", kind: "outlet" }],
  [/أسوشيتد برس|اسوشيتد برس|Associated Press|\bAP\b/, { name: "AP", site: "apnews.com", lang: "en", kind: "outlet" }],
  [/أكسيوس|اكسيوس|Axios/i, { name: "Axios", site: "axios.com", lang: "en", kind: "outlet" }],
  [/بلومبرغ|بلومبيرغ|Bloomberg/i, { name: "Bloomberg", site: "bloomberg.com", lang: "en", kind: "outlet" }],
  [/فاينانشال تايمز|فايننشال تايمز|Financial Times/i, { name: "Financial Times", site: "ft.com", lang: "en", kind: "outlet" }],
  [/الغارديان|Guardian/i, { name: "The Guardian", site: "theguardian.com", lang: "en", kind: "outlet" }],
  [/بوليتيكو|Politico/i, { name: "Politico", site: "politico.com", lang: "en", kind: "outlet" }],
  [/سي إن إن|سي ان ان|\bCNN\b/i, { name: "CNN", site: "cnn.com", lang: "en", kind: "outlet" }],
  [/فوكس نيوز|Fox News/i, { name: "Fox News", site: "foxnews.com", lang: "en", kind: "outlet" }],
  // Bare "الشرق الأوسط" is "the Middle East"; only the paper counts.
  [/صحيفة\s+"?الشرق الأوسط|Asharq Al-Awsat/i, { name: "Asharq Al-Awsat", site: "aawsat.com", lang: "ar", kind: "outlet" }],
  [/الأخبار اللبنانية|صحيفة الأخبار|Al-Akhbar/i, { name: "Al-Akhbar", site: "al-akhbar.com", lang: "ar", kind: "outlet" }],
  [/وزارة الدفاع السعودية|الدفاع السعودية|Saudi (?:Defen[cs]e|defen[cs]e) Ministry|Saudi Ministry of Defen[cs]e/i, { name: "Saudi Defense Ministry", site: "spa.gov.sa", lang: "en", kind: "official" }],
  [/المتحدث (?:الرسمي )?باسم (?:قوات )?التحالف|تحالف دعم الشرعية|coalition spokesman/i, { name: "Coalition (SPA)", site: "spa.gov.sa", lang: "en", kind: "official" }],
  [/وكالة الأنباء السعودية|\(واس\)|\bواس\b|Saudi Press Agency/i, { name: "SPA", site: "spa.gov.sa", lang: "en", kind: "official" }],
  [/سنتكوم|القيادة المركزية الأمريكية|CENTCOM|Central Command/i, { name: "CENTCOM", site: "centcom.mil", lang: "en", kind: "official" }],
  [/الخارجية الأمريكية|الخارجية الأميركية|State Department/i, { name: "State Department", site: "state.gov", lang: "en", kind: "official" }],
  [/المبعوث الأممي|غروندبرغ|UN envoy|Grundberg/i, { name: "UN envoy's office", site: "osesgy.unmissions.org", lang: "en", kind: "official" }],
  // Wires and broadcasters the channels relay by name.
  [/فرانس برس|وكالة الصحافة الفرنسية|\bAFP\b|Agence France[- ]Presse/i, { name: "AFP", site: "afp.com", lang: "en", kind: "outlet" }],
  [/بي بي سي|\bBBC\b/i, { name: "BBC", site: "bbc.com", lang: "en", kind: "outlet" }],
  [/الأناضول|أناضول|Anadolu/i, { name: "Anadolu", site: "aa.com.tr", lang: "en", kind: "outlet" }],
  [/تي آر تي|\bTRT\b/i, { name: "TRT", site: "trt.net.tr", lang: "en", kind: "outlet" }],
  [/الجزيرة نت|موقع الجزيرة|Al Jazeera Net/i, { name: "Al Jazeera", site: "aljazeera.net", lang: "ar", kind: "outlet" }],
  [/ميدل إيست آي|Middle East Eye/i, { name: "Middle East Eye", site: "middleeasteye.net", lang: "en", kind: "outlet" }],
  [/العربي الجديد/, { name: "Al-Araby Al-Jadeed", site: "alaraby.co.uk", lang: "ar", kind: "outlet" }],
  // The UN bodies that publish the displacement, hunger and casualty figures
  // the desk keeps being asked to carry. Each publishes its own release; a
  // channel quoting "the UNHCR said" is quoting a document with a URL.
  [/المفوضية السامية للأمم المتحدة لشؤون اللاجئين|مفوضية (?:الأمم المتحدة )?(?:السامية )?لشؤون اللاجئين|\bUNHCR\b/i, { name: "UNHCR", site: "unhcr.org", lang: "en", kind: "official" }],
  [/مكتب تنسيق الشؤون الإنسانية|أوتشا|\bOCHA\b/i, { name: "UN OCHA", site: "unocha.org", lang: "en", kind: "official" }],
  [/برنامج الأغذية العالمي|\bWFP\b|World Food Programme/i, { name: "WFP", site: "wfp.org", lang: "en", kind: "official" }],
  [/منظمة الصحة العالمية|World Health Organization|\bWHO\b/, { name: "WHO", site: "who.int", lang: "en", kind: "official" }],
  [/اليونيسف|\bUNICEF\b/i, { name: "UNICEF", site: "unicef.org", lang: "en", kind: "official" }],
  [/المنظمة البحرية الدولية|\bIMO\b/, { name: "IMO", site: "imo.org", lang: "en", kind: "official" }],
  // Governments whose statements arrive through whoever saw them first.
  [/الخارجية البريطانية|وزارة الخارجية البريطانية|Foreign(?:,| and) Commonwealth|\bFCDO\b|British Foreign Office/i, { name: "UK Foreign Office", site: "gov.uk", lang: "en", kind: "official" }],
  [/البنتاغون|وزارة الدفاع الأمريكية|Pentagon|\bDoD\b/i, { name: "Pentagon", site: "defense.gov", lang: "en", kind: "official" }],
  [/البيت الأبيض|White House/i, { name: "White House", site: "whitehouse.gov", lang: "en", kind: "official" }],
];

/** A citation marker: the name must be what the post is relaying, not a subject. */
const RELAY = /(?:نقلا عن|نقلاً عن|وفقا ل|وفقاً ل|بحسب|حسب|عن|قالت|ذكرت|أفادت|أعلنت|كشفت|أكدت|:|according to|citing|told|said|reported|reports)/i;

/** The first source the text relays from, other than the outlet carrying it. */
export function findCitation(text: string, carrier: string, carrierUrl = ""): Cited | null {
  const t = String(text || "");
  for (const [re, cited] of CITABLE) {
    const m = re.exec(t);
    if (!m) continue;
    if (carrierUrl.includes(cited.site) || carrier.toLowerCase() === cited.name.toLowerCase()) continue;
    // Within a few words of a relay word, before or after ("رويترز عن",
    // "قالت صحيفة نيويورك تايمز", "Reuters reported", "NYT:").
    const around = t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 12);
    if (RELAY.test(around)) return cited;
  }
  return null;
}

const STOP_EN = new Set(
  "the a an of in on at to for and or but with from by as is are was were be been has have had its it this that after before over into amid says said say new report reports".split(" "),
);
const STOP_AR = new Set("في من على إلى عن مع أن إن التي الذي هذا هذه بعد قبل حول ضد كما وقد قد لا لم ما هو هي".split(" "));

/** The words a search and a match are judged on. */
export function keywords(text: string, lang: "en" | "ar", skip: string): string[] {
  const skipWords = new Set(skip.toLowerCase().split(/\s+/));
  const words =
    lang === "en"
      ? (String(text).match(/[A-Za-z][A-Za-z'-]{2,}/g) || [])
          .map((w) => w.replace(/'s$/, ""))
          .filter((w) => !STOP_EN.has(w.toLowerCase()) && !skipWords.has(w.toLowerCase()))
      : (String(text).match(/[ء-ي]{4,}/g) || []).filter((w) => !STOP_AR.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  // Names first (capitalised), then the rest in order.
  const ranked = lang === "en" ? [...words.filter((w) => /^[A-Z]/.test(w)), ...words] : words;
  for (const w of ranked) {
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

/** Does a search result tell the same story? Shared words and a fitting time. */
export function overlap(title: string, want: string[], resultAt: number, reportAt: number): number {
  if (!Number.isFinite(resultAt) || resultAt > reportAt + 6 * 3600_000 || resultAt < reportAt - 36 * 3600_000) return 0;
  const have = new Set((title.match(/[A-Za-zء-ي][A-Za-z'ء-ي-]{2,}/g) || []).map((w) => w.toLowerCase()));
  return want.filter((w) => have.has(w.toLowerCase())).length;
}

/** Shared words, each weighted by how early it ranks in `want`. */
export function weight(title: string, want: string[]): number {
  const have = new Set((title.match(/[A-Za-zء-ي][A-Za-z'ء-ي-]{2,}/g) || []).map((w) => w.toLowerCase()));
  return want.reduce((s, w, i) => s + (have.has(w.toLowerCase()) ? 1 / (1 + i) : 0), 0);
}

/** A paraphrase shares few words with the original's headline: two is a match. */
const MIN_SHARED = 2;

// v3: video pages and matches over 36 hours old refused, originals read in
// full; v2 matches weighted by the post's leading names; v1 held looser matches.
const CACHE_KEY = "origin-cache-v3";
const CACHE_MAX = 600;
/** Searches per tick: each costs a Google search plus a link resolution. */
export const ORIGIN_BUDGET = 4;
const RETRY_MS = 3600_000;
const GIVE_UP_MS = 24 * 3600_000;

type Found = { url: string; source: string; title?: string; readBy?: string };

/** The original, read in full and queued for the reader to write the card from. */
export type ReRead = { source: string; url: string; text: string; at: string; lean: string; fp: string; score: number; tags: string[] };
/** Originals read per tick: each costs a page, and maybe a search and three copies. */
const READ_BUDGET = 2;
type Entry =
  | { found: Found; at: number }
  | { cited: Cited; keys: string[]; firstAt: number; lastAt: number; report: LiveReport };

/** Paths that are never the article itself: video, photo and live pages, a bare front page. */
const NOT_ARTICLE = /\/(?:video|videos|pictures|graphics|live)\//i;
function articlePath(url: string): boolean {
  try {
    const p = new URL(url).pathname;
    return p.length > 1 && !NOT_ARTICLE.test(p);
  } catch {
    return false;
  }
}

async function search(cited: Cited, keys: string[], reportAt: number): Promise<Found | null> {
  const q = `site:${cited.site} ${keys.slice(0, 4).join(" ")} when:3d`;
  const items = await searchGoogleNews(q, cited.lang);
  // Enough shared words to count, then the best fit: a word ranked early (the
  // post's leading names, "Trump") weighs more than one from deep in the body.
  const ranked = items
    .filter((i) => overlap(i.title, keys, i.at, reportAt) >= MIN_SHARED)
    .sort((a, b) => weight(b.title, keys) - weight(a.title, keys));
  // A video page or a section front is not the article: try the next fit.
  for (const hit of ranked.slice(0, 2)) {
    const url = await resolveGoogleNews(hit.link);
    if (url && articlePath(url)) return { url, source: cited.name, title: hit.title };
  }
  return null;
}

async function page(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.text() : "";
  } catch {
    return "";
  }
}

/** An article page's paragraphs, without the page's furniture. */
export function articleText(html: string): string {
  // Stylesheets and scripts first. Stripping tags alone leaves what was between
  // them, and sites that style their links inline — wsj.com does — put a
  // `<style>` block inside the first paragraph, so every rescued WSJ story
  // began "DUBAI—.css-qxhvg8-OverridedLink{-webkit-text-decoration:none…".
  const clean = String(html || "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  return [...clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&#x27;|&#39;|&rsquo;|&lsquo;/g, "'")
        .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;|&#160;/g, " ")
        .replace(/^Listen\s*/, "")
        .replace(/\s*REUTERS\s*$/, "")
        .trim(),
    )
    .filter((t) => t.length > 60 && !/cookie|subscribe|sign up|newsletter|all rights reserved|©/i.test(t))
    // A paragraph is a sentence: a line with no closing stop is a related
    // headline or a caption, not the story.
    .filter((t) => /[.!?؟"'”’)»]$/.test(t))
    .filter((t, i, all) => all.indexOf(t) === i)
    // Whole paragraphs, the whole article: its key fact may be near the end.
    .reduce((out, t) => (out.length + t.length < FULL_TEXT_MAX ? (out ? `${out}\n${t}` : t) : out), "");
}

/**
 * A headline reduced to its letters, so the same story under two outlets'
 * punctuation compares equal.
 *
 * The backslashes matter: written `[^p{L}p{N}]` the class is not "anything but
 * a letter or a digit", it is "anything but the five characters p { L } N".
 * Every lowercased headline came out as a run of the letter p — "Trump spoke
 * with Yemen's president Al-Alimi" was "ppp" — so unrelated stories with the
 * same number of p's compared equal, and `readOriginal` returned a different
 * article's text as this report's body. Caught by a rescued Arab News item
 * about a call with Yemen's president coming back as Trump meeting Qatar's PM.
 */
const titleKey = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** How each site's original was read, and how often it could not be: the admin record. */
export const ROUTES_KEY = "origin-routes";
export type Route = "page" | "copy" | "wayback" | "none";
export type RouteLog = Record<string, { routes: Partial<Record<Route, number>>; lastAt: number; last: Route }>;
export function logRoute(log: RouteLog, url: string, route: Route, now = Date.now()): void {
  const host = hostOf(url);
  if (!host) return;
  const e = (log[host] ??= { routes: {}, lastAt: 0, last: route });
  e.routes[route] = (e.routes[route] ?? 0) + 1;
  e.lastAt = now;
  e.last = route;
}
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www./, "");
  } catch {
    return "";
  }
};

/**
 * The original's full text. Wires such as Reuters refuse automated readers, so
 * when the page itself will not open, the same story is read from a paper
 * that carries the wire under the same headline (The Straits Times,
 * MarketScreener, ...). No page is forced: a refusal moves on to the next copy.
 */
export async function readOriginal(f: Found, lang: "en" | "ar" = "en", note: (r: Route) => void = () => {}): Promise<string> {
  const own = articleText(await page(f.url));
  if (own.length >= 400) return note("page"), own;
  const kept = async () => {
    // A copy the Wayback Machine already holds; a new capture is never asked for.
    const text = articleText(await page(await archived(f.url)));
    note(text.length >= 400 ? "wayback" : "none");
    return text.length > own.length ? text : own;
  };
  if (!f.title) return kept();
  const want = titleKey(f.title);
  const copies = (await searchGoogleNews(`"${f.title}"`, lang)).filter(
    (i) => i.outlet && i.outlet !== f.source && titleKey(i.title) === want,
  );
  for (const i of copies.slice(0, 3)) {
    const url = await resolveGoogleNews(i.link);
    const text = url ? articleText(await page(url)) : "";
    if (text.length >= 400) return note("copy"), text;
  }
  return kept();
}

/** The raw page of an existing Wayback Machine capture, or "". */
async function archived(url: string): Promise<string> {
  try {
    const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(6000) });
    const snap = res.ok ? ((await res.json()) as { archived_snapshots?: { closest?: { url?: string; available?: boolean } } }).archived_snapshots?.closest : undefined;
    return snap?.available && snap.url ? snap.url.replace(/\/web\/(\d+)\//, "/web/$1id_/") : "";
  } catch {
    return "";
  }
}

/**
 * Trace this cycle's reports, and retry ones still waiting. Returns the stored
 * reports whose original turned up only now, to be re-saved with it.
 */
export async function traceOrigins(
  store: DeskStore,
  reports: LiveReport[],
  sourceText: Map<string, string>,
  now = Date.now(),
  reread: ReRead[] = [],
): Promise<LiveReport[]> {
  const cache = (await store.getJson<Record<string, Entry>>(CACHE_KEY)) ?? {};
  let budget = ORIGIN_BUDGET;
  let dirty = false;
  const apply = (r: LiveReport, f: Found) => {
    // The original stands alone: no "Also" line of relays.
    r.url = f.url;
    r.source = f.source;
    r.citing = undefined;
    r.alsoReportedBy = undefined;
  };
  let reads = READ_BUDGET;
  let routes: RouteLog | undefined;
  /**
   * The first report traced to an original has the original read and queued,
   * so the card is written from the original text, not the relay. Another
   * relay of the same original joins that card instead.
   */
  const readFrom = async (r: LiveReport, f: Found, cited: Cited | null) => {
    const owner = Object.entries(cache).find(([fp, e]) => fp !== r.fp && "found" in e && e.found.url === f.url && e.found.readBy)?.[1];
    if (owner && "found" in owner) {
      r.duplicateOf = owner.found.readBy;
      return;
    }
    if (f.readBy || !cited || cited.kind !== "outlet" || reads <= 0) return;
    reads -= 1;
    const text = await readOriginal(f, cited.lang, (route) => logRoute((routes ??= {}), f.url, route, now));
    if (text.length < 400) return;
    f.readBy = r.fp;
    dirty = true;
    reread.push({
      source: f.source,
      url: f.url,
      text: `${f.title ?? ""}
${text}`.trim(),
      at: r.at,
      lean: "intl",
      fp: r.fp,
      score: r.score ?? 0,
      tags: [...(r.tags ?? []), "original"],
    });
  };

  for (const r of reports) {
    const text = sourceText.get(r.url);
    const prior = cache[r.fp];
    if (prior && "found" in prior) {
      apply(r, prior.found);
      await readFrom(r, prior.found, findCitation(text ?? "", "", ""));
      continue;
    }
    if (prior) {
      r.citing = prior.cited.name;
      continue; // waiting: retried below
    }
    if (!text) continue;
    const cited = findCitation(text, r.source, r.url);
    if (!cited) continue;
    const keys = keywords(cited.lang === "en" ? `${r.summary} ${r.text}` : text, cited.lang, cited.name);
    if (keys.length < 2) continue;
    r.citing = cited.name;
    const entry: Entry = { cited, keys, firstAt: now, lastAt: 0, report: { ...r } };
    cache[r.fp] = entry;
    dirty = true;
    if (budget <= 0) continue;
    budget -= 1;
    entry.lastAt = now;
    const found = await search(cited, keys, Date.parse(r.at));
    if (found) {
      cache[r.fp] = { found, at: now };
      apply(r, found);
      await readFrom(r, found, cited);
    }
  }

  // Retries: hourly, for a day after the report.
  const late: LiveReport[] = [];
  for (const [fp, e] of Object.entries(cache)) {
    if (budget <= 0) break;
    if ("found" in e || now - e.firstAt > GIVE_UP_MS || now - e.lastAt < RETRY_MS) continue;
    budget -= 1;
    e.lastAt = now;
    dirty = true;
    const found = await search(e.cited, e.keys, Date.parse(e.report.at));
    if (!found) continue;
    cache[fp] = { found, at: now };
    const r = { ...e.report };
    apply(r, found);
    await readFrom(r, found, e.cited);
    late.push(r);
  }

  if (routes) {
    const log = (await store.getJson<RouteLog>(ROUTES_KEY)) ?? {};
    for (const [host, e] of Object.entries(routes)) {
      const into = (log[host] ??= { routes: {}, lastAt: 0, last: e.last });
      for (const [k, n] of Object.entries(e.routes)) into.routes[k as Route] = (into.routes[k as Route] ?? 0) + (n ?? 0);
      into.lastAt = e.lastAt;
      into.last = e.last;
    }
    await store.putJson(ROUTES_KEY, log);
  }
  if (dirty) {
    const stamp = (e: Entry) => ("found" in e ? e.at : e.firstAt);
    const kept = Object.entries(cache)
      .sort((a, b) => stamp(b[1]) - stamp(a[1]))
      .slice(0, CACHE_MAX);
    await store.putJson(CACHE_KEY, Object.fromEntries(kept));
  }
  return late;
}
