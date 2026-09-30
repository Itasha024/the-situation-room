/**
 * The current brief's maps, once (30 Sep): a fired mark with no flight path takes
 * the one launch area the window's cards name (Sanaa -> Aden), and a missile
 * mark on the spot another was fired from is that launch area, not a target.
 * The next window is built this way by brief-store.ts. LIVE DATABASE WRITE.
 */
import { BRIEF_KEY, type StoredBrief } from "../src/lib/desk/brief-store.ts";
import { cardMarks, launchFor, nearAny } from "../src/lib/desk/dev-marks.ts";
import { getStore } from "../src/lib/desk/store.ts";
import type { DevMark } from "../src/lib/desk/prose.ts";
import type { LiveReport } from "../src/lib/desk/types.ts";

const store = await getStore();
const saved = await store.getJson<StoredBrief>(BRIEF_KEY);
if (!saved?.brief) process.exit(1);
const b = saved.brief;
console.log("model:", b.situation?.model, "\n", b.situation?.line, "\n", b.situation?.more);
const start = Date.parse(b.windowStart), end = Date.parse(b.updatedAt);
const { reports } = await store.recentDesk(600, undefined, { events: false });
const inWindow = (reports as unknown as LiveReport[]).filter((r) => { const t = Date.parse(String(r.at)); return t >= start && t < end; });
const { launches } = cardMarks(inWindow, () => []);
console.log("launches:", JSON.stringify(launches));
const FIRED = new Set(["missile", "drone", "interception"]);
const fix = (list: DevMark[]) => {
  const out = list.map((x) => (x.kind === "interception" && !x.from ? (({ fromLl, ...y }) => y)(x) : x)).map((x) => (x.fromLl ? x : { ...x, ...(launchFor(x, launches) ? { fromLl: launchFor(x, launches) } : {}) }));
  const paths = out.filter((x) => x.fromLl);
  return out.filter((x) => !(FIRED.has(x.kind) && !x.fromLl && paths.some((y) => y.side === x.side && nearAny(x, [{ ...x, ll: y.fromLl }], 10))));
};
b.devMap = fix(b.devMap ?? []);
for (const f of b.fronts) if (f.map) f.map = fix(f.map);
for (const m of b.devMap) if (FIRED.has(m.kind)) console.log(JSON.stringify(m));
await store.putJson(BRIEF_KEY, saved);
process.exit(0);
