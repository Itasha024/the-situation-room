/**
 * The Iran desk's places (Round 30 stage 6): where this war's attacks land.
 * Iran's cities, nuclear, missile, oil and port sites and its Gulf islands;
 * Israel's cities and bases; Lebanon, Iraq, Syria, Jordan; the Gulf states'
 * cities, ports and the US bases; the seas. Each with the spellings its
 * sources use (English, Arabic, Persian, Hebrew).
 *
 * A pin goes only on a place the source's own text names (grounded), never on
 * a country or a province, and never on a word that is also a common word in
 * the source's language ("صور" is "pictures", "القدس" is the Quds Force too):
 * those places are matched by their English name only.
 *
 * Coordinates checked against OpenStreetMap's Nominatim (9 Oct 2026).
 */
export type IranPlaceKind = "city" | "site" | "base" | "port" | "island" | "sea";
export type IranPlace = { name: string; lat: number; lng: number; country: string; kind: IranPlaceKind; alt?: string[] };

const P = (name: string, lat: number, lng: number, country: string, kind: IranPlaceKind, alt: string[] = []): IranPlace => ({ name, lat, lng, country, kind, alt });

export const IRAN_PLACES: IranPlace[] = [
  // Iran: cities.
  P("Tehran", 35.6892, 51.389, "Iran", "city", ["طهران", "تهران"]),
  P("Isfahan", 32.6546, 51.668, "Iran", "city", ["Esfahan", "أصفهان", "اصفهان"]),
  P("Shiraz", 29.5918, 52.5837, "Iran", "city", ["شيراز", "شیراز"]),
  P("Tabriz", 38.08, 46.2919, "Iran", "city", ["تبريز", "تبریز"]),
  P("Mashhad", 36.2605, 59.6168, "Iran", "city", ["مشهد"]),
  P("Kermanshah", 34.3142, 47.065, "Iran", "city", ["كرمانشاه", "کرمانشاه"]),
  P("Qom", 34.6399, 50.8759, "Iran", "city"),
  P("Karaj", 35.84, 50.9391, "Iran", "city", ["كرج", "کرج"]),
  P("Semnan", 35.5769, 53.3953, "Iran", "city", ["سمنان"]),
  P("Shahroud", 36.4182, 54.9763, "Iran", "city", ["Shahrud", "شاهرود"]),
  P("Kerman", 30.2839, 57.0834, "Iran", "city", ["كرمان", "کرمان"]),
  P("Yazd", 31.8974, 54.3569, "Iran", "city", ["يزد", "یزد"]),
  P("Hamadan", 34.7983, 48.5148, "Iran", "city", ["همدان"]),
  P("Dezful", 32.3811, 48.4058, "Iran", "city", ["دزفول"]),
  P("Ahvaz", 31.3183, 48.6706, "Iran", "city", ["Ahwaz", "الأهواز", "اهواز"]),
  P("Abadan", 30.3473, 48.2934, "Iran", "city", ["عبادان", "آبادان"]),
  P("Urmia", 37.5527, 45.0761, "Iran", "city", ["أرومية", "ارومیه"]),
  P("Zahedan", 29.4963, 60.8629, "Iran", "city", ["زاهدان"]),
  P("Khorramabad", 33.4878, 48.3558, "Iran", "city", ["خرم آباد", "خرم‌آباد"]),
  P("Ilam", 33.6374, 46.4227, "Iran", "city", ["إيلام", "ایلام"]),
  P("Sanandaj", 35.3219, 46.9862, "Iran", "city", ["سنندج"]),
  P("Rasht", 37.2808, 49.5832, "Iran", "city", ["رشت"]),
  P("Kashan", 33.985, 51.41, "Iran", "city", ["كاشان", "کاشان"]),
  P("Minab", 27.1467, 57.0801, "Iran", "city", ["ميناب", "میناب"]),
  P("Zanjan", 36.6736, 48.4787, "Iran", "city", ["زنجان"]),
  P("Qazvin", 36.2797, 50.0049, "Iran", "city", ["قزوين", "قزوین"]),
  P("Arak", 34.0954, 49.7013, "Iran", "city", ["اراک"]),
  // Iran: nuclear, missile and military sites.
  P("Natanz", 33.724, 51.727, "Iran", "site", ["نطنز"]),
  P("Fordow", 34.8847, 50.9958, "Iran", "site", ["Fordo", "فوردو"]),
  P("Khondab", 34.373, 49.183, "Iran", "site", ["Arak heavy water", "خنداب"]),
  P("Bushehr nuclear plant", 28.8296, 50.8858, "Iran", "site", ["Bushehr nuclear", "Bushehr power plant", "Bushehr reactor"]),
  P("Parchin", 35.52, 51.77, "Iran", "site", ["بارشين", "پارچین"]),
  P("Khojir", 35.655, 51.715, "Iran", "site", ["خجير", "خجیر"]),
  P("Mehrabad Airport", 35.6892, 51.3134, "Iran", "base", ["Mehrabad", "مهرآباد", "مهر آباد"]),
  P("Imam Khomeini Airport", 35.4161, 51.1522, "Iran", "base", ["Imam Khomeini International", "فرودگاه امام خمینی"]),
  P("Evin Prison", 35.7963, 51.387, "Iran", "site", ["Evin", "سجن إيفين", "زندان اوین", "اوین"]),
  // Iran: ports, oil and the islands.
  P("Bushehr", 28.9234, 50.8203, "Iran", "port", ["بوشهر"]),
  P("Bandar Abbas", 27.1832, 56.2666, "Iran", "port", ["بندر عباس", "بندرعباس"]),
  P("Shahid Rajaee port", 27.111, 56.064, "Iran", "port", ["Shahid Rajaei", "Rajaee port", "الشهيد رجائي", "شهید رجایی"]),
  P("Jask", 25.6385, 57.7745, "Iran", "port", ["جاسك", "جاسک"]),
  P("Chabahar", 25.2919, 60.643, "Iran", "port", ["تشابهار", "چابهار"]),
  P("Konarak", 25.36, 60.4, "Iran", "port", ["كنارك", "کنارک"]),
  P("Bandar Lengeh", 26.558, 54.88, "Iran", "port", ["Lengeh", "بندر لنجة", "بندر لنگه"]),
  P("Bandar Imam Khomeini", 30.426, 49.078, "Iran", "port", ["بندر الإمام الخميني", "بندر امام خمینی"]),
  P("Mahshahr", 30.5589, 49.1981, "Iran", "port", ["ماهشهر"]),
  P("Bandar Anzali", 37.4727, 49.4622, "Iran", "port", ["Anzali", "انزلي", "انزلی"]),
  P("Asaluyeh", 27.476, 52.607, "Iran", "site", ["Assaluyeh", "South Pars", "عسلوية", "عسلویه", "پارس جنوبی", "بارس الجنوبي"]),
  P("Kangan", 27.838, 52.064, "Iran", "port", ["كنكان", "کنگان"]),
  P("Kharg Island", 29.26, 50.33, "Iran", "island", ["Kharg", "خارك", "خارک"]),
  P("Qeshm", 26.958, 56.271, "Iran", "island", ["قشم"]),
  P("Hormuz Island", 27.064, 56.461, "Iran", "island", ["جزيرة هرمز", "جزیره هرمز"]),
  P("Larak Island", 26.85, 56.36, "Iran", "island", ["Larak", "لارك", "لارک"]),
  P("Kish Island", 26.54, 53.98, "Iran", "island", ["Kish", "كيش", "کیش"]),
  P("Lavan Island", 26.81, 53.36, "Iran", "island", ["Lavan", "لاوان"]),
  P("Sirri Island", 25.91, 54.54, "Iran", "island", ["Sirri", "سيري", "سیری"]),
  P("Abu Musa", 25.873, 55.033, "Iran", "island", ["أبو موسى", "ابوموسی", "ابو موسی"]),
  P("Greater Tunb", 26.265, 55.307, "Iran", "island", ["Tunb", "طنب الكبرى", "تنب بزرگ"]),
  // Israel.
  P("Tel Aviv", 32.0853, 34.7818, "Israel", "city", ["تل أبيب", "تل ابيب", "تل‌آویو", "تل آویو", "תל אביב"]),
  P("Jerusalem", 31.7683, 35.2137, "Israel", "city", ["ירושלים"]),
  P("Haifa", 32.794, 34.9896, "Israel", "port", ["حيفا", "حیفا", "חיפה"]),
  P("Beersheba", 31.2518, 34.7913, "Israel", "city", ["Beer Sheva", "Be'er Sheva", "بئر السبع", "בארי שבע", "באר שבע"]),
  P("Dimona", 31.07, 35.0333, "Israel", "site", ["ديمونا", "دیمونا", "דימונה"]),
  P("Nevatim", 31.2083, 35.0122, "Israel", "base", ["نيفاتيم", "نواتیم", "נבטים"]),
  P("Eilat", 29.5577, 34.9519, "Israel", "port", ["إيلات", "ايلات", "ایلات", "אילת"]),
  P("Ashdod", 31.8044, 34.6553, "Israel", "port", ["أسدود", "اسدود", "אשדוד"]),
  P("Ashkelon", 31.6688, 34.5743, "Israel", "city", ["عسقلان", "אשקלון"]),
  P("Netanya", 32.3215, 34.8532, "Israel", "city", ["نتانيا", "נתניה"]),
  P("Rishon LeZion", 31.973, 34.7925, "Israel", "city", ["Rishon Lezion", "ראשון לציון"]),
  P("Petah Tikva", 32.084, 34.8878, "Israel", "city", ["Petah Tiqva", "פתח תקווה"]),
  P("Ramat Gan", 32.0684, 34.8248, "Israel", "city", ["رمات غان", "רמת גן"]),
  P("Holon", 32.0158, 34.7874, "Israel", "city", ["חולון"]),
  P("Herzliya", 32.1624, 34.8447, "Israel", "city", ["هرتسليا", "הרצליה"]),
  P("Rehovot", 31.8928, 34.8113, "Israel", "city", ["רחובות"]),
  P("Tiberias", 32.7959, 35.531, "Israel", "city", ["طبريا", "טבריה"]),
  P("Safed", 32.9646, 35.496, "Israel", "city", ["صفد", "צפת"]),
  P("Kiryat Shmona", 33.2073, 35.5711, "Israel", "city", ["كريات شمونة", "קריית שמונה"]),
  P("Nahariya", 33.0058, 35.0941, "Israel", "city", ["نهاريا", "נהריה"]),
  P("Acre", 32.9281, 35.0818, "Israel", "city", ["Akko", "عكا", "עכו"]),
  P("Ben Gurion Airport", 32.0055, 34.8854, "Israel", "base", ["مطار بن غوريون", "נתב\"ג"]),
  P("Ramat David", 32.665, 35.179, "Israel", "base", ["רמת דוד"]),
  P("Tel Nof", 31.839, 34.822, "Israel", "base", ["תל נוף"]),
  P("Hatzerim", 31.233, 34.663, "Israel", "base", ["חצרים"]),
  // Lebanon.
  P("Beirut", 33.8938, 35.5018, "Lebanon", "city", ["بيروت", "بیروت"]),
  P("Dahiyeh", 33.853, 35.51, "Lebanon", "city", ["Dahieh", "Dahiya", "الضاحية الجنوبية", "ضاحیه"]),
  P("Tyre", 33.2705, 35.2038, "Lebanon", "city"),
  P("Sidon", 33.5571, 35.3729, "Lebanon", "city", ["صيدا"]),
  P("Nabatieh", 33.3772, 35.4836, "Lebanon", "city", ["النبطية"]),
  P("Baalbek", 34.0047, 36.211, "Lebanon", "city", ["بعلبك"]),
  P("Bint Jbeil", 33.1194, 35.4333, "Lebanon", "city", ["بنت جبيل"]),
  // Iraq.
  P("Baghdad", 33.3152, 44.3661, "Iraq", "city", ["بغداد"]),
  P("Erbil", 36.1911, 44.0092, "Iraq", "city", ["أربيل", "اربيل", "اربیل"]),
  P("Ain al-Asad", 33.7856, 42.4411, "Iraq", "base", ["Ain al-Assad", "Al-Asad", "عين الأسد", "عين الاسد", "عین الاسد"]),
  P("Basra", 30.5085, 47.7804, "Iraq", "city", ["البصرة", "بصره"]),
  P("Sulaymaniyah", 35.5613, 45.4374, "Iraq", "city", ["السليمانية", "سلیمانیه"]),
  P("Kirkuk", 35.4681, 44.3922, "Iraq", "city", ["كركوك", "کرکوک"]),
  P("Jurf al-Sakhar", 32.87, 44.11, "Iraq", "site", ["Jurf al-Nasr", "جرف الصخر", "جرف النصر"]),
  P("Al-Qaim", 34.37, 41.09, "Iraq", "city", ["القائم"]),
  // Syria and Jordan.
  P("Damascus", 33.5138, 36.2765, "Syria", "city", ["دمشق"]),
  P("Deir ez-Zor", 35.3359, 40.1408, "Syria", "city", ["Deir ez-Zur", "Deir al-Zour", "دير الزور"]),
  P("Al-Bukamal", 34.4536, 40.9362, "Syria", "city", ["Abu Kamal", "Albukamal", "البوكمال"]),
  P("Al-Tanf", 33.49, 38.66, "Syria", "base", ["Tanf", "التنف"]),
  P("Amman", 31.9539, 35.9106, "Jordan", "city", ["عمّان"]),
  P("Muwaffaq Salti Air Base", 31.83, 36.78, "Jordan", "base", ["Muwaffaq Salti", "موفق السلطي"]),
  // The Gulf states (Saudi Arabia's places are the Yemen desk's gazetteer's).
  P("Dubai", 25.2048, 55.2708, "UAE", "city", ["دبي", "دبی"]),
  P("Abu Dhabi", 24.4539, 54.3773, "UAE", "city", ["أبوظبي", "أبو ظبي", "ابوظبی"]),
  P("Fujairah", 25.1288, 56.3265, "UAE", "port", ["الفجيرة", "فجیره"]),
  P("Khor Fakkan", 25.3393, 56.356, "UAE", "port", ["خورفكان", "خور فكان"]),
  P("Ras al-Khaimah", 25.7895, 55.9432, "UAE", "city", ["رأس الخيمة"]),
  P("Jebel Ali", 25.011, 55.061, "UAE", "port", ["جبل علي"]),
  P("Al Dhafra Air Base", 24.2482, 54.5475, "UAE", "base", ["Al Dhafra", "الظفرة"]),
  P("Ruwais", 24.11, 52.73, "UAE", "site", ["الرويس"]),
  P("Doha", 25.2854, 51.531, "Qatar", "city", ["الدوحة", "دوحه"]),
  P("Al Udeid Air Base", 25.1173, 51.315, "Qatar", "base", ["Al Udeid", "Al-Udeid", "العديد", "العدید"]),
  P("Ras Laffan", 25.914, 51.538, "Qatar", "site", ["راس لفان", "رأس لفان"]),
  P("Manama", 26.2285, 50.586, "Bahrain", "city", ["المنامة"]),
  P("Kuwait City", 29.3759, 47.9774, "Kuwait", "city", ["مدينة الكويت"]),
  P("Camp Arifjan", 28.93, 48.1, "Kuwait", "base", ["Arifjan", "عريفجان"]),
  P("Ali Al Salem Air Base", 29.3467, 47.5208, "Kuwait", "base", ["Ali Al Salem", "علي السالم"]),
  P("Muscat", 23.588, 58.3829, "Oman", "city", ["مسقط"]),
  P("Duqm", 19.6656, 57.7046, "Oman", "port", ["الدقم"]),
  P("Sohar", 24.347, 56.709, "Oman", "port", ["صحار"]),
  P("Khasab", 26.1797, 56.2478, "Oman", "port", ["Musandam", "خصب", "مسندم"]),
  P("Ras Tanura", 26.644, 50.159, "Saudi Arabia", "port", ["رأس تنورة", "راس تنورة"]),
  // The seas.
  P("Strait of Hormuz", 26.5667, 56.25, "sea", "sea", ["Hormuz Strait", "مضيق هرمز", "تنگه هرمز"]),
  P("Gulf of Oman", 24.5, 58.5, "sea", "sea", ["خليج عمان", "دریای عمان"]),
  P("Persian Gulf", 27.0, 51.5, "sea", "sea", ["Arabian Gulf", "الخليج العربي", "خلیج فارس"]),
  P("Arabian Sea", 18.0, 62.0, "sea", "sea", ["بحر العرب", "دریای عرب"]),
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LATIN = /^[\x20-\x7e]+$/;
/** A Latin name as a word; an Arabic, Persian or Hebrew one with its prefixes (و ب ل ال، ה ו ב ל מ). */
function patternOf(name: string): RegExp {
  if (LATIN.test(name)) return new RegExp(`(?<![\\p{L}\\p{N}])${esc(name)}(?![\\p{L}\\p{N}])`, "iu");
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:[وبلف]?(?:ال)?|[הובלמש]?)${esc(name)}(?![\\p{L}\\p{N}])`, "u");
}
const PATTERNS = IRAN_PLACES.map((p) => ({ p, res: [p.name, ...(p.alt ?? [])].map(patternOf) }));

/** The region's places a text names, in the order it names them. */
export function iranPlacesIn(text: string): IranPlace[] {
  const t = String(text || "");
  const hits: { p: IranPlace; at: number }[] = [];
  for (const { p, res } of PATTERNS) {
    let at = Infinity;
    for (const re of res) {
      const m = re.exec(t);
      if (m && m.index < at) at = m.index;
    }
    if (at < Infinity) hits.push({ p, at });
  }
  // "Bushehr nuclear plant" is not also the port; "Kharg Island" is not also "Kharg".
  const out = hits.sort((a, b) => a.at - b.at).map((h) => h.p);
  return out.filter((p) => !out.some((q) => q !== p && q.name.length > p.name.length && q.name.startsWith(p.name)));
}

/**
 * Where an attack card is pinned: the places its own copy (or the model's
 * targets) names that the source text names too. A sea is the pin only of a
 * ship, or when no land place is named.
 */
export function iranPins(copy: string, sourceText: string, vessel: boolean): IranPlace[] {
  const inSource = new Set(iranPlacesIn(sourceText).map((p) => p.name));
  const named = iranPlacesIn(copy).filter((p) => inSource.has(p.name) && !asProvince(copy, p) && !asProvince(sourceText, p));
  const land = named.filter((p) => p.kind !== "sea");
  const sea = named.filter((p) => p.kind === "sea");
  if (vessel) {
    const coast = land.filter((p) => p.kind === "port" || p.kind === "island");
    return [...coast, ...sea].slice(0, 1).length ? [...coast, ...sea].slice(0, 1) : land.slice(0, 1);
  }
  return land.length ? land.slice(0, 6) : sea.slice(0, 1);
}

/** "Kerman province", "استان کرمان": the province, never a pin on its city. */
export function asProvince(copy: string, p: IranPlace): boolean {
  return [p.name, ...(p.alt ?? [])].some((n) => {
    const e = esc(n);
    return new RegExp(`${e}\\s+(?:province|governorate|region)\\b|\\b(?:province|governorate) of\\s+${e}`, "i").test(copy) || new RegExp(`(?:استان|محافظة|محافظه)\\s+${e}`, "u").test(copy);
  });
}

/**
 * A count of attacks over days or weeks ("10 tankers targeted in the week to
 * 4 October", "five attacks in the past four days", "record attacks since the
 * war began") is no one attack: no pin.
 */
const TALLY =
  /\b(?:in the (?:past|last) (?:\d+|two|three|four|five|six|seven|ten|several|few) (?:days|weeks|months)|(?:last|this|past) (?:week|month)|in (?:the )?week to|since (?:the )?(?:war|start|beginning|February|March|28 Feb)|so far|tally|on record|record (?:number|attacks)|in total|total of)\b/i;
export function tallyNotEvent(headline: string): boolean {
  return TALLY.test(headline);
}
