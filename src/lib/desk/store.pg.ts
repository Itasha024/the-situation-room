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
import type { DeskEventRow, DeskReportRow } from "./snapshot.ts";
import { deriveEvents, hasArticlePath } from "./snapshot.ts";
import type { DeskSlice, DeskStore, MergeResult } from "./store.ts";
import { EMPTY_SCAN_STATE, type LiveReport, type ScanPayload, type ScanState } from "./types.ts";

const SCAN_STATE_KEY = "scan_state";
const PAYLOAD_KEY = "payload";
/** fp → when a card was deleted by hand; a scan running meanwhile cannot bring it back. */
const DROPPED_KEY = "json:dropped";

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
      const dropped = (await readState<Record<string, number>>(DROPPED_KEY)) ?? {};
      p.reports = p.reports.filter((r) => !(r.fp in dropped));
      return p;
    },

    async savePayload(payload: ScanPayload): Promise<void> {
      const dropped = (await readState<Record<string, number>>(DROPPED_KEY)) ?? {};
      return writeState(PAYLOAD_KEY, { ...payload, reports: payload.reports.filter((r) => !(r.fp in dropped)) });
    },

    /**
     * The read that was missing. Without it every row written below was stored
     * and never shown: deployed, the page had only the build-time snapshot and
     * the last cycle's payload, so the feed silently reset to one cycle's worth
     * on every scan.
     *
     * `at` comes back as a Date from `pg`, so it is normalised to ISO here —
     * the page compares timestamps as strings.
     */
    async recentDesk(limit = 400, before?: string): Promise<DeskSlice> {
      const cursor = before && Number.isFinite(Date.parse(before)) ? before : null;
      const sql = await sqlProvider();
      const iso = (v: unknown): string =>
        v instanceof Date ? v.toISOString() : typeof v === "string" ? v : "";

      const reports = await sql<Record<string, unknown>>`
        select fp, url, at, source, type, summary, body, priority, confidence,
               score, tier, place, lat, lng, also_reported_by, citing,
               -- A reply to a row since deleted leads nowhere: shown as none.
               case when exists (select 1 from desk_report p where p.fp = d.reply_to) then reply_to end as reply_to
          from desk_report d
         where (${cursor}::timestamptz is null or at < ${cursor}::timestamptz)
         order by at desc
         limit ${limit}
      `;
      const events = await sql<Record<string, unknown>>`
        select fp, at, type, lat, lng, place, label, body, source, url, map_only
          from desk_event
         where (${cursor}::timestamptz is null or at < ${cursor}::timestamptz)
         order by at desc
         limit ${limit}
      `;

      return {
        updatedAt: reports.length ? iso(reports[0].at) : null,
        // Back to the shape `toDeskReportRow` produces, so the page cannot tell
        // which driver served it.
        reports: reports.map((r) => {
          const row: Record<string, unknown> = {
            fp: r.fp,
            priority: r.priority,
            at: iso(r.at),
            source: r.source,
            url: r.url,
            type: r.type,
            summary: r.summary,
            text: r.body,
            live: true,
            confidence: r.confidence,
            score: r.score,
            tier: r.tier,
          };
          if (r.place != null) row.place = r.place;
          if (r.lat != null) {
            row.lat = r.lat;
            row.lng = r.lng;
          }
          if (r.also_reported_by) row.alsoReportedBy = r.also_reported_by;
          if (r.reply_to) row.replyTo = r.reply_to;
          if (r.citing) row.citing = r.citing;
          return row as DeskReportRow;
        }),
        events: events.map(
          (e) =>
            ({
              fp: e.fp,
              at: iso(e.at),
              type: e.type,
              lat: e.lat,
              lng: e.lng,
              place: e.place ?? undefined,
              label: e.label,
              text: e.body ?? undefined,
              source: e.source ?? undefined,
              url: e.url ?? undefined,
              mapOnly: !!e.map_only,
            }) as DeskEventRow,
        ),
      };
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
              (fp, url, at, source, type, summary, body, priority, confidence, score, tier, place, lat, lng,
               also_reported_by, reply_to, citing)
            select
              ${r.fp}, ${r.url}, ${r.at}::timestamptz, ${r.source}, ${r.type}, ${r.summary}, ${r.text},
              ${r.type === "economy" ? 2 : 1}, ${r.confidence ?? 3}, ${r.score ?? null},
              ${r.tier ?? null}, ${r.place ?? null}, ${r.lat ?? null}, ${r.lng ?? null},
              ${r.alsoReportedBy?.length ? JSON.stringify(r.alsoReportedBy) : null}::jsonb,
              ${r.replyTo ?? null}, ${r.citing ?? null}
             -- A card deleted by hand stays deleted.
             where not exists (select 1 from desk_state s where s.key = ${DROPPED_KEY} and s.value ? ${r.fp})
            on conflict do nothing
            returning fp
          `;
          if (!inserted.length) {
            // The original of a relayed report turned up after it was stored:
            // the original replaces the relay as its source and link.
            if (!r.citing && r.source) {
              await sql`
                update desk_report set url = ${r.url}, source = ${r.source}, citing = null, also_reported_by = null
                 where fp = ${r.fp} and url like 'https://t.me/%' and ${r.url} not like 'https://t.me/%'
                   and not exists (select 1 from desk_report d where d.url = ${r.url})
              `;
            }
            // The card rewritten from its original's full text replaces the
            // relay's version: headline, body, source and link.
            if (r.tags?.includes("original")) {
              await sql`
                update desk_report set summary = ${r.summary}, body = ${r.text}, url = ${r.url}, source = ${r.source}, citing = null,
                       -- Written from the original: the outlets that relayed it are no "Also".
                       also_reported_by = null
                 where fp = ${r.fp} and (summary is distinct from ${r.summary} or url is distinct from ${r.url})
              `;
            }
            // Another outlet's take on this story arrived after it was stored.
            if (r.alsoReportedBy?.length) {
              const also = JSON.stringify(r.alsoReportedBy);
              await sql`
                update desk_report set also_reported_by = ${also}::jsonb, confidence = coalesce(${r.confidence ?? null}, confidence)
                 where fp = ${r.fp} and also_reported_by is distinct from ${also}::jsonb
              `;
            }
            // A speech line re-threaded: a late line took its place in time.
            // Only ever to an older row that exists.
            if (r.replyTo) {
              await sql`
                update desk_report set reply_to = ${r.replyTo}
                 where fp = ${r.fp} and reply_to is distinct from ${r.replyTo}
                   and exists (select 1 from desk_report p where p.fp = ${r.replyTo} and p.at < ${r.at}::timestamptz)
              `;
            }
            // Stored earlier without a place (the geocoder had not found it
            // yet): take the place now, and let its pin be added below.
            if (r.lat == null || r.lng == null) continue;
            const placed = await sql<{ fp: string }>`
              update desk_report set place = ${r.place ?? null}, lat = ${r.lat}, lng = ${r.lng}
               where fp = ${r.fp} and lat is null
              returning fp
            `;
            if (!placed.length) continue;
          } else out.reportsAdded += 1;

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
