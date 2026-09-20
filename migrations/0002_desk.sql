-- The desk's durable state.
--
-- Deployed, the desk runs on ephemeral, read-only serverless instances: module
-- memory resets on every cold start and `public/*.json` cannot be written. That
-- is why the published desk never advanced. These tables are where the scan
-- cadence, the collected reports and the map pins actually live.
--
-- Rows are UNOWNED on purpose — there is no `user_id`. The desk has no accounts
-- (auth is off); it publishes one shared public view of the conflict, written
-- only by the scheduled tick. Nothing personal is ever stored here: every row
-- originates from an already-public news source and carries its link.

-- Small key/value state: scan cadence bookkeeping, and the last scan payload.
create table if not exists desk_state (
  key         text        primary key,
  value       jsonb       not null,
  updated_at  timestamptz not null default now()
);

-- One row per report carried by the desk. `url` is unique so the same story
-- arriving twice from one outlet cannot be stored twice.
create table if not exists desk_report (
  fp          text        primary key,
  url         text        not null unique,
  at          timestamptz not null,
  source      text        not null,
  type        text        not null,
  summary     text        not null,
  body        text        not null,
  priority    integer     not null default 1,
  confidence  real,
  score       integer,
  tier        text,
  place       text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);

-- Newest-first is the only order the feed ever asks for.
create index if not exists desk_report_at_idx on desk_report (at desc);

-- One row per map pin. An alert naming five cities produces five rows, which is
-- why this is not simply a view over desk_report.
create table if not exists desk_event (
  fp          text        primary key,
  at          timestamptz not null,
  type        text        not null,
  lat         double precision not null,
  lng         double precision not null,
  place       text,
  label       text        not null,
  body        text,
  source      text,
  url         text,
  map_only    boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists desk_event_at_idx on desk_event (at desc);
