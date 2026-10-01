import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { DeskDoc } from "@/components/desk-doc";

/**
 * Every source the desk reads, by group, with its 1–5 rating (user, 1 Oct).
 * Reached only from the "Sources reliability methodology" pop-up beside the
 * report column; not in any menu, footer or search engine.
 */
type Row = { name: string; url: string; group: "houthi" | "gov" | "nonaligned"; rating: number };
type Loaded = { updatedAt: string | null; sources: Row[] };

const loadRatings = createServerFn({ method: "GET" }).handler(async (): Promise<Loaded> => {
  const { getStore } = await import("@/lib/desk/store");
  const { RATINGS_KEY } = await import("@/lib/desk/source-rating");
  const store = await getStore();
  const made = await store.getJson<{ updatedAt: string; sources: Row[] }>(RATINGS_KEY);
  return { updatedAt: made?.updatedAt ?? null, sources: (made?.sources ?? []).map((s) => ({ name: s.name, url: s.url, group: s.group, rating: s.rating })) };
});

export const Route = createFileRoute("/yemen-conflict-desk_/sources")({
  head: () => ({ meta: [{ title: "Sources list · Yemen Conflict Desk" }, { name: "robots", content: "noindex, nofollow" }] }),
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
        <span key={i} className="sr-dot" style={{ ["--f" as string]: `${Math.round(Math.max(0, Math.min(1, rating - (i - 1))) * 100)}%` }} />
      ))}
    </span>
  );
}

function SourcesPage() {
  const { updatedAt, sources } = Route.useLoaderData();
  // The time on the reader's own clock, once the page is in their browser.
  const [when, setWhen] = useState("");
  useEffect(() => {
    if (!updatedAt) return;
    const d = new Date(updatedAt);
    setWhen(`${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}, ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`);
  }, [updatedAt]);
  return (
    <DeskDoc title="Sources list">
      <p className="sr-stamp">
        Updates every 24 hours{when ? ` · Last updated ${when}` : ""}
      </p>
      {GROUPS.map(([g, label]) => {
        const rows = sources.filter((s) => s.group === g).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
        if (!rows.length) return null;
        return (
          <section key={g} className={`sr-group sr-${g}`}>
            <h3>
              <span className="sw" />
              {label}
            </h3>
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
          </section>
        );
      })}
      {!sources.length ? <p className="sr-empty">The ratings are being worked out. Please look again shortly.</p> : null}
    </DeskDoc>
  );
}
