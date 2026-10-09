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

/**
 * The big English outlets rarely say "exclusive": their own scoop is "two
 * officials said", "people familiar with the matter", in the headline or the
 * first lines (Reuters' Turkey support to Saudi Arabia, 7 Oct; Axios' "US
 * declines to join, officials say", 2 Oct). On their own site that is their
 * own reporting; credited to another outlet it is that outlet's.
 */
const MAJORS = /^(?:Reuters|Axios|WSJ|(?:The )?Wall Street Journal|(?:The )?New York Times|NYT|(?:The )?Washington Post|CNN|Bloomberg|Financial Times|FT|AP|Associated Press|Politico|NBC News|CBS News|ABC News|Fox News|(?:The )?Guardian|(?:The )?Telegraph|BBC(?: News)?)$/i;
const OTHERS = /\b(?:Reuters|Axios|Wall Street Journal|the Journal|New York Times|the Times|Washington Post|the Post|CNN|Bloomberg|Financial Times|AP|Associated Press|Politico|NBC|CBS|ABC|Fox News|Guardian|Telegraph|BBC|Al Arabiya|Al Jazeera|Asharq|Al-Monitor|Middle East Eye)\b/gi;
const SAID = /\b(?:two|three|four|five|several|multiple|a few|\d+)\s+(?:[\w-]+\s+){0,3}(?:officials?|sources?|people|diplomats?)\b[^.\n]{0,80}\b(?:said|say|says|told)\b|\bpeople (?:familiar with|briefed on|with knowledge of)\b|\baccording to (?:two|three|four|several|multiple|\d+)\s+(?:[\w-]+\s+){0,3}(?:officials?|sources?|people)\b|,\s*(?:[\w-]+\s+){0,2}(?:officials|sources)\s+(?:say|said)\s*(?:\n|$)/im;

function ownSourcing(text: string, source: string): boolean {
  const head = text.slice(0, 500);
  if (!SAID.test(head)) return false;
  // Someone else's scoop retold: "officials told Axios", "Reuters reported".
  const self = String(source || "").toLowerCase();
  for (const m of head.matchAll(OTHERS)) {
    const n = m[0].toLowerCase();
    if (self.includes(n.replace(/^the /, "")) || n.includes(self) || (n === "the journal" && /journal|wsj/.test(self)) || (n === "the times" && /times/.test(self)) || (n === "the post" && /post/.test(self))) continue;
    const before = head.slice(Math.max(0, m.index - 16), m.index);
    const after = head.slice(m.index + m[0].length, m.index + m[0].length + 14);
    if (/\b(?:told|to|by|according to|reported|reports|citing|cited)\s*$/i.test(before) || /^\W{0,3}\s*(?:reported|reports|said|says)\b/i.test(after)) return false;
  }
  return true;
}

/** Said in public: a statement, a speech, a post, a press conference. */
const PUBLIC = /\b(?:(?:said|says|added|stated|announced|noted) in (?:a|an|its|his|her|their) (?:written |joint |official )?statement|(?:issued|released|published) (?:a |an )?(?:joint |official )?statement|statement (?:issued|released|published|posted)|(?:press|news) (?:conference|briefing)|told (?:reporters|journalists|a news conference|a press conference|lawmakers|parliament)|(?:posted|wrote|said) on (?:X|Twitter|Telegram|Truth Social|Facebook|Instagram)|in a (?:post|tweet|speech|televised (?:address|speech)|video (?:message|address))|addressing (?:a|the) (?:rally|crowd|conference|summit|parliament))\b|بيان|بلاغ\s+صحفي|في\s+كلمة|خلال\s+كلمة|في\s+خطاب|خلال\s+خطاب|مؤتمرا?\s+صحفيا?|في\s+تغريدة|في\s+تدوينة|في\s+منشور|(?:عبر|على)\s+(?:حسابه|حسابها|صفحته|صفحتها|منصة)/i;
/** Words given to the outlet itself: an interview, a statement made to it. */
const TO_OUTLET = /\b(?:(?:exclusive|phone|telephone) interview|in an interview|interviewed by|(?:told|tells|telling|spoke to|speaking to|spoke with|speaking with|said to|exclusively to)\s+(?!reporters|journalists|a news|a press|lawmakers|parliament)(?:the\s+)?[A-Z])|(?:حديث|حديثه|حديثها|تصريح|تصريحات|تصريحه|تصريحاتها?)\s+(?:خاص(?:ة)?\s+)?(?:لـ|ل\s*«|مع)|(?:مقابلة|حوار|لقاء)\s+(?:خاص(?:ة)?\s+)?(?:مع|لـ|أجرته|أجرتها)|خاص(?:ة)?\s+(?:لـ|ب)\s*[«"“]|حصري(?:اً|ا)?\s+لـ|(?:أبلغ|أبلغت|أخبر|أخبرت)\s/;

/** Is this the outlet's own exclusive? `source` is the outlet carrying it. */
export function isExclusive(text: string, source: string): boolean {
  // "Exclusive footage" is a clip, not the outlet's own reporting: Alfaqaar's
  // "مشاهد حصرية" of the Khurais fire went out as an exclusive (7 Oct 10:30).
  const t = String(text || "")
    .slice(0, 1500)
    .replace(/(?:مشاهد|صور|لقطات|فيديو|مقطع|تصوير)\s+(?:جديدة\s+)?حصري(?:اً|ا|ة)?|\bexclusive(?:ly)?\s+(?:footage|video|images?|pictures?|photos?|scenes|clip)\b|\b(?:footage|video|images?|pictures?|photos?|scenes|clip)\s+(?:obtained\s+)?exclusively\b/gi, " ");
  // A site's terms ("a non-exclusive licence", SPA's "ترخيصا غير حصريا", 6 Oct) are not a label.
  const u = t.replace(/\bnon-?\s?exclusive\b|غير\s+حصري(?:اً|ا|ة)?/gi, " ");
  // "عدن الغد /خاص", "كريتر سكاي/خاص:" is the site's byline (its own staff),
  // not a label: Aden al-Ghad's Sanaa explosions and Crater Sky's camp blasts
  // went out as exclusives (8 Oct).
  const v = u.replace(/\/\s*خاص(?:ة)?(?=[\s:.\-–—|]|$)\s*:?/g, " ");
  // A public statement is everyone's, whatever label the site puts on it,
  // unless it was given to this outlet alone (user, 9 Oct).
  if (GENERIC.some((re) => re.test(v))) return !PUBLIC.test(v) || TO_OUTLET.test(v);
  if (MAJORS.test(String(source || "").trim()) && ownSourcing(t, source)) return true;
  // The outlet's own name after "told", "learned", "علمت", "مصادر لـ".
  const words = String(source || "")
    .split(/\s+/)
    .map((w) => w.replace(/^al-?/i, ""))
    .filter((w) => w.length >= 4);
  const ar: Record<string, string> = { akhbar: "الأخبار", suhail: "سهيل", sheba: "شبا", araby: "العربي", arabiya: "العربية", hadath: "الحدث", almashhad: "المشهد", erem: "إرم", jazeera: "الجزيرة", mayadeen: "الميادين", masirah: "المسيرة" };
  const names = [...words, ...words.map((w) => ar[w.toLowerCase()]).filter(Boolean)];
  for (const n of names) {
    const name = esc(n);
    if (new RegExp(String.raw`\b(?:told|tells)\s+(?:the\s+)?(?:al-?\s?)?${name}`, "i").test(t)) return true;
    if (new RegExp(String.raw`(?:al-?\s?)?${name}\b[^.\n]{0,30}\b(?:has|have)\s+learned`, "i").test(t)) return true;
    // The English majors' own reporting: "documents seen by Reuters", "Axios
    // can reveal", "officials who spoke to the Journal", "first reported by Axios".
    if (new RegExp(String.raw`\b${name}\b[^.\n]{0,30}\b(?:can reveal|can confirm|has seen|has reviewed|has obtained|understands)\b`, "i").test(t)) return true;
    if (new RegExp(String.raw`\b(?:seen|reviewed|obtained|viewed|verified)\s+by\s+(?:the\s+)?${name}\b|\b(?:spoke|speaking|talked)\s+(?:to|with)\s+(?:the\s+)?${name}\b|\bfirst\s+reported\s+by\s+(?:the\s+)?${name}\b`, "i").test(t)) return true;
    if (new RegExp(String.raw`علمت\s*[«"]?\s*(?:ال)?${name}|مصادر[^.\n]{0,20}لـ?\s*[«"]?\s*(?:ال)?${name}|قالت?\s+مصادر[^.\n]{0,30}لـ?\s*[«"]?${name}`).test(t)) return true;
    // "أفادت مصادر استخباراتية في صنعاء، «الأخبار»، بأن": the verb takes the
    // outlet with no "لـ". The quote marks keep الأخبار "the news" out.
    if (new RegExp(String.raw`(?:أفاد|أفادت|أبلغ|أبلغت|أخبر|أخبرت)\s+(?:مصادر|مصدر|مسؤول|مسؤولون|قيادي|ضابط)[^.\n]{0,60}[«"“]\s*${name}\s*[»"”]`).test(t)) return true;
    // A teller and the outlet before the colon: "مسؤول أمريكي للجزيرة:", "مصدر أميركي للحدث:" (user, 8 Oct: Al Jazeera's US official is its own).
    const stem = n.replace(/^ال/, "");
    const head = t.replace(/^[\s‎‏|]*(?:عاجل|خاص|🔴|⭕️)?\s*\|?\s*/u, "").slice(0, 120);
    if (/^ال/.test(n) && new RegExp(String.raw`^[^:\n]{2,80}\s(?:لل|لـ\s*ال|ل\s*ال)${esc(stem)}\s*:`).test(head)) return true;
  }
  return false;
}
