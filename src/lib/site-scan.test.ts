/**
 * Round 30 stage 4b-2: one scan for the whole site. Each source is read once,
 * and what the Yemen reader gets through its inbox is what it got by hand.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { IRAN_RSS, IRAN_TG, IRAN_X } from "./desk/iran-sources.ts";
import { compareFetches, mergeFetches } from "./site-scan.server.ts";
import { type YemenFetch, sourceCatalogue } from "./yemen-scan.server.ts";

const hit = (url: string, text: string, at = "2026-10-08T18:00:00+03:00") => ({ source: "Al-Masirah", url, text, at, lean: "houthi", fromTg: true });
const fetchOf = (at: number, hits: ReturnType<typeof hit>[], ids: string[] = ["almasirah2"]): YemenFetch => ({
  at,
  hits,
  status: ids.map((id) => ({ id, name: id, kind: "tg" as const, ok: true, cadence: "every 5 min", hits: hits.length })),
  sourcesOk: ids.length,
  learnedIds: [],
  iranShared: [],
});

test("site scan: no source is on both desks' lists, so none is read twice", () => {
  const yemen = new Set(sourceCatalogue().map((e) => e.url.toLowerCase().replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")));
  const iran = [...IRAN_TG.map((s) => `t.me/${s.id}`), ...IRAN_X.map((s) => `x.com/${s.id}`)].map((u) => u.toLowerCase());
  const both = iran.filter((u) => yemen.has(u));
  assert.deepEqual(both, []);
  const feeds = IRAN_RSS.map((f) => f.id);
  assert.equal(new Set(feeds).size, feeds.length);
});

test("site scan: the Yemen reader gets the same items through its inbox", () => {
  const got = fetchOf(1, [hit("https://t.me/almasirah2/1", "Yemeni Armed Forces: a drone hit a ship in the Red Sea"), hit("https://t.me/almasirah2/2", "صنعاء: غارات على الحديدة")]);
  // The store keeps it as JSON: what comes back is the same to the reader.
  const back = JSON.parse(JSON.stringify(got)) as YemenFetch;
  const same = compareFetches(got, back);
  assert.equal(same.sameHits && same.sameCandidates, true);
  assert.equal(same.hits, 2);
  // An item changed on the way would show.
  back.hits[0].text = "Something else";
  const diff = compareFetches(got, back);
  assert.equal(diff.sameHits, false);
  // Nothing back at all: every item is missing.
  assert.equal(compareFetches(got, null).sameHits, false);
});

test("site scan: reads left in the inbox by a failed reader join the next", () => {
  assert.equal(mergeFetches([]), null);
  const older = fetchOf(1, [hit("a", "one"), hit("b", "two")], ["x1"]);
  const newer = fetchOf(2, [hit("b", "two, longer"), hit("c", "three")], ["x2"]);
  const m = mergeFetches([newer, older]) as YemenFetch;
  assert.equal(m.at, 2);
  assert.deepEqual(m.hits.map((h) => h.url).sort(), ["a", "b", "c"]);
  assert.equal(m.hits.find((h) => h.url === "b")?.text, "two, longer");
  assert.deepEqual(m.status.map((s) => s.id).sort(), ["x1", "x2"]);
});

test("every source first read for Yemen has its group on the Iran desk: the sources are the site's (user, 9 Oct)", async () => {
  const { yemenSourceKeys } = await import("./yemen-scan.server.ts");
  const { SHARED_RSS, SHARED_TG, SHARED_X } = await import("./desk/iran-sources.ts");
  const k = yemenSourceKeys();
  const loose = [...k.tg.filter((s) => !(s.id in SHARED_TG)), ...k.x.filter((s) => !(s.id in SHARED_X)), ...k.rss.filter((s) => !(s.id in SHARED_RSS))].map((s) => s.id);
  assert.deepEqual(loose, []);
});

test("the Iran desk's own sources' items on Yemen's war go to the Yemen desk, Israeli media's do not", async () => {
  const { toYemen } = await import("./iran-scan.server.ts");
  const out = toYemen([
    { source: "Tasnim", url: "t1", text: "Ansarullah leader says Yemen will answer any aggression on Sanaa", at: "2026-10-09T10:00:00Z", lean: "axis" },
    { source: "Tasnim", url: "t2", text: "Araghchi meets Omani counterpart in Muscat", at: "2026-10-09T10:00:00Z", lean: "axis" },
    { source: "Kan", url: "k1", text: "Houthi missile launched from Yemen toward Eilat", at: "2026-10-09T10:00:00Z", lean: "israel" },
  ] as never);
  assert.deepEqual(out.map((h) => [h.url, h.lean]), [["t1", "houthi"]]);
});

test("a row of the Iran sources' Yemen items brings its items, never the cycle's time or status", () => {
  const main: YemenFetch = { at: 5, hits: [{ source: "S", url: "a", text: "x", at: "" } as never], status: [{ id: "x1" } as never], sourcesOk: 3, learnedIds: [], iranShared: [] };
  const extra: YemenFetch = { at: 9, hits: [{ source: "Tasnim", url: "t", text: "y", at: "" } as never], status: [], sourcesOk: 0, learnedIds: [], iranShared: [], extra: true };
  const m = mergeFetches([main, extra]) as YemenFetch;
  assert.equal(m.at, 5);
  assert.equal(m.sourcesOk, 3);
  assert.equal(m.extra, undefined);
  assert.deepEqual(m.hits.map((h) => h.url).sort(), ["a", "t"]);
  assert.equal(mergeFetches([extra]), null);
});
