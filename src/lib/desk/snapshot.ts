/**
 * Turning a composed report into the rows the desk stores.
 *
 * Both store drivers use this, so the filesystem desk and the Postgres desk can
 * never disagree about what becomes a feed row, what becomes a map pin, or what
 * counts as unplaceable. The previous code had this logic written twice — once
 * in the scanner, once inline — and the copies had already drifted.
 */

import { PLACE_BY_NAME } from "./gazetteer.ts";
import { alertCities } from "./copies.ts";
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
  /** Only when not Yemen's alone (desk-route.ts). */
  desks?: string[];
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
    ...(r.media ? { media: r.media } : {}),
    ...(r.flags?.length ? { flags: r.flags } : {}),
    // Yemen's alone, as every card before the Iran desk, carries nothing.
    ...(r.desks?.length && r.desks.join() !== "yemen" ? { desks: r.desks } : {}),
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
  // One alert test for the whole desk (copies.ts): sirens however worded.
  if (alertCities(r)) {
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
    // No listed city ("Makkah", "siren mode"): the report's own pin, as any other.
    if (events.length) return { events, unplaced: false };
  }

  if (!mapsAsPin(r.type)) return { events: [], unplaced: false };

  if (r.lat == null || r.lng == null) return { events: [], unplaced: true };

  // A card written from a wave names several places: a pin at each, all
  // opening the same card. The first is the card's own pin.
  const more = (r.places ?? []).filter((p) => p.name !== r.place);
  const extra: DeskEventRow[] = more.map((p) => ({
    fp: `${r.fp}-pin-${p.name.replace(/s+/g, "-")}`,
    at: r.at,
    type: r.type,
    lat: p.lat,
    lng: p.lng,
    place: p.name,
    label: r.summary,
    text: r.text,
    source: r.source,
    url: r.url,
    mapOnly: true,
  }));

  return {
    events: [
      ...extra,
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
