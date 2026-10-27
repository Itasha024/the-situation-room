import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { cachedResponse } from "@/lib/desk/microcache";
import { getStore } from "@/lib/desk/store";
import { deskById } from "@/lib/desks";
import { serveCard } from "@/lib/desk/copy-rules";
import { type Card as SameCard, foldServed } from "@/lib/desk/fold-same";
import { type GazaCard, gazaNumbers } from "@/lib/desk/gaza-numbers";
import { GAZA_LIVE_KEY, liveGazaBoxes } from "@/lib/desk/gaza-live";
import type { IranLive } from "@/lib/desk/iran-live";

/**
 * The Gaza – Judea & Samaria desk's numbers (gaza-numbers.ts): the desk's cards since it began reading, as
 * served (the same rules and folds), counted. Ten minutes fresh, then served at once while the next is made.
 */
export const Route = createFileRoute("/api/gaza-numbers")({
  server: {
    handlers: {
      GET: ({ request }) => metered("gaza-numbers", async () => {
        try {
          return await cachedResponse("gaza-numbers", 10 * 60_000, 6 * 3600_000, async () => {
            const store = await getStore();
            const slice = await store.recentDesk(1500, undefined, { desk: "gaza", floor: deskById("gaza").feedFrom, events: false });
            const shown = (slice.reports as unknown as Record<string, unknown>[]).filter((r) => serveCard(r, "gaza"));
            const cards = foldServed(shown as unknown as SameCard[]).reports as unknown as GazaCard[];
            const counted = gazaNumbers(cards);
            // The researched boxes the reports have moved since (gaza-live.ts), each with its set: the page puts them in place.
            const moved = liveGazaBoxes(await store.getJson<IranLive>(GAZA_LIVE_KEY));
            const body = JSON.stringify({ ok: true, at: new Date().toISOString(), ...counted, boxes: [...counted.boxes, ...moved] });
            return { status: 200, body, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } };
          }, request.headers.get("accept-encoding"));
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: String((err as Error)?.message ?? err) }), { status: 500, headers: { "content-type": "application/json" } });
        }
      }),
    },
  },
});
