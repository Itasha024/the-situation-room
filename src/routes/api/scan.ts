import { createFileRoute } from "@tanstack/react-router";
import { metered } from "@/lib/desk/cpu-meter";
import { deskParam, onDesk } from "@/lib/desk/desk-route";
import { IRAN_PAYLOAD, scanYemenSources } from "@/lib/yemen-scan.server";
import { getStore } from "@/lib/desk/store";
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
          const desk = deskParam(new URL(request.url).searchParams.get("desk"));
          const payload =
            desk === "iran"
              ? ((await (await getStore()).getJson<ScanPayload>(IRAN_PAYLOAD)) ?? { ok: true as const, scannedAt: "", reports: [], sourcesTried: 0, sourcesOk: 0, rawHits: [], sourceStatus: [] })
              : await scanYemenSources();
          if (desk !== "iran") payload.reports = payload.reports.filter((r) => onDesk(r, desk));
          return new Response(JSON.stringify(payload), {
            headers: {
              "content-type": "application/json; charset=utf-8",
              // Short: the tick can land at any moment and readers should see
              // it promptly, but this still absorbs a burst of visitors.
              "cache-control": "public, max-age=30",
              // Served by Vercel's edge, not by a function and a database read
              // per visitor: two minutes fresh (the tick runs every five), then
              // refreshed in the background.
              "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=30",
            },
          });
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
