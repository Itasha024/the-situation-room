import { test } from "node:test";
import assert from "node:assert/strict";
import { headlinePoints, numberRefs, pointList, type Ref, stripRefs } from "./refs.ts";
import { cleanPoints } from "./prose.ts";
import { fromAnswer, writerInput } from "./iran-brief.ts";

const card = (fp: string, source: string, summary: string) => ({ fp, source, summary, at: "2026-10-09T10:00:00Z", url: `https://x/${fp}`, text: "", type: "statement", live: true }) as never;

test("the writer's ids become the box's own numbers, in order of first use; a made-up id is dropped", () => {
  const refs: Record<string, { fp: string }> = { r1: { fp: "a" }, r2: { fp: "b" }, t1: { fp: "ts-1" } };
  const look = (id: string) => (refs[id] ? { ...refs[id], source: "S", at: "", url: "", headline: "" } : null);
  const got = numberRefs(["Trump said the blockade stays [t1].", "Saudi jets hit Sanaa [r2, r1][r9].", "The IRGC seized a tanker. [r2]"], look);
  assert.deepEqual(got.points, ["Trump said the blockade stays[[1]].", "Saudi jets hit Sanaa[[2]].", "The IRGC seized a tanker[[2]]."]);
  assert.deepEqual(got.refs.map((r) => r.fp), ["ts-1", "b"]);
  assert.equal(stripRefs(got.points[1]), "Saudi jets hit Sanaa.");
  assert.equal(numberRefs(["Flights were disrupted, [r1]."], look).points[0], "Flights were disrupted[[1]].");
  assert.equal(stripRefs("Flights were disrupted,[[4]]."), "Flights were disrupted.");
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

test("several reports of one fact: one number, the speaker's own account or the country's own source first", () => {
  const refs: Record<string, Ref> = {
    r1: { fp: "bl", source: "Bloomberg", at: "", url: "", headline: "Trump says US will not attack Iran before the midterms" },
    r2: { fp: "hd", source: "Al Hadath", at: "", url: "", headline: "Trump: No US attack on Iran before midterms" },
    t1: { fp: "ts", source: "Truth Social", at: "", url: "", headline: "Trump: I will not attack Iran before the midterms", trump: true },
    r3: { fp: "rt", source: "Reuters", at: "", url: "", headline: "US Treasury sanctions 17 tankers" },
    r4: { fp: "tr", source: "US Treasury", at: "", url: "", headline: "Treasury sanctions 17 vessels of Iran's shadow fleet" },
    r5: { fp: "od", source: "OSINTdefender", at: "", url: "", headline: "UKMTO: tanker struck" },
    r6: { fp: "uk", source: "UKMTO", at: "", url: "", headline: "UKMTO: a tanker was struck by a projectile" },
  };
  const got = numberRefs(["Trump said the US will not attack Iran before the midterms [r1][r2][t1].", "The US Treasury sanctioned 17 tankers [r3, r4].", "A tanker was struck, UKMTO said [r5][r6]."], (id) => refs[id]);
  assert.deepEqual(got.refs.map((r) => r.fp), ["ts", "tr", "uk"]);
  assert.equal(got.points[0], "Trump said the US will not attack Iran before the midterms[[1]].");
});

test("arenas: the Yemen desk's war goes nowhere, US in the region is the US's doing, Israel's arena cites Israel's own sources", async () => {
  const { fits, israelRef } = await import("./iran-brief.ts");
  assert.equal(fits("us", "Turkey, Pakistan and Saudi Arabia pledged deployments to help Riyadh against Houthi attacks."), false);
  assert.equal(fits("us", "UAE and British naval commanders met on a Gulf coalition."), false);
  assert.equal(fits("us", "The Pentagon sent a third carrier to the Gulf."), true);
  assert.equal(fits("sanctions", "A US military source said US forces are focused on a complete blockade of Iranian ships and ports."), false);
  assert.equal(fits("sanctions", "The US Treasury sanctioned 17 vessels of Iran's shadow fleet."), true);
  assert.equal(fits("nuclear", "Trump said Iran will never have a nuclear weapon."), true);
  assert.equal(fits("axis", "The US Mission to the UAE warned of Iranian-supported Houthi attacks."), true);
  const r = (source: string, lean?: string) => ({ fp: "x", source, at: "", url: "", headline: "h", ...(lean ? { lean } : {}) });
  assert.equal(israelRef(r("Tasnim", "axis")), undefined);
  assert.equal(israelRef(r("Al-Alam", "axis")), undefined);
  assert.ok(israelRef(r("Unews", "axis")));
  assert.ok(israelRef(r("N12", "israel")));
  assert.ok(israelRef(r("IDF")));
  assert.ok(israelRef(r("Reuters")));
  assert.ok(israelRef({ ...r("Tasnim", "axis"), excl: true }));
});

test("America's and Israel's words are never cited from Iran's outlets; a strike on Iran's own ground may be", async () => {
  const { ownRef } = await import("./iran-brief.ts");
  const r = (source: string, lean?: string) => ({ fp: "x", source, at: "", url: "", headline: "h", ...(lean ? { lean } : {}) });
  assert.equal(ownRef("US Representative Ro Khanna called on Congress to vote to end the war [r2].", r("Al-Alam", "axis")), undefined);
  assert.equal(ownRef("A US Navy official said 12 ships enforce the blockade on Iran [r1].", r("Tasnim", "axis")), undefined);
  assert.ok(ownRef("Israeli jets struck a missile site near Isfahan [r1].", r("Tasnim", "axis")));
  assert.ok(ownRef("US Representative Ro Khanna called on Congress to vote [r2].", r("Reuters")));
  assert.ok(ownRef("Iranian drones struck opposition sites in Erbil [r1].", r("Press TV", "axis")));
});

test("one point per event and per speaker; no outlet opens a point; a speaker gets the colon (user, 9 Oct)", async () => {
  const { onePointEach } = await import("./prose.ts");
  const got = onePointEach([
    "IRGC Navy says LPG carriers NV Sunshine and Golpeyker were hit and caught fire south of Hormuz, blames US forces [r1].",
    "IRGC Navy: targeting caused a widespread fire in the engine room of NV Sunshine [r2].",
    "IRGC: responsibility for these incidents lies with US forces [r3].",
    "Bessent: the US blockade of Iran aims to halt all Iranian oil exports [r4].",
    "Bessent: the US runs an absolute isolation campaign against Iran [r5].",
    "Vahid Online: gunmen killed a police chief in Faryab, Kerman province [r6].",
  ], ["Vahid Online"]);
  assert.equal(got.length, 3);
  assert.match(got[0], /^IRGC Navy: LPG carriers/);
  assert.match(got[1], /^Bessent: the US blockade .*\[r4\]\. The US runs .*\[r5\]\.$/);
  assert.equal(got[2], "Gunmen killed a police chief in Faryab, Kerman province [r6].");
});

test("a statement's speaker gets the colon; first-person words with no speaker are refused (9 Oct)", async () => {
  const { colonAfterLead, fixHeadline } = await import("./reader.ts");
  assert.equal(colonAfterLead("IRGC Navy continued US interventions will lead to more incidents", "IRGC Navy"), "IRGC Navy: continued US interventions will lead to more incidents");
  assert.equal(colonAfterLead("IRGC Navy seized a tanker that will be taken to Bandar Abbas", "IRGC Navy"), "IRGC Navy seized a tanker that will be taken to Bandar Abbas");
  assert.equal(colonAfterLead("Hezbollah fighters will not disarm", "Hezbollah"), "Hezbollah fighters will not disarm");
  assert.equal(fixHeadline("IRGC Navy: continued US interventions will lead to more incidents"), "IRGC Navy: continued US interventions will lead to more incidents");
  assert.equal(fixHeadline("Trump: held a call with Putin"), "Trump held a call with Putin");
});
