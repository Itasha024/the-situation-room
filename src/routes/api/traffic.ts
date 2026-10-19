import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";

/**
 * Live traffic for the map-first view's "Live traffic" button (user, 19 Oct: every aircraft and
 * ship in the region, live, whenever the buttons are on).
 *
 * - Aircraft: adsb.fi's open data (no key; one call a second): twelve circles cover the region,
 *   its military list every two minutes, and the scheduled route of a flight number from
 *   adsb.lol's standing data. Read only while someone has the layer on (asked in the last three
 *   minutes), then the reading stops.
 * - Ships: AISStream's live feed, read here (its terms keep the key off the browser), only when
 *   the server has an AISSTREAM_KEY; without one the answer says so and the page offers none.
 */
const UA = { headers: { "user-agent": "TheSituationRoom/1.0 (+https://thesituationroom.live)" } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CIRCLES: [number, number, number][] = [
  [26.5, 54, 250], [29, 49, 250], [33, 44, 250], [32.5, 35.5, 200], [35.5, 51.5, 250], [30, 57, 250],
  [21, 40, 250], [15, 43, 250], [13, 48, 250], [24, 46, 250], [18, 38, 250], [34, 38, 200],
];
const inBox = (lat: number, lon: number) => lat > 8 && lat < 42 && lon > 30 && lon < 64;

type Ac = Record<string, unknown> & { hex: string; lat?: number; lon?: number };
type Row = (string | number | null)[];

const air = { rows: [] as Row[], at: "", asked: 0, running: false, mil: new Set<string>(), milAt: 0 };
const routes = new Map<string, { from: string; to: string } | null>();

async function getJson(u: string) {
  const r = await fetch(u, { ...UA, signal: AbortSignal.timeout(12_000) });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json() as Promise<{ aircraft?: Ac[]; ac?: Ac[]; _airports?: { iata?: string; icao?: string; location?: string; name?: string; countryiso2?: string }[] }>;
}
async function routeOf(cs: string) {
  if (routes.has(cs) || !/^[A-Z]{3}\d/.test(cs) || routes.size > 6000) return;
  routes.set(cs, null);
  try {
    const x = await getJson(`https://vrs-standing-data.adsb.lol/routes/${cs.slice(0, 2)}/${cs}.json`);
    const A = x._airports || [];
    const at = (a: (typeof A)[number]) => [a.iata || a.icao, a.location || a.name].filter(Boolean).join(" ");
    if (A.length >= 2) routes.set(cs, { from: at(A[0]), to: at(A[A.length - 1]) });
  } catch { /* none */ }
}
async function airLoop() {
  if (air.running) return;
  air.running = true;
  try {
    while (Date.now() - air.asked < 180_000) {
      const all = new Map<string, Ac>();
      for (const [la, lo, d] of CIRCLES) {
        try {
          const x = await getJson(`https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${d}`);
          for (const a of x.aircraft || x.ac || []) if (typeof a.lat === "number") all.set(a.hex, a);
        } catch { /* the next sweep */ }
        await sleep(1100);
      }
      if (Date.now() - air.milAt > 120_000) {
        air.milAt = Date.now();
        try {
          const x = await getJson("https://opendata.adsb.fi/api/v2/mil");
          for (const a of x.aircraft || x.ac || []) {
            air.mil.add(a.hex);
            if (typeof a.lat === "number" && typeof a.lon === "number" && inBox(a.lat, a.lon)) all.set(a.hex, { ...all.get(a.hex), ...a });
          }
        } catch { /* the next time */ }
        await sleep(1100);
      }
      const rows: Row[] = [];
      let lookups = 0;
      for (const a of all.values()) {
        const lat = Number(a.lat), lon = Number(a.lon);
        if (!inBox(lat, lon) || a.alt_baro === "ground") continue;
        const f = String(a.flight || "").trim();
        const mil = air.mil.has(a.hex) || (Number(a.dbFlags) & 1) === 1 ? 1 : 0;
        if (f && !mil && !routes.has(f) && lookups < 8) { lookups++; void routeOf(f); }
        const rt = f ? routes.get(f) : null;
        const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
        // hex, lat, lon, altitude ft, ground speed kt, track, climb ft/min, squawk, flight, registration,
        // type code, type, operator, military, from, to
        rows.push([a.hex, +lat.toFixed(4), +lon.toFixed(4), n(a.alt_baro), n(a.gs), n(a.track), n(a.baro_rate ?? a.geom_rate), (a.squawk as string) || null,
          f || null, (a.r as string) || null, (a.t as string) || null, (a.desc as string) || null, (a.ownOp as string) || null, mil, rt ? rt.from : null, rt ? rt.to : null]);
      }
      if (rows.length) { air.rows = rows; air.at = new Date().toISOString(); }
    }
  } finally {
    air.running = false;
  }
}

/* Ships: AISStream, kept open while asked for in the last ten minutes. */
type Ship = { mmsi: number; name: string; lat: number; lon: number; sog: number | null; cog: number | null; hdg: number | null; nav: number | null; type?: number; dest?: string; cs?: string; imo?: number; len?: number; t: number };
const sea = { ships: new Map<number, Ship>(), asked: 0, ws: null as WebSocket | null, note: "" };
function seaOpen() {
  const key = process.env.AISSTREAM_KEY;
  if (!key || sea.ws || typeof WebSocket === "undefined") return;
  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  sea.ws = ws;
  sea.note = "connecting";
  ws.onopen = () => {
    sea.note = "live";
    ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: [[[8, 30], [32, 63]]], FilterMessageTypes: ["PositionReport", "StandardClassBPositionReport", "ShipStaticData"] }));
  };
  ws.onmessage = async (ev) => {
    try {
      const m = JSON.parse(typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text());
      const md = m.MetaData || {};
      const id = Number(md.MMSI);
      if (!id) return;
      const s: Ship = sea.ships.get(id) || { mmsi: id, name: "", lat: 0, lon: 0, sog: null, cog: null, hdg: null, nav: null, t: 0 };
      s.name = String(md.ShipName || s.name || "").trim();
      const pr = m.Message && (m.Message.PositionReport || m.Message.StandardClassBPositionReport);
      if (pr) Object.assign(s, { lat: +Number(md.latitude).toFixed(4), lon: +Number(md.longitude).toFixed(4), sog: pr.Sog ?? null, cog: pr.Cog ?? null, hdg: pr.TrueHeading === 511 ? null : pr.TrueHeading ?? null, nav: pr.NavigationalStatus ?? null, t: Date.now() });
      const st = m.Message && m.Message.ShipStaticData;
      if (st) {
        const D = st.Dimension || {};
        Object.assign(s, { type: st.Type, dest: String(st.Destination || "").trim(), cs: String(st.CallSign || "").trim(), imo: st.ImoNumber || undefined, len: (D.A || 0) + (D.B || 0) || undefined });
      }
      sea.ships.set(id, s);
    } catch { /* a bad message */ }
  };
  ws.onclose = () => { sea.ws = null; sea.note = "closed"; };
  ws.onerror = () => { /* onclose follows */ };
}
function seaTidy() {
  const cut = Date.now() - 3 * 3600_000;
  for (const [k, s] of sea.ships) if (s.t < cut) sea.ships.delete(k);
  if (sea.ws && Date.now() - sea.asked > 600_000) { try { sea.ws.close(); } catch { /* gone */ } sea.ws = null; }
}

const json = (body: unknown, cache = "public, max-age=0, must-revalidate") =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, "cdn-cache-control": "public, s-maxage=10, stale-while-revalidate=20" } });

export const Route = createFileRoute("/api/traffic")({
  server: {
    handlers: {
      GET: ({ request }) => metered("traffic", async () => {
        const kind = new URL(request.url).searchParams.get("kind") || "air";
        if (kind === "sea") {
          if (!process.env.AISSTREAM_KEY) return json({ ok: false, live: false, note: "no-key", ships: [] });
          sea.asked = Date.now();
          seaOpen();
          seaTidy();
          const ships = [...sea.ships.values()].filter((s) => s.t && inBox(s.lat, s.lon));
          return json({ ok: true, live: sea.note === "live", note: sea.note, at: new Date().toISOString(), ships: ships.map((s) => [s.mmsi, s.name, s.lat, s.lon, s.sog, s.cog, s.hdg, s.nav, s.type ?? null, s.dest || null, s.cs || null, s.imo ?? null, s.len ?? null, new Date(s.t).toISOString()]) });
        }
        air.asked = Date.now();
        // Positions from a reading that stopped long ago are not shown as live.
        if (!air.running && air.at && Date.now() - Date.parse(air.at) > 300_000) air.rows = [];
        void airLoop();
        // The first answer after a quiet spell waits for the first circles to come in.
        for (let i = 0; i < 48 && !air.rows.length; i++) await sleep(500);
        return json({ ok: true, at: air.at, ac: air.rows, ships: !!process.env.AISSTREAM_KEY });
      }),
    },
  },
});
