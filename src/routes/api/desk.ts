import { createFileRoute } from "@tanstack/react-router";

import { getStore } from "@/lib/desk/store";

/**
 * The accumulated desk — every report the clock has collected, newest first.
 *
 * WHY THIS EXISTS
 * ---------------
 * The page used to build its feed from two things: `data.json`, baked at build
 * time, and `/api/scan`, which returns only the LAST scan cycle. Deployed, that
 * made the feed a rolling snapshot rather than a stream — the tick dutifully
 * wrote every report into `desk_report`, nothing ever read them back, and a
 * report that scrolled out of a Telegram channel's recent window vanished from
 * the public desk while still sitting in the database.
 *
 * This is the read that fixes it. `/api/scan` keeps its job (what the last
 * cycle saw, plus scanner health for the live scan box); this serves the feed
 * itself.
 *
 * A READ, never a scan — a page view must never trigger outbound fetches.
 */
export const Route = createFileRoute("/api/desk")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const asked = Number(url.searchParams.get("limit") || NaN);
          // Bounded so a crafted query cannot ask the desk to serialise the
          // entire archive on every request.
          const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), 1000) : 400;

          // Paging back: rows strictly older than this ISO time.
          const before = url.searchParams.get("before") || undefined;

          const store = await getStore();
          const slice = await store.recentDesk(limit, before);

          return json(
            { ok: true, store: store.kind, ...slice },
            // Short, for the same reason as /api/scan: the tick can land at any
            // moment and readers should see it promptly.
            {
              "cache-control": "public, max-age=30",
              // Every visitor's poll was a function call and a 400-row database
              // read. The edge serves them now: a minute fresh, refreshed behind.
              "cdn-cache-control": "public, s-maxage=60, stale-while-revalidate=240",
            },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "desk read failed";
          // Reported, not swallowed. A feed that silently serves nothing is the
          // exact failure this endpoint exists to end.
          return json({ ok: false, error: message, reports: [], events: [] }, {}, 500);
        }
      },
    },
  },
});

function json(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
