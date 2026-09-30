/**
 * Catch up the update windows (every CADENCE_HOURS) the desk was down for.
 *
 * District control, each side's figures and the official numbers move only
 * when a brief is built. The windows of a downtime are never built, so
 * a capture reported in them never reaches the map. Once the replay has put
 * those windows' cards in the store, this applies each missed window in order,
 * then rebuilds the current brief (scripts/rebuild-brief.mjs does the same
 * last step) so the prose, fronts and figures are written from the whole gap.
 *
 * LIVE DATABASE WRITE. Run with the live settings:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/catch-up-windows.mjs
 */

import { CADENCE_HOURS } from "../src/lib/desk/brief.ts";
import { BRIEF_KEY, refreshBrief } from "../src/lib/desk/brief-store.ts";
import { CONTROL_LIVE_KEY, updateControlLive } from "../src/lib/desk/control-live.ts";
import { getStore } from "../src/lib/desk/store.ts";
import { refreshClaims, refreshTally } from "../src/lib/desk/tally.ts";

// The windows no brief was built for, one per update, from <from> up to <to>.
const [FROM, TO] = process.argv.slice(2).map((x) => Date.parse(x));
if (!Number.isFinite(FROM) || !Number.isFinite(TO) || TO <= FROM) {
  console.error("usage: catch-up-windows.mjs <from> <to> (ISO times on update boundaries)");
  process.exit(1);
}
const STEP = CADENCE_HOURS * 3600e3;
const MISSED = [];
for (let t = FROM; t < TO; t += STEP) MISSED.push([new Date(t).toISOString(), new Date(Math.min(t + STEP, TO)).toISOString()]);

const store = await getStore();
const { reports } = await store.recentDesk(3000, undefined, { events: false });
const inWindow = (a, b) =>
  reports.filter((r) => {
    const t = Date.parse(String(r.at || ""));
    return Number.isFinite(t) && t >= Date.parse(a) && t < Date.parse(b);
  });

let live = (await store.getJson(CONTROL_LIVE_KEY)) ?? null;
const later = (live?.changes ?? []).filter((c) => Date.parse(c.at) >= Date.parse(MISSED[0][0]));
if (later.length) {
  // Something already moved inside the gap: applying older windows on top could undo it.
  console.error(`control: ${later.length} change(s) already inside the gap; control not replayed`, later.map((c) => c.name));
}
for (const [a, b] of MISSED) {
  const rows = inWindow(a, b);
  console.log(`window ${a} → ${b}: ${rows.length} cards, ${rows.filter((r) => r.type === "combat").length} combat`);
  if (!later.length) {
    const before = live?.changes?.length ?? 0;
    live = updateControlLive(live, rows, new Date());
    await store.putJson(CONTROL_LIVE_KEY, live);
    for (const c of live.changes.slice(0, live.changes.length - before)) console.log(`  control: ${c.name} ${c.from} → ${c.to} (${c.outlets.join(", ")})`);
  }
  try {
    await refreshClaims(store, rows, new Date());
  } catch (err) {
    console.error("  claims failed:", err?.message ?? err);
  }
  try {
    await refreshTally(store, rows, new Date());
  } catch (err) {
    console.error("  tally failed:", err?.message ?? err);
  }
}

// Rebuild the current brief from its history, as rebuild-brief.mjs does.
const saved = await store.getJson(BRIEF_KEY);
if (saved?.brief) {
  const h = saved.history || {};
  await store.putJson(BRIEF_KEY, {
    brief: { ...saved.brief, updatedAt: "rebuilt-from-history", numbers: h.prevWindow ?? saved.brief.numbers, fronts: Object.values(h.prevFronts || {}) },
    history: { streaks: Object.fromEntries(Object.entries(h.streaks || {}).map(([k, v]) => [k, Math.max(0, v - 1)])) },
  });
}
const { brief, built } = await refreshBrief(store);
console.log(`brief built=${built} window to ${brief.updatedAt}`);
console.log("situation:", brief.situation?.line);
const after = (await store.getJson(CONTROL_LIVE_KEY))?.changes ?? [];
console.log("latest control changes:", after.slice(0, 5).map((c) => `${c.at.slice(0, 16)} ${c.name} ${c.from}→${c.to}`));
process.exit(0);
