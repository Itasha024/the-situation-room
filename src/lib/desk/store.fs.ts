/**
 * Filesystem driver for the desk store — local development.
 *
 * Keeps the same files the desk has always used, so nothing downstream has to
 * change: `public/data.json` is the desk snapshot the page renders,
 * `public/live-reports.json` is the last scan payload. Cadence state gets its
 * own small file rather than riding in either.
 *
 * Writes go through a temp file and a rename, so a crash mid-write cannot leave
 * a half-written `data.json` that fails to parse and blanks the desk.
 */

import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { DeskEventRow, DeskReportRow } from "./snapshot.ts";
import { deriveEvents, hasArticlePath, toDeskReportRow } from "./snapshot.ts";
import type { DeskSlice, DeskStore, MergeResult } from "./store.ts";
import { EMPTY_SCAN_STATE, type LiveReport, type ScanPayload, type ScanState } from "./types.ts";

const PUBLIC_DIR = join(process.cwd(), "public");
const DATA_FILE = join(PUBLIC_DIR, "data.json");
const STATE_FILE = join(PUBLIC_DIR, "desk-state.json");

/**
 * The payload is written to both the served directory and the built output, so
 * a preview of the built bundle sees the same snapshot as dev.
 */
const PAYLOAD_FILES = [
  join(PUBLIC_DIR, "live-reports.json"),
  join(process.cwd(), ".vercel", "output", "static", "live-reports.json"),
];

const rowsFile = (prefix: string) => join(PUBLIC_DIR, `desk-rows-${prefix}.json`);

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Write via temp + rename so readers never observe a partial file.
 * `indent` keeps each file's existing shape: the desk snapshot stays readable
 * by hand, the scan payload stays compact.
 */
async function writeJsonAtomic(path: string, value: unknown, indent = 0): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(value, null, indent), "utf8");
  await rename(tmp, path);
}

type DeskSnapshot = {
  updatedAt?: string;
  reports?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  [k: string]: unknown;
};

function jerusalemIso(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+03:00`;
}

export function createFsStore(): DeskStore {
  return {
    kind: "fs",

    async loadScanState(): Promise<ScanState> {
      const s = await readJson<ScanState>(STATE_FILE);
      if (!s || typeof s !== "object") return { ...EMPTY_SCAN_STATE };
      return {
        scannedOnce: !!s.scannedOnce,
        lastScanAt: s.lastScanAt && typeof s.lastScanAt === "object" ? s.lastScanAt : {},
        lastTickAt: typeof s.lastTickAt === "number" ? s.lastTickAt : undefined,
        // Dropping these made every Telegram read a first sight (no paging back
        // to the last post read) and lost each site's last listing figures.
        ...(s.lastTgPost && typeof s.lastTgPost === "object" ? { lastTgPost: s.lastTgPost } : {}),
        ...(s.lastXPost && typeof s.lastXPost === "object" ? { lastXPost: s.lastXPost } : {}),
        ...(s.sites && typeof s.sites === "object" ? { sites: s.sites } : {}),
      };
    },

    async saveScanState(state: ScanState): Promise<void> {
      await writeJsonAtomic(STATE_FILE, state);
    },

    async getJson<T>(key: string): Promise<T | null> {
      return readJson<T>(join(PUBLIC_DIR, `desk-${key}.json`));
    },

    async putJson(key: string, value: unknown): Promise<void> {
      await writeJsonAtomic(join(PUBLIC_DIR, `desk-${key}.json`), value);
    },

    async deleteJson(key: string): Promise<void> {
      await unlink(join(PUBLIC_DIR, `desk-${key}.json`)).catch(() => {});
    },

    /** Locally a cache's rows share one file: `desk-rows-<prefix>.json`. */
    async getMany<T>(prefix: string, ids: string[]): Promise<Record<string, T>> {
      const all = (await readJson<Record<string, { v: T; at: number }>>(rowsFile(prefix))) ?? {};
      const out: Record<string, T> = {};
      for (const id of ids) if (id in all) out[id] = all[id].v;
      return out;
    },

    async putMany(prefix: string, entries: Record<string, unknown>): Promise<void> {
      if (!Object.keys(entries).length) return;
      const all = (await readJson<Record<string, { v: unknown; at: number }>>(rowsFile(prefix))) ?? {};
      const at = Date.now();
      for (const [id, v] of Object.entries(entries)) all[id] = { v, at };
      await writeJsonAtomic(rowsFile(prefix), all);
    },

    async prune(prefix: string, olderThanMs: number): Promise<number> {
      const all = (await readJson<Record<string, { v: unknown; at: number }>>(rowsFile(prefix))) ?? {};
      const cut = Date.now() - olderThanMs;
      let n = 0;
      for (const [id, row] of Object.entries(all)) if (row.at < cut) {
        delete all[id];
        n += 1;
      }
      if (n) await writeJsonAtomic(rowsFile(prefix), all);
      return n;
    },

    async loadPayload(): Promise<ScanPayload | null> {
      for (const p of PAYLOAD_FILES) {
        const parsed = await readJson<ScanPayload>(p);
        if (parsed && Array.isArray(parsed.reports) && parsed.scannedAt) return parsed;
      }
      return null;
    },

    async savePayload(payload: ScanPayload): Promise<void> {
      const results = await Promise.allSettled(
        PAYLOAD_FILES.map((p) => writeJsonAtomic(p, payload)),
      );
      // The built-output copy is optional (it does not exist before a build);
      // the served copy is not. Only fail if every target failed.
      if (results.every((r) => r.status === "rejected")) {
        const first = results[0];
        throw new Error(
          `could not write scan payload: ${first.status === "rejected" ? first.reason : "unknown"}`,
        );
      }
    },

    /**
     * Locally the accumulated desk IS `data.json` — `mergeIntoDesk` unshifts
     * into it and the page reads it directly. Reading it back here keeps the
     * two drivers answering the same question, so `/api/desk` behaves
     * identically in development and deployed.
     */
    async recentDesk(limit = 400, before?: string, _opts?: { events?: boolean }): Promise<DeskSlice> {
      const cut = before ? Date.parse(before) : NaN;
      const older = (r: Record<string, unknown>) =>
        !Number.isFinite(cut) || Date.parse(String(r.at || "")) < cut;
      const data = await readJson<DeskSnapshot>(DATA_FILE);
      if (!data) return { updatedAt: null, reports: [], events: [] };
      const byAtDesc = (a: Record<string, unknown>, b: Record<string, unknown>) =>
        String(b.at || "").localeCompare(String(a.at || ""));
      return {
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
        reports: [...(data.reports ?? [])].filter(older).sort(byAtDesc).slice(0, limit) as DeskReportRow[],
        events: [...(data.events ?? [])].filter((e) => older(e as Record<string, unknown>)).sort(byAtDesc).slice(0, limit) as unknown as DeskEventRow[],
      };
    },

    async mergeIntoDesk(reports: LiveReport[]): Promise<MergeResult> {
      const out: MergeResult = { reportsAdded: 0, eventsAdded: 0, unplaced: [] };
      const data = await readJson<DeskSnapshot>(DATA_FILE);
      if (!data) {
        out.error = "desk snapshot missing or unparseable";
        return out;
      }

      data.reports = Array.isArray(data.reports) ? data.reports : [];
      data.events = Array.isArray(data.events) ? data.events : [];

      const haveFp = new Set(data.events.map((e) => String(e.fp || "")));
      const haveUrl = new Set([
        ...data.reports.map((r) => String(r.url || "")),
        ...data.events.map((e) => String(e.url || "")),
      ]);

      for (const r of reports) {
        if (!r.url || haveUrl.has(r.url) || haveFp.has(r.fp)) continue;
        if (!hasArticlePath(r.url)) continue;

        data.reports.unshift(toDeskReportRow(r));
        haveUrl.add(r.url);
        haveFp.add(r.fp);
        out.reportsAdded += 1;

        const { events, unplaced } = deriveEvents(r);
        for (const e of events) {
          if (haveFp.has(e.fp)) continue;
          data.events.unshift({ ...e });
          haveFp.add(e.fp);
          out.eventsAdded += 1;
        }
        if (unplaced) out.unplaced.push({ fp: r.fp, summary: r.summary, place: r.place });
      }

      if (!out.reportsAdded) return out;

      data.reports.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
      data.updatedAt = jerusalemIso();
      try {
        await writeJsonAtomic(DATA_FILE, data, 2);
      } catch (err) {
        out.error = err instanceof Error ? err.message : "desk snapshot write failed";
        out.reportsAdded = 0;
        out.eventsAdded = 0;
      }
      return out;
    },
  };
}
