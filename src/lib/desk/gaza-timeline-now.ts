/**
 * The Gaza desk's Timeline "Now" box (user, 26 Oct: "on all desks it should update, only the current one"),
 * rewritten every 36 hours as the Iran desk's is (iran-timeline-now.ts). Server-only.
 *
 * The researched entry (public/gaza-timeline.json) is the base; a rewrite keeps its dated turns, topic by
 * topic, and adds a turn of the last 36 hours only when it changed things. The desk's words throughout.
 */

import type { LiveReport } from "./types.ts";
import type { DeskStore } from "./store.ts";
import { NUMBERS_MODELS, askChain } from "./models.ts";
import { outletSide } from "./digest.ts";
import { cleanProse } from "./prose.ts";
import { gazaWords, GAZA_WORD_RULES } from "./gaza-words.ts";
import { iranNowDue, type IranTimelineNow } from "./iran-timeline-now.ts";
import TL from "../../../public/gaza-timeline.json" with { type: "json" };

export const GAZA_NOW_KEY = "gaza:timeline-now";
const EVERY_MS = 36 * 3600_000;

export type GazaTimelineNow = IranTimelineNow;

export const GAZA_NOW_BASE = { summary: TL.now.sum, detail: TL.now.detail } as const;

/** The topics the entry is written in, each its own paragraph opening "Topic: ", as the researched entry has them. */
export const GAZA_TOPICS = GAZA_NOW_BASE.detail.split(/\n\s*\n/).map((p) => p.split(":")[0].trim());

const SYSTEM = `You write the "Now" entry of a timeline of Gaza and Judea and Samaria since the ceasefire of 10 October 2025.
You get the entry as it stood and the headlines of the last 36 hours. Rewrite the entry so it is true today.
- "summary": 2 sentences, at most 70 words: where things stand now.
- "detail": one paragraph per topic, in this order, each opening with the topic's name and a colon: ${GAZA_TOPICS.join("; ")}. Paragraphs are separated by a blank line. Each paragraph: the topic's main turns in date order, each with its date, 2 to 6 sentences.
Rules:
- Keep every dated turn the entry has, unless a headline shows it was wrong. Add a turn from the headlines only if it changed things (a decision on the day after, the Board of Peace, the ISF, disarmament, the line, a crossing, an election, sanctions, a major attack); never a routine strike, a statement, a threat or a toll of one attack.
- Only facts in the entry or the headlines. Never invent a place, date, number or claim. Hamas's, the PA's and Gaza's Health Ministry's figures and claims are written as their claims.
${GAZA_WORD_RULES}
- No clock times. Neutral wording. No mention of reports, headlines, the desk or "the last 36 hours".
- Past tense for events, present for the state of play.
Return ONLY JSON {"summary":"...","detail":"..."}.`;

/** A rewrite stands only in the entry's own shape: every topic's paragraph, no clock time. */
export function gazaNowShape(summary: string, detail: string): boolean {
  if (!summary || !detail || /\b\d{1,2}:\d{2}\b/.test(summary + detail)) return false;
  const paras = detail.split(/\n\s*\n/);
  return GAZA_TOPICS.every((f) => paras.some((p) => p.startsWith(`${f}:`)));
}

/** Rewrite the Now box when 36 hours have passed. Returns what is stored. */
export async function refreshGazaTimelineNow(store: DeskStore, reports: LiveReport[], now = new Date()): Promise<GazaTimelineNow | null> {
  const saved = (await store.getJson<GazaTimelineNow>(GAZA_NOW_KEY)) ?? null;
  if (!iranNowDue(saved, now)) return saved;
  const since = now.getTime() - EVERY_MS;
  const recent = reports
    .filter((r) => r.summary && Date.parse(String(r.at)) >= since)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (recent.length < 10) return saved;
  const base = saved?.summary ? saved : GAZA_NOW_BASE;
  let got: { json: Record<string, unknown>; model: string } | null = null;
  for (const cap of [500, 160, 60]) {
    const user = [
      `ENTRY SUMMARY: ${base.summary}`,
      `ENTRY DETAIL:\n${base.detail}`,
      "HEADLINES:",
      ...recent.slice(-cap).map((r) => {
        const side = outletSide(String(r.source || ""));
        return `${r.at.slice(0, 10)} ${r.source}${side ? ` [${side}]` : ""}: ${r.summary}`;
      }),
    ].join("\n");
    got = await askChain("gaza-timeline-now", SYSTEM, user, { models: NUMBERS_MODELS, timeoutMs: 120_000 });
    if (got) break;
  }
  if (!got) return saved;
  const summary = gazaWords(cleanProse(got.json.summary, 2, false, 600));
  const detail = gazaWords(cleanProse(got.json.detail, 45, false, 6000));
  if (!gazaNowShape(summary, detail)) {
    console.error("[gaza-timeline-now] answer failed the checks; the entry stays as it was");
    return saved;
  }
  const out: GazaTimelineNow = { summary, detail, asOf: now.toISOString(), model: got.model };
  await store.putJson(GAZA_NOW_KEY, out);
  return out;
}
