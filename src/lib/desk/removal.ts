/**
 * Why a card was removed, noted at the moment it is removed (Round 27 Stage D,
 * user 2 Oct). A false report lowers its outlets' rating; a duplicate, an
 * out-of-scope card or the desk's own mistake does not.
 *
 * The reason is kept on the server (json:verdicts) and never shown.
 */

import type { RatedCard, Verdict } from "./source-rating.ts";

/** Why a card goes. The first four are the source's error; the rest are not. */
export const REMOVAL_WHY = [
  "false", // it did not happen
  "old-picture", // a picture of earlier damage put out as a new attack
  "false-figure", // a number that proved false
  "denied", // the speaker denies saying it
  "duplicate", // the same event as another card
  "out-of-scope", // not this war
  "desk-error", // our own mistake: a wrong place, a mixed-up text, a relay the outlet deleted
] as const;
export type RemovalWhy = (typeof REMOVAL_WHY)[number];

const AGAINST_SOURCE: Partial<Record<RemovalWhy, Verdict["verdict"]>> = {
  false: "false",
  "old-picture": "false",
  "false-figure": "false",
  denied: "denied",
};

export function isRemovalWhy(s: string): s is RemovalWhy {
  return (REMOVAL_WHY as readonly string[]).includes(s);
}

/**
 * The verdict a removal leaves, or null when the removal says nothing about
 * the source. The card itself is kept in it, so a removed card still counts
 * against the outlets that carried it.
 */
export function removalVerdict(
  why: RemovalWhy,
  reason: string,
  card: RatedCard,
  opts: { at?: string; link?: string; sources?: string[] } = {},
): Verdict | null {
  const verdict = AGAINST_SOURCE[why];
  if (!verdict) return null;
  const label = why === "old-picture" ? "a picture of earlier damage put out as a new attack" : why === "false-figure" ? "a figure that proved false" : "";
  return {
    verdict,
    reason: [label, reason].filter(Boolean).join(": ") || why,
    at: opts.at ?? new Date().toISOString(),
    ...(opts.link ? { link: opts.link } : {}),
    ...(opts.sources?.length ? { sources: opts.sources } : {}),
    card,
  };
}

/** The card as the rating reads it, from a desk_report row. */
export function ratedFromRow(r: Record<string, unknown>): RatedCard {
  const at = r.at instanceof Date ? r.at.toISOString() : String(r.at);
  return {
    fp: String(r.fp),
    at,
    source: String(r.source ?? ""),
    ...(typeof r.type === "string" ? { type: r.type } : {}),
    ...(typeof r.summary === "string" ? { summary: r.summary } : {}),
    ...(typeof r.lat === "number" && typeof r.lng === "number" ? { lat: r.lat, lng: r.lng } : {}),
    also: Array.isArray(r.also_reported_by) ? (r.also_reported_by as { source: string; url?: string }[]) : [],
  };
}
