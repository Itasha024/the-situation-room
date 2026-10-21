/**
 * A ship shown deep inland is a false position (user, 21 Oct: "there's a ship in the middle of
 * Egypt": WESTLANDGRACHT, a Dutch cargo ship, reported at Asyut, 259 km from any coast; GPS is
 * jammed and spoofed across the region). The map's own land outline (public/iran-land.json,
 * Natural Earth 1:10m, 24–66°E, 8–46°N) decides: a position on land more than 8 km from the
 * coast is not shown. Ships in port lie on the simplified coast's land side by a km or two, so they
 * are kept. The outline fills in the Suez Canal with its lakes and the Shatt al-Arab, so ships
 * along those two waterways are kept too (WATERWAYS). Outside the outline's box nothing is dropped.
 *
 * Each answer is kept per 0.01° cell (about a km), so the check costs a few lookups a request.
 */
import LAND from "../../../public/iran-land.json" with { type: "json" };
import { makeSea } from "../../../scripts/iran-research/offshore.mjs";

const SEA = makeSea((LAND as { polys: Parameters<typeof makeSea>[0] }).polys);
const memo = new Map<number, boolean>();
/** Waterways the outline counts as land: their course as [lat, lon] points, and how far from it a ship may be (km). */
const WATERWAYS: { km: number; line: [number, number][] }[] = [
  // The Suez Canal, Port Said to Suez, through Lake Timsah and the Bitter Lakes.
  { km: 7, line: [[31.27, 32.31], [31.0, 32.31], [30.8, 32.315], [30.6, 32.32], [30.55, 32.3], [30.45, 32.35], [30.33, 32.38], [30.2, 32.47], [30.1, 32.56], [29.93, 32.56]] },
  // The Shatt al-Arab, Basra to the sea at Fao.
  { km: 5, line: [[30.56, 47.82], [30.5, 47.85], [30.43, 48.0], [30.42, 48.18], [30.35, 48.27], [30.1, 48.42], [29.96, 48.55]] },
];
function nearWaterway(lat: number, lon: number) {
  const k = Math.cos((lat * Math.PI) / 180);
  return WATERWAYS.some(({ km, line }) => line.some((a, i) => {
    if (!i) return false;
    const b = line[i - 1];
    const ax = (a[1] - lon) * k, ay = a[0] - lat, bx = (b[1] - lon) * k, by = b[0] - lat;
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(ax + t * dx, ay + t * dy) * 111 <= km;
  }));
}
export const INLAND_KM = 8;

export function shipInland(lat: number, lon: number): boolean {
  if (lon < 24 || lon > 66 || lat < 8 || lat > 46) return false;
  const key = Math.round(lat * 100) * 100_000 + Math.round(lon * 100);
  const had = memo.get(key);
  if (had !== undefined) return had;
  const v = SEA.onLand(lat, lon) && SEA.coastKm(lat, lon) > INLAND_KM && !nearWaterway(lat, lon);
  if (memo.size > 200_000) memo.clear();
  memo.set(key, v);
  return v;
}
