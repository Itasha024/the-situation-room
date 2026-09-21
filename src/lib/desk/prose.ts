/**
 * The 12-hour prose: "Latest Developments" for the whole conflict and a short
 * paragraph per front, written by a model from the window's published cards.
 * Server-only.
 *
 * The composed text in synthesis.ts (counts turned into sentences) read like a
 * log. This asks for what a wire editor would write: what happened, what
 * changed, where things stand. Anything that fails the checks here falls back
 * to the composed text, so a bad or missing answer never blanks a panel.
 */

import type { LiveReport } from "./types.ts";
import { groqKey, readerKey, GROQ_MODEL, roleNamesInProse } from "./reader.ts";
import { outletSide } from "./digest.ts";

export type ProseFront = { id: string; name: string; incidents: number; previous: string };
export type Prose = { situation: string; fronts: Record<string, string> };

const SYSTEM = `You are the editor of a live news desk on the current round of the Yemen war (from 3 July 2026: the Houthis against the Yemeni government and the Saudi-led coalition).
You get the cards the desk published in the last 12 hours and the text that stood before. Each card line is: outlet [its alignment, if any] {the front ids it belongs to}: headline — body.
Write, in English wire style (Reuters/AP):
- "situation": 3-5 sentences for the whole conflict. Lead with the most important development of the 12 hours, then what changed elsewhere, then where the war stands now (fronts moving or holding, the air campaign, the Saudi home front, the sea, diplomacy).
- "fronts": for each front id given, 2-3 sentences: the latest there and its current state. A front with 0 incidents: say briefly that no new fighting was reported and restate its state from the previous text.
Rules:
- Only facts in the cards. Never invent a place, number, unit or claim.
- A front's paragraph uses ONLY cards tagged with that front's id.
- Anything from a [Houthi-aligned] or [Gov/Saudi-aligned] outlet is that side's claim and is attributed to it: "Houthi media said", "the Houthi spokesperson said", "Saudi-aligned outlets reported". This covers casualties, damage, what a strike hit (markets, schools, homes), strike counts and advances.
- A figure keeps the speaker its card gives. Never move a figure from one party to another (a count of Saudi strikes given by the Houthi spokesperson is "the Houthi spokesperson said", never "Saudi forces reported").
- Neutral wording, no side's labels (no "aggression", "martyrs", "militia", "mercenaries").
- No clock times and no "according to a report"; name who said it.
- Keep every casualty figure you mention exact, and never drop reported deaths from the lead development.
- Never mention the desk, cards, logging, counts of reports or "the window". No "reportedly" chains, no hype.
- Past tense for events, present for the state of play.
Return ONLY JSON {"situation":"...","fronts":{"<id>":"..."}}.`;

const BANNED = /\b(?:desk|logged|log|cards?|in the window|this window)\b/i;

function cardLine(r: LiveReport, frontsOf: (r: LiveReport) => string[]): string {
  const side = outletSide(String(r.source || ""));
  const ids = frontsOf(r);
  const body = String(r.text || "").replace(/\s+/g, " ").slice(0, 140);
  return `${r.source}${side ? ` [${side}]` : ""}${ids.length ? ` {${ids.join(",")}}` : ""}: ${r.summary}${body ? ` — ${body}` : ""}`;
}

/** Drop a paragraph that breaks the rules; the composed text stands in for it. */
export function cleanProse(s: unknown, maxSentences: number): string {
  const t = roleNamesInProse(String(s ?? "").replace(/\s+/g, " ").trim());
  if (t.length < 40 || t.length > 1200 || BANNED.test(t)) return "";
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
  return sentences.slice(0, maxSentences).map((x) => x.trim()).join(" ");
}

/**
 * Groq limits tokens per day per model, and the card reader spends most of the
 * main model's budget: the prose falls through to other models on the account.
 */
const PROSE_MODELS = [GROQ_MODEL, "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

/** The first JSON object in a model answer (some models wrap it in prose or fences). */
export function looseJson(text: string): Record<string, unknown> | null {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const v = JSON.parse(text.slice(a, b + 1));
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function askJson(system: string, user: string): Promise<Record<string, unknown> | null> {
  const groq = groqKey();
  for (const model of groq ? PROSE_MODELS : []) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${groq}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const parsed = looseJson(j.choices?.[0]?.message?.content || "");
        if (parsed) return parsed;
        console.error(`[prose] ${model}: no JSON in the answer`);
        continue;
      }
      console.error(`[prose] ${model}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
    } catch (err) {
      console.error(`[prose] ${model}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  const gemini = readerKey();
  if (!gemini) return null;
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": gemini },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}");
  } catch {
    return null;
  }
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
  // The smaller models cap input tokens per minute: a busy night's cards are
  // cut down, oldest first, until one answers.
  let j: Record<string, unknown> | null = null;
  let last = -1;
  for (const want of [140, 90, 55]) {
    const cap = Math.min(want, sorted.length);
    if (cap === last) continue;
    last = cap;
    const user = [
      `PREVIOUS SITUATION: ${previousSituation || "(none)"}`,
      "FRONTS:",
      ...fronts.map((f) => `- ${f.id} = ${f.name}; incidents: ${f.incidents}; previous: ${f.previous || "(none)"}`),
      "CARDS:",
      ...sorted.slice(-cap).map((r) => cardLine(r, frontsOf)),
    ].join("\n");
    j = await askJson(SYSTEM, user);
    if (j) break;
  }
  if (!j) return null;
  const out: Prose = { situation: cleanProse(j.situation, 5), fronts: {} };
  const fj = (j.fronts && typeof j.fronts === "object" ? j.fronts : {}) as Record<string, unknown>;
  for (const f of fronts) out.fronts[f.id] = cleanProse(fj[f.id], 3);
  return out;
}
