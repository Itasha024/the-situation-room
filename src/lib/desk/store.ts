/**
 * Where the desk keeps what it has collected. Server-only.
 *
 * WHY THIS EXISTS
 * ---------------
 * The desk used to hold its scan cadence in a module-level `Map` and write its
 * results to `public/*.json`. Both assume one long-lived process with a
 * writable disk. Deployed on Vercel neither holds: every request may land on a
 * cold instance, and the filesystem is read-only. The writes failed silently —
 * both paths swallowed their errors — so the public desk froze at whatever was
 * baked into the build and nothing said so.
 *
 * So state goes behind this interface, with two drivers:
 *
 *   fs  — the JSON files, for local development. Survives restarts.
 *   pg  — Postgres (Neon), for deployment. Survives cold starts.
 *
 * Chosen by `DATABASE_URL` exactly as `src/lib/db.ts` picks its backend, so the
 * two never disagree about which world they are in.
 */

import type { DeskId } from "../desks.ts";
import type { DeskEventRow, DeskReportRow } from "./snapshot.ts";
import type { LiveReport, ScanPayload, ScanState } from "./types.ts";

export type StoreKind = "fs" | "pg";

/**
 * What the desk has accumulated, newest first — the whole feed, not one cycle.
 */
export type DeskSlice = {
  updatedAt: string | null;
  reports: DeskReportRow[];
  events: DeskEventRow[];
};

export interface DeskStore {
  readonly kind: StoreKind;

  /** Per-source cadence bookkeeping. Never throws — a missing store reads empty. */
  loadScanState(): Promise<ScanState>;
  saveScanState(state: ScanState): Promise<void>;

  /** The last completed scan payload, or null when the desk has never scanned. */
  loadPayload(): Promise<ScanPayload | null>;
  savePayload(payload: ScanPayload): Promise<void>;

  /**
   * Arbitrary durable state, keyed. Used for things that must survive a cold
   * start but are not the scan itself — the 6-hour brief and its history.
   */
  getJson<T>(key: string): Promise<T | null>;
  putJson(key: string, value: unknown): Promise<void>;
  deleteJson(key: string): Promise<void>;

  /**
   * Caches of many small entries (article leads by URL, readings by content
   * hash), one row each. They were one blob apiece, read and written whole
   * every tick: 12 MB a tick, the whole free database egress many times over.
   * Now a tick reads only the entries it looks up and writes only those it set.
   */
  getMany<T>(prefix: string, ids: string[]): Promise<Record<string, T>>;
  putMany(prefix: string, entries: Record<string, unknown>): Promise<void>;
  /**
   * Every entry under a prefix, removed as it is read: one desk's scan hands
   * the other its items this way (the Iran inbox), and nothing is taken twice.
   */
  takeMany<T>(prefix: string): Promise<T[]>;
  /** Drop a cache's entries not written for `olderThanMs`. */
  prune(prefix: string, olderThanMs: number): Promise<number>;

  /**
   * Fold new reports into the desk snapshot — the feed rows and the map pins.
   * Returns how many were genuinely new, so the tick can report real numbers
   * instead of claiming success it did not achieve.
   */
  mergeIntoDesk(reports: LiveReport[]): Promise<MergeResult>;

  /** When each of these cards was first published (fp → ISO), for those stored. */
  timesOf?(fps: string[]): Promise<Record<string, string>>;

  /**
   * Read the accumulated feed back out, newest first.
   *
   * WHY THIS EXISTS: `mergeIntoDesk` was write-only on the Postgres side. The
   * page renders the build-time `data.json` plus the last scan payload, so
   * deployed, every report the desk collected sat in `desk_report` and was
   * never shown — the feed could only ever be as long as one cycle, and a
   * report that scrolled out of a Telegram channel's recent window disappeared
   * from the public desk while still being stored. This is the read that makes
   * the feed a continuous stream instead of a rolling snapshot.
   *
   * `before` (an ISO time) pages back: only rows strictly older are returned,
   * so "Show earlier reports" can walk the whole archive a page at a time.
   *
   * `desk`: only the cards and pins shown on that desk. Without it, every
   * desk's — the scanner's own look-backs, which must see everything it kept.
   *
   * `reports: false` with `since`: the map's pins alone, back to a day. The
   * map's whole-war view had only the newest 2,000 cards' pins, so as days
   * passed its count stood still near 920 (8 Oct).
   */
  recentDesk(limit?: number, before?: string, opts?: RecentOpts): Promise<DeskSlice>;
}

export type RecentOpts = { events?: boolean; reports?: boolean; since?: string; desk?: DeskId };

export type MergeResult = {
  reportsAdded: number;
  eventsAdded: number;
  /**
   * Kept reports that should have produced a map pin but had no usable
   * coordinates. Surfaced rather than silently dropped — a gazetteer miss is a
   * bug to fix, not a report to lose.
   */
  unplaced: { fp: string; summary: string; place?: string }[];
  /** Set when persistence failed. The tick reports this instead of hiding it. */
  error?: string;
};

/**
 * What the store moved, for the status page: database bytes read and written
 * since the counter was last reset (the tick resets it at its start). Supabase
 * bills egress, so this is the figure to watch.
 */
export const dbMeter = { read: 0, written: 0, queries: 0 };
export function resetDbMeter(): void {
  dbMeter.read = 0;
  dbMeter.written = 0;
  dbMeter.queries = 0;
}

/**
 * A blob cache from before the per-row caches, moved once into rows and then
 * deleted. `idOf` turns the blob's key into the row id.
 */
export async function migrateBlob(
  store: DeskStore,
  blobKey: string,
  prefix: string,
  idOf: (key: string) => string = (k) => k,
): Promise<void> {
  const blob = await store.getJson<Record<string, unknown>>(blobKey);
  if (!blob || typeof blob !== "object") return;
  const rows: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(blob)) rows[idOf(k)] = v;
  await store.putMany(prefix, rows);
  await store.deleteJson(blobKey);
}

const rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
const databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : undefined;

export const storeKind: StoreKind = databaseUrl ? "pg" : "fs";

let storePromise: Promise<DeskStore> | null = null;

/**
 * The shared store. Memoized; a failed init is not cached, so the next tick
 * retries rather than inheriting a poisoned promise.
 */
export function getStore(): Promise<DeskStore> {
  storePromise ??= createStore().catch((err) => {
    storePromise = null;
    throw err;
  });
  return storePromise;
}

async function createStore(): Promise<DeskStore> {
  if (typeof window !== "undefined") {
    throw new Error("desk store is server-only — never import it from client code");
  }
  if (storeKind === "pg") {
    const { createPgStore } = await import("./store.pg.ts");
    return createPgStore();
  }
  const { createFsStore } = await import("./store.fs.ts");
  return createFsStore();
}
