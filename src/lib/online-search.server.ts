/**
 * The Online watch's keyword sweep (user, 23 Oct: "automated regular searches in all social media platforms
 * by many hundreds of keywords"): hundreds of Arabic searches in turn, a few each tick, on every route that
 * is free and allowed. What is about Gaza or Judea and Samaria joins the watch's posts, and the model sorts
 * it like the rest.
 *
 * - Bluesky: its open search, no key.
 * - YouTube: the Data API (YOUTUBE_API_KEY): 100 searches a day, and the comments under the videos found.
 * - TikTok, Instagram, Facebook and X, as the search engines have them: Exa (EXA_API_KEY), Tavily
 *   (TAVILY_API_KEY) and Serper's Google results (SERPER_API_KEY), each with `site:` and within its free
 *   monthly allowance. A post reaches these hours after it goes up.
 * An engine without its key is skipped.
 */
import { MORE_WORDS } from "./desk/online-more.ts";
import { TOPICS, type WatchPost, aboutHome, areaOf, plainArabic, topicsOf } from "./desk/online-watch.ts";

export type SweepState = {
  qAt?: Record<string, number>;
  /** Searches used per engine on each day (UTC). */
  used?: Record<string, number>;
  day?: string;
  /** YouTube videos found, and when their comments were last read. */
  videos?: Record<string, { at: number; read: number; ch: string }>;
};

const PLACES = ["غزة", "خانيونس", "رفح", "دير البلح", "النصيرات", "البريج", "المغازي", "جباليا", "بيت لاهيا", "بيت حانون", "المواصي", "الشجاعية", "مخيم الشاطئ", "جنين", "مخيم جنين", "نابلس", "طولكرم", "نور شمس", "طوباس", "قلقيلية", "رام الله", "بيت لحم", "الخليل", "أريحا", "يطا", "قباطية", "بلاطة", "الضفة الغربية"];
/** Every search: the towns and camps by name, and the topics' phrases (two words or more, or a hashtag). */
export const SWEEP_QUERIES: string[] = [
  ...new Set(
    [...PLACES, ...TOPICS.flatMap((t) => t.words), ...Object.values(MORE_WORDS).flat()].filter(
      (w) => /[؀-ۿ]/.test(w) && (w.includes(" ") || w.startsWith("#") || PLACES.includes(w)),
    ),
  ),
];
/** For the engines that charge per search: four phrases at once, each group with a place in it. */
export const SWEEP_GROUPS: string[] = (() => {
  const phrases = SWEEP_QUERIES.filter((q) => !PLACES.includes(q));
  const out: string[] = [];
  for (let i = 0; i < phrases.length; i += 4) out.push(`(${phrases.slice(i, i + 4).map((p) => `"${p.replace(/^#/, "")}"`).join(" OR ")}) (${PLACES[(i / 4) % PLACES.length]} OR فلسطين)`);
  return out;
})();
const SITES: [string, WatchPost["pl"]][] = [["tiktok.com", "tiktok"], ["instagram.com", "instagram"], ["facebook.com", "facebook"], ["x.com", "x"]];

const env = (k: string) => (typeof process !== "undefined" ? process.env[k] ?? "" : "");
const H = 3600_000;

async function getJson(url: string, init: RequestInit = {}, ms = 20_000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; TheSituationRoom/1.0)", ...(init.headers ?? {}) } });
    if (!r.ok) {
      console.error(`[online] search ${new URL(url).host}: HTTP ${r.status}`);
      return null;
    }
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const post = (u: string, at: string | undefined, ch: string, text: string, pl: WatchPost["pl"], c = false): WatchPost => {
  const x = Array.from(String(text || "").trim()).slice(0, 400).join("");
  const t = Date.parse(at ?? "");
  return { u, at: new Date(Number.isFinite(t) ? t : Date.now()).toISOString(), ch, a: areaOf(x, "both"), t: topicsOf(x), x, v: 0, pl, ...(c ? { c: 1 as const } : {}) };
};

async function bluesky(q: string): Promise<WatchPost[]> {
  const j = (await getJson(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&lang=ar&sort=latest&limit=50`)) as { posts?: { uri: string; indexedAt: string; author: { handle: string }; record: { text?: string; createdAt?: string } }[] } | null;
  return (j?.posts ?? []).map((p) => post(`https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`, p.record?.createdAt ?? p.indexedAt, p.author.handle, p.record?.text ?? "", "bsky"));
}

async function youtube(q: string, state: SweepState, now: number): Promise<WatchPost[]> {
  const key = env("YOUTUBE_API_KEY");
  const after = new Date(now - 12 * H).toISOString();
  const j = (await getJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&maxResults=25&relevanceLanguage=ar&publishedAfter=${after}&q=${encodeURIComponent(q)}&key=${key}`)) as { items?: { id: { videoId: string }; snippet: { title: string; description: string; channelTitle: string; publishedAt: string } }[] } | null;
  const videos = (state.videos ??= {});
  return (j?.items ?? []).map((it) => {
    videos[it.id.videoId] ??= { at: Date.parse(it.snippet.publishedAt), read: 0, ch: it.snippet.channelTitle };
    return post(`https://www.youtube.com/watch?v=${it.id.videoId}`, it.snippet.publishedAt, it.snippet.channelTitle, `${it.snippet.title}\n${it.snippet.description}`, "yt");
  });
}
/** The comments under the videos the searches found: the talk (1 unit of the day's 10,000 each). */
async function youtubeComments(state: SweepState, now: number, max = 12): Promise<WatchPost[]> {
  const key = env("YOUTUBE_API_KEY");
  const videos = (state.videos ??= {});
  for (const [id, v] of Object.entries(videos)) if (now - v.at > 2 * 24 * H) delete videos[id];
  const due = Object.entries(videos).filter(([, v]) => now - v.read > H).sort((a, b) => a[1].read - b[1].read).slice(0, max);
  const out: WatchPost[] = [];
  for (const [id, v] of due) {
    v.read = now;
    const j = (await getJson(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&order=time&maxResults=100&textFormat=plainText&videoId=${id}&key=${key}`)) as { items?: { id: string; snippet: { topLevelComment: { snippet: { textDisplay: string; publishedAt: string } } } }[] } | null;
    for (const c of j?.items ?? []) {
      const s = c.snippet.topLevelComment.snippet;
      out.push({ ...post(`https://www.youtube.com/watch?v=${id}&lc=${c.id}`, s.publishedAt, v.ch, s.textDisplay, "yt", true), re: `https://www.youtube.com/watch?v=${id}` });
    }
  }
  return out;
}

async function exa(q: string, site: [string, WatchPost["pl"]], now: number): Promise<WatchPost[]> {
  const j = (await getJson("https://api.exa.ai/search", { method: "POST", headers: { "content-type": "application/json", "x-api-key": env("EXA_API_KEY") }, body: JSON.stringify({ query: q, type: "keyword", numResults: 20, includeDomains: [site[0]], startPublishedDate: new Date(now - 24 * H).toISOString(), contents: { text: { maxCharacters: 500 } } }) })) as { results?: { url: string; title?: string; text?: string; publishedDate?: string; author?: string }[] } | null;
  return (j?.results ?? []).map((r) => post(r.url, r.publishedDate, r.author || new URL(r.url).pathname.split("/")[1] || site[0], `${r.title ?? ""}\n${r.text ?? ""}`, site[1]));
}
async function tavily(q: string, site: [string, WatchPost["pl"]]): Promise<WatchPost[]> {
  const j = (await getJson("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${env("TAVILY_API_KEY")}` }, body: JSON.stringify({ query: q, include_domains: [site[0]], time_range: "day", max_results: 20 }) })) as { results?: { url: string; title?: string; content?: string; published_date?: string }[] } | null;
  return (j?.results ?? []).map((r) => post(r.url, r.published_date, new URL(r.url).pathname.split("/")[1] || site[0], `${r.title ?? ""}\n${r.content ?? ""}`, site[1]));
}
async function serper(q: string, site: [string, WatchPost["pl"]]): Promise<WatchPost[]> {
  const j = (await getJson("https://google.serper.dev/search", { method: "POST", headers: { "content-type": "application/json", "x-api-key": env("SERPER_API_KEY") }, body: JSON.stringify({ q: `${q} site:${site[0]}`, tbs: "qdr:d", num: 20, hl: "ar" }) })) as { organic?: { link: string; title?: string; snippet?: string; date?: string }[] } | null;
  return (j?.organic ?? []).map((r) => post(r.link, r.date, new URL(r.link).pathname.split("/")[1] || site[0], `${r.title ?? ""}\n${r.snippet ?? ""}`, site[1]));
}

/** Each engine: its key, its searches a day (within the free allowance), and how it searches. */
type Engine = { name: string; key?: string; perDay: number; grouped: boolean; search: (q: string, n: number, state: SweepState, now: number) => Promise<WatchPost[]> };
const ENGINES: Engine[] = [
  { name: "bsky", perDay: 12 * 288, grouped: false, search: (q) => bluesky(q) },
  { name: "yt", key: "YOUTUBE_API_KEY", perDay: 95, grouped: false, search: (q, _n, s, now) => youtube(q, s, now) },
  // Exa's $10 a month (~2,500 searches), Tavily's 1,000 credits, Serper's 2,500 credits over a month; each search one site in turn.
  { name: "exa", key: "EXA_API_KEY", perDay: 80, grouped: true, search: (q, n, _s, now) => exa(q, SITES[n % SITES.length], now) },
  { name: "tavily", key: "TAVILY_API_KEY", perDay: 30, grouped: true, search: (q, n) => tavily(q, SITES[n % SITES.length]) },
  { name: "serper", key: "SERPER_API_KEY", perDay: 80, grouped: true, search: (q, n) => serper(q, SITES[n % SITES.length]) },
];

/** One tick of the sweep: each engine's next searches (those not run longest), within its day's share; what they found about home, from the last day. */
export async function sweep(state: SweepState, now = Date.now()): Promise<{ found: WatchPost[]; ran: number }> {
  const qAt = (state.qAt ??= {});
  const day = new Date(now).toISOString().slice(0, 10);
  if (state.day !== day) {
    state.day = day;
    state.used = {};
  }
  const used = (state.used ??= {});
  const found: WatchPost[] = [];
  let ran = 0;
  for (const e of ENGINES) {
    if (e.key && !env(e.key)) continue;
    // The day's share spread over its 288 ticks, at least one search when there is share left.
    const left = e.perDay - (used[e.name] ?? 0);
    const slots = Math.min(left, Math.max(1, Math.round(e.perDay / 288)));
    if (slots <= 0 || (e.perDay < 288 && Math.random() > e.perDay / 288)) continue;
    const pool = e.grouped ? SWEEP_GROUPS : SWEEP_QUERIES;
    const next = [...pool].sort((a, b) => (qAt[`${e.name}:${a}`] ?? 0) - (qAt[`${e.name}:${b}`] ?? 0)).slice(0, slots);
    for (const q of next) {
      qAt[`${e.name}:${q}`] = now;
      used[e.name] = (used[e.name] ?? 0) + 1;
      ran += 1;
      for (const p of await e.search(q, used[e.name], state, now)) if (now - Date.parse(p.at) < 24 * H && (p.pl === "bsky" || p.pl === "yt" ? aboutHome(p.x) : true) && plainArabic(p.x).length > 15) found.push(p);
    }
  }
  if (env("YOUTUBE_API_KEY")) found.push(...(await youtubeComments(state, now)).filter((p) => now - Date.parse(p.at) < 24 * H && plainArabic(p.x).length > 3));
  return { found, ran };
}
