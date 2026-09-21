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
import { type Place, placesIn } from "./gazetteer.ts";
import { type OutletSide, credibility, outletSide } from "./credibility.ts";
import {
  type EventType,
  type Reading,
  type ReaderItem,
  type RecentReport,
  READER_BATCH,
  checkReading,
  contentHash,
  groqKey,
  readBatch,
  readerKey,
} from "./reader.ts";
import type { DeskStore } from "./store.ts";
import type { DeskType } from "./digest.ts";
import type { LiveReport } from "./types.ts";
import { datelineOf } from "./wire-style.ts";

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

const CACHE_KEY = "reader-cache";
const QUEUE_KEY = "reader-queue";
const QUOTA_KEY = "reader-quota";
/** A model that answered 429 is left alone this long before it is tried again. */
const QUOTA_REST_MS = 6 * 3600 * 1000;
const CACHE_MAX = 6000;
/** A queued item older than this is no longer news; it is dropped from the queue. */
const QUEUE_TTL_MS = 24 * 3600 * 1000;
/** How far back, and how many, published reports the reader sees for follow-ups. */
const RECENT_MS = 24 * 3600 * 1000;
const RECENT_MAX = 40;
/** Model calls per cycle, so one busy cycle cannot spend the day's quota. */
const MAX_CALLS_PER_CYCLE = 5;

type CacheEntry = { reading: Reading; at: number };

/**
 * Rejections for thinness made before the rule that a headline stating a fact
 * about this war is publishable. Those alone are read again, rather than
 * re-reading the whole cache and spending the day's quota.
 */
const THIN_RULE_AT = Date.parse("2026-09-21T14:30:00+03:00");
const THIN_REASON = /substantive|teaser|headline|vague|brief|analy|recap|uninformative/i;
function stale(e: CacheEntry): boolean {
  return e.at < THIN_RULE_AT && !e.reading.publish && THIN_REASON.test(String(e.reading.reject_reason || ""));
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
  const cache = (await store.getJson<Cache>(CACHE_KEY)) ?? {};
  const queue = ((await store.getJson<Queued[]>(QUEUE_KEY)) ?? []).filter((q) => now - q.queuedAt < QUEUE_TTL_MS);

  // This cycle's items plus anything still waiting from earlier cycles.
  const byUrl = new Map<string, Queued>();
  for (const q of queue) byUrl.set(q.url, q);
  for (const c of fresh) byUrl.set(c.url, { ...c, queuedAt: byUrl.get(c.url)?.queuedAt ?? now });
  const all = [...byUrl.values()];

  const verdicts = new Map<string, EditorVerdict>();
  const readingOf = new Map<string, Reading>();
  const unread: Queued[] = [];
  for (const c of all) {
    const hit = cache[contentHash(c.text)];
    if (hit && !stale(hit)) {
      verdicts.set(c.url, decide(hit.reading, c));
      readingOf.set(c.url, hit.reading);
    } else unread.push(c);
  }

  // Models that ran out of daily quota recently are not asked again yet.
  const quota = (await store.getJson<Record<string, number>>(QUOTA_KEY)) ?? {};
  const skip = new Set(Object.keys(quota).filter((m) => now - quota[m] < QUOTA_REST_MS));

  // Read what is new, newest first, within this cycle's budget.
  const key = readerKey();
  const anyReader = !!key || !!groqKey();
  let modelNote = anyReader ? "" : "reader off: GEMINI_API_KEY not set";
  unread.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const stillQueued: Queued[] = [];
  let calls = 0;
  // What the desk already published today, so the reader can mark a direct
  // development of one of them as its follow-up.
  const recent: RecentReport[] = [];
  const refToFp = new Map<string, { fp: string; at: number }>();
  if (unread.length && anyReader) {
    try {
      const { reports } = await store.recentDesk(RECENT_MAX);
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
  for (let i = 0; i < unread.length; i += READER_BATCH) {
    const batch = unread.slice(i, i + READER_BATCH);
    if (!anyReader || calls >= MAX_CALLS_PER_CYCLE) {
      stillQueued.push(...batch);
      continue;
    }
    calls += 1;
    const items: ReaderItem[] = batch.map((c, n) => ({
      id: String(n),
      source: c.source,
      alignment: ALIGNMENT[outletSide(c.source, c.lean)],
      postedAt: c.at,
      text: c.text,
    }));
    const { readings, model, error, exhausted } = await readBatch(items, key, skip, recent);
    for (const m of exhausted) {
      quota[m] = now;
      skip.add(m);
    }
    if (error) modelNote = error;
    else if (model) modelNote = `read by ${model}`;
    batch.forEach((c, n) => {
      const r = readings.get(String(n));
      if (!r) {
        stillQueued.push(c);
        return;
      }
      // Refs mean nothing outside this call; keep the report's fp instead. A
      // reply only ever points back in time: an old post read late (a replay)
      // cannot follow up something published after it.
      const parent = refToFp.get(String(r.follows_up || ""));
      r.follows_up = parent && parent.at < Date.parse(c.at) ? parent.fp : "";
      cache[contentHash(c.text)] = { reading: r, at: now };
      verdicts.set(c.url, decide(r, c));
      readingOf.set(c.url, r);
    });
  }
  for (const c of stillQueued) {
    verdicts.set(c.url, { kind: "pending", note: "Waiting for the reader; retried next cycle." });
  }

  // A field event the gazetteer could not place: look its target up instead.
  const jobs: NeedsPlace[] = [];
  for (const c of all) {
    const v = verdicts.get(c.url);
    const r = readingOf.get(c.url);
    if (v?.kind !== "publish" || !r || v.report.place || !r.confident_roles) continue;
    if (v.report.type === "statement" || v.report.type === "diplomacy") continue;
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

  const kept = Object.entries(cache)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, CACHE_MAX);
  await store.putJson(CACHE_KEY, Object.fromEntries(kept));
  await store.putJson(QUEUE_KEY, stillQueued);
  await store.putJson(QUOTA_KEY, quota);

  return { verdicts, queued: stillQueued, modelNote };
}

/** A reading, checked, becomes a report — or a rejection with its reason. */
/**
 * The sources' vocabulary the model sometimes carries into English. Reworded
 * here: a real statement or strike must not be lost over one word.
 */
const REWORD: [RegExp, string][] = [
  [/\bthe (Saudi|US|American|Israeli|Zionist|Emirati|Houthi) enem(?:y|ies)\b/gi, "$1 forces"],
  [/\benemy (positions|forces|targets|aircraft|vessels|ships)\b/gi, "opposing $1"],
  [/\bthe enemy\b/gi, "the opposing side"],
  [/\benem(?:y|ies)\b/gi, "opponents"],
  [/\bthe (?:US-Saudi |Saudi-American |Saudi |American )?aggression\b/gi, "the Saudi-led coalition"],
  [/\baggression\b/gi, "attacks"],
  [/\bmartyrdom\b/gi, "death"],
  [/\bmartyred\b/gi, "killed"],
  [/\bmartyrs?\b/gi, "people killed"],
  [/\bmercenar(?:y|ies)\b/gi, "government forces"],
  [/\bZionist entity\b/gi, "Israel"],
  [/\bZionists?\b/gi, "Israeli"],
];

export function reword(s: string): string {
  let out = String(s || "");
  for (const [re, to] of REWORD) out = out.replace(re, to);
  return out.replace(/\bSaudi forces forces\b/g, "Saudi forces");
}

function decide(raw: Reading, c: Candidate): EditorVerdict {
  // Arabic left in the English copy and the sources' partisan words are fixed
  // here, not grounds for rejection.
  const r: Reading = { ...raw, headline: reword(anglicise(raw.headline)), body: reword(anglicise(raw.body)) };
  // A statement whose headline forgot its speaker gets the speaker put first.
  const lead = String(r.speaker_lead || "").trim();
  if ((r.event_type === "statement" || r.event_type === "diplomacy") && lead && !r.headline.toLowerCase().startsWith(lead.toLowerCase())) {
    r.headline = `${lead}: ${r.headline.trim()}`;
  }
  const problem = checkReading(r, c.text);
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

export function toReport(r: Reading, c: Candidate): LiveReport {
  const type = TYPE_OF[r.event_type] ?? "statement";
  const spoken = type === "statement" || type === "diplomacy";
  // Statements are never pinned and carry no dateline: the desk knows what was
  // said, not where. Unclear roles name no place at all.
  const places = spoken || !r.confident_roles ? [] : groundedPlaces(r.targets || [], c.text);
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
    text: dateline ? `${dateline} — ${body}` : body,
    live: true,
    score: c.score,
    tier: side === "agency" ? "agency" : side === "neutral" ? "unverified" : "claim",
    tags: c.tags,
    side,
    interest: r.interest,
    hasTime: !!r.has_time,
  };
  if (r.follows_up && r.follows_up !== c.fp) row.replyTo = r.follows_up;
  row.confidence = confidenceOf(row, []);
  const place = places.find((p) => p.country !== "sea") || places[0];
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
