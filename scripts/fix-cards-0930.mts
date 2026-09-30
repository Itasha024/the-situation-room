/**
 * 30 September 2026, two cards the operator flagged as not this war:
 * - 01:38, Axios (via Bin Saeed): "Trump may order return to major combat
 *   operations after midterm elections" is about the US–Iran war.
 * - 08:37, Almashhad: the Egyptian sailors of the M/T Eureka, hijacked in May by
 *   unidentified gunmen and held off Somalia, is piracy.
 * Removed, and kept out (json:dropped).
 *
 * LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/fix-cards-0930.mts
 */
import { getSql } from "../src/lib/db.ts";

const sql = await getSql();
const REMOVE = ["live-t-me-bin-1saeed-73713", "https://www.almashhad.news/news/497323", "live-x-com-marebpress-status-2105243748368040142"];

for (const key of REMOVE) {
  const rows = await sql`select fp, url, summary from desk_report where fp = ${key} or url = ${key}`;
  for (const { fp, url, summary } of rows) {
    await sql`delete from desk_event where fp = ${fp} or url = ${url}`;
    await sql`delete from desk_report where fp = ${fp}`;
    await sql`
      insert into desk_state (key, value, updated_at) values ('json:dropped', jsonb_build_object(${fp}::text, ${Date.now()}::bigint), now())
      on conflict (key) do update set value = desk_state.value || excluded.value, updated_at = now()`;
    console.log("removed:", fp, "|", summary);
  }
  if (!rows.length) console.log("not found:", key);
}
process.exit(0);
