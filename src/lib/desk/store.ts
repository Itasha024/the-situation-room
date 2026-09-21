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
   * start but are not the scan itself — the 12-hour brief and its history.
   */
  getJson<T>(key: string): Promise<T | null>;
  putJson(key: string, value: unknown): Promise<void>;

  /**
   * Fold new reports into the desk snapshot — the feed rows and the map pins.
   * Returns how many were genuinely new, so the tick can report real numbers
   * instead of claiming success it did not achieve.
   */
  mergeIntoDesk(reports: LiveReport[]): Promise<MergeResult>;

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
   */
  recentDesk(limit?: number, before?: string): Promise<DeskSlice>;
}

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
