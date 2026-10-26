import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { cachedResponse } from "@/lib/desk/microcache";
import { getStore } from "@/lib/desk/store";
import { TRUMP_KEY, type TrumpFeed, desksOf, plainCard, shownCard, shownYet } from "@/lib/desk/trump";

/**
 * A desk's Trump feed (stage 5): his own words on its war, newest first, as
 * the Iran cycle keeps them. `?desk=yemen` gives his words on Yemen and the
 * Houthis (17 Oct); the default is the Iran desk's. A read only; each answer
 * is kept a minute here so a visitor never waits on the database.
 */

export const Route = createFileRoute("/api/trump")({
  server: {
    handlers: {
      GET: ({ request }) => metered("trump", async () => {
        const asked = new URL(request.url).searchParams.get("desk");
        const desk = asked === "yemen" || asked === "gaza" ? asked : "iran";
        try {
          // Kept a minute, then served at once while the next is read behind it (microcache.ts, 20 Oct).
          return await cachedResponse(`trump|${desk}`, 60_000, 30 * 60_000, async () => {
            const feed = (await (await getStore()).getJson<TrumpFeed>(TRUMP_KEY)) ?? { statements: [] };
            // A statement with no desks named is the Iran desk's, as all were before Yemen's (17 Oct).
            const onDesk = (s: TrumpFeed["statements"][number]) => {
              // The Gaza desk came after most statements were stored: its words are read again.
              const d = desk === "gaza" ? desksOf(`${s.text}\n${s.headline ?? ""}`) : (s.desks ?? desksOf(s.text));
              return d.includes(desk) || (desk === "iran" && !d.length);
            };
            const body = JSON.stringify({ ok: true, statements: feed.statements.filter((s) => shownYet(s) && onDesk(s)).map(({ tries: _t, off: _o, desks: _d, body: _b, ...s }) => (s.headline ? { ...s, ...shownCard({ headline: s.headline, body: _b }) } : { ...s, ...plainCard({ ...s, body: _b }) })), checkedAt: feed.checkedAt ?? null, down: feed.down ?? [] });
            return { status: 200, body, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60", "cdn-cache-control": "public, s-maxage=60, stale-while-revalidate=86400" } };
          }, request.headers.get("accept-encoding"));
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "trump feed failed", statements: [] }), { status: 500, headers: { "content-type": "application/json" } });
        }
      }),
    },
  },
});
