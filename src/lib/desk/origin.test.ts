import { test } from "node:test";
import assert from "node:assert/strict";
import { findCitation, keywords, overlap } from "./origin.ts";

test("a relayed outlet is found, the carrier itself is not", () => {
  assert.equal(findCitation("نيويورك تايمز: ترامب تردد في ضرب اليمن بعد طلب سعودي", "Shajab News")?.name, "NYT");
  assert.equal(findCitation("رويترز عن مصادر: هجوم على ناقلة", "Al Jazeera")?.name, "Reuters");
  assert.equal(findCitation("Reuters reported an attack", "Reuters"), null);
});

test("the Saudi Defense Ministry is traced to SPA", () => {
  assert.equal(findCitation("قالت وزارة الدفاع السعودية إن الدفاعات اعترضت صاروخا", "Al Hadath")?.site, "spa.gov.sa");
});

test("'the Middle East' is not the newspaper", () => {
  assert.equal(findCitation("قال إن الوضع في الشرق الأوسط خطير", "Naya"), null);
});

test("a paraphrase is matched on shared names within the time window", () => {
  const keys = keywords("Trump: hesitated on Yemen strikes before Saudi requests", "en", "NYT");
  const at = Date.parse("2026-09-21T10:00:00Z");
  assert.ok(overlap("Trump Gets Caught in a Dilemma Over a Saudi Plea for Military Help", keys, at - 3600_000, at) >= 2);
  assert.equal(overlap("Trump Gets Caught in a Dilemma Over a Saudi Plea", keys, at - 5 * 86400_000, at), 0);
});
