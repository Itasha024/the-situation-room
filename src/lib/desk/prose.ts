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
import { groqKey, readerKey, GROQ_MODEL } from "./reader.ts";

export type ProseFront = { id: string; name: string; incidents: number; previous: string };
export type Prose = { situation: string; fronts: Record<string, string> };

const SYSTEM = `You are the editor of a live news desk on the current round of the Yemen war (from 3 July 2026: the Houthis against the Yemeni government and the Saudi-led coalition).
You get the cards the desk published in the last 12 hours (time, outlet, headline, body) and the text that stood before.
Write, in English wire style (Reuters/AP):
- "situation": 3-5 sentences for the whole conflict. Lead with the most important development of the 12 hours, then what changed elsewhere, then where the war stands now (fronts moving or holding, the air campaign, the Saudi home front, the sea, diplomacy).
- "fronts": for each front id given, 2-3 sentences: the latest there and its current state. A front with 0 incidents: say briefly that no new fighting was reported and restate its state from the previous text.
Rules:
- Only facts in the cards. Never invent a place, number, unit or claim.
- Attribute every claim of a party ("the Houthis said", "Saudi-aligned media reported"); neutral wording, no side's labels (no "aggression", "martyrs", "militia", "mercenaries").
- Keep every casualty figure you mention exact, and never drop reported deaths from the lead development.
- Never mention the desk, cards, logging, counts of reports or "the window". No "reportedly" chains, no hype.
- Past tense for events, present for the state of play.
Return ONLY JSON {"situation":"...","fronts":{"<id>":"..."}}.`;

const BANNED = /\b(?:desk|logged|log|cards?|in the window|this window)\b/i;

function cardLine(r: LiveReport): string {
  const t = String(r.at || "").slice(11, 16);
  const body = String(r.text || "").replace(/\s+/g, " ").slice(0, 220);
  return `${t} ${r.source}: ${r.summary}${body ? ` — ${body}` : ""}`;
}

/** Drop a paragraph that breaks the rules; the composed text stands in for it. */
export function cleanProse(s: unknown, maxSentences: number): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (t.length < 40 || t.length > 1200 || BANNED.test(t)) return "";
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
  return sentences.slice(0, maxSentences).join(" ").trim();
}

async function askJson(system: string, user: string): Promise<Record<string, unknown> | null> {
  const groq = groqKey();
  if (groq) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${groq}`, "content-type": "application/json" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return JSON.parse(j.choices?.[0]?.message?.content || "{}");
      }
    } catch {
      // Fall through to Gemini.
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
): Promise<Prose | null> {
  // Newest last, capped so the prompt stays small on a busy night.
  const cards = [...reports]
    .filter((r) => r.summary)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(-160);
  const user = [
    `PREVIOUS SITUATION: ${previousSituation || "(none)"}`,
    "FRONTS:",
    ...fronts.map((f) => `- ${f.id} = ${f.name}; incidents: ${f.incidents}; previous: ${f.previous || "(none)"}`),
    "CARDS:",
    ...cards.map(cardLine),
  ].join("\n");
  const j = await askJson(SYSTEM, user);
  if (!j) return null;
  const out: Prose = { situation: cleanProse(j.situation, 5), fronts: {} };
  const fj = (j.fronts && typeof j.fronts === "object" ? j.fronts : {}) as Record<string, unknown>;
  for (const f of fronts) out.fronts[f.id] = cleanProse(fj[f.id], 3);
  return out;
}
