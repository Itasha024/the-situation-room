/**
 * The Iran desk's scan (Round 30 stage 3b). Server-only.
 *
 * One scanner reads each source once. The Yemen scan reads the sources both
 * desks share and hands this one their items about Iran's war (its inbox,
 * IRAN_INBOX). This scan reads the Iran desk's own sources (iran-sources.ts),
 * adds the inbox, and sends the lot through the Iran reader (iran-reader.ts),
 * whose cards are the Iran desk's alone ("ir-…", desks ["iran"]).
 *
 * It runs on its own clock and its own lock, beside the Yemen tick, so the
 * Yemen desk's cycle is no longer than before. Its reader takes the other free
 * services before Gemini, and Gemini's lite models only while today's use of
 * them leaves the Yemen reader its share.
 */
import { IRAN_RSS, IRAN_TG, IRAN_X, type IranLean } from "./desk/iran-sources.ts";
import { passesIranOwnGate } from "./desk/iran-reader.ts";
import { type Candidate, IRAN_READER, USAGE_KEY, type Usage, editCandidates } from "./desk/editor.ts";
import { getStore } from "./desk/store.ts";
import { combineSystem } from "./desk/combine.ts";
import { isExclusive } from "./desk/exclusive.ts";
import { hearable, listenToVideos } from "./desk/listen.ts";
import { cleanUrl, isGnews, resolveGoogleNews } from "./desk/gnews.ts";
import type { LiveReport, RawScanHit, ScanPayload, SourceStatus } from "./desk/types.ts";
import {
  type DeskPipe,
  shapeCards,
  IRAN_INBOX,
  IRAN_PAYLOAD,
  type RawHit,
  extractLead,
  fetchText,
  fpOf,
  fxPage,
  gnews,
  jerusalemIso,
  newerX,
  newestTgPost,
  parseFxStatuses,
  parseRss,
  parseTelegram,
} from "./yemen-scan.server.ts";

const STATE_KEY = "iran:scan-state";
export const IRAN_TICK_USAGE_KEY = "iran:tick-usage";

type IranState = {
  lastScanAt: Record<string, number>;
  lastTgPost: Record<string, number>;
  lastXPost: Record<string, string>;
  /** url → when first seen: nothing is read twice. */
  seen: Record<string, number>;
  /** Google News items whose article address is still to be found: tried again next tick. */
  pending?: RawHit[];
};

type Feed = { id: string; url: string; name: string; lean: IranLean; every: number };

/**
 * The safety net: Google News searched each hour for the war's words, in
 * English, Arabic and Persian, and for the US officials who speak on it. They
 * catch what none of the sources carried.
 */
const SEARCHES: Feed[] = [
  { id: "gn-en", name: "Google News", lean: "intl", every: 60, url: gnews('(Iran OR Tehran OR IRGC OR Hormuz OR Hezbollah OR "Iraqi militia") when:1h') },
  { id: "gn-ar", name: "Google News", lean: "intl", every: 60, url: gnews("(إيران OR طهران OR الحرس الثوري OR هرمز OR حزب الله OR الحشد الشعبي) when:1h", "ar", "SA", "SA:ar") },
  { id: "gn-fa", name: "Google News", lean: "intl", every: 60, url: gnews("(ایران OR سپاه OR تنگه هرمز OR آمریکا) when:1h", "fa", "IR", "IR:fa") },
  {
    id: "gn-officials",
    name: "Google News",
    lean: "us",
    every: 60,
    url: gnews("(Trump OR Vance OR Rubio OR Hegseth OR Witkoff OR Leavitt OR CENTCOM OR Bessent) (Iran OR Hormuz OR Tehran) when:1h"),
  },
];

/** A day's items: what is older is not news, and is not read. */
const MAX_AGE_MS = 24 * 3600_000;
/** First sight of a source: only its last few hours. */
const FIRST_SIGHT_MS = 4 * 3600_000;
const SEEN_KEEP_MS = 3 * 24 * 3600_000;
/** Articles opened a tick (a teaser is not enough to read). */
const LEADS_PER_TICK = 15;
const GNEWS_PER_TICK = 10;
const PAYLOAD_REPORTS = 300;
const RAW_HITS = 200;
const RAW_HITS_MS = 3 * 3600_000;
/**
 * Gemini's lite models are the Yemen reader's first; the Iran reader uses them
 * only while today's calls on them stay under this, so Yemen keeps its share.
 */
const GEMINI_LITE_SHARE = 300;

const due = (state: IranState, id: string, everyMin: number, now: number) => now - (state.lastScanAt[id] ?? 0) >= everyMin * 60_000 - 20_000;

async function readTg(src: { id: string; name: string; lean: IranLean }, state: IranState, now: number): Promise<{ rows: RawHit[]; ok: boolean }> {
  const html = await fetchText(`https://t.me/s/${src.id}`);
  const ok = !!(html && html.includes("tgme_widget_message"));
  if (!ok) return { rows: [], ok };
  const seen = state.lastTgPost[src.id] ?? 0;
  const newest = newestTgPost(html as string, src.id);
  if (seen && newest <= seen) return { rows: [], ok };
  const rows = parseTelegram(html as string, { id: src.id, name: src.name, lean: "intl" })
    .filter((r) => {
      const n = Number(/\/(\d+)(?:#|$)/.exec(r.url)?.[1] ?? 0);
      return seen ? n > seen || !n : Date.parse(r.at) > now - FIRST_SIGHT_MS;
    })
    .map((r) => ({ ...r, lean: src.lean }));
  if (newest > 0) state.lastTgPost[src.id] = Math.max(seen, newest);
  return { rows, ok };
}

async function readX(src: { id: string; name: string; lean: IranLean }, state: IranState, now: number): Promise<{ rows: RawHit[]; ok: boolean }> {
  // FxTwitter answers some requests 404 and the next one right (8 Oct): one retry.
  const page = (await fxPage(src.id)) ?? (await fxPage(src.id));
  if (!page) return { rows: [], ok: false };
  const all = parseFxStatuses(page, { handle: src.id, name: src.name, lean: "intl", cadence: { everyMin: 15 } });
  const seen = state.lastXPost[src.id];
  const idOf = (r: RawHit) => /\/status\/(\d+)/.exec(r.url)?.[1] ?? "";
  const rows = all.filter((r) => newerX(idOf(r), seen) && (seen || Date.parse(r.at) > now - FIRST_SIGHT_MS)).map((r) => ({ ...r, lean: src.lean }));
  const newest = all.map(idOf).reduce((m, id) => (newerX(id, m || undefined) ? id : m), seen ?? "");
  if (newest) state.lastXPost[src.id] = newest;
  return { rows, ok: true };
}

async function readFeed(f: Feed): Promise<{ rows: RawHit[]; ok: boolean }> {
  const body = await fetchText(f.url, 10_000);
  const ok = !!(body && /<item[\s>]/i.test(body));
  return { rows: ok ? parseRss(body as string, f.name).map((r) => ({ ...r, lean: f.lean })) : [], ok };
}

/**
 * The Iran desk's own keys for the steps every desk shares (yemen-scan's
 * shapeCards): its queue, its relays waiting for their original, its count of
 * picture looks, and its war in the writer's and the picture check's prompts.
 */
export const IRAN_PIPE: DeskPipe = {
  desk: "iran",
  queueKey: IRAN_READER.queueKey,
  originCacheKey: "iran:origin-cache-v3",
  combineSystem: combineSystem("the war with Iran", '("the IRGC said", "the IDF said")'),
  war: "the war with Iran",
  visionKey: "iran:media-vision",
  // The Yemen desk's combining and link models are Gemini's lite ones and
  // Groq's: this desk asks NVIDIA and OpenRouter first, so their quotas last.
  combineModels: [
    { provider: "nvidia", id: "nvidia/nemotron-3-super-120b-a12b" },
    { provider: "nvidia", id: "nvidia/nemotron-3-ultra-550b-a55b" },
    { provider: "openrouter", id: "openai/gpt-oss-120b:free" },
  ],
  linkModels: [
    { provider: "nvidia", id: "nvidia/nemotron-3-super-120b-a12b" },
    { provider: "openrouter", id: "openai/gpt-oss-120b:free" },
  ],
  traceShare: 0.4,
};

export type IranTickResult = { ok: boolean; scannedAt: string; sourcesTried: number; sourcesOk: number; fromInbox: number; candidates: number; reportsAdded: number; note: string; tookMs: number; error?: string };

export async function runIranCycle(): Promise<IranTickResult> {
  const started = Date.now();
  const now = started;
  const store = await getStore();
  const state: IranState = { lastScanAt: {}, lastTgPost: {}, lastXPost: {}, seen: {}, ...((await store.getJson<IranState>(STATE_KEY)) ?? {}) };
  const prev = await store.getJson<ScanPayload>(IRAN_PAYLOAD);
  const seenAt = jerusalemIso(new Date(now));

  // 1. The Iran desk's own sources, each on its own clock.
  const status: SourceStatus[] = [];
  const own: RawHit[] = [];
  const jobs: Promise<void>[] = [];
  const run = (id: string, name: string, kind: SourceStatus["kind"], every: number, read: () => Promise<{ rows: RawHit[]; ok: boolean }>) => {
    if (!due(state, id, every, now)) return;
    jobs.push(
      (async () => {
        let res = { rows: [] as RawHit[], ok: false };
        try {
          res = await read();
        } catch {
          // Unread this tick; the status says so.
        }
        state.lastScanAt[id] = Date.now();
        own.push(...res.rows);
        status.push({ id, name, kind, ok: res.ok, cadence: every >= 60 ? "hourly" : `every ${every} min`, hits: res.rows.length });
      })(),
    );
  };
  for (const s of IRAN_TG) run(`tg:${s.id}`, s.name, "tg", s.every, () => readTg(s, state, now));
  for (const s of IRAN_X) run(`x:${s.id}`, s.name, "x", s.every, () => readX(s, state, now));
  for (const f of [...IRAN_RSS, ...SEARCHES]) run(`web:${f.id}`, f.name, "web", f.every, () => readFeed(f));
  await Promise.allSettled(jobs);

  // 2. What the Yemen scan handed over from the shared sources.
  let inbox: RawHit[] = [];
  try {
    inbox = (await store.takeMany<RawHit[]>(IRAN_INBOX)).flat();
  } catch (err) {
    console.error("[iran] inbox:", err instanceof Error ? err.message : err);
  }

  // 3. New, recent, and about this war: the Iran desk's own sources pass on
  //    the war's and the economy's words, the shared ones were gated already.
  for (const [u, t] of Object.entries(state.seen)) if (now - t > SEEN_KEEP_MS) delete state.seen[u];
  const byUrl = new Map<string, RawHit>();
  for (const h of [...own.filter((h) => passesIranOwnGate(`${h.title ?? ""} ${h.text}`)), ...inbox, ...(state.pending ?? [])]) {
    const t = Date.parse(h.at);
    if (state.seen[h.url] || (Number.isFinite(t) && now - t > MAX_AGE_MS)) continue;
    if (Number.isFinite(t) && t > now + 10 * 60_000) h.at = seenAt;
    const had = byUrl.get(h.url);
    if (!had || h.text.length > had.text.length) byUrl.set(h.url, h);
  }
  const hits = [...byUrl.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // 4. A teaser is not enough to read: the article is opened (Google's links
  //    resolved first), a few a tick, newest first.
  let opened = 0;
  let resolved = 0;
  await Promise.allSettled(
    hits
      .filter((h) => !h.fromTg && h.text.length < 600)
      .slice(0, LEADS_PER_TICK)
      .map(async (h) => {
        if (isGnews(h.url)) {
          if (resolved++ >= GNEWS_PER_TICK) return;
          const real = await resolveGoogleNews(h.url);
          if (!real) return;
          h.url = cleanUrl(real);
        }
        const html = await fetchText(h.url, 6000);
        const lead = html ? extractLead(html) : "";
        if (lead.length > 80) h.text = `${h.text}\n${lead}`.slice(0, 8600);
        opened += 1;
      }),
  );
  // A Google item still on Google's redirect waits for the next tick.
  const readable = hits.filter((h) => !isGnews(h.url));
  state.pending = hits.filter((h) => isGnews(h.url)).slice(0, 60);

  // 5. A video's spoken words join its post before the reader sees it, as on
  //    the Yemen desk; the Iran desk keeps its own half of the day's listening.
  try {
    const heard = await listenToVideos(store, readable, now, { worth: (h) => hearable(h) && passesIranOwnGate(h.text), dayKey: "iran:listen-day" });
    if (heard) console.log(`[iran] [listen] ${heard} post(s) given their video's words`);
  } catch (err) {
    console.error("[iran] [listen] failed:", err instanceof Error ? err.message : err);
  }

  // 6. The Iran reader.
  const candidates: Candidate[] = readable.map((h) => ({
    source: h.source,
    url: h.url,
    text: h.text,
    at: h.at,
    lean: h.lean,
    fp: `ir-${fpOf(h.url, h.text.slice(0, 80))}`,
    score: 1,
    tags: [],
  }));
  for (const h of readable) state.seen[h.url] = now;
  const usage = await store.getJson<Usage>(USAGE_KEY);
  const liteToday = Object.entries(usage?.calls ?? {})
    .filter(([m]) => IRAN_READER.models.includes(m))
    .reduce((n, [, c]) => n + c, 0);
  const cfg = liteToday >= GEMINI_LITE_SHARE ? { ...IRAN_READER, models: [] } : IRAN_READER;
  const { verdicts, modelNote } = await editCandidates(store, candidates, now, cfg);

  // 7. Cards, by the steps every desk shares: a relay traced to its original,
  //    copies of one story one card with "Also", the time a card first went
  //    out kept, pictures, follow-ups and later facts (user, 8 Oct).
  const texts = new Map(readable.map((h) => [h.url, h]));
  const approved: LiveReport[] = [];
  for (const [url, v] of verdicts) {
    if (v.kind !== "publish") continue;
    const h = texts.get(url);
    if (h && isExclusive(h.text, h.source)) v.report.flags = [...new Set([...(v.report.flags ?? []), "exclusive"])];
    v.report.desks = ["iran"];
    approved.push(v.report);
  }
  const { uniqReports, touched } = await shapeCards(IRAN_PIPE, approved, readable, prev, now);
  const before = new Set((prev?.reports ?? []).map((r) => r.fp));
  const cards = uniqReports.filter((r) => !before.has(r.fp));
  const folded = approved.length - cards.length;
  const merge = uniqReports.length || touched.length ? await store.mergeIntoDesk([...uniqReports.slice(0, PAYLOAD_REPORTS), ...touched]) : { reportsAdded: 0, eventsAdded: 0, unplaced: [] };

  // 7. The scan box: what came in and what became of it.
  const rawHits: RawScanHit[] = hits.map((h) => {
    const v = verdicts.get(h.url);
    const kept = v?.kind === "publish";
    return {
      source: h.source,
      url: h.url,
      snippet: h.text.replace(/\s+/g, " ").trim().slice(0, 280),
      at: h.at,
      seenAt,
      kind: h.fromTg ? "tg" : "web",
      kept,
      outcome: kept ? "feed" : v?.kind === "pending" || !v ? "tray" : "exclude",
      reachable: true,
      reason: kept ? "kept" : v?.kind === "reject" ? v.reason : "pending",
      note: v?.kind === "reject" || v?.kind === "pending" ? v.note : "",
    };
  });
  const keep = (r: { seenAt?: string; at: string }) => now - Date.parse(r.seenAt || r.at) <= RAW_HITS_MS;
  const allHits = [...rawHits, ...(prev?.rawHits ?? []).filter((h) => keep(h) && !byUrl.has(h.url))].filter(keep).slice(0, RAW_HITS);
  const reports = uniqReports.slice(0, PAYLOAD_REPORTS);
  const statusAll = [...status, ...(prev?.sourceStatus ?? []).filter((s) => !status.some((x) => x.id === s.id))].sort((a, b) => a.name.localeCompare(b.name));
  const note = `${status.length} sources read, ${inbox.length} items from the shared sources, ${candidates.length} new to read, ${opened} articles opened, ${cards.length} new cards, ${folded} copies folded.${modelNote ? ` Reader: ${modelNote}.` : ""}`;
  const payload: ScanPayload = {
    ok: true,
    scannedAt: seenAt,
    reports,
    sourcesTried: status.length,
    sourcesOk: status.filter((s) => s.ok).length,
    rawHits: allHits,
    sourceStatus: statusAll,
    cycleNote: note,
  };
  await store.putJson(IRAN_PAYLOAD, payload);
  await store.putJson(STATE_KEY, state);
  const tookMs = Date.now() - started;
  try {
    const log = (await store.getJson<{ at: string; tookMs: number; cards: number; read: number }[]>(IRAN_TICK_USAGE_KEY)) ?? [];
    await store.putJson(IRAN_TICK_USAGE_KEY, [{ at: new Date().toISOString(), tookMs, cards: cards.length, read: candidates.length }, ...log].slice(0, 48));
  } catch {
    /* the meter must never cost the tick */
  }
  console.log(`[iran] ${note} ${Math.round(tookMs / 1000)}s`);
  return {
    ok: !merge.error,
    scannedAt: seenAt,
    sourcesTried: status.length,
    sourcesOk: payload.sourcesOk,
    fromInbox: inbox.length,
    candidates: candidates.length,
    reportsAdded: merge.reportsAdded,
    note,
    tookMs,
    ...(merge.error ? { error: merge.error } : {}),
  };
}
