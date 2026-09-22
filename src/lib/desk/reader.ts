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
  actor_side?: "houthi" | "government" | "stc" | "saudi" | "other" | "unclear";
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
  // Each has its own free daily quota. The newest is last: the 12-hour prose
  // leads with it (models.ts), so the reader leaves it for that when it can.
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
];
/** The stronger reader for a second look at a rejected field report. */
export const SECOND_LOOK_MODELS = ["gemini-flash-latest"];
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
const RESPONSE_SCHEMA = {
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
Arabic) and return one verdict per item. You decide whether each item is
published, and you write it. Being wrong is worse than being silent: when in
doubt, publish=false.

PUBLISH ONLY IF ALL OF THESE HOLD
1. IN SCOPE. The item is about THIS war. Our sources cover many other stories;
   an item is not ours because it sounds military. Out of scope, whoever posts
   it: Iran or the IRGC acting against the US or Israel (e.g. a drone shot down
   over Hormuz) unless the item itself ties it to Yemen or the Houthis; Gaza,
   Lebanon, Iraq, Syria, Ukraine, Pakistan, Sudan as the subject; domestic
   politics of any country. In scope: fighting, strikes, launches, sirens and
   alerts in Yemen, in Saudi Arabia, and at sea; statements by the parties
   (Houthis, the Yemeni government, Saudi Arabia) and by the US, Iran, the UN,
   Europe, Turkey, Pakistan, Qatar ABOUT this war; arms sales to a party; a
   party tying Yemen to other fronts ("unity of fronts");
   outside powers deciding or debating whether to strike, arm or back a party
   (e.g. Trump weighing strikes on the Houthis after a Saudi request), and
   requests for help between the parties and their allies; foreign media
   reports about this war, including ones relayed by other outlets ("according
   to the New York Times ..."). These are in scope, not "internal politics".
2. CURRENT. It reports something that happened or was said now. NOT a
   programme title, a video segment, a battle map, a documentary, an analysis,
   an anniversary, a recap. "Marib and Taiz: the map of the battles #ThisDay"
   is a programme clip, not a report of clashes — publish=false.
3. SUBSTANTIVE. A reader learns what happened or what was said about what.
   "A spokesman said something" with no content is not a report.
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
- A short item that fits in the headline: the whole report goes in the
  headline and body is "" (empty). Never a body that says the headline again
  in more words.
- A longer item, as a wire story: the headline carries the most important
  facts; the body (1-3 sentences) adds the next ones — detail, figures,
  context from the text — never a rephrasing of the headline.
- A long item is a full article: read ALL of it. The headline carries its
  most important new development wherever in the text it appears — a
  decision, a commitment, a reversal, casualties — not only the opening
  paragraph; the body keeps the other key facts (a leader agreed to strike,
  then called it off: both).
- Do not compress: keep who, what, where, casualties (killed and wounded,
  with their figures), weapon and unit. A short item stays whole.
- Every number, name and place you write must be in the item's text. Add
  nothing: no background, no cause, no casualties, no attribution the text
  does not give.
- NEVER write about what is missing or unverified: no "no casualties were
  reported", "casualty figures were not given", "details were not immediately
  available", "could not be independently verified", "it was unclear". Never
  name the outlet or say who "carried" or "reported" the item — the card shows
  the source.
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
condemnation, a funding appeal) stays statement or diplomacy.

SIDES (actor_side)
Both the Houthis (Sanaa) and the recognised government (Aden) call themselves
"Yemen", "the Yemeni armed forces", "Yemen's defence minister". Judge each
item's side from its evidence: the person named (Saree, al-Mashat, the Sanaa
ministers are Houthi; al-Alimi, the Aden ministers, the national army are
government), the seat (Sanaa, Saba Sanaa, Al-Masirah vs Aden, Saba Aden, the
Presidential Council), the content (fire on Saudi Arabia, its ships or its
soldiers, "the aggression" = Houthi; "the militia", "the Houthi coup" =
government). The outlet's alignment is a hint, never enough alone.
actor_side = the side of whoever acted or spoke: houthi | government | stc |
saudi | other | unclear. Write it: Houthi -> "Houthi forces", "a Houthi
attack", "Houthi defence minister", never "Yemeni forces" or "a Yemeni
attack"; government -> "Yemeni government forces", "Yemen's government
defence minister"; unclear -> the name and title only, no label.

STATEMENTS (event_type statement or diplomacy)
- speaker_lead is REQUIRED: the person or body the report is about.
- A colon ONLY when the item carries that person's own words (a quote, speech,
  post, interview, statement, remarks): "Houthi spokesperson: Saudi jets
  carried out 28 strikes in 24 hours". Then ALWAYS the colon, straight after
  the speaker — never "UN spokesman says …" or "UN spokesman warns …": write
  "UN spokesman: …".
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
  (the Houthi armed forces spokesman) is always "Houthi spokesperson"; al-Alimi is
  "Yemen's president", al-Mashat "the Houthi political council head",
  al-Zubaidi "the STC leader", in the headline and wherever a reader would not
  know the name.
- Tom Fletcher is "UN aid chief Tom Fletcher". An official's "we" is his
  organisation: a UN official's "we fear famine" is "the UN fears famine" in the
  body. One person is never "they": "Fletcher told Al Arabiya the UN fears …".
- Words of the speaker in the first person (our, we, us) only after the colon,
  never "X said that our …": either "Houthi leader: our demands are legitimate"
  or "Houthi leader says the Houthis' demands are legitimate".
  Otherwise the title alone ("Yemen's defence minister", "The Houthis' chief
  negotiator") or the affiliation alone ("A Houthi official", "A Saudi
  military analyst"). Never an unfamiliar personal name, in headline or body.
- Say what was said, specifically. If the speaker denies an accusation, state
  the accusation and the denial.

SPEECH LINES
Channels post a live speech one sentence at a time ("السيد القائد: ...").
Each line is read on its own. Publish a line ONLY if it carries at least one of:
a threat or warning to a named party; an announcement (an operation,
escalation, halt, deadline or condition); a new position on talks or a deal;
a claim of a specific attack or its result; a figure. Praise, prayer,
thanks, history, the anniversary, general accusations and slogans are
rejected with reject_reason "speech-rhetoric". A published line is
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
  "Al Masirah|Saba|SPA|Media|Reports?|Sources?";
export const OUTLET_LEAD = new RegExp(`^(?:${OUTLET_NAMES})(?:\\s+(?:sources?|reports?|TV))?\\s*:\\s*`, "i");

/**
 * Headline fixes the model keeps needing: an outlet opening the headline goes
 * ("Reuters sources: Reuters: …"), and a colon after a name that introduces
 * no words of theirs ("Trump: held a call …") becomes a plain sentence.
 */
export function fixHeadline(headline: string): string {
  let h = String(headline || "").trim();
  while (OUTLET_LEAD.test(h)) h = h.replace(OUTLET_LEAD, "");
  h = h.replace(/^(?:Sayyed |Sayyid )?Abdul[- ]?Malik (?:Badr al-Din |Badreddin )?al-Houthi:/i, "Houthi leader:");
  // People readers do not know by name go by their role.
  for (const [name, role] of ROLE_NAMES) h = h.replace(name, (_m, at: number) => (at === 0 ? role.replace(/^the /, "") : role));
  h = h.replace(/\b(Yemen's president)(?:,? \1)+/gi, "$1");
  // "Name: role: words" — one speaker, named by role only.
  h = h.replace(/^[^:]{2,40}:\s+([^:]{2,60}):\s+/, "$1: ");
  h = h.replace(/^Yemeni ((?:culture|information|foreign|defen[cs]e|interior|oil|finance) minister):/i, "Yemen's $1:");
  // "X said that our …" is his own words without the quote: the colon form.
  h = h.replace(/^([^:]{2,60}?) (?:said|says|stated|stressed|affirmed|declared|added) (?:that )?((?:our|we|us|my|I)\b.*)$/, "$1: $2");
  // A spokesman's or minister's statement always takes the colon: "UN
  // spokesman says talks will resume" → "UN spokesman: talks will resume".
  h = h.replace(SPEAKER_SAYS, "$1: $2");
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
  [/\b(?:Yemen's |Yemeni )?(?:[Pp]resident(?:ial (?:Leadership )?Council (?:head|chairman|leader))? )?(?:Rashad )?al-Alimi\b/gi, "Yemen's president"],
  [/\b(?:STC (?:leader|head|chief) )?(?:Aidarous |Aidrous )?al-Zubaidi\b/gi, "the STC leader"],
  [/\b(?:Houthi (?:political council|Supreme Political Council) (?:head|chief) )?(?:Mahdi )?al-Mashat\b/gi, "the Houthi political council head"],
  [/\b(?:(?:the )?(?:Houthi|Yemeni|Sanaa) (?:armed forces |military |army )?spokes(?:man|person) )?(?:Brig(?:adier)?\.? (?:Gen(?:eral)?\.? )?)?(?:Yahya )?Saree\b/gi, "the Houthi spokesperson"],
  [/\bHouthi (?:armed forces |military |army )?spokes(?:man|person)\b/gi, "Houthi spokesperson"],
  [/\b(?:(?:the )?UN (?:aid|humanitarian|relief) (?:chief|coordinator|head) )?Tom Fletcher\b/g, "UN aid chief Tom Fletcher"],
];

/** Running prose (the 12-hour brief): the same people by role, "Houthi leader" included. */
export function roleNamesInProse(text: string): string {
  let t = String(text || "").replace(/\b(?:the )?Houthi leader,? (?:Sayyed |Sayyid )?Abdul[- ]?Malik (?:Badr al-Din |Badreddin )?al-Houthi\b|\b(?:Sayyed |Sayyid )?Abdul[- ]?Malik (?:Badr al-Din |Badreddin )?al-Houthi\b/gi, "the Houthi leader");
  for (const [name, role] of ROLE_NAMES) t = t.replace(name, role);
  // A sentence opens with a capital, whatever role now leads it.
  return t.replace(/(^|[.!?]\s+)the /g, "$1The ");
}
/** "<role> says/warns (that) X" for a speaker whose words X are: the colon form. */
const SPEAKER_SAYS =
  /^((?:[\w'.-]+ ){0,4}(?:spokes(?:man|person|woman)|minister|envoy|leader|secretary-general|chief|coordinator|Guterres|Grundberg|Fletcher)) (?:says|said|stated|warns|warned|stresses|stressed|affirms|affirmed|confirms|confirmed|declares|declared) (?:that )?(.+)$/i;

const BODY_FILLER = new Set(
  ("the and are was were has have had been for with from that this its their there after into over also " +
    "said says say sources source report reports reported according carried out " +
    "governorate province district city town area north south east west northern southern eastern western yemen yemeni").split(" "),
);
const stemOf = (w: string) => w.replace(/(?:ing|ed|es|s)$/, "");
const wordsOf = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);

/**
 * A body that only says the headline again in more words ("There are
 * indications of fuel shortages in Sanaa, sources say" under "Indications of
 * fuel shortages in Sanaa, sources say"). A new number, a casualty or a name
 * the headline lacks keeps it.
 */
export function redundantBody(headline: string, body: string): boolean {
  const b = String(body || "").trim();
  if (!b) return false;
  const h = String(headline || "");
  const hl = h.toLowerCase();
  if ((b.match(/\d+/g) || []).some((n) => !h.includes(n))) return false;
  const counts = (s: string) => new Set(s.toLowerCase().match(/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|dozens?|hundreds?|thousands?)\b/g) || []);
  const hc = counts(h);
  if ([...counts(b)].some((n) => !hc.has(n))) return false;
  if (/\b(?:killed|wounded|injured|dead|died|casualt)/i.test(b) && !/\b(?:killed|wounded|injured|dead|died|casualt)/i.test(h)) return false;
  const seen = new Set(wordsOf(h).map(stemOf));
  const fresh = wordsOf(b).filter((w) => !BODY_FILLER.has(w) && !seen.has(stemOf(w)));
  // A capitalised name the headline does not have (the dateline aside).
  const names = (b.replace(/^[^—]{2,30}—\s*/, "").match(/(?<=\S\s)[A-Z][\p{L}'-]{2,}/gu) || []).filter((n) => !hl.includes(n.toLowerCase()) && !BODY_FILLER.has(n.toLowerCase()));
  if (names.length) return false;
  return fresh.length <= 2;
}
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

/** Western digits for every number in a text, Arabic-Indic included. */
function numbersIn(text: string): Set<string> {
  const western = String(text || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  return new Set((western.match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, "")));
}

/**
 * The code's check on the model. Returns why a reading must not be published,
 * or null when it may be.
 */
const CASUALTY_SRC = /قتيل|قتلى|شهيد|شهداء|جرحى|جريح|مصابين|\bkilled\b|\bwounded\b|\binjured\b|casualties/i;
const CASUALTY_COPY = /kill|dead|death|died|wound|injur|casualt|lives|bodies/i;

/** Failures a second writing can fix; anything else is a judgement, and stands. */
export function repairable(problem: string): boolean {
  return /headline length|empty body|casualties dropped|does not lead with its speaker|leads with outlet|written as|banned phrase|source-language/i.test(problem);
}

/**
 * `strict` adds the checks a repair may still fail on a good card (casualties,
 * side words); a card that failed them twice goes out rather than be lost.
 */
export function checkReading(r: Reading, sourceText: string, strict = true): string | null {
  if (!r.publish) return r.reject_reason || "not publishable";
  const h = String(r.headline || "").trim();
  const b = String(r.body || "").trim();
  if (h.length < 12 || h.length > 140) return "headline length";
  if (b && b.length < 20) return "empty body";
  if (/[؀-ۿ֐-׿]/.test(h + b)) return "source-language text in copy";
  for (const re of BANNED_PHRASES) if (re.test(`${h} ${b}`)) return `banned phrase: ${re.source}`;

  // Every figure must come from the source. Years and ordinals in dates are
  // numbers too, so they are held to the same rule.
  const have = numbersIn(sourceText);
  for (const n of numbersIn(`${h} ${b}`)) {
    if (!have.has(n)) return `figure not in source: ${n}`;
  }

  if (r.event_type === "statement" || r.event_type === "diplomacy") {
    // A headline shaped "X: ..." names its speaker even when the field is empty.
    const lead = String(r.speaker_lead || "").trim() || (/^([^:]{2,60}):\s/.exec(h)?.[1] ?? "");
    // A report about someone is a plain sentence; only a named speaker leads.
    if (lead && !h.toLowerCase().startsWith(lead.toLowerCase())) return "statement does not lead with its speaker";
  }
  if (OUTLET_LEAD.test(h)) return "headline leads with outlet";
  // Casualties in the source are never dropped from the copy.
  if (!strict) return null;
  if (CASUALTY_SRC.test(sourceText) && !CASUALTY_COPY.test(`${h} ${b}`)) return "casualties dropped";
  // A Houthi actor is never "Yemeni forces", nor a government one "Houthi".
  if (r.actor_side === "houthi" && /\bYemeni (?:armed )?forces\b|\bYemen's (?:army|armed forces)\b/i.test(`${h} ${b}`)) return "Houthi actor written as Yemeni forces";
  return null;
}

type CallResult = { readings: Reading[]; model: string } | { error: string };

async function callModel(items: ReaderItem[], apiKey: string, model: string, recent: RecentReport[]): Promise<CallResult> {
  const payload = items.map((i) => ({
    id: i.id,
    source: i.source,
    source_alignment: i.alignment,
    posted_at: i.postedAt,
    text: i.text.slice(0, i.full ? FULL_TEXT_MAX : 2400),
    ...(i.fix ? { fix_previous: i.fix } : {}),
  }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ recent, items: payload }) }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      }),
    });
    // A 429 is either the minute's quota (wait a cycle) or the day's (wait for
    // midnight Pacific, when Google resets it); the body's quota id says which.
    if (res.status === 429) return { error: /PerDay/i.test(await res.text().catch(() => "")) ? "HTTP 429 daily" : "HTTP 429" };
    if (!res.ok) return { error: `HTTP ${res.status}` };
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
): Promise<{ readings: Map<string, Reading>; model?: string; error?: string; exhausted: string[]; minute: string[] }> {
  let lastError = "";
  // Out for the day, and out for this minute only.
  const exhausted: string[] = [];
  const minute: string[] = [];
  for (const model of models) {
    if (!apiKey || skip.has(model)) continue;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const r = await callModel(items, apiKey, model, recent);
      if ("readings" in r) {
        const byId = new Map<string, Reading>();
        for (const x of r.readings) if (x && typeof x.id === "string") byId.set(x.id, x);
        return { readings: byId, model: r.model, exhausted, minute };
      }
      lastError = `${model}: ${r.error}`;
      // Quota exhausted: the next model has its own quota — move on now.
      if (r.error.startsWith("HTTP 429")) {
        (r.error.endsWith("daily") ? exhausted : minute).push(model);
        break;
      }
      if (r.error !== "HTTP 503" && !/abort/i.test(r.error)) break;
      await sleep(1500 * 2 ** attempt);
    }
  }
  // Every Gemini model out (or no Gemini key): the free Groq fallback reads
  // what it can. Its free tier counts tokens per minute, so it takes a few
  // items per call; what it does not reach stays queued for the next cycle.
  const groq = groqKey();
  if (groq && !skip.has(GROQ_MODEL)) {
    const r = await callGroq(items.slice(0, GROQ_BATCH), groq, recent.slice(0, 15));
    if ("readings" in r) {
      const byId = new Map<string, Reading>();
      for (const x of r.readings) if (x && typeof x.id === "string") byId.set(x.id, x);
      return { readings: byId, model: r.model, exhausted, minute };
    }
    lastError = `${GROQ_MODEL}: ${r.error}`;
    if (r.daily) exhausted.push(GROQ_MODEL);
  }
  return { readings: new Map(), error: lastError || "every model skipped (quota)", exhausted, minute };
}

/**
 * The fallback reader, used only when every Gemini model is out of quota.
 * Same prompt, same `checkReading` afterwards, so a weaker model can publish
 * less, never something wrong.
 */
export const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_BATCH = 4;

async function callGroq(
  items: ReaderItem[],
  apiKey: string,
  recent: RecentReport[],
): Promise<{ readings: Reading[]; model: string } | { error: string; daily: boolean }> {
  const payload = items.map((i) => ({
    id: i.id,
    source: i.source,
    source_alignment: i.alignment,
    posted_at: i.postedAt,
    text: i.text.slice(0, i.full ? 6000 : 1600),
    ...(i.fix ? { fix_previous: i.fix } : {}),
  }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ recent, items: payload }) },
        ],
      }),
    });
    if (!res.ok) {
      // A per-minute limit clears by the next cycle; a daily one does not.
      const wait = Number(res.headers.get("retry-after") || 0);
      return { error: `HTTP ${res.status}`, daily: res.status === 429 && wait > 600 };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "") as { items?: Reading[] };
    if (!Array.isArray(parsed.items)) return { error: "no items in response", daily: false };
    return { readings: parsed.items, model: GROQ_MODEL };
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
