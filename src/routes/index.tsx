import { createFileRoute } from "@tanstack/react-router";
import { YemenDesk } from "@/components/yemen-desk";

export const Route = createFileRoute("/")({
  component: Home,
  // The page is a shell: its news comes from the cached APIs. Rendered once
  // an hour at the edge instead of once per visit (Vercel bills the CPU), and
  // a deploy clears it.
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
  }),
});

function Home() {
  return <YemenDesk />;
}
