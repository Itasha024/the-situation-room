/**
 * The Timeline's "Now" box, rewritten every three days. Server-only.
 *
 * The earlier phases are history and never change; the present one is the
 * widest picture on the desk: how this round of the war began, what changed in
 * the last days and where it stands. No incident lists, no clock times, no
 * run of figures — the feed and the fronts carry those.
 */

import type { LiveReport } from "./types.ts";
import type { DeskStore } from "./store.ts";
import { askChain } from "./models.ts";
import { outletSide } from "./digest.ts";
import { cleanProse, controlContext } from "./prose.ts";
import { CONTROL_AS_OF } from "./control-data.ts";

export const TIMELINE_NOW_KEY = "timeline-now";
export const NOW_EVERY_MS = 3 * 24 * 3600_000;

export type TimelineNow = { summary: string; detail: string; asOf: string; model?: string };

/** The phase as written by hand, the base every rewrite starts from. */
export const NOW_BASE = {
  summary:
    "The war resumed in July 2026, when strikes on Sanaa airport ended years of de-escalation and the Houthis answered with missiles on Saudi Arabia and a blockade of Saudi-linked shipping. In September they took Mocha and closed on the Bab al-Mandab strait, while government forces pushed in Al-Jawf, Al-Bayda and western Taiz.",
  detail:
    "The round opened on 13 July 2026, when government jets struck the runways at Sanaa and Hodeidah airports to stop an Iranian aircraft landing. The Houthis called it the end of the de-escalation in place since the 2022 truce and fired missiles and drones at Abha, Jeddah, Jazan and Yanbu, hitting Aramco sites; on 20 July they declared a naval blockade of Saudi-linked shipping and attacked Saudi tankers in the Red Sea. Coalition and government air strikes answered in Hodeidah, Saada, Marib and Al-Jawf. Through August the Houthis kept up missile, drone and explosive-boat attacks on the port of Mocha, the government's foothold on the west coast. In early September government forces opened offensives in Al-Jawf, Al-Bayda and west of Taiz, and the Houthis struck back on the coast: they took Hays, Al-Khokha and on 10 September Mocha itself, and pushed towards Bab al-Mandab and the islands off it. Fighting has since spread along the Taiz, Lahj and Al-Dhale lines, and Houthi missiles keep reaching Saudi cities while Saudi air strikes and artillery hit northern Yemen. Hundreds of thousands have been displaced from the west coast.",
} as const;

const SYSTEM = `You write the "Now" entry of a timeline of the Yemen war: the current round, which began in July 2026 (the Houthis against the Yemeni government and the Saudi-led coalition).
You get the entry as it stood, who holds the contested districts, and the headlines of the last three days.
Rewrite the entry so it is true today. It is the widest view on the whole site — a historian's paragraph, not a news bulletin:
- "summary": 2 sentences, at most 60 words: what this round is and where it stands now.
- "detail": 4-7 sentences, at most 200 words: how the round began (keep the opening facts as given), its main turns, what shifted in the last days, and the state of play.
Rules:
- Only facts in the entry or the headlines. Never invent a place, number or claim.
- Bird's-eye: name regions, fronts and turning points, never single incidents, strikes, salvos, clock times or tolls of one attack. At most two figures in the whole text.
- A party's claim (from a [Houthi-aligned] or [Gov/Saudi-aligned] outlet) that no other side confirms is not a turning point; leave it out or write it as reported.
- Neutral wording, no side's labels. No mention of reports, headlines, the desk or "the last three days".
- Past tense for events, present for the state of play.
Return ONLY JSON {"summary":"...","detail":"..."}.`;

/** A clock time, or a text heavy with figures, is incident-level, not a bird's-eye view. */
export function birdsEye(s: string): boolean {
  if (/\b\d{1,2}:\d{2}\b/.test(s)) return false;
  // Years and dates ("13 July") are the timeline's own; anything else is a figure.
  const figures = s
    .replace(/\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December)\b/g, "")
    .match(/\b\d[\d,.]*\b/g)
    ?.filter((n) => !/^(?:19|20)\d\d$/.test(n)) ?? [];
  if (figures.length > 2) return false;
  // A list of incidents: a sentence strung on semicolons or many commas.
  return !s.split(/(?<=[.!?])\s+/).some((x) => (x.match(/;/g) || []).length > 2 || (x.match(/,/g) || []).length > 7);
}

export function nowDue(saved: TimelineNow | null, now: Date): boolean {
  if (!saved?.asOf) return true;
  const t = Date.parse(saved.asOf);
  return !Number.isFinite(t) || now.getTime() - t >= NOW_EVERY_MS;
}

/** Rewrite the Now box when three days have passed. Returns what is stored. */
export async function refreshTimelineNow(
  store: DeskStore,
  reports: LiveReport[],
  now = new Date(),
): Promise<TimelineNow | null> {
  const saved = (await store.getJson<TimelineNow>(TIMELINE_NOW_KEY)) ?? null;
  if (!nowDue(saved, now)) return saved;
  const since = now.getTime() - NOW_EVERY_MS;
  const recent = reports
    .filter((r) => r.summary && Date.parse(String(r.at)) >= since)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (recent.length < 10) return saved;
  const base = saved?.summary ? saved : NOW_BASE;
  let got: { json: Record<string, unknown>; model: string } | null = null;
  for (const cap of [500, 160]) {
    const user = [
      `ENTRY SUMMARY: ${base.summary}`,
      `ENTRY DETAIL: ${base.detail}`,
      `CONTROL (as of ${CONTROL_AS_OF}):`,
      ...controlContext().map((l) => `- ${l}`),
      "HEADLINES:",
      ...recent.slice(-cap).map((r) => {
        const side = outletSide(String(r.source || ""));
        return `${r.at.slice(0, 10)} ${r.source}${side ? ` [${side}]` : ""}: ${r.summary}`;
      }),
    ].join("\n");
    got = await askChain("timeline-now", SYSTEM, user);
    if (got) break;
  }
  if (!got) return saved;
  const summary = cleanProse(got.json.summary, 2);
  const detail = cleanProse(got.json.detail, 7);
  if (!summary || !detail || !birdsEye(summary) || !birdsEye(detail) || !/\bJuly\b/.test(detail)) {
    console.error("[timeline-now] answer failed the checks; the entry stays as it was");
    return saved;
  }
  const out: TimelineNow = { summary, detail, asOf: now.toISOString(), model: got.model };
  await store.putJson(TIMELINE_NOW_KEY, out);
  return out;
}
