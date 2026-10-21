import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type SourceRow, SourcesList } from "@/components/sources-list";

/**
 * The Iran desk's sources by its six filter groups, each with its 1–5 rating
 * (user, 22 Oct), made once a day as the Yemen desk's (source-rating.ts).
 * Reached from the "Source ratings" link beside the reports' sources filter.
 */
const loadRatings = createServerFn({ method: "GET" }).handler(async (): Promise<{ sources: SourceRow[] }> => {
  const { getStore } = await import("@/lib/desk/store");
  const { IRAN_RATINGS_KEY } = await import("@/lib/desk/source-rating");
  const store = await getStore();
  const made = await store.getJson<{ sources: { name: string; url: string; lean?: string; rating: number }[] }>(IRAN_RATINGS_KEY);
  return { sources: (made?.sources ?? []).map((s) => ({ name: s.name, url: s.url, group: s.lean || "intl", rating: s.rating })) };
});

export const Route = createFileRoute("/iran-conflict-desk_/sources")({
  head: () => ({
    meta: [
      { title: "Sources list · Iran Conflict Desk" },
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
  ["axis", "Iran and Axis-aligned"],
  ["opposition", "Iranian opposition"],
  ["israel", "Israeli"],
  ["us", "US"],
  ["gulf", "Gulf and Arab"],
  ["intl", "International"],
];

function SourcesPage() {
  const { sources } = Route.useLoaderData();
  return <SourcesList sources={sources} groups={GROUPS} back={{ href: "/iran-conflict-desk", label: "Back to the live desk" }} />;
}
