import { createFileRoute, notFound } from "@tanstack/react-router";

import { focusBySlug } from "@/lib/region";

/**
 * A country or sea page (option C): /yemen, /saudi-arabia, /red-sea, /iran,
 * /hormuz, /israel, /lebanon, /iraq, /gulf-states, /united-states. The main
 * desk with that place in focus, plus its figures (counts belong here, never
 * on the front page). Places without a page yet are not found.
 */
export const Route = createFileRoute("/_main/$place")({
  beforeLoad: ({ params }) => {
    const f = focusBySlug(params.place);
    if (!f || f.hidden) throw notFound();
  },
  component: () => null,
  head: ({ params }) => {
    const f = focusBySlug(params.place);
    if (!f) return {};
    const what = f.kind === "sea" ? "shipping, strikes and alerts" : f.kind === "actor" ? "strikes, sanctions and talks" : "strikes, fighting and diplomacy";
    return {
      meta: [
        { title: `${f.name}: live reports, map and figures | The Situation Room` },
        { name: "description", content: `${f.context} Live open-source reports on ${f.name}: ${what}, on one map, from every side's sources.` },
      ],
      links: [{ rel: "canonical", href: `https://thesituationroom.live/${f.slug}` }],
    };
  },
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=30",
  }),
});
