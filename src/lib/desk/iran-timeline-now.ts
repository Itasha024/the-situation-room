/**
 * The Iran desk's Timeline "Now" box (Round 31 N3), rewritten every 36 hours.
 * Server-only. The Yemen desk's box (timeline-now.ts) is untouched: its own
 * key, its three days, its rules.
 *
 * The researched entry (public/iran-timeline.json, every turn dated and
 * sourced) is the base; a rewrite keeps the war's main turns, front by front,
 * and adds a turn of the last 36 hours only when it changed the war.
 */

import type { LiveReport } from "./types.ts";
import type { DeskStore } from "./store.ts";
import { NUMBERS_MODELS, askChain } from "./models.ts";
import { outletSide } from "./digest.ts";
import { cleanProse } from "./prose.ts";
import TL from "../../../public/iran-timeline.json" with { type: "json" };

export const IRAN_NOW_KEY = "iran:timeline-now";
export const IRAN_NOW_EVERY_MS = 36 * 3600_000;
const SLACK_MS = 3600_000;

export type IranTimelineNow = { summary: string; detail: string; asOf: string; model?: string };

export const IRAN_NOW_BASE = { summary: TL.now.sum, detail: TL.now.detail } as const;

/** The fronts the entry is written in, each its own paragraph opening "Front: ". */
export const IRAN_FRONTS = ["Iran, Israel and the US", "Lebanon", "Iraq", "The Gulf states", "Hormuz and shipping", "Talks and ceasefires", "Sanctions and the economy"];

const SYSTEM = `You write the "Now" entry of a timeline of the Iran war, which began on 28 February 2026 with US and Israeli strikes on Iran.
You get the entry as it stood and the headlines of the last 36 hours. Rewrite the entry so it is true today.
- "summary": 2 sentences, at most 70 words: what the war is and where it stands now.
- "detail": one paragraph per front, in this order, each opening with the front's name and a colon: ${IRAN_FRONTS.join("; ")}. Paragraphs are separated by a blank line. Each paragraph: the front's main turns in date order, each with its date, 2 to 6 sentences.
Rules:
- Keep every dated turn the entry has, unless a headline shows it was wrong. Add a turn from the headlines only if it changed the front (a new front, a ceasefire or its end, a leader killed, a first, a major site hit, a deal); never a routine strike, a statement, a threat or a toll of one attack.
- Only facts in the entry or the headlines. Never invent a place, date, number or claim. A party's claim that no other side confirms is written as its claim.
- The Houthis' war in Yemen, Saudi Arabia's south and the Red Sea is another desk's: leave it out.
- No clock times. Neutral wording, no side's labels. No mention of reports, headlines, the desk or "the last 36 hours".
- Past tense for events, present for the state of play.
Return ONLY JSON {"summary":"...","detail":"..."}.`;

export function iranNowDue(saved: IranTimelineNow | null, now: Date): boolean {
  if (!saved?.asOf) return true;
  const t = Date.parse(saved.asOf);
  return !Number.isFinite(t) || now.getTime() - t >= IRAN_NOW_EVERY_MS - SLACK_MS;
}

/** A rewrite stands only in the entry's own shape: every front's paragraph, the war's start, no clock time. */
export function iranNowShape(summary: string, detail: string): boolean {
  if (!summary || !detail || /\b\d{1,2}:\d{2}\b/.test(summary + detail)) return false;
  if (!/28 February/.test(detail)) return false;
  const paras = detail.split(/\n\s*\n/);
  return IRAN_FRONTS.every((f) => paras.some((p) => p.startsWith(`${f}:`)));
}

/** Rewrite the Now box when 36 hours have passed. Returns what is stored. */
export async function refreshIranTimelineNow(store: DeskStore, reports: LiveReport[], now = new Date()): Promise<IranTimelineNow | null> {
  const saved = (await store.getJson<IranTimelineNow>(IRAN_NOW_KEY)) ?? null;
  if (!iranNowDue(saved, now)) return saved;
  const since = now.getTime() - IRAN_NOW_EVERY_MS;
  const recent = reports
    .filter((r) => r.summary && Date.parse(String(r.at)) >= since)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (recent.length < 10) return saved;
  const base = saved?.summary ? saved : IRAN_NOW_BASE;
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
    got = await askChain("iran-timeline-now", SYSTEM, user, { models: NUMBERS_MODELS, timeoutMs: 120_000 });
    if (got) break;
  }
  if (!got) return saved;
  const summary = cleanProse(got.json.summary, 2, false, 600);
  const detail = cleanProse(got.json.detail, 45, false, 6000);
  if (!iranNowShape(summary, detail)) {
    console.error("[iran-timeline-now] answer failed the checks; the entry stays as it was");
    return saved;
  }
  const out: IranTimelineNow = { summary, detail, asOf: now.toISOString(), model: got.model };
  await store.putJson(IRAN_NOW_KEY, out);
  return out;
}
