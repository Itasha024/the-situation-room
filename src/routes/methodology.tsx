import { createFileRoute } from "@tanstack/react-router";
import { DeskDoc } from "@/components/desk-doc";

/**
 * The site's one Methodology page (user, 17 Oct): each desk's methodologies under its name, the
 * Yemen desk's sources, control shares and map, the Iran desk's sources and map. public/app.js
 * fills it from the pop-ups' own texts (installMethodology), so the page and the pop-ups never differ.
 */
export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [{ title: "Methodology · The Situation Room" }],
  }),
  headers: () => ({
    "cache-control": "no-cache",
    "cdn-cache-control": "public, s-maxage=600, stale-while-revalidate=300",
  }),
  component: MethodologyPage,
});

function MethodologyPage() {
  return (
    <DeskDoc title="Methodology" back={{ href: "/", label: "Back to all desks" }}>
      <div id="meth-doc" />
    </DeskDoc>
  );
}
