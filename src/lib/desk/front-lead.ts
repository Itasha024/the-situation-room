/**
 * A front's point opened with the front itself ("In Saudi Arabia, ...", "In western Taiz governorate, ...")
 * says again what its title says (user, 27 Oct): the opening goes, and a part of the front it named
 * ("western") stays at the end.
 */
const SIDE = "north|south|east|west|north-?east|north-?west|south-?east|south-?west|central";
const words = (s: string) => s.toLowerCase().replace(/^al-/, "").split(/[\s-]+/).filter((w) => w.length > 2);

export function dropFrontLead(point: string, front: string): string {
  const m = new RegExp(String.raw`^(?:In|On|At|Across)\s+(?:the\s+)?(?:(${SIDE})(?:ern)?\s+(?:part\s+of\s+(?:the\s+)?)?)?([^,]{2,60}?),\s+`, "i").exec(point);
  if (!m) return point;
  const named = m[2].toLowerCase();
  const fw = words(front);
  if (!fw.length || !fw.some((w) => named.includes(w))) return point;
  // Only the front, its kind and the part: "governorate", "front", "coast", "province", "region", "area".
  const rest = fw.reduce((s, w) => s.replace(w, ""), named.replace(/^al-/, "")).replace(/\b(?:the|governorate|front|coast|province|region|area|city|strait|of|al|and)\b|[-\s]/g, "");
  if (rest) return point;
  let body = point.slice(m[0].length);
  body = body.charAt(0).toUpperCase() + body.slice(1);
  if (m[1]) body = `${body.replace(/\.?\s*$/, "")} (${m[1].toLowerCase()}ern ${front}).`;
  return body;
}
