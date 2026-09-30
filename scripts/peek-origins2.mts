/** Print the raw waiting fields of the given origin cache fps (read only). */
import { getStore } from "../src/lib/desk/store.ts";
const store = await getStore();
const cache = (await store.getJson<Record<string, Record<string, unknown>>>("origin-cache-v3")) ?? {};
const now = Date.now();
const all = Object.entries(cache);
const waiting = all.filter(([, e]) => !("found" in e));
console.log("entries", all.length, "waiting", waiting.length, "waiting<24h", waiting.filter(([, e]) => now - Number(e.firstAt) < 864e5).length);
for (const fp of process.argv.slice(2)) {
  const e = cache[fp];
  if (!e) { console.log(fp, "none"); continue; }
  const { report, keys, arKeys, trKeys, ...rest } = e as Record<string, unknown>;
  console.log(fp, JSON.stringify(rest).slice(0, 400), "keys", JSON.stringify(keys));
}
process.exit(0);
