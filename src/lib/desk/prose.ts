/**
 * The 12-hour prose: "Latest Developments" for the whole conflict and a short
 * paragraph per front, written by a model from the window's published cards.
 * Server-only.
 *
 * Both are a bird's-eye view: the state of the war and of each front, not a
 * list of who said what. The cards carry the attribution; these panels carry
 * the picture. Anything that fails the checks here falls back to the composed
 * text, so a bad or missing answer never blanks a panel.
 */

import type { LiveReport } from "./types.ts";
import { roleNamesInProse } from "./reader.ts";
import { askChain } from "./models.ts";
import { outletSide } from "./digest.ts";

export type ProseFront = { id: string; name: string; incidents: number; previous: string };
export type Prose = { situation: string; fronts: Record<string, string>; model?: string };

const SYSTEM = `You are the editor of a live news desk on the current round of the Yemen war (from 3 July 2026: the Houthis against the Yemeni government and the Saudi-led coalition).
You get the reports published in the last 12 hours and the text that stood before. Each report line is: outlet [its alignment, if any] {the front ids it belongs to}: headline — body.
Write a bird's-eye view in English wire style (Reuters/AP):
- "situation": 2-3 short sentences, at most 60 words, for the whole conflict: ONE picture of where the war stands, built from the most important developments (not a list of events followed by a summary).
- "fronts": for each front id given, the current state of that front drawn from its latest developments. Two sentences as a rule; up to four when there is real substance.
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
- Past tense for events, present for the state of play.
Return ONLY JSON {"situation":"...","fronts":{"<id>":"..."}}.`;

const BANNED = /\b(?:desk|logged|log|cards?|in the window|this window)\b/i;
/** Writing about absence: the panels state what is, not what was not reported. */
const ABSENCE = /\b(?:no (?:new )?(?:fighting|clashes|strikes|attacks|incidents|reports?|activity|developments?)|(?:was|were) not reported|nothing (?:new )?(?:was )?reported|remain(?:ed|s)? unchanged)\b/i;

function cardLine(r: LiveReport, frontsOf: (r: LiveReport) => string[]): string {
  const side = outletSide(String(r.source || ""));
  const ids = frontsOf(r);
  const body = String(r.text || "").replace(/\s+/g, " ").slice(0, 160);
  return `${r.source}${side ? ` [${side}]` : ""}${ids.length ? ` {${ids.join(",")}}` : ""}: ${r.summary}${body ? ` — ${body}` : ""}`;
}

/** Drop a paragraph that breaks the rules; the composed text stands in for it. */
export function cleanProse(s: unknown, maxSentences: number): string {
  const t = roleNamesInProse(String(s ?? "").replace(/\s+/g, " ").trim());
  if (t.length < 40 || t.length > 1200 || BANNED.test(t)) return "";
  // A dot between digits is a decimal, not a full stop: "fell 1.1 percent" came
  // back as "fell 1. 1 percent" once the sentences were joined again.
  const sentences = (t.match(/(?:[^.!?]|\.(?=\d))+[.!?]+/g) || [t]).map((x) => x.trim());
  // A sentence about absence is dropped; the rest of the paragraph stands.
  const kept = sentences.filter((x) => !ABSENCE.test(x));
  return kept.length ? kept.slice(0, maxSentences).join(" ") : "";
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
      "REPORTS:",
      ...sorted.slice(-cap).map((r) => cardLine(r, frontsOf)),
    ].join("\n");
    got = await askChain("prose", SYSTEM, user);
    if (got) break;
  }
  if (!got) return null;
  const j = got.json;
  const out: Prose = { situation: cleanProse(j.situation, 3), fronts: {}, model: got.model };
  const fj = (j.fronts && typeof j.fronts === "object" ? j.fronts : {}) as Record<string, unknown>;
  for (const f of fronts) out.fronts[f.id] = cleanProse(fj[f.id], 4);
  return out;
}
