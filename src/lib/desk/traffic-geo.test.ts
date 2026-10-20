import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tidyShips, AIR_BOX, AIR_ROW, AIR_ROW_LEN, aisEta, bearing, continues, destPoint, EST, project, inAirBox, inSeaBox, km, lattice, History, joinTracks, matchPort, nearestPort, pickRoute, routeFits, SEA_ROW, SEA_ROW_LEN, type Place } from "./traffic-geo.ts";

/** Commas outside brackets: the number of fields of a row literal, less one. */
function topCommas(src: string) {
  let depth = 0, n = 0;
  for (const ch of src.slice(src.indexOf("[") + 1)) {
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === "," && depth === 0) n++;
  }
  return n;
}
const ap = (icao: string, lat: number, lon: number): Place => ({ name: icao, icao, iata: null, lat, lon });
const CAI = ap("HECA", 30.12, 31.41), DXB = ap("OMDB", 25.25, 55.36), IST = ap("LTFM", 41.26, 28.74), LYS = ap("LFLL", 45.73, 5.08), BER = ap("EDDB", 52.36, 13.5), AMM = ap("OJAI", 31.72, 35.99);

test("a flight on the line between its airports and heading for the destination fits", () => {
  // THY3PC, 20 Oct: Istanbul–Cairo, live at 32.87N 30.98E on 175°.
  const f = routeFits(IST, CAI, { lat: 32.87, lon: 30.98 }, 175);
  assert.equal(f.ok, true);
  assert.ok(f.offKm < 50);
});

test("a flight flying away from the destination does not fit", () => {
  assert.equal(routeFits(IST, CAI, { lat: 32.87, lon: 30.98 }, 355).ok, false);
});

test("a flight far off the great circle does not fit", () => {
  // QTR8813 over the Nile delta on 175° matched no route its callsign was filed with.
  assert.equal(routeFits(ap("MPTO", 9.07, -79.38), ap("EBLG", 50.64, 5.44), { lat: 31.82, lon: 31.09 }, 175).ok, false);
});

test("a flight beyond the destination does not fit", () => {
  // On the Cairo–Dubai line extended 600 km east of Dubai, still heading east.
  assert.equal(routeFits(CAI, DXB, { lat: 24, lon: 61 }, 100).ok, false);
});

test("near either end the heading is not checked (climb-out, holding, approach)", () => {
  assert.equal(routeFits(CAI, DXB, { lat: 25.6, lon: 55.0 }, 300).ok, true);
});

test("pickRoute: the source whose origin matches the seen take-off wins and is confirmed", () => {
  // RJA122, 20 Oct: adsbdb said Berlin–Amman, adsb.im Lyon–Amman; the flown track began at Lyon.
  const pos = { lat: 34.25, lon: 31.0, track: 122 };
  const p = pickRoute([{ source: "adsbdb", origin: BER, destination: AMM }, { source: "adsb.im", origin: LYS, destination: AMM }], pos, { lat: 45.73, lon: 5.09 });
  assert.equal(p.origin?.icao, "LFLL");
  assert.equal(p.confidence, "confirmed");
});

test("pickRoute: two sources agreeing confirm; one alone is likely; none fitting is unknown", () => {
  const pos = { lat: 32.87, lon: 30.98, track: 175 };
  assert.equal(pickRoute([{ source: "a", origin: IST, destination: CAI }, { source: "b", origin: IST, destination: CAI }], pos, null).confidence, "confirmed");
  assert.equal(pickRoute([{ source: "a", origin: IST, destination: CAI }], pos, null).confidence, "likely");
  const none = pickRoute([{ source: "a", origin: CAI, destination: IST }], pos, null);
  assert.equal(none.confidence, "unknown");
  assert.equal(none.origin, null);
  assert.equal(none.destination, null);
});

test("pickRoute: a take-off seen far from the stated origin rules the route out", () => {
  const p = pickRoute([{ source: "a", origin: IST, destination: CAI }], { lat: 32.87, lon: 30.98, track: 175 }, { lat: 52.3, lon: 4.8 });
  assert.equal(p.confidence, "unknown");
});

test("row index maps: new fields only at the end, the old ones where the front end reads them", () => {
  assert.equal(AIR_ROW.ageSec, 17);
  assert.equal(AIR_ROW.speedKt, 4);
  assert.equal(AIR_ROW.trackDeg, 5);
  assert.equal(AIR_ROW.climbFpm, 6);
  assert.equal(AIR_ROW.posTime, 18);
  assert.equal(AIR_ROW.source, 20);
  assert.equal(AIR_ROW.estimated, 21);
  assert.equal(Math.max(...Object.values(AIR_ROW)) + 1, AIR_ROW_LEN);
  assert.equal(new Set(Object.values(AIR_ROW)).size, AIR_ROW_LEN);
  assert.equal(SEA_ROW.posTimeIso, 13);
  assert.equal(SEA_ROW.posTime, 14);
  assert.equal(Math.max(...Object.values(SEA_ROW)) + 1, SEA_ROW_LEN);
  assert.equal(new Set(Object.values(SEA_ROW)).size, SEA_ROW_LEN);
  // The route file builds rows of exactly these lengths.
  const src = readFileSync(new URL("../../routes/api/traffic.ts", import.meta.url), "utf8");
  const airRow = src.slice(src.indexOf("rows.push([a.hex"), src.indexOf("]);", src.indexOf("rows.push([a.hex")));
  assert.equal(topCommas(airRow) + 1, AIR_ROW_LEN);
  const seaRow = src.slice(src.indexOf("ships.map((s) => [s.mmsi"), src.indexOf("]) });", src.indexOf("ships.map((s) => [s.mmsi")));
  assert.equal(topCommas(seaRow) + 1, SEA_ROW_LEN);
  // A scripted edit once turned the callsign test's \d into a plain d, and no continued track ever found its route.
  assert.ok(!src.includes("{3}d/"), "a callsign regex lost its backslash");
});

test("History keeps one point per interval, six hours back, capped", () => {
  const h = new History(60, 3600, 10, 2);
  for (let t = 0; t < 7200; t += 20) h.add("a", 30, 40 + t / 1e4, 1_800_000_000 + t);
  const pts = h.get("a");
  assert.ok(pts.length <= 10);
  assert.ok(pts.every((p, i) => i === 0 || p[2] - pts[i - 1][2] >= 60));
  h.add("b", 1, 1, 1);
  h.add("c", 1, 1, 1);
  assert.equal(h.map.size, 2);
  h.prune(1_800_000_000 + 7000);
  assert.ok(h.map.has("a") && !h.map.has("b"));
});

test("joinTracks sorts by time, drops repeats and thins", () => {
  const j = joinTracks(3, [[1, 1, 100], [2, 2, 200]], [[1.5, 1.5, 150], [2, 2, 200], [3, 3, 300], [4, 4, 400]]);
  assert.equal(j.length, 3);
  assert.deepEqual(j[0], [1, 1, 100]);
  assert.deepEqual(j[2], [4, 4, 400]);
});

test("AIS destinations and ETAs", () => {
  assert.equal(matchPort("AEJEA")?.name, "Jebel Ali");
  assert.equal(matchPort("AE JEA")?.name, "Jebel Ali");
  assert.equal(matchPort("JEBEL ALI")?.name, "Jebel Ali");
  assert.equal(matchPort("OMSOH>AEJEA")?.code, "AEJEA");
  assert.equal(matchPort("BANDAR ABBAS")?.code, "IRBND");
  assert.equal(matchPort("FOR ORDERS"), null);
  assert.equal(nearestPort(25.02, 55.07)?.code, "AEJEA");
  assert.equal(nearestPort(20, 62), null);
  const now = Date.UTC(2026, 9, 20);
  assert.equal(aisEta({ Month: 10, Day: 25, Hour: 6, Minute: 30 }, now), "2026-10-25T06:30:00.000Z");
  assert.equal(aisEta({ Month: 1, Day: 3, Hour: 0, Minute: 0 }, now), "2027-01-03T00:00:00.000Z");
  assert.equal(aisEta({ Month: 0, Day: 0, Hour: 24, Minute: 60 }, now), null);
});

test("pickRoute: a detour is allowed only when the take-off was seen at the origin, and then only as likely", () => {
  // UAE136, 20 Oct: Venice–Dubai, flying south over the Nile delta (round closed airspace).
  const VCE = ap("LIPZ", 45.5, 12.35);
  const pos = { lat: 32.44, lon: 31.01, track: 171 };
  const c = [{ source: "a", origin: VCE, destination: DXB }, { source: "b", origin: VCE, destination: DXB }];
  assert.equal(pickRoute(c, pos, null).confidence, "unknown");
  const p = pickRoute(c, pos, { lat: 45.54, lon: 12.41 });
  assert.equal(p.destination?.icao, "OMDB");
  assert.equal(p.confidence, "likely");
});

test("the air circles cover the whole region box with no hole (0.05° grid, 250 nm circles)", () => {
  const C = lattice(AIR_BOX, 250);
  assert.ok(C.length <= 46, `${C.length} circles`);
  const r = 250 * 1.852 - 1;
  const holes: string[] = [];
  for (let la = AIR_BOX.s; la <= AIR_BOX.n + 1e-9; la += 0.05)
    for (let lo = AIR_BOX.w; lo <= AIR_BOX.e + 1e-9; lo += 0.05)
      if (!C.some(([a, b]) => Math.abs(a - la) < 8.5 && km(a, b, la, lo) <= r)) holes.push(`${la.toFixed(2)},${lo.toFixed(2)}`);
  assert.deepEqual(holes.slice(0, 5), []);
});

test("the region reaches Egypt, Sudan, the Horn, Iran's east and the Caspian; ships also the Arabian Sea", () => {
  for (const [la, lo] of [[30.1, 31.2], [15.6, 32.5], [11.6, 43.1], [29.5, 60.9], [37.5, 50], [33.3, 44.4], [24.7, 46.7], [15.4, 44.2]]) assert.ok(inAirBox(la, lo), `${la},${lo}`);
  for (const [la, lo] of [[12.5, 47], [15, 65], [31.3, 32.3], [34, 27]]) assert.ok(inSeaBox(la, lo), `${la},${lo}`);
});

test("continued tracks: only aircraft last heard airborne, fast and high", () => {
  assert.equal(continues(35000, 450, 120), true);
  assert.equal(continues(4000, 250, 120), false);
  assert.equal(continues(35000, 100, 120), false);
  assert.equal(continues("ground", 0, 0), false);
  assert.equal(continues(35000, 450, undefined), false);
});

test("continued tracks: moved along the great circle to the destination at the last ground speed", () => {
  // Lost over Kuwait at 480 kt, bound for Riyadh (OERK).
  const last = { lat: 29.0, lon: 47.8, t: 1_800_000_000, gs: 480, track: 200, alt: 36000, rate: 0 };
  const RUH = { lat: 24.96, lon: 46.7 };
  const e = project(last, RUH, last.t + 900);
  const moved = km(last.lat, last.lon, e.lat, e.lon);
  assert.ok(Math.abs(moved - 480 * 1.852 * 0.25) < 3, `moved ${moved}`);
  // still on the line to Riyadh, pointing at it
  assert.ok(Math.abs(km(last.lat, last.lon, RUH.lat, RUH.lon) - moved - km(e.lat, e.lon, RUH.lat, RUH.lon)) < 2);
  assert.ok(Math.abs(e.track - bearing(e.lat, e.lon, RUH.lat, RUH.lon)) <= 1);
  assert.equal(e.done, null);
  assert.equal(e.alt, 36000);
});

test("continued tracks: dropped on arrival (40 km out), on landing, after three hours", () => {
  const last = { lat: 29.0, lon: 47.8, t: 1_800_000_000, gs: 480, track: 200, alt: 36000, rate: 0 };
  const RUH = { lat: 24.96, lon: 46.7 };
  const total = km(last.lat, last.lon, RUH.lat, RUH.lon);
  const toArrive = ((total - EST.arriveKm + 1) / (480 * 1.852)) * 3600;
  assert.equal(project(last, RUH, last.t + toArrive).done, "arrived");
  assert.equal(project(last, RUH, last.t + toArrive - 60).done, null);
  // descending at 2,000 ft/min from 12,000 ft: down in five minutes
  assert.equal(project({ ...last, alt: 12000, rate: -2000 }, null, last.t + 330).done, "landed");
  // a long route: three hours at most
  const far = destPoint(last, 120, 9000);
  assert.equal(project({ ...last, gs: 300 }, far, last.t + EST.maxSec + 1).done, "too-long");
});

test("continued tracks: without a route, straight on for ten minutes only", () => {
  const last = { lat: 20, lon: 40, t: 1_800_000_000, gs: 450, track: 90, alt: 37000, rate: 0 };
  const e = project(last, null, last.t + 300);
  assert.equal(e.done, null);
  assert.ok(Math.abs(e.lat - 20) < 0.1 && e.lon > 40.5);
  assert.equal(project(last, null, last.t + EST.noRouteSec + 1).done, "no-route");
});

test("ships: positions kept six hours, name and destination a day, the cap drops position-less ships first", () => {
  const now = 1_800_000_000_000, h = 3600_000;
  const m = new Map<number, { mmsi: number; t: number; sAt?: number }>([
    [1, { mmsi: 1, t: now - 5 * h }],
    [2, { mmsi: 2, t: now - 7 * h, sAt: now - 2 * h }],
    [3, { mmsi: 3, t: now - 7 * h }],
    [4, { mmsi: 4, t: 0, sAt: now - 25 * h }],
    [5, { mmsi: 5, t: 0, sAt: now - h }],
  ]);
  tidyShips(m, now, 10);
  assert.deepEqual([...m.keys()].sort(), [1, 2, 5]);
  assert.equal(m.get(2)?.t, 0); // too old to show, kept for its name
  tidyShips(m, now, 1);
  assert.deepEqual([...m.keys()], [1]);
});
