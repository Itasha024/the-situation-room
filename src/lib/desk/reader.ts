/**
 * The reading layer. Server-only.
 *
 * WHY THIS EXISTS: the deterministic composer decides what a report says from
 * keyword matches, and keywords cannot answer the questions that decide whether
 * a report is true. It published a programme clip titled "Marib and Taiz: the
 * battle map" as clashes happening now; an IRGC shoot-down over Hormuz as a
 * Houthi action; Pakistani casualties as this war's; artillery fire as air
 * strikes; the air bases Saudi jets took off from as the targets they hit.
 *
 * So a model reads each item and answers, per item, as a wire editor would:
 * is this our conflict, is it happening now, who did what to whom, with what —
 * and writes the report. Then code checks the answer (`checkReading`) before
 * anything is published: every figure must be in the source, no filler, no
 * sourcing labels, a statement must lead with its speaker. What fails the
 * check is not published.
 *
 * Without a verdict, nothing is published: the item waits and is retried on
 * the next cycle. A wrong report is worse than a late one.
 */

import { createHash } from "node:crypto";
import { calendarHints, findCalendarDates } from "./calendars.ts";
import { SPELLING_RULES, spellingHints } from "./spelling.ts";

export type ReaderItem = {
  id: string;
  source: string;
  /** "Houthi-aligned", "Saudi/government-aligned", "no declared alignment". */
  alignment: string;
  postedAt: string;
  text: string;
  /** An original article read in full: the model reads all of it, not its top. */
  full?: boolean;
  /** A repair: what the model's earlier copy of this item failed. */
  fix?: string;
};

export type EventType =
  | "air_strike"
  | "shelling"
  | "missile_launch"
  | "drone_attack"
  | "interception"
  | "ground_clash"
  | "advance_or_capture"
  | "air_raid_alert"
  | "maritime_attack"
  | "statement"
  | "diplomacy"
  | "economy";

export type Reading = {
  id: string;
  publish: boolean;
  /** Why not, in a few words, when publish is false. */
  reject_reason: string;
  event_type: EventType;
  /** False when origin and target cannot be told apart with confidence. */
  confident_roles: boolean;
  actor: string | null;
  /** Whose side acted or spoke; decides "Houthi" vs "Yemeni government" wording. */
  actor_side?: "houthi" | "government" | "stc" | "saudi" | "other" | "unclear" | "iran" | "hezbollah" | "iraqi_militias" | "us" | "israel" | "gulf";
  /** The Iran desk's arenas this item belongs to, by subject (iran-reader.ts). */
  arenas?: string[];
  /** English names of the places struck, or where the event happened. */
  targets: string[];
  /** English names of places a weapon or aircraft came FROM. Never pinned. */
  origins: string[];
  /** How a statement card opens: "Trump", "Yemen's defence minister". */
  speaker_lead: string | null;
  /** Does the report favour the side of the outlet carrying it? */
  interest: "for" | "against" | "neutral";
  has_time: boolean;
  headline: string;
  body: string;
  /**
   * The ref of an already-published report this item directly develops (the
   * same incident: its toll, its aftermath, a response to that exact attack),
   * or "". Resolved to that report's fp before the reading is cached.
   */
  follows_up?: string;
  /** The fp of a published report telling this same event with nothing new: this item joins its "Also". */
  duplicate_of?: string;
};

/**
 * What one desk's reader is told and must answer in: its instructions, its
 * answer's shape, and its list of sides (anything else a model says is mapped
 * onto it). The Yemen desk's is the default everywhere (Round 30).
 */
export type ReaderPrompt = { system: string; schema: object; sides: readonly string[]; side: (word: string) => string };

/** A report already on the desk, shown to the reader so it can spot follow-ups. */
export type RecentReport = { ref: string; at: string; headline: string };

/**
 * Tried in order. The free tier allows about 20 requests a day PER MODEL, so
 * the chain is the daily budget: lite models first (they read the audit cases
 * correctly and their quota goes further), the full model last.
 */
export const READER_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  // Each has its own free daily quota (about 20 calls). The two newest Flash
  // models are kept for the 6-hour update alone (models.ts): when the lite
  // models ran out by evening the reader took them, and every update after
  // that was written by a lite model (1 Oct). Groq reads after this one.
  "gemini-3.5-flash",
];
/**
 * The stronger reader for a second look at a rejected field report, and what to
 * fall back to. A single model here meant that once its free quota was gone the
 * second look stopped happening at all — silently, for the rest of the day — and
 * the desk lost exactly the reports this pass exists to catch.
 */
// The three newest Flash models come last: they write the 6-hour update, and
// a second look that led with them spent their small daily quota by evening,
// so the update was always written by a lite model (29 Sep).
export const SECOND_LOOK_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
];
/** Items per model call — large, because calls are what the quota counts. */
export const READER_BATCH = 30;

/** When Google's free daily quota resets: the next midnight in California. */
export function nextPacificMidnight(now: number): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(now));
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
  const since = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000;
  return now - since + 86_400_000 + 60_000;
}

/** The day in California, the quota's day. */
export function pacificDay(now: number): string {
  return new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}
/** An original article is read to this length: its key fact may be deep in it. */
export const FULL_TEXT_MAX = 8000;

/** The answer's shape, enforced by the API so a reply always parses. */
export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          publish: { type: "BOOLEAN" },
          reject_reason: { type: "STRING" },
          event_type: {
            type: "STRING",
            enum: [
              "air_strike", "shelling", "missile_launch", "drone_attack", "interception", "ground_clash",
              "advance_or_capture", "air_raid_alert", "maritime_attack", "statement", "diplomacy", "economy",
            ],
          },
          confident_roles: { type: "BOOLEAN" },
          actor: { type: "STRING", nullable: true },
          actor_side: { type: "STRING", enum: ["houthi", "government", "stc", "saudi", "other", "unclear"] },
          targets: { type: "ARRAY", items: { type: "STRING" } },
          origins: { type: "ARRAY", items: { type: "STRING" } },
          // Required and never null: an optional field is one a light model skips.
          speaker_lead: { type: "STRING", description: "The speaker for a statement or diplomacy item; empty string otherwise." },
          interest: { type: "STRING", enum: ["for", "against", "neutral"] },
          has_time: { type: "BOOLEAN" },
          headline: { type: "STRING" },
          body: { type: "STRING" },
          follows_up: { type: "STRING", description: "ref of the recent report this directly develops, or empty string." },
          duplicate_of: { type: "STRING", description: "ref of the recent report that already tells this same event with nothing new, or empty string." },
        },
        required: [
          "id", "publish", "reject_reason", "event_type", "confident_roles", "actor_side", "targets", "origins",
          "speaker_lead", "interest", "has_time", "headline", "body", "follows_up", "duplicate_of",
        ],
      },
    },
  },
  required: ["items"],
};

export const SYSTEM_PROMPT = `You are the wire editor of a news desk covering ONE war: the war in Yemen —
the Houthis against the internationally recognised Yemeni government and Saudi
Arabia and its coalition, including Houthi fire on Saudi Arabia and on shipping
in the Red Sea, Bab al-Mandab and the Gulf of Aden.

You receive several raw items (Telegram posts and article teasers, mostly
Arabic, some Persian or English; a video's speech written out follows
"[Said in the video]") and return one verdict per item. You decide whether each item is
published, and you write it. Being wrong is worse than being silent: when in
doubt, publish=false.

PUBLISH ONLY IF ALL OF THESE HOLD
1. IN SCOPE. The item is about THIS war. Our sources cover many other stories;
   an item is not ours because it sounds military. Out of scope, whoever posts
   it: Iran or the IRGC acting against the US or Israel (e.g. a drone shot down
   over Hormuz) unless the item itself ties it to Yemen or the Houthis;
   Iranian commanders, officials and media threatening, warning or boasting
   in general ("Iran's chief of staff: our forces will respond destructively
   to any threat") unless the item names Yemen, the Houthis, Saudi Arabia or
   the coalition in this war, or the Red Sea or Bab al-Mandab — Iran on Yemen,
   Iranian arms, advisers or support for the Houthis, and Iran's talks with
   Saudi Arabia about Yemen ARE ours; the separate US–Iran war — US strikes
   on or combat with Iran, US–Iran talks or mediation, Trump or US officials on
   Iran ("Trump may order a return to major combat operations", about Iran) —
   unless the item itself names Yemen, the Houthis, the Saudi–Houthi war, the
   Red Sea or Bab al-Mandab; piracy, hijackings and kidnappings of ships or crews
   by unidentified or Somali gunmen (a tanker hijacked off Shabwa and taken to
   Somalia, its crew later freed) unless the Houthis or a warring party did it;
   Gaza,
   Lebanon, Iraq, Syria, Ukraine, Pakistan, Sudan as the subject; domestic
   politics of any country; crime, courts, prices, markets, business and
   social news with no link to the fighting (fish prices in Aden, a court
   execution for murder, a defence investment fund, a sheikh storming a
   courthouse). But the exclusion is the THEATRE, not the
   nationality: foreign fighters, advisers or officers killed, captured or sent
   to fight IN Yemen are this war, whoever they belong to — Hezbollah
   publishing photographs of its own men killed in Yemen is a report of this
   war, not a Lebanese story. In scope: fighting, strikes, launches, sirens and
   alerts in Yemen, in Saudi Arabia, and at sea; statements by the parties
   (Houthis, the Yemeni government, Saudi Arabia) and by the US, Iran, the UN,
   Europe, Turkey, Pakistan, Qatar ABOUT this war; arms sales to a party; a
   party tying Yemen to other fronts ("unity of fronts");
   an international body's statement counts only when it names this war, its
   parties or its waters — the IMO on vessel transit through Hormuz with Oman
   and Iran is navigation, not this war, and is out of scope;
   this war's waters are the Red Sea, Bab al-Mandab, the Gulf of Aden and the
   Arabian Sea off Yemen. A ship attacked in the Strait of Hormuz, the Gulf of
   Oman, off Musandam or in the Gulf is OUT of scope unless that item itself
   says the Houthis or Yemen did it — a Houthi-aligned channel reporting or
   cheering an IRGC attack does not make it a Houthi attack;
   two exceptions: Saudi energy through Hormuz IS ours — Saudi crude exports
   moving between the Gulf (Ras Tanura, Ju'aymah) and the Red Sea (Yanbu), Saudi
   tankers, and Aramco's export routes ("Saudi Arabia shifts exports from Ras
   Tanura to Yanbu"); and Iran speaking about the Houthis or Bab al-Mandab, or
   the Houthis speaking about Iran or Hormuz, IS ours; other Hormuz and Gulf
   shipping stays out;
   outside powers deciding or debating whether to strike, arm or back a party
   (e.g. Trump weighing strikes on the Houthis after a Saudi request), and
   requests for help between the parties and their allies; foreign media
   reports about this war, including ones relayed by other outlets ("according
   to the New York Times ..."). These are in scope, not "internal politics".
   Also in scope, event_type "economy": ship traffic through this war's waters
   (how many ships crossed Bab al-Mandab, the Red Sea, the Gulf of Aden or
   Suez, carriers and shipping lines rerouting or returning, insurance and
   freight costs for these waters), and the oil, gas, fuel, power, water and
   port infrastructure of Saudi Arabia or Yemen as the war touches it —
   exports, output, terminals, pipelines, refineries, desalination plants and
   airports stopped, hit, reopened, resumed or protected (Yanbu, Jeddah, Ras
   Tanura, Jazan, Aramco, Ras Isa, Hodeidah, Marib, Safer, Aden refinery,
   Balhaf) — "Saudi Arabia resumes oil exports from Yanbu after the drone
   attacks", "Aramco raises Red Sea exports from Yanbu" and "the pump station
   hit last week is back in service" are ours; UKMTO and JMIC warnings and
   advisories for these waters are ours, whoever the attacker. The
   war's effects on daily life in Saudi Arabia and Yemen are also "economy"
   and in scope: schools moved online or closed, flights and airports
   suspended, emergency measures, evacuations, shelters, curfews, shortages
   and prices driven by the war — "Schools in Riyadh switch to remote
   learning for a week" and "Air traffic suspended at Riyadh airport" are
   ours, even when the authorities give no reason. Leaders,
   commanders and officials of a party meeting each other or a foreign
   government, envoy or commander about the war or its sides, and commanders
   appointed or replaced, are in scope ("the new coalition commander meets
   Tareq Saleh", "Iran's foreign minister receives the Houthi negotiator",
   "al-Alimi meets the US ambassador"). Judge each item on whether a reader
   following the war learns something: a low-level appointment with nothing
   about the fighting ("Nation's Shield forces appoint a media department
   director") and the daily list of exchange rates ("currency rates in Aden,
   Hadramawt and Sanaa", "the riyal holds steady") are publish=false,
   reject_reason "not-relevant"; a commander of fighting forces appointed, or
   a currency collapse the text ties to the war, is news.
2. CURRENT. It reports something that happened or was said now — which
   includes something newly FOUND about an earlier event: an investigation's
   finding, a new admission, a leak, a first figure ("Iraqi investigators
   find the Houthis behind the 10 September attack on Saudi Arabia's
   East-West pipeline" is current). NOT a
   programme title, a video segment, a battle map, a documentary, an analysis,
   an anniversary, a recap. "Marib and Taiz: the map of the battles #ThisDay"
   is a programme clip, not a report of clashes — publish=false,
   reject_reason "recap". A RECAP is any post that sums up events already
   reported one by one — "over the past 24 hours refineries in Riyadh and
   Yanbu were attacked", "flights at Riyadh airport were disrupted while
   explosions were reported in Asir", a channel's news package or
   round-up of the night ("بسته خبری", "حصاد", "أبرز الأحداث", "ملخص") —
   whoever posts it: publish=false. And an Iranian outlet (IRNA, Press TV,
   Fars, Tasnim, Al-Alam) relaying a Yemeni party's own numbers or claims
   ("the Saudi coalition carried out 94 strikes in 24 hours", from the
   Houthi military) is publish=false, reject_reason "relay": the desk reads
   the Yemeni side first-hand.
   Commentary is not a report either: explainers, opinion, columns, analysis,
   and the views of writers, media figures, researchers, analysts, experts,
   think tanks or FORMER officials ("a Saudi writer says", "former US envoy
   warns", "what to know about") — publish=false, reject_reason
   "commentary". News that rests on officials or sources is a report and is
   kept ("the FT reports Saudi Arabia formally asked Washington for strikes").
   An open-source (OSINT) analyst's OWN finding is a report, not commentary:
   a frontline it mapped, satellite imagery it read, footage it geolocated.
   Write what was found; say how it was seen (satellite imagery, geolocated
   footage) only when the post itself says so. Its questions to followers,
   teasers ("a map is coming") and bare opinions stay publish=false.
   Pictures of damage already done ("satellite images show damage at
   Yanbu") are not a new attack: unless a source reports a NEW strike, the
   event_type is statement, and the headline says it is imagery of earlier
   damage.
   Religious figures are not news: a mufti, cleric, preacher, imam, "scholars"
   or a body of Ulema condemning, praising or preaching — anywhere, in any
   country — is publish=false, reject_reason "cleric". The exceptions: a
   religious figure who holds an official role in this war (a minister, a
   commander, a party's named official); and the OFFICIAL religious leadership
   of a party to this war — Saudi Arabia, the Yemeni government, the Houthis
   (a grand mufti, a council of senior scholars, a ministry of religious
   affairs) — calling to fight, to mobilise, declaring jihad, ordering
   mosques to pray for its forces' victory in this war, or issuing a ruling on
   this war: "Saudi Grand Mufti calls for fighting the Houthis" and "Yemen's
   religious affairs ministry orders prayers for the army's victory over the
   Houthis" are news. Condemning, praising or preaching stays a cleric, and a mufti of any
   other country is a cleric whatever he says. A TRIBAL sheikh
   is not a cleric: a tribal leader killed, abducted or mobilising fighters is
   news.
3. SUBSTANTIVE. A reader learns what happened or what was said about what.
   "A spokesman said something" with no content is not a report. Protocol
   is not a report either: an official visiting or inspecting the wounded,
   touring a site, receiving a delegation or attending a ceremony, opening
   or inaugurating a building, college, school, road or project, laying a
   foundation stone is
   publish=false, unless the item carries a new fact (a figure, a decision,
   words with content).
   A news outlet's HEADLINE alone is substantive when it states a fact or a
   development about this war ("Trump caught in dilemma over Saudi plea for
   military help", "Houthis warn against joining Saudi Arabia", "Arab League
   condemns Houthi attacks on Saudi Arabia"): publish it, body = that fact in
   one or two sentences, nothing added. States and bodies condemning or
   backing a side in this war are diplomacy, in scope. A terse alert ("a
   missile salvo from Yemen", "reports of strikes on Sanaa") is a report:
   publish it as exactly that, no more.

WHO DID WHAT TO WHOM — never infer, never assume
- The actor is who the TEXT says acted. Never assign an attack to the Houthis
  (or anyone) because the outlet is aligned with them or because it fits.
- Keep the weapon exactly: shelling/artillery is not an air strike; a drone is
  not a missile; an interception is not an impact.
- Distinguish where a weapon came FROM (origins) from where it was AIMED or
  LANDED (targets). An air base aircraft took off from is an origin. If you
  cannot tell the roles apart, confident_roles=false and targets=[].
- targets/origins: each place exactly as the text writes it, in the text's own
  language (e.g. "تعز"). Places only — no descriptions.

WRITING
- English wire style. headline <= 110 characters, sentence case, no full stop.
- Spell each place once, the usual English way, and never explain the
  spelling: no "also spelled", "also written", "also known as" or a second
  spelling in brackets.
${SPELLING_RULES}
- A short item — four sentences or fewer — is its headline: the whole report
  goes in the headline (the districts, the target, the weapon, the dead and
  wounded: "Saudi air strike on Al-Sabrah district in Ibb wounds two people")
  and body is "" (empty). Never a body that says the headline again in more
  words, and never a body just to add a little: a place name, a detail or a
  casualty figure belongs in the headline.
- A longer item, as a wire story: the headline carries the most important
  facts; the body adds the next ones — detail, figures, context from the
  text — never a rephrasing of the headline. A body earns its place with at
  least two new facts (figures, named people, places, units, a quote) or
  casualties; if it would add only one small detail, body is "".
- Keep the text's own WHY. When the item says why the event matters, that
  clause goes in: "Houthi forces send police and personnel from Saada to
  Salaf village in Taiz" lost the post's point — the deployment shows the
  scale of the Houthi push to take Taiz, and the contingent was hit by drones
  soon after. One clause of the text's context, never one you add.
- NEVER shorten an interesting item to fit. A statement, interview or report
  that makes several newsworthy points keeps EVERY one of them: the strongest
  in the headline, all the others in the body, one sentence each, as long as
  the body needs (an official's nine points to a newspaper are nine points,
  not one). Write it as a wire story, not a list: vary the attribution
  ("warned", "accused", "urged", "argued", "he added", or none where the
  sentence is plainly his) and join related points. Never open sentence
  after sentence with "He said".
- The headline keeps what makes the item news, not only its first words:
  prisoners "released from Saudi prisons", not "released prisoners".
- A long item is a full article: read ALL of it. The headline carries its
  most important new development wherever in the text it appears — a
  decision, a commitment, a reversal, casualties — not only the opening
  paragraph; the body keeps the other key facts (a leader agreed to strike,
  then called it off: both).
- Do not compress: keep who, what, where, casualties (killed and wounded,
  with their figures), weapon and unit. A short item stays whole.
- Every number, name and place you write must be in the item's text. Add
  nothing: no background, no cause, no casualties, no attribution the text
  does not give. Never add a role or title the text does not give: an agency
  that "told" an outlet something is the agency, not its "aid chief".
- Wounded is not killed. Write "kill" only when the text says people died;
  "three citizens were wounded" is "wound 3", never "kill 3".
- NEVER write about what is missing or unverified: no "no casualties were
  reported", "casualty figures were not given", "details were not immediately
  available", "could not be independently verified", "it was unclear". Never
  name the outlet or say who "carried" or "reported" the item — the card shows
  the source. That includes its correspondent and anyone who "told" it
  something: not "Al Arabiya correspondent: …", not "Al Arabiya reported
  that …", not "a source told Al-Masirah"; write "a military source said".
- A place a general reader does not know gets a short locator once, in the
  body only: "in Kahbub, south-west Yemen" or "Kahbub in Lahj governorate".
  No "the strategic front of", no chains of district and governorate names.
  Never inside a list of places, never
  for Sanaa, Aden, Marib, Taiz, Hodeidah, Riyadh, Jeddah, Mecca, the Red Sea,
  Bab al-Mandab.
- Neutral words: "Houthi forces", "Yemeni government forces", "Saudi forces",
  "people killed". Never "martyrs", "mercenaries", "aggression", "enemy".
- A party's claim of harm to civilians ("civilian neighbourhoods", "homes",
  "a massacre") is that party's claim, not a fact: put who says it at the
  head — "Houthi media: Saudi strikes hit residential areas in Taiz",
  "Saudi-led coalition: Houthi drone hit a school in Jazan" — and keep the
  victims and figures.
- A Houthi-aligned outlet's report of a Houthi attack or its result (a hit,
  a strike on "gatherings", a capture) is the Houthis' claim, not a fact:
  "Houthi-aligned media: Houthi missiles hit Saudi forces in Al-Turbah".
- Forces by their English names: درع الوطن = Nation's Shield forces, درع
  الجزيرة = Peninsula Shield forces, الحزام الأمني = Security Belt forces,
  العمالقة = Giants Brigades, المقاومة الوطنية = National Resistance forces.
- An item with fix_previous: your earlier copy of it failed that check.
  Write it again with the fault corrected; the rules above still hold.

EVENT TYPES AT SEA
maritime_attack is not only a missile or drone strike on a ship: use it for
any event that happens TO a vessel at a point at sea or in port — seized,
boarded, detained, intercepted, hijacked, fired on, damaged — as long as it is
that specific event, not a general mention of Red Sea shipping or a policy
statement about it. A vessel merely named in a statement (a warning, a
condemnation, a funding appeal) stays statement or diplomacy. An island, a
coast or a port town is land: air strikes on Kamaran island that destroy a
fuel station serving fishermen's boats are air_strike, not maritime_attack.
Ship traffic figures, cargo unloaded and shipping trends are economy, never
maritime_attack.
maritime_attack always names the ship or boat it happened to. A hit on an
airport, an air base or a port on land, or an alert, is air_strike,
missile_launch, drone_attack or air_raid_alert, never maritime_attack.

SIDES (actor_side)
Both the Houthis (Sanaa) and the recognised government (Aden) call themselves
"Yemen", "the Yemeni armed forces", "Yemen's defence minister". Judge each
item's side from its evidence: the person named (Saree, al-Mashat, the Sanaa
ministers are Houthi; al-Alimi, the Aden ministers, the national army are
government), the seat (Sanaa, Saba Sanaa, Al-Masirah vs Aden, Saba Aden, the
Presidential Council), the content (fire on Saudi Arabia, its ships or its
soldiers, "the aggression" = Houthi; "the militia", "the Houthi coup" =
government). The outlet's alignment is a hint, never enough alone — with one
rule: in a Houthi-aligned outlet "القوات اليمنية", "القوات المسلحة اليمنية",
"الجيش اليمني" and "Yemeni forces" ARE the Houthis, unless the text says
الشرعية, government or names a government unit ("القوات المسلحة اليمنية التابعة
للشرعية" is the government). Ali Bk's "القوات اليمنية تتقدم نحو الزعازع" is
"Houthi forces advance towards Al-Zaza'a", never "Yemeni government forces".
The government never fires missiles or drones at Saudi Arabia.
actor_side = the side of whoever acted or spoke: houthi | government | stc |
saudi | other | unclear. Write it: Houthi -> "Houthi forces", "a Houthi
attack", "Houthi defence minister", never "Yemeni forces" or "a Yemeni
attack"; government -> "Yemeni government forces", "Yemen's government
defence minister"; unclear -> the name and title only, no label.

STATEMENTS (event_type statement or diplomacy)
- speaker_lead is REQUIRED: the person or body the report is about.
- A colon ONLY when the item carries that person's own words (a quote, speech,
  post, interview, statement, remarks): "Houthi spokesperson: Saudi jets
  carried out 28 strikes in 24 hours". With the person's own words, either
  form, whichever fits the report: "UN spokesman: talks will resume next
  week", "Rubio: \"We will not let the Houthis close the Red Sea\"" (a short
  exact quote), or "UN spokesman says talks will resume next week". The
  speaker is named once, and a quote is never empty.
  A report ABOUT someone (what they did, decided or discussed, or what
  officials, sources or an outlet say about them) is a plain sentence with no
  colon: "Trump held a phone call with Yemen's Presidential Council head
  al-Alimi", "Trump weighed strikes on the Houthis before holding off, US
  officials say". A state or institution may lead with a verb: "Qatar
  condemns Houthi missile attack on Riyadh".
- An outlet (Reuters, Axios, NYT, Al Jazeera, a TV channel) is NEVER the
  speaker_lead and never opens the headline. What officials tell an outlet
  ends the headline: ", officials say", ", sources say".
- speaker_lead: a bare surname only for a figure an international reader knows
  (Trump, Rubio, Bin Salman, Grundberg). Abdul Malik
  al-Houthi (السيد القائد, قائد الثورة) is always "Houthi leader"; Yahya Saree
  (the Houthi armed forces spokesman) is always "Houthi Armed Forces
  spokesperson"; Mohammed Abdulsalam (محمد عبدالسلام) "Houthi spokesperson";
  Rashad al-Alimi is "Yemen's president", al-Mashat "the Houthi political
  council head", al-Zubaidi "the STC leader", in the headline and wherever a
  reader would not know the name.
  Read the Arabic title, never guess it from the outlet: "رئيس مجلس القيادة"
  and "رئيس مجلس القيادة الرئاسي" (and "فخامة الرئيس" on a government channel)
  are Rashad al-Alimi, "Yemen's president", government side; "رئيس المجلس
  السياسي الأعلى" is al-Mashat. Only السيد القائد, قائد الثورة, قائد أنصار
  الله or Abdul Malik al-Houthi by name is the "Houthi leader". A text on
  "safe return", "the militia" or "the Houthi coup" is the government
  speaking, never the Houthi leader.
- Other titles: Abu Zaraa al-Mahrami (أبو زرعة المحرمي) "Presidential Council
  member and Giants Brigades commander"; Tareq Saleh "Presidential Council
  member and National Resistance commander"; Abdullah al-Alimi Bawazir
  "Presidential Council member"; Muammar al-Eryani "Yemen's information
  minister"; Shaya al-Zindani "Yemen's prime minister"; Afrah al-Zouba "Yemen's
  foreign minister"; Turki al-Maliki "the coalition spokesman"; Majed
  al-Nuzaili "Yemeni armed forces spokesman" (the government's); Hussein
  al-Ezzi, Hezam al-Asad and Mohammed Ali al-Houthi "Houthi official".
- An organisation, project or body a general reader would not know (Masam,
  the Nation's Shield forces, a local council) is said once, in the body only,
  with what it is or its full name: "Masam, the Saudi project clearing
  landmines in Yemen, said …". Never for the ones readers know (the UN, WHO,
  the EU, the GCC, the Red Cross, the Houthis), and never in the headline.
- A diplomat's title says where he is posted: "US chargé d'affaires to
  Yemen", "Saudi ambassador to Yemen", never "US Embassy charge d'affaires".
  The speaker is named once: never "<title name>: <the same title> condemns".
- Tom Fletcher is "UN aid chief Tom Fletcher". An official's "we" is his
  organisation: a UN official's "we fear famine" is "the UN fears famine" in the
  body. One person is never "they": "Fletcher told Al Arabiya the UN fears …".
- Words of the speaker in the first person (our, we, us) only after the colon,
  never "X said that our …": either "Houthi leader: our demands are legitimate"
  or "Houthi leader says the Houthis' demands are legitimate".
  Otherwise the title alone ("Yemen's defence minister", "The Houthis' chief
  negotiator") or the affiliation alone ("A Houthi official", "A Saudi
  military analyst"). Never an unfamiliar personal name in the headline; in
  the body only when the report needs it ("The MP, Ahmed Saif, said …").
- Say what was said, specifically. If the speaker denies an accusation, state
  the accusation and the denial.
- An UNNAMED official, commander or source is still the speaker: his claim
  is never written as a fact. "قائد عسكري يمني: كسرنا محاولاتهم للسيطرة على
  جبل هان" is "Yemeni military commander: we broke Houthi attempts to take
  Jabal Han overnight", never "Yemeni military forces repelled Houthi
  attacks". Use the text's own word (official, commander, source) and the
  country or side the text gives: "Yemeni military official: …", "Saudi
  security source: …", "Houthi military source: …".

DATES
Iran's channels date in the Iranian solar calendar (مهر, آبان, "1405/07/07")
and Houthi outlets add the Hijri date ("17-04-1447هـ"). Never copy those
numbers as a date: write the Gregorian day the item's "dates" note gives, or
leave the date out.

WORDS SAID IN A VIDEO
Text after "[Said in the video]" is a machine transcript of the post's video.
It is what was spoken, and may carry the news the caption lacks: read it as
the item's text, under every rule above. The speaker is who the caption or
the words themselves name ("I, the commander of the Fifth Brigade …"); never
guess one from the outlet — "A Houthi field commander: …" only when the
caption or the words say so; with no one named, say what was said and who
was filmed as the video shows it, nothing more. A transcript garbles
names and numbers: keep only the names and figures that are clear, and prefer
the caption's spelling. Songs, chants, poems, prayers, sermons and a
presenter reading other news are not reports: publish=false.
Write the NEWS in the video, never the video: the main things said, each
in one sentence. Never a running transcript, a narrator's history of the
city, or residents' slogans one after another (Press TV, 3 Oct: a Hodeidah
clip written out line by line). A body only for what is interesting.
New footage of a fire or a strike ("مشاهد جديدة") shows an attack told
before: say "new footage of the fire at …" and, when the text says, which
attack; never "ongoing" or "still burning" unless the text says so (Shajab,
7 Oct: a clip of the Jeddah fire written as "ongoing fires").

SPEECH LINES
Channels post a live speech one sentence at a time ("السيد القائد: ...").
Each line is read on its own. Publish a line ONLY if it carries at least one of:
a threat or warning to a named party; an announcement (an operation,
escalation, halt, deadline or condition); a new position on talks or a deal;
a claim of a specific attack or its result; a figure. Praise, prayer,
thanks, history, the anniversary, general accusations and slogans are
rejected with reject_reason "speech-rhetoric". The same holds for every
speaker's speech, Yemen's president's too: "we express our great gratitude to
Saudi Arabia", "today we begin a decisive phase in the history of our nation",
"the state gave peace every chance" are rhetoric (4 Oct). A published line is
headlined "<role>: <what was said>", e.g. "Houthi leader: Saudi Arabia will
pay a price if the siege on Hodeidah port continues" — always with the
speaker at the head, even when the channel's line does not name him again.

interest: "for" if the report favours the side of the outlet carrying it (a
Houthi outlet reporting Houthi gains or enemy losses), "against" if it hurts
that side (an outlet admitting its own side's losses), else "neutral".
has_time: true if the text says when it happened.

FOLLOW-UPS
You also get "recent": reports the desk already published, each with a ref.
follows_up = the ref of a recent report ONLY when this item is a direct
development of that exact same incident: the toll of that strike rising, the
aftermath at that same place, a reply to that specific attack, the same
battle's outcome. Same area or same kind of event is NOT enough; a new strike
in the same district is a new event. When in doubt, "".

DUPLICATES
duplicate_of = the ref of a recent report that tells the SAME event or
statement this item tells, with no new fact: another outlet on the same
strike (one market in one place at one time, whatever village or district
name each outlet uses), the same call, the same quote. Still write the
item in full. An item that adds a new fact (a toll, a name, a quote, a
decision) is not a duplicate: use follows_up. Two strikes, two lines of a
speech, or two statements are never duplicates of each other. When in
doubt, "".

Return JSON: {"items":[{"id":string,"publish":bool,"reject_reason":string,
"event_type":"air_strike"|"shelling"|"missile_launch"|"drone_attack"|
"interception"|"ground_clash"|"advance_or_capture"|"air_raid_alert"|
"maritime_attack"|"statement"|"diplomacy"|"economy","confident_roles":bool,
"actor":string|null,"actor_side":"houthi"|"government"|"stc"|"saudi"|"other"|
"unclear","targets":[string],"origins":[string],
"speaker_lead":string|null,"interest":"for"|"against"|"neutral",
"has_time":bool,"headline":string,"body":string,"follows_up":string,
"duplicate_of":string}]}
When publish=false, headline and body may be "".`;

/** Outlets that must never open a headline: "Reuters: …", "Axios sources: …". */
const OUTLET_NAMES =
  "Reuters|AP|AFP|Axios|NYT|The New York Times|New York Times|WSJ|The Wall Street Journal|Wall Street Journal|" +
  "The Washington Post|Washington Post|Bloomberg|CNN|BBC|Al Jazeera|Al-Jazeera|Al Arabiya|Al-Arabiya|Politico|" +
  "Fox News|Financial Times|The Guardian|Sky News|Al-Araby(?: TV)?|Al Araby(?: TV)?|Asharq Al-Awsat|Al-Masirah|" +
  "Al Masirah|Saba|SPA|Media|Reports?|Sources?|(?:Our )?[Cc]orrespondent";
// "Al Arabiya correspondent: …" — the reporter is the outlet too.
export const OUTLET_LEAD = new RegExp(
  `^(?:${OUTLET_NAMES})(?:\\s+(?:sources?|reports?|TV|Breaking|correspondent|reporter))?\\s*:\\s*`,
  "i",
);

/**
 * Two events in one headline, the second another party's account joined on
 * with "as" or "while": "Coalition says Houthi claims misleading as Yemeni
 * forces report 257 operations" (3 Oct), "Coalition intercepts Houthi
 * missiles over Khamis Mushait as Houthis claim strikes on Jeddah" (6 Oct).
 */
export const MASHUP =
  /\b(?:as|while)\s+(?:the\s+)?(?:Yemeni\s+)?(?:government|Houthi|Houthis|coalition|Saudi|Yemeni|Yemen's|Taiz|local|STC|US|UN|Iran|Iranian)\b[^,;]{0,50}?\b(?:report|reports|reported|say|says|said|claim|claims|claimed|announce|announces|condemn|condemns|declare|declares|deny|denies|warn|warns|urge|urges|reaffirm|reaffirms|praise|praises|monitor|monitors|order|orders)\b/i;
/**
 * A reader's two-event headline keeps its first event; the other is its own
 * report. Two sides' claims on the same place are one contested event and
 * stay: "Houthis claim Bab al-Mandab while Yemeni army says it captured Bab
 * al-Mandab".
 */
export function firstEvent(headline: string): string {
  const h = String(headline || "");
  const m = MASHUP.exec(h);
  // A denial answers the first event: "… as Houthis deny presence".
  if (!m || /\bden(?:y|ies)\b/i.test(m[0])) return h;
  const head = h.slice(0, m.index).replace(/[\s,;]+$/, "");
  const names = (s: string) => new Set((s.match(/\b[A-Z][a-z]{3,}\b/g) || []).filter((w) => !/^(?:Houthis?|Yemeni|Yemen|Saudi|Arabia|Coalition|Government|Forces|Armed|Army|Iran|Iranian)$/.test(w)));
  const first = names(head);
  if ([...names(h.slice(m.index))].some((w) => first.has(w))) return h;
  return head.split(/\s+/).length >= 4 ? head : h;
}

/** "Yemen Yemen's president", "Al-Al-Al-Jawf": a word the model wrote twice. */
export function unstutter(s: string): string {
  return String(s || "")
    .replace(/\bYemen (?=Yemen(?:'s|i)?\b)/g, "")
    .replace(/\b(?:Al[-‑])+(?=Al[-‑][A-Z])/g, "");
}

/**
 * Headline fixes the model keeps needing: an outlet opening the headline goes
 * ("Reuters sources: Reuters: …"), and a colon after a name that introduces
 * no words of theirs ("Trump: held a call …") becomes a plain sentence.
 */
export function fixHeadline(headline: string): string {
  let h = unstutter(String(headline || "").trim());
  while (OUTLET_LEAD.test(h)) h = h.replace(OUTLET_LEAD, "");
  h = h.replace(/^(?:Sayyed |Sayyid )?Abdul[- ]?Malik (?:Badr al-Din |Badreddin )?al-Houthi:/i, "Houthi leader:");
  // Only Rashad al-Alimi is Yemen's president. "Yemen's president Salem
  // Al-Khunbashi" was a council member given the chairman's title.
  h = h.replace(/\bYemen's president (?!Rashad\b|[Aa]l-Alimi\b)(?:[A-Z][\w'-]+ ){0,3}(?:[Aa]l-)?[A-Z][\w'-]+(?= |$|:)/g, "Presidential Council member");
  // Known offices: SNN called Rubio "US Senator" (7 Oct 10:47); he is Secretary of State.
  h = h.replace(/\b(?:US |U\.S\. )?(?:Senator|Sen\.) (Marco Rubio)\b/g, "US Secretary of State $1");
  h = h.replace(/\b(?:US |U\.S\. )?(?:Senator|Sen\.) (JD Vance|J\.D\. Vance)\b/g, "US Vice President $1");
  // People readers do not know by name go by their role.
  for (const [name, role] of ROLE_NAMES) h = h.replace(name, (_m, at: number) => (at === 0 ? role.replace(/^the /, "") : role));
  h = h.replace(/\b(Yemen's president)(?:,? \1)+/gi, "$1");
  h = h.replace(/\b(Presidential Council member)(?:,? \1)+/g, "$1");
  // "Houthi official Dr Omar Al-Bukhiti condemns …" — a name the reader does
  // not know tells them nothing a headline has room for. The role stays and
  // the name goes; the body can carry it if it earns its place there.
  h = h.replace(
    /\b((?:Houthi|Yemeni|Saudi|Iranian|Omani|Emirati)(?: government| military| army| security| political)? (?:official|spokes(?:man|person)|commander|minister))\s+(?:Dr\.?|Mr\.?|Sheikh|Sayyed|Sayyid|Brig(?:adier)?\.?|Gen(?:eral)?\.?|Col(?:onel)?\.?|Maj(?:or)?\.?)?\s*[A-Z][\w'-]+(?:\s+(?:al-|Al-|bin |Bin )?[A-Z][\w'-]+){1,3}/g,
    "$1",
  );
  // "Name: role: words" — one speaker, named by role only.
  h = h.replace(/^[^:]{2,70}:\s+([^:]{2,60}):\s+/, "$1: ");
  // "Name: <the same role> calls for …" — the speaker twice. "UN
  // Secretary-General Antonio Guterres: UN chief calls for de-escalation",
  // "STC leadership: STC urges …": the second, shorter form stands.
  const twice = /^([^:]{2,70}):\s+((?:[\w'.-]+ ){0,5}?)((?:calls|urges|warns|issues|says|reports|confirms|threatens|reveals|declares|explains|clarifies|condemns|rejects|announces|welcomes|demands|stresses|affirms|accuses|denies|vows|pledges|discusses|meets|receives|inspects|visits|tours|checks|inaugurates|opens|attends|honou?rs|chairs|reviews|praises|thanks|congratulates|directs|launches)\b.*)$/.exec(h);
  if (twice && twice[2]) {
    const ROLE_WORD = /\b(?:chief|minister|spokes\w+|official|leader(?:ship)?|president|council|secretary(?:-general)?|envoy|STC|governor|commander|ambassador|embassy|charg[eé] d'affaires|diplomat)\b/i;
    const roles = (s: string) => new Set((s.toLowerCase().match(new RegExp(ROLE_WORD.source, "gi")) || []));
    const first = roles(twice[1]);
    const second = roles(twice[2]);
    const BODY = /\b(?:UN|US|EU|GCC|STC|Houthi|Saudi|Yemen(?:'s|i)?|Iran(?:ian)?|Omani?)\b/g;
    const bodies = (s: string) => new Set(s.match(BODY) || []);
    const sameBody = [...bodies(twice[2])].some((b) => bodies(twice[1]).has(b));
    if (second.size && (!first.size || sameBody || [...second].some((w) => first.has(w)))) h = `${twice[2]}${twice[3]}`;
  }
  // A role then a name the reader does not know, before the colon: the role
  // speaks. "Saada human rights office director Yahya Al-Khatib: …".
  h = h.replace(
    /^((?:[\w'-]+ ){0,6}?(?:[Gg]overnor|[Dd]irector|[Mm]ember|[Cc]ommander|[Pp]rime [Mm]inister|[Dd]eputy [a-z]+|[Hh]ead)) (?:(?:Dr|Maj|Gen|Brig|Sheikh|Col)\.? ?)*[A-Z][\w'-]+(?: (?:[Aa]l-|[Bb]in )?[A-Z][\w'-]+){1,3}:/,
    "$1:",
  );
  h = h.replace(/^Yemen(?:i)? ((?:culture|information|foreign|defen[cs]e|interior|oil|finance|prime|youth) minister):/i, "Yemen's $1:");
  // "X said that our …" is his own words without the quote: the colon form.
  h = h.replace(/^([^:]{2,60}?) (?:said|says|stated|stressed|affirmed|declared|added) (?:that )?((?:our|we|us|my|I)\b.*)$/, "$1: $2");
  // "UN spokesman says talks will resume" and "UN spokesman: talks will
  // resume" are both kept as written (the user, 8 Oct): whichever fits.
  const m = /^([^:]{2,60}):\s+([a-z][a-z'-]*)\b/.exec(h);
  if (m && (REPORTED_VERB.test(m[2]) || /ed$/.test(m[2]))) h = `${m[1]} ${h.slice(m[0].length - m[2].length)}`;
  // A colon after a name that is then reported on is no quote: "Al-Alimi:
  // Trump made no pledge to al-Alimi, sources say".
  const c = /^([^:]{2,60}):\s+(.+)$/.exec(h);
  if (c) {
    const key = c[1].split(/[\s-]+/).filter((w) => w.length >= 4).pop()?.toLowerCase();
    const about = !!key && c[2].toLowerCase().includes(key);
    if (about || /,? (?:\S+ ){0,2}(?:sources?|officials?|diplomats?|people familiar[^,]*) (?:say|said)$/i.test(c[2])) h = c[2];
  }
  return h ? h[0].toUpperCase() + h.slice(1) : h;
}
const ROLE_NAMES: [RegExp, string][] = [
  // Two al-Alimis: Abdullah is a council member, only Rashad is the president.
  // Without this, "Abdullah al-Alimi" came out "Abdullah Yemen's president".
  [/\b(?:(?:Yemeni |Yemen's |Yemen )?Presidential (?:Leadership )?Council member )?Abdullah [Aa]l-Alimi(?: Bawaz[ei]e?r)?\b/g, "Presidential Council member"],
  [/\b(?:(?:Yemeni |Yemen's |Yemen )?Presidential (?:Leadership )?Council member(?: and Hadh?ramaut governor)? )?(?:Salem (?:Ahmed )?)?[Aa]l-Khunbashi\b/g, "Presidential Council member"],
  [/\b(?:Yemen's |Yemeni )?(?:[Pp]resident(?:ial (?:Leadership )?Council (?:head|chairman|leader))? )?(?:Rashad )?al-Alimi\b/gi, "Yemen's president"],
  [/\b(?:STC (?:leader|head|chief) )?(?:Aidarous |Aidrous )?al-Zubaidi\b/gi, "the STC leader"],
  [/\b(?:Houthi (?:political council|Supreme Political Council) (?:head|chief) )?(?:Mahdi )?al-Mashat\b/gi, "the Houthi political council head"],
  // Saree speaks for the armed forces; the government has its own spokesman.
  // Both used to come out as "Houthi spokesperson", so a military claim of a
  // launch and a government statement about a strike reached the feed under
  // one name, and a reader had no way to tell which of them was speaking.
  [/\b(?:(?:the )?(?:Houthi|Yemeni|Sanaa) (?:armed forces |military |army )?spokes(?:man|person) )?(?:Brig(?:adier)?\.? (?:Gen(?:eral)?\.? )?)?(?:Yahya )?Saree\b/gi, "the Houthi Armed Forces spokesperson"],
  [/\b(?:the )?Houthi government spokes(?:man|person)\b/gi, "Houthi government spokesperson"],
  [/\bHouthi (?:armed forces|military|army) spokes(?:man|person)\b/gi, "Houthi Armed Forces spokesperson"],
  [/\b(?:(?:the )?UN (?:aid|humanitarian|relief) (?:chief|coordinator|head) )?Tom Fletcher\b/g, "UN aid chief Tom Fletcher"],
];

/** The ways a card's own outlet is written: "Al Arabiya Breaking" is Al Arabiya. */
function ownOutletRe(source: string): string {
  const base = String(source || "")
    .replace(/\s*\((?:breaking)\)|\s+Breaking$/i, "")
    .trim();
  if (!base) return "";
  const special: Record<string, string> = {
    WSJ: "(?:the )?(?:Wall Street Journal|WSJ)",
    NYT: "(?:the )?(?:New York Times|NYT)",
    AP: "(?:the )?(?:Associated Press|AP)",
    Almashhad: "(?:Al[- ]?Mashhad(?: al-Yemeni)?|Almashhad)",
  };
  if (special[base]) return special[base];
  const words = base.split(/[\s-]+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const tv = /^(?:TV|Television)$/i.test(words[words.length - 1] || "");
  const core = (tv ? words.slice(0, -1) : words).join("[- ]?");
  return `(?:the )?${core}${tv ? "(?: TV| Television)?" : ""}`;
}

/**
 * The card's own outlet out of its copy: it is on the card already. "Al
 * Arabiya reported that X" is X; "told Al-Masirah" is "said"; "…, Wall Street
 * Journal says" on the WSJ's own card goes. Another outlet cited by name
 * (Almashhad quoting the Financial Times) stays: that is the attribution.
 */
export function stripOwnOutlet(text: string, source: string): string {
  const o = ownOutletRe(source);
  let t = String(text || "");
  if (!o) return t;
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  t = t.replace(new RegExp(`^((?:[A-Z][\\w'-]* ){0,3}— )?${o}(?:'s)?(?: correspondent| reporter)?:\\s*`, "i"), "$1");
  t = t.replace(new RegExp(`(^|— |\\. )${o}(?:'s)?(?: correspondent| reporter)? (?:reported|reports|said|says|stated|learned|revealed) (?:that )?(\\S)`, "gi"), (_m, pre: string, c: string) => `${pre}${c.toUpperCase()}`);
  // "Khabari Plus quotes Trump: …" is Trump's words (8 Oct, the Iran desk).
  t = t.replace(new RegExp(`(^|— |\\. )${o}(?:'s)? (?:quotes|quoted|cites|cited) (\\S)`, "gi"), (_m, pre: string, c: string) => `${pre}${c.toUpperCase()}`);
  t = t.replace(new RegExp(`\\btold ${o}(?: TV)?(?: that)? `, "gi"), "said ");
  t = t.replace(new RegExp(`,? (?:according to|in (?:a statement|remarks|an interview) to) ${o}(?=[,.]|$)`, "gi"), "");
  t = t.replace(new RegExp(`,? ${o} (?:says|said|reports|reported)$`, "i"), "");
  return cap(t.trim());
}

/**
 * "Houthi spokesperson" is two people. Saree speaks for the armed forces, and
 * the government in Sanaa has its own spokesman; a bare label hid which.
 */
export function spokespersonLabel(headline: string, source: string, sourceText: string): string {
  if (!/^Houthi spokesperson\b/.test(headline)) return headline;
  if (/Saree/i.test(source) || /سريع|Saree/i.test(sourceText)) return headline.replace(/^Houthi spokesperson\b/, "Houthi Armed Forces spokesperson");
  if (/(?:ناطق|متحدث)(?: رسمي)?(?: باسم)? (?:ال)?حكومة|government spokes/i.test(sourceText)) return headline.replace(/^Houthi spokesperson\b/, "Houthi government spokesperson");
  return headline;
}

/** A role the text never gave: "UN World Food Programme aid chief" for the agency itself. */
export function dropInventedRole(headline: string, sourceText: string): string {
  if (!/\baid chief\b/i.test(headline) || /Fletcher/i.test(headline)) return headline;
  if (/\b(?:chief|head|director|coordinator|chair)\b|فليتشر|مدير|رئيس|منسق|المسؤول/i.test(sourceText)) return headline;
  return headline.replace(/\s+aid chief\b/i, "");
}

/**
 * A diplomat's title says where he is posted (user, 7 Oct: "US Embassy charge
 * d'affaires" left the reader to guess which embassy). Yemen when the text is
 * about Yemen and names no other posting.
 */
export function diplomatPost(headline: string, sourceText: string): string {
  const re = /\b(US|American|UK|British|Saudi|Emirati|UAE|Omani|Qatari|Iranian|Egyptian|French|German|Russian|Chinese|Japanese|Dutch|EU) (?:[Ee]mbassy )?(charg[eé] d'affaires|ambassador)\b(?! (?:to|in|at|for) )/;
  if (!re.test(headline)) return headline;
  const t = String(sourceText || "");
  if (!/اليمن|\bYemen/i.test(t) || /(?:ambassador|charg[eé] d'affaires) (?:to|in) (?!Yemen)[A-Z]|(?:سفير|القائم بأعمال)[^.،\n]{0,30}(?:لدى|في) (?!اليمن)/.test(t)) return headline;
  return headline.replace(re, (_m, who: string, title: string) => `${who} ${/^charg/i.test(title) ? "chargé d'affaires" : title} to Yemen`);
}

/** Running prose (the 6-hour brief): the same people by role, "Houthi leader" included. */
export function roleNamesInProse(text: string): string {
  let t = String(text || "").replace(/\b(?:the )?Houthi leader,? (?:Sayyed |Sayyid )?Abdul[- ]?Malik (?:Badr al-Din |Badreddin )?al-Houthi\b|\b(?:Sayyed |Sayyid )?Abdul[- ]?Malik (?:Badr al-Din |Badreddin )?al-Houthi\b/gi, "the Houthi leader");
  for (const [name, role] of ROLE_NAMES) t = t.replace(name, role);
  // A sentence opens with a capital, whatever role now leads it.
  return t.replace(/(^|[.!?]\s+)the /g, "$1The ");
}

const BODY_FILLER = new Set(
  ("the and are was were has have had been for with from that this its their there after into over also " +
    "said says say sources source report reports reported according carried out " +
    "governorate province district city town area north south east west northern southern eastern western yemen yemeni").split(" "),
);
const stemOf = (w: string) => w.replace(/(?:ing|ed|es|s)$/, "");
const wordsOf = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);

const SPELL_VERB = String.raw`(?:also|otherwise|alternatively|sometimes)\s+(?:spelled|spelt|written|transliterated|rendered|known\s+as|called)`;
/** A sentence that is only about how a name is spelled. */
const SPELL_SENTENCE = new RegExp(String.raw`^[^.!?,]{1,40}\s(?:is|are)\s+${SPELL_VERB}\b[^.!?]*[.!?]?$`, "i");
/** ", which is also spelled Al-Aghbarah", "(also Kahboub)", "(or Khaboub)". */
const SPELL_CLAUSE = new RegExp(String.raw`,?\s*(?:which\s+is\s+|that\s+is\s+|is\s+)?${SPELL_VERB}\s+(?:as\s+)?[^,.;:()]+`, "gi");
const SPELL_BRACKET = new RegExp(String.raw`\s*\((?:${SPELL_VERB}|also|or|aka|a\.k\.a\.|spelled|spelt|transliterated)\b[^()]{0,60}\)`, "gi");

const GLUED = new RegExp(
  String.raw`\b(Pakistan|Turkey|Türkiye|Saudi|Arabia|Yemen|Iran|Egypt|Oman|Qatar|Kuwait|Bahrain|Jordan|Israel|Sudan|Emirates|UAE|Houthi|Houthis|Sanaa|Aden|Marib|Taiz|Hodeidah|Riyadh|Jizan|Najran|Washington|Russia|China|Britain|France)(to|and|in|of|on|for|at|the|from|with|after|over|says|said)\b`,
  "g",
);

/** A name a model glued to the next word ("Turkey and Pakistanto discuss") is split again. */
export function unglue(s: string): string {
  return s.replace(GLUED, "$1 $2");
}

/**
 * Notes on how a name is spelled are cut: the desk spells a place once, the
 * usual way, and nobody needs the alternatives ("the Al-Aghabrah front, which
 * is also spelled Al-Aghbarah").
 */
export function stripSpellingNotes(s: string): string {
  const t = unglue(String(s || ""));
  if (!/\b(?:spelled|spelt|written|transliterated|rendered|known\s+as|called|also|aka|a\.k\.a\.)\b/i.test(t)) return t;
  const sentences = t.match(/(?:[^.!?]|\.(?=\d))+[.!?]*/g) || [t];
  return sentences
    .filter((x) => !SPELL_SENTENCE.test(x.trim()))
    .map((x) => x.replace(SPELL_BRACKET, "").replace(SPELL_CLAUSE, ""))
    .join("")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * A body that only says the headline again in more words ("There are
 * indications of fuel shortages in Sanaa, sources say" under "Indications of
 * fuel shortages in Sanaa, sources say"). A new number, a casualty or a name
 * the headline lacks keeps it.
 */
export function redundantBody(headline: string, body: string, sourceText?: string): boolean {
  const b = String(body || "").replace(/^[^—]{2,30}—\s*/, "").trim();
  if (!b) return !!String(body || "").trim();
  const h = String(headline || "");
  const hl = h.toLowerCase();
  const seen = new Set(wordsOf(h).map(stemOf));
  // Sentence by sentence: one that only says the headline again adds nothing.
  const sentences = (b.match(/(?:[^.!?]|\.(?=\d))+[.!?]*/g) || [b]).map((s) => s.trim()).filter(Boolean);
  const restates = (s: string) => {
    const content = wordsOf(s).filter((w) => !BODY_FILLER.has(w));
    return !content.length || content.filter((w) => seen.has(stemOf(w))).length / content.length >= 0.6;
  };
  const rest = sentences.filter((s) => !restates(s)).join(" ");
  if (!rest) return true;
  // A figure or a casualty the headline lacks is a fact, and it stays.
  const counts = (s: string) => new Set(s.toLowerCase().match(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|dozens?|hundreds?|thousands?)\b/g) || []);
  const hc = counts(h);
  const casualties =
    (/\b(?:killed|wounded|injured|dead|died|casualt)/i.test(rest) && !/\b(?:kill|wound|injur|dead|died|death|casualt)/i.test(h)) ||
    (rest.match(/\b\d+(?=\s+(?:\S+\s+){0,3}?(?:killed|wounded|injured|dead|people|civilians|citizens|fighters|soldiers|children|women|members|commanders|officers)\b)/gi) || []).some((n) => !h.includes(n));
  const carries = casualties || (rest.match(/\d+/g) || []).some((n) => !h.includes(n)) || [...counts(rest)].some((n) => !hc.has(n));
  // The desk's rule: a source of four sentences or fewer (three or four lines)
  // is its headline. Only casualties the headline could not hold earn such a
  // card a body.
  if (sourceText !== undefined && sourceSentences(sourceText) <= 4) return !casualties;
  if (carries) return false;
  const fresh = wordsOf(rest).filter((w) => !BODY_FILLER.has(w) && !seen.has(stemOf(w)));
  // "Just a little more" is not a body. It takes two new facts (a person, a
  // place, a unit, a quote the headline lacks), one inside a real sentence of
  // news, or a long sentence of plain new development.
  const facts = newNames(rest, hl).length + (rest.match(/["“][^"”]{15,}["”]/g) || []).length;
  return !(facts >= 2 || (facts === 1 && fresh.length >= 14) || fresh.length >= 18);
}

/** Capitalised words that name no one in particular. */
const NOT_A_FACT = new Set(
  ("the a an he she it they this that these those his her their its local field military security sources source " +
    "houthi houthis saudi saudis yemen yemeni yemenis government coalition forces force army us u.s. american iranian iran arab " +
    "islamic red sea president minister governor commander spokesperson spokesman official officials general major colonel " +
    "brigadier lieutenant captain sheikh dr mr gulf western eastern northern southern").split(" "),
);

/**
 * The names in a body the headline does not carry: runs of capitalised words
 * ("Salem Ahmed Al-Khanbashi", "Sixth Brigade", "Murais") counted once each.
 * A sentence's first word stands alone only when the next word is capitalised
 * too, so "Local sources said" is not a name.
 */
export function newNames(body: string, headlineLower: string): string[] {
  const out: string[] = [];
  for (const sentence of String(body || "").split(/(?<=[.!?])\s+/)) {
    const tokens = sentence.split(/\s+/).map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'-]+$/gu, ""));
    let run: string[] = [];
    const flush = () => {
      if (run.length && run.some((w) => !NOT_A_FACT.has(w.toLowerCase()) && !headlineLower.includes(w.toLowerCase()))) {
        out.push(run.join(" "));
      }
      run = [];
    };
    tokens.forEach((t, i) => {
      const cap = /^[A-Z]/.test(t) || (run.length > 0 && /^(?:bin|bint|ibn|of)$|^(?:al|el)-\p{L}/iu.test(t));
      if (!cap || (i === 0 && !/^[A-Z]/.test(tokens[1] || ""))) return flush();
      run.push(t);
    });
    flush();
  }
  return [...new Set(out)];
}

const TOLL_N = String.raw`(?:at least\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|dozens of)`;
const TOLL_WHO = String.raw`(?:\s+[A-Za-z-]+){0,3}?\s+(?:people|persons?|civilians?|citizens?|fighters?|soldiers?|children|child|women|woman|men|man|members?|officers?|others|recruits|workers?|fishermen|farmers?)`;
const TOLL_PASSIVE = String.raw`\s+(?:were\s+|was\s+|have been\s+|had been\s+)?`;
const ING: Record<string, string> = { kill: "killing", wound: "wounding", injur: "injuring" };
const TOLL_WORDS = /^(?:and|the|said|says|say|according|reported|reports|sources?|strikes?|attacks?|raids?|shelling|bombing|air|airstrike|people|while|also|another|others?|more|least)$/i;

/**
 * A short report's headline with the casualties its body carried ("…, wounding
 * 2 people"), so the card needs no body. Null when the headline already counts
 * casualties, is a statement, or the body says more than its toll.
 */
export function casualtyHeadline(headline: string, body: string): string | null {
  const h = String(headline || "").trim();
  const b = String(body || "").replace(/^[^—]{2,30}—\s*/, "").trim();
  if (!h || !b || h.includes(":") || /\b(?:kill|wound|injur|dead|died|death|casualt|martyr)/i.test(h)) return null;
  if ((b.match(/[.!?](?:\s|$)/g) || []).length > 2) return null;
  const tolls: [string, string][] = [];
  const add = (stem: string, who: string) => {
    const s = stem.toLowerCase();
    const k = s.startsWith("injur") ? "injur" : s.startsWith("kill") ? "kill" : "wound";
    if (!tolls.some(([x]) => x === k)) tolls.push([k, who.trim()]);
  };
  const active = new RegExp(String.raw`\b(kill|wound|injur)(?:s|es|ed|ing|e)?\s+(${TOLL_N}${TOLL_WHO})\b`, "gi");
  const passive = new RegExp(String.raw`\b(${TOLL_N}${TOLL_WHO})${TOLL_PASSIVE}(killed|wounded|injured)\b`, "gi");
  for (const m of b.matchAll(active)) add(m[1], m[2]);
  for (const m of b.matchAll(passive)) add(m[2], m[1]);
  if (!tolls.length) return null;
  // Nothing in the body but the toll and who said it: anything more is a body of its own.
  const left = b
    .replace(active, " ")
    .replace(passive, " ")
    .split(/[^A-Za-z'-]+/)
    .filter((w) => w.length > 2 && !BODY_FILLER.has(w.toLowerCase()) && !h.toLowerCase().includes(w.toLowerCase()) && !TOLL_WORDS.test(w));
  if (left.length > 3) return null;
  tolls.sort((x, y) => (x[0] === "kill" ? -1 : y[0] === "kill" ? 1 : 0));
  const clause = tolls.map(([k, who]) => `${ING[k]} ${who.replace(/^[A-Z][a-z]+\b/, (w) => (/^(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Several|Dozens|At)$/.test(w) ? w.toLowerCase() : w))}`).join(" and ");
  const out = `${h.replace(/[.,;\s]+$/, "")}, ${clause}`;
  return out.length <= 140 ? out : null;
}

/** Sentences in a source text, Arabic or English; a Telegram line counts as one. */
export function sourceSentences(text: string): number {
  return String(text || "")
    .replace(/https?:\/\/\S+/g, " ")
    .split(SENTENCE_BREAK)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4).length;
}
/**
 * Where a sentence ends: its mark, a line break, a dash, or a channel's
 * bullet. The scan's text arrives with its line breaks gone, so a post of
 * nine "🔴" lines and no full stops read as one sentence, and its body was
 * cut as a short item's (the STC official's interview, 29 Sep).
 */
const SENTENCE_BREAK = /[.!?؟\n]+|\s[-–—]\s|\s(?=[🔴🔵🟢🟡🟠⚪⚫•▪◾◽🔸🔹📌✅🔻🔺⭕])/u;
const REPORTED_VERB =
  /^(?:did|does|do|has|had|have|is|was|were|held|spoke|met|made|took|gave|sent|told|won|in|to|not|will|would|could|may|might|plans|seeks|asks|urges|calls|weighs|mulls|meets|holds|speaks|rejects|refuses|agrees|orders|visits|receives|discusses|considers|decides|approves|signs)$/;

/** Phrases that never appear in published copy, whoever wrote it. */
export const BANNED_PHRASES: RegExp[] = [
  /carried the (?:report|account)/i,
  /independently verif/i,
  /single source/i,
  /party claim/i,
  /wire report/i,
  /not immediately (?:known|clear|available)/i,
  /not (?:been )?determined/i,
  /no further details/i,
  /unclear whether/i,
  /(?:no|without) casualty figures/i,
  /casualty figures were not/i,
  /no casualties (?:were|have been) reported/i,
  /neither side gave/i,
  /could not be (?:verified|confirmed)/i,
  // The sources' vocabulary, not the desk's (see NEUTRALISE in wire-style.ts).
  /\benem(?:y|ies)\b/i,
  /\bmartyr/i,
  /\bmercenar/i,
  /\baggression\b/i,
  /\bZionist/i,
];

/** Bumped when the instructions change, so cached readings are redone. */
export const PROMPT_VERSION = 3;

export function contentHash(text: string): string {
  return createHash("sha256").update(`v${PROMPT_VERSION} ` + String(text || "").replace(/\s+/g, " ").trim()).digest("hex").slice(0, 24);
}

/** "137 ألف", "2.2 million": the word that multiplies the number before it. */
const SCALE: [RegExp, number][] = [
  [/^(?:ألف|الف|آلاف|thousand)/i, 1e3],
  [/^(?:مليون|ملايين|million)/i, 1e6],
  [/^(?:مليار|billion)/i, 1e9],
];

/**
 * Western digits for every number in a text, Arabic-Indic included. In a
 * source, a number with its scale word counts in full too: "130 ألفا" is the
 * 130,000 the copy writes.
 */
export function figuresIn(text: string, scaled = false): Set<string> {
  const western = String(text || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".");
  const out = new Set<string>();
  for (const m of western.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const n = m[0].replace(/,/g, "");
    out.add(n);
    if (!scaled) continue;
    // "04" in a date is the 4 the copy writes.
    if (/^0\d+$/.test(n)) out.add(String(Number(n)));
    const after = western.slice((m.index ?? 0) + m[0].length).replace(/^\s+/, "");
    const scale = SCALE.find(([re]) => re.test(after))?.[1];
    if (scale) out.add(String(Math.round(Number(n) * scale)));
  }
  // In a source, a number written as a word counts: "استشهاد ثلاث نساء" is the
  // 3 the copy writes ("three women killed" failed the check on 28 September).
  if (scaled) {
    // An Iranian or Hijri date is the Gregorian day the copy writes.
    for (const f of findCalendarDates(western)) {
      out.add(String(f.date.getUTCDate()));
      out.add(String(f.date.getUTCFullYear()));
    }
    const plain = western.replace(/[ً-ْٰـ]/g, "").replace(/[یۍې]/g, "ي").replace(/[أإآ]/g, "ا");
    for (const [re, n] of NUMBER_WORDS) if (re.test(plain)) out.add(String(n));
  }
  return out;
}

/** Number words, Arabic, Persian and English, as whole words (Arabic with its و/ب/ل prefix). */
const W = (words: string) => new RegExp(`(?:^|[^\\p{L}])(?:و|ب|ل|ف)?(?:${words})(?=$|[^\\p{L}])`, "iu");
const NUMBER_WORDS: [RegExp, number][] = [
  [W("اثنان|اثنين|اثنتان|اثنتين|two|دو"), 2],
  [W("ثلاث|ثلاثة|ثلاثه|three|سه"), 3],
  [W("اربع|اربعة|اربعه|four|چهار"), 4],
  [W("خمس|خمسة|خمسه|five|پنج"), 5],
  [W("ست|ستة|سته|six|شش"), 6],
  [W("سبع|سبعة|سبعه|seven|هفت"), 7],
  [W("ثمان|ثماني|ثمانية|ثمانيه|eight|هشت"), 8],
  [W("تسع|تسعة|تسعه|nine"), 9],
  [W("عشر|عشرة|عشره|ten|ده"), 10],
  [W("احد عشر|eleven|يازده"), 11],
  [W("اثنا عشر|اثني عشر|twelve|دوازده"), 12],
  [W("عشرين|عشرون|twenty|بيست"), 20],
];

/**
 * The code's check on the model. Returns why a reading must not be published,
 * or null when it may be.
 */
const CASUALTY_SRC = /قتيل|قتلى|شهيد|شهداء|جرحى|جريح|مصابين|كشته|مجروح|زخمي|\bkilled\b|\bwounded\b|\binjured\b|casualties/i;
const CASUALTY_COPY = /kill|dead|death|died|wound|injur|casualt|lives|bodies/i;
/** Words that say someone died; the wounded-only words are not among them. */
const KILLED_SRC = /قتل|قتيل|قتلى|مقتل|استشهد|استشهاد|شهيد|شهداء|كشته|جان باخت|وفاة|توفي|مصرع|جثث|جثة|\bkill|\bdead\b|\bdied\b|\bdeaths?\b|\bbodies\b|\bmartyr/i;

/** Words an English sentence of four or more words almost never goes without. */
const FUNCTION_WORDS = new Set(
  ("the a an of to in on at by for from with and or but is are was were be been has have had will would not no " +
    "we our us it its this that they their he his she her as than into after over").split(" "),
);

/**
 * Arabic spelled in Latin letters instead of translated: "Qwa Al-Haymna
 * Asthdft Al-Ymn Lamtlakh Waml Al-Nhda" went out as three lines of a speech.
 * No English function word, and vowelless words among "Al-" words.
 * The speaker before a colon is left out: a name may be spelled so.
 */
export function transliterated(headline: string): boolean {
  const said = String(headline || "").replace(/^[^:]{2,80}:\s+/, "");
  const words = said.split(/[^\p{L}'’-]+/u).filter(Boolean);
  if (words.length < 4) return false;
  if (words.some((w) => FUNCTION_WORDS.has(w.toLowerCase()))) return false;
  const stem = (w: string) => w.replace(/^(?:al|el)-/i, "");
  const al = words.filter((w) => /^(?:al|el)-/i.test(w)).length;
  // "Asthdft", "Qbwl", "Al-Ymn"; an acronym (GCC, UKMTO) is not one.
  const vowelless = words.filter((w) => stem(w).length >= 3 && !/^\p{Lu}+$/u.test(stem(w)) && !/[aeiouy]/i.test(stem(w).slice(1))).length;
  return vowelless >= 2 || (al >= 2 && vowelless >= 1);
}

/** Failures a second writing can fix; anything else is a judgement, and stands. */
export function repairable(problem: string): boolean {
  return /headline length|empty body|points dropped|unfamiliar name|casualties dropped|killed not in source|figure not in source|does not lead with its speaker|leads with outlet|written as|banned phrase|source-language|wrong speaker/i.test(problem);
}

const PLC_HEAD = /رئيس\s+مجلس\s+القيادة|العليمي|فخامة\s+(?:الأخ\s+)?الرئيس|Presidential (?:Leadership )?Council (?:head|chairman|president)|al-Alimi/i;
const HOUTHI_HEAD = /السيد\s+القائد|قائد\s+الثورة|قائد\s+(?:حركة\s+)?أنصار\s+الله|عبد\s?الملك\s+(?:بدر\s+الدين\s+)?الحوثي|Abdul[- ]?Malik/i;
const MASHAT = /المشاط|المجلس\s+السياسي\s+الأعلى|al-Mashat|Supreme Political Council/i;

/**
 * The one who spoke, against the title in the text. "رئيس مجلس القيادة" (the
 * government's president) came out "Houthi leader" on 28 September; a code
 * check stands behind the prompt's rule.
 */
export function wrongSpeaker(copy: string, sourceText: string): string | null {
  if (/\bHouthi leader\b/i.test(copy) && PLC_HEAD.test(sourceText) && !HOUTHI_HEAD.test(sourceText)) {
    return "wrong speaker: the text's رئيس مجلس القيادة is Yemen's president (al-Alimi), not the Houthi leader";
  }
  if (/\bHouthi political council head\b/i.test(copy) && PLC_HEAD.test(sourceText) && !MASHAT.test(sourceText)) {
    return "wrong speaker: the text's رئيس مجلس القيادة is Yemen's president (al-Alimi), not al-Mashat";
  }
  if (/\bYemen's president\b/i.test(copy) && !PLC_HEAD.test(sourceText) && (HOUTHI_HEAD.test(sourceText) || MASHAT.test(sourceText))) {
    return "wrong speaker: the text names a Houthi leader, not Yemen's president";
  }
  return null;
}

/*
 * Protocol is no report: "Presidential Council member opens IT college
 * building in Marib" went out on 29 September. An opening, a foundation stone,
 * a tour, a visit, a delegation received or a ceremony attended is dropped
 * when nothing in the card touches the war: no fighting, no casualties, no
 * decision or figure of its own. The reader's rule 3 says so; this stands
 * behind it.
 */
const PROTOCOL_ACT = /\b(?:opens|opened|inaugurat\w*|lays? (?:the )?foundation|launch(?:es|ed)? (?:the |a )?(?:project|course|programme|program|exhibition|campaign to (?:plant|clean|pave))|tours?|toured|visits?|visited|inspects?|inspected|receives?|received|attends?|attended|honou?rs?|honou?red|chairs?|chaired|graduat\w*|celebrat\w*|commemorat\w*|marks? (?:the )?anniversary)\b/i;
const PROTOCOL_OBJECT = /\b(?:building|college|university|school|institute|hospital|clinic|centre|center|project|road|bridge|office|headquarters|exhibition|workshop|seminar|course|ceremony|celebration|festival|anniversary|graduation|delegation|ambassador|envoy|guests?|station|plant|factory|market|mosque|stadium|library)\b/i;
const WAR_NEWS = /\b(?:kill\w*|dead|deaths?|died|wound\w*|injur\w*|casualt\w*|attack\w*|strik\w*|struck|missiles?|drones?|UAVs?|shell\w*|clash\w*|fight\w*|battle\w*|front\w*|captur\w*|seiz\w*|advanc\w*|repel\w*|offensive|troops|soldiers|fighters|weapons?|arms|mobili[sz]\w*|recruit\w*|evacuat\w*|displac\w*|explosion|blast|bomb\w*|mines?|ceasefire|truce|talks|negotiat\w*|prisoners?|detain\w*|arrest\w*|hostages?|siege|blockade|shipping|Red Sea|Bab al-Mandab|sanctions?|aid|relief|famine|cholera|war|military|army|brigades?|defen[cs]e|security forces|reinforce\w*|frontline|threat\w*|warn\w*|vow\w*|accus\w*|condemn\w*|escalat\w*|damage\w*|destroy\w*|rebuil\w*|reconstruct\w*)\b/i;
export function protocolOnly(headline: string, body = ""): boolean {
  const h = String(headline || "");
  if (!PROTOCOL_ACT.test(h) || !PROTOCOL_OBJECT.test(`${h} ${body}`)) return false;
  // Someone's own words ("Minister: Haifan road in Taiz is open") are judged as a statement.
  if (/^[^:]{2,80}:\s/.test(h)) return false;
  // A figure of its own (money, a count) is a fact a reader may want.
  if (/\d/.test(h)) return false;
  return !WAR_NEWS.test(`${h} ${body}`);
}

/**
 * `strict` adds the checks a repair may still fail on a good card (casualties,
 * side words); a card that failed them twice goes out rather than be lost.
 */
export function checkReading(r: Reading, sourceText: string, strict = true): string | null {
  if (!r.publish) return r.reject_reason || "not publishable";
  const h = String(r.headline || "").trim();
  const b = String(r.body || "").trim();
  if (protocolOnly(h, b)) return "protocol: an opening, visit or ceremony with no news of the war";
  if (h.length < 12 || h.length > 140) return "headline length";
  if (b && b.length < 20) return "empty body";
  if (/[؀-ۿ֐-׿]/.test(h + b)) return "source-language text in copy";
  if (transliterated(h)) return "headline written as transliterated Arabic";
  for (const re of BANNED_PHRASES) if (re.test(`${h} ${b}`)) return `banned phrase: ${re.source}`;

  // Every figure must come from the source. Years and ordinals in dates are
  // numbers too, so they are held to the same rule.
  const have = figuresIn(sourceText, true);
  for (const n of figuresIn(`${h} ${b}`)) {
    if (!have.has(n)) return `figure not in source: ${n}`;
  }

  // A speaker with nothing after the colon, or an empty quote, says nothing.
  if (/:\s*(?:["“”'‘’]\s*["“”'‘’]\s*)?$/.test(h.trim())) return "headline is only its speaker: say what they said";
  if (r.event_type === "statement" || r.event_type === "diplomacy") {
    // A headline shaped "X: ..." names its speaker even when the field is empty.
    const lead = String(r.speaker_lead || "").trim() || (/^([^:]{2,60}):\s/.exec(h)?.[1] ?? "");
    // A report about someone is a plain sentence; only a named speaker leads.
    if (lead && !h.toLowerCase().startsWith(lead.toLowerCase())) return "statement does not lead with its speaker";
  }
  if (OUTLET_LEAD.test(h)) return "headline leads with outlet";
  const added = SAUDI_SITES.find(([en, src]) => en.test(`${h} ${b}`) && !src.test(sourceText));
  if (added) return `place not in source: ${added[0].source.split("|")[0].replace(/\\b/g, "")} — name only the places the text names`;
  // Never let pass: a card that puts the other side's leader's words in his mouth.
  const who = wrongSpeaker(`${h} ${b}`, sourceText);
  if (who) return who;
  // Casualties in the source are never dropped from the copy.
  if (!strict) return null;
  // Persian letters as the Arabic ones: "شهید", "کشته".
  const srcN = sourceText.replace(/[یۍې]/g, "ي").replace(/ک/g, "ك");
  if (CASUALTY_SRC.test(srcN) && !CASUALTY_COPY.test(`${h} ${b}`)) return "casualties dropped";
  // Wounded is not killed: "Saudi air strikes on Kamaran Island kill 3
  // citizens" over a text that says three were wounded.
  if (/\bkill(?:s|ed|ing)?\b|\bdead\b|\bdeaths?\b|\bdied\b/i.test(h) && !KILLED_SRC.test(srcN)) return "killed not in source";
  // A Houthi actor is never "Yemeni forces", nor a government one "Houthi".
  if (r.actor_side === "houthi" && /\bYemeni (?:armed )?forces\b|\bYemen's (?:army|armed forces)\b/i.test(`${h} ${b}`)) return "Houthi actor written as Yemeni forces";
  // "Amin al-Warafi receives released prisoners in Ibb": nobody knows him.
  const name = UNKNOWN_NAME_LEAD.exec(h);
  if (name && !KNOWN_NAMES.test(name[0])) return `unfamiliar name in headline: "${name[0].trim()}" — write their role or affiliation, never the name`;
  // A statement of many points kept to one line: the STC official's nine
  // points to an Italian paper went out as one of them and no body.
  const points = pointsIn(sourceText);
  if ((r.event_type === "statement" || r.event_type === "diplomacy") && points >= 4 && b.length < 120) {
    return `points dropped: the text makes ${points} points; the body carries every newsworthy one, as long as it needs`;
  }
  return null;
}

/**
 * Saudi sites a card may name only when its text does. Saree's 3 Oct
 * statement named Riyadh alone, and cards on it said "Riyadh, Yanbu and
 * Abqaiq" and "Riyadh and Khurais": the model filled in the usual targets.
 */
const SAUDI_SITES: [RegExp, RegExp][] = [
  [/\bYanbu\b/i, /Yanbu|ينبع/i],
  [/\bAbqaiq\b/i, /Abqaiq|بقيق/i],
  [/\bKhurais\b/i, /Khurais|خريص/i],
  [/\bRabigh\b/i, /Rabigh|رابغ/i],
  [/\bRas Tanura\b/i, /Ras Tanura|رأس تنورة|راس تنورة/i],
  [/\bJ(?:i|a)zan\b/i, /J(?:i|a)zan|جازان|جيزان/i],
  [/\bJeddah\b/i, /Jeddah|Jiddah|جدة|جده/i],
  [/\bTaibah\b/i, /Taibah|طيبة/i],
];

/** A headline opening on a personal name ("Amin al-Warafi receives …", "Amin al-Warafi: …"). */
const UNKNOWN_NAME_LEAD = /^(?:(?:Dr|Sheikh|Brig|Gen|Maj|Col)\.? )?[A-Z][a-z]+(?: [A-Z][a-z]+)? (?:al|Al|el|El)-[A-Z][\w'-]+(?=:| [a-z])/;
/** Names a general reader knows, or that the desk turns into roles itself. */
const KNOWN_NAMES = /\b(?:al-(?:Houthi|Alimi|Zubaidi|Mashat|Maliki|Eryani|Mahrami|Sisi|Assad|Sharaa|Sudani|Thani|Nahyan|Busaidi|Bidh))\b|^Abdul Malik/i;

/** The separate claims of a statement: its lines of some length, bullets and hashtags aside. */
export function pointsIn(text: string): number {
  return String(text || "")
    .split(/\n+|\s(?=[🔴🔵🟢🟡🟠⚪⚫•▪◾◽🔸🔹📌✅🔻🔺⭕])/u)
    .map((l) => l.replace(/#\S+/g, "").replace(/^[\s🔴🔵🟢🟡🟠⚪⚫•▪◾◽🔸🔹📌✅🔻🔺⭕️*-]+/u, "").trim())
    .filter((l) => l.length >= 40).length;
}

type CallResult = { readings: Reading[]; model: string } | { error: string };

async function callModel(items: ReaderItem[], apiKey: string, model: string, recent: RecentReport[], prompt: ReaderPrompt): Promise<CallResult> {
  const payload = items.map((i) => ({
    id: i.id,
    source: i.source,
    source_alignment: i.alignment,
    posted_at: i.postedAt,
    text: i.text.slice(0, i.full ? FULL_TEXT_MAX : i.text.includes("[Said in the video]") ? 5000 : 2400),
    ...(spellingHints(i.text) ? { spelling: spellingHints(i.text) } : {}),
    ...(calendarHints(i.text) ? { dates: calendarHints(i.text) } : {}),
    ...(i.fix ? { fix_previous: i.fix } : {}),
  }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), READER_TIMEOUT_MS);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ recent, items: payload }) }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: prompt.schema },
      }),
    });
    // A 429 is either the minute's quota (wait a cycle) or the day's (wait for
    // midnight Pacific, when Google resets it); the body's quota id says which.
    if (res.status === 429) return { error: /PerDay/i.test(await res.text().catch(() => "")) ? "HTTP 429 daily" : "HTTP 429" };
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return { error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
    const parsed = JSON.parse(text) as { items?: Reading[] };
    if (!Array.isArray(parsed.items)) return { error: "no items in response" };
    return { readings: parsed.items, model };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "call failed" };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * How long one reader call may take. A healthy call answers in 10-30s; one
 * that hangs is not waited on for a minute, and never three times in a row.
 */
const READER_TIMEOUT_MS = 35_000;

/** One line per call, so a slow or failing model shows in the server log. */
function logCall(model: string, n: number, started: number, error?: string) {
  console.log(`[reader] ${model} ${n} items ${Math.round((Date.now() - started) / 1000)}s${error ? ` | ${error}` : ""}`);
}

/**
 * Read a batch, walking the model chain. Busy (503): back off and retry. Out
 * of quota (429): note the model in `exhausted` so the caller skips it for a
 * while, and move to the next. Returns what was read; anything missing simply
 * was not read this time.
 */
export async function readBatch(
  items: ReaderItem[],
  apiKey: string,
  skip: ReadonlySet<string> = new Set(),
  recent: RecentReport[] = [],
  models: readonly string[] = READER_MODELS,
  prompt: ReaderPrompt = YEMEN_PROMPT,
  /** The other free services before Gemini (the Iran desk's reader, so Yemen's Gemini quota lasts). */
  fallbacksFirst = false,
): Promise<{ readings: Map<string, Reading>; model?: string; error?: string; exhausted: string[]; minute: string[]; slow: string[] }> {
  let lastError = "";
  // Out for the day, and out for this minute only.
  const exhausted: string[] = [];
  const minute: string[] = [];
  // Hung past the timeout: the caller rests it for a while, across scans.
  const slow: string[] = [];
  type Done = { readings: Map<string, Reading>; model?: string; exhausted: string[]; minute: string[]; slow: string[] };
  const gemini = async (): Promise<Done | null> => {
  for (const model of models) {
    if (!apiKey || skip.has(model) || exhausted.includes(model) || minute.includes(model)) continue;
    // Busy (503): one short retry. A timeout is not retried: the model that
    // hung once this minute will hang again, and the next one is waiting.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const started = Date.now();
      const r = await callModel(items, apiKey, model, recent, prompt);
      if ("readings" in r) {
        logCall(model, items.length, started);
        const byId = new Map<string, Reading>();
        for (const x of r.readings) if (x && typeof x.id === "string") byId.set(x.id, x);
        return { readings: byId, model: r.model, exhausted, minute, slow };
      }
      logCall(model, items.length, started, r.error);
      lastError = `${model}: ${r.error}`;
      // Quota exhausted: the next model has its own quota — move on now.
      if (r.error.startsWith("HTTP 429")) {
        (r.error.endsWith("daily") ? exhausted : minute).push(model);
        break;
      }
      // Timed out: skipped for the rest of this scan.
      if (/abort/i.test(r.error)) {
        minute.push(model);
        slow.push(model);
        break;
      }
      if (r.error !== "HTTP 503") break;
      // Still busy after the retry: the other batches of this scan skip it.
      if (attempt === 1) minute.push(model);
      else await sleep(1500);
    }
  }
  return null;
  };
  // Every Gemini model out (or no Gemini key): the other free services read
  // what they can, each model with its own allowance. What they do not reach
  // stays queued for the next cycle.
  const others = async (): Promise<Done | null> => {
  for (const p of FALLBACKS) {
    const pk = p.key();
    if (!pk) continue;
    for (const gm of p.models) {
      // The same model on two services has two allowances: Groq's keep their bare names.
      const tag = serviceModel(p.name, gm);
      if (skip.has(tag) || exhausted.includes(tag) || minute.includes(tag)) continue;
      const started = Date.now();
      const n = Math.min(items.length, p.batch);
      // The Iran desk reads these first, and tells one story for hours: 15
      // recent cards (half an hour) let the same story be carded ten times (8 Oct).
      const r = await callOpenAI(items.slice(0, p.batch), pk, recent.slice(0, fallbacksFirst ? 60 : 15), p, gm, prompt);
      if ("readings" in r) {
        logCall(tag, n, started);
        const byId = new Map<string, Reading>();
        for (const x of r.readings) if (x && typeof x.id === "string") byId.set(x.id, x);
        return { readings: byId, model: tag, exhausted, minute, slow };
      }
      logCall(tag, n, started, r.error);
      lastError = `${tag}: ${r.error}`;
      if (r.daily) exhausted.push(tag);
      else if (/429|503|abort/i.test(r.error)) minute.push(tag);
    }
  }
  return null;
  };
  for (const step of fallbacksFirst ? [others, gemini] : [gemini, others]) {
    const done = await step();
    if (done) return done;
  }
  return { readings: new Map(), error: lastError || "every model skipped (quota)", exhausted, minute, slow };
}

/**
 * The fallback reader, used only when every Gemini model is out of quota.
 * Same prompt, same `checkReading` afterwards, so a weaker model can publish
 * less, never something wrong.
 */
export const GROQ_MODEL = "openai/gpt-oss-120b";
/** Groq's free models, strongest first; each has its own allowance. */
export const GROQ_MODELS = [GROQ_MODEL, "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

const env = (name: string) => (typeof process !== "undefined" && process.env[name]?.trim()) || "";

/**
 * The free services tried after Gemini, all speaking the OpenAI chat format.
 * A service without its key in the settings is skipped, so adding one is only
 * a matter of its key (and, if its model names change, `<NAME>_MODELS`).
 * Groq's free tier counts tokens per minute, so it takes a few items a call;
 * the others allow more (Cerebras is a paid trial since 16 Jul 2026; GitHub
 * Models closed on 30 Jul 2026).
 *
 * Tried on three sample reports (2 Oct): NVIDIA's Nemotron 3 Super read them
 * right in 20 s with its thinking off (110 s with it on). Mistral's free plan
 * opens only its small models (Ministral, Nemo), and Ministral 14B called the
 * Houthi spokesman "government forces", so Mistral has no model by default.
 * NVIDIA's gpt-oss-120b was retired on 3 Sep.
 *
 * Tried on 24 live Telegram posts against Gemini (8 Oct, scripts/model-trial.mts):
 * Nemotron 3 Ultra agreed on 23 of 24 publish calls and 6 of 7 sides in 38 s,
 * so it leads NVIDIA's list; Super agreed less (22, 3 of 5 sides) in 17 s.
 * Kimi K3 and Gemma 4 read as well but took over 4 minutes; DeepSeek V4.1
 * Flash and GLM 5.3 Flash never answered in 150 s.
 */
export type Fallback = { name: string; url: string; key: () => string; models: string[]; batch: number; ms?: number };
const list = (name: string, dflt: string) => (env(name) || dflt).split(",").map((s) => s.trim()).filter(Boolean);
export const FALLBACKS: Fallback[] = [
  { name: "cerebras", url: "https://api.cerebras.ai/v1/chat/completions", key: () => env("CEREBRAS_API_KEY"), models: list("CEREBRAS_MODELS", "gpt-oss-120b"), batch: 15 },
  { name: "nvidia", url: "https://integrate.api.nvidia.com/v1/chat/completions", key: () => env("NVIDIA_API_KEY"), models: list("NVIDIA_MODELS", "nvidia/nemotron-3-ultra-550b-a55b,nvidia/nemotron-3-super-120b-a12b"), batch: 5, ms: 90_000 },
  { name: "openrouter", url: "https://openrouter.ai/api/v1/chat/completions", key: () => env("OPENROUTER_API_KEY"), models: list("OPENROUTER_MODELS", "openai/gpt-oss-120b:free"), batch: 10 },
  { name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", key: () => groqKey(), models: GROQ_MODELS, batch: 4 },
  { name: "mistral", url: "https://api.mistral.ai/v1/chat/completions", key: () => env("MISTRAL_API_KEY"), models: list("MISTRAL_MODELS", ""), batch: 15 },
];

/** Nemotron thinks at length unless told not to: five times slower, and no better on the reader's job. */
export const noThinking = (model: string) => (/nemotron/.test(model) ? { chat_template_kwargs: { enable_thinking: false } } : {});

/** Gemini keeps actor_side to its list; the other services may answer in words ("Houthi forces"). */
const SIDES = ["houthi", "government", "stc", "saudi", "other", "unclear"] as const;
function sideWord(x: Reading, prompt: ReaderPrompt = YEMEN_PROMPT): Reading {
  const s = String(x?.actor_side ?? "").toLowerCase();
  if (!s || prompt.sides.includes(s)) return x;
  return { ...x, actor_side: prompt.side(s) as Reading["actor_side"] };
}
function yemenSide(s: string): string {
  return /houthi|ansar/.test(s) ? "houthi" : /\bstc\b|transitional/.test(s) ? "stc" : /saudi|coalition/.test(s) ? "saudi" : /gov|giant|amaliqa|legitim/.test(s) ? "government" : "unclear";
}
/** The Yemen desk's reader: its prompt, its answer's shape, its sides. */
export const YEMEN_PROMPT: ReaderPrompt = { system: SYSTEM_PROMPT, schema: RESPONSE_SCHEMA, sides: SIDES, side: yemenSide };

/** A model's name in the logs and rest lists: Groq's bare, any other service's prefixed. */
export function serviceModel(service: string, model: string): string {
  return service === "groq" ? model : `${service}/${model}`;
}

/** Is any fallback service set up? */
export function fallbackKey(): boolean {
  return FALLBACKS.some((p) => !!p.key());
}

async function callOpenAI(
  items: ReaderItem[],
  apiKey: string,
  recent: RecentReport[],
  provider: Fallback,
  model: string,
  prompt: ReaderPrompt = YEMEN_PROMPT,
): Promise<{ readings: Reading[]; model: string } | { error: string; daily: boolean }> {
  const payload = items.map((i) => ({
    id: i.id,
    source: i.source,
    source_alignment: i.alignment,
    posted_at: i.postedAt,
    text: i.text.slice(0, i.full ? 6000 : i.text.includes("[Said in the video]") ? 4000 : 1600),
    ...(spellingHints(i.text) ? { spelling: spellingHints(i.text) } : {}),
    ...(calendarHints(i.text) ? { dates: calendarHints(i.text) } : {}),
    ...(i.fix ? { fix_previous: i.fix } : {}),
  }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), provider.ms ?? 45_000);
  try {
    const res = await fetch(provider.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        ...(/gpt-oss/.test(model) ? { reasoning_effort: "low" } : {}),
        ...noThinking(model),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: JSON.stringify({ recent, items: payload }) },
        ],
      }),
    });
    if (!res.ok) {
      // A per-minute limit clears by the next cycle; a daily one does not.
      const wait = Number(res.headers.get("retry-after") || 0);
      await res.body?.cancel().catch(() => {});
      return { error: `HTTP ${res.status}`, daily: res.status === 429 && wait > 600 };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "") as { items?: Reading[] } | Reading[];
    // Some models (Mistral's small ones) answer with the bare list, or under another name.
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : Object.values(parsed).find(Array.isArray);
    if (!list) return { error: "no items in response", daily: false };
    return { readings: (list as Reading[]).map((x) => sideWord(x, prompt)), model };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "call failed", daily: false };
  } finally {
    clearTimeout(timer);
  }
}

export function readerKey(): string {
  return (typeof process !== "undefined" && process.env.GEMINI_API_KEY?.trim()) || "";
}

export function groqKey(): string {
  return (typeof process !== "undefined" && process.env.GROQ_API_KEY?.trim()) || "";
}
