/**
 * 5 October 2026, the operator's review of the maps and the incident tables.
 *
 * District colours (control-live):
 * - Jabal Habashi went to the government at 08:23 UTC on one compound headline,
 *   "government forces destroy Houthi vehicles in Jabal Habashi, while Houthi
 *   forces expel Saudi mobilization from Al-Mawasit district". The capture
 *   clause was the Houthis', and in Al-Mawasit. It goes back to its hand
 *   baseline (contested), and the change is dropped.
 * - Al-Mawasit: Houthi forces entering Al-Ayn town in the district (Al-Araby TV,
 *   Almashhad, 08:49 UTC) makes it contested under the same rule.
 * - Dhubab stays the government's (the whole district, told by outlets of two
 *   groups); the operator decided to leave it as it is.
 *
 * Developments' and fronts' maps (brief): a "ground taken" flag with no whole
 * district confirmed behind it is drawn as an advance (the page does the same).
 *
 * Energy and maritime tables (ledger): the stored copy is put through the new
 * rules and the corrected research rows (ledger-baseline.ts), so the stored
 * ledger matches what the page shows.
 *
 * LIVE DATABASE WRITE. Dry run first:
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/fix-map-ledger-1005.mts
 *   node --env-file=%USERPROFILE%\desk-live\desk.env --experimental-strip-types scripts/fix-map-ledger-1005.mts --apply
 */
import { CONTROL_LIVE_KEY, type ControlLive } from "../src/lib/desk/control-live.ts";
import { LEDGER_KEY, LEDGER_SEED, type Ledger, withBaseline } from "../src/lib/desk/ledger.ts";
import type { DevMark } from "../src/lib/desk/prose.ts";
import { getStore } from "../src/lib/desk/store.ts";

const apply = process.argv.includes("--apply");
const store = await getStore();

/* District colours */
const live = await store.getJson<ControlLive>(CONTROL_LIVE_KEY);
if (live) {
  const next: ControlLive = structuredClone(live);
  delete next.districts["jabal-habashi"];
  next.changes = next.changes.filter((c) => !(c.district === "jabal-habashi" && c.at.startsWith("2026-10-05")));
  if (!next.districts["al-mawasit"]) {
    next.districts["al-mawasit"] = {
      side: "contested",
      since: "2026-10-05",
      src: [
        { outlet: "Al-Araby TV", url: "https://t.me/AlarabyTvBrk/66238" },
        { outlet: "Almashhad", url: "https://www.almashhad.news/news/498128" },
      ],
      note: "Houthi forces enter Al-Ayn town in Al-Mawasit district of the Taiz countryside",
    };
    next.changes.unshift({
      at: "2026-10-05T08:49:24.000Z",
      district: "al-mawasit",
      name: "Al Mawasit",
      from: "plc",
      to: "contested",
      outlets: ["Al-Araby TV", "Almashhad"],
      headlines: ["Houthi forces enter Al-Ayn town in Al-Mawasit district of Taiz countryside"],
    });
  }
  console.log("control-live before:", Object.entries(live.districts).map(([k, v]) => `${k}=${v.side}`).join(", "));
  console.log("control-live after: ", Object.entries(next.districts).map(([k, v]) => `${k}=${v.side}`).join(", "));
  if (apply) await store.putJson(CONTROL_LIVE_KEY, next);
}

/* Flags on the developments' and fronts' maps */
type BriefLike = { devMap?: DevMark[]; fronts?: { id: string; map?: DevMark[] }[] };
const brief = await store.getJson<BriefLike>("brief");
if (brief) {
  let n = 0;
  const fix = (list?: DevMark[]) => list?.forEach((m) => m.kind === "capture" && !m.district && ((m.kind = "advance"), (n += 1)));
  fix(brief.devMap);
  for (const f of brief.fronts ?? []) fix(f.map);
  console.log(`flags without a whole district confirmed, now advances: ${n}`);
  if (apply && n) await store.putJson("brief", brief);
}

/* Energy and maritime tables */
const stored = (await store.getJson<Ledger>(LEDGER_KEY)) ?? LEDGER_SEED;
const ledger = withBaseline(stored);
const hits = (l: Ledger) => l.sites.flatMap((s) => s.hits.filter((h) => h.date >= "2026-09-19").map((h) => `${h.date} ${s.id} (${h.name})`)).sort();
console.log("energy hits since 19 Sep, before:\n  " + hits(stored).join("\n  "));
console.log("energy hits since 19 Sep, after:\n  " + hits(ledger).join("\n  "));
console.log("ships since 1 Oct, after:", ledger.ships.filter((s) => s.date >= "2026-10-01" && s.date <= "2026-10-31").map((s) => `${s.date} ${s.ship ?? s.type} (${s.src.name})`));
if (apply) await store.putJson(LEDGER_KEY, ledger);

console.log(apply ? "written" : "dry run: nothing written (add --apply)");
process.exit(0);
