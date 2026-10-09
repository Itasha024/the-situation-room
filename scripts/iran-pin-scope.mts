/**
 * Takes off the Iran desk's map the pins its scope leaves out (user, 9 Oct):
 * by who acted and where it landed, fly-overs, round-ups, Iran's own unrest,
 * and any place the region's list does not hold (the Red Sea is the Yemen
 * desk's). The card stays in the feed; only its pin goes.
 *
 *   node scripts/iran-pin-scope.mjs [--apply]
 */
import { getSql } from "../src/lib/db.ts";
import { IRAN_PLACES, iranPinAllowed } from "../src/lib/desk/iran-places.ts";

const apply = process.argv.includes("--apply");
const sql = await getSql();
const rows = await sql<{ fp: string; place: string | null; label: string | null; flags: string[] | null }>`
  select e.fp, e.place, e.label, r.flags
    from desk_event e left join desk_report r on r.fp = regexp_replace(e.fp, '-pin-.*$', '')
   where 'iran' = any(e.desks) and not ('yemen' = any(e.desks))`;
const byName = new Map(IRAN_PLACES.map((p) => [p.name, p]));
let n = 0;
for (const r of rows) {
  const actor = (r.flags ?? []).find((f) => f.startsWith("actor:"))?.slice(6) ?? null;
  const p = byName.get(String(r.place ?? ""));
  if (p && iranPinAllowed(actor, p, String(r.label ?? ""))) continue;
  n++;
  console.log(`off | ${actor ?? "-"} | ${r.place} | ${r.label}`);
  if (!apply) continue;
  await sql`delete from desk_event where fp = ${r.fp}`;
  if (!r.fp.includes("-pin-")) await sql`update desk_report set place = null, lat = null, lng = null where fp = ${r.fp}`;
}
console.log(`${rows.length} Iran pins; ${n} off the map${apply ? "" : " (dry run)"}`);
process.exit(0);
