-- A later development of an earlier report is shown as a reply to it, not
-- folded into it. This holds the fp of the report it follows up.

alter table desk_report
  add column if not exists reply_to text;
