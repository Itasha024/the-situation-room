/**
 * ============================================================================
 *  THE DESK STYLE BOOK — how this code writes English news copy
 * ============================================================================
 *
 * Every line the desk publishes is written by this module. The rules below are
 * the ones English wire services (Reuters, AP, AFP) and their downstream news
 * sites actually follow. They are encoded as functions so the output is
 * consistent no matter which Arabic, English or Telegram fragment came in.
 *
 * 1. ATTRIBUTION IS THE SPINE.
 *    Nothing is stated as fact unless a credible outlet stated it as fact.
 *    Three tiers, chosen from the source, decide the grammar of the headline:
 *
 *      AGENCY    Reuters, AP, AFP, BBC, Al Jazeera, WSJ, NYT, Washington Post…
 *                → declarative:  "Houthi forces launch ballistic missile towards Riyadh"
 *
 *      CLAIM     A belligerent's own channel — Houthi military media, Saudi or
 *                Yemeni-government media, a named spokesman.
 *                → the claim is the subject:
 *                  "Houthi military claims ballistic missile launch towards Riyadh"
 *
 *      UNVERIFIED  A single Telegram channel, an OSINT account, an unnamed
 *                "field source".
 *                → the report is the subject:
 *                  "Reports of a ballistic missile launch towards Riyadh"
 *
 *    This is why the same event can be phrased three ways. It is not hedging
 *    for its own sake — it tells the reader how much weight to put on the line.
 *
 * 2. HEADLINE SHAPE.
 *    One sentence. Sentence case, not Title Case. No terminal full stop.
 *    Order: actor → verb → object → place → count.
 *    Target length 60–110 characters; hard cap 140, cut on a word boundary.
 *    Never a colon-prefixed source name ("Reuters: …"); the source has its own
 *    field on the card.
 *
 * 3. VERBS ARE PLAIN AND ACTIVE, PAST TENSE FOR COMPLETED EVENTS.
 *    launched, struck, hit, shelled, intercepted, shot down, seized, retook,
 *    clashed, killed, wounded, halted, suspended, cancelled.
 *    Never: eliminated, neutralised, liberated, martyred, heroic, terrorist,
 *    Zionist, mercenary, treacherous. Those are the sources' words, not ours.
 *
 * 4. NO PARTISAN VOCABULARY SURVIVES INGEST. See NEUTRALISE below.
 *    "the Saudi enemy" → Saudi forces.  "the occupied capital" → Sanaa.
 *    "martyrs" → people killed.  "mercenaries" → government forces.
 *
 * 5. NUMBERS, AP STYLE.
 *    Spell out one through nine, figures from 10 up. Casualty figures always
 *    carry "at least", because first counts are always partial.
 *
 * 6. PLACES GET A LOCATOR THE FIRST TIME, IN THE BODY, NEVER IN THE HEADLINE.
 *    "Kahbub, a hill in Lahj governorate overlooking the Bab al-Mandab strait".
 *    Sanaa, Aden, Riyadh, Jeddah, Mecca, the Red Sea are never glossed.
 *
 * 7. THE BODY IS A WIRE LEAD, NOT AN ESSAY.
 *    DATELINE — one sentence of what happened, with attribution.
 *    Then at most two sentences of detail: numbers, weapon, denial, context.
 *    If the claim stands on one partisan or anonymous source, the body closes
 *    with "The report could not be independently verified." — once, never twice.
 *
 * 8. NO EDITORIALISING, NO SECOND PERSON, NO DESK VOICE.
 *    No "note that", no "importantly", no "as our readers know", no exclamation
 *    marks, no rhetorical questions, no scare quotes on ordinary nouns.
 *
 * 9. WHAT WE DO NOT KNOW, WE SAY WE DO NOT KNOW.
 *    "No casualties were reported." is a fact. "There were no casualties." is a
 *    claim we cannot make. Absence of detail is reported as absence of detail.
 */

import { type Place, datelineFor, placesIn, withLocator } from "./gazetteer.ts";

/* ------------------------------------------------------------------ *
 * 1. Attribution tiers
 * ------------------------------------------------------------------ */

export type Tier = "agency" | "claim" | "unverified";

/** Wire services and major internationals — reported facts, not claims. */
const AGENCY_RE =
  /^(Reuters|AP|AFP|BBC|Al Jazeera|The Guardian|Guardian|WSJ|NYT|Washington Post|CNN|CBS|ABC|Axios|Bloomberg|CNBC|Politico|Anadolu|France 24|The National|Al-Monitor|Middle East Eye|US media)$/i;

/** A belligerent's own media, or a named official of one side. */
const PARTISAN_RE =
  /Saba|Al-?Masirah|Ansarollah|Yahya Saree|Abdulsalam|al-?Houthi|Al-?Mihwar|Sabereen|Ali Bk|Naya|Shin Persian|Shajab|Al-?Aqsa|Hazam|Murtada|Al-?Mayadeen|Al-?Akhbar|Baghdad Today|YPA|Al-?Thawrah|SPA|Saudi MoD|Saudi Civil Defense|Okaz|Al-?Watan|Arab News|Asharq|Al Arabiya|Al Hadath|Bin Saeed|Saudi Gazette|Giants Brigades|Nation Shield/i;

export function tierOf(source: string, extraSources = 0): Tier {
  const primary = String(source || "")
    .split(/\s*[·|/]\s*/)[0]
    .trim();
  if (AGENCY_RE.test(primary)) return "agency";
  // Two or more independent outlets on the same story lifts an unverified item.
  if (extraSources >= 2) return "agency";
  if (PARTISAN_RE.test(primary)) return "claim";
  return "unverified";
}

/** Who is making a CLAIM-tier assertion, in plain English. */
export function claimantOf(source: string, text: string): string {
  const s = `${source} ${text}`;
  if (/Yahya Saree|يحيى السريع|يحيى سريع|العميد سريع/i.test(s)) return "the Houthi military spokesman";
  if (/Saba|Al-?Masirah|Ansarollah|almasirah|السبتمبر|أنصار الله/i.test(s)) return "Houthi media";
  if (/Abdulsalam|عبدالسلام/i.test(s)) return "the Houthi negotiating team";
  if (/al-?Houthi|الحوثي\b/i.test(s)) return "a Houthi official";
  if (/SPA|Saudi MoD|Saudi Civil Defense|Saudi Gazette|واس/i.test(s)) return "Saudi state media";
  if (/Okaz|Al-?Watan|Arab News|Asharq|Al Arabiya|Al Hadath|Saudi/i.test(s)) return "Saudi-aligned media";
  if (/Giants Brigades|Nation Shield|العمالقة|درع الوطن/i.test(s)) return "Yemeni government forces";
  if (/Al-?Akhbar|Al-?Mayadeen|Baghdad Today/i.test(s)) return "Houthi-aligned media";
  return "one side";
}

/* ------------------------------------------------------------------ *
 * 2. Actors and units — neutral English names
 * ------------------------------------------------------------------ */

export const ACTORS = {
  houthi: "Houthi forces",
  houthiPlain: "the Houthis",
  gov: "Yemeni government forces",
  govFull: "the internationally recognised government",
  saudi: "Saudi forces",
  saudiState: "Saudi Arabia",
  coalition: "the Saudi-led coalition",
} as const;

const UNIT_RULES: [RegExp, string][] = [
  [/درع الوطن|Homeland Shield/i, "the Homeland Shield forces"],
  [/ألوية العمالقة|العمالقة|Giants? Brigades/i, "the Giants Brigades"],
  [/حراس الجمهورية|Republican Guard/i, "the Republican Guard"],
  [/المقاومة الوطنية|طارق صالح|Tareq Saleh/i, "the National Resistance forces"],
  [/المقاومة الشعبية|Popular Resistance/i, "the Popular Resistance"],
  [/المجلس الانتقالي|\bSTC\b/i, "the Southern Transitional Council"],
  [/القبائل|مسلحين قبلي|tribal fighters/i, "tribal fighters"],
];

export function unitsIn(text: string): string[] {
  const out: string[] = [];
  for (const [re, name] of UNIT_RULES) if (re.test(text) && !out.includes(name)) out.push(name);
  return out;
}

const SPEAKER_RULES: [RegExp, string][] = [
  [/يحيى السريع|يحيى سريع|العميد سريع|Yahya Saree/i, "Yahya Saree, the Houthi military spokesman"],
  [/عبد الملك الحوثي|عبدالملك الحوثي/i, "Abdul Malik al-Houthi, the Houthi leader"],
  [/محمد عبد السلام|محمد عبدالسلام/i, "Mohammed Abdulsalam, the Houthis' chief negotiator"],
  [/محمد علي الحوثي/i, "Mohammed Ali al-Houthi, a senior Houthi official"],
  [/حزام الأسد|حزام الاسد|Hezam al-?Asad|Hazam al-?Asad/i, "Hezam al-Asad, a Houthi political bureau member"],
  [/عبدالقادر المرتضى|عبد القادر المرتضى|al-?Murtad/i, "Abdulqader al-Murtada, the Houthi prisoner-affairs chief"],
  [/رشاد العليمي|al-?Alimi/i, "Rashad al-Alimi, the head of Yemen's Presidential Leadership Council"],
  [/سمير الحاج/i, "Samir al-Haj al-Sabri, Yemen's deputy defence minister"],
  [/نبيل شمسان/i, "Nabil Shamsan, a Yemeni government official"],
  [/أبوراس|أبو راس|Aburas/i, "Abdul Wahid Aburas"],
  [/مهدي المشاط|المشاط|al-?Mashat/i, "Mahdi al-Mashat, head of the Houthis' Supreme Political Council"],
  [/سلطان العرادة|العرادة|al-?Arada/i, "Sultan al-Arada, the governor of Marib"],
  [/ترامب|Trump/i, "US President Donald Trump"],
  [/روبيو|Rubio/i, "US Secretary of State Marco Rubio"],
  [/فانس|\bVance\b/i, "US Vice-President JD Vance"],
];

/**
 * Institutions that speak. Unlike personal names these have settled English
 * forms, so naming them is safe.
 */
const ORG_RULES: [RegExp, string][] = [
  [/الخارجية القطرية|وزارة الخارجية القطرية/i, "Qatar's foreign ministry"],
  [/رئيس الوزراء.*القطري|وزير الخارجية القطري/i, "Qatar's prime minister and foreign minister"],
  [/دولة قطر|قطر\b/i, "Qatar"],
  [/البرلمان الإيراني|مجلس الشورى الإسلامي/i, "Iran's parliament"],
  [/الخارجية الإيرانية|وزارة الخارجية الإيرانية/i, "Iran's foreign ministry"],
  [/الحرس الثوري/i, "Iran's Revolutionary Guard"],
  [/وزارة الدفاع السعودية|الدفاع السعودية/i, "Saudi Arabia's defence ministry"],
  [/الخارجية السعودية/i, "Saudi Arabia's foreign ministry"],
  [/الخارجية الأمريكية|وزارة الخارجية الأمريكية/i, "the US State Department"],
  [/البيت الأبيض/i, "the White House"],
  [/البنتاغون|البنتاجون/i, "the Pentagon"],
  [/الخارجية التركية|وزارة الخارجية التركية/i, "Turkey's foreign ministry"],
  [/الخارجية الباكستانية|وزارة الداخلية الباكستانية/i, "Pakistan's government"],
  [/مجلس الأمن/i, "the UN Security Council"],
  [/الأمم المتحدة/i, "the United Nations"],
  [/المبعوث الأممي|غروندبرغ/i, "the UN special envoy"],
  [/الاتحاد الأوروبي/i, "the European Union"],
  [/مشروع مسام|«مسام»|مسام لنزع الألغام/i, "the Masam demining project"],
  [/وزارة الدفاع اليمنية|الدفاع اليمنية/i, "Yemen's defence ministry"],
  [/مجلس القيادة الرئاسي/i, "Yemen's Presidential Leadership Council"],
  [/UKMTO/i, "UKMTO"],
];

/**
 * Titles, mapped to an English ROLE rather than a name.
 *
 * This is the part that matters. Arabic reporting names people the desk has no
 * safe transliteration for, and inventing a spelling would put a fabricated
 * name on a public page. So an unknown speaker is published by their role —
 * "a Yemeni military commander said…" — which is true, checkable against the
 * linked source, and never made up.
 */
const ROLE_RULES: [RegExp, string][] = [
  // Heads of state and government come first: "الرئيس X:" is the commonest
  // attributed-quote format on the channels this desk reads.
  [/الرئيس\b|رئيس الجمهورية/i, "the president"],
  [/ولي العهد/i, "the crown prince"],
  [/زعيم|قائد الثورة/i, "the leader"],
  [/قائد المنطقة العسكرية|قائد المحور|قائد اللواء/i, "a Yemeni military region commander"],
  [/اللواء الركن|اللواء\b|العميد الركن|العميد\b/i, "a senior military commander"],
  [/المتحدث باسم القوات المسلحة|المتحدث العسكري/i, "a military spokesman"],
  [/المتحدث باسم/i, "a spokesman"],
  [/الخبير العسكري|المحلل العسكري|خبير عسكري/i, "a military analyst"],
  [/المحلل السياسي|الكاتب والمحلل/i, "a political analyst"],
  [/وزير الخارجية/i, "the foreign minister"],
  [/وزير الدفاع/i, "the defence minister"],
  [/وزير الداخلية/i, "the interior minister"],
  [/رئيس الوزراء/i, "the prime minister"],
  [/مصدر عسكري|مصادر عسكرية/i, "a military source"],
  [/مصدر حكومي|مصادر حكومية/i, "a government source"],
  [/مصادر مطلعة|مصادر خاصة|مصدر مطلع/i, "informed sources"],
  [/مسؤول عسكري/i, "a military official"],
  [/مسؤول\b|مسؤولون/i, "an official"],
  [/محافظ\b/i, "a provincial governor"],
];

/** Nationality adjective, so a role reads as "a Saudi military analyst". */
const NATIONALITY_RULES: [RegExp, string][] = [
  [/السعودي|السعودية|سعودي/i, "Saudi"],
  [/اليمني|اليمنية|يمني/i, "Yemeni"],
  [/الإيراني|الإيرانية|إيراني/i, "Iranian"],
  [/التركي|التركية|تركي/i, "Turkish"],
  [/الباكستاني|الباكستانية/i, "Pakistani"],
  [/الأمريكي|الأمريكية/i, "American"],
  [/القطري|القطرية/i, "Qatari"],
];

/**
 * Who is speaking, in publishable English.
 *
 * Three tiers, most specific first: a known individual keeps their name and
 * title; a known institution gets its settled English form; anyone else is
 * described by role. Returns "" only when the text names no speaker at all.
 *
 * The previous version was a list of twelve named people, so every other
 * speaker fell through and the item was dropped — 29 of 34 held reports in one
 * live scan failed here, not on relevance.
 */
export function speakerIn(text: string): string {
  for (const [re, name] of SPEAKER_RULES) if (re.test(text)) return name;
  for (const [re, name] of ORG_RULES) if (re.test(text)) return name;

  for (const [re, role] of ROLE_RULES) {
    if (!re.test(text)) continue;
    // "the president" alone says nothing; "the Iranian president" does.
    const adj = NATIONALITY_RULES.find(([nre]) => nre.test(text))?.[1];
    if (!adj) return role;
    return role
      .replace(/^(an?|the) /, `$1 ${adj} `)
      .replace(/^a ([AEIOU])/, "an $1")
      .replace(/^an ([^AEIOU])/, "a $1");
  }
  return "";
}

/** Short form for a headline: "Saree", "Trump", "Al-Alimi". */
export function speakerShort(full: string): string {
  if (!full) return "";
  const head = full.split(",")[0].trim();
  // A role or an institution is not a surname: "a Yemeni military commander"
  // must not shorten to "commander". Drop the article and keep the phrase.
  if (/^(an?|the)\s/i.test(head)) return head.replace(/^(an?|the)\s+/i, "");
  if (/\b(ministry|department|parliament|government|council|nations|union|project|house|pentagon)\b/i.test(head)) {
    return head;
  }
  const parts = head.replace(/^(US President|US Secretary of State)\s+/i, "").split(/\s+/);
  return parts[parts.length - 1] || head;
}

/* ------------------------------------------------------------------ *
 * 3. Neutralising the sources' vocabulary
 * ------------------------------------------------------------------ */

/**
 * Loaded terms are rewritten before anything is composed. Left column is what
 * the belligerents write; right column is what a wire desk prints.
 */
const NEUTRALISE: [RegExp, string][] = [
  [/العدو السعودي|the Saudi enemy/gi, "Saudi forces"],
  [/العاصمة المحتلة|the occupied capital/gi, "Sanaa"],
  [/المرتزقة|mercenaries/gi, "government forces"],
  [/الغزاة|the invaders/gi, "coalition forces"],
  [/الشهداء|الشهيد|martyrs?/gi, "people killed"],
  [/استشهاد/gi, "killing"],
  [/قوات صنعاء|Sanaa forces/gi, "Houthi forces"],
  [/أنصار الله|Ansar Allah|Ansarollah/gi, "the Houthis"],
  [/الحوثيين|الحوثي|حوثي|الحوثيون/g, "the Houthis"],
  [/جماعة الحوثي/g, "the Houthi movement"],
  [/الجيش الوطني|الجيش اليمني|Yemeni army/gi, "Yemeni government forces"],
  [/الحكومة الشرعية|the legitimate government/gi, "the internationally recognised government"],
  [/التحالف/g, "the Saudi-led coalition"],
  [/liberated|محررة|تحرير/gi, "retaken"],
  [/heroic|البطولية/gi, ""],
  [/\bterrorists?\b|الإرهابيين/gi, "fighters"],
  [/العدوان/g, "the offensive"],
];

export function neutralise(text: string): string {
  let s = String(text || "");
  for (const [re, to] of NEUTRALISE) s = s.replace(re, to);
  return s.replace(/\s{2,}/g, " ").trim();
}

/* ------------------------------------------------------------------ *
 * 4. Mechanics: numbers, case, tidying
 * ------------------------------------------------------------------ */

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** AP style: words for one–nine, figures from 10. */
export function num(n: number | string): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  if (v >= 0 && v <= 9 && Number.isInteger(v)) return WORDS[v];
  return String(v);
}

/** First letter up, rest untouched so proper nouns and acronyms survive. */
export function sentenceCase(s: string): string {
  const t = String(s || "").trim();
  if (!t) return "";
  return t[0].toUpperCase() + t.slice(1);
}

/** Headline hygiene: no terminal stop, single spaces, no stray punctuation. */
export function tidyHeadline(s: string, cap = 140): string {
  let t = String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/[«»"“”]/g, "")
    .replace(/\s*[—–-]\s*$/, "")
    .replace(/[.\s]+$/, "")
    .trim();
  if (t.length > cap) {
    t = t.slice(0, cap).replace(/\s+\S*$/, "").replace(/[,;:]$/, "");
  }
  return sentenceCase(t);
}

/** Body hygiene: sentences end in a stop, no doubled caveats, no source dumps. */
export function tidyBody(s: string): string {
  let t = String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .replace(/…/g, "")
    .trim();
  // One caveat only, and always last.
  const caveat = "The report could not be independently verified.";
  const hits = t.split(caveat).length - 1;
  if (hits > 1) t = t.split(caveat).join("").replace(/\s{2,}/g, " ").trim() + " " + caveat;
  if (t && !/[.!?]$/.test(t)) t += ".";
  return sentenceCase(t);
}

export const UNVERIFIED_CAVEAT = "The report could not be independently verified.";
export const NO_CONFIRMATION = "There was no immediate confirmation from the other side.";

/* ------------------------------------------------------------------ *
 * 5. Weapons, timing, counts
 * ------------------------------------------------------------------ */

export type Weapon =
  | "ballistic missile"
  | "cruise missile"
  | "hypersonic missile"
  | "missile"
  | "drone"
  | "armed drone"
  | "artillery"
  | "mortar fire"
  | "naval mine"
  | "anti-ship missile";

export function weaponIn(text: string, fallback: Weapon = "missile"): Weapon {
  const t = String(text || "");
  if (/فرط ?صوتي|hypersonic/i.test(t)) return "hypersonic missile";
  if (/مجنح|cruise missile/i.test(t)) return "cruise missile";
  if (/مضاد.{0,10}سفن|anti-?ship/i.test(t)) return "anti-ship missile";
  if (/باليست|ballistic/i.test(t)) return "ballistic missile";
  if (/مسيّرة? انقضاضية|one-?way attack|kamikaze/i.test(t)) return "armed drone";
  if (/مسيّر|مسيرة|درون|\bdrone\b|\bUAV\b/i.test(t)) return "drone";
  if (/لغم بحري|naval mine/i.test(t)) return "naval mine";
  if (/مدفعية|artillery/i.test(t)) return "artillery";
  if (/هاون|mortar/i.test(t)) return "mortar fire";
  if (/صاروخ|missile/i.test(t)) return "missile";
  return fallback;
}

/** Plain-English time reference, or "" when the source gives none. */
export function whenIn(text: string): string {
  const t = String(text || "");
  if (/فجر|قبل الفجر|before dawn|at dawn/i.test(t)) return "before dawn";
  if (/صباح اليوم|هذا الصباح|this morning/i.test(t)) return "in the morning";
  if (/مساء اليوم|هذا المساء|this evening/i.test(t)) return "in the evening";
  if (/ليلة|overnight|during the night/i.test(t)) return "overnight";
  if (/خلال الـ?\s*24|الـ24 ساعة|past 24 hours/i.test(t)) return "over the past 24 hours";
  if (/الساعات (?:القليلة )?الماضية|recent hours/i.test(t)) return "in recent hours";
  return "";
}

export type Counts = { killed: string; wounded: string; downed: string; captured: string };

export function countsIn(text: string): Counts {
  const t = String(text || "");
  const killed =
    t.match(/(\d+)\s*(?:قتيلا?|شهيد|قتلى|killed|dead|fatalit)/i) ||
    t.match(/(?:قتل|مقتل|استشهاد|killing of)\s*(\d+)/i);
  const wounded = t.match(/(\d+)\s*(?:جريح|جرحى|wounded|injured)/i) || t.match(/إصابة\s*(?:أكثر من\s*)?(\d+)/);
  const downed =
    t.match(/(?:أسقط|اسقاط|إسقاط|downed|shot down|intercepted)\D{0,24}(\d+)/i) ||
    t.match(/(\d+)\s*(?:مسيّرة?|drones?)\b/i);
  const captured = t.match(/(?:أسر|captured|taken prisoner)\D{0,20}(\d+)/i);
  return {
    killed: killed?.[1] || "",
    wounded: wounded?.[1] || "",
    downed: downed?.[1] || "",
    captured: captured?.[1] || "",
  };
}

/** "at least four killed and 12 wounded" — empty when the source gives no figures. */
export function casualtyPhrase(c: Counts): string {
  const parts: string[] = [];
  if (c.killed) parts.push(`${num(c.killed)} killed`);
  if (c.wounded) parts.push(`${num(c.wounded)} wounded`);
  if (c.captured) parts.push(`${num(c.captured)} captured`);
  if (!parts.length) return "";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `at least ${list}`;
}

/* ------------------------------------------------------------------ *
 * 6. Place phrasing
 * ------------------------------------------------------------------ */

/** "Jeddah, Taif and Yanbu" — Oxford comma omitted, wire style. */
export function listPlaces(names: string[]): string {
  const xs = names.filter(Boolean);
  if (!xs.length) return "";
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** "in Al-Wazi'iyah", "in the Red Sea", "" when nowhere is named. */
export function inPlaces(places: Place[]): string {
  const names = places.slice(0, 3).map((p) => p.name);
  if (!names.length) return "";
  return `in ${listPlaces(names)}`;
}

/**
 * Body geography: the first unfamiliar place gets its locator, the rest stay bare.
 * "in Kahbub, a hill in Lahj governorate overlooking the Bab al-Mandab strait"
 */
export function inPlacesWithLocator(places: Place[]): string {
  const xs = places.slice(0, 3);
  if (!xs.length) return "";
  const first = withLocator(xs[0]);
  const rest = xs.slice(1).map((p) => p.name);
  return `in ${listPlaces([first, ...rest])}`;
}

export function datelineOf(places: Place[], fallback = "SANAA"): string {
  const land = places.find((p) => p.country !== "sea") || places[0];
  return datelineFor(land) || fallback;
}

/* ------------------------------------------------------------------ *
 * 7. Composers
 * ------------------------------------------------------------------ */

export type Composed = { headline: string; body: string };

type LaunchArgs = {
  tier: Tier;
  weapon: Weapon;
  actor?: string;
  targets: Place[];
  origin?: Place;
  counts: Counts;
  when: string;
  source: string;
  claimant: string;
};

/**
 * Launch — the shape the operator asked for:
 *   unverified → "Reports of a ballistic missile launch towards Riyadh"
 *   claim      → "Houthi military claims ballistic missile launch towards Riyadh"
 *   agency     → "Houthi forces launch ballistic missile towards Riyadh"
 */
export function composeLaunch(a: LaunchArgs): Composed {
  const toward = a.targets.length ? `towards ${listPlaces(a.targets.slice(0, 3).map((p) => p.name))}` : "";
  const weapon = a.weapon;
  const article = /^[aeiou]/i.test(weapon) ? "an" : "a";
  const actor = a.actor || ACTORS.houthi;
  const cas = casualtyPhrase(a.counts);

  let headline: string;
  if (a.tier === "agency") {
    headline = `${actor} launch ${article} ${weapon}${toward ? " " + toward : ""}`;
  } else if (a.tier === "claim") {
    const who = a.claimant === "one side" ? actor : a.claimant;
    headline = `${who} claims ${article} ${weapon} launch${toward ? " " + toward : ""}`;
  } else {
    headline = `Reports of ${article} ${weapon} launch${toward ? " " + toward : ""}`;
  }
  if (cas) headline += `, ${cas}`;

  const dateline = a.targets.length ? datelineOf(a.targets) : "SANAA";
  const from = a.origin ? ` from ${a.origin.name}` : "";
  const lead =
    a.tier === "agency"
      ? `${actor} launched ${article} ${weapon}${from}${toward ? " " + toward : ""}${a.when ? " " + a.when : ""}.`
      : `${article === "an" ? "An" : "A"} ${weapon} was reported launched${from}${toward ? " " + toward : ""}${a.when ? " " + a.when : ""}.`;
  // No outlet name and no "could not be verified" line: the card already shows
  // the source, and the hedge is carried by the wording of the lead itself.
  const detail = cas ? `${sentenceCase(cas)} were reported.` : "No casualty figures were given.";

  return {
    headline: tidyHeadline(headline),
    body: tidyBody(`${dateline} — ${lead} ${detail}`),
  };
}

type AlertArgs = { tier: Tier; cities: Place[]; source: string; explosions: boolean; firstTime: boolean };

/** Air-defence / civil-defence alerts. Sirens only — never aircraft activity. */
export function composeAlert(a: AlertArgs): Composed {
  const where = a.cities.length ? listPlaces(a.cities.slice(0, 4).map((p) => p.name)) : "Saudi Arabia";
  const headline =
    a.tier === "unverified"
      ? `Reports of air raid sirens in ${where}`
      : `Air defence alerts sound in ${where}`;
  const first = a.firstTime ? " It was the first such alert there since the current round of fighting began." : "";
  const boom = a.explosions ? " Residents reported hearing explosions." : "";
  const dateline = datelineOf(a.cities, "RIYADH");
  return {
    headline: tidyHeadline(headline + (a.firstTime ? ", a first since the fighting began" : "")),
    body: tidyBody(
      `${dateline} — Saudi civil defence sounded air raid alerts in ${where}.${boom}${first} An all-clear followed.`,
    ),
  };
}

type InterceptArgs = { tier: Tier; weapon: Weapon; places: Place[]; counts: Counts; source: string; defender: string };

export function composeIntercept(a: InterceptArgs): Composed {
  const n = a.counts.downed ? num(a.counts.downed) : "";
  const obj = n ? `${n} ${a.weapon}${Number(a.counts.downed) > 1 ? "s" : ""}` : `a ${a.weapon}`;
  const where = inPlaces(a.places);
  const headline =
    a.tier === "unverified"
      ? `Reports of ${obj} shot down${where ? " " + where : ""}`
      : `${a.defender} intercept ${obj}${where ? " " + where : ""}`;
  return {
    headline: tidyHeadline(headline),
    body: tidyBody(
      `${datelineOf(a.places)} — ${a.defender} said ${obj} ${Number(a.counts.downed) > 1 ? "were" : "was"} shot down${
        inPlacesWithLocator(a.places) ? " " + inPlacesWithLocator(a.places) : ""
      }.`,
    ),
  };
}

type StrikeArgs = {
  tier: Tier;
  places: Place[];
  counts: Counts;
  when: string;
  source: string;
  target: string;
  attacker: string;
};

/** Air strikes on land targets. */
export function composeAirstrike(a: StrikeArgs): Composed {
  const where = inPlaces(a.places);
  const cas = casualtyPhrase(a.counts);
  const obj = a.target || "positions";
  const headline =
    a.tier === "unverified"
      ? `Reports of air strikes on ${obj}${where ? " " + where : ""}`
      : `Air strikes hit ${obj}${where ? " " + where : ""}`;
  return {
    headline: tidyHeadline(headline + (cas ? `, ${cas}` : "")),
    body: tidyBody(
      `${datelineOf(a.places)} — Air strikes hit ${obj} ${inPlacesWithLocator(a.places)}${a.when ? " " + a.when : ""}${
        a.attacker ? `, in an attack attributed to ${a.attacker}` : ""
      }. ${cas ? sentenceCase(cas) + " were reported." : "No casualty figures were given."}`,
    ),
  };
}

type ClashArgs = {
  tier: Tier;
  places: Place[];
  counts: Counts;
  left: string;
  right: string;
  source: string;
  houthiPush: boolean;
  when: string;
};

export function composeClash(a: ClashArgs): Composed {
  const where = inPlaces(a.places);
  const cas = casualtyPhrase(a.counts);
  const headline = a.houthiPush
    ? `Houthi forces attack government lines${where ? " " + where : ""}`
    : `Clashes between ${a.left} and ${a.right}${where ? " " + where : ""}`;
  return {
    headline: tidyHeadline(headline + (cas ? `, ${cas}` : "")),
    body: tidyBody(
      `${datelineOf(a.places)} — ${a.houthiPush ? "Houthi forces attacked government lines" : `${sentenceCase(a.left)} and ${a.right} clashed`} ${inPlacesWithLocator(
        a.places,
      )}${a.when ? " " + a.when : ""}. ${cas ? sentenceCase(cas) + " were reported." : "Neither side gave casualty figures."}`,
    ),
  };
}

type SeizeArgs = { tier: Tier; places: Place[]; actor: string; counts: Counts; source: string; retake: boolean };

export function composeSeize(a: SeizeArgs): Composed {
  const where = inPlaces(a.places);
  const verb = a.retake ? "retake" : "seize";
  const past = a.retake ? "retook" : "seized";
  const cas = casualtyPhrase(a.counts);
  const headline =
    a.tier === "unverified"
      ? `Reports that ${a.actor} ${past} positions${where ? " " + where : ""}`
      : `${a.actor} ${verb} positions${where ? " " + where : ""}`;
  return {
    headline: tidyHeadline(headline + (cas ? `, ${cas}` : "")),
    body: tidyBody(
      `${datelineOf(a.places)} — ${sentenceCase(a.actor)} ${past} positions ${inPlacesWithLocator(a.places)}. ${
        cas ? sentenceCase(cas) + " were reported." : "No casualty figures were given."
      }`,
    ),
  };
}

type VesselArgs = { tier: Tier; places: Place[]; source: string; vessel: string; counts: Counts };

export function composeVessel(a: VesselArgs): Composed {
  const ship = a.vessel || "a vessel";
  const where = a.places.length ? inPlaces(a.places) : "in the Red Sea";
  const headline =
    a.tier === "unverified" ? `Reports of ${ship} attacked ${where}` : `${sentenceCase(ship)} attacked ${where}`;
  const cas = casualtyPhrase(a.counts);
  return {
    headline: tidyHeadline(headline + (cas ? `, ${cas}` : "")),
    body: tidyBody(
      `${datelineOf(a.places, "RED SEA")} — ${sentenceCase(ship)} was attacked ${where}. ${
        cas ? sentenceCase(cas) + " were reported." : "No casualties among the crew were reported."
      }`,
    ),
  };
}

type PortArgs = { tier: Tier; places: Place[]; source: string; counts: Counts; facility: string };

export function composePort(a: PortArgs): Composed {
  const place = a.places[0];
  const name = place?.name || "a Yemeni port";
  const what = a.facility || "port";

  /**
   * "The oil terminal OF Riyadh" asserts a terminal in a landlocked capital —
   * the desk inventing infrastructure. A facility is only "of" a place when
   * that place is a port; otherwise it is a facility "in" it, which is all the
   * source actually said.
   */
  const coastal = !place || place.kind === "port city" || place.kind === "sea" || what === "port";
  const article = /^[aeiou]/i.test(what) ? "an" : "a";
  const target = coastal ? `the ${what} of ${name}` : `${article} ${what} in ${name}`;
  const Target = coastal
    ? `The ${what} of ${name}`
    : `${article === "an" ? "An" : "A"} ${what} in ${name}`;

  const headline =
    a.tier === "unverified" ? `Reports of a strike on ${target}` : `Strike hits ${target}`;
  const cas = casualtyPhrase(a.counts);
  return {
    headline: tidyHeadline(headline + (cas ? `, ${cas}` : "")),
    body: tidyBody(
      `${datelineOf(a.places)} — ${Target} was hit in a strike. ${
        cas ? sentenceCase(cas) + " were reported." : "No casualty figures were given."
      }`,
    ),
  };
}

type StatementArgs = { speaker: string; gist: string; detail: string; places: Place[]; source: string; tier: Tier };

/**
 * Statements carry the speaker in the headline, wire style:
 *   "Saree says Saudi infiltration attempts foiled in Sanaa"
 * A statement is never dressed up as an event.
 */
export function composeStatement(a: StatementArgs): Composed {
  const who = speakerShort(a.speaker) || "";
  const gist = a.gist.replace(/^[\s:—–-]+/, "").replace(/[.\s]+$/, "");
  const headline = who ? `${who} says ${gist.charAt(0).toLowerCase() + gist.slice(1)}` : gist;
  const dateline = datelineOf(a.places);
  const detail = a.detail || gist + ".";
  // "Trump said X. Trump made the remarks." — the detail already names the
  // speaker, so the attribution line only earns its place when it does not.
  const namesSpeaker = !!a.speaker && detail.toLowerCase().includes(a.speaker.toLowerCase());
  const attrib = namesSpeaker ? "" : a.speaker ? ` ${sentenceCase(a.speaker)} made the remarks.` : "";
  return {
    headline: tidyHeadline(headline),
    body: tidyBody(`${dateline} — ${detail}${attrib}`),
  };
}

type EconomyArgs = { headline: string; detail: string; source: string; places: Place[] };

export function composeEconomy(a: EconomyArgs): Composed {
  return {
    headline: tidyHeadline(a.headline),
    body: tidyBody(`${datelineOf(a.places, "RIYADH")} — ${a.detail}`),
  };
}

/* ------------------------------------------------------------------ *
 * 8. Quality gate on the finished copy
 * ------------------------------------------------------------------ */

/** Residual source language, empty slots or template leakage — reject the row. */
export function isBadCopy(headline: string, body: string): boolean {
  const h = String(headline || "").trim();
  if (h.length < 16) return true;
  if (/[؀-ۿ֐-׿]/.test(h + body)) return true; // Arabic or Hebrew leaked
  if (/\bundefined\b|\bNaN\b|\[object/i.test(h + body)) return true;
  if (/^Reports of\s*$|^Reports of a\s*$/i.test(h)) return true;
  if (/\b(\w+)\s+\1\b/i.test(h)) return true; // stutter: "the the", "forces forces"
  if (/\s,|,,|\.\./.test(h)) return true;
  // A headline with no verb is a fragment, not a line of copy.
  if (
    !/\b(launch|launched|claims|claimed|report|reports|reported|hit|hits|struck|strike|strikes|clash|clashes|clashed|seize|seizes|seized|retake|retook|intercept|intercepts|intercepted|shot|down|says|said|kill|killed|wound|wounded|attack|attacked|sound|sounds|sounded|halt|halted|suspend|suspended|cancel|cancels|cancelled|advance|warn|warns|warned|deny|denies|denied|announce|announced|reject|rejected|refuse|refused|agree|agreed|resume|resumed)\b/i.test(
      h,
    )
  ) {
    return true;
  }
  return false;
}

/** Convenience for callers that only have free text and a source. */
export function placesOf(text: string): Place[] {
  return placesIn(neutralise(text));
}
