/**
 * The reading layer. Server-only.
 *
 * WHY THIS EXISTS: the deterministic composer decides what a report says from
 * keyword matches, and keywords cannot answer the questions that decide whether
 * a report is true. It published a programme clip titled "Marib and Taiz: the
 * battle map" as clashes happening now; an IRGC shoot-down over Hormuz as a
 * Houthi action; Pakistani casualties as this war's; artillery fire as air
 * strikes; the air bases Saudi jets took off from as the targets they hit.
 *
 * So a model reads each item and answers, per item, as a wire editor would:
 * is this our conflict, is it happening now, who did what to whom, with what —
 * and writes the report. Then code checks the answer (`checkReading`) before
 * anything is published: every figure must be in the source, no filler, no
 * sourcing labels, a statement must lead with its speaker. What fails the
 * check is not published.
 *
 * Without a verdict, nothing is published: the item waits and is retried on
 * the next cycle. A wrong report is worse than a late one.
 */

import { createHash } from "node:crypto";

export type ReaderItem = {
  id: string;
  source: string;
  /** "Houthi-aligned", "Saudi/government-aligned", "no declared alignment". */
  alignment: string;
  postedAt: string;
  text: string;
};

export type EventType =
  | "air_strike"
  | "shelling"
  | "missile_launch"
  | "drone_attack"
  | "interception"
  | "ground_clash"
  | "advance_or_capture"
  | "air_raid_alert"
  | "maritime_attack"
  | "statement"
  | "diplomacy"
  | "economy";

export type Reading = {
  id: string;
  publish: boolean;
  /** Why not, in a few words, when publish is false. */
  reject_reason: string;
  event_type: EventType;
  /** False when origin and target cannot be told apart with confidence. */
  confident_roles: boolean;
  actor: string | null;
  /** English names of the places struck, or where the event happened. */
  targets: string[];
  /** English names of places a weapon or aircraft came FROM. Never pinned. */
  origins: string[];
  /** How a statement card opens: "Trump", "Yemen's defence minister". */
  speaker_lead: string | null;
  /** Does the report favour the side of the outlet carrying it? */
  interest: "for" | "against" | "neutral";
  has_time: boolean;
  headline: string;
  body: string;
  /**
   * The ref of an already-published report this item directly develops (the
   * same incident: its toll, its aftermath, a response to that exact attack),
   * or "". Resolved to that report's fp before the reading is cached.
   */
  follows_up?: string;
};

/** A report already on the desk, shown to the reader so it can spot follow-ups. */
export type RecentReport = { ref: string; at: string; headline: string };

/**
 * Tried in order. The free tier allows about 20 requests a day PER MODEL, so
 * the chain is the daily budget: lite models first (they read the audit cases
 * correctly and their quota goes further), the full model last.
 */
export const READER_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];
/** Items per model call — large, because calls are what the quota counts. */
export const READER_BATCH = 15;

/** The answer's shape, enforced by the API so a reply always parses. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          publish: { type: "BOOLEAN" },
          reject_reason: { type: "STRING" },
          event_type: {
            type: "STRING",
            enum: [
              "air_strike", "shelling", "missile_launch", "drone_attack", "interception", "ground_clash",
              "advance_or_capture", "air_raid_alert", "maritime_attack", "statement", "diplomacy", "economy",
            ],
          },
          confident_roles: { type: "BOOLEAN" },
          actor: { type: "STRING", nullable: true },
          targets: { type: "ARRAY", items: { type: "STRING" } },
          origins: { type: "ARRAY", items: { type: "STRING" } },
          // Required and never null: an optional field is one a light model skips.
          speaker_lead: { type: "STRING", description: "The speaker for a statement or diplomacy item; empty string otherwise." },
          interest: { type: "STRING", enum: ["for", "against", "neutral"] },
          has_time: { type: "BOOLEAN" },
          headline: { type: "STRING" },
          body: { type: "STRING" },
          follows_up: { type: "STRING", description: "ref of the recent report this directly develops, or empty string." },
        },
        required: [
          "id", "publish", "reject_reason", "event_type", "confident_roles", "targets", "origins",
          "speaker_lead", "interest", "has_time", "headline", "body", "follows_up",
        ],
      },
    },
  },
  required: ["items"],
};

export const SYSTEM_PROMPT = `You are the wire editor of a news desk covering ONE war: the war in Yemen —
the Houthis against the internationally recognised Yemeni government and Saudi
Arabia and its coalition, including Houthi fire on Saudi Arabia and on shipping
in the Red Sea, Bab al-Mandab and the Gulf of Aden.

You receive several raw items (Telegram posts and article teasers, mostly
Arabic) and return one verdict per item. You decide whether each item is
published, and you write it. Being wrong is worse than being silent: when in
doubt, publish=false.

PUBLISH ONLY IF ALL OF THESE HOLD
1. IN SCOPE. The item is about THIS war. Our sources cover many other stories;
   an item is not ours because it sounds military. Out of scope, whoever posts
   it: Iran or the IRGC acting against the US or Israel (e.g. a drone shot down
   over Hormuz) unless the item itself ties it to Yemen or the Houthis; Gaza,
   Lebanon, Iraq, Syria, Ukraine, Pakistan, Sudan as the subject; domestic
   politics of any country. In scope: fighting, strikes, launches, sirens and
   alerts in Yemen, in Saudi Arabia, and at sea; statements by the parties
   (Houthis, the Yemeni government, Saudi Arabia) and by the US, Iran, the UN,
   Europe, Turkey, Pakistan, Qatar ABOUT this war; arms sales to a party; a
   party tying Yemen to other fronts ("unity of fronts");
   outside powers deciding or debating whether to strike, arm or back a party
   (e.g. Trump weighing strikes on the Houthis after a Saudi request), and
   requests for help between the parties and their allies; foreign media
   reports about this war, including ones relayed by other outlets ("according
   to the New York Times ..."). These are in scope, not "internal politics".
2. CURRENT. It reports something that happened or was said now. NOT a
   programme title, a video segment, a battle map, a documentary, an analysis,
   an anniversary, a recap. "Marib and Taiz: the map of the battles #ThisDay"
   is a programme clip, not a report of clashes — publish=false.
3. SUBSTANTIVE. A reader learns what happened or what was said about what.
   "A spokesman said something" with no content is not a report.

WHO DID WHAT TO WHOM — never infer, never assume
- The actor is who the TEXT says acted. Never assign an attack to the Houthis
  (or anyone) because the outlet is aligned with them or because it fits.
- Keep the weapon exactly: shelling/artillery is not an air strike; a drone is
  not a missile; an interception is not an impact.
- Distinguish where a weapon came FROM (origins) from where it was AIMED or
  LANDED (targets). An air base aircraft took off from is an origin. If you
  cannot tell the roles apart, confident_roles=false and targets=[].
- targets/origins: each place exactly as the text writes it, in the text's own
  language (e.g. "تعز"). Places only — no descriptions.

WRITING
- English wire style. headline <= 110 characters, sentence case, no full stop.
- body: 1-3 sentences carrying the substance. A thin item gets a short body.
- Every number, name and place you write must be in the item's text. Add
  nothing: no background, no cause, no casualties, no attribution the text
  does not give.
- NEVER write about what is missing or unverified: no "no casualties were
  reported", "casualty figures were not given", "details were not immediately
  available", "could not be independently verified", "it was unclear". Never
  name the outlet or say who "carried" or "reported" the item — the card shows
  the source.
- A place a general reader does not know gets a short locator once, in the
  body only: "Kahbub in Lahj governorate". Never inside a list of places, never
  for Sanaa, Aden, Marib, Taiz, Hodeidah, Riyadh, Jeddah, Mecca, the Red Sea,
  Bab al-Mandab.
- Neutral words: "Houthi forces", "Yemeni government forces", "Saudi forces",
  "people killed". Never "martyrs", "mercenaries", "aggression", "enemy".

STATEMENTS (event_type statement or diplomacy)
- speaker_lead is REQUIRED, and the headline starts with it.
  A person: speaker_lead, a colon, what they said — "Saree: Saudi jets carried
  out 28 strikes in 24 hours", "Trump: ...". A state or institution may lead
  with a verb — "Qatar condemns Houthi missile attack on Riyadh".
- speaker_lead: a bare surname only for a figure an international reader knows
  (Trump, Rubio, al-Mashat, Saree, Abdul Malik al-Houthi, al-Alimi, Grundberg).
  Otherwise the title alone ("Yemen's defence minister", "The Houthis' chief
  negotiator") or the affiliation alone ("A Houthi official", "A Saudi
  military analyst"). Never an unfamiliar personal name, in headline or body.
- Say what was said, specifically. If the speaker denies an accusation, state
  the accusation and the denial.

interest: "for" if the report favours the side of the outlet carrying it (a
Houthi outlet reporting Houthi gains or enemy losses), "against" if it hurts
that side (an outlet admitting its own side's losses), else "neutral".
has_time: true if the text says when it happened.

FOLLOW-UPS
You also get "recent": reports the desk already published, each with a ref.
follows_up = the ref of a recent report ONLY when this item is a direct
development of that exact same incident: the toll of that strike rising, the
aftermath at that same place, a reply to that specific attack, the same
battle's outcome. Same area or same kind of event is NOT enough; a new strike
in the same district is a new event. When in doubt, "".

Return JSON: {"items":[{"id":string,"publish":bool,"reject_reason":string,
"event_type":"air_strike"|"shelling"|"missile_launch"|"drone_attack"|
"interception"|"ground_clash"|"advance_or_capture"|"air_raid_alert"|
"maritime_attack"|"statement"|"diplomacy"|"economy","confident_roles":bool,
"actor":string|null,"targets":[string],"origins":[string],
"speaker_lead":string|null,"interest":"for"|"against"|"neutral",
"has_time":bool,"headline":string,"body":string,"follows_up":string}]}
When publish=false, headline and body may be "".`;

/** Phrases that never appear in published copy, whoever wrote it. */
export const BANNED_PHRASES: RegExp[] = [
  /carried the (?:report|account)/i,
  /independently verif/i,
  /single source/i,
  /party claim/i,
  /wire report/i,
  /not immediately (?:known|clear|available)/i,
  /not (?:been )?determined/i,
  /no further details/i,
  /unclear whether/i,
  /(?:no|without) casualty figures/i,
  /casualty figures were not/i,
  /no casualties (?:were|have been) reported/i,
  /neither side gave/i,
  /could not be (?:verified|confirmed)/i,
  // The sources' vocabulary, not the desk's (see NEUTRALISE in wire-style.ts).
  /\benem(?:y|ies)\b/i,
  /\bmartyr/i,
  /\bmercenar/i,
  /\baggression\b/i,
  /\bZionist/i,
];

/** Bumped when the instructions change, so cached readings are redone. */
export const PROMPT_VERSION = 2;

export function contentHash(text: string): string {
  return createHash("sha256").update(`v${PROMPT_VERSION} ` + String(text || "").replace(/\s+/g, " ").trim()).digest("hex").slice(0, 24);
}

/** Western digits for every number in a text, Arabic-Indic included. */
function numbersIn(text: string): Set<string> {
  const western = String(text || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  return new Set((western.match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, "")));
}

/**
 * The code's check on the model. Returns why a reading must not be published,
 * or null when it may be.
 */
export function checkReading(r: Reading, sourceText: string): string | null {
  if (!r.publish) return r.reject_reason || "not publishable";
  const h = String(r.headline || "").trim();
  const b = String(r.body || "").trim();
  if (h.length < 12 || h.length > 140) return "headline length";
  if (b.length < 20) return "empty body";
  if (/[؀-ۿ֐-׿]/.test(h + b)) return "source-language text in copy";
  for (const re of BANNED_PHRASES) if (re.test(`${h} ${b}`)) return `banned phrase: ${re.source}`;

  // Every figure must come from the source. Years and ordinals in dates are
  // numbers too, so they are held to the same rule.
  const have = numbersIn(sourceText);
  for (const n of numbersIn(`${h} ${b}`)) {
    if (!have.has(n)) return `figure not in source: ${n}`;
  }

  if (r.event_type === "statement" || r.event_type === "diplomacy") {
    // A headline shaped "X: ..." names its speaker even when the field is empty.
    const lead = String(r.speaker_lead || "").trim() || (/^([^:]{2,60}):\s/.exec(h)?.[1] ?? "");
    if (!lead) return "statement without a speaker";
    if (!h.toLowerCase().startsWith(lead.toLowerCase())) return "statement does not lead with its speaker";
  }
  return null;
}

type CallResult = { readings: Reading[]; model: string } | { error: string };

async function callModel(items: ReaderItem[], apiKey: string, model: string, recent: RecentReport[]): Promise<CallResult> {
  const payload = items.map((i) => ({
    id: i.id,
    source: i.source,
    source_alignment: i.alignment,
    posted_at: i.postedAt,
    text: i.text.slice(0, 2400),
  }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ recent, items: payload }) }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      }),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
    const parsed = JSON.parse(text) as { items?: Reading[] };
    if (!Array.isArray(parsed.items)) return { error: "no items in response" };
    return { readings: parsed.items, model };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "call failed" };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Read a batch, walking the model chain. Busy (503): back off and retry. Out
 * of quota (429): note the model in `exhausted` so the caller skips it for a
 * while, and move to the next. Returns what was read; anything missing simply
 * was not read this time.
 */
export async function readBatch(
  items: ReaderItem[],
  apiKey: string,
  skip: ReadonlySet<string> = new Set(),
  recent: RecentReport[] = [],
): Promise<{ readings: Map<string, Reading>; model?: string; error?: string; exhausted: string[] }> {
  let lastError = "";
  const exhausted: string[] = [];
  for (const model of READER_MODELS) {
    if (!apiKey || skip.has(model)) continue;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const r = await callModel(items, apiKey, model, recent);
      if ("readings" in r) {
        const byId = new Map<string, Reading>();
        for (const x of r.readings) if (x && typeof x.id === "string") byId.set(x.id, x);
        return { readings: byId, model: r.model, exhausted };
      }
      lastError = `${model}: ${r.error}`;
      // Quota exhausted: the next model has its own quota — move on now.
      if (r.error === "HTTP 429") {
        exhausted.push(model);
        break;
      }
      if (r.error !== "HTTP 503" && !/abort/i.test(r.error)) break;
      await sleep(1500 * 2 ** attempt);
    }
  }
  // Every Gemini model out (or no Gemini key): the free Groq fallback reads
  // what it can. Its free tier counts tokens per minute, so it takes a few
  // items per call; what it does not reach stays queued for the next cycle.
  const groq = groqKey();
  if (groq && !skip.has(GROQ_MODEL)) {
    const r = await callGroq(items.slice(0, GROQ_BATCH), groq, recent.slice(0, 15));
    if ("readings" in r) {
      const byId = new Map<string, Reading>();
      for (const x of r.readings) if (x && typeof x.id === "string") byId.set(x.id, x);
      return { readings: byId, model: r.model, exhausted };
    }
    lastError = `${GROQ_MODEL}: ${r.error}`;
    if (r.daily) exhausted.push(GROQ_MODEL);
  }
  return { readings: new Map(), error: lastError || "every model skipped (quota)", exhausted };
}

/**
 * The fallback reader, used only when every Gemini model is out of quota.
 * Same prompt, same `checkReading` afterwards, so a weaker model can publish
 * less, never something wrong.
 */
export const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_BATCH = 4;

async function callGroq(
  items: ReaderItem[],
  apiKey: string,
  recent: RecentReport[],
): Promise<{ readings: Reading[]; model: string } | { error: string; daily: boolean }> {
  const payload = items.map((i) => ({
    id: i.id,
    source: i.source,
    source_alignment: i.alignment,
    posted_at: i.postedAt,
    text: i.text.slice(0, 1600),
  }));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ recent, items: payload }) },
        ],
      }),
    });
    if (!res.ok) {
      // A per-minute limit clears by the next cycle; a daily one does not.
      const wait = Number(res.headers.get("retry-after") || 0);
      return { error: `HTTP ${res.status}`, daily: res.status === 429 && wait > 600 };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "") as { items?: Reading[] };
    if (!Array.isArray(parsed.items)) return { error: "no items in response", daily: false };
    return { readings: parsed.items, model: GROQ_MODEL };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "call failed", daily: false };
  } finally {
    clearTimeout(timer);
  }
}

export function readerKey(): string {
  return (typeof process !== "undefined" && process.env.GEMINI_API_KEY?.trim()) || "";
}

export function groqKey(): string {
  return (typeof process !== "undefined" && process.env.GROQ_API_KEY?.trim()) || "";
}
