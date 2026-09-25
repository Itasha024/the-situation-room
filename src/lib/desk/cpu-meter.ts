import { getStore } from "./store.ts";

/**
 * Processor time per endpoint, per day. Vercel's free plan allows 4 hours of
 * "Active CPU" a month, and the tick's own meter showed only a fifth of what
 * the bill did: the rest is visitors' reads. Each instance adds up its calls
 * and folds them into one small row at most every 5 minutes.
 */
export const CPU_KEY = "cpu-meter";
export type CpuRow = { n: number; ms: number };
export type CpuMeter = Record<string, Record<string, CpuRow>>;

const FLUSH_MS = 5 * 60_000;
const KEEP_DAYS = 7;

let pending: Record<string, CpuRow> = {};
let lastFlush = Date.now();

/** Adds `add` to the day's rows and keeps the last week. */
export function mergeMeter(meter: CpuMeter | null, day: string, add: Record<string, CpuRow>): CpuMeter {
  const out: CpuMeter = { ...(meter ?? {}) };
  const today = { ...(out[day] ?? {}) };
  for (const [route, r] of Object.entries(add)) {
    const was = today[route] ?? { n: 0, ms: 0 };
    today[route] = { n: was.n + r.n, ms: Math.round(was.ms + r.ms) };
  }
  out[day] = today;
  for (const d of Object.keys(out).sort().slice(0, -KEEP_DAYS)) delete out[d];
  return out;
}

async function flush(): Promise<void> {
  const add = pending;
  pending = {};
  lastFlush = Date.now();
  try {
    const store = await getStore();
    const meter = await store.getJson<CpuMeter>(CPU_KEY);
    await store.putJson(CPU_KEY, mergeMeter(meter, new Date().toISOString().slice(0, 10), add));
  } catch {
    // A lost flush loses a few minutes of counts, never a response.
  }
}

/** Runs one request's handler and counts its processor time under `route`. */
export async function metered(route: string, fn: () => Promise<Response>): Promise<Response> {
  const start = process.cpuUsage();
  try {
    return await fn();
  } finally {
    const d = process.cpuUsage(start);
    const row = (pending[route] ??= { n: 0, ms: 0 });
    row.n += 1;
    row.ms += (d.user + d.system) / 1000;
    if (Date.now() - lastFlush > FLUSH_MS) await flush();
  }
}
