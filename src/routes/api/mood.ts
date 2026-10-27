import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { cachedResponse } from "@/lib/desk/microcache";
import { getStore } from "@/lib/desk/store";
import { claimLine, ownVoice } from "@/lib/desk/gaza-mood";
import type { GeneralMood } from "@/lib/desk/gaza-mood";
import { GENERAL_KEY, MOOD_KEY, type MoodStore } from "@/lib/gaza-mood.server";

/**
 * The Gaza desk's mood monitor (gaza-mood.server.ts): the general mood over the last hours and its series, and the
 * spikes' own reads. Only spikes with a read are served; a minute fresh.
 */
export const Route = createFileRoute("/api/mood")({
  server: {
    handlers: {
      GET: ({ request }) => metered("mood", async () => {
        try {
          return await cachedResponse("mood", 60_000, 3600_000, async () => {
            const store = await getStore();
            const m = (await store.getJson<MoodStore>(MOOD_KEY)) ?? { at: "", events: [] };
            const events = m.events.filter((e) => e.read?.about).map(({ terms, seed, ...e }) => (e.found ? { ...e, headline: claimLine(e.headline) } : e))
              // The quote rules as they stand now, on reads stored before them too.
              .map((e) => (e.read ? { ...e, read: { ...e.read, quotes: e.read.quotes.filter((q) => ownVoice(q.en)) } } : e));
            // The general mood over the last hours, with its two-day series (user, 27 Oct).
            const g = await store.getJson<GeneralMood>(GENERAL_KEY);
            const general = g?.read ? { ...g, read: { ...g.read, quotes: g.read.quotes.filter((q) => ownVoice(q.en)) } } : g ?? null;
            const body = JSON.stringify({ ok: true, at: g?.at && g.at > m.at ? g.at : m.at, general, events, following: m.events.length });
            return { status: 200, body, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" } };
          }, request.headers.get("accept-encoding"));
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: String((err as Error)?.message ?? err) }), { status: 500, headers: { "content-type": "application/json" } });
        }
      }),
    },
  },
});
