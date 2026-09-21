/**
 * The desk's wire types.
 *
 * These live here rather than in `yemen-scan.server.ts` so the scanner and the
 * store can both refer to them without importing each other. `yemen-scan.server.ts`
 * re-exports them, so existing imports keep working.
 */

import type { DeskType } from "./digest.ts";

export type LiveReport = {
  fp: string;
  at: string;
  source: string;
  url: string;
  type: DeskType;
  /** Headline, English wire style, sentence case, no terminal stop. */
  summary: string;
  /** Full body: dateline, lead, attribution, caveat. */
  text: string;
  live: true;
  confidence?: number;
  place?: string;
  lat?: number;
  lng?: number;
  /** 1–100 interest score from the gate. */
  score?: number;
  tier?: "agency" | "claim" | "unverified";
  tags?: string[];
  /**
   * Other outlets that carried the same story. The best-sourced account leads
   * the card; these are kept and linked rather than deleted as duplicates.
   */
  alsoReportedBy?: { source: string; url: string }[];
};

export type RawScanHit = {
  source: string;
  url: string;
  snippet: string;
  /** Publication time as the source gives it. */
  at: string;
  /** When THIS desk first saw the item. The scan box sorts on this, newest first. */
  seenAt: string;
  kind: "tg" | "web";
  /** True only when the item reached the feed. */
  kept: boolean;
  /**
   * feed / tray / exclude. The tray is the ambiguous band: held in the scan
   * box, out of the feed, awaiting corroboration — never silently binned.
   */
  outcome?: "feed" | "tray" | "exclude";
  /** 0–100 confidence that this is about our conflict at all. */
  topicality?: number;
  reachable: boolean;
  /** "kept", or the gate's rejection slug: air-activity, rally, vague, thin… */
  reason: string;
  /** One sentence explaining the verdict. */
  note: string;
  tags?: string[];
};

export type SourceStatus = {
  id: string;
  name: string;
  kind: "tg" | "web";
  ok: boolean;
  cadence: string;
  hits: number;
};

export type ScanPayload = {
  ok: true;
  scannedAt: string;
  reports: LiveReport[];
  sourcesTried: number;
  sourcesOk: number;
  rawHits?: RawScanHit[];
  sourceStatus?: SourceStatus[];
  cycleNote?: string;
  /** Legend for the rejection slugs, so the UI can explain itself. */
  reasons?: { id: string; note: string }[];
  /**
   * Carried reports that belong on the map but had no usable coordinates —
   * a gazetteer miss. Surfaced so it can be fixed, rather than the report
   * quietly never appearing.
   */
  unplaced?: { fp: string; summary: string; place?: string }[];
};

/**
 * Per-source cadence bookkeeping.
 *
 * This used to be a module-level `Map`, which is why the deployed desk never
 * advanced: every Vercel cold start reset it, so the scanner either re-fetched
 * everything or believed it had never run. It belongs in the store.
 */
export type ScanState = {
  /** False only before the very first cycle — then every source is due. */
  scannedOnce: boolean;
  /** Source id (`tg:foo` / `web:bar`) → epoch ms of its last fetch. */
  lastScanAt: Record<string, number>;
  /** Epoch ms of the last completed tick, for health reporting. */
  lastTickAt?: number;
  /**
   * Channel id → highest Telegram post number already read. Lets a scan page
   * back through a busy channel to the last post it saw, instead of reading
   * only whatever fits on the channel's first page.
   */
  lastTgPost?: Record<string, number>;
};

export const EMPTY_SCAN_STATE: ScanState = { scannedOnce: false, lastScanAt: {} };
