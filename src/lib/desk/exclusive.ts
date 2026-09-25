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
  const t = String(text || "").slice(0, 4000);
  for (const n of names.en) {
    const name = String.raw`(?:the\s+)?${esc(n)}`;
    if (new RegExp(String.raw`\b(?:told|tells|said to|speaking to|spoke to|in an? (?:exclusive )?interview with|interviewed by|in remarks to|in a statement to|obtained by|seen by)\s+${name}\b`, "i").test(t)) return true;
    if (new RegExp(String.raw`\b${esc(n)}\b[^.\n]{0,30}\b(?:has |have )?(?:learned|obtained|reviewed)`, "i").test(t)) return true;
  }
  for (const n of names.ar) {
    const to = toAr(n);
    if (new RegExp(String.raw`(?:قال|قالت|أكد|أكدت|كشف|كشفت|أوضح|أوضحت|صرح|صرّح|صرحت|أفاد|أفادت|تحدث|تحدثت|مصادر|مصدر|مسؤول|مسؤولون)[^.\n]{0,50}${to}`).test(t)) return true;
    if (new RegExp(String.raw`(?:حديث|مقابلة|تصريح|تصريحات|حوار|لقاء)[^.\n]{0,15}(?:خاص(?:ة)?\s*)?(?:${to}|مع${Q}${esc(n)})`).test(t)) return true;
    if (new RegExp(String.raw`(?:علمت|حصلت|اطلعت|تلقت)(?:\s+عليها|\s+عليه)?${Q}${esc(n)}`).test(t)) return true;
  }
  return false;
}

/** Is this the outlet's own exclusive? `source` is the outlet carrying it. */
export function isExclusive(text: string, source: string): boolean {
  const t = String(text || "").slice(0, 1500);
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
  }
  return false;
}
