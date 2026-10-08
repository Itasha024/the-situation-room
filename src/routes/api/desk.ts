import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { deskParam } from "@/lib/desk/desk-route";
import { checkLinks } from "@/lib/desk/links";
import type { DeskId } from "@/lib/desks";
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
 * The same answer is kept here: a minute fresh, and after that still served at
 * once while a new one is read behind it, so a visitor never waits on the
 * database (a miss took over two seconds).
 */
const MEMO_MS = 60_000;
const STALE_MS = 30 * 60_000;
const memo = new Map<string, { at: number; body: string }>();
const reading = new Map<string, Promise<{ at: number; body: string }>>();

async function readDesk(limit: number, before: string | undefined, desk: DeskId) {
  const store = await getStore();
  const slice = await store.recentDesk(limit, before, { desk });
  // Cards stored before the link rules keep their row; a link that
  // breaks the rules is just not shown (links.ts).
  checkLinks(slice.reports as never[], slice.reports as never[]);
  // A word a model glued to a name is shown split, and a name in the
  // desk's one spelling; the row is left as it is.
  for (const r of slice.reports) {
    r.summary = respell(unglue(String(r.summary ?? "")));
    if (r.text) r.text = respell(String(r.text));
  }
  return { at: Date.now(), body: JSON.stringify({ ok: true, store: store.kind, ...slice }) };
}

function renew(key: string, limit: number, before: string | undefined, desk: DeskId) {
  let p = reading.get(key);
  if (!p) {
    p = readDesk(limit, before, desk)
      .then((hit) => {
        if (memo.size > 20) memo.clear();
        memo.set(key, hit);
        return hit;
      })
      .finally(() => reading.delete(key));
    reading.set(key, p);
  }
  return p;
}

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

          // Which desk's cards (Round 30); none asked is Yemen's, as before.
          const desk = deskParam(url.searchParams.get("desk"));

          const key = `${desk}|${limit}|${before ?? ""}`;
          let hit = memo.get(key);
          const age = hit ? Date.now() - hit.at : Infinity;
          if (!hit || age > STALE_MS) hit = await renew(key, limit, before, desk);
          else if (age > MEMO_MS) renew(key, limit, before, desk).catch(() => {});

          return raw(
            hit.body,
            // New cards reach the page through /api/scan within minutes; this
            // is the archive behind them, so the edge keeps it five minutes.
            {
              "cache-control": "public, max-age=30",
              "cdn-cache-control": "public, s-maxage=60, stale-while-revalidate=600",
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
