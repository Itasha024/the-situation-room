/**
 * `npm run deploy` — put a new build live on the Google server (VM "desk",
 * project situation-room-510315, us-east1-b). The PC only builds and sends.
 *
 * On the server the site runs from /srv/desk/current (a link to a release),
 * as the systemd service desk-server; desk-tick.timer scans every 5 minutes,
 * desk-tunnel is the Cloudflare link, desk-backup.timer copies the database
 * nightly to gs://situation-room-backups. Each deploy:
 *   1. builds (skip with --no-build),
 *   2. sends `.output` and migrations/ to /srv/desk/releases/<time>,
 *   3. applies migrations the server's database hasn't had yet,
 *   4. waits for a scan under way, points current at the release and restarts the site,
 *   5. waits for /api/status; if it doesn't answer, goes back to the previous release,
 *   6. keeps the newest 3 releases.
 * The old PC host (scripts/deploy-host.mjs) is `npm run deploy:pc`.
 */

import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = "situation-room-510315";
const ZONE = "us-east1-b";
const VM = "desk";
const USER = "itama";
const KEY = join(homedir(), ".ssh", "google_compute_engine");
const GCLOUD = process.env.GCLOUD || "C:\\My Programs\\Google Cloud CLI\\google-cloud-sdk\\bin\\gcloud.cmd";
const SSH = process.platform === "win32" ? "C:\\Windows\\System32\\OpenSSH\\ssh.exe" : "ssh";
const TAR = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";

if (!process.argv.includes("--no-build")) execSync("npm run build", { stdio: "inherit" });
if (!existsSync(join(".output", "server", "index.mjs"))) {
  console.error("[deploy] no .output/server/index.mjs — the build did not produce a Node server");
  process.exit(1);
}

// The server's address can change when it is stopped and started, so ask Google each time.
const ip =
  process.env.DESK_VM_IP ||
  execSync(`"${GCLOUD}" compute instances describe ${VM} --zone ${ZONE} --project ${PROJECT} ` +
    `"--format=value(networkInterfaces[0].accessConfigs[0].natIP)"`, { encoding: "utf8" }).trim();

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
const remote = `set -e
R=/srv/desk/releases/${stamp}
mkdir -p $R
tar -xzf - -C $R
mv $R/.output/* $R/ && rmdir $R/.output
rm -rf /srv/desk/migrations && mv $R/migrations /srv/desk/migrations
. /srv/desk/db.env
for f in /srv/desk/migrations/0*.sql; do
  n=$(basename $f)
  if [ -z "$(psql "$DATABASE_URL" -tAc "select 1 from _migrations where name='$n'")" ]; then
    psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -1 -f $f -c "insert into _migrations (name) values ('$n')"
    echo "[deploy] migration $n applied"
  fi
done
PREV=$(readlink -f /srv/desk/current)
# A scan under way finishes first (up to 4 minutes): a restart cut it off.
for i in $(seq 80); do systemctl is-active --quiet desk-tick.service || break; [ $i = 1 ] && echo "[deploy] waiting for the scan to finish"; sleep 3; done
ln -sfn $R /srv/desk/current
sudo systemctl restart desk-server
ok=
for i in $(seq 30); do
  sleep 3
  if curl -sf -o /dev/null -m 10 http://127.0.0.1:3000/api/status; then ok=1; break; fi
done
if [ -z "$ok" ]; then
  ln -sfn $PREV /srv/desk/current
  sudo systemctl restart desk-server
  echo "[deploy] new release did not answer /api/status — back on $PREV"
  exit 1
fi
ls -1d /srv/desk/releases/* | sort -r | tail -n +4 | grep -v -x -e "$R" -e "$PREV" | xargs -r rm -rf
echo "[deploy] live: $R"`;

const tar = spawn(TAR, ["-czf", "-", ".output", "migrations"], { stdio: ["ignore", "pipe", "inherit"] });
const ssh = spawn(SSH, ["-i", KEY, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", `${USER}@${ip}`, remote], {
  stdio: ["pipe", "inherit", "inherit"],
});
tar.stdout.pipe(ssh.stdin);
ssh.on("close", (code) => process.exit(code ?? 1));
