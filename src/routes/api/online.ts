import { createFileRoute } from "@tanstack/react-router";
import { metered } from "@/lib/desk/cpu-meter";
import { getStore } from "@/lib/desk/store";
import { cachedResponse } from "@/lib/desk/microcache";
import { WATCH_SUMMARY } from "@/lib/online-watch.server";

/** The Gaza desk's Online tab (user, 23 Oct): the summary the watch writes each tick, read as it is. */
export const Route = createFileRoute("/api/online")({
  server: {
    handlers: {
      GET: ({ request }) =>
        metered("online", async () => {
          try {
            return await cachedResponse("online|gaza", 30_000, 15 * 60_000, async () => ({
              status: 200,
              body: JSON.stringify((await (await getStore()).getJson(WATCH_SUMMARY)) ?? { at: null, areas: [] }),
              headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" },
            }),request.headers.get("accept-encoding"));
          } catch (err) {
            return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "online read failed", areas: [] }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
          }
        }),
    },
  },
});
