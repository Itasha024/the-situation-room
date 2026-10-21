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
  // A reader's click only (21 Oct: the continued tracks' look-ups had spent the budget above, and cards came back bare).
  "adsbdb-info": { gap: 500, next: 0, tokens: 50, perDay: 2000, at: Date.now(), until: 0 },
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
/** The airline and the flight number as sold (EK203 for UAE203), from adsbdb's answer for the callsign (21 Oct). */
export type Airline = { name: string; iata: string | null; icao: string | null; country: string | null; iso: string | null };
const airlines = new Map<string, { airline: Airline | null; flightNo: string | null }>();
async function fromAdsbdb(cs: string): Promise<Candidate[]> {
  const x = (await getJson("adsbdb", `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`)) as { response?: { flightroute?: Record<string, Record<string, unknown>> } } | null;
  const fr = x?.response && typeof x.response === "object" ? x.response.flightroute : undefined;
  if (!fr) return [];
  const al = fr.airline as Record<string, unknown> | undefined;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (airlines.size > 5000) airlines.clear();
  airlines.set(cs, { airline: al && str(al.name) ? { name: str(al.name)!, iata: str(al.iata), icao: str(al.icao), country: str(al.country), iso: str(al.country_iso) } : null, flightNo: str(fr.callsign_iata) });
  const p = (a: Record<string, unknown> | undefined) => a && place({ name: a.name as string, iata: a.iata_code as string, icao: a.icao_code as string, location: a.municipality as string, lat: a.latitude as number, lon: a.longitude as number });
  const o = p(fr.origin), d = p(fr.destination);
  return o && d ? [{ source: "adsbdb.com", origin: o, destination: d }] : [];
}
/**
 * The airline by the callsign's first three letters when the route record gave none (QTR83V has no
 * route on file, but QTR is Qatar Airways); kept a day per code.
 */
const byCode = new Map<string, { at: number; p: Promise<Airline | null> }>();
function airlineByCode(code: string) {
  const had = byCode.get(code);
  if (had && Date.now() - had.at < 86_400_000) return had.p;
  const p = getJson("adsbdb-info", `https://api.adsbdb.com/v0/airline/${code}`).then((x) => {
    const r = (x as { response?: Record<string, unknown>[] } | null)?.response;
    const a = Array.isArray(r) ? r[0] : null;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return a && str(a.name) ? { name: str(a.name)!, iata: str(a.iata), icao: str(a.icao), country: str(a.country), iso: str(a.country_iso) } : null;
  }).catch(() => null);
  byCode.set(code, { at: Date.now(), p });
  return p;
}

/**
 * The airframe (21 Oct: "more details on each"): maker, type, owner and the owner's country, and a
 * photo when Planespotters has none, from adsbdb's aircraft record; kept a day per aircraft.
 */
export type Airframe = { maker: string | null; type: string | null; owner: string | null; ownerCountry: string | null; ownerIso: string | null; reg: string | null; photo: string | null; thumb: string | null };
const frames = new Map<string, { at: number; p: Promise<Airframe | null> }>();
function airframe(hex: string) {
  const had = frames.get(hex);
  if (had && Date.now() - had.at < 86_400_000) return had.p;
  if (frames.size > 5000) frames.clear();
  const p = getJson("adsbdb-info", `https://api.adsbdb.com/v0/aircraft/${hex}`).then((x) => {
    const a = (x as { response?: { aircraft?: Record<string, unknown> } } | null)?.response?.aircraft;
    if (!a || typeof a !== "object") return null;
    const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const https = (v: unknown) => { const u = s(v); return u && /^https?:\/\//.test(u) ? u.replace(/^http:/, "https:") : null; };
    return { maker: s(a.manufacturer), type: s(a.type), owner: s(a.registered_owner), ownerCountry: s(a.registered_owner_country_name), ownerIso: s(a.registered_owner_country_iso_name), reg: s(a.registration), photo: https(a.url_photo), thumb: https(a.url_photo_thumbnail) };
  }).catch(() => null);
  frames.set(hex, { at: Date.now(), p });
  return p;
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
  airline?: Airline | null; flightNo?: string | null; airframe?: Airframe | null;
};

/**
 * pos: the live position (with track) the server has for the aircraft, if any; seen: our own
 * kept history of it ([lat, lon, unix s]).
 */
export async function airRoute(hex: string, cs: string | null, pos: (LatLon & { track?: number | null; t?: number }) | null, seen: TrackPoint[], withTrack = true): Promise<AirRouteAnswer> {
  const call = cs && /^[A-Z0-9]{3,8}$/.test(cs) ? cs : null;
  const cands = call && /^[A-Z]{3}\d/.test(call)
    ? cached(candCache, call, 20 * 60_000, 3000, () => ({
        // The continued tracks' look-ups ask adsb.im only: adsbdb's budget is kept for readers' clicks.
        c: Promise.all([fromAdsbIm(call, pos), withTrack ? fromAdsbdb(call) : Promise.resolve([] as Candidate[])]).then((r) => {
          // Nothing found (or a source skipped for its budget): asked again after two minutes, not twenty.
          const e = candCache.get(call);
          if (!r.flat().length && e) e.at = Date.now() - 18 * 60_000;
          return r.flat();
        }),
      })).c
    : Promise.resolve([] as Candidate[]);
  // Continued tracks ask for the route only: OpenSky's track is spent on readers' clicks.
  const trk = withTrack ? cached(trackCache, hex, 3 * 60_000, 500, () => ({ p: openskyTrack(hex) })).p : Promise.resolve([] as Awaited<ReturnType<typeof openskyTrack>>);
  const [c, path, frame] = await Promise.all([cands, trk, withTrack ? airframe(hex) : Promise.resolve(null)]);
  // A track that began low and slow was a take-off its receivers saw: where it began is the origin.
  const first = path[0];
  const start = first && (first.gnd || (first.altM != null && first.altM < 1500)) ? { lat: first.lat, lon: first.lon } : null;
  const pick = pickRoute(c, pos, start);
  // Our own positions fill in where OpenSky's sparse track has gaps, and bring it up to now.
  const track = joinTracks(500, path.map((p) => [+p.lat.toFixed(4), +p.lon.toFixed(4), p.t] as TrackPoint), seen, pos && pos.t ? [[pos.lat, pos.lon, pos.t]] : []);
  const source = [...pick.source];
  if (path.length) source.push("OpenSky Network (flown track)");
  if (seen.length) source.push("adsb.fi / adsb.lol positions kept by the desk");
  let al = call ? airlines.get(call) : undefined;
  if (withTrack && call && !al?.airline && /^[A-Z]{3}\d/.test(call)) {
    const airline = await airlineByCode(call.slice(0, 3));
    // The flight number as sold, when the callsign is the airline's code and a number (UAE203 → EK203).
    const num = /^[A-Z]{3}(\d{1,4})$/.exec(call);
    if (airline) al = { airline, flightNo: al?.flightNo ?? (airline.iata && num ? airline.iata + num[1] : null) };
  }
  return { ok: true, kind: "air", hex, callsign: call, origin: pick.origin, destination: pick.destination, track, source, confidence: pick.confidence, checks: pick.checks, at: new Date().toISOString(),
    airline: al?.airline ?? null, flightNo: al?.flightNo ?? null, airframe: frame };
}
