import { createFileRoute } from "@tanstack/react-router";
import type { Brief } from "@/lib/desk/brief";
import { briefWindow } from "@/lib/desk/brief";
import { refreshBrief } from "@/lib/desk/brief-store";
import { getStore } from "@/lib/desk/store";
import { readTally, type Tally } from "@/lib/desk/tally";

/**
 * The 12-hour brief: the general status, the fronts and the numbers.
 *
 * The clock builds it (see `refreshBrief`, called from every tick), so it moves
 * whether or not anyone has the page open. This route only reads it — and
 * builds it itself only if the clock has not reached the new window yet, so a
 * visitor never sees last window's brief labelled as current.
 */
export const Route = createFileRoute("/api/brief")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const store = await getStore();
          const { brief } = await refreshBrief(store);
          return ok(brief, await readTally(store));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "brief failed";
          return json({ ok: false, error: msg, ...briefWindow() }, 500);
        }
      },
    },
  },
});

function ok(brief: Brief, tally: Tally) {
  const secondsLeft = Math.max(60, Math.round((Date.parse(brief.nextUpdateAt) - Date.now()) / 1000));
  return json({ ...brief, tally }, 200, `public, max-age=${Math.min(secondsLeft, 1800)}`);
}

function json(body: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });
}
