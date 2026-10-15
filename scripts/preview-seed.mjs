#!/usr/bin/env node
/**
 * Fill .preview/ with a copy of the live desks' public feed, so a local
 * preview of the main desk (option C) shows real reports:
 *   node scripts/preview-seed.mjs
 * then start the "region-preview" server (.claude/launch.json), which sets
 * DESK_DATA_DIR=.preview, no AI keys and no clock.
 *
 * Read-only: it asks the public pages any visitor asks, writes nothing
 * anywhere but .preview/, and never touches the live database.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LIVE = process.env.DESK_LIVE || "https://thesituationroom.live";
const DIR = join(process.cwd(), ".preview");

async function get(path) {
  const res = await fetch(LIVE + path, { headers: { "user-agent": "situation-room-preview-seed" } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const [y, i, yPins, iPins, yBrief, iBrief] = await Promise.all([
  get("/api/desk?limit=1000"),
  get("/api/desk?desk=iran&limit=1000"),
  get("/api/desk?since=2026-07-13"),
  get("/api/desk?desk=iran&since=2026-02-28"),
  get("/api/brief"),
  get("/api/brief?desk=iran"),
]);

const reports = [...y.reports, ...i.reports.map((r) => ({ ...r, desks: r.desks?.length ? r.desks : ["iran"] }))];
const seen = new Set();
const events = [];
for (const [list, desk] of [[yPins.events, "yemen"], [iPins.events, "iran"], [y.events, "yemen"], [i.events, "iran"]]) {
  for (const e of list ?? []) {
    const k = `${e.fp}|${e.lat}|${e.lng}`;
    if (seen.has(k)) continue;
    seen.add(k);
    events.push(desk === "iran" && !e.desks?.length ? { ...e, desks: ["iran"] } : e);
  }
}

await mkdir(DIR, { recursive: true });
await writeFile(join(DIR, "data.json"), JSON.stringify({ updatedAt: y.updatedAt ?? new Date().toISOString(), reports, events }));
// The desks' saved briefs, in the shapes the store keeps them in.
const { ok: _o, tally: _t, claims: _c, ledger: _l, transits: _tr, controlLive: _cl, timelineNow, ...brief } = yBrief;
await writeFile(join(DIR, "desk-brief.json"), JSON.stringify({ brief: { ok: true, ...brief }, history: [] }));
if (timelineNow) await writeFile(join(DIR, "desk-timeline-now.json"), JSON.stringify(timelineNow));
const { timelineNow: iNow, ...ib } = iBrief;
await writeFile(join(DIR, "desk-brief_iran.json"), JSON.stringify(ib));
if (iNow) await writeFile(join(DIR, "desk-iran_timeline-now.json"), JSON.stringify(iNow));

console.log(`preview: ${reports.length} cards, ${events.length} pins, briefs from ${yBrief.updatedAt} and ${iBrief.updatedAt} → .preview/`);
