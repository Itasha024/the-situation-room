import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { tgMedia } from "@/lib/desk/media";

/**
 * Fresh links to a Telegram post's picture or video.
 *
 * Telegram's file links (cdn*.telesco.pe) stop working after a while, so an
 * older card's picture fails. The page then asks here: the post is read once
 * from Telegram's public page and its links come back new. The edge keeps the
 * answer an hour, so each post costs one read an hour at most.
 */
export const Route = createFileRoute("/api/tgmedia")({
  server: {
    handlers: {
      GET: ({ request }) => metered("tgmedia", async () => {
        const post = new URL(request.url).searchParams.get("post") ?? "";
        const m = /^([A-Za-z0-9_]{3,40})\/(\d{1,9})$/.exec(post);
        if (!m) return json({ ok: false, error: "post must be channel/id" }, {}, 400);
        const [, ch, id] = m;
        try {
          const res = await fetch(`https://t.me/s/${ch}?before=${Number(id) + 1}`, {
            headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)", accept: "text/html" },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) {
            await res.body?.cancel().catch(() => {});
            return json({ ok: false, error: `telegram ${res.status}` }, { "cdn-cache-control": "public, s-maxage=300" });
          }
          const html = await res.text();
          const want = `data-post="${ch}/${id}"`.toLowerCase();
          const block = html.split("tgme_widget_message_wrap").find((p) => p.toLowerCase().includes(want));
          const media = block ? tgMedia(block, `https://t.me/${ch}/${id}`) : undefined;
          return json(
            { ok: !!media, ...(media ? { media } : {}) },
            { "cache-control": "public, max-age=600", "cdn-cache-control": "public, s-maxage=3600, stale-while-revalidate=600" },
          );
        } catch (err) {
          return json({ ok: false, error: err instanceof Error ? err.message : "read failed" }, {}, 502);
        }
      }),
    },
  },
});

function json(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
