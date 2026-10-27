/**
 * The mood monitor's reading (gaza-mood.ts): after each Gaza cycle, at most every 15 minutes, the biggest events of
 * the last day are followed: their town's channels and the main Palestinian channels searched for them on
 * Telegram's public pages (no account), the comments under the most-read posts, the emoji, and a model's read of
 * the reactions. Each event is read again while it is fresh (every 30 minutes for 3 hours, then every 90) for a day.
 */
import type { DeskStore } from "./desk/store.ts";
import { askChain, type ChainModel } from "./desk/models.ts";
import { gazaWords } from "./desk/gaza-words.ts";
import { type DeskCard, type MoodEvent, type MoodPost, type MoodRead, FIND_SYSTEM, MOOD_SYSTEM, arabicNames, channelsFor, cut, findPrompt, moodItems, moodPrompt, parseComments, parsePosts, pickEvents, readFound, readMood, stirring, sumReactions, watchChannels } from "./desk/gaza-mood.ts";
import { fetchText } from "./yemen-scan.server.ts";
import { webReactions } from "./desk/mood-web.ts";

export const MOOD_KEY = "gaza:mood";
const MOOD_LOCK = "gaza:mood-lock";
const H = 3600_000;
const EVERY_MS = 15 * 60_000;
const PER_RUN = 3;
const AT_ONCE = 5;
/** Events found from the reactions (the finder), and how often the channels' latest posts are read for them. */
const FOUND_KEY = "gaza:mood-found";
const FIND_EVERY = 30 * 60_000;
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
  const channels = channelsFor(ev);
  const from = Date.parse(ev.at) - H, to = Date.parse(ev.at) + 24 * H;
  const found = new Map<string, MoodPost>();
  // The town's and the main channels by every word; the many others by the first only (Telegram's pages are shared with the scan).
  const jobs = channels.flatMap((ch, i) => (i < 25 ? terms : terms.slice(0, 1)).map((t) => ({ ch, t })));
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
  await pool(posts.filter((p) => p.u.startsWith("https://t.me/")).sort((a, b) => b.v - a.v).slice(0, 15), async (p) => {
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

export async function runMood(store: DeskStore, now = Date.now()): Promise<number> {
  const prev = (await store.getJson<MoodStore>(MOOD_KEY)) ?? { at: "", events: [] };
  if (prev.at && now - Date.parse(prev.at) < EVERY_MS) return 0;
  // One reader at a time (27 Oct: two processes read the same event at once and the worse read was kept).
  const held = await store.getJson<{ at: number }>(MOOD_LOCK);
  if (held && now - held.at < 10 * 60_000) return 0;
  await store.putJson(MOOD_LOCK, { at: now });
  try {
    return await runMoodNow(store, prev, now);
  } finally {
    await store.putJson(MOOD_LOCK, { at: 0 }).catch(() => {});
  }
}

async function runMoodNow(store: DeskStore, prev: MoodStore, now: number): Promise<number> {
  const { reports } = await store.recentDesk(800, undefined, { events: false, desk: "gaza", floor: new Date(now - 26 * H).toISOString() });
  const picked = pickEvents(reports as unknown as DeskCard[], now);
  const found = await findEvents(store, picked, prev, now).catch((err) => { console.error("[mood] find", err instanceof Error ? err.message : err); return [] as MoodEvent[]; });
  const events = [...picked, ...found];
  const byFp = new Map(prev.events.map((e) => [e.fp, e]));
  // Kept for a day after the event, picked or not.
  const keep = prev.events.filter((e) => now - Date.parse(e.at) < 26 * H);
  const todo = events.filter((ev) => due(byFp.get(ev.fp), now)).slice(0, PER_RUN);
  let n = 0;
  for (const ev of todo) {
    try {
      const entry = await readEvent(ev, byFp.get(ev.fp), now);
      byFp.set(ev.fp, entry);
      n += 1;
      console.log(`[mood] ${cut(ev.headline, 70)}: ${entry.posts} posts, ${entry.comments} comments in ${entry.channels.length} channels; ${entry.read ? entry.read.mood.map((m) => `${m.k} ${m.w}%`).join(", ") : "no read yet"}`);
    } catch (err) {
      console.error("[mood]", err instanceof Error ? err.message : err);
    }
  }
  const out = [...new Map([...keep, ...[...byFp.values()].filter((e) => now - Date.parse(e.at) < 26 * H)].map((e) => [e.fp, byFp.get(e.fp) ?? e])).values()]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 30);
  await store.putJson(MOOD_KEY, { at: new Date(now).toISOString(), events: out } satisfies MoodStore);
  return n;
}

type FoundStore = { at: string; events: MoodEvent[] };

/**
 * Events found from the reactions (user, 27 Oct: "you find reactions and find events this way"): every half hour the
 * latest posts of every Palestinian channel the desk knows are read, the most-reacted grouped into events by a model,
 * and the ones not yet followed are followed for a day.
 */
async function findEvents(store: DeskStore, picked: MoodEvent[], prev: MoodStore, now: number): Promise<MoodEvent[]> {
  const had = (await store.getJson<FoundStore>(FOUND_KEY)) ?? { at: "", events: [] };
  const kept = had.events.filter((e) => now - Date.parse(e.at) < 24 * H);
  if (had.at && now - Date.parse(had.at) < FIND_EVERY) return kept;
  const posts: MoodPost[] = [];
  await pool(watchChannels(), async (ch) => {
    const html = await fetchText(`https://t.me/s/${ch.toLowerCase()}`, 12_000).catch(() => null);
    if (html) posts.push(...parsePosts(html, ch));
  });
  const top = stirring(posts, now);
  let fresh: MoodEvent[] = [];
  if (top.length >= 5) {
    const followed = [...new Set([...picked, ...kept, ...prev.events].map((e) => e.headline))].slice(0, 40);
    const got = await askChain("gaza-mood-find", FIND_SYSTEM, findPrompt(top, followed), { models: MODELS, timeoutMs: 90_000, temperature: 0.1, accept: (j) => (Array.isArray(j.events) ? null : "no events") }).catch(() => null);
    fresh = got ? readFound(got.json, top, gazaWords) : [];
  }
  const byFp = new Map(kept.map((e) => [e.fp, e]));
  for (const e of fresh) if (!byFp.has(e.fp)) byFp.set(e.fp, e);
  const out = [...byFp.values()].sort((a, b) => b.score - a.score).slice(0, 12);
  await store.putJson(FOUND_KEY, { at: new Date(now).toISOString(), events: out } satisfies FoundStore);
  console.log(`[mood] find: ${posts.length} posts in ${watchChannels().length} channels, ${top.length} most-reacted, ${fresh.length} events (${fresh.map((e) => cut(e.headline, 50)).join("; ")})`);
  return out;
}
