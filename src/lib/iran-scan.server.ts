/**
 * The Iran desk's scan (Round 30 stage 3b). Server-only.
 *
 * One scanner reads each source once (site-scan.server.ts). The site scan
 * reads the Iran desk's own sources (iran-sources.ts) and leaves what passes
 * this desk's gate in its inbox (IRAN_INBOX); the items about Iran's war from
 * the sources both desks share follow once the Yemen reader has read them.
 * This cycle reads the inbox and sends it through the Iran reader
 * (iran-reader.ts), whose cards are the Iran desk's alone ("ir-…", desks
 * ["iran"]). With the site scan off, it reads its own sources itself.
 *
 * It runs on its own clock and its own lock, beside the Yemen tick, so the
 * Yemen desk's cycle is no longer than before. Its reader takes the other free
 * services before Gemini, and Gemini's lite models only while today's use of
 * them leaves the Yemen reader its share.
 */
import { IRAN_RSS, IRAN_TG, IRAN_X, IRAQI_MEDIA, ISRAELI_MEDIA, LEBANESE_MEDIA, NNA_LATEST, type IranLean, nnaStory } from "./desk/iran-sources.ts";
import { isIranWar, passesIranOwnGate, passesIraqiMediaGate, passesIsraeliMediaGate, passesLebaneseMediaGate } from "./desk/iran-reader.ts";
import { type Candidate, IRAN_READER, USAGE_KEY, type Usage, editCandidates } from "./desk/editor.ts";
import { getStore } from "./desk/store.ts";
import { iranPlaceFromWords } from "./desk/iran-places.ts";
import { remember } from "./desk/recent-reads.ts";
import { combineSystem } from "./desk/combine.ts";
import { isExclusive } from "./desk/exclusive.ts";
import { exclusiveUrl } from "./desk/copy-rules.ts";
import { hearable, listenToVideos } from "./desk/listen.ts";
import { canResolve, cleanUrl, isGnews, knownResolve, outletFromHost, resolvesLeft } from "./desk/gnews.ts";
import { bingLeft } from "./desk/bing.ts";
import { articleLink, isPostUrl, msnCopy, ownStory, readerService, unshorten } from "./desk/full-text.ts";
import { LIVE_BLOG, articleText } from "./desk/origin.ts";
import type { LiveReport, RawScanHit, ScanPayload, SourceStatus } from "./desk/types.ts";
import { scanTrump } from "./trump-feed.server.ts";
import { SAID_QUEUE, type SaidItem, enqueueSaid, trumpSaid } from "./desk/trump-said.ts";
import { refreshIranBrief } from "./desk/iran-brief.ts";
import { refreshOfac } from "./desk/ofac.ts";
import { refreshIranLive, type NumbersFile } from "./desk/iran-live.ts";
import { refreshIranReports, refreshUkmto } from "./desk/iran-live-model.ts";
import IRAN_NUMBERS from "../../public/iran-numbers.json" with { type: "json" };
import {
  type DeskPipe,
  shapeCards,
  IRAN_INBOX,
  IRAN_PAYLOAD,
  type RawHit,
  articleOf,
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
  tgPostNo,
  ownPostNo,
  TG_MARK_SLACK,
  WAR_ONLY,
} from "./yemen-scan.server.ts";

const STATE_KEY = "iran:scan-state";
/**
 * Where the site scan keeps how far it has read each Iran source. Apart from
 * the reader's state (what it has read), since the two run on their own clocks
 * and would otherwise write over each other.
 */
const FETCH_STATE_KEY = "iran:fetch-state";
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

type FetchState = Pick<IranState, "lastScanAt" | "lastTgPost" | "lastXPost">;

/**
 * A row of the Iran inbox: items for this desk's reader. `own` rows come from
 * the Iran desk's own sources, read by the site scan, with their status; the
 * rest are the shared sources' items, handed on after the Yemen reader read
 * them. (Before 8 Oct a row was the bare list of items.)
 */
export type IranInboxRow = { hits: RawHit[]; status?: SourceStatus[]; own?: boolean };

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
const LEADS_PER_TICK = 40;
/** Posts a tick whose linked article is opened and read with them. */
const POST_LINKS_PER_TICK = 8;
/** Articles a tick whose page refused the server, read from MSN's copy or the reading service. */
const BLOCKED_PER_TICK = 4;

/**
 * An article's text: its own page; if that refuses the server, the outlet's
 * licensed copy on MSN; then the reading service (never for a paywalled site,
 * whose page there is its teaser too).
 */
async function openArticle(url: string, title: string, source: string, ownFirst = true): Promise<string> {
  let best = "";
  if (ownFirst) {
    const html = await fetchText(url, 8000);
    best = html ? extractLead(html) : "";
    if (best.length >= 600) return best;
  }
  const msn = articleText(await msnCopy(url, title, source));
  if (msn.length >= 400) return msn;
  if (!PAYWALL_HOST.test(url)) {
    const html = await readerService(url);
    const text = html ? extractLead(html) : "";
    if (text.length > best.length) best = text;
  }
  return best;
}
const PAYWALL_HOST = /^https?:\/\/(?:[^/]*\.)?(?:wsj\.com|bloomberg\.com|ft\.com|nytimes\.com|washingtonpost\.com|economist\.com|thetimes\.com|telegraph\.co\.uk|barrons\.com|foreignpolicy\.com)\//i;
const GNEWS_PER_TICK = 4;
const PAYLOAD_REPORTS = 300;
const RAW_HITS = 200;
const RAW_HITS_MS = 3 * 3600_000;
/**
 * Gemini's lite models are the Yemen reader's first; the Iran reader uses them
 * only while today's calls on them stay under this, so Yemen keeps its share.
 */
const GEMINI_LITE_SHARE = 300;

const due = (state: IranState, id: string, everyMin: number, now: number) => now - (state.lastScanAt[id] ?? 0) >= everyMin * 60_000 - 20_000;

const TG_BACKFILL_PAGES = 4;
/**
 * Channels read again from a post, once (the key marks it done): Araghchi's 7-part interview of 20 Oct
 * night (posts 13084–13096) was read cut short and made one card; read again under 21 Oct's rules.
 */
const REWIND = [{ id: "s_a_araghchi", from: 13083, to: 13097, until: Date.parse("2026-10-22T06:00:00Z"), key: "rewind:s_a_araghchi:13083:v10" }];
/** A post a rewind brings back is read again though seen before (by its number, so a restart between the read
 *  and the reading does not lose it; a reading already cached under the new rules costs nothing). */
const rewound = (url: string, now: number) => REWIND.some((x) => now < x.until && url.includes(`t.me/${x.id}/`) && tgPostNo(url) > x.from && tgPostNo(url) <= x.to);

async function readTg(src:{ id: string; name: string; lean: IranLean }, state: IranState, now: number): Promise<{ rows: RawHit[]; ok: boolean }> {
  const html = await fetchText(`https://t.me/s/${src.id}`);
  const ok = !!(html && html.includes("tgme_widget_message"));
  if (!ok) return { rows: [], ok };
  // Once: a channel read again from a post (REWIND), its posts read again whatever was seen.
  const rw = REWIND.find((x) => x.id === src.id && now < x.until && !state.lastTgPost[x.key]);
  if (rw) state.lastTgPost[rw.key] = now;
  const newest = newestTgPost(html as string, src.id);
  // A mark past anything the channel posted is no mark (Al-Akhbar's, 22 Oct).
  const stored = state.lastTgPost[src.id] ?? 0;
  const seen = rw ? rw.from : newest > 0 && stored > newest + TG_MARK_SLACK ? newest : stored;
  if (seen && newest <= seen) return { rows: [], ok };
  const all = parseTelegram(html as string, { id: src.id, name: src.name, lean: "intl" });
  // A busy channel can post more between two reads than its page holds (Araghchi's interview: a video and a
  // text for each of 7 parts, 21 Oct): page back to the last post read, as the Yemen desk does.
  for (let page = 0; seen && page < TG_BACKFILL_PAGES; page += 1) {
    const oldest = Math.min(...all.map((r) => ownPostNo(r.url, src.id)).filter(Boolean));
    if (!Number.isFinite(oldest) || oldest <= seen + 1) break;
    // Telegram turns a request down now and then while the scan reads every channel at once: once more, after a pause.
    const older = (await fetchText(`https://t.me/s/${src.id}?before=${oldest}`)) ?? (await new Promise((r) => setTimeout(r, 2000)).then(() => fetchText(`https://t.me/s/${src.id}?before=${oldest}`)));
    const more = older ? parseTelegram(older, { id: src.id, name: src.name, lean: "intl" }).filter((r) => tgPostNo(r.url) < oldest) : [];
    if (!more.length) break;
    all.push(...more);
  }
  const rows = all
    .filter((r) => {
      const n = Number(/\/(\d+)(?:#|$)/.exec(r.url)?.[1] ?? 0);
      return seen ? n > seen || !n : Date.parse(r.at) > now - FIRST_SIGHT_MS;
    })
    .map((r) => ({ ...r, lean: src.lean }));
  if (rw) console.log(`[iran] rewind ${src.id} from ${rw.from}: ${all.length} posts on its pages, ${rows.length} read again`);
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

/**
 * Lebanon's state agency from its own site (user, 22 Oct): the latest list, then the full text of each new
 * story that passes the Lebanese gate on its headline (NNA posts some 300 stories a day, most of them local).
 */
async function readNna(state: IranState, now: number): Promise<{ rows: RawHit[]; ok: boolean }> {
  type Story = { id: number; title?: string; url?: string; publish_date?: number; is_exclusive?: boolean };
  let list: Story[] = [];
  try {
    list = (JSON.parse((await fetchText(NNA_LATEST, 15_000)) ?? "") as { data?: { news?: Story[] } }).data?.news ?? [];
  } catch {
    return { rows: [], ok: false };
  }
  if (!list.length) return { rows: [], ok: false };
  const seen = state.lastTgPost[NNA_MARK] ?? 0;
  const fresh = list.filter((s) => s.id > seen && s.title && (seen || (s.publish_date ?? 0) * 1000 > now - FIRST_SIGHT_MS));
  const rows: RawHit[] = [];
  for (const s of fresh.filter((x) => passesLebaneseMediaGate(x.title ?? "")).slice(0, 12)) {
    let text = "";
    try {
      const j = JSON.parse((await fetchText(nnaStory(s.id), 15_000)) ?? "") as { data?: { data?: { content?: string } } };
      text = articleText(`<article>${j.data?.data?.content ?? ""}</article>`) || String(j.data?.data?.content ?? "").replace(/<[^>]+>/g, " ");
    } catch {
      // The headline alone, as the channel gives it.
    }
    const at = s.publish_date ? jerusalemIso(new Date(s.publish_date * 1000)) : jerusalemIso(new Date(now));
    rows.push({ source: "NNA", url: s.url ?? `https://nna-leb.gov.lb/ar/news/short/${s.id}`, title: s.title, text: `${s.title}\n${text.replace(/\s+\n/g, "\n").trim()}`.slice(0, 6000), at, lean: "gulf", fromTg: false, ...(s.is_exclusive ? { feedBody: text } : {}) });
  }
  state.lastTgPost[NNA_MARK] = Math.max(seen, ...list.map((s) => s.id));
  return { rows, ok: true };
}
const NNA_MARK = "nna-leb";

async function readFeed(f: Feed): Promise<{ rows: RawHit[]; ok: boolean }> {
  const body = await fetchText(f.url, 10_000);
  // A feed with nothing new still answered (Google's listing of a slow site).
  const ok = !!(body && /<(?:item|channel)[\s>]/i.test(body));
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

/**
 * The Iran desk's own sources, each on its own clock, and what of theirs is
 * about the war or its economy (the desk's own gate). The site scan calls it
 * with the scan's store of how far each source was read.
 */
export async function fetchIranSources(state: FetchState, now: number): Promise<{ hits: RawHit[]; status: SourceStatus[]; yemen: RawHit[] }> {
  const iState = state as IranState;
  const status: SourceStatus[] = [];
  const own: RawHit[] = [];
  const jobs: Promise<void>[] = [];
  const run = (id: string, name: string, kind: SourceStatus["kind"], every: number, read: () => Promise<{ rows: RawHit[]; ok: boolean }>) => {
    if (!due(iState, id, every, now)) return;
    jobs.push(
      (async () => {
        let res = { rows: [] as RawHit[], ok: false };
        try {
          res = await read();
        } catch {
          // Unread this tick; the status says so.
        }
        iState.lastScanAt[id] = Date.now();
        own.push(...res.rows);
        status.push({ id, name, kind, ok: res.ok, cadence: every >= 60 ? "hourly" : `every ${every} min`, hits: res.rows.length });
      })(),
    );
  };
  for (const s of IRAN_TG) run(`tg:${s.id}`, s.name, "tg", s.every, () => readTg(s, iState, now));
  for (const s of IRAN_X) run(`x:${s.id}`, s.name, "x", s.every, () => readX(s, iState, now));
  for (const f of [...IRAN_RSS, ...SEARCHES]) run(`web:${f.id}`, f.name, "web", f.every, () => readFeed(f));
  run("web:nna", "NNA", "web", 5, () => readNna(iState, now));
  await Promise.allSettled(jobs);
  remember(own);

  return { hits: own.filter((h) => passesOwnSourceGate(h)), status, yemen: toYemen(own) };
}

/** The Yemen desk's filter group for a source of this desk's: Iran's side is the Houthis' side there. */
const YEMEN_LEAN: Partial<Record<IranLean, string>> = { axis: "houthi", gulf: "gov" };

/**
 * The sources are the site's (user, 9 Oct): what of this desk's sources names
 * Yemen's war (WAR_ONLY, the words the Yemen scan keeps its wide accounts to)
 * goes to the Yemen desk too, through its own gate and reader. Israeli media
 * stay off it: the Yemen desk does not take Israeli outlets.
 */
export function toYemen(rows: RawHit[]): RawHit[] {
  return rows
    .filter((h) => !ISRAELI_MEDIA.has(h.source) && WAR_ONLY.test(`${h.title ?? ""} ${h.text}`))
    .map((h) => ({ ...h, lean: YEMEN_LEAN[h.lean as IranLean] ?? "intl" }));
}

/**
 * Most of the Iran desk's own sources post about Iran and little else. Israeli
 * media post about everything in Israel and the IAEA about every country's
 * nuclear file: theirs pass on the war itself only, and Israeli media's
 * relays of foreign outlets do not pass (stage 4c). Lebanese media pass on
 * Lebanon's war with Israel and on Iran's.
 */
export function passesOwnSourceGate(h: Pick<RawHit, "source" | "title" | "text">): boolean {
  const text = `${h.title ?? ""} ${h.text}`;
  if (ISRAELI_MEDIA.has(h.source)) return passesIsraeliMediaGate(text);
  if (LEBANESE_MEDIA.has(h.source)) return passesLebaneseMediaGate(text);
  if (IRAQI_MEDIA.has(h.source)) return passesIraqiMediaGate(text);
  if (h.source === "IAEA" || /^Rafael Grossi/.test(h.source)) return isIranWar(text);
  // Russia's and RT's feeds cover the world: only what names Iran's war.
  if (/^(?:TASS|RIA Novosti|RT|RT Arabic|Russia Foreign Ministry|Maria Zakharova)$/.test(h.source)) return isIranWar(text);
  return passesIranOwnGate(text);
}

/** The site scan's part for the Iran desk: its own sources read, into its inbox. */
export async function scanIranSources(store: Awaited<ReturnType<typeof getStore>>, now: number): Promise<{ n: number; yemen: RawHit[] }> {
  const state: FetchState = { lastScanAt: {}, lastTgPost: {}, lastXPost: {}, ...((await store.getJson<FetchState>(FETCH_STATE_KEY)) ?? {}) };
  // First run: how far the Iran cycle had read each source itself.
  if (!Object.keys(state.lastScanAt).length) {
    const old = await store.getJson<IranState>(STATE_KEY);
    if (old) Object.assign(state, { lastScanAt: { ...old.lastScanAt }, lastTgPost: { ...old.lastTgPost }, lastXPost: { ...old.lastXPost } });
  }
  const { hits, status, yemen } = await fetchIranSources(state, now);
  const row: IranInboxRow = { hits, status, own: true };
  await store.putMany(IRAN_INBOX, { [`own-${now}`]: row });
  await store.putJson(FETCH_STATE_KEY, { lastScanAt: state.lastScanAt, lastTgPost: state.lastTgPost, lastXPost: state.lastXPost });
  return { n: hits.length, yemen };
}

export type IranTickResult = { ok: boolean; scannedAt: string; sourcesTried: number; sourcesOk: number; fromInbox: number; candidates: number; reportsAdded: number; note: string; tookMs: number; error?: string };

/** `fromScan`: the site scan read this desk's own sources (site-scan mode "on"). */
export async function runIranCycle(fromScan = false): Promise<IranTickResult> {
  const started = Date.now();
  const now = started;
  const store = await getStore();
  const state: IranState = { lastScanAt: {}, lastTgPost: {}, lastXPost: {}, seen: {}, ...((await store.getJson<IranState>(STATE_KEY)) ?? {}) };
  const prev = await store.getJson<ScanPayload>(IRAN_PAYLOAD);
  // A card taken off the desk (json:dropped) is not carried forward and saved again.
  const dropped = (await store.getJson<Record<string, number>>("dropped")) ?? {};
  if (prev && Array.isArray(prev.reports)) prev.reports = prev.reports.filter((r) => !(r.fp in dropped));
  const seenAt = jerusalemIso(new Date(now));
  // The Trump feed (stage 5) is read beside the cycle; the cycle never waits on it.
  const trump = scanTrump(store, now).catch((err) => console.error("[trump]", err instanceof Error ? err.message : err));

  // 1. The Iran desk's own sources: read here in the old path (site-scan
  //    mode "off"), else by the site scan, which leaves them in the inbox.
  let status: SourceStatus[] = [];
  let own: RawHit[] = [];
  if (!fromScan) ({ hits: own, status } = await fetchIranSources(state, now));

  // 2. What the Yemen scan handed over from the shared sources.
  let inbox: RawHit[] = [];
  try {
    for (const row of await store.takeMany<RawHit[] | IranInboxRow>(IRAN_INBOX)) {
      if (Array.isArray(row)) inbox.push(...row);
      else if (row.own) {
        own.push(...row.hits);
        // The newest read of each source is its status.
        for (const st of row.status ?? []) status = [...status.filter((x) => x.id !== st.id), st];
      } else inbox.push(...row.hits);
    }
  } catch (err) {
    console.error("[iran] inbox:", err instanceof Error ? err.message : err);
  }

  // 3. New, recent, and about this war: the Iran desk's own sources pass on
  //    the war's and the economy's words, the shared ones were gated already.
  for (const [u, t] of Object.entries(state.seen)) if (now - t > SEEN_KEEP_MS) delete state.seen[u];
  const byUrl = new Map<string, RawHit>();
  for (const h of [...own, ...inbox, ...(state.pending ?? [])]) {
    const t = Date.parse(h.at);
    if ((state.seen[h.url] && !rewound(h.url, now)) || (Number.isFinite(t) && now - t > MAX_AGE_MS)) continue;
    // A whole live blog is many stories under one address: its entries come from their own sources.
    if (LIVE_BLOG.test(h.url)) continue;
    if (Number.isFinite(t) && t > now + 10 * 60_000) h.at = seenAt;
    const had = byUrl.get(h.url);
    if (!had || h.text.length > had.text.length) byUrl.set(h.url, h);
  }
  const hits = [...byUrl.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const back = hits.filter((h) => rewound(h.url, now));
  if (back.length) console.log(`[iran] rewound posts to read: ${back.map((h) => tgPostNo(h.url)).join(" ")}`);

  // 4. A teaser is not enough to read: the article is opened (Google's links
  //    resolved first), a few a tick, newest first.
  // Google's links wait on the budget every caller shares (gnews.ts), so they
  // no longer take the turns of articles that open at once: on 17 Oct the newest
  // fifteen were mostly Google links during Google's rest, and the desk opened
  // 159 articles in a day of 21,500 shared items.
  let opened = 0;
  let resolved = 0;
  const gnBudget = Math.min(GNEWS_PER_TICK, canResolve("lead") ? resolvesLeft() : bingLeft());
  await Promise.allSettled(
    hits
      .filter((h) => !h.fromTg && h.text.length < 600 && (!isGnews(h.url) || !!knownResolve(h.url) || resolved++ < gnBudget))
      .slice(0, LEADS_PER_TICK)
      .map(async (h) => {
        if (isGnews(h.url)) {
          const real = await articleOf(h);
          if (!real) return;
          h.url = cleanUrl(real);
          if (h.source === "Google News") h.source = outletFromHost(h.url) || h.source;
        }
        const html = await fetchText(h.url, 6000);
        const lead = html ? extractLead(html) : "";
        if (lead.length > 80) h.text = `${h.text}\n${lead}`.slice(0, 8600);
        opened += 1;
      }),
  );
  // 4b. The article behind a post, and an article whose page refused the server (user, 22 Oct:
  //     "if you see a link on x dont just take the 2 sentences in the x post but go to the link").
  const postOf = new Map<RawHit, string>();
  let links = POST_LINKS_PER_TICK;
  let blocked = BLOCKED_PER_TICK;
  await Promise.allSettled(
    hits
      .filter((h) => !isGnews(h.url) && h.text.length < 1500 && passesIranOwnGate(h.text))
      .map(async (h) => {
        if (isPostUrl(h.url)) {
          const link = articleLink(h.text);
          if (!link || links <= 0) return;
          links -= 1;
          const url = cleanUrl(await unshorten(link));
          if (isPostUrl(url) || !/^https?:\/\/[^/]+\/./.test(url)) return;
          const outlet = outletFromHost(url);
          const text = await openArticle(url, h.title || h.text.split("\n")[0], outlet);
          if (text.length < 300) return;
          h.text = `${h.text}\n\n[The linked article${outlet ? `, ${outlet}` : ""}]\n${text}`.slice(0, 8600);
          // An outlet's post of its own story is that story: the card links the article.
          if (ownStory(url, outlet, h.source)) {
            postOf.set(h, h.url);
            h.url = url;
          }
          opened += 1;
        } else if (!h.fromTg && h.text.length < 600 && blocked > 0) {
          blocked -= 1;
          const text = await openArticle(h.url, h.title || h.text.split("\n")[0], h.source, false);
          if (text.length > h.text.length) h.text = `${h.title ?? ""}\n${text}`.trim().slice(0, 8600);
        }
      }),
  );
  // A Google item still on Google's redirect waits for the next tick.
  const readable = hits.filter((h) => !isGnews(h.url));
  for (const h of readable) if (h.source === "Google News") h.source = outletFromHost(h.url) || h.source;
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
  for (const h of readable) {
    state.seen[h.url] = now;
    const post = postOf.get(h);
    if (post) state.seen[post] = now;
  }
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
  // Trump's own words go to the Trump column, not the feed (user, 16 Oct): the
  // column finds where he said them and writes them from there.
  const said: LiveReport[] = [];
  for (const [url, v] of verdicts) {
    if (v.kind !== "publish") continue;
    const h = texts.get(url);
    if ((h && isExclusive(h.text, h.source)) || exclusiveUrl(url)) v.report.flags = [...new Set([...(v.report.flags ?? []), "exclusive"])];
    v.report.desks = ["iran"];
    if (trumpSaid(v.report)) said.push(v.report);
    else approved.push(v.report);
  }
  if (said.length) {
    await store.putJson(SAID_QUEUE, enqueueSaid((await store.getJson<SaidItem[]>(SAID_QUEUE)) ?? [], said.map((r) => ({ fp: r.fp, at: r.at, summary: r.summary, text: r.text, url: r.url, source: r.source })), now));
    console.log(`[iran] ${said.length} report(s) of Trump's words sent to the Trump column`);
  }
  const { uniqReports, touched } = await shapeCards(IRAN_PIPE, approved, readable, prev, now);
  const before = new Set((prev?.reports ?? []).map((r) => r.fp));
  const cards = uniqReports.filter((r) => !before.has(r.fp));
  const folded = approved.length - cards.length;
  const merge = uniqReports.length || touched.length ? await store.mergeIntoDesk([...uniqReports.slice(0, PAYLOAD_REPORTS), ...touched]) : { reportsAdded: 0, eventsAdded: 0, unplaced: [] };
  // A strike, fighting or ship card stored with no place is given one from its own headline (user, 18 Oct), as on the Yemen desk.
  try {
    const placed = await store.placeUnplaced?.("2026-09-28T00:00:00+03:00", iranPlaceFromWords, "iran");
    if (placed) console.log(`[iran pins] ${placed} cards with no place given one from their headline`);
  } catch (err) {
    console.warn("[iran pins] placing cards failed", err);
  }

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
  const note = `${status.length} sources read${fromScan ? " by the site scan" : ""}, ${own.length} items from them, ${inbox.length} from the shared sources, ${candidates.length} new to read, ${opened} articles opened, ${cards.length} new cards, ${folded} copies folded.${modelNote ? ` Reader: ${modelNote}.` : ""}`;
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
  // The 3-hour brief (stage 6): built once its window closes, never held for by the cycle.
  void refreshIranBrief(store).catch((err) => console.error("[iran-brief]", err instanceof Error ? err.message : err));
  // US sanctions from OFAC's own list, once an hour (user, 17 Oct: the 15 Oct sanctions never reached the numbers).
  void refreshOfac(store).catch((err) => console.error("[ofac]", err instanceof Error ? err.message : err));
  // Every other box of the numbers from its own source, and the rest from the reports every 6 hours (user, 17 Oct: "everything should be automatic").
  void refreshIranLive(store, IRAN_NUMBERS as NumbersFile)
    // UKMTO's own warnings onto the ship list by code, every half hour (18 Oct).
    .then(() => refreshUkmto(store, IRAN_NUMBERS as NumbersFile))
    .then(() => refreshIranReports(store, IRAN_NUMBERS as NumbersFile))
    .catch((err) => console.error("[iran-live]", err instanceof Error ? err.message : err));
  await trump;
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
