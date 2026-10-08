/** Which account leads a card, on every desk (user, 8 Oct). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { nearerSource, nearness, subjectNation } from "./speaker-press.ts";

const ajm = { source: "Al Jazeera Mubasher", lean: "gulf" };

test("a report about a country is led by that country's sources, the most official first", () => {
  const h = "Trump says US will not attack Iran before November 3 midterm elections, holds constructive talks";
  assert.equal(subjectNation(h), "us");
  assert.ok(nearerSource(h, { source: "CNN", lean: "us" }, ajm));
  assert.ok(nearerSource(h, { source: "Bloomberg.com" }, ajm));
  assert.ok(nearerSource(h, { source: "Truth Social (Trump)", lean: "us" }, { source: "CNN", lean: "us" }), "his own account over any outlet");
  assert.ok(!nearerSource(h, { source: "VOA Farsi", lean: "us" }, ajm), "the US government's Persian service relays");
  assert.ok(!nearerSource(h, ajm, { source: "CNN", lean: "us" }), "never the other way");
  assert.ok(nearerSource("Araghchi says Iran will answer within days", { source: "Tasnim", lean: "axis" }, { source: "Al Arabiya", lean: "gulf" }));
  assert.ok(nearerSource("Araghchi says Iran will answer within days", { source: "Abbas Araghchi", lean: "axis" }, { source: "Tasnim", lean: "axis" }));
  assert.ok(nearerSource("CENTCOM says it cleared Iranian naval mines from Strait of Hormuz", { source: "CENTCOM", lean: "us" }, { source: "Al Arabiya", lean: "gulf" }));
  assert.ok(nearerSource("UAE bans 472 vessels linked to Iranian regime", { source: "WAM" }, { source: "MEK", lean: "opposition" }));
  assert.ok(nearerSource("Oil prices jump amid record tanker attacks in Hormuz", { source: "Reuters" }, { source: "OSINT Hexagone" }), "no country: a wire over an aggregator");
});

test("the Yemen desk: Yemeni sources stay ahead of wires and Saudi outlets", () => {
  const h = "Houthis say they fired a missile at Eilat";
  const local = { source: "Aden al-Ghad", side: "yemen" };
  assert.ok(!nearerSource(h, { source: "Reuters" }, local));
  assert.ok(!nearerSource(h, { source: "Al Arabiya" }, local));
  assert.ok(nearerSource(h, { source: "Yahya Saree", side: "yemen" }, { source: "Al Mayadeen", lean: "axis" }));
  assert.equal(nearness("Akhbar-e Fori", "iran", "axis"), 11, "an Iranian outlet is Iran's");
  assert.equal(nearness("Al Mayadeen", "iran", "axis"), 1, "Beirut relays Tehran");
});
