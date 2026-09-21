-- A relayed report credits what it cites ("Shajab News, citing NYT") until
-- the desk finds the original, which then replaces it as source and link.

alter table desk_report
  add column if not exists citing text;
