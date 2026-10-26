import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { cachedResponse } from "@/lib/desk/microcache";
import { getStore } from "@/lib/desk/store";
import { MOOD_KEY, type MoodStore } from "@/lib/gaza-mood.server";

/**
 * The Gaza desk's mood monitor (gaza-mood.server.ts): the reactions to the day's big events, as last read.
 * Only events with a read are served; a minute fresh.
 */
export const Route = createFileRoute("/api/mood")({
  server: {
    handlers: {
      GET: ({ request }) => metered("mood", async () => {
        try {
          return await cachedResponse("mood", 60_000, 3600_000, async () => {
            const store = await getStore();
            const m = (await store.getJson<MoodStore>(MOOD_KEY)) ?? { at: "", events: [] };
            const events = m.events.filter((e) => e.read?.about).map(({ terms, ...e }) => e);
            const body = JSON.stringify({ ok: true, at: m.at, events, following: m.events.length });
            return { status: 200, body, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" } };
          }, request.headers.get("accept-encoding"));
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: String((err as Error)?.message ?? err) }), { status: 500, headers: { "content-type": "application/json" } });
        }
      }),
    },
  },
});
