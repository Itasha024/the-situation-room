/**
 * The Trump feed's reader (Round 30 stage 5). Server-only.
 *
 * Every Iran cycle (5 minutes) it reads trumpstruth.org's feed of his Truth
 * Social posts, and every 10 minutes Rapid Response 47's clips of his words
 * on camera, and keeps the statements on Iran and the war (desk/trump.ts). A
 * source that does not answer leaves the list as it was, and says so.
 *
 * His words told anywhere else (an interview, a rally, remarks to reporters)
 * reach it through the Iran scan's queue of reports of his words
 * (desk/trump-said.ts): each is matched to where he said it, and the entry is
 * written from the transcript or the American reports of it (16 Oct).
 */
import { deskById } from "./desks.ts";
import type { getStore } from "./desk/store.ts";
import { type ChainModel, askChain } from "./desk/models.ts";
import { TRUMP_KEY, TRUMP_SYSTEM, type TrumpFeed, type TrumpStatement, checkWritten, clipStatement, clipWords, desksOf, mergeStatements, parseTruthFeed, withoutSignOff } from "./desk/trump.ts";
import { fetchText, fxPage, parseFxStatuses } from "./yemen-scan.server.ts";
import {
  type DayAppearance,
  type FactbaseEntry,
  type SaidItem,
  type SearchDeps,
  SAID_QUEUE,
  SAID_WAIT_MS,
  appearanceId,
  addFactbase,
  appearancesNear,
  factbaseLabel,
  factbaseTime,
  factbaseWords,
  findTrumpWords,
  parseFactbaseList,
  inColumn,
  iranParts,
  mergeQueue,
  sibling,
  tellingKeys,
  whereSaid,
} from "./desk/trump-said.ts";
import { resolveGoogleNews, searchGoogleNews } from "./desk/gnews.ts";
import { parseTruthFeed as truthPosts } from "./desk/originals.ts";
import { recentReads } from "./desk/recent-reads.ts";
import { iranLeanOf } from "./desk/iran-sources.ts";

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
    const what = s.source === "Truth Social" ? "His Truth Social post" : s.id.startsWith("fb-") ? `What he said (${s.source}), from the transcript` : s.id.startsWith("ap-") ? `What he said (${s.source}), from the transcript or the reports of it` : "His words on camera";
    const got = await askChain("trump", TRUMP_SYSTEM, `${what}:

${words}`, { temperature: 0.2, models: TRUMP_MODELS, timeoutMs: 60_000 }).catch(() => null);
    const card = got && checkWritten(got.json);
    if (!card) { s.tries = (s.tries ?? 0) + 1; continue; }
    if (card.off) s.off = true;
    else { s.headline = card.headline; if (card.body) s.body = card.body; else delete s.body; }
    wrote++;
  }
  return wrote;
}

/** A page's words, its markup taken out ("" when it does not open). */
async function pageWords(url: string, ms = 30_000): Promise<string> {
  const html = await fetchText(url, ms);
  return html ? html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[#a-z0-9]+;/gi, " ").replace(/\s+/g, " ") : "";
}

const SAID_DEPS: SearchDeps = {
  reads: () => recentReads(),
  truth: async () => {
    const xml = await fetchText("https://www.trumpstruth.org/feed", 12_000);
    return xml ? truthPosts(xml) : [];
  },
  search: (q) => searchGoogleNews(q, "en"),
  resolve: (link) => resolveGoogleNews(link),
  page: pageWords,
  usLean: (name) => iranLeanOf(name) === "us",
  factbase: () => factbaseNow,
};

/**
 * Where he spoke, from Factbase's own list (17 Oct): every rally, gaggle,
 * interview and speech, each with its transcript a few hours after. Read
 * every fifteen minutes; an appearance's transcript is read again for three
 * hours after it is listed, as it is filled in, then kept.
 */
const FB_KEY = "trump:factbase";
const FB_LIST = "https://rollcall.com/wp-json/factbase/v1/search?q=&media=&type=&sort=date&location=all&place=all&page=1&format=json";
const FB_EVERY_MS = 15 * 60_000 - 20_000;
/** Older appearances were put in the column by hand (16 Oct). */
const FB_FROM = Date.parse("2026-10-16T00:00:00-04:00");
const FB_PER_RUN = 4;
type FbState = { at: number; entries: FactbaseEntry[]; seen: Record<string, { first: number; tries: number; done?: boolean }> };
let factbaseNow: FactbaseEntry[] = [];

export async function readFactbase(store: Store, now = Date.now()): Promise<FactbaseEntry[]> {
  const st: FbState = (await store.getJson<FbState>(FB_KEY)) ?? { at: 0, entries: [], seen: {} };
  if (now - st.at < FB_EVERY_MS) return st.entries;
  st.at = now;
  const raw = await fetchText(FB_LIST, 30_000);
  let list: ReturnType<typeof parseFactbaseList> = [];
  try {
    list = raw ? parseFactbaseList(JSON.parse(raw)) : [];
  } catch {
    list = [];
  }
  if (!list.length) console.log("[trump] Factbase's list did not answer");
  let read = 0;
  for (const r of list) {
    const day = Date.parse(`${r.date}T00:00:00-04:00`);
    if (!(day >= FB_FROM) || now - day > 4 * 86400_000) continue;
    const s = (st.seen[r.slug] ??= { first: now, tries: 0 });
    if (s.done || read >= FB_PER_RUN) continue;
    read += 1;
    s.tries += 1;
    const words = factbaseWords(await pageWords(r.url, 45_000), true);
    if (!words) {
      if (s.tries >= 16) s.done = true;
      continue;
    }
    if (now - s.first >= 3 * 3600_000) s.done = true;
    const entry: FactbaseEntry = { ...factbaseLabel(r), slug: r.slug, title: r.title, url: r.url, at: factbaseTime(r, s.first), text: iranParts(words) };
    st.entries = [...st.entries.filter((e) => e.slug !== r.slug), entry];
  }
  st.entries = st.entries.filter((e) => now - e.at < 5 * 86400_000);
  for (const [k, v] of Object.entries(st.seen)) if (now - v.first > 6 * 86400_000) delete st.seen[k];
  await store.putJson(FB_KEY, st);
  if (read) console.log(`[trump] Factbase: ${read} transcript(s) read, ${st.entries.filter((e) => e.text).length} with his words on Iran or Yemen`);
  return st.entries;
}


/** Where he spoke lately, looked up once in twenty minutes. */
let lately: { at: number; list: DayAppearance[] } | null = null;
const LATELY_MS = 20 * 60_000;
/** Reports of his words settled per run: each may cost a few searches. */
const SAID_PER_RUN = 6;

/** The entry for an appearance: its transcript's Iran parts, else what the American reports of it say. */
async function appearanceEntry(app: DayAppearance): Promise<TrumpStatement | null> {
  const at = Math.min(...app.items.map((i) => i.at));
  let text = app.transcript?.text ?? "";
  let url = app.transcript?.url ?? "";
  if (!text) {
    const parts: string[] = [];
    for (const i of app.items.slice(0, 4)) {
      const real = i.url.includes("news.google.com") ? await resolveGoogleNews(i.url).catch(() => "") : i.url;
      const words = real ? iranParts(await pageWords(real), 3000) : "";
      if (words.length > 150) {
        parts.push(`${i.title}\n${words}`);
        url ||= real;
      }
    }
    text = parts.join("\n\n").slice(0, 9000);
  }
  if (!text) text = app.items.map((i) => i.title).join("\n");
  if (!url) return null;
  return { id: appearanceId(app, at), at: new Date(at).toISOString(), text, url, source: app.label };
}

/** Factbase gives an appearance's day only: the first report of his words there dates it. */
function earliest(s: TrumpStatement, at: string) {
  if (s.id.startsWith("fb-") && Date.parse(at) < Date.parse(s.at) && Date.parse(s.at) - Date.parse(at) < 20 * 3600_000) s.at = new Date(Date.parse(at)).toISOString();
}

/**
 * The queue of reports of his words, settled: each matched to where he said
 * it and written into the column from there, or found already in it, or left
 * waiting; after three hours with no source of his words it is set aside,
 * never published from the relay.
 */
export async function settleSaid(store: Store, statements: TrumpStatement[], now = Date.now()): Promise<number> {
  const queue = (await store.getJson<SaidItem[]>(SAID_QUEUE)) ?? [];
  const open = queue.filter((x) => !x.done).slice(0, SAID_PER_RUN);
  if (!open.length) return 0;
  if (!lately || now - lately.at > LATELY_MS) lately = { at: now, list: await appearancesNear(now, SAID_DEPS, 40 * 3600_000).catch(() => []) };
  let added = 0;
  for (const it of open) {
    it.tries += 1;
    const story = `${it.summary}\n${it.text ?? ""}`;
    const had = inColumn(statements, tellingKeys(story), story, Date.parse(it.at));
    if (had) {
      it.done = "already";
      it.statementId = had.id;
      earliest(had, it.at);
      continue;
    }
    const { found } = await findTrumpWords(it, SAID_DEPS).catch(() => ({ found: [] }));
    const sib = sibling(it, queue);
    const sibApp = sib ? lately.list.find((a) => a.label === sib) : undefined;
    const w = sibApp ? { label: sibApp.label, app: sibApp, words: found } : whereSaid(it, lately.list, found);
    if (!w) {
      if (now - it.firstAt > SAID_WAIT_MS) it.done = "not-found";
      continue;
    }
    it.label = w.label;
    if ("byTime" in w && w.byTime) it.byTime = true;
    if (w.label === "Truth Social") {
      it.done = "truth";
      continue;
    }
    const entry = w.app
      ? await appearanceEntry(w.app)
      : { id: `ap-${w.words[0].url.replace(/[^a-z0-9]+/gi, "-").slice(-60)}`, at: new Date(w.words[0].at).toISOString(), text: w.words.map((f) => f.text).join("\n\n"), url: w.words[0].url, source: w.words[0].source };
    if (!entry) continue;
    // The appearance's transcript is in the column already: that entry is his words.
    const fb = statements.find((s) => s.id.startsWith("fb-") && s.source === entry.source && Math.abs(Date.parse(s.at) - Date.parse(entry.at)) < 20 * 3600_000);
    if (fb) {
      it.done = "already";
      it.statementId = fb.id;
      earliest(fb, it.at);
      continue;
    }
    entry.desks = desksOf(entry.text);
    it.statementId = entry.id;
    it.done = "column";
    if (statements.some((s) => s.id === entry.id)) continue;
    statements.push(entry);
    added += 1;
  }
  // The scan may have queued more reports meanwhile: they are kept.
  await store.putJson(SAID_QUEUE, mergeQueue((await store.getJson<SaidItem[]>(SAID_QUEUE)) ?? [], open));
  const counts = open.reduce<Record<string, number>>((m, x) => ((m[x.done ?? "waiting"] = (m[x.done ?? "waiting"] ?? 0) + 1), m), {});
  console.log(`[trump] reports of his words: ${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ")}`);
  return added;
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
  factbaseNow = await readFactbase(store, now).catch((err) => (console.error("[trump] Factbase:", err instanceof Error ? err.message : err), factbaseNow));
  const spoke = addFactbase(statements, factbaseNow);
  if (spoke) console.log(`[trump] ${spoke} entr${spoke === 1 ? "y" : "ies"} from Factbase's transcripts`);
  const heard =await settleSaid(store, statements, now).catch((err) => (console.error("[trump] reports of his words:", err instanceof Error ? err.message : err), 0));
  statements.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id));
  const added = statements.filter((s) => !had.has(s.id)).length;
  if (heard) console.log(`[trump] ${heard} entr${heard === 1 ? "y" : "ies"} from his interviews, rallies and remarks`);
  await writeStatements(statements);
  await store.putJson(TRUMP_KEY, { statements, checkedAt: new Date(now).toISOString(), down } satisfies TrumpFeed);
  if (added || down.length) console.log(`[trump] ${added} new statement(s)${down.length ? `; not answering: ${down.join(", ")}` : ""}`);
  return added;
}
