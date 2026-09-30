/**
 * Rebuild the current window's fronts after the fronts changed (30 Sep:
 * governorates plus Saudi Arabia, Bab al-Mandab and the Red Sea coast), then
 * ask for the prose again. LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/refront-now.mts
 */
import { BRIEF_KEY, refront, type StoredBrief } from "../src/lib/desk/brief-store.ts";
import { getStore } from "../src/lib/desk/store.ts";

const store = await getStore();
const saved = await store.getJson<StoredBrief>(BRIEF_KEY);
if (!saved?.brief) {
  console.error("no stored brief");
  process.exit(1);
}
const b = await refront(store, saved, new Date());
console.log("model:", b.situation?.model);
for (const f of b.fronts) console.log(`- ${f.id} (${f.name}): ${f.strikes + f.ground + f.alerts + f.maritime} events, ${(f.map ?? []).length} marks\n  ${f.line}`);
process.exit(0);
