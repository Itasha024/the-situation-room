import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ASSET_V } from "@/lib/asset-version";

/**
 * The home page (user, 17 Oct: Mock G): every desk on one map, the latest
 * developments and the stories to follow. public/home.js draws it from the
 * live feeds; picking a desk turns the page into that desk in place.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Situation Room" },
      {
        name: "description",
        content:
          "Live open-source reporting on the wars with Iran and in Yemen: strikes on every side, the Strait of Hormuz, the Red Sea, oil and the talks, from every side's sources.",
      },
    ],
    links: [
      { rel: "stylesheet", href: `/home.css?v=${ASSET_V}` },
      // The page's script and the two desks' data start with the page, not after the app is up
      // (user, 18 Oct: a first visit waited seconds for the pins).
      { rel: "preload", as: "script", href: `/home.js?v=${ASSET_V}` },
      { rel: "preload", as: "fetch", href: "/api/desk?desk=iran", crossOrigin: "anonymous" },
      { rel: "preload", as: "fetch", href: "/api/desk?desk=yemen", crossOrigin: "anonymous" },
    ],
  }),
  component: Home,
  // The page is a shell: its news comes from the cached APIs.
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=3600",
  }),
});

declare global {
  interface Window {
    startHome?: () => Promise<void>;
  }
}

function Home() {
  useEffect(() => {
    if (window.startHome) {
      void window.startHome();
      return;
    }
    if (document.getElementById("home-js")) return;
    const s = document.createElement("script");
    s.id = "home-js";
    s.src = `/home.js?v=${ASSET_V}`;
    document.body.appendChild(s);
  }, []);

  return <div id="home-root" className="home-root" suppressHydrationWarning />;
}
