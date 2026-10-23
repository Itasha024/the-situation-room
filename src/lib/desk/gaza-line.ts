/**
 * The IDF-held part of Gaza (user, 24 Oct: "the IDF-controlled area pulled automatically as reports that
 * will affect the map", from OSINT mappers on X and Telegram).
 *
 * Two layers on the Gaza map:
 *  - the mapped area: the newest polygon a mapping project publishes as data (gaza-line.server.ts reads it),
 *    with its date and the share of the Strip it covers;
 *  - the reported moves since that date: every card the reader marked as the IDF moving its line or
 *    positions (`line:advance`, `line:withdraw`), pinned where it says, until a newer mapped area is out.
 */

export type LineMove = "advance" | "withdraw";

const BACK = /\b(?:withdr[ae]w\w*|pull(?:s|ed|ing)?\s+(?:back|out)|pull-?back|retreat\w*|evacuat\w+\s+(?:its\s+)?(?:positions?|posts?)|left\s+(?:its\s+)?(?:positions?|posts?)|redeploy\w*\s+(?:east|back))\b|انسحا?ب|تراجع/i;

/** Which way a card says the IDF line moved, or null when it tells no move. */
export function lineMoveOf(eventType: string | undefined, headline: string): LineMove | null {
  if (eventType !== "advance_or_capture") return null;
  return BACK.test(String(headline || "")) ? "withdraw" : "advance";
}

/** The Gaza Strip's land area, km², for the share the IDF holds. */
export const GAZA_KM2 = 365;

type Ring = [number, number][];
/** A ring's area in km² on the sphere (lng/lat degrees). */
function ringKm2(r: Ring): number {
  const R = 6378.137;
  const rad = Math.PI / 180;
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) a += (r[i + 1][0] - r[i][0]) * rad * (2 + Math.sin(r[i][1] * rad) + Math.sin(r[i + 1][1] * rad));
  return Math.abs((a * R * R) / 2);
}

/** A GeoJSON Polygon or MultiPolygon geometry's area in km² (holes taken off). */
export function areaKm2(geom: { type: string; coordinates: unknown }): number {
  const polys = (geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : []) as Ring[][];
  return polys.reduce((s, p) => s + (p.length ? ringKm2(p[0]) - p.slice(1).reduce((h, r) => h + ringKm2(r), 0) : 0), 0);
}
