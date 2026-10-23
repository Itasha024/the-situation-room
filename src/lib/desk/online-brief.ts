/**
 * The Online tab's briefs (user, 23 Oct: "for each category a brief and not the full messages, with an
 * option to see all"; "every 3 hours"; "add one 24h brief too"): what each kind of talk says in each area
 * over the last 3 hours, and the whole day in a few sentences, written by a free model every 3 hours from
 * the posts and comments. The messages themselves come in live.
 */
import { askChain, type ChainModel } from "./models.ts";
import { gazaWords } from "./gaza-words.ts";
import { VOICES, type AreaSummary, type WatchPost } from "./online-watch.ts";
import { cut } from "./online-classify.ts";

export type Briefs = {
  at: string;
  /** Each kind of talk, per area: id → brief. */
  areas: Record<string, Record<string, string>>;
  /** The whole day, per area. */
  day?: Record<string, string>;
};

const MODELS: ChainModel[] = [
  { provider: "nvidia", id: "nvidia/nemotron-3.5-lightning-30b-a3b" },
  { provider: "nvidia", id: "nvidia/nemotron-3-ultra-550b-a55b" },
  { provider: "openrouter", id: "openai/gpt-oss-120b:free" },
];
const PER_VOICE = 14;

type Listed = WatchPost & { n?: number; k?: string[] };
const line = (p: Listed) =>
  `- [${p.c ? "comment" : "post"} @${p.ch}${p.n && p.n > 1 ? `, on ${p.n} channels` : ""}${p.k?.length ? `; ${p.k.join(", ")}` : ""}] ${cut(p.x, 260)}`;
const areaName = (a: string) => (a === "gaza" ? "Gaza" : "Judea and Samaria");

const WORDING = `Never name a private person. Neutral wording: "killed", not "martyred"; "attack", not "heroic operation"; "Judea and Samaria", never "West Bank"; "Israeli citizens", never "settlers"; "the IDF" or "Israeli forces", not "the occupation".`;

const KINDS_SYSTEM = `You brief an Israeli news desk on what Palestinians are saying online, in one area (Gaza, or Judea and Samaria), over the last hours. You get the posts and comments of Palestinian Telegram channels, sorted by kind of talk.
For each kind given, write 1 to 3 short, plain English sentences: what is being said, who says it (a faction, local channels, commenters), the main lines and how widespread it is (one channel, many channels, many comments). Quote a striking phrase in English when it helps. ${WORDING}
When the messages under a kind do not really show that kind of talk (a road closure under "anger_hamas", a prayer under "anger_pa"), give that kind an empty string.
Answer JSON only: {"<kind id>": "<brief>"}, for the kinds given.`;

const DAY_SYSTEM = `You brief an Israeli news desk on the last 24 hours of talk among Palestinians online in one area (Gaza, or Judea and Samaria), from the posts and comments of Palestinian Telegram channels, each tagged with its kind (call, threat, praise, anger_hamas, anger_pa, complaint, grief, rumour).
Write 3 to 5 short, plain English sentences: the main things people talked about, the calls and threats if any, the mood, and what changed over the day. ${WORDING}
Answer JSON only: {"day": "<brief>"}.`;

/** A model's brief made clean: the desk's words, no "martyr", no stray JSON marks. */
export function cleanBrief(s: string): string {
  return gazaWords(String(s || "").trim().replace(/[}"'\s]+$/u, "").replace(/^["'{\s]+/u, ""))
    .replace(/\bthe martyrdom of\b/gi, "the killing of")
    .replace(/\bmartyrdom\b/gi, "death")
    .replace(/\bmartyred\b/gi, "killed")
    .replace(/\bmartyrs\b/gi, "those killed")
    .replace(/\bmartyr\b/gi, "person killed")
    .replace(/\b(Israeli citizens), soldiers,? and Israeli citizens\b/gi, "$1 and soldiers");
}

/** The briefs for both areas: the kinds from the last hours' summary, the day from the day's; the earlier ones where a model gave none. */
export async function writeBriefs(recent: AreaSummary[], day: AreaSummary[], prev: Briefs | null, now = Date.now()): Promise<Briefs> {
  const out: Briefs = { at: new Date(now).toISOString(), areas: { ...(prev?.areas ?? {}) }, day: { ...(prev?.day ?? {}) } };
  for (const a of day) {
    const ps = (a.top as Listed[]).slice(0, 40);
    if (!ps.length) continue;
    const got = await askChain(`online-day ${a.area}`, DAY_SYSTEM, `Area: ${areaName(a.area)}\n\n${ps.map(line).join("\n")}`, {
      models: MODELS,
      timeoutMs: 60_000,
      accept: (j) => (typeof j.day === "string" ? null : "no day"),
    });
    if (got) out.day![a.area] = cleanBrief(String(got.json.day)).slice(0, 900);
  }
  for (const a of recent) {
    const top = a.top as Listed[];
    const kinds = VOICES.filter((v) => top.some((p) => (p.k ?? []).includes(v.id)));
    if (!kinds.length) continue;
    const user = kinds.map((v) => `## ${v.id} (${v.name})\n${top.filter((p) => (p.k ?? []).includes(v.id)).slice(0, PER_VOICE).map(line).join("\n")}`).join("\n\n");
    const got = await askChain(`online-brief ${a.area}`, KINDS_SYSTEM, `Area: ${areaName(a.area)}\n\n${user}`, {
      models: MODELS,
      timeoutMs: 60_000,
      accept: (j) => (kinds.some((v) => typeof j[v.id] === "string") ? null : "no briefs"),
    });
    if (!got) continue;
    const briefs: Record<string, string> = {};
    for (const v of kinds) if (typeof got.json[v.id] === "string" && String(got.json[v.id]).trim()) briefs[v.id] = cleanBrief(String(got.json[v.id])).slice(0, 600);
    out.areas[a.area] = briefs;
  }
  return out;
}
