/**
 * The brief built on the 12-hour clock says its next update is at 00:00. Once
 * the 6-hour clock is live, point it at the next 6-hour boundary instead, so
 * the page's stamp is right until that boundary builds a new one. LIVE DB WRITE.
 */
import { BRIEF_KEY } from "../src/lib/desk/brief-store.ts";
import { briefWindow, CADENCE_HOURS } from "../src/lib/desk/brief.ts";
import { getStore } from "../src/lib/desk/store.ts";

const store = await getStore();
const saved = await store.getJson<{ brief: Record<string, unknown> }>(BRIEF_KEY);
if (!saved?.brief) { console.log("no brief"); process.exit(0); }
const w = briefWindow();
console.log("was", saved.brief.nextUpdateAt, saved.brief.cadenceHours, "→", w.nextUpdateAt, CADENCE_HOURS);
saved.brief.nextUpdateAt = w.nextUpdateAt;
saved.brief.cadenceHours = CADENCE_HOURS;
await store.putJson(BRIEF_KEY, saved);
process.exit(0);
