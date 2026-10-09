/**
 * The Trump feed's reader (Round 30 stage 5). Server-only.
 *
 * Every Iran cycle (5 minutes) it reads trumpstruth.org's feed of his Truth
 * Social posts, and every 10 minutes Rapid Response 47's clips of his words
 * on camera, and keeps the statements on Iran and the war (desk/trump.ts). A
 * source that does not answer leaves the list as it was, and says so.
 */
import { deskById } from "./desks.ts";
import type { getStore } from "./desk/store.ts";
import { type ChainModel, askChain } from "./desk/models.ts";
import { TRUMP_KEY, TRUMP_SYSTEM, type TrumpFeed, type TrumpStatement, checkWritten, clipStatement, clipWords, mergeStatements, parseTruthFeed, withoutSignOff } from "./desk/trump.ts";
import { fetchText, fxPage, parseFxStatuses } from "./yemen-scan.server.ts";

type Store = Awaited<ReturnType<typeof getStore>>;
const CLIPS_EVERY_MS = 10 * 60_000 - 20_000;
const CLIPS_AT_KEY = "trump:clips-at";

export async function readTruthSocial(): Promise<TrumpStatement[] | null> {
  const xml = await fetchText("https://www.trumpstruth.org/feed", 12_000);
  return xml && /<item[\s>]/i.test(xml) ? parseTruthFeed(xml) : null;
}

export async function readClips(): Promise<TrumpStatement[] | null> {
  const page = (await fxPage("RapidResponse47")) ?? (await fxPage("RapidResponse47"));
  if (!page) return null;
  const posts = parseFxStatuses(page, { handle: "RapidResponse47", name: "Rapid Response 47", lean: "intl", cadence: { everyMin: 10 } });
  return posts.map((p) => clipStatement(p)).filter((s): s is TrumpStatement => !!s);
}

/** NVIDIA and Groq first: a few calls a day, kept off the Gemini quota the readers need. */
const TRUMP_MODELS: ChainModel[] = [
  { provider: "nvidia", id: "nvidia/nemotron-3-super-120b-a12b" },
  { provider: "nvidia", id: "nvidia/nemotron-3-ultra-550b-a55b" },
  { provider: "groq", id: "openai/gpt-oss-120b" },
  { provider: "openrouter", id: "openai/gpt-oss-120b:free" },
  { provider: "gemini", id: "gemini-3.5-flash-lite" },
];

/** Each new statement's headline and body (9 Oct): his main points in his voice, only the relevant parts below. */
export async function writeStatements(list: TrumpStatement[], most = 4): Promise<number> {
  let wrote = 0;
  for (const s of list.filter((x) => !x.headline && !x.off && (x.tries ?? 0) < 3).slice(0, most)) {
    const words = s.id.startsWith("rr-") ? clipWords(s.text) : withoutSignOff(s.text);
    const got = await askChain("trump", TRUMP_SYSTEM, `${s.source === "Truth Social" ? "His Truth Social post" : "His words on camera"}:

${words}`, { temperature: 0.2, models: TRUMP_MODELS, timeoutMs: 60_000 }).catch(() => null);
    const card = got && checkWritten(got.json);
    if (!card) { s.tries = (s.tries ?? 0) + 1; continue; }
    if (card.off) s.off = true;
    else { s.headline = card.headline; if (card.body) s.body = card.body; else delete s.body; }
    wrote++;
  }
  return wrote;
}

/** One read of both sources into the stored list. Returns how many statements are new. */
export async function scanTrump(store: Store, now = Date.now()): Promise<number> {
  const feed: TrumpFeed = (await store.getJson<TrumpFeed>(TRUMP_KEY)) ?? { statements: [] };
  const clipsDue = now - ((await store.getJson<number>(CLIPS_AT_KEY)) ?? 0) >= CLIPS_EVERY_MS;
  const [truth, clips] = await Promise.all([readTruthSocial().catch(() => null), clipsDue ? readClips().catch(() => null) : Promise.resolve([] as TrumpStatement[])]);
  if (clipsDue) await store.putJson(CLIPS_AT_KEY, now);
  const down = [...(truth ? [] : ["Truth Social"]), ...(clips ? [] : ["Rapid Response 47"])];
  const had = new Set(feed.statements.map((s) => s.id));
  const statements = mergeStatements(feed.statements, [...(truth ?? []), ...(clips ?? [])], deskById("iran").feedFrom ?? "2026-10-08T00:00:00+03:00");
  const added = statements.filter((s) => !had.has(s.id)).length;
  await writeStatements(statements);
  await store.putJson(TRUMP_KEY, { statements, checkedAt: new Date(now).toISOString(), down } satisfies TrumpFeed);
  if (added || down.length) console.log(`[trump] ${added} new statement(s)${down.length ? `; not answering: ${down.join(", ")}` : ""}`);
  return added;
}
