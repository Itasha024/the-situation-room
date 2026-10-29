/**
 * The Gaza – Judea & Samaria desk's scan (user, 23 Oct). Server-only.
 *
 * A third desk is its sources, its gate and its reader (site-scan.server.ts). The site scan reads this
 * desk's own sources (gaza-sources.ts) into its inbox (GAZA_INBOX); the other desks' sources hand over
 * what of theirs is about Gaza or Judea and Samaria (the Israeli outlets and the IDF from the Iran scan,
 * the Arab channels and sites from the Yemen scan). This cycle reads the inbox through the desk's reader
 * (gaza-reader.ts); its cards are this desk's alone ("gz-…", desks ["gaza"]). It runs on its own clock
 * and lock, and reads with the free services the other desks use least.
 */
import { fillThinCards } from "./desk/thin-cards.ts";
import { gazaLeadBonus } from "./desk/gaza-sourcing.ts";
import { refreshGazaBrief } from "./desk/gaza-brief.ts";
import { refreshAllBrief } from "./desk/all-brief.ts";
import { refreshGazaNumbers } from "./desk/gaza-live.ts";
import { refreshIdfArea } from "./gaza-line.server.ts";
import { GAZA_SEARCHES, GAZA_TG, GAZA_X, WAFA_SITE } from "./desk/gaza-sources.ts";
import { hearable, listenToVideos } from "./desk/listen.ts";
import { runGateAudit, setYemenGate } from "./desk/gate-audit.ts";
import { refreshDueExplainers } from "./desk/explain-live.ts";
import { isGazaDeskItem, passesGazaOwnGate } from "./desk/gaza-reader.ts";
import { type Candidate, GAZA_READER, editCandidates } from "./desk/editor.ts";
import { getStore } from "./desk/store.ts";
import { gazaPlaceFromWords } from "./desk/gaza-places.ts";
import { remember } from "./desk/recent-reads.ts";
import { combineSystem } from "./desk/combine.ts";
import { isExclusive } from "./desk/exclusive.ts";
import { exclusiveUrl } from "./desk/copy-rules.ts";
import { canResolve, cleanUrl, isGnews, knownResolve, outletFromHost, resolvesLeft } from "./desk/gnews.ts";
import { bingLeft } from "./desk/bing.ts";
import { articleLink, isPostUrl, ownStory, unshorten } from "./desk/full-text.ts";
import { LIVE_BLOG } from "./desk/origin.ts";
import type { LiveReport, RawScanHit, ScanPayload, SourceStatus } from "./desk/types.ts";
import { type DeskPipe, shapeCards, GAZA_INBOX, GAZA_PAYLOAD, type RawHit, articleOf, extractLead, fetchText, fpOf, jerusalemIso, WAR_ONLY } from "./yemen-scan.server.ts";
import { type IranState, openArticle, readFeed, readTg, readX } from "./iran-scan.server.ts";

const STATE_KEY = "gaza:scan-state";
/** How far the site scan has read each of this desk's sources, apart from what the reader has read. */
const FETCH_STATE_KEY = "gaza:fetch-state";
export const GAZA_TICK_USAGE_KEY = "gaza:tick-usage";

type GazaState = IranState;
type FetchState = Pick<GazaState, "lastScanAt" | "lastTgPost" | "lastXPost"> & {
  /** A site's stories already listed (WAFA's front page): url → when first seen. */
  web?: Record<string, number>;
};
/** A row of the inbox: `own` rows are this desk's sources with their status; the rest come from the other desks' sources. */
export type GazaInboxRow = { hits: RawHit[]; status?: SourceStatus[]; own?: boolean };

/** The desk counts from the day it began reading (desks.ts): nothing older is read. */
const MAX_AGE_MS = 24 * 3600_000;
const SEEN_KEEP_MS = 3 * 24 * 3600_000;
const LEADS_PER_TICK = 24;
const POST_LINKS_PER_TICK = 6;
/** Articles a tick whose page refused the server, read from MSN's copy or the reading service. */
const BLOCKED_PER_TICK = 6;
const GNEWS_PER_TICK = 2;
const PENDING_MAX = 80;
const PAYLOAD_REPORTS = 300;
const RAW_HITS = 200;
const RAW_HITS_MS = 3 * 3600_000;
/** Sources read at once: the small server times out with more (22 Oct). */
const SOURCES_AT_ONCE = 8;

const due = (state: FetchState, id: string, everyMin: number, now: number) => now - (state.lastScanAt[id] ?? 0) >= everyMin * 60_000 - 20_000;

/** The desk's keys for the steps every desk shares (yemen-scan's shapeCards). */
export const GAZA_PIPE: DeskPipe = {
  desk: "gaza",
  queueKey: GAZA_READER.queueKey,
  originCacheKey: "gaza:origin-cache-v1",
  combineSystem: combineSystem("Gaza and Judea and Samaria", '("the IDF said", "Hamas said")'),
  war: "Gaza and Judea and Samaria",
  visionKey: "gaza:media-vision",
  leadBonus: gazaLeadBonus,
  combineModels: [
    { provider: "nvidia", id: "nvidia/nemotron-3-ultra-550b-a55b" },
    { provider: "openrouter", id: "openai/gpt-oss-120b:free" },
  ],
  linkModels: [
    { provider: "nvidia", id: "nvidia/nemotron-3-ultra-550b-a55b" },
    { provider: "openrouter", id: "openai/gpt-oss-120b:free" },
  ],
  traceShare: 0.2,
};

/** This desk's own sources, each on its own clock, and what of theirs passes its gate. */
/**
 * WAFA's own site (user, 23 Oct): its front page's stories, each once, by title; the cycle opens each article.
 * The links are "/news/2026/10/23/<title>", the day in the address.
 */
async function readWafa(state: FetchState, now: number): Promise<{ rows: RawHit[]; ok: boolean }> {
  const html = await fetchText(WAFA_SITE, 15_000);
  if (!html) return { rows: [], ok: false };
  const seen = (state.web ??= {});
  for (const [u, t] of Object.entries(seen)) if (now - t > 3 * 24 * 3600_000) delete seen[u];
  const rows: RawHit[] = [];
  const at = jerusalemIso(new Date(now));
  for (const m of html.matchAll(/href="(\/news\/(\d{4})\/(\d{2})\/(\d{2})\/[^"]+)"[^>]*>([^<]{12,300})</g)) {
    const url = new URL(m[1], WAFA_SITE).toString();
    const title = m[5].replace(/&#xA0;|&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
    // Today's and yesterday's only; each once.
    if (seen[url] || now - Date.parse(`${m[2]}-${m[3]}-${m[4]}T12:00:00+03:00`) > 36 * 3600_000) continue;
    seen[url] = now;
    rows.push({ source: "WAFA", url, title, text: title, at, lean: "pa", fromTg: false });
  }
  return { rows, ok: true };
}

export async function fetchGazaSources(state: FetchState, now: number): Promise<{ hits: RawHit[]; status: SourceStatus[]; all: RawHit[] }> {
  const gState = { seen: {}, ...state } as GazaState;
  const status: SourceStatus[] = [];
  const own: RawHit[] = [];
  const jobs: (() => Promise<void>)[] = [];
  const run = (id: string, name: string, kind: SourceStatus["kind"], every: number, read: () => Promise<{ rows: RawHit[]; ok: boolean }>) => {
    if (!due(state, id, every, now)) return;
    jobs.push(async () => {
      let res = { rows: [] as RawHit[], ok: false };
      try {
        res = await read();
      } catch {
        // Unread this tick; the status says so.
      }
      state.lastScanAt[id] = Date.now();
      own.push(...res.rows);
      status.push({ id, name, kind, ok: res.ok, cadence: every >= 60 ? "hourly" : `every ${every} min`, hits: res.rows.length });
    });
  };
  for (const s of GAZA_TG) run(`tg:${s.id}`, s.name, "tg", s.every, () => readTg(s, gState, now));
  for (const s of GAZA_X) run(`x:${s.id}`, s.name, "x", s.every, () => readX(s, gState, now));
  for (const f of GAZA_SEARCHES) run(`web:${f.id}`, f.name, "web", f.every, () => readFeed(f));
  run("web:wafa", "WAFA (site)", "web", 10, () => readWafa(state, now));
  let next = 0;
  await Promise.allSettled(
    Array.from({ length: SOURCES_AT_ONCE }, async () => {
      while (next < jobs.length) await jobs[next++]();
    }),
  );
  remember(own);
  // `all`: every item read, for the other desks' gates (user, 23 Oct: one pool of sources).
  return { hits: own.filter((h) => passesGazaOwnGate(`${h.title ?? ""} ${h.text}`)), status, all: own };
}

/** The site scan's part for this desk: its own sources read, into its inbox. */
export async function scanGazaSources(store: Awaited<ReturnType<typeof getStore>>, now: number): Promise<{ n: number; all: RawHit[] }> {
  const state: FetchState = { lastScanAt: {}, lastTgPost: {}, lastXPost: {}, ...((await store.getJson<FetchState>(FETCH_STATE_KEY)) ?? {}) };
  const { hits, status, all } = await fetchGazaSources(state, now);
  await store.putMany(GAZA_INBOX, { [`own-${now}`]: { hits, status, own: true } satisfies GazaInboxRow });
  await store.putJson(FETCH_STATE_KEY, { lastScanAt: state.lastScanAt, lastTgPost: state.lastTgPost, lastXPost: state.lastXPost, web: state.web });
  return { n: hits.length, all };
}

/** Another desk's items about Gaza or Judea and Samaria, handed to this desk's inbox. */
export async function toGaza(store: Awaited<ReturnType<typeof getStore>>, rows: RawHit[], from: string): Promise<number> {
  const mine = rows.filter((h) => isGazaDeskItem(`${h.title ?? ""} ${h.text}`)).map((h) => ({ ...h, picked: undefined }));
  if (mine.length) await store.putMany(GAZA_INBOX, { [`${from}-${Date.now()}`]: { hits: mine } satisfies GazaInboxRow });
  return mine.length;
}

export type GazaTickResult = { ok: boolean; scannedAt: string; sourcesTried: number; fromInbox: number; candidates: number; reportsAdded: number; note: string; tookMs: number; error?: string };

/** The desk's cycle: its inbox through its reader, into cards. */
export async function runGazaCycle(): Promise<GazaTickResult> {
  const started = Date.now();
  const now = started;
  const store = await getStore();
  const state: GazaState = { lastScanAt: {}, lastTgPost: {}, lastXPost: {}, seen: {}, ...((await store.getJson<GazaState>(STATE_KEY)) ?? {}) };
  const prev = await store.getJson<ScanPayload>(GAZA_PAYLOAD);
  const dropped = (await store.getJson<Record<string, number>>("dropped")) ?? {};
  if (prev && Array.isArray(prev.reports)) prev.reports = prev.reports.filter((r) => !(r.fp in dropped));
  const seenAt = jerusalemIso(new Date(now));

  // 1. The inbox: this desk's own sources (read by the site scan) and the other desks' handed over.
  let status: SourceStatus[] = [];
  const own: RawHit[] = [];
  const inbox: RawHit[] = [];
  try {
    for (const row of await store.takeMany<GazaInboxRow>(GAZA_INBOX)) {
      if (row.own) {
        own.push(...row.hits);
        for (const st of row.status ?? []) status = [...status.filter((x) => x.id !== st.id), st];
      } else inbox.push(...row.hits);
    }
  } catch (err) {
    console.error("[gaza] inbox:", err instanceof Error ? err.message : err);
  }

  // 2. New and recent, once each.
  for (const [u, t] of Object.entries(state.seen)) if (now - t > SEEN_KEEP_MS) delete state.seen[u];
  const byUrl = new Map<string, RawHit>();
  for (const h of [...own, ...inbox, ...(state.pending ?? [])]) {
    const t = Date.parse(h.at);
    if (state.seen[h.url] || (Number.isFinite(t) && now - t > MAX_AGE_MS)) continue;
    if (LIVE_BLOG.test(h.url)) continue;
    if (Number.isFinite(t) && t > now + 10 * 60_000) h.at = seenAt;
    const had = byUrl.get(h.url);
    if (!had || h.text.length > had.text.length) byUrl.set(h.url, h);
  }
  const hits = [...byUrl.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // 3. A teaser is not enough to read: articles opened, Google's links resolved within the shared budget.
  let opened = 0;
  const gnBudget = Math.min(GNEWS_PER_TICK, canResolve("lead") ? resolvesLeft() : bingLeft());
  // The few look-ups go to the links whose headline is this desk's first (user, 24 Oct: the Arab sites' stories
  // waited behind everything else Google listed and aged out unread).
  const toResolve = new Set(
    hits
      .filter((h) => isGnews(h.url) && !knownResolve(h.url))
      .sort((a, b) => Number(!passesGazaOwnGate(a.text)) - Number(!passesGazaOwnGate(b.text)))
      .slice(0, gnBudget),
  );
  let blocked = BLOCKED_PER_TICK;
  await Promise.allSettled(
    hits
      .filter((h) => !h.fromTg && h.text.length < 600 && (!isGnews(h.url) || !!knownResolve(h.url) || toResolve.has(h)))
      .slice(0, LEADS_PER_TICK)
      .map(async (h) => {
        if (isGnews(h.url)) {
          const real = await articleOf(h);
          if (!real) return;
          h.url = cleanUrl(real);
          if (h.source === "Google News") h.source = outletFromHost(h.url) || h.source;
        }
        const html = await fetchText(h.url, 6000);
        let lead = html ? extractLead(html) : "";
        // A page that refused the server (Al Arabiya, Erem, the Lebanese papers: Cloudflare) is read from MSN's
        // copy or the reading service, when it is this desk's.
        if (lead.length < 300 && passesGazaOwnGate(h.text) && blocked-- > 0) {
          const text = await openArticle(h.url, h.title || h.text.split("\n")[0], h.source, false);
          if (text.length > lead.length) lead = text;
        }
        if (lead.length > 80) h.text = `${h.text}\n${lead}`.slice(0, 8600);
        opened += 1;
      }),
  );
  // The article behind a post (user, 22 Oct: go to the link, not only the post's two sentences).
  const postOf = new Map<RawHit, string>();
  let links = POST_LINKS_PER_TICK;
  await Promise.allSettled(
    hits
      .filter((h) => isPostUrl(h.url) && h.text.length < 1500)
      .map(async (h) => {
        const link = articleLink(h.text);
        if (!link || links <= 0) return;
        links -= 1;
        const url = cleanUrl(await unshorten(link));
        if (isPostUrl(url) || !/^https?:\/\/[^/]+\/./.test(url)) return;
        const outlet = outletFromHost(url);
        const text = await openArticle(url, h.title || h.text.split("\n")[0], outlet);
        if (text.length < 300) return;
        h.text = `${h.text}\n\n[The linked article${outlet ? `, ${outlet}` : ""}]\n${text}`.slice(0, 8600);
        if (ownStory(url, outlet, h.source)) {
          postOf.set(h, h.url);
          h.url = url;
        }
        opened += 1;
      }),
  );
  const readable = hits.filter((h) => !isGnews(h.url));
  for (const h of readable) if (h.source === "Google News") h.source = outletFromHost(h.url) || h.source;
  state.pending = hits.filter((h) => isGnews(h.url)).slice(0, PENDING_MAX);

  // A video's spoken words join its post before the reader sees it (user, 23 Oct: many of the channels' reports are
  // videos, Jusoor's above all), within this desk's share of the free listening.
  try {
    const heard = await listenToVideos(store, readable, now, { worth: (h) => hearable(h) && passesGazaOwnGate(h.text), dayKey: "gaza:listen-day", daySeconds: 9000 });
    if (heard) console.log(`[gaza] [listen] ${heard} post(s) given their video's words`);
  } catch (err) {
    console.error("[gaza] [listen] failed:", err instanceof Error ? err.message : err);
  }

  // 4. The reader.
  const candidates: Candidate[] = readable.map((h) => ({ source: h.source, url: h.url, text: h.text, at: h.at, lean: h.lean, fp: `gz-${fpOf(h.url, h.text.slice(0, 80))}`, score: 1, tags: [] }));
  for (const h of readable) {
    state.seen[h.url] = now;
    const post = postOf.get(h);
    if (post) state.seen[post] = now;
  }
  const { verdicts, modelNote } = await editCandidates(store, candidates, now, GAZA_READER);

  // 5. Cards, by the steps every desk shares.
  const texts = new Map(readable.map((h) => [h.url, h]));
  const approved: LiveReport[] = [];
  for (const [url, v] of verdicts) {
    if (v.kind !== "publish") continue;
    const h = texts.get(url);
    if ((h && isExclusive(h.text, h.source)) || exclusiveUrl(url)) v.report.flags = [...new Set([...(v.report.flags ?? []), "exclusive"])];
    v.report.desks = ["gaza"];
    approved.push(v.report);
  }
  const { uniqReports, touched } = await shapeCards(GAZA_PIPE, approved, readable, prev, now);
  const before = new Set((prev?.reports ?? []).map((r) => r.fp));
  const cards = uniqReports.filter((r) => !before.has(r.fp));
  const folded = approved.length - cards.length;
  const merge = uniqReports.length || touched.length ? await store.mergeIntoDesk([...uniqReports.slice(0, PAYLOAD_REPORTS), ...touched]) : { reportsAdded: 0, eventsAdded: 0, unplaced: [] };
  try {
    const placed = await store.placeUnplaced?.("2026-10-23T00:00:00+03:00", gazaPlaceFromWords, "gaza");
    if (placed) console.log(`[gaza pins] ${placed} cards with no place given one from their headline`);
  } catch (err) {
    console.warn("[gaza pins] placing cards failed", err);
  }

  // 6. The scan box: what came in and what became of it.
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
  const statusAll = [...status, ...(prev?.sourceStatus ?? []).filter((s) => !status.some((x) => x.id === s.id))].sort((a, b) => a.name.localeCompare(b.name));
  const note = `${status.length} sources read, ${own.length} items from them, ${inbox.length} from the other desks' sources, ${candidates.length} new to read, ${opened} articles opened, ${cards.length} new cards, ${folded} copies folded.${modelNote ? ` Reader: ${modelNote}.` : ""}`;
  const payload: ScanPayload = {
    ok: true,
    scannedAt: seenAt,
    reports: uniqReports.slice(0, PAYLOAD_REPORTS),
    sourcesTried: statusAll.length,
    sourcesOk: statusAll.filter((s) => s.ok).length,
    rawHits: allHits,
    sourceStatus: statusAll,
    cycleNote: note,
  };
  await store.putJson(GAZA_PAYLOAD, payload);
  await store.putJson(STATE_KEY, state);
  const tookMs = Date.now() - started;
  try {
    const log = (await store.getJson<{ at: string; tookMs: number; cards: number; read: number }[]>(GAZA_TICK_USAGE_KEY)) ?? [];
    await store.putJson(GAZA_TICK_USAGE_KEY, [{ at: new Date().toISOString(), tookMs, cards: cards.length, read: candidates.length }, ...log].slice(0, 48));
  } catch {
    /* the meter must never cost the tick */
  }
  console.log(`[gaza] ${note} ${Math.round(tookMs / 1000)}s`);
  // The 3-hour brief, Gaza and Judea and Samaria apart (gaza-brief.ts); it must never cost the cycle.
  // Then every desk's points in one order of importance (all-brief.ts).
  void fillThinCards(store, "gaza").catch((err) => console.error("[thin-cards]", err instanceof Error ? err.message : err));
  void refreshGazaBrief(store).then(() => refreshAllBrief(store)).catch((err) => console.error("[gaza-brief]", err instanceof Error ? err.message : err));
  // The IDF-held area as the mapping projects publish it, every 6 hours (gaza-line.server.ts).
  void refreshIdfArea(store).catch((err) => console.error("[gaza-line]", err instanceof Error ? err.message : err));
  // The researched numbers kept current from the reports, every 6 hours, one model call (gaza-live.ts).
  void refreshGazaNumbers(store).catch((err) => console.error("[gaza-numbers]", err instanceof Error ? err.message : err));
  // The three desks' explainers, each checked once a week against the week's reports, one desk at a time (explain-live.ts).
  void refreshDueExplainers(store).catch((err) => console.error("[explain]", err instanceof Error ? err.message : err));
  // The gates' daily check, all three desks (gate-audit.ts): once a day, or now when asked (json:gate-audit-now).
  setYemenGate(WAR_ONLY);
  void (async () => {
    const asked = !!(await store.getJson<number>("gate-audit-now"));
    if (asked) await store.putJson("gate-audit-now", 0);
    await runGateAudit(store, Date.now(), asked);
  })().catch((err) => console.error("[gate-audit]", err instanceof Error ? err.message : err));
  return { ok: !merge.error, scannedAt: seenAt, sourcesTried: statusAll.length, fromInbox: inbox.length, candidates: candidates.length, reportsAdded: merge.reportsAdded, note, tookMs, ...(merge.error ? { error: merge.error } : {}) };
}

