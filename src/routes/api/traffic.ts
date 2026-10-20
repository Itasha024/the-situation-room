import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";

/**
 * Live traffic for the map-first view's "Live traffic" button (user, 19 Oct: every aircraft and
 * ship in the region, live, whenever the buttons are on; 20 Oct: "make sure it loads immediately
 * all the live data upon choosing to activate it" and "not missing any data").
 *
 * - Aircraft: adsb.fi's and adsb.lol's open data together (no key; each sees through its own
 *   receivers, so the two give the fuller picture; adsb.fi one call a second, adsb.lol 500 a day,
 *   so adsb.fi carries the sweep and adsb.lol tops it up, see `lol` below). 35 circles of 250 nm
 *   cover the whole box (8–42°N, 30–64°E) with no gap. The reading never stops: one pass a minute
 *   while nobody looks, passes back to back while someone has the layer on, so the first answer
 *   is the warm picture at once. Each circle's aircraft join the picture as it lands; an aircraft
 *   neither feed sees any longer inside a circle just read leaves it. Circles that held nothing
 *   are read every third pass (still at least every three minutes). adsb.fi's military list every
 *   two minutes (adsb.lol's every ten), those on the ground too (marked), and the scheduled route of a flight number from
 *   adsb.lol's standing data.
 * - Ships: AISStream's live feed, read here (its terms keep the key off the browser; compressed,
 *   as its terms ask from September 2026), kept open whenever the server has an AISSTREAM_KEY
 *   (/srv/desk/app.env on the server); without one the answer says so and the page offers none.
 *   No free live AIS source without an account covers the region (checked 20 Oct).
 */
const UA = { headers: { "user-agent": "TheSituationRoom/1.0 (+https://thesituationroom.live)" } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RADIUS = 250; // nm, the most either feed answers
/** A hexagonal lattice over the box, checked on a 0.05° grid: no point of the box is outside every circle. */
const LATTICE: [number, number][] = [
  [9, 30], [9, 36.9], [9, 43.9], [9, 50.8], [9, 57.7], [9, 64.7],
  [14.9, 33.6], [14.9, 40.7], [14.9, 47.8], [14.9, 54.9], [14.9, 62.1],
  [20.8, 30], [20.8, 37.4], [20.8, 44.8], [20.8, 52.2], [20.8, 59.6], [20.8, 67],
  [26.6, 33.9], [26.6, 41.7], [26.6, 49.5], [26.6, 57.3], [26.6, 65.1],
  [32.5, 30], [32.5, 38.3], [32.5, 46.6], [32.5, 55], [32.5, 63.3],
  [38.4, 34.5], [38.4, 43.5], [38.4, 52.6], [38.4, 61.6],
  [44.3, 30], [44.3, 39.4], [44.3, 48.9], [44.3, 58.3],
];
const inBox = (lat: number, lon: number) => lat > 8 && lat < 42 && lon > 30 && lon < 64;
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
const FIELDS = ["alt_baro", "gs", "track", "baro_rate", "geom_rate", "squawk", "flight", "r", "t", "desc", "ownOp", "dbFlags"];
function slim(x: Record<string, unknown>): Ac | null {
  if (typeof x.hex !== "string" || typeof x.lat !== "number" || typeof x.lon !== "number") return null;
  const a: Ac = { hex: x.hex, lat: x.lat, lon: x.lon };
  for (const k of FIELDS) { const v = x[k]; if (typeof v === "string" || typeof v === "number") a[k] = v; }
  return a;
}

/**
 * seen: each aircraft with the time its position was taken (ms), and whether only adsb.lol saw it
 * last (adsb.lol is read far less often, so its own aircraft are not dropped by an adsb.fi read).
 */
const air = {
  seen: new Map<string, { a: Ac; t: number; lol: boolean }>(),
  rows: [] as Row[], ver: 0, built: -1,
  at: "", asked: 0, running: false, wake: null as null | (() => void),
  mil: new Set<string>(), milAt: 0, lolMilAt: 0,
  srcOk: new Map<string, number>(),
  count: CIRCLES.map(() => -1), readAt: CIRCLES.map(() => 0), lolAt: CIRCLES.map(() => 0),
};
/**
 * adsb.lol allows one address 4 calls a second, 60 a minute and 500 a day (its x-ratelimit-limit
 * header, 20 Oct; past that every call is refused for a while). So it is spent from a budget of
 * 450 a day, only while someone has the layer on: the busiest circles in turn, and its military
 * list every ten minutes. adsb.fi (one call a second, no daily cap) carries the sweep.
 */
const lol = { tokens: 10, at: Date.now(), until: 0 };
function lolSpend() {
  const now = Date.now();
  lol.tokens = Math.min(40, lol.tokens + ((now - lol.at) * 450) / 86_400_000);
  lol.at = now;
  if (now < lol.until || lol.tokens < 1) return false;
  lol.tokens -= 1;
  return true;
}
const routes = new Map<string, { from: string; to: string } | null>();

async function getJson(u: string) {
  const r = await fetch(u, { ...UA, signal: AbortSignal.timeout(12_000) });
  if (r.status === 429 && u.includes("adsb.lol")) lol.until = Date.now() + Math.max(60, Number(r.headers.get("retry-after")) || 0) * 1000;
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json() as Promise<{ aircraft?: Record<string, unknown>[]; ac?: Record<string, unknown>[]; _airports?: { iata?: string; icao?: string; location?: string; name?: string; countryiso2?: string }[] }>;
}
async function routeOf(cs: string) {
  if (routes.has(cs) || !/^[A-Z]{3}\d/.test(cs)) return;
  if (routes.size > 6000) routes.clear();
  routes.set(cs, null);
  try {
    const x = await getJson(`https://vrs-standing-data.adsb.lol/routes/${cs.slice(0, 2)}/${cs}.json`);
    const A = x._airports || [];
    const at = (a: (typeof A)[number]) => [a.iata || a.icao, a.location || a.name].filter(Boolean).join(" ");
    if (A.length >= 2) routes.set(cs, { from: at(A[0]), to: at(A[A.length - 1]) });
  } catch { /* none */ }
}

/** The fresher position of the two feeds wins; the other fills what it lacks. */
function put(a: Ac, now: number, fromLol: boolean) {
  const t = now - Math.max(0, Number(a.seen_pos ?? 0)) * 1000;
  const was = air.seen.get(a.hex);
  if (!was || t >= was.t) air.seen.set(a.hex, { a: was ? { ...was.a, ...a } : a, t, lol: fromLol && (!was || was.lol) });
  else { was.a = { ...a, ...was.a }; if (!fromLol) was.lol = false; }
}
async function readFeed(u: string, now: number, fromLol: boolean) {
  const x = await getJson(u);
  const got = new Set<string>();
  for (const raw of x.aircraft || x.ac || []) {
    const a = slim(raw);
    if (!a) continue;
    a.seen_pos = Number(raw.seen_pos ?? 0);
    got.add(a.hex);
    put(a, now, fromLol);
  }
  air.srcOk.set(fromLol ? "adsb.lol" : "adsb.fi", Date.now());
  return got;
}
async function readCircle(i: number, withLol: boolean) {
  const [la, lo] = CIRCLES[i];
  const now = Date.now();
  const [fi, ll] = await Promise.all([
    readFeed(`https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${RADIUS}`, now, false).catch(() => null),
    withLol ? readFeed(`https://api.adsb.lol/v2/point/${la}/${lo}/${RADIUS}`, now, true).catch(() => null) : Promise.resolve(null),
  ]);
  if (ll) air.lolAt[i] = now;
  if (!fi && !ll) return;
  // Mark what adsb.fi saw itself; then what the feeds that answered no longer see well inside the circle has gone.
  if (fi) for (const h of fi) { const s = air.seen.get(h); if (s) s.lol = false; }
  for (const [h, s] of air.seen) {
    if (fi?.has(h) || ll?.has(h) || s.t >= now || nm(la, lo, s.a.lat, s.a.lon) > RADIUS - 10) continue;
    if (ll || (fi && !s.lol)) air.seen.delete(h);
  }
  air.count[i] = new Set([...(fi || []), ...(ll || [])]).size;
  air.readAt[i] = Date.now();
  air.at = new Date().toISOString();
  air.ver++;
}
async function readMil() {
  const now = Date.now();
  const lists: [string, boolean][] = [["https://opendata.adsb.fi/api/v2/mil", false]];
  if (Date.now() - air.lolMilAt > 600_000 && watched() && lolSpend()) { air.lolMilAt = now; lists.push(["https://api.adsb.lol/v2/mil", true]); }
  air.milAt = now;
  for (const [u, fromLol] of lists) {
    try {
      const x = await getJson(u);
      for (const raw of x.aircraft || x.ac || []) {
        if (typeof raw.hex === "string") air.mil.add(raw.hex);
        const a = slim(raw);
        if (a && inBox(a.lat, a.lon)) { a.seen_pos = Number(raw.seen_pos ?? 0); put(a, now, fromLol); }
      }
      air.srcOk.set(fromLol ? "adsb.lol" : "adsb.fi", Date.now());
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
        await sleep(1100); // adsb.fi: one call a second
      }
      if (Date.now() - air.milAt > 120_000) { await readMil(); await sleep(1100); }
      // An aircraft whose circle has not been read for four minutes (feeds failing) is not shown as live,
      // nor one only adsb.lol saw, two and a half minutes on.
      const cut = Date.now() - 240_000, cutLol = Date.now() - 150_000;
      for (const [h, s] of air.seen) if (s.t < cut || (s.lol && s.t < cutLol)) air.seen.delete(h);
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
  if (air.built === air.ver) return air.rows;
  const rows: Row[] = [];
  let lookups = 0;
  const now = Date.now();
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  for (const { a, t } of air.seen.values()) {
    const { lat, lon } = a;
    if (!inBox(lat, lon)) continue;
    const gnd = a.alt_baro === "ground" ? 1 : 0;
    const f = String(a.flight || "").trim();
    const mil = air.mil.has(a.hex) || (Number(a.dbFlags) & 1) === 1 ? 1 : 0;
    if (f && !mil && !routes.has(f) && lookups < 8) { lookups++; void routeOf(f); }
    const rt = f ? routes.get(f) : null;
    // hex, lat, lon, altitude ft, ground speed kt, track, climb ft/min, squawk, flight, registration,
    // type code, type, operator, military, from, to, on the ground, seconds since the position
    rows.push([a.hex, +lat.toFixed(4), +lon.toFixed(4), gnd ? 0 : n(a.alt_baro), n(a.gs), n(a.track), n(a.baro_rate ?? a.geom_rate), s(a.squawk),
      f || null, s(a.r), s(a.t), s(a.desc), s(a.ownOp), mil, rt ? rt.from : null, rt ? rt.to : null, gnd, Math.max(0, Math.round((now - t) / 1000))]);
  }
  air.rows = rows;
  air.built = air.ver;
  return rows;
}

/* Ships: AISStream, kept open while the server has a key, so the picture is already there when asked for. */
type Ship = { mmsi: number; name: string; lat: number; lon: number; sog: number | null; cog: number | null; hdg: number | null; nav: number | null; type?: number; dest?: string; cs?: string; imo?: number; len?: number; t: number };
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
    ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: [[[8, 30], [42, 64]]],
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
      if (pr && typeof md.latitude === "number" && typeof md.longitude === "number") {
        Object.assign(s, { lat: +md.latitude.toFixed(4), lon: +md.longitude.toFixed(4), sog: num(pr.Sog), cog: num(pr.Cog), hdg: pr.TrueHeading === 511 ? null : num(pr.TrueHeading), nav: num(pr.NavigationalStatus) ?? s.nav, t: Date.now() });
      }
      const st = M.ShipStaticData;
      if (st) {
        const D = (st.Dimension || {}) as Record<string, number>;
        Object.assign(s, { type: st.Type, dest: String(st.Destination || "").trim(), cs: String(st.CallSign || "").trim(), imo: st.ImoNumber || undefined, len: (D.A || 0) + (D.B || 0) || undefined });
      }
      const sd = M.StaticDataReport as Record<string, Record<string, unknown> | undefined> | undefined;
      if (sd) {
        if (sd.ReportA && sd.ReportA.Name) s.name = String(sd.ReportA.Name).trim() || s.name;
        const B = sd.ReportB;
        if (B) {
          const D = (B.Dimension || {}) as Record<string, number>;
          Object.assign(s, { type: B.ShipType ?? s.type, cs: String(B.CallSign || s.cs || "").trim(), len: (D.A || 0) + (D.B || 0) || s.len });
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
  const cut = Date.now() - 3 * 3600_000;
  // A ship with no position for three hours (or never one) goes; never more than 40,000 kept.
  for (const [k, s] of sea.ships) if (s.t ? s.t < cut : Date.now() - sea.openedAt > 3600_000 && sea.ships.size > 20_000) sea.ships.delete(k);
  if (sea.ships.size > 40_000) for (const k of [...sea.ships.keys()].slice(0, sea.ships.size - 40_000)) sea.ships.delete(k);
}

/* Kept warm from the start in the site's own server process (port 3000 on the VM), not the scan
   worker on port 3001 nor a build; elsewhere the first request starts it. */
if (process.env.NODE_ENV === "production" && process.env.NITRO_PORT && process.env.NITRO_PORT !== "3001") {
  void airLoop();
  seaOpen();
}

const json = (body: unknown, cache = "public, max-age=0, must-revalidate") =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, "cdn-cache-control": "public, s-maxage=10, stale-while-revalidate=20" } });

export const Route = createFileRoute("/api/traffic")({
  server: {
    handlers: {
      GET: ({ request }) => metered("traffic", async () => {
        const kind = new URL(request.url).searchParams.get("kind") || "air";
        if (kind === "sea") {
          if (!process.env.AISSTREAM_KEY) return json({ ok: false, live: false, note: "no-key", ships: [], why: "The live ship feed needs a free AISStream key on the server (AISSTREAM_KEY); none is set." });
          sea.asked = Date.now();
          seaOpen();
          seaTidy();
          const ships = [...sea.ships.values()].filter((s) => s.t && inBox(s.lat, s.lon));
          return json({ ok: true, live: sea.note === "live", note: sea.note, at: new Date().toISOString(), ships: ships.map((s) => [s.mmsi, s.name, s.lat, s.lon, s.sog, s.cog, s.hdg, s.nav, s.type ?? null, s.dest || null, s.cs || null, s.imo ?? null, s.len ?? null, new Date(s.t).toISOString()]) });
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
