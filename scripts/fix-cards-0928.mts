/**
 * 28 September 2026, two cards the operator flagged:
 * - 18:25, Yemen TV: "رئيس مجلس القيادة" (Yemen's president) was written as the
 *   Houthi leader. Re-read under the fixed rules and rewritten with the reader's copy.
 * - 19:01, Al-Masirah: the Iranian chief of staff's general threat is not this
 *   war. Removed, and kept out (json:dropped).
 *
 * LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/fix-cards-0928.mts
 */
import { getSql } from "../src/lib/db.ts";
import { READER_MODELS, checkReading, readBatch } from "../src/lib/desk/reader.ts";
import { toReport } from "../src/lib/desk/editor.ts";

const sql = await getSql();
const REWRITE = "live-x-com-yementvyem-status-2104593260044066845";
const REMOVE = "https://t.me/almasirah2/300562";

// 1. The president's words, read again.
const text = "رئيس مجلس القيادة يشيد بكفاءة القوات المسلحة ويوجه بتسريع تنفيذ قراري العودة الآمنة والتعبئة العامة";
const [row] = await sql`select fp, url, at, source from desk_report where fp = ${REWRITE}`;
if (row) {
  const item = { id: "1", source: "Yemen TV", alignment: "Saudi/government-aligned", postedAt: new Date(row.at).toISOString(), text };
  const res = await readBatch([item], process.env.GEMINI_API_KEY || "", new Set(), [], READER_MODELS);
  const r = res.readings.get("1");
  const problem = r ? checkReading(r, text) : "no reading";
  console.log("reading:", res.model, r?.headline, "| check:", problem);
  if (r && !problem) {
    const rep = toReport(r, { source: row.source, url: row.url, text, at: new Date(row.at).toISOString(), lean: "gov", fp: row.fp });
    await sql`update desk_report set summary = ${rep.summary}, type = ${rep.type}, body = ${rep.text ?? null} where fp = ${REWRITE}`;
    console.log("rewritten:", rep.summary);
  }
}

// 2. The Iranian threat, out.
const gone = await sql`select fp from desk_report where url = ${REMOVE}`;
for (const { fp } of gone) {
  await sql`delete from desk_event where url = ${REMOVE}`;
  await sql`delete from desk_report where fp = ${fp}`;
  await sql`
    insert into desk_state (key, value, updated_at) values ('json:dropped', jsonb_build_object(${fp}::text, ${Date.now()}::bigint), now())
    on conflict (key) do update set value = desk_state.value || excluded.value, updated_at = now()`;
  console.log("removed:", fp);
}
process.exit(0);
