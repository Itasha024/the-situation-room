/**
 * Which of a site's new headlines could concern this war, server-only.
 *
 * A website is read whole (sitemap.ts): its listing names every article, most
 * of them about something else. A keyword never judged these well — "Saudi oil
 * detour" names neither Yemen nor the Houthis — so a model reads the headlines,
 * sixty to a call, and picks the ones worth opening. The reader then decides on
 * the full article, as it does for everything, so triage leans towards picking.
 *
 * The chain is the models with the largest free daily quotas, not the reader's:
 * a triage call must never cost the reader a card. When none answers, the
 * keyword test below decides, and the headlines are judged again next time.
 */

import { type ChainModel, askChain } from "./models.ts";

export type Titled = { id: string; title: string; desc?: string; source: string };

/** Headlines per model call. */
export const TRIAGE_BATCH = 60;
/** Model calls per tick; what does not fit waits for the next tick. */
export const TRIAGE_CALLS = 5;
/** Triage never holds a tick longer than this: the tick has 300 seconds in all. */
const TRIAGE_MS = 45_000;

export const TRIAGE_MODELS: ChainModel[] = [
  { provider: "groq", id: "openai/gpt-oss-20b" },
  { provider: "groq", id: "qwen/qwen3.8-27b" },
  { provider: "groq", id: "openai/gpt-oss-safeguard-20b" },
  { provider: "gemini", id: "gemma-4-31b-it" },
];

const SYSTEM = `You sort headlines for a news desk that covers ONE war: the war in Yemen —
the Houthis against the Yemeni government, the Southern Transitional Council and
the Saudi-led coalition — including Houthi fire on Saudi Arabia and on shipping.

Pick every headline that could be about:
- fighting, strikes, launches, casualties or alerts in Yemen or Saudi Arabia;
- the Houthis, the Yemeni government, the STC, the coalition, Saudi or Emirati
  forces, or Iran's or anyone's support for a party;
- the Red Sea, Bab al-Mandab, the Gulf of Aden, and shipping or oil exports
  hit or rerouted by the war (Yanbu, the East-West pipeline, Aramco), ship
  traffic through Bab al-Mandab and Suez, Saudi exports moving between the Gulf
  and the Red Sea, and energy sites hit, repaired or back in service;
- Saudi Arabia's defence, security or diplomacy (talks with the US, Iran,
  Pakistan, the UN), and decisions or debate abroad about Yemen, the Houthis or
  helping Saudi Arabia;
- UN, aid or humanitarian news about Yemen.

Skip: other wars (Gaza, Lebanon, Syria, Iraq, Ukraine, Sudan, and the US–Iran
war and US–Iran talks, and Hormuz or Gulf shipping) unless Yemen, the Houthis,
Bab al-Mandab or Saudi exports are named;
piracy and ship hijackings by Somali or unknown gunmen; sport, culture, celebrities, markets and
business with no tie to the war; domestic politics of any country; opinion.
When a headline might be ours, pick it: the full article is read afterwards.

Answer JSON only: {"ours":["<id>", ...]}`;

/** The test used when no model answers: any name this war is reported under. */
const OURS =
  /\b(?:yemen\w*|houthis?|ansar allah|sanaa|aden|hodeidah|marib|taiz|red sea|bab[- ]el[- ]mandeb|bab al-mandab|gulf of aden|saudi\w*|riyadh|jeddah|yanbu|aramco|jazan|najran|stc|southern transitional)\b|اليمن|يمني|الحوث|أنصار الله|صنعاء|عدن|الحديدة|مأرب|تعز|البحر الأحمر|باب المندب|السعودي|الرياض|جدة|ينبع|أرامكو|جازان|نجران|الانتقالي/i;

/** Names that are only ever this war: a model's "no" does not overrule them. */
const SURE =
  /\b(?:yemen\w*|houthis?|ansar allah|sanaa|hodeidah|marib|bab[- ]el[- ]mandeb|bab al-mandab)\b|اليمن|يمني|الحوث|أنصار الله|صنعاء|الحديدة|مأرب|باب المندب/i;

export function keywordPick(t: Titled, re = OURS): boolean {
  return re.test(`${t.title} ${t.desc ?? ""}`);
}

/**
 * The ids a model picked, with `judged` true, or the keyword picks with
 * `judged` false when no model answered: those are asked again next tick.
 */
export async function triage(
  items: Titled[],
  ask: typeof askChain = askChain,
): Promise<{ picked: Set<string>; judged: Set<string> }> {
  const picked = new Set<string>();
  const judged = new Set<string>();
  const batches: Titled[][] = [];
  for (let i = 0; i < items.length; i += TRIAGE_BATCH) batches.push(items.slice(i, i + TRIAGE_BATCH));
  const until = Date.now() + TRIAGE_MS;
  // One call at a time, each starting on a different model: the free tiers
  // limit tokens per minute, and parallel calls spent it at once.
  for (const [n, batch] of batches.entries()) {
    const models = [...TRIAGE_MODELS.slice(n % TRIAGE_MODELS.length), ...TRIAGE_MODELS.slice(0, n % TRIAGE_MODELS.length)];
    const lines = batch.map((t) => `${t.id} | ${t.source} | ${t.title}${t.desc ? ` — ${t.desc.slice(0, 120)}` : ""}`);
    // Past the call budget or the time budget, the keywords decide for now.
    const res =
      n < TRIAGE_CALLS && Date.now() < until
        ? await ask("triage", SYSTEM, lines.join("\n"), { temperature: 0, models, timeoutMs: 15_000 }).catch(() => null)
        : null;
    const ours = Array.isArray(res?.json.ours) ? (res.json.ours as unknown[]).map(String) : null;
    for (const t of batch) {
      if (ours) {
        judged.add(t.id);
        if (ours.includes(t.id)) picked.add(t.id);
      } else if (keywordPick(t)) picked.add(t.id);
    }
  }
  // Never lose what the keywords are sure of, whatever a model said.
  for (const t of items) if (judged.has(t.id) && keywordPick(t, SURE)) picked.add(t.id);
  return { picked, judged };
}
