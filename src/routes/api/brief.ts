import { createFileRoute } from "@tanstack/react-router";
import { type Brief, type BriefHistory, buildBrief, briefWindow } from "@/lib/desk/brief";
import { getStore } from "@/lib/desk/store";
import { scanYemenSources } from "@/lib/yemen-scan.server";

/**
 * The 12-hour brief: the general status, the fronts and the numbers.
 *
 * Built once per window and stored, so every visitor in the same window sees
 * the same figures and the same "next update" time — and so the NEXT window
 * can say which way the war is moving. Without the stored previous window
 * every brief reads as if the conflict began twelve hours ago.
 */

const BRIEF_KEY = "brief";

type StoredBrief = { brief: Brief; history: BriefHistory };

export const Route = createFileRoute("/api/brief")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const store = await getStore();
          const w = briefWindow();

          const saved = (await store.getJson?.<StoredBrief>(BRIEF_KEY)) ?? null;
          if (saved?.brief?.updatedAt === w.updatedAt) return ok(saved.brief);

          const scan = await scanYemenSources();
          // The window that just closed becomes this one's comparison point.
          const history: BriefHistory = saved
            ? {
                prevWindow: saved.brief.numbers,
                prevFronts: Object.fromEntries(
                  (saved.brief.fronts || []).map((f) => [f.id, f]),
                ) as BriefHistory["prevFronts"],
                streaks: bumpStreaks(saved),
              }
            : {};

          const brief = buildBrief(scan.reports, new Date(), history);
          await store.putJson?.(BRIEF_KEY, { brief, history } satisfies StoredBrief);
          return ok(brief);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "brief failed";
          return json({ ok: false, error: msg, ...briefWindow() }, 500);
        }
      },
    },
  },
});

/** A front active again this window extends its streak; a quiet one resets. */
function bumpStreaks(saved: StoredBrief): BriefHistory["streaks"] {
  const out: Record<string, number> = {};
  for (const f of saved.brief.fronts || []) {
    const active = f.strikes + f.ground + f.alerts + f.maritime > 0;
    const prior = saved.history?.streaks?.[f.id] ?? 0;
    out[f.id] = active ? prior + 1 : 0;
  }
  return out as BriefHistory["streaks"];
}

function ok(brief: Brief) {
  const secondsLeft = Math.max(60, Math.round((Date.parse(brief.nextUpdateAt) - Date.now()) / 1000));
  return json(brief, 200, `public, max-age=${Math.min(secondsLeft, 1800)}`);
}

function json(body: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });
}
