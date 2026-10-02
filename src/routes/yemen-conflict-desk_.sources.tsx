import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DeskDoc } from "@/components/desk-doc";

/**
 * Every source the desk reads, by group, with its 1–5 rating (user, 1 Oct).
 * Reached only from the "Sources reliability methodology" pop-up beside the
 * report column; not in any menu, footer or search engine.
 */
type Row = { name: string; url: string; group: "houthi" | "gov" | "nonaligned"; rating: number };
type Loaded = { nextAt: number; sources: Row[] };

const loadRatings = createServerFn({ method: "GET" }).handler(async (): Promise<Loaded> => {
  const { getStore } = await import("@/lib/desk/store");
  const { DROPPED_SOURCES, RATINGS_KEY } = await import("@/lib/desk/source-rating");
  const { deskDay } = await import("@/lib/desk/brief");
  const store = await getStore();
  const made = await store.getJson<{ updatedAt: string; sources: Row[] }>(RATINGS_KEY);
  const dropped = new Set(DROPPED_SOURCES.map((n) => n.toLowerCase()));
  return {
    // The ratings are made at 00:00 Israel: the next one is the coming midnight.
    nextAt: deskDay(deskDay(Date.now()).startedAt + 26 * 3600_000).startedAt,
    sources: (made?.sources ?? [])
      .filter((s) => !dropped.has(s.name.toLowerCase()))
      .map((s) => ({ name: s.name, url: s.url, group: s.group, rating: s.rating })),
  };
});

export const Route = createFileRoute("/yemen-conflict-desk_/sources")({
  head: () => ({
    meta: [
      { title: "Sources list · Yemen Conflict Desk" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=600, stale-while-revalidate=300",
  }),
  loader: () => loadRatings(),
  component: SourcesPage,
});

const GROUPS: [Row["group"], string][] = [
  ["houthi", "Houthi-aligned"],
  ["gov", "Government-aligned"],
  ["nonaligned", "Non-aligned"],
];

function Dots({ rating }: { rating: number }) {
  return (
    <span className="sr-dots" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="sr-dot"
          style={{
            ["--f" as string]: `${Math.round(Math.max(0, Math.min(1, rating - (i - 1))) * 100)}%`,
          }}
        />
      ))}
    </span>
  );
}

function SourcesPage() {
  const { sources } = Route.useLoaderData();
  // Every group starts closed (user, 2 Oct); each opens on its own, or all at once.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const shown = GROUPS.filter(([g]) => sources.some((s) => s.group === g));
  const allOpen = shown.length > 0 && shown.every(([g]) => open[g]);
  const setAll = (v: boolean) => setOpen(Object.fromEntries(shown.map(([g]) => [g, v])));
  return (
    <DeskDoc title="Sources list">
      <div className="sr-top">
        <p className="sr-stamp">Sources reliability changes every 24h</p>
        {shown.length ? (
          <button
            type="button"
            className="sr-all"
            aria-pressed={allOpen}
            onClick={() => setAll(!allOpen)}
          >
            {allOpen ? "Close all" : "Open all"}
          </button>
        ) : null}
      </div>
      {GROUPS.map(([g, label]) => {
        const rows = sources
          .filter((s) => s.group === g)
          .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
        if (!rows.length) return null;
        return (
          <section key={g} className={`sr-group sr-${g}${open[g] ? " open" : ""}`}>
            <h3>
              <button
                type="button"
                className="sr-head"
                aria-expanded={!!open[g]}
                aria-controls={`sr-${g}-list`}
                onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}
              >
                <span className="sw" />
                <span className="sr-name">{label}</span>
                <span className="sr-count">{rows.length}</span>
                <svg className="sr-chev" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 7.5l5 5 5-5" />
                </svg>
              </button>
            </h3>
            <div className="sr-body" id={`sr-${g}-list`} inert={!open[g] || undefined}>
              <div>
                <table className="sr-table">
                  <thead>
                    <tr>
                      <th scope="col">Source</th>
                      <th scope="col">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.name}>
                        <td>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer">
                              {s.name}
                            </a>
                          ) : (
                            s.name
                          )}
                        </td>
                        <td className="sr-rate" aria-label={`${s.rating.toFixed(1)} out of 5`}>
                          <b>{s.rating.toFixed(1)}</b>
                          <Dots rating={s.rating} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })}
      {!sources.length ? (
        <p className="sr-empty">The ratings are being worked out. Please look again shortly.</p>
      ) : null}
    </DeskDoc>
  );
}
