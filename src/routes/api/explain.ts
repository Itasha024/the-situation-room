import { createFileRoute } from "@tanstack/react-router";

import { cachedResponse } from "@/lib/desk/microcache";
import { getStore } from "@/lib/desk/store";
import { type ExplainDesk, type ExplainLive, EXPLAIN_DESKS, currentExplain, explainKey } from "@/lib/desk/explain-live";

/**
 * A desk's explainers as the weekly check keeps them (explain-live.ts), else as the file has them: the desk's
 * Explainers panel and its guide page read them. Ten minutes fresh.
 */
export const Route = createFileRoute("/api/explain")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const asked = new URL(request.url).searchParams.get("desk") as ExplainDesk;
        const desk = EXPLAIN_DESKS.includes(asked) ? asked : "iran";
        try {
          return await cachedResponse(`explain:${desk}`, 10 * 60_000, 24 * 3600_000, async () => {
            const live = await (await getStore()).getJson<ExplainLive>(explainKey(desk));
            return { status: 200, body: JSON.stringify(currentExplain(desk, live)), headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=600" } };
          }, request.headers.get("accept-encoding"));
        } catch {
          return new Response(JSON.stringify(currentExplain(desk, null)), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
        }
      },
    },
  },
});
