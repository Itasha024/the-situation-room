/**
 * Move the pins of stored cards whose place had wrong coordinates in the
 * gazetteer (checked against OpenStreetMap, 29 Sep). LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/repin-0929.mts [--write]
 * Without --write it only lists what would move.
 */
import { getSql } from "../src/lib/db.ts";

/** name: [old lat, old lng, new lat, new lng] */
const MOVES: Record<string, [number, number, number, number]> = {
  "Kahbub": [12.85, 43.55, 12.94, 43.645],
  "Al-Mudaribah": [13.15, 43.9, 12.86, 43.98],
  "Al-Wazi'iyah": [13.35, 43.55, 13.174, 43.73],
  "Al-Aghbara": [13.4, 43.48, 13.05, 43.78],
  "Hays": [13.98, 43.33, 13.932, 43.483],
  "Sharirah": [13.38, 43.52, 13.153, 43.864],
  "Al-Bukrah": [13.3, 43.47, 13.17, 43.798],
  "Al-Alqamah": [13.36, 43.5, 13.118, 43.922],
  "Khalid camp": [13.35, 43.28, 13.364, 43.585],
  "Al-Barh": [13.48, 43.72, 13.731, 43.714],
  "Al-Ruwayk": [15.55, 45.85, 15.862, 46.174],
};

const write = process.argv.includes("--write");
const sql = await getSql();
let total = 0;
for (const table of ["desk_report", "desk_event"] as const) {
  for (const [name, [oLat, oLng, nLat, nLng]] of Object.entries(MOVES)) {
    const pick = (t: typeof table) =>
      t === "desk_report"
        ? sql<{ fp: string }>`select fp from desk_report where (place = ${name} or place like ${name + ",%"}) and abs(lat - ${oLat}) < 0.005 and abs(lng - ${oLng}) < 0.005`
        : sql<{ fp: string }>`select fp from desk_event where (place = ${name} or place like ${name + ",%"}) and abs(lat - ${oLat}) < 0.005 and abs(lng - ${oLng}) < 0.005`;
    const rows = await pick(table);
    if (!rows.length) continue;
    console.log(`${table} ${name}: ${rows.length} pin(s) -> ${nLat},${nLng}`);
    total += rows.length;
    if (write) {
      const fps = rows.map((r) => r.fp);
      if (table === "desk_report") await sql`update desk_report set lat = ${nLat}, lng = ${nLng} where fp = any(${fps}::text[])`;
      else await sql`update desk_event set lat = ${nLat}, lng = ${nLng} where fp = any(${fps}::text[])`;
    }
  }
}
console.log(write ? `moved ${total}` : `would move ${total} (dry run)`);
process.exit(0);
