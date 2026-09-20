/**
 * The Postgres driver, exercised against an embedded Postgres (PGLite).
 *
 * This is the DEPLOYED path — the one that only runs for real once there is a
 * Neon database behind it — so it is worth proving here that the schema applies,
 * the statements are valid, and the semantics the tick depends on actually hold:
 * state survives, and a repeated tick adds nothing a second time.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  await pg.exec(await readFile("migrations/0002_desk.sql", "utf8"));

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

test("a link to a section front is not a report", async () => {
  const store = createPgStore(provider);
  const res = await store.mergeIntoDesk([report({ fp: "live-d", url: "https://example.com/" })]);
  assert.equal(res.reportsAdded, 0);
});
