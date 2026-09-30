/** Print the origin cache entries of the given card fps (read only). */
import { getStore } from "../src/lib/desk/store.ts";

const store = await getStore();
const cache = (await store.getJson<Record<string, Record<string, unknown>>>("origin-cache-v3")) ?? {};
for (const fp of process.argv.slice(2)) {
  const e = cache[fp];
  if (!e) { console.log(fp, "none"); continue; }
  const f = e.found as { url?: string; source?: string; readBy?: string } | undefined;
  console.log(fp, f ? `FOUND ${f.source} ${f.url} read:${f.readBy ?? "-"}` : `waiting lastAt=${new Date(Number(e.lastAt)).toISOString()}`);
}
process.exit(0);
