/**
 * The 6-hour prose: "Latest developments" for the whole conflict and a short
 * paragraph per front, written by a model from the window's published cards,
 * with a list of what happened where for the animated maps beside them.
 * Server-only.
 *
 * The main developments name their places and who did what; the fronts give
 * each front's state. Neither is a list of who said what. The cards carry the attribution; these panels carry
 * the picture. Anything that fails the checks here falls back to the composed
 * text, so a bad or missing answer never blanks a panel.
 */

import type { LiveReport } from "./types.ts";
import { roleNamesInProse } from "./reader.ts";
import { type ChainModel, askChain, WRITER_MODELS } from "./models.ts";
import { repelAttacker } from "./dev-marks.ts";
import { outletSide } from "./digest.ts";
import { CONTROL, CONTROL_AS_OF } from "./control-data.ts";
import { CADENCE_HOURS } from "./brief.ts";
import { pointList, type Ref, refOfReport, stripRefs } from "./refs.ts";

const GOV_NAME: Record<string, string> = {
  "YE-TA": "Taiz", "YE-LA": "Lahj", "YE-DA": "Al-Dhale", "YE-MA": "Marib", "YE-JA": "Al-Jawf", "YE-BA": "Al-Bayda",
  "YE-HU": "Hodeidah", "YE-HJ": "Hajjah", "YE-SD": "Saada", "YE-SH": "Shabwa", "YE-AB": "Abyan",
};

/**
 * Who holds what, district by district (public/control.json): the contested
 * districts and those that changed hands this round. The writer reads it as
 * background, so a front is described from where its lines actually run.
 */
export function controlContext(rows: typeof CONTROL = CONTROL): string[] {
  const side = (s: string) => (s === "plc" ? "government" : s === "houthi" ? "Houthi" : "contested");
  return rows.filter((d) => d.side === "contested" || d.since).map(
    (d) => `${d.name} (${GOV_NAME[d.gov] ?? d.gov}): ${side(d.side)}${d.since ? ` since ${d.since}` : ""}${d.note ? ` — ${d.note}` : ""}`,
  );
}

export type ProseFront = { id: string; name: string; incidents: number; previous: string };
/** One development at one place, for the animated map (brief.devMap, a front's map). */
export type DevMark = {
  place: string;
  kind: DevKind;
  /** Who acted: the taker, the attacker, the one who struck or fired. */
  side: DevSide;
  /** Where a missile or drone was launched from, when the reports say. */
  from?: string;
  /** Filled in once the places are found (brief-store.ts). */
  ll?: [number, number];
  fromLl?: [number, number];
  /** For an interception: what was shot down. */
  shot?: "drone" | "missile";
};
export const DEV_KINDS = ["capture", "advance", "fighting", "repelled", "airstrike", "shelling", "missile", "drone", "interception", "naval", "energy", "alert"] as const;
export type DevKind = (typeof DEV_KINDS)[number];
export const DEV_SIDES = ["houthi", "government", "southern", "saudi", "us"] as const;
export type DevSide = (typeof DEV_SIDES)[number];

export type Prose = {
  /** The points as plain text, a blank line between them: for the places, the map and the next writer. */
  situation: string;
  /** The fuller account behind "Read more" (the old form; the points have none). */
  more: string;
  fronts: Record<string, string>;
  /** The points with the writer's report ids ("[r12]"), for refs.ts to number (user, 9 Oct). */
  points?: string[];
  frontPoints?: Record<string, string[]>;
  /** The report each id stands for. */
  refOf?: Record<string, Ref>;
  model?: string;
  devMap: DevMark[];
  frontMaps: Record<string, DevMark[]>;
};

const H = `${CADENCE_HOURS} hours`;
const SYSTEM = `You are the editor of a live news desk on the current round of the Yemen war (from 13 July 2026, the strike on Sanaa airport: the Houthis against the Yemeni government and the Saudi-led coalition).
You get the reports published in the last ${H} and the text that stood before. Each report line is: [its id] outlet [whose word it is, if only one side reports it] {the front ids it belongs to}: headline — body.
Write in English wire style (Reuters/AP):
- "points": the latest developments of these ${H}, as a numbered list for a reader with a minute: 3-8 points, each ONE development in 1-2 short sentences (at most 40 words), ordered from the most important to the least. Importance is what changes the war most: a front moving, a big strike and its deaths, attacks on Saudi Arabia, on shipping or on oil and energy sites, a leader's decision or threat, talks. What a leader or government actually said or decided outranks reports of what they might do. Minor or local items come last or are left out. Two reports of one event are one point.
  Bird's-eye but concrete: every point names its front, governorate or region and who acted ("Houthi forces pressed on the Marib front and took ground north of Hays"); no villages or units unless the point is about that place; never vague ("multiple fronts", "several fronts", "various areas", "remain targeted", "across several areas", "intense fighting continued").
  After the words each report supports, put that report's id in square brackets, before the full stop: "Saudi airstrikes hit Sanaa airport [r4][r9]." Every point carries at least one id, and only ids from the REPORTS.
- "fronts": for each front id given, a list of 1-4 points: the main developments on that front in these ${H}, most important first, each 1-2 short sentences with the same ids in square brackets. Concrete places and who did what, never vague. A front is a governorate (or the Bab al-Mandab strait, the Red Sea coast from Mocha to Hodeidah, or Saudi Arabia): say where inside it each thing happened ("in western Taiz, at Al-Wazi'iyah", "north of Marib city"). A front with nothing new gets one point with its current state from the previous text, stated positively, with no id.
- "map": one entry per main development of these ${H} (the ones "points" give) that happened AT a named place, taken from the REPORTS: {"place": the place exactly as written in the report (village, town, district, mountain, Saudi city), "kind": one of capture|advance|fighting|repelled|airstrike|shelling|missile|drone|interception|naval|energy|alert, "side": who acted (the taker, the attacker, the one who struck or fired): houthi|government|southern|saudi|us, "from": for a missile or drone, where it was launched from if the reports say (a place name), else omit}.
  capture = ground taken; advance = forces moved forward without taking a named place; fighting = clashes with no side gaining; repelled = an attack beaten back (side = the attacker); interception = a missile or drone shot down (place = the target area); naval = an attack on or by a ship; energy = an oil, gas or power site hit (a refinery, pipeline or pump station, oil field, fuel depot, oil terminal; side = the attacker); alert = sirens or an air-raid alert sounded there (side = the side whose attack was feared). Statements, decisions and meetings get no entry. No entry without a named place.
- "front_maps": the same kind of list for each front id, from that front's points (places as written there).
Rules:
- Only facts in the reports. Never invent a place, number, unit or claim.
- A front's points use ONLY reports tagged with that front's id.
- No outlets or spokespeople by name. A report marked [Houthi side only] or [Gov/Saudi side only] is that side's word, not a fact: write it as theirs, naming the side: "the Houthis say they struck...", "the Houthis said a ship was sunk...", "government forces say they repelled...", "the coalition says it intercepted...", "Saudi media say...". Never "it was reported", never as plain fact. This covers casualties, what a strike hit, strike counts and advances. When the other side, a wire agency or an official body reports the same event too, it is a fact. Keep it light: name the side once per sentence or run of claims ("the Houthis say they struck two ships and downed a drone"), not on every clause, and vary the verb (say, claim, report).
- A statement by an official body (a ministry, the UN, the coalition command, a government) is written as plain fact, with no speaker.
- Never write about what was NOT reported or did not change ("no fighting was reported", "no new clashes", "remained unchanged", "no reports"). A front with nothing new gets its current state from the previous text, stated positively.
- Neutral wording, no side's labels (no "aggression", "martyrs", "militia", "mercenaries").
- No clock times. Keep every casualty figure you mention exact; never drop reported deaths from the lead.
- A cumulative toll stays cumulative: a figure for the whole round (since July) is written as such ("since the round began in July"), never as the toll of recent or current fighting.
- Never mention the desk, reports, cards, logging, counts of reports or "the window". No hype.
- CONTROL lists who holds the contested districts and what changed hands this round. It is background: use it to place a front's fighting correctly (who holds the town, where the line runs), never as news of its own, and never contradict a newer report with it.
- Past tense for events, present for the state of play.
Return ONLY JSON {"points":["..."],"fronts":{"<id>":["..."]},"map":[...],"front_maps":{"<id>":[...]}}.`;

const BANNED = /\b(?:desk|logged|log|cards?|in the window|this window)\b/i;
/** Writing about absence: the panels state what is, not what was not reported. */
/** Filler the main developments must never carry: no place, no actor, no news. */
const VAGUE = /\b(?:(?:multiple|several|various|many|numerous) (?:fronts|areas|locations|axes)|remain(?:s|ed)? targeted|across (?:the |several |multiple )?(?:fronts|areas|country)|intense fighting (?:continued|spans?))\b/i;
const ABSENCE = /\b(?:no (?:new )?(?:fighting|clashes|strikes|attacks|incidents|reports?|activity|developments?)|(?:was|were) not reported|nothing (?:new )?(?:was )?reported|remain(?:ed|s)? unchanged)\b/i;

/**
 * A front "holding": units on alert, lines held, readiness kept, tension
 * lasting. Written with no report behind it, it is a model filling space
 * ("Anti-aircraft defences in Sanaa remain on alert"). Each such sentence
 * stays only when the front's own reports say it: the word it rests on
 * ("alert", "positions", "readiness", "tension") is in one of them.
 */
const HOLDING: [RegExp, RegExp][] = [
  [/\b(?:remain|remains|remained|stay|stays|stayed|kept|keep|keeps|are|is|on) (?:on )?(?:high |elevated |full |heightened |maximum )?alert\b/i, /\balert\b/i],
  [/\b(?:maintain|maintains|maintained|maintaining|hold|holds|held|holding|keep|keeps|kept) (?:their |its |defensive |high |full )*(?:positions|lines|readiness|combat readiness)\b/i, /\b(?:positions|lines|readiness)\b/i],
  [/\b(?:high|full|combat) (?:combat )?readiness\b/i, /\breadiness\b/i],
  [/\btensions? (?:persist|persists|remain|remains|continue|continues)\b/i, /\btension/i],
  [/\b(?:continue|continues|continued) to face\b/i, /\bface[sd]?\b/i],
  [/\bremain(?:s|ed)? (?:tense|calm|stable|quiet|steady)\b/i, /\b(?:tense|calm|stable|quiet|steady)\b/i],
];

/** The text without the "holding" sentences its reports do not carry; "" when none is left. */
export function keepReported(text: string, own: { summary: string; text?: string }[]): string {
  const said = own.map((r) => `${r.summary} ${r.text ?? ""}`).join(" ");
  const sentences = String(text || "").match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [];
  return sentences
    .filter((s) => !HOLDING.some(([pattern, word]) => pattern.test(s) && !word.test(said)))
    .join("")
    .trim();
}

/**
 * Whose word a card is: "Houthi side only" or "Gov/Saudi side only" when every
 * outlet on it (the lead and "Also") is on that one side. The writer then gives
 * it as that side's word ("the Houthis say..."), never as fact (Stage D, user 2 Oct).
 */
export function wordOf(r: Pick<LiveReport, "source"> & { alsoReportedBy?: { source: string }[] }): string {
  const sides = new Set([r.source, ...(r.alsoReportedBy ?? []).map((a) => a.source)].map((n) => outletSide(String(n || ""))));
  if (sides.size !== 1) return "";
  const [side] = [...sides];
  return side === "Houthi-aligned" ? "Houthi side only" : side === "Gov/Saudi-aligned" ? "Gov/Saudi side only" : "";
}

function cardLine(r: LiveReport, frontsOf: (r: LiveReport) => string[], id = ""): string {
  const word = wordOf(r as LiveReport & { alsoReportedBy?: { source: string }[] });
  const ids = frontsOf(r);
  const body = String(r.text || "").replace(/\s+/g, " ").slice(0, 160);
  return `${id ? `[${id}] ` : ""}${r.source}${word ? ` [${word}]` : ""}${ids.length ? ` {${ids.join(",")}}` : ""}: ${r.summary}${body ? ` — ${body}` : ""}`;
}

/** Drop a paragraph that breaks the rules; the composed text stands in for it. */
export function cleanProse(s: unknown, maxSentences: number, noVague = false, maxLength = 1200): string {
  // The writer's paragraphs (a blank line between them) are kept.
  const paras = String(s ?? "").split(/\n\s*\n/).map((p) => roleNamesInProse(p.replace(/\s+/g, " ").trim())).filter(Boolean);
  if (paras.join(" ").length < 40) return "";
  const out: string[] = [];
  let left = maxSentences;
  let room = maxLength;
  for (const p of paras) {
    if (left <= 0 || room <= 0) break;
    // A dot between digits is a decimal, not a full stop: "fell 1.1 percent" came
    // back as "fell 1. 1 percent" once the sentences were joined again.
    const sentences = (p.match(/(?:[^.!?]|\.(?=\d))+[.!?]+/g) || [p]).map((x) => x.trim());
    // A sentence about absence, or about the desk itself, is dropped; the rest of
    // the paragraph stands. A long answer is cut at a whole sentence, never thrown
    // away whole (1 Oct, 00:00: the backup writer's overview was lost that way).
    const kept: string[] = [];
    for (const x of sentences) {
      if (ABSENCE.test(x) || BANNED.test(x) || (noVague && VAGUE.test(x))) continue;
      if (kept.length >= left || x.length + 1 > room) break;
      kept.push(x);
      room -= x.length + 1;
    }
    left -= kept.length;
    if (kept.length) out.push(kept.join(" "));
  }
  const t = out.join("\n\n");
  return t;
}

/** Fighting, strikes, missiles and drones, at sea or on Saudi Arabia: the battle picture. */
const BATTLE = /\b(?:fight\w*|clash\w*|attack\w*|strikes?|struck|airstrikes?|air ?raids?|shell\w*|missiles?|drones?|intercept\w*|advanc\w*|offensive|assault\w*|push\w*|pressed|took|taken|captur\w*|seiz\w*|repel\w*|killed|wounded|dead|deaths?|casualt\w*|front|forces|troops|fighters|ships?|vessels?|tankers?|naval|sirens?|bomb\w*|artillery|launch\w*|fired|hit|battles?|siege|shot down)\b/i;
/** Politics, diplomacy and the economy. */
const OTHER = /\b(?:warn\w*|threat\w*|vow\w*|call(?:s|ed)? (?:for|on)|urg\w*|condemn\w*|denounc\w*|welcom\w*|talks|negotiat\w*|meetings?|met|envoy|diplomat\w*|summit|visit\w*|econom\w*|currency|rial|prices?|inflation|salar\w*|aid|humanitarian|sanction\w*|agreements?|truce|ceasefire|mediat\w*|mobili[sz]\w*|parliament|cabinet|appoint\w*|minister|president|ministry|statement)\b/i;

/** The sea and shipping, with no fighting on land or in the air named: after the battle, before politics. */
const SEA = /\b(?:ships?|vessels?|tankers?|shipping|naval|escorts?|Aspides|UKMTO|transits?)\b/i;
const LAND = /\b(?:fight\w*|clash\w*|airstrikes?|shell\w*|missiles?|drones?|advanc\w*|offensive|front|forces|troops|artillery)\b/i;
function isSea(x: string): boolean {
  return SEA.test(x) && !LAND.test(x);
}

/** A sentence is political when its politics come before any fighting it names ("the envoy condemned the strikes"). */
export function isOther(x: string): boolean {
  const o = x.search(OTHER);
  if (o < 0) return false;
  const b = x.search(BATTLE);
  return b < 0 || o < b;
}

/**
 * The overview opens with the battle and keeps politics in a paragraph of its
 * own after it (Round 25). The writer is told so; this puts it right when it
 * mixes them, keeping each part's sentences in their order.
 */
export function battleFirst(text: string): string {
  const paras = String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const battle: string[] = [];
  const sea: string[] = [];
  const other: string[] = [];
  for (const p of paras) {
    const sentences = (p.match(/(?:[^.!?]|\.(?=\d))+[.!?]+/g) || [p]).map((x) => x.trim()).filter(Boolean);
    const b = sentences.filter((x) => !isOther(x) && !isSea(x));
    const s = sentences.filter((x) => !isOther(x) && isSea(x));
    const o = sentences.filter((x) => isOther(x));
    if (b.length) battle.push(b.join(" "));
    if (s.length) sea.push(s.join(" "));
    if (o.length) other.push(o.join(" "));
  }
  if ([battle, sea, other].filter((x) => x.length).length < 2) return paras.join("\n\n");
  return [...battle, sea.join(" "), other.join(" ")].filter(Boolean).join("\n\n");
}

const SIDE_WORDS: Record<string, DevSide> = {
  houthi: "houthi", houthis: "houthi", ansarallah: "houthi",
  government: "government", "pro-government": "government", plc: "government", army: "government", "national resistance": "government", giants: "government",
  southern: "southern", stc: "southern", "southern forces": "southern",
  saudi: "saudi", coalition: "saudi", "saudi-led coalition": "saudi",
  us: "us", "united states": "us", american: "us",
};

/**
 * A repelled attack is drawn from the attacker's side; models often give the
 * defender. The sentence decides: "repelled a Houthi attack" -> houthi,
 * "Houthi forces repelled" -> government.
 */
function repelledBy(text: string, place: string, side: DevSide): DevSide {
  const sentence = (text.match(/(?:[^.!?]|\.(?=\d))+[.!?]*/g) || [text]).find((x) => x.toLowerCase().includes(place.toLowerCase())) || "";
  return repelAttacker(sentence) ?? side;
}

/**
 * The map list, checked: a place the text names, a kind and a side from the
 * lists; anything else is dropped. At most `max` entries, one per place and kind.
 */
export function cleanDevMap(raw: unknown, text: string, max = 10): DevMark[] {
  if (!Array.isArray(raw) || !text) return [];
  const low = text.toLowerCase().replace(/[’]/g, "'");
  const out: DevMark[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const place = String(o.place ?? "").replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
    const kind = String(o.kind ?? "").toLowerCase().trim() as DevKind;
    const side = SIDE_WORDS[String(o.side ?? "").toLowerCase().trim()] ?? null;
    if (!place || place.length > 60 || !low.includes(place.toLowerCase())) continue;
    if (!(DEV_KINDS as readonly string[]).includes(kind) || !side) continue;
    if (out.some((m) => m.place.toLowerCase() === place.toLowerCase() && m.kind === kind)) continue;
    const from = String(o.from ?? "").replace(/\s+/g, " ").trim();
    const mark: DevMark = { place, kind, side: kind === "repelled" ? repelledBy(text, place, side) : side };
    if (from && from.length <= 60 && (kind === "missile" || kind === "drone" || kind === "interception")) mark.from = from;
    out.push(mark);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Write the prose, or null when no model answered. Each paragraph that fails
 * `cleanProse` comes back empty, for the caller to fill from the composed text.
 */
export async function writeProse(
  reports: LiveReport[],
  fronts: ProseFront[],
  previousSituation: string,
  frontsOf: (r: LiveReport) => string[] = () => [],
  control: string[] = controlContext(),
  models: ChainModel[] = WRITER_MODELS,
  /** This update's count of strong-writer calls (models.ts PER_UPDATE). */
  budget?: Record<string, number>,
): Promise<Prose | null> {
  const sorted = [...reports]
    .filter((r) => r.summary)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  // Gemini takes the whole window; the Groq fallbacks cap input tokens per
  // minute, so a busy night's reports are cut down, oldest first, if needed.
  let got: { json: Record<string, unknown>; model: string } | null = null;
  let last = -1;
  for (const want of [400, 140, 60]) {
    const cap = Math.min(want, sorted.length);
    if (cap === last) continue;
    last = cap;
    const user = [
      `PREVIOUS SITUATION: ${previousSituation || "(none)"}`,
      "FRONTS:",
      ...fronts.map((f) => `- ${f.id} = ${f.name}; previous: ${f.previous || "(none)"}`),
      `CONTROL (as of ${CONTROL_AS_OF}):`,
      ...control.map((l) => `- ${l}`),
      "REPORTS:",
      ...sorted.slice(-cap).map((r, i) => cardLine(r, frontsOf, `r${i + 1}`)),
    ].join("\n");
    // Only Groq refuses a long prompt: Gemini had the whole window once, and asking it again shorter spent its day for nothing.
    const chain = want === 400 ? models : models.filter((m) => m.provider !== "gemini");
    if (!chain.length) break;
    got = await askChain("prose", SYSTEM, user, { models: chain, budget });
    if (got) break;
  }
  if (!got) return null;
  const j = got.json;
  const given = sorted.slice(-last);
  const refOf: Record<string, Ref> = Object.fromEntries(given.map((r, i) => [`r${i + 1}`, refOfReport(r)]));
  const points = cleanPoints(j.points, 8, true);
  const out: Prose = { situation: points.map(stripRefs).join("\n\n"), more: "", fronts: {}, points, frontPoints: {}, refOf, model: got.model, devMap: [], frontMaps: {} };
  if (!out.situation) console.warn(`[prose] ${got.model}: no usable points (${JSON.stringify(j.points ?? null).length} chars)`);
  const fj = (j.fronts && typeof j.fronts === "object" ? j.fronts : {}) as Record<string, unknown>;
  const fm = (j.front_maps && typeof j.front_maps === "object" ? j.front_maps : {}) as Record<string, unknown>;
  for (const f of fronts) {
    const fp = cleanPoints(fj[f.id], 4);
    out.frontPoints![f.id] = fp;
    out.fronts[f.id] = fp.map(stripRefs).join(" ");
    const marks = cleanDevMap(fm[f.id], out.fronts[f.id]);
    if (marks.length) out.frontMaps[f.id] = marks;
  }
  // The overview names fronts, not villages: its map's places are checked
  // against everything written and the reports themselves, so the map keeps
  // every place it had.
  if (out.situation) {
    const written = [out.situation, ...Object.values(out.fronts), ...given.map((r) => `${r.summary}. ${String(r.text || "")}`)].join("\n");
    out.devMap = cleanDevMap(j.map, written, 14);
  }
  return out;
}

/**
 * The writer's points, each checked as the paragraphs were: a sentence about
 * absence, about the desk or (`noVague`) vague filler is dropped, and a point
 * left with nothing goes. At most `max`.
 */
export function cleanPoints(raw: unknown, max: number, noVague = false): string[] {
  const out: string[] = [];
  for (const p of pointList(raw).map(tidyPoint)) {
    // The last sentence may have no full stop: it is kept, never cut at the "1." of "1.5" or at "Maj." (9 Oct).
    const sentences = (p.match(/(?:[^.!?]|\.(?=\d))+(?:[.!?]+|$)(?:\s*\[[^\]]*\])*/g) || [p]).map((x) => x.trim()).filter(Boolean);
    const kept = sentences.filter((x) => !ABSENCE.test(x) && !BANNED.test(stripRefs(x)) && !(noVague && VAGUE.test(x)));
    let t = roleNamesInProse(kept.join(" ").trim());
    if (t && !/[.!?]["”’)]?(?:\s*\[[^\]]*\])*$/.test(t)) t += ".";
    if (stripRefs(t).length >= 12) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Who opens a point and stays: a speaker, not an outlet. */
const SPEAKER_OPEN = /^(?:Trump|CENTCOM|UKMTO|Iran|Israel|The|US|IRGC|Saudi|Houthi|Hezbollah|Araghchi|Pezeshkian|Netanyahu|Vance|Rubio|Hegseth|Khamenei|Qalibaf|Government|Coalition)\b/;

/**
 * What a weaker writer leaves in a point: an outlet opening it ("Press TV
 * reported …": the reference shows the outlet), and a card's headline and body
 * glued with " — " (the headline stays, with the point's marks).
 */
export function tidyPoint(p: string): string {
  let t = String(p || "").trim();
  t = t.replace(/^[A-Z][\w'’.&-]*(?:\s+(?:al-|Al-|of |the )?[A-Z][\w'’.&-]*){0,4}\s+(?:reported|reports)(?: that)?:?\s+(?=[A-Za-z])/, (m) => (SPEAKER_OPEN.test(m) ? m : ""));
  const dash = t.indexOf(" — ");
  if (dash > 30 && stripRefs(t.slice(dash)).length > 40) {
    const marks = (t.slice(dash).match(/\[[^\]]*\]/g) || []).join("");
    t = t.slice(0, dash).replace(/[.\s]+$/, "") + marks + ".";
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * The overview cut to whole sentences within `max` words; the sentences left
 * over come back second ("" when it fits). The first sentence always stays.
 */
export function fitWords(text: string, max: number): [string, string] {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  if (words(text) <= max) return [text, ""];
  const sentences = text.match(/[^.!?]+[.!?]+["'”’)]?\s*/g) ?? [text];
  let keep = "";
  let i = 0;
  while (i < sentences.length && (i === 0 || words(keep + sentences[i]) <= max)) keep += sentences[i++];
  return [keep.replace(/\s+$/, "").replace(/\n{3,}/g, "\n\n"), sentences.slice(i).join("").trim()];
}
