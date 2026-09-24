/**
 * The Postgres driver, exercised against an embedded Postgres (PGLite).
 *
 * This is the DEPLOYED path — the one that only runs for real once there is a
 * Neon database behind it — so it is worth proving here that the schema applies,
 * the statements are valid, and the semantics the tick depends on actually hold:
 * state survives, and a repeated tick adds nothing a second time.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { createPgStore } from "./store.pg.ts";
import type { Sql } from "../db.ts";
import type { LiveReport, ScanPayload } from "./types.ts";

let pg: PGlite;
let sql: Sql;

before(async () => {
  pg = new PGlite({ parsers: { 20: Number, 1082: (v: string) => v } });
  await pg.waitReady;
  // Every migration, in order — not a named one. Pinning this to a single file
  // meant adding `0003` left the test running against a schema the deployed
  // desk no longer has, and the driver failed against it in a way that looked
  // like a logic bug.
  const files = (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.length > 0, "no migrations found to apply");
  for (const f of files) await pg.exec(await readFile(`migrations/${f}`, "utf8"));

  const run = async <T>(text: string, params: unknown[]): Promise<T[]> => {
    const res = await pg.query<T>(text, params);
    return res.rows;
  };
  const tagged = (async <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  tagged.query = <T>(text: string, params: unknown[] = []) => run<T>(text, params);
  sql = tagged;
});

after(async () => {
  await pg?.close();
});

const provider = () => Promise.resolve(sql);

function report(over: Partial<LiveReport> = {}): LiveReport {
  return {
    fp: "live-a",
    at: "2026-09-20T10:00:00+03:00",
    source: "Almashhad",
    url: "https://example.com/news/1",
    type: "combat",
    summary: "Clashes between Houthi forces and Yemeni government forces in Taiz",
    text: "TAIZ — Fighting was reported.",
    live: true,
    confidence: 3.2,
    score: 61,
    tier: "claim",
    place: "Taiz",
    lat: 13.58,
    lng: 44.02,
    ...over,
  };
}

test("scan state survives a round trip, which is what a cold start depends on", async () => {
  const store = createPgStore(provider);

  assert.deepEqual(await store.loadScanState(), { scannedOnce: false, lastScanAt: {} });

  await store.saveScanState({
    scannedOnce: true,
    lastScanAt: { "tg:Alomhoar": 1_700_000_000_000 },
    lastTickAt: 1_700_000_001_000,
  });

  const back = await store.loadScanState();
  assert.equal(back.scannedOnce, true);
  assert.equal(back.lastScanAt["tg:Alomhoar"], 1_700_000_000_000);
  assert.equal(back.lastTickAt, 1_700_000_001_000);

  // Saving again must update in place, not fail on the primary key.
  await store.saveScanState({ scannedOnce: true, lastScanAt: { "web:spa": 5 } });
  assert.deepEqual((await store.loadScanState()).lastScanAt, { "web:spa": 5 });
});

test("an absent payload reads as null rather than throwing", async () => {
  const store = createPgStore(provider);
  assert.equal(await store.loadPayload(), null);

  const payload: ScanPayload = {
    ok: true,
    scannedAt: "2026-09-20T10:00:00+03:00",
    reports: [report()],
    sourcesTried: 38,
    sourcesOk: 35,
  };
  await store.savePayload(payload);
  const back = await store.loadPayload();
  assert.equal(back?.scannedAt, payload.scannedAt);
  assert.equal(back?.reports.length, 1);
});

test("a repeated tick adds nothing the second time", async () => {
  const store = createPgStore(provider);

  const first = await store.mergeIntoDesk([report()]);
  assert.equal(first.error, undefined);
  assert.equal(first.reportsAdded, 1);
  assert.equal(first.eventsAdded, 1, "a placed combat report becomes one pin");
  assert.deepEqual(first.unplaced, []);

  // The clock is deliberately over-eager; running it again must be a no-op.
  const second = await store.mergeIntoDesk([report()]);
  assert.equal(second.reportsAdded, 0);
  assert.equal(second.eventsAdded, 0);
});

test("a report that belongs on the map but has no coordinates is reported, not dropped", async () => {
  const store = createPgStore(provider);

  const res = await store.mergeIntoDesk([
    report({ fp: "live-b", url: "https://example.com/news/2", lat: undefined, lng: undefined, place: undefined }),
  ]);
  assert.equal(res.reportsAdded, 1, "the report itself is still carried");
  assert.equal(res.eventsAdded, 0);
  assert.equal(res.unplaced.length, 1, "the gazetteer miss must be visible");
  assert.equal(res.unplaced[0].fp, "live-b");
});

test("a statement is carried but never pinned", async () => {
  const store = createPgStore(provider);

  const res = await store.mergeIntoDesk([
    report({
      fp: "live-c",
      url: "https://example.com/news/3",
      type: "statement",
      summary: "Spokesman comments on the fighting",
    }),
  ]);
  assert.equal(res.reportsAdded, 1);
  assert.equal(res.eventsAdded, 0, "pinning a speech to a coordinate tells the reader something untrue");
  assert.deepEqual(res.unplaced, [], "and it is not a gazetteer miss either");
});

test("what the tick writes, the feed can read back", async () => {
  // The defect this covers: `mergeIntoDesk` was write-only on the Postgres
  // side. Rows went in, nothing read them out, and the deployed feed could
  // only ever show the last scan cycle while the archive sat unused.
  const store = createPgStore(provider);

  await store.mergeIntoDesk([
    report({
      fp: "live-read-1",
      url: "https://example.com/news/10",
      at: "2026-09-20T08:00:00+03:00",
      summary: "Older report",
    }),
    report({
      fp: "live-read-2",
      url: "https://example.com/news/11",
      at: "2026-09-20T12:00:00+03:00",
      summary: "Newer report",
      alsoReportedBy: [{ source: "Al-Masirah", url: "https://example.com/news/11b" }],
    }),
  ]);

  const slice = await store.recentDesk(50);
  const fps = slice.reports.map((r) => r.fp);
  assert.ok(fps.includes("live-read-1") && fps.includes("live-read-2"), "both reports come back");

  // Newest first is the only order the feed asks for.
  const idxNew = fps.indexOf("live-read-2");
  const idxOld = fps.indexOf("live-read-1");
  assert.ok(idxNew < idxOld, `newest first expected, got ${JSON.stringify(fps)}`);

  const newer = slice.reports.find((r) => r.fp === "live-read-2") as Record<string, unknown>;
  // The shape must match what `toDeskReportRow` produces, or the page cannot
  // tell fs rows and pg rows apart.
  assert.equal(newer.summary, "Newer report");
  assert.equal(newer.text, "TAIZ — Fighting was reported.", "body maps back to `text`");
  assert.equal(typeof newer.at, "string", "timestamps come back as ISO strings, not Dates");
  assert.deepEqual(
    newer.alsoReportedBy,
    [{ source: "Al-Masirah", url: "https://example.com/news/11b" }],
    "story grouping survives storage",
  );

  assert.ok(
    slice.events.some((e) => e.fp === "live-read-2"),
    "the map pins come back too",
  );
});

test("the feed read is bounded, so one request cannot ask for the whole archive", async () => {
  const store = createPgStore(provider);
  const slice = await store.recentDesk(1);
  assert.equal(slice.reports.length, 1);
});

test("the feed pages back: `before` returns only strictly older rows", async () => {
  const store = createPgStore(provider);
  const all = await store.recentDesk(50);
  assert.ok(all.reports.length >= 2, "fixture has at least two rows");
  const newest = String(all.reports[0].at);
  const older = await store.recentDesk(50, newest);
  assert.ok(older.reports.length > 0, "something is older than the newest row");
  assert.ok(
    older.reports.every((r) => Date.parse(String(r.at)) < Date.parse(newest)),
    "no row at or after the cursor",
  );
});

test("a link to a section front is not a report", async () => {
  const store = createPgStore(provider);
  const res = await store.mergeIntoDesk([report({ fp: "live-d", url: "https://example.com/" })]);
  assert.equal(res.reportsAdded, 0);
});

test("a value with NUL or half an emoji is still saved (Postgres refuses both in jsonb)", async () => {
  const store = createPgStore(provider);
  const bad = "Sanaa" + String.fromCharCode(0) + " strike " + String.fromCharCode(0xd83d) + "end";
  await store.putJson("nul-test", { text: bad });
  const back = await store.getJson<{ text: string }>("nul-test");
  assert.equal(back?.text, "Sanaa strike end");
});

test("cache rows: only the ids asked for come back, and a write replaces", async () => {
  const store = createPgStore(provider);
  await store.putMany("lead", { a1: { lead: "one", at: 1 }, b2: { lead: "two", at: 2 } });
  await store.putMany("lead", { b2: { lead: "two again", at: 3 } });
  const got = await store.getMany<{ lead: string }>("lead", ["b2", "zz"]);
  assert.deepEqual(Object.keys(got), ["b2"]);
  assert.equal(got.b2.lead, "two again");
  // Another cache's rows are apart.
  assert.deepEqual(await store.getMany("read", ["a1"]), {});
});

test("cache rows not written for the keep period are pruned; fresh ones stay", async () => {
  const store = createPgStore(provider);
  await store.putMany("prune", { old: 1, fresh: 2 });
  await sql`update desk_state set updated_at = now() - interval '10 days' where key = 'row:prune:old'`;
  assert.equal(await store.prune("prune", 7 * 24 * 3600 * 1000), 1);
  assert.deepEqual(await store.getMany("prune", ["old", "fresh"]), { fresh: 2 });
});

test("an old blob cache moves into rows once and is deleted", async () => {
  const { migrateBlob } = await import("./store.ts");
  const store = createPgStore(provider);
  await store.putJson("blob-test", { "https://x/1": { lead: "L", at: 5 } });
  await migrateBlob(store, "blob-test", "mig", (k) => k.replace(/\W/g, ""));
  assert.equal(await store.getJson("blob-test"), null);
  assert.deepEqual(await store.getMany("mig", ["httpsx1"]), { httpsx1: { lead: "L", at: 5 } });
});

test("a row held in memory is re-read when another instance changes it, and not mutated by callers", async () => {
  const a = createPgStore(provider);
  const b = createPgStore(provider);
  await a.putJson("ver-test", { n: 1 });
  const first = await a.getJson<{ n: number }>("ver-test");
  first!.n = 99; // a caller mutating what it got
  assert.equal((await a.getJson<{ n: number }>("ver-test"))?.n, 1, "the held copy is untouched");
  await b.putJson("ver-test", { n: 2 });
  assert.equal((await a.getJson<{ n: number }>("ver-test"))?.n, 2, "another writer's change is seen");
  await b.deleteJson("ver-test");
  assert.equal(await a.getJson("ver-test"), null, "and so is a delete");
});
