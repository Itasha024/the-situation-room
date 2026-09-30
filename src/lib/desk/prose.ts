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
import { askChain } from "./models.ts";
import { repelAttacker } from "./dev-marks.ts";
import { outletSide } from "./digest.ts";
import { CONTROL, CONTROL_AS_OF } from "./control-data.ts";
import { CADENCE_HOURS } from "./brief.ts";

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
export const DEV_KINDS = ["capture", "advance", "fighting", "repelled", "airstrike", "shelling", "missile", "drone", "interception", "naval", "alert"] as const;
export type DevKind = (typeof DEV_KINDS)[number];
export const DEV_SIDES = ["houthi", "government", "southern", "saudi", "us"] as const;
export type DevSide = (typeof DEV_SIDES)[number];

export type Prose = { situation: string; /** The fuller account behind "Read more". */ more: string; fronts: Record<string, string>; model?: string; devMap: DevMark[]; frontMaps: Record<string, DevMark[]> };

const H = `${CADENCE_HOURS} hours`;
const SYSTEM = `You are the editor of a live news desk on the current round of the Yemen war (from 3 July 2026: the Houthis against the Yemeni government and the Saudi-led coalition).
You get the reports published in the last ${H} and the text that stood before. Each report line is: outlet [its alignment, if any] {the front ids it belongs to}: headline — body.
Write in English wire style (Reuters/AP):
- "situation": the whole conflict in these ${H} SEEN FROM ABOVE, as an editor's overview for a reader with ten seconds: 2-4 short sentences, at most 70 words, most important first within each part (see Order). Say where the war moved and which way: which fronts were active and who gained or lost ground (by front or governorate: "the Marib front", "western Taiz", "the Saudi border"), escalations (attacks on Saudi Arabia, on shipping, big strikes with their deaths), and the big political or military facts (a leader's threat, a mobilisation, talks). Always include the Saudi front when anything happened there.
  Not tactical: no villages, hills, positions or units, and no list of incidents; fold many incidents into one line about the picture they make ("Houthi forces pressed on the Marib and western Taiz fronts and took ground north of Hays"). Integrate everything important of the ${H}; leave the detail to "situation_more" and the fronts.
  Never vague either: every sentence names its fronts or regions and who acted; no "multiple fronts", "several fronts", "various areas", "remain targeted", "across several areas", "intense fighting continued".
  Order: the battle first, seen from above: the ground fronts, then strikes, missiles and drones (on Saudi Arabia and at sea too, and on oil and energy sites). Then, when the reports have them, the sea and energy: attacks on ships and warnings to shipping (UKMTO, naval missions), traffic through Bab al-Mandab and the Red Sea, Saudi oil exports and pipelines, energy sites hit or repaired and what they can do now, with the figure and who gives it. Then, in a paragraph of their own after it, the political, diplomatic and economic facts (threats, mobilisations, talks, statements, the economy). Never mix the two in one paragraph, unless a political fact belongs to a battle sentence (a mobilisation call with the offensive it launched).
  Split it into short paragraphs by topic, 1-2 sentences each, with a blank line ("\\n\\n") between them.
- "situation_more": what a reader gets from "Read more" under "situation": the same bird's-eye view one level closer, with the key figures (deaths, what was hit) and the other notable developments "situation" left out, including statements, talks and meetings on the war. 2-5 sentences, at most 120 words, no tactical detail, never repeating a sentence of "situation". "" when there is nothing more. The same order: battle first, then the political, diplomatic and economic facts in their own paragraph. Short paragraphs by topic, with a blank line ("\\n\\n") between them.
- "fronts": for each front id given, the MAIN DEVELOPMENTS on that front in these ${H}, most important first, in the same way: concrete places and who did what, 2-4 short sentences, never vague. A front is a governorate (or the Bab al-Mandab strait, the Red Sea coast from Mocha to Hodeidah, or Saudi Arabia): say where inside it each thing happened ("in western Taiz, at Al-Wazi'iyah", "north of Marib city"). A front with nothing new gets its current state from the previous text, stated positively.
- "map": one entry per main development of these ${H} (the ones "situation" sums up) that happened AT a named place, taken from the REPORTS: {"place": the place exactly as written in the report (village, town, district, mountain, Saudi city), "kind": one of capture|advance|fighting|repelled|airstrike|shelling|missile|drone|interception|naval|alert, "side": who acted (the taker, the attacker, the one who struck or fired): houthi|government|southern|saudi|us, "from": for a missile or drone, where it was launched from if the reports say (a place name), else omit}.
  capture = ground taken; advance = forces moved forward without taking a named place; fighting = clashes with no side gaining; repelled = an attack beaten back (side = the attacker); interception = a missile or drone shot down (place = the target area); naval = an attack on or by a ship; alert = sirens or an air-raid alert sounded there (side = the side whose attack was feared). Statements, decisions and meetings get no entry. No entry without a named place.
- "front_maps": the same kind of list for each front id, from that front's paragraph (places as written there).
Rules:
- Only facts in the reports. Never invent a place, number, unit or claim.
- A front's paragraph uses ONLY reports tagged with that front's id.
- No attribution to outlets or spokespeople. Anything from a [Houthi-aligned] or [Gov/Saudi-aligned] outlet is a party's claim and is written as reported, never as fact: "strikes were reported on...", "fighting was reported in...", "it was reported that...". This covers casualties, what a strike hit, strike counts and advances.
- A statement by an official body (a ministry, the UN, the coalition command, a government) is written as plain fact, with no speaker.
- Never write about what was NOT reported or did not change ("no fighting was reported", "no new clashes", "remained unchanged", "no reports"). A front with nothing new gets its current state from the previous text, stated positively.
- Neutral wording, no side's labels (no "aggression", "martyrs", "militia", "mercenaries").
- No clock times. Keep every casualty figure you mention exact; never drop reported deaths from the lead.
- A cumulative toll stays cumulative: a figure for the whole round (since July) is written as such ("since the round began in July"), never as the toll of recent or current fighting.
- Never mention the desk, reports, cards, logging, counts of reports or "the window". No hype.
- CONTROL lists who holds the contested districts and what changed hands this round. It is background: use it to place a front's fighting correctly (who holds the town, where the line runs), never as news of its own, and never contradict a newer report with it.
- Past tense for events, present for the state of play.
Return ONLY JSON {"situation":"...","situation_more":"...","fronts":{"<id>":"..."},"map":[...],"front_maps":{"<id>":[...]}}.`;

const BANNED = /\b(?:desk|logged|log|cards?|in the window|this window)\b/i;
/** Writing about absence: the panels state what is, not what was not reported. */
/** Filler the main developments must never carry: no place, no actor, no news. */
const VAGUE = /\b(?:(?:multiple|several|various|many|numerous) (?:fronts|areas|locations|axes)|remain(?:s|ed)? targeted|across (?:the |several |multiple )?(?:fronts|areas|country)|intense fighting (?:continued|spans?))\b/i;
const ABSENCE = /\b(?:no (?:new )?(?:fighting|clashes|strikes|attacks|incidents|reports?|activity|developments?)|(?:was|were) not reported|nothing (?:new )?(?:was )?reported|remain(?:ed|s)? unchanged)\b/i;

function cardLine(r: LiveReport, frontsOf: (r: LiveReport) => string[]): string {
  const side = outletSide(String(r.source || ""));
  const ids = frontsOf(r);
  const body = String(r.text || "").replace(/\s+/g, " ").slice(0, 160);
  return `${r.source}${side ? ` [${side}]` : ""}${ids.length ? ` {${ids.join(",")}}` : ""}: ${r.summary}${body ? ` — ${body}` : ""}`;
}

/** Drop a paragraph that breaks the rules; the composed text stands in for it. */
export function cleanProse(s: unknown, maxSentences: number, noVague = false, maxLength = 1200): string {
  // The writer's paragraphs (a blank line between them) are kept.
  const paras = String(s ?? "").split(/\n\s*\n/).map((p) => roleNamesInProse(p.replace(/\s+/g, " ").trim())).filter(Boolean);
  const t = paras.join(" ");
  if (t.length < 40 || t.length > maxLength || BANNED.test(t)) return "";
  const out: string[] = [];
  let left = maxSentences;
  for (const p of paras) {
    if (left <= 0) break;
    // A dot between digits is a decimal, not a full stop: "fell 1.1 percent" came
    // back as "fell 1. 1 percent" once the sentences were joined again.
    const sentences = (p.match(/(?:[^.!?]|\.(?=\d))+[.!?]+/g) || [p]).map((x) => x.trim());
    // A sentence about absence is dropped; the rest of the paragraph stands.
    const kept = sentences.filter((x) => !ABSENCE.test(x) && !(noVague && VAGUE.test(x))).slice(0, left);
    left -= kept.length;
    if (kept.length) out.push(kept.join(" "));
  }
  return out.join("\n\n");
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
function isOther(x: string): boolean {
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
      ...sorted.slice(-cap).map((r) => cardLine(r, frontsOf)),
    ].join("\n");
    got = await askChain("prose", SYSTEM, user);
    if (got) break;
  }
  if (!got) return null;
  const j = got.json;
  const out: Prose = { situation: cleanProse(j.situation, 4, true, 700), more: "", fronts: {}, model: got.model, devMap: [], frontMaps: {} };
  if (out.situation) {
    // Ordered over both parts together: the fighting from the overview and "Read more" first, then the sea, then politics.
    const [first, ...rest] = battleFirst([out.situation, cleanProse(j.situation_more, 5, true, 1000)].filter(Boolean).join("\n\n")).split("\n\n");
    out.situation = first;
    out.more = rest.join("\n\n");
  }
  // Over 75 words the overview is not short: its last sentences open "Read more" instead, so nothing is lost.
  const [top, moved] = fitWords(out.situation, 75);
  if (moved) {
    out.situation = top;
    out.more = [moved, out.more].filter(Boolean).join("\n\n");
  }
  const fj = (j.fronts && typeof j.fronts === "object" ? j.fronts : {}) as Record<string, unknown>;
  const fm = (j.front_maps && typeof j.front_maps === "object" ? j.front_maps : {}) as Record<string, unknown>;
  for (const f of fronts) {
    out.fronts[f.id] = cleanProse(fj[f.id], 4);
    const marks = cleanDevMap(fm[f.id], out.fronts[f.id]);
    if (marks.length) out.frontMaps[f.id] = marks;
  }
  // The overview names fronts, not villages: its map's places are checked
  // against everything written and the reports themselves, so the map keeps
  // every place it had.
  if (out.situation) {
    const written = [out.situation, out.more, ...Object.values(out.fronts), ...sorted.slice(-last).map((r) => `${r.summary}. ${String(r.text || "")}`)].join("\n");
    out.devMap = cleanDevMap(j.map, written, 14);
  }
  return out;
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
