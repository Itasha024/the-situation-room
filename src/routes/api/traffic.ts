import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { AIR_BOX, aisEta, cameFrom, type HistFix, type TrackPoint, SEA_KEEP, tidyShips, angleDiff, bearing, continues, flagOf, History, shipJump, inAirBox, inSeaBox, joinTracks, km, lattice, matchPort, nearestPort, project, SEA_BOX, type LatLon } from "@/lib/desk/traffic-geo";
import { shipInland } from "@/lib/desk/ship-land";
import { airRoute, listRoute } from "@/lib/traffic-route.server";

/**
 * Live traffic for the map-first view's "Live traffic" button (user, 19 Oct: every aircraft and
 * ship in the region, live, whenever the buttons are on; 20 Oct: "make sure it loads immediately
 * all the live data upon choosing to activate it" and "not missing any data").
 *
 * - Aircraft: adsb.fi's, adsb.lol's and the OpenSky Network's open data together (no key; each
 *   sees through its own receivers, so together they give the fullest picture; adsb.fi one call a
 *   second, adsb.lol 10 a minute and 500 a day, OpenSky 400 credits a day; so adsb.fi carries the
 *   sweep, OpenSky's one whole-region call (4 credits) every 5 minutes while someone looks adds
 *   what only its receivers hear — a third more aircraft on 20 Oct — and adsb.lol tops up the
 *   busy circles, see `lol` and `os` below). 45 circles of 250 nm cover the whole box (8–42°N,
 *   25–65°E: Egypt, Sudan and the Horn to the Caspian and Pakistan) with no gap (`lattice`,
 *   checked in traffic-geo.test.ts). Checked 20 Oct and not used: airplanes.live (its API now
 *   asks every user to write to them first), adsb.one (a Cloudflare challenge), ADS-B Exchange
 *   (paid key), ADSBHub (feeders only), Flightradar24 and the like (their terms forbid it).
 *   Iraq, Iran, inland Saudi Arabia, Yemen, Sudan and the Red Sea have few or no open receivers:
 *   none of these feeds sees much there. The reading never stops: one pass a minute
 *   while nobody looks, passes back to back while someone has the layer on, so the first answer
 *   is the warm picture at once. Each circle's aircraft join the picture as it lands; an aircraft
 *   neither feed sees any longer inside a circle just read leaves it. Circles that held nothing
 *   are read every third pass (still at least every three minutes). adsb.fi's military list every
 *   two minutes (adsb.lol's every ten), those on the ground too (marked), and the scheduled route of a flight number from
 *   adsb.lol's standing data.
 * - Ships: AISStream's live feed, read here (its terms keep the key off the browser; compressed,
 *   as its terms ask from September 2026), kept open whenever the server has an AISSTREAM_KEY
 *   (/srv/desk/app.env on the server); without one the answer says so and the page offers none.
 *   No free live AIS source without an account covers the region (checked 20 Oct). AISStream is
 *   shore receivers run by volunteers: on 20 Oct it gave the Gulf, Hormuz, the Gulf of Oman, the
 *   east Mediterranean and Suez, and nothing from the Red Sea, the Gulf of Aden or the open
 *   Arabian Sea although they are inside the box (no volunteer receivers there; ships far out
 *   are heard only by satellite AIS, which is paid; and many ships there switch AIS off). Checked
 *   and not usable: AISHub (only for those who feed it), Global Fishing Watch (account, days
 *   late, fishing vessels), BarentsWatch / Digitraffic / the Danish Maritime Authority (their own
 *   waters only), aiscatcher.org (no public read API), MarineTraffic, VesselFinder,
 *   MyShipTracking and the like (terms forbid it), Spire / Kpler / Datalastic (paid).
 */
const UA = { headers: { "user-agent": "TheSituationRoom/1.0 (+https://thesituationroom.live)" } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RADIUS = 250; // nm, the most either feed answers
/** A hexagonal lattice over the box, checked on a 0.05° grid: no point of the box is outside every circle. */
const LATTICE = lattice(AIR_BOX, RADIUS);
const inBox = inAirBox;
function nm(a: number, b: number, c: number, d: number) {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.sqrt(x));
}
// The busiest places first, so the first circles after a restart are the ones that matter most.
const HUBS: [number, number][] = [[25.3, 55.3], [32, 35], [33.3, 44.4], [35.7, 51.4], [15, 43], [29.5, 47.8]];
const CIRCLES = [...LATTICE].sort((p, q) => Math.min(...HUBS.map(([a, b]) => nm(p[0], p[1], a, b))) - Math.min(...HUBS.map(([a, b]) => nm(q[0], q[1], a, b))));

type Ac = { hex: string; lat: number; lon: number } & Record<string, string | number | undefined>;
type Row = (string | number | null)[];
/** Only what a row needs is kept (the VM has 1 GB). */
const FIELDS = ["alt_baro", "gs", "track", "baro_rate", "geom_rate", "squawk", "flight", "r", "t", "desc", "ownOp", "dbFlags", "true_heading"];
function slim(x: Record<string, unknown>): Ac | null {
  if (typeof x.hex !== "string" || typeof x.lat !== "number" || typeof x.lon !== "number") return null;
  const a: Ac = { hex: x.hex, lat: x.lat, lon: x.lon };
  for (const k of FIELDS) { const v = x[k]; if (typeof v === "string" || typeof v === "number") a[k] = v; }
  return a;
}

/**
 * seen: each aircraft with the time its position was taken (ms), the feed whose reads decide when
 * it has gone (`own`: "fi" once adsb.fi has seen it, else the feed that did; adsb.lol and OpenSky
 * are read far less often, so their own aircraft are not dropped by an adsb.fi read), and the
 * feed that gave the position shown (`by`).
 */
type Src = "fi" | "lol" | "os";
const air = {
  seen: new Map<string, { a: Ac; t: number; own: Src; by: Src }>(),
  rows: [] as Row[], ver: 0, built: -1, builtAt: 0,
  at: "", asked: 0, running: false, wake: null as null | (() => void),
  mil: new Set<string>(), milAt: 0, lolMilAt: 0,
  srcOk: new Map<string, number>(),
  count: CIRCLES.map(() => -1), readAt: CIRCLES.map(() => 0), lolAt: CIRCLES.map(() => 0),
};
/**
 * adsb.lol allows one address 4 calls a second, 60 a minute and 500 a day (its x-ratelimit-limit
 * header), and since 20 Oct also only 10 a minute ("rate limit exceeded: 10 req/min", retry-after
 * 15 s; past that every call is refused for a while). So it is spent from a budget of 450 a day,
 * at most one call each 7 seconds, only while someone has the layer on: the busiest circles in
 * turn, and its military list every ten minutes. adsb.fi (one call a second, no daily cap) carries
 * the sweep.
 */
const lol = { tokens: 10, at: Date.now(), until: 0, last: 0 };
function lolSpend() {
  const now = Date.now();
  lol.tokens = Math.min(40, lol.tokens + ((now - lol.at) * 450) / 86_400_000);
  lol.at = now;
  if (now < lol.until || lol.tokens < 1 || now - lol.last < 7000) return false;
  lol.tokens -= 1;
  lol.last = now;
  return true;
}
/**
 * OpenSky Network, anonymous: 400 credits a day per address; the whole region in one call costs 4
 * (any box over 400 square degrees). 95 calls a day: one each 5 minutes while someone looks (a
 * burst of six, then as the budget refills, about one each 15 minutes), each 30 minutes while
 * nobody does, so the first look is warm. Its own aircraft stay up to 12 minutes, moved on by
 * the page from their speed and track.
 */
const os = { tokens: 4, at: Date.now(), until: 0, last: 0 };
function osDue() {
  const now = Date.now();
  os.tokens = Math.min(6, os.tokens + ((now - os.at) * 95) / 86_400_000);
  os.at = now;
  return now >= os.until && os.tokens >= 1 && now - os.last >= (watched() ? 300_000 : 1_800_000);
}
async function readOpenSky() {
  const now = Date.now();
  os.last = now;
  os.tokens -= 1;
  try {
    const r = await fetch(`https://opensky-network.org/api/states/all?lamin=${AIR_BOX.s}&lomin=${AIR_BOX.w}&lamax=${AIR_BOX.n}&lomax=${AIR_BOX.e}`, { ...UA, signal: AbortSignal.timeout(20_000) });
    const wait = Number(r.headers.get("x-rate-limit-retry-after-seconds"));
    if (r.status === 429 || Number(r.headers.get("x-rate-limit-remaining")) < 4) os.until = now + (Number.isFinite(wait) && wait > 0 ? wait : 3600) * 1000;
    if (!r.ok) return;
    const x = (await r.json()) as { states?: unknown[][] | null };
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    // [icao24, callsign, country, time_position, last_contact, lon, lat, baro_alt m, on_ground, velocity m/s, true_track, vertical_rate m/s, sensors, geo_alt, squawk, ...]
    for (const st of x.states || []) {
      const hex = typeof st[0] === "string" ? st[0].toLowerCase() : "";
      const lat = num(st[6]), lon = num(st[5]), tp = num(st[3]);
      if (!hex || lat == null || lon == null || tp == null || !inBox(lat, lon) || now / 1000 - tp > 300) continue;
      const alt = num(st[7]), v = num(st[9]), vr = num(st[11]), trk = num(st[10]);
      // Only what OpenSky has is set: a merge must not blank what another feed gave.
      const a: Ac = { hex, lat, lon, seen_pos: Math.max(0, now / 1000 - tp) };
      if (st[8] === true) a.alt_baro = "ground";
      else if (alt != null) a.alt_baro = alt * 3.28084;
      if (v != null) a.gs = v * 1.943844;
      if (trk != null) a.track = trk;
      if (vr != null) a.baro_rate = vr * 196.8504;
      if (typeof st[14] === "string") a.squawk = st[14];
      if (typeof st[1] === "string" && st[1].trim()) a.flight = st[1];
      put(a, now, "os");
    }
    air.srcOk.set("OpenSky", Date.now());
    air.at = new Date().toISOString();
    air.ver++;
  } catch { /* the next time */ }
}
const routes = new Map<string, { from: string; to: string } | null>();
/** Each aircraft's own positions, one a minute for six hours (for the flown route when a reader opens it). */
const airHist = new History(60, 6 * 3600, 360, 5000);

/**
 * Continued tracks (user, 20 Oct: aircraft must not vanish into receiver holes over inland Saudi
 * Arabia, Iraq, Iran, Yemen and the Red Sea). An aircraft every feed has stopped hearing while
 * airborne (over 5,000 ft and 120 kt) is kept as an estimate: moved on at its last ground speed
 * along the great circle to its destination when its route is known ("confirmed" or "likely"
 * only), else on its last track for ten minutes. It goes on arrival (40 km out), on landing,
 * after three hours, or the moment any feed hears it again (a real position always wins).
 * At most 3,000 kept; route look-ups one at a time, the aircraft lost last first, within the
 * route sources' own budgets.
 */
type Ghost = { a: Ac; t: number; by: Src; lostAt: number; dest: LatLon | null; asked: 0 | 1 | 2 };
const ghosts = new Map<string, Ghost>();
const ghostLook = { busy: false };
function lose(h: string) {
  const s = air.seen.get(h);
  air.seen.delete(h);
  if (!s || ghosts.size >= 3000 || !inBox(s.a.lat, s.a.lon) || s.a.alt_baro === "ground") return;
  if (!continues(s.a.alt_baro, s.a.gs, s.a.track)) return;
  ghosts.set(h, { a: s.a, t: s.t, by: s.by, lostAt: Date.now(), dest: null, asked: 0 });
}
/** One route look-up for a continued aircraft, if none is running: the one lost last first. */
function ghostRoute() {
  if (ghostLook.busy) return;
  let pick: [string, Ghost] | null = null;
  for (const e of ghosts) if (e[1].asked === 0 && (!pick || e[1].lostAt > pick[1].lostAt)) pick = e;
  if (!pick) return;
  const [h, g] = pick;
  const cs = String(g.a.flight || "").trim().toUpperCase();
  if (!/^[A-Z]{3}\d/.test(cs) || air.mil.has(h)) { g.asked = 2; return; }
  g.asked = 1;
  ghostLook.busy = true;
  void airRoute(h, cs, { lat: g.a.lat, lon: g.a.lon, track: typeof g.a.track === "number" ? g.a.track : null, t: Math.round(g.t / 1000) }, [], false)
    .then((ans) => { if (ans.destination && (ans.confidence === "confirmed" || ans.confidence === "likely")) g.dest = { lat: ans.destination.lat, lon: ans.destination.lon }; })
    .catch(() => {})
    .finally(() => { g.asked = 2; ghostLook.busy = false; air.ver++; });
}

async function getJson(u: string) {
  const r = await fetch(u, { ...UA, signal: AbortSignal.timeout(12_000) });
  if (r.status === 429 && u.startsWith("https://api.adsb.lol/")) lol.until = Date.now() + Math.max(60, Number(r.headers.get("retry-after")) || 0) * 1000;
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json() as Promise<{ aircraft?: Record<string, unknown>[]; ac?: Record<string, unknown>[]; _airports?: { iata?: string; icao?: string; location?: string; name?: string; countryiso2?: string }[] }>;
}
async function routeOf(cs: string) {
  if (routes.has(cs) || !/^[A-Z]{3}\d/.test(cs)) return;
  if (routes.size > 6000) routes.clear();
  routes.set(cs, null);
  if (!vrsNone.has(cs)) try {
    const x = await getJson(`https://vrs-standing-data.adsb.lol/routes/${cs.slice(0, 2)}/${cs}.json`);
    const A = x._airports || [];
    const at = (a: (typeof A)[number]) => [a.iata || a.icao, a.location || a.name].filter(Boolean).join(" ");
    if (A.length >= 2) { routes.set(cs, { from: at(A[0]), to: at(A[A.length - 1]) }); return; }
  } catch { /* none */ }
  // Not in adsb.lol's routes: adsbdb's (22 Oct), within its own budget; when that is spent, asked again on a later rebuild.
  if (vrsNone.size > 6000) vrsNone.clear();
  vrsNone.add(cs);
  const r = await listRoute(cs).catch(() => null);
  if (r === undefined) routes.delete(cs);
  else if (r) { routes.set(cs, r); air.ver++; }
}
const vrsNone = new Set<string>();
/** The from/to of the flights on the map, a few after each circle read (22 Oct: they filled only while the page asked, 8 a time). */
function fillRoutes(n: number) {
  // Flights not yet asked first; then those waiting on adsbdb's budget.
  for (const again of [false, true]) {
    for (const { a } of air.seen.values()) {
      if (n <= 0) return;
      const f = String(a.flight || "").trim();
      if (!/^[A-Z]{3}\d/.test(f) || routes.has(f) || air.mil.has(a.hex) || vrsNone.has(f) !== again) continue;
      n--;
      void routeOf(f);
    }
  }
}

/** Merged by hex: the freshest position of the feeds wins; the others fill what it lacks. */
function put(a: Ac, now: number, src: Src) {
  const t = now - Math.max(0, Number(a.seen_pos ?? 0)) * 1000;
  const was = air.seen.get(a.hex);
  ghosts.delete(a.hex); // heard again: the real position wins
  if (!was || t >= was.t) {
    air.seen.set(a.hex, { a: was ? { ...was.a, ...a } : a, t, own: was?.own === "fi" ? "fi" : src, by: src });
    if (inBox(a.lat, a.lon)) airHist.add(a.hex, a.lat, a.lon, t / 1000);
  }
  else { was.a = { ...a, ...was.a }; if (src === "fi") was.own = "fi"; }
}
async function readFeed(u: string, now: number, src: Src) {
  const x = await getJson(u);
  const got = new Set<string>();
  for (const raw of x.aircraft || x.ac || []) {
    const a = slim(raw);
    if (!a) continue;
    a.seen_pos = Number(raw.seen_pos ?? 0);
    got.add(a.hex);
    put(a, now, src);
  }
  air.srcOk.set(src === "lol" ? "adsb.lol" : "adsb.fi", Date.now());
  return got;
}
async function readCircle(i: number, withLol: boolean) {
  const [la, lo] = CIRCLES[i];
  const now = Date.now();
  const [fi, ll] = await Promise.all([
    readFeed(`https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${RADIUS}`, now, "fi").catch(() => null),
    withLol ? readFeed(`https://api.adsb.lol/v2/point/${la}/${lo}/${RADIUS}`, now, "lol").catch(() => null) : Promise.resolve(null),
  ]);
  if (ll) air.lolAt[i] = now;
  if (!fi && !ll) return;
  // Mark what adsb.fi saw itself; then what the feeds that answered no longer see well inside the circle has gone.
  if (fi) for (const h of fi) { const s = air.seen.get(h); if (s) s.own = "fi"; }
  for (const [h, s] of air.seen) {
    if (fi?.has(h) || ll?.has(h) || s.t >= now || nm(la, lo, s.a.lat, s.a.lon) > RADIUS - 10) continue;
    if (s.own === "os") continue; // OpenSky's own: kept until its next read or 12 minutes
    if (ll || (fi && s.own === "fi")) lose(h);
  }
  air.count[i] = new Set([...(fi || []), ...(ll || [])]).size;
  air.readAt[i] = Date.now();
  air.at = new Date().toISOString();
  air.ver++;
}
async function readMil() {
  const now = Date.now();
  const lists: [string, Src][] = [["https://opendata.adsb.fi/api/v2/mil", "fi"]];
  if (Date.now() - air.lolMilAt > 600_000 && watched() && lolSpend()) { air.lolMilAt = now; lists.push(["https://api.adsb.lol/v2/mil", "lol"]); }
  air.milAt = now;
  for (const [u, src] of lists) {
    try {
      const x = await getJson(u);
      for (const raw of x.aircraft || x.ac || []) {
        if (typeof raw.hex === "string") air.mil.add(raw.hex);
        const a = slim(raw);
        if (a && inBox(a.lat, a.lon)) { a.seen_pos = Number(raw.seen_pos ?? 0); put(a, now, src); }
      }
      air.srcOk.set(src === "lol" ? "adsb.lol" : "adsb.fi", Date.now());
    } catch { /* the next time */ }
  }
  if (air.mil.size > 20_000) air.mil.clear();
  air.ver++;
}
const watched = () => Date.now() - air.asked < 180_000;
async function airLoop() {
  if (air.running) return;
  air.running = true;
  try {
    for (let pass = 0; ; pass++) {
      const start = Date.now();
      // The circles with the most aircraft first; those that held nothing every third pass.
      const order = CIRCLES.map((_, i) => i).sort((x, y) => air.count[y] - air.count[x]);
      // adsb.lol, while someone looks: the busy circles it has read least lately, as its budget allows.
      const lolTurn = new Set(watched() ? order.filter((i) => air.count[i] !== 0).sort((x, y) => air.lolAt[x] - air.lolAt[y]).slice(0, 3) : []);
      for (const i of order) {
        if (air.count[i] === 0 && pass % 3 !== 0 && Date.now() - air.readAt[i] < 180_000) continue;
        await readCircle(i, lolTurn.has(i) && lolSpend());
        if (osDue()) await readOpenSky();
        ghostRoute();
        fillRoutes(6);
        await sleep(1050); // adsb.fi: one call a second
      }
      if (osDue()) await readOpenSky();
      if (Date.now() - air.milAt > 120_000) { await readMil(); await sleep(1100); }
      // An aircraft whose circle has not been read for four minutes (feeds failing) is not shown as live,
      // nor one only adsb.lol saw, two and a half minutes on, nor one only OpenSky saw, twelve minutes on.
      const now = Date.now();
      const keep = { fi: 240_000, lol: 150_000, os: 720_000 };
      for (const [h, s] of air.seen) if (s.t < now - keep[s.own]) lose(h);
      airHist.prune(Date.now() / 1000 - 1800);
      air.ver++;
      // Nobody looking: one pass a minute, woken at once when someone turns the layer on.
      const rest = 60_000 - (Date.now() - start);
      if (rest > 0 && !watched()) await new Promise<void>((r) => { const tm = setTimeout(r, rest); air.wake = () => { clearTimeout(tm); r(); }; });
      air.wake = null;
    }
  } finally {
    air.running = false;
  }
}

function airRows() {
  // Estimates move with the clock, so the rows are rebuilt at least every five seconds while there are any.
  if (air.built === air.ver && (!ghosts.size || Date.now() - air.builtAt < 5000)) return air.rows;
  const rows: Row[] = [];
  let lookups = 0;
  const now = Date.now();
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const items: { a: Ac; t: number; by: Src; lat: number; lon: number; est: 0 | 1; at: number; alt?: number | null; track?: number }[] = [];
  for (const { a, t, by } of air.seen.values()) items.push({ a, t, by, lat: a.lat, lon: a.lon, est: 0, at: t });
  for (const [h, g] of ghosts) {
    const e = project({ lat: g.a.lat, lon: g.a.lon, t: g.t / 1000, gs: Number(g.a.gs), track: Number(g.a.track), alt: typeof g.a.alt_baro === "number" ? g.a.alt_baro : null, rate: Number(g.a.baro_rate ?? g.a.geom_rate) }, g.dest, now / 1000);
    // Without a route yet, held to the ten-minute rule only once its look-up has answered.
    if ((e.done && !(e.done === "no-route" && g.asked < 2 && now - g.t < 3600_000)) || !inBox(e.lat, e.lon) || air.seen.has(h)) { if (e.done || !inBox(e.lat, e.lon)) ghosts.delete(h); continue; }
    items.push({ a: g.a, t: g.t, by: g.by, lat: e.lat, lon: e.lon, est: 1, at: now, alt: e.alt, track: e.track });
  }
  for (const { a, t, by, lat, lon, est, at, alt, track } of items) {
    if (!inBox(lat, lon)) continue;
    const gnd = a.alt_baro === "ground" ? 1 : 0;
    const f = String(a.flight || "").trim();
    const mil = air.mil.has(a.hex) || (Number(a.dbFlags) & 1) === 1 ? 1 : 0;
    if (f && !mil && !routes.has(f) && lookups < 8) { lookups++; void routeOf(f); }
    const rt = f ? routes.get(f) : null;
    // hex, lat, lon, altitude ft, ground speed kt, track, climb ft/min, squawk, flight, registration,
    // type code, type, operator, military, from, to, on the ground, seconds since the position,
    // then (20 Oct, added at the end) the position's unix time, the true heading, the feed and whether it
    // is an estimate (then the age counts from the last real position). See AIR_ROW.
    rows.push([a.hex, +lat.toFixed(4), +lon.toFixed(4), gnd ? 0 : n(est ? alt : a.alt_baro), n(a.gs), n(est ? track : a.track), est ? null : n(a.baro_rate ?? a.geom_rate), s(a.squawk),
      f || null, s(a.r), s(a.t), s(a.desc), s(a.ownOp), mil, rt ? rt.from : null, rt ? rt.to : null, gnd, Math.max(0, Math.round((now - t) / 1000)),
      Math.round(at / 1000), est ? null : n(a.true_heading), by, est]);
  }
  air.rows = rows;
  air.built = air.ver;
  air.builtAt = now;
  return rows;
}

/* Ships: AISStream, kept open while the server has a key, so the picture is already there when asked for. */
/**
 * stop: where the ship last lay still (speed under half a knot, or moored / at anchor) and until
 * when; once it moves on, that is where it came from (AIS has no origin).
 */
type Ship = { mmsi: number; name: string; lat: number; lon: number; sog: number | null; cog: number | null; hdg: number | null; nav: number | null; type?: number; dest?: string; cs?: string; imo?: number; len?: number; beam?: number; draught?: number; eta?: string | null; t: number; sAt?: number;
  /** the monitor's category ("Crude Oil Tanker"), its flag, deadweight, and who gave the position: "ais" AISStream, "hz" the monitor */
  cat?: string; flag?: string; dwt?: number; by?: "ais" | "hz";
  /** a position that jumped too far too fast, held until a second report agrees (shipJump) */
  jump?: { lat: number; lon: number; t: number };
  stop?: { lat: number; lon: number; from: number; to: number } };
/** Each ship's own positions, one per quarter hour for twelve hours (21 Oct: the past track on the card). */
const seaHist = new History(900, 12 * 3600, 48, 9000);
const sea = { ships: new Map<number, Ship>(), asked: 0, ws: null as WebSocket | null, note: "", openedAt: 0, tidyAt: 0 };
type Msg = Record<string, Record<string, unknown> | undefined> & { MetaData?: Record<string, unknown>; Message?: Record<string, Record<string, unknown> | undefined>; error?: string };
function seaOpen() {
  const key = process.env.AISSTREAM_KEY;
  if (!key || sea.ws || typeof WebSocket === "undefined" || Date.now() - sea.openedAt < 20_000) return;
  sea.openedAt = Date.now();
  // Node's WebSocket asks for permessage-deflate, which AISStream wants (uncompressed links are capped).
  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  sea.ws = ws;
  sea.note = "connecting";
  ws.onopen = () => {
    sea.note = "live";
    ws.send(JSON.stringify({ APIKey: key, // The whole sea region: east Mediterranean, Suez, Red Sea, Gulf of Aden, Arabian Sea, the Gulf;
      // every ship type (no type filter), class A and B.
      BoundingBoxes: [[[SEA_BOX.s, SEA_BOX.w], [SEA_BOX.n, SEA_BOX.e]]],
      FilterMessageTypes: ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData", "StaticDataReport"] }));
  };
  ws.onmessage = async (ev) => {
    try {
      const m = JSON.parse(typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text()) as Msg;
      if (m.error) { sea.note = `error: ${String(m.error).slice(0, 120)}`; return; }
      const md = m.MetaData || {};
      const id = Number(md.MMSI);
      if (!id) return;
      const s: Ship = sea.ships.get(id) || { mmsi: id, name: "", lat: 0, lon: 0, sog: null, cog: null, hdg: null, nav: null, t: 0 };
      s.name = String(md.ShipName || s.name || "").trim();
      const M = m.Message || {};
      const pr = M.PositionReport || M.StandardClassBPositionReport || M.ExtendedClassBPositionReport;
      const num = (v: unknown) => (typeof v === "number" ? v : null);
      const lat = Number(md.latitude), lon = Number(md.longitude), now = Date.now();
      // A false jump (spoofed GPS) is held back until a second report agrees with it.
      const held = pr && Number.isFinite(lat) && Number.isFinite(lon) && shipJump(s, lat, lon, now) && !(s.jump && km(s.jump.lat, s.jump.lon, lat, lon) < 10 && now - s.jump.t < 3600_000);
      if (held) s.jump = { lat, lon, t: now };
      if (pr && !held && typeof md.latitude === "number" && typeof md.longitude === "number") {
        s.jump = undefined;
        Object.assign(s, { lat: +md.latitude.toFixed(4), lon: +md.longitude.toFixed(4), sog: num(pr.Sog), cog: num(pr.Cog), hdg: pr.TrueHeading === 511 ? null : num(pr.TrueHeading), nav: num(pr.NavigationalStatus) ?? s.nav, t: Date.now(), by: "ais" });
        const still = (s.sog != null && s.sog < 0.5) || s.nav === 1 || s.nav === 5;
        if (still) {
          if (s.stop && s.stop.to > s.t - 1800_000 && km(s.stop.lat, s.stop.lon, s.lat, s.lon) < 5) s.stop.to = s.t;
          else s.stop = { lat: s.lat, lon: s.lon, from: s.t, to: s.t };
        }
        seaHist.add(id, s.lat, s.lon, s.t / 1000);
      }
      const st = M.ShipStaticData;
      if (st) {
        const D = (st.Dimension || {}) as Record<string, number>;
        Object.assign(s, { type: st.Type, dest: String(st.Destination || "").trim(), cs: String(st.CallSign || "").trim(), imo: st.ImoNumber || undefined, len: (D.A || 0) + (D.B || 0) || undefined, beam: (D.C || 0) + (D.D || 0) || undefined, draught: typeof st.MaximumStaticDraught === "number" && st.MaximumStaticDraught > 0 ? st.MaximumStaticDraught : undefined, eta: aisEta(st.Eta), sAt: Date.now() });
      }
      const sd = M.StaticDataReport as Record<string, Record<string, unknown> | undefined> | undefined;
      if (sd) {
        s.sAt = Date.now();
        if (sd.ReportA && sd.ReportA.Name) s.name = String(sd.ReportA.Name).trim() || s.name;
        const B = sd.ReportB;
        if (B) {
          const D = (B.Dimension || {}) as Record<string, number>;
          Object.assign(s, { type: B.ShipType ?? s.type, cs: String(B.CallSign || s.cs || "").trim(), len: (D.A || 0) + (D.B || 0) || s.len, beam: (D.C || 0) + (D.D || 0) || s.beam });
        }
      }
      sea.ships.set(id, s);
      if (Date.now() - sea.tidyAt > 60_000) seaTidy();
    } catch { /* a bad message */ }
  };
  ws.onclose = () => { sea.ws = null; if (!sea.note.startsWith("error")) sea.note = "closed"; setTimeout(seaOpen, 30_000); };
  ws.onerror = () => { /* onclose follows */ };
}
function seaTidy() {
  sea.tidyAt = Date.now();
  // Ships report slowly (a ship at anchor every 3 minutes, its name and destination every 6, and
  // many receivers only now and then), so the picture builds up: a position is kept six hours
  // (shown with its time), name, type and destination a day; never more than 40,000 ships, those
  // with no position going first.
  const cut = Date.now() - SEA_KEEP.posMs;
  tidyShips(sea.ships, Date.now(), 40_000);
  seaHist.prune(cut / 1000);
}

/**
 * The Gulf, Hormuz, the Gulf of Oman, the Red Sea and the Gulf of Aden from the Strait of Hormuz
 * Ship Monitor's public JSON API (hormuz.data-tracking.net, documented for reuse in its llms.txt):
 * on 22 Oct AISStream's volunteers heard 2 ships there and the monitor listed 5,400, with category,
 * flag, size, deadweight, draught and destination. It polls every 30 minutes, so it is read every
 * 15; a fresher AISStream position of the same ship wins.
 */
const HZ = "https://hormuz.data-tracking.net/api/";
/**
 * Also (22 Oct, "more ships"): the ships it tracks outside its zones (the Arabian Sea off Iran,
 * Pakistan and Oman; about 850 heard in the last two hours), from its ship directory, which
 * answers 500 at a time: four orders between them give nearly all.
 */
const MONITOR = [`${HZ}ships`, `${HZ}bab/ships`, ...["", "&sort=last_position&order=asc", "&sort=name", "&sort=dwt"].map((o) => `${HZ}ships/directory?zone=outside${o}`)];
const monitor = { at: 0, busy: false, n: 0 };
/** Which of the monitor's two areas a ship is in: its history is asked of that one. */
const hzBab = new Set<number>();
/** The monitor's category as the AIS type the map colours by. */
function typeOfCategory(c: string): number | undefined {
  if (/tanker|lng|lpg|gas carrier/i.test(c)) return 80;
  if (/naval|navy|military|warship|law enforcement|coast ?guard/i.test(c)) return 35;
  if (/passenger|ferry|cruise|ro-?pax/i.test(c)) return 60;
  if (/cargo|bulk|container|carrier|ro-?ro|reefer/i.test(c)) return 70;
  if (/tug|towing/i.test(c)) return 52;
  if (/fishing/i.test(c)) return 30;
  return undefined;
}
type MonitorShip = { mmsi: string; name?: string; ship_category?: string; flag?: string; length?: number | null; width?: number | null; dwt?: number | null; destination?: string | null; draught?: number | null; latitude: number; longitude: number; speed?: number | null; course?: number | null; hdg?: number | null; timestamp?: string; last_position?: string; still?: boolean };
async function monitorRead() {
  if (monitor.busy || Date.now() - monitor.at < 15 * 60_000) return;
  monitor.busy = true;
  monitor.at = Date.now();
  try {
    const got = new Set<number>();
    for (const url of MONITOR) {
      const r = await fetch(url, { ...UA, signal: AbortSignal.timeout(30_000) }).catch(() => null);
      if (!r || !r.ok) continue;
      const body = (await r.json().catch(() => [])) as MonitorShip[] | { ships?: MonitorShip[] };
      const list = Array.isArray(body) ? body : body.ships;
      if (!Array.isArray(list)) continue;
      for (const m of list) {
        const id = Number(m.mmsi), t = Date.parse(m.timestamp || m.last_position || "");
        // The directory also lists ships last heard weeks ago: only the last six hours are a position.
        if (!id || !Number.isFinite(m.latitude) || !Number.isFinite(m.longitude) || !Number.isFinite(t) || Date.now() - t > SEA_KEEP.posMs) continue;
        if (url.includes("/bab/")) hzBab.add(id);
        const s: Ship = sea.ships.get(id) || { mmsi: id, name: "", lat: 0, lon: 0, sog: null, cog: null, hdg: null, nav: null, t: 0 };
        s.name = s.name || String(m.name || "").trim();
        const cat = String(m.ship_category || "").trim();
        if (cat) s.cat = cat;
        if (s.type == null) s.type = typeOfCategory(cat);
        if (m.flag) s.flag = m.flag;
        if (m.dwt) s.dwt = m.dwt;
        if (!s.len && m.length) s.len = m.length;
        if (!s.beam && m.width) s.beam = m.width;
        if (!s.draught && m.draught) s.draught = m.draught;
        if (!s.dest && m.destination) s.dest = String(m.destination).trim();
        s.sAt = Math.max(s.sAt ?? 0, t);
        if (t > s.t) {
          Object.assign(s, { lat: +m.latitude.toFixed(4), lon: +m.longitude.toFixed(4), sog: m.speed ?? null, cog: m.course ?? null, hdg: m.hdg ?? null, t, by: "hz" });
          if (m.still || (s.sog != null && s.sog < 0.5)) {
            if (s.stop && s.stop.to > t - 3 * 3600_000 && km(s.stop.lat, s.stop.lon, s.lat, s.lon) < 5) s.stop.to = t;
            else s.stop = { lat: s.lat, lon: s.lon, from: t, to: t };
          }
          seaHist.add(id, s.lat, s.lon, t / 1000);
        }
        sea.ships.set(id, s);
        got.add(id);
      }
    }
    if (got.size) monitor.n = got.size;
  } catch { /* tried again in 15 minutes */ }
  finally { monitor.busy = false; }
}

/**
 * A ship's 30 days from the monitor (one fix each half hour), for where it came from and a longer
 * past track: asked only when a reader opens the ship, kept 30 minutes, one call at a time.
 */
const hzHist = new Map<number, { at: number; p: Promise<HistFix[]> }>();
const hzGate = { next: 0 };
function hzHistory(mmsi: number) {
  const had = hzHist.get(mmsi);
  if (had && Date.now() - had.at < 30 * 60_000) return had.p;
  if (hzHist.size > 400) hzHist.clear();
  const wait = Math.max(0, hzGate.next - Date.now());
  hzGate.next = Date.now() + wait + 1000;
  const p = sleep(wait)
    .then(() => fetch(`${HZ}${hzBab.has(mmsi) ? "bab/" : ""}ship/history?mmsi=${mmsi}`, { ...UA, signal: AbortSignal.timeout(15_000) }))
    .then((r) => (r.ok ? r.json() : []))
    .then((x: unknown) => (Array.isArray(x) ? x : []).map((f: Record<string, unknown>) => ({ lat: Number(f.latitude), lon: Number(f.longitude), t: Date.parse(String(f.timestamp)) / 1000, speed: typeof f.speed === "number" ? f.speed : null })))
    .catch(() => [] as HistFix[]);
  hzHist.set(mmsi, { at: Date.now(), p });
  return p;
}
/** A place for a stop: the port there, else "off" the port within 80 km, else the sea position. */
function stopPlace(lat: number, lon: number) {
  const p = nearestPort(lat, lon, 30);
  if (p) return { name: p.name, locode: p.code ?? null };
  const q = nearestPort(lat, lon, 80);
  return { name: q ? `off ${q.name}` : `at sea ${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`, locode: null };
}

/** A ship's route: the AIS destination (and ETA) its crew set, where it came from, and its past track. */
async function seaRoute(mmsi: number) {
  const s = sea.ships.get(mmsi);
  // The monitor's 30 days for its ships: where it last stopped before now, and two days of track.
  const hist = s && s.cat ? await hzHistory(mmsi) : [];
  const recent = hist.filter((f) => f.t > Date.now() / 1000 - 48 * 3600 && !shipInland(f.lat, f.lon)).map((f) => [+f.lat.toFixed(4), +f.lon.toFixed(4), Math.round(f.t)] as TrackPoint);
  const track = joinTracks(300, recent, seaHist.get(mmsi).filter((p) => !shipInland(p[0], p[1])), s && s.t ? [[s.lat, s.lon, Math.round(s.t / 1000)]] : []);
  if (!s) return { ok: true, kind: "sea", mmsi, origin: null, destination: null, track, source: [], confidence: "unknown", note: "no position in the last six hours" };
  const moving = s.sog != null && s.sog >= 0.5 && s.nav !== 1 && s.nav !== 5;
  let origin = null;
  const from = hist.length ? cameFrom(hist) : null;
  if (from) {
    origin = { ...stopPlace(from.lat, from.lon), lat: from.lat, lon: from.lon, left: new Date(from.left * 1000).toISOString() };
  } else if (s.stop && moving) {
    const p = nearestPort(s.stop.lat, s.stop.lon, 30);
    origin = { name: p ? p.name : null, locode: p?.code ?? null, lat: s.stop.lat, lon: s.stop.lon, left: new Date(s.stop.to).toISOString() };
  } else if (!moving) {
    const p = nearestPort(s.lat, s.lon, 30);
    origin = p ? { name: p.name, locode: p.code, lat: p.lat, lon: p.lon, left: null } : null;
  }
  const port = matchPort(s.dest);
  const destination = s.dest ? { name: port ? port.name : s.dest, locode: port?.code ?? null, lat: port?.lat ?? null, lon: port?.lon ?? null, ais: s.dest, eta: s.eta ?? null } : null;
  // Confirmed: the destination is a known port and the ship's course points at it (or it is nearly there).
  let confidence: "confirmed" | "likely" | "unknown" = destination ? "likely" : "unknown";
  if (port && moving && s.cog != null) {
    const d = km(s.lat, s.lon, port.lat, port.lon);
    // Ships follow coasts and straits, so the course is held to the destination only loosely.
    if (d < 50 || angleDiff(bearing(s.lat, s.lon, port.lat, port.lon), s.cog) <= 75) confidence = "confirmed";
  }
  const source = [s.by === "hz" ? "Strait of Hormuz Ship Monitor, hormuz.data-tracking.net (AIS destination as set by the crew)" : "AISStream (AIS destination and ETA as set by the crew)"];
  if (from) source.push("the monitor's 30-day history of the ship (where it last lay still)");
  else if (origin) source.push("the desk's own kept positions (where the ship last lay still)");
  return { ok: true, kind: "sea", mmsi, name: s.name || null, origin, destination, track, source, confidence };
}

/* Kept warm from the start in the site's own server process (port 3000 on the VM), not the scan
   worker on port 3001 nor a build; elsewhere the first request starts it. */
if (process.env.NODE_ENV === "production" && process.env.NITRO_PORT && process.env.NITRO_PORT !== "3001") {
  void airLoop();
  seaOpen();
  void monitorRead();
  setInterval(() => void monitorRead(), 5 * 60_000).unref?.();
}

const json = (body: unknown, cache = "public, max-age=0, must-revalidate") =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, "cdn-cache-control": "public, s-maxage=10, stale-while-revalidate=20" } });

export const Route = createFileRoute("/api/traffic")({
  server: {
    handlers: {
      GET: ({ request }) => metered("traffic", async () => {
        const q = new URL(request.url).searchParams;
        const kind = q.get("kind") || "air";
        // One aircraft's or ship's route: GET /api/traffic?route=<hex>&cs=<callsign> or ?kind=sea&mmsi=<mmsi>.
        if (kind === "sea" && q.get("mmsi")) {
          const mmsi = Number(q.get("mmsi"));
          if (!Number.isInteger(mmsi) || mmsi <= 0) return json({ ok: false, why: "bad mmsi" });
          if (!process.env.AISSTREAM_KEY) return json({ ok: false, kind: "sea", mmsi, origin: null, destination: null, track: [], source: [], confidence: "unknown", note: "no-key" });
          return json(await seaRoute(mmsi));
        }
        const hex = (q.get("route") || "").toLowerCase();
        if (q.has("route")) {
          if (!/^~?[0-9a-f]{6}$/.test(hex)) return json({ ok: false, why: "bad hex" });
          const s = air.seen.get(hex);
          const cs = (q.get("cs") || String(s?.a.flight || "")).trim().toUpperCase() || null;
          const pos = s ? { lat: s.a.lat, lon: s.a.lon, track: typeof s.a.track === "number" ? s.a.track : null, t: Math.round(s.t / 1000) } : null;
          const ans = await airRoute(hex.replace("~", ""), cs, pos, airHist.get(hex));
          // The list's from/to follows the checked answer: a route that did not fit is not shown there either.
          if (cs && s && ans.checks.length && String(s.a.flight || "").trim().toUpperCase() === cs) {
            const at = (p: NonNullable<typeof ans.origin>) => [p.iata || p.icao, p.city || p.name].filter(Boolean).join(" ");
            routes.set(cs, ans.origin && ans.destination ? { from: at(ans.origin), to: at(ans.destination) } : null);
            air.ver++;
          }
          return json(ans, "public, max-age=60");
        }
        if (kind === "sea") {
          if (!process.env.AISSTREAM_KEY) return json({ ok: false, live: false, note: "no-key", ships: [], why: "The live ship feed needs a free AISStream key on the server (AISSTREAM_KEY); none is set." });
          sea.asked = Date.now();
          seaOpen();
          void monitorRead();
          seaTidy();
          // Not a ship deep inland (a false position, see ship-land.ts).
          const ships = [...sea.ships.values()].filter((s) => s.t && inSeaBox(s.lat, s.lon) && !shipInland(s.lat, s.lon));
          return json({ ok: true, live: sea.note === "live", note: sea.note, at: new Date().toISOString(), src: { ais: sea.note, monitor: monitor.n }, ships: ships.map((s) => [s.mmsi, s.name, s.lat, s.lon, s.sog, s.cog, s.hdg, s.nav, s.type ?? null, s.dest || null, s.cs || null, s.imo ?? null, s.len ?? null, new Date(s.t).toISOString(), Math.round(s.t / 1000), s.eta ?? null, s.draught ?? null, s.beam ?? null, s.flag || flagOf(s.mmsi),
            // 22 Oct (at the end): the monitor's category; deadweight in tonnes; whose position (SEA_ROW).
            s.cat ?? null, s.dwt ?? null, s.by ?? null]) });
        }
        air.asked = Date.now();
        if (air.wake) air.wake();
        void airLoop();
        // Only right after a restart is there nothing yet: the first circle lands within a few seconds.
        for (let i = 0; i < 30 && !air.at; i++) await sleep(500);
        // Positions from a reading that stopped long ago are not shown as live.
        const stale = !air.at || Date.now() - Date.parse(air.at) > 300_000;
        const fresh = Date.now() - 300_000;
        return json({ ok: true, at: air.at, ac: stale ? [] : airRows(), src: [...air.srcOk].filter(([, t]) => t > fresh).map(([k]) => k), ships: !!process.env.AISSTREAM_KEY,
          cover: [air.readAt.filter((t) => t > Date.now() - 200_000).length, CIRCLES.length] });
      }),
    },
  },
});
