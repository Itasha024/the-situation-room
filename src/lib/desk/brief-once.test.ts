import { test } from "node:test";
import assert from "node:assert/strict";
import { citedRefs, freshPoints, markTold, toldBefore } from "./brief.ts";
import { shipHit } from "./all-brief.ts";
import { notNews, palestinianClaim } from "./copy-rules.ts";
import { gazaWords } from "./gaza-words.ts";
import { linkOk } from "./links.ts";
import type { Ref } from "./refs.ts";

// 29 Oct, the user: "don't ever leave a report in briefs for more than one brief".
const ref = (fp: string): Ref => ({ fp, source: "X", at: "2026-10-29T09:00:00Z", url: "", headline: fp });

test("a point whose every report an earlier brief told goes; a point with a new report stays", () => {
  const x = { points: ["Old news[[1]].", "Old and new[[1]][[2]].", "New[[3]]."], refs: [ref("a"), ref("b"), ref("c")] };
  assert.deepEqual(freshPoints(x, new Set(["a"])).points, ["Old and new[[1]][[2]].", "New[[3]]."]);
  assert.deepEqual(citedRefs(["New[[3]]."], x.refs).map((r) => r.fp), ["c"]);
});

test("the record counts earlier briefs only, so the same window written again keeps its points", async () => {
  const mem: Record<string, unknown> = {};
  const store = { getJson: async (k: string) => (mem[k] ?? null) as never, putJson: async (k: string, v: unknown) => void (mem[k] = v) } as never;
  await markTold(store, "iran", ["A[[1]]."], [ref("a")], "2026-10-29T09:00:00.000Z");
  assert.deepEqual([...(await toldBefore(store, "iran", "2026-10-29T09:00:00.000Z"))], []);
  assert.deepEqual([...(await toldBefore(store, "iran", "2026-10-29T12:00:00.000Z"))], ["a"]);
});

test("ship and tanker hits rank near the top; threats do not", () => {
  assert.ok(shipHit("IRGC Navy: Three oil tankers exploded after hitting sea mines in the Strait of Hormuz[[1]]."));
  assert.ok(shipHit("A drone struck an LPG carrier south of Hormuz[[2]]."));
  assert.ok(!shipHit("IRGC: it will strike any tanker that crosses Hormuz under US escort[[3]]."));
  assert.ok(!shipHit("Israeli artillery shelled south Lebanon[[4]]."));
});

test("29 Oct cards the user called not interesting are not news", () => {
  assert.ok(notNews("Israeli forces filled in absorption pit in Qalqilya claimed to be a tunnel"));
  assert.ok(notNews("Israeli citizens' buses and vehicles cross the Jenin-Nablus road via Asfur roundabout under army escort"));
  assert.ok(notNews("Mother of slain Hammam Abu Labda recounts her second son killed by Israeli fire in southern Gaza within a month"));
  assert.ok(notNews("Palestinian media: Ihab Abu Taqiya from Abu Muslama killed"));
  assert.ok(notNews("Doctor in Taiz dedicates his clinic to treating army and resistance personnel for free"));
  assert.ok(notNews("Israeli extremists release sheep around Palestinian homes in Ghraba area northwest of Sinjil, north of Ramallah"));
  assert.ok(notNews("Geneva Centre for Security Governance Director: Yemeni tribal code of honor for civilian protection launched in Geneva"));
});

test("real deaths, attacks and thefts stay", () => {
  assert.equal(notNews("Palestinian media: Two Palestinians killed in drone strike at al-Maghazi camp"), null);
  assert.equal(notNews("Hamas commander Raed Saad killed"), null);
  assert.equal(notNews("Israeli extremists stole 200 sheep from a farmer near Sinjil"), null);
  assert.equal(notNews("Israeli extremists attacked shepherds and their flocks near Sinjil"), null);
  assert.equal(notNews("Houthis launched a drone at a tanker in the Red Sea"), null);
  assert.equal(notNews("Iranian officials: Tehran plans to disrupt US midterms after seeking to interfere in Israel's vote"), null);
});

test("a Palestinian outlet's 'pretext' is told plainly, and the deed as its claim", () => {
  const h = gazaWords("Israel uses 'building without permit in Area C' pretext to demolish homes; 19 houses demolished in Salfit villages");
  assert.equal(h, "Israel demolished homes over building without permit in Area C; 19 houses demolished in Salfit villages");
  assert.match(palestinianClaim(h, "humanitarian", "WAFA"), /^WAFA: /);
  assert.equal(gazaWords("Israeli forces arrested three under the pretext of security"), "Israeli forces arrested three citing security");
});

test("one outlet's two posts on towns far apart are two stories", () => {
  const c = (fp: string, at: string, summary: string, place: string, lat: number, lng: number) => ({ fp, at, summary, place, lat, lng, type: "raid", source: "Jenin News" }) as never;
  const hebron = c("a", "2026-10-29T11:06:00Z", "Palestinian media: Israeli forces demolished monument at al-Sahab junction south of Hebron", "Hebron", 31.53, 35.1);
  const jenin = c("b", "2026-10-29T11:07:00Z", "Palestinian village head: Israeli forces bulldozed farmland west of Jenin", "Jenin", 32.46, 35.3);
  assert.equal(linkOk(jenin, hebron), false);
});
