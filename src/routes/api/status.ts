import { createFileRoute } from "@tanstack/react-router";

import { MISSED_KEY, type Missed, USAGE_KEY, type Usage } from "@/lib/desk/editor";
import { REGISTRY_KEY, ROUTES_KEY, type Registry, type RouteLog } from "@/lib/desk/origin";
import { getStore } from "@/lib/desk/store";
import { sourceList } from "@/lib/yemen-scan.server";

/**
 * The desk's own health, for the operator: what each source gave in 24 hours,
 * when it was last read, what the reader rejected that looked like news (the
 * missed list), and how each site's originals could be read. A READ only.
 */
export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const store = await getStore();
          const now = Date.now();
          const [state, slice, missed, routes, usage, quota, registry] = await Promise.all([
            store.loadScanState(),
            store.recentDesk(1000),
            store.getJson<Missed[]>(MISSED_KEY),
            store.getJson<RouteLog>(ROUTES_KEY),
            store.getJson<Usage>(USAGE_KEY),
            store.getJson<Record<string, number>>("reader-quota"),
            store.getJson<Registry>(REGISTRY_KEY),
          ]);
          const day = new Map<string, number>();
          for (const row of slice.reports) {
            const r = row as { at: string; source: string };
            if (now - Date.parse(r.at) > 86_400_000) continue;
            day.set(r.source, (day.get(r.source) ?? 0) + 1);
          }
          // One row per source name; a source read through several feeds shows its latest read.
          const byName = new Map<string, { name: string; lastReadAt: string | null; cards24h: number }>();
          for (const s of sourceList()) {
            const at = state.lastScanAt[s.key] ? new Date(state.lastScanAt[s.key]).toISOString() : null;
            const row = byName.get(s.name);
            if (!row) byName.set(s.name, { name: s.name, lastReadAt: at, cards24h: day.get(s.name) ?? 0 });
            else if (at && (!row.lastReadAt || at > row.lastReadAt)) row.lastReadAt = at;
          }
          const seen = new Set(byName.keys());
          const sources = [...byName.values()];
          // Originals (Reuters, NYT, ...) are sources too, though no feed reads them.
          for (const [name, n] of day) if (!seen.has(name)) sources.push({ name, lastReadAt: null, cards24h: n });
          return json({
            ok: true,
            lastTickAt: state.lastTickAt ? new Date(state.lastTickAt).toISOString() : null,
            sources,
            missed: (missed ?? []).slice(0, 100),
            routes: routes ?? {},
            // Each whole site's last read: listed, new to the desk, picked by triage.
            sites: state.sites ?? {},
            // Outlets a relay named that the desk looked up: their site, or none.
            outlets: Object.fromEntries(Object.entries(registry ?? {}).map(([name, r]) => [name, "site" in r ? r.site : null])),
            usage: usage ?? null,
            // Models out of their daily quota, and when they are back.
            resting: Object.fromEntries(Object.entries(quota ?? {}).filter(([, until]) => until > now).map(([m, until]) => [m, new Date(until).toISOString()])),
          });
        } catch (err) {
          return json({ ok: false, error: err instanceof Error ? err.message : "status failed" }, 500);
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
