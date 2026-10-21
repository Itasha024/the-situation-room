import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type SourceRow, SourcesList } from "@/components/sources-list";

/**
 * Every source the desk reads, by group, with its 1–5 rating (user, 1 Oct).
 * Reached from the "Source ratings" link beside the reports' sources filter;
 * not in any menu, footer or search engine.
 */
type Loaded = { nextAt: number; sources: SourceRow[] };

const loadRatings = createServerFn({ method: "GET" }).handler(async (): Promise<Loaded> => {
  const { getStore } = await import("@/lib/desk/store");
  const { DROPPED_SOURCES, RATINGS_KEY } = await import("@/lib/desk/source-rating");
  const { deskDay } = await import("@/lib/desk/brief");
  const store = await getStore();
  const made = await store.getJson<{ updatedAt: string; sources: SourceRow[] }>(RATINGS_KEY);
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

const GROUPS: [string, string][] = [
  ["houthi", "Houthi-aligned"],
  ["gov", "Government-aligned"],
  ["nonaligned", "Non-aligned"],
];

function SourcesPage() {
  const { sources } = Route.useLoaderData();
  return <SourcesList sources={sources} groups={GROUPS} back={{ href: "/yemen-conflict-desk", label: "Back to the live desk" }} />;
}
