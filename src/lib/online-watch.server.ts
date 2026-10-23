/**
 * The Online watch's reading (user, 23 Oct): every watched channel's public page each 15 minutes, its new
 * posts tagged and kept by the hour for a day, each hour's counts kept for 8 days, and the tab's summary
 * written after each read. No model reads these posts: the counts are cheap enough to run all day.
 */
import type { DeskStore } from "./desk/store.ts";
import { WATCH_TG } from "./desk/online-sources.ts";
import { type HourCounts, type WatchPost, countHour, parseWatchPage, summarise } from "./desk/online-watch.ts";
import { fetchText } from "./yemen-scan.server.ts";

export const WATCH_HOURS = "gaza:online:h";
export const WATCH_COUNTS = "gaza:online-counts";
export const WATCH_SUMMARY = "gaza:online-summary";
const WATCH_STATE = "gaza:online-state";
const EVERY_MS = 15 * 60_000;
const AT_ONCE = 4;
const H = 3600_000;
const hourKey = (t: number) => new Date(Math.floor(t / H) * H).toISOString().slice(0, 13);

type State = { lastAt: Record<string, number>; lastPost: Record<string, number> };

export async function runOnlineWatch(store: DeskStore, now = Date.now()): Promise<{ read: number; posts: number }> {
  const state: State = { lastAt: {}, lastPost: {}, ...((await store.getJson<State>(WATCH_STATE)) ?? {}) };
  // A third of the channels each 5-minute tick, so each is read every 15 minutes and Telegram sees a steady pace.
  const due = WATCH_TG.filter((c) => now - (state.lastAt[c.id] ?? 0) >= EVERY_MS - 60_000).slice(0, Math.ceil(WATCH_TG.length / 3) + 5);
  const fresh: WatchPost[] = [];
  let next = 0;
  let read = 0;
  await Promise.allSettled(
    Array.from({ length: AT_ONCE }, async () => {
      while (next < due.length) {
        const c = due[next++];
        const html = await fetchText(`https://t.me/s/${c.id}`, 12_000).catch(() => null);
        state.lastAt[c.id] = Date.now();
        if (!html || !html.includes("tgme_widget_message")) continue;
        read += 1;
        const seen = state.lastPost[c.id] ?? 0;
        const posts = parseWatchPage(html, c);
        const no = (p: WatchPost) => Number(/\/(\d+)$/.exec(p.u)?.[1] ?? 0);
        // First sight of a channel: its last day only.
        fresh.push(...posts.filter((p) => (seen ? no(p) > seen : Date.parse(p.at) > now - 24 * H)));
        state.lastPost[c.id] = Math.max(seen, ...posts.map(no));
      }
    }),
  );
  // Into the hour rows, each post once.
  const byHour = new Map<string, WatchPost[]>();
  for (const p of fresh) {
    const k = hourKey(Date.parse(p.at));
    (byHour.get(k) ?? byHour.set(k, []).get(k)!).push(p);
  }
  const counts = (await store.getJson<Record<string, HourCounts>>(WATCH_COUNTS)) ?? {};
  if (byHour.size) {
    const had = await store.getMany<WatchPost[]>(WATCH_HOURS, [...byHour.keys()]);
    const write: Record<string, WatchPost[]> = {};
    for (const [k, ps] of byHour) {
      const old = had[k] ?? [];
      const urls = new Set(old.map((p) => p.u));
      const all = [...old, ...ps.filter((p) => !urls.has(p.u))];
      write[k] = all;
      counts[k] = countHour(all);
    }
    await store.putMany(WATCH_HOURS, write);
  }
  // Counts for 8 days; posts for a day and a bit.
  for (const k of Object.keys(counts)) if (Date.parse(`${k}:00:00Z`) < now - 8 * 24 * H) delete counts[k];
  await store.putJson(WATCH_COUNTS, counts);
  await store.putJson(WATCH_STATE, state);
  await store.prune(WATCH_HOURS, 30 * H).catch(() => 0);
  const keys = Array.from({ length: 25 }, (_, i) => hourKey(now - i * H));
  const rows = await store.getMany<WatchPost[]>(WATCH_HOURS, keys);
  const posts = Object.values(rows).flat();
  await store.putJson(WATCH_SUMMARY, summarise(posts, counts, now, 3, WATCH_TG.length));
  console.log(`[online] ${read} of ${due.length} channels read, ${fresh.length} new posts, ${posts.length} in the last day`);
  return { read, posts: fresh.length };
}
