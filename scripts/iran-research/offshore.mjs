// @ts-check
/**
 * At sea or on land, and a sea pin in its sea (user, 12 Oct: a Hormuz pin in the Red Sea; land pins under
 * "At sea"). One rule for the researched pins (map-pack.cjs, at build) and the desk's own (api/desk.ts, as served):
 * - At sea: a ship, a boat or "off" a place, or a point more than 3 km off the coast (Natural Earth land,
 *   public/iran-land.json). A tanker aircraft, a ship-repair yard or a naval base is not a ship.
 * - A sea pin whose words name a sea, and whose point is in none of the seas named, goes to that sea.
 * - A sea pin on land goes out to sea: by "N nm east of X" when the words give it, else to the nearest open
 *   water (the way the words point, if they say "north of", "east of"). A ship in a port stays at the port.
 */

/** @typedef {{ b: number[], r: number[][][] }} Poly */

/** The seas of this war: words that name them, a box that holds them [south, west, north, east], a point in each. */
export const SEAS = [
  { name: "Strait of Hormuz", re: /\b(?:Strait of Hormuz|Hormuz Strait|Hormuz)\b/i, box: [25.4, 55.4, 27.3, 57.5], at: [26.5667, 56.25] },
  { name: "Persian Gulf", re: /\b(?:Persian Gulf|Arabian Gulf)\b/i, box: [23.4, 47.6, 30.6, 57.0], at: [27.0, 51.5] },
  { name: "Gulf of Oman", re: /\b(?:Gulf of Oman|Sea of Oman|Oman Sea)\b/i, box: [22.0, 56.2, 26.6, 62.0], at: [24.5, 58.5] },
  { name: "Arabian Sea", re: /\bArabian Sea\b/i, box: [5.0, 51.0, 25.5, 76.0], at: [18.0, 62.0] },
  { name: "Red Sea", re: /\bRed Sea\b/i, box: [12.4, 32.2, 30.1, 43.6], at: [20.5, 38.5] },
  { name: "Gulf of Aden", re: /\bGulf of Aden\b/i, box: [10.4, 43.0, 15.2, 51.6], at: [12.5, 47.5] },
  { name: "Caspian Sea", re: /\bCaspian\b/i, box: [36.4, 46.5, 47.2, 55.2], at: [40.0, 51.0] },
  { name: "Mediterranean", re: /\bMediterranean\b/i, box: [30.0, 24.0, 37.8, 36.3], at: [33.9, 33.6] },
];

/** A ship, a boat, at sea. */
const SEA_WORDS = /\b(?:ships?|vessels?|tankers?|freighters?|boats?|speed-?boats?|dhows?|frigates?|destroyers?|warships?|carriers?|bulkers?|submarines?|corvettes?|minelayers?|minesweepers?|IRIS|USS|HMS|M\/[TV]|UKMTO|JMIC|at sea|offshore|anchorage)\b/i;
/** Words with "ship" or "tanker" in them that are not a ship. */
const NOT_A_SHIP = /anti-ship|ship[- ]?(?:repair|yard|building)\w*|shipyards?|KC-\d+\s+tankers?|tankers? (?:aircraft|planes?)|refuel+ing tankers?|tankers? and an? E-3|carrier-support/gi;
/** A tanker at an air base is an aircraft. */
const AIRFIELD = /\b(?:air ?base|airbase|airport|airfield)\b/i;
/** A ship in a port stays at the port. */
const IN_PORT = /\b(?:port|harbou?r|docked|berth(?:ed)?|pier|jetty|quay|dock)\b/i;
const BEARING = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
const DIR = String.raw`(north-?east|north-?west|south-?east|south-?west|north|south|east|west)`;

/** @param {number[][]} r @param {number} x @param {number} y */
function inRing(r, x, y) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** @param {number[]} box @param {number} lat @param {number} lng */
const inBox = (box, lat, lng) => lat >= box[0] && lat <= box[2] && lng >= box[1] && lng <= box[3];

/** The seas a text names, in the order it names them. @param {string} text */
export function seasNamed(text) {
  return SEAS.map((s) => ({ s, i: String(text || "").search(s.re) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i).map((x) => x.s);
}

/** Do the words say a ship or the sea? @param {string} label @param {string} [place] */
export function seaWords(label, place) {
  const l = String(label || "");
  const words = (AIRFIELD.test(l) ? l.replace(/\btankers?\b/gi, "") : l).replace(NOT_A_SHIP, "");
  return SEA_WORDS.test(words) || /^off /i.test(String(place || ""));
}

/** @param {Poly[]} land */
export function makeSea(land) {
  /** @param {number} lat @param {number} lng */
  const onLand = (lat, lng) => land.some((p) => lng >= p.b[0] && lng <= p.b[2] && lat >= p.b[1] && lat <= p.b[3] && inRing(p.r[0], lng, lat) && !p.r.slice(1).some((h) => inRing(h, lng, lat)));
  /** Km to the nearest coast (Infinity when none within about 10 km of a polygon's box). @param {number} lat @param {number} lng */
  function coastKm(lat, lng) {
    const k = Math.cos((lat * Math.PI) / 180);
    let best = Infinity;
    for (const p of land) {
      if (lng < p.b[0] - 0.1 || lng > p.b[2] + 0.1 || lat < p.b[1] - 0.1 || lat > p.b[3] + 0.1) continue;
      for (const r of p.r) for (let i = 1; i < r.length; i++) {
        const ax = (r[i - 1][0] - lng) * k, ay = r[i - 1][1] - lat, bx = (r[i][0] - lng) * k, by = r[i][1] - lat;
        const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy) * 111);
      }
    }
    return best;
  }
  /** The point `km` from a point on a bearing. @param {number} lat @param {number} lng @param {number} deg @param {number} km */
  const go = (lat, lng, deg, km) => {
    const a = (deg * Math.PI) / 180;
    return [lat + (km * Math.cos(a)) / 111, lng + (km * Math.sin(a)) / (111 * Math.cos((lat * Math.PI) / 180))];
  };
  /** Open water (not land, a km or more from the coast), in the named seas when there are any. @param {number[]} pt @param {object[]} named */
  const open = (pt, named) => !onLand(pt[0], pt[1]) && coastKm(pt[0], pt[1]) >= 1 && (!named.length || named.some((s) => inBox(/** @type {any} */ (s).box, pt[0], pt[1])));

  /**
   * Where a pin goes, and whether it is at sea.
   * A sea pin deep inland sits on a country's middle ("Off Fujairah" on the UAE's): `lookup` finds the town it names.
   * @param {{ lat: number, lng: number, label?: string | null, place?: string | null, text?: string | null, type?: string | null }} p
   * @param {(name: string) => number[] | null} [lookup]
   * @returns {{ lat: number, lng: number, sea: boolean, moved?: string }}
   */
  function place(p, lookup) {
    let { lat, lng } = p;
    const label = String(p.label || ""), where = String(p.place || "");
    const said = `${where} ${label}`;
    const land0 = onLand(lat, lng);
    const coast0 = land0 ? 0 : coastKm(lat, lng);
    const sea = p.type === "vessel" || seaWords(label, where) || (!land0 && coast0 > 3);
    if (!sea) return { lat, lng, sea: false };
    // The seas the words name ("the strait" alone is Hormuz's, in this war).
    let named = seasNamed(where).length ? seasNamed(where) : seasNamed(label);
    if (!named.length && /\b(?:the strait|transit route)\b/i.test(said)) named = [SEAS[0]];
    let moved;
    if (lookup && land0 && coastKm(lat, lng) > 20) {
      const town = where.replace(/^(?:the\s+)?(?:(?:sea|waters)\s+)?off\s+(?:the\s+)?/i, "").replace(/\s+(?:coast|port|offshore)$/i, "").split(",")[0].trim();
      const at = town ? lookup(town) : null;
      if (at && coastKm(at[0], at[1]) <= 5) [lat, lng, moved] = [at[0], at[1], `to ${town}`];
    }
    if (named.length && !named.some((s) => inBox(s.box, lat, lng))) [lat, lng, moved] = [named[0].at[0], named[0].at[1], `to the ${named[0].name}`];
    if (!onLand(lat, lng) && coastKm(lat, lng) >= 1) return { lat, lng, sea: true, moved };
    // On land or on the coast line: a ship in a port stays at the port.
    if (!moved && IN_PORT.test(said) && coastKm(lat, lng) <= 3) return { lat, lng, sea: true };
    // "60 nautical miles east of Muscat".
    const off = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*(nm|NM|nautical miles?|km|kilometres?|kilometers?|miles?)\s+(?:to the\s+)?${DIR}\s+of\b`, "i").exec(said);
    if (off) {
      const n = Number(off[1]), unit = off[2].toLowerCase();
      const km = Math.min(400, /^(?:nm|nautical)/.test(unit) ? n * 1.852 : /^mile/.test(unit) ? n * 1.609 : n);
      const pt = go(lat, lng, BEARING[/** @type {keyof typeof BEARING} */ (off[3].toLowerCase().replace(/-/g, ""))] ?? 0, km);
      if (!onLand(pt[0], pt[1])) return { lat: pt[0], lng: pt[1], sea: true, moved: `${off[0]}` };
    }
    // The nearest open water, the way the words point if they do ("north of Sharjah").
    const way = new RegExp(String.raw`\b${DIR}\s+of\b`, "i").exec(said);
    const want = way ? BEARING[/** @type {keyof typeof BEARING} */ (way[1].toLowerCase().replace(/-/g, ""))] : null;
    for (const r of [2, 4, 6, 9, 13, 18, 25, 35, 50, 70]) {
      /** @type {{ pt: number[], score: number }[]} */
      const ok = [];
      for (let d = 0; d < 360; d += 10) {
        const pt = go(lat, lng, d, r);
        if (!open(pt, named)) continue;
        const turn = want == null ? 0 : Math.abs((((d - want) % 360) + 540) % 360 - 180);
        ok.push({ pt, score: (want != null && turn <= 60 ? 1000 : 0) + coastKm(pt[0], pt[1]) });
      }
      if (ok.length) {
        const best = ok.sort((a, b) => b.score - a.score)[0].pt;
        return { lat: Math.round(best[0] * 1e4) / 1e4, lng: Math.round(best[1] * 1e4) / 1e4, sea: true, moved: moved ? `${moved}, then ${r} km out` : `${r} km out` };
      }
    }
    return { lat, lng, sea: true, moved };
  }
  return { onLand, coastKm, place };
}
