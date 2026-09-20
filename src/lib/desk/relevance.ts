/**
 * ============================================================================
 *  THE INTEREST GATE — deciding what is actually worth putting on the desk
 * ============================================================================
 *
 * WHAT CHANGED, AND WHY
 * ---------------------
 * This used to be an ALLOW-LIST: an item had to match a known pattern to
 * survive, so anything phrased in words nobody had listed died by default. No
 * amount of adding keywords fixes that — it is structural. Measured against
 * real traffic it kept 25% of what it should have, and lost every
 * source-based exclusive.
 *
 * But the catalogue is not self-filtering either. Al Jazeera, Reuters and CNN
 * are overwhelmingly about other things, and even the Houthi-aligned channels
 * post rallies, sermons and ceremonial notices. Carrying everything drowns the
 * desk in Gaza and Lebanon.
 *
 * So the gate now SCORES rather than filters, and answers with three outcomes:
 *
 *   feed    — carry it
 *   tray    — plausibly relevant, not established. Held out of the feed,
 *             promoted if corroboration arrives, never silently binned.
 *   exclude — matched a specific, named exclusion.
 *
 * Four things make it work:
 *
 *   1. PER-SOURCE THRESHOLDS. The Houthi military spokesman is almost purely
 *      on-topic; Reuters is a broad wire. One global bar cannot serve both.
 *   2. GRADED TOPICALITY, scored separately from interest. "Is this our war"
 *      and "how important is it" are different questions.
 *   3. FRAME AWARENESS. Gaza named BY a party to this war, tying fronts
 *      together, is ours. Gaza as the subject is not. Same word, opposite
 *      verdicts — so the rule keys on what else is present, not on the word.
 *   4. ARABIC NORMALISATION, so an unlisted spelling of a listed word still
 *      matches. This is what stops "we didn't write that exact form" losses.
 *
 * ---------------------------------------------------------------------------
 * THE TRAP THIS FILE EXISTS TO REMEMBER
 * ---------------------------------------------------------------------------
 * The single most expensive mistake this desk made was reading
 *
 *   "نشاط مكثف لطائرات المراقبة والإنذار المبكر السعودية من طرازي
 *    King Air 350i وSaab 2000، مع تحليق 4 طائرات في الوقت نفسه"
 *
 * as "alerts in Saudi Arabia". It is nothing of the kind: routine surveillance
 * and airborne early-warning patrols, tracked by flight spotters. الإنذار
 * المبكر means "early warning", and it modifies طائرات — aircraft — not
 * صفارات — sirens. So:
 *
 *   AIR-DEFENCE ALERT  requires siren vocabulary plus a named city → news
 *   AIRCRAFT ACTIVITY  types, orbits, tail numbers, ADS-B         → noise
 *
 * Aircraft spotting becomes news only when something happens to or from the
 * aircraft: a shoot-down, a crash, a strike flown from it, a first deployment.
 */

import { type Place, placesIn } from "./gazetteer.ts";
import { neutralise } from "./wire-style.ts";

export type Outcome = "feed" | "tray" | "exclude";

export type Verdict = {
  /** feed / tray / exclude. */
  outcome: Outcome;
  /** True only for `feed`. Kept so callers that just want "carry it" still work. */
  keep: boolean;
  /** Stable slug shown in the scan box, e.g. "air-activity", "rally", "off-topic". */
  reason: string;
  /** Human sentence for the scan box tooltip. */
  note: string;
  /** 0–100 interest. Drives feed ordering and the confidence figure. */
  score: number;
  /** 0–100 confidence that this is about our conflict at all. */
  topicality: number;
  tags: string[];
  places: Place[];
  /** Source text is short / garbled / hashtag soup — compose with maximum hedging. */
  unclear: boolean;
};

/* ------------------------------------------------------------------ *
 * Arabic normalisation
 *
 * Source text arrives with inconsistent orthography: hamza forms, ta marbuta
 * vs ha, alif maqsura vs ya, diacritics, tatweel. Matching raw meant listing
 * every spelling of every word. Normalising once means listing one.
 * ------------------------------------------------------------------ */

export function normaliseArabic(s: string): string {
  return String(s || "")
    .replace(/[ً-ْٰـ]/g, "") // harakat, dagger alif, tatweel
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ -> ا
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/ة/g, "ه") // ة -> ه
    .replace(/ؤ/g, "و") // ؤ -> و
    .replace(/ئ/g, "ي") // ئ -> ي
    .toLowerCase();
}

/* ------------------------------------------------------------------ *
 * Entities — written against NORMALISED text
 * ------------------------------------------------------------------ */

/** Unmistakably this war. */
const CONFLICT_CORE =
  /يمن|حوث|انصار ?الله|صنعا|مارب|تعز|الحديده|حديده|عدن|صعده|الجوف|الضالع|لحج|المخا|ميون|باب ?المندب|شبوه|حضرموت|البيضا|ابين|المهره|ريما|المحويت|ذمار|حجه|يمني|yemen|houthi|sanaa|sana'a|marib|taiz|hodeidah|hudaydah|aden|saada|al-?jawf|al-?dhale|lahj|mocha|mayun|bab ?al-?mandab|bab ?el-?mandeb|ansar ?allah/;

/** Saudi Arabia: a party to this war, and its home front. */
const SAUDI =
  /السعودي|السعوديه|الرياض|جده|مكه|الطايف|الطائف|ينبع|جازان|جيزان|نجران|خميس ?مشيط|ابها|العلا|الخرج|فرسان|شروره|المدينه ?المنوره|ارامكو|التحالف|saudi|riyadh|jeddah|jizan|jazan|najran|abha|khamis|yanbu|aramco|al-?ula|al-?kharj|sharurah|farasan|coalition/;

/** The maritime and energy dimension. */
const MARITIME =
  /البحر ?الاحمر|باب ?المندب|الملاحه|ناقله|ناقلات|سفينه|سفن|ميناء|موانئ|خليج ?عدن|قناه ?السويس|انبوب|نفط|خام|red ?sea|gulf ?of ?aden|shipping|tanker|vessel|merchant ?ship|ukmto|suez|pipeline|crude|port|terminal/;

/**
 * Parties to this conflict, and the governments that act on it.
 * Deliberately wide: the previous list knew only Yemeni factions plus a
 * handful of US names, so every Iranian, Turkish, Pakistani and European
 * statement was thrown away as having no actor.
 */
const ACTOR_GROUPS: { id: string; re: RegExp }[] = [
  {
    id: "houthi",
    re: /حوث|انصار ?الله|عبدالملك|سريع|عبدالسلام|المرتضي|المشاط|المسيره|houthi|ansar ?allah|saree|abdulsalam/,
  },
  {
    id: "yemen-gov",
    re: /العليمي|طارق ?صالح|العمالقه|درع ?الوطن|حراس ?الجمهوريه|المقاومه ?الوطنيه|الانتقالي|الجيش ?اليمني|القوات ?المسلحه ?اليمنيه|الشرعيه|مجلس ?القياده|al-?alimi|tareq ?saleh|giants ?brigades|\bstc\b|yemeni ?(?:government|army|forces)/,
  },
  {
    // Saudi OFFICIALS, not the country. "Saudi Arabia" is already a party and a
    // place signal; counting the bare country name here again double-scored it,
    // which pushed loosely-related shipping items into the feed.
    id: "saudi",
    re: /بن ?سلمان|فيصل ?بن ?فرحان|التحالف|وزاره ?الدفاع ?السعوديه|المالكي|الخارجيه ?السعوديه|الحكومه ?السعوديه|bin ?salman|coalition|saudi ?(?:government|officials?|defence|defense|foreign ?ministry|military)/,
  },
  {
    id: "iran",
    re: /ايران|طهران|خامنئي|بزشكيان|عراقجي|الحرس ?الثوري|فيلق ?القدس|قااني|iran|tehran|khamenei|pezeshkian|araghchi|irgc|revolutionary ?guard/,
  },
  {
    id: "turkey",
    re: /تركيا|انقره|اردوغان|فيدان|التركي|التركيه|turkey|turkish|ankara|erdogan|fidan/,
  },
  {
    id: "pakistan",
    re: /باكستان|اسلام ?اباد|نقوي|الباكستاني|الباكستانيه|pakistan|pakistani|islamabad/,
  },
  {
    id: "us",
    re: /واشنطن|البيت ?الابيض|الخارجيه ?الامريكيه|البنتاجون|ترامب|روبيو|فانس|الامريكي|الولايات ?المتحده|washington|white ?house|state ?department|pentagon|trump|rubio|vance|united ?states|american/,
  },
  {
    id: "europe",
    re: /الاتحاد ?الاوروبي|بروكسل|فرنسا|بريطانيا|لندن|باريس|المانيا|كالاس|الاوروبي|european ?union|brussels|france|britain|german|kallas/,
  },
  {
    id: "un",
    re: /غروندبرغ|مجلس ?الامن|الامم ?المتحده|المبعوث ?الاممي|الوساطه|الوسطاء|grundberg|security ?council|united ?nations|un ?envoy|mediat/,
  },
];

/**
 * How many distinct parties are named.
 *
 * Contact BETWEEN parties is what makes a diplomatic item matter: "Pakistan's
 * interior minister in Tehran" and "Qatar working with Tehran and Washington"
 * each name two blocs, and that is the signal — not any single word. Counting
 * groups rather than matching one big alternation is what lets the desk tell a
 * passing mention from a development.
 */
function actorGroupsIn(n: string): string[] {
  return ACTOR_GROUPS.filter((g) => g.re.test(n)).map((g) => g.id);
}

/** The diplomatic track this round turns on. */
const AGREEMENT =
  /اتفاق ?مكه|مفاوضات ?مكه|اعلان ?مكه|مكه ?للسلام|mecca ?(?:agreement|accord|declaration|talks)/;

/**
 * Other theatres. These are only a penalty when nothing ties the item to our
 * war — a Houthi or Iranian official invoking Gaza to link the fronts IS ours.
 */
const COMPETING_THEATRE =
  /غزه|القطاع|الاقصي|القدس|الضفه|رام ?الله|اسراييل|اسرائيل|لبنان|حزب ?الله|الضاحيه|اوكرانيا|السودان|ليبيا|الصومال|كردستان|اربيل|سوريا|دير ?الزور|يونيفيل|gaza|al-?aqsa|jerusalem|west ?bank|ramallah|israel|lebanon|hezbollah|ukraine|sudan|libya|somalia|kurdistan|erbil|syria|unifil/;

/** Observable consequences. A channel breaking news rarely uses doctrinal words first. */
const OBSERVABLE =
  /دخان|حريق|حرايق|نيران|انفجار|انفجارات|دوي|اعمده ?دخان|السنه ?اللهب|اسعاف|الدفاع ?المدني|هلع|اضويه|قذيفه|شظايا|smoke|fire|flames|blast|explosion|ambulance|civil ?defen[cs]e|debris|shrapnel/;

const SIREN =
  /صفارات|صافرات|صفاره|صافره|دوي ?صفار|انذار ?جوي|air[- ]?raid ?(?:siren|alert)|\bsirens?\b|all-?clear/;

const KINETIC =
  /صاروخ|صواريخ|باليست|مسير|مسيره|درون|قصف|غاره|غارات|استهدف|اشتباك|اشتباكات|معارك|مواجهات|اسقط|اسقاط|سيطر|استعاد|تفجير|انفجار|هجوم|مدفعيه|هاون|راجمات|كمين|تقدم ?ميداني|جبهه|جبهات|missile|drone|\buav\b|air ?strike|airstrike|shell(?:ed|ing)|clash|seiz(?:e|ed)|retook|retake|intercept|shot ?down|attack|artillery|mortar|front ?line|offensive/;

const WEAPON =
  /باليست|مجنح|فرط ?صوتي|مسير|مسيره|درون|صاروخ|مدفعيه|هاون|لغم|الغام|راجمات|ballistic|cruise|hypersonic|drone|\buav\b|missile|artillery|mortar|mine|f-?15|f-?16|f-?35|typhoon/;

const COUNT = /\b\d{1,6}\b/;

/**
 * Exclusive and source-based reporting — category (c).
 *
 * Deliberately broad: missing one of these loses a scoop, and there are many
 * ways to write it in both languages. Self-attribution ("sources told
 * «Al-Akhbar»") is the strongest signal there is, because the outlet is naming
 * itself as the recipient.
 */
const EXCLUSIVE = new RegExp(
  [
    // Explicit markers
    "حصري|خاص ?بـ|خاص ?ل|\\bخاص\\b|\\bexclusive\\b",
    // Arabic attribution
    "مصادر|مصدر|مصادر ?مطلعه|مصادر ?خاصه|مصادر ?مسيوله|مصادر ?مقربه|مصادر ?دبلوماسيه|مصادر ?عسكريه",
    "معلومات|معطيات|علمت|علم ?من|كشفت|كشف ?ل|افادت ?مصادر|وفق ?مصادر|بحسب ?مصادر|نقلا ?عن ?مصادر|اوساط ?مطلعه",
    // English attribution
    "sources? (?:told|said|say|familiar)|officials? (?:told|said|say|briefed)",
    "people (?:familiar|briefed)|a person (?:familiar|briefed)|according to (?:people|sources|officials)",
    "first reported|obtained by|has (?:seen|learned|reviewed)|learned that|briefed on",
  ].join("|"),
);

/* ------------------------------------------------------------------ *
 * Exclusions — ordered, first match wins
 * ------------------------------------------------------------------ */

type NoiseRule = { id: string; note: string; re: RegExp; unless?: RegExp };

/** Aircraft spotting and patrol activity — not an alert, not an event. */
const AIR_ACTIVITY =
  /طايرات ?(?:المراقبه|الاستطلاع|الانذار|الدعم|التزود)|طايره ?(?:مراقبه|استطلاع|انذار)|الانذار ?المبكر ?السعودي|تحليق|طلعات|من ?طراز|king ?air|saab ?2000|beechcraft|rc-?135|e-?3|awacs|p-?8|kc-?130|\bisr (?:flight|aircraft|orbit)\b|ads-?b|flight ?radar|flightradar|orbit(?:ing|ed)? ?over|\bcallsign\b|tail ?number/;

/** Something actually happened to or from the aircraft — keeps it in play. */
const AIR_EVENT =
  /اسقط|اسقاط|تحطم|سقوط ?طايره|shot ?down|downed|crash(?:ed)?|wreckage|struck|strike|غاره|قصف|هجوم|first (?:ever )?(?:deployment|sortie)|للمره ?الاولي/;

const NOISE: NoiseRule[] = [
  {
    id: "air-activity",
    note: "Surveillance or early-warning aircraft flying patrols. Routine air activity, not an alert or a strike.",
    re: AIR_ACTIVITY,
    unless: AIR_EVENT,
  },
  {
    id: "sport",
    note: "Sport.",
    re: /كره ?القدم|مباراه|مباريات|الدوري|المنتخب|ديربي|هدف ?في ?مرمي|football|soccer|\bmatch\b|league ?table|olympic|derby/,
  },
  {
    id: "rally",
    note: "Rally, march or demonstration. Mobilisation theatre, not a battlefield or policy development.",
    re: /مسيرات ?جماهيريه|مسيره ?حاشده|مسيرات|تظاهرات|مليونيه|خروج ?شعبي|وقفه ?احتجاجيه|حشود|\brall(?:y|ies)\b|\bmarch(?:es)?\b|demonstration/,
    // NOT "مسير" for drone: normalisation strips the shadda from مسيّر, and the
    // result is a substring of مسيرات (marches), so every rally would escape.
    unless: /صاروخ|غاره|جبهه|استهدف|اشتباك|قصف|درون|missile|strike|clash|drone/,
  },
  {
    id: "ceremony",
    note: "Ceremonial or administrative occasion — a speech event, opening, seminar or commemoration.",
    re: /فعاليه ?خطابيه|فعاليه ?بمناسبه|ندوه|ورشه ?عمل|حفل ?تكريم|تدشين|افتتاح ?معرض|اجتماع ?دوري|زياره ?تفقديه|يتفقد|العيد ?ال|ذكري ?ثوره|ثوره ?21 ?سبتمبر|بمناسبه ?ذكري|الذكري ?السنويه|anniversary ?of|commemorat|inaugurat|ceremony/,
    unless: /صاروخ|غاره|اشتباك|قصف|جبهه|strike|missile|clash/,
  },
  {
    id: "admin",
    note: "Administrative, civil-service or local-government news: salaries, exams, budgets, service projects.",
    re: /الرواتب|صرف ?المرتبات|الامتحانات|الاختبارات|العام ?الدراسي|جدول ?مواعيد|انقطاع ?الكهربا|رسوم|جوازات|الاحوال ?المدنيه|المشاريع ?الخدميه|التنمويه|الزراعيه|خطه ?تنفيذ|مناقشه ?تقييم|برياسه ?المحافظ|اجتماع ?بمحافظه|الموازنه|civil ?service ?pay|school ?year|exam ?results|development ?projects/,
    unless: /جبهه|صاروخ|غاره|اشتباك|قصف|strike|missile|front ?line/,
  },
  {
    id: "crime",
    note: "Crime blotter, court or traffic item with no bearing on the conflict.",
    re: /سجين|قصاص|اوليا ?الدم|جنبيه|حادث ?مروري|سرقه|المحكمه ?الجزاييه|traffic ?accident|court ?sentenced/,
    unless: /جبهه|صاروخ|غاره|اشتباك|مسير|strike|missile|front/,
  },
  {
    id: "prices",
    note: "Commodity or currency prices with no link to the conflict's energy or shipping story.",
    re: /اسعار ?الذهب|سعر ?الصرف|اسعار ?العملات|الريال ?اليمني|gold ?price|exchange ?rate/,
    unless: /نفط|خام|برنت|ناقله|شحن|oil|crude|brent|tanker|shipping|aramco/,
  },
  {
    id: "weather",
    note: "Weather or seasonal forecast.",
    re: /الامطار|حاله ?الطقس|الارصاد|منخفض ?جوي|weather ?forecast|rainfall|cyclone ?warning/,
    unless: /غاره|صاروخ|اشتباك|strike|missile/,
  },
  {
    id: "religion",
    note: "Sermon, prayer or religious observance coverage.",
    re: /خطبه ?الجمعه|صلاه ?الجمعه|المولد ?النبوي|شهر ?رمضان|الحج ?والعمره|sermon|friday ?prayers/,
    unless: /صاروخ|غاره|اشتباك|استهدف|missile|strike/,
  },
  {
    id: "opinion",
    note: "Opinion, column or think-piece rather than reporting.",
    re: /^\s*(?:مقال|راي|تحليل|وجهه ?نظر)\b|\bop-?ed\b|\bopinion\b\s*[|:]|column(?:ist)?\b/,
  },
  {
    id: "press-review",
    note: "Press review or headline round-up — no new reporting of its own.",
    re: /ابرز ?عناوين ?الصحف|عناوين ?الصحف|الصحافه ?اليوم|press ?review|what ?the ?papers ?say|morning ?briefing/,
  },
  {
    id: "obituary",
    note: "Funeral or condolence coverage without an operational account.",
    re: /تشييع|جثمان|العزا|نقل ?جثمان|funeral|laid ?to ?rest|condolence/,
    unless: /قتل ?في|اشتباك|غاره|قصف|killed ?in/,
  },
];

export const NOISE_REASONS = [
  ...NOISE.map((r) => ({ id: r.id, note: r.note })),
  {
    id: "off-topic",
    note: "Nothing ties the item to this conflict or to a party to it.",
  },
  {
    id: "other-theatre",
    note: "The item is about a different theatre and only borrows the same vocabulary.",
  },
  {
    id: "empty",
    note: "Too little text to say anything at all — no place, no actor, no action.",
  },
  {
    id: "tray",
    note: "Plausibly relevant but not established. Held for corroboration rather than dropped.",
  },
];

/* ------------------------------------------------------------------ *
 * Per-source thresholds
 *
 * The cheapest large accuracy win: the Houthi military spokesman is almost
 * purely on-topic, Reuters is a broad wire. One global bar cannot serve both.
 * ------------------------------------------------------------------ */

export type Breadth = "focused" | "mixed" | "wire";

/** Sources whose output is mostly this conflict. */
const FOCUSED_SRC =
  /almashhad|المشهد|saba|سبا|masirah|المسيره|sabereen|صابرين|saree|mihwar|المحور|ali ?bk|shajab|bin ?saeed|naya|shin ?persian|al-?aqsa|abdulsalam|\bspa\b|septemberne|ypa|al-?thawrah/i;

/** Broad regional outlets: much of their output is other files. */
const MIXED_SRC =
  /jazeera|جزيره|al-?araby|العربي|hadath|الحدث|arabiya|العربيه|aawsat|asharq|الشرق|akhbar|الاخبار|erem|ارم|alhurra|الحره|arab ?news/i;

export function breadthOf(source: string): Breadth {
  if (FOCUSED_SRC.test(source)) return "focused";
  if (MIXED_SRC.test(source)) return "mixed";
  return "wire";
}

/** Topicality needed to reach the feed, and to reach the tray. */
const THRESHOLD: Record<Breadth, { feed: number; tray: number }> = {
  focused: { feed: 30, tray: 15 },
  mixed: { feed: 50, tray: 25 },
  wire: { feed: 45, tray: 22 },
};

/* ------------------------------------------------------------------ *
 * Clarity
 * ------------------------------------------------------------------ */

/** Strip the furniture a Telegram post carries so we can see how much text is left. */
function contentOnly(text: string): string {
  return String(text || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@][\w؀-ۿ_]+/g, " ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️‍]/gu, " ")
    .replace(/[|•·▪◾➖➡🔻🔺]+/g, " ")
    .replace(/\b(?:عاجل|هام|مباشر|خاص|breaking|urgent|update|live)\b\s*[:|-]?/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * How much is actually here.
 *
 * `unclear` no longer means dropped. A three-word post naming a city and an
 * observable — "smoke over Riyadh" — is a lead, and the channels that break
 * news fastest write exactly that. It is published with the strongest hedge
 * and a low confidence figure instead of being thrown away. Only a post with
 * nothing in it at all is `empty`.
 */
function assessClarity(text: string): { unclear: boolean; empty: boolean } {
  const core = contentOnly(text);
  if (core.length < 12) return { unclear: true, empty: true };
  const words = core.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 3) return { unclear: true, empty: true };
  const punctRatio = (core.match(/[^\p{L}\p{N}\s]/gu) || []).length / core.length;
  if (punctRatio > 0.45) return { unclear: true, empty: true };
  const distinct = new Set(words.map((w) => w.toLowerCase()));
  if (words.length >= 5 && distinct.size <= Math.ceil(words.length / 3)) {
    return { unclear: true, empty: true };
  }
  return { unclear: core.length < 70, empty: false };
}

/* ------------------------------------------------------------------ *
 * The gate
 * ------------------------------------------------------------------ */

export type GateInput = {
  text: string;
  source: string;
  url: string;
  agency: boolean;
  /** Override the source's breadth class. Mostly for tests. */
  breadth?: Breadth;
};

export function gate(input: GateInput): Verdict {
  const raw = String(input.text || "");
  const n = normaliseArabic(neutralise(raw));
  const tags: string[] = [];
  const places = placesIn(raw);
  const breadth = input.breadth ?? breadthOf(input.source);

  const out = (
    outcome: Outcome,
    reason: string,
    note: string,
    score = 0,
    topicality = 0,
    unclear = false,
  ): Verdict => ({
    outcome,
    keep: outcome === "feed",
    reason,
    note,
    score,
    topicality,
    tags,
    places,
    unclear,
  });

  /* 1. Is there anything here at all? ------------------------------ */
  const clarity = assessClarity(raw);

  /* 2. Named exclusions -------------------------------------------- */
  // Siren language beats the aircraft rule: early-warning SIRENS are an event,
  // early-warning AIRCRAFT are not.
  const isSiren = SIREN.test(n);
  for (const rule of NOISE) {
    if (rule.id === "air-activity" && isSiren) continue;
    if (!rule.re.test(n)) continue;
    if (rule.unless && rule.unless.test(n)) continue;
    return out("exclude", rule.id, rule.note);
  }

  /* 3. Topicality --------------------------------------------------- */
  const hasCore = CONFLICT_CORE.test(n);
  const hasSaudi = SAUDI.test(n);
  const hasMaritime = MARITIME.test(n);
  const groups = actorGroupsIn(n);
  const hasActor = groups.length > 0;
  const hasAgreement = AGREEMENT.test(n);
  const hasCompeting = COMPETING_THEATRE.test(n);
  const observable = OBSERVABLE.test(n);
  const kinetic = KINETIC.test(n);
  const yemeniPlace = places.some((p) => p.country === "Yemen");
  const saudiPlace = places.some((p) => p.country === "Saudi Arabia");

  let topicality = 0;
  if (hasCore) topicality += 55;
  if (yemeniPlace) topicality += 25;
  if (hasAgreement) topicality += 45;
  if (hasSaudi) topicality += hasCore ? 5 : 22;
  if (saudiPlace && (observable || kinetic || isSiren)) topicality += 22;
  if (hasMaritime) topicality += hasCore ? 5 : 18;
  if (hasActor) topicality += hasCore ? 8 : 24;
  // Contact between parties is the development; one party merely mentioned is not.
  if (groups.length > 1) topicality += Math.min(16, (groups.length - 1) * 8);
  if (kinetic || isSiren) topicality += 8;

  /**
   * Frame awareness. Another theatre is a penalty only when nothing ties the
   * item to our war. A Houthi or Iranian official invoking Gaza to link the
   * fronts names the same word for the opposite reason, and the presence of a
   * conflict-core entity is what tells the two apart.
   */
  if (hasCompeting && !hasCore && !hasAgreement && !yemeniPlace) {
    topicality -= 55;
    tags.push("other-theatre");
  }

  topicality = Math.max(0, Math.min(100, topicality));

  /* 4. Tags and interest -------------------------------------------- */
  if (places.length) tags.push("place");
  if (WEAPON.test(n)) tags.push("weapon");
  if (COUNT.test(n)) tags.push("figures");
  if (hasActor) tags.push("actor");
  if (kinetic) tags.push("kinetic");
  if (isSiren) tags.push("alert");
  if (observable) tags.push("observable");
  if (hasMaritime) tags.push("maritime");
  if (hasAgreement) tags.push("agreement");
  if (EXCLUSIVE.test(n)) tags.push("exclusive");

  let score = 20;
  if (isSiren) score += 30;
  if (kinetic) score += 20;
  if (observable) score += 10;
  if (tags.includes("figures")) score += 10;
  if (tags.includes("weapon")) score += 10;
  if (tags.includes("place")) score += 10;
  if (tags.includes("exclusive")) score += 14;
  if (tags.includes("agreement")) score += 10;
  if (input.agency) score += 12;
  if (clarity.unclear) score -= 12;
  score = Math.max(1, Math.min(100, score));

  /* 5. Outcome ------------------------------------------------------ */
  const bar = THRESHOLD[breadth];

  // An empty post can still be a lead — but only if it reports something
  // happening. "عاجل | اليمن" names the theatre and says nothing; "smoke over
  // Riyadh" says what was seen. Topicality alone must not carry a bare tag.
  const reportsSomething = observable || kinetic || isSiren;
  if (clarity.empty && (!reportsSomething || topicality < bar.feed)) {
    return out(
      "exclude",
      "empty",
      "Too little in the post to say what happened — no place, no actor and no concrete action.",
      score,
      topicality,
      true,
    );
  }

  if (topicality >= bar.feed) {
    return out(
      "feed",
      "kept",
      clarity.unclear
        ? "Kept, but the source text is thin — published with the strongest hedge."
        : "Kept.",
      score,
      topicality,
      clarity.unclear,
    );
  }

  if (topicality >= bar.tray) {
    return out(
      "tray",
      "tray",
      "Plausibly about this conflict but not established — held for corroboration rather than dropped.",
      score,
      topicality,
      clarity.unclear,
    );
  }

  if (tags.includes("other-theatre")) {
    return out(
      "exclude",
      "other-theatre",
      "The item is about a different theatre and only borrows the same vocabulary.",
      score,
      topicality,
    );
  }

  return out(
    "exclude",
    "off-topic",
    "Nothing ties the item to this conflict or to a party to it.",
    score,
    topicality,
  );
}

/**
 * Does this item belong on the MAP, as opposed to only in the feed?
 * Only things that happened at a point on the ground or at sea get a pin.
 * Statements, diplomacy, economy and humanitarian items stay in the feed —
 * pinning a speech to a coordinate tells the reader something untrue.
 */
export function mapsAsPin(type: string): boolean {
  return type === "strike" || type === "combat" || type === "vessel" || type === "port";
}
