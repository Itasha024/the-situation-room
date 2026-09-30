/**
 * 30 Sep: stored cards pinned on a namesake or a dateline, placed again from
 * their headline with the fixed gazetteer (Al-Mansurah and Al-Haymah of Lahj,
 * Jabal al-Bazilah). LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/repin-0930.mts [--write]
 */
import { getSql } from "../src/lib/db.ts";
import { PLACE_BY_NAME, placesIn } from "../src/lib/desk/gazetteer.ts";
import { pinPlace } from "../src/lib/desk/editor.ts";

const write = process.argv.includes("--write");
const sql = await getSql();
const rows = await sql<{ fp: string; summary: string; place: string; lat: number; lng: number }[]>`
  select fp, summary, place, lat, lng from desk_report
  where at > now() - interval '21 days' and lat is not null
    and (summary ~* 'Mansurah|Haymah|Baz[ia]?lah|Bazala')`;
let n = 0;
for (const r of rows) {
  // The card's own place, where the gazetteer moved it (Al-Mansurah); else the
  // headline's place, never a tribe ("Al-Subayhah tribes") or a city/governorate.
  const own = PLACE_BY_NAME[r.place];
  const pick = pinPlace(placesIn(r.summary.replace(/Al-Subayhah tribes?/g, "tribes")));
  const fine = (x?: typeof own) => x && x.kind !== "governorate" && !/city$/.test(x.kind);
  const moved = own && (Math.abs(own.lat - r.lat) > 0.005 || Math.abs(own.lng - r.lng) > 0.005) ? own : undefined;
  const p = fine(pick) ? pick : fine(moved) ? moved : undefined;
  if (!p || (Math.abs(p.lat - r.lat) < 0.005 && Math.abs(p.lng - r.lng) < 0.005)) continue;
  n += 1;
  console.log(`${r.place} [${r.lat},${r.lng}] -> ${p.name} [${p.lat},${p.lng}] | ${r.summary}`);
  if (write) {
    await sql`update desk_report set place = ${p.name}, lat = ${p.lat}, lng = ${p.lng} where fp = ${r.fp}`;
    await sql`update desk_event set place = ${p.name}, lat = ${p.lat}, lng = ${p.lng} where fp = ${r.fp}`;
  }
}
console.log(write ? `moved ${n}` : `would move ${n} (dry run)`);
process.exit(0);
