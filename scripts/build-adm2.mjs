// Builds public/yemen-adm2.geojson, Yemen's 333 districts, from geoBoundaries
// (gbOpen YEM ADM2, simplified; CC BY 4.0, scripts/data/). Each district gets a
// stable id and the governorate (ISO) its centre lies in, from the same
// governorate outlines the map draws, so control can be set district by
// district and a governorate's default still applies to the rest.
import { readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync("scripts/data/geoBoundaries-YEM-ADM2_simplified.geojson", "utf8"));
const adm1 = JSON.parse(readFileSync("public/yemen-adm1.geojson", "utf8"));
const r3 = (v) => Math.round(v * 1000) / 1000;
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polysOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}
/** A point inside the district: the centre of its largest ring if inside, else a vertex-average probe. */
function inner(g) {
  const ring = polysOf(g).map((p) => p[0]).sort((a, b) => ringArea(b) - ringArea(a))[0];
  let x = 0, y = 0;
  for (const [a, b] of ring) { x += a; y += b; }
  x /= ring.length; y /= ring.length;
  if (inRing(x, y, ring)) return [x, y];
  for (let i = 0; i < ring.length; i += Math.max(1, Math.floor(ring.length / 40))) {
    const [a, b] = ring[i], [c, d] = ring[(i + Math.floor(ring.length / 2)) % ring.length];
    const m = [(a + c) / 2, (b + d) / 2];
    if (inRing(m[0], m[1], ring)) return m;
  }
  return ring[0];
}
const govAt = (x, y) => adm1.features.find((f) => polysOf(f.geometry).some((p) => inRing(x, y, p[0])))?.properties.shapeISO ?? null;

const seen = new Map();
const features = src.features.map((f) => {
  const [x, y] = inner(f.geometry);
  const gov = govAt(x, y);
  let id = slug(f.properties.shapeName);
  if (seen.has(id)) id = `${id}-${gov?.slice(3).toLowerCase() ?? seen.get(id)}`;
  seen.set(id, 1);
  const coords = polysOf(f.geometry).map((p) => p.map((ring) => ring.map(([a, b]) => [r3(a), r3(b)])));
  const km2 = polysOf(f.geometry).reduce((s, p) => s + ringArea(p[0]), 0) * 111.32 * 110.57 * Math.cos((y * Math.PI) / 180);
  return {
    type: "Feature",
    properties: { id, name: f.properties.shapeName, gov, km2: Math.round(km2), c: [r3(y), r3(x)] },
    geometry: coords.length === 1 ? { type: "Polygon", coordinates: coords[0] } : { type: "MultiPolygon", coordinates: coords },
  };
});
writeFileSync("public/yemen-adm2.geojson", JSON.stringify({ type: "FeatureCollection", attribution: "geoBoundaries (gbOpen, CC BY 4.0)", features }));
const byGov = {};
for (const f of features) (byGov[f.properties.gov] ??= []).push(f.properties.id);
console.log(features.length, "districts;", Object.entries(byGov).map(([g, l]) => `${g}:${l.length}`).join(" "));
