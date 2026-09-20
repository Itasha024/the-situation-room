/**
 * Postgres driver for the desk store — the deployed desk.
 *
 * Schema lives in `migrations/0002_desk.sql` and is applied by `src/lib/db.ts`
 * before the first query, so this file never creates tables itself.
 *
 * Everything here is written to be safe under an over-eager clock: inserts are
 * `on conflict do nothing` and report what they actually inserted, so calling
 * the tick twice in a row adds nothing the second time and says so.
 */

import type { Sql } from "../db.ts";
import { deriveEvents, hasArticlePath } from "./snapshot.ts";
import type { DeskStore, MergeResult } from "./store.ts";
import { EMPTY_SCAN_STATE, type LiveReport, type ScanPayload, type ScanState } from "./types.ts";

const SCAN_STATE_KEY = "scan_state";
const PAYLOAD_KEY = "payload";

/**
 * The SQL client is injected so the driver can be exercised against an embedded
 * Postgres in tests. `src/lib/db.ts` reaches for `import.meta.glob` to collect
 * migrations, which only exists inside Vite — so a test cannot simply call
 * `getSql()`. Production passes nothing and gets the real client.
 */
export type SqlProvider = () => Promise<Sql>;

/**
 * Imported lazily and on first use: `src/lib/db.ts` kicks a PGLite bootstrap at
 * module load, so importing it eagerly would fire that side effect in any test
 * that merely touches this file. Deployed, `DATABASE_URL` is set, so the import
 * lands on the Neon path and the pool is created on the first query.
 */
const defaultSqlProvider: SqlProvider = async () => {
  const { getSql } = await import("../db.ts");
  return getSql();
};

export function createPgStore(sqlProvider: SqlProvider = defaultSqlProvider): DeskStore {
  const readState = async <T>(key: string): Promise<T | null> => {
    const sql = await sqlProvider();
    const rows = await sql<{ value: T }>`select value from desk_state where key = ${key}`;
    return rows.length ? rows[0].value : null;
  };

  const writeState = async (key: string, value: unknown): Promise<void> => {
    const sql = await sqlProvider();
    await sql`
      insert into desk_state (key, value, updated_at)
      values (${key}, ${JSON.stringify(value)}::jsonb, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
  };

  return {
    kind: "pg",

    async loadScanState(): Promise<ScanState> {
      const s = await readState<ScanState>(SCAN_STATE_KEY);
      if (!s || typeof s !== "object") return { ...EMPTY_SCAN_STATE };
      return {
        scannedOnce: !!s.scannedOnce,
        lastScanAt: s.lastScanAt && typeof s.lastScanAt === "object" ? s.lastScanAt : {},
        lastTickAt: typeof s.lastTickAt === "number" ? s.lastTickAt : undefined,
      };
    },

    saveScanState(state: ScanState): Promise<void> {
      return writeState(SCAN_STATE_KEY, state);
    },

    getJson<T>(key: string): Promise<T | null> {
      return readState<T>(`json:${key}`);
    },

    putJson(key: string, value: unknown): Promise<void> {
      return writeState(`json:${key}`, value);
    },

    async loadPayload(): Promise<ScanPayload | null> {
      const p = await readState<ScanPayload>(PAYLOAD_KEY);
      if (!p || !Array.isArray(p.reports) || !p.scannedAt) return null;
      return p;
    },

    savePayload(payload: ScanPayload): Promise<void> {
      return writeState(PAYLOAD_KEY, payload);
    },

    async mergeIntoDesk(reports: LiveReport[]): Promise<MergeResult> {
      const out: MergeResult = { reportsAdded: 0, eventsAdded: 0, unplaced: [] };
      try {
        const sql = await sqlProvider();

        for (const r of reports) {
          if (!r.url || !hasArticlePath(r.url)) continue;

          // `returning fp` tells us whether this row was genuinely new, so the
          // tick reports real numbers rather than assuming every insert landed.
          const inserted = await sql<{ fp: string }>`
            insert into desk_report
              (fp, url, at, source, type, summary, body, priority, confidence, score, tier, place, lat, lng)
            values (
              ${r.fp}, ${r.url}, ${r.at}, ${r.source}, ${r.type}, ${r.summary}, ${r.text},
              ${r.type === "economy" ? 2 : 1}, ${r.confidence ?? 3}, ${r.score ?? null},
              ${r.tier ?? null}, ${r.place ?? null}, ${r.lat ?? null}, ${r.lng ?? null}
            )
            on conflict do nothing
            returning fp
          `;
          if (!inserted.length) continue;
          out.reportsAdded += 1;

          const { events, unplaced } = deriveEvents(r);
          for (const e of events) {
            const ev = await sql<{ fp: string }>`
              insert into desk_event
                (fp, at, type, lat, lng, place, label, body, source, url, map_only)
              values (
                ${e.fp}, ${e.at}, ${e.type}, ${e.lat}, ${e.lng}, ${e.place ?? null},
                ${e.label}, ${e.text ?? null}, ${e.source ?? null}, ${e.url ?? null}, ${e.mapOnly}
              )
              on conflict (fp) do nothing
              returning fp
            `;
            if (ev.length) out.eventsAdded += 1;
          }
          if (unplaced) out.unplaced.push({ fp: r.fp, summary: r.summary, place: r.place });
        }
      } catch (err) {
        out.error = err instanceof Error ? err.message : "desk write failed";
        out.reportsAdded = 0;
        out.eventsAdded = 0;
      }
      return out;
    },
  };
}
