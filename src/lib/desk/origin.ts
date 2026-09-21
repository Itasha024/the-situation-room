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

import { resolveGoogleNews, searchGoogleNews } from "./gnews.ts";
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
  if (!Number.isFinite(resultAt) || resultAt > reportAt + 6 * 3600_000 || resultAt < reportAt - 72 * 3600_000) return 0;
  const have = new Set((title.match(/[A-Za-zء-ي][A-Za-z'ء-ي-]{2,}/g) || []).map((w) => w.toLowerCase()));
  return want.filter((w) => have.has(w.toLowerCase())).length;
}

/** A paraphrase shares few words with the original's headline: two is a match. */
const MIN_SHARED = 2;

const CACHE_KEY = "origin-cache";
const CACHE_MAX = 600;
/** Searches per tick: each costs a Google search plus a link resolution. */
export const ORIGIN_BUDGET = 4;
const RETRY_MS = 3600_000;
const GIVE_UP_MS = 24 * 3600_000;

type Found = { url: string; source: string };
type Entry =
  | { found: Found; at: number }
  | { cited: Cited; keys: string[]; firstAt: number; lastAt: number; report: LiveReport };

async function search(cited: Cited, keys: string[], reportAt: number): Promise<Found | null> {
  const q = `site:${cited.site} ${keys.slice(0, 4).join(" ")} when:3d`;
  const items = await searchGoogleNews(q, cited.lang);
  let hit: (typeof items)[number] | undefined;
  let best = MIN_SHARED - 1;
  for (const i of items) {
    const n = overlap(i.title, keys, i.at, reportAt);
    if (n > best) [hit, best] = [i, n];
  }
  if (!hit) return null;
  const url = await resolveGoogleNews(hit.link);
  return url ? { url, source: cited.name } : null;
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

  for (const r of reports) {
    const text = sourceText.get(r.url);
    const prior = cache[r.fp];
    if (prior && "found" in prior) {
      apply(r, prior.found);
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
    late.push(r);
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
