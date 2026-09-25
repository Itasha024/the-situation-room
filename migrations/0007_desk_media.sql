-- A card's picture or video (from the X or Telegram post it was written from)
-- and its labels ("exclusive"). Both optional; old rows have neither.

alter table desk_report
  add column if not exists media jsonb,
  add column if not exists flags jsonb;
