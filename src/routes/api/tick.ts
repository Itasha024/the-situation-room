import { createFileRoute } from "@tanstack/react-router";
import { metered } from "@/lib/desk/cpu-meter";
import { runScanCycle } from "@/lib/yemen-scan.server";
import { getStore } from "@/lib/desk/store";

/**
 * The desk's clock.
 *
 * This is the ONLY thing that scans. A scheduler calls it on a cadence, so the
 * feed keeps filling whether or not anyone has the page open — which is the
 * whole point: page views read, the clock writes.
 *
 * Idempotent with respect to the per-source schedule: calling it more often
 * than needed simply finds fewer sources due, so a jittery cron costs nothing.
 *
 * AUTH — `DESK_TICK_SECRET`:
 *   set   → callers must send `Authorization: Bearer <secret>`.
 *   unset → localhost only, so local development needs no setup while a
 *           deployed desk can never be left publicly tickable by accident.
 */
export const Route = createFileRoute("/api/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => metered("tick", () => tick(request)),
      // GET is allowed too: several free schedulers can only issue GETs.
      GET: async ({ request }) => metered("tick", () => tick(request)),
    },
  },
});

function isLocal(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/** Constant-time-ish compare, so a wrong secret leaks nothing by timing. */
function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function authorize(request: Request): string | null {
  const expected = (process.env.DESK_TICK_SECRET || "").trim();
  if (!expected) {
    return isLocal(request)
      ? null
      : "DESK_TICK_SECRET is not set, so the tick only accepts local callers";
  }
  const header = request.headers.get("authorization") || "";
  const given = header.replace(/^Bearer\s+/i, "").trim();
  if (!given) return "missing bearer token";
  return secretMatches(given, expected) ? null : "bad token";
}

/**
 * Vercel's hook for work that outlives the response. The free schedulers cut
 * a request off after ~30 seconds and a cycle takes longer, so on Vercel the
 * tick answers 202 at once and the cycle finishes in the background.
 */
function backgroundRunner(request: Request): ((p: Promise<unknown>) => void) | null {
  const fromRequest = (request as Request & { waitUntil?: (p: Promise<unknown>) => void }).waitUntil;
  if (typeof fromRequest === "function") return fromRequest;
  const ctx = (
    globalThis as unknown as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } }>
  )[Symbol.for("@vercel/request-context")]?.get?.();
  return typeof ctx?.waitUntil === "function" ? ctx.waitUntil.bind(ctx) : null;
}

const LOCK_KEY = "tick-lock";
/** Just under Vercel's 300-second function limit: a crashed cycle frees the lock by then. */
const LOCK_TTL_MS = 290_000;

/** A scheduler with no concurrency control must never stack two cycles. */
async function runLocked(): Promise<Record<string, unknown>> {
  const store = await getStore();
  const held = await store.getJson<{ at: number }>(LOCK_KEY);
  if (held && Date.now() - held.at < LOCK_TTL_MS) {
    return { ok: true, skipped: "a cycle is already running" };
  }
  await store.putJson(LOCK_KEY, { at: Date.now() });
  const startedAt = Date.now();
  try {
    const result = await runScanCycle();
    return { ...result, tookMs: Date.now() - startedAt };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "tick failed",
      tookMs: Date.now() - startedAt,
    };
  } finally {
    await store.putJson(LOCK_KEY, { at: 0 }).catch(() => {});
  }
}

async function tick(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return json({ ok: false, error: denied }, 401);

  const background = backgroundRunner(request);
  // `?wait=1` keeps the old synchronous answer, for a human checking by hand.
  const wait = new URL(request.url).searchParams.get("wait") === "1";
  if (background && !wait) {
    background(
      runLocked().then((r) => console.log("[tick]", JSON.stringify(r).slice(0, 500))),
    );
    return json({ ok: true, accepted: true }, 202);
  }
  const result = await runLocked();
  return json(result, result.ok === false ? 500 : 200);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 1), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
