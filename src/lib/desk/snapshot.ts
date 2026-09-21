/**
 * Turning a composed report into the rows the desk stores.
 *
 * Both store drivers use this, so the filesystem desk and the Postgres desk can
 * never disagree about what becomes a feed row, what becomes a map pin, or what
 * counts as unplaceable. The previous code had this logic written twice — once
 * in the scanner, once inline — and the copies had already drifted.
 */

import { PLACE_BY_NAME } from "./gazetteer.ts";
import { mapsAsPin } from "./relevance.ts";
import type { LiveReport } from "./types.ts";

/** Cities named in an air-defence alert each get their own pin, so the map shows the spread. */
const ALERT_CITIES = [
  "Jeddah",
  "Taif",
  "Yanbu",
  "Khamis Mushait",
  "Abha",
  "Jazan",
  "Najran",
  "Al-Ula",
  "Mecca",
  "Riyadh",
  "Al-Kharj",
  "Farasan Islands",
];

const ALERT_RE = /air raid sirens|air defence alerts/i;

export type DeskReportRow = Record<string, unknown>;

export type DeskEventRow = {
  fp: string;
  at: string;
  type: string;
  lat: number;
  lng: number;
  place?: string;
  label: string;
  text?: string;
  source?: string;
  url?: string;
  mapOnly: boolean;
};

/** A link that points at a section front rather than one report is not a report. */
export function hasArticlePath(url: string): boolean {
  try {
    const u = new URL(url);
    return !!u.pathname && u.pathname !== "/" && !/^\/[a-z]{2}\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

export function toDeskReportRow(r: LiveReport): DeskReportRow {
  return {
    fp: r.fp,
    priority: r.type === "economy" ? 2 : 1,
    at: r.at,
    source: r.source,
    url: r.url,
    type: r.type,
    summary: r.summary,
    text: r.text,
    live: true,
    confidence: r.confidence || 3,
    score: r.score,
    tier: r.tier,
    ...(r.place ? { place: r.place } : {}),
    ...(r.lat != null ? { lat: r.lat, lng: r.lng } : {}),
    // Kept so the card can link the other outlets — dropping it here would
    // undo the grouping and leave the other accounts unreachable.
    ...(r.alsoReportedBy?.length ? { alsoReportedBy: r.alsoReportedBy } : {}),
    ...(r.replyTo ? { replyTo: r.replyTo } : {}),
    ...(r.citing ? { citing: r.citing } : {}),
    // Set only on rows the reader wrote; also the trust figure's inputs.
    ...(r.side ? { side: r.side, interest: r.interest, hasTime: r.hasTime } : {}),
  };
}

/**
 * The map pins a report should produce.
 *
 * `unplaced` is true when the report belongs on the map but has nowhere to go —
 * a gazetteer miss. The caller surfaces it rather than dropping it silently,
 * because a relevant report vanishing from the map with no trace is the failure
 * mode we most want to see.
 */
export function deriveEvents(r: LiveReport): { events: DeskEventRow[]; unplaced: boolean } {
  if (ALERT_RE.test(r.summary)) {
    const events: DeskEventRow[] = [];
    for (const name of ALERT_CITIES) {
      if (!r.summary.includes(name) && !(r.text || "").includes(name)) continue;
      const p = PLACE_BY_NAME[name];
      if (!p) continue;
      events.push({
        fp: `${r.fp}-pin-${name.replace(/\s+/g, "-")}`,
        at: r.at,
        type: "strike",
        lat: p.lat,
        lng: p.lng,
        place: p.name,
        label: `Air defence alerts in ${p.name}`,
        text: r.text,
        source: r.source,
        url: r.url,
        mapOnly: true,
      });
    }
    return { events, unplaced: events.length === 0 };
  }

  if (!mapsAsPin(r.type)) return { events: [], unplaced: false };

  if (r.lat == null || r.lng == null) return { events: [], unplaced: true };

  return {
    events: [
      {
        fp: r.fp,
        at: r.at,
        type: r.type,
        lat: r.lat,
        lng: r.lng,
        place: r.place,
        label: r.summary,
        text: r.text,
        source: r.source,
        url: r.url,
        mapOnly: false,
      },
    ],
    unplaced: false,
  };
}
