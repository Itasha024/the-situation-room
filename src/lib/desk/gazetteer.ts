/**
 * Canonical place gazetteer for the Yemen desk.
 *
 * One entry per place. `name` is the ONLY spelling that ever reaches the page —
 * standard English exonyms as used by Reuters / AP / AFP, so a reader who does not
 * know Arabic, Hebrew or the Yemeni map can still follow the copy.
 *
 * `aliases` are regex sources matching every spelling the desk might ingest:
 * Arabic (source language), English variants, and the legacy Hebrew transliterations
 * this desk used before the English rewrite (kept so old data.json rows migrate).
 *
 * This file is the single source of truth. `scripts/gen-gazetteer.mjs` emits
 * `public/gazetteer.json` from it for the browser bundle — never edit that by hand.
 */

export type PlaceKind =
  | "city"
  | "port city"
  | "town"
  | "governorate"
  | "district"
  | "island"
  | "islands"
  | "strait"
  | "hill"
  | "ridge"
  | "valley"
  | "area"
  | "front"
  | "square"
  | "site"
  | "country"
  | "camp"
  | "crossing"
  | "facility"
  | "sea";

export type Country = "Yemen" | "Saudi Arabia" | "Djibouti" | "sea";

export type Place = {
  /** Canonical English name — the only form ever published. */
  name: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  country: Country;
  /**
   * Full geographic locator, for the EXPANDED view only:
   * "Kahbub, a hill in Lahj governorate overlooking the Bab al-Mandab strait".
   * Omit for places an international reader already knows.
   *
   * This is deliberately not what the feed card shows. Glossing every place at
   * this length broke the copy apart — "Air strikes hit positions in Taiz, a
   * city and governorate in south-western Yemen, Al-Jawf and Marib" leaves the
   * reader unable to tell where the description ends and the target list
   * resumes. Cards use `shortWhere()` instead.
   */
  region?: string;
  /**
   * The card-length locator: "south-west Yemen", "Lahj governorate". Set this
   * only where `shortWhere()` derives something awkward from `region`.
   */
  where?: string;
  /** Widely known abroad — never glossed, never given a locator. */
  wellKnown?: boolean;
  /** Regex sources (case-insensitive) for Arabic / English / legacy Hebrew spellings. */
  aliases: string[];
  /** Uppercase dateline slug, wire style. Defaults to name.toUpperCase(). */
  dateline?: string;
};

/* ------------------------------------------------------------------ *
 * Yemen
 * ------------------------------------------------------------------ */

const YEMEN: Place[] = [
  {
    name: "Sanaa",
    lat: 15.3694,
    lng: 44.191,
    kind: "city",
    country: "Yemen",
    wellKnown: true,
    aliases: ["صنعاء", "العاصمة المحتلة", "Sana'?a", "Sanaa", "צנעאא?׳?", "צנעא"],
  },
  {
    name: "Azal",
    lat: 15.409,
    lng: 44.207,
    kind: "district",
    country: "Yemen",
    region: "in northern Sanaa",
    aliases: ["آزال", "ازال", "مديرية آزال", "Azal", "אזאל"],
    dateline: "SANAA",
  },
  {
    name: "Dhahr Himyar",
    lat: 15.412,
    lng: 44.208,
    kind: "area",
    country: "Yemen",
    region: "in the Azal district of Sanaa",
    aliases: ["ظهر حمير", "Dhahr Himyar", "דַ?׳?הר חִ?מְ?יַ?ר"],
    dateline: "SANAA",
  },
  {
    name: "Al-Sabeen Square",
    lat: 15.33,
    lng: 44.2,
    kind: "square",
    country: "Yemen",
    region: "the main rally ground in Sanaa",
    aliases: ["ميدان السبعين", "السبعين", "Al-?Sabeen", "אל?[־-]?סַ?בְ?ּ?עִ?ין", "אלסַ?בְ?ּ?עִ?ין"],
    dateline: "SANAA",
  },
  {
    name: "Saada",
    lat: 16.94,
    lng: 43.76,
    kind: "governorate",
    country: "Yemen",
    region: "in Yemen's far north, the Houthi heartland",
    aliases: ["صعدة", "Saada", "Sa'?dah", "Saadah", "סעדה"],
  },
  {
    name: "Hodeidah",
    lat: 14.8,
    lng: 42.95,
    kind: "port city",
    country: "Yemen",
    wellKnown: true,
    aliases: ["الحديدة", "Hodeidah", "Hudaydah", "Hodeida", "אל?[־-]?חודיידה", "אלחודיידה"],
  },
  {
    name: "Mocha",
    lat: 13.32,
    lng: 43.25,
    kind: "port city",
    country: "Yemen",
    region: "on Yemen's Red Sea coast",
    aliases: ["المخا", "المخاء", "Mocha", "Mokha", "al-?Makha", "אל?[־-]?מח׳א", "אלמח׳א", "המכא", "מוח׳א"],
  },
  {
    name: "Al-Hazm",
    lat: 16.16,
    lng: 44.78,
    kind: "city",
    country: "Yemen",
    region: "the capital of Al-Jawf governorate in Yemen's north-east",
    aliases: ["الحزم", "al-?Hazm", "אלחַ?זְ?ם"],
  },
  {
    name: "Al-Dhale",
    lat: 13.7,
    lng: 44.73,
    kind: "governorate",
    country: "Yemen",
    region: "in southern Yemen, north-west of Aden",
    aliases: ["الضالع", "Dhalea", "al-?Dhale", "Ad-?Dali", "אל?[־-]?דאלע", "אלדאלע"],
  },
  {
    name: "Al-Jawf",
    lat: 16.72,
    lng: 44.76,
    kind: "governorate",
    country: "Yemen",
    region: "in Yemen's north-east",
    aliases: ["الجوف", "al-?Jawf", "Jawf", "אל?[־-]?ג׳וף", "אלג׳וף"],
  },
  {
    name: "Marib",
    lat: 15.47,
    lng: 45.32,
    kind: "city",
    country: "Yemen",
    region: "a city and governorate in east-central Yemen, and the government's main northern stronghold",
    aliases: ["مأرب", "مارب", "Marib", "Ma'?rib", "מאריב"],
  },
  {
    name: "Taiz",
    lat: 13.58,
    lng: 44.02,
    kind: "city",
    country: "Yemen",
    region: "a city and governorate in south-western Yemen",
    aliases: ["تعز", "Taiz", "Ta'?izz", "תעז"],
  },
  {
    name: "Lahj",
    lat: 13.05,
    lng: 44.88,
    kind: "governorate",
    country: "Yemen",
    region: "in south-western Yemen, between Aden and Taiz",
    aliases: ["لحج", "Lahj", "Lahij", "לחג׳"],
  },
  {
    name: "Aden",
    lat: 12.79,
    lng: 45.02,
    kind: "port city",
    country: "Yemen",
    wellKnown: true,
    aliases: ["عدن", "Aden", "עדן"],
  },
  {
    name: "Ibb",
    lat: 13.97,
    lng: 44.18,
    kind: "governorate",
    country: "Yemen",
    region: "in Yemen's central highlands",
    aliases: ["إب", "\\bIbb\\b", "איב"],
  },
  {
    name: "Dhubab",
    lat: 12.94,
    lng: 43.41,
    kind: "district",
    country: "Yemen",
    region: "a coastal district beside the Bab al-Mandab strait",
    aliases: ["ذباب", "Dhubab", "ד׳ובאב"],
  },
  {
    name: "Mayun",
    lat: 12.65,
    lng: 43.414,
    kind: "island",
    country: "Yemen",
    region: "also known as Perim, the island that sits inside the Bab al-Mandab strait",
    aliases: ["ميون", "Mayun", "Mayyun", "Perim", "מַ?יוּ?ן", "מיון"],
  },
  {
    name: "Hanish Islands",
    lat: 13.706,
    lng: 42.724,
    kind: "islands",
    country: "Yemen",
    region: "off Yemen's Red Sea coast",
    aliases: ["حنيش", "Hanish", "חַ?ניש"],
  },
  {
    name: "Kamaran",
    lat: 15.35,
    lng: 42.59,
    kind: "island",
    country: "Yemen",
    region: "a Red Sea island off Hodeidah",
    aliases: ["كمران", "Kamaran", "כַ?מְ?רַ?אן", "כמראן"],
  },
  {
    name: "Kahbub",
    lat: 12.85,
    lng: 43.55,
    kind: "hill",
    country: "Yemen",
    region: "in Lahj governorate, overlooking the Bab al-Mandab strait",
    aliases: ["كهبوب", "كحبوب", "Kahbub", "Kahboub", "כַ?ּ?הבּ?וּ?ב", "כהבוב"],
  },
  {
    name: "Harib",
    lat: 14.93,
    lng: 45.5,
    kind: "district",
    country: "Yemen",
    region: "in southern Marib governorate",
    aliases: ["حريب", "Harib", "חַ?רִ?יב", "חריב"],
  },
  {
    name: "Murays",
    lat: 13.85,
    lng: 44.7,
    kind: "front",
    country: "Yemen",
    region: "in northern Al-Dhale governorate",
    aliases: ["مريس", "Murays", "Murais", "מֻ?רַ?יְ?ס"],
  },
  {
    name: "Al-Khokha",
    lat: 13.81,
    lng: 43.25,
    kind: "town",
    country: "Yemen",
    region: "on Yemen's Red Sea coast",
    aliases: ["الخوخة", "al-?Khokha", "Khokha", "אל?[־-]?ח׳וחה", "אלח׳וחה"],
  },
  {
    name: "Hays",
    lat: 13.98,
    lng: 43.33,
    kind: "town",
    country: "Yemen",
    region: "on the Red Sea coast south of Hodeidah",
    where: "on the Red Sea coast",
    aliases: ["حيس", "\\bHays\\b", "Hais", "חֵ?יס", "חַ?יְ?ס"],
  },
  {
    name: "Al-Bayda",
    lat: 13.99,
    lng: 45.57,
    kind: "governorate",
    country: "Yemen",
    region: "in central Yemen",
    aliases: ["البيضاء", "al-?Bayda", "אל?[־-]?ביידא", "אלביידא"],
  },
  {
    name: "Shabwa",
    lat: 14.55,
    lng: 46.83,
    kind: "governorate",
    country: "Yemen",
    region: "in eastern Yemen",
    aliases: ["شبوة", "Shabwa", "Shabwah", "שבְ?ּ?וה"],
  },
  {
    name: "Hadramawt",
    lat: 15.55,
    lng: 48.5,
    kind: "governorate",
    country: "Yemen",
    region: "Yemen's largest governorate, in the east",
    where: "eastern Yemen",
    aliases: ["حضرموت", "Hadramawt", "Hadhramaut", "Hadramout", "חצרמוות"],
  },
  {
    name: "Hajjah",
    lat: 15.69,
    lng: 43.6,
    kind: "governorate",
    country: "Yemen",
    region: "in north-western Yemen",
    aliases: ["حجة", "Hajjah", "Hajja", "חג׳ה"],
  },
  {
    name: "Al-Wazi'iyah",
    lat: 13.35,
    lng: 43.55,
    kind: "district",
    country: "Yemen",
    region: "in western Taiz governorate, towards the Red Sea coast",
    aliases: [
      "الوازعية",
      "al-?Wazi'?iyah",
      "Waziyah",
      "al-?Wazia",
      "אל?[־-]?ואזעיה",
      "אלואזעיה",
      "ואזעיה",
    ],
  },
  {
    name: "Bab al-Mandab",
    lat: 12.7,
    lng: 43.47,
    kind: "strait",
    country: "sea",
    // Named in every story this desk carries — glossing it on each mention
    // reads as padding, not help.
    wellKnown: true,
    aliases: [
      "باب المندب",
      "Bab al-?Mandab",
      "Bab el-?Mandeb",
      "Bab-?el-?Mandeb",
      "באב אל?[־-]?מַ?נדב",
      "באב אלמַ?נדב",
    ],
    dateline: "BAB AL-MANDAB",
  },
  {
    name: "Al-Aghbara",
    lat: 13.4,
    lng: 43.48,
    kind: "site",
    country: "Yemen",
    region: "at the edge of Al-Wazi'iyah district in western Taiz",
    where: "western Taiz",
    aliases: [
      "الأغبرة",
      "الاغبره",
      "الأغبره",
      "الاغبرة",
      "al-?Aghbara",
      "אל?[־-]?אַ?עְ?׳?בַ?ּ?רַ?ה",
      "אלאע׳ברה",
      "אַ?עְ?׳?בַ?ּ?רַ?ה",
    ],
  },
  {
    name: "Al-Mudaribah",
    lat: 13.15,
    lng: 43.9,
    kind: "area",
    country: "Yemen",
    region: "in Lahj governorate",
    aliases: ["المضاربه", "المضاربة", "al-?Mudaribah", "אלמצ׳ארבה"],
  },
  {
    name: "Jabal al-Aswad",
    lat: 13.22,
    lng: 43.92,
    kind: "ridge",
    country: "Yemen",
    region: "in Lahj governorate",
    aliases: ["الجبل الأسود", "Jabal al-?Aswad", "אלג׳בל אלאסוד"],
  },
  {
    name: "Qahaza",
    lat: 13.18,
    lng: 43.88,
    kind: "site",
    country: "Yemen",
    region: "in Lahj governorate",
    aliases: ["قحازة", "قحازه", "Qahaza", "קחאזה"],
  },
  {
    name: "Wadi Dhanah",
    lat: 15.42,
    lng: 45.25,
    kind: "valley",
    country: "Yemen",
    region: "west of Marib city",
    aliases: ["وادي ذَ?ن[هة]", "Wadi Dhanah", "ואדי ד׳נה"],
  },
  {
    name: "East Balaq",
    lat: 15.35,
    lng: 45.22,
    kind: "ridge",
    country: "Yemen",
    region: "a ridge line south-west of Marib city",
    aliases: ["البلق الشرقي", "East Balaq", "בַ?ּ?לְ?ק המזרחי"],
  },
  {
    name: "Balaq",
    lat: 15.35,
    lng: 45.15,
    kind: "ridge",
    country: "Yemen",
    region: "a ridge line west of Marib city",
    aliases: ["البلق", "\\bBalaq\\b", "אל?[־-]?בַ?ּ?לַ?ק", "אלבַ?ּ?לַ?ק", "בַ?ּ?לְ?ק"],
  },
  {
    name: "Al-Wadi district",
    lat: 15.55,
    lng: 45.35,
    kind: "district",
    country: "Yemen",
    region: "in Marib governorate",
    aliases: ["مديرية الوادي", "Al-?Wadi district", "נפת אלואדי"],
  },
  {
    name: "Al-Dharifah junction",
    lat: 13.38,
    lng: 43.52,
    kind: "site",
    country: "Yemen",
    region: "a road junction in western Taiz",
    aliases: ["الضريفة", "مفرق الضريفة", "al-?Dharifah", "מפרק אלצ׳ריפה"],
  },
  {
    name: "Al-Hazmah",
    lat: 15.48,
    lng: 45.38,
    kind: "area",
    country: "Yemen",
    region: "on the supply road in Marib governorate",
    where: "Marib governorate",
    aliases: ["الحزمة", "al-?Hazmah", "אלחַ?זמה"],
  },
  {
    name: "Al-Alqamah",
    lat: 13.36,
    lng: 43.5,
    kind: "area",
    country: "Yemen",
    region: "in western Taiz",
    aliases: ["العلقمة", "al-?Alqamah", "אל?[־-]?עַ?לְ?קַ?מַ?ה", "אלעַ?לְ?קַ?מַ?ה"],
  },
  {
    name: "Sharirah",
    lat: 13.38,
    lng: 43.52,
    kind: "site",
    country: "Yemen",
    region: "in western Taiz",
    aliases: ["شريرة", "شريره", "Sharirah", "שַ?רִ?ירַ?ה", "שרירה"],
  },
  {
    name: "Al-Mansurah",
    lat: 13.28,
    lng: 43.45,
    kind: "area",
    country: "Yemen",
    region: "in western Taiz",
    aliases: ["المنصورة", "al-?Mansurah", "אלמנצורה"],
  },
  {
    name: "Al-Bukrah",
    lat: 13.3,
    lng: 43.47,
    kind: "area",
    country: "Yemen",
    region: "in western Taiz",
    aliases: ["البوكرة", "البوكره", "al-?Bukrah", "אלבּ?וכרה"],
  },
  {
    name: "Al-Sudayr",
    lat: 12.95,
    lng: 44.2,
    kind: "front",
    country: "Yemen",
    region: "a front line in Lahj governorate",
    aliases: ["السدير", "al-?Sudayr", "אל?[־-]?סֻ?דַ?יְ?ר", "אלסֻ?דַ?יְ?ר"],
  },
  {
    name: "Jahannam",
    lat: 12.7,
    lng: 43.45,
    kind: "front",
    country: "Yemen",
    region: "a sector beside the Bab al-Mandab strait",
    aliases: ["جهنم", "Jahannam", "גַ?׳?הַ?נַ?ּ?ם"],
  },
  {
    name: "Al-Aqrab",
    lat: 12.72,
    lng: 43.48,
    kind: "front",
    country: "Yemen",
    region: "a sector beside the Bab al-Mandab strait",
    aliases: ["العقرب", "al-?Aqrab", "אל?[־-]?עַ?קְ?רַ?ב", "אלעַ?קְ?רַ?ב"],
  },
  {
    name: "Rum",
    lat: 12.88,
    lng: 43.52,
    kind: "area",
    country: "Yemen",
    region: "near the Bab al-Mandab strait",
    aliases: ["روم", "\\bRum\\b", "^רום$"],
  },
  {
    name: "Al-Fakhir",
    lat: 13.92,
    lng: 44.78,
    kind: "area",
    country: "Yemen",
    region: "in Al-Dhale governorate",
    aliases: ["الفاخر", "al-?Fakhir", "אל?[־-]?פאח׳ר", "אלפאח׳ר"],
  },
  {
    name: "Al-Musaymir",
    lat: 13.44,
    lng: 44.61,
    kind: "district",
    country: "Yemen",
    region: "in Lahj governorate",
    aliases: ["المسيمير", "al-?Musaymir", "אלמסימיר"],
  },
  {
    name: "Al-Haymah",
    lat: 14.05,
    lng: 43.12,
    kind: "area",
    country: "Yemen",
    region: "on the Red Sea coast",
    aliases: ["الحيمة", "al-?Haymah", "אלחיימה"],
  },
  {
    name: "Al-Wadiah",
    lat: 17.3,
    lng: 47.12,
    kind: "crossing",
    country: "Yemen",
    region: "the main land crossing between Yemen and Saudi Arabia",
    aliases: ["الوديعة", "al-?Wadiah", "אל?[־-]?ודיעה", "ודיעה"],
  },
  {
    name: "Qalabah",
    lat: 13.68,
    lng: 44.12,
    kind: "area",
    country: "Yemen",
    region: "in Taiz governorate",
    aliases: ["قلبة", "Qalabah", "קַ?לַ?בַ?ּ?ה"],
  },
  {
    name: "Al-Salw",
    lat: 13.38,
    lng: 44.22,
    kind: "district",
    country: "Yemen",
    region: "in Taiz governorate",
    aliases: ["الصلو", "al-?Salw", "אלסלו"],
  },
  {
    name: "Hadran",
    lat: 13.52,
    lng: 43.88,
    kind: "area",
    country: "Yemen",
    region: "in Taiz governorate",
    aliases: ["حدران", "Hadran", "חַ?דְ?רַ?אן"],
  },
  {
    name: "Al-Ruwayk",
    lat: 15.55,
    lng: 45.85,
    kind: "area",
    country: "Yemen",
    region: "in Marib governorate",
    aliases: ["الرويك", "al-?Ruwayk", "אלרֻ?וַ?יְ?ק"],
  },
  {
    name: "Yafa",
    lat: 13.78,
    lng: 45.2,
    kind: "area",
    country: "Yemen",
    region: "in southern Yemen",
    aliases: ["يافع", "Yafa", "Yafi", "יַ?פַ?ע", "יפע"],
  },
  {
    name: "Midi",
    lat: 16.32,
    lng: 42.76,
    kind: "town",
    country: "Yemen",
    region: "on the Red Sea coast near the Saudi border",
    where: "on the Red Sea coast",
    aliases: ["ميدي", "\\bMidi\\b", "מִ?דִ?י", "מידי"],
  },
  {
    name: "Al-Suwayda",
    lat: 15.4,
    lng: 45.1,
    kind: "area",
    country: "Yemen",
    region: "in western Marib governorate",
    aliases: ["السويداء", "al-?Suwayda", "אל?[־-]?סויידא", "אלסויידא"],
  },
  {
    name: "Sirwah",
    lat: 15.45,
    lng: 45.05,
    kind: "district",
    country: "Yemen",
    region: "west of Marib city",
    aliases: ["صرواح", "Sirwah", "צַ?רְ?וַ?אח"],
  },
  {
    name: "Yatmah",
    lat: 16.18,
    lng: 44.62,
    kind: "area",
    country: "Yemen",
    region: "in Al-Jawf governorate",
    aliases: ["يتمة", "Yatmah", "יַ?תְ?מַ?ה", "יתמה"],
  },
  {
    name: "Khalid camp",
    lat: 13.35,
    lng: 43.28,
    kind: "camp",
    country: "Yemen",
    region: "a government military base on the Red Sea coast",
    aliases: ["معسكر خالد", "Khalid camp", "מחנה ח׳אלד"],
  },
  {
    name: "Al-Barh",
    lat: 13.48,
    lng: 43.72,
    kind: "area",
    country: "Yemen",
    region: "in Taiz governorate",
    aliases: ["البرح", "al-?Barh", "אל?[־-]?בַ?ּ?רְ?ח", "אלברח"],
  },
  {
    name: "Al-Subayhah",
    lat: 13.2,
    lng: 44.3,
    kind: "area",
    country: "Yemen",
    region: "a tribal area in Lahj governorate",
    aliases: ["الصبيحة", "al-?Subayhah", "אל?[־-]?צֻ?בַ?ּ?יְ?חַ?ה", "אלצֻ?בַ?ּ?יְ?חַ?ה"],
  },
  {
    name: "Al-Hujariyah",
    lat: 13.35,
    lng: 44.1,
    kind: "area",
    country: "Yemen",
    region: "a region in southern Taiz governorate",
    aliases: ["الحجرية", "al-?Hujariyah", "אלחֻ?גַ?׳?רִ?יה"],
  },
  {
    name: "Maqbanah",
    lat: 13.55,
    lng: 43.66,
    kind: "district",
    country: "Yemen",
    region: "in western Taiz governorate",
    aliases: ["مقبنة", "Maqbanah", "מַ?קְ?בַ?ּ?נַ?ה"],
  },
  {
    name: "Djibouti",
    lat: 11.59,
    lng: 43.15,
    kind: "country",
    country: "Djibouti",
    wellKnown: true,
    aliases: ["جيبوتي", "Djibouti", "ג׳יבוטי"],
  },
];

/* ------------------------------------------------------------------ *
 * Saudi Arabia
 * ------------------------------------------------------------------ */

const SAUDI: Place[] = [
  {
    name: "Riyadh",
    lat: 24.7136,
    lng: 46.6753,
    kind: "city",
    country: "Saudi Arabia",
    wellKnown: true,
    aliases: ["الرياض", "Riyadh", "ריאד"],
  },
  {
    name: "Al-Kharj",
    lat: 24.155,
    lng: 47.305,
    kind: "city",
    country: "Saudi Arabia",
    region: "east of Riyadh",
    aliases: ["الخرج", "al-?Kharj", "אלחַ?׳?רְ?ג׳", "אלחרג׳"],
  },
  {
    name: "Olaya",
    lat: 24.693,
    lng: 46.685,
    kind: "area",
    country: "Saudi Arabia",
    region: "a central business district of Riyadh",
    where: "Riyadh",
    aliases: ["العليا", "Olaya", "Al-?Ulaya", "עוליה"],
    dateline: "RIYADH",
  },
  {
    name: "Jeddah",
    lat: 21.4858,
    lng: 39.1925,
    kind: "port city",
    country: "Saudi Arabia",
    wellKnown: true,
    aliases: ["جدة", "جده", "Jeddah", "Jedda", "גִ?׳?דַ?ּ?ה", "ג׳דה"],
  },
  {
    name: "Mecca",
    lat: 21.3891,
    lng: 39.8579,
    kind: "city",
    country: "Saudi Arabia",
    wellKnown: true,
    aliases: ["مكة", "مكه", "Mecca", "Makkah", "מכה"],
  },
  {
    name: "Taif",
    lat: 21.2703,
    lng: 40.4158,
    kind: "city",
    country: "Saudi Arabia",
    region: "in western Saudi Arabia, east of Mecca",
    aliases: ["الطائف", "al-?Taif", "Taif", "טאיף", "אלטאיף"],
  },
  {
    name: "Yanbu",
    lat: 24.0231,
    lng: 38.1899,
    kind: "port city",
    country: "Saudi Arabia",
    region: "Saudi Arabia's main Red Sea oil export terminal",
    where: "on Saudi Arabia's Red Sea coast",
    aliases: ["ينبع", "Yanbu", "Yanbo", "יַ?נְ?בּ?וּ?ע", "ינבוע"],
  },
  {
    name: "Al-Ula",
    lat: 26.61,
    lng: 37.92,
    kind: "city",
    country: "Saudi Arabia",
    region: "in north-western Saudi Arabia",
    aliases: ["العلا", "al-?Ula", "עֻ?לָ?א"],
  },
  {
    name: "Jazan",
    lat: 16.8892,
    lng: 42.5511,
    kind: "city",
    country: "Saudi Arabia",
    region: "in southern Saudi Arabia, near the Yemeni border",
    aliases: ["جازان", "جيزان", "Jazan", "Jizan", "Jizzan", "גַ?׳?אזאן", "ג׳אזאן"],
  },
  {
    name: "Najran",
    lat: 17.4917,
    lng: 44.1322,
    kind: "city",
    country: "Saudi Arabia",
    region: "on Saudi Arabia's southern border with Yemen",
    where: "southern Saudi Arabia",
    aliases: ["نجران", "Najran", "נַ?גְ?׳?רַ?אן", "נג׳ראן"],
  },
  {
    name: "Khamis Mushait",
    lat: 18.3,
    lng: 42.73,
    kind: "city",
    country: "Saudi Arabia",
    region: "in south-western Saudi Arabia, home to a major air base",
    aliases: ["خميس مشيط", "Khamis Mushait", "Khamis Mushayt", "ח׳מיס מושייט", "חמיס מושייט"],
  },
  {
    name: "Abha",
    lat: 18.2164,
    lng: 42.5053,
    kind: "city",
    country: "Saudi Arabia",
    region: "in south-western Saudi Arabia",
    aliases: ["أبها", "ابها", "Abha", "עַ?בְ?ּ?הַ?א", "עבהא", "אבהא"],
  },
  {
    name: "Sharurah",
    lat: 17.48,
    lng: 47.12,
    kind: "town",
    country: "Saudi Arabia",
    region: "on Saudi Arabia's southern desert border with Yemen",
    where: "southern Saudi Arabia",
    aliases: ["شرورة", "Sharurah", "Sharorah", "שַ?ׁ?רוּ?רָ?ה", "שרורה"],
  },
  {
    name: "Farasan Islands",
    lat: 16.702,
    lng: 42.118,
    kind: "islands",
    country: "Saudi Arabia",
    region: "in the Red Sea off Jazan",
    aliases: ["فرسان", "Farasan", "פרסאן"],
  },
  {
    name: "Abqaiq",
    lat: 25.933,
    lng: 49.667,
    kind: "facility",
    country: "Saudi Arabia",
    region: "the world's largest oil processing plant, in eastern Saudi Arabia",
    aliases: ["بقيق", "أبقيق", "Abqaiq", "Abqaiiq", "אבקייק", "עַ?בְ?ּ?קַ?איְ?ק"],
  },
  {
    name: "Ras Tanura",
    lat: 26.64,
    lng: 50.16,
    kind: "facility",
    country: "Saudi Arabia",
    region: "Saudi Arabia's main Gulf oil export terminal",
    where: "eastern Saudi Arabia",
    aliases: ["رأس تنورة", "Ras Tanura", "ראס תַ?נּ?וּ?רַ?ה", "ראס תנורה"],
  },
  {
    name: "Al-Shuqaiq",
    lat: 17.7,
    lng: 42.05,
    kind: "facility",
    country: "Saudi Arabia",
    region: "a power and desalination complex on Saudi Arabia's Red Sea coast",
    aliases: ["الشقيق", "al-?Shuqaiq", "אלשֻ?קַ?יְ?ק"],
  },
];

/* ------------------------------------------------------------------ *
 * Waters
 * ------------------------------------------------------------------ */

const WATERS: Place[] = [
  {
    name: "the Red Sea",
    lat: 15.5,
    lng: 41.5,
    kind: "sea",
    country: "sea",
    wellKnown: true,
    aliases: ["البحر الأحمر", "Red Sea", "הים האדום", "ים האדום"],
    dateline: "RED SEA",
  },
  {
    name: "the Gulf of Aden",
    lat: 12.5,
    lng: 47.0,
    kind: "sea",
    country: "sea",
    wellKnown: true,
    aliases: ["خليج عدن", "Gulf of Aden", "מפרץ עדן"],
    dateline: "GULF OF ADEN",
  },
  {
    name: "the Arabian Sea",
    lat: 13.5,
    lng: 52.0,
    kind: "sea",
    country: "sea",
    wellKnown: true,
    aliases: ["بحر العرب", "Arabian Sea", "הים הערבי"],
    dateline: "ARABIAN SEA",
  },
];

export const PLACES: Place[] = [...YEMEN, ...SAUDI, ...WATERS];

export const PLACE_BY_NAME: Record<string, Place> = Object.fromEntries(
  PLACES.map((p) => [p.name, p]),
);

/** Longest name first, so "Bab al-Mandab" wins over a bare "Mandab". */
const BY_LENGTH = [...PLACES].sort((a, b) => b.name.length - a.name.length);

type Matcher = { place: Place; re: RegExp };

/**
 * Letters and digits, Latin plus Arabic. Used for word boundaries, because
 * JavaScript's `\b` is useless here: it is defined against [A-Za-z0-9_], and
 * Arabic letters are not word characters, so `\b` never fires between two
 * Arabic letters.
 */
const WORDISH = "A-Za-z0-9\\u0600-\\u06FF";

/**
 * Arabic proclitics — و ف ب ل ك and the article ال — glued to the front of a
 * word: بالبيضاء is ب + البيضاء. A strict left boundary would lose those, so
 * the matcher allows a short prefix to be consumed.
 */
const PROCLITIC = "[\\u0648\\u0641\\u0628\\u0644\\u0643]{0,2}";

/**
 * Bound an alias to whole words.
 *
 * Without this, aliases matched as bare substrings: "إب" (Ibb) matched inside
 * "إبادة" (genocide), and "ازال" (Azal) matched inside "مازالت" (still) — so a
 * report about Erbil or Sudan acquired a Yemeni place, which then told the gate
 * it was on-topic and could put a pin on the map. Both were observed in real
 * traffic.
 *
 * A malformed alias falls back to the unbounded form rather than taking the
 * whole gazetteer down with it.
 */
function boundedMatcher(src: string): RegExp {
  try {
    return new RegExp(`(?<![${WORDISH}])${PROCLITIC}(?:${src})(?![${WORDISH}])`, "i");
  } catch {
    return new RegExp(src, "i");
  }
}

const MATCHERS: Matcher[] = BY_LENGTH.flatMap((place) =>
  [place.name.replace(/^the /, ""), ...place.aliases].map((src) => ({
    place,
    re: boundedMatcher(src),
  })),
);

/** Every place named anywhere in `text`, canonical names, first mention order. */
export function placesIn(text: string): Place[] {
  const t = String(text || "");
  if (!t) return [];
  const found = new Map<string, { place: Place; idx: number }>();
  for (const { place, re } of MATCHERS) {
    const m = re.exec(t);
    if (!m) continue;
    const prev = found.get(place.name);
    if (!prev || m.index < prev.idx) found.set(place.name, { place, idx: m.index });
  }
  return [...found.values()].sort((a, b) => a.idx - b.idx).map((x) => x.place);
}

export function placesInCountry(text: string, country: Country): Place[] {
  return placesIn(text).filter((p) => p.country === country);
}

/**
 * Prose locator for a place the reader may not know:
 * "Kahbub, a hill in Lahj governorate overlooking the Bab al-Mandab strait".
 * Well-known places come back bare.
 */
/** Prepositions that begin a usable locator inside a longer `region` phrase. */
const LOCATOR_HEAD =
  /\b(in|on|off|at|beside|near|inside|overlooking|between|north|south|east|west|north-east|north-west|south-east|south-west)\b/i;

/**
 * The card-length locator: "south-west Yemen", "Lahj governorate".
 *
 * Derived from `region` by dropping the "a <kind> and <kind>" preamble and
 * everything after the first comma, because the card only needs to place the
 * reader on the map — the full description belongs in the expanded view.
 * Returns "" when there is nothing short and useful to say.
 */
export function shortWhere(place: Place): string {
  if (place.where) return place.where;
  if (place.wellKnown || !place.region) return "";

  let s = place.region.trim();
  // "a city and governorate in south-western Yemen" → "in south-western Yemen"
  const head = LOCATOR_HEAD.exec(s);
  if (head && head.index > 0) s = s.slice(head.index);
  // "in Yemen's far north, the Houthi heartland" → "in Yemen's far north"
  s = s.split(",")[0].trim();
  // Drop a leading "in"/"at" only — the caller supplies "in". "on", "off",
  // "beside" and the rest are kept, because "Mocha in Yemen's Red Sea coast"
  // is wrong where "Mocha on Yemen's Red Sea coast" is right.
  s = s.replace(/^(?:in|at)\s+/i, "");
  // Compound compass points lose the "-ern": "south-west Yemen", as the desk
  // writes it. Single ones keep it — "northern Sanaa" is a part of the city,
  // while "north Sanaa" is not English.
  s = s.replace(/\b(north|south)-(east|west)ern\b/gi, "$1-$2");
  return s.replace(/\s{2,}/g, " ").trim();
}

/**
 * A place with its card-length locator: "Taiz in south-west Yemen".
 *
 * Never the long form. The previous version built "Taiz, a city and governorate
 * in south-western Yemen" and inserted it mid-sentence, which read as padding
 * on every mention and made lists of places ambiguous.
 */
export function withLocator(place: Place): string {
  if (place.wellKnown) return place.name;
  if (place.kind === "country" || place.kind === "sea") return place.name;
  const where = shortWhere(place);
  if (!where) return place.name;
  // A locator that already carries its own preposition is used as-is:
  // "on the Red Sea coast", "west of Marib city", "between Yemen and Saudi
  // Arabia". A bare compass region is not one of those — "south-west Yemen"
  // still needs "in", which is the form the desk writes.
  const selfPrepositioned =
    /^(?:on|off|beside|near|inside|overlooking|between)\b/i.test(where) ||
    /^(?:north|south|east|west|north-east|north-west|south-east|south-west)\s+of\b/i.test(where);
  return selfPrepositioned ? `${place.name} ${where}` : `${place.name} in ${where}`;
}

export function datelineFor(place: Place | undefined): string {
  if (!place) return "";
  return place.dateline || place.name.replace(/^the /, "").toUpperCase();
}

/** True open water inside Bab al-Mandab — not Mayun, not the Yemeni shore. */
export function isOpenWaterNearBab(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.hypot(lat - 12.65, lng - 43.414) < 0.05) return false; // Mayun island
  if (Math.hypot(lat - 13.73, lng - 42.75) < 0.15) return false; // Hanish group
  if (lng >= 43.4) return false; // Yemeni mainland side
  if (lng <= 43.12) return false; // Djiboutian side
  return lat >= 11.95 && lat <= 13.15;
}
