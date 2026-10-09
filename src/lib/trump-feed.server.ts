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
import { TRUMP_KEY, type TrumpFeed, type TrumpStatement, clipStatement, mergeStatements, parseTruthFeed } from "./desk/trump.ts";
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
  await store.putJson(TRUMP_KEY, { statements, checkedAt: new Date(now).toISOString(), down } satisfies TrumpFeed);
  if (added || down.length) console.log(`[trump] ${added} new statement(s)${down.length ? `; not answering: ${down.join(", ")}` : ""}`);
  return added;
}
