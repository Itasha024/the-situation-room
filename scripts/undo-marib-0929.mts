/**
 * 29 September 2026, 00:00: "Houthi forces seize Al-Juba hospital in Marib for
 * military use" turned Ma'rib district contested (a building, and the
 * governorate's name read as the district). Both rules are fixed in
 * control-live.ts; this takes the change back. LIVE DATABASE WRITE.
 */
import { CONTROL_LIVE_KEY, type ControlLive } from "../src/lib/desk/control-live.ts";
import { getStore } from "../src/lib/desk/store.ts";
const store = await getStore();
const live = await store.getJson<ControlLive>(CONTROL_LIVE_KEY);
if (live) {
  const bad = (c: { district: string; headlines: string[] }) => c.district === "ma-rib" && c.headlines.some((h) => /hospital/i.test(h));
  const had = live.changes.filter(bad);
  live.changes = live.changes.filter((c) => !bad(c));
  if (had.length && /hospital/i.test(live.districts["ma-rib"]?.note ?? "")) delete live.districts["ma-rib"];
  await store.putJson(CONTROL_LIVE_KEY, live);
  console.log("undone:", had.length, "ma-rib now:", live.districts["ma-rib"] ?? "baseline");
}
process.exit(0);
