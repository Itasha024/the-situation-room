import { createFileRoute } from "@tanstack/react-router";
import { IranDesk } from "@/components/iran-desk";
import { deskById } from "@/lib/desks";

/**
 * The Iran desk at thesituationroom.live/iran-conflict-desk (Round 30). Open to
 * anyone with the link while it is built; in the menus only once it is ready.
 */
const desk = deskById("iran");

export const Route = createFileRoute("/iran-conflict-desk")({
  head: () => ({
    meta: [{ title: desk.name }, { name: "description", content: desk.description }],
  }),
  component: IranDeskPage,
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=30",
  }),
});

function IranDeskPage() {
  return <IranDesk />;
}
