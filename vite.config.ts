import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { deskTickPlugin } from "./scripts/desk-tick-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";
const NITRO_PRESET = process.env.NITRO_PRESET || "node-server";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/** Files of public/ that are never published (the nitro `ignore` below). */
const UNPUBLISHED = /(^|\/)(desk-[^/]*\.json|[^/]*\.tmp-[^/]*|[^/]*\.he\.json|SOURCES\.md)$/;

/**
 * A fingerprint of everything public/ publishes, taken at build: it is part of ASSET_V, so a
 * changed app.js, style or data.json always has a new address (20 Oct: half the releases changed
 * them without a new ASSET_V, which is why browsers could not be told to keep them).
 */
function publicFingerprint(root: string): string {
  const h = createHash("sha1");
  const walk = (dir: string, rel: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), r);
      else if (!UNPUBLISHED.test(r)) h.update(r).update(readFileSync(join(dir, e.name)));
    }
  };
  walk(join(root, "public"), "");
  return h.digest("hex").slice(0, 8);
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  // src/lib/asset-version.ts; the dev server rewrites data.json every tick, so it has none.
  define: command === "build" ? { __ASSET_HASH__: JSON.stringify(publicFingerprint(process.cwd())) } : {},
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    watch: {
      // Build output is not source: a `npm run build` while dev runs writes
      // here, and on Windows a locked file crashes the watcher. The desk's own
      // data files are rewritten by every tick and fetched fresh by the page,
      // so a change to them must not reload it.
      ignored: [
        "**/.vercel/**",
        "**/.output/**",
        "**/public/data.json",
        "**/public/live-reports.json",
      ],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // Dev-only: drives the scan cycle on an interval, standing in for the
    // scheduler that calls /api/tick on the deployed desk.
    deskTickPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            // The desk runs as a plain Node server (`.output/server/index.mjs`)
            // behind a Cloudflare Tunnel since Vercel's free plan ran out of
            // compute. `NITRO_PRESET=vercel` still builds the old deploy.
            preset: NITRO_PRESET,
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
            // Local development keeps the desk's working state next to the
            // page in public/ (reader cache, scan state, queues, quota, tick
            // lock, meters). None of it is fetched by the page, so it must
            // never be published.
            ignore: ["**/desk-*.json", "**/*.tmp-*", "**/*.he.json", "**/SOURCES.md"],
            // Browsers keep the page's files (20 Oct: every visit fetched app.js, the styles and
            // the 888 KB data.json again from the small server). The page asks for these only as
            // ?v=ASSET_V, which holds the build's fingerprint of public/, so a changed file has a
            // new address. These rules run before the static files; a server middleware does not.
            routeRules: Object.fromEntries([
              ...["/app.js", "/home.js", "/ops.js", "/desk.css", "/home.css", "/ops.css", "/themes.css", "/rtl.css", "/data.json", "/i18n/**"].map(
                (p) => [p, { headers: { "cache-control": "public, max-age=31536000, immutable" } }],
              ),
              // The map's outlines and the desks' reference files had no cache rule at all (20 Oct: every
              // visit fetched 2-3 MB of them again from the small server). The outlines change about never:
              // a day, then a week served while checked again. The rest change with a release; some are
              // asked for without ?v=, so an hour, then a day served while checked again.
              ...["/yemen-adm1.geojson", "/yemen-adm2.geojson", "/saudi-adm1.geojson", "/iran-adm1.geojson", "/iran-adm2.geojson", "/iran-countries.geojson", "/iran-land.json", "/vendor/**"].map(
                (p) => [p, { headers: { "cache-control": "public, max-age=86400, stale-while-revalidate=604800" } }],
              ),
              ...["/gazetteer.json", "/control.json", "/iran-cities.json", "/iran-map-pins.json", "/iran-map-notes.json", "/iran-numbers.json", "/iran-timeline.json"].map(
                (p) => [p, { headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" } }],
              ),
            ]),
            // On Vercel a tick cycle (scan + model reads) outlives the default
            // limit; 300s is the Hobby ceiling. It runs in the background (see
            // src/routes/api/tick.ts), so the scheduler never waits for it.
            ...(NITRO_PRESET === "vercel"
              ? { vercel: { functions: { maxDuration: 300 } } }
              : {}),
          }),
        ]
      : []),
    viteReact(),
  ],
}));
