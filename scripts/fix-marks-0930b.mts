/**
 * The current brief's maps, once (30 Sep): the interceptions and ships as the
 * new rules draw them. An interception takes the side and the shape the window's
 * cards give it (a Saudi drone shot down over Saada, not a Houthi one), and a
 * ship with no card about a ship near it goes (Kahbub is a hill). The next
 * window is built this way by brief-store.ts. LIVE DATABASE WRITE.
 */
import { BRIEF_KEY, type StoredBrief } from "../src/lib/desk/brief-store.ts";
import { addMark, cardMarks, nearAny } from "../src/lib/desk/dev-marks.ts";
import { getStore } from "../src/lib/desk/store.ts";
import type { DevMark } from "../src/lib/desk/prose.ts";
import type { LiveReport } from "../src/lib/desk/types.ts";

const store = await getStore();
const saved = await store.getJson<StoredBrief>(BRIEF_KEY);
if (!saved?.brief) process.exit(1);
const b = saved.brief;
const start = Date.parse(b.windowStart), end = Date.parse(b.updatedAt);
const { reports } = await store.recentDesk(600, undefined, { events: false });
const inWindow = (reports as unknown as LiveReport[]).filter((r) => { const t = Date.parse(String(r.at)); return t >= start && t < end; });
const cards = cardMarks(inWindow, () => []).all;
const fix = (list: DevMark[]) => {
  const out: DevMark[] = [];
  for (const x0 of list) {
    const x = { ...x0 };
    if (x.kind === "naval" && !nearAny(x, cards.filter((c) => c.kind === "naval"))) continue;
    if (x.kind === "interception") {
      const c = cards.find((c) => c.kind === "interception" && nearAny(x, [c], 20));
      if (c) Object.assign(x, { side: c.side, ...(c.shot ? { shot: c.shot } : {}) });
    }
    addMark(out, x);
  }
  return out;
};
b.devMap = fix(b.devMap ?? []);
for (const f of b.fronts) if (f.map) f.map = fix(f.map);
for (const m of b.devMap) if (m.kind === "interception" || m.kind === "naval") console.log(JSON.stringify(m));
await store.putJson(BRIEF_KEY, saved);
process.exit(0);
