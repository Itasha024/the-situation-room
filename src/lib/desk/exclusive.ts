/**
 * A piece the outlet has on its own: "Exclusive:", "علمت «الأخبار»", "مصادر
 * لـ«سهيل»", "sources told Al-Akhbar", "Sheba Intelligence has learned". Such
 * a piece is always read in full, never left behind by the triage cap, and its
 * card carries an "Exclusive" label.
 */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const GENERIC = [
  /\bexclusive(?:ly)?\b/i,
  /حصري(?:اً|ا|ة)?/,
  // "خاص" alone is "especially"; as a label it stands at the head or before «outlet».
  /(?:^|[\n|:])\s*خاص\s*(?:[|:\-–—]|ب\s*«|لـ?\s*«)/,
  /(?:^|[\n|:])\s*«?خاص»?\s*$/m,
];

/**
 * Sites whose value is what they have on their own. Most of what they post is
 * other agencies' news, already on the desk from its first source; like Sky
 * News Arabia's breaking account, only their own information goes on: an
 * exclusive, their own sources, or words said to them (an interview, a
 * statement given to them).
 */
const OWN_NAMES: Record<string, { en: string[]; ar: string[] }> = {
  "Erem News": { en: ["Erem News", "Erem"], ar: ["إرم نيوز", "إرم"] },
  "Asharq Al-Awsat": { en: ["Asharq Al-Awsat"], ar: ["الشرق الأوسط"] },
  "Al-Araby Al-Jadeed": { en: ["Al-Araby Al-Jadeed", "The New Arab", "Al-Araby"], ar: ["العربي الجديد"] },
  "Al-Akhbar": { en: ["Al-Akhbar"], ar: ["الأخبار"] },
  Alhurra: { en: ["Alhurra", "Al-Hurra", "Al Hurra"], ar: ["الحرة"] },
  "Arab News": { en: ["Arab News"], ar: ["عرب نيوز"] },
};
export const OWN_ONLY = new Set(Object.keys(OWN_NAMES));

const Q = String.raw`\s*[«"“']?\s*`;
/** "لـ«الشرق الأوسط»", "للشرق الأوسط", "لإرم نيوز". */
const toAr = (n: string) => (n.startsWith("ال") ? String.raw`(?:لـ?${Q}${esc(n)}|ل${esc(n.slice(1))})` : String.raw`لـ?${Q}${esc(n)}`);

/** Does the piece carry the outlet's own information? Always true for other outlets. */
export function ownInformation(text: string, source: string): boolean {
  const names = OWN_NAMES[source];
  if (!names) return true;
  if (isExclusive(text, source)) return true;
  // Outlets word it many ways; any sign that the outlet itself was told,
  // shown, or went and saw counts. Other agencies' news does not.
  const t = String(text || "").slice(0, 6000);
  for (const n of names.en) {
    const name = String.raw`(?:the\s+)?${esc(n)}(?:'s)?`;
    if (new RegExp(String.raw`\b(?:told|tells|telling|informed|said to|say to|says to|speaking (?:to|with)|spoke (?:to|with)|talking to|talked to|in (?:an? )?(?:exclusive |phone |telephone |special )?(?:interview|conversation|call|remarks|comments|statement|statements)s? (?:with|to)|interviewed by|confirmed to|revealed to|briefed|according to (?:sources|officials|documents|a source|an official)[^.\n]{0,60}(?:to|by|with))\s+${name}\b`, "i").test(t)) return true;
    if (new RegExp(String.raw`\b(?:obtained|seen|reviewed|viewed|verified|confirmed|gathered)\s+by\s+${name}\b`, "i").test(t)) return true;
    if (new RegExp(String.raw`\b${esc(n)}\b[^.\n]{0,40}\b(?:has |have |had )?(?:learned|learnt|obtained|reviewed|understands|can reveal|can confirm|has seen|was told|were told|visited|toured|witnessed|correspondent)`, "i").test(t)) return true;
    if (new RegExp(String.raw`\b${esc(n)}(?:'s)?\s+(?:correspondent|reporter|sources?|team)\b`, "i").test(t)) return true;
  }
  for (const n of names.ar) {
    const to = toAr(n);
    const nm = `${Q}${esc(n)}`;
    // Words said to it: "قال مسؤول لـ«الشرق الأوسط»", "أبلغ مصدر «إرم نيوز»".
    if (new RegExp(String.raw`(?:قال|قالت|يقول|تقول|أكد|أكدت|يؤكد|كشف|كشفت|يكشف|أوضح|أوضحت|صرح|صرّح|صرحت|أفاد|أفادت|تحدث|تحدثت|أشار|أشارت|أضاف|أضافت|نفى|نفت|رجح|رجّح|توقع|أعرب|اعتبر|أبلغت?|يبلغ|مصادر|مصدر|مسؤول|مسؤولون|مسؤولين|قيادي|قياديون|ضابط|مستشار|دبلوماسي|دبلوماسيون|شهود|سكان|مواطنون|مطلع|مطلعة)[^.\n]{0,90}(?:${to}|أبلغت?${nm})`).test(t)) return true;
    if (new RegExp(String.raw`(?:أبلغ|أبلغت|يبلغ|أخبر|أخبرت)[^.\n]{0,40}${nm}`).test(t)) return true;
    // An interview or statement given to it or with it.
    if (new RegExp(String.raw`(?:حديث|حديثه|حديثها|مقابلة|تصريح|تصريحات|تصريحه|حوار|لقاء|اتصال|مكالمة|رسالة|ردّ|رد)[^.\n]{0,25}(?:خاص(?:ة)?\s*)?(?:${to}|مع${nm}|أجرته${nm}|أجرتها${nm})`).test(t)) return true;
    // What it learned, got hold of, saw, checked.
    if (new RegExp(String.raw`(?:علمت|حصلت|اطلعت|تلقت|رصدت|وثقت|تابعت|زارت|تحققت|استطلعت|انفردت|تنفرد|تكشف|كشفت|تنشر|نشرت|تنقل|نقلت)(?:\s+عليها|\s+عليه)?${nm}`).test(t)) return true;
    if (new RegExp(String.raw`(?:حصلت|اطلعت|وصلت)[^.\n]{0,15}(?:عليها|عليه|إلى|الى)?${nm}`).test(t)) return true;
    // Its own correspondent or its own sources.
    if (new RegExp(String.raw`(?:مراسل|مراسلة|موفد|موفدة|فريق|مصادر)${nm}`).test(t)) return true;
    if (new RegExp(String.raw`(?:مراسلنا|مراسلتنا|موفدنا|مصادرنا|علمنا|حصلنا)`).test(t)) return true;
  }
  return false;
}

/** Is this the outlet's own exclusive? `source` is the outlet carrying it. */
export function isExclusive(text: string, source: string): boolean {
  // "Exclusive footage" is a clip, not the outlet's own reporting: Alfaqaar's
  // "مشاهد حصرية" of the Khurais fire went out as an exclusive (7 Oct 10:30).
  const t = String(text || "")
    .slice(0, 1500)
    .replace(/(?:مشاهد|صور|لقطات|فيديو|مقطع|تصوير)\s+(?:جديدة\s+)?حصري(?:اً|ا|ة)?|\bexclusive(?:ly)?\s+(?:footage|video|images?|pictures?|photos?|scenes|clip)\b|\b(?:footage|video|images?|pictures?|photos?|scenes|clip)\s+(?:obtained\s+)?exclusively\b/gi, " ");
  if (GENERIC.some((re) => re.test(t))) return true;
  // The outlet's own name after "told", "learned", "علمت", "مصادر لـ".
  const words = String(source || "")
    .split(/\s+/)
    .map((w) => w.replace(/^al-?/i, ""))
    .filter((w) => w.length >= 4);
  const ar: Record<string, string> = { akhbar: "الأخبار", suhail: "سهيل", sheba: "شبا", araby: "العربي", arabiya: "العربية", hadath: "الحدث", almashhad: "المشهد", erem: "إرم" };
  const names = [...words, ...words.map((w) => ar[w.toLowerCase()]).filter(Boolean)];
  for (const n of names) {
    const name = esc(n);
    if (new RegExp(String.raw`\b(?:told|tells)\s+(?:the\s+)?(?:al-?\s?)?${name}`, "i").test(t)) return true;
    if (new RegExp(String.raw`(?:al-?\s?)?${name}\b[^.\n]{0,30}\b(?:has|have)\s+learned`, "i").test(t)) return true;
    if (new RegExp(String.raw`علمت\s*[«"]?\s*(?:ال)?${name}|مصادر[^.\n]{0,20}لـ?\s*[«"]?\s*(?:ال)?${name}|قالت?\s+مصادر[^.\n]{0,30}لـ?\s*[«"]?${name}`).test(t)) return true;
    // "أفادت مصادر استخباراتية في صنعاء، «الأخبار»، بأن": the verb takes the
    // outlet with no "لـ". The quote marks keep الأخبار "the news" out.
    if (new RegExp(String.raw`(?:أفاد|أفادت|أبلغ|أبلغت|أخبر|أخبرت)\s+(?:مصادر|مصدر|مسؤول|مسؤولون|قيادي|ضابط)[^.\n]{0,60}[«"“]\s*${name}\s*[»"”]`).test(t)) return true;
  }
  return false;
}
