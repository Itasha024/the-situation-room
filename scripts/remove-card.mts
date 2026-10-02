/**
 * Removes a card and notes why (Round 27 Stage D). The one way cards are
 * removed from now on, so every false report lowers its outlets' rating and a
 * duplicate does not.
 *
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types \
 *     scripts/remove-card.mts <fp or url> <why> "<reason>" [link]
 *
 * why: false | old-picture | false-figure | denied   (counts against the source)
 *      duplicate | out-of-scope | desk-error         (does not)
 *
 * LIVE DATABASE WRITE: the card's row and pins go, its fp joins json:dropped,
 * and a false one is kept, card and all, in json:verdicts.
 */
import { getSql } from "../src/lib/db.ts";
import { REMOVAL_WHY, isRemovalWhy, ratedFromRow, removalVerdict } from "../src/lib/desk/removal.ts";

const [key, why, reason = "", link] = process.argv.slice(2);
if (!key || !why || !isRemovalWhy(why)) {
  console.error(`usage: remove-card.mts <fp|url> <${REMOVAL_WHY.join("|")}> "<reason>" [link]`);
  process.exit(1);
}

const sql = await getSql();
const rows = await sql`select fp, url, at, source, type, summary, lat, lng, also_reported_by from desk_report where fp = ${key} or url = ${key}`;
if (!rows.length) {
  console.log("not found:", key);
  process.exit(1);
}
for (const row of rows) {
  const fp = String(row.fp);
  const verdict = removalVerdict(why, reason, ratedFromRow(row), { link });
  // The verdict first: a removal cut short never loses why.
  if (verdict)
    await sql`
      insert into desk_state (key, value, updated_at) values ('json:verdicts', jsonb_build_object(${fp}::text, ${JSON.stringify(verdict)}::jsonb), now())
      on conflict (key) do update set value = desk_state.value || excluded.value, updated_at = now()`;
  await sql`
    insert into desk_state (key, value, updated_at) values ('json:dropped', jsonb_build_object(${fp}::text, ${Date.now()}::bigint), now())
    on conflict (key) do update set value = desk_state.value || excluded.value, updated_at = now()`;
  await sql`delete from desk_event where fp = ${fp} or url = ${row.url}`;
  await sql`delete from desk_report where fp = ${fp}`;
  console.log("removed:", fp, "|", row.summary, "|", why, verdict ? "→ counts against the source" : "→ not against the source");
}
process.exit(0);
