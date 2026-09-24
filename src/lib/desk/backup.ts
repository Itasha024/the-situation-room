/**
 * Once-a-day snapshot of the desk tables into `desk_backup`, kept 14 days.
 *
 * Built inside Postgres, so a snapshot costs one statement and moves no rows
 * through the function. Restore a day with:
 *
 *   begin;
 *   delete from desk_report; delete from desk_event; delete from desk_state;
 *   insert into desk_state  select * from jsonb_populate_recordset(null::desk_state,  (select data->'state'   from desk_backup where day = 'YYYY-MM-DD'));
 *   insert into desk_report select * from jsonb_populate_recordset(null::desk_report, (select data->'reports' from desk_backup where day = 'YYYY-MM-DD'));
 *   insert into desk_event  select * from jsonb_populate_recordset(null::desk_event,  (select data->'events'  from desk_backup where day = 'YYYY-MM-DD'));
 *   commit;
 */
const KEEP_DAYS = 14;

export async function backupDaily(): Promise<boolean> {
  const { getSql } = await import("../db.ts");
  const sql = await getSql();
  const made = await sql.query(
    `insert into desk_backup (day, data)
     select current_date, jsonb_build_object(
       -- The caches (row:*) are left out: they rebuild themselves.
       'state',   coalesce((select jsonb_agg(t) from desk_state t where t.key not like 'row:%'),  '[]'::jsonb),
       'reports', coalesce((select jsonb_agg(t) from desk_report t), '[]'::jsonb),
       'events',  coalesce((select jsonb_agg(t) from desk_event t),  '[]'::jsonb))
     -- Checked first: the snapshot of every table was built on every tick and
     -- then thrown away by the conflict.
     where not exists (select 1 from desk_backup b where b.day = current_date)
     on conflict (day) do nothing
     returning day`,
  );
  if (made.length) {
    await sql.query(`delete from desk_backup where day < current_date - $1::int`, [KEEP_DAYS]);
  }
  return made.length > 0;
}
