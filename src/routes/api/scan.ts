import { createFileRoute } from "@tanstack/react-router";
import { metered } from "@/lib/desk/cpu-meter";
import { deskParam, onDesk } from "@/lib/desk/desk-route";
import { GAZA_PAYLOAD, IRAN_PAYLOAD, scanYemenSources } from "@/lib/yemen-scan.server";
import { getStore } from "@/lib/desk/store";
import { cachedResponse } from "@/lib/desk/microcache";
import type { ScanPayload } from "@/lib/desk/types";

/**
 * What the desk currently holds.
 *
 * A READ, never a scan. The clock (`/api/tick`) does the fetching, so the feed
 * advances whether or not anyone is looking — and a page view costs one store
 * read instead of 38 outbound requests.
 */
export const Route = createFileRoute("/api/scan")({
  server: {
    handlers: {
      GET: ({ request }) => metered("scan", async () => {
        try {
          // One scan feeds every desk; each is sent only its own cards (Round 30).
          // The Iran desk's scan box is its own scan's: its sources, its verdicts.
          const q = new URL(request.url).searchParams;
          const desk = deskParam(q.get("desk"));
          const only = q.get("only") === "time" ? "time" : "";
          // Built once per 20 seconds, not per visitor: each read parsed the whole stored scan (330-430 KB),
          // even for the home page's clock, which wants only its time (20 Oct, microcache.ts).
          return await cachedResponse(`scan|${desk}|${only}`, 20_000, 15 * 60_000, () => readScan(desk, only), request.headers.get("accept-encoding"));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "scan read failed";
          return new Response(JSON.stringify({ ok: false, error: msg, reports: [] }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
      }),
    },
  },
});

async function readScan(desk: ReturnType<typeof deskParam>, only: string) {
  // The Iran and Gaza desks' scan boxes are their own scans'.
  const own = desk === "iran" ? IRAN_PAYLOAD : desk === "gaza" ? GAZA_PAYLOAD : "";
  const payload = own
    ? ((await (await getStore()).getJson<ScanPayload>(own)) ?? { ok: true as const, scannedAt: "", reports: [], sourcesTried: 0, sourcesOk: 0, rawHits: [], sourceStatus: [] })
    : await scanYemenSources();
  if (!own) payload.reports = payload.reports.filter((r) => onDesk(r, desk));
  // The home page asks only when each desk last looked (user, 17 Oct: its clock is the desks' clock).
  const body = only === "time" ? { ok: true, scannedAt: payload.scannedAt } : payload;
  return {
    status: 200,
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Short: the tick can land at any moment and readers should see
      // it promptly, but this still absorbs a burst of visitors.
      "cache-control": "public, max-age=30",
      // Kept at the edge: 30 seconds fresh (the tick runs every five minutes), then
      // refreshed in the background.
      "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=86400",
    },
  };
}
