import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { getStore } from "@/lib/desk/store";
import { TRUMP_KEY, type TrumpFeed, desksOf, plainCard, shownCard, shownYet } from "@/lib/desk/trump";

/**
 * A desk's Trump feed (stage 5): his own words on its war, newest first, as
 * the Iran cycle keeps them. `?desk=yemen` gives his words on Yemen and the
 * Houthis (17 Oct); the default is the Iran desk's. A read only; each answer
 * is kept a minute here so a visitor never waits on the database.
 */
const memo = new Map<string, { at: number; body: string }>();

export const Route = createFileRoute("/api/trump")({
  server: {
    handlers: {
      GET: ({ request }) => metered("trump", async () => {
        const desk = new URL(request.url).searchParams.get("desk") === "yemen" ? "yemen" : "iran";
        try {
          let m = memo.get(desk);
          if (!m || Date.now() - m.at > 60_000) {
            const feed = (await (await getStore()).getJson<TrumpFeed>(TRUMP_KEY)) ?? { statements: [] };
            // A statement with no desks named is the Iran desk's, as all were before Yemen's (17 Oct).
            const onDesk = (s: TrumpFeed["statements"][number]) => {
              const d = s.desks ?? desksOf(s.text);
              return d.includes(desk) || (desk === "iran" && !d.length);
            };
            m = { at: Date.now(), body: JSON.stringify({ ok: true, statements: feed.statements.filter((s) => shownYet(s) && onDesk(s)).map(({ tries: _t, off: _o, desks: _d, ...s }) => (s.headline ? { ...s, ...shownCard({ headline: s.headline, body: s.body }) } : { ...s, ...plainCard(s) })), checkedAt: feed.checkedAt ?? null, down: feed.down ?? [] }) };
            memo.set(desk, m);
          }
          return new Response(m.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60", "cdn-cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "trump feed failed", statements: [] }), { status: 500, headers: { "content-type": "application/json" } });
        }
      }),
    },
  },
});
