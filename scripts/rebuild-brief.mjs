/**
 * Rebuild the current 12-hour brief from the cards now in the store.
 *
 * For a brief built while its window's cards were still missing — after the
 * desk was down, the first tick back builds the brief before the backlog is
 * read, and every front says "nothing was reported". This puts back the
 * previous window (kept in the brief's own history) as the stored brief, so
 * `refreshBrief` builds the current window again with the right comparison.
 *
 * LIVE DATABASE WRITE. Run with the live settings:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/rebuild-brief.mjs
 */

import { BRIEF_KEY, refreshBrief } from "../src/lib/desk/brief-store.ts";
import { getStore } from "../src/lib/desk/store.ts";

const store = await getStore();
const saved = await store.getJson(BRIEF_KEY);
if (!saved?.brief) {
  console.error("no stored brief");
  process.exit(1);
}
const h = saved.history || {};
const previous = {
  brief: {
    ...saved.brief,
    updatedAt: "rebuilt-from-history",
    numbers: h.prevWindow ?? saved.brief.numbers,
    fronts: Object.values(h.prevFronts || {}),
  },
  // bumpStreaks reads these back; the fronts above carry last window's activity.
  history: { streaks: Object.fromEntries(Object.entries(h.streaks || {}).map(([k, v]) => [k, Math.max(0, v - 1)])) },
};
await store.putJson(BRIEF_KEY, previous);
const { brief, built } = await refreshBrief(store);
console.log(`built=${built} window to ${brief.updatedAt}`);
console.log("situation:", brief.situation?.line);
for (const f of brief.fronts.slice(0, 6)) console.log(`- ${f.name}: ${f.line}`);
process.exit(0);
