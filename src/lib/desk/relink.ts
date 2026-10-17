/**
 * Cards stored under a Google News link get their article's own, server-only.
 *
 * A Google item the scan could not resolve in time goes on under Google's
 * redirect rather than be missed (yemen-scan.server.ts, GNEWS_HOLD_TRIES), and
 * stayed there: 388 cards by 18 Oct, each naming "Google News" or linking a
 * page that sends readers to a robot check. Each tick a few are resolved, the
 * newest first, and the card and its pins take the article's address and its
 * outlet's name. Google's budget is shared (gnews.ts): a card of the last six
 * hours spends at "card" need, an older one only what is left over.
 */

import type { DeskStore } from "./store.ts";
import { type ResolveNeed, canResolve, cleanUrl, knownResolve, outletFromHost, resolveGoogleNews } from "./gnews.ts";

/** fp → failed look-ups, so a link Google no longer knows does not hold the queue. */
export const RELINK_KEY = "gnews-relink";
/** Look-ups a tick at most, whatever the budget has left. */
export const RELINK_PER_TICK = 3;
const RELINK_TRIES = 3;
const FRESH_MS = 6 * 3600_000;
/** Cards read from the store a tick: the queue's head. */
const QUEUE = 60;

export type RelinkDeps = {
  resolve: (link: string, need: ResolveNeed) => Promise<string>;
  can: (need: ResolveNeed) => boolean;
  known: (link: string) => string;
};

const DEFAULT_DEPS: RelinkDeps = { resolve: resolveGoogleNews, can: canResolve, known: knownResolve };

/** The outlet a relinked card names: its own unless that was Google. */
export function relinkedSource(source: string, url: string): string {
  return !source || /^google news$/i.test(source.trim()) ? outletFromHost(url) || source : source;
}

/** Relinks a few stored cards; returns how many moved to their article's address. */
export async function relinkStoredCards(store: DeskStore, now = Date.now(), deps: RelinkDeps = DEFAULT_DEPS, perTick = RELINK_PER_TICK): Promise<number> {
  if (!store.gnewsLinks || !store.relink) return 0;
  const tries = (await store.getJson<Record<string, number>>(RELINK_KEY)) ?? {};
  const rows = await store.gnewsLinks(QUEUE, Object.keys(tries).filter((fp) => tries[fp] >= RELINK_TRIES));
  if (!rows.length) return 0;
  let dirty = false;
  let moved = 0;
  let spent = 0;
  for (const r of rows) {
    if ((tries[r.fp] ?? 0) >= RELINK_TRIES) continue;
    const need: ResolveNeed = now - Date.parse(r.at) < FRESH_MS ? "card" : "backlog";
    let real = deps.known(r.url);
    if (!real) {
      if (spent >= perTick || !deps.can(need)) continue;
      spent += 1;
      real = await deps.resolve(r.url, need);
    }
    if (!real) {
      // Google's rest began on this look-up: not the link's fault.
      if (!deps.can(need)) continue;
      tries[r.fp] = (tries[r.fp] ?? 0) + 1;
      dirty = true;
      continue;
    }
    const url = cleanUrl(real);
    if (await store.relink(r.fp, url, relinkedSource(r.source, url))) moved += 1;
    else {
      tries[r.fp] = RELINK_TRIES;
      dirty = true;
    }
  }
  if (dirty) await store.putJson(RELINK_KEY, tries);
  return moved;
}
