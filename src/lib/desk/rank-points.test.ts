import { test } from "node:test";
import assert from "node:assert/strict";
import { band, dropEmpty, emptyPoint, rankPoints, MAX_POINTS } from "./rank-points.ts";

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

test("attacks at sea come before a minister's remark, and the list stops at its cap", () => {
  // A cap of six here (the desks' cap is 8 since 21 Oct): the last remark is the one to go.
  const out = rankPoints(IRAN_17OCT, 6);
  assert.equal(out.length, 6);
  assert.ok(rankPoints(IRAN_17OCT).length <= MAX_POINTS);
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

test("points with no new fact go to band 4 and are dropped when stronger points exist (18 Oct)", () => {
  const condemn = "Condemned navigation disruptions in the Strait of Hormuz and Bab al-Mandab[[2]].";
  const dar = "Dar: discussed regional issues during a phone call with Iranian Foreign Minister Araghchi[[3]].";
  assert.equal(band(condemn), 4);
  assert.equal(band(dar), 4);
  assert.equal(band("IRGC commander congratulated the new defence minister [r1]."), 4);
  assert.equal(band("Bahraini foreign minister condemns Houthi attacks on civilian objects in Saudi Arabia [r2]."), 4);
  assert.ok(emptyPoint("Iran's executive vice president: despite US and Israeli threats, Iran will remain united and steadfast [r3]."));
  // A condemnation with a toll or a decision in it is news.
  assert.equal(emptyPoint("Bahrain condemned the strike on Riyadh airport that killed two [r4]."), false);
  assert.equal(emptyPoint("Pakistan condemned the attack and announced it would send troops [r5]."), false);
  const talks = [
    "Iran urged the US to accept a proposal to reopen the Strait of Hormuz[[1]].",
    "Russian Foreign Minister Lavrov arrived in Bahrain to ease Gulf tensions, with a planned visit to Tehran next[[2]].",
    dar,
  ];
  assert.deepEqual(dropEmpty(talks), talks.slice(0, 2));
  assert.equal(rankPoints([condemn, ...talks]).length, 2);
  // A list of only such points is kept: the arena is not left empty.
  assert.deepEqual(dropEmpty([condemn, dar]), [condemn, dar]);
});
