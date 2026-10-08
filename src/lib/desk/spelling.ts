/**
 * How the desk writes Arabic names in English: one spelling per person and
 * place, the one the wires use (Reuters, AP, AFP), whatever the model wrote.
 *
 * - The reader is told, per post, how to write the people and places it
 *   names (`spellingHints`).
 * - After the reader, any other spelling of a known name in the headline or
 *   body becomes the desk's (`respell`).
 * - A name the desk does not know follows the rules in the reader's prompt
 *   (`SPELLING_RULES`), and an Arabic word left in the copy is transliterated
 *   by `anglicise`.
 */

import { PLACES } from "./gazetteer.ts";

type Person = {
  /** The one spelling that reaches the page. */
  en: string;
  /** How Arabic posts write him or her. */
  ar: string[];
  /** Other English spellings (regex sources), replaced by `en`. */
  variants?: string[];
};

const AL = String.raw`(?:al-?|el-?|al |el )`;

/** People the war's news names often. */
export const PEOPLE: Person[] = [
  // Houthis
  { en: "Abdul-Malik al-Houthi", ar: ["عبد الملك الحوثي", "عبدالملك الحوثي", "عبد الملك بدر الدين الحوثي", "عبدالملك بدرالدين الحوثي"], variants: [String.raw`Abd(?:ul|el|al|-?al)?[- ]?Mal(?:i|e)k ${AL}?H[ou]u?th[iy]`, String.raw`Abdulmalik ${AL}?Houthi`] },
  { en: "Yahya Saree", ar: ["يحيى سريع", "يحيي سريع"], variants: [String.raw`Yahy?a Sar(?:ee|i|ie|ea|ia|e'e|i')`] },
  { en: "Mohammed Abdulsalam", ar: ["محمد عبد السلام", "محمد عبدالسلام"], variants: [String.raw`Moh?amm?[ea]d Abd(?:ul|el|al)[- ]?[Ss]alam`] },
  { en: "Mahdi al-Mashat", ar: ["مهدي المشاط"], variants: [String.raw`Mahdi ${AL}Mash+at`] },
  { en: "Mohammed Ali al-Houthi", ar: ["محمد علي الحوثي"], variants: [String.raw`Moh?amm?[ea]d Ali ${AL}H[ou]u?th[iy]`] },
  { en: "Mohammed al-Bukhaiti", ar: ["محمد البخيتي"], variants: [String.raw`Moh?amm?[ea]d ${AL}Bukh(?:a|ay)?(?:i|ee)?ti`] },
  { en: "Hussein al-Ezzi", ar: ["حسين العزي"], variants: [String.raw`Huss?[ae]in ${AL}(?:Ezzi|Izzi|Azzi)`] },
  { en: "Hezam al-Asad", ar: ["حزام الأسد", "حزام الاسد"], variants: [String.raw`Hi?[ez]am ${AL}Assad`, String.raw`Hizam ${AL}Asad`] },
  { en: "Nasruddin Amer", ar: ["نصر الدين عامر", "نصرالدين عامر"], variants: [String.raw`Nasr?(?:[- ]?[aeu]d[- ]?Din|uddin|eddin) Amer`] },
  { en: "Mohammed al-Atifi", ar: ["محمد العاطفي"], variants: [String.raw`Moh?amm?[ea]d ${AL}At(?:t)?ifi`] },
  { en: "Yousef al-Madani", ar: ["يوسف المداني"], variants: [String.raw`Yo?usu?[ef]f? ${AL}Madani`] },
  { en: "Abdulqader al-Murtada", ar: ["عبد القادر المرتضى", "عبدالقادر المرتضى"], variants: [String.raw`Abd(?:ul|el|al)[- ]?[QK]ader ${AL}Murt[ae]d[ah]a?`] },
  { en: "Abdulmalik al-Ajri", ar: ["عبد الملك العجري", "عبدالملك العجري"], variants: [String.raw`Abd(?:ul|el|al)[- ]?Mal(?:i|e)k ${AL}Ajri`] },
  { en: "Abdulkhaleq al-Houthi", ar: ["عبد الخالق الحوثي", "عبدالخالق الحوثي"], variants: [String.raw`Abd(?:ul|el|al)[- ]?Khal(?:e|i)q ${AL}H[ou]u?th[iy]`] },
  // Government and the Presidential Leadership Council
  { en: "Rashad al-Alimi", ar: ["رشاد العليمي", "رشاد محمد العليمي"], variants: [String.raw`Rashad ${AL}(?:Aleemi|Olaimi|Ulaymi|Alimy)`] },
  { en: "Aidarous al-Zubaidi", ar: ["عيدروس الزبيدي", "عيدروس قاسم الزبيدي"], variants: [String.raw`Aid(?:a|e|ou|o)?r(?:oo|o|ou|u)s ${AL}Zub(?:ai|ay|ei)di`] },
  { en: "Tareq Saleh", ar: ["طارق صالح", "طارق محمد عبدالله صالح"], variants: [String.raw`Tar[ie][qk] Sal(?:e|i)h`, String.raw`Tareq Salih`] },
  { en: "Sultan al-Arada", ar: ["سلطان العرادة"], variants: [String.raw`Sultan ${AL}Ar+ad(?:a|ah)`] },
  { en: "Abu Zaraa al-Mahrami", ar: ["أبو زرعة المحرمي", "ابو زرعة المحرمي", "عبد الرحمن المحرمي", "عبدالرحمن المحرمي"], variants: [String.raw`Abu Zar(?:'?aa?|'a|ah) ${AL}Mahrami`, String.raw`Abd(?:ul|el|al)[- ]?Rah?man ${AL}Mahrami`] },
  { en: "Faraj al-Bahsani", ar: ["فرج البحسني"], variants: [String.raw`Faraj (?:Salmin )?${AL}Bahsani`] },
  { en: "Abdullah al-Alimi", ar: ["عبدالله العليمي", "عبد الله العليمي"], variants: [String.raw`Abd(?:ul|el)?[- ]?[Ll]ah ${AL}Alimi`] },
  { en: "Othman Mujalli", ar: ["عثمان مجلي"], variants: [String.raw`Oth?man Mujall?i`, String.raw`Uthman Mujalli`] },
  { en: "Salem bin Breik", ar: ["سالم بن بريك"], variants: [String.raw`Salem [Bb]in B(?:raik|uraik|reik|urayk)`] },
  { en: "Muammar al-Eryani", ar: ["معمر الإرياني", "معمر الارياني"], variants: [String.raw`Mu'?amm?[ae]r ${AL}(?:Iryani|Eryani|Aryani)`] },
  { en: "Shaya al-Zindani", ar: ["شائع الزنداني", "شايع الزنداني"], variants: [String.raw`Sha(?:y|'|e)?(?:a|e)a? (?:Mohsen )?${AL}Zindani`] },
  { en: "Sagheer bin Aziz", ar: ["صغير بن عزيز"], variants: [String.raw`Sagh?(?:ee|i)r [Bb]in Aziz`] },
  { en: "Mahmoud al-Subaihi", ar: ["محمود الصبيحي"], variants: [String.raw`Mahm(?:ou|u)d ${AL}Sub(?:ai|ay)hi`] },
  { en: "Hani bin Breik", ar: ["هاني بن بريك"], variants: [String.raw`Hani [Bb]in B(?:raik|uraik|reik)`] },
  { en: "Ahmed Awad bin Mubarak", ar: ["أحمد عوض بن مبارك", "احمد عوض بن مبارك"], variants: [String.raw`Ahm[ae]d Awadh? [Bb]in Mub[ae]rak`] },
  { en: "Afrah al-Zouba", ar: ["أفراح الزوبة", "افراح الزوبة"], variants: [String.raw`Afrah ${AL}Zub(?:a|ah)`] },
  // Saudi Arabia
  { en: "Mohammed bin Salman", ar: ["محمد بن سلمان"], variants: [String.raw`Moh?amm?[ea]d [Bb]in Salman`] },
  { en: "Khalid bin Salman", ar: ["خالد بن سلمان"], variants: [String.raw`Khaled [Bb]in Salman`] },
  { en: "Faisal bin Farhan", ar: ["فيصل بن فرحان"], variants: [String.raw`Faysal [Bb]in Farhan`] },
  { en: "Mohammed Al Jaber", ar: ["محمد آل جابر", "محمد ال جابر"], variants: [String.raw`Moh?amm?[ea]d (?:Al-|al-|Aal )Jaber`] },
  { en: "Turki al-Maliki", ar: ["تركي المالكي"], variants: [String.raw`Turki ${AL}Malki`] },
  // Iran (8 Oct, the Iran desk): by surname, as the wires write them. `ar`
  // holds the Persian spelling and the Arabic one. A Persian name follows
  // Persian sounds, not Arabic ones: ق and غ are "gh" (Ghalibaf, not Qalibaf),
  // و is "v" (Velayati), the vowels are e and o (Esmaeil, Mohsen).
  { en: "Araghchi", ar: ["عراقچی", "عراقچي", "عراقجي", "عراقتشي"], variants: [String.raw`Ara(?:q|k|g|gh)(?:ch|j|tch)[iy]`, String.raw`Iraq(?:ch|j)i`, String.raw`Erak?chi`, String.raw`Araghchy`] },
  { en: "Khamenei", ar: ["خامنه‌ای", "خامنه ای", "خامنه‌اي", "خامنئي", "خامنئی"], variants: [String.raw`Kham(?:e|a)n(?:e|eh)?'?(?:i|ai|ii)`, String.raw`Khameini`, String.raw`Khamina?i`].map((v) => String.raw`(?!Khamenei\b)${v}`) },
  { en: "Pezeshkian", ar: ["پزشکیان", "پزشكيان", "بزشكيان", "بزشکیان"], variants: [String.raw`(?:Pez|Paz|Biz|Bez|Piz|Pez)(?:e|i)?shk(?:i|y|iy)an`].map((v) => String.raw`(?!Pezeshkian\b)${v}`) },
  { en: "Ghalibaf", ar: ["قالیباف", "قاليباف"], variants: [String.raw`(?:Qal|Kal|Ghal)(?:i|ee|e)baa?f`].map((v) => String.raw`(?!Ghalibaf\b)${v}`) },
  { en: "Baghaei", ar: ["بقائی", "بقایی", "بقائي", "بقايي"], variants: [String.raw`Ba(?:q|gh)a(?:'i|ee|i|ie|yi|ei)`].map((v) => String.raw`(?!Baghaei\b)${v}`) },
  { en: "Ghaempanah", ar: ["قائم‌پناه", "قائم پناه", "قائمپناه"], variants: [String.raw`(?:Qa|Gha)(?:e|i|')?m[- ]?[Pp]anah`].map((v) => String.raw`(?!Ghaempanah\b)${v}`) },
  { en: "Haddad-Adel", ar: ["حداد عادل", "حدادعادل"], variants: [String.raw`Hadd?ad(?:[- ]e)?[- ]?Adel`, String.raw`Haddadadad`].map((v) => String.raw`(?!Haddad-Adel\b)${v}`) },
  { en: "Mohammad Eslami", ar: ["محمد اسلامی", "محمد إسلامي"], variants: [String.raw`Moh?amm?[ae]d Islami`] },
  { en: "Gharibabadi", ar: ["غریب‌آبادی", "غریب آبادی", "غريب آبادي"], variants: [String.raw`(?:Qarib|Gharib)[- ]?[Aa]badi`].map((v) => String.raw`(?!Gharibabadi\b)${v}`) },
  { en: "Velayati", ar: ["ولایتی", "ولايتي"], variants: [String.raw`Wilayati`, String.raw`Velayaty`] },
  { en: "Mohajerani", ar: ["مهاجرانی", "مهاجراني"], variants: [String.raw`Muhajerani`, String.raw`Mohajerany`] },
  { en: "Takht-Ravanchi", ar: ["تخت‌روانچی", "تخت روانچی", "تخت روانجي"], variants: [String.raw`Takht(?:[- ]e)?[- ]Ravanchi`].map((v) => String.raw`(?!Takht-Ravanchi\b)${v}`) },
  { en: "Mohseni-Ejei", ar: ["محسنی اژه‌ای", "محسنی اژه ای", "محسني إجئي"], variants: [String.raw`Mohseni[- ]Ej(?:e|eh)(?:'i|i|ie|ii|hi)`].map((v) => String.raw`(?!Mohseni-Ejei\b)${v}`) },
  { en: "Qaani", ar: ["قاآنی", "قاآني", "قآني"], variants: [String.raw`Gh?aa'?ani`, String.raw`Qa'?ani`, String.raw`Ghaani`].map((v) => String.raw`(?!Qaani\b)${v}`) },
  { en: "Pakpour", ar: ["پاکپور", "پاک‌پور", "باكبور"], variants: [String.raw`Pakpur`] },
  { en: "Nasirzadeh", ar: ["نصیرزاده", "نصيرزاده"], variants: [String.raw`Nasir[- ]?[Zz]ade`, String.raw`Nasir Zadeh`].map((v) => String.raw`(?!Nasirzadeh\b)${v}`) },
  { en: "Kanaani", ar: ["کنعانی", "كنعاني"], variants: [String.raw`Kan'?ani`].map((v) => String.raw`(?!Kanaani\b)${v}`) },
  { en: "Zolghadr", ar: ["ذوالقدر"], variants: [String.raw`Z[ou]l(?:q|gh)adr`].map((v) => String.raw`(?!Zolghadr\b)${v}`) },
  { en: "Shamkhani", ar: ["شمخانی", "شمخاني"] },
  { en: "Larijani", ar: ["لاریجانی", "لاريجاني"], variants: [String.raw`Larijany`] },
  { en: "Mousavi", ar: ["موسوی", "موسوي"], variants: [String.raw`Musavi`, String.raw`Moussavi`] },
  { en: "Tangsiri", ar: ["تنگسیری", "تنكسيري"] },
  { en: "Vahidi", ar: ["وحیدی", "وحيدي"] },
  { en: "Jalili", ar: ["جلیلی", "جليلي"] },
  { en: "Mokhber", ar: ["محمد مخبر"], variants: [String.raw`Mukhber`] },
  { en: "Hatami", ar: ["حاتمی", "حاتمي"] },
  { en: "Ahmadian", ar: ["احمدیان", "أحمديان"] },
  { en: "Kpler", ar: ["کپلر", "كبلر"], variants: [String.raw`Capler(?: Analytics)?`, String.raw`Kepler(?= (?:data|Analytics|figures|says|said|estimates))`] },
];

/**
 * Iran's places as the wires write them (8 Oct). Kept apart from PEOPLE (whose
 * words are never places) and from the Yemen gazetteer (which pins them).
 */
export const IRAN_PLACES: Person[] = [
  { en: "Bandar Abbas", ar: ["بندرعباس", "بندر عباس"], variants: [String.raw`Bandar[- ]e[- ]Abbas`, String.raw`Bandar-Abbas`] },
  { en: "Bushehr", ar: ["بوشهر"], variants: [String.raw`Bushire`, String.raw`Bouchehr`, String.raw`Busheh?r(?<!Bushehr)`] },
  { en: "Isfahan", ar: ["اصفهان", "أصفهان"], variants: [String.raw`Esfahan`, String.raw`Isfehan`] },
  { en: "Fordow", ar: ["فردو", "فوردو"], variants: [String.raw`Ford(?:o|u|ou|ow)(?<!Fordow)`] },
  { en: "Natanz", ar: ["نطنز"] },
  { en: "Kharg", ar: ["خارک", "خارك"], variants: [String.raw`Khark`] },
  { en: "Chabahar", ar: ["چابهار", "جابهار", "تشابهار"], variants: [String.raw`Chah[- ]?Bahar`] },
  { en: "Sistan and Baluchestan", ar: ["سیستان و بلوچستان", "سيستان وبلوشستان", "سيستان وبلوچستان", "سيستان و بلوشستان"], variants: [String.raw`Sistan[- ](?:and[- ])?Bal(?:o|u)ch(?:i|e)stan(?<!Sistan and Baluchestan)`] },
  { en: "Khuzestan", ar: ["خوزستان"], variants: [String.raw`Khuzistan`] },
  { en: "Ahvaz", ar: ["اهواز", "الأهواز"], variants: [String.raw`Ahwaz`] },
  { en: "Qom", ar: [], variants: [String.raw`Ghom`] },
  { en: "Qeshm", ar: ["قشم"], variants: [String.raw`Gheshm`, String.raw`Qishm`] },
  { en: "Asaluyeh", ar: ["عسلویه", "عسلوية"], variants: [String.raw`Ass?al(?:ou|u)y(?:eh|e)(?<!Asaluyeh)`] },
  { en: "Kermanshah", ar: ["کرمانشاه", "كرمانشاه"], variants: [String.raw`Kirmanshah`] },
  { en: "Hormozgan", ar: ["هرمزگان", "هرمزكان"], variants: [String.raw`Hormuzgan`] },
  { en: "Jask", ar: ["جاسک", "جاسك"] },
  { en: "Parchin", ar: ["پارچین", "بارشين"] },
  { en: "Mashhad", ar: [], variants: [String.raw`Meshed`] },
  { en: "Tabriz", ar: ["تبریز", "تبريز"] },
  { en: "Shiraz", ar: ["شیراز", "شيراز"] },
  { en: "Nikshahr", ar: ["نیکشهر", "نيكشهر"], variants: [String.raw`Nik[- ]Shahr`] },
];

/** Place spellings that are other names, not other spellings: never swapped. */
const KEEP_ALIAS = /^(?:Perim|Dhu \?Bab)$/i;

type Swap = { re: RegExp; src: string; to: string };

const B = String.raw`(?<![A-Za-z'’-])(?<!\b[AaEe][ln] )`;
const E = String.raw`(?![A-Za-z'’-])`;

const SWAPS: Swap[] = [
  ...[...PEOPLE, ...IRAN_PLACES].flatMap((p) => (p.variants ?? []).map((v) => ({ re: new RegExp(`${B}(?:${v})${E}`, "g"), src: v, to: p.en }))),
  ...[...PLACES]
    .sort((a, b) => b.name.length - a.name.length)
    .flatMap((p) =>
      p.aliases
        // An alias that is the name itself changes nothing.
        .filter((a) => /^[A-Za-z]/.test(a.replace(/^\\b/, "")) && !/\(\?:/.test(a) && !KEEP_ALIAS.test(a) && a.replace(/\\b/g, "").toLowerCase() !== p.name.replace(/^the /, "").toLowerCase())
        // "al-?Jawf" also takes "Al Jawf".
        .map((a) => {
          const src = a.replace(/\\b/g, "").replace(/al-\?/gi, "al[- ]?");
          return { re: new RegExp(`${B}(?:${src})${E}`, "gi"), src, to: p.name.replace(/^the /, "") };
        }),
    ),
];

/** One look for any other spelling at all, so most copy costs one test. */
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ANY = new RegExp(`${B}(?:${SWAPS.map((s) => `(?!${escRe(s.to)}${E})(?:${s.src})`).join("|")})${E}`, "i");

/** Every known name in English copy, in the desk's one spelling. */
export function respell(text: string): string {
  let out = String(text || "");
  if (!out || !ANY.test(out)) return out;
  for (const { re, to } of SWAPS) out = out.replace(re, to);
  return out;
}

const HAS_AR = /[؀-ۿ]/;
/** An Arabic or Persian letter (پ چ ژ ک گ ی too). */
const FA_LETTER = "[\u0621-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC]";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "يحيى سريع = Yahya Saree; الحديدة = Hodeidah": how this post's names are written. */
export function spellingHints(sourceText: string, max = 20): string {
  const t = String(sourceText || "");
  if (!HAS_AR.test(t)) return "";
  const out: string[] = [];
  for (const p of PEOPLE) {
    const hit = p.ar.find((a) => new RegExp(`(?<![\\u0621-\\u064A])${esc(a)}`).test(t));
    if (hit) out.push(`${hit} = ${p.en}`);
    if (out.length >= max) break;
  }
  // Iran's places as whole words, Persian letters included on both sides.
  for (const p of IRAN_PLACES) {
    if (out.length >= max) break;
    const hit = p.ar.find((a) => new RegExp(`(?<!${FA_LETTER})${esc(a)}(?!${FA_LETTER})`).test(t));
    if (hit) out.push(`${hit} = ${p.en}`);
  }
  for (const p of PLACES) {
    if (out.length >= max) break;
    // A name two places share is this one's only in its own context.
    if ((p.needs && !new RegExp(p.needs, "i").test(t)) || (p.unless && new RegExp(p.unless, "i").test(t))) continue;
    for (const a of p.aliases) {
      if (!HAS_AR.test(a)) continue;
      let re: RegExp;
      try {
        re = new RegExp(`(?<![\\u0621-\\u064A])[وفبلك]{0,2}((?:${a}))(?![\\u0621-\\u064A])`);
      } catch {
        continue;
      }
      const m = re.exec(t);
      if (m) {
        out.push(`${m[1]} = ${p.name.replace(/^the /, "").replace(/ \(.*\)$/, "")}`);
        break;
      }
    }
  }
  return out.join("; ");
}

/** The reader's rules for a name the desk does not know. */
export const SPELLING_RULES = `- Names: when an item has "spelling", write those names exactly so. Any other
  Arabic name the way the wires (Reuters, AP, AFP) write it: the usual English
  form when there is one (Sanaa, Hodeidah, Saada, Marib, Mukalla, Mohammed,
  Abdullah, Hussein); "al-" joined by a hyphen and lower case inside a name
  (Mahdi al-Mashat), "Al-" when it begins a place name (Al-Jawf); "bin" for بن;
  "Abdul-"/"Abdul" for عبد (Abdulaziz, Abdul-Malik); no apostrophes or marks
  for ع and ء; ة is "a" or "ah" (Hodeidah, Shabwa); ق is "q", خ "kh", غ "gh",
  ش "sh", ث "th", ذ and ظ "dh". Never transliterate an ordinary word: translate it.`;

/**
 * The Iran reader's rules for a Persian name the desk does not know (8 Oct:
 * "Haddadadad" for Haddad-Adel, "Qaem Panah" for Ghaempanah, "Capler" for Kpler).
 */
export const PERSIAN_SPELLING_RULES = `- Names: when an item has "spelling", write those names exactly so. Any other
  Iranian name the way the wires (Reuters, AP, AFP) and Iran's own English
  outlets write it, by PERSIAN sounds, never Arabic ones: ق and غ are "gh"
  (Ghalibaf, Gharibabadi, Ghaempanah), و is "v" (Velayati, Vahidi), خ "kh",
  چ "ch", ژ "zh", ش "sh"; the short vowels are "e" and "o", not "i" and "u"
  (Esmaeil, Mohsen, Mojtaba, Hossein, Mohammad); ی at the end is "i" (Rezaei,
  Baghaei); ع and ء are not written. A compound name keeps its hyphen
  (Haddad-Adel, Mohseni-Ejei, Takht-Ravanchi); never join or double its parts.
  An Arabic name the way the wires write Arabic names (al-, bin, q for ق).
- A firm, an outlet or a body keeps its own Latin name, never a spelling back
  from Persian or Arabic: کپلر is Kpler, ویندوارد Windward, وال‌استریت ژورنال
  the Wall Street Journal. If you do not know a name's Latin form, describe
  it ("a German business weekly") rather than guess a spelling.
- Never transliterate an ordinary word: translate it. ماه is "month", not a
  name ("اعتراضات دی ماه" are the January 2026 protests).`;
