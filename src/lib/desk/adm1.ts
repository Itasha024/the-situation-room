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

/** The ISO code ("YE-SD") of the governorate at a point, or null outside Yemen. */
export function governorateAt(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const g of ORDER) if (g.rings.some((r) => inRing(lng, lat, r))) return g.iso;
  return null;
}
