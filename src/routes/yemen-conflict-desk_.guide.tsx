import { createFileRoute } from "@tanstack/react-router";
import { YemenGuide } from "@/components/yemen-guide";

/**
 * Who is who in Yemen's war (user, 26 Oct): the two camps, who holds what, the words, and the Yemen desk's
 * explainers in full by category. Reached from the Yemen desk.
 */
export const Route = createFileRoute("/yemen-conflict-desk_/guide")({
  head: () => ({
    meta: [
      { title: "Who is who in Yemen's war · Yemen desk" },
      { name: "description", content: "The Houthis and the recognised government, their leaders and backers, who holds which part of Yemen, and the background to the war." },
      { name: "robots", content: "noindex" },
    ],
  }),
  headers: () => ({
    "cache-control": "public, max-age=300",
    "cdn-cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
  }),
  component: YemenGuide,
});
