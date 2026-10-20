/**
 * Pure helpers for the live traffic layer's routes (user, 20 Oct: click an aircraft or ship and see
 * where it came from, where it is going and its real route; and every row must carry speed, track
 * and the time of the position so the map can move it at its real speed).
 *
 * No imports, so `node --experimental-strip-types --test` runs the checks directly.
 */

/** Aircraft row of GET /api/traffic (kind=air) `ac[]`. New fields only ever go at the end. */
export const AIR_ROW = {
  hex: 0, lat: 1, lon: 2, altFt: 3, speedKt: 4, trackDeg: 5, climbFpm: 6, squawk: 7, flight: 8, reg: 9,
  typeCode: 10, type: 11, operator: 12, military: 13, from: 14, to: 15, onGround: 16, ageSec: 17,
  /** unix seconds when the position was taken (ageSec counts from the answer's time) */
  posTime: 18,
  /** true heading in degrees when the aircraft sends it (track is the path over the ground) */
  headingDeg: 19,
  /** which open feed gave the position: "fi" adsb.fi, "lol" adsb.lol, "os" OpenSky Network */
  source: 20,
  /**
   * 1 = an estimate: no feed hears the aircraft any longer (a receiver hole), so it is moved on
   * from its last real position along its route (or its last track, ten minutes at most). For
   * these, ageSec is the time since the last real position and posTime the time of the estimate.
   */
  estimated: 21,
} as const;
export const AIR_ROW_LEN = 22;

/** Ship row of GET /api/traffic?kind=sea `ships[]`. New fields only ever go at the end. */
export const SEA_ROW = {
  mmsi: 0, name: 1, lat: 2, lon: 3, speedKt: 4, courseDeg: 5, headingDeg: 6, navStatus: 7, shipType: 8,
  destination: 9, callsign: 10, imo: 11, lengthM: 12, posTimeIso: 13,
  /** unix seconds when the position was received */
  posTime: 14,
  /** ETA the crew set in AIS (ISO, UTC), or null */
  eta: 15,
} as const;
export const SEA_ROW_LEN = 16;

/** The live traffic region (user, 20 Oct: every aircraft and ship in the region, without exception). */
export const AIR_BOX = { s: 8, n: 42, w: 25, e: 65 } as const;
/** Ships: also the Arabian Sea to India and the Gulf of Aden to its mouth. */
export const SEA_BOX = { s: 5, n: 42, w: 25, e: 70 } as const;
/** How long ship data is kept: positions six hours, name / type / destination a day. */
export const SEA_KEEP = { posMs: 6 * 3600_000, staticMs: 24 * 3600_000 } as const;
/** Drops ship positions past six hours and ships with neither a position nor static data of the day; at most `max` kept, those without a position going first. */
export function tidyShips<T extends { mmsi: number; t: number; sAt?: number }>(ships: Map<number, T>, now: number, max: number) {
  const cut = now - SEA_KEEP.posMs, statCut = now - SEA_KEEP.staticMs;
  for (const [k, s] of ships) {
    if (s.t && s.t < cut) s.t = 0;
    if (!s.t && !(s.sAt && s.sAt > statCut)) ships.delete(k);
  }
  if (ships.size > max) {
    const order = [...ships.values()].sort((a, b) => (a.t ? 1 : 0) - (b.t ? 1 : 0) || Math.max(a.t, a.sAt || 0) - Math.max(b.t, b.sAt || 0));
    for (const x of order.slice(0, ships.size - max)) ships.delete(x.mmsi);
  }
}
export const inAirBox = (lat: number, lon: number) => lat > AIR_BOX.s && lat < AIR_BOX.n && lon > AIR_BOX.w && lon < AIR_BOX.e;
export const inSeaBox = (lat: number, lon: number) => lat > SEA_BOX.s && lat < SEA_BOX.n && lon > SEA_BOX.w && lon < SEA_BOX.e;

/**
 * Circle centres that cover a lat/lon box with no hole: a hexagonal lattice of circles of
 * `radiusNm`, drawn at 88% of the radius (the columns widen with latitude, so the margin keeps
 * the corners between circles inside one). Checked on a 0.05° grid in the tests.
 */
export function lattice(box: { s: number; n: number; w: number; e: number }, radiusNm: number): [number, number][] {
  const rd = (radiusNm * 0.88) / 60;
  const out: [number, number][] = [];
  let row = 0;
  for (let la = box.s + rd * 0.7; la - rd * 0.7 < box.n; la += 1.5 * rd, row++) {
    const worst = Math.min(Math.max(Math.abs(la - rd / 2), Math.abs(la + rd / 2)), 80);
    const col = (Math.sqrt(3) * rd) / Math.cos((worst * Math.PI) / 180);
    for (let lo = row % 2 ? box.w - col / 2 : box.w; lo - col / 2 < box.e; lo += col) out.push([+la.toFixed(2), +Math.max(lo, box.w - col / 2).toFixed(2)]);
  }
  return out;
}

const R = Math.PI / 180;
const EARTH_KM = 6371;
export function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const x = Math.sin(((lat2 - lat1) * R) / 2) ** 2 + Math.cos(lat1 * R) * Math.cos(lat2 * R) * Math.sin(((lon2 - lon1) * R) / 2) ** 2;
  return EARTH_KM * 2 * Math.asin(Math.min(1, Math.sqrt(x)));
}
/** Initial great-circle bearing from 1 to 2, degrees 0–360. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const y = Math.sin((lon2 - lon1) * R) * Math.cos(lat2 * R);
  const x = Math.cos(lat1 * R) * Math.sin(lat2 * R) - Math.sin(lat1 * R) * Math.cos(lat2 * R) * Math.cos((lon2 - lon1) * R);
  return (Math.atan2(y, x) / R + 360) % 360;
}
export const angleDiff = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
/** Distance of p from the great circle through o and d, km. */
export function crossTrackKm(o: LatLon, d: LatLon, p: LatLon) {
  const d13 = km(o.lat, o.lon, p.lat, p.lon) / EARTH_KM;
  const t13 = bearing(o.lat, o.lon, p.lat, p.lon) * R;
  const t12 = bearing(o.lat, o.lon, d.lat, d.lon) * R;
  return Math.abs(Math.asin(Math.sin(d13) * Math.sin(t13 - t12)) * EARTH_KM);
}

export type LatLon = { lat: number; lon: number };

/** The point `distKm` from p on the initial bearing `brg` (great circle). */
export function destPoint(p: LatLon, brg: number, distKm: number): LatLon {
  const d = distKm / EARTH_KM, b = brg * R, la = p.lat * R, lo = p.lon * R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 / R, lon: ((lo2 / R + 540) % 360) - 180 };
}

/** Rules for continued tracks (user, 20 Oct: aircraft must not vanish into receiver holes). */
export const EST = {
  /** only aircraft last seen airborne, faster than this (kt) and higher than this (ft), are continued */
  minKt: 120, minFt: 5000,
  /** dropped this close to the destination (km): assumed arrived */
  arriveKm: 40,
  /** never continued longer than this (s) */
  maxSec: 3 * 3600,
  /** without a known route: on the last track for at most this (s) */
  noRouteSec: 600,
} as const;
export type LastFix = LatLon & { t: number; gs: number; track: number; alt?: number | null; rate?: number | null };
export type Estimate = LatLon & { track: number; alt: number | null; done: null | "arrived" | "landed" | "too-long" | "no-route" };

/** Should an aircraft that every feed has stopped hearing be continued? */
export function continues(alt: unknown, gs: unknown, track: unknown) {
  return typeof alt === "number" && alt > EST.minFt && typeof gs === "number" && gs > EST.minKt && typeof track === "number" && Number.isFinite(track);
}

/**
 * Where an aircraft last heard at `last` is now (unix s), at its last ground speed: along the
 * great circle to `dest` when its route is known, else straight on its last track. `done` says
 * it should be dropped: within 40 km of the destination (arrived), descending to below 2,000 ft on
 * its last rate (landed), three hours on, or ten minutes on with no route.
 */
export function project(last: LastFix, dest: LatLon | null, nowSec: number): Estimate {
  const dt = Math.max(0, nowSec - last.t);
  const dist = (last.gs * 1.852 * dt) / 3600;
  let alt = typeof last.alt === "number" ? last.alt : null;
  if (alt != null && typeof last.rate === "number" && last.rate < -500) alt = alt + (last.rate * dt) / 60;
  let p: LatLon, track: number, done: Estimate["done"] = null;
  if (dest) {
    const total = km(last.lat, last.lon, dest.lat, dest.lon);
    if (total - dist <= EST.arriveKm) { p = dest; track = bearing(last.lat, last.lon, dest.lat, dest.lon); done = "arrived"; }
    else {
      p = destPoint(last, bearing(last.lat, last.lon, dest.lat, dest.lon), dist);
      track = bearing(p.lat, p.lon, dest.lat, dest.lon);
    }
  } else {
    p = destPoint(last, last.track, dist);
    track = last.track;
    if (dt > EST.noRouteSec) done = "no-route";
  }
  if (!done && alt != null && alt < 2000) done = "landed";
  if (!done && dt > EST.maxSec) done = "too-long";
  return { lat: +p.lat.toFixed(4), lon: +p.lon.toFixed(4), track: Math.round(track), alt: alt == null ? null : Math.max(0, Math.round(alt)), done };
}
export type Place = LatLon & { name: string; iata?: string | null; icao?: string | null; city?: string | null };
export type Fit = { ok: boolean; lengthKm: number; offKm: number; detourKm: number; headingOff: number | null; why: string };

/**
 * Is a flight at `p` flying `track` plausibly on the way from `o` to `d`?
 * - within max(300 km, 25% of the route) of the great circle,
 * - not a long way beyond either end (origin→p→destination at most max(400 km, 35%) longer than the route),
 * - its track points at the destination within 60° (skipped within 200 km of either end, where
 *   aircraft climb out, hold and line up; and when the track is unknown).
 */
export function routeFits(o: LatLon, d: LatLon, p: LatLon, track: number | null | undefined, maxHeadingOff = 60): Fit {
  const lengthKm = km(o.lat, o.lon, d.lat, d.lon);
  const toO = km(o.lat, o.lon, p.lat, p.lon), toD = km(p.lat, p.lon, d.lat, d.lon);
  const offKm = crossTrackKm(o, d, p);
  const detourKm = toO + toD - lengthKm;
  const nearEnd = Math.min(toO, toD) < 200;
  const headingOff = typeof track === "number" && Number.isFinite(track) && toD > 1 ? angleDiff(bearing(p.lat, p.lon, d.lat, d.lon), track) : null;
  const r = (n: number) => Math.round(n);
  const base = { lengthKm: r(lengthKm), offKm: r(offKm), detourKm: r(detourKm), headingOff: headingOff == null ? null : r(headingOff) };
  if (lengthKm < 20) return { ok: false, ...base, why: "origin and destination are the same place" };
  if (offKm > Math.max(300, 0.25 * lengthKm)) return { ok: false, ...base, why: "too far off the line between the airports" };
  if (detourKm > Math.max(400, 0.35 * lengthKm)) return { ok: false, ...base, why: "beyond one end of the route" };
  if (!nearEnd && headingOff != null && headingOff > maxHeadingOff) return { ok: false, ...base, why: "not heading for the destination" };
  return { ok: true, ...base, why: "fits" };
}

export type Candidate = { source: string; origin: Place; destination: Place };
export type TrackPoint = [number, number, number]; // lat, lon, unix seconds
export type Pick = { origin: Place | null; destination: Place | null; source: string[]; confidence: "confirmed" | "likely" | "unknown"; checks: { source: string; route: string; fit: Fit }[] };

const code = (p: Place) => (p.icao || p.iata || p.name || "").toUpperCase();
const same = (a: Place, b: Place) => (a.icao && b.icao ? a.icao === b.icao : a.iata && b.iata ? a.iata === b.iata : km(a.lat, a.lon, b.lat, b.lon) < 15);

/**
 * Picks the route that fits the live position. `start` is the first point of a flown track that
 * began low (a take-off a receiver saw), when there is one: a route whose origin is far from it is
 * wrong, one whose origin is near it is confirmed.
 * Confirmed = fits and (a second source says the same, or the take-off was seen there);
 * likely = fits but only one source and no take-off seen; unknown = nothing fits (no airport is
 * better than a wrong one).
 */
export function pickRoute(cands: Candidate[], pos: (LatLon & { track?: number | null }) | null, start: LatLon | null): Pick {
  const checks: Pick["checks"] = [];
  const seenAtOrigin = (c: Candidate) => !!start && km(start.lat, start.lon, c.origin.lat, c.origin.lon) < 80;
  const detour = new Set<Candidate>();
  const good: Candidate[] = [];
  for (const c of cands) {
    let fit = pos ? routeFits(c.origin, c.destination, pos, pos.track) : { ok: true, lengthKm: Math.round(km(c.origin.lat, c.origin.lon, c.destination.lat, c.destination.lon)), offKm: 0, detourKm: 0, headingOff: null, why: "no live position to check" };
    // Seen taking off from this origin: war-time detours (round closed airspace, down the Red Sea)
    // may point well away from the destination for a while, so the heading is held to 100°.
    if (!fit.ok && pos && seenAtOrigin(c) && fit.why === "not heading for the destination") {
      const loose = routeFits(c.origin, c.destination, pos, pos.track, 100);
      if (loose.ok) { fit = { ...loose, why: "fits, on a detour (take-off seen at the origin)" }; detour.add(c); }
    }
    if (fit.ok && start && km(start.lat, start.lon, c.origin.lat, c.origin.lon) > 150) { fit.ok = false; fit.why = "the take-off was seen elsewhere"; }
    checks.push({ source: c.source, route: `${code(c.origin)}-${code(c.destination)}`, fit });
    if (fit.ok) good.push(c);
  }
  if (!good.length) return { origin: null, destination: null, source: [], confidence: "unknown", checks };
  const agree = (c: Candidate) => good.filter((g) => same(g.origin, c.origin) && same(g.destination, c.destination));
  const seenAt = seenAtOrigin;
  // Best: seen take-off there, then most sources agreeing, then nearest the line.
  const score = (c: Candidate) => (seenAt(c) ? 100 : 0) + agree(c).length * 10 - (checks.find((k) => k.source === c.source && k.route === `${code(c.origin)}-${code(c.destination)}`)?.fit.offKm ?? 0) / 1000;
  const best = [...good].sort((a, b) => score(b) - score(a))[0];
  const sources = [...new Set(agree(best).map((c) => c.source))];
  const confirmed = !!pos && !detour.has(best) && (sources.length >= 2 || seenAt(best));
  return { origin: best.origin, destination: best.destination, source: seenAt(best) ? [...sources, "take-off seen in the flown track"] : sources, confidence: confirmed ? "confirmed" : "likely", checks };
}

/**
 * A capped position history: one point per `everySec`,
 * at most `keepSec` back and `maxPoints` long (and `maxKeys` vehicles), kept flat
 * (lat, lon, t, lat, lon, t, ...) to stay small on a 1 GB server.
 */
export class History {
  readonly map = new Map<string | number, number[]>();
  readonly everySec: number;
  readonly keepSec: number;
  readonly maxPoints: number;
  readonly maxKeys: number;
  constructor(everySec: number, keepSec: number, maxPoints: number, maxKeys: number) {
    this.everySec = everySec;
    this.keepSec = keepSec;
    this.maxPoints = maxPoints;
    this.maxKeys = maxKeys;
  }
  add(key: string | number, lat: number, lon: number, t: number) {
    let h = this.map.get(key);
    if (!h) {
      if (this.map.size >= this.maxKeys) return;
      h = [];
      this.map.set(key, h);
    }
    const n = h.length;
    if (n && t - h[n - 1] < this.everySec) return;
    h.push(+lat.toFixed(4), +lon.toFixed(4), Math.round(t));
    let drop = 0;
    while (drop + 3 <= h.length && (h[drop + 2] < t - this.keepSec || (h.length - drop) / 3 > this.maxPoints)) drop += 3;
    if (drop) h.splice(0, drop);
  }
  get(key: string | number): TrackPoint[] {
    const h = this.map.get(key) || [];
    const out: TrackPoint[] = [];
    for (let i = 0; i + 2 < h.length; i += 3) out.push([h[i], h[i + 1], h[i + 2]]);
    return out;
  }
  /** Drops keys whose last point is older than `cutSec`. */
  prune(cutSec: number) {
    for (const [k, h] of this.map) if (!h.length || h[h.length - 1] < cutSec) this.map.delete(k);
  }
}

/** Joins tracks (each [lat, lon, t]) by time, drops repeats, and thins it to at most `max` points. */
export function joinTracks(max: number, ...tracks: TrackPoint[][]): TrackPoint[] {
  const all = tracks.flat().filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).sort((a, b) => a[2] - b[2]);
  const out: TrackPoint[] = [];
  for (const p of all) {
    const q = out[out.length - 1];
    if (q && (p[2] - q[2] < 5 || (p[0] === q[0] && p[1] === q[1]))) continue;
    out.push(p);
  }
  if (out.length <= max) return out;
  const step = (out.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => out[Math.round(i * step)]);
}

/** AIS ETA {Month, Day, Hour, Minute} to ISO; null when not set (month or day 0, hour 24, minute 60). */
export function aisEta(e: unknown, now = Date.now()): string | null {
  if (!e || typeof e !== "object") return null;
  const { Month: mo, Day: d, Hour: h, Minute: mi } = e as Record<string, number>;
  if (!mo || !d || mo > 12 || d > 31 || h > 23 || mi > 59) return null;
  const y = new Date(now).getUTCFullYear();
  let t = Date.UTC(y, mo - 1, d, h || 0, mi || 0);
  if (t < now - 60 * 86_400_000) t = Date.UTC(y + 1, mo - 1, d, h || 0, mi || 0);
  if (t > now + 300 * 86_400_000) t = Date.UTC(y - 1, mo - 1, d, h || 0, mi || 0);
  return new Date(t).toISOString();
}

/**
 * Ports of the region and its approaches, for naming a ship's AIS destination (crews type it
 * freely: a UN/LOCODE, a name, often abbreviated) and the place a ship last stopped.
 */
export const PORTS: { name: string; code: string; lat: number; lon: number; alias?: string[] }[] = [
  { name: "Jebel Ali", code: "AEJEA", lat: 25.01, lon: 55.06, alias: ["JEBEL ALI", "JEBELALI", "JEA", "J.ALI"] },
  { name: "Dubai (Port Rashid)", code: "AEDXB", lat: 25.27, lon: 55.27, alias: ["DUBAI", "PORT RASHID", "AE DXB"] },
  { name: "Khor Fakkan", code: "AEKLF", lat: 25.35, lon: 56.36, alias: ["KHOR FAKKAN", "KHORFAKKAN"] },
  { name: "Fujairah", code: "AEFJR", lat: 25.17, lon: 56.36, alias: ["FUJAIRAH", "FUJ", "AEFUJ", "FUJAIRAH ANCH"] },
  { name: "Abu Dhabi (Khalifa)", code: "AEKHL", lat: 24.81, lon: 54.65, alias: ["KHALIFA", "ABU DHABI", "AEAUH"] },
  { name: "Ruwais", code: "AERUW", lat: 24.12, lon: 52.73, alias: ["RUWAIS"] },
  { name: "Das Island", code: "AEDAS", lat: 25.15, lon: 52.87, alias: ["DAS ISLAND"] },
  { name: "Sharjah", code: "AESHJ", lat: 25.37, lon: 55.38, alias: ["SHARJAH", "HAMRIYAH"] },
  { name: "Ras al-Khaimah (Saqr)", code: "AERKT", lat: 25.85, lon: 56.05, alias: ["RAS AL KHAIMAH", "SAQR", "AESQR"] },
  { name: "Hamad Port", code: "QAHMD", lat: 25.02, lon: 51.63, alias: ["HAMAD", "DOHA", "QADOH"] },
  { name: "Ras Laffan", code: "QARLF", lat: 25.91, lon: 51.58, alias: ["RAS LAFFAN", "RASLAFFAN"] },
  { name: "Mesaieed", code: "QAMES", lat: 24.99, lon: 51.57, alias: ["MESAIEED", "MESAIED", "UMM SAID"] },
  { name: "Khalifa Bin Salman (Bahrain)", code: "BHKBS", lat: 26.2, lon: 50.71, alias: ["BAHRAIN", "KBS", "SITRA", "BHMIN"] },
  { name: "Dammam", code: "SADMM", lat: 26.5, lon: 50.2, alias: ["DAMMAM", "KING ABDULAZIZ"] },
  { name: "Ras Tanura", code: "SARTA", lat: 26.64, lon: 50.16, alias: ["RAS TANURA", "RASTANURA"] },
  { name: "Jubail", code: "SAJUB", lat: 27.03, lon: 49.68, alias: ["JUBAIL", "AL JUBAIL"] },
  { name: "Ras al-Khair", code: "SARAR", lat: 27.48, lon: 49.25, alias: ["RAS AL KHAIR"] },
  { name: "Jeddah", code: "SAJED", lat: 21.47, lon: 39.17, alias: ["JEDDAH", "JIDDAH"] },
  { name: "King Abdullah Port", code: "SAKAC", lat: 22.52, lon: 39.09, alias: ["KING ABDULLAH", "KAP"] },
  { name: "Yanbu", code: "SAYNB", lat: 23.96, lon: 38.24, alias: ["YANBU", "YENBO"] },
  { name: "Jizan", code: "SAGIZ", lat: 16.89, lon: 42.55, alias: ["JIZAN", "JAZAN"] },
  { name: "Shuwaikh (Kuwait)", code: "KWSWK", lat: 29.35, lon: 47.92, alias: ["SHUWAIKH", "KUWAIT", "KWKWI"] },
  { name: "Shuaiba", code: "KWSAA", lat: 29.04, lon: 48.16, alias: ["SHUAIBA", "SHUAIBAH"] },
  { name: "Mina al-Ahmadi", code: "KWMEA", lat: 29.07, lon: 48.15, alias: ["MINA AL AHMADI", "AHMADI"] },
  { name: "Umm Qasr", code: "IQUQR", lat: 30.03, lon: 47.95, alias: ["UMM QASR", "UMMQASR"] },
  { name: "Basra Oil Terminal", code: "IQBSR", lat: 29.68, lon: 48.81, alias: ["BASRA", "BASRAH", "ABOT"] },
  { name: "Bandar Abbas", code: "IRBND", lat: 27.14, lon: 56.21, alias: ["BANDAR ABBAS", "BANDARABBAS", "SHAHID RAJAEE", "IRBAN"] },
  { name: "Bushehr", code: "IRBUZ", lat: 28.98, lon: 50.83, alias: ["BUSHEHR", "BUSHIRE"] },
  { name: "Bandar Imam Khomeini", code: "IRBKM", lat: 30.43, lon: 49.08, alias: ["IMAM KHOMEINI", "BIK"] },
  { name: "Kharg Island", code: "IRKHK", lat: 29.24, lon: 50.31, alias: ["KHARG"] },
  { name: "Chabahar", code: "IRZBR", lat: 25.3, lon: 60.62, alias: ["CHABAHAR"] },
  { name: "Assaluyeh", code: "IRPGU", lat: 27.48, lon: 52.6, alias: ["ASSALUYEH", "ASALUYEH"] },
  { name: "Sohar", code: "OMSOH", lat: 24.5, lon: 56.62, alias: ["SOHAR"] },
  { name: "Muscat (Sultan Qaboos)", code: "OMMCT", lat: 23.63, lon: 58.57, alias: ["MUSCAT", "MINA QABOOS"] },
  { name: "Duqm", code: "OMDQM", lat: 19.66, lon: 57.71, alias: ["DUQM"] },
  { name: "Salalah", code: "OMSLL", lat: 16.94, lon: 54.0, alias: ["SALALAH"] },
  { name: "Mina al-Fahal", code: "OMMFH", lat: 23.63, lon: 58.52, alias: ["MINA AL FAHAL", "FAHAL"] },
  { name: "Aden", code: "YEADE", lat: 12.8, lon: 44.96, alias: ["ADEN"] },
  { name: "Hodeidah", code: "YEHOD", lat: 14.83, lon: 42.93, alias: ["HODEIDAH", "HODEIDA", "HUDAYDAH"] },
  { name: "Ras Isa", code: "YERAI", lat: 15.11, lon: 42.62, alias: ["RAS ISA", "RAS ISSA"] },
  { name: "Mukalla", code: "YEMKX", lat: 14.52, lon: 49.15, alias: ["MUKALLA"] },
  { name: "Djibouti", code: "DJJIB", lat: 11.6, lon: 43.14, alias: ["DJIBOUTI", "DORALEH"] },
  { name: "Berbera", code: "SOBBO", lat: 10.44, lon: 45.01, alias: ["BERBERA"] },
  { name: "Port Sudan", code: "SDPZU", lat: 19.61, lon: 37.23, alias: ["PORT SUDAN", "PORTSUDAN"] },
  { name: "Massawa", code: "ERMSW", lat: 15.61, lon: 39.45, alias: ["MASSAWA"] },
  { name: "Suez (Port Tawfiq)", code: "EGSUZ", lat: 29.95, lon: 32.56, alias: ["SUEZ", "SUEZ CANAL", "EGSUC", "PORT TAWFIQ"] },
  { name: "Ain Sokhna", code: "EGSOK", lat: 29.6, lon: 32.35, alias: ["SOKHNA", "AIN SOKHNA"] },
  { name: "Port Said", code: "EGPSD", lat: 31.26, lon: 32.31, alias: ["PORT SAID", "PORTSAID", "EAST PORT SAID", "EGEPS"] },
  { name: "Alexandria", code: "EGALY", lat: 31.18, lon: 29.87, alias: ["ALEXANDRIA", "DEKHEILA", "EGEDK"] },
  { name: "Damietta", code: "EGDAM", lat: 31.47, lon: 31.76, alias: ["DAMIETTA"] },
  { name: "Aqaba", code: "JOAQJ", lat: 29.45, lon: 34.98, alias: ["AQABA"] },
  { name: "Eilat", code: "ILETH", lat: 29.54, lon: 34.95, alias: ["EILAT", "ELAT"] },
  { name: "Haifa", code: "ILHFA", lat: 32.82, lon: 35.0, alias: ["HAIFA"] },
  { name: "Ashdod", code: "ILASH", lat: 31.82, lon: 34.64, alias: ["ASHDOD"] },
  { name: "Beirut", code: "LBBEY", lat: 33.9, lon: 35.52, alias: ["BEIRUT"] },
  { name: "Tripoli (Lebanon)", code: "LBKYE", lat: 34.46, lon: 35.83, alias: ["TRIPOLI LEBANON", "TRIPOLI LB"] },
  { name: "Latakia", code: "SYLTK", lat: 35.52, lon: 35.77, alias: ["LATAKIA", "LATTAKIA"] },
  { name: "Tartus", code: "SYTTS", lat: 34.9, lon: 35.87, alias: ["TARTUS", "TARTOUS"] },
  { name: "Limassol", code: "CYLMS", lat: 34.65, lon: 33.02, alias: ["LIMASSOL"] },
  { name: "Larnaca", code: "CYLCA", lat: 34.92, lon: 33.64, alias: ["LARNACA"] },
  { name: "Mersin", code: "TRMER", lat: 36.79, lon: 34.63, alias: ["MERSIN"] },
  { name: "Iskenderun", code: "TRISK", lat: 36.6, lon: 36.18, alias: ["ISKENDERUN"] },
  { name: "Ceyhan", code: "TRCEY", lat: 36.88, lon: 35.93, alias: ["CEYHAN"] },
  { name: "Karachi", code: "PKKHI", lat: 24.83, lon: 66.98, alias: ["KARACHI"] },
  { name: "Port Qasim", code: "PKBQM", lat: 24.77, lon: 67.33, alias: ["PORT QASIM", "QASIM"] },
  { name: "Gwadar", code: "PKGWD", lat: 25.11, lon: 62.34, alias: ["GWADAR"] },
  { name: "Mundra", code: "INMUN", lat: 22.74, lon: 69.7, alias: ["MUNDRA"] },
  { name: "Kandla", code: "INIXY", lat: 23.0, lon: 70.22, alias: ["KANDLA", "DEENDAYAL"] },
  { name: "Sikka", code: "INSIK", lat: 22.43, lon: 69.84, alias: ["SIKKA", "JAMNAGAR"] },
  { name: "Nhava Sheva", code: "INNSA", lat: 18.95, lon: 72.95, alias: ["NHAVA SHEVA", "JNPT", "MUMBAI", "INBOM"] },
];
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** Names an AIS destination string, or null when no port of the list matches it. */
export function matchPort(dest: string | null | undefined) {
  if (!dest) return null;
  const d = norm(dest);
  if (!d) return null;
  const compact = d.replace(/ /g, "");
  // "AE JEA", "AEJEA", "OMSOH>AEJEA" (a route): the last LOCODE in it is the destination.
  const codes = [...d.matchAll(/\b([A-Z]{2}) ?([A-Z0-9]{3})\b/g)].map((m) => m[1] + m[2]);
  for (const c of codes.reverse()) { const p = PORTS.find((x) => x.code === c); if (p) return p; }
  const tail = d.split(/ ?(?:>|TO|=) ?/).pop() || d;
  for (const s of [tail, d]) {
    const p = PORTS.find((x) => (x.alias || []).some((a) => s === a || s.startsWith(a + " ") || s.endsWith(" " + a) || s.includes(" " + a + " ")) || s === norm(x.name));
    if (p) return p;
  }
  return PORTS.find((x) => (x.alias || []).some((a) => a.length >= 5 && compact.includes(a.replace(/ /g, "")))) || null;
}
/** The port nearest a point within `maxKm`, or null. */
export function nearestPort(lat: number, lon: number, maxKm = 30) {
  let best: (typeof PORTS)[number] | null = null, bd = maxKm;
  for (const p of PORTS) { const d = km(lat, lon, p.lat, p.lon); if (d <= bd) { bd = d; best = p; } }
  return best;
}
