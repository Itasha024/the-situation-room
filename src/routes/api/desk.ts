import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { checkLinks } from "@/lib/desk/links";
import { unglue } from "@/lib/desk/reader";
import { respell } from "@/lib/desk/spelling";
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
/**
 * The edge asks each region's copy anew; one instance serves several regions.
 * The same answer is kept a minute here, so those misses cost no database read
 * and no link check.
 */
const MEMO_MS = 60_000;
const memo = new Map<string, { at: number; body: string }>();

export const Route = createFileRoute("/api/desk")({
  server: {
    handlers: {
      GET: ({ request }) => metered("desk", async () => {
        try {
          const url = new URL(request.url);
          const asked = Number(url.searchParams.get("limit") || NaN);
          // Bounded so a crafted query cannot ask the desk to serialise the
          // entire archive on every request.
          const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), 1000) : 400;

          // Paging back: rows strictly older than this ISO time.
          const before = url.searchParams.get("before") || undefined;

          const key = `${limit}|${before ?? ""}`;
          let hit = memo.get(key);
          if (!hit || Date.now() - hit.at > MEMO_MS) {
            const store = await getStore();
            const slice = await store.recentDesk(limit, before);
            // Cards stored before the link rules keep their row; a link that
            // breaks the rules is just not shown (links.ts).
            checkLinks(slice.reports as never[], slice.reports as never[]);
            // A word a model glued to a name is shown split, and a name in the
            // desk's one spelling; the row is left as it is.
            for (const r of slice.reports) {
              r.summary = respell(unglue(String(r.summary ?? "")));
              if (r.text) r.text = respell(String(r.text));
            }
            hit = { at: Date.now(), body: JSON.stringify({ ok: true, store: store.kind, ...slice }) };
            if (memo.size > 20) memo.clear();
            memo.set(key, hit);
          }

          return raw(
            hit.body,
            // New cards reach the page through /api/scan within minutes; this
            // is the archive behind them, so the edge keeps it five minutes.
            {
              "cache-control": "public, max-age=30",
              "cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=900",
            },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "desk read failed";
          // Reported, not swallowed. A feed that silently serves nothing is the
          // exact failure this endpoint exists to end.
          return json({ ok: false, error: message, reports: [], events: [] }, {}, 500);
        }
      }),
    },
  },
});

function json(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return raw(JSON.stringify(body), headers, status);
}

function raw(body: string, headers: Record<string, string> = {}, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
