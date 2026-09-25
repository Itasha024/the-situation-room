import assert from "node:assert/strict";
import test from "node:test";
import { mergeMeter } from "./cpu-meter.ts";

test("the meter adds calls and time per endpoint per day, and keeps a week", () => {
  let m = mergeMeter(null, "2026-09-25", { desk: { n: 2, ms: 10.4 } });
  m = mergeMeter(m, "2026-09-25", { desk: { n: 1, ms: 5 }, scan: { n: 1, ms: 3 } });
  assert.deepEqual(m["2026-09-25"], { desk: { n: 3, ms: 15 }, scan: { n: 1, ms: 3 } });
  for (let d = 10; d < 20; d += 1) m = mergeMeter(m, `2026-10-${d}`, { tick: { n: 1, ms: 1 } });
  assert.equal(Object.keys(m).length, 7);
  assert.ok(!m["2026-09-25"]);
});
