import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { MainDesk } from "@/components/main-desk";
import { focusBySlug } from "@/lib/region";

/**
 * The main desk (option C) and its country and sea pages share one page, so
 * moving from / to /lebanon flies the map instead of loading a new one.
 */
export const Route = createFileRoute("/_main")({
  component: MainLayout,
  head: () => ({
    links: [
      { rel: "stylesheet", href: "/main-desk.css?v=md-2" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" },
    ],
  }),
});

function MainLayout() {
  const { place } = useParams({ strict: false }) as { place?: string };
  const f = place ? focusBySlug(place) : undefined;
  return (
    <>
      <MainDesk focus={f && !f.hidden ? f.id : "region"} />
      <Outlet />
    </>
  );
}
