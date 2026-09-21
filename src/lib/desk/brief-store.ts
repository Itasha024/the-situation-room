/**
 * The stored 12-hour brief. Server-only.
 *
 * WHY THIS EXISTS: the brief used to be built inside the `/api/brief` route,
 * on the first page view after a window closed. Two things followed from that:
 *
 *   1. With nobody visiting, no brief was built — the general status, fronts
 *      and numbers only moved when a browser asked, and a window nobody looked
 *      at left no history, so the next brief compared itself against whatever
 *      stale window happened to be stored.
 *   2. It counted `scan.reports` — the LAST CYCLE's reports only — so "the 12
 *      hours to 12:00" really meant "the last five minutes before someone
 *      opened the page".
 *
 * Now the clock builds it (`runScanCycle` calls `refreshBrief` every tick; it
 * is a no-op until a window closes), from everything the desk accumulated in
 * the window. The route only reads.
 */

import type { LiveReport } from "./types.ts";
import { type Brief, type BriefHistory, buildBrief, briefWindow } from "./brief.ts";
import type { DeskStore } from "./store.ts";
import { refreshTally } from "./tally.ts";

export const BRIEF_KEY = "brief";

export type StoredBrief = { brief: Brief; history: BriefHistory };

/** Enough rows to cover a busy 12-hour window with the caps raised. */
const WINDOW_ROWS = 3000;

/**
 * Return the brief for the current window, building and storing it first if
 * the stored one belongs to an earlier window. Safe to call every tick.
 */
export async function refreshBrief(
  store: DeskStore,
  now = new Date(),
): Promise<{ brief: Brief; built: boolean }> {
  const w = briefWindow(now);
  const saved = (await store.getJson<StoredBrief>(BRIEF_KEY)) ?? null;
  if (saved?.brief?.updatedAt === w.updatedAt) return { brief: saved.brief, built: false };

  // The window that just closed: [startedAt, updatedAt). Anything later belongs
  // to the next brief, even when this one is built late.
  const start = Date.parse(w.startedAt);
  const end = Date.parse(w.updatedAt);
  const { reports } = await store.recentDesk(WINDOW_ROWS);
  const inWindow = reports
    .map((r) => r as unknown as LiveReport)
    .filter((r) => {
      const t = Date.parse(String(r.at || ""));
      return Number.isFinite(t) && t >= start && t < end;
    });

  // The brief that was current until now becomes this one's comparison point.
  const history: BriefHistory = saved
    ? {
        prevWindow: saved.brief.numbers,
        prevFronts: Object.fromEntries(
          (saved.brief.fronts || []).map((f) => [f.id, f]),
        ) as BriefHistory["prevFronts"],
        streaks: bumpStreaks(saved),
      }
    : {};

  const brief = buildBrief(inWindow, now, history);
  await store.putJson(BRIEF_KEY, { brief, history } satisfies StoredBrief);
  // The official numbers move on the same 12-hour clock. A failed fetch keeps
  // the last tally; it must never cost the brief.
  try {
    await refreshTally(store, inWindow, now);
  } catch (err) {
    console.error("[desk] tally refresh failed:", err instanceof Error ? err.message : err);
  }
  return { brief, built: true };
}

/** A front active again this window extends its streak; a quiet one resets. */
function bumpStreaks(saved: StoredBrief): BriefHistory["streaks"] {
  const out: Record<string, number> = {};
  for (const f of saved.brief.fronts || []) {
    const active = f.strikes + f.ground + f.alerts + f.maritime > 0;
    const prior = saved.history?.streaks?.[f.id] ?? 0;
    out[f.id] = active ? prior + 1 : 0;
  }
  return out as BriefHistory["streaks"];
}
