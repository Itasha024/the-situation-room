import { createFileRoute } from "@tanstack/react-router";
import { scanYemenSources } from "@/lib/yemen-scan.server";

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
      GET: async () => {
        try {
          const payload = await scanYemenSources();
          return new Response(JSON.stringify(payload), {
            headers: {
              "content-type": "application/json; charset=utf-8",
              // Short: the tick can land at any moment and readers should see
              // it promptly, but this still absorbs a burst of visitors.
              "cache-control": "public, max-age=30",
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "scan read failed";
          return new Response(JSON.stringify({ ok: false, error: msg, reports: [] }), {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
      },
    },
  },
});
