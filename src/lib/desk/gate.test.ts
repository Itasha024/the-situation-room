/**
 * The gate, measured against labelled real traffic.
 *
 * Asserting on aggregate scores rather than individual cases is deliberate:
 * the balance between "loses nothing" and "lets nothing in" is the thing that
 * matters, and it can only be judged in both directions at once. A change that
 * rescues dropped reports usually admits something too; this is what makes that
 * cost visible before it reaches the live desk.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { GATE_FIXTURES } from "./gate-fixtures.ts";
import { formatReport, runReport } from "./gate-report.ts";
import { breadthOf, gate, normaliseArabic } from "./relevance.ts";

test("the gate loses nothing relevant and admits nothing irrelevant", () => {
  const r = runReport();
  const detail = formatReport(r);

  // Recall first: before this scorer the gate kept 25% of what it should have.
  assert.equal(r.lost.length, 0, `relevant items were excluded:\n${detail}`);
  // And the other half of the balance — noise must not reach the feed.
  assert.equal(r.leaked.length, 0, `noise reached the feed:\n${detail}`);
  assert.ok(r.exact >= 0.9, `feed/tray placement drifted:\n${detail}`);
});

test("normalisation makes an unlisted spelling of a listed word still match", () => {
  // Same word, four orthographies the sources actually use.
  const forms = ["صنعاء", "صنعاء", "صَنْعاء", "صنعآء"];
  const normalised = new Set(forms.map(normaliseArabic));
  assert.ok(normalised.size <= 2, `normalisation left too many variants: ${[...normalised]}`);

  // Hamza and ta-marbuta forms collapse, which is the point.
  assert.equal(normaliseArabic("أنصار الله"), normaliseArabic("انصار الله"));
  assert.equal(normaliseArabic("غارة"), normaliseArabic("غاره"));
});

test("source breadth sets the bar, so one item is judged differently by outlet", () => {
  assert.equal(breadthOf("Al-Masirah"), "focused");
  assert.equal(breadthOf("Al Jazeera"), "mixed");
  assert.equal(breadthOf("Reuters"), "wire");

  // A loosely-topical line from a Yemen-only channel is likelier to be ours
  // than the same line from a global wire.
  const text = "تحركات عسكرية جديدة قرب الحدود";
  const focused = gate({ text, source: "Al-Masirah", url: "u", agency: false, breadth: "focused" });
  const wire = gate({ text, source: "Reuters", url: "u", agency: true, breadth: "wire" });
  assert.ok(
    ["feed", "tray"].indexOf(focused.outcome) <= ["feed", "tray"].indexOf(wire.outcome) ||
      focused.outcome === wire.outcome,
    "a focused source must never be stricter than a wire on the same text",
  );
});

test("another theatre named BY a party, linking fronts, is ours — the same word is not", () => {
  // Gaza as the subject.
  const subject = gate({
    text: "الخارجية القطرية تدين استمرار القتل ومنع دخول المساعدات لغزة",
    source: "Al Jazeera",
    url: "u",
    agency: false,
  });
  assert.equal(subject.keep, false, "Gaza as the subject is not this desk's file");

  // Gaza invoked by a party to THIS war, tying the fronts together.
  const frame = gate({
    text: "قال قائد أنصار الله إن جبهات المقاومة موحدة وإن ما يجري في اليمن مرتبط بما يجري في غزة ولبنان",
    source: "Al-Masirah",
    url: "u",
    agency: false,
  });
  assert.equal(frame.keep, true, "a unity-of-fronts statement is about this war");
});

test("every fixture carries a label the report can score", () => {
  for (const f of GATE_FIXTURES) {
    assert.ok(["feed", "tray", "exclude"].includes(f.label), `${f.name}: bad label`);
    assert.ok(f.text.trim().length > 10, `${f.name}: fixture text too short to be meaningful`);
  }
});

test("jambiya is a whole word: 'foreign' (الأجنبية) is not a crime item", () => {
  const speech = gate({ text: "قائد الثورة: الشعب اليمني تحرر من الوصاية الأجنبية ومن ممارساتها الإجرامية بحق اليمن", source: "Al-Masirah", url: "", agency: false });
  assert.notEqual(speech.reason, "crime");
  const brawl = gate({ text: "مقتل شخص بطعنة جنبية في شجار بسوق تعز", source: "Almashhad", url: "", agency: false });
  assert.equal(brawl.reason, "crime");
});

test("a leader's quoted line skips the ceremony/crime rules and goes to the reader", () => {
  const v = gate({ text: "🔴 عاجل 🔴 السيد القائد: في ذكرى ثورة 21 سبتمبر نؤكد أن السعودي سيدفع الثمن إذا استمر الحصار", source: "Al-Masirah", url: "", agency: false });
  assert.equal(v.outcome, "feed");
  assert.equal(v.reason, "leader-quote");
});

test("a stream notice has no quote and stays out", () => {
  const v = gate({ text: "📡 البث المباشر لكلمة السيد القائد عبدالملك بدرالدين الحوثي بمناسبة ذكرى ثورة 21 سبتمبر", source: "Al-Masirah", url: "", agency: false });
  assert.equal(v.outcome, "exclude");
});

test("a leader's line relayed by another outlet is dropped unless his outlet was down", () => {
  const text = "عبدالملك الحوثي: نتوجه إلى الله بالحمد والشكر على ما منّ به على شعبنا العزيز من النصر والتأييد في ثورته المباركة ثورة 21 سبتمبر";
  assert.equal(gate({ text, source: "Bin Saeed", url: "", agency: false }).reason, "speech-relay");
  assert.notEqual(gate({ text, source: "Bin Saeed", url: "", agency: false, officialDown: true }).reason, "speech-relay");
});

test("military words are not rally or sports noise", () => {
  assert.notEqual(gate({ text: "الدفاعات الجوية تعترض مسيرات أطلقها الحوثيون باتجاه مأرب", source: "Almashhad", url: "", agency: false }).reason, "rally");
  assert.notEqual(gate({ text: "دورية عسكرية تتعرض لكمين في أبين", source: "Almashhad", url: "", agency: false }).reason, "sports");
  assert.notEqual(gate({ text: "وزير الدفاع يتفقد جبهات مأرب", source: "Saba", url: "", agency: false }).reason, "ceremony");
});

test("the wide radar: an official of any side speaking, and alerts in Saudi Arabia", async () => {
  const { onRadar } = await import("./editor.ts");
  assert.ok(onRadar("وزير الثقافة للتلفزيون العربي: صنعاء هي الهدف والحوثيون يريدون إشعال المنطقة"));
  assert.ok(onRadar("وزير الدفاع ورئيس هيئة الأركان للعدو السعودي: أي تصعيد سيواجه بخيارات تصعيدية مكلّفة"));
  assert.ok(onRadar("دوي صافرات الإنذار في جازان"));
  assert.ok(onRadar("Civil defence sirens sound in Riyadh"));
  assert.ok(!onRadar("وزير الرياضة يفتتح بطولة كرة القدم"));
  assert.ok(!onRadar("Sirens sound in Tel Aviv after a launch from Lebanon"));
});

test("Persian is read: Iran's channels on Yemen reach the reader, Iran's other news does not", () => {
  assert.equal(normaliseArabic("یمن"), "يمن");
  assert.equal(normaliseArabic("باب‌المندب"), "باب المندب");
  const on = gate({ source: "Fars News", url: "https://t.me/farsna/1", agency: false, text: "حمله موشکی انصارالله یمن به تأسیسات آرامکو در ینبع عربستان سعودی" });
  assert.equal(on.outcome, "feed");
  const off = gate({ source: "Fars News", url: "https://t.me/farsna/2", agency: false, text: "بازدید رئیس جمهور از نمایشگاه بین المللی کتاب تهران و دیدار با ناشران" });
  assert.notEqual(off.outcome, "feed");
});

test("Iran's channels: Iran alone is no tie, ایمن is not Yemen, and nothing is held on a maybe", () => {
  const flag = gate({ source: "SNN", url: "u", agency: false, text: "اهتزاز پرچم مقدس جمهوری اسلامی ایران در دانشگاه فردوسی مشهد" });
  assert.equal(flag.outcome, "exclude");
  const safety = gate({ source: "Mehr News", url: "u", agency: false, text: "مدیرعامل سازمان آتش‌نشانی تهران: پیشرفت سی تا چهل درصدی ایمن‌سازی بازار بزرگ تهران در زمینه کابل‌کشی‌ها" });
  assert.equal(safety.outcome, "exclude");
  const drone = gate({ source: "Mehr News", url: "u", agency: false, text: "یمن یک پهپاد شناسایی سعودی را ساقط کرد سخنگوی نیروهای مسلح یمن: یک پهپاد شناسایی کاریال متعلق به دشمن سعودی" });
  assert.equal(drone.outcome, "feed");
  assert.equal(gate({ source: "Saba", url: "u", agency: false, text: "قال أيمن محمد إن الاجتماع ناقش خطة التعليم" }).outcome === "feed", false);
});

test("the war's effects on daily life reach the reader: schools online, airports shut, emergency measures", async () => {
  const { digest } = await import("./digest.ts");
  for (const t of [
    "عاجل | تحول الدراسة في مدارس الرياض إلى التعليم عن بعد عبر منصة مدرستي لمدة أسبوع",
    "Schools in Riyadh to switch to remote learning for one week amid Houthi attacks",
    "تعليق الرحلات في مطار الملك خالد الدولي بالرياض",
  ]) {
    assert.notEqual(digest("Al-Mihwar", t, "houthi").outcome, "exclude", t);
  }
});

test("the sea and energy reach the reader: UKMTO warnings for this war's waters, energy sites stopped or back", () => {
  const read = (text: string, source: string) => gate({ text, source, lean: "intl" } as never).outcome;
  assert.equal(read("UKMTO WARNING\n148-26 - SUSPICIOUS ACTIVITY\nUKMTO has received a report of an incident 25NM south-west of Mokha. A small craft approached the vessel.", "UKMTO"), "feed");
  assert.equal(read("Pumping on the East-West pipeline restored after the attack\nThe Ministry of Energy said", "Saudi Energy Ministry"), "feed");
  // A Hormuz warning names none of this war's places: not raised.
  assert.notEqual(read("UKMTO WARNING\n146-26 - ATTACK\nAn incident within the Strait of Hormuz. A tanker has been struck by an unknown projectile.", "UKMTO"), "feed");
});
