import { createFileRoute } from "@tanstack/react-router";
import { DeskDoc, type DocSection } from "@/components/desk-doc";

/**
 * How the desk works, written from what the code does (public/SOURCES.md,
 * src/lib/desk). Each section has an anchor the live page links to: a card's
 * certainty tag (#certainty), a pin's pop-up (#places), a district (#control),
 * the numbers (#numbers).
 */
export const Route = createFileRoute("/yemen-conflict-desk_/methodology")({
  head: () => ({ meta: [{ title: "Methodology · Yemen Conflict Desk" }] }),
  headers: () => ({
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=60",
  }),
  component: MethodologyPage,
});


const SECTIONS: DocSection[] = [
  {
    id: "covers",
    title: "What the desk covers",
    html: `<p>This round of the war in Yemen, from the strike on Sanaa airport on <b>13 July 2026</b>: the Houthis against the internationally recognised government and the Saudi-led coalition. That means the fighting inside Yemen, Houthi missile and drone attacks on Saudi Arabia, attacks on ships in the Red Sea, Bab al-Mandab and the Gulf of Aden, attacks on oil and energy sites, and the statements, talks and decisions about the war.</p>
<p>Left out: the US–Iran war, unless a report ties it to Yemen or the Houthis; piracy by unidentified or Somali gunmen; the Strait of Hormuz and the Gulf, unless it concerns Saudi oil moving between the Gulf and the Red Sea, or Iran and the Houthis speaking about each other.</p>`,
  },
  {
    id: "sources",
    title: "Sources",
    html: `<p>The desk reads a fixed list of sources, chosen by its editor to cover every side: Houthi media and officials (Al-Masirah, Saba, the Houthi military spokesman), the government and Saudi side (SPA, the Yemeni army and ministries, Almashhad, Al Arabiya, Al Hadath), and outlets with no declared side (Reuters, AP, AFP, Al Jazeera, The New York Times and others). It also reads governments, ministries, the UN and the EU on their own accounts, and, for the sea and energy, UKMTO, the Saudi Energy Ministry, Kpler and the shipping press.</p>
<ul>
<li><b>Telegram</b> channels every 5 minutes; <b>X</b> accounts every 5 to 30 minutes, read through FxTwitter's open service; <b>websites</b> read whole from their feeds or sitemaps every 5 to 30 minutes.</li>
<li>Sites that turn automated readers away are reached only through Google News search results. The desk never gets round paywalls, bot checks or logins.</li>
<li><b>No Israeli outlets.</b> Every card links to the original article or post, never to a copy.</li>
<li>Each source's side is marked on its cards by colour: Houthi-aligned, government or Saudi-aligned, or no declared alignment.</li>
</ul>`,
  },
  {
    id: "reading",
    title: "How a post becomes a report",
    html: `<ol>
<li><b>A first filter</b> keeps posts about the war: places, sides, weapons and events. Sermons, rallies, ceremonies, adverts and repeats are dropped. Everything read, kept or dropped, is listed in the page's "Live scan" box with the reason.</li>
<li><b>An AI reader</b> reads each post as a wire editor would: is this our war, is it happening now, who did what to whom, with what. It then writes the card in plain English. The desk uses only free tiers: Google's Gemini and Gemma models, and open models (OpenAI's gpt-oss and Alibaba's Qwen) hosted by Groq.</li>
<li><b>Code checks the card</b> before it is published: every figure must appear in the source, a statement must lead with its speaker, and there is no filler. A card that fails the check is not published. Without a clear reading, the post waits for the next scan. A late report is better than a wrong one.</li>
</ol>`,
  },
  {
    id: "originals",
    title: "Relays and originals",
    html: `<p>Many posts pass on someone else's words ("the WSJ reports", "the Egyptian foreign ministry said"). The desk looks for the original: the body's own X account or website, its national news agency, the wires. It tries on the next three scans (about 15 minutes). If the original is not found, the card is published from a major outlet that carries the statement (a wire or the country's agency), and only if there is none, from the relay, marked "citing". The search goes on for 24 hours, and the original replaces the relay when it is found. An original found at a site the desk did not read becomes one of its sources.</p>`,
  },
  {
    id: "merging",
    title: "One card per event",
    html: `<p>Several outlets telling the same event become one card, written from every account. The lead source is the most fitting one: the speaker's own channel, then an official outlet, then the original of a relay, then an agency. The others are listed under "Also", as links. A later report that adds to an earlier one shows "Follows" and links back to it.</p>`,
  },
  {
    id: "certainty",
    title: "Certainty labels",
    html: `<p>Every card carries a label saying how sure the desk can be, from who carries it:</p>
<ul>
<li><b>Confirmed</b>: carried by a wire agency (Reuters, AP, AFP, Bloomberg), by UKMTO or the UN, or by outlets of both sides.</li>
<li><b>Several outlets</b>: carried by two or more outlets with no declared side, but not yet by a wire or by both sides.</li>
<li><b>One side's claim</b>: only outlets of one side report it so far.</li>
<li><b>Single source</b>: one outlet with no declared side reports it so far.</li>
<li><b>Statement</b>: what someone said. The desk reports that it was said, not that it is true.</li>
</ul>
<p>A label can change as more outlets report the event. The same idea decides control of a district, and whether a capture is drawn with a flag (see <a href="#control">Control map</a>). The labels follow the grading used by casualty recorders such as Airwars ("confirmed", "fair", "single source", "contested").</p>`,
  },
  {
    id: "places",
    title: "Places and pins",
    html: `<p>A report's place is looked up in the desk's own list of Yemeni and Saudi places, then in OpenStreetMap. Checks keep a pin honest:</p>
<ul>
<li>A place outside Yemen is used only when the text names Saudi Arabia or a Saudi place (a Yemeni hill with the name of a Saudi one is not in Saudi Arabia).</li>
<li>The place must lie in the governorate the report names; a namesake elsewhere is refused.</li>
<li>When a report's body names a more exact place than its dateline, the pin goes on the body's place.</li>
<li>A ship is drawn only at sea or in a port, never inland. A ground event is never drawn at sea.</li>
</ul>
<p>Each pin's pop-up says how exact it is, as ACLED does: <b>named place</b> (a village, hill, base or site), <b>district</b>, <b>governorate or city</b> (the pin is at its centre), or <b>at sea, approximate</b> (placed from the distance and bearing given).</p>`,
  },
  {
    id: "map-icons",
    title: "Map icons",
    html: `<p>The main map has four kinds of pins: <b>ground fighting</b> (crossed swords), <b>launch, strike or alert</b> (a rocket), <b>maritime incident</b> (a ship) and <b>energy incident</b> (an attack on an oil, gas or port site). Statements stay in the feed.</p>
<p>The maps of Latest developments and of each front draw what happened in that update, in the colour of the side that acted: ground taken (a flag, only when confirmed), advance (an arrow towards the other side's lines), ground fighting, attack repelled, air strike, shelling, missile, drone, interception (shot down in mid-air), attack on a ship, energy site hit (a burning tank) and sirens. A missile or drone flies in from its launch area when the reports name it.</p>`,
  },
  {
    id: "control",
    title: "Control map",
    html: `<p>Control is shaded by district. The starting lines, as of 24 September 2026, come from Wikipedia's page on the 2026 Yemen offensives, Majalla, The National, Al Jazeera and the desk's own reading of the reports, over the lines before September drawn from the Sanaa Center, ACLED and Critical Threats maps. A district with no report of its own takes its governorate's control.</p>
<p>Every 6 hours the desk reads that window's reports against the districts they fall in:</p>
<ul>
<li><b>Taken</b>: two or more outlets from different sides, or a wire agency, report the capture of the district's town or of the district itself. The district changes hands.</li>
<li><b>Contested</b>: only one side reports it, both sides claim ground there, or what was taken is positions, heights or villages rather than the district.</li>
</ul>
<p>On the developments maps a capture keeps its flag only under the same rule; anything less is drawn as an advance. Clicking a district shows its control, the day it last changed, the note and its sources. The shares at the top of the page are the shaded area in square kilometres, district by district, from the geoBoundaries district borders.</p>`,
  },
  {
    id: "front-areas",
    title: "Fronts",
    html: `<p>A front is a governorate, plus three areas of their own: the <b>Bab al-Mandab</b> strait (Dhubab, Perim, the Lahj coast and the strait's waters), the <b>Red Sea coast</b> from Mocha to Hodeidah and its waters, and <b>Saudi Arabia</b>. A report belongs to the front of the district its pin sits in. A report with no pin joins a front only when its text names exactly one governorate. When fighting clusters in a governorate no front covers, a new front opens for it, and it closes after a week with nothing reported. Each front's map shows only what happened inside its own area.</p>`,
  },
  {
    id: "developments",
    title: "Latest developments",
    html: `<p>Written by AI every 6 hours, at 00:00, 06:00, 12:00 and 18:00 Israel time, from that window's cards only. It opens with the battle seen from above (the ground fronts, then strikes, missiles and drones), then the sea and energy, and then, in a paragraph of its own, the political, diplomatic and economic news. Code keeps that order if the model mixes it. The text is written a few minutes before the hour by the strongest free model available and published on the hour. Its map marks come from the cards; a place the text names is drawn only within 40 km of a card's pin of that window.</p>`,
  },
  {
    id: "numbers",
    title: "The conflict in numbers",
    html: `<p><b>Casualties.</b> The <b>Official</b> column holds figures from official bodies only: UN agencies, the WHO, ministries, governments, the coalition, civil defence and health authorities. Everything else is <b>unofficial</b> and shown under the side that states it (Houthi sources, or government and Saudi sources). A journalist's or an outlet's count is never official. A figure without a side is left out.</p>
<ul>
<li>Only running totals for this round count. A day's or one battle's toll is not a total.</li>
<li>The figure must be in the source's own text, and each figure links to it. An official figure read on another site says "via" that site; the desk looks for the body's own report first (on ReliefWeb for the UN and the WHO).</li>
<li>In each cell the newest figure stands. Where the sides differ, both are shown and never averaged. An empty cell means no one has published that figure.</li>
<li>"How each figure is counted", under each box, gives every figure's source, date and what it covers.</li>
</ul>
<p><b>Maritime.</b> Attacks on ships come from UKMTO's own warnings (posted as pictures, which an AI model reads into text), official statements and the wires; anything else is marked unofficial. Ship counts through Bab al-Mandab and the Suez Canal come from IMF PortWatch, which counts ships from their satellite position signals; its figures are 3 to 4 days behind and can be revised. "Before conflict" is the average of 13 June to 12 July. Oil through Bab al-Mandab is Kpler's monthly estimate, as reported.</p>
<p><b>Energy.</b> Attacks on energy sites come from the Saudi Energy Ministry, the Saudi Press Agency and the wires; a hit reported only by the Houthi side is unofficial. A site's status (working, reduced, down, unknown) is the latest word on it. Saudi exports are the kingdom's own monthly figures (JODI) and Kpler's, as reported by Reuters. The oil price is the daily Brent price from the US Energy Information Administration.</p>
<p>These numbers are read again every 6 hours.</p>`,
  },
  {
    id: "timeline-media",
    title: "Timeline, media and time",
    html: `<p><b>Timeline.</b> The earlier phases of the round are written once and do not change. The present phase is rewritten every three days: how the round began, what changed and where it stands.</p>
<p><b>Pictures and video</b> come only from the post a card was written from, and only when they show the event: launches, strikes and impacts, interceptions, a ship hit, battlefield footage, damage to a named site, satellite images and front-line maps. Left out: speeches, logos and "breaking" cards, portraits and meetings, the wounded, anything graphic, prisoners' faces, file footage and montages. An AI model looks at each still before it is shown.</p>
<p><b>Time.</b> Every time on the page is in your own time zone. The clock at the top is the time in Yemen. The 6-hour updates run on Israel time (00:00, 06:00, 12:00 and 18:00).</p>`,
  },
  {
    id: "limits",
    title: "What the desk cannot know",
    html: `<ul>
<li>The desk does not see the ground. It reports what sources say and marks how sure it can be.</li>
<li>Some areas are covered by one side only. Houthi-held areas have little independent press, so much of what happens there is known only from Houthi media.</li>
<li>Both sides inflate the other's losses and play down their own. Casualty counts are partial, differ between sources and come late.</li>
<li>Ship counts are 3 to 4 days behind, and oil and export figures come out once a month.</li>
<li>The AI reader can misread a report. Code checks catch many mistakes; the rest are fixed when found.</li>
</ul>`,
  },
];

function MethodologyPage() {
  return (
    <DeskDoc
      title="Methodology"
      lede="How the Yemen Conflict Desk finds, checks and shows what happens in the war: its sources, how a post becomes a report, how sure each report is, and what the desk cannot know."
      sections={SECTIONS}
    />
  );
}
