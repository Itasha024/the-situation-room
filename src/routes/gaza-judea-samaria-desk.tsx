import { createFileRoute } from "@tanstack/react-router";
import { GazaDesk } from "@/components/gaza-desk";
import { deskById } from "@/lib/desks";

/**
 * The Gaza – Judea & Samaria desk (user, 23 Oct). Being built: out of the menus and search engines
 * until it is switched on; its page opens by its address.
 */
const desk = deskById("gaza");

export const Route = createFileRoute("/gaza-judea-samaria-desk")({
  head: () => ({
    meta: [{ title: desk.name }, { name: "description", content: desk.description }, ...(desk.hidden ? [{ name: "robots", content: "noindex" }] : [])],
  }),
  component: GazaDeskPage,
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=3600",
  }),
});

function GazaDeskPage() {
  return <GazaDesk />;
}
