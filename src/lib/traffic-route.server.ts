import { joinTracks, pickRoute, type Candidate, type LatLon, type Place, type TrackPoint } from "./desk/traffic-geo.ts";

/**
 * Where an aircraft came from and is going, and the way it flew (user, 20 Oct). Sources compared
 * on 12 live flights over the region, 20 Oct (see the report in traffic.ts):
 * - adsb.im routeset (the adsb.lol route database, VRS standing data plus its own plausibility
 *   flag; api.adsb.lol/api/0/routeset now answers 201 with nothing, adsb.im answers): right 10 of 12.
 * - adsbdb.com: the same database for most flights, but older for some (RJA122 said Berlin, the
 *   flown track began at Lyon) and missing others (KAC357): right 9 of 12.
 * - hexdb.io: routes last updated years ago for many callsigns (2012, 2017, 2019): not used.
 * - OpenSky tracks/all (anonymous): the flown path, sparse but from take-off where its receivers
 *   saw it; also tells which origin is real when the databases disagree.
 * - adsb.lol / adsb.fi / airplanes.live globe traces: redirected or 403 (bot checks): not used.
 * Each route is checked against the live position before it is shown; none that fits = "unknown".
 */
const UA = { "user-agent": "TheSituationRoom/1.0 (+https://thesituationroom.live)" };

/** One call at a time per host, at least `gap` ms apart, and a daily budget; a call that would wait too long is skipped. */
type Gate = { gap: number; next: number; tokens: number; perDay: number; at: number; until: number };
const gates: Record<string, Gate> = {
  "adsb.im": { gap: 1500, next: 0, tokens: 50, perDay: 3000, at: Date.now(), until: 0 },
  "adsbdb": { gap: 1000, next: 0, tokens: 50, perDay: 3000, at: Date.now(), until: 0 },
  // OpenSky gives an anonymous address 400 credits a day.
  "opensky": { gap: 3000, next: 0, tokens: 20, perDay: 350, at: Date.now(), until: 0 },
};
async function gated<T>(name: keyof typeof gates, fn: () => Promise<T>): Promise<T | null> {
  const g = gates[name];
  const now = Date.now();
  g.tokens = Math.min(g.perDay / 10, g.tokens + ((now - g.at) * g.perDay) / 86_400_000);
  g.at = now;
  if (now < g.until || g.tokens < 1) return null;
  const wait = Math.max(0, g.next - now);
  if (wait > 8000) return null;
  g.tokens -= 1;
  g.next = now + wait + g.gap;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  try {
    return await fn();
  } catch {
    return null;
  }
}
async function getJson(name: keyof typeof gates, url: string, init?: RequestInit) {
  return gated(name, async () => {
    const r = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers || {}) }, signal: AbortSignal.timeout(10_000) });
    if (r.status === 429) {
      const s = Number(r.headers.get("retry-after") || r.headers.get("x-rate-limit-retry-after-seconds")) || 600;
      gates[name].until = Date.now() + Math.min(s, 6 * 3600) * 1000;
    }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as unknown;
  });
}

type Ap = { name?: string; iata?: string; icao?: string; location?: string; lat?: number; lon?: number };
const place = (a: Ap | undefined): Place | null =>
  a && typeof a.lat === "number" && typeof a.lon === "number"
    ? { name: a.name || a.location || a.icao || "", iata: a.iata || null, icao: a.icao || null, city: a.location || null, lat: a.lat, lon: a.lon }
    : null;

/** adsb.im: every leg of a multi-stop flight number is a candidate. */
async function fromAdsbIm(cs: string, pos: LatLon | null): Promise<Candidate[]> {
  const x = await getJson("adsb.im", "https://adsb.im/api/0/routeset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ planes: [{ callsign: cs, lat: pos?.lat ?? 0, lng: pos?.lon ?? 0 }] }),
  });
  const r = Array.isArray(x) ? (x[0] as { _airports?: Ap[]; plausible?: boolean | number }) : null;
  const A = (r?._airports || []).map(place).filter((p): p is Place => !!p);
  const out: Candidate[] = [];
  for (let i = 0; i + 1 < A.length; i++) out.push({ source: "adsb.im (adsb.lol routes)", origin: A[i], destination: A[i + 1] });
  return out;
}
async function fromAdsbdb(cs: string): Promise<Candidate[]> {
  const x = (await getJson("adsbdb", `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`)) as { response?: { flightroute?: Record<string, Record<string, unknown>> } } | null;
  const fr = x?.response && typeof x.response === "object" ? x.response.flightroute : undefined;
  if (!fr) return [];
  const p = (a: Record<string, unknown> | undefined) => a && place({ name: a.name as string, iata: a.iata_code as string, icao: a.icao_code as string, location: a.municipality as string, lat: a.latitude as number, lon: a.longitude as number });
  const o = p(fr.origin), d = p(fr.destination);
  return o && d ? [{ source: "adsbdb.com", origin: o, destination: d }] : [];
}
/** OpenSky's live track: [time, lat, lon, baro altitude m, track, on ground]. */
async function openskyTrack(hex: string) {
  const x = (await getJson("opensky", `https://opensky-network.org/api/tracks/all?icao24=${hex}&time=0`)) as { path?: (number | boolean | null)[][] } | null;
  return (x?.path || [])
    .filter((p) => typeof p[1] === "number" && typeof p[2] === "number")
    .map((p) => ({ t: p[0] as number, lat: p[1] as number, lon: p[2] as number, altM: typeof p[3] === "number" ? p[3] : null, gnd: !!p[5] }));
}

/** Caches: route candidates 20 minutes per callsign, OpenSky track 3 minutes per aircraft; small. */
const candCache = new Map<string, { at: number; c: Promise<Candidate[]> }>();
const trackCache = new Map<string, { at: number; p: ReturnType<typeof openskyTrack> }>();
function cached<V>(m: Map<string, { at: number } & V>, key: string, ttl: number, max: number, make: () => V): V {
  const now = Date.now();
  const hit = m.get(key);
  if (hit && now - hit.at < ttl) return hit;
  if (m.size >= max) for (const [k, v] of m) if (now - v.at >= ttl || m.size >= max) m.delete(k);
  const v = { at: now, ...make() } as { at: number } & V;
  m.set(key, v);
  return v;
}

export type AirRouteAnswer = {
  ok: true; kind: "air"; hex: string; callsign: string | null;
  origin: Place | null; destination: Place | null; track: TrackPoint[]; source: string[];
  confidence: "confirmed" | "likely" | "unknown"; checks: ReturnType<typeof pickRoute>["checks"]; at: string;
};

/**
 * pos: the live position (with track) the server has for the aircraft, if any; seen: our own
 * kept history of it ([lat, lon, unix s]).
 */
export async function airRoute(hex: string, cs: string | null, pos: (LatLon & { track?: number | null; t?: number }) | null, seen: TrackPoint[]): Promise<AirRouteAnswer> {
  const call = cs && /^[A-Z0-9]{3,8}$/.test(cs) ? cs : null;
  const cands = call && /^[A-Z]{3}\d/.test(call)
    ? cached(candCache, call, 20 * 60_000, 3000, () => ({
        c: Promise.all([fromAdsbIm(call, pos), fromAdsbdb(call)]).then((r) => {
          // Nothing found (or a source skipped for its budget): asked again after two minutes, not twenty.
          const e = candCache.get(call);
          if (!r.flat().length && e) e.at = Date.now() - 18 * 60_000;
          return r.flat();
        }),
      })).c
    : Promise.resolve([] as Candidate[]);
  const trk = cached(trackCache, hex, 3 * 60_000, 500, () => ({ p: openskyTrack(hex) })).p;
  const [c, path] = await Promise.all([cands, trk]);
  // A track that began low and slow was a take-off its receivers saw: where it began is the origin.
  const first = path[0];
  const start = first && (first.gnd || (first.altM != null && first.altM < 1500)) ? { lat: first.lat, lon: first.lon } : null;
  const pick = pickRoute(c, pos, start);
  // Our own positions fill in where OpenSky's sparse track has gaps, and bring it up to now.
  const track = joinTracks(500, path.map((p) => [+p.lat.toFixed(4), +p.lon.toFixed(4), p.t] as TrackPoint), seen, pos && pos.t ? [[pos.lat, pos.lon, pos.t]] : []);
  const source = [...pick.source];
  if (path.length) source.push("OpenSky Network (flown track)");
  if (seen.length) source.push("adsb.fi / adsb.lol positions kept by the desk");
  return { ok: true, kind: "air", hex, callsign: call, origin: pick.origin, destination: pick.destination, track, source, confidence: pick.confidence, checks: pick.checks, at: new Date().toISOString() };
}
