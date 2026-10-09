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
// Judea and Samaria (the West Bank) in Israel's blue (user, 9 Oct), one shape with Israel, no line between
// them; Gaza is not. Natural Earth's "Palestine" holds both: its polygon east of 34.9°E is the West Bank.
// The border the two share (arcs used by both, one each way) is dropped and the rest joined into one ring.
const geoms = topo.objects.countries.geometries;
const byName = (n) => geoms.find((g) => g.properties?.name === n);
const westBank = byName("Palestine").arcs.find((p) => ring(p[0]).reduce((s, [x]) => s + x, 0) / ring(p[0]).length > 34.9)[0];
const israel = byName("Israel");
const both = [...israel.arcs[0], ...westBank];
const shared = new Set(both.filter((i) => both.includes(~i)).map((i) => (i < 0 ? ~i : i)));
const pieces = both.filter((i) => !shared.has(i < 0 ? ~i : i)).map((i) => (i < 0 ? [...arcs[~i]].reverse() : arcs[i]));
const joined = [pieces.shift()];
while (pieces.length) {
  const end = joined.at(-1).at(-1);
  const k = pieces.findIndex((a) => a[0][0] === end[0] && a[0][1] === end[1]);
  if (k < 0) throw new Error("Israel and the West Bank do not join");
  joined.push(pieces.splice(k, 1)[0]);
}
israel.arcs = null;
israel.ring = joined.flatMap((a, i) => (i ? a.slice(1) : a));

const features = [];
for (const g of geoms) {
  const side = SIDE[g.properties?.name];
  if (!side) continue;
  const coordinates = g.ring ? [g.ring] : g.type === "Polygon" ? g.arcs.map(ring) : g.arcs.map((p) => p.map(ring));
  const name = g.ring ? "Israel, Judea and Samaria" : g.properties.name;
  features.push({ type: "Feature", properties: { name, side }, geometry: { type: g.type, coordinates } });
}
fs.writeFileSync("public/iran-countries.geojson", JSON.stringify({ type: "FeatureCollection", features }));
console.log(features.map((f) => f.properties.name).join(", "), fs.statSync("public/iran-countries.geojson").size, "bytes");
