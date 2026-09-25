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
import { type NeedsPlace, geocodeJobs } from "./geocode.ts";
import { maritimeType, seaPlace } from "./maritime.ts";
import { type Place, placesIn } from "./gazetteer.ts";
import { type OutletSide, credibility, outletSide } from "./credibility.ts";
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
  fixHeadline,
  redundantBody,
  stripSpellingNotes,
  spokespersonLabel,
  stripOwnOutlet,
  contentHash,
  groqKey,
  readBatch,
  readerKey,
} from "./reader.ts";
import { type DeskStore, migrateBlob } from "./store.ts";
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
function stale(e: CacheEntry, c: Pick<Candidate, "url">): boolean {
  if (e.reading.publish) return false;
  const why = String(e.reading.reject_reason || "");
  if (e.at < THIN_RULE_AT && THIN_REASON.test(why)) return true;
  if (e.at < OSINT_RULE_AT && isXPost(c) && OSINT_REASON.test(why)) return true;
  return e.at < SCOPE_RULE_AT && SCOPE_REASON.test(why);
}

/** A post on an X account: the desk reads open-source analysts there. */
function isXPost(c: Pick<Candidate, "url">): boolean {
  return /^https:\/\/x\.com\/[^/]+\/status\//.test(c.url);
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

/** Is the reader switched on? Without a key the desk publishes nothing new. */
export function readerAvailable(): boolean {
  return !!readerKey() || !!groqKey();
}

/**
 * Decide every candidate. Candidates from the queue are folded in, and any
 * that cannot be read this cycle go back on it.
 */
export async function editCandidates(
  store: DeskStore,
  fresh: Candidate[],
  now = Date.now(),
): Promise<{ verdicts: Map<string, EditorVerdict>; queued: Candidate[]; modelNote: string }> {
  const queue = ((await store.getJson<Queued[]>(QUEUE_KEY)) ?? []).filter((q) => now - q.queuedAt < QUEUE_TTL_MS);

  // This cycle's items plus anything still waiting from earlier cycles.
  const byUrl = new Map<string, Queued>();
  for (const q of queue) byUrl.set(q.url, q);
  for (const c of fresh) byUrl.set(c.url, { ...c, queuedAt: byUrl.get(c.url)?.queuedAt ?? now });
  const all = [...byUrl.values()];

  // Only this cycle's readings are fetched, one row each, and only those
  // written this cycle are saved (the whole cache was 2.6 MB a tick each way).
  await migrateOnce(store);
  const cache: Cache = await store.getMany<CacheEntry>(CACHE_PREFIX, all.map((c) => contentHash(c.text)));
  const dirty = new Set<string>();
  const setEntry = (hash: string, e: CacheEntry) => {
    cache[hash] = e;
    dirty.add(hash);
  };

  const verdicts = new Map<string, EditorVerdict>();
  const readingOf = new Map<string, Reading>();
  const unread: Queued[] = [];
  for (const c of all) {
    const hit = cache[contentHash(c.text)];
    if (hit && !stale(hit, c)) {
      verdicts.set(c.url, decide(hit.reading, c, !hit.loose));
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
  const anyReader = !!key || !!groqKey();
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
      const { reports } = await store.recentDesk(RECENT_MAX, undefined, { events: false });
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
  for (let i = 0; i < toRead.length; i += READER_BATCH) {
    const batch = toRead.slice(i, i + READER_BATCH);
    if (!anyReader || calls >= MAX_CALLS_PER_CYCLE) {
      stillQueued.push(...batch);
      continue;
    }
    calls += 1;
    const items: ReaderItem[] = batch.map((c, n) => ({
      id: String(n),
      source: c.source,
      alignment: alignmentOf(c),
      postedAt: c.at,
      text: c.text,
      full: c.tags.includes("original"),
    }));
    const { readings, model, error, exhausted, minute } = await readBatch(items, key, skip, recent);
    count(model);
    for (const m of exhausted) {
      quota[m] = nextPacificMidnight(now);
      skip.add(m);
    }
    for (const m of minute) skip.add(m);
    if (error) modelNote = error;
    else if (model) modelNote = `read by ${model}`;
    batch.forEach((c, n) => {
      const r = readings.get(String(n));
      if (!r) {
        stillQueued.push(c);
        return;
      }
      unref(r, c);
      setEntry(contentHash(c.text), { reading: r, at: now });
      const v = decide(r, c);
      verdicts.set(c.url, v);
      readingOf.set(c.url, r);
      if (v.kind === "reject" && v.reason === "reader-check" && repairable(v.note)) fixes.push({ c, note: v.note });
    });
  }
  for (const [c, first] of copyOf) {
    const r = readingOf.get(first.url);
    if (!r) {
      stillQueued.push(c);
      continue;
    }
    const copy = { ...r };
    setEntry(contentHash(c.text), { reading: copy, at: now });
    verdicts.set(c.url, decide(copy, c));
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
      alignment: alignmentOf(c),
      postedAt: c.at,
      text: c.text,
      full: c.tags.includes("original"),
      fix: note,
    }));
    const res = await readBatch(items, key, skip, recent);
    count(res.model);
    const missed = (await store.getJson<Missed[]>(MISSED_KEY)) ?? [];
    batch.forEach(({ c, note }, n) => {
      const first = readingOf.get(c.url)!;
      const second = res.readings.get(String(n));
      if (second) unref(second, c);
      let outcome = "unread";
      let v = second ? decide(second, c) : undefined;
      let entry: CacheEntry | undefined = v?.kind === "publish" ? { reading: second!, at: now } : undefined;
      if (v?.kind === "publish") outcome = "published after repair";
      else {
        const loose = decide(second ?? first, c, false);
        if (loose.kind === "publish") {
          v = loose;
          entry = { reading: second ?? first, at: now, loose: true };
          outcome = `published as written: ${second ? (v as { note?: string }).note ?? "repair failed" : "no repair"}`;
        } else if (v) outcome = `rejected again: ${(v as { note?: string }).note ?? ""}`;
      }
      if (v?.kind === "publish" && entry) {
        verdicts.set(c.url, v);
        readingOf.set(c.url, entry.reading);
        setEntry(contentHash(c.text), entry);
      }
      missed.unshift({ at: new Date(now).toISOString(), source: c.source, url: c.url, text: c.text.replace(/\s+/g, " ").slice(0, 280), reason: `check: ${note}`, second: outcome });
    });
    await store.putJson(MISSED_KEY, missed.slice(0, MISSED_MAX));
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
  const doubt = all.filter((c) => {
    const r = readingOf.get(c.url);
    const v = verdicts.get(c.url);
    const entry = cache[contentHash(c.text)];
    if (!r || v?.kind !== "reject" || entry?.second) return false;
    // Attempted, but every model was resting: wait rather than ask again now.
    if (entry?.secondTriedAt && now - entry.secondTriedAt < SECOND_RETRY_MS) return false;
    if (/speech-rhetoric/i.test(String(r.reject_reason || ""))) return false;
    return fieldReport(c.text) || onRadar(c.text);
  });
  if (doubt.length) {
    const missed = (await store.getJson<Missed[]>(MISSED_KEY)) ?? [];
    const batch = doubt.slice(0, SECOND_LOOK_MAX);
    let second = new Map<string, Reading>();
    if (anyReader) {
      const items: ReaderItem[] = batch.map((c, n) => ({
        id: String(n),
        source: c.source,
        alignment: alignmentOf(c),
        postedAt: c.at,
        text: c.text,
      }));
      const res = await readBatch(items, key, skip, recent, SECOND_LOOK_MODELS);
      count(res.model);
      second = res.readings;
    }
    batch.forEach((c, n) => {
      const first = readingOf.get(c.url)!;
      const r = second.get(String(n));
      const hash = contentHash(c.text);
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
      const v = decide(r, c);
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
    await store.putJson(MISSED_KEY, missed.slice(0, MISSED_MAX));
  }

  // A field event the gazetteer could not place: look its target up instead.
  const jobs: NeedsPlace[] = [];
  for (const c of all) {
    const v = verdicts.get(c.url);
    const r = readingOf.get(c.url);
    if (v?.kind !== "publish" || !r || v.report.place) continue;
    if (v.report.type === "statement" || v.report.type === "diplomacy") continue;
    // A street address for a ship is a place on land: a ship is placed only from the gazetteer's waters and ports.
    if (v.report.type === "vessel") continue;
    const report = v.report;
    jobs.push({
      targets: r.targets || [],
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

  await store.putMany(CACHE_PREFIX, Object.fromEntries([...dirty].map((h) => [h, cache[h]])));
  if (now - lastPrune > PRUNE_EVERY_MS) {
    lastPrune = now;
    await store.prune(CACHE_PREFIX, CACHE_KEEP_MS).catch(() => 0);
  }
  await store.putJson(QUEUE_KEY, stillQueued);
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
      .replace(/\b(?<!government )Yemeni (forces|army|troops)\b/g, "Yemeni government $1")
      .replace(/\bYemen's (defen[cs]e minister|chief of staff|army)\b/g, "Yemen's government $1");
  }
  return out;
}

export function reword(s: string): string {
  let out = String(s || "");
  for (const [re, to] of REWORD) out = out.replace(re, to);
  return out.replace(/\bSaudi forces forces\b/g, "Saudi forces");
}

/** A channel's line of the Houthi leader's speech: his title, then a colon. */
const HOUTHI_LEADER_LINE = /^\s*(?:السيد القائد|قائد الثورة|السيد عبد ?الملك(?: بدر الدين)? الحوثي)[^:\n]{0,30}:/;

function decide(raw: Reading, c: Candidate, strict = true): EditorVerdict {
  // Arabic left in the English copy and the sources' partisan words are fixed
  // here, not grounds for rejection.
  const r: Reading = { ...raw, headline: fixHeadline(reword(anglicise(raw.headline))), body: reword(anglicise(raw.body)) };
  // The outlet is on the card: not in its headline, not in its body. And a
  // spokesperson or a role is only what the text says it is.
  r.headline = dropInventedRole(spokespersonLabel(fixHeadline(stripOwnOutlet(r.headline, c.source)), c.source, c.text), c.text);
  r.body = stripOwnOutlet(r.body, c.source);
  if (r.speaker_lead) r.speaker_lead = dropInventedRole(spokespersonLabel(r.speaker_lead, c.source, c.text), c.text);
  // One side for both, judged on the whole copy: the body alone may not say "Saudi".
  const side = raw.actor_side ?? (sideWords(`${r.headline} ${r.body}`, undefined) !== `${r.headline} ${r.body}` ? "houthi" : undefined);
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
  // A short report is its headline: a body that only says it again goes.
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
  if (fromTargets.length) return fromTargets;
  const origins = new Set((r.origins || []).flatMap((o) => placesIn(o)).map((p) => p.name));
  return groundedPlaces([r.headline || ""], sourceText).filter((p) => !origins.has(p.name));
}

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
  const place = type === "vessel" ? seaPlace(places) : places.find((p) => p.country !== "sea") || places[0];
  if (place) {
    row.place = place.name;
    row.lat = place.lat;
    row.lng = place.lng;
  }
  return row;
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
export async function queueForReading(store: DeskStore, cands: Candidate[], now = Date.now()): Promise<void> {
  if (!cands.length) return;
  const queue = (await store.getJson<Queued[]>(QUEUE_KEY)) ?? [];
  for (const c of cands) if (!queue.some((q) => q.url === c.url)) queue.push({ ...c, queuedAt: now });
  await store.putJson(QUEUE_KEY, queue);
}
