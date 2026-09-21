/**
 * Re-read every report the keyword composer published, through the reader.
 *
 *   node --experimental-strip-types scripts/reread-feed.mts          (dry run)
 *   node --experimental-strip-types scripts/reread-feed.mts --apply  (writes)
 *
 * WHY: before the reading layer, the desk published programme clips as live
 * clashes, other countries' wars as this one, shelling as air strikes. Fixing
 * the pipeline stops new ones; this cleans what is already in the feed.
 *
 * For each live row it re-fetches the source text (a Telegram post's public
 * embed page, an article's page), runs the same reader and the same checks as
 * the live pipeline, and then:
 *   publish   → the row is rewritten in the reader's version, pins re-derived
 *   reject    → the row and its pins are removed
 *   no source → removed: a report that cannot be checked is not kept
 *
 * Local (fs) store only: it edits public/data.json, which git can restore.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Candidate, toReport } from "../src/lib/desk/editor.ts";
import { READER_BATCH, checkReading, readBatch, type ReaderItem } from "../src/lib/desk/reader.ts";
import { outletSide } from "../src/lib/desk/credibility.ts";
import { deriveEvents, toDeskReportRow } from "../src/lib/desk/snapshot.ts";
import { decodeEntities, extractLead, sourceLean } from "../src/lib/yemen-scan.server.ts";

const ROOT = join(import.meta.dirname, "..");
const DATA = join(ROOT, "public", "data.json");
const APPLY = process.argv.includes("--apply");
process.loadEnvFile(join(ROOT, ".env"));
const KEY = process.env.GEMINI_API_KEY || "";
if (!KEY) throw new Error("GEMINI_API_KEY not set");

type Row = Record<string, any>;
const data = JSON.parse(readFileSync(DATA, "utf8")) as { reports: Row[]; events: Row[] };
// Rows the reader already wrote carry `side`; only the old composer's rows are re-read.
const rows = data.reports.filter((r) => r.live && r.url && !r.side);

async function get(url: string): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)" } });
    return res.ok ? await res.text() : "";
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

/** The text the report was written from, as its source still shows it. */
async function sourceText(url: string): Promise<string> {
  const tg = /^https:\/\/t\.me\/(?:s\/)?([^/]+)\/(\d+)/.exec(url);
  if (tg) {
    const html = await get(`https://t.me/${tg[1]}/${tg[2]}?embed=1&mode=tme`);
    const m = html.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    return m ? decodeEntities(m[1]) : "";
  }
  if (/(^|\.)x\.com\//.test(new URL(url).host + "/")) return "";
  const html = await get(url);
  if (!html) return "";
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  return `${title}\n${extractLead(html)}`.trim();
}

// 1. Fetch source texts, a few at a time.
const texts = new Map<string, string>();
for (let i = 0; i < rows.length; i += 8) {
  await Promise.all(rows.slice(i, i + 8).map(async (r) => texts.set(r.url, await sourceText(r.url))));
}

// 2. Read them.
const readable = rows.filter((r) => (texts.get(r.url) || "").length >= 20);
const cands: Candidate[] = readable.map((r) => ({
  source: String(r.source || ""),
  url: r.url,
  text: texts.get(r.url) as string,
  at: String(r.at),
  lean: sourceLean(String(r.source || "")),
  fp: String(r.fp),
  score: Number(r.score) || 50,
  tags: [],
}));
type Out = { row: Row; verdict: "rewrite" | "remove"; why: string; next?: ReturnType<typeof toReport> };
const out: Out[] = [];
for (const r of rows) {
  if (!readable.includes(r)) out.push({ row: r, verdict: "remove", why: "source text unavailable" });
}
for (let i = 0; i < cands.length; i += READER_BATCH) {
  const batch = cands.slice(i, i + READER_BATCH);
  const items: ReaderItem[] = batch.map((c, n) => ({
    id: String(n),
    source: c.source,
    alignment: { houthi: "Houthi-aligned", gov: "Saudi/government-aligned", neutral: "no declared alignment", agency: "international news agency" }[outletSide(c.source, c.lean)],
    postedAt: c.at,
    text: c.text,
  }));
  const { readings, error } = await readBatch(items, KEY);
  batch.forEach((c, n) => {
    const row = rows.find((r) => r.url === c.url) as Row;
    const reading = readings.get(String(n));
    if (!reading) {
      // Not read (rate limit, outage): left untouched for a later run.
      process.stderr.write(`not read: ${error || "missing"}\n`);
      return;
    }
    const problem = checkReading(reading, c.text);
    if (problem) out.push({ row, verdict: "remove", why: problem });
    else out.push({ row, verdict: "rewrite", why: "", next: toReport(reading, c) });
  });
  process.stderr.write(`read ${Math.min(i + READER_BATCH, cands.length)}/${cands.length}\n`);
  // Stay under the free tier's per-minute limit.
  await new Promise((r) => setTimeout(r, 6000));
}

// 3. Report.
const removed = out.filter((o) => o.verdict === "remove");
const rewritten = out.filter((o) => o.verdict === "rewrite");
console.log(`live rows ${rows.length}: rewrite ${rewritten.length}, remove ${removed.length}\n`);
console.log("=== REMOVED ===");
for (const o of removed) console.log(`- ${o.row.source}: ${o.row.summary}\n    why: ${o.why}`);
console.log("\n=== REWRITTEN (old → new) ===");
for (const o of rewritten) console.log(`- ${o.row.summary}\n  → ${o.next!.summary}`);

// 4. Apply.
if (APPLY) {
  const drop = new Set(removed.map((o) => o.row.fp));
  const redo = new Map(rewritten.map((o) => [o.row.fp, o.next!]));
  const touched = new Set([...drop, ...redo.keys()]);
  const touchedUrls = new Set(out.map((o) => o.row.url));
  data.reports = data.reports
    .filter((r) => !drop.has(r.fp))
    .map((r) => {
      const next = redo.get(r.fp);
      return next ? toDeskReportRow(next) : r;
    });
  // Pins of every touched row are re-derived from the reader's version only.
  data.events = data.events.filter(
    (e) => !touchedUrls.has(e.url) && ![...touched].some((fp) => String(e.fp).startsWith(fp)),
  );
  for (const next of redo.values()) data.events.push(...deriveEvents(next).events);
  writeFileSync(DATA, JSON.stringify(data, null, 1) + "\n");
  console.log(`\napplied: ${data.reports.length} reports, ${data.events.length} events`);
}
