import { createFileRoute } from "@tanstack/react-router";
import { runScanCycle } from "@/lib/yemen-scan.server";

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
      POST: async ({ request }) => tick(request),
      // GET is allowed too: several free schedulers can only issue GETs.
      GET: async ({ request }) => tick(request),
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

async function tick(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return json({ ok: false, error: denied }, 401);

  const startedAt = Date.now();
  try {
    const result = await runScanCycle();
    return json({ ...result, tookMs: Date.now() - startedAt }, result.ok ? 200 : 500);
  } catch (err) {
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "tick failed",
        tookMs: Date.now() - startedAt,
      },
      500,
    );
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 1), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
