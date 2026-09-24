/**
 * The model chain for the few, important writing jobs (the 12-hour prose, the
 * official numbers). Server-only.
 *
 * Every model on the free tiers has its own daily quota, so the chain is the
 * budget: the strongest free model first, and each one that answers 429 is
 * passed over for the next. Gemini Pro has no free quota (limit 0), so the
 * newest Gemini Flash leads. The card reader keeps its own chain (reader.ts)
 * and reaches the newest Flash last, so these jobs rarely find it spent.
 */

import { groqKey, readerKey } from "./reader.ts";

export type ChainModel = { provider: "gemini" | "groq"; id: string };

export const WRITER_MODELS: ChainModel[] = [
  { provider: "gemini", id: "gemini-3.8-flash" },
  { provider: "gemini", id: "gemini-3.7-flash" },
  { provider: "gemini", id: "gemini-3.5-flash" },
  { provider: "groq", id: "openai/gpt-oss-120b" },
  { provider: "gemini", id: "gemini-flash-latest" },
  { provider: "gemini", id: "gemma-4-31b-it" },
  { provider: "groq", id: "qwen/qwen3.8-27b" },
  { provider: "groq", id: "openai/gpt-oss-20b" },
];

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

async function callOne(m: ChainModel, system: string, user: string, temperature: number, ms = 90_000): Promise<string> {
  if (m.provider === "groq") {
    const key = groqKey();
    if (!key) throw new Error("no key");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(ms),
      body: JSON.stringify({
        model: m.id,
        temperature,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content || "";
  }
  const key = readerKey();
  if (!key) throw new Error("no key");
  // Gemma takes no system instruction or JSON mode: both go in the prompt.
  const gemma = m.id.startsWith("gemma");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m.id}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(ms),
    body: JSON.stringify({
      ...(gemma ? {} : { system_instruction: { parts: [{ text: system }] } }),
      contents: [{ role: "user", parts: [{ text: gemma ? `${system}\n\n${user}` : user }] }],
      generationConfig: { temperature, ...(gemma ? {} : { responseMimeType: "application/json" }) },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120).replace(/\s+/g, " ")}`);
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  return (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
}

/**
 * Ask the chain for a JSON object. Returns the answer and the model that gave
 * it, or null when none did. `tag` prefixes the log lines.
 */
export async function askChain(
  tag: string,
  system: string,
  user: string,
  { temperature = 0.2, models = WRITER_MODELS, timeoutMs = 90_000 }: { temperature?: number; models?: ChainModel[]; timeoutMs?: number } = {},
): Promise<{ json: Record<string, unknown>; model: string } | null> {
  for (const m of models) {
    try {
      const json = looseJson(await callOne(m, system, user, temperature, timeoutMs));
      if (json) {
        console.log(`[${tag}] written by ${m.id}`);
        return { json, model: m.id };
      }
      console.error(`[${tag}] ${m.id}: no JSON in the answer`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      if (msg !== "no key") console.error(`[${tag}] ${m.id}: ${msg}`);
    }
  }
  return null;
}
