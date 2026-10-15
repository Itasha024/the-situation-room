import { createFileRoute } from "@tanstack/react-router";
import { MainDesk } from "@/components/main-desk";

/**
 * The front page (option C): the main desk, the whole region on one map and
 * one wire. The Yemen desk lives at /yemen-conflict-desk, the Iran desk at
 * /iran-conflict-desk.
 */
export const Route = createFileRoute("/")({
  component: MainDesk,
  head: () => ({
    meta: [
      { title: "The Situation Room: Yemen, Iran and the region, live" },
      {
        name: "description",
        content:
          "Live open-source reporting on the wars in Yemen and Iran on one map: Saudi Arabia, the Red Sea, Hormuz, Israel, Lebanon, Iraq and the Gulf, from every side's sources.",
      },
    ],
    links: [
      { rel: "stylesheet", href: "/main-desk.css?v=md-1" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" },
    ],
  }),
  // The page is a shell: its news comes from the cached APIs.
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=30",
  }),
});
