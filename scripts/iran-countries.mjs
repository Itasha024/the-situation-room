// Builds public/iran-countries.geojson: the borders of the countries in the
// Iran war, each with the map side whose colour it is lit in (user, 9 Oct).
// Source: Natural Earth 1:50m via world-atlas (TopoJSON), read from a local copy:
//   node scripts/iran-countries.mjs <countries-50m.json>
import fs from "node:fs";

const SIDE = {
  Iran: "iran",
  Israel: "israel",
  Lebanon: "hezbollah",
  Iraq: "iraqi_militias",
  "Saudi Arabia": "gulf",
  "United Arab Emirates": "gulf",
  Qatar: "gulf",
  Bahrain: "gulf",
  Kuwait: "gulf",
  Oman: "gulf",
};

const topo = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const [sx, sy] = topo.transform.scale;
const [tx, ty] = topo.transform.translate;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [Math.round((x * sx + tx) * 1000) / 1000, Math.round((y * sy + ty) * 1000) / 1000];
  });
});
const ring = (ids) => {
  const out = [];
  for (const i of ids) {
    const a = i < 0 ? [...arcs[~i]].reverse() : arcs[i];
    out.push(...(out.length ? a.slice(1) : a));
  }
  return out;
};
const features = [];
for (const g of topo.objects.countries.geometries) {
  const side = SIDE[g.properties?.name];
  if (!side) continue;
  const coordinates = g.type === "Polygon" ? g.arcs.map(ring) : g.arcs.map((p) => p.map(ring));
  features.push({ type: "Feature", properties: { name: g.properties.name, side }, geometry: { type: g.type, coordinates } });
}
fs.writeFileSync("public/iran-countries.geojson", JSON.stringify({ type: "FeatureCollection", features }));
console.log(features.map((f) => f.properties.name).join(", "), fs.statSync("public/iran-countries.geojson").size, "bytes");
