import assert from "node:assert/strict";
import { test } from "node:test";

import { findCandidates, headlineHas, learnPeople, strongTerms, understandLocally } from "./search.ts";

const people = learnPeople([
  "US Secretary of State Marco Rubio discusses regional security with Saudi counterpart",
  "Saudi Foreign Minister Prince Faisal bin Farhan meets UN envoy",
  "Houthi military spokesperson Yahya Saree: forces struck Jazan",
]);
const doc = (fp: string, summary: string) => ({ fp, at: "2026-09-29T10:00:00Z", source: "X", summary, text: "" });

test("who is who is learned from the archive's own words, both ways", () => {
  assert.ok(people.byName.get("rubio")?.has("us secretary of state"));
  assert.ok(people.byTitle.get("saudi foreign minister")?.has("faisal bin farhan"));
  assert.ok(people.byName.get("faisal bin farhan")?.has("prince faisal"));
});

test("'saudi fm and rubio' is two ideas, each with its names and titles, and needs no model", () => {
  const u = understandLocally("saudi fm and rubio", people);
  assert.equal(u.groups.length, 2);
  assert.ok(u.groups[0].includes("saudi foreign minister") && u.groups[0].includes("faisal bin farhan"));
  assert.ok(u.groups[1].includes("us secretary of state"));
  assert.equal(u.known, true);
  const docs = [
    doc("a", "US Secretary of State receives Saudi Foreign Minister in Washington"),
    doc("b", "Prince Faisal and Marco Rubio reaffirm Saudi-US strategic ties"),
    doc("c", "Saudi Foreign Minister meets UN Secretary-General"),
    doc("d", "Rubio: US will fulfil its commitments"),
  ];
  const strong = strongTerms("saudi fm and rubio", u);
  const got = findCandidates(docs, u).filter((x) => headlineHas(x.doc, strong, u)).map((x) => x.doc.fp).sort();
  assert.deepEqual(got, ["a", "b"]);
});

test("a word the desk does not know asks the model; a synonym it knows does not", () => {
  assert.equal(understandLocally("uav").known, true);
  assert.equal(understandLocally("hodeidah port").known, false);
  assert.equal(understandLocally("hodeidah", undefined, new Set(["hodeidah"])).known, true);
});

test("a phrase's loose words are no sure match: 'prisoner swap' is not a strike on a prison", () => {
  const u = understandLocally("prisoner swap");
  const strong = strongTerms("prisoner swap", u);
  assert.equal(headlineHas(doc("x", "Saudi air strike on a prison in Al-Jawf kills 9 prisoners"), strong, u), false);
  assert.equal(headlineHas(doc("y", "Houthis and government agree prisoner exchange"), strong, u), true);
});

test("each idea must be in the headline: 'hodeidah port' is not any Hodeidah report", () => {
  const u = understandLocally("hodeidah port");
  const strong = strongTerms("hodeidah port", u);
  assert.equal(headlineHas(doc("a", "UN verifies 55 civilian casualties in Hodeidah"), strong, u), false);
  assert.equal(headlineHas(doc("b", "Strike hits Hodeidah port cranes"), strong, u), true);
});

test("'uav attacks on saudi oil' means drones hitting Saudi energy sites, by any of their words (1 Oct)", () => {
  const u = understandLocally("uav attacks on saudi oil", people);
  assert.equal(u.known, true);
  assert.equal(u.groups.length, 4);
  const [drone, attack, saudi, oil] = u.groups;
  assert.ok(drone.includes("drone"));
  assert.ok(attack.includes("hit") && attack.includes("targeted"));
  assert.ok(saudi.includes("jazan") && saudi.includes("najran"));
  assert.ok(oil.includes("aramco") && oil.includes("refinery"));
});

test("an outlet's name finds its cards, not headlines with the word; a misspelt word reads as the desk's (1 Oct)", async () => {
  const { learnLexicon, respellWord } = await import("./search.ts");
  const docs = [
    { fp: "r1", at: "2026-09-29T10:00:00Z", source: "Reuters", summary: "Saudi exports through Yanbu fall", text: "" },
    { fp: "r2", at: "2026-09-29T11:00:00Z", source: "Almashhad", summary: "Houthi drone hits Medina power station", text: "", also: "Reuters" },
    { fp: "r3", at: "2026-09-29T12:00:00Z", source: "Al-Jazeera", summary: "Reuters team visits Taiz camp", text: "" },
    { fp: "r4", at: "2026-09-29T13:00:00Z", source: "Al-Masirah", summary: "Strikes on Hodeidah port", text: "" },
  ];
  const lex = learnLexicon(docs, ["Reuters", "Almashhad", "Al-Jazeera", "Al-Masirah"]);
  for (const q of ["reuters", "reuter"]) {
    const u = understandLocally(q, undefined, undefined, lex);
    assert.deepEqual(u.sources, ["reuters"]);
    assert.equal(u.known, true);
    const got = findCandidates(docs, u).filter((x) => headlineHas(x.doc, strongTerms(q, u), u)).map((x) => x.doc.fp).sort();
    assert.deepEqual(got, ["r1", "r2", "r3"], q);
  }
  assert.deepEqual(understandLocally("masirah hodeidah", undefined, new Set(["hodeidah"]), lex).sources, ["al masirah"]);
  assert.deepEqual(understandLocally("al jazera", undefined, undefined, lex).sources, ["al jazeera"]);
  assert.deepEqual(respellWord("midina", lex), ["medina"]);
  assert.deepEqual(respellWord("hoddeidah", lex), ["hodeidah"]);
  assert.deepEqual(respellWord("medina", lex), []);
  const u = understandLocally("midina", undefined, undefined, lex);
  assert.equal(u.about, "medina");
  assert.ok(u.groups[0].includes("medina"));
});
