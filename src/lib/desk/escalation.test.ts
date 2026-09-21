import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreWindow, bandOf, escalationView, pushPoint, incidentDeaths } from "./escalation.ts";
import type { LiveReport } from "./types.ts";

let n = 0;
const rep = (type: string, lat: number, lng: number, summary = "Clashes reported", extra: Partial<LiveReport> = {}): LiveReport =>
  ({ fp: `f${n++}`, at: "2026-09-21T10:00:00Z", source: "X", url: `u${n}`, type, summary, text: "", live: true, lat, lng, ...extra } as LiveReport);
const filler = (k: number) => Array.from({ length: k }, () => rep("statement", 15, 44, "A statement"));

test("a wider, heavier window scores higher than a quiet one", () => {
  const quiet = scoreWindow([...filler(12), rep("combat", 13.5, 43.9)], "t");
  const busy = scoreWindow([
    ...filler(12),
    ...[[13.5, 43.9], [15.4, 45.3], [16.2, 44.8], [12.9, 43.5], [14.5, 44.3], [15.9, 43.6]].map(([a, b]) => rep("combat", a, b)),
    ...[[16.9, 43.7], [15.4, 44.2], [16.6, 45.8]].map(([a, b]) => rep("strike", a, b, "Air strikes kill 12 people")),
    rep("strike", 17.5, 44.2, "Drone hits Najran", { place: "Najran" }),
  ], "t");
  assert.ok(busy.score > quiet.score + 30, `${busy.score} vs ${quiet.score}`);
});

test("the same event from many outlets, and its follow-ups, count once", () => {
  const one = scoreWindow([...filler(12), rep("strike", 15.4, 44.2)], "t");
  const many = scoreWindow([...filler(12), rep("strike", 15.41, 44.21), rep("strike", 15.39, 44.19), rep("strike", 15.4, 44.2, "More detail", { replyTo: "f1" })], "t");
  assert.equal(many.score, one.score);
});

test("a truce lowers the score; a rejected one does not", () => {
  const base = [...filler(12), rep("combat", 13.5, 43.9), rep("strike", 15.4, 44.2)];
  const s0 = scoreWindow(base, "t").score;
  assert.ok(scoreWindow([...base, rep("diplomacy", 0, 0, "Houthis and government agree to a ceasefire in Taiz")], "t").score < s0);
  assert.equal(scoreWindow([...base, rep("diplomacy", 0, 0, "Houthis reject ceasefire proposal")], "t").score, s0);
});

test("a thin window is marked sparse, and the view never reads it as calm", () => {
  const thin = scoreWindow([rep("combat", 13.5, 43.9)], "2026-09-20T09:00:00Z");
  assert.equal(thin.sparse, true);
  const full = scoreWindow([...filler(12), rep("combat", 13.5, 43.9)], "2026-09-20T21:00:00Z");
  const v = escalationView(pushPoint(pushPoint([], full), thin));
  assert.equal(v?.now.at, full.at);
  assert.equal(v?.line.find((p) => p.at === thin.at)?.score, null);
});

test("bands, bounds and incident deaths", () => {
  assert.equal(bandOf(0), "Calm");
  assert.equal(bandOf(59), "Elevated");
  assert.equal(bandOf(100), "Severe");
  assert.equal(incidentDeaths("Saudi strike kills 5, 12 people were killed in Saada"), 12);
  assert.equal(incidentDeaths("Nearly 700 people killed since the round began"), 0);
  assert.equal(incidentDeaths("Five soldiers were killed in Najran"), 5);
});
