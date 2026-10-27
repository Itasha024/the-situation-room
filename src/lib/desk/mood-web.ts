/**
 * Reactions to an event beyond Telegram (user, 27 Oct: "search for it also with key words in X and other platforms
 * … without account"). What answers a reader with no account and no bot check, tried from the server on 27 Oct:
 * - YouTube: its search page (newest first) and the comments under the videos, through the page's own public calls.
 * - Bluesky: its public search API.
 * - X: no search without an account (Nitter, xcancel, DuckDuckGo and Brave all answer with a block or a bot check),
 *   so the Palestinian news accounts FxTwitter can read are searched instead.
 * Reddit, TikTok, Facebook, Instagram and TGStat refuse a reader without an account, so they are left out.
 */
import { cut, type MoodPost } from "./gaza-mood.ts";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
/** Palestinian X accounts FxTwitter can read (27 Oct; Shehab, Safa, WAFA and the others answer nothing). */
export const PAL_X = ["QudsNen", "PalinfoAr", "palinfoen", "Paltodaytv", "alqastalps", "PalestineChron"];

const UNIT: Record<string, number> = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };
/** "3 hours ago" (YouTube's English page) as a time. */
export function agoAt(s: string, now: number): number | null {
  const m = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(String(s || ""));
  return m ? now - Number(m[1]) * UNIT[m[2].toLowerCase()] : null;
}
const num = (s: unknown) => Number(String(s ?? "").replace(/[^\d]/g, "")) || 0;
const hits = (text: string, terms: string[]) => terms.some((t) => t && text.includes(t));

type YtVideo = { id: string; title: string; ch: string; at: number; views: number };
/** The videos on a YouTube search page, from the data the page carries. */
export function parseYtSearch(html: string, now: number): YtVideo[] {
  const raw = /var ytInitialData = (\{[\s\S]*?\});<\/script>/.exec(html)?.[1];
  if (!raw) return [];
  const out: YtVideo[] = [];
  try {
    JSON.parse(raw, (k, v) => {
      if (k === "videoRenderer" && v?.videoId) {
        const at = agoAt(v.publishedTimeText?.simpleText ?? "", now);
        if (at != null) out.push({ id: v.videoId, title: String(v.title?.runs?.[0]?.text ?? ""), ch: String(v.ownerText?.runs?.[0]?.text ?? ""), at, views: num(v.viewCountText?.simpleText) });
      }
      return v;
    });
  } catch {
    return [];
  }
  return [...new Map(out.map((x) => [x.id, x])).values()];
}

/** The comments in an answer of YouTube's comment call. */
export function parseYtComments(j: unknown, video: YtVideo, now: number): MoodPost[] {
  const out: MoodPost[] = [];
  JSON.stringify(j, (k, v) => {
    if (k === "commentEntityPayload") {
      const x = cut(String(v?.properties?.content?.content ?? ""), 300);
      const at = agoAt(String(v?.properties?.publishedTime ?? "").replace(/\s*\(edited\)/, ""), now);
      if (x && at != null) out.push({ u: `https://www.youtube.com/watch?v=${video.id}&lc=${v.properties.commentId ?? ""}`, at: new Date(at).toISOString(), ch: `YouTube: ${video.ch}`, x, v: 0, c: 1 });
    }
    return v;
  });
  return out;
}

async function get(url: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const r = await fetch(url, { ...init, headers: { "user-agent": UA, "accept-language": "en", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
    if (r.ok) return r;
    await r.body?.cancel().catch(() => {});
  } catch {
    // Nothing from this one.
  }
  return null;
}

async function youtube(terms: string[], from: number, to: number, now: number): Promise<MoodPost[]> {
  const vids = new Map<string, YtVideo>();
  // One search and three videos an event: the server is small (27 Oct).
  for (const t of terms.slice(0, 1)) {
    const r = await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(t)}&sp=CAI%3D&hl=en`);
    if (r) for (const v of parseYtSearch(await r.text(), now)) if (v.at >= from - 864e5 && v.at <= to) vids.set(v.id, v);
  }
  const top = [...vids.values()].sort((a, b) => b.views - a.views).slice(0, 3);
  const out: MoodPost[] = top.map((v) => ({ u: `https://www.youtube.com/watch?v=${v.id}`, at: new Date(v.at).toISOString(), ch: `YouTube: ${v.ch}`, x: cut(v.title, 300), v: v.views }));
  for (const v of top) {
    const page = await get(`https://www.youtube.com/watch?v=${v.id}&hl=en`);
    const html = page ? await page.text() : "";
    const ver = /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/.exec(html)?.[1];
    // The last "watch next" call on the page is the comments section's.
    const token = [...html.matchAll(/"continuationCommand":\{"token":"([^"]+)","request":"CONTINUATION_REQUEST_TYPE_WATCH_NEXT"/g)].pop()?.[1];
    if (!ver || !token) continue;
    const r = await get("https://www.youtube.com/youtubei/v1/next?prettyPrint=false", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: ver, hl: "en" } }, continuation: token }) });
    if (r) out.push(...parseYtComments(await r.json().catch(() => null), v, now).slice(0, 30));
  }
  return out;
}

type BskyPost = { uri?: string; indexedAt?: string; likeCount?: number; repostCount?: number; author?: { handle?: string }; record?: { text?: string; createdAt?: string } };
export function parseBsky(j: { posts?: BskyPost[] } | null): MoodPost[] {
  return (j?.posts ?? []).flatMap((p) => {
    const x = cut(String(p.record?.text ?? ""), 300);
    const rkey = String(p.uri ?? "").split("/").pop();
    const at = Date.parse(p.record?.createdAt ?? p.indexedAt ?? "");
    if (!x || !rkey || !p.author?.handle || !Number.isFinite(at)) return [];
    return [{ u: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`, at: new Date(at).toISOString(), ch: `Bluesky: ${p.author.handle}`, x, v: (p.likeCount ?? 0) * 20 + (p.repostCount ?? 0) * 40 }];
  });
}

export async function bluesky(terms: string[], from: number): Promise<MoodPost[]> {
  const out: MoodPost[] = [];
  for (const t of terms.slice(0, 2)) {
    const r = await get(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(t)}&sort=latest&limit=50&since=${new Date(from).toISOString()}`);
    if (r) out.push(...parseBsky(await r.json().catch(() => null)));
  }
  return out;
}

type FxPost = { url?: string; text?: string; created_at?: string; views?: number; likes?: number; author?: { screen_name?: string } };
let xCache: { at: number; posts: FxPost[] } = { at: 0, posts: [] };
/** The Palestinian X accounts' latest posts, read once per 10 minutes for every event. */
async function xTimelines(now: number): Promise<FxPost[]> {
  if (now - xCache.at < 10 * 60_000) return xCache.posts;
  const posts: FxPost[] = [];
  for (const h of PAL_X) {
    const r = await get(`https://api.fxtwitter.com/2/profile/${h}/statuses`, { headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)", accept: "application/json" } });
    const j = r ? ((await r.json().catch(() => null)) as { results?: FxPost[] } | null) : null;
    posts.push(...(j?.results ?? []));
  }
  xCache = { at: now, posts };
  return posts;
}
export function matchX(posts: FxPost[], terms: string[], from: number, to: number): MoodPost[] {
  return posts.flatMap((p) => {
    const at = Date.parse(p.created_at ?? "");
    const x = cut(String(p.text ?? ""), 300);
    if (!p.url || !x || !Number.isFinite(at) || at < from || at > to || !hits(x, terms)) return [];
    return [{ u: p.url, at: new Date(at).toISOString(), ch: `X: @${p.author?.screen_name ?? "?"}`, x, v: p.views ?? (p.likes ?? 0) * 30 }];
  });
}

/** Every web reaction found for an event's words, in its time. */
export async function webReactions(terms: string[], from: number, to: number, now = Date.now()): Promise<MoodPost[]> {
  const words = terms.filter(Boolean);
  if (!words.length) return [];
  const got = await Promise.allSettled([youtube(words, from, to, now), bluesky(words, from), xTimelines(now).then((p) => matchX(p, words, from, to))]);
  return got.flatMap((g) => (g.status === "fulfilled" ? g.value : []));
}
