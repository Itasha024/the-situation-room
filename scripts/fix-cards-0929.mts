/**
 * 29 September 2026, the STC official's interview (the operator asked for this card only):
 * - South24 17:44: nine points to Linkiesta went out as one line. The body now
 *   carries them all, in wire style (not "he said … he said …").
 * - South24 English 17:49 retold the same interview as a second card: removed,
 *   kept out (json:dropped), and credited under "Also".
 * The body is written into the cached readings and the payload too (with a new
 * updated_at, or the server's memory copy wins), so scans keep it.
 *
 * LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/fix-cards-0929.mts
 */
import { getSql } from "../src/lib/db.ts";

const sql = await getSql();
const FP = "live-x-com-south24-net-status-2104945495852331314";
const DUP = "live-x-com-south24e-status-2104946654428443119";
const DUP_URL = "https://x.com/South24E/status/2104946654428443119";
const BODY = [
  "In an interview with Italy's Linkiesta, al-Bidh warned that Houthi control of Bab al-Mandab would let the group close the strait at will, without firing a missile or a drone.",
  "He accused Saudi Arabia of weakening the anti-Houthi front and urged Washington not to leave Riyadh to manage the Yemen crisis alone.",
  "Forces under Saudi control cannot deliver a military solution, and neither can the Yemeni government for now, al-Bidh argued, while the STC has proved highly effective against the Houthis; the UAE, unlike Saudi Arabia, was effective on the ground against armed groups including the Houthis.",
  "The south is hard ground for the Houthis, who were defeated when they reached it, and is key to containing them and keeping them from strategic areas, so it should be treated as part of the solution rather than the problem.",
  "The STC does not claim to speak for all southerners, he added, but for the project of an independent southern state.",
].join(" ");

const [dup] = await sql`select summary from desk_report where fp = ${DUP}`;
const also = [{ source: "South24 English", url: DUP_URL, ...(dup ? { summary: dup.summary } : {}) }];
await sql`update desk_report set body = ${BODY}, also_reported_by = ${JSON.stringify(also)}::jsonb where fp = ${FP}`;
await sql`delete from desk_event where url = ${DUP_URL}`;
await sql`delete from desk_report where fp = ${DUP}`;
await sql`
  insert into desk_state (key, value, updated_at) values ('json:dropped', jsonb_build_object(${DUP}::text, ${Date.now()}::bigint), now())
  on conflict (key) do update set value = desk_state.value || excluded.value, updated_at = now()`;

for (const key of ["row:read:76db2636198835f4ec0efca2", "row:read:e5f3971fda60f99f15ed5394"]) {
  const [row] = await sql<{ value: { reading: { body: string } } }>`select value from desk_state where key = ${key}`;
  if (!row) continue;
  row.value.reading.body = BODY;
  await sql`update desk_state set value = ${JSON.stringify(row.value)}::jsonb, updated_at = now() where key = ${key}`;
}
const [p] = await sql<{ value: { reports: { fp: string; text?: string; alsoReportedBy?: unknown }[] } }>`select value from desk_state where key = 'payload'`;
const card = p.value.reports.find((r) => r.fp === FP);
if (card) {
  card.text = BODY;
  card.alsoReportedBy = also;
}
p.value.reports = p.value.reports.filter((r) => r.fp !== DUP);
await sql`update desk_state set value = ${JSON.stringify(p.value)}::jsonb, updated_at = now() where key = 'payload'`;
console.log("rewritten, duplicate removed:", !!dup, "payload card:", !!card);
process.exit(0);
