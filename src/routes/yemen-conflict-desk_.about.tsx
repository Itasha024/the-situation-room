import { createFileRoute } from "@tanstack/react-router";
import { DeskDoc, type DocSection } from "@/components/desk-doc";

/** What the desk is, for whom, and how it keeps itself honest. The full method is on /methodology. */
export const Route = createFileRoute("/yemen-conflict-desk_/about")({
  head: () => ({ meta: [{ title: "About · Yemen Conflict Desk" }] }),
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=60",
  }),
  component: AboutPage,
});

const M = "/yemen-conflict-desk/methodology";

const SECTIONS: DocSection[] = [
  {
    id: "what",
    title: "What it is",
    html: `<p>The Yemen Conflict Desk is a live, open-source picture of the war in Yemen, from the strike on Sanaa airport on 13 July 2026. In one page it brings the latest reports from every side, a map of what happened where, who controls each district, the fronts, the casualty, shipping and energy numbers, and a timeline. It is part of The Situation Room.</p>`,
  },
  {
    id: "why",
    title: "Why, and for whom",
    html: `<p>News of this war is scattered across Telegram channels, X accounts and sites in Arabic and English, each speaking for one side. The desk reads them all, says who is saying what, and shows how sure it can be. It is for journalists, researchers, analysts and anyone who wants to follow the war without taking one side's word for it.</p>`,
  },
  {
    id: "how",
    title: "How it works, in short",
    html: `<ul>
<li>A fixed list of sources from every side is read every 5 to 30 minutes (<a href="${M}#sources">Sources</a>).</li>
<li>An AI reader writes each report in plain English, and code checks it before it is published: every figure must be in the source (<a href="${M}#reading">How a post becomes a report</a>).</li>
<li>A statement is published from the body that made it, not from the outlet that passed it on (<a href="${M}#originals">Relays and originals</a>).</li>
<li>Every card says how sure it is: confirmed, several outlets, one side's claim, single source, or a statement (<a href="${M}#certainty">Certainty labels</a>).</li>
<li>Control changes only when both sides or a wire agency report it (<a href="${M}#control">Control map</a>).</li>
<li>The overview, the fronts, the maps and the numbers are brought up to date every 6 hours; the reports and the map pins as they come in.</li>
</ul>
<p>The full method: <a href="${M}">Methodology</a>.</p>`,
  },
  {
    id: "independence",
    title: "Independence",
    html: `<ul>
<li>The desk shows sources of every side and marks each one's side on its cards. It takes no side itself.</li>
<li>No Israeli outlets. Every card links to the original article or post.</li>
<li>It never gets round paywalls, bot checks or logins, and it uses only free tools and the free tiers of AI models.</li>
<li>Official figures come from official bodies only; everyone else's are shown as that side's.</li>
</ul>`,
  },
  {
    id: "ai",
    title: "How AI is used",
    html: `<p>AI models read the posts, write the reports, write the 6-hourly overview, read UKMTO's warnings off their pictures and look at pictures before they are shown. They do not decide control of a district or which figures are official: fixed rules in code do that, and code checks the models' work before anything is published. Models can still misread a report; mistakes are fixed when found.</p>`,
  },
  {
    id: "contact",
    title: "Contact",
    html: `<p>A contact address for tips and mistakes will be added here.</p>`,
  },
];

function AboutPage() {
  return (
    <DeskDoc
      title="About the desk"
      lede="A live, open-source picture of the war in Yemen: every side's reports, the map, control, the fronts and the numbers, with how sure each piece is."
      sections={SECTIONS}
      toc={false}
    />
  );
}
