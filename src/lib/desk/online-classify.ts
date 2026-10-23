/**
 * The Online watch's sorting by a model (user, 23 Oct: "anger at Hamas contains a message about the
 * traffic"): each post and comment read once by a free model, as news, a service notice or talk, and
 * talk by its kinds. The word lists only stand in until the model has read a post.
 */
import { askChain, type ChainModel } from "./models.ts";
import { VOICES, type WatchPost } from "./online-watch.ts";

const MODELS: ChainModel[] = [
  { provider: "nvidia", id: "nvidia/nemotron-3.5-lightning-30b-a3b" },
  { provider: "nvidia", id: "nvidia/nemotron-3-ultra-550b-a55b" },
];
export const CLASSIFY_BATCH = 40;
const KINDS = VOICES.filter((v) => v.id !== "other");

const SYSTEM = `You sort posts and comments from Palestinian Telegram channels (Gaza, Judea and Samaria) for a desk that watches what Palestinians SAY online, apart from the news.
For each numbered item give:
- "t": "news" for a report of events or of what someone said, told as news (strikes, raids, arrests, casualties, an army's or a government's statement, foreign news, Israeli media relayed); "service" for practical notices (road and checkpoint status, traffic, schedules, aid and gas lists, prices lists, job and study ads, contact details, weather); "talk" for what people or factions say as their own voice: calls, threats, praise, anger, complaints, grief, rumours, opinions, jokes, prayers, a comment.
- "k": for talk only, the kinds that fit (none, one or more): ${KINDS.map((v) => `"${v.id}" (${v.name})`).join(", ")}. "call" is a call on the public to act (protest, strike, mobilise, rise up); "threat" is a threat or a call to attack; "anger_hamas" only when the item blames or attacks Hamas or its rule; "anger_pa" only when it blames or attacks the Palestinian Authority; "complaint" is about daily life (food, prices, aid, shelter, power, water, cash).
A faction's own statement with a call, a threat or praise is talk, even when a channel relays it. When unsure between news and talk, choose news.
Answer JSON only: {"items": [{"i": <number>, "t": "news"|"service"|"talk", "k": [...]}]}.`;

/**
 * Text cut by characters, not code units, with any half of an emoji left by an earlier cut taken out:
 * a lone half made the request's JSON invalid and the model service refused it (HTTP 400, 23 Oct).
 */
export function cut(s: string, n: number): string {
  const whole = String(s || "").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "").replace(/\s+/g, " ");
  return Array.from(whole).slice(0, n).join("");
}

/** Reads a batch; marks each post it answered for (q), its type (r: 1 news or service) and its kinds (kv). */
export async function classifyBatch(posts: WatchPost[]): Promise<number> {
  if (!posts.length) return 0;
  const user = posts.map((p, i) => `${i}. [${p.c ? "comment" : "post"} @${p.ch}] ${cut(p.x, 280)}`).join("\n");
  const got = await askChain("online-sort", SYSTEM, user, { models: MODELS, timeoutMs: 75_000, temperature: 0, accept: (j) => (Array.isArray(j.items) ? null : "no items") });
  if (!got) return 0;
  const ids = new Set(KINDS.map((v) => v.id));
  let n = 0;
  for (const it of got.json.items as { i?: unknown; t?: unknown; k?: unknown }[]) {
    const p = posts[Number(it?.i)];
    if (!p || typeof it.t !== "string") continue;
    p.q = 1;
    p.r = it.t === "talk" ? 0 : 1;
    p.kv = p.r ? [] : (Array.isArray(it.k) ? it.k : []).map(String).filter((k) => ids.has(k));
    n += 1;
  }
  return n;
}
