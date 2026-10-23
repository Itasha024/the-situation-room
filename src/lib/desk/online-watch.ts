/**
 * The Online watch (user, 23 Oct): what people in Gaza and in Judea and Samaria talk about, how each topic
 * rises and falls, the calls (to protest, to strike, threats) and the posts worth reading. Pure functions:
 * reading a channel's public page, tagging a post with its area and topics, and summing them up.
 */
import type { WatchArea } from "./online-sources.ts";

export type WatchPost = {
  /** The post's link. */
  u: string;
  at: string;
  /** The channel's handle. */
  ch: string;
  /** Gaza, Judea and Samaria, or both. */
  a: WatchArea;
  /** Topic ids. */
  t: string[];
  /** The text, cut. */
  x: string;
  /** Views, as the page shows them. */
  v: number;
  /** Has a video or photo. */
  m?: 1;
};

/** Arabic as one spelling: no vowel marks or tatweel, one alef, ta marbuta and alef maqsura as ha and ya. */
export function plainArabic(s: string): string {
  return String(s || "")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase();
}

export type Topic = { id: string; name: string; area: WatchArea; call?: true; words: string[] };

/** The topics (to be set with the user): each by the words people write. */
export const TOPICS: Topic[] = [
  { id: "bread", name: "Bread, food and prices", area: "gaza", words: ["طابور الخبز", "طوابير الخبز", "ربطة خبز", "ربطة الخبز", "المخبز", "المخابز", "الطحين", "كيس طحين", "شوال طحين", "جشع التجار", "غلاء", "الاسعار", "اسعار السوق", "سعر الكيلو", "السكر", "الزيت", "الخضار", "اللحوم", "الدجاج", "البيض", "تكية", "التكايا", "وجبات", "مجاعه", "جوع", "#جشع_التجار", "رفع الاسعار", "احتكار"] },
  { id: "aid", name: "Aid lists and distribution", area: "gaza", words: ["كشوفات", "كشف المستفيدين", "المستفيدين", "طرد غذائي", "طرود", "الطرود", "توزيع المساعدات", "مساعدات", "لم نستلم", "ما استلمنا", "رابط التسجيل", "سجل الان", "الاونروا", "برنامج الغذاء", "wfp", "unrwa", "كوبونه", "كابونه", "سرقه المساعدات", "نهب المساعدات", "شاحنات المساعدات", "مؤسسه غزه الانسانيه", "نقطه توزيع", "نقاط التوزيع", "منحه", "مساعده نقديه"] },
  { id: "cash", name: "Cash, rates and fees", area: "both", words: ["سعر صرف", "الدولار", "الشيكل", "الدينار", "عموله", "عمولة الكاش", "التكييش", "تكييش", "الكاش", "السيوله", "البنك", "بنك فلسطين", "المحفظه", "محفظه", "pal pay", "بال باي", "جوال باي", "الصرافين", "صراف"] },
  { id: "shelter", name: "Shelter, tents and weather", area: "gaza", words: ["خيمه", "خيام", "الخيام", "النازحين", "نازح", "النزوح", "مراكز الايواء", "مركز ايواء", "الايواء", "المواصي", "غرق الخيام", "المنخفض", "الشتاء", "البرد", "الامطار", "شوادر", "شادر", "كرفانات", "كرفان", "الركام", "بيوت مدمره", "#يوميات_نازح"] },
  { id: "crossings", name: "Crossings and travel", area: "both", words: ["معبر رفح", "المعبر", "كشف المسافرين", "المسافرين", "السفر", "التنسيق", "معبر كرم ابو سالم", "كرم ابو سالم", "زيكيم", "معبر الكرامه", "جسر الكرامه", "الجسر", "حاجز", "الحاجز", "البوابه", "البوابه مغلقه", "اغلاق الحاجز", "احوال الطرق", "عين سينيا", "عطاره", "الكونتينر", "قلنديا", "زعتره", "حواره", "جبع"] },
  { id: "hamas_rule", name: "Hamas rule and policing", area: "gaza", words: ["حكومه حماس", "حكومة غزه", "الامن الداخلي", "امن المقاومه", "رادع", "وحده سهم", "عملاء", "العملاء", "متخابر", "اعدام", "اعدامات", "تصفيه", "فساد", "الشرطه في غزه", "قياده حماس", "حماس سرقت", "ضد حماس", "يسقط حكم", "بدنا نعيش", "كفى", "تعبنا", "وحده سهم"] },
  { id: "clans", name: "Clans and militias", area: "gaza", words: ["بيان عائله", "عشيره", "العشيره", "عشائر", "مخاتير", "المختار", "وجهاء", "القوات الشعبيه", "ابو شباب", "ميليشيا", "مليشيا", "عصابه", "العصابات", "عصابات", "شجار", "اشتباك عائلي", "ثار", "الثار", "دغمش", "حلس", "المجايده"] },
  { id: "idf_gaza", name: "The IDF and the yellow line", area: "gaza", words: ["الخط الاصفر", "الخط الاحمر", "الخط البرتقالي", "توغل", "توغلت", "الاليات", "اليات الاحتلال", "دبابات", "الدبابات", "كواد كابتر", "كوادكابتر", "الزنانه", "القناصه", "قنص", "اطلاق نار", "نسف", "تفجير", "عمليات نسف", "الجرافات", "تجريف", "اخلاء", "اوامر اخلاء", "انذار", "المنطقه الحمراء", "شرق خانيونس", "شرق مدينه غزه", "الشجاعيه", "رفح", "طائره مسيره", "مسيرات الاحتلال"] },
  { id: "raids", name: "Raids and arrests", area: "js", words: ["اقتحام", "اقتحمت", "تقتحم", "مداهمه", "مداهمات", "اعتقال", "اعتقالات", "حمله اعتقالات", "معتقل", "اعتقل", "قوه خاصه", "المستعربين", "تحقيق ميداني", "حصار", "محاصره", "قوات الاحتلال", "جيش الاحتلال", "جنود الاحتلال", "دوريه", "اليات عسكريه", "جرافه عسكريه"] },
  { id: "extremists", name: "Israeli extremists' violence, olive harvest", area: "js", words: ["مستوطنين", "المستوطنين", "مستوطن", "المستوطنون", "قطعان المستوطنين", "هجوم المستوطنين", "اعتداء المستوطنين", "مستعمرين", "المستعمرين", "قطف الزيتون", "موسم الزيتون", "حرق", "احراق", "اقتلاع", "بؤره", "بؤره استيطانيه", "تلال", "رعاه", "الاغوار", "مسافر يطا", "ترمسعيا", "المغير", "سنجل", "دوما", "قصره", "بيتا", "اشجار الزيتون"] },
  { id: "pa", name: "The PA: salaries, forces, camps", area: "js", words: ["الرواتب", "الراتب", "نسبه الراتب", "صرف الرواتب", "الموظفين", "خصومات", "المقاصه", "وزاره الماليه", "السلطه", "السلطه الفلسطينيه", "الاجهزه الامنيه", "اجهزه السلطه", "الامن الوقائي", "المخابرات", "الامن الوطني", "عباس", "ابو مازن", "حسين الشيخ", "محمد مصطفى", "الانتخابات", "حركه فتح", "اشتباك مع الاجهزه", "اعتقال سياسي", "الاعتقال السياسي"] },
  { id: "mourning", name: "Mourning and funerals", area: "both", words: ["تشييع", "يشيع", "تشيع", "جثمان", "جثامين", "بيت عزاء", "بيت العزاء", "ننعى", "نعي", "نعت", "الشهيد", "شهيد", "شهداء", "ارتقى", "ارتقاء", "استشهاد", "استشهد", "رحمه الله", "انا لله وانا اليه راجعون", "الفاتحه", "زفاف الشهيد", "موكب"] },
  { id: "protest", name: "Calls to protest or strike", area: "both", call: true, words: ["وقفه احتجاجيه", "تظاهرات", "التظاهرات", "التظاهر", "مظاهرات", "المظاهرات", "مشاركه شعبيه", "وقفه تضامنيه", "دعوه للتظاهر", "دعوات للتظاهر", "مسيره غاضبه", "مظاهره", "تظاهره", "اعتصام", "اضراب شامل", "الاضراب", "اضراب", "حداد", "الحداد العام", "النفير العام", "يوم غضب", "جمعه غضب", "شد الرحال", "الدعوه الى", "#يوم_غضب"] },
  { id: "threat", name: "Threats and calls to attack", area: "both", call: true, words: ["الرد قادم", "الثار", "ثار", "انتقام", "الانتقام", "سننتقم", "لن يمر", "توعد", "تتوعد", "يتوعد", "النفير", "استنفار", "عمليه نوعيه", "عمليات فدائيه", "فدائي", "المقاومه ستر", "رساله للاحتلال", "حي على الجهاد", "استهداف المستوطنين", "اضربوا"] },
  { id: "operations", name: "Attacks on Israelis, praised or told", area: "both", words: ["عمليه الخليل", "منفذ العمليه", "منفذي العمليه", "منفذو العمليه", "منفذا العمليه", "الشهيدان", "الشهيدين", "عمليه اطلاق نار", "عمليه طعن", "عمليه دهس", "عمليه بطوليه", "عمليه فدائيه", "كمين", "اشتباك مسلح", "اشتباكات مسلحه", "الاشتباك", "مقتل جندي", "مقتل جنديين", "مقتل مستوطن", "قتلى في صفوف", "ابطال", "المقاومين", "المقاومه", "كتيبه جنين", "كتيبه طولكرم", "عرين الاسود", "سرايا القدس", "كتائب القسام", "القسام"] },
  { id: "demolitions", name: "Demolitions and notices", area: "both", words: ["هدم", "الهدم", "هدم منزل", "هدم منازل", "عمليات الهدم", "اخطار هدم", "اخطارات", "اخطارات هدم", "جرافات الاحتلال", "الجرافات", "تجريف", "دون ترخيص", "بحجه البناء", "مصادره", "مصادره اراضي", "الاستيلاء على", "وضع اليد"] },
  { id: "missing", name: "Missing people and appeals", area: "gaza", words: ["مفقود", "مفقوده", "المفقودين", "تائه", "تايه", "عثر على", "تم العثور", "من يعرف", "من لديه معلومات", "مناشده", "نناشد", "اناشد", "استغاثه", "حاله انسانيه", "بحاجه ماسه", "علاج بالخارج", "تحويله طبيه"] },
  { id: "prisoners", name: "Prisoners", area: "both", words: ["الاسرى", "الاسير", "اسير", "اسيرات", "الافراج", "الافراج عن", "محرر", "المحررين", "صفقه", "سجن", "سجون الاحتلال", "عوفر", "النقب", "مجدو", "الاعتقال الاداري", "نادي الاسير", "هيئه الاسرى", "زياره الاسرى"] },
  { id: "students", name: "Students and universities", area: "both", words: ["الجامعه", "جامعه", "طلاب", "الطلاب", "الطلبه", "مجلس الطلبه", "الكتله الاسلاميه", "الشبيبه", "انتخابات مجلس", "التعليم", "المدارس", "المدرسه", "الدوام", "التوجيهي", "امتحانات", "التعليم الالكتروني", "منحه دراسيه"] },
  { id: "israel_politics", name: "Reaction to Israeli decisions", area: "both", words: ["نتنياهو", "سموتريتش", "بن غفير", "كاتس", "الكابينت", "حكومه الاحتلال", "الكنيست", "الانتخابات الاسرائيليه", "قرار الاحتلال", "ضم", "السياده", "اغلاق شامل", "طوق امني", "الاعلام العبري", "القناه 12", "القناه 14", "يديعوت"] },
  { id: "health", name: "Health and hospitals", area: "both", words: ["مستشفى", "المستشفى", "المستشفيات", "مجمع ناصر", "الشفاء", "المعمداني", "شهداء الاقصى", "العياده", "الادويه", "دواء", "نقص الادويه", "مرضى", "الكلى", "السرطان", "وباء", "امراض", "التطعيم", "الهلال الاحمر", "اسعاف", "الاسعاف"] },
  { id: "utilities", name: "Water, power, fuel and gas", area: "both", words: ["المياه", "مياه", "تحليه", "الكهرباء", "كهرباء", "الطاقه الشمسيه", "الوقود", "السولار", "البنزين", "الغاز", "غاز الطهي", "كشف الغاز", "جره غاز", "اسطوانه", "الحطب", "انقطاع", "جدول المياه", "الصرف الصحي"] },
  { id: "crime", name: "Crime, thefts and disputes", area: "both", words: ["سرقه", "سرقات", "لصوص", "سطو", "قتل", "جريمه", "جريمه قتل", "طعن", "شجار", "مشاجره", "ابتزاز", "احتيال", "نصب", "تاجر مخدرات", "مخدرات", "الشرطه تقبض"] },
  { id: "dayafter", name: "Reconstruction, Board of Peace, the committee", area: "gaza", words: ["اعاده الاعمار", "الاعمار", "مجلس السلام", "ملادينوف", "اللجنه الاداريه", "لجنه اداره غزه", "لجنه التكنوقراط", "القوه الدوليه", "قوات دوليه", "قوه الاستقرار", "اليوم التالي", "المرحله الثانيه", "نزع السلاح", "تسليم السلاح", "ترامب", "خطه ترامب"] },
  { id: "leaving", name: "Leaving Gaza", area: "gaza", words: ["الهجره", "هجره", "السفر للخارج", "مغادره غزه", "التهجير", "تهجير", "التنسيقات", "تنسيق السفر", "شركه هلا", "لم الشمل", "فيزا", "تأشيره", "المغادرين", "شركه هلا"] },
];

/** A word's forms with its joined prefixes off: "والمستوطنين" is "مستوطنين", "بالخيام" is "خيام". */
function forms(token: string): string[] {
  const out = new Set([token]);
  if (/^[وف]../.test(token)) out.add(token.slice(1));
  for (const v of [...out]) for (const p of ["ال", "بال", "لل", "كال", "وال", "فال", "وبال"]) if (v.startsWith(p) && v.length > p.length + 1) out.add(v.slice(p.length));
  return [...out];
}
/** A keyword as the text must hold it: one word as a whole word in any of its forms, a phrase as it is. */
type Key = { phrase: string } | { word: string };
const keyOf = (w: string): Key => {
  const p = plainArabic(w).trim();
  return /\s|#/.test(p) || !/[؀-ۿ]/.test(p) ? { phrase: p } : { word: p.startsWith("ال") && p.length > 3 ? p.slice(2) : p };
};
const TOPIC_KEYS = TOPICS.map((t) => ({ t, k: t.words.map(keyOf) }));
/** A post's topics: those it has a keyword of. */
export function topicsOf(text: string): string[] {
  const p = plainArabic(text);
  const words = new Set<string>();
  for (const tk of p.split(/[^\p{L}\p{N}]+/u)) if (tk) for (const f of forms(tk)) words.add(f);
  return TOPIC_KEYS.filter(({ k }) => k.some((x) => ("word" in x ? words.has(x.word) : p.includes(x.phrase)))).map(({ t }) => t.id);
}

const GAZA_WORDS = ["غزه", "خانيونس", "خان يونس", "رفح", "دير البلح", "النصيرات", "البريج", "المغازي", "الزوايده", "جباليا", "بيت لاهيا", "بيت حانون", "المواصي", "الشجاعيه", "الزيتون", "تل الهوى", "الشاطئ", "الرمال", "القطاع"].map(plainArabic);
const JS_WORDS = ["الضفه", "جنين", "نابلس", "طولكرم", "نور شمس", "طوباس", "الفارعه", "قلقيليه", "سلفيت", "رام الله", "البيره", "بيت لحم", "الخليل", "اريحا", "يطا", "قباطيه", "بلاطه", "القدس", "الاغوار", "مسافر يطا"].map(plainArabic);
/** The area a post is about: its words, else its channel's. */
export function areaOf(text: string, channel: WatchArea): WatchArea {
  const p = plainArabic(text);
  const g = GAZA_WORDS.some((w) => p.includes(w));
  const j = JS_WORDS.some((w) => p.includes(w));
  if (g && !j) return "gaza";
  if (j && !g) return "js";
  return channel;
}

/** The places people name, for the map's talk layer: the towns, camps and neighbourhoods in both areas. */
export const TALK_PLACES: [string, string][] = [
  ["Gaza City", "مدينه غزه"], ["Khan Younis", "خانيونس"], ["Khan Younis", "خان يونس"], ["Rafah", "رفح"], ["Deir al-Balah", "دير البلح"], ["Nuseirat", "النصيرات"], ["Bureij", "البريج"], ["Maghazi", "المغازي"], ["Zawaida", "الزوايده"], ["Jabalia", "جباليا"], ["Beit Lahia", "بيت لاهيا"], ["Beit Hanoun", "بيت حانون"], ["Al Mawasi", "المواصي"], ["Shuja'iyya", "الشجاعيه"], ["Zeitoun", "الزيتون"], ["Tel al-Hawa", "تل الهوى"], ["Al-Shati camp", "مخيم الشاطئ"], ["Remal", "الرمال"],
  ["Jenin", "جنين"], ["Nablus", "نابلس"], ["Tulkarm", "طولكرم"], ["Nur Shams", "نور شمس"], ["Tubas", "طوباس"], ["Far'a camp", "الفارعه"], ["Qalqilya", "قلقيليه"], ["Salfit", "سلفيت"], ["Ramallah", "رام الله"], ["Al-Bireh", "البيره"], ["Bethlehem", "بيت لحم"], ["Hebron", "الخليل"], ["Jericho", "اريحا"], ["Yatta", "يطا"], ["Qabatiya", "قباطيه"], ["Balata", "بلاطه"], ["Jerusalem", "القدس"], ["Beita", "بيتا"], ["Turmus Ayya", "ترمسعيا"], ["Al-Mughayyir", "المغير"], ["Masafer Yatta", "مسافر يطا"], ["Dura", "دورا"], ["Beit Ummar", "بيت امر"],
].map(([n, a]) => [n, plainArabic(a)]);
export function placesTalked(text: string): string[] {
  const p = plainArabic(text);
  return [...new Set(TALK_PLACES.filter(([, a]) => p.includes(a)).map(([n]) => n))];
}

/** "12.3K" → 12300. */
export function viewsOf(s: string): number {
  const m = /([\d.,]+)\s*([KkMm])?/.exec(String(s || ""));
  if (!m) return 0;
  const n = Number(m[1].replace(/,/g, ""));
  return Math.round(n * (/[Kk]/.test(m[2] ?? "") ? 1e3 : /[Mm]/.test(m[2] ?? "") ? 1e6 : 1));
}

const decode = (s: string) =>
  s.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** A channel's public page as posts: link, time, text, views, and whether it has a picture or video. */
export function parseWatchPage(html: string, ch: { id: string; area: WatchArea }): WatchPost[] {
  const out: WatchPost[] = [];
  for (const block of String(html || "").split(/(?=<div class="tgme_widget_message_wrap)/)) {
    const post = /data-post="([^"]+)"/.exec(block)?.[1];
    const at = /<time datetime="([^"]+)"/.exec(block)?.[1];
    if (!post || !at) continue;
    const textHtml = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? "";
    const x = decode(textHtml).trim();
    const media = /tgme_widget_message_(?:photo|video)/.test(block);
    if (!x && !media) continue;
    const v = viewsOf(/<span class="tgme_widget_message_views">([^<]*)<\/span>/.exec(block)?.[1] ?? "");
    out.push({ u: `https://t.me/${post}`, at: new Date(at).toISOString(), ch: ch.id, a: areaOf(x, ch.area), t: topicsOf(x), x: x.slice(0, 400), v, ...(media ? { m: 1 as const } : {}) });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The summary the tab shows.
 * ------------------------------------------------------------------ */

const H = 3600_000;
/** One hour's counts: "area|topic" → posts, "area|*" → all posts. */
export type HourCounts = Record<string, number>;

export function countHour(posts: WatchPost[]): HourCounts {
  const c: HourCounts = {};
  const add = (k: string) => (c[k] = (c[k] ?? 0) + 1);
  for (const p of posts) {
    const areas = p.a === "both" ? ["gaza", "js"] : [p.a];
    for (const a of areas) {
      add(`${a}|*`);
      for (const t of p.t) add(`${a}|${t}`);
    }
  }
  return c;
}

export type TopicTrend = { id: string; name: string; call: boolean; now: number; usual: number; ratio: number; trend: "rising" | "falling" | "steady" | "new"; share: number };
export type AreaSummary = {
  area: "gaza" | "js";
  posts: number;
  topics: TopicTrend[];
  calls: WatchPost[];
  top: WatchPost[];
  places: { name: string; n: number }[];
  tags: { tag: string; n: number; isNew: boolean }[];
  hourly: number[];
};
export type WatchSummary = { at: string; windowHours: number; channels: number; areas: AreaSummary[] };

/**
 * The tab's summary: each area's topics in the last `win` hours against the same hours of the days before
 * (or the hours just before, while there are no earlier days), its calls, its most-read posts, the places
 * and new hashtags in its talk, and its posts an hour over the last day.
 */
export function summarise(posts: WatchPost[], counts: Record<string, HourCounts>, now: number, win = 3, channels = 0): WatchSummary {
  const hourKey = (t: number) => new Date(Math.floor(t / H) * H).toISOString().slice(0, 13);
  const sumHours = (from: number, hours: number, k: string) => {
    let n = 0;
    for (let i = 0; i < hours; i += 1) n += counts[hourKey(from + i * H)]?.[k] ?? 0;
    return n;
  };
  const start = now - win * H;
  // A day counts once the watch was reading in those hours of it.
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => Array.from({ length: win + 1 }, (_, i) => counts[hourKey(start - d * 24 * H + i * H)]).some(Boolean));
  const usualOf = (k: string) =>
    days.length ? days.reduce((s, d) => s + sumHours(start - d * 24 * H, win, k), 0) / days.length : sumHours(start - win * H, win, k);
  const areas: AreaSummary[] = (["gaza", "js"] as const).map((area) => {
    const mine = posts.filter((p) => (p.a === area || p.a === "both") && Date.parse(p.at) >= start);
    const all = Math.max(1, mine.length);
    const topics = TOPICS.filter((t) => t.area === area || t.area === "both").map((t) => {
      const n = mine.filter((p) => p.t.includes(t.id)).length;
      const usual = usualOf(`${area}|${t.id}`);
      const ratio = usual > 0 ? n / usual : n > 0 ? Infinity : 1;
      const trend: TopicTrend["trend"] = usual === 0 && n >= 3 ? "new" : n >= 3 && ratio >= 1.5 ? "rising" : usual >= 3 && ratio <= 0.6 ? "falling" : "steady";
      return { id: t.id, name: t.name, call: !!t.call, now: n, usual: Math.round(usual * 10) / 10, ratio: Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : 99, trend, share: Math.round((n / all) * 1000) / 10 };
    }).sort((a, b) => b.now - a.now);
    const callIds = new Set(TOPICS.filter((t) => t.call).map((t) => t.id));
    const rising = new Set(topics.filter((t) => t.trend === "rising" || t.trend === "new").map((t) => t.id));
    const score = (p: WatchPost) => Math.log10(1 + p.v) + (p.t.some((t) => rising.has(t)) ? 1 : 0) + (p.t.length ? 0.5 : -1);
    const calls = mine.filter((p) => p.t.some((t) => callIds.has(t))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 25);
    const seen = new Set<string>();
    const top = [...mine].sort((a, b) => score(b) - score(a)).filter((p) => {
      const k = plainArabic(p.x).slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 30);
    const placeN = new Map<string, number>();
    for (const p of mine) for (const n of placesTalked(p.x)) placeN.set(n, (placeN.get(n) ?? 0) + 1);
    const tagsOf = (ps: WatchPost[]) => {
      const m = new Map<string, number>();
      for (const p of ps) for (const t of new Set(p.x.match(/#[\p{L}\p{N}_]{3,}/gu) ?? [])) m.set(t, (m.get(t) ?? 0) + 1);
      return m;
    };
    const before = tagsOf(posts.filter((p) => (p.a === area || p.a === "both") && Date.parse(p.at) < start));
    const tags = [...tagsOf(mine)].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, n]) => ({ tag, n, isNew: !before.has(tag) }));
    const hourly = Array.from({ length: 24 }, (_, i) => counts[hourKey(now - (23 - i) * H)]?.[`${area}|*`] ?? 0);
    return { area, posts: mine.length, topics, calls, top, places: [...placeN].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, n]) => ({ name, n })), tags, hourly };
  });
  return { at: new Date(now).toISOString(), windowHours: win, channels, areas };
}
