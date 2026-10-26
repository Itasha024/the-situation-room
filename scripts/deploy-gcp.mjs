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
 *   4. waits for a scan under way, then starts the release beside the live one,
 *   5. waits for /api/status and warms its caches, then switches nginx to it
 *      and stops the old one; if it never answers, the live site is left as it was,
 *   6. keeps the newest 3 releases.
 * The old PC host (scripts/deploy-host.mjs) is `npm run deploy:pc`.
 *
 * No gap on a deploy (user, 22 Oct: "make sure it doesnt go down"): nginx holds
 * port 3000 (where the Cloudflare link points) and passes to desk-web@3010 or
 * desk-web@3011, whichever /srv/desk/live-port names. Each release runs from
 * /srv/desk/slot-<port>. Before that set-up a deploy restarted desk-server, and
 * the site was away for its restart and slow until its caches were warm; a
 * server without it still deploys that way.
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
for i in $(seq 80); do systemctl is-active --quiet desk-tick.service || systemctl is-active --quiet desk-iran-tick.service || systemctl is-active --quiet desk-gaza-tick.service || break; [ $i = 1 ] && echo "[deploy] waiting for the scan to finish"; sleep 3; done
# The first visitor after a restart does not pay for the cold caches: the pages and the desks' data are read once now.
# The map's whole-war pins (?since=, the heaviest answers) and the scan's are among them (20 Oct).
warm() { for u in / /yemen-conflict-desk /iran-conflict-desk "/api/desk?desk=yemen" "/api/desk?desk=iran" "/api/desk?limit=400" "/api/desk?desk=yemen&since=2026-07-13" "/api/desk?desk=iran&since=2026-02-28" "/api/brief?desk=yemen" "/api/brief?desk=iran" /api/brief /api/scan "/api/scan?only=time" "/api/scan?desk=iran&only=time" /api/trump "/api/trump?desk=yemen" /gaza-judea-samaria-desk "/api/desk?desk=gaza" "/api/brief?desk=gaza" "/api/trump?desk=gaza"; do curl -s -o /dev/null -m 90 "http://127.0.0.1:$1$u" || true; done; echo "[deploy] caches warmed"; }
up() { for i in $(seq 30); do sleep 3; if curl -sf -o /dev/null -m 10 http://127.0.0.1:$1/api/status; then return 0; fi; done; return 1; }
restart_worker() { if systemctl list-unit-files desk-worker.service >/dev/null 2>&1; then sudo systemctl restart desk-worker; fi; }
if [ -f /srv/desk/live-port ] && [ -f /etc/systemd/system/desk-web@.service ]; then
  LIVE=$(cat /srv/desk/live-port)
  if [ "$LIVE" = 3010 ]; then NEXT=3011; else NEXT=3010; fi
  ln -sfn $R /srv/desk/slot-$NEXT
  # The new one starts and warms on what CPU the live one leaves (22 Oct: warming at equal weight, one
  # live request in eleven timed out); it gets its full share once it is the live one.
  sudo systemctl set-property --runtime desk-web@$NEXT CPUWeight=10
  # Two sites and the scans do not fit in the 1 GB together (26 Oct: memory ran out mid-deploy, both sites
  # stalled for minutes): the scans pause until the new site is live, and start again either way.
  sudo systemctl stop desk-worker 2>/dev/null || true
  sudo systemctl restart desk-web@$NEXT
  if ! up $NEXT; then
    sudo systemctl stop desk-web@$NEXT
    restart_worker
    echo "[deploy] new release did not answer /api/status — the live site was not touched"
    exit 1
  fi
  warm $NEXT
  # A page already open, or kept by nginx, asks for the old release's script files: they stay (26 Oct: the
  # front page failed on "Failed to fetch dynamically imported module" after a deploy).
  cp -rn $PREV/public/assets/. $R/public/assets/ 2>/dev/null || true
  echo "server 127.0.0.1:$NEXT;" | sudo tee /etc/nginx/desk-upstream.conf >/dev/null
  sudo nginx -t -q && sudo systemctl reload nginx
  # The pages nginx kept were the old release's (scripts/nginx/desk.conf).
  sudo find /var/cache/nginx/desk -type f -delete 2>/dev/null || true
  echo $NEXT > /srv/desk/live-port
  sudo systemctl set-property --runtime desk-web@$NEXT CPUWeight=100
  ln -sfn $R /srv/desk/current
  sudo systemctl enable -q desk-web@$NEXT
  # Requests under way on the old one finish first.
  sleep 8
  sudo systemctl disable -q desk-web@$LIVE
  sudo systemctl stop desk-web@$LIVE
  # The scans run in their own process (desk-worker, port 3001, 18 Oct), so the site never waits on one.
  restart_worker
else
  ln -sfn $R /srv/desk/current
  sudo systemctl restart desk-server
  restart_worker
  if ! up 3000; then
    ln -sfn $PREV /srv/desk/current
    sudo systemctl restart desk-server
    restart_worker
    echo "[deploy] new release did not answer /api/status — back on $PREV"
    exit 1
  fi
  warm 3000
fi
ls -1d /srv/desk/releases/* | sort -r | tail -n +4 | grep -v -x -e "$R" -e "$PREV" -e "$(readlink -f /srv/desk/slot-3010)" -e "$(readlink -f /srv/desk/slot-3011)" | xargs -r rm -rf
echo "[deploy] live: $R"`;

const tar = spawn(TAR, ["-czf", "-", ".output", "migrations"], { stdio: ["ignore", "pipe", "inherit"] });
const ssh = spawn(SSH, ["-i", KEY, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", `${USER}@${ip}`, remote], {
  stdio: ["pipe", "inherit", "inherit"],
});
tar.stdout.pipe(ssh.stdin);
ssh.on("close", (code) => process.exit(code ?? 1));
