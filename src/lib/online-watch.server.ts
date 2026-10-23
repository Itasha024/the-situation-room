/**
 * The Online watch's reading (user, 23 Oct): every watched channel's public page each 15 minutes, its new
 * posts tagged and kept by the hour for a day, each hour's counts kept for 8 days, and the tab's summary
 * written after each read. The comments under the posts come from Telegram's public comments widget: the
 * talk in the channels' discussion groups, read without an account. No model reads any of it: the counts
 * are cheap enough to run all day.
 */
import type { DeskStore } from "./desk/store.ts";
import { WATCH_TG } from "./desk/online-sources.ts";
import { type HourCounts, type WatchPost, countHour, parseComments, parseWatchPage, summarise } from "./desk/online-watch.ts";
import { fetchText } from "./yemen-scan.server.ts";
import { type Briefs, writeBriefs } from "./desk/online-brief.ts";
import { CLASSIFY_BATCH, classifyBatch } from "./desk/online-classify.ts";
import { type SweepState, sweep } from "./online-search.server.ts";

export const WATCH_HOURS = "gaza:online:h";
export const WATCH_COUNTS = "gaza:online-counts";
export const WATCH_SUMMARY = "gaza:online-summary";
const WATCH_STATE = "gaza:online-state";
const WATCH_BRIEFS = "gaza:online-briefs";
// Briefs every 3 hours; the messages themselves come in live (user, 23 Oct).
const BRIEF_EVERY_MS = 3 * 3600_000;
const EVERY_MS = 10 * 60_000;
const AT_ONCE = 4;
const H = 3600_000;
/** Comment threads read a tick, and how often one post's thread is read again. */
// (23 Oct: 45 a tick left 166 channels untried after a day; the server's load stays low.)
const THREADS_PER_TICK = 140;
const TRIES_PER_TICK = 60;
const THREAD_AGAIN_MS = 60 * 60_000;
/** Posts and comments the model sorts a tick, newest first. */
const SORT_PER_TICK = 4 * CLASSIFY_BATCH;
const hourKey = (t: number) => new Date(Math.floor(t / H) * H).toISOString().slice(0, 13);

type State = {
  lastAt: Record<string, number>;
  lastPost: Record<string, number>;
  /** Per channel: comments found under its posts (yes), tries without any, when last tried. */
  talk?: Record<string, { yes: number; tries: number; at: number }>;
  /** When each post's thread was last read. */
  threadAt?: Record<string, number>;
  /** The keyword sweep's turn: when each search last ran. */
  sweep?: SweepState;
};

async function pool<T>(items: T[], run: (x: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.allSettled(Array.from({ length: AT_ONCE }, async () => {
    while (next < items.length) await run(items[next++]);
  }));
}

export async function runOnlineWatch(store: DeskStore, now = Date.now()): Promise<{ read: number; posts: number; comments: number }> {
  const state: State = { lastAt: {}, lastPost: {}, ...((await store.getJson<State>(WATCH_STATE)) ?? {}) };
  const talk = (state.talk ??= {});
  const threadAt = (state.threadAt ??= {});
  // Half the channels each 5-minute tick, so each is read every 10 minutes and Telegram sees a steady pace.
  const due = WATCH_TG.filter((c) => now - (state.lastAt[c.id] ?? 0) >= EVERY_MS - 60_000).slice(0, Math.ceil(WATCH_TG.length / 2) + 5);
  const fresh: WatchPost[] = [];
  let read = 0;
  await pool(due, async (c) => {
    const html = await fetchText(`https://t.me/s/${c.id}`, 12_000).catch(() => null);
    state.lastAt[c.id] = Date.now();
    if (!html || !html.includes("tgme_widget_message")) return;
    read += 1;
    const seen = state.lastPost[c.id] ?? 0;
    const posts = parseWatchPage(html, c);
    const no = (p: WatchPost) => Number(/\/(\d+)$/.exec(p.u)?.[1] ?? 0);
    // First sight of a channel: its last day only.
    fresh.push(...posts.filter((p) => (seen ? no(p) > seen : Date.parse(p.at) > now - 24 * H)));
    state.lastPost[c.id] = Math.max(seen, ...posts.map(no));
  });

  const counts = (await store.getJson<Record<string, HourCounts>>(WATCH_COUNTS)) ?? {};
  const keys = Array.from({ length: 26 }, (_, i) => hourKey(now - i * H));
  const rows: Record<string, WatchPost[]> = await store.getMany<WatchPost[]>(WATCH_HOURS, keys);
  const touched = new Set<string>();
  const add = (ps: WatchPost[]) => {
    for (const p of ps) {
      const k = hourKey(Date.parse(p.at));
      const row = (rows[k] ??= []);
      if (row.some((q) => q.u === p.u)) continue;
      row.push(p);
      touched.add(k);
    }
  };
  add(fresh);

  // The comments: posts 20 minutes to 12 hours old, from channels whose posts get comments (or not yet known),
  // the most-read first; a channel tried three times without one is tried again after a week.
  const byCh = new Map(WATCH_TG.map((c) => [c.id, c]));
  const open = (id: string) => { const t = talk[id]; return !t || t.yes > 0 || t.tries < 3 || now - t.at > 7 * 24 * H; };
  const cands = Object.values(rows).flat()
    .filter((p) => !p.c && byCh.has(p.ch) && open(p.ch) && now - Date.parse(p.at) > 20 * 60_000 && now - Date.parse(p.at) < 12 * H && now - (threadAt[p.u] ?? 0) > THREAD_AGAIN_MS)
    .sort((a, b) => +((talk[b.ch]?.yes ?? 0) > 0) - +((talk[a.ch]?.yes ?? 0) > 0) || b.v - a.v);
  // One unknown channel tried once a tick, so a channel without comments costs little.
  const tried = new Set<string>();
  // Channels known to have comments, and up to TRIES_PER_TICK channels not yet known, one post each.
  const known = cands.filter((p) => (talk[p.ch]?.yes ?? 0) > 0).slice(0, THREADS_PER_TICK - TRIES_PER_TICK);
  const trying = cands.filter((p) => !((talk[p.ch]?.yes ?? 0) > 0) && !tried.has(p.ch) && tried.add(p.ch)).slice(0, TRIES_PER_TICK);
  const picks = [...known, ...trying];
  const comments: WatchPost[] = [];
  await pool(picks, async (p) => {
    const html = await fetchText(`${p.u}?embed=1&discussion=1&comments_limit=50`, 12_000).catch(() => null);
    threadAt[p.u] = Date.now();
    if (!html) return;
    const cs = parseComments(html, byCh.get(p.ch)!, p.u);
    const t = (talk[p.ch] ??= { yes: 0, tries: 0, at: 0 });
    t.at = Date.now();
    if (cs.length) t.yes += 1;
    else if (!t.yes) t.tries += 1;
    comments.push(...cs);
  });
  add(comments);

  // The keyword sweep on the other platforms (user, 23 Oct): a few of its hundreds of searches each tick.
  let swept = 0;
  try {
    const { found } = await sweep((state.sweep ??= {}), now);
    add(found);
    swept = found.length;
  } catch (err) {
    console.error("[online] sweep:", err instanceof Error ? err.message : err);
  }

  // The model sorts what it has not read yet: news, a notice or talk, and talk's kinds (user, 23 Oct).
  const unsorted = Object.values(rows).flat().filter((p) => !p.q && now - Date.parse(p.at) < 12 * H).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, SORT_PER_TICK);
  let sorted = 0;
  for (let i = 0; i < unsorted.length; i += CLASSIFY_BATCH) {
    const batch = unsorted.slice(i, i + CLASSIFY_BATCH);
    const n = await classifyBatch(batch).catch(() => 0);
    if (!n) break;
    sorted += n;
    for (const p of batch) if (p.q) touched.add(hourKey(Date.parse(p.at)));
  }
  for (const [u, t] of Object.entries(threadAt)) if (now - t > 30 * H) delete threadAt[u];

  if (touched.size) {
    const write: Record<string, WatchPost[]> = {};
    for (const k of touched) {
      write[k] = rows[k];
      counts[k] = countHour(rows[k]);
    }
    await store.putMany(WATCH_HOURS, write);
  }
  // Counts for 8 days; posts for a day and a bit.
  for (const k of Object.keys(counts)) if (Date.parse(`${k}:00:00Z`) < now - 8 * 24 * H) delete counts[k];
  await store.putJson(WATCH_COUNTS, counts);
  await store.putJson(WATCH_STATE, state);
  await store.prune(WATCH_HOURS, 30 * H).catch(() => 0);
  const posts = keys.slice(0, 25).flatMap((k) => rows[k] ?? []);
  // The last 3 hours, and the last day (user, 23 Oct: the 3 hours alone looked empty).
  const day = summarise(posts, counts, now, 24, WATCH_TG.length).areas;
  const recent = summarise(posts, counts, now, 3, WATCH_TG.length);
  // Each kind of talk briefed in a few sentences, and the whole day (user, 23 Oct).
  let briefs = await store.getJson<Briefs>(WATCH_BRIEFS);
  if (!briefs || now - Date.parse(briefs.at) > BRIEF_EVERY_MS) {
    try {
      briefs = await writeBriefs(recent.areas, day, briefs, now);
      await store.putJson(WATCH_BRIEFS, briefs);
    } catch (err) {
      console.error('[online] briefs:', err instanceof Error ? err.message : err);
    }
  }
  await store.putJson(WATCH_SUMMARY, { ...recent, day, briefs });
  const withTalk = Object.values(talk).filter((t) => t.yes > 0).length;
  console.log(`[online] ${read} of ${due.length} channels read, ${fresh.length} new posts; ${picks.length} comment threads read, ${comments.length} comments (${withTalk} channels with comments); ${sorted} sorted by the model; ${swept} found by the keyword sweep; ${posts.length} in the last day`);
  return { read, posts: fresh.length, comments: comments.length };
}
