import { createFileRoute } from "@tanstack/react-router";
import { DeskDoc, type DocSection } from "@/components/desk-doc";

/** What the desk is and why a reader can trust it, from the reader's side (user, 1 Oct). The method is on /methodology. */
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
    html: `<p>The Yemen Conflict Desk follows the war in Yemen as it happens: what each side reports, where it happened, who holds which ground, and what the war is costing in lives, shipping and oil. It is part of The Situation Room.</p>`,
  },
  {
    id: "why",
    title: "Why it exists",
    html: `<p>News of this war is scattered and partisan: each side tells its own story, in its own channels, often in Arabic only. We bring it together in one place, in plain English, so you can see the whole picture and know whose account you are reading.</p>`,
  },
  {
    id: "trust",
    title: "What you can rely on",
    html: `<ul>
<li><b>Every side is heard.</b> We report the Houthis, the government and its allies, and independent outlets alike, and mark which side each source speaks for.</li>
<li><b>Claims stay claims.</b> What one side says is shown as that side's account. We call something confirmed only when independent sources or both sides back it.</li>
<li><b>From the original.</b> Every report links to where it was first published, so you can check it yourself.</li>
<li><b>Nothing added.</b> We do not add figures, places or claims that are not in the source.</li>
<li><b>Mistakes are fixed.</b> When we get something wrong, we correct it.</li>
</ul>`,
  },
  {
    id: "independence",
    title: "Independence",
    html: `<p>The desk takes no side in the war, and it does not use Israeli outlets. We use AI to keep up with a war reported in several languages around the clock, but the rules for what we publish are our own and apply the same way to every side.</p>
<p>More on how we work: <a href="${M}">Methodology</a>.</p>`,
  },
  {
    id: "contact",
    title: "Contact",
    html: `<p>A contact address for tips and corrections will be added here.</p>`,
  },
];

function AboutPage() {
  return (
    <DeskDoc
      title="About the desk"
      lede="The war in Yemen as it happens, from every side, with every account marked as such."
      sections={SECTIONS}
      toc={false}
    />
  );
}
