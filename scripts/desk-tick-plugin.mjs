/**
 * Dev-server self-tick.
 *
 * Deployed, an external scheduler calls `/api/tick`. In development there is no
 * scheduler, so this drives the same cycle on an interval — which means a dev
 * server left running keeps the feed filling exactly as the deployed desk does,
 * with nobody watching the page.
 *
 * It calls `runScanCycle()` directly rather than fetching `/api/tick`, so it
 * needs no secret and does not care which port Vite settled on.
 *
 * Off with `DESK_SELF_TICK=0`. Dev only — `apply: "serve"`.
 */

import { loadEnv } from "vite";

const DEFAULT_INTERVAL_MS = 60_000;

export function deskTickPlugin() {
  return {
    name: "desk:self-tick",
    apply: "serve",
    configureServer(server) {
      // Vite leaves non-VITE_ .env entries out of process.env, so read the
      // flag from .env too — the shell still wins when it sets one.
      const fileEnv = loadEnv(server.config.mode, server.config.root, "DESK_");
      const selfTick = process.env.DESK_SELF_TICK ?? fileEnv.DESK_SELF_TICK;
      if (selfTick === "0") {
        server.config.logger.info("[desk] self-tick disabled (DESK_SELF_TICK=0)");
        return;
      }

      const every = Number(process.env.DESK_TICK_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
      let running = false;
      let stopped = false;

      const tick = async () => {
        // A slow cycle must never stack up behind itself.
        if (running || stopped) return;
        running = true;
        try {
          const mod = await server.ssrLoadModule("/src/lib/yemen-scan.server.ts");
          const r = await mod.runScanCycle();
          if (r.sourcesTried > 0 || r.reportsAdded > 0 || !r.ok) {
            server.config.logger.info(
              `[desk] tick: ${r.sourcesOk}/${r.sourcesTried} sources, ` +
                `+${r.reportsAdded} reports, +${r.eventsAdded} pins` +
                (r.unplaced.length ? `, ${r.unplaced.length} unplaced` : "") +
                (r.error ? ` — ERROR: ${r.error}` : ""),
            );
          }
        } catch (err) {
          server.config.logger.error(`[desk] tick failed: ${err?.message || err}`);
        } finally {
          running = false;
        }
      };

      // Let Vite finish starting before the first cycle, so startup stays fast.
      const first = setTimeout(tick, 4000);
      const timer = setInterval(tick, every);
      timer.unref?.();

      server.httpServer?.once("close", () => {
        stopped = true;
        clearTimeout(first);
        clearInterval(timer);
      });

      server.config.logger.info(`[desk] self-tick every ${Math.round(every / 1000)}s`);
    },
  };
}
