/**
 * 29 September 2026: old Sheba Intelligence articles, sent again each scan,
 * joined new cards as "Also" (the four Iranian experts of 28 Sep under 29 Sep
 * Taiz strikes; the mobilisation call under a 26 Sep card). Every Sheba "Also"
 * on a card from another outlet comes off; Sheba's own cards stay.
 *
 * LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/fix-sheba-also-0929.mts
 */
import { getSql } from "../src/lib/db.ts";

type Also = { source: string; url: string; summary?: string };
const sheba = (a: Also) => /sheba/i.test(a.source || "") || /shebaintelligence\.uk/.test(a.url || "");
const sql = await getSql();
const rows = await sql<{ fp: string; source: string; also_reported_by: Also[] | null }>`
  select fp, source, also_reported_by from desk_report
  where at > now() - interval '30 days' and source not ilike '%sheba%'
    and also_reported_by::text ilike '%shebaintelligence%'`;
const fixed = new Map<string, Also[]>();
for (const r of rows) {
  const keep = (r.also_reported_by ?? []).filter((a) => !sheba(a));
  fixed.set(r.fp, keep);
  await sql`update desk_report set also_reported_by = ${JSON.stringify(keep)}::jsonb where fp = ${r.fp}`;
}
const [p] = await sql<{ value: { reports: { fp: string; source?: string; alsoReportedBy?: Also[] }[] } }>`select value from desk_state where key = 'payload'`;
let inPayload = 0;
for (const r of p.value.reports) {
  if (/sheba/i.test(r.source || "") || !(r.alsoReportedBy ?? []).some(sheba)) continue;
  r.alsoReportedBy = (r.alsoReportedBy ?? []).filter((a) => !sheba(a));
  inPayload += 1;
}
await sql`update desk_state set value = ${JSON.stringify(p.value)}::jsonb, updated_at = now() where key = 'payload'`;
console.log(`stored cards fixed: ${fixed.size}, payload cards fixed: ${inPayload}`);
process.exit(0);
