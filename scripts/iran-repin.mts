/**
 * Pins the Iran desk's attack cards published before its map had places
 * (Round 30 stage 6, 9 Oct). The card's own copy stands in for the source
 * text, which is not kept. Houthi attacks are the Yemen desk's map.
 *
 *   node scripts/iran-repin.mjs [--apply]
 */
import { getSql } from "../src/lib/db.ts";
import { iranPins, tallyNotEvent } from "../src/lib/desk/iran-places.ts";

const apply = process.argv.includes("--apply");
const sql = await getSql();
const rows = await sql<{ fp: string; at: Date; type: string; summary: string; body: string; source: string; url: string; flags: string[] | null; desks: string[] }>`
  select fp, at, type, summary, body, source, url, flags, desks from desk_report
   where 'iran' = any(desks) and type in ('strike', 'combat', 'vessel') and lat is null and at >= '2026-10-08'
   order by at`;
let n = 0;
for (const r of rows) {
  if ((r.flags ?? []).includes("actor:houthi") || tallyNotEvent(r.summary)) continue;
  const copy = `${r.summary}. ${r.body ?? ""}`;
  const pins = iranPins(r.summary, copy, r.type === "vessel");
  if (!pins.length) continue;
  n++;
  console.log(`${r.fp} | ${pins.map((p) => p.name).join(", ")} | ${r.summary}`);
  if (!apply) continue;
  const [first, ...more] = pins;
  await sql`update desk_report set place = ${first.name}, lat = ${first.lat}, lng = ${first.lng} where fp = ${r.fp} and lat is null`;
  const all = [{ fp: r.fp, p: first, only: false }, ...more.map((p) => ({ fp: `${r.fp}-pin-${p.name.replace(/\s+/g, "-")}`, p, only: true }))];
  for (const e of all) {
    await sql`
      insert into desk_event (fp, at, type, lat, lng, place, label, body, source, url, map_only, desks)
      values (${e.fp}, ${r.at}, ${r.type}, ${e.p.lat}, ${e.p.lng}, ${e.p.name}, ${r.summary}, ${r.body || null}, ${r.source}, ${r.url}, ${e.only}, ${r.desks}::text[])
      on conflict (fp) do nothing`;
  }
}
console.log(`${rows.length} unpinned attack cards; ${n} pinned${apply ? "" : " (dry run)"}`);
process.exit(0);
