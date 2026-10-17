// Builds the Iran map's provinces, districts and cities (user, 12 Oct: districts and cities in
// every coloured country), from local copies of free data:
//   geoBoundaries gbOpen ADM1/ADM2, simplified (CC BY 4.0 / ODbL, per country): <ISO>-ADM1.geojson, <ISO>-ADM2.geojson
//   GeoNames cities15000.txt (CC BY 4.0)
//   node scripts/iran-research/adm-pack.cjs <dir>
// Writes public/iran-adm1.geojson, public/iran-adm2.geojson and public/iran-cities.json.
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
if (!dir) throw new Error("usage: adm-pack.cjs <dir with the downloads>");
// The coloured countries (scripts/iran-countries.mjs). Kuwait's and Qatar's ADM2 are city blocks and
// zone numbers, not districts; the UAE and Bahrain have none.
// Every country on the maps, the Yemen war's too (user, 18 Oct: districts and towns as you zoom, on every map):
// Yemen from the desk's own shapes (public/yemen-adm1/adm2, saved under these names), so the names match its map.
const ISO = { IRN: "IR", ISR: "IL", LBN: "LB", IRQ: "IQ", SAU: "SA", ARE: "AE", QAT: "QA", BHR: "BH", KWT: "KW", OMN: "OM", YEM: "YE", SYR: "SY", JOR: "JO", PSE: "PS", EGY: "EG", ERI: "ER", DJI: "DJ", SOM: "SO" };
// Egypt's districts are thousands of city blocks; only its governorates.
const NO_ADM2 = new Set(["KWT", "QAT", "EGY"]);
// Lebanon's governorates carry their French names in the source.
const LB = { "Beyrouth": "Beirut", "Liban-Nord": "North Lebanon", "Mont-Liban": "Mount Lebanon", "Liban-Sud": "South Lebanon", "Nabatîyé": "Nabatieh", "Béqaa": "Bekaa", "Aakkâr": "Akkar" };

const title = (s) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Al|As|Ad|Az|Ar|An|Ash|Adh)\b/g, (m) => m.toLowerCase()).replace(/^(\p{L})/u, (m) => m.toUpperCase());
function cleanName(raw, iso) {
  let n = String(raw || "").trim();
  if (iso === "LBN") n = LB[n] || n;
  n = n.replace(/^WILAYAT\s+/i, "");
  if (n === n.toUpperCase()) n = title(n);
  n = n.replace(/\s+(County|Governorate|Region|Province|District)$/i, "").replace(/_/g, " ").trim();
  return n;
}

const round = (v) => Math.round(v * 1000) / 1000;
/** Douglas-Peucker on one ring, then rounded to ~100 m; a ring that shrinks below a triangle is dropped. */
function simplify(ring, tol) {
  if (ring.length < 5) return null;
  const keep = new Uint8Array(ring.length);
  // A closed ring starts and ends on one point: split it at the point farthest from there.
  let m = 1;
  for (let i = 1; i < ring.length - 1; i++) if (Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]) > Math.hypot(ring[m][0] - ring[0][0], ring[m][1] - ring[0][1])) m = i;
  keep[0] = keep[m] = keep[ring.length - 1] = 1;
  const stack = [[0, m], [m, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = ring[a];
    const [bx, by] = ring[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    let far = -1, fd = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * ring[i][0] - dx * ring[i][1] + bx * ay - by * ax) / len;
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    if (!keep[i]) continue;
    const p = [round(ring[i][0]), round(ring[i][1])];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out.length >= 4 ? out : null;
}
function pack(level, tol) {
  const features = [];
  for (const iso of Object.keys(ISO)) {
    if (level === "ADM2" && NO_ADM2.has(iso)) continue;
    const file = path.join(dir, `${iso}-${level}.geojson`);
    if (!fs.existsSync(file)) continue;
    const g = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const f of g.features) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      // Outer rings only: the lines between areas are what is drawn, not holes.
      const rings = polys.map((p) => simplify(p[0], tol)).filter(Boolean);
      if (!rings.length) continue;
      features.push({ type: "Feature", properties: { n: cleanName(f.properties.shapeName, iso), c: iso }, geometry: { type: "MultiPolygon", coordinates: rings.map((r) => [r]) } });
    }
  }
  return { type: "FeatureCollection", features };
}

const adm1 = pack("ADM1", 0.01);
const adm2 = pack("ADM2", 0.006);
fs.writeFileSync("public/iran-adm1.geojson", JSON.stringify(adm1));
fs.writeFileSync("public/iran-adm2.geojson", JSON.stringify(adm2));

// Cities: tier 1 a capital or a million people, 2 from 250,000, 3 from 60,000, 4 the rest of the 15,000+.
const cc = new Set(Object.values(ISO));
const cities = [];
for (const line of fs.readFileSync(path.join(dir, "cities15000.txt"), "utf8").split("\n")) {
  const c = line.split("\t");
  // A part of a city (PPLX: a quarter) is not a town of its own.
  if (c.length < 15 || !cc.has(c[8]) || c[7] === "PPLX") continue;
  const pop = +c[14] || 0;
  const tier = c[7] === "PPLC" || pop >= 1e6 ? 1 : pop >= 250000 ? 2 : pop >= 60000 ? 3 : 4;
  cities.push([c[2] || c[1], round(+c[4]), round(+c[5]), tier, pop, c[8], c[7] === "PPLC"]);
}
// A country with no capital in the list (Israel's is not marked one) has its biggest town named from the start.
const top = new Map();
for (const c of cities) if (!top.has(c[5]) || top.get(c[5])[4] < c[4]) top.set(c[5], c);
for (const c of top.values()) if (!cities.some((x) => x[5] === c[5] && x[6])) c[3] = 1;
// Capitals first, so a capital is never taken for a bigger neighbour's suburb (Manama by Muharraq).
cities.sort((a, b) => b[6] - a[6] || a[3] - b[3] || b[4] - a[4]);
// A town within 8 km of a bigger one is its suburb (New Mosul by Mosul): only the bigger is named.
const near = (a, b) => Math.hypot((a[1] - b[1]) * 111, (a[2] - b[2]) * 111 * Math.cos(a[1] * Math.PI / 180)) < 8;
for (let i = cities.length - 1; i > 0; i--) if (cities.slice(0, i).some((b) => near(cities[i], b))) cities.splice(i, 1);
fs.writeFileSync("public/iran-cities.json", JSON.stringify({ cities: cities.map((c) => [...c.slice(0, 4), c[5]]) }));
const kb = (f) => Math.round(fs.statSync(f).size / 1024) + " KB";
console.log(`provinces ${adm1.features.length} (${kb("public/iran-adm1.geojson")}), districts ${adm2.features.length} (${kb("public/iran-adm2.geojson")}), cities ${cities.length} (${kb("public/iran-cities.json")})`);

// Land, for the map's Land / Sea filter (user, 12 Oct): Natural Earth 1:10m land (world-atlas, public
// domain), <dir>/land-10m.json, cut to the war's part of the world. Each polygon is its outer ring and
// its holes (the Caspian is a hole in Eurasia); a point in an outer ring and in none of its holes is on land.
const BOX = [24, 8, 66, 46]; // west, south, east, north
function clip(ring) {
  // Sutherland-Hodgman against the box's four edges.
  const edges = [[(p) => p[0] >= BOX[0], (a, b) => [BOX[0], a[1] + (b[1] - a[1]) * (BOX[0] - a[0]) / (b[0] - a[0])]],
    [(p) => p[0] <= BOX[2], (a, b) => [BOX[2], a[1] + (b[1] - a[1]) * (BOX[2] - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= BOX[1], (a, b) => [a[0] + (b[0] - a[0]) * (BOX[1] - a[1]) / (b[1] - a[1]), BOX[1]]],
    [(p) => p[1] <= BOX[3], (a, b) => [a[0] + (b[0] - a[0]) * (BOX[3] - a[1]) / (b[1] - a[1]), BOX[3]]]];
  let out = ring;
  for (const [inside, cut] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length], b = src[i];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) return null;
  }
  out.push(out[0]);
  return out;
}
{
  const topo = JSON.parse(fs.readFileSync(path.join(dir, "land-10m.json"), "utf8"));
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
  const ringOf = (ids) => { const r = []; for (const id of ids) { const a = id < 0 ? arcs[~id].slice().reverse() : arcs[id]; r.push(...(r.length ? a.slice(1) : a)); } return r; };
  const polys = [];
  for (const g of topo.objects.land.geometries) {
    for (const p of g.type === "Polygon" ? [g.arcs] : g.arcs) {
      const rings = p.map(ringOf).map(clip).filter((r) => r && r.length >= 4).map((r) => simplify(r, 0.003)).filter(Boolean);
      if (!rings.length) continue;
      const xs = rings[0].map((q) => q[0]), ys = rings[0].map((q) => q[1]);
      polys.push({ b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(round), r: rings });
    }
  }
  fs.writeFileSync("public/iran-land.json", JSON.stringify({ polys }));
  console.log(`land polygons ${polys.length} (${kb("public/iran-land.json")})`);
}
