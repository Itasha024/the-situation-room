/**
 * Round 29, stage 4a: the review of every card of 3-4 Oct (and the first
 * cards after stage 3 went live, 7 Oct). Each rule tested on the real text it
 * came from; Israel time in the test names.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { gate, FINAL_EXCLUDES } from "./relevance.ts";
import { houthiAfterAll } from "./editor.ts";
import { namedSpots, sameTarget, speechOwner } from "./copies.ts";
import { toWritten } from "./combine.ts";
import { fixHeadline } from "./reader.ts";
import type { LiveReport } from "./types.ts";

test("7 Oct 06:33, 08:19, 09:01 — Iran's channels relaying the Houthi spokesman, or summing up, stay out, and the radar does not bring them back", () => {
  const fars = gate({ source: "Fars News", url: "https://t.me/farsna/466764", agency: false, text: "‌ 🔴 سخنگوی انصارالله یمن: فرودگاه ملک خالد عربستان را با چندین فروند پهپاد هدف قرار دادیم.  @Farsna" } as never);
  assert.equal(fars.reason, "iran-relay");
  const snn = gate({ source: "SNN", url: "https://t.me/snntv/519030", agency: false, text: "🔴عملیات موشکی و پهپادی یمن علیه سه پایگاه نظامی پهپادی سعودی\n\n🔸نیروهای مسلح یمن با صدور بیانیه‌ای اعلام کردند که سه پایگاه نظامی مهم در مناطق مرزی عربستان سعودی مورد اصابت قرار گرفت." } as never);
  assert.equal(snn.reason, "iran-relay");
  const nour = gate({ source: "Nour News", url: "https://t.me/Nournews_ir/399948", agency: false, text: "✅ آخرین تحولات جنگ عربستان و یمن؛ حمله به زیر ساختهای حیاتی ریاض و تداوم نبرد باب‌المندب\n\n🔹درگیری میان عربستان و انصارالله یمن در جبهه‌های تعز و باب‌المندب تشدید شده" } as never);
  assert.equal(nour.reason, "summary");
  for (const r of ["iran-relay", "summary", "prices"]) assert.ok(FINAL_EXCLUDES.has(r));
  // Iran's own minister discussing "the latest developments" is no summary.
  const own = gate({ source: "IRNA", url: "u", agency: false, text: "عراقچی در گفتگو با همتای عمانی آخرین تحولات یمن و حملات عربستان را بررسی کرد" } as never);
  assert.notEqual(own.reason, "summary");
});

test("7 Oct 08:09, 4 Oct 00:36 and 08:33 — the government never strikes Saudi forces or Saudi cities: that is the Houthis", () => {
  const badr = "اليمن: مراسل الميادين: القوات المسلحة اليمنية استهدفت إمدادات عسكرية سعودية في معسكر بدر القريب من مطار عدن الدولي";
  assert.equal(houthiAfterAll(undefined, "Yemeni government forces strike Saudi military supplies at Badr camp near Aden International Airport", badr, "houthi"), true);
  assert.equal(houthiAfterAll("saudi", "Yemeni government forces target Dammam in eastern Saudi Arabia", "", "houthi"), true);
  assert.equal(houthiAfterAll(undefined, "Yemeni government forces launch wide attack on Saudi-aligned militia sites in Al-Akhan and Al-Khanif mountains", "", "houthi"), true);
  // Ali Bk, 4 Oct 08:31: no side given, the outlet's "Yemeni forces" kept.
  assert.equal(houthiAfterAll(undefined, "Yemeni forces reach Al-Safaqi junction, cut last supply route for Saudi-aligned forces", "القوات اليمنية تصل إلى جولة الصافقي", "houthi"), true);
  // The government's own strikes, told by its own outlets, stay the government's.
  assert.equal(houthiAfterAll("government", "Yemeni government forces strike Houthi sites in Sanaa and Saada", "الجيش اليمني يستهدف مواقع الحوثيين", "gov"), false);
  assert.equal(houthiAfterAll("government", "Yemeni government forces strike Houthi targets with Saudi support", "", "gov"), false);
});

test("3 Oct — Jabal Han's night attack repelled, told six times, is one event; so is Al-Hisn, and the missile on Badr camp", () => {
  const c = (summary: string, at: string, type = "combat") => ({ type, summary, at: `2026-10-03T${at}:00+03:00` });
  const han = c("Yemeni military forces repelled overnight Houthi attacks to take Jabal Han", "10:35");
  assert.ok(sameTarget(han, c("Yemeni government army repels Houthi attacks on Jabal Han and Hazdran in Taiz, inflicting dozens of casualties", "11:11")));
  assert.ok(sameTarget(han, c("Yemeni government forces repel Houthi attacks in Jabal Han in Taiz, killing and wounding dozens", "15:33")));
  const hisn = c("Yemeni government forces and Popular Resistance liberate Al-Hisn in Jabal Sameh and expand clashes towards Al-Ja'shah south of Taiz", "15:51");
  assert.ok(sameTarget(hisn, c("Yemeni government forces and Popular Resistance capture Al-Hisn in Jabal Sameh south-east of Taiz", "17:33")));
  const badr = { type: "strike", summary: "Houthi ballistic missiles strike Badr camp near Aden International Airport, killing and wounding Saudi officers", at: "2026-10-07T07:37:00+03:00" };
  assert.ok(sameTarget(badr, { type: "strike", summary: "Houthi forces strike Saudi military supplies at Badr camp near Aden International Airport", at: "2026-10-07T08:09:00+03:00" }));
  // Not one event: two villages in one district; the other side; a new strike; a district struck hours apart.
  const safiyah = c("Houthi forces seize Al-Safiyah area in Al-Shamaytayn district of Taiz", "12:00");
  assert.ok(!sameTarget(safiyah, c("Houthi forces seize Al-Burkani in Al-Shamaytayn district", "13:00")));
  assert.ok(!sameTarget(han, c("Houthi forces repel government attack on Jabal Han", "11:00")));
  assert.ok(!sameTarget(badr, { type: "strike", summary: "Houthi forces launch new missile strike on Badr camp", at: "2026-10-07T09:00:00+03:00" }));
  assert.ok(!sameTarget(c("Yemeni government air strikes hit Houthi reinforcements in Al-Wazi'iyah, Taiz", "00:05", "strike"), c("Government air strikes hit Houthi reinforcements in Al-Wazi'iyah, Taiz", "03:45", "strike")));
  // A plain "Al-" name holds three hours; a named hill or site six.
  assert.ok(!sameTarget(c("Giants Brigades repel Houthi attacks in Al-Mudaribah", "12:00"), c("Giants Brigades repel Houthi attacks in Al-Mudaribah and Al-Wazi'iyah", "16:00")));
  assert.deepEqual([...namedSpots("Houthi forces seize Mount Beihan camp in Al-Asabah district overlooking Al-Turbah city")].sort(), ["n:asabah", "s:beihan"]);
});

test("4 Oct 15:00 — a speech's lines from other outlets are copies of the speaker's own outlet's", async () => {
  assert.equal(speechOwner("Yemen's president: every city the state recovers will enter a stage of stability")?.key, "alimi");
  assert.equal(speechOwner("Yemen Yemen's president announces nationwide military operations")?.key, "alimi");
  assert.equal(speechOwner("The coalition: Houthi forces have looted Yemeni resources and harmed tribal leaders")?.key, "maliki");
  assert.equal(speechOwner("Coalition says Houthi attacks on Saudi Arabia require continued deterrent measures")?.key, "maliki");
  assert.equal(speechOwner("Houthi political council head orders activation of presidential amnesty in Taiz")?.key, "mashat");
  assert.equal(speechOwner("Coalition intercepts Houthi missiles over Riyadh"), null);
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [], type: "statement" } as const;
  const saba = { ...base, fp: "sb", url: "https://x.com/sabanew_/status/1", source: "Saba (government)", at: "2026-10-04T15:02:00+03:00", summary: "Yemen president announces full-scale military operations in Sanaa, Saada and Hodeidah" };
  const arabiya = { ...base, fp: "ar", url: "https://t.me/AlArabiya_Brk/1", source: "Al Arabiya", at: "2026-10-04T15:10:00+03:00", summary: "Yemen's president: every city the state recovers will enter a stage of stability, recovery and reconstruction" };
  const spa = { ...base, fp: "spa", url: "https://www.spa.gov.sa/1", source: "SPA", at: "2026-10-04T18:04:00+03:00", summary: "Turki al-Maliki: Coalition vows to continue operations to deter Houthi forces" };
  const hadath = { ...base, fp: "hd", url: "https://t.me/alhadath_brk/1", source: "Al Hadath", at: "2026-10-04T21:17:00+03:00", summary: "The coalition: Houthi terrorist attacks against the Yemeni people are flagrant violations" };
  const reports = [arabiya, hadath] as never[];
  foldIntoPublished(reports, new Set(), [saba, spa] as never[]);
  assert.equal(reports.length, 0);
});

test("3-4 Oct — a card written from several accounts keeps the lead's side, one event, and no stutter", () => {
  const acc = (source: string, summary: string): LiveReport => ({ fp: source, url: `u-${source}`, at: "2026-10-07T08:00:00+03:00", source, type: "strike", summary, text: "", live: true, score: 1, tags: [] }) as LiveReport;
  const all = [
    acc("Yahya Saree", "Houthi ballistic missiles strike Badr camp near Aden International Airport, killing and wounding Saudi officers"),
    acc("Al Mayadeen", "Yemeni armed forces target Saudi military supplies at Badr camp near Aden International Airport"),
  ];
  assert.equal(toWritten({ headline: "Yemeni government forces strike Saudi military supplies at Badr camp near Aden International Airport, killing and wounding Saudi officers" }, all, []), null);
  const w = toWritten({ headline: "Yemeni armed forces strike Badr camp near Aden International Airport, killing and wounding Saudi officers" }, all, []);
  assert.match(String(w?.headline), /^Houthi forces strike Badr camp/);
  const two = [acc("Saudi News", "Coalition says Houthi claims of targeting Riyadh misleading"), acc("South24", "Yemeni government forces report 257 operations against Houthi military sites in Sanaa")];
  assert.equal(toWritten({ headline: "Coalition says Houthi claims of targeting Riyadh misleading as Yemeni forces report 257 operations against Houthi military sites in Sanaa" }, two, []), null);
  assert.equal(fixHeadline("Yemen Yemen's president praises Saudi Arabia as a partner in security"), "Yemen's president praises Saudi Arabia as a partner in security");
  assert.equal(fixHeadline("Houthis claim control of As-Safiya while government reports strikes in Saada, Al‑Al‑Al-Jawf"), "Houthis claim control of As-Safiya while government reports strikes in Saada, Al-Jawf");
});

/* ---- Stage 4b: the review of 5-7 Oct ---- */

test("5 Oct 14:30-01:13 — a front report never follows a held Rubio relay on common words ('←Marco Rubio' on 259 reports)", async () => {
  const { sameSpeakerWords } = await import("./origin.ts");
  const keys = ["Bab", "forces", "oppose", "control", "near", "al-Mandab", "Arabia", "Yemeni", "Houthi", "official", "Saudi"];
  assert.equal(sameSpeakerWords("Three Saudi soldiers killed in clashes near the Yemeni border", "Marco Rubio", keys), false);
  assert.equal(sameSpeakerWords("Giants Brigades forces surround Mocha near Bab al-Mandab", "Marco Rubio", keys), false);
  const rubio = ["Saudi", "Arabia", "right", "defend", "itself", "Houthi", "attacks", "uphold", "security", "agreement", "commitments"];
  assert.equal(sameSpeakerWords("Rubio: Washington will uphold its security agreement and commitments to Saudi Arabia, which has the right to defend itself", "Marco Rubio", rubio), true);
});

test("5-7 Oct — the Houthis' words for the other side are never the government's", () => {
  const gov = (h: string) => houthiAfterAll("government", h, "", "neutral");
  assert.ok(gov("Yemeni government forces strike Saudi mobilisations in Al-Jawf and Marib")); // Saree, 6 Oct 07:21
  assert.ok(gov("Yemeni government forces shell Saudi government forces gatherings in Ras al-Ara, dozens killed")); // Naya
  assert.ok(gov("Yemeni government forces expel Saudi infiltrations in Dhubab and seize equipment after Giants Brigades forces flee")); // Ali Bk
  assert.ok(gov("Yemeni government forces in Dhubab city as Saudi government forces flee toward Aden")); // Shajab
  assert.ok(gov("Yemeni government forces clear opponents mobilisations in Al-Maafir and Al-Shmaytayn districts of Taiz")); // Abdulsalam
  assert.ok(gov("Yemeni government forces strike Shabwa Defence Forces and Saba Axis in Marib, causing casualties")); // Ali Bk
  assert.ok(gov("Yemeni government forces conduct three ballistic missile operations")); // Al Mayadeen
  assert.ok(gov("Yemeni government forces target Saudi troop concentrations between Ras al-Ara and al-Suqya with over 20 strikes"));
  assert.ok(gov("Yemeni government forces liberate Dhubab Airport, the only site held by Saudi militias this morning")); // Bin Saeed
  // The government's own: its strikes, its missile finds, another party in a second clause.
  assert.ok(!gov("Yemeni government forces destroyed a ballistic missile depot in Saada")); // Yemen TV
  assert.ok(!gov("Yemeni government forces advance with Saudi air cover toward Mocha"));
  assert.ok(!gov("Yemeni government army and resistance forces destroy Houthi vehicles in Jabal Habashi, while Houthi forces expel Saudi mobilization from Al-Mawasit"));
});

test("5-7 Oct — a reader's headline with another party's account joined on keeps its first event", async () => {
  const { firstEvent } = await import("./reader.ts");
  assert.equal(
    firstEvent("Coalition intercepts Houthi ballistic missile toward Khamis Mushait as Houthi media report suspension of air operations at King Khalid International Airport"),
    "Coalition intercepts Houthi ballistic missile toward Khamis Mushait",
  );
  assert.equal(
    firstEvent("Yemen foreign minister meets Jordan Senate president in Amman as Saudi Council of Ministers reaffirms support for Yemeni government"),
    "Yemen foreign minister meets Jordan Senate president in Amman",
  );
  // Two sides' claims on one place, and a denial, are one contested event.
  const contested = "Houthis claim Bab al-Mandab, Dhubab and Mocha while Yemeni army says it captured Bab al-Mandab and Dhubab airport";
  assert.equal(firstEvent(contested), contested);
  const denied = "Yemeni forces claim control of Bab al-Mandab, Dhubab airport and Mocha as Houthis deny presence";
  assert.equal(firstEvent(denied), denied);
});

test("5-7 Oct — one decision, one town taken, one attack on Aden airport: one card each", async () => {
  const { sameDecision, sameSiteAttack } = await import("./copies.ts");
  const at = (h: string) => `2026-10-05T${h}:00+03:00`;
  assert.ok(sameDecision({ summary: "Saudi Arabia to regularize status of undocumented Yemenis", at: at("21:08") }, { summary: "Saudi Arabia begins correcting status of Yemenis in Riyadh", at: at("21:26") }));
  assert.ok(sameDecision({ summary: "Saudi Arabia restores East-West pipeline throughput to 5.8 million barrels per day" }, { summary: "Saudi Arabia restores East-West pipeline flows to 5.8 million barrels per day" }));
  assert.ok(!sameDecision({ summary: "Saudi Arabia’s East-West pipeline operating normally with crude oil continuing to flow, sources say" }, { summary: "Fire reported at Saudi oil pipeline" }));
  assert.ok(!sameDecision({ summary: "Some flights diverted to King Fahd International Airport in Dammam" }, { summary: "Air traffic suspended and nine aircraft diverted from King Abdulaziz International Airport in Jeddah" }));
  const c = (summary: string, t: string) => ({ type: "combat", summary, at: at(t) });
  assert.ok(sameTarget(c("Yemeni government forces capture Mocha as road to Turbah in Taiz reopens", "17:52"), c("Yemeni government forces capture Mocha city and port in Taiz governorate", "18:41")));
  assert.ok(!sameTarget(c("Yemeni government forces capture Mocha city", "19:20"), c("Houthi forces capture Mocha, Dhubab and Perim Island", "22:08")));
  const s = (summary: string) => ({ type: "strike", summary });
  assert.ok(sameSiteAttack(s("Houthi ballistic missiles target Aden International Airport"), s("Smoke columns rise from Aden International Airport after targeting by Abu Jabril")));
  assert.ok(!sameSiteAttack(s("Houthi ballistic missiles target Aden International Airport"), s("Saudi air strikes hit Sanaa airport")));
  assert.ok(!sameSiteAttack(s("Houthi missiles target Aden airport"), s("Houthi forces launch new missile strike on Aden airport")));
});

test("5 Oct — the spokesmen's lines from other outlets, and relays of one ministry's statement, join one card", async () => {
  assert.equal(speechOwner("Yemeni government forces spokesperson: Dhubab airport is under our forces' control")?.key, "gov spokesman");
  assert.equal(speechOwner("Houthi spokesperson: Saudi regime's crimes reveal its true nature")?.key, "abdulsalam");
  assert.equal(speechOwner("Houthi Armed Forces spokesperson: we shot down a CH-4"), null);
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [], type: "statement" } as const;
  const own = { ...base, fp: "sp", url: "https://t.me/army/1", source: "Yemeni Army spokesman", at: "2026-10-05T11:29:00+03:00", summary: "Yemeni government forces spokesperson: hundreds of Houthi fighters trapped in Dhubab must surrender" };
  const asharq = { ...base, fp: "as", url: "https://t.me/asharq/1", source: "Asharq News", at: "2026-10-05T11:33:00+03:00", summary: "Yemeni government forces spokesperson: Dhubab airport is under our forces' control" };
  const araby = { ...base, fp: "ar", url: "https://t.me/araby/1", source: "Al-Araby TV", at: "2026-10-05T21:01:00+03:00", summary: "Saudi defense minister says Mecca Alliance will deploy forces to Saudi Arabia and activate collective deterrence", citing: "Saudi Defence Ministry" };
  const mubasher = { ...base, fp: "mu", url: "https://t.me/mubasher/1", source: "Al Jazeera Mubasher", at: "2026-10-05T21:07:00+03:00", summary: "Saudi defence minister: Collective deterrence activated against attacks on kingdom", citing: "Saudi Defense Ministry" };
  const reports = [asharq, mubasher] as never[];
  foldIntoPublished(reports, new Set(), [own, araby] as never[]);
  assert.equal(reports.length, 0);
});

test("5-6 Oct — Shin Persian relaying UKMTO's notices stays out: the desk reads UKMTO", () => {
  const g = gate({ source: "Shin Persian", url: "https://t.me/shin_persian/10745", agency: false, text: "🔴 هشدار UKMTO شماره 152-26 درباره امنیت دریانوردی در دریای سرخ و خلیج عدن" } as never);
  assert.equal(g.reason, "iran-relay");
});
