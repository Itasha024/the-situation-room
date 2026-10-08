/**
 * The desk's wire types.
 *
 * These live here rather than in `yemen-scan.server.ts` so the scanner and the
 * store can both refer to them without importing each other. `yemen-scan.server.ts`
 * re-exports them, so existing imports keep working.
 */

import type { DeskId } from "../desks.ts";
import type { DeskType } from "./digest.ts";

/**
 * One picture or video on a card. `post` is the X or Telegram post it is
 * from (the fallback link); `src` a playable file (X), `embed` Telegram's
 * own player for the post; `thumb` the still shown before it plays.
 */
export type Media = {
  kind: "video" | "photo";
  from: "x" | "tg";
  post: string;
  thumb: string;
  src?: string;
  embed?: string;
  duration?: number;
  w?: number;
  h?: number;
  /** A post's other pictures, after the first: the card shows them one at a time. */
  more?: { thumb: string; w?: number; h?: number }[];
};

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
  /** Every place of a card written from several accounts (a wave of strikes): one map pin each. */
  places?: { name: string; lat: number; lng: number }[];
  /** 1–100 interest score from the gate. */
  score?: number;
  tier?: "agency" | "claim" | "unverified";
  tags?: string[];
  /**
   * Other outlets that carried the same story. The best-sourced account leads
   * the card; these are kept and linked rather than deleted as duplicates.
   */
  alsoReportedBy?: { source: string; url: string; summary?: string }[];
  /** The original a relaying post cites, while the original is not yet found. */
  citing?: string;
  /** fp of the earlier report this one directly develops; shown as a reply to it. */
  replyTo?: string;
  /** fp of a published report telling this same event with nothing new; folded into its "Also", never stored. */
  duplicateOf?: string;
  /** The post's picture or video, when it shows the event (media.ts). */
  media?: Media;
  /** Labels shown on the card: "exclusive" (a piece the outlet has on its own). */
  flags?: string[];
  /** The desks the card is shown on (desk-route.ts); none means Yemen's. */
  desks?: DeskId[];
  /** `copyKey` of the post it was written from: forwards of one post share it. */
  copyKey?: string;
  /** Inputs to the trust figure — see credibility.ts. */
  side?: "houthi" | "gov" | "neutral" | "agency";
  interest?: "for" | "against" | "neutral";
  hasTime?: boolean;
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
  kind: "tg" | "web" | "x";
  ok: boolean;
  cadence: string;
  hits: number;
  /**
   * Every item this feed returned was published after the previous read, so
   * the feed may have rolled over in between and older items scrolled off
   * unseen. Telegram pages back to the last post it saw; a web feed cannot,
   * so this is how a possible gap becomes visible instead of silent.
   */
  rolled?: boolean;
  /** A whole site's listing: articles it named, new to the desk, and picked by triage. */
  listed?: number;
  fresh?: number;
  picked?: number;
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
  /** Stored cards this cycle gave a new "Also"; saved to the desk, never kept in the payload. */
  touched?: LiveReport[];
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
  /** X handle → id of the newest post already read (ids grow with time). */
  lastXPost?: Record<string, string>;
  /** A whole site's last read: what its listing named, what was new, what triage picked. */
  sites?: Record<string, { at: number; ok: boolean; listed: number; fresh: number; picked: number; rolled: boolean }>;
};

export const EMPTY_SCAN_STATE: ScanState = { scannedOnce: false, lastScanAt: {} };
