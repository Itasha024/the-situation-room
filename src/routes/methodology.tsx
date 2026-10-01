import { createFileRoute } from "@tanstack/react-router";
import { DeskDoc, type DocSection } from "@/components/desk-doc";

/**
 * How every desk on the site works, as principles: whom we read, how we judge
 * what we read, and where we decide for ourselves. Site-wide, so it names no
 * one war (user, 1 Oct), and it is not a rundown of the build: no counts,
 * timings, models or code.
 */
export const Route = createFileRoute("/methodology")({
  head: () => ({ meta: [{ title: "Methodology · The Situation Room" }] }),
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=60",
  }),
  component: MethodologyPage,
});

// Section ids must not repeat a desk page's own (map, fronts, timeline…).
const SECTIONS: DocSection[] = [
  {
    id: "covers",
    title: "What we cover",
    html: `<p>Each desk follows one subject in one part of the world, from a set date, and keeps to it. Where the subject is a war, that means the fighting, attacks beyond its borders, and what the sides and other governments say and decide about it.</p>
<p>Events elsewhere are covered only where they bear on the desk's own subject.</p>`,
  },
  {
    id: "sources",
    title: "Our sources",
    html: `<p>We read every side: each party's own media and officials, and outlets with no stake in the matter, from the international wire agencies to regional and specialist press. We also follow governments, ministries, the UN and other official bodies on their own channels.</p>
<p>Every source is marked by the side it speaks for, so a reader always knows whose account they are reading.</p>`,
  },
  {
    id: "claims",
    title: "Claims and confirmation",
    html: `<p>The sides in a dispute often claim more than they can prove. We keep a firm line between what a side says and what is established. One side's account is reported as that side's account. We treat an event as confirmed when an independent wire agency reports it, when both sides agree it happened, or when the side it hurt admits it. A statement is reported as having been made, not as being true.</p>`,
  },
  {
    id: "judgement",
    title: "Where we decide for ourselves",
    html: `<p>Some things no source settles for us, and we make the call. We decide:</p>
<ul>
<li>whether an item belongs to the subject a desk follows;</li>
<li>which side a source speaks for;</li>
<li>where a desk follows fighting, whether a claimed capture counts as ground taken, or only as an advance;</li>
<li>where on the map an event belongs, and how exactly we can place it;</li>
<li>which developments matter most in each overview;</li>
<li>which figures are official, and which are one side's.</li>
</ul>
<p>We make these calls by the same rules for every side, and when we are not sure, we leave a thing out or present it as a claim rather than as fact.</p>`,
  },
  {
    id: "places",
    title: "Places on the map",
    html: `<p>Every event is placed as exactly as the reports allow: on the village, hill or site when one is named, or in the district or province when only that is known. We check that a place fits the story; a name that also belongs to somewhere else does not move an event across a border. The colour of a mark is the side that acted.</p>`,
  },
  {
    id: "control",
    title: "Control of territory",
    html: `<p>Where a desk maps who holds the ground, the map is our own assessment, area by area. Its starting lines draw on published research and maps of the front. An area changes hands on the map only when the capture is confirmed, in the sense above. A claim by one side, or ground taken short of the area itself, shows as contested or as an advance, not as a change of control.</p>`,
  },
  {
    id: "front-areas",
    title: "Fronts",
    html: `<p>Where a desk follows fighting, it splits it into fronts: provinces, and places that matter on their own, such as a strait or a coast. An area becomes a front when fighting starts there, and drops off when it goes quiet.</p>`,
  },
  {
    id: "overview",
    title: "The overview",
    html: `<p>Latest developments is rewritten at fixed times through the day, from that period's reports alone. It gives the picture from above, names places and sides, and leaves the detail to the reports and the fronts.</p>`,
  },
  {
    id: "numbers",
    title: "Numbers",
    html: `<p><b>Official</b> means official bodies only: UN agencies, the World Health Organization, ministries, governments, armed forces and civil defence. Every other figure is unofficial and shown under the side that gives it. Where the sides differ, we show both and never average them. We use only running totals for the period a desk covers, each linked to where it was published; a figure nobody has published stays empty.</p>
<p>For shipping, energy and the like, we take official warnings and statements first, then the wire agencies; an attack that only one side reports is shown as unofficial.</p>`,
  },
  {
    id: "limits",
    title: "What we cannot know",
    html: `<ul>
<li>We do not see the ground. We report what sources say and how far they can be trusted.</li>
<li>Some areas are covered by one side only, with little independent press.</li>
<li>Sides in a conflict tend to inflate the other's losses and play down their own. Casualty counts are partial and come late.</li>
<li>Some figures, such as shipping and trade, come out days or weeks after the events.</li>
</ul>`,
  },
];

function MethodologyPage() {
  return (
    <DeskDoc
      title="Methodology"
      lede="How our desks work: whom we read, how we judge what we read, where we decide for ourselves, and what we cannot know."
      sections={SECTIONS}
      desk={false}
    />
  );
}
