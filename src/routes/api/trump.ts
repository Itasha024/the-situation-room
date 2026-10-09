import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { getStore } from "@/lib/desk/store";
import { TRUMP_KEY, type TrumpFeed } from "@/lib/desk/trump";

/**
 * The Iran desk's Trump feed (stage 5): his own words on Iran and the war,
 * newest first, as the Iran cycle keeps them. A read only; the answer is kept
 * a minute here so a visitor never waits on the database.
 */
let memo: { at: number; body: string } | null = null;

export const Route = createFileRoute("/api/trump")({
  server: {
    handlers: {
      GET: () => metered("trump", async () => {
        try {
          if (!memo || Date.now() - memo.at > 60_000) {
            const feed = (await (await getStore()).getJson<TrumpFeed>(TRUMP_KEY)) ?? { statements: [] };
            memo = { at: Date.now(), body: JSON.stringify({ ok: true, statements: feed.statements, checkedAt: feed.checkedAt ?? null, down: feed.down ?? [] }) };
          }
          return new Response(memo.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60", "cdn-cache-control": "public, s-maxage=60, stale-while-revalidate=60" } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "trump feed failed", statements: [] }), { status: 500, headers: { "content-type": "application/json" } });
        }
      }),
    },
  },
});
