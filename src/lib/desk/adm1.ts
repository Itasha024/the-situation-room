/**
 * Which governorate of Yemen a point lies in, from the same outlines the map
 * draws (public/yemen-adm1.geojson, compacted into adm1-data.ts).
 */

import { ADM1 } from "./adm1-data.ts";

function inRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function area(ring: [number, number][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

// Smallest first: Sanaa city sits inside Sanaa governorate's outer ring.
const ORDER = [...ADM1].sort(
  (a, b) => Math.min(...a.rings.map(area)) - Math.min(...b.rings.map(area)),
);

/**
 * Each ring with its bounding box, so a point outside the box skips the ring (20 Oct: the map's pins
 * asked this tens of thousands of times per answer, and walking every outline was most of the site's
 * processor time on the small server). The answer is the same.
 */
type Boxed = { ring: [number, number][]; x0: number; x1: number; y0: number; y1: number };
const BOXED: { iso: string; rings: Boxed[] }[] = ORDER.map((g) => ({
  iso: g.iso,
  rings: g.rings.map((ring) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of ring) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { ring, x0, x1, y0, y1 };
  }),
}));
const YEMEN = BOXED.reduce(
  (b, g) => g.rings.reduce((c, r) => ({ x0: Math.min(c.x0, r.x0), x1: Math.max(c.x1, r.x1), y0: Math.min(c.y0, r.y0), y1: Math.max(c.y1, r.y1) }), b),
  { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity },
);

// The same point is asked again and again (once per pair of pins): its answer is kept.
const known = new Map<string, string | null>();

/** The ISO code ("YE-SD") of the governorate at a point, or null outside Yemen. */
export function governorateAt(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lng < YEMEN.x0 || lng > YEMEN.x1 || lat < YEMEN.y0 || lat > YEMEN.y1) return null;
  const key = `${lat},${lng}`;
  const was = known.get(key);
  if (was !== undefined) return was;
  let iso: string | null = null;
  for (const g of BOXED) {
    if (g.rings.some((r) => lng >= r.x0 && lng <= r.x1 && lat >= r.y0 && lat <= r.y1 && inRing(lng, lat, r.ring))) {
      iso = g.iso;
      break;
    }
  }
  if (known.size > 20_000) known.clear();
  known.set(key, iso);
  return iso;
}
