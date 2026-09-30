/**
 * Write the current brief's prose again (its paragraphs, places and maps), as
 * the clock does when a fallback model wrote it; control, numbers and the
 * timeline stay. LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/reprose-now.mts
 */
import { BRIEF_KEY, reprose, type StoredBrief } from "../src/lib/desk/brief-store.ts";
import { getStore } from "../src/lib/desk/store.ts";

const store = await getStore();
const saved = await store.getJson<StoredBrief>(BRIEF_KEY);
if (!saved?.brief) {
  console.error("no stored brief");
  process.exit(1);
}
// `--strong`: keep it only when a strong model wrote it.
const b = await reprose(store, saved, new Date(), !process.argv.includes("--strong"));
console.log("model:", b.situation?.model);
console.log("situation:", b.situation?.line);
console.log("more:", b.situation?.more);
console.log("devMap:", JSON.stringify(b.devMap));
for (const f of b.fronts) console.log(`- ${f.id}: ${f.line}\n  map: ${JSON.stringify(f.map ?? [])}`);
process.exit(0);
