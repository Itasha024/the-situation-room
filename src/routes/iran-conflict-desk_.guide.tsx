import { createFileRoute } from "@tanstack/react-router";
import { IranGuide } from "@/components/iran-guide";

/**
 * How Iran is ruled and fights (user, 26 Oct): the Supreme Leader and the councils, the IRGC and the army, the
 * axis, and the desk's explainers. Reached from the Iran desk.
 */
export const Route = createFileRoute("/iran-conflict-desk_/guide")({
  head: () => ({
    meta: [
      { title: "How Iran is ruled and fights · Iran desk" },
      { name: "description", content: "The Supreme Leader and the councils, the Revolutionary Guards and the army, the axis of resistance, the nuclear programme, missiles and oil." },
      { name: "robots", content: "noindex" },
    ],
  }),
  headers: () => ({
    "cache-control": "public, max-age=300",
    "cdn-cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
  }),
  component: IranGuide,
});
