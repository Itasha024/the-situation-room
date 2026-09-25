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
