import { test } from "node:test";
import assert from "node:assert/strict";
import { band, rankPoints, MAX_POINTS } from "./rank-points.ts";

// The Iran desk's points as published on 17 Oct: a remark first, the tanker attacks under it.
const IRAN_17OCT = [
  "Araghchi: Insecurity in Hormuz due to US and Israeli attacks since war began [r1]. We have always committed to diplomacy [r2].",
  "UK Maritime Trade Organisation reports 12 attacks on ships near Strait of Hormuz in past week, highest since March [r3].",
  "UKMTO warns of two tanker attacks northeast of Al Jubayl, Saudi Arabia [r4].",
  "Araghchi met Egyptian Foreign Minister Abdelatty on sidelines of OIC foreign ministers session in Baghdad [r5].",
  "Iranian President Masoud Pezeshkian rejects allegations that Iran is pursuing nuclear weapons, calls claims false [r6].",
  "Iran's acting defense minister: Iranian missiles, not US bombs determine equation [r7].",
  "Qashqavi: Pre-emptive strike by Iranian forces would be good if it prevents war [r8].",
  "Hostile artillery fire targeted outskirts of Zoutar al-Sharqiya [r9].",
];

test("attacks at sea come before a minister's remark, and the list stops at six", () => {
  const out = rankPoints(IRAN_17OCT);
  assert.equal(out.length, MAX_POINTS);
  assert.match(out[0], /12 attacks on ships/);
  assert.match(out[1], /two tanker attacks/);
  assert.match(out[2], /artillery fire/);
  assert.match(out[3], /Araghchi met/);
  assert.ok(!out.some((p) => /Qashqavi/.test(p)), "the last remark falls off");
});

test("a writer that already ranks well keeps its order", () => {
  const yemen = [
    "An oil tanker was struck by an unknown projectile northeast of Al Jubayl off Saudi Arabia's eastern coast [r1].",
    "Houthi missile strikes targeted the Saudi forces command headquarters at Badr camp in Aden [r2].",
    "Saudi Civil Defence: ballistic missiles struck Abha and Khamis Mushait [r3].",
    "Houthi forces tightened their siege of Taiz city by cutting sections of the highway to Aden [r5].",
    "Yemen's president declared a general mobilisation [r7].",
    "In western Taiz, airstrikes struck Houthi military convoys in Jabal Habashi district [r8].",
  ];
  assert.deepEqual(rankPoints(yemen), yemen);
});

test("bands", () => {
  assert.equal(band("Trump: Iran will pay a big price [t1]."), 0);
  assert.equal(band("Houthi missile attack on the presidential palace in Aden killed five [r1]."), 0);
  assert.equal(band("IRGC Navy: it struck two LPG carriers south of Hormuz [r2]."), 0);
  assert.equal(band("US imposed sanctions on two banks for financial services to Iran [r3]."), 1);
  assert.equal(band("Russian Foreign Minister Sergei Lavrov to visit Tehran on 19 October [r4]."), 2);
  assert.equal(band("Shipping costs for oil tankers from Gulf to Asia rose fivefold to $36 per barrel [r5]."), 2);
  assert.equal(band("IRGC and Army spokesmen claim increased defense capabilities and downing of several US drones [r6]."), 3);
  assert.equal(band("Iranian MP Ahmad Bakhshayesh Ardestani: Neither Iran nor the US wants an apocalyptic war [r7]."), 3);
});

test("fewer than six points are all kept", () => {
  assert.equal(rankPoints(IRAN_17OCT.slice(0, 3)).length, 3);
});
