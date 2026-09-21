#!/usr/bin/env node
/**
 * The desk's local clock: one scan cycle, however the machine happens to be.
 *
 * A Windows scheduled task runs this every five minutes (see
 * `scripts/install-clock.ps1`). It is what keeps the desk alive with no
 * browser open, no Claude session and no dev server:
 *
 *   dev server up   → GET http://localhost:8080/api/tick. The server's own
 *                     self-tick is probably already scanning; the tick is
 *                     idempotent per source schedule, so asking again costs
 *                     nothing.
 *   dev server down → start Vite headless (no port, no watcher), load
 *                     `runScanCycle` and run it in-process — the exact code the
 *                     deployed `/api/tick` runs, against the same store.
 *
 * Every run appends one line to `logs/tick.log`, so a stalled clock is visible
 * afterwards rather than silent. A lock stops a slow headless cycle from having
 * a second one stack up behind it.
 *
 * Deployed, this file is not used: the GitHub Action calls `/api/tick`.
 */
import { appendFileSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT); // the file store resolves public/ against the cwd

const LOG_DIR = join(ROOT, "logs");
const LOG_FILE = join(LOG_DIR, "tick.log");
const LOCK_FILE = join(LOG_DIR, "tick.lock");
const DEV_URL = process.env.DESK_DEV_URL || "http://localhost:8080";
/** A lock older than this belongs to a run that died; take it over. */
const STALE_LOCK_MS = 10 * 60_000;

mkdirSync(LOG_DIR, { recursive: true });

function log(line) {
  const stamp = new Date().toISOString();
  appendFileSync(LOG_FILE, `${stamp} ${line}\n`);
  console.log(line);
}

function summarize(r, how) {
  if (!r || typeof r !== "object") return `${how}: no result`;
  return (
    `${how}: ${r.ok ? "ok" : "FAILED"} ${r.sourcesOk ?? "?"}/${r.sourcesTried ?? "?"} sources, ` +
    `+${r.reportsAdded ?? 0} reports, +${r.eventsAdded ?? 0} pins` +
    (r.briefBuilt ? ", brief composed" : "") +
    (r.error ? ` — ERROR: ${r.error}` : "")
  );
}

function takeLock() {
  try {
    writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    try {
      if (Date.now() - statSync(LOCK_FILE).mtimeMs > STALE_LOCK_MS) {
        rmSync(LOCK_FILE, { force: true });
        writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
        return true;
      }
    } catch {
      /* someone else took it between the checks */
    }
    return false;
  }
}

/** Ask a running dev server to tick. Null when nothing is listening. */
async function viaDevServer() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4 * 60_000);
  try {
    const res = await fetch(`${DEV_URL}/api/tick`, { signal: ctl.signal });
    return await res.json();
  } catch (err) {
    // Connection refused means no server — fall through to headless.
    const code = err?.cause?.code || err?.code;
    if (code === "ECONNREFUSED" || code === "ECONNRESET") return null;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// A file written by the cycle can reach Vite's module graph after close();
// it rejects with ERR_CLOSED_SERVER, which is shutdown noise, not a failure.
process.on("unhandledRejection", (err) => {
  if (err?.code === "ERR_CLOSED_SERVER") return;
  log(`FAILED (unhandled): ${err?.stack || err}`);
  process.exitCode = 1;
});

async function headless() {
  // The dev server's own interval must not start inside this one-shot run.
  process.env.DESK_SELF_TICK = "0";
  try {
    process.loadEnvFile(join(ROOT, ".env"));
  } catch {
    /* no .env: the scan needs no secret locally */
  }
  const { createServer } = await import("vite");
  const server = await createServer({
    root: ROOT,
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom",
  });
  try {
    const mod = await server.ssrLoadModule("/src/lib/yemen-scan.server.ts");
    return await mod.runScanCycle();
  } finally {
    await server.close();
  }
}

async function main() {
  if (!takeLock()) {
    log("skip: previous cycle still running");
    return;
  }
  try {
    const viaServer = await viaDevServer();
    if (viaServer) {
      log(summarize(viaServer, "dev-server"));
      return;
    }
    log(summarize(await headless(), "headless"));
  } catch (err) {
    log(`FAILED: ${err?.stack || err}`);
    process.exitCode = 1;
  } finally {
    rmSync(LOCK_FILE, { force: true });
  }
}

await main();
// Vite can leave handles open after close(); the cycle is done either way.
process.exit(process.exitCode ?? 0);
