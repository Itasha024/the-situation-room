// The country a point lies in, from the map's own borders (public/iran-countries.geojson: the countries in this
// war). A report snaps onto a pin only in its own country: Jordan's in general is not a pin at Ein Gedi.
const fs = require('fs');
const path = require('path');
const G = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/iran-countries.geojson'), 'utf8'));
const inRing = (r, x, y) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const NAME = { 'Israel, Judea and Samaria': 'Israel' };
const memo = new Map();
module.exports = (lat, lng) => {
  const k = lat + ',' + lng;
  if (memo.has(k)) return memo.get(k);
  const f = G.features.find((f) => polys(f.geometry).some(([outer, ...holes]) => inRing(outer, lng, lat) && !holes.some((h) => inRing(h, lng, lat))));
  const n = f ? NAME[f.properties.name] || f.properties.name : null;
  memo.set(k, n);
  return n;
};
