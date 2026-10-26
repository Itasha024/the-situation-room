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

/**
 * The share of Gaza a report says the IDF holds (user, 26 Oct: the share by the IDF-held area, "update it … acc to
 * reports automatically"): "the IDF controls 58% of Gaza", "Israel holds some 53 percent of the Strip", "expanded the
 * area under its control to 60% of the Strip". Not a share of something else ("95% of entries", "unemployment 85%").
 */
export function heldShareIn(text: string): number | null {
  const t = String(text || "");
  const m = /\b(?:about |some |around |nearly |roughly |over |more than |almost |approximately )?(\d{2}(?:\.\d)?) ?(?:%|percent|per cent) of (?:the )?(?:Gaza(?: Strip)?|Strip|the enclave|enclave|Gaza's (?:territory|land|area))\b/i.exec(t);
  if (!m) return null;
  if (!/\b(?:IDF|Israel(?:i)?|army|military|troops|forces)\b/i.test(t) || !/\b(?:control\w*|hold\w*|held|occup\w*|behind the (?:yellow|orange) line|under (?:its|Israeli) (?:control|hold)|positions?|deployed)\b/i.test(t)) return null;
  const v = +m[1];
  return v >= 20 && v <= 90 ? v : null;
}

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
