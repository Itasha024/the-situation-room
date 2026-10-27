import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { deskParam } from "@/lib/desk/desk-route";
import type { DeskId } from "@/lib/desks";
import { getStore } from "@/lib/desk/store";
import { gzipped, respond } from "@/lib/desk/microcache";
import { deskKey, readDesk, SERVED_FRESH_MS, servedKey, type Served } from "@/lib/desk/serve-desk";

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
 * database (a miss took over two seconds). Three minutes fresh: on the small server
 * a read blocks the site while it is made, up to a minute when the machine is
 * throttled (22 Oct), and the scans write new cards only every few minutes.
 */
const MEMO_MS = 3 * 60_000;
const PINS_MEMO_MS = 4 * 60_000;
const STALE_MS = 30 * 60_000;
const memo = new Map<string, { at: number; body: string; gz?: Uint8Array }>();
const reading = new Map<string, Promise<{ at: number; body: string }>>();

function renew(key: string, limit: number, before: string | undefined, desk: DeskId, since?: string) {
  let p = reading.get(key);
  if (!p) {
    p = fromWorker(key)
      .then((got) => got ?? readDesk(limit, before, desk, since))
      .then((hit) => {
        // The oldest answer goes, never all of them: a reader paging back (?before=) once cleared the
        // desks' main answers too, and the next visitors waited on a rebuild (20 Oct).
        memo.delete(key);
        if (memo.size >= 20) memo.delete(memo.keys().next().value as string);
        memo.set(key, hit);
        return hit;
      })
      .finally(() => reading.delete(key));
    reading.set(key, p);
  }
  return p;
}

/**
 * The answer the worker built after its last scan (serve-desk.ts, 27 Oct): the site only hands it out, so a rebuild
 * never holds every other visitor up. Older than its freshness, or never built, the site builds it itself.
 */
async function fromWorker(key: string): Promise<{ at: number; body: string; gz?: Uint8Array } | null> {
  try {
    const got = await (await getStore()).getJson<Served>(servedKey(key));
    if (!got?.body || Date.now() - got.at > SERVED_FRESH_MS) return null;
    return { at: Date.now(), body: got.body, gz: await gzipped(got.body) };
  } catch {
    return null;
  }
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
          // The map's pins since a day (?since=YYYY-MM-DD): the whole war, no
          // cards. Pins are small; the bound only stops a runaway.
          const sinceDay = url.searchParams.get("since") || "";
          const since = /^\d{4}-\d{2}-\d{2}$/.test(sinceDay) ? `${sinceDay}T00:00:00+03:00` : undefined;
          const cap = since ? 20_000 : 1000;
          const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), cap) : since ? cap : 400;

          // Paging back: rows strictly older than this ISO time.
          const before = url.searchParams.get("before") || undefined;

          // Which desk's cards (Round 30); none asked is Yemen's, as before.
          const desk = deskParam(url.searchParams.get("desk"));

          const key = deskKey(desk, limit, before, since);
          let hit = memo.get(key);
          const age = hit ? Date.now() - hit.at : Infinity;
          if (!hit || age > STALE_MS) hit = await renew(key, limit, before, desk, since);
          // The whole war's pins (?since=) are the heaviest answer and change only with a scan (every 5 minutes).
          else if (age > (since ? PINS_MEMO_MS : MEMO_MS)) renew(key, limit, before, desk, since).catch(() => {});

          return respond(
            {
              ...hit,
              status: 200,
              // New cards reach the page through /api/scan within minutes; this
              // is the archive behind them, so the edge keeps it a minute (the war's pins four).
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "public, max-age=30",
                "cdn-cache-control": `public, s-maxage=${since ? 240 : 60}, stale-while-revalidate=86400`,
              },
            },
            request.headers.get("accept-encoding"),
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
