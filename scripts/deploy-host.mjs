/**
 * `npm run deploy` — put a new build live on this PC.
 *
 * The live desk runs from its own folder (%USERPROFILE%\desk-live), never from
 * the project's `.output`, so a local build can't pull files out from under
 * the running server. Each deploy:
 *   1. builds (skip with --no-build),
 *   2. copies `.output` to desk-live\releases\<time>,
 *   3. points current.txt at it and stops the running server, which the
 *      "Desk server" task (scripts/host/run-server.ps1) starts again on it,
 *   4. waits for /api/status to answer; if it doesn't, goes back to the
 *      previous release,
 *   5. keeps the newest 3 releases.
 * It also refreshes the task scripts in desk-live\bin.
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LIVE = process.env.DESK_LIVE_DIR || join(homedir(), "desk-live");
const RELEASES = join(LIVE, "releases");
const CURRENT = join(LIVE, "current.txt");
const PID = join(LIVE, "server.pid");
const KEEP = 3;
const HEALTH_URL = "http://127.0.0.1:3000/api/status";

if (!process.argv.includes("--no-build")) {
  execSync("npm run build", { stdio: "inherit" });
}
if (!existsSync(join(".output", "server", "index.mjs"))) {
  console.error("[deploy] no .output/server/index.mjs — the build did not produce a Node server");
  process.exit(1);
}

mkdirSync(RELEASES, { recursive: true });
mkdirSync(join(LIVE, "bin"), { recursive: true });
cpSync(join("scripts", "host"), join(LIVE, "bin"), { recursive: true });

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
const release = join(RELEASES, stamp);
cpSync(".output", release, { recursive: true });
console.log(`[deploy] copied build to ${release}`);

const previous = existsSync(CURRENT) ? readFileSync(CURRENT, "utf8").trim() : null;

async function switchTo(dir) {
  writeFileSync(CURRENT, dir);
  stopServer();
  return waitHealthy();
}

function stopServer() {
  if (!existsSync(PID)) return;
  const pid = Number(readFileSync(PID, "utf8").trim());
  try {
    process.kill(pid);
  } catch {
    // Not running (first deploy, or the task isn't installed yet).
  }
}

async function waitHealthy() {
  const until = Date.now() + 90_000;
  // Give the old process time to exit and the task to start the new one.
  await new Promise((r) => setTimeout(r, 7000));
  while (Date.now() < until) {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

const serverInstalled = existsSync(PID);
if (!serverInstalled) {
  writeFileSync(CURRENT, release);
  console.log("[deploy] release ready. The server task isn't installed yet — run scripts/host/install.ps1 as Administrator.");
} else if (await switchTo(release)) {
  console.log(`[deploy] live: ${release}`);
} else if (previous && existsSync(previous)) {
  console.error("[deploy] new release did not answer /api/status — going back to the previous one");
  const ok = await switchTo(previous);
  console.error(ok ? `[deploy] back on ${previous}` : "[deploy] previous release is not answering either — check desk-live\\logs");
  process.exit(1);
} else {
  console.error("[deploy] new release did not answer /api/status — check desk-live\\logs");
  process.exit(1);
}

const live = readFileSync(CURRENT, "utf8").trim();
const old = readdirSync(RELEASES).sort().reverse().slice(KEEP);
for (const name of old) {
  const dir = join(RELEASES, name);
  if (dir !== live && dir !== previous) rmSync(dir, { recursive: true, force: true });
}
