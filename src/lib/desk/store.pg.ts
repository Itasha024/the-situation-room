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
import { dbMeter, type DeskSlice, type DeskStore, type RecentOpts, type MergeResult } from "./store.ts";
import type { DeskId } from "../desks.ts";
import { DEFAULT_DESK } from "./desk-route.ts";
import { EMPTY_SCAN_STATE, type LiveReport, type ScanPayload, type ScanState } from "./types.ts";

const SCAN_STATE_KEY = "scan_state";
/** Yemen's alone, as every card before the Iran desk: the row carries no `desks`, as before. */
const notYemenAlone = (d: unknown): d is string[] => Array.isArray(d) && d.length > 0 && d.join() !== DEFAULT_DESK;
const PAYLOAD_KEY = "payload";
/** fp → when a card was deleted by hand; a scan running meanwhile cannot bring it back. */
const DROPPED_KEY = "json:dropped";
/** Desks taken off a card by hand ({fp: ["iran"]}): seeing the card again does not put it back (9 Oct). */
const UNDESK_KEY = "json:undesk";

/**
 * The SQL client is injected so the driver can be exercised against an embedded
 * Postgres in tests. `src/lib/db.ts` reaches for `import.meta.glob` to collect
 * migrations, which only exists inside Vite — so a test cannot simply call
 * `getSql()`. Production passes nothing and gets the real client.
 */
export type SqlProvider = () => Promise<Sql>;

/** Drops what Postgres refuses in text/jsonb: NUL and half of a surrogate pair. */
export function pgSafe(s: string): string {
  return s.split(String.fromCharCode(0)).join("").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

/** JSON for a jsonb column: every string passes through `pgSafe`. */
export function pgJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "string" ? pgSafe(v) : v));
}

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

/** A state row held in memory is only kept when smaller than this. */
const MEM_MAX = 2_000_000;
/** Rows per multi-row upsert. */
const PUT_CHUNK = 400;
/** Cards saved side by side in `mergeIntoDesk` (the pool in db.ts holds 10). */
const MERGE_PARALLEL = 10;

export function createPgStore(sqlProvider: SqlProvider = defaultSqlProvider): DeskStore {
  /**
   * The rows this instance last read or wrote, with their version. A warm
   * instance asks only for a row's `updated_at` (a few bytes) and downloads the
   * value again only when someone else changed it: most state rows are written
   * by the tick itself, so the next tick on the same instance reads almost
   * nothing. The JSON text is kept, and parsed afresh on each read, so a caller
   * that mutates what it got cannot change the copy held here.
   */
  const mem = new Map<string, { ver: string; text: string }>();

  const readState = async <T>(key: string): Promise<T | null> => {
    const sql = await sqlProvider();
    dbMeter.queries += 1;
    const held = mem.get(key);
    if (held) {
      const v = await sql<{ ver: string }>`select updated_at::text as ver from desk_state where key = ${key}`;
      dbMeter.read += 40;
      if (!v.length) {
        mem.delete(key);
        return null;
      }
      if (v[0].ver === held.ver) return JSON.parse(held.text) as T;
      dbMeter.queries += 1;
    }
    const rows = await sql<{ v: string; ver: string }>`select value::text as v, updated_at::text as ver from desk_state where key = ${key}`;
    if (!rows.length) return null;
    const { v, ver } = rows[0];
    dbMeter.read += v.length;
    if (v.length < MEM_MAX) mem.set(key, { ver, text: v });
    else mem.delete(key);
    return JSON.parse(v) as T;
  };

  const writeState = async (key: string, value: unknown): Promise<void> => {
    const sql = await sqlProvider();
    const text = pgJson(value);
    dbMeter.queries += 1;
    dbMeter.written += text.length;
    const rows = await sql<{ ver: string }>`
      insert into desk_state (key, value, updated_at)
      values (${key}, ${text}::jsonb, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
      returning updated_at::text as ver
    `;
    // What was written is what a read would return: no need to read it back.
    if (rows.length && text.length < MEM_MAX) mem.set(key, { ver: rows[0].ver, text });
    else mem.delete(key);
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
        // Dropping these made every Telegram read a first sight (no paging back
        // to the last post read) and lost each site's last listing figures.
        ...(s.lastTgPost && typeof s.lastTgPost === "object" ? { lastTgPost: s.lastTgPost } : {}),
        ...(s.lastXPost && typeof s.lastXPost === "object" ? { lastXPost: s.lastXPost } : {}),
        ...(s.sites && typeof s.sites === "object" ? { sites: s.sites } : {}),
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

    async deleteJson(key: string): Promise<void> {
      const sql = await sqlProvider();
      mem.delete(`json:${key}`);
      dbMeter.queries += 1;
      await sql`delete from desk_state where key = ${`json:${key}`}`;
    },

    async getMany<T>(prefix: string, ids: string[]): Promise<Record<string, T>> {
      const out: Record<string, T> = {};
      const want = [...new Set(ids)];
      if (!want.length) return out;
      const sql = await sqlProvider();
      const head = `row:${prefix}:`;
      for (let i = 0; i < want.length; i += PUT_CHUNK) {
        const keys = want.slice(i, i + PUT_CHUNK).map((id) => head + id);
        dbMeter.queries += 1;
        const rows = await sql<{ key: string; v: string }>`
          select key, value::text as v from desk_state where key = any(${keys}::text[])
        `;
        for (const r of rows) {
          dbMeter.read += r.v.length + r.key.length;
          out[r.key.slice(head.length)] = JSON.parse(r.v) as T;
        }
      }
      return out;
    },

    async putMany(prefix: string, entries: Record<string, unknown>): Promise<void> {
      const list = Object.entries(entries);
      if (!list.length) return;
      const sql = await sqlProvider();
      for (let i = 0; i < list.length; i += PUT_CHUNK) {
        const chunk = list.slice(i, i + PUT_CHUNK);
        const keys = chunk.map(([id]) => `row:${prefix}:${id}`);
        const values = chunk.map(([, v]) => pgJson(v));
        dbMeter.queries += 1;
        dbMeter.written += values.reduce((n, v) => n + v.length, 0);
        await sql`
          insert into desk_state (key, value, updated_at)
          select k, v::jsonb, now() from unnest(${keys}::text[], ${values}::text[]) as t(k, v)
          on conflict (key) do update set value = excluded.value, updated_at = now()
        `;
      }
    },

    async takeMany<T>(prefix: string): Promise<T[]> {
      const sql = await sqlProvider();
      dbMeter.queries += 1;
      const rows = await sql<{ v: string }>`
        delete from desk_state where key like ${`row:${prefix}:%`} returning value::text as v
      `;
      return rows.map((r) => {
        dbMeter.read += r.v.length;
        return JSON.parse(r.v) as T;
      });
    },

    async prune(prefix: string, olderThanMs: number): Promise<number> {
      const sql = await sqlProvider();
      const cut = new Date(Date.now() - olderThanMs).toISOString();
      dbMeter.queries += 1;
      const gone = await sql<{ n: number }>`
        with d as (
          delete from desk_state where key like ${`row:${prefix}:%`} and updated_at < ${cut}::timestamptz
          returning 1
        ) select count(*)::int as n from d
      `;
      return gone[0]?.n ?? 0;
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
    async recentDesk(limit = 400, before?: string, opts: RecentOpts = {}): Promise<DeskSlice> {
      const cursor = before && Number.isFinite(Date.parse(before)) ? before : null;
      const since = opts.since && Number.isFinite(Date.parse(opts.since)) ? opts.since : null;
      const desk = opts.desk ?? null;
      const floor = opts.floor && Number.isFinite(Date.parse(opts.floor)) ? opts.floor : null;
      const sql = await sqlProvider();
      const iso = (v: unknown): string =>
        v instanceof Date ? v.toISOString() : typeof v === "string" ? v : "";

      const reports = opts.reports === false ? [] : await sql<Record<string, unknown>>`
        select fp, url, at, source, type, summary, body, priority, confidence,
               score, tier, place, lat, lng, also_reported_by, citing, media, flags, desks,
               -- A reply to a row since deleted leads nowhere: shown as none.
               case when exists (select 1 from desk_report p where p.fp = d.reply_to) then reply_to end as reply_to
          from desk_report d
         where (${cursor}::timestamptz is null or at < ${cursor}::timestamptz)
           and (${floor}::timestamptz is null or at >= ${floor}::timestamptz)
           and (${desk}::text is null or ${desk}::text = any(desks))
         order by at desc
         limit ${limit}
      `;
      // The tick's own look-backs want the cards only: the pins are not read.
      const events = opts.events === false ? [] : await sql<Record<string, unknown>>`
        select fp, at, type, lat, lng, place, label, body, source, url, map_only, desks
          from desk_event
         where (${cursor}::timestamptz is null or at < ${cursor}::timestamptz)
           and (${since}::timestamptz is null or at >= ${since}::timestamptz)
           and (${desk}::text is null or ${desk}::text = any(desks))
         order by at desc
         limit ${limit}
      `;
      dbMeter.queries += 2;
      dbMeter.read += JSON.stringify(reports).length + JSON.stringify(events).length;

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
          if (r.media) row.media = r.media;
          if (Array.isArray(r.flags) && r.flags.length) row.flags = r.flags;
          if (notYemenAlone(r.desks)) row.desks = r.desks;
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
              ...(notYemenAlone(e.desks) ? { desks: e.desks as string[] } : {}),
            }) as DeskEventRow,
        ),
      };
    },

    async timesOf(fps: string[]): Promise<Record<string, string>> {
      if (!fps.length) return {};
      const sql = await sqlProvider();
      const rows = await sql<{ fp: string; at: unknown }>`
        select fp, at from desk_report where fp = any(${fps}::text[])
      `;
      dbMeter.queries += 1;
      dbMeter.read += JSON.stringify(rows).length;
      const out: Record<string, string> = {};
      for (const r of rows) out[r.fp] = r.at instanceof Date ? r.at.toISOString() : String(r.at);
      return out;
    },

    async mergeIntoDesk(reports: LiveReport[]): Promise<MergeResult> {
      const out: MergeResult = { reportsAdded: 0, eventsAdded: 0, unplaced: [] };
      try {
        const sql = await sqlProvider();

        const saveOne = async (r: LiveReport): Promise<void> => {
          // One card that fails to save (a clash on its link) must not stop
          // the cards after it: a tick once lost every older card this way.
          try {
            if (!r.url || !hasArticlePath(r.url)) return;
            const desks = r.desks?.length ? r.desks : [DEFAULT_DESK];

            // `returning fp` tells us whether this row was genuinely new, so the
            // tick reports real numbers rather than assuming every insert landed.
            const inserted = await sql<{ fp: string }>`
              insert into desk_report
                (fp, url, at, source, type, summary, body, priority, confidence, score, tier, place, lat, lng,
                 also_reported_by, reply_to, citing, media, flags, desks)
              select
                ${r.fp}, ${r.url}, ${r.at}::timestamptz, ${r.source}, ${r.type}, ${pgSafe(r.summary)}, ${r.text == null ? null : pgSafe(r.text)},
                ${r.type === "economy" ? 2 : 1}, ${r.confidence ?? 3}, ${r.score ?? null},
                ${r.tier ?? null}, ${r.place ?? null}, ${r.lat ?? null}, ${r.lng ?? null},
                ${r.alsoReportedBy?.length ? pgJson(r.alsoReportedBy) : null}::jsonb,
                ${r.replyTo ?? null}, ${r.citing ?? null},
                ${r.media ? pgJson(r.media) : null}::jsonb, ${r.flags?.length ? pgJson(r.flags) : null}::jsonb,
                ${desks}::text[]
               -- A card deleted by hand stays deleted.
               where not exists (select 1 from desk_state s where s.key = ${DROPPED_KEY} and s.value ? ${r.fp})
              on conflict do nothing
              returning fp
            `;
            if (!inserted.length) {
              // Two desks' readers wrote one post (the Iran desk's cards are "ir-…"):
              // the card stored first stays, and joins the other desk.
              if (r.fp.startsWith("ir-") || r.tags?.includes("iran-url")) {
                const joined = await sql<{ fp: string }>`
                  update desk_report set desks = array(select distinct d from unnest(desks || ${desks}::text[]) d where d = any(desks) or not exists (select 1 from desk_state s where s.key = ${UNDESK_KEY} and coalesce(s.value -> desk_report.fp, '[]'::jsonb) ? d) order by 1)
                   where url = ${r.url} and fp <> ${r.fp} and (${r.fp.startsWith("ir-")} or fp like 'ir-%')
                     and not (desks @> ${desks}::text[])
                  returning fp
                `;
                for (const j of joined) {
                  await sql`
                    update desk_event set desks = array(select distinct d from unnest(desks || ${desks}::text[]) d where d = any(desks) or not exists (select 1 from desk_state s where s.key = ${UNDESK_KEY} and coalesce(s.value -> ${j.fp}::text, '[]'::jsonb) ? d) order by 1)
                     where (fp = ${j.fp} or fp like ${j.fp + "-%"}) and not (desks @> ${desks}::text[])
                  `;
                }
              }
              // Seen again as another desk's too: it joins that desk, and so do its pins.
              if (notYemenAlone(desks)) {
                await sql`
                  update desk_report set desks = array(select distinct d from unnest(desks || ${desks}::text[]) d where d = any(desks) or not exists (select 1 from desk_state s where s.key = ${UNDESK_KEY} and coalesce(s.value -> desk_report.fp, '[]'::jsonb) ? d) order by 1)
                   where fp = ${r.fp} and not (desks @> ${desks}::text[])
                `;
                await sql`
                  update desk_event set desks = array(select distinct d from unnest(desks || ${desks}::text[]) d where d = any(desks) or not exists (select 1 from desk_state s where s.key = ${UNDESK_KEY} and coalesce(s.value -> ${r.fp}::text, '[]'::jsonb) ? d) order by 1)
                   where (fp = ${r.fp} or fp like ${r.fp + "-%"}) and not (desks @> ${desks}::text[])
                `;
              }
              // The original of a relayed report turned up after it was stored:
              // the original replaces the relay as its source and link. Any relay
              // — a website (Almashhad citing Bloomberg) as well as a channel: a
              // stored row still "citing" someone is a relay's card. Its text
              // follows when the original has been read (the "original" rewrite).
              if (!r.citing && r.source) {
                await sql`
                  update desk_report set url = ${r.url}, source = ${r.source}, citing = null, also_reported_by = null
                   where fp = ${r.fp} and url is distinct from ${r.url} and ${r.url} not like 'https://t.me/%'
                     and (citing is not null or url like 'https://t.me/%')
                     and not exists (select 1 from desk_report d where d.url = ${r.url})
                `;
              }
              // The party's own outlet took the card from a paper that had only
              // been relaying it. Same card, same place in the feed; the copy,
              // the link and the byline change hands, and the relay is kept in
              // "Also" rather than dropped — so the swap is visible, not silent.
              if (r.tags?.includes("lead-swap")) {
                await sql`
                  update desk_report set summary = ${pgSafe(r.summary)}, body = ${r.text == null ? null : pgSafe(r.text)},
                         url = case when exists (select 1 from desk_report d where d.url = ${r.url} and d.fp <> ${r.fp}) then url else ${r.url} end,
                         source = case when exists (select 1 from desk_report d where d.url = ${r.url} and d.fp <> ${r.fp}) then source else ${r.source} end,
                         citing = null,
                         also_reported_by = ${r.alsoReportedBy?.length ? pgJson(r.alsoReportedBy) : null}::jsonb
                   where fp = ${r.fp} and source is distinct from ${r.source}
                     -- The lead's own link is another card: no half swap of the headline alone (9 Oct clones).
                     and not exists (select 1 from desk_report d where d.url = ${r.url} and d.fp <> ${r.fp})
                `;
              }
              // The card rewritten from its original's full text replaces the
              // relay's version: headline, body, source and link.
              // The original already has a card of its own: this relay's card is
              // a copy of it, and goes (9 Oct: Saree's "two operations" on five
              // cards, the Bayraktar shoot-down on three, each a relay's card
              // given the original's headline under the relay's own link).
              const holder = r.tags?.includes("original")
                ? await sql<{ fp: string }>`select fp from desk_report where url = ${r.url} and fp <> ${r.fp} limit 1`
                : [];
              if (holder.length) {
                await sql`delete from desk_event where fp = ${r.fp} or fp like ${r.fp + "-%"}`;
                await sql`delete from desk_report where fp = ${r.fp}`;
                await sql`
                  insert into desk_state (key, value, updated_at)
                  values (${DROPPED_KEY}, jsonb_build_object(${r.fp}::text, ${Date.now()}::bigint), now())
                  on conflict (key) do update set value = desk_state.value || excluded.value, updated_at = now()
                `;
              } else if (r.tags?.includes("original")) {
                await sql`
                  update desk_report set summary = ${pgSafe(r.summary)}, body = ${r.text == null ? null : pgSafe(r.text)},
                         -- Another card already holds the original's link: keep this one's.
                         url = case when exists (select 1 from desk_report d where d.url = ${r.url} and d.fp <> ${r.fp}) then url else ${r.url} end,
                         source = case when exists (select 1 from desk_report d where d.url = ${r.url} and d.fp <> ${r.fp}) then source else ${r.source} end,
                         citing = null,
                         -- Written from the original: the outlets that relayed it are no "Also".
                         also_reported_by = null
                   where fp = ${r.fp} and (summary is distinct from ${r.summary} or url is distinct from ${r.url})
                `;
              }
              // A later outlet added a figure or a place, and the card was written
              // again from every account: the new copy replaces the old.
              if (r.tags?.includes("merged") && !r.tags?.includes("original")) {
                await sql`
                  update desk_report set summary = ${pgSafe(r.summary)}, body = ${r.text == null ? null : pgSafe(r.text)}
                   where fp = ${r.fp} and (summary is distinct from ${pgSafe(r.summary)} or body is distinct from ${r.text == null ? null : pgSafe(r.text)})
                `;
              }
              // A picture or a label found after the card was stored (a later
              // account of it carried the video; the original was an exclusive).
              if (r.media || r.flags?.length) {
                await sql`
                  update desk_report set media = coalesce(media, ${r.media ? pgJson(r.media) : null}::jsonb),
                         flags = coalesce(flags, ${r.flags?.length ? pgJson(r.flags) : null}::jsonb)
                   where fp = ${r.fp} and ((media is null and ${!!r.media}) or (flags is null and ${!!r.flags?.length}))
                `;
              }
              // An exclusive leads with no "Also" (user, 8 Oct), whenever it was found to be one.
              if (r.flags?.includes("exclusive")) {
                await sql`update desk_report set also_reported_by = null where fp = ${r.fp} and also_reported_by is not null`;
              }
              // Another outlet's take on this story arrived after it was stored.
              if (r.alsoReportedBy?.length) {
                const also = pgJson(r.alsoReportedBy);
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
              if (r.lat == null || r.lng == null) return;
              const placed = await sql<{ fp: string }>`
                update desk_report set place = ${r.place ?? null}, lat = ${r.lat}, lng = ${r.lng}
                 where fp = ${r.fp} and lat is null
                returning fp
              `;
              if (!placed.length) return;
            } else out.reportsAdded += 1;

            const { events, unplaced } = deriveEvents(r);
            for (const e of events) {
              const ev = await sql<{ fp: string }>`
                insert into desk_event
                  (fp, at, type, lat, lng, place, label, body, source, url, map_only, desks)
                values (
                  ${e.fp}, ${e.at}, ${e.type}, ${e.lat}, ${e.lng}, ${e.place ?? null},
                  ${e.label}, ${e.text ?? null}, ${e.source ?? null}, ${e.url ?? null}, ${e.mapOnly},
                  ${desks}::text[]
                )
                on conflict (fp) do nothing
                returning fp
              `;
              if (ev.length) out.eventsAdded += 1;
            }
            if (unplaced) out.unplaced.push({ fp: r.fp, summary: r.summary, place: r.place });
          } catch (err) {
            out.error ??= `${r.fp}: ${err instanceof Error ? err.message : "desk write failed"}`;
          }
        };
        // Each card is a few round trips; one after another, the ~300 cards a
        // tick carries took over two minutes from a server far from the
        // database. Ten at a time, in the payload's order.
        for (let i = 0; i < reports.length; i += MERGE_PARALLEL) {
          await Promise.all(reports.slice(i, i + MERGE_PARALLEL).map(saveOne));
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
