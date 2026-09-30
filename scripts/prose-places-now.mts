/**
 * Find the places of the stored brief's prose now, rather than at the next
 * 12-hour boundary. LIVE DATABASE WRITE:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/prose-places-now.mts
 */
import { BRIEF_KEY, type StoredBrief } from "../src/lib/desk/brief-store.ts";
import { placeProse } from "../src/lib/desk/prose-places.ts";
import { getStore } from "../src/lib/desk/store.ts";
import type { LiveReport } from "../src/lib/desk/types.ts";

const store = await getStore();
const saved = await store.getJson<StoredBrief>(BRIEF_KEY);
if (!saved) throw new Error("no brief");
const { reports } = await store.recentDesk(3000, undefined, { events: false });
const b = saved.brief;
b.places = await placeProse(store, [b.situation?.line || "", ...b.fronts.map((f) => f.line || "")], reports as unknown as LiveReport[]);
console.log(b.places);
await store.putJson(BRIEF_KEY, saved);
process.exit(0);
