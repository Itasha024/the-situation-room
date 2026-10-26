import { createFileRoute } from "@tanstack/react-router";
import { PaGuide } from "@/components/pa-guide";

/**
 * How the Palestinian side is built (user, 26 Oct): the PLO, the PA and its security services, Fatah and the
 * Tanzim, Hamas, Islamic Jihad and the other factions, the elections. Reached from the Gaza desk.
 */
export const Route = createFileRoute("/gaza-judea-samaria-desk_/guide")({
  head: () => ({
    meta: [
      { title: "How the Palestinian side is built · Gaza – Judea & Samaria" },
      { name: "description", content: "The PLO, the Palestinian Authority and its security services, Fatah and the Tanzim, Hamas, Islamic Jihad and the other factions, and the elections." },
      { name: "robots", content: "noindex" },
    ],
  }),
  headers: () => ({
    "cache-control": "public, max-age=300",
    "cdn-cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
  }),
  component: PaGuide,
});
