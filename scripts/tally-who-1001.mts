/**
 * 1 Oct: the official totals (838 killed, 3,643 wounded) linked to
 * yemenonline.info; the WHO-led Health Cluster's own report on ReliefWeb
 * carries them (situation report 5: 4,481 casualties since 6 August, 838 of
 * them deaths). The count also starts on 13 July now. LIVE DATABASE WRITE.
 *   node --env-file=... --experimental-strip-types scripts/tally-who-1001.mts [--dry]
 */
import { TALLY_KEY, type Tally } from "../src/lib/desk/tally.ts";
import { getStore } from "../src/lib/desk/store.ts";

const SITREP = "https://reliefweb.int/report/yemen/conflict-escalation-yemen-situation-report-5-reporting-period-19-26-september-2026-issued-27-september-2026";
const dry = process.argv[2] === "--dry";
const store = await getStore();
const cur = await store.getJson<Tally>(TALLY_KEY);
if (!cur) {
  console.log("no stored tally");
  process.exit(0);
}
const next: Tally = structuredClone(cur);
next.since = "2026-07-13";
for (const k of ["killed.total", "injured.total"] as const) {
  const f = next.from[k];
  if (f && /yemenonline/.test(f.url)) next.from[k] = { ...f, name: "WHO (Health Cluster)", url: SITREP, date: "2026-09-27" };
}
console.log("before", JSON.stringify({ since: cur.since, t: cur.from["killed.total"], i: cur.from["injured.total"] }));
console.log("after", JSON.stringify({ since: next.since, t: next.from["killed.total"], i: next.from["injured.total"] }));
if (!dry) {
  await store.putJson(TALLY_KEY, next);
  console.log("written");
}
process.exit(0);
