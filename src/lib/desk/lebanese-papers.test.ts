/**
 * Al-Modon, Nidaa al-Watan and Ad-Diyar (user, 18 Oct): read by the scan, on
 * the Iran desk, and like the other big Arab sites only their own information
 * goes on. Lines are Al-Modon's own of 18 Oct.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { isExclusive, ownInformation, OWN_ONLY } from "./exclusive.ts";
import { relayOf } from "./copy-rules.ts";
import { rivalRelay } from "./speaker-press.ts";
import { SHARED_RSS, iranLeanOf } from "./iran-sources.ts";
import { findCitation } from "./origin.ts";

test("the three Lebanese papers are own-news sites read by both desks' scan", () => {
  for (const s of ["Al-Modon", "Nidaa al-Watan", "Ad-Diyar"]) {
    assert.ok(OWN_ONLY.has(s), s);
    assert.ok(s in SHARED_RSS, s);
  }
  assert.equal(iranLeanOf("Ad-Diyar"), "axis");
  assert.equal(iranLeanOf("Al-Modon"), "gulf");
});

test("their own sources are theirs: 'parliamentary sources told Al-Modon', 'a source to \"Al-Modon\"'", () => {
  const us = "تُفيد مصادر نيابيّة لـالمدن بأنّ السفير الأميركي أبلغ رئيس المجلس أن واشنطن لن تضغط على إسرائيل قبل نزع السلاح";
  assert.equal(isExclusive(us, "Al-Modon"), true);
  assert.equal(ownInformation(us, "Al-Modon"), true);
  assert.equal(isExclusive('مصدر لـ"المدن": فادي صقر قيد الإقامة الجبرية', "Al-Modon"), true);
  assert.equal(isExclusive("قالت مصادر أميركية لـ«نداء الوطن» إن الإدارة تدرس تمديد المهلة", "Nidaa al-Watan"), true);
  assert.equal(isExclusive("علمت «الديار» أن وفداً إيرانياً سيزور بيروت الأسبوع المقبل", "Ad-Diyar"), true);
  // Words said to it in an interview are its own too.
  assert.equal(ownInformation('يقول الخبير البيئي زاهر هاشم في حديث لـ"المدن" إن الخطوة هامة', "Al-Modon"), true);
});

test("the agencies' news they carry is not theirs, and 'the cities' is not Al-Modon", () => {
  const agency = "أعلن الجيش الإسرائيلي في بيان أنه استهدف بنى تحتية لحزب الله في جنوب لبنان، وفق ما نقلت الوكالة الوطنية للإعلام";
  assert.equal(ownInformation(agency, "Al-Modon"), false);
  assert.equal(ownInformation("شنّ الطيران الإسرائيلي غارات على بلدات الجنوب صباح اليوم", "Ad-Diyar"), false);
  assert.equal(isExclusive("ارتفاع الحرارة في المدن الساحلية والداخلية", "Al-Modon"), false);
});

test("the US or Israel through them: a relay, unless the paper's own sources told it (user, 18 Oct)", () => {
  // The US ambassador's words from parliamentary sources that spoke to Al-Modon: its own, kept.
  assert.equal(relayOf({ headline: "US ambassador: Washington will not press Israel before disarmament", source: "Al-Modon", desk: "iran", own: true }), null);
  assert.equal(rivalRelay("US ambassador: Washington will not press Israel before disarmament", "Al-Modon", "gulf", true), null);
  // Israel's army statement retold by Ad-Diyar: Israel is told from its own sources.
  assert.match(String(rivalRelay("Israeli army: we struck Hezbollah infrastructure in south Lebanon", "Ad-Diyar", "axis", false)), /relay/);
});

test("a relay naming them is traced to them", () => {
  assert.equal(findCitation("نقلت صحيفة نداء الوطن عن مصادر أن الحكومة ستجتمع غداً", "Al-Alam")?.name, "Nidaa al-Watan");
  assert.equal(findCitation("نقل موقع «المدن» عن مسؤول أميركي أنه سيزور بيروت", "Al-Alam")?.name, "Al-Modon");
  assert.equal(findCitation("وقالت صحيفة الديار إن اللقاء تأجل", "Al-Alam")?.name, "Ad-Diyar");
  // Bare "the cities" names no paper.
  assert.equal(findCitation("سقطت صواريخ على المدن الشمالية", "Al-Alam")?.name === "Al-Modon", false);
});
