-- Round 30: more than one desk. Each card and each map pin says which desks
-- show it; every row stored before this is the Yemen desk's. A card about
-- both wars is one row with both desks, so it is fetched and read once.

alter table desk_report
  add column if not exists desks text[] not null default '{yemen}';

alter table desk_event
  add column if not exists desks text[] not null default '{yemen}';

create index if not exists desk_report_desks_idx on desk_report using gin (desks);
create index if not exists desk_event_desks_idx on desk_event using gin (desks);
