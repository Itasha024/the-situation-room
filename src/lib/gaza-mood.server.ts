/**
 * The mood monitor's reading (gaza-mood.ts; user, 27 Oct: "reflect the mood across time … just when something bigger
 * happens that creates a lot of traffic"). Every hour, while the server is not throttled: every Palestinian channel's
 * latest page read once (Telegram's public pages, no account); the general mood of the last 3 hours read from them and
 * the comments under the most-read, kept as a two-day series; and the spikes (events told by many channels or drawing
 * a large share of the stir) each followed on its own: its words searched in the channels, YouTube, Bluesky and X.
 */
import type { DeskStore } from "./desk/store.ts";
import { askChain, type ChainModel } from "./desk/models.ts";
import { gazaWords } from "./desk/gaza-words.ts";
import { type GeneralMood, type MoodEvent, type MoodPost, type MoodRead, DAY_SYSTEM, FIND_SYSTEM, GENERAL_SYSTEM, MOOD_SYSTEM, addPoint, keywordBatch, arabicNames, channelsFor, cut, findPrompt, generalPrompt, isSpike, moodItems, moodPrompt, parseComments, parsePosts, readFound, readMood, stirOf, stirring, sumReactions, watchChannels } from "./desk/gaza-mood.ts";
import { fetchText } from "./yemen-scan.server.ts";
import { bluesky, webReactions } from "./desk/mood-web.ts";

export const MOOD_KEY = "gaza:mood";
const MOOD_LOCK = "gaza:mood-lock";
const H = 3600_000;
// Light on purpose (27 Oct: the mood reads on top of the scans had the small server throttled and the site down).
const EVERY_MS = 60 * 60_000;
const PER_RUN = 2;
const AT_ONCE = 3;
/** Channels searched per event: the town's, the main ones, then the rest of the Palestinian ones up to this. */
const CHANNELS_PER_EVENT = 30;
/** Events found from the reactions (the finder), and how often the channels' latest posts are read for them. */
const FOUND_KEY = "gaza:mood-found";
/** The general mood, and the hours each of its reads covers. */
export const GENERAL_KEY = "gaza:mood-general";
const GENERAL_HOURS = 3;
const MODELS: ChainModel[] = [
  { provider: "nvidia", id: "nvidia/nemotron-3-ultra-550b-a55b" },
  { provider: "nvidia", id: "minimaxai/minimax-m3.1-flash" },
  { provider: "kilo", id: "nvidia/nemotron-3-ultra-550b-a55b:free" },
  { provider: "nvidia", id: "nvidia/nemotron-3.5-lightning-30b-a3b" },
];

export type MoodEntry = MoodEvent & {
  terms: string[];
  firstAt: string;
  readAt: string;
  reads: number;
  posts: number;
  comments: number;
  channels: string[];
  reactions: ReturnType<typeof sumReactions>;
  read: MoodRead | null;
};
export type MoodStore = { at: string; events: MoodEntry[] };

async function pool<T>(items: T[], run: (x: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.allSettled(Array.from({ length: AT_ONCE }, async () => {
    while (next < items.length) await run(items[next++]);
  }));
}

/** Search words for an event with no place (a decision, a law): the words Palestinian channels would use. */
async function termsOf(ev: MoodEvent): Promise<string[]> {
  const names = arabicNames(ev.place);
  if (names.length >= 2) return names;
  // Words few other posts use (user, 27 Oct: "Gaza" alone found the whole day's news).
  const got = await askChain("gaza-mood-terms", 'Give 1 or 2 short Arabic search words (one to three words each) that Palestinian Telegram channels would surely use when they write about THIS event and few others: the exact village, camp, neighbourhood or landmark, a family or a person named, the law or decision by its name. Never a whole city, "Gaza" or "the West Bank" alone. JSON only: {"terms": ["..."]}', `${ev.headline}${ev.place ? ` (place: ${ev.place})` : ""}`, { models: MODELS, timeoutMs: 45_000, temperature: 0, accept: (j) => (Array.isArray(j.terms) && j.terms.length ? null : "no terms") }).catch(() => null);
  const more = ((got?.json.terms as unknown[]) ?? []).map(String).map((t) => t.trim()).filter((t) => /[؀-ۿ]/.test(t) && t.length <= 30 && !/^(?:غزة|قطاع غزة|الضفة|الضفة الغربية)$/.test(t));
  return [...new Set([...names, ...more])].slice(0, 2);
}

async function readEvent(ev: MoodEvent, had: MoodEntry | undefined, now: number): Promise<MoodEntry> {
  // Words that found little are asked for again.
  const terms = had?.terms?.length && had.posts >= 3 ? had.terms : ev.terms?.length ? ev.terms : await termsOf(ev);
  const channels = channelsFor(ev).slice(0, CHANNELS_PER_EVENT);
  const from = Date.parse(ev.at) - H, to = Date.parse(ev.at) + 24 * H;
  const found = new Map<string, MoodPost>();
  // The town's and the main channels by every word; the many others by the first only (Telegram's pages are shared with the scan).
  const jobs = channels.flatMap((ch, i) => (i < 12 ? terms : terms.slice(0, 1)).map((t) => ({ ch, t })));
  await pool(jobs, async ({ ch, t }) => {
    // The handle in small letters: Telegram's search page answers it (the other spelling redirects first).
    const html = await fetchText(`https://t.me/s/${ch.toLowerCase()}?q=${encodeURIComponent(t)}`, 12_000).catch(() => null);
    if (!html) return;
    for (const p of parsePosts(html, ch)) {
      const at = Date.parse(p.at);
      if (at >= from && at <= to && !found.has(p.u)) found.set(p.u, p);
    }
  });
  // The posts the finder found the event by.
  for (const p of ev.seed ?? []) if (!found.has(p.u)) found.set(p.u, p);
  // The same words on YouTube (videos and their comments), Bluesky and the Palestinian X accounts (mood-web.ts).
  const web = await webReactions(terms, from, Math.min(to, now), now).catch(() => [] as MoodPost[]);
  const comments: MoodPost[] = web.filter((p) => p.c);
  for (const p of web) if (!p.c && !found.has(p.u)) found.set(p.u, p);
  const posts = [...found.values()];
  // The comments under the most-read Telegram posts (only channels with a public discussion group have any).
  await pool(posts.filter((p) => p.u.startsWith("https://t.me/")).sort((a, b) => b.v - a.v).slice(0, 8), async (p) => {
    const html = await fetchText(`${p.u}?embed=1&discussion=1&comments_limit=40`, 12_000).catch(() => null);
    if (html) comments.push(...parseComments(html, p.ch));
  });
  const all = [...posts, ...comments];
  const items = moodItems(all);
  let read: MoodRead | null = had?.read ?? null;
  // A new read only when there is something new to read.
  if (items.length >= 3 && (!had || all.length !== had.posts + had.comments)) {
    const got = await askChain("gaza-mood", MOOD_SYSTEM, moodPrompt(ev, items), { models: MODELS, timeoutMs: 90_000, temperature: 0.1, accept: (j) => (typeof j.about === "boolean" ? null : "no about") }).catch(() => null);
    const r = got ? readMood(got.json, items, gazaWords) : null;
    if (r) read = r;
  }
  const { seed: _seed, ...plain } = ev;
  return {
    ...plain,
    headline: gazaWords(ev.headline),
    terms,
    firstAt: had?.firstAt ?? new Date(now).toISOString(),
    readAt: new Date(now).toISOString(),
    reads: (had?.reads ?? 0) + 1,
    posts: posts.length,
    comments: comments.length,
    channels: [...new Set(all.map((p) => p.ch))],
    // The emoji under the posts the model found about this event; before its first read, under all found.
    reactions: read?.rel?.length ? sumReactions(read.rel.map((i) => items[i]).filter((p) => p && !p.c)) : had?.reactions ?? sumReactions(posts),
    read,
  };
}

const due = (e: MoodEntry | undefined, now: number) => !e || now - Date.parse(e.readAt) >= (now - Date.parse(e.at) < 3 * H ? 30 : 90) * 60_000;

/** True when the server is throttled: a loop of a few milliseconds takes many times that (vm-cpu-throttle). */
function cpuSlow(): boolean {
  const t = performance.now();
  let x = 0;
  for (let i = 0; i < 3e6; i++) x += i;
  return x > 0 && performance.now() - t > 150;
}

export async function runMood(store: DeskStore, now = Date.now()): Promise<number> {
  const prev = (await store.getJson<MoodStore>(MOOD_KEY)) ?? { at: "", events: [] };
  if (prev.at && now - Date.parse(prev.at) < EVERY_MS) return 0;
  // The reactions wait while the server is slow: the site comes first.
  if (cpuSlow()) {
    console.log("[mood] skipped: the server is slow");
    return 0;
  }
  // One reader at a time (27 Oct: two processes read the same event at once and the worse read was kept).
  const held = await store.getJson<{ at: number }>(MOOD_LOCK);
  if (held && now - held.at < 10 * 60_000) return 0;
  await store.putJson(MOOD_LOCK, { at: now });
  try {
    return await runMoodNow(store, prev, now);
  } finally {
    // A pause set by hand (a time far ahead) stays.
    const still = await store.getJson<{ at: number }>(MOOD_LOCK).catch(() => null);
    if (!still || still.at <= now) await store.putJson(MOOD_LOCK, { at: 0 }).catch(() => {});
  }
}

/** Every Palestinian channel's latest page, read once a run (no account: Telegram's public pages). */
async function latestPosts(): Promise<MoodPost[]> {
  const posts: MoodPost[] = [];
  await pool(watchChannels(), async (ch) => {
    const html = await fetchText(`https://t.me/s/${ch.toLowerCase()}`, 12_000).catch(() => null);
    if (html) posts.push(...parsePosts(html, ch));
  });
  return posts;
}

/**
 * The general mood (user, 27 Oct: "reflect the mood across time"): the last GENERAL_HOURS of every channel, the
 * comments under the most-read posts, one read; a point added to the two-day series.
 */
async function readGeneral(store: DeskStore, posts: MoodPost[], now: number): Promise<void> {
  const fresh = posts.filter((p) => {
    const t = Date.parse(p.at);
    return t <= now && now - t < GENERAL_HOURS * H;
  });
  const own = fresh.slice().sort((a, b) => stirOf(b) - stirOf(a));
  const comments: MoodPost[] = [];
  await pool(own.slice(0, 8), async (p) => {
    const html = await fetchText(`${p.u}?embed=1&discussion=1&comments_limit=40`, 12_000).catch(() => null);
    if (html) comments.push(...parseComments(html, p.ch));
  });
  // The keyword searches on the other platforms, a new batch every hour (keywordBatch); two words a call.
  const words = keywordBatch(now);
  const web: MoodPost[] = [];
  for (let i = 0; i < words.length; i += 2) web.push(...(await bluesky(words.slice(i, i + 2), now - GENERAL_HOURS * H).catch(() => [] as MoodPost[])));
  const webSeen = new Set<string>();
  const webFresh = web.filter((p) => !webSeen.has(p.u) && (webSeen.add(p.u), true)).sort((a, b) => b.v - a.v);
  const items = [...own.slice(0, 40), ...webFresh.slice(0, 15), ...comments.slice(0, 30)];
  const had = (await store.getJson<GeneralMood>(GENERAL_KEY)) ?? { at: "", hours: GENERAL_HOURS, read: null, posts: 0, comments: 0, channels: 0, series: [] };
  let read: MoodRead | null = null;
  if (items.length >= 8) {
    const got = await askChain("gaza-mood-general", GENERAL_SYSTEM, generalPrompt(items, GENERAL_HOURS), { models: MODELS, timeoutMs: 90_000, temperature: 0.1, accept: (j) => (typeof j.about === "boolean" ? null : "no about") }).catch(() => null);
    read = got ? readMood(got.json, items, gazaWords) : null;
  }
  const channels = new Set(fresh.map((p) => p.ch.toLowerCase())).size;
  const at = new Date(now).toISOString();
  const point = read?.about
    ? { at, mood: read.mood, intensity: read.intensity, posts: fresh.length + webFresh.length, comments: comments.length, channels, summary: read.summary, quotes: read.quotes.slice(0, 3), calls: read.calls.slice(0, 3) }
    : null;
  const series = point ? addPoint(had.series, point, now) : had.series.filter((x) => now - Date.parse(x.at) < 48 * H);
  // The day's line, every 3 hours, from the hours' lines (text only: a small call).
  let day = had.day;
  if (point && (!day || now - Date.parse(day.at) >= 3 * H)) {
    const notes = series.filter((x) => now - Date.parse(x.at) < 24 * H && x.summary).map((x) => `${x.at.slice(11, 16)} UTC: ${x.summary}`);
    const got = notes.length ? await askChain("gaza-mood-day", DAY_SYSTEM, notes.join("\n"), { models: MODELS, timeoutMs: 60_000, temperature: 0.1, accept: (j) => (typeof j.summary === "string" && j.summary.trim() ? null : "no summary") }).catch(() => null) : null;
    if (got) day = { at, summary: gazaWords(String(got.json.summary).trim()) };
  }
  const out: GeneralMood = point
    ? { at, hours: GENERAL_HOURS, read, posts: fresh.length + webFresh.length, comments: comments.length, channels, series, day, searched: { terms: words.length, found: webFresh.length } }
    : { ...had, series, day };
  await store.putJson(GENERAL_KEY, out);
  console.log(`[mood] general: ${fresh.length} posts, ${webFresh.length} from ${words.length} searches, ${comments.length} comments in ${channels} channels; ${read?.about ? read.mood.map((m) => `${m.k} ${m.w}%`).join(", ") : "no read"}`);
}

async function runMoodNow(store: DeskStore, prev: MoodStore, now: number): Promise<number> {
  const posts = await latestPosts();
  await readGeneral(store, posts, now).catch((err) => console.error("[mood] general", err instanceof Error ? err.message : err));
  // Only the spikes get a reading of their own (no review per report).
  const spikes = await findSpikes(store, posts, prev, now).catch((err) => {
    console.error("[mood] find", err instanceof Error ? err.message : err);
    return [] as MoodEvent[];
  });
  const byFp = new Map(prev.events.map((e) => [e.fp, e]));
  const todo = spikes.filter((ev) => due(byFp.get(ev.fp), now)).slice(0, PER_RUN);
  let n = 0;
  for (const ev of todo) {
    try {
      const entry = await readEvent(ev, byFp.get(ev.fp), now);
      byFp.set(ev.fp, entry);
      n += 1;
      console.log(`[mood] spike ${cut(ev.headline, 70)}: ${entry.posts} posts, ${entry.comments} comments in ${entry.channels.length} channels; ${entry.read ? entry.read.mood.map((m) => `${m.k} ${m.w}%`).join(", ") : "no read yet"}`);
    } catch (err) {
      console.error("[mood]", err instanceof Error ? err.message : err);
    }
  }
  // The spikes of the last day.
  const live = new Set(spikes.map((e) => e.fp));
  const out = [...byFp.values()]
    .filter((e) => live.has(e.fp) && now - Date.parse(e.at) < 26 * H)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 12);
  await store.putJson(MOOD_KEY, { at: new Date(now).toISOString(), events: out } satisfies MoodStore);
  return n;
}

type FoundStore = { at: string; events: MoodEvent[] };

/**
 * The spikes (user, 27 Oct: "just when something bigger happens that creates a lot of traffic"): the most-reacted
 * posts of the hours read grouped into events by a model, and only those told by many channels or drawing a large
 * share of all the stir kept, for a day.
 */
async function findSpikes(store: DeskStore, posts: MoodPost[], prev: MoodStore, now: number): Promise<MoodEvent[]> {
  const had = (await store.getJson<FoundStore>(FOUND_KEY)) ?? { at: "", events: [] };
  const kept = had.events.filter((e) => now - Date.parse(e.at) < 24 * H && e.spike);
  const top = stirring(posts, now);
  let fresh: MoodEvent[] = [];
  if (top.length >= 5) {
    const followed = [...new Set([...kept, ...prev.events].map((e) => e.headline))].slice(0, 40);
    const got = await askChain("gaza-mood-find", FIND_SYSTEM, findPrompt(top, followed), { models: MODELS, timeoutMs: 90_000, temperature: 0.1, accept: (j) => (Array.isArray(j.events) ? null : "no events") }).catch(() => null);
    fresh = (got ? readFound(got.json, top, gazaWords) : []).filter((e) => isSpike(e.seed ?? [], posts)).map((e) => ({ ...e, spike: 1 as const }));
  }
  const byFp = new Map(kept.map((e) => [e.fp, e]));
  for (const e of fresh) if (!byFp.has(e.fp)) byFp.set(e.fp, e);
  const out = [...byFp.values()].sort((a, b) => b.score - a.score).slice(0, 8);
  await store.putJson(FOUND_KEY, { at: new Date(now).toISOString(), events: out } satisfies FoundStore);
  console.log(`[mood] spikes: ${posts.length} posts in ${watchChannels().length} channels, ${top.length} most-reacted, ${fresh.length} new spikes (${fresh.map((e) => cut(e.headline, 50)).join("; ")})`);
  return out;
}
