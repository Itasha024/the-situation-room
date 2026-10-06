/**
 * The current brief's maps, once (7 Oct): a "ground taken" flag stays only
 * where a card of the window tells the whole district taken, confirmed as
 * control needs it (control-live.ts captureConfirmed). Any other capture is
 * drawn as that side's advance, with the side the window's cards give the spot
 * (Nation's Shield's gains in Jabal Habashi were drawn as Houthi flags).
 * The next window is built this way by brief-store.ts. LIVE DATABASE WRITE.
 */
import { BRIEF_KEY, type StoredBrief } from "../src/lib/desk/brief-store.ts";
import { cardMarks, nearAny } from "../src/lib/desk/dev-marks.ts";
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
const fix = (list: DevMark[]) =>
  list.map((m) => {
    if (m.kind !== "capture" || cards.some((c) => c.kind === "capture" && c.side === m.side && nearAny(m, [c], 3))) return m;
    const near = cards.find((c) => (c.kind === "advance" || c.kind === "capture") && nearAny(m, [c], 20));
    const out = { ...m, kind: "advance" as const, ...(near ? { side: near.side } : {}) };
    console.log(`${m.place}: capture/${m.side} -> advance/${out.side}`);
    return out;
  });
b.devMap = fix(b.devMap ?? []);
for (const f of b.fronts) if (f.map) f.map = fix(f.map);
await store.putJson(BRIEF_KEY, saved);
process.exit(0);
