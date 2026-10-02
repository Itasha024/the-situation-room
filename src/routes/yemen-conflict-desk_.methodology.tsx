import { createFileRoute } from "@tanstack/react-router";
import { DeskDoc } from "@/components/desk-doc";

/**
 * The desk's Methodology page, under the desk in the menu (user, 2 Oct): the
 * Sources reliability, Control share and Map methodologies, one after another.
 * public/app.js fills it from the pop-ups' own texts (installMethodology).
 */
export const Route = createFileRoute("/yemen-conflict-desk_/methodology")({
  head: () => ({
    meta: [{ title: "Methodology · Yemen Conflict Desk" }],
  }),
  // Never kept by the browser: an old "no page here" copy from before this page existed stayed on a PC (user, 2 Oct).
  headers: () => ({
    "cache-control": "no-cache",
    "cdn-cache-control": "public, s-maxage=600, stale-while-revalidate=300",
  }),
  component: MethodologyPage,
});

function MethodologyPage() {
  return (
    <DeskDoc title="Methodology">
      <div id="meth-doc" />
    </DeskDoc>
  );
}
