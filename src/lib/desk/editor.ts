/**
 * The desk editor: turns candidate items into published reports through the
 * reading layer (`reader.ts`). Server-only.
 *
 *   cache    every verdict is kept by content hash, so nothing is read twice
 *   queue    an item the model could not read this cycle (quota, outage) waits
 *            and is retried next cycle — it is never published unread, and it
 *            is not lost when it scrolls off a channel's first page
 *   check    `checkReading` is applied to every verdict before publication
 *   place    pins and datelines come only from targets the gazetteer ALSO
 *            finds in the source text — never from the model's say-so alone
 */

import { anglicise } from "./anglicise.ts";
import { respell } from "./spelling.ts";
import { westernDates } from "./calendars.ts";
import { type NeedsPlace, geocodeJobs } from "./geocode.ts";
import { maritimeType, seaPlace } from "./maritime.ts";
import { offsetFromText } from "./offshore.ts";
import { governorateAt } from "./adm1.ts";
import { type Place, placesIn } from "./gazetteer.ts";
import { placeNamesIn } from "./prose-places.ts";
import { type OutletSide, credibility, outletSide } from "./credibility.ts";
import { recordOf } from "./source-rating.ts";
import { domainOf, majorCarrier } from "./origin.ts";
import {
  type EventType,
  type Reading,
  type ReaderItem,
  type RecentReport,
  READER_BATCH,
  SECOND_LOOK_MODELS,
  OUTLET_LEAD,
  checkReading,
  nextPacificMidnight,
  pacificDay,
  repairable,
  dropInventedRole,
  diplomatPost,
  firstEvent,
  fixHeadline,
  redundantBody,
  casualtyHeadline,
  sourceSentences,
  stripSpellingNotes,
  spokespersonLabel,
  stripOwnOutlet,
  contentHash,
  fallbackKey,
  readBatch,
  readerKey,
  READER_MODELS,
  YEMEN_PROMPT,
  type ReaderPrompt,
} from "./reader.ts";
import { type DeskStore, migrateBlob } from "./store.ts";
import type { DeskId } from "../desks.ts";
import { deskKey } from "./desk-route.ts";
import { IRAN_ARENAS, IRAN_PROMPT, iranContentHash, iranCopyProblem, iranReword } from "./iran-reader.ts";
import type { DeskType } from "./digest.ts";
import type { LiveReport } from "./types.ts";
import { datelineOf } from "./wire-style.ts";
import { normaliseArabic } from "./relevance.ts";
import { copyKey } from "./copies.ts";

export type Candidate = {
  source: string;
  url: string;
  text: string;
  at: string;
  lean: string;
  fp: string;
  /** Gate interest score, kept for feed ordering. */
  score: number;
  tags: string[];
};

export type EditorVerdict =
  | { kind: "publish"; report: LiveReport }
  | { kind: "reject"; reason: string; note: string }
  | { kind: "pending"; note: string };

/** The old whole-cache blob, moved into rows once. */
const CACHE_KEY = "reader-cache";
const CACHE_PREFIX = "read";
const QUEUE_KEY = "reader-queue";
const QUOTA_KEY = "reader-quota";
const SLOW_REST_MS = 20 * 60_000;
/** Model calls per model on the quota's (Pacific) day: the status page's count. */
export const USAGE_KEY = "reader-usage";
export type Usage = { day: string; calls: Record<string, number> };
/** Readings not written for two weeks are dropped: nothing that old is listed again. */
const CACHE_KEEP_MS = 14 * 24 * 3600 * 1000;
const PRUNE_EVERY_MS = 3600 * 1000;
let lastPrune = 0;
let migrated = false;
async function migrateOnce(store: DeskStore): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    await migrateBlob(store, CACHE_KEY, CACHE_PREFIX);
  } catch {
    migrated = false;
  }
}
/** A queued item older than this is no longer news; it is dropped from the queue. */
const QUEUE_TTL_MS = 24 * 3600 * 1000;
/** How far back, and how many, published reports the reader sees for follow-ups. */
const RECENT_MS = 24 * 3600 * 1000;
const RECENT_MAX = 40;
/** Model calls per cycle, so one busy cycle cannot spend the day's quota. */
const MAX_CALLS_PER_CYCLE = 5;
/** While a backlog waits (a replay, an outage caught up), a cycle may make more. */
const BACKLOG_CALLS_PER_CYCLE = 9;
const BACKLOG_ITEMS = 150;
/** Reader calls in flight at once: a cycle waits on the slowest of three, not on the sum. */
const PARALLEL_CALLS = 3;

/**
 * `loose`: failed a strict check twice and went out anyway (see the repair).
 * `second`: the second look has read it. `secondTriedAt`: the second look was
 * attempted and no model answered (all of them out of quota). Without the
 * second stamp the item came back every single cycle, forever.
 */
type CacheEntry = { reading: Reading; at: number; second?: boolean; secondTriedAt?: number; loose?: boolean };

/** Rejected field reports, with what the second look made of them (admin page). */
export type Missed = { at: string; source: string; url: string; text: string; reason: string; second: string };
export const MISSED_KEY = "reader-missed";
const MISSED_MAX = 200;
const SECOND_LOOK_MAX = 8;
/** After a second look that no model answered, wait this long before retrying. */
const SECOND_RETRY_MS = 3600 * 1000;
const REPAIR_MAX = 10;

/** A place in Yemen or Saudi Arabia, and something happening there. */
const FIELD_WORDS =
  /غاره|غارات|قصف|اشتباك|اشتباكات|مواجهات|مقتل|قتلي|قتيل|جرحي|جريح|اصابه|مصابين|شهدا|صاروخ|صواريخ|مسيره|مسيرات|استهداف|استهدف|هجوم|كمين|تفجير|strike|clash|killed|wounded|injured|missile|drone|attack|shell/;
export function fieldReport(text: string): boolean {
  if (!FIELD_WORDS.test(normaliseArabic(text))) return false;
  return placesIn(text).some((p) => p.country === "Yemen" || p.country === "Saudi Arabia");
}

/**
 * The wide radar: what the desk must never lose even when no keyword fires.
 * Anyone with a role on any side speaking to any outlet about this war, and
 * any siren, civil-defence alert, interception or closed airspace in Saudi
 * Arabia (or Eilat, when the fire comes from Yemen).
 */
const ROLE =
  /وزير|وزارة|مسؤول|مسئول|متحدث|ناطق|مستشار|قائد|رئيس هيئة الأركان|رئيس الأركان|محافظ|سفير|مبعوث|مصدر (?:في|ب|مطلع|عسكري|حكومي|دبلوماسي)|عضو المكتب السياسي|\b(?:minister|ministry|official|spokes(?:man|woman|person)|advis[eo]r|commander|chief of staff|governor|ambassador|envoy)\b/i;
const SPEAKS = /قال|صرح|صرّح|أكد|اكد|حذر|حذّر|أعلن|اعلن|كشف|لـ?«|لـ?"|ل(?:قناة|صحيفة|موقع|وكالة|التلفزيون)|:|\b(?:said|says|told|warned|stated|announced)\b/i;
const WAR = /الحوث|اليمن|يمني|صنعاء|عدن|السعودي|الرياض|البحر الأحمر|باب المندب|أنصار الله|\b(?:Houthis?|Yemen|Yemeni|Sanaa|Aden|Saudi|Riyadh|Red Sea|Bab al-Mandab)\b/i;
const ALERT =
  /صفارات الإنذار|صافرات الإنذار|صفارات الانذار|صافرات الانذار|الدفاع المدني|اعتراض|إغلاق المجال الجوي|اغلاق المجال الجوي|تعليق الرحلات|الملاجئ|\b(?:sirens?|civil defen[cs]e|intercept\w*|airspace|flights? (?:suspended|halted|diverted)|shelters?)\b/i;
const ALERT_PLACE =
  /السعودي|الرياض|جدة|جيزان|جازان|نجران|أبها|ابها|الطائف|ينبع|الدمام|خميس مشيط|مكة|إيلات|ايلات|\b(?:Saudi|Riyadh|Jeddah|Jizan|Jazan|Najran|Abha|Taif|Yanbu|Dammam|Khamis Mushait|Mecca|Makkah|Eilat)\b/i;
export function onRadar(text: string): boolean {
  const t = String(text || "");
  return (ROLE.test(t) && SPEAKS.test(t) && WAR.test(t)) || (ALERT.test(t) && ALERT_PLACE.test(t));
}

/**
 * Rejections for thinness made before the rule that a headline stating a fact
 * about this war is publishable. Those alone are read again, rather than
 * re-reading the whole cache and spending the day's quota.
 */
const THIN_RULE_AT = Date.parse("2026-09-21T14:30:00+03:00");
const THIN_REASON = /substantive|teaser|headline|vague|brief|analy|recap|uninformative/i;
/**
 * Scope rejections made before the rule that the exclusion is the theatre and
 * not the nationality — men of a foreign force killed in Yemen are this war.
 * Those alone are read again: a whole-cache re-read would spend a day of free
 * quota to change a handful of verdicts, and only items a source still lists
 * come back round anyway.
 */
const SCOPE_RULE_AT = Date.parse("2026-09-23T09:00:00+03:00");
const SCOPE_REASON = /scope|theatre|theater|unrelated|another war|different war/i;
/**
 * X posts turned down as commentary before the rule that an open-source
 * analyst's own finding (a frontline mapped from satellite imagery, footage
 * geolocated) is a report. Only X posts are read again.
 */
const OSINT_RULE_AT = Date.parse("2026-09-25T03:55:00+03:00");
const OSINT_REASON = /commentary|analy|opinion/i;
/**
 * Rejections made before the wider scope (user, 28 Sep): ship traffic through
 * this war's waters, oil exports hit or resumed, commanders meeting on the
 * fighting, a warring party's official clerics calling to fight. Only those
 * are read again.
 */
const WIDE_SCOPE_AT = Date.parse("2026-09-28T19:00:00+03:00");
const WIDE_SCOPE_REASON = /econom|scope|cleric|not publishable|business|market|price|shipping|unrelated/i;
/** Wartime prayers ordered by a warring party's religious ministry became news (28 Sep 19:30). */
const PRAYER_RULE_AT = Date.parse("2026-09-28T19:30:00+03:00");
function stale(e: CacheEntry, c: Pick<Candidate, "url">): boolean {
  if (e.reading.publish) return false;
  const why = String(e.reading.reject_reason || "");
  if (e.at < WIDE_SCOPE_AT && WIDE_SCOPE_REASON.test(why)) return true;
  if (e.at < PRAYER_RULE_AT && /cleric/i.test(why)) return true;
  if (e.at < THIN_RULE_AT && THIN_REASON.test(why)) return true;
  if (e.at < OSINT_RULE_AT && isXPost(c) && OSINT_REASON.test(why)) return true;
  return e.at < SCOPE_RULE_AT && SCOPE_REASON.test(why);
}

/** A post on an X account: the desk reads open-source analysts there. */
function isXPost(c: Pick<Candidate, "url">): boolean {
  return /^https:\/\/x\.com\/[^/]+\/status\//.test(c.url);
}
/**
 * Articles the reader reads whole, not their top 2,400 characters: an original,
 * an exclusive, and any major outlet's own article (user, 3 Oct 05:56: the
 * Axios piece on Trump's Camp David meeting went out as its headline; "read
 * the whole article, there was probably more relevant info there").
 */
function readWhole(c: Candidate): boolean {
  return c.tags.includes("original") || c.tags.includes("exclusive") || (!/^https:\/\/(?:t\.me|x\.com|twitter\.com)\//.test(c.url) && majorCarrier(domainOf(c.url)));
}

function alignmentOf(c: Candidate): string {
  return isXPost(c) ? "open-source (OSINT) analyst's own X account, no declared alignment" : ALIGNMENT[outletSide(c.source, c.lean)];
}
type Cache = Record<string, CacheEntry>;
type Queued = Candidate & { queuedAt: number };

const ALIGNMENT: Record<OutletSide, string> = {
  houthi: "Houthi-aligned",
  gov: "Saudi/government-aligned",
  neutral: "no declared alignment",
  agency: "international news agency",
};

const TYPE_OF: Record<EventType, DeskType> = {
  air_strike: "strike",
  missile_launch: "strike",
  drone_attack: "strike",
  interception: "strike",
  air_raid_alert: "strike",
  shelling: "combat",
  ground_clash: "combat",
  advance_or_capture: "combat",
  maritime_attack: "vessel",
  statement: "statement",
  diplomacy: "diplomacy",
  economy: "economy",
};

/**
 * One desk's reading: where its queue and cache live, its prompt and checks,
 * its share of the model calls. The Yemen desk's is the default (Round 30).
 */
export type DeskReader = {
  desk: DeskId;
  queueKey: string;
  cachePrefix: string;
  missedKey: string;
  hash: (text: string) => string;
  decide: (r: Reading, c: Candidate, strict?: boolean) => EditorVerdict;
  alignment: (c: Candidate) => string;
  prompt: ReaderPrompt;
  models: readonly string[];
  fallbacksFirst: boolean;
  /** Calls this cycle; unset, the Yemen budget. */
  maxCalls?: number;
  secondLook: boolean;
  geocode: boolean;
  /** The most items kept waiting, newest first; unset, no limit. */
  queueMax?: number;
  /** Published cards the reader sees to mark copies and follow-ups; unset, RECENT_MAX. */
  recentMax?: number;
};

export const YEMEN_READER: DeskReader = {
  desk: "yemen",
  queueKey: QUEUE_KEY,
  cachePrefix: CACHE_PREFIX,
  missedKey: MISSED_KEY,
  hash: contentHash,
  decide: (r, c, strict = true) => decide(r, c, strict),
  alignment: (c) => alignmentOf(c),
  prompt: YEMEN_PROMPT,
  models: READER_MODELS,
  fallbacksFirst: false,
  secondLook: true,
  geocode: true,
};

/** Is the reader switched on? Without a key the desk publishes nothing new. */
export function readerAvailable(): boolean {
  return !!readerKey() || fallbackKey();
}

/**
 * Decide every candidate. Candidates from the queue are folded in, and any
 * that cannot be read this cycle go back on it.
 */
export async function editCandidates(
  store: DeskStore,
  fresh: Candidate[],
  now = Date.now(),
  cfg: DeskReader = YEMEN_READER,
): Promise<{ verdicts: Map<string, EditorVerdict>; queued: Candidate[]; modelNote: string }> {
  const queue = ((await store.getJson<Queued[]>(cfg.queueKey)) ?? []).filter((q) => now - q.queuedAt < QUEUE_TTL_MS);

  // This cycle's items plus anything still waiting from earlier cycles.
  const byUrl = new Map<string, Queued>();
  for (const q of queue) byUrl.set(q.url, q);
  for (const c of fresh) byUrl.set(c.url, { ...c, queuedAt: byUrl.get(c.url)?.queuedAt ?? now });
  const all = [...byUrl.values()];

  // Only this cycle's readings are fetched, one row each, and only those
  // written this cycle are saved (the whole cache was 2.6 MB a tick each way).
  if (cfg.desk === "yemen") await migrateOnce(store);
  const cache: Cache = await store.getMany<CacheEntry>(cfg.cachePrefix, all.map((c) => cfg.hash(c.text)));
  const dirty = new Set<string>();
  const setEntry = (hash: string, e: CacheEntry) => {
    cache[hash] = e;
    dirty.add(hash);
  };

  const verdicts = new Map<string, EditorVerdict>();
  const readingOf = new Map<string, Reading>();
  const unread: Queued[] = [];
  for (const c of all) {
    const hit = cache[cfg.hash(c.text)];
    if (hit && !stale(hit, c)) {
      verdicts.set(c.url, cfg.decide(hit.reading, c, !hit.loose));
      readingOf.set(c.url, hit.reading);
    } else unread.push(c);
  }

  // Models out of their daily quota rest until it resets (the value is when).
  const quota = (await store.getJson<Record<string, number>>(QUOTA_KEY)) ?? {};
  const skip = new Set(Object.keys(quota).filter((m) => now < quota[m]));
  // Calls per model today, for the status page.
  const today = pacificDay(now);
  const usage = await store.getJson<Usage>(USAGE_KEY);
  const calls24: Usage = usage?.day === today ? usage : { day: today, calls: {} };
  const count = (model?: string) => {
    if (model) calls24.calls[model] = (calls24.calls[model] ?? 0) + 1;
  };

  // Read what is new, newest first, within this cycle's budget.
  const key = readerKey();
  const anyReader = !!key || fallbackKey();
  let modelNote = anyReader ? "" : "reader off: GEMINI_API_KEY not set";
  unread.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  // A post forwarded by several channels is read once; the copies take its reading.
  const copyOf = new Map<Queued, Queued>();
  const firstOf = new Map<string, Queued>();
  for (const c of unread) {
    const k = copyKey(c.text);
    const first = k ? firstOf.get(k) : undefined;
    if (first) copyOf.set(c, first);
    else if (k) firstOf.set(k, c);
  }
  const toRead = unread.filter((c) => !copyOf.has(c));
  const stillQueued: Queued[] = [];
  let calls = 0;
  // What the desk already published today, so the reader can mark a direct
  // development of one of them as its follow-up.
  const recent: RecentReport[] = [];
  const refToFp = new Map<string, { fp: string; at: number }>();
  // Refs mean nothing outside this call; keep the report's fp instead. A
  // reply only ever points back in time: an old post read late (a replay)
  // cannot follow up something published after it.
  const unref = (r: Reading, c: Candidate) => {
    const parent = refToFp.get(String(r.follows_up || ""));
    r.follows_up = parent && parent.at < Date.parse(c.at) ? parent.fp : "";
    r.duplicate_of = refToFp.get(String(r.duplicate_of || ""))?.fp ?? "";
  };
  const fixes: { c: Queued; note: string }[] = [];
  if (unread.length && anyReader) {
    try {
      const { reports } = await store.recentDesk(cfg.recentMax ?? RECENT_MAX, undefined, { events: false, desk: cfg.desk });
      for (const r of reports) {
        if (now - Date.parse(String(r.at)) > RECENT_MS || !r.fp) continue;
        const ref = "r" + (recent.length + 1);
        refToFp.set(ref, { fp: String(r.fp), at: Date.parse(String(r.at)) });
        recent.push({ ref, at: String(r.at), headline: String(r.summary || "").slice(0, 160) });
      }
    } catch {
      // Without the recent list nothing is marked a follow-up; nothing else changes.
    }
  }
  // A backlog (a replay, an outage caught up) gets a few more calls a cycle.
  const maxCalls = cfg.maxCalls ?? (toRead.length > BACKLOG_ITEMS ? BACKLOG_CALLS_PER_CYCLE : MAX_CALLS_PER_CYCLE);
  const batches: Queued[][] = [];
  for (let i = 0; i < toRead.length; i += READER_BATCH) batches.push(toRead.slice(i, i + READER_BATCH));
  const readOne = async (batch: Queued[]) => {
    const items: ReaderItem[] = batch.map((c, n) => ({
      id: String(n),
      source: c.source,
      alignment: cfg.alignment(c),
      postedAt: c.at,
      text: c.text,
      full: readWhole(c),
    }));
    const { readings, model, error, exhausted, minute, slow } = await readBatch(items, key, skip, recent, cfg.models, cfg.prompt, cfg.fallbacksFirst);
    count(model);
    for (const m of exhausted) {
      quota[m] = nextPacificMidnight(now);
      skip.add(m);
    }
    for (const m of minute) skip.add(m);
    // A model that hung (Google's "high demand" nights) rests 20 minutes: each
    // scan waited 35 seconds on it before moving on.
    for (const m of slow) quota[m] = Math.max(quota[m] ?? 0, now + SLOW_REST_MS);
    if (error) modelNote = error;
    else if (model) modelNote = `read by ${model}`;
    batch.forEach((c, n) => {
      const r = readings.get(String(n));
      if (!r) {
        stillQueued.push(c);
        return;
      }
      unref(r, c);
      setEntry(cfg.hash(c.text), { reading: r, at: now });
      const v = cfg.decide(r, c);
      verdicts.set(c.url, v);
      readingOf.set(c.url, r);
      if (v.kind === "reject" && v.reason === "reader-check" && repairable(v.note)) fixes.push({ c, note: v.note });
    });
  };
  // Up to three calls at once; newest batches first, as before.
  for (let i = 0; i < batches.length; i += PARALLEL_CALLS) {
    const round: Queued[][] = [];
    for (const batch of batches.slice(i, i + PARALLEL_CALLS)) {
      if (!anyReader || calls >= maxCalls) stillQueued.push(...batch);
      else {
        calls += 1;
        round.push(batch);
      }
    }
    await Promise.all(round.map(readOne));
  }
  for (const [c, first] of copyOf) {
    const r = readingOf.get(first.url);
    if (!r) {
      stillQueued.push(c);
      continue;
    }
    const copy = { ...r };
    setEntry(cfg.hash(c.text), { reading: copy, at: now });
    verdicts.set(c.url, cfg.decide(copy, c));
    readingOf.set(c.url, copy);
  }

  /**
   * The repair: copy that failed a check a second writing can pass (casualties
   * dropped, the speaker not first, length...) is sent back once, in the same
   * cycle, with the fault named. Still failing a strict check, it goes out as
   * first written rather than be lost; either way it is on the missed list.
   */
  if (fixes.length && anyReader) {
    const batch = fixes.slice(0, REPAIR_MAX);
    const items: ReaderItem[] = batch.map(({ c, note }, n) => ({
      id: String(n),
      source: c.source,
      alignment: cfg.alignment(c),
      postedAt: c.at,
      text: c.text,
      full: readWhole(c),
      fix: note,
    }));
    const res = await readBatch(items, key, skip, recent, cfg.models, cfg.prompt, cfg.fallbacksFirst);
    count(res.model);
    const missed = (await store.getJson<Missed[]>(cfg.missedKey)) ?? [];
    batch.forEach(({ c, note }, n) => {
      const first = readingOf.get(c.url)!;
      const second = res.readings.get(String(n));
      if (second) unref(second, c);
      let outcome = "unread";
      let v = second ? cfg.decide(second, c) : undefined;
      let entry: CacheEntry | undefined = v?.kind === "publish" ? { reading: second!, at: now } : undefined;
      if (v?.kind === "publish") outcome = "published after repair";
      else {
        const loose = cfg.decide(second ?? first, c, false);
        if (loose.kind === "publish") {
          v = loose;
          entry = { reading: second ?? first, at: now, loose: true };
          outcome = `published as written: ${second ? (v as { note?: string }).note ?? "repair failed" : "no repair"}`;
        } else if (v) outcome = `rejected again: ${(v as { note?: string }).note ?? ""}`;
      }
      if (v?.kind === "publish" && entry) {
        verdicts.set(c.url, v);
        readingOf.set(c.url, entry.reading);
        setEntry(cfg.hash(c.text), entry);
      }
      missed.unshift({ at: new Date(now).toISOString(), source: c.source, url: c.url, text: c.text.replace(/\s+/g, " ").slice(0, 280), reason: `check: ${note}`, second: outcome });
    });
    await store.putJson(cfg.missedKey, missed.slice(0, MISSED_MAX));
  }

  for (const c of stillQueued) {
    verdicts.set(c.url, { kind: "pending", note: "Waiting for the reader; retried next cycle." });
  }

  /**
   * A second look. A rejected post that names a place in Yemen or Saudi Arabia
   * together with a strike, clash, casualty or launch is exactly what the desk
   * must never lose, so the stronger model reads it once more, and its
   * reading stands. Every such rejection is also logged on the missed list.
   */
  const doubt = !cfg.secondLook ? [] : all.filter((c) => {
    const r = readingOf.get(c.url);
    const v = verdicts.get(c.url);
    const entry = cache[cfg.hash(c.text)];
    if (!r || v?.kind !== "reject" || entry?.second) return false;
    // Attempted, but every model was resting: wait rather than ask again now.
    if (entry?.secondTriedAt && now - entry.secondTriedAt < SECOND_RETRY_MS) return false;
    if (/speech-rhetoric/i.test(String(r.reject_reason || ""))) return false;
    return fieldReport(c.text) || onRadar(c.text);
  });
  if (doubt.length) {
    const missed = (await store.getJson<Missed[]>(cfg.missedKey)) ?? [];
    const batch = doubt.slice(0, SECOND_LOOK_MAX);
    let second = new Map<string, Reading>();
    if (anyReader) {
      const items: ReaderItem[] = batch.map((c, n) => ({
        id: String(n),
        source: c.source,
        alignment: cfg.alignment(c),
        postedAt: c.at,
        text: c.text,
      }));
      const res = await readBatch(items, key, skip, recent, SECOND_LOOK_MODELS, cfg.prompt);
      count(res.model);
      second = res.readings;
    }
    batch.forEach((c, n) => {
      const first = readingOf.get(c.url)!;
      const r = second.get(String(n));
      const hash = cfg.hash(c.text);
      if (!r) {
        // No model answered — every one of them is resting. Stamp the attempt
        // so the item waits its backoff instead of being asked again five
        // minutes from now, and do not log a verdict that says nothing: an
        // unanswered retry echoed every cycle filled all 200 missed slots with
        // 14 URLs and pushed the real misses off the list unread.
        const entry = cache[hash];
        if (entry) setEntry(hash, { ...entry, secondTriedAt: now });
        return;
      }
      r.follows_up = "";
      r.duplicate_of = "";
      setEntry(hash, { reading: r, at: now, second: true });
      const v = cfg.decide(r, c);
      const outcome = v.kind === "publish" ? "published" : `rejected again: ${v.kind === "reject" ? v.note : ""}`;
      if (v.kind === "publish") {
        verdicts.set(c.url, v);
        readingOf.set(c.url, r);
      }
      missed.unshift({
        at: new Date(now).toISOString(),
        source: c.source,
        url: c.url,
        text: c.text.replace(/\s+/g, " ").slice(0, 280),
        reason: String(first.reject_reason || (verdicts.get(c.url) as { note?: string })?.note || ""),
        second: outcome,
      });
    });
    await store.putJson(cfg.missedKey, missed.slice(0, MISSED_MAX));
  }

  // A field event the gazetteer could not place: look its target up instead.
  const jobs: NeedsPlace[] = [];
  for (const c of all) {
    const v = verdicts.get(c.url);
    const r = readingOf.get(c.url);
    if (!cfg.geocode || v?.kind !== "publish" || !r || v.report.place) continue;
    if (v.report.type === "statement" || v.report.type === "diplomacy") continue;
    // A street address for a ship is a place on land: a ship is placed only from the gazetteer's waters and ports.
    if (v.report.type === "vessel") continue;
    const report = v.report;
    jobs.push({
      targets: r.targets || [],
      named: unknownSpots(r.headline || ""),
      sourceText: c.text,
      apply: (hit) => {
        report.place = hit.name;
        report.lat = hit.lat;
        report.lng = hit.lng;
        report.text = `${hit.name.toUpperCase()} — ${report.text}`;
      },
    });
  }
  try {
    await geocodeJobs(store, jobs);
  } catch {
    // Unplaced stays unplaced; the report itself is unaffected.
  }

  await store.putMany(cfg.cachePrefix, Object.fromEntries([...dirty].map((h) => [h, cache[h]])));
  if (now - lastPrune > PRUNE_EVERY_MS) {
    lastPrune = now;
    await store.prune(cfg.cachePrefix, CACHE_KEEP_MS).catch(() => 0);
  }
  if (cfg.queueMax !== undefined) stillQueued.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  await store.putJson(cfg.queueKey, cfg.queueMax === undefined ? stillQueued : stillQueued.slice(0, cfg.queueMax));
  await store.putJson(QUOTA_KEY, quota);
  await store.putJson(USAGE_KEY, calls24);

  return { verdicts, queued: stillQueued, modelNote };
}

/** A reading, checked, becomes a report — or a rejection with its reason. */
/**
 * The sources' vocabulary the model sometimes carries into English. Reworded
 * here: a real statement or strike must not be lost over one word.
 */
const REWORD: [RegExp, string][] = [
  [/\bthe Saudi (?:regime|adversary|aggressor)\b/gi, "Saudi Arabia"],
  [/\bthe (US|American|Israeli|Emirati) (?:adversary|aggressor|foe)\b/gi, "$1 forces"],
  [/\b(?:the )?(Saudi|US|American|Israeli|Zionist|Emirati|Houthi) enem(?:y|ies)\b/gi, "$1 forces"],
  [/\benemy (positions|forces|targets|aircraft|vessels|ships)\b/gi, "opposing $1"],
  [/\bthe enemy\b/gi, "the opposing side"],
  [/\benem(?:y|ies)\b/gi, "opponents"],
  [/\bthe (?:US-Saudi |Saudi-American |Saudi |American )?aggression\b/gi, "the Saudi-led coalition"],
  [/\baggression\b/gi, "attacks"],
  [/\bmartyrdom\b/gi, "death"],
  [/\bmartyred\b/gi, "killed"],
  // "killing a martyr" is one person killed, not "a people killed".
  [/\b(killing|kills|killed) (?:a|one) (?:martyr|people killed)\b/gi, "$1 one person"],
  [/\b(?:a|one) martyr\b/gi, "one person killed"],
  [/\bmartyrs?\b/gi, "people killed"],
  [/\ba people killed\b/gi, "one person killed"],
  [/\bmercenar(?:y|ies)\b/gi, "government forces"],
  [/\bZionist entity\b/gi, "Israel"],
  [/\bZionists?\b/gi, "Israeli"],
];

/**
 * "Yemeni" names two sides. Copy about a Houthi actor says "Houthi", copy
 * about a government actor says "Yemeni government", as the reader judged the
 * side. Fire on Saudi Arabia from Yemen is Houthi whoever reports it, so a
 * "Yemeni attack" on Saudis is Houthi even in readings made before the field.
 */
export function sideWords(s: string, side: string | undefined): string {
  let out = String(s || "");
  const onSaudi =
    (/^(?:Saree|Houthi|Al-Mashat)\b/.test(out) || /\b(?:Saudi|Riyadh|Jeddah|Yanbu|Jizan|Najran|Abha|Aramco|Dammam)\b/.test(out)) &&
    /\bYemeni (?:attacks?|drones?|missiles?|operations?|strikes?|armed forces)\b/i.test(out);
  if (side === "houthi" || (!side && onSaudi)) {
    out = out
      .replace(/\b(?:the )?Yemen(?:i|'s) armed forces\b/gi, "Houthi forces")
      .replace(/\b(?:the )?Yemen(?:i|'s) (foreign|defen[cs]e|interior|information|oil) ministry\b/gi, "the Houthi $1 ministry")
      .replace(/^the Houthi/, "The Houthi")
      .replace(/\b(?<!government )Yemeni (forces|army|military)\b/g, "Houthi forces")
      .replace(/\bYemeni (attacks?|drones?|missiles?|operations?|strikes?|drone attacks?|missile attacks?)\b/g, "Houthi $1")
      .replace(/\bYemen's (defen[cs]e minister|chief of staff|military spokesman|army)\b/g, "Houthi $1")
      .replace(/\bHouthi forces forces\b/g, "Houthi forces");
  } else if (side === "government") {
    out = out
      .replace(/\b(?:the )?Yemen(?:i|'s) armed forces\b/gi, "Yemeni government forces")
      .replace(/\b(?<!government )Yemeni (forces|army|troops)\b/g, "Yemeni government $1")
      .replace(/\bYemen's (defen[cs]e minister|chief of staff|army)\b/g, "Yemen's government $1");
  }
  // Against "Saudi-backed forces" the other side is the Houthis, whatever the
  // outlet calls them: "clashes between Yemeni forces and Saudi-backed forces".
  out = out
    .replace(/\bYemeni (?:government )?forces(?= and (?:Saudi|coalition)-backed forces\b)/g, "Houthi forces")
    .replace(/\b((?:Saudi|coalition)-backed forces and )Yemeni (?:government )?forces\b/g, "$1Houthi forces")
    // "Militia" is one side's word for the other; the desk says forces.
    .replace(/\bHouthi militias? (elements|members|fighters|positions|gatherings|reinforcements|leaders|commanders)\b/g, "Houthi $1")
    .replace(/\bHouthi militia (continues|targets|launches|attacks|fires|shells|uses|seeks|tries|keeps|pushes|deploys|claims|says|has|is|was)\b/g, (_m, v: string) =>
      `Houthi forces ${({ has: "have", is: "are", was: "were", tries: "try" } as Record<string, string>)[v] ?? v.replace(/(?<=ch|sh|ss|x)es$|s$/, "")}`)
    .replace(/\bHouthi militias?\b/g, "Houthi forces")
    .replace(/\bHouthi forces forces\b/g, "Houthi forces");
  return out;
}

/**
 * A government actor that is the Houthis after all (user, 3 Oct 14:16, "big
 * mistake"). Ali Bk's "القوات اليمنية تتقدم نحو الزعازع" went out as "Yemeni
 * government forces advance": a Houthi-aligned outlet calls the Houthis
 * "the Yemeni forces", and says الشرعية or names a government unit when it
 * means the government (Al-Aqsa TV: "القوات المسلحة اليمنية التابعة
 * للشرعية"). And the government never fires missiles or drones at Saudi
 * Arabia (Sabereen, 5 Oct: "Yemeni government forces launch missile and drone
 * strikes on Riyadh, Rabigh, Abha").
 */
const YEMENI_FORCES_AR = /القوات (?:المسلحة )?اليمنية|الجيش اليمني|قواتنا المسلحة|\bYemen(?:i|'s) (?:armed )?forces\b|\bYemeni army\b/i;
const GOV_WORDS = /لشرعي|الحكومي|التابعة للحكومة|الجيش الوطني|المقاومة الوطنية|العمالقة|درع الوطن|القوات الجنوبية|الانتقالي|مجلس القيادة|\bgovernment\b|\blegitima/i;
const GOV_COPY = /\bYemeni government (?:forces|army|troops)\b|\bgovernment forces\b/g;

/** An official body that posts its own statements, and the name a reader knows it by. */
const OFFICIAL_BODY = /Ministry|Foreign Office|spokesman|State Department|Embassy|CENTCOM|White House|Civil Defence|military axis/i;
const BODY_NAME: Record<string, string> = { "Sanaa Foreign Ministry": "Houthi foreign ministry", "Yemen Foreign Ministry": "Yemeni government foreign ministry" };
export function officialLead(headline: string, source: string): string {
  if (!OFFICIAL_BODY.test(source) || /^[^:]{2,70}:\s/.test(headline)) return headline;
  const name = BODY_NAME[source] ?? source;
  // It already names itself: "Saudi Foreign Ministry condemns …".
  if (new RegExp(OFFICIAL_BODY.exec(name)?.[0] ?? name, "i").test(headline)) return headline;
  return `${name}: ${headline}`;
}

const CLAIMED_ATTACK = new Set(["air_strike", "shelling", "missile_launch", "drone_attack", "ground_clash", "advance_or_capture", "maritime_attack"]);
/** A Houthi-aligned outlet's Houthi attack, led by who claims it unless the headline already says so. */
export function ownClaim(headline: string, actor: string | null | undefined, type: string, source: string): string {
  if (actor !== "houthi" || !CLAIMED_ATTACK.has(type)) return headline;
  if (/^[^:]{2,60}:\s/.test(headline) || /\b(?:say|says|said|claim|claims|claimed|reports?|reported|according|footage|video)\b/i.test(headline)) return headline;
  const who = /Masirah|^Saba|Thawrah|Ansarollah|Saree|^YPA$|Yemen Press Agency/i.test(source) ? "Houthi media" : "Houthi-aligned media";
  return `${who}: ${headline}`;
}
const FIRE_ON_SAUDI = /\b(?:missiles?|drones?|ballistic|UAVs?)\b.{0,80}\b(?:Saudi|Riyadh|Jeddah|Yanbu|Rabigh|Jizan|Jazan|Najran|Abha|Khamis Mushait|Aramco|Dammam|Khurais|Abqaiq|Ras Tanura|Taif|Medina)\b|\b(?:Saudi|Riyadh|Jeddah|Yanbu|Rabigh|Jizan|Jazan|Najran|Abha|Aramco)\b.{0,40}\b(?:hit|targeted|struck) by (?:missiles?|drones?)/i;
/**
 * Nor does it attack Saudi forces, their supplies or Saudi cities, whatever
 * side the reader gave (7 Oct, Al Mayadeen: "Yemeni government forces strike
 * Saudi military supplies at Badr camp"; 4 Oct, Shajab: "Yemeni government
 * forces target Dammam"; Al-Mihwar: "... launch wide attack on Saudi-aligned
 * militia sites").
 */
const GOV_ON_SAUDI =
  /^Yemeni government (?:forces|army|troops)\b[^.]{0,100}?\b(?:launch|fire|target|strike|attack|hit|shell|bomb|seiz|captur|advanc|reach|clash|expel|pursu|clear|driv)\w*\b[^.]{0,80}?\b(?:(?:Saudi|pro-Saudi|Saudi-(?:aligned|backed|led))\s+(?:military\s+)?(?:forces|troops|soldiers|officers|supplies|reinforcements|positions|bases?|camps?|gatherings|concentrations|militias?|militia sites|fighters|sites)|Riyadh|Jeddah|Yanbu|Rabigh|Jizan|Jazan|Najran|Abha|Khamis Mushait|Aramco|Dammam|Khurais|Abqaiq|Ras Tanura|Taif|Medina)\b/i;
/**
 * The Houthis' own words for the other side, which no government outlet uses
 * of its allies: "Saudi mobilisations", "Saudi infiltrations", "Saudi troop
 * concentrations", "Saudi government forces", "Saudi militias" (5-6 Oct:
 * Saree, Al-Masirah, Naya, Sabereen and Ali Bk each written as the government's).
 */
const SAUDI_FOE =
  /\b(?:(?:Saudi|pro-Saudi|Saudi-(?:aligned|backed|led))\s+(?:forces?\s+)?(?:troop\s+)?(?:mobili[sz]ations?|infiltrations?|militias?|mercenar\w+|concentrations|gatherings|crowds?|build-?ups?|targets)|Saudi government forces|opponents(?:['’])? (?:mobili[sz]ations?|concentrations|gatherings))\b/i;
/** Government forces striking the government's own units ("strike Shabwa Defence Forces and Saba Axis", Ali Bk, 6 Oct). */
const GOV_ON_OWN =
  /^Yemeni government (?:forces|army|troops)\s+(?:strike|target|attack|shell|ambush|bomb|hit)\w*\s+(?:\w+\s+){0,2}?(?:Giants|Nation's Shield|Shabwa Defen[cs]e|Saba Axis|Southern (?:forces|Armed)|National Resistance|Taiz (?:military )?axis)/i;
/** The government fires no ballistic missiles in this war (Al Mayadeen, 5 Oct: "three ballistic missile operations"). */
const GOV_BALLISTIC = /^Yemeni government (?:forces|army|troops)\b[^.]{0,60}?(?:\b(?:launch|fire|conduct)\w*\b[^.]{0,30}?\bballistic missiles?\b|\bwith ballistic missiles?\b)/i;
export function houthiAfterAll(side: string | null | undefined, copy: string, source: string, outlet: string): boolean {
  if (GOV_ON_SAUDI.test(copy) || GOV_ON_OWN.test(copy) || GOV_BALLISTIC.test(copy)) return true;
  // The first clause only: "…, while Houthi forces expel Saudi mobilisations" is another party.
  if (/^Yemeni government (?:forces|army|troops)\b/i.test(copy) && (SAUDI_FOE.test(copy.split(/[.;]\s|,? (?:while|as|amid) /)[0]) || /\bSaudi government forces\b/.test(copy))) return true;
  // No side given, and the copy kept the outlet's "Yemeni forces" (Ali Bk, 4
  // Oct: "Yemeni forces reach Al-Safaqi junction"): the same outlet test.
  const unsided = side == null && /\bYemeni (?:armed )?(?:forces|army)\b/.test(copy) && !/\bgovernment\b/i.test(copy);
  if (side !== "government" && !unsided) return false;
  if (/\bYemeni government forces (?:launch|fire|target|strike|attack)\w*/i.test(copy) && FIRE_ON_SAUDI.test(copy)) return true;
  return outlet === "houthi" && YEMENI_FORCES_AR.test(source) && !GOV_WORDS.test(source);
}

export function reword(s: string): string {
  let out = String(s || "");
  for (const [re, to] of REWORD) out = out.replace(re, to);
  return out.replace(/\bSaudi forces forces\b/g, "Saudi forces");
}

/** A channel's line of the Houthi leader's speech: his title, then a colon. */
const HOUTHI_LEADER_LINE = /^\s*(?:السيد القائد|قائد الثورة|السيد عبد ?الملك(?: بدر الدين)? الحوثي)[^:\n]{0,30}:/;

/**
 * Stories the reader keeps letting through that are not this war (user, 30 Sep):
 * piracy by Somali or unknown gunmen (the M/T Eureka's Egyptian crew), and the
 * separate US–Iran war. Out unless the copy or source names a party of this war.
 */
const OUR_WAR = /Yemen|اليمن|يمني|Sanaa|صنعاء|Aden|عدن|Houthis?|Ansar ?Allah|حوثي|انصار ?الله|Saree|سريع|Red Sea|البحر الأحمر|Bab al-?Mandab|باب المندب|Saudi|السعودي|coalition|التحالف/i;
const PARTY = /Houthis?|Ansar ?Allah|حوثي|انصار ?الله|coalition|التحالف|Saudi|السعودي|STC|الانتقالي|government forces|القوات الحكومية/i;
const PIRACY = /pira(?:cy|tes?)|hijack\w*|kidnap\w*|abduct\w*|قرصن|اختطاف|خطف|مختطف/i;
const CREW = /sailors?|crew|tanker|vessel|ship|بحار|طاقم|ناقلة|سفينة/i;
const SOMALI_OR_UNKNOWN = /Somali\w*|الصومال|unidentified|unknown gunmen|مجهول/i;
const IRAN_WAR = /\bIran\w*\b|إيران|ايران/i;
const US_SIDE = /\b(?:Trump|US|U\.S\.|United States|Washington|Pentagon|White House|American)\b|ترامب|واشنطن|الأمريكي|الامريكي/i;
export function notThisWar(copy: string, source: string): string | null {
  const t = `${copy}
${source}`;
  // Off Yemen's coast is still piracy unless a warring party did it.
  if (PIRACY.test(t) && CREW.test(t) && SOMALI_OR_UNKNOWN.test(t) && !PARTY.test(t)) return "piracy, not this war";
  if (OUR_WAR.test(t)) return null;
  if (IRAN_WAR.test(t) && US_SIDE.test(t)) return "the US–Iran war, not this one";
  return null;
}

function decide(raw: Reading, c: Candidate, strict = true): EditorVerdict {
  const away = raw.publish ? notThisWar(`${raw.headline}
${raw.body}`, c.text) : null;
  if (away) return { kind: "reject", reason: "other-theatre", note: sentence(away) };
  // Arabic left in the English copy and the sources' partisan words are fixed
  // here, not grounds for rejection.
  const r: Reading = { ...raw, headline: firstEvent(fixHeadline(westernDates(reword(respell(anglicise(raw.headline)))))), body: westernDates(reword(respell(anglicise(raw.body)))) };
  // The outlet is on the card: not in its headline, not in its body. And a
  // spokesperson or a role is only what the text says it is.
  r.headline = diplomatPost(dropInventedRole(spokespersonLabel(fixHeadline(stripOwnOutlet(r.headline, c.source)), c.source, c.text), c.text), c.text);
  r.body = stripOwnOutlet(r.body, c.source);
  if (r.speaker_lead) r.speaker_lead = dropInventedRole(spokespersonLabel(r.speaker_lead, c.source, c.text), c.text);
  // The model's headline led with its speaker and these fixes reworded that
  // lead ("US Embassy charge d'affaires Neal Hopp: US Embassy charge d'affaires
  // condemns …" → "US chargé d'affaires to Yemen condemns …"): the speaker is
  // the headline's new lead, not a miss.
  const sp = String(raw.speaker_lead || "").trim().toLowerCase();
  if (sp && raw.headline.trim().toLowerCase().startsWith(sp) && !r.headline.toLowerCase().startsWith(String(r.speaker_lead || "").toLowerCase())) {
    const own = /^([^:]{2,70}?)(?::\s| (?:calls|urges|warns|says|condemns|rejects|welcomes|demands|denies|accuses|announces|meets|discusses|stresses|affirms|vows|pledges|praises|thanks)\b)/.exec(r.headline)?.[1];
    if (own) r.speaker_lead = own;
  }
  // A Houthi-aligned outlet's "Yemeni forces" are the Houthis (user, 3 Oct).
  if (houthiAfterAll(raw.actor_side, `${r.headline} ${r.body}`, c.text, outletSide(c.source, c.lean))) {
    if (/\bHouthis?\b/.test(`${r.headline} ${r.body}`)) {
      return { kind: "reject", reason: "reader-check", note: "Wrong side: in this Houthi-aligned outlet \"Yemeni forces\" are the Houthis; the actor is Houthi, not the government." };
    }
    r.actor_side = "houthi";
    r.headline = r.headline.replace(GOV_COPY, "Houthi forces");
    r.body = r.body.replace(GOV_COPY, "Houthi forces");
  }
  // A Houthi-aligned outlet's own claim of a Houthi attack or its result is a
  // claim, not a fact: who says it goes first (user, 8 Oct: Al-Mihwar's
  // "Houthi ballistic missiles strike Saudi gatherings in Al-Turbah" went out bare).
  if (outletSide(c.source, c.lean) === "houthi") r.headline = ownClaim(r.headline, r.actor_side, r.event_type, c.source);
  // One side for both, judged on the whole copy: the body alone may not say "Saudi".
  const side = r.actor_side ?? (sideWords(`${r.headline} ${r.body}`, undefined) !== `${r.headline} ${r.body}` ? "houthi" : undefined);
  r.headline = sideWords(r.headline, side);
  r.body = sideWords(r.body, side);
  if (r.speaker_lead) r.speaker_lead = sideWords(r.speaker_lead, side);
  // An outlet is never the speaker. A statement whose headline forgot its
  // speaker gets the speaker put first, and a colon that introduces no words
  // of theirs ("Trump: held a call") becomes a plain sentence.
  let lead = String(r.speaker_lead || "").trim();
  if (OUTLET_LEAD.test(`${lead}:`)) lead = "";
  r.speaker_lead = lead || null;
  if ((r.event_type === "statement" || r.event_type === "diplomacy") && lead && !r.headline.toLowerCase().startsWith(lead.toLowerCase())) {
    r.headline = fixHeadline(`${lead}: ${r.headline.trim()}`);
  }
  // An official body's own post is its statement: it leads (user, 8 Oct: the
  // Sanaa foreign ministry's "Saudi Arabia continues crimes against Yemen" went out with no speaker).
  if ((r.event_type === "statement" || r.event_type === "diplomacy") && !r.speaker_lead) r.headline = officialLead(r.headline, c.source);
  // The name went to its role, or the colon was no quote: the lead follows.
  if (lead && !r.headline.toLowerCase().startsWith(lead.toLowerCase())) {
    const role = fixHeadline(lead);
    r.speaker_lead = r.headline.toLowerCase().startsWith(role.toLowerCase()) ? role : null;
  }
  // A speech line posted as "السيد القائد: …" is his words, whether or not the
  // model kept his name: the speaker goes first.
  if (HOUTHI_LEADER_LINE.test(c.text) && !/^Houthi leader\b/i.test(r.headline) && !r.headline.includes(":")) {
    r.headline = `Houthi leader: ${r.headline}`;
    r.speaker_lead = "Houthi leader";
  }
  // A place is spelled once; notes on its other spellings go.
  r.headline = stripSpellingNotes(r.headline);
  r.body = stripSpellingNotes(r.body);
  // A short report is its headline, its dead and wounded too (user, 2 Oct:
  // "Al-Masirah said the Saudi air strike wounds 2 people" was a body).
  if (r.body && sourceSentences(c.text) <= 4) {
    const h = casualtyHeadline(r.headline, r.body);
    if (h) [r.headline, r.body] = [h, ""];
  }
  // A body that only says the headline again goes.
  if (redundantBody(r.headline, r.body, c.text)) r.body = "";
  const problem = checkReading(r, c.text, strict);
  if (problem) {
    return { kind: "reject", reason: r.publish ? "reader-check" : "reader", note: sentence(problem) };
  }
  return { kind: "publish", report: toReport(r, c) };
}

function sentence(s: string): string {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1).replace(/[.\s]*$/, ".") : "";
}

/**
 * Places the model named that the gazetteer also finds in the source. A place
 * the model produced but the text does not contain never reaches the map.
 */
function groundedPlaces(names: string[], sourceText: string): Place[] {
  const inSource = new Map(placesIn(sourceText).map((p) => [p.name, p]));
  const out: Place[] = [];
  for (const n of names) {
    for (const p of placesIn(n)) {
      if (inSource.has(p.name) && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

/**
 * Where the report is: the model's `targets` first, and failing that the place
 * the desk's own headline names.
 *
 * The fallback exists because `targets` means "where a weapon was aimed", and a
 * great many field reports plainly state where they are without having one. A
 * ground advance has no target; a shelling death names a hill or a district the
 * gazetteer does not list. Measured over a day of published rows, 45 of 126
 * field reports carried no place, and most of those named a place the gazetteer
 * already knows — in the headline the desk itself published.
 *
 * The headline and not the body, because the headline is where the desk states
 * where this happened and the body is where it puts everything else. "Houthi
 * forces launch major offensive … in central Yemen" has a body reading "progress
 * toward Aden": the offensive is not at Aden, and the body would have pinned it
 * there.
 *
 * Origins are kept out for the same reason. The air bases aircraft took off
 * from are named in the same breath as the raids they flew, and pinning a
 * strike on Yemen at Khamis Mushait would be a lie the reader cannot see.
 *
 * Grounding is unchanged either way: a place must also appear in the source
 * text, so nothing the model invented reaches the map.
 */
function placesFor(r: Reading, sourceText: string): Place[] {
  const fromTargets = groundedPlaces(r.targets || [], sourceText);
  // The headline names the spot ("Southern forces capture Al-Bazilah mountain"),
  // the gazetteer does not know it, and the target it does know is not in the
  // headline: that target is the story's dateline or region ("Kahbub"), not
  // where this happened. No pin from it; the headline's spot is looked up.
  if (unknownSpots(r.headline || "").length && !fromTargets.some((p) => namedIn(r.headline || "", p))) return [];
  if (fromTargets.length) return fromTargets;
  const origins = new Set((r.origins || []).flatMap((o) => placesIn(o)).map((p) => p.name));
  return groundedPlaces([r.headline || ""], sourceText).filter((p) => !origins.has(p.name));
}

/** Spots the headline names that the gazetteer does not know: "Al-Bazilah mountain", "Jabal Qarfan". */
export function unknownSpots(headline: string): string[] {
  const low = headline.toLowerCase();
  return placeNamesIn(headline).filter((n) => {
    if (placesIn(n).length) return false;
    if (/^(?:Jabal|Jebel|Mount|Wadi)\b/i.test(n)) return true;
    const i = low.indexOf(n.toLowerCase());
    return i >= 0 && /^\s+(?:mountain|mount|hill|hills|heights|village|area)\b/i.test(headline.slice(i + n.length));
  });
}

const namedIn = (headline: string, p: Place) => headline.toLowerCase().includes(p.name.toLowerCase());

export function toReport(r: Reading, c: Candidate): LiveReport {
  // A "maritime_attack" that names no ship is typed by what its copy says.
  const type = maritimeType(TYPE_OF[r.event_type] ?? "statement", `${r.headline || ""} ${r.body || ""}`);
  const spoken = type === "statement" || type === "diplomacy";
  // Statements are never pinned and carry no dateline: the desk knows what was
  // said, not where.
  //
  // Unclear roles are no longer a reason to drop the place. `confident_roles` is
  // the model saying it cannot tell who did this to whom — which is a reason to
  // publish no `targets`, and it does — but "sirens sound in Najran", "violent
  // explosions reported in Taiz", "Saudi air strike hits a prison in Al-Jawf"
  // are all perfectly clear about *where*, and a pin asserts that something
  // happened there, not who caused it. Holding the place back on that gate kept
  // twelve such reports a day off the map for a fact none of them was unsure of.
  const places = spoken ? [] : placesFor(r, c.text);
  const dateline = datelineOf(places);
  const body = String(r.body || "").trim();
  const side = outletSide(c.source, c.lean);

  const row: LiveReport = {
    fp: c.fp,
    at: c.at,
    source: c.source,
    url: c.url,
    type,
    summary: r.headline.trim().replace(/[.\s]+$/, ""),
    // No body, no dateline: "KAHBUB — " on its own is an empty card.
    text: dateline && body ? `${dateline} — ${body}` : body,
    live: true,
    score: c.score,
    tier: side === "agency" ? "agency" : side === "neutral" ? "unverified" : "claim",
    tags: c.tags,
    side,
    interest: r.interest,
    hasTime: !!r.has_time,
  };
  const key = copyKey(c.text);
  if (key) row.copyKey = key;
  // The original always leads: it is never folded under a relay's card.
  if (r.duplicate_of && r.duplicate_of !== c.fp && !c.tags.includes("original")) row.duplicateOf = r.duplicate_of;
  else if (r.follows_up && r.follows_up !== c.fp) row.replyTo = r.follows_up;
  row.confidence = confidenceOf(row, []);
  // A ship is pinned at sea or in port, never on an inland town.
  const place = type === "vessel" ? seaPlace(places) : pinPlace(places);
  if (place) {
    row.place = place.name;
    row.lat = place.lat;
    row.lng = place.lng;
    // "63 nautical miles west of Yanbu" is at sea, not on the town.
    const moved = offsetFromText(`${row.summary}. ${c.text}`, place.name, place.lat, place.lng, type === "vessel");
    if (moved) [row.lat, row.lng] = moved;
  }
  return row;
}

/**
 * The spot a card is pinned on: the exact place it names (a village, a hill, a
 * district) before the governorate around it. When the text names governorates,
 * a Yemeni spot must lie inside one of them — "Al-Aghbara in Lahj" was pinned in
 * Taiz — and a spot that does not is no pin at all, never the governorate's
 * centre passed off as the place.
 */
export function pinPlace(places: Place[]): Place | undefined {
  const land = places.filter((p) => p.country !== "sea");
  const city = (p: Place) => /city$/.test(p.kind);
  // "Taiz" names the city and its governorate alike.
  const homes = new Set(
    land.filter((p) => p.kind === "governorate" || city(p)).map((g) => governorateAt(g.lat, g.lng)).filter(Boolean),
  );
  const fits = (p: Place) => {
    const at = governorateAt(p.lat, p.lng);
    return !homes.size || !at || homes.has(at);
  };
  const fine = land.filter((p) => p.kind !== "governorate" && p.kind !== "country");
  if (fine.length) {
    const first = fine.find(fits);
    if (!first) return undefined;
    // "Al-Wazi'iyah in Taiz": the district, not the city named after it.
    if (city(first)) {
      const home = governorateAt(first.lat, first.lng);
      const inside = fine.find((p) => !city(p) && home && governorateAt(p.lat, p.lng) === home);
      if (inside) return inside;
    }
    return first;
  }
  return land[0] || places[0];
}

/** The card's trust figure, given the sides of any outlets that also carried it. */
export function confidenceOf(r: LiveReport, corroboratedBy: OutletSide[]): number {
  return credibility({
    side: r.side ?? "neutral",
    statement: r.type === "statement" || r.type === "diplomacy",
    interest: r.interest ?? "neutral",
    hasPlace: !!r.place,
    hasFigure: /\d/.test(`${r.summary} ${r.text}`),
    hasTime: !!r.hasTime,
    corroboratedBy,
    record: recordOf(r.source),
  });
}

/** `decide` on a bare source text, for tests. */
export function decideForTest(r: Reading, text: string): EditorVerdict {
  return decide(r, { source: "Al-Masirah", url: "https://t.me/almasirah2/1", text, at: "2026-09-21T12:00:00Z", lean: "houthi", fp: "t", score: 1, tags: [] });
}

/**
 * Put candidates on the reader's queue for the next cycle: an original found
 * and read in full after this cycle's reading was done.
 */
export async function queueForReading(store: DeskStore, cands: Candidate[], now = Date.now(), key = QUEUE_KEY): Promise<void> {
  if (!cands.length) return;
  const queue = (await store.getJson<Queued[]>(key)) ?? [];
  for (const c of cands) if (!queue.some((q) => q.url === c.url)) queue.push({ ...c, queuedAt: now });
  await store.putJson(key, queue);
}

/* ------------------------------------------------------------------ *
 * The Iran desk's reading (Round 30 stage 3b)
 * ------------------------------------------------------------------ */

const IRAN_ALIGNMENT: Record<string, string> = {
  axis: "Iran or Axis-aligned (Iranian state media, Hezbollah, the Iraqi militias)",
  opposition: "Iranian opposition",
  israel: "Israeli",
  us: "US",
  gulf: "Gulf or Arab",
  intl: "international, no declared alignment",
};

/**
 * The Iran reader's checks: the same copy rules as Yemen's (every figure in
 * the source, no loaded words, a statement leads with its speaker), none of
 * Yemen's side rules. Every report is said as its teller's; no "claim" is added.
 */
function decideIran(raw: Reading, c: Candidate, strict = true): EditorVerdict {
  // The site's general copy rules, as on the Yemen desk (user, 8 Oct): Iran's
  // calendar out, one spelling per name, the outlet off its own copy, no
  // role the text did not give.
  const fix = (s: string) => westernDates(iranReword(reword(respell(anglicise(s)))));
  const r: Reading = { ...raw, headline: firstEvent(fixHeadline(fix(raw.headline))), body: fix(raw.body) };
  r.headline = dropInventedRole(fixHeadline(stripOwnOutlet(r.headline, c.source)), c.text);
  r.body = stripOwnOutlet(r.body, c.source);
  if (r.speaker_lead) r.speaker_lead = dropInventedRole(stripOwnOutlet(r.speaker_lead, c.source), c.text);
  let lead = String(r.speaker_lead || "").trim().replace(/\s*:+\s*$/, "");
  if (OUTLET_LEAD.test(`${lead}:`)) lead = "";
  r.speaker_lead = lead || null;
  // "US Secretary of State Rubio says …" names its speaker already: no "Marco Rubio:" in front (8 Oct).
  const surname = (lead.split(/\s+/).pop() ?? "").toLowerCase();
  const named = surname.length > 2 && r.headline.slice(0, 70).toLowerCase().split(/[^\p{L}'-]+/u).includes(surname);
  if (named && !r.headline.toLowerCase().startsWith(lead.toLowerCase())) r.speaker_lead = null;
  if ((r.event_type === "statement" || r.event_type === "diplomacy") && lead && !named && !r.headline.toLowerCase().startsWith(lead.toLowerCase())) {
    r.headline = fixHeadline(`${lead}: ${r.headline.trim()}`);
  }
  if ((r.event_type === "statement" || r.event_type === "diplomacy") && !r.speaker_lead) r.headline = officialLead(r.headline, c.source);
  r.headline = stripSpellingNotes(r.headline);
  r.body = stripSpellingNotes(r.body);
  // A short report is its headline, its dead and wounded too.
  if (r.body && sourceSentences(c.text) <= 4) {
    const h = casualtyHeadline(r.headline, r.body);
    if (h) [r.headline, r.body] = [h, ""];
  }
  if (redundantBody(r.headline, r.body, c.text)) r.body = "";
  // A speaker and a colon with nothing after it says nothing (8 Oct, "… deputy executive to Masoud Pezeshkian:").
  if (r.publish && /:\s*$/.test(r.headline.trim())) return { kind: "reject", reason: "reader-check", note: "Headline is only its speaker: say what they said." };
  // The rules the free models kept breaking (audit of 8 Oct), in code.
  const own = r.publish ? iranCopyProblem(r, c.text) : null;
  if (own) return { kind: "reject", reason: /^(?:commentary|yemen desk|not iran)/.test(own) ? "reader" : "reader-check", note: sentence(own) };
  const problem = checkReading(r, c.text, strict);
  if (problem) return { kind: "reject", reason: r.publish ? "reader-check" : "reader", note: sentence(problem) };
  const report = toReport(r, c);
  // The arenas and who acted travel as the card's labels (the store keeps them).
  const arenas = (r.arenas ?? []).filter((a) => a in IRAN_ARENAS).slice(0, 2);
  report.flags = [...(report.flags ?? []), ...arenas.map((a) => `arena:${a}`), ...(r.actor_side ? [`actor:${r.actor_side}`] : [])];
  report.desks = ["iran"];
  return { kind: "publish", report };
}

export const IRAN_READER: DeskReader = {
  desk: "iran",
  queueKey: deskKey("iran", QUEUE_KEY),
  cachePrefix: "iran-read",
  missedKey: deskKey("iran", MISSED_KEY),
  hash: iranContentHash,
  decide: (r, c, strict = true) => decideIran(r, c, strict),
  alignment: (c) => (isXPost(c) && !c.lean ? "an X account, no declared alignment" : IRAN_ALIGNMENT[c.lean] ?? "no declared alignment"),
  prompt: IRAN_PROMPT,
  // The lite models only: the strong ones write Yemen's 6-hour update.
  models: ["gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"],
  // The other free services first, so the Yemen reader's Gemini quota lasts the day.
  fallbacksFirst: true,
  // NVIDIA reads five items a call in a few seconds (8 Oct): six calls a cycle.
  maxCalls: 6,
  queueMax: 200,
  // A busy hour is 30 cards: the reader sees the day's last few hours, so a
  // story retold all afternoon is one card (audit of 8 Oct: ten for Araghchi's reply).
  recentMax: 60,
  secondLook: false,
  geocode: false,
};

/** `decideIran` on a bare source text, for tests. */
export function decideIranForTest(r: Reading, text: string, source = "Tasnim", lean = "axis"): EditorVerdict {
  return decideIran(r, { source, url: "https://t.me/Tasnimnews_EN/1", text, at: "2026-10-08T12:00:00Z", lean, fp: "ir-t", score: 1, tags: [] });
}
