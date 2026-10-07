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
