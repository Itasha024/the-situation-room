import { createFileRoute } from "@tanstack/react-router";
import { DeskDoc, type DocSection } from "@/components/desk-doc";

/**
 * How the desk works, as principles: what it covers, whom it reads, how it
 * judges what it reads, and where it decides for itself. Not a rundown of the
 * build (user, 1 Oct): no counts, timings, models or code.
 */
export const Route = createFileRoute("/yemen-conflict-desk_/methodology")({
  head: () => ({ meta: [{ title: "Methodology · Yemen Conflict Desk" }] }),
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=60",
  }),
  component: MethodologyPage,
});

// Section ids must not repeat the live page's own (map, fronts, timeline…).
const SECTIONS: DocSection[] = [
  {
    id: "covers",
    title: "What we cover",
    html: `<p>This round of the war in Yemen, from the strike on Sanaa airport on 13 July 2026: the Houthis against the internationally recognised government and the Saudi-led coalition. That takes in the fighting inside Yemen, attacks on Saudi Arabia, attacks on shipping in the Red Sea, Bab al-Mandab and the Gulf of Aden, attacks on oil and energy sites, and what the parties and other governments say and decide about the war.</p>
<p>Wars next door are covered only where they touch this one. The confrontation between the United States and Iran, piracy off Somalia and events in the Gulf stay out, unless they bear directly on Yemen, the Houthis or Saudi energy.</p>`,
  },
  {
    id: "sources",
    title: "Our sources",
    html: `<p>We read every side: Houthi media and officials; the Yemeni government, its forces and the Saudi side; and outlets with no stake in the war, from the international wire agencies to regional and specialist press. We also follow governments, ministries, the UN and the naval and shipping authorities on their own channels.</p>
<p>Every source is marked by the side it speaks for, so a reader always knows whose account they are reading. We do not use Israeli outlets. We do not get round paywalls, logins or measures that keep automated readers out. Every report links to the original article or post, never to a copy.</p>`,
  },
  {
    id: "reporting",
    title: "How we report",
    html: `<p>For each item we ask what a wire editor would ask: is this our war, is it happening now, who did what to whom, and with what. We write the answer plainly and keep what the source says, no more and no less: no figure, place or claim that is not in it. When an item is unclear, we wait for more rather than guess. A late report is better than a wrong one.</p>
<p>AI helps us read and write at the speed the war moves, in Arabic, Persian and English. It works inside our editorial rules, and its work is checked against the source before it is published.</p>`,
  },
  {
    id: "originals",
    title: "Originals first",
    html: `<p>Much of what circulates is one outlet repeating another, or repeating an official. We go back to whoever spoke first: the ministry's own statement, the spokesman's own channel, the newspaper's own article. When the original cannot be found at once, we publish from the most reliable outlet carrying it and keep looking, and the original takes its place when we find it.</p>
<p>When several outlets tell the same event, it becomes one report, led by the best source, with the others listed beside it.</p>`,
  },
  {
    id: "claims",
    title: "Claims and confirmation",
    html: `<p>In a war each side claims more than it can prove. We keep a firm line between what a side says and what is established. One side's account is reported as that side's account. We treat an event as confirmed when an independent wire agency reports it, when both sides agree it happened, or when the side it hurt admits it. A statement is reported as having been made, not as being true.</p>`,
  },
  {
    id: "judgement",
    title: "Where we decide for ourselves",
    html: `<p>Some things no source settles for us, and we make the call. We decide:</p>
<ul>
<li>whether an item belongs to this war at all;</li>
<li>which side a source speaks for;</li>
<li>whether a claimed capture counts as ground taken, or only as an advance;</li>
<li>where on the map an event belongs, and how exactly we can place it;</li>
<li>which developments matter most in each overview;</li>
<li>which figures are official, and which are one side's.</li>
</ul>
<p>We make these calls by the same rules for every side, and when we are not sure, we leave a thing out or present it as a claim rather than as fact.</p>`,
  },
  {
    id: "places",
    title: "Places on the map",
    html: `<p>Every event is placed as exactly as the reports allow: on the village, hill or site when one is named, or in the district or governorate when only that is known. We check that a place fits the story; a name that also belongs to somewhere else does not move an event across a border. The colour of a mark is the side that acted.</p>`,
  },
  {
    id: "control",
    title: "Control of territory",
    html: `<p>The control map is our own assessment, district by district. Its starting lines draw on published research and maps of the front. A district changes hands on the map only when the capture is confirmed, in the sense above. A claim by one side, or ground taken that is short of the district itself, shows as contested or as an advance, not as a change of control. The shares at the top of the page are by area.</p>`,
  },
  {
    id: "front-areas",
    title: "Fronts",
    html: `<p>We follow the war by governorate, and by three areas that matter on their own: the Bab al-Mandab strait, the Red Sea coast, and Saudi Arabia. A governorate becomes a front when fighting starts there, and drops off when it goes quiet.</p>`,
  },
  {
    id: "overview",
    title: "The overview",
    html: `<p>Latest developments is rewritten every six hours from that period's reports alone. It gives the picture from above: the fighting first, then the sea and energy, then politics and diplomacy, each kept apart. It names places and sides, and leaves the detail to the reports and the fronts.</p>`,
  },
  {
    id: "numbers",
    title: "Numbers",
    html: `<p><b>Official</b> means official bodies only: UN agencies, the World Health Organization, ministries, governments, the coalition and civil defence. Every other figure is unofficial and shown under the side that gives it. Where the sides differ, we show both and never average them. We use only running totals for this round, each linked to where it was published; a cell nobody has published stays empty.</p>
<p>For the sea and energy we take official warnings and statements first, then the wire agencies; an attack that only one side reports is shown as unofficial. Ship traffic comes from satellite tracking of vessels and runs a few days behind; oil and export figures come out monthly.</p>`,
  },
  {
    id: "media",
    title: "Pictures and video",
    html: `<p>We show a picture or a video only when it shows the event itself, and only from the source the report came from. We leave out anything graphic, the faces of prisoners, propaganda, speeches and old footage.</p>`,
  },
  {
    id: "mistakes",
    title: "Mistakes",
    html: `<p>When we get something wrong, we correct it as soon as we find it, and we change the way we work so it does not happen again.</p>`,
  },
  {
    id: "limits",
    title: "What we cannot know",
    html: `<ul>
<li>We do not see the ground. We report what sources say and how far they can be trusted.</li>
<li>Some areas are covered by one side only. Houthi-held areas have little independent press.</li>
<li>Both sides inflate the other's losses and play down their own. Casualty counts are partial and come late.</li>
<li>Shipping and oil figures lag behind events.</li>
</ul>`,
  },
];

function MethodologyPage() {
  return (
    <DeskDoc
      title="Methodology"
      lede="How the Yemen Conflict Desk works: whom we read, how we judge what we read, where we decide for ourselves, and what we cannot know."
      sections={SECTIONS}
    />
  );
}
