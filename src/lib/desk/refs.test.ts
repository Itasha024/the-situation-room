import { test } from "node:test";
import assert from "node:assert/strict";
import { headlinePoints, numberRefs, pointList, stripRefs } from "./refs.ts";
import { cleanPoints } from "./prose.ts";
import { fromAnswer, writerInput } from "./iran-brief.ts";

const card = (fp: string, source: string, summary: string) => ({ fp, source, summary, at: "2026-10-09T10:00:00Z", url: `https://x/${fp}`, text: "", type: "statement", live: true }) as never;

test("the writer's ids become the box's own numbers, in order of first use; a made-up id is dropped", () => {
  const refs: Record<string, { fp: string }> = { r1: { fp: "a" }, r2: { fp: "b" }, t1: { fp: "ts-1" } };
  const look = (id: string) => (refs[id] ? { ...refs[id], source: "S", at: "", url: "", headline: "" } : null);
  const got = numberRefs(["Trump said the blockade stays [t1].", "Saudi jets hit Sanaa [r2, r1][r9].", "The IRGC seized a tanker. [r2]"], look);
  assert.deepEqual(got.points, ["Trump said the blockade stays[[1]].", "Saudi jets hit Sanaa[[2]][[3]].", "The IRGC seized a tanker[[2]]."]);
  assert.deepEqual(got.refs.map((r) => r.fp), ["ts-1", "b", "a"]);
  assert.equal(stripRefs(got.points[1]), "Saudi jets hit Sanaa.");
});

test("points come as a list or as numbered lines; a point about absence or the desk goes", () => {
  assert.deepEqual(pointList("1. One thing happened.\n2) Another thing happened."), ["One thing happened.", "Another thing happened."]);
  assert.deepEqual(cleanPoints(["No fighting was reported on the Marib front [r1].", "Houthi forces took ground north of Hays [r2]."], 8), ["Houthi forces took ground north of Hays [r2]."]);
});

test("with no writer, the strongest headlines are the points, each with its own card", () => {
  const got = headlinePoints([card("a", "Saba", "Saudi airstrikes hit Sanaa airport.")]);
  assert.deepEqual(got.points, ["Saudi airstrikes hit Sanaa airport[[1]]."]);
  assert.equal(got.refs[0].source, "Saba");
});

test("the Iran writer gets cards and Trump's statements by id; an arena keeps only points it can reference", () => {
  const { lines, refOf } = writerInput([card("ir-1", "Fars", "IRGC seizes a tanker off Fujairah")], [{ id: "ts-9", at: "2026-10-09T09:00:00Z", text: "The blockade stays.", url: "https://truthsocial.com/x", source: "Truth Social", headline: "Trump: The blockade stays" }]);
  assert.match(lines[0], /^\[r1\] Fars: IRGC seizes/);
  assert.match(lines[1], /^\[t1\] Trump \(Truth Social\): Trump: The blockade stays/);
  const got = fromAnswer({ points: ["Trump said the US blockade of Iran stays in place [t1].", "The IRGC Navy seized a tanker off Fujairah [r1]."], arenas: { hormuz: ["The IRGC Navy seized a tanker off Fujairah [r1]."], talks: ["Talks went on somewhere."] } }, refOf);
  assert.equal(got.situation?.refs[0].trump, true);
  assert.deepEqual(Object.keys(got.arenas), ["hormuz"]);
  assert.equal(got.arenas.hormuz.points[0], "The IRGC Navy seized a tanker off Fujairah[[1]].");
});

test("a point is never cut at a decimal or an abbreviation; an outlet opening it and a glued body go; a repeat goes", async () => {
  const { tidyPoint } = await import("./prose.ts");
  const { oncePer } = await import("./iran-brief.ts");
  assert.deepEqual(cleanPoints(["CENTCOM said US forces helped move about 1.5 million barrels [r3]"], 8), ["CENTCOM said US forces helped move about 1.5 million barrels [r3]."]);
  assert.deepEqual(cleanPoints(["The IDF confirmed Maj. Gen. Cohen was killed [r2]."], 8), ["The IDF confirmed Maj. Gen. Cohen was killed [r2]."]);
  assert.equal(tidyPoint("Press TV reported Araghchi said talks are ongoing [r2]"), "Araghchi said talks are ongoing [r2]");
  assert.equal(tidyPoint("Trump said the blockade stays [t1]"), "Trump said the blockade stays [t1]");
  assert.equal(tidyPoint("Iran's atomic chief said inspections are impossible — Iran's atomic energy chief, Mohammad Eslami, said inspections of the sites cannot happen [r3]"), "Iran's atomic chief said inspections are impossible[r3].");
  assert.equal(oncePer(["US Treasury imposed new sanctions on 17 tankers of Iran's shadow fleet [r3].", "US Treasury sanctioned 17 tankers of Iran's shadow fleet [r4]."]).length, 1);
});
