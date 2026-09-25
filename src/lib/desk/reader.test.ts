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
import { type Reading, checkReading, nextPacificMidnight, pacificDay, repairable, stripSpellingNotes } from "./reader.ts";

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

/** A store in memory: state keys in `json`, each cache's rows under `rows:<prefix>`. */
function memStore(json: Record<string, unknown>) {
  const rows = (p: string) => ((json[`rows:${p}`] ??= {}) as Record<string, unknown>);
  return {
    getJson: async (k: string) => json[k] ?? null,
    putJson: async (k: string, v: unknown) => { json[k] = v; },
    deleteJson: async (k: string) => { delete json[k]; },
    getMany: async (p: string, ids: string[]) => Object.fromEntries(ids.filter((i) => i in rows(p)).map((i) => [i, rows(p)[i]])),
    putMany: async (p: string, e: Record<string, unknown>) => { Object.assign(rows(p), e); },
    prune: async () => 0,
    recentDesk: async () => ({ reports: [], events: [], updatedAt: "" }),
  };
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
  // A target the text does not contain never reaches the map, and neither does
  // a place the copy names that the text does not contain.
  const nowhere = { headline: "Air strikes hit Houthi positions", body: "" };
  const invented = toReport(reading({ targets: ["صنعاء"], ...nowhere }), cand(SAREE));
  assert.equal(invented.place, undefined);
  const inventedCopy = toReport(reading({ headline: "Air strikes hit Houthi positions in Sanaa", body: "" }), cand(SAREE));
  assert.equal(inventedCopy.place, undefined);
  // Unclear roles still get a pin. Not knowing who fired is not the same as not
  // knowing where it landed, and a pin only says something happened here.
  const unclear = toReport(reading({ targets: ["تعز"], ...nowhere, confident_roles: false }), cand(SAREE));
  assert.equal(unclear.place, "Taiz");
  // Grounding still holds when the roles are unclear: an invented place is out.
  const unclearInvented = toReport(reading({ targets: ["صنعاء"], ...nowhere, confident_roles: false }), cand(SAREE));
  assert.equal(unclearInvented.place, undefined);
});

test("a field report with no usable target is pinned by the place its own copy names", () => {
  // The real shape of the miss: the target is a front the gazetteer does not
  // list, and the governorate is sitting in the headline.
  const src = "اشتباكات عنيفة في جبهة جردد بمحافظة تعز";
  const row = toReport(
    reading({
      event_type: "ground_clash",
      targets: ["جبهة جردد"],
      headline: "Heavy fighting on the Jardad front in Taiz",
      body: "",
    }),
    cand(src),
  );
  assert.equal(row.place, "Taiz");

  // The target still wins when it is one the gazetteer knows.
  const aimed = toReport(
    reading({ targets: ["المخا"], headline: "Shelling kills six in Mocha, Taiz governorate", body: "" }),
    cand("قصف على المخا في محافظة تعز أسفر عن ستة قتلى"),
  );
  assert.equal(aimed.place, "Mocha");

  // A launch base named in the copy is not a pin: the raids flew from Khamis
  // Mushait and Taif, and landed in Yemen.
  const bases = toReport(
    reading({
      targets: [],
      origins: ["قاعدتي خميس مشيط والطائف"],
      headline: "Saudi warplanes flew 28 raids from Khamis Mushait and Taif",
      body: "",
    }),
    cand(SAREE),
  );
  assert.equal(bases.place, undefined);
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
  assert.equal(fixHeadline("Houthi leader says the Houthis' demands are legitimate"), "Houthi leader: the Houthis' demands are legitimate");
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

test("a spokesman's statement takes the colon; Saree speaks for the military", async () => {
  const { fixHeadline } = await import("./reader.ts");
  assert.equal(fixHeadline("UN spokesman says talks on Yemen will resume next week"), "UN spokesman: talks on Yemen will resume next week");
  assert.equal(fixHeadline("Yemen's government spokesman warns that the Houthis are preparing an offensive"), "Yemen's government spokesman: the Houthis are preparing an offensive");
  assert.equal(fixHeadline("Yahya Saree: Houthi forces fired missiles at Jizan"), "Houthi Armed Forces spokesperson: Houthi forces fired missiles at Jizan");
  assert.equal(fixHeadline("Houthi military spokesman Yahya Saree says drones hit Abha airport"), "Houthi Armed Forces spokesperson: drones hit Abha airport");
  assert.equal(fixHeadline("Trump says he spoke with Bin Salman"), "Trump says he spoke with Bin Salman");
});

test("a body that says the headline again goes; one with new facts stays", async () => {
  const { redundantBody } = await import("./reader.ts");
  assert.equal(redundantBody("Indications of fuel and oil derivatives shortages in Sanaa, sources say", "There are indications of shortages of fuel and oil derivatives in Sanaa, sources say."), true);
  assert.equal(redundantBody("Saudi warplanes resume bombing in Taiz", "TAIZ — Saudi warplanes have resumed bombing in Taiz province."), true);
  assert.equal(redundantBody("Saudi air raid targets Al-Hazm district in Al-Jawf", "The raid killed 3 people and wounded 5."), false);
  assert.equal(redundantBody("Houthi drone hits Saudi border post", "The attack targeted a post near Najran, the Saudi-led coalition said."), false);
  assert.equal(redundantBody("Houthi drone hits Saudi border post", ""), false);
});

test("'killing a martyr' is one person killed", async () => {
  const { reword } = await import("./editor.ts");
  assert.equal(reword("Saudi airstrike kills a martyr in Haifan"), "Saudi airstrike kills one person in Haifan");
  assert.equal(reword("Saudi airstrike kills a people killed in Haifan"), "Saudi airstrike kills one person in Haifan");
  assert.equal(reword("three martyrs in Taiz"), "three people killed in Taiz");
});

test("Tom Fletcher is named with his role, and his statement takes the colon", async () => {
  const { fixHeadline } = await import("./reader.ts");
  assert.equal(fixHeadline("Tom Fletcher says Yemen is approaching famine"), "UN aid chief Tom Fletcher: Yemen is approaching famine");
  assert.equal(fixHeadline("Tom Fletcher: we fear rising hunger levels in Yemen"), "UN aid chief Tom Fletcher: we fear rising hunger levels in Yemen");
});

test("the second look has somewhere to fall back to", async () => {
  const { SECOND_LOOK_MODELS, READER_MODELS } = await import("./reader.ts");
  // One model here meant that the day its free quota ran out, the pass that
  // exists so the desk never loses a field report simply stopped running.
  assert.ok(SECOND_LOOK_MODELS.length > 1, "a single model is a single point of failure");
  for (const m of SECOND_LOOK_MODELS) {
    assert.ok(READER_MODELS.includes(m), `${m} is not a model the reader knows`);
  }
});

test("a second look no model answered is stamped, not retried every cycle", async () => {
  // No key: readBatch is never called, so this is the exact path taken when
  // every model is resting on its daily quota.
  const key = process.env.GEMINI_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const { editCandidates } = await import("./editor.ts");
    const { contentHash } = await import("./reader.ts");
    const text = "عاجل ـ السعودية تقصف مديرية حيفان بمحافظة تعز بسلسلة غارات جوية";
    const now = Date.parse("2026-09-23T07:00:00+03:00");

    const json: Record<string, unknown> = {
      // Already read once and rejected: this is what puts it up for a second look.
      "reader-cache": {
        [contentHash(text)]: {
          // Not a scope reason: those are deliberately re-read (see the scope rule).
          reading: reading({ publish: false, reject_reason: "duplicate of an earlier report", headline: "", body: "" }),
          at: now,
        },
      },
    };
    const store = memStore(json) as unknown as Parameters<typeof editCandidates>[0];

    const candidate = { ...cand(text), url: "https://t.me/x/99" };
    await editCandidates(store, [candidate], now);

    // The old blob moved into rows on first use, and is gone.
    assert.equal(json["reader-cache"], undefined, "the blob is deleted once moved");
    const cache = json["rows:read"] as Record<string, { secondTriedAt?: number; second?: boolean }>;
    const entry = cache[contentHash(text)];
    assert.ok(entry, "the reading stays in the cache");
    assert.equal(entry.secondTriedAt, now, "the attempt is stamped even though no model answered");
    assert.ok(!entry.second, "an unanswered attempt is not recorded as a completed second look");
    assert.ok(
      !((json["reader-missed"] as unknown[]) ?? []).length,
      "an unanswered retry writes nothing to the missed list, which the echo used to fill",
    );
  } finally {
    if (key !== undefined) process.env.GEMINI_API_KEY = key;
    if (groq !== undefined) process.env.GROQ_API_KEY = groq;
  }
});

test("a scope rejection made under the old wording is read again; a thin one is not re-read twice", async () => {
  const { editCandidates } = await import("./editor.ts");
  const { contentHash } = await import("./reader.ts");
  const key = process.env.GEMINI_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const text = "حزب الله ينشر صور عدد من عناصره الذين قُتلوا في اليمن خلال مشاركتهم في العمليات";
    // Rejected for scope, before the theatre-not-nationality rule landed.
    const before = Date.parse("2026-09-22T20:00:00+03:00");
    const json: Record<string, unknown> = {
      "rows:read": {
        [contentHash(text)]: { reading: reading({ publish: false, reject_reason: "out-of-scope", headline: "", body: "" }), at: before },
      },
    };
    const store = memStore(json) as unknown as Parameters<typeof editCandidates>[0];

    const { verdicts, queued } = await editCandidates(store, [{ ...cand(text), url: "https://t.me/x/501" }], Date.now());
    // Stale: the cached verdict is not reused, so with no reader it waits for one.
    assert.equal(verdicts.get("https://t.me/x/501")?.kind, "pending", "it goes back for a fresh reading");
    assert.equal(queued.length, 1, "and waits in the queue rather than standing on the old answer");
  } finally {
    if (key !== undefined) process.env.GEMINI_API_KEY = key;
    if (groq !== undefined) process.env.GROQ_API_KEY = groq;
  }
});

test("the military spokesman and the government spokesman are two people", async () => {
  const { fixHeadline } = await import("./reader.ts");
  assert.equal(
    fixHeadline("Yahya Saree: Houthi forces launched a ballistic missile at Riyadh"),
    "Houthi Armed Forces spokesperson: Houthi forces launched a ballistic missile at Riyadh",
  );
  assert.equal(
    fixHeadline("Houthi government spokesman: Saudi strike hits prisoner facility in Al-Jawf"),
    "Houthi government spokesperson: Saudi strike hits prisoner facility in Al-Jawf",
  );
  assert.equal(fixHeadline("Houthi armed forces spokesman announced a new operation"), "Houthi Armed Forces spokesperson announced a new operation");
});

test("a name the reader does not know is dropped from the headline, the role is not", async () => {
  const { fixHeadline } = await import("./reader.ts");
  assert.equal(
    fixHeadline("Houthi official Dr Omar Al-Bukhiti condemns Saudi crimes in Al-Jawf and Taiz"),
    "Houthi official condemns Saudi crimes in Al-Jawf and Taiz",
  );
  // Names a reader does know are left alone.
  assert.equal(fixHeadline("Trump: we will not let the Houthis win"), "Trump: we will not let the Houthis win");
  assert.equal(fixHeadline("Houthi leader: Saudi Arabia will pay a price"), "Houthi leader: Saudi Arabia will pay a price");
});

// Round 12: each case is a card the desk published on 22-23 September.
test("a correspondent, a doubled speaker and the wrong al-Alimi are put right", async () => {
  const { fixHeadline } = await import("./reader.ts");
  assert.equal(
    fixHeadline("Al Arabiya correspondent: Displaced people killed in Houthi ballistic missile strike on a school in Al-Modarba"),
    "Displaced people killed in Houthi ballistic missile strike on a school in Al-Modarba",
  );
  assert.equal(
    fixHeadline("Yemeni Presidential Council member Abdullah al-Alimi discusses economic recovery support in New York"),
    "Presidential Council member discusses economic recovery support in New York",
  );
  assert.equal(
    fixHeadline("Yemen's president Salem Ahmed Al-Khunbashi urges enhanced security readiness in Mukalla"),
    "Presidential Council member urges enhanced security readiness in Mukalla",
  );
  assert.equal(
    fixHeadline("Houthi political council member Muhammad Al-Farah: Houthi official: UK military support to Saudi Arabia is direct involvement in attacks"),
    "Houthi official: UK military support to Saudi Arabia is direct involvement in attacks",
  );
  assert.equal(
    fixHeadline("UN Secretary-General Antonio Guterres: UN chief calls for de-escalation in Middle East and restored navigation rights"),
    "UN chief calls for de-escalation in Middle East and restored navigation rights",
  );
  assert.equal(
    fixHeadline("Yemen Prime Minister Dheifallah Al-Zandani: Yemen prime minister: Bab al-Mandab battle is a red line"),
    "Yemen's prime minister: Bab al-Mandab battle is a red line",
  );
  assert.equal(
    fixHeadline("Saada human rights office director Yahya Al-Khatib: Saudi forces target border areas daily"),
    "Saada human rights office director: Saudi forces target border areas daily",
  );
  assert.equal(fixHeadline("STC leadership: STC urges calm in Aden"), "STC urges calm in Aden");
  assert.equal(fixHeadline("Interior minister Ibrahim Haydan: Yemen's interior minister urges vigilance"), "Yemen's interior minister urges vigilance");
  // What must not change.
  assert.equal(fixHeadline("Saudi foreign minister: Saudi Arabia rejects Houthi escalation"), "Saudi foreign minister: Saudi Arabia rejects Houthi escalation");
  assert.equal(fixHeadline("Yemen's president Rashad al-Alimi reiterates commitment to ending the coup"), "Yemen's president reiterates commitment to ending the coup");
  assert.equal(fixHeadline("Trump: we will not let the Houthis win"), "Trump: we will not let the Houthis win");
});

test("the card's own outlet leaves its copy; a cited outlet stays", async () => {
  const { stripOwnOutlet } = await import("./reader.ts");
  assert.equal(
    stripOwnOutlet("Al Arabiya reported that a ballistic missile strike launched by Houthi forces hit a school", "Al Arabiya"),
    "A ballistic missile strike launched by Houthi forces hit a school",
  );
  assert.equal(
    stripOwnOutlet("The UN World Food Programme told Al Arabiya it was unable to operate", "Al Arabiya Breaking"),
    "The UN World Food Programme said it was unable to operate",
  );
  assert.equal(
    stripOwnOutlet("A military source told Al-Masirah that heavy equipment was seized", "Al-Masirah"),
    "A military source said heavy equipment was seized",
  );
  assert.equal(stripOwnOutlet("Yemen's Houthis are increasingly supplied by China, Wall Street Journal says", "WSJ"), "Yemen's Houthis are increasingly supplied by China");
  assert.equal(
    stripOwnOutlet("The Wall Street Journal reported that the Houthis are increasingly supplied by China.", "WSJ"),
    "The Houthis are increasingly supplied by China.",
  );
  assert.equal(
    stripOwnOutlet("A navigation source told Almashhad that a medium-sized aircraft landed", "Almashhad"),
    "A navigation source said a medium-sized aircraft landed",
  );
  const cited = "The Financial Times reported that Saudi Arabia formally asked Washington to strike";
  assert.equal(stripOwnOutlet(cited, "Almashhad"), cited);
});

test("which Houthi spokesperson, and no role the text never gave", async () => {
  const { spokespersonLabel, dropInventedRole } = await import("./reader.ts");
  assert.equal(
    spokespersonLabel("Houthi spokesperson: 52 Saudi strikes hit five governorates", "Sabereen News", "العميد يحيى سريع: 52 غارة"),
    "Houthi Armed Forces spokesperson: 52 Saudi strikes hit five governorates",
  );
  assert.equal(
    spokespersonLabel("Houthi spokesperson: Saudi crimes justify the right to self-defence", "Al-Masirah", "ناطق حكومة صنعاء: الجرائم السعودية"),
    "Houthi government spokesperson: Saudi crimes justify the right to self-defence",
  );
  assert.equal(
    dropInventedRole("UN World Food Programme aid chief: unable to operate in Houthi-controlled areas", "برنامج الأغذية العالمي للعربية: لا نستطيع العمل في مناطق الحوثيين"),
    "UN World Food Programme: unable to operate in Houthi-controlled areas",
  );
  assert.equal(dropInventedRole("UN aid chief Tom Fletcher: Yemen is approaching famine", "فليتشر"), "UN aid chief Tom Fletcher: Yemen is approaching famine");
});

test("a body that adds only a little is dropped; two new facts or a real sentence of news keep it", async () => {
  const { redundantBody, newNames } = await import("./reader.ts");
  const long = "أولا جملة طويلة عن الهجوم في المنطقة. ثانيا جملة أخرى عن القوات هناك. ثالثا جملة عن الخسائر والأضرار. رابعا جملة عن ردود الفعل الرسمية. خامسا جملة عن السياق.";
  // Live, 23 Sep: the governor's name and "discussed threats" is not a body.
  assert.equal(
    redundantBody(
      "Hadhramout governor: Security Committee held high-level meeting on Houthi escalation",
      "The security committee in Hadhramout in eastern Yemen met under Governor Salem Ahmed Al-Khanbashi to review military developments and discuss Houthi threats.",
      long,
    ),
    true,
  );
  // One small addition after an air strike is not a body either.
  assert.equal(
    redundantBody(
      "Air strike hits Al-Wazi'iyah district in western Taiz governorate",
      "AL-WAZI'IYAH — Local sources said Houthi forces imposed a security cordon around the site following the strike, preventing access and enforcing a media blackout.",
      long,
    ),
    true,
  );
  // A commander, a district and a brigade are facts the headline lacks.
  assert.equal(
    redundantBody(
      "Fourth Military Region commander inspects Al-Aghabrah front in Lahj",
      "AL-AGHBARA — Major General Hamdi Shukri visited troops in Al-Sabihah district, met by the Sixth Brigade commander in the Nation's Shield forces.",
      long,
    ),
    false,
  );
  // A source of four sentences is its headline.
  const four = "جملة أولى عن القصف المدفعي. جملة ثانية عن المواقع المستهدفة. جملة ثالثة عن القوات هناك. جملة رابعة عن الوضع الميداني.";
  assert.equal(redundantBody("Saudi shelling hits Munabbih district in Saada", "The shelling hit the Al-Raqw area near the border crossing of Al-Thabit.", four), true);
  assert.deepEqual(newNames("Local sources said Muhammad Shihab al-Muharrami was killed near Kahbub.", "fighter killed in kahbub"), ["Muhammad Shihab al-Muharrami"]);
});

test("a source of three sentences or fewer is its headline; a longer one needs a real new sentence", async () => {
  const { redundantBody } = await import("./reader.ts");
  const hajjah = "قصف مدفعي سعودي يستهدف المناطق الحدودية في مديريتي بكيل المير وحرض بمحافظة حجة";
  assert.equal(redundantBody("Saudi artillery shelling hits border areas in Hajjah", "HAJJAH — Saudi artillery shelling targeted border areas in the districts of Bakil al-Mir and Haradh in Hajjah governorate.", hajjah), true);
  // A dateline with nothing after it is no body.
  assert.equal(redundantBody("Houthi forces target Saudi-backed militia build-up with four ballistic missiles in Ras al-Ara", "RAS AL-ARA — "), true);
  // Casualties the headline lacks keep a short item's body.
  const taiz = "قصف مدفعي يستهدف حي الحرير في مديرية صالة بتعز ويقتل امرأة ويصيب زوجها";
  assert.equal(redundantBody("Saudi shelling hits Al-Harir neighbourhood in Taiz", "The shelling killed a woman and wounded her husband.", taiz), false);
  const long = "أولا جملة طويلة عن الهجوم في المنطقة. ثانيا جملة أخرى عن القوات هناك. ثالثا جملة عن الخسائر والأضرار. رابعا جملة عن ردود الفعل الرسمية. خامسا جملة عن السياق.";
  assert.equal(redundantBody("Houthi drone strikes government positions in Al-Dhale", "The positions are in Al-Dhale governorate.", long), true);
  assert.equal(
    redundantBody("Houthi drone strikes government positions in Al-Dhale", "The attack followed a week of shelling on the Murais front, and government commanders said reinforcements were moving north from Aden.", long),
    false,
  );
});

test("wounded is never written as killed", () => {
  const src = "إصابة 3 مواطنين وتدمير محطة وقود تزود قوارب الصيادين جراء ثلاث غارات للعدوان السعودي على جزيرة كمران";
  const bad = reading({ headline: "Houthi media: Saudi air strikes on Kamaran Island kill 3 citizens and destroy fuel station", body: "" });
  assert.equal(checkReading(bad, src), "killed not in source");
  assert.ok(repairable("killed not in source"));
  const good = reading({ headline: "Houthi media: Saudi air strikes on Kamaran Island wound 3 citizens and destroy fuel station", body: "" });
  assert.equal(checkReading(good, src), null);
});

test("a headline left in transliterated Arabic fails the check and is sent back for a second writing", async () => {
  const { transliterated, repairable } = await import("./reader.ts");
  for (const h of [
    "Al-Lama Mftah: Qwa Al-Haymna Asthdft Al-Ymn Lamtlakh Waml Al-Nhda",
    "Al-Lama Mftah: Al-Shb Al-Ymny Kan Sayqf M Al-Ndham Al-Sabq Lw Sa Lantza Al-Syada",
    "Al-Lama Mftah: Mshkla Al-Ymn Kant Fy Qbwl Al-Ndham Al-Sabq Al-Khdw Lltbya Al-Kharjya",
  ]) assert.equal(transliterated(h), true, h);
  for (const h of [
    "Al-Lama Mftah: Saudi Arabia sought to impose dictates in Yemen",
    "Houthi shelling hits Al-Hazm, Al-Maslub",
    "UKMTO: GCC states track ship attack near Musandam",
    "Yanbu port targeted",
  ]) assert.equal(transliterated(h), false, h);
  assert.equal(repairable("headline written as transliterated Arabic"), true);
});

test("notes on how a name is spelled are cut", () => {
  assert.equal(
    stripSpellingNotes("The fighting was in the Kahbub mountains and the Al-Aghabrah front, which is also spelled Al-Aghbarah."),
    "The fighting was in the Kahbub mountains and the Al-Aghabrah front.",
  );
  assert.equal(stripSpellingNotes("Clashes on Jabal Kahbub (also Khaboub) left 3 dead."), "Clashes on Jabal Kahbub left 3 dead.");
  assert.equal(stripSpellingNotes("Houthi shelling hit Hays. Hays is also written Hais. Two were wounded."), "Houthi shelling hit Hays. Two were wounded.");
  assert.equal(stripSpellingNotes("A group called the Southern Giants attacked."), "A group called the Southern Giants attacked.");
});
