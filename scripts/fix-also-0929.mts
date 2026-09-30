/**
 * 29 September 2026: the reader linked Almashhad's post of the government
 * armed forces spokesman to the STC official's card. Its "Also" moves to the
 * spokesman's card.
 *
 * LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/fix-also-0929.mts
 */
import { getSql } from "../src/lib/db.ts";

type Also = { source: string; url: string; summary?: string };
const sql = await getSql();
const STC = "live-x-com-south24-net-status-2104945495852331314";
const URL = "https://www.almashhad.news/news/497196";
const [to] = await sql<{ fp: string; also_reported_by: Also[] | null }>`
  select fp, also_reported_by from desk_report
  where summary ilike 'Yemeni armed forces spokesperson%monitored%' and at > now() - interval '6 hours' order by at limit 1`;
const [stc] = await sql<{ also_reported_by: Also[] | null }>`select also_reported_by from desk_report where fp = ${STC}`;
const moved = (stc?.also_reported_by ?? []).find((a) => a.url === URL);
const keep = (stc?.also_reported_by ?? []).filter((a) => a.url !== URL);
await sql`update desk_report set also_reported_by = ${JSON.stringify(keep)}::jsonb where fp = ${STC}`;
if (to && moved && !(to.also_reported_by ?? []).some((a) => a.source === moved.source)) {
  await sql`update desk_report set also_reported_by = ${JSON.stringify([...(to.also_reported_by ?? []), moved])}::jsonb where fp = ${to.fp}`;
}
const [p] = await sql<{ value: { reports: { fp: string; alsoReportedBy?: Also[] }[] } }>`select value from desk_state where key = 'payload'`;
for (const r of p.value.reports) {
  if (r.fp === STC) r.alsoReportedBy = keep;
  if (to && moved && r.fp === to.fp && !(r.alsoReportedBy ?? []).some((a) => a.source === moved.source)) r.alsoReportedBy = [...(r.alsoReportedBy ?? []), moved];
}
await sql`update desk_state set value = ${JSON.stringify(p.value)}::jsonb, updated_at = now() where key = 'payload'`;
console.log("moved:", !!moved, "to:", to?.fp ?? "none");
process.exit(0);
