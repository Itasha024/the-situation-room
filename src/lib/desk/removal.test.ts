import { test } from "node:test";
import assert from "node:assert/strict";
import { removalVerdict, ratedFromRow, isRemovalWhy } from "./removal.ts";
import { rateSources } from "./source-rating.ts";

const card = { fp: "a", at: "2026-09-20T10:00:00Z", source: "Ali Bk", summary: "Houthi drones hit Yanbu", also: [{ source: "Fars" }] };

test("a false report leaves a verdict with the card; a duplicate leaves none", () => {
  const v = removalVerdict("old-picture", "satellite picture from 24 Sep", card, { at: "2026-10-02T00:00:00Z" });
  assert.equal(v?.verdict, "false");
  assert.match(v!.reason, /earlier damage.*24 Sep/);
  assert.equal(v?.card?.fp, "a");
  assert.equal(removalVerdict("duplicate", "same as b", card), null);
  assert.equal(removalVerdict("out-of-scope", "", card), null);
  assert.equal(removalVerdict("desk-error", "", card), null);
  assert.equal(removalVerdict("denied", "the minister denies it", card)?.verdict, "denied");
  assert.ok(isRemovalWhy("false") && !isRemovalWhy("nonsense"));
});

test("a removed false card still lowers its outlets; a removed duplicate does not", () => {
  const now = Date.parse("2026-10-02T00:00:00Z");
  const cat = [{ name: "Ali Bk", lean: "houthi" as const, url: "" }, { name: "Fars", lean: "houthi" as const, url: "" }];
  const base = rateSources([], cat as never, {}, now).find((r) => r.name === "Ali Bk")!.rating;
  const after = rateSources([], cat as never, { a: removalVerdict("false", "", card)! }, now).find((r) => r.name === "Ali Bk")!.rating;
  assert.ok(after < base, `${after} < ${base}`);
});

test("ratedFromRow reads a desk_report row", () => {
  const r = ratedFromRow({ fp: "x", at: new Date("2026-10-01T00:00:00Z"), source: "SPA", type: "strike", lat: 1, lng: 2, also_reported_by: [{ source: "Reuters" }] });
  assert.deepEqual(r, { fp: "x", at: "2026-10-01T00:00:00.000Z", source: "SPA", type: "strike", lat: 1, lng: 2, also: [{ source: "Reuters" }] });
});
