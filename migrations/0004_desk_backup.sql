-- Daily snapshots of the desk tables. Supabase Free keeps no backups, so the
-- tick copies everything here once a day and keeps two weeks. It guards
-- against a bad deploy or a bad write, not against losing the project.
create table if not exists desk_backup (
  day date primary key,
  at timestamptz not null default now(),
  data jsonb not null
);
