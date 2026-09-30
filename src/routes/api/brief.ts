import { createFileRoute } from "@tanstack/react-router";
import type { Brief } from "@/lib/desk/brief";
import { briefWindow } from "@/lib/desk/brief";
import { refreshBrief } from "@/lib/desk/brief-store";
import { metered } from "@/lib/desk/cpu-meter";
import { getStore } from "@/lib/desk/store";
import { mergeNumbers } from "@/lib/desk/numbers";
import { type Claims, readClaims, readTally, type Tally } from "@/lib/desk/tally";
import { type Ledger, readLedger, readTransits, type Transits } from "@/lib/desk/ledger";
import { TIMELINE_NOW_KEY, type TimelineNow } from "@/lib/desk/timeline-now";
import { CONTROL_LIVE_KEY, type ControlLive } from "@/lib/desk/control-live";

/**
 * The 6-hour brief: the general status, the fronts and the numbers.
 *
 * The clock builds it (see `refreshBrief`, called from every tick), so it moves
 * whether or not anyone has the page open. This route only reads it — and
 * builds it itself only if the clock has not reached the new window yet, so a
 * visitor never sees last window's brief labelled as current.
 */
export const Route = createFileRoute("/api/brief")({
  server: {
    handlers: {
      GET: () => metered("brief", async () => {
        try {
          const store = await getStore();
          const { brief } = await refreshBrief(store);
          const timelineNow = (await store.getJson<TimelineNow>(TIMELINE_NOW_KEY)) ?? null;
          const live = (await store.getJson<ControlLive>(CONTROL_LIVE_KEY)) ?? null;
          // The changes let a past day on the map undo what came after it.
          const controlLive = live ? { districts: live.districts, changes: (live.changes ?? []).map((c) => ({ at: c.at, district: c.district, from: c.from, to: c.to })), asOf: live.asOf } : null;
          return ok(brief, await readTally(store), await readClaims(store), timelineNow, controlLive, await readLedger(store), await readTransits(store));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "brief failed";
          return json({ ok: false, error: msg, ...briefWindow() }, 500);
        }
      }),
    },
  },
});

function ok(brief: Brief, tally: Tally, claims: Claims, timelineNow: TimelineNow | null, controlLive: (Pick<ControlLive, "districts" | "asOf"> & { changes: Pick<ControlLive["changes"][number], "at" | "district" | "from" | "to">[] }) | null, ledger: Ledger, transits: Transits | null) {
  const secondsLeft = Math.max(60, Math.round((Date.parse(brief.nextUpdateAt) - Date.now()) / 1000));
  const age = Math.min(secondsLeft, 600);
  // The edge holds it until the window turns (at most ten minutes), so visitors
  // never each cost a function call and a database read. A browser keeps it one
  // minute only: the page asks again every ten, and a brief rebuilt inside a
  // window (district control, a rewrite) must reach an open page without a
  // reload — held for half an hour, it did not.
  return json({ ...brief, tally, claims, figures: mergeNumbers(tally, claims), timelineNow, controlLive, ledger, transits }, 200, "public, max-age=60", `public, s-maxage=${age}, stale-while-revalidate=60`);
}

function json(body: unknown, status = 200, cache = "no-store", cdn?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, ...(cdn ? { "cdn-cache-control": cdn } : {}) },
  });
}
