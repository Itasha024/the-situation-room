/**
 * 30 Sep: the ledger's research moved to its original sources (UKMTO, the
 * Saudi ministries, JODI, the wires) and to the war's real start (13 July).
 * The stored ledger still holds the first research's rows, which a stored row
 * would keep over the new baseline. This drops them, keeping only what the
 * 6-hour reads added. LIVE DATABASE WRITE.
 *   node --env-file=... --experimental-strip-types scripts/ledger-rebase.mts <old-baseline.ts> [--dry]
 */
import { pathToFileURL } from "node:url";
import { LEDGER_KEY, type Ledger } from "../src/lib/desk/ledger.ts";
import { getStore } from "../src/lib/desk/store.ts";

const [oldPath, dry] = process.argv.slice(2);
const OLD = (await import(pathToFileURL(oldPath).href)).LEDGER_BASELINE as Ledger;
const store = await getStore();
const cur = await store.getJson<Ledger>(LEDGER_KEY);
if (!cur) {
  console.log("no stored ledger");
  process.exit(0);
}
const oldUrls = new Set([...OLD.ships.map((s) => s.src.url), ...OLD.sites.flatMap((s) => s.hits.map((h) => h.url)), ...OLD.figures.map((f) => f.src.url), ...OLD.notices.map((n) => n.src.url)]);
const oldIds = new Set([...OLD.ships.map((s) => s.id), ...OLD.figures.map((f) => f.id), ...OLD.notices.map((n) => n.id)]);
const next: Ledger = {
  since: "2026-07-13",
  ships: cur.ships.filter((s) => !oldIds.has(s.id) && !oldUrls.has(s.src.url)),
  sites: cur.sites.map((s) => ({ ...s, hits: s.hits.filter((h) => !oldUrls.has(h.url)) })).filter((s) => s.hits.length || (s.statusSrc && !oldUrls.has(s.statusSrc.url))),
  figures: cur.figures.filter((f) => !oldIds.has(f.id) && !oldUrls.has(f.src.url)),
  notices: cur.notices.filter((n) => !oldIds.has(n.id)),
  updatedAt: cur.updatedAt,
};
console.log("kept ships", next.ships.map((s) => `${s.date} ${s.ship ?? s.place} (${s.src.name})`));
console.log("kept site hits", next.sites.map((s) => `${s.id}: ${s.hits.map((h) => `${h.date} ${h.name}`).join(", ")}`));
console.log("kept figures", next.figures.map((f) => `${f.label} ${f.value} (${f.src.name})`));
console.log("kept notices", next.notices.length);
if (dry !== "--dry") {
  await store.putJson(LEDGER_KEY, next);
  console.log("written");
}
process.exit(0);
