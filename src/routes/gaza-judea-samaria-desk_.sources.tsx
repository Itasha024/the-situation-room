import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type SourceRow, SourcesList } from "@/components/sources-list";

/**
 * The Gaza desk's sources by its six filter groups, each with its 1–5 rating (user, 27 Oct: the
 * "Source ratings" link as on the other desks, with this desk's own sources), made once a day.
 */
const loadRatings = createServerFn({ method: "GET" }).handler(async (): Promise<{ sources: SourceRow[] }> => {
  const { getStore } = await import("@/lib/desk/store");
  const { GAZA_RATINGS_KEY } = await import("@/lib/desk/source-rating");
  const store = await getStore();
  const made = await store.getJson<{ sources: { name: string; url: string; lean?: string; rating: number }[] }>(GAZA_RATINGS_KEY);
  return { sources: (made?.sources ?? []).map((s) => ({ name: s.name, url: s.url, group: s.lean || "intl", rating: s.rating })) };
});

export const Route = createFileRoute("/gaza-judea-samaria-desk_/sources")({
  head: () => ({
    meta: [
      { title: "Sources list · Gaza – Judea & Samaria Desk" },
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
  ["israel", "Israeli"],
  ["pa", "Palestinian Authority"],
  ["factions", "Hamas and the factions"],
  ["palestinian", "Palestinian"],
  ["arab", "Arab"],
  ["intl", "International"],
];

function SourcesPage() {
  const { sources } = Route.useLoaderData();
  return <SourcesList sources={sources} groups={GROUPS} back={{ href: "/gaza-judea-samaria-desk", label: "Back to the live desk" }} />;
}
