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
 * those places are matched by their English name only, or with the word that
 * makes them a place ("العديد" is "many", "القائم" is "the acting": only "قاعدة العديد", "مدينة القائم").
 *
 * Coordinates checked against OpenStreetMap's Nominatim (9 Oct 2026).
 */
import { IRAN_GAZ } from "./iran-gazetteer.ts";
import { FIRST_FOOTAGE_RE } from "./pin-rule.ts";
import { makeSea } from "../../../scripts/iran-research/offshore.mjs";
import LAND from "../../../public/iran-land.json" with { type: "json" };

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
  P("Al-Qaim", 34.37, 41.09, "Iraq", "city", ["Qaim", "مدينة القائم", "قضاء القائم", "منفذ القائم"]),
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
  P("Al Udeid Air Base", 25.1173, 51.315, "Qatar", "base", ["Al Udeid", "Al-Udeid", "قاعدة العديد", "پایگاه العدید", "پایگاه العديد"]),
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
  // Saudi Arabia's Jubail, never Lebanon's Jbeil (Byblos), which the same letters spell (17 Oct).
  P("Jubail", 27.011, 49.658, "Saudi Arabia", "port", ["Jubayl", "Al Jubail", "الجبيل"]),
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
  const spans: { p: IranPlace; at: number; end: number }[] = [];
  for (const { p, res } of PATTERNS) {
    for (const re of res) {
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      for (const m of t.matchAll(g)) spans.push({ p, at: m.index!, end: m.index! + m[0].length });
    }
  }
  // A name inside another place's longer name is not that place (user, 11 Oct): "Bint Jbeil" is
  // not also Jbeil (Byblos), "بنت جبيل" not also "جبيل". A place counts where it stands on its own.
  const free = spans.filter((s) => !spans.some((o) => o.p !== s.p && o.end - o.at > s.end - s.at && o.at <= s.at && s.end <= o.end));
  const first = new Map<IranPlace, number>();
  for (const s of free) if (!first.has(s.p) || s.at < first.get(s.p)!) first.set(s.p, s.at);
  const hits = [...first].map(([p, at]) => ({ p, at }));
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
  const inCopy = iranPlacesIn(copy);
  // A hand-list place the source names in Arabic or Persian and the copy spells its own way.
  const sounds = new Set<string>();
  windows(latinWords(copy), (_k, _at, run) => isName(copy, run) && sounds.add(latinSound(run)));
  const heard = iranPlacesIn(sourceText).filter((p) => !inCopy.includes(p) && (p.alt ?? []).some((n) => !LATIN.test(n) && nativeSound(n).length >= 3 && sounds.has(nativeSound(n))));
  const hand = [...inCopy.filter((p) => inSource.has(p.name)), ...heard];
  const wider = gazPlacesIn(copy, sourceText).filter((g) => !hand.some((p) => km(p, g) < 3));
  const named = [...hand, ...wider].filter((p) => !asProvince(copy, p) && !asProvince(sourceText, p));
  const land = named.filter((p) => p.kind !== "sea");
  const sea = named.filter((p) => p.kind === "sea");
  if (vessel) {
    const coast = land.filter((p) => p.kind === "port" || p.kind === "island");
    return [...coast, ...sea].slice(0, 1).length ? [...coast, ...sea].slice(0, 1) : land.slice(0, 1);
  }
  return land.length ? land.slice(0, 6) : sea.slice(0, 1);
}

/**
 * The wider list (user, 11 Oct: Qantara, Talousa and Hermel got no pin, as the
 * hand list above had no room for every village): every place a research pin
 * stands on, and Lebanon's villages from OpenStreetMap (iran-gazetteer.ts). A
 * place counts only when the source names it, in its own script or in English,
 * and the card's copy names it too, in any English spelling ("Kfar Tibnit",
 * "Kafr Tebnit"): the copy is the model's English, so the two must agree.
 */
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const ARTICLE = /^(?:al|el|ad|an|ar|as|ash|at|az|ad-)$/;
/** A Latin text's words, lower case, without the Arabic article ("al-Qantara" is "qantara"). */
export const latinWords = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\b(?:al|el|ad|an|ar|as|ash|at|az)-/g, "").split(/[^a-z]+/).filter((w) => w && !ARTICLE.test(w));
/** A spelling's consonants: "Kfar Tibnit" and "Kafr Tebnit" are both "kfrtbnt". */
export const skeleton = (words: string[]) => words.join("").replace(/q|c/g, "k").replace(/[aeiouy]/g, "").replace(/(.)\1+/g, "$1");
/** Arabic and Persian letters made one: hamzas, ta marbuta, alif maqsura, Persian kaf and yeh. */
const nativeNorm = (s: string) => s.replace(/[ً-ٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/[ىی]/g, "ي").replace(/ک/g, "ك");
export const nativeWords = (s: string) => nativeNorm(s).split(/[^\p{L}]+/u).filter(Boolean);
/**
 * A name's consonants by sound, in either script, so an English spelling the
 * lists lack still meets the source's Arabic or Persian (user, 11 Oct): "Kfar
 * Tibnit" and "كفر تبنيت" are both KFRTBNT. Vowels, h, w, y and ain drop out.
 */
const SOUND: Record<string, string> = {
  ب: "B", پ: "B", ت: "T", ث: "T", ط: "T", ج: "J", چ: "C", خ: "K", د: "D", ذ: "D", ض: "D", ظ: "D", ر: "R", ز: "Z", ژ: "Z",
  س: "S", ش: "S", ص: "S", غ: "G", ف: "F", ق: "K", ك: "K", ک: "K", گ: "G", ل: "L", م: "M", ن: "N",
};
export const nativeSound = (name: string) =>
  nativeWords(name).map((w) => w.replace(/^ال/, "")).join("").split("").map((c) => SOUND[c] ?? "").join("").replace(/(.)\1+/g, "$1");
export const latinSound = (words: string[]) =>
  words.join("").replace(/ch/g, "C").replace(/h/g, "").replace(/[qck]/g, "K").replace(/[pb]/g, "B").replace(/[vf]/g, "F").replace(/[aeiouyw']/g, "").toUpperCase().replace(/(.)\1+/g, "$1");
/** The run is a name in the copy: each of its words capitalised ("tells" is no Tallousa). */
export const isName = (copy: string, run: string[]) => {
  const caps = new Set(latinWords((copy.match(/(?<![\p{L}])[A-Z][\p{L}'’-]*/gu) ?? []).join(" ")));
  return run.every((w) => caps.has(w));
};
const COUNTRY: Record<string, string> = { "United Arab Emirates": "UAE" };
// The hand list's places are its own (its seas too): the wider list never stands in for them.
const HAND = new Set(IRAN_PLACES.flatMap((p) => [p.name, ...(p.alt ?? [])]).map((n) => n.toLowerCase()));
// A village named as a group is never the group's place (18 Oct: "Islamic Jihad" pinned on Al-Jihad).
const GAZ = IRAN_GAZ.filter(([name]) => !HAND.has(name.toLowerCase()) && !/\b(?:Strait|Gulf|Sea|Ocean|off)\b/i.test(name) && !/^(?:al-?\s?)?(?:jihad|amal)$/i.test(name)).map(([name, lat, lng, country, latin, native]) => ({
  place: { name, lat, lng, country: COUNTRY[country] ?? country, kind: "city", alt: [...latin, ...native] } as IranPlace,
  skeletons: new Set(latin.map((n) => skeleton(latinWords(n))).filter((k) => k.length >= 3)),
  sounds: new Set(native.map(nativeSound).filter((k) => k.length >= 3)),
}));
const BY_LATIN = new Map<string, (typeof GAZ)[number][]>();
const BY_NATIVE = new Map<string, (typeof GAZ)[number][]>();
for (const g of GAZ) {
  for (const n of g.place.alt ?? []) {
    const [map, key] = /^[\x20-\x7e]+$/.test(n) ? [BY_LATIN, latinWords(n).join(" ")] : [BY_NATIVE, nativeWords(n).join(" ")];
    if (key) (map.get(key) ?? map.set(key, []).get(key)!).push(g);
  }
}
/** Each run of one to four words, as the key of a name. */
export function windows(words: string[], each: (key: string, at: number, run: string[]) => void): void {
  for (let i = 0; i < words.length; i++) for (let n = 1; n <= 4 && i + n <= words.length; n++) each(words.slice(i, i + n).join(" "), i, words.slice(i, i + n));
}
/** The hand list's names blanked out, so no wider place is read inside one ("Jbeil" in "Bint Jbeil"). */
function maskHand(text: string): string {
  let t = String(text || "");
  for (const { res } of PATTERNS) for (const re of res) t = t.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), " zzzz ");
  return t;
}
export function gazPlacesIn(copyIn: string, sourceIn: string): IranPlace[] {
  const copy = maskHand(copyIn);
  const sourceText = maskHand(sourceIn);
  const named = new Set<(typeof GAZ)[number]>();
  const inNative = new Set<(typeof GAZ)[number]>();
  windows(latinWords(sourceText), (k) => BY_LATIN.get(k)?.forEach((g) => named.add(g)));
  // "وكفر تبنيت", "بالقنطرة": the joined letters before a native name.
  windows(nativeWords(sourceText), (k) => {
    for (const key of [k, k.replace(/^(?:[وبلف]?ال|[وبلف])/, "")]) BY_NATIVE.get(key)?.forEach((g) => (named.add(g), inNative.add(g)));
  });
  if (!named.size) return [];
  const hits: { p: IranPlace; at: number; n: number }[] = [];
  windows(latinWords(copy), (_k, at, run) => {
    if (!isName(copy, run)) return;
    const s = skeleton(run);
    // A spelling the lists know; or, when the source names it in Arabic or Persian, any that sounds the same.
    const sound = latinSound(run);
    for (const g of named)
      if ((g.skeletons.has(s) || (inNative.has(g) && sound.length >= 3 && g.sounds.has(sound))) && !hits.some((h) => h.p === g.place)) hits.push({ p: g.place, at, n: run.length });
  });
  // "Kfar Tibnit" is not also a village called "Kfar": the longer name wins.
  const inside = (h: (typeof hits)[number]) => hits.some((o) => o !== h && o.n > h.n && o.at <= h.at && h.at + h.n <= o.at + o.n);
  return hits.filter((h) => !inside(h)).sort((a, b) => a.at - b.at).map((h) => h.p);
}

/** "Kerman province", "استان کرمان": the province, never a pin on its city. */
export function asProvince(copy: string, p: IranPlace): boolean {
  return [p.name, ...(p.alt ?? [])].some((n) => {
    const e = esc(n);
    return new RegExp(`${e}\\s+(?:province|governorate|region|district|county)\\b|\\b(?:province|governorate|district) of\\s+${e}`, "i").test(copy) || new RegExp(`(?:استان|محافظة|محافظه|قضاء|شهرستان)\\s+${e}`, "u").test(copy);
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

/**
 * Which attacks the Iran desk's map carries (user, 9 Oct), by who acted and
 * where it landed:
 * - Iran and its axis (Hezbollah, the Iraqi and Syrian militias): anywhere
 *   outside Iran, Kurdish Iraq and Israel from Syria too. Inside Iran it is
 *   Iran's own unrest, never this map, save its air defence at work.
 * - The US, Israel and the Gulf states: in Iran, Iraq and the seas; Israel in
 *   Lebanon too. Israel in Syria and Gaza is not this war's map.
 * - The Houthis: their launches at Israel (user, 9 Oct); their war at sea and
 *   in Yemen is the Yemen desk's map, and so is everything south of 20.3°N
 *   between the Red Sea and Oman: southern Saudi Arabia, the southern Red
 *   Sea, Bab al-Mandab, the Gulf of Aden (user, 11 Oct).
 * - Not told who: at sea, or a strike or blast that is no police matter.
 * Sirens and explosions heard count, in every country but Israel, whose alerts
 * come from the Home Front Command (user, 10 Oct).
 * Never a fly-over, a round-up of attacks, a count of the dead with no attack,
 * or a tally over days.
 */
// 18 Oct (the unplaced cards placed): warplanes at an altitude, mock raids, flares, a plane's emergency code,
// GPS jamming, "new tactics", launches with no impact, planes turned back, a drone crossing airspace.
const NOT_AN_ATTACK =
  /\b(?:fl(?:y|ies|ew|ying)\s+(?:\w+\s+){0,3}(?:over|altitude)|mock (?:raids?|attacks?)|illuminat\w* (?:flares?|bombs?|shells?|rounds?)|flares?|squawk|GPS (?:disruption|jamming|interference|spoofing)|new tactics|no impacts?|turned back|cross(?:es|ed|ing)? (?:\w+ ){0,3}(?:into )?(?:\w+ )?airspace|(?:jet|drone|UAV|aircraft|air|helicopter)\s+activity|(?:seen|spotted|sighted|circl(?:e|es|ing))\s+over|in (?:the )?skies? (?:over|of|above)|violat\w* (?:\w+ ){0,2}airspace|drills?|military exercises?|manoeuvres?|maneuvers?|accident\w*|ammunition (?:blast|explosion)|explosion at (?:a |the )?(?:damaged-)?ammunition|reinforces?|deploys?|presence|shipping slows|crossed|transit\w*|(?:lifts?|raises?) (?:the )?(?:security )?alert|warns?|threatens?|evacuat\w*|unidentified (?:object|aircraft|drone))\b/i;
const ROUNDUP =
  /\b(?:multiple|several|series of|string of|spate of|wave of|a number of)\s+(?:\w+\s+){0,2}(?:attacks|incidents|strikes)\s+(?:reported|recorded|across|in\b)|\b(?:wounded|killed|dead|casualties|injured)\s+in\s+(?:air\s+|the\s+)?(?:incidents|attacks|strikes)\b(?!\s+on\b)|\bas\s+(?:Tehran|Iran|Washington|the US|Israel)\s+(?:tries|seeks|aims|moves|looks|struggles|presses)\b|\bin\s+(?:recent|past|the past)\s+(?:days|weeks|months)\b|\bin\s+(?:one|a single)\s+day\b|\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:separate\s+)?attacks\b/i;
// The Baluch insurgency's attacks on Iran's forces are Iran's unrest, not the war (user's rule: no Iran unrest pins).
const INTERNAL =
  /\b(?:Sistan|Baluchestan|Zahedan|Mehrastan|Nikshahr|Saravan|Khash|Taftan|Rask|Iranshahr|police|roadside|gunmen|militants?|Jaish al-Adl|PJAK|PKK|Komala|protest(?:s|ers)?|riots?|unrest|clash(?:es)?|security forces|border guards?|assassinat\w*|executed|arrest(?:s|ed)?|MEK|PMOI|Mojahedin|resistance units|regime banners?)\b/i;
/**
 * Not an attack of its own (Stage C, 12 Oct, the live pins read one by one): footage or a later look at
 * an attack already pinned ("IRGC releases footage of …", "still ablaze after the 1 Oct strike", "in
 * Erbil yesterday", thermal anomalies), a sound bomb, a sonic boom, an alert declared with nothing heard,
 * troops or tanks on the move, gunfire sweeps.
 */
const NOT_NEW_OR_NOT_A_STRIKE =
  /\b(?:releases? (?:new )?footage|footage (?:shows?|of)|video (?:shows?|of)|still (?:ablaze|burning|on fire)|(?<!since )yesterday|over (?:the )?past (?:\d+|two|three|few|several) (?:days|hours)|thermal anomal\w*|sound bombs?|sonic boom|(?:break|breaks|broke) the sound barrier|break sound barrier|breaks sound barrier|(?:at|on) (?:its )?(?:highest|high|full|maximum) alert|alert (?:was |is )?declared|declared? (?:a )?(?:red |state of )?alert|state of alert|(?:tanks?|troops|forces|bulldozers?) (?:move|moves|moved|advance|advances|advanced)|machine-?gun (?:cover|sweeps?))\b/i;
const AIR_DEFENCE = /\b(?:intercept\w*|air defen[cs]es?|shot down|shoots down|downed|downs)\b/i;
const AXIS = new Set(["iran", "hezbollah", "iraqi_militias"]);
const PURSUERS: Record<string, Set<string>> = {
  us: new Set(["Iran", "Iraq", "sea"]),
  gulf: new Set(["Iran", "Iraq", "sea"]),
  israel: new Set(["Iran", "Iraq", "Lebanon", "sea"]),
};
export function iranPinAllowed(actor: string | null | undefined, place: Pick<IranPlace, "country"> & Partial<Pick<IranPlace, "lat" | "lng">>, headline: string): boolean {
  const a = String(actor || "unclear");
  if (place.lat != null && place.lng != null && place.lat < 20.3 && place.lng > 32 && place.lng < 52) return false;
  if ((a === "houthi" && place.country !== "Israel") || NOT_AN_ATTACK.test(headline) || NOT_NEW_OR_NOT_A_STRIKE.test(headline) || FIRST_FOOTAGE_RE.test(headline) || ROUNDUP.test(headline) || tallyNotEvent(headline)) return false;
  if (/\bsirens?\b/i.test(headline) && place.country === "Israel") return false;
  if (place.country === "Yemen" || place.country === "Gaza" || place.country === "Palestine") return false;
  if (AXIS.has(a)) return place.country !== "Iran" || (a === "iran" && AIR_DEFENCE.test(headline) && !INTERNAL.test(headline));
  if (PURSUERS[a]) return PURSUERS[a].has(place.country);
  return place.country !== "Syria" && !INTERNAL.test(headline);
}

/**
 * A place for an Iran desk card stored with none (user, 18 Oct: 300 strike, fighting and ship cards had no pin,
 * Israeli strikes on south Lebanon's villages among them): the first place its headline names that the map may
 * show for its actor, as a new card is pinned (editor.ts pinIran).
 */
export function iranPlaceFromWords(summary: string, type: string, card?: { body?: string; flags?: string[] }): { name: string; lat: number; lng: number } | null {
  const actor = (card?.flags ?? []).map((f) => /^actor:(.+)$/.exec(f)?.[1]).find(Boolean) ?? null;
  // The source's own words are not kept with a stored card: its headline and text stand for them.
  const p = iranPins(summary, `${summary}\n${card?.body ?? ""}`, type === "vessel").find((x) => iranPinAllowed(actor, x, summary));
  return p ? { name: p.name, lat: p.lat, lng: p.lng } : null;
}

const PLACE_BY_NAME = new Map([...GAZ.map((g) => [g.place.name, g.place] as const), ...IRAN_PLACES.map((p) => [p.name, p] as const)]);

/**
 * A stored Iran pin the map may show, checked again as it is served (user,
 * 9 Oct: the Red Sea round-up stayed after the rules changed): its place on
 * the region's list and within the map's scope. Rows stay as they are.
 */
export function iranEventAllowed(e: { actor?: string | null; place?: string | null; label?: string | null }): boolean {
  const p = PLACE_BY_NAME.get(String(e.place ?? ""));
  return !!p && iranPinAllowed(e.actor ?? null, p, String(e.label ?? ""));
}

/**
 * A Gulf state's own attack (user, 20 Oct: "return the gulf states as a side in purple ... and add their pins for
 * attacks they did"): a strike, a raid or jets a Gulf state flies, alone or beside the US, or a strike laid at its
 * door. Not its air defence. The same words as scripts/iran-research/pin-rules.cjs GULF_ATTACK (the researched pins).
 */
export const GULF_ATTACK = /\b(?:(?:US|U\.S\.|American)(?:\s+and\s+|-)(?:Saudi|Emirati|UAE|Qatari|Bahraini|Kuwaiti|Omani)|Saudi(?:[- ]led)?|Emirati|UAE|Qatari|Bahraini|Kuwaiti|Omani|(?<!Persian |Arabian )Gulf)\s+(?:(?:fighter|war|air|drone|naval)\s+)?(?:jets?|warplanes?|planes?|aircraft|air ?strikes?|strikes?|raids?|bombing|bombardment|artillery|shelling|helicopters?|drone strikes?|forces?\s+(?:strike|struck|hit|bomb\w*|attack\w*|shell\w*|raid\w*))\b|\b(?:attributed|blamed)\s+(?:on|to)\s+(?:the\s+)?(?:UAE|Emirates|Saudi Arabia|Saudis|Qatar|Bahrain|Kuwait|Oman)\b|\b(?:Saudi Arabia|the UAE|Emirates|Qatar|Bahrain|Kuwait|Oman)\s+(?:strikes|struck|bombs|bombed|shells|shelled|raids|raided|launch(?:es|ed)\s+(?:air ?)?strikes)\b/;
const GULF_TARGET_BEFORE = /\b(?:on|at|against|targeting|targets?|hits?|hit|struck|over|into|toward|towards)\s+(?:the\s+|a\s+|an\s+)?$/i;
export function gulfAttack(label: string | null | undefined): boolean {
  const s = String(label || "");
  const m = GULF_ATTACK.exec(s);
  return !!m && !GULF_TARGET_BEFORE.test(s.slice(Math.max(0, m.index - 20), m.index));
}

/**
 * Iran's own air defence, interceptions, sirens and blasts heard over Iran are
 * not Iran's attacks (user, 12 Oct): with no attacker named, the pin's side is
 * "not stated". map-pack.cjs applies the same rule to the researched pins.
 */
const DEFENCE = /intercept|air[- ]?defen[cs]e|shot down|shoots? down|downed|sirens?\b|explosions? (?:were |was )?(?:heard|reported)|blasts? heard|sounds? of explosions|red alert|anti-?aircraft|alert sounded/i;
const ATTACKER = /\b(?:Israel|Israeli|US|U\.S\.|American|CENTCOM|IDF|Mossad)\b/;
export function ownSkyOnly(e: { actor?: string | null; place?: string | null; label?: string | null }): boolean {
  const p = PLACE_BY_NAME.get(String(e.place ?? ""));
  const label = String(e.label ?? "");
  return e.actor === "iran" && p?.country === "Iran" && DEFENCE.test(label) && !ATTACKER.test(label);
}

/**
 * A pin on a district's seat when its label names the village ("Israeli tank fire kills a retired soldier
 * in Yater, Bint Jbeil district", pinned at Bint Jbeil; Stage C, 12 Oct): the village the label names first,
 * near the seat. Null when the pin stands right.
 */
export function districtSeat(e: { place?: string | null; label?: string | null }): IranPlace | null {
  const me = PLACE_BY_NAME.get(String(e.place ?? ""));
  const label = String(e.label ?? "");
  if (!me || !asProvince(label, me)) return null;
  const others = [...iranPlacesIn(label), ...gazPlacesIn(label, label)].filter((p) => p.name !== me.name && p.kind !== "sea" && km(p, me) < 40);
  return others[0] ?? null;
}

/**
 * A stored pin whose place was only heard inside a longer place's name (user,
 * 11 Oct: "Bint Jbeil" read as Jbeil, Byblos, 113 km north): the longer place
 * the label names, when the pin's own name is nowhere else in it and the two
 * lie more than 15 km apart. Null when the pin stands right.
 */
export function heardInside(e: { place?: string | null; label?: string | null }): IranPlace | null {
  const me = PLACE_BY_NAME.get(String(e.place ?? ""));
  const label = String(e.label ?? "");
  if (!me || !label) return null;
  const words = latinWords(label);
  const mine = [me.name, ...(me.alt ?? [])].filter((n) => LATIN.test(n)).map((n) => latinWords(n).join(" ")).filter(Boolean);
  const said = words.join(" ");
  if (mine.some((n) => ` ${said} `.includes(` ${n} `))) return null;
  const sounds = new Set([me.name, ...(me.alt ?? [])].map((n) => (LATIN.test(n) ? latinSound(latinWords(n)) : nativeSound(n))).filter((s) => s.length >= 3));
  for (const host of iranPlacesIn(label)) {
    if (host === me || km(host, me) <= 15) continue;
    const parts = [host.name, ...(host.alt ?? [])].filter((n) => LATIN.test(n) && /[\s-]/.test(n)).flatMap((n) => latinWords(n));
    if (parts.some((w) => sounds.has(latinSound([w])))) return host;
  }
  return null;
}

/**
 * At sea or on land, and a sea pin in its sea and off the land (user, 12 Oct: a Hormuz pin in the Red Sea,
 * land pins under "At sea"): the researched pins' rule (scripts/iran-research/offshore.mjs), for the desk's own.
 */
const SEA_RULE = makeSea((LAND as { polys: Parameters<typeof makeSea>[0] }).polys);
export function seaPlace(e: { lat: number; lng: number; place?: string | null; label?: string | null; type?: string | null }) {
  return SEA_RULE.place(e, (name) => { const p = PLACE_BY_NAME.get(name) ?? iranPlacesIn(name)[0]; return p ? [p.lat, p.lng] : null; });
}

/** In Lebanon, by the pin's spot. */
export const inLebanon = (lat: number, lng: number) => lat > 33.03 && lat < 34.7 && lng > 35.1 && lng < 36.65;

/**
 * Syria's Quneitra, set down on the Lebanese village of Qnaitra by the place search (17 Oct: "Israeli
 * forces shell Jabata al-Khashab nature reserve in northern Quneitra countryside" pinned near Nabatieh).
 */
export function syrianQuneitra(e: { lat?: number; lng?: number; label?: string | null }): { place: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number" || !inLebanon(e.lat, e.lng)) return null;
  const t = String(e.label ?? "");
  if (!/\bQu?n[ae]itr[ae]h?\b/i.test(t) || !/\b(?:Syria|Syrian|countryside|Golan|Kodana|Kudnah|Jabata|Khashab|Hamidiyah|Rafid)\b/i.test(t)) return null;
  return { place: "Quneitra countryside, Syria", lat: 33.1257, lng: 35.8241 };
}

/**
 * Fire into south Lebanon with no side named is Israel's: only its forces shell, bulldoze and raid there
 * in this war (17 Oct: "Shelling of Ain al-Samahiya between Zoutar al-Sharqiya and Mifdun" had no colour).
 */
export function lebanonFire(e: { lat?: number; lng?: number; label?: string | null; actor?: string | null }): boolean {
  if (typeof e.lat !== "number" || typeof e.lng !== "number" || !inLebanon(e.lat, e.lng)) return false;
  if (e.actor && e.actor !== "unclear") return false;
  const t = String(e.label ?? "");
  if (/\b(?:Hezbollah|Islamic Resistance|resistance fighters|rocket fire (?:at|toward|on) (?:northern )?Israel)\b/i.test(t)) return false;
  return /\b(?:hostile|enemy|shell\w*|artillery|Merkava|tank (?:fire|shell)|demoli\w*|bulldoz\w*|incursion|sweep|combing|flares?|machine-?gun|air ?strikes?|drone strikes?|warplanes?)\b/i.test(t);
}
