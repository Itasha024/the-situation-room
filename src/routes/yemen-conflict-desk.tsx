import { createFileRoute } from "@tanstack/react-router";
import { YemenDesk } from "@/components/yemen-desk";

/**
 * The Yemen desk at thesituationroom.live/yemen-conflict-desk. Each desk has its own
 * path: its headline, lower-case, with "-" between the words.
 */
export const Route = createFileRoute("/yemen-conflict-desk")({
  component: YemenDeskPage,
  // The page is a shell: its news comes from the cached APIs.
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=30",
  }),
});

function YemenDeskPage() {
  return <YemenDesk />;
}
