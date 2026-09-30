/**
 * A pin the text puts some way from its named place: "63 nautical miles west
 * of Yanbu", "a tanker attacked off Hodeidah". Pinned on the town, a ship
 * stood on dry land. The page does the same for older cards (app.js
 * offsetFromText).
 */

/** Which way the open sea lies from a coastal town (degrees, 0 = north, 90 = east). */
export const SEAWARD: Record<string, number> = {
  yanbu: 250, jeddah: 270, jidda: 270, jazan: 255, jizan: 255, "al-shuqaiq": 250, shuqaiq: 250, farasan: 250, "al-lith": 250, "al-qunfudhah": 250,
  hodeidah: 270, hudaydah: 270, "ras isa": 280, salif: 280, "al-salif": 280, "as-salif": 280, mocha: 270, mokha: 270, "al-mokha": 270, "al-khokha": 270, khokha: 270,
  midi: 270, dhubab: 250, aden: 180, mukalla: 170, "al-mukalla": 170, nishtun: 150, "ash-shihr": 160, shihr: 160, socotra: 0, "ras al-ara": 190,
};
const COMPASS: Record<string, number> = {
  north: 0, "north-east": 45, northeast: 45, east: 90, "south-east": 135, southeast: 135,
  south: 180, "south-west": 225, southwest: 225, west: 270, "north-west": 315, northwest: 315,
};
const DIST_RE =
  /(\d+(?:[.,]\d+)?)\s*(km|kilomet(?:er|re)s?|nautical miles?|nm|miles?)\s+(?:to the\s+)?((?:north|south)(?:-?(?:east|west))?|east|west)?\s*(?:off|of|from)\s+(?:the\s+)?(?:(?:coast|port|city|town) of\s+)?([A-Z][\w'’-]*(?:\s[A-Z][\w'’-]*)?)/g;
const OFF_RE = /\boff(?: the coast of)?\s+(?:the\s+)?(?:port of\s+)?([A-Z][\w'’-]*(?:\s[A-Z][\w'’-]*)?)/;

function moveBy(lat: number, lng: number, km: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const out: [number, number] = [lat + (km * Math.cos(r)) / 111, lng + (km * Math.sin(r)) / (111 * Math.cos((lat * Math.PI) / 180))];
  return [Math.round(out[0] * 1e4) / 1e4, Math.round(out[1] * 1e4) / 1e4];
}

/**
 * Where the text puts the event, or null to leave the pin on its place. A
 * ship with no direction goes out to sea from its port; a land event moves
 * only when the text gives a direction and more than 10 km.
 */
export function offsetFromText(text: string, place: string, lat: number, lng: number, ship: boolean): [number, number] | null {
  const t = String(text || "");
  const base = String(place || "").toLowerCase().replace(/^(?:the )?(?:red sea |gulf of aden )?off /, "").trim();
  if (!base || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const same = (name: string) => {
    const n = String(name || "").toLowerCase();
    return n === base || base.startsWith(n) || n.startsWith(base);
  };
  for (const m of t.matchAll(DIST_RE)) {
    if (!same(m[4])) continue;
    const n = parseFloat(m[1].replace(",", "."));
    if (!(n > 0) || n > 400) continue;
    const km = /naut|nm/i.test(m[2]) ? n * 1.852 : /mile/i.test(m[2]) ? n * 1.609 : n;
    const dir = m[3] ? COMPASS[m[3].toLowerCase().replace(/^(north|south)(east|west)$/, "$1-$2")] : undefined;
    const deg = dir ?? (ship ? SEAWARD[base] : undefined);
    if (deg === undefined || (!ship && km <= 10)) return null;
    return moveBy(lat, lng, km, deg);
  }
  if (ship && SEAWARD[base] !== undefined) {
    const off = t.match(OFF_RE);
    if (off && same(off[1])) return moveBy(lat, lng, 25, SEAWARD[base]);
  }
  return null;
}
