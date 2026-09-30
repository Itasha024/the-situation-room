/**
 * 30 Sep: two stored site hits were not attacks. Fars's "Yanbu" was satellite
 * pictures of damage from 25 to 27 Sep (the 24 Sep strike), and Shajab's
 * "Abqaiq" was smoke seen from space with no attack reported. This drops them.
 * LIVE DATABASE WRITE.
 *   node --env-file=... --experimental-strip-types scripts/ledger-drop-0930.mts [--dry]
 */
import { LEDGER_KEY, type Ledger } from "../src/lib/desk/ledger.ts";
import { getStore } from "../src/lib/desk/store.ts";

const DROP = new Set(["https://t.me/farsna/465511", "https://t.me/shajab_news/68014"]);
const dry = process.argv[2] === "--dry";
const store = await getStore();
const cur = await store.getJson<Ledger>(LEDGER_KEY);
if (!cur) {
  console.log("no stored ledger");
  process.exit(0);
}
const next: Ledger = {
  ...cur,
  sites: cur.sites.map((s) => ({ ...s, hits: s.hits.filter((h) => !DROP.has(h.url)) })).filter((s) => s.hits.length || s.statusSrc),
};
console.log("before", cur.sites.map((s) => `${s.id}: ${s.hits.map((h) => `${h.date} ${h.name}`).join(", ")}`));
console.log("after", next.sites.map((s) => `${s.id}: ${s.hits.map((h) => `${h.date} ${h.name}`).join(", ")}`));
if (!dry) {
  await store.putJson(LEDGER_KEY, next);
  console.log("written");
}
process.exit(0);
