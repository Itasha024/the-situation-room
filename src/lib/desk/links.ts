/**
 * "Follows": which earlier card a card directly develops.
 *
 * Links came from four places — a Telegram reply, the reader's `follows_up`,
 * the same outlet's next post within minutes, a speaker's next line — and
 * none was checked. On 25 September a fifth of them were wrong: shelling in
 * Beihan following an infiltration in Haifan, a Majzar air strike following
 * the president's speech, one Ali Bk salvo following another six hours
 * earlier, a chain of separate Saudi shells on Hajjah and Saada, The Cube's
 * Marib card following its Kahbub card.
 *
 * Every link now has to pass the same rules, whatever made it:
 *
 *   speech   — one speaker's lines: within 45 minutes whatever the card's
 *              type, within 12 hours when both are statements;
 *   anchor   — otherwise both cards must share a place finer than a
 *              governorate (by name, or pins within 25 km), a named object
 *              (a person, a mountain, a school, a ship, the Taiz-Aden road) or
 *              a figure;
 *   time     — within 12 hours; two attack reports (strikes, shells, salvos)
 *              within 3, since two attacks on one spot hours apart are two
 *              events, not one's aftermath.
 *
 * The link judge (once a tick, one free-model call) then decides among the
 * cards the rules allow which one, if any, a new card develops — and so also
 * finds the links nobody made.
 */
import { kmApart, sameWords } from "./copies.ts";
import { PLACE_BY_NAME, type Place, placesIn } from "./gazetteer.ts";
import type { LiveReport } from "./types.ts";

type Card = Pick<LiveReport, "fp" | "at" | "source" | "type" | "summary"> &
  Partial<Pick<LiveReport, "text" | "place" | "lat" | "lng" | "replyTo">>;

/* ------------------------------------------------------------------ *
 * Speakers
 * ------------------------------------------------------------------ */

/**
 * The officials this war quotes, each under one key whatever the headline
 * calls them: "Saudi Foreign Minister", "Saudi Foreign Minister Faisal bin
 * Farhan" and "Faisal bin Farhan" are one man, and one speech.
 */
const SPEAKER_ALIASES: [RegExp, string][] = [
  [/bin salman|\bmbs\b|saudi crown prince/, "mbs"],
  [/faisal bin farhan|saudi (?:foreign minister|fm)\b/, "saudi fm"],
  [/zindani|yemen(?:i|'s)? (?:foreign minister|fm)\b/, "yemen fm"],
  [/\balimi\b|presidential (?:leadership )?council (?:head|chair(?:man)?|president)|\bplc (?:head|chair(?:man)?)/, "alimi"],
  [/abdul-?malik al-houthi|houthi leader/, "houthi leader"],
  [/\bsaree\b|houthi (?:military|armed forces) spokes(?:man|person)/, "saree"],
  [/abdul-?salam|houthi (?:chief )?negotiator|houthi spokes(?:man|person)/, "abdulsalam"],
  [/volker t[uü]rk|un (?:human )?rights chief/, "turk"],
  [/turki al-maliki|coalition spokesman/, "maliki"],
];

/** One key per person, whatever the title: "US President Donald Trump" is "trump". */
/** "Kuwaiti crown prince" and "Kuwait's crown prince" are one man. */
const DEMONYMS: Record<string, string> = {
  yemeni: "yemen", kuwaiti: "kuwait", omani: "oman", qatari: "qatar", emirati: "uae", iranian: "iran", egyptian: "egypt",
  jordanian: "jordan", bahraini: "bahrain", iraqi: "iraq", pakistani: "pakistan", turkish: "turkey", sudanese: "sudan",
};

export function speakerKey(who: string): string {
  const w = who
    .toLowerCase()
    .replace(/^(?:the\s+)?(?:u\.?s\.?|us|american|former)\s+/, "")
    .replace(/['’]s\b/g, "")
    .replace(/\b[a-z]+\b/g, (x) => DEMONYMS[x] ?? x);
  const known = /\b(trump|rubio|vance|hegseth|witkoff|leavitt|biden|netanyahu|khamenei|araghchi|pezeshkian|guterres|grundberg|fletcher)\b/.exec(w);
  if (known) return known[1];
  for (const [re, key] of SPEAKER_ALIASES) if (re.test(w)) return key;
  return w.replace(/^(?:president|secretary of state|secretary|minister|prime minister)\s+/, "");
}

/** The verbs a statement or a diplomat's headline opens with after its speaker. */
const SPEAKER_VERBS =
  "says|said|tells|told|warns|warned|denies|denied|condemns|condemned|urges|urged|calls for|called for|announces|announced|" +
  "rejects|rejected|meets|met|stresses|stressed|affirms|affirmed|welcomes|welcomed|discusses|discussed|receives|received";
const SPEAKER_RE = new RegExp(`^(.{2,48}?)(?::\\s|\\s(?:${SPEAKER_VERBS})\\b)`);

/**
 * The speaker a statement headline opens with — "Al-Mashat says …",
 * "Trump: …" — lowercased, or "" when there is none or it is generic. "A
 * spokesman" or "the official" in two posts are not known to be one person,
 * so they are never grouped on that alone.
 */
export function namedSpeaker(summary: string): string {
  const m = SPEAKER_RE.exec(summary || "");
  if (!m) return "";
  const who = m[1].trim();
  if (/^(an?|the)\s/i.test(who)) return "";
  if (/^(spokes(?:man|woman|person)|officials?|sources?|commanders?|ministers?)$/i.test(who)) return "";
  return speakerKey(who);
}

/** "Houthi media:", "Local sources:" open lists of separate events, not one speech. */
const NOT_A_SPEAKER = /\b(?:media|sources?|activists?|residents|witnesses|reports?|outlets?|channels?|data)\b/;

/** A card's own speaker: its headline's, including a long title before a colon. */
function ownSpeaker(c: Card): string {
  let w = namedSpeaker(c.summary);
  if (!w) {
    const m = /^([^:]{2,80}):\s/.exec(c.summary || "");
    if (m && !/^(an?|the)\s/i.test(m[1])) w = speakerKey(m[1].trim());
  }
  return w && !NOT_A_SPEAKER.test(w) ? w : "";
}

const TALK = new Set(["statement", "diplomacy"]);
const FIELD = new Set(["strike", "combat", "vessel", "port"]);
/** A speakerless line and its channel's named line this close are one speaker's. */
const NEIGHBOUR_MS = 3 * 60_000;

/**
 * Each card's speaker; a statement that names none ("our forces will
 * respond") takes the speaker of its channel's line posted within three
 * minutes of it, as the speech threading does.
 */
export function speakersOf(cards: Card[]): Map<string, string> {
  const out = new Map<string, string>();
  const own = ownSpeaker;
  for (const c of cards) {
    const w = own(c);
    if (w) out.set(c.fp, w);
  }
  for (const c of cards) {
    if (out.has(c.fp) || !TALK.has(c.type)) continue;
    const t = Date.parse(c.at);
    const n = cards.find((o) => o !== c && o.source === c.source && TALK.has(o.type) && Math.abs(Date.parse(o.at) - t) <= NEIGHBOUR_MS && own(o));
    if (n) out.set(c.fp, own(n));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Anchors: what two cards about one thing have in common
 * ------------------------------------------------------------------ */

/** Places too wide to tie two events together: a governorate, a sea, a strait, a country. */
const WIDE_KINDS = new Set(["governorate", "country", "sea", "strait"]);
/** Cities that are also their governorate's name: "in Taiz" is usually the governorate. */
const WIDE_NAMES = new Set(["Taiz", "Marib", "Hodeidah", "Sanaa", "Aden"]);
const wide = (p: Place | undefined) => !p || WIDE_KINDS.has(p.kind) || WIDE_NAMES.has(p.name);

/** Governorates and countries by any spelling, as bare words. */
const WIDE_WORDS =
  "yemen yemeni yemenis saudi saudis arabia taiz marib lahj hodeidah hudaydah saada sadah hajjah abyan shabwa shabwah aden sanaa " +
  "ibb dhale dhalea jawf bayda hadramawt hadramout hadhramaut hadhramout hadramaut mahra mahrah amran dhamar raymah mahwit socotra " +
  "iran iranian israel israeli oman omani kuwait kuwaiti qatar qatari egypt egyptian turkey turkish pakistan pakistani sudan sudanese " +
  "jordan uae emirati emirates china chinese russia russian britain british france french gulf";

/** Capitalised words that name no particular thing: actors, titles, generic geography. */
const STOP = new Set(
  (
    WIDE_WORDS +
    " houthi houthis ansar allah government forces force army armed coalition led backed aligned affiliated controlled pro" +
    " united states nations kingdom red sea strait bab mandab arabian president vice minister ministry foreign defense defence" +
    " interior prime crown prince king council presidential leadership deputy head chief chiefs spokesperson spokesman spokeswoman" +
    " secretary state general military national resistance popular giants brigade brigades southern transitional stc commission" +
    " human rights center centre security civil office media agency news sources source official officials jabal jebel wadi mount" +
    " mountain mountains road route highway front fronts district governorate province city port airport base island islands north" +
    " south east west western eastern northern southern central region regional international joint agreement pact operation" +
    " operations monday tuesday wednesday thursday friday saturday sunday january february march april may june july august" +
    " september october november december sheikh colonel brigadier commander commanders major captain dr gcc irgc ceo plc un" +
    " who wfp unicef unhcr iom ocha eu usa uk us sabereen almasirah masirah saba naya reuters afp ap bloomberg"
  ).split(" "),
);

const dash = (s: string) => String(s || "").replace(/[‐-―]/g, "-");

/** Named things in a headline: capitalised words past the sentence's first, minus the generic. */
function nameWords(headline: string): string[] {
  const out: string[] = [];
  // A new sentence starts the headline and follows a speaker's colon.
  for (const clause of dash(headline).split(/:\s+/)) {
    const words = clause.split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
    words.slice(1).forEach((w) => {
      for (let part of w.split("-")) {
        part = part.replace(/['’]s$/, "");
        if (!/^\p{Lu}/u.test(part) || part.length < 3) continue;
        const k = part.toLowerCase().replace(/['’]/g, "");
        if (!STOP.has(k) && k !== "al" && k !== "el") out.push(k);
      }
    });
  }
  return out;
}

/** "Taiz-Aden road" and "Aden-Lahj-Taiz road" are one road: each pair of its ends. */
function roads(headline: string): string[] {
  const out: string[] = [];
  const re = /((?:\p{Lu}[\p{L}'’]*)(?:\s?-\s?(?:\p{Lu}[\p{L}'’]*))+)\s+(?:road|highway|route)/gu;
  for (const m of dash(headline).matchAll(re)) {
    const ends = m[1].split(/\s?-\s?/).map((e) => e.toLowerCase());
    for (let i = 0; i < ends.length; i += 1) for (let j = i + 1; j < ends.length; j += 1) out.push(`road:${[ends[i], ends[j]].sort().join("~")}`);
  }
  return out;
}

/** Figures of 20 and up that are not years or spans of time. */
function figures(headline: string): string[] {
  const out: string[] = [];
  for (const m of String(headline || "").matchAll(/(\d[\d,]*)(?!\d)(?!\s*(?:hours?|days?|weeks?|months?|years?|km|kilomet))/g)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (n >= 20 && !(n >= 1900 && n <= 2100)) out.push(`num:${n}`);
  }
  return out;
}

/** What a card could share with another card about the same thing. */
export function anchorsOf(c: Card): Set<string> {
  const h = String(c.summary || "");
  const out = new Set<string>();
  for (const p of placesIn(h)) if (!wide(p)) out.add(`place:${p.name}`);
  if (c.place && !wide(PLACE_BY_NAME[c.place]) && !WIDE_NAMES.has(c.place)) out.add(`place:${c.place}`);
  for (const w of nameWords(h)) out.add(`name:${w}`);
  for (const r of roads(h)) out.add(r);
  for (const f of figures(h)) out.add(f);
  return out;
}

/** Pins close enough to be one spot, when neither is a governorate's centre. */
function nearPins(a: Card, b: Card, km = 25): boolean {
  if (!Number.isFinite(a.lat) || !Number.isFinite(b.lat) || !a.place || !b.place) return false;
  if (wide(PLACE_BY_NAME[a.place]) && PLACE_BY_NAME[a.place]) return false;
  if (wide(PLACE_BY_NAME[b.place]) && PLACE_BY_NAME[b.place]) return false;
  if (WIDE_NAMES.has(a.place) || WIDE_NAMES.has(b.place)) return false;
  return kmApart({ lat: a.lat!, lng: a.lng! }, { lat: b.lat!, lng: b.lng! }) <= km;
}

/** Every place a card names or is pinned at, governorates included. */
const allPlaces = (c: Card) => new Set([...placesIn(c.summary).map((p) => p.name), ...(c.place ? [c.place] : [])]);

/** Two cards that name places name at least one in common; two that name none match too. */
function samePlaces(a: Card, b: Card): boolean {
  const x = allPlaces(a);
  const y = allPlaces(b);
  if (!x.size || !y.size) return !x.size && !y.size;
  for (const p of x) if (y.has(p)) return true;
  return false;
}

/**
 * A shared place, named thing, road or figure; pins within 25 km (8 for two
 * attacks: Shada and Razih are neighbours, and two shellings); or the same
 * headline in other words at the same place.
 */
export function sharesAnchor(a: Card, b: Card, pinKm = 25): boolean {
  if (nearPins(a, b, pinKm)) return true;
  const mine = anchorsOf(a);
  for (const x of anchorsOf(b)) if (mine.has(x)) return true;
  return sameWords(a.summary, b.summary) && samePlaces(a, b);
}

/* ------------------------------------------------------------------ *
 * The rules
 * ------------------------------------------------------------------ */

/** One speaker's lines, any card type: a briefing or a speech. */
const BRIEFING_MS = 45 * 60_000;
/** A statement thread, a battle, a crisis's aftermath: one story this long. */
const STORY_MS = 12 * 3600_000;
/** Two attack reports on one spot this far apart are two attacks. */
const ATTACK_MS = 3 * 3600_000;
const ATTACK_RE = /air ?strikes?|air raids?|\braids?\b|shell(?:s|ed|ing)?\b|artillery|rockets?|missiles?|drones?|salvos?|\bbomb|launch/i;
const ALERT_RE = /siren|alarm|early warning|warning alerts?|alerts? (?:issued|sounded|activated)|air raid alert|take shelter/i;
const ALL_CLEAR_RE = /danger (?:has )?(?:cleared|passed|over)|all[- ]clear|alerts? (?:status )?(?:lifted|ended|over)|lifts? (?:the |its )?(?:security )?alert|sirens? (?:stop|end)/i;
const GROUND_RE = /clash|fight|battle|advanc|captur|seiz|control|repel|repuls|thwart|foil|infiltrat|ambush|offensive|\bpush|reinforc|withdr|retreat/i;

/** Does a headline name this speaker (by a word of the speaker's own, not a title)? */
function names(headline: string, speaker: string): boolean {
  const words = new Set(String(headline || "").toLowerCase().split(/[^\p{L}\p{N}]+/u));
  return speaker.split(/[^\p{L}\p{N}]+/u).some((w) => w.length >= 4 && !STOP.has(w) && words.has(w));
}

/**
 * May `child` follow `parent`? `who` is `speakersOf` over the cards at hand;
 * without it each card's own headline speaker is used.
 */
export function linkOk(child: Card, parent: Card, who?: Map<string, string>): boolean {
  if (!child || !parent || child.fp === parent.fp) return false;
  const gap = Date.parse(child.at) - Date.parse(parent.at);
  // Back in time only; two cards of one second in one fixed order, so two
  // never follow each other.
  if (!Number.isFinite(gap) || gap < 0 || (gap === 0 && child.fp < parent.fp)) return false;
  const speaker = (c: Card) => who?.get(c.fp) ?? ownSpeaker(c);
  const s = speaker(child);
  const ps = speaker(parent);
  if (s && s === ps) {
    if (gap <= BRIEFING_MS) return true;
    if (TALK.has(child.type) && TALK.has(parent.type) && gap <= STORY_MS) return true;
  }
  // Two speakers' words are two stories, unless the later one answers the
  // earlier by name: Macron on Yanbu does not follow the League on Yanbu.
  if (s && ps && s !== ps && TALK.has(child.type) && TALK.has(parent.type) && !names(child.summary, ps)) return false;
  // An all-clear follows its alert, across the kingdom unless both name cities.
  if (ALL_CLEAR_RE.test(child.summary) && ALERT_RE.test(parent.summary) && gap <= ATTACK_MS) {
    const x = allPlaces(child);
    const y = allPlaces(parent);
    if (!x.size || !y.size || [...x].some((p) => y.has(p))) return true;
  }
  // A meeting or a pact does not develop a strike, nor a strike a meeting:
  // "Riyadh defence pact" and "missiles on Riyadh" share a word, not a story.
  if ((child.type === "diplomacy" && FIELD.has(parent.type)) || (parent.type === "diplomacy" && FIELD.has(child.type))) return false;
  const both = `${child.summary} ${parent.summary}`;
  const attacks = ATTACK_RE.test(child.summary) && ATTACK_RE.test(parent.summary) && !GROUND_RE.test(both);
  if (!sharesAnchor(child, parent, attacks ? 8 : 25)) return false;
  return gap <= (attacks ? ATTACK_MS : STORY_MS);
}

/**
 * Removes every link that breaks the rules. `pool` holds the parents; a
 * parent not in it is left alone (it cannot be checked). Returns the cards
 * whose link was removed.
 */
export function checkLinks(cards: Card[], pool: Card[]): Card[] {
  const byFp = new Map(pool.map((c) => [c.fp, c]));
  for (const c of cards) if (!byFp.has(c.fp)) byFp.set(c.fp, c);
  const who = speakersOf([...byFp.values()]);
  const cut: Card[] = [];
  for (const c of cards) {
    if (!c.replyTo) continue;
    const p = byFp.get(c.replyTo);
    if (p && !linkOk(c, p, who)) {
      delete c.replyTo;
      cut.push(c);
    }
  }
  return cut;
}

/* ------------------------------------------------------------------ *
 * The judge
 * ------------------------------------------------------------------ */

/** New cards judged per tick; the model sees each with its possible parents. */
export const JUDGE_CARDS = 12;
const CANDIDATES = 6;
const LOOKBACK_MS = 24 * 3600_000;

/** Asks a model; null when none answered. */
export type Ask = (system: string, user: string) => Promise<Record<string, unknown> | null>;

export const JUDGE_SYSTEM = `You link the reports of a war news desk into threads.

Each new report comes with the earlier reports it could follow. Answer, for each
new report, the ref of the ONE earlier report it directly develops:
- the same incident's toll, damage, denial or aftermath;
- a reply to that exact statement, attack or claim;
- the same speech, interview or briefing continued;
- the outcome of that same battle for that same position or road;
- an alert and its all-clear, a launch and its interception or impact.

NOT a development, even at the same place or on the same day:
- a new strike, salvo, shelling or raid (two attacks are two events);
- another front, another town, another speaker's separate statement;
- a report that only shares the war's general topic.

When in doubt, "". Return JSON only:
{"links":[{"id":"n1","follows":"n1e2"},{"id":"n2","follows":""}]}`;

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * One call a tick: each new card with the earlier cards the rules allow it to
 * follow, newest first. The answer sets the link, or clears it; a card the
 * model did not answer for keeps what it had. Speech lines are threaded by
 * their speaker and not asked about. Returns the cards whose link changed.
 */
export async function judgeLinks(fresh: LiveReport[], pool: LiveReport[], ask: Ask): Promise<LiveReport[]> {
  const all = new Map(pool.map((c) => [c.fp, c]));
  for (const c of fresh) all.set(c.fp, c);
  const who = speakersOf([...all.values()]);
  const items: { card: LiveReport; cands: LiveReport[] }[] = [];
  for (const card of [...fresh].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    if (items.length >= JUDGE_CARDS) break;
    const now = all.get(card.replyTo ?? "");
    const s = who.get(card.fp);
    if (now && s && s === who.get(now.fp)) continue;
    const t = Date.parse(card.at);
    const cands = [...all.values()]
      .filter((x) => x.fp !== card.fp && Date.parse(x.at) <= t && t - Date.parse(x.at) <= LOOKBACK_MS)
      .filter((x) => linkOk(card, x, who))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, CANDIDATES);
    if (cands.length) items.push({ card, cands });
  }
  if (!items.length) return [];
  const refs = new Map<string, LiveReport>();
  const reports = items.map(({ card, cands }, i) => ({
    id: `n${i + 1}`,
    at: card.at,
    source: card.source,
    headline: card.summary,
    body: short(String(card.text || "").replace(/\s+/g, " "), 280),
    earlier: cands.map((c, j) => {
      const ref = `n${i + 1}e${j + 1}`;
      refs.set(ref, c);
      return { ref, at: c.at, source: c.source, headline: c.summary };
    }),
  }));
  const json = await ask(JUDGE_SYSTEM, JSON.stringify({ reports }));
  const links = Array.isArray(json?.links) ? (json!.links as { id?: unknown; follows?: unknown }[]) : [];
  const changed: LiveReport[] = [];
  items.forEach(({ card, cands }, i) => {
    const ans = links.find((l) => String(l?.id) === `n${i + 1}`);
    if (!ans) return;
    const ref = String(ans.follows ?? "").trim();
    const to = refs.get(ref);
    if (to && cands.includes(to)) {
      if (card.replyTo === to.fp) return;
      card.replyTo = to.fp;
      changed.push(card);
    } else if (!ref && card.replyTo) {
      delete card.replyTo;
      changed.push(card);
    }
  });
  return changed;
}
