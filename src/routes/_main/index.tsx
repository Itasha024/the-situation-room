import { createFileRoute, redirect } from "@tanstack/react-router";

import { focusBySlug } from "@/lib/region";

/**
 * The front page (option C): the main desk, the whole region on one map and
 * one wire. The Yemen desk lives at /yemen-conflict-desk, the Iran desk at
 * /iran-conflict-desk; each country and sea at its own address (/lebanon).
 */
export const Route = createFileRoute("/_main/")({
  // The first build marked a place as /?focus=lebanon: it has its own address now.
  beforeLoad: ({ location }) => {
    const slug = (location.search as Record<string, unknown>).focus;
    const f = typeof slug === "string" ? focusBySlug(slug) : undefined;
    if (f && !f.hidden) throw redirect({ to: "/$place", params: { place: f.slug }, statusCode: 301 });
  },
  component: () => null,
  head: () => ({
    meta: [
      { title: "The Situation Room: Yemen, Iran and the region, live" },
      {
        name: "description",
        content:
          "Live open-source reporting on the wars in Yemen and Iran on one map: Saudi Arabia, the Red Sea, Hormuz, Israel, Lebanon, Iraq and the Gulf, from every side's sources.",
      },
    ],
  }),
  // The page is a shell: its news comes from the cached APIs.
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=30",
  }),
});
