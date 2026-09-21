/**
 * The code's checks on the reader, and the trust figure.
 *
 * The model decides what an item says; these decide whether that decision may
 * be published. No network: every case is a hand-written model answer.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { credibility } from "./credibility.ts";
import { type Candidate, toReport } from "./editor.ts";
import { type Reading, checkReading, nextPacificMidnight, pacificDay, repairable } from "./reader.ts";

function reading(over: Partial<Reading>): Reading {
  return {
    id: "0",
    publish: true,
    reject_reason: "",
    event_type: "air_strike",
    confident_roles: true,
    actor: null,
    targets: [],
    origins: [],
    speaker_lead: null,
    interest: "neutral",
    has_time: false,
    headline: "Air strikes hit Houthi positions in Marib",
    body: "Air strikes hit Houthi positions in Marib.",
    ...over,
  };
}

const SAREE =
  'العميد يحيى سريع: شن الطيران الحربي السعودي خلال الـ24 ساعة الماضية 28 غارة جوية من خلال طائرات "F15" و "تايفون" أقلعت من قاعدتي خميس مشيط والطائف استهدفت محافظات تعز والجوف ومأرب ليبلغ إجمالي الغارات 760 غارة جوية.';

function cand(text: string, source = "Shajab News", lean = "houthi"): Candidate {
  return { source, url: "https://t.me/x/1", text, at: "2026-09-21T10:00:00+03:00", lean, fp: "live-x", score: 50, tags: [] };
}

test("a figure the source does not contain blocks publication", () => {
  const r = reading({ headline: "Saree: Saudi jets carried out 30 strikes", body: "Saudi jets carried out 30 strikes." });
  assert.match(String(checkReading(r, SAREE)), /figure not in source: 30/);
  const ok = reading({ headline: "Saree: Saudi jets carried out 28 strikes", body: "The total reached 760.", event_type: "statement", speaker_lead: "Saree" });
  assert.equal(checkReading(ok, SAREE), null);
});

test("filler, sourcing labels and partisan words never publish", () => {
  for (const body of [
    "Clashes were reported. No casualties were reported.",
    "Clashes were reported. Neither side gave casualty figures.",
    "Clashes were reported. The report could not be independently verified.",
    "Clashes were reported. Al-Masirah carried the report.",
    "The enemy shelled villages.",
  ]) {
    assert.ok(checkReading(reading({ body }), "اشتباكات"), body);
  }
});

test("a statement must lead with its speaker", () => {
  const src = "دولة قطر تعلن إدانتها استهداف جماعة الحوثي لمدينة الرياض";
  const r = reading({ event_type: "diplomacy", speaker_lead: "Qatar", headline: "Qatar condemns Houthi missile attack on Riyadh", body: "Qatar condemned the attack." });
  assert.equal(checkReading(r, src), null);
  const buried = reading({ event_type: "statement", speaker_lead: "Qatar", headline: "Houthi attack on Riyadh condemned by Qatar", body: "Qatar condemned the attack." });
  assert.match(String(checkReading(buried, src)), /lead with its speaker/);
  // A colon-led headline names its speaker even when the field came back empty.
  const colon = reading({ event_type: "statement", speaker_lead: "", headline: "Al-Mashat: Saudi claims about Mecca are false", body: "Al-Mashat rejected the claims." });
  assert.equal(checkReading(colon, "المشاط مكة"), null);
});

test("launch bases are never pinned: pins come from targets found in the source", () => {
  const r = reading({ targets: ["تعز", "الجوف", "مأرب"], origins: ["خميس مشيط", "الطائف"] });
  const row = toReport(r, cand(SAREE));
  assert.ok(row.place && ["Taiz", "Al-Jawf", "Marib"].includes(row.place), `pinned ${row.place}`);
  // A target the text does not contain never reaches the map.
  const invented = toReport(reading({ targets: ["صنعاء"] }), cand(SAREE));
  assert.equal(invented.place, undefined);
  // Unclear roles: no place at all.
  const unclear = toReport(reading({ targets: ["تعز"], confident_roles: false }), cand(SAREE));
  assert.equal(unclear.place, undefined);
});

test("a statement carries no pin and no dateline", () => {
  const row = toReport(
    reading({ event_type: "statement", speaker_lead: "Al-Mashat", targets: ["مكة"], headline: "Al-Mashat: Saudi claims about Mecca are false", body: "Al-Mashat rejected Saudi claims." }),
    cand("المشاط: نستهجن الافتراء باستهداف مكة المكرمة"),
  );
  assert.equal(row.place, undefined);
  assert.doesNotMatch(row.text, /^[A-Z' -]+ —/);
});

test("the trust figure weighs who reported it, against whose interest, and who confirmed it", () => {
  const base = { statement: false, hasPlace: true, hasFigure: false, hasTime: false, corroboratedBy: [] as never[] };
  const selfClaim = credibility({ ...base, side: "houthi", interest: "for" });
  const admission = credibility({ ...base, side: "houthi", interest: "against" });
  const wire = credibility({ ...base, side: "agency", interest: "neutral" });
  const confirmed = credibility({ ...base, side: "houthi", interest: "for", corroboratedBy: ["gov"] });
  const echoed = credibility({ ...base, side: "houthi", interest: "for", corroboratedBy: ["houthi", "houthi"] });
  assert.ok(selfClaim < admission, "an admission outweighs a self-serving claim");
  assert.ok(selfClaim < wire, "a wire agency outweighs a party channel");
  assert.ok(confirmed > selfClaim + 0.5, "the other side confirming is strong evidence");
  assert.equal(echoed, selfClaim, "the same side repeating a claim adds nothing");
  for (const v of [selfClaim, admission, wire, confirmed]) assert.ok(v >= 1 && v <= 5);
});

test("a strike on a named Yemeni place gets a second look; rhetoric does not", async () => {
  const { fieldReport } = await import("./editor.ts");
  assert.ok(fieldReport("عاجل ـ السعودية تقصف مديرية حيفان بمحافظة تعز بسلسلة غارات جوية"));
  assert.ok(!fieldReport("السيد القائد: شعبنا تفانى وبذل التضحيات للدفاع عن أرضه وكرامته"));
});

test("no outlet opens a headline, and a report about someone is no quote", async () => {
  const { fixHeadline } = await import("./reader.ts");
  assert.equal(fixHeadline("Reuters sources: Reuters: Yemeni president asked US for support against Houthis"), "Yemeni president asked US for support against Houthis");
  assert.equal(fixHeadline("Trump: did not commit to military aid requested by Rashad al-Alimi"), "Trump did not commit to military aid requested by Yemen's president");
  assert.equal(fixHeadline("Trump: hesitated on Yemen strikes before Saudi requests"), "Trump hesitated on Yemen strikes before Saudi requests");
  assert.equal(fixHeadline("Trump: spoke with Yemeni Presidential Leadership Council head Rashad al-Alimi"), "Trump spoke with Yemen's president");
  // Reported on, not quoted: the colon goes. Unfamiliar names go by role.
  assert.equal(fixHeadline("Al-Alimi: Trump made no pledge of military support to Yemen's president al-Alimi in a call, sources say"), "Trump made no pledge of military support to Yemen's president in a call, sources say");
  assert.equal(fixHeadline("Al-Zubaidi: the south will not accept Houthi rule"), "STC leader: the south will not accept Houthi rule");
  assert.equal(fixHeadline("Mufie Damaj: Yemeni culture minister: Sanaa is the primary target"), "Yemen's culture minister: Sanaa is the primary target");
  // "said that our" is his words without the quote: the colon form.
  assert.equal(fixHeadline("Houthi leader said that our demands are legitimate rights"), "Houthi leader: our demands are legitimate rights");
  assert.equal(fixHeadline("Houthi leader says the Houthis' demands are legitimate"), "Houthi leader says the Houthis' demands are legitimate");
  // Real quotes keep their colon.
  assert.equal(fixHeadline("Houthi leader: Saudi Arabia will pay a price"), "Houthi leader: Saudi Arabia will pay a price");
  assert.equal(fixHeadline("Abdul Malik al-Houthi: Saudi regime committed crimes"), "Houthi leader: Saudi regime committed crimes");
  assert.equal(fixHeadline("Trump: we will not let the Houthis win"), "Trump: we will not let the Houthis win");
});

test("the side decides Houthi or Yemeni government wording", async () => {
  const { sideWords } = await import("./editor.ts");
  assert.equal(sideWords("Six Saudi soldiers killed in Yemeni attack", undefined), "Six Saudi soldiers killed in Houthi attack");
  assert.equal(sideWords("Yemeni armed forces target Saudi ship", "houthi"), "Houthi forces target Saudi ship");
  assert.equal(sideWords("Saree: Yemeni armed forces executed operations against Riyadh and Yanbu", undefined), "Saree: Houthi forces executed operations against Riyadh and Yanbu");
  assert.equal(sideWords("Yemeni foreign ministry: ready to cooperate to face Israeli danger", "houthi"), "The Houthi foreign ministry: ready to cooperate to face Israeli danger");
  assert.equal(sideWords("Yemen's defence minister warns Saudi ships", "houthi"), "Houthi defence minister warns Saudi ships");
  assert.equal(sideWords("Yemen's defence minister inspects Marib fronts", "government"), "Yemen's government defence minister inspects Marib fronts");
  assert.equal(sideWords("Yemeni forces advance in Marib", "government"), "Yemeni government forces advance in Marib");
  assert.equal(sideWords("Yemeni government forces advance in Marib", "government"), "Yemeni government forces advance in Marib");
  // Unclear side: no label added.
  assert.equal(sideWords("Yemen's defence minister spoke", "unclear"), "Yemen's defence minister spoke");
});

test("a side-corrected statement still leads with its speaker", async () => {
  const { decideForTest } = await import("./editor.ts");
  const src = "الخارجية اليمنية: مستعدون للتعاون لمواجهة الخطر الإسرائيلي";
  const v = decideForTest(
    reading({ event_type: "statement", actor_side: "houthi", speaker_lead: "Yemeni foreign ministry", headline: "Yemeni foreign ministry: ready to cooperate to face Israeli danger", body: "The Yemeni foreign ministry said it is ready to cooperate against the Israeli danger." }),
    src,
  );
  assert.equal(v.kind, "publish");
  assert.equal(v.kind === "publish" && v.report.summary, "The Houthi foreign ministry: ready to cooperate to face Israeli danger");
});

test("a side's 'enemy' becomes that side's forces, never 'opposing'", async () => {
  const { reword } = await import("./editor.ts");
  assert.equal(reword("Houthi leader: Saudi enemy targets civilian objects"), "Houthi leader: Saudi forces targets civilian objects");
  assert.equal(reword("the Saudi adversary opened its airports"), "Saudi Arabia opened its airports");
});

test("casualties in the source are never dropped; a card failing that twice still goes out", () => {
  const src = "غارات سعودية على سوق شعبي في ذباب أسفرت عن سقوط قتلى وجرحى";
  const dropped = reading({ headline: "Saudi jets strike a market in Dhubab", body: "Saudi jets struck a popular market in Dhubab." });
  assert.equal(checkReading(dropped, src), "casualties dropped");
  assert.ok(repairable("casualties dropped"));
  assert.equal(checkReading(dropped, src, false), null);
  const kept = reading({ headline: "Saudi jets strike a market in Dhubab, killing and wounding people", body: "People were killed and wounded." });
  assert.equal(checkReading(kept, src), null);
});

test("a Houthi actor written as Yemeni forces fails, and can be repaired", () => {
  const r = reading({ actor_side: "houthi", headline: "Yemeni forces fire drones at Jizan", body: "Yemeni forces said they fired drones at Jizan." });
  assert.match(String(checkReading(r, "القوات المسلحة اليمنية تستهدف جيزان")), /written as Yemeni forces/);
  assert.equal(repairable("figure not in source: 30"), false);
});

test("a daily 429 rests the model until midnight in California", () => {
  const now = Date.parse("2026-09-21T17:30:00Z"); // 10:30 in California
  assert.equal(new Date(nextPacificMidnight(now)).toISOString(), "2026-09-22T07:01:00.000Z");
  assert.equal(pacificDay(now), "2026-09-21");
  assert.equal(pacificDay(Date.parse("2026-09-22T06:59:00Z")), "2026-09-21");
});
