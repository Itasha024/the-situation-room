-- Story grouping, and the two indexes the feed read actually uses.
--
-- `desk_report` had no column for the other outlets carrying the same story, so
-- a card that says "also reported by 3 sources" in development lost that list
-- the moment the desk ran on Postgres. The scanner computes it either way; only
-- the storage was missing.

alter table desk_report
  add column if not exists also_reported_by jsonb;

-- The feed asks for "newest N reports" and "newest N pins" and nothing else.
-- `desk_report_at_idx` already covers the first; this covers the second for
-- the map's own query rather than relying on a sequential scan.
create index if not exists desk_event_map_at_idx on desk_event (map_only, at desc);
