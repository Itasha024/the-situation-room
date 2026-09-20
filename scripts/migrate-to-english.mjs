/**
 * One-way migration of the desk archive from Hebrew to English.
 *
 *   node scripts/migrate-to-english.mjs
 *
 * Reads public/data.he.json (the preserved Hebrew original) and writes
 * public/data.json in English. Idempotent: rerun it after adding translations.
 *
 * Three sources of English, in priority order:
 *   1. scripts/lib/archive-en.json — hand translations, keyed by normalised Hebrew
 *   2. TEMPLATES below — the Hebrew the old composer generated from templates,
 *      re-composed in English wire style from the same parts
 *   3. a wire lead built from the row's own fields (type, place, source), used
 *      only when neither of the above covers the row. Never invents detail.
 *
 * At the end it prints what is still untranslated, so the gap is visible rather
 * than silently shipped.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { heKey } from "./lib/he-key.mjs";
import {
  CASUALTIES,
  CONTROL,
  DIGESTS,
  EPOCHS,
  EPOCH_CITIES,
  FRONTS,
  GLOSSARY,
  GOVERNORATES,
  ISLANDS,
  NOTES,
  SITUATION,
  TIMELINE,
} from "./lib/curated-en.mjs";

/* ------------------------------------------------------------------ *
 * Hand translations
 * ------------------------------------------------------------------ */

const rawStore = JSON.parse(readFileSync("scripts/lib/archive-en.json", "utf8"));
const STORE = new Map();
for (const [k, v] of Object.entries(rawStore)) {
  if (k === "_note") continue;
  STORE.set(heKey(k), v);
}

/* ------------------------------------------------------------------ *
 * Hebrew place names → canonical English
 * ------------------------------------------------------------------ */

/**
 * Gazetteer aliases are regex sources. Expand the small subset of syntax they
 * use — optional characters and short character classes — into every literal
 * spelling, so "באב אל?[־-]?מַ?נדב" yields the strings the archive actually wrote.
 */
function expandAlias(src) {
  let out = [""];
  let i = 0;
  const s = String(src).replace(/^\\b|\\b$/g, "");
  while (i < s.length) {
    let atoms;
    if (s[i] === "[") {
      const close = s.indexOf("]", i);
      if (close < 0) return [];
      atoms = s
        .slice(i + 1, close)
        .replace(/(.)-(.)/g, "$1$2")
        .split("");
      i = close + 1;
    } else if (s[i] === "\\") {
      atoms = [s[i + 1]];
      i += 2;
    } else if ("^$()|*+".includes(s[i])) {
      return []; // syntax we do not need to expand
    } else {
      atoms = [s[i]];
      i += 1;
    }
    const optional = s[i] === "?";
    if (optional) i += 1;
    const next = [];
    for (const prefix of out) {
      if (optional) next.push(prefix);
      for (const a of atoms) next.push(prefix + a);
    }
    out = [...new Set(next)];
    if (out.length > 64) out = out.slice(0, 64);
  }
  return out;
}

const gaz = JSON.parse(readFileSync("public/gazetteer.json", "utf8"));
const PLACE_HE = new Map();
for (const p of gaz.places) {
  for (const a of p.aliases) {
    if (!/[֐-׿]/.test(a)) continue;
    for (const literal of expandAlias(a)) {
      const k = heKey(literal);
      if (k && !PLACE_HE.has(k)) PLACE_HE.set(k, p.name);
    }
  }
}
// Spellings the archive uses that are not gazetteer entries.
for (const [he, en] of [
  ["תימן", "Yemen"],
  ["סעודיה", "Saudi Arabia"],
  ["הממלכה", "Saudi Arabia"],
  ["הים האדום", "the Red Sea"],
  ["ים האדום", "the Red Sea"],
  ["ים סוף", "the Red Sea"],
  ["הים הערבי", "the Arabian Sea"],
  ["ג'יבוטי", "Djibouti"],
  ["גיבוטי", "Djibouti"],
  ["עמראן", "Amran"],
  ["אלמחווית", "Al-Mahwit"],
  ["דמאר", "Dhamar"],
  ["ד'מאר", "Dhamar"],
  ["רימה", "Raymah"],
  ["אביין", "Abyan"],
  ["אלמהרה", "Al-Mahrah"],
  ["סוקוטרה", "Socotra"],
  ["אלמדינה", "Madinah"],
  ["חאיל", "Hail"],
  ["תבוכ", "Tabuk"],
  ["עסיר", "Asir"],
  ["אלקסים", "Al-Qassim"],
  ["אלבאחה", "Al-Bahah"],
  ["זקר", "Zuqar"],
  ["ראס אלעארה", "Ras al-Arah"],
  ["טור אלבאחה", "Tur al-Baha"],
  ["גבל חבשי", "Jabal Habashi"],
  ["גבל נעמאן", "Jabal Numan"],
  ["אלשמאיתין", "Al-Shamayatayn"],
  ["אלכדחה", "Al-Kadha"],
  ["אלטרירה", "Al-Tarirah"],
  ["אלבאזלה", "Al-Bazilah"],
  ["אללבנאת", "Al-Lubanat"],
  ["רגום", "Rajum"],
  ["אלגראחי", "Al-Jarrahi"],
  ["מדי", "Midi"],
]) {
  const k = heKey(he);
  if (!PLACE_HE.has(k)) PLACE_HE.set(k, en);
}

/** One Hebrew token → English place name, or "" when unknown. */
function onePlace(token) {
  let t = heKey(token)
    .replace(/^(?:מרחבי|מרחב|אזורי|אזור|גזרת|נפת|מחוז|עיר)\s+/, "")
    .replace(/\s*\(.*$/, "")
    .trim();
  if (!t) return "";
  // Full token first: "לחג'" is a place name, not "to Hajjah".
  const tries = [t];
  // Then with one Hebrew prefix letter removed, then with the article restored.
  if (/^[בלמהוש]/.test(t)) tries.push(t.slice(1), "אל" + t.slice(1));
  if (/^(?:וב|ול|ומ|מה|בה|לה)/.test(t)) tries.push(t.slice(2), "אל" + t.slice(2));
  tries.push("אל" + t);
  for (const cand of tries) {
    const hit = PLACE_HE.get(heKey(cand));
    if (hit) return hit;
  }
  return "";
}

/**
 * "באלואזעיה ובתעז" → ["Al-Wazi'iyah", "Taiz"].
 * `complete` is false when any token could not be resolved, so callers can fall
 * back rather than publish a half-translated place list.
 */
function englishPlaces(fragment) {
  const cleaned = heKey(fragment)
    // Drop trailing descriptive clauses the old composer appended.
    .replace(/\s+ש?ב(?:דרום|צפון|מרכז|מערב|מזרח)[^,]*$/, "")
    .replace(/\s+(?:שבדרוםמערב|שבצפוןמזרח|שבמרכז|שבמערב|שבמזרח|שבדרום|שבצפון)\s+\S+/g, "")
    .replace(/\s*[-—;:].*$/, "")
    .trim();
  const raw = cleaned
    .split(/\s*,\s*|\s+ו(?=[֐-׿])|\s*\/\s*|\s+and\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  let complete = raw.length > 0;
  for (const part of raw) {
    const hit = onePlace(part);
    if (hit) out.push(hit);
    else complete = false;
  }
  return { places: [...new Set(out)], complete };
}

function listEn(xs) {
  if (!xs.length) return "";
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const num = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v >= 0 && v <= 9 && Number.isInteger(v) ? WORDS[v] : String(v);
};

/**
 * Figures that cannot be true are data errors, not reporting, and the desk does
 * not print them. The archive contains at least one row claiming 350,838 drones
 * shot down in a single incident.
 */
function plausible(n, ceiling) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 && v <= ceiling ? v : null;
}

/** "(30 הרוגים, 60 פצועים)" → ", at least 30 killed and 60 wounded" */
function casualtyTail(paren) {
  if (!paren) return "";
  const s = heKey(paren);
  const killed = plausible((s.match(/(\d+)\s*הרוגים/) || [])[1], 5000);
  const wounded = plausible((s.match(/(\d+)\s*פצועים/) || [])[1], 10000);
  const downed = plausible((s.match(/(\d+)\s*כטב"?מים שהופלו/) || [])[1], 60);
  const parts = [];
  if (killed) parts.push(`${num(killed)} killed`);
  if (wounded) parts.push(`${num(wounded)} wounded`);
  if (downed) parts.push(`${num(downed)} drones shot down`);
  if (!parts.length) return "";
  return `, at least ${listEn(parts)}`;
}

/* ------------------------------------------------------------------ *
 * Coordinates are more reliable than the old composer's place word
 * ------------------------------------------------------------------ */

/** Nearest gazetteer place to a coordinate, within about 40km. */
function placeFromCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best = null;
  let bestD = Infinity;
  for (const p of gaz.places) {
    const d = Math.hypot(p.lat - lat, p.lng - lng);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return bestD <= 0.36 ? best : null;
}

/**
 * The old composer fell back to the word "Yemen" whenever it could not name a
 * place, which produced lines like "strike on the port at Yemen" pinned to
 * Riyadh. Where the row carries coordinates, the coordinates win.
 */
function sharpenPlace(head, row) {
  const near = placeFromCoords(Number(row.lat), Number(row.lng));
  if (!near) return head;
  return head.replace(/\b(in|at|towards|over|off) Yemen\b/g, (_, prep) => `${prep} ${near.name}`);
}

/** Places that actually have a port or marine terminal. */
const PORTS = new Set([
  "Hodeidah", "Mocha", "Aden", "Al-Khokha", "Hays", "Midi", "Kamaran",
  "Yanbu", "Jazan", "Jeddah", "Ras Tanura", "Abqaiq", "Al-Shuqaiq", "Farasan Islands",
]);

/**
 * A "strike on the port" pinned to Riyadh is an ingest error, not a story. When
 * the resolved place has no port, the row is demoted to a plain strike and the
 * wording follows.
 */
function fixPortRows(row) {
  if (row.type !== "port") return row;
  const where = row.place || "";
  if (PORTS.has(where)) return row;
  row.type = "strike";
  row.summary = String(row.summary || "").replace(
    /^Reports of a strike on the port at (.+)$/,
    "Reports of a strike at $1",
  );
  if (row.label) {
    row.label = String(row.label).replace(
      /^Reports of a strike on the port at (.+)$/,
      "Reports of a strike at $1",
    );
  }
  row.text = String(row.text || "").replace(/strike on the port at/g, "strike at");
  return row;
}

/* ------------------------------------------------------------------ *
 * Templates the old Hebrew composer produced
 * ------------------------------------------------------------------ */

const WEAPON_HE = {
  'כטב"ם': "drone",
  "טיל בליסטי": "ballistic missile",
  טיל: "missile",
};

/**
 * Each rule gets the niqqud-stripped Hebrew and returns English, or null when
 * the parts could not be resolved (in which case the next fallback applies).
 */
const TEMPLATES = [
  // Air defence alerts in Saudi cities
  (s) => {
    const m = s.match(/^התרעות ב(.+?)\.?$/);
    if (!m) return null;
    const { places, complete } = englishPlaces(m[1]);
    if (!complete || !places.length) return null;
    return `Air defence alerts sound in ${listEn(places)}`;
  },
  // Missile / drone launch
  (s) => {
    const m = s.match(/^שיגור (טיל בליסטי|כטב"ם|טיל)(?: מ(\S+?))?(?: לעבר (.+?))?(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    const weapon = WEAPON_HE[m[1]] || "missile";
    const article = /^[aeiou]/i.test(weapon) ? "an" : "a";
    let from = "";
    if (m[2]) {
      const f = englishPlaces(m[2]);
      if (f.places.length) from = ` from ${f.places[0]}`;
    }
    let toward = "";
    if (m[3]) {
      const t = englishPlaces(m[3]);
      if (!t.complete || !t.places.length) return null;
      toward = ` towards ${listEn(t.places)}`;
    }
    return `Reports of ${article} ${weapon} launch${from}${toward}${casualtyTail(m[4])}`;
  },
  // Air strikes on Houthi positions
  (s) => {
    const m = s.match(/^תקיפה אווירית על מוצבי חות'ים ב(.+?)(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    const { places, complete } = englishPlaces(m[1]);
    if (!complete || !places.length) return null;
    return `Air strikes hit Houthi positions in ${listEn(places)}${casualtyTail(m[2])}`;
  },
  // Air strikes, unattributed target
  (s) => {
    const m = s.match(/^תקיפה אווירית ב(.+?)(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    const { places, complete } = englishPlaces(m[1]);
    if (!complete || !places.length) return null;
    return `Air strikes hit positions in ${listEn(places)}${casualtyTail(m[2])}`;
  },
  // Houthi assault on the contact lines
  (s) => {
    const m = s.match(/^התקפה חות'ית על קווי מגע ב(.+?)(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    const { places, complete } = englishPlaces(m[1]);
    if (!complete || !places.length) return null;
    return `Houthi forces attack government lines in ${listEn(places)}${casualtyTail(m[2])}`;
  },
  // Clashes between two named sides
  (s) => {
    const m = s.match(/^עימותים בין (.+?) ל(.+?) ב(.+?)(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    const side = (he) => {
      const k = heKey(he);
      if (/חות'ים|חות'י/.test(k)) return "Houthi forces";
      if (/הענקים/.test(k)) return "the Giants Brigades";
      if (/מגן המולדת|דרע אלוטן/.test(k)) return "the Homeland Shield forces";
      if (/טארק|התנגדות/.test(k)) return "the National Resistance forces";
      if (/שבטי/.test(k)) return "tribal fighters";
      if (/נאמנים לסעודיה/.test(k)) return "Saudi-aligned forces";
      if (/ממשלת|ממשלתי/.test(k)) return "government forces";
      return null;
    };
    const a = side(m[1]);
    const b = side(m[2]);
    const { places, complete } = englishPlaces(m[3]);
    if (!a || !b || !complete || !places.length) return null;
    return `Clashes between ${a} and ${b} in ${listEn(places)}${casualtyTail(m[4])}`;
  },
  // Retake by government forces
  (s) => {
    const m = s.match(/^השתלטות מחדש של כוחות ממשלתיים ב(.+?)(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    const { places, complete } = englishPlaces(m[1]);
    if (!complete || !places.length) return null;
    return `Government forces retake positions in ${listEn(places)}${casualtyTail(m[2])}`;
  },
  // Seizure
  (s) => {
    const m = s.match(/^השתלטות (.+?) ב(.+?)(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    const k = heKey(m[1]);
    const actor = /חות'ים/.test(k)
      ? "Houthi forces"
      : /ממשלת/.test(k)
        ? "government forces"
        : /הענקים/.test(k)
          ? "the Giants Brigades"
          : null;
    const { places, complete } = englishPlaces(m[2]);
    if (!actor || !complete || !places.length) return null;
    return `${actor} seize positions in ${listEn(places)}${casualtyTail(m[3])}`;
  },
  // Drone shot down
  (s) => {
    const m = s.match(/^הופל כטב"ם(?: ב(.+?))?(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    let where = "";
    if (m[1]) {
      const p = englishPlaces(m[1]);
      if (!p.complete || !p.places.length) return null;
      where = ` over ${listEn(p.places)}`;
    }
    const n = (heKey(m[2] || "").match(/(\d+)/) || [])[1];
    const obj = n && Number(n) > 1 ? `${num(n)} drones` : "a drone";
    return `Reports of ${obj} shot down${where}`;
  },
  // Port hit
  (s) => {
    const m = s.match(/^פגיעה בנמל ב(.+?)(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    const { places, complete } = englishPlaces(m[1]);
    if (!complete || !places.length) return null;
    return `Reports of a strike on the port at ${listEn(places)}${casualtyTail(m[2])}`;
  },
  // Maritime incident
  (s) => {
    const m = s.match(/^תקרית ימית ב(.+?)(\s*\([^)]*\))?\.?$/);
    if (!m) return null;
    const { places, complete } = englishPlaces(m[1]);
    if (!complete || !places.length) return null;
    return `Maritime incident reported in ${listEn(places)}${casualtyTail(m[2])}`;
  },
  // Looting
  (s) => {
    const m = s.match(/^ביזה חות'ית במתקנים ב(.+?)\.?$/);
    if (!m) return null;
    const { places, complete } = englishPlaces(m[1]);
    if (!complete || !places.length) return null;
    return `Reported Houthi looting of facilities in ${listEn(places)}`;
  },
  // Rally
  (s) => {
    const m = s.match(/^עצרת חות'ית ב(.+?)(\s*—.*)?\.?$/);
    if (!m) return null;
    const { places, complete } = englishPlaces(m[1]);
    if (!complete || !places.length) return null;
    return `Houthi rally in ${listEn(places)}`;
  },
];

/**
 * Body-level sentence rules. The old composer wrote bodies out of a small set of
 * stock sentences, mostly around Saudi civil-defence alerts; each is re-written
 * here in English. A body is only accepted when EVERY sentence in it resolves —
 * a half-translated paragraph is worse than a clean one-line lead.
 */
const SENTENCE_RULES = [
  [/^הגנה אזרחית בסעודיה הפעילה התרעות ב(.+)$/, (m) => alertSentence(m[1], "sounded air raid alerts")],
  [/^ההגנה האזרחית הסעודית השיקה התרעה לילית ב(.+?), ואחר כך הודיעה שהסכנה חלפה$/, (m) =>
    alertSentence(m[1], "issued an overnight alert", " and later announced the all-clear")],
  [/^ההגנה האזרחית הסעודית השיקה התרעה בפלטפורמה הלאומית ב(.+?)(?:, ואחר כך הודיעה שהסכנה חלפה)?$/, (m) =>
    alertSentence(m[1], "issued an alert on the national platform")],
  [/^ההגנה האזרחית הסעודית השיקה התרעות קצרות ב(.+?)(?: - לראשונה ב(.+?) מאז פתיחת העימות)?$/, (m) => {
    const base = alertSentence(m[1], "issued brief alerts");
    if (!base) return null;
    if (!m[2]) return base;
    const first = englishPlaces(m[2]);
    if (!first.complete || !first.places.length) return null;
    return `${base}, the first for ${first.places[0]} since the conflict began`;
  }],
  [/^צפירות התרעה בסעודיה בגל הלילה$/, () => "Air raid sirens sounded in Saudi Arabia during the overnight wave"],
  [/^בלי אישור רשמי על פגיעה$/, () => "There was no official confirmation of any impact"],
  [/^אחר כך (?:נמסר|הודיעה|הודיע) שהסכנה חלפה$/, () => "An all-clear followed"],
  [/^כתבים שמעו פיצוצים בעוליה$/, () => "Journalists heard explosions in the Olaya district of Riyadh"],
  [/^ממזרח לבירה$/, () => "east of the capital"],
  [/^ההגנה האזרחית הסעודית: שניים נפצעו, מסגד ומבנים ניזוקו מפגיעת קליע חות'י בג'אזאן$/, () =>
    "Saudi civil defence said two people were wounded and a mosque and other buildings damaged by a Houthi projectile in Jazan"],
  [/^ההגנה האזרחית הסעודית: תושב תימני נהרג ושניים נפצעו אחרי יירוט כטב"ם בטאיף(.*)$/, () =>
    "Saudi civil defence said a Yemeni resident was killed and two people wounded after a drone was intercepted over Taif"],
  [/^הקואליציה: 73 פצועים, בהם נשים וילדים, בתקיפות חות'יות על אתרים אזרחיים וכלכליים ב(.+)$/, (m) => {
    const p = englishPlaces(m[1]);
    if (!p.complete || !p.places.length) return null;
    return `The coalition said 73 people were wounded, among them women and children, in Houthi attacks on civilian and economic sites in ${listEn(p.places)}`;
  }],
  [/^הקואליציה: יום שני ברציפות של שיגורים בליסטיים וכטב"מים לעבר (.+)$/, (m) => {
    const p = englishPlaces(m[1]);
    if (!p.complete || !p.places.length) return null;
    return `The coalition reported a second consecutive day of ballistic missile and drone launches towards ${listEn(p.places)}`;
  }],
];

function alertSentence(fragment, verb, tail = "") {
  const { places, complete } = englishPlaces(fragment);
  if (!complete || !places.length) return null;
  return `Saudi civil defence ${verb} in ${listEn(places)}${tail}`;
}

/** Split a Hebrew body into sentences and translate each one. */
function fromSentences(he) {
  let s = heKey(he);
  let attribution = "";
  const lead = s.match(/^לפי ([^:]{2,40}):\s*/);
  if (lead) {
    attribution = ASCII_SOURCE(lead[1]);
    s = s.slice(lead[0].length);
  }
  const parts = s
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.replace(/[.\s]+$/, "").trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const out = [];
  for (const part of parts) {
    let hit = null;
    for (const [re, build] of SENTENCE_RULES) {
      const m = part.match(re);
      if (!m) continue;
      hit = build(m);
      if (hit) break;
    }
    if (!hit) hit = fromTemplate(part);
    if (!hit) return null;
    out.push(hit.replace(/[.\s]*$/, ""));
  }
  const body = out.join(". ") + ".";
  return attribution ? `${body} ${attribution} carried the report.` : body;
}

/** Hebrew outlet name in a "לפי X:" prefix → its English name, or "The source". */
const SOURCE_HE_EN = {
  אלמשהד: "Almashhad",
  "אלח'בר אלימני": "Al-Khabar al-Yemeni",
  "אלחדת'": "Al Hadath",
  אלערביה: "Al Arabiya",
  "אלג'זירה": "Al Jazeera",
  סבא: "Saba",
  "עלי בכר": "Ali Bk",
  צאברין: "Sabereen News",
  אלמסירה: "Al-Masirah",
  "יחיא סריע": "Yahya Saree",
  "אלאח'באר": "Al-Akhbar",
  רויטרס: "Reuters",
  "ערב ניוז": "Arab News",
  "ימן פיוצ'ר": "Yemen Future",
  שיבא: "Sheba Intelligence",
  "עדן אובזרבר": "Aden Observer",
  אנאדולו: "Anadolu",
  אלמנאר: "Al-Manar",
  "מידל איסט איי": "Middle East Eye",
  גרדיאן: "The Guardian",
  "אלערבי אלגדיד": "Al-Araby Al-Jadeed",
  "אלשרק אלאוסט": "Asharq Al-Awsat",
  אלחרה: "Alhurra",
  "ארם ניוז": "Erem News",
  "אלמחור": "Al-Mihwar",
  נאיא: "Naya",
  "שג'ב": "Shajab News",
  "בן סעיד": "Bin Saeed",
  "מוחמד עבדאלסלאם": "Mohammed Abdulsalam",
  "אלקצא עאג'ל": "Al-Aqsa Breaking",
  "שין פרסיאן": "Shin Persian",
  "אלערבי TV": "Al-Araby Television",
  "תקשורת אמריקנית": "US media",
};

function ASCII_SOURCE(he) {
  const k = heKey(he).trim();
  for (const [a, b] of Object.entries(SOURCE_HE_EN)) if (heKey(a) === k) return b;
  return /[֐-׿]/.test(k) ? "The source" : k;
}

function fromTemplate(he) {
  const s = heKey(he);
  for (const rule of TEMPLATES) {
    try {
      const out = rule(s);
      if (out) return out;
    } catch {
      /* a rule that cannot parse simply does not apply */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Fallback: a wire lead from the row's own fields
 * ------------------------------------------------------------------ */

const TYPE_LEAD = {
  strike: (p) => `Reports of a strike${p ? ` in ${p}` : " in Yemen"}`,
  combat: (p) => `Reports of ground fighting${p ? ` in ${p}` : " in Yemen"}`,
  vessel: (p) => `Reports of a vessel attacked${p ? ` off ${p}` : " in the Red Sea"}`,
  port: (p) => `Reports of a strike on port facilities${p ? ` at ${p}` : " in Yemen"}`,
  economy: () => "Reported effect of the conflict on oil exports and shipping",
  diplomacy: () => "Reported diplomatic development around the war in Yemen",
  statement: (p) => `Statement on the fighting${p ? ` in ${p}` : " in Yemen"}`,
};

function placeEn(place, row) {
  // A coordinate beats a place word: it is what the map actually pins.
  const near = row ? placeFromCoords(Number(row.lat), Number(row.lng)) : null;
  if (near && (!place || heKey(String(place)) === heKey("תימן") || /^yemen$/i.test(String(place)))) {
    return near.name;
  }
  if (!place) return near ? near.name : "";
  if (/^[\x00-\x7F\s'’.-]+$/.test(place)) return place; // already English
  const hit = PLACE_HE.get(heKey(place));
  return hit || (near ? near.name : "");
}

function fallbackHead(row) {
  const p = placeEn(row.place);
  const lead = TYPE_LEAD[row.type] || TYPE_LEAD.statement;
  return lead(p);
}

/** Bodies with no hand translation become a one-sentence wire lead. */
function fallbackBody(head, row) {
  const src = String(row.source || "").split(/\s*[·|/]\s*/)[0] || "the source";
  const day = fmtDay(row.at);
  const sentence = head.replace(/[.\s]*$/, "");
  return `${sentence}${day ? ` on ${day}` : ""}. ${src} carried the report. Full detail is at the source link.`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtDay(at) {
  const m = String(at || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

/** Wire dateline for the body, from the row's place. */
function dateline(row) {
  const p = placeEn(row.place);
  if (!p) return "";
  return `${p.replace(/^the /, "").toUpperCase()} — `;
}

/* ------------------------------------------------------------------ *
 * Row translation
 * ------------------------------------------------------------------ */

const stats = {
  headHand: 0,
  headTemplate: 0,
  headFallback: 0,
  bodyHand: 0,
  bodyTemplate: 0,
  bodyFallback: 0,
  missing: new Map(),
};

function noteMissing(he, kind) {
  const k = heKey(he).slice(0, 90);
  if (!k) return;
  const prev = stats.missing.get(k) || { kind, n: 0 };
  prev.n += 1;
  stats.missing.set(k, prev);
}

function hasHebrew(s) {
  return /[֐-׿]/.test(String(s || ""));
}

function translateHead(he, row) {
  if (!hasHebrew(he)) return sharpenPlace(String(he || ""), row);
  const hand = STORE.get(heKey(he));
  if (hand) {
    stats.headHand += 1;
    return sharpenPlace(hand, row);
  }
  const tpl = fromTemplate(he);
  if (tpl) {
    stats.headTemplate += 1;
    return sharpenPlace(tpl, row);
  }
  stats.headFallback += 1;
  noteMissing(he, "head");
  return sharpenPlace(fallbackHead(row), row);
}

function translateBody(he, head, row) {
  if (!hasHebrew(he)) return String(he || "") || fallbackBody(head, row);
  const hand = STORE.get(heKey(he));
  if (hand) {
    stats.bodyHand += 1;
    return `${dateline(row)}${hand}`;
  }
  // Bodies the old composer generated: rebuild them sentence by sentence.
  const sentences = fromSentences(he);
  if (sentences) {
    stats.bodyTemplate += 1;
    return `${dateline(row)}${sentences}`;
  }
  const stripped = heKey(he).replace(/^לפי [^:]{1,40}:\s*/, "");
  const tpl = fromTemplate(stripped);
  if (tpl) {
    stats.bodyTemplate += 1;
    return `${dateline(row)}${fallbackBody(tpl, row)}`;
  }
  stats.bodyFallback += 1;
  noteMissing(he, "body");
  return `${dateline(row)}${fallbackBody(head, row)}`;
}

/* Media captions, credits and the short curator notes on map events. */

const CAPTIONS = {
  "שברי F-15 סעודי ממערב למאריב — עדיין מתוך סרטון חות׳י שאומת גיאוגרפית ב־BBC Verify (סנפיר זנב עם דגל סעודי).":
    "Wreckage of a Saudi F-15 west of Marib — a still from Houthi video geolocated by BBC Verify, showing a tail fin with Saudi markings.",
  "תצלום אווירי של אי מַיוּן (פֶּרים) במצר באב אלמַנדב. ממחיש את מיקום האי — לא צילום ההשתלטות עצמה.":
    "Aerial view of Mayun (Perim) island in the Bab al-Mandab strait. Shown to place the island — not a photograph of the seizure itself.",
  "עמוד עשן שחור מעל רחוב באלמח׳א ב־9.08.2026, אחרי גל הטילים והכטב״מים על הנמל.":
    "A column of black smoke over a street in Mocha on 9 August 2026, after the wave of missiles and drones on the port.",
  "עמוד עשן מעל מתחם ארמקו בגַ׳אזאן ב־9.08.2026 — צילום לוויין.":
    "Smoke over the Aramco complex at Jazan on 9 August 2026, in a satellite image.",
};

const CREDITS = {
  "BBC Verify · דובר החות׳ים": "BBC Verify · Houthi military spokesman",
  "ניו יורק טיימס": "The New York Times",
  רויטרס: "Reuters",
  "דיווחי סוכנויות גלויים, 2026": "Open agency reporting, 2026",
};

const EVENT_NOTES = {
  "אלמשהד / אלמהריה — כוחות וציוד לסעודית/קואליציה":
    "Almashhad and Al-Mahriah — troops and equipment for the Saudi-led coalition",
  "אלמשהד / ענקים — מקורות ביטחוניים; לא אומת":
    "Almashhad and the Giants Brigades — security sources, unverified",
  "אלמשהד — אחד משלושה פיצוצים בסביבת מחנה עקורים":
    "Almashhad — one of three explosions near a displacement camp",
  "Yemen Window — התבצרות חות׳ית ברום המשקיף על המיצר":
    "Yemen Window — Houthi forces digging in on the heights overlooking the strait",
  "אלמוניטור / שיבאב — כמעט 1,000 חיילים ממשלתיים הגיעו לג׳יבוטי; זֻקַר לצד חַניש":
    "Al-Monitor and Shabab — nearly 1,000 government soldiers reached Djibouti; Zuqar alongside Hanish",
  "דווח ב־AFP — חַניש הגדול והקטן": "AFP — Greater and Lesser Hanish",
  "שליטה חות׳ית מדווחת בפתח באב אלמַנדב": "Reported Houthi control at the mouth of Bab al-Mandab",
  "ציר באב אלמַנדב — אחיזה חות׳ית מדווחת": "Bab al-Mandab axis — reported Houthi foothold",
  "דווח באלג׳זירה / ערב ניוז — אחיזה חות׳ית בנמל ובציר חוף":
    "Al Jazeera and Arab News — Houthi foothold in the port and along the coastal road",
  "פינוי ממשלתי מדווח לאורך חוף תעז": "Reported government evacuation along the Taiz coast",
};

function lookupCurated(map, he) {
  if (!he) return "";
  const want = heKey(he);
  for (const [k, v] of Object.entries(map)) if (heKey(k) === want) return v;
  return "";
}

function migrateMedia(m) {
  const row = { ...m };
  if (row.captionHe) {
    row.caption = lookupCurated(CAPTIONS, row.captionHe) || STORE.get(heKey(row.captionHe)) || "";
    delete row.captionHe;
  }
  if (row.credit && hasHebrew(row.credit)) {
    row.credit = lookupCurated(CREDITS, row.credit) || row.credit.replace(/[֐-׿]+/g, "").trim();
  }
  return row;
}

/** Fingerprints carried Hebrew city names; keep them stable but ASCII. */
function asciiFp(fp) {
  const s = String(fp || "");
  if (!hasHebrew(s)) return s;
  return s.replace(/[֐-׿][֐-׿֑-ׇ'׳״\s]*/g, (m) => {
    const en = onePlace(m.trim());
    return en ? en.replace(/[^A-Za-z0-9]+/g, "-") : "x";
  });
}

function migrateSources(list) {
  if (!Array.isArray(list)) return list;
  return list.map((s) => {
    if (!s || typeof s !== "object" || !hasHebrew(s.name || "")) return s;
    return { ...s, name: lookupCurated(CREDITS, s.name) || "Open source reporting" };
  });
}

/* ------------------------------------------------------------------ *
 * Migration
 * ------------------------------------------------------------------ */

const src = JSON.parse(readFileSync("public/data.he.json", "utf8"));
const out = { ...src };

/* Reports */
out.reports = (src.reports || []).map((r) => {
  const row = { ...r };
  const head = translateHead(r.summary, r);
  row.summary = head;
  row.text = translateBody(r.text, head, r);
  const p = placeEn(r.place, r);
  if (p) row.place = p;
  else delete row.place;
  row.fp = asciiFp(row.fp);
  if (Array.isArray(row.media)) row.media = row.media.map(migrateMedia);
  if (Array.isArray(row.sources)) row.sources = migrateSources(row.sources);
  if (Array.isArray(row.confidenceSources)) row.confidenceSources = migrateSources(row.confidenceSources);
  return fixPortRows(row);
});

/* Events — labelHe becomes label */
out.events = (src.events || []).map((e) => {
  const row = { ...e };
  const head = translateHead(e.labelHe || e.titleHe, e);
  row.label = head;
  delete row.labelHe;
  delete row.titleHe;
  row.text = translateBody(e.text, head, e);
  if (row.note) row.note = lookupCurated(EVENT_NOTES, row.note) || (hasHebrew(row.note) ? "" : row.note);
  row.fp = asciiFp(row.fp);
  const p = placeEn(e.place, e);
  if (p) row.place = p;
  else delete row.place;
  if (Array.isArray(row.media)) row.media = row.media.map(migrateMedia);
  if (Array.isArray(row.sources)) row.sources = migrateSources(row.sources);
  return fixPortRows(row);
});


/* Control */
out.control = (src.control || []).map((c) => {
  const en = CONTROL[c.id] || {};
  return { ...c, name: en.name || c.name, note: en.note || "" };
});

/* Governorates */
out.governorates = (src.governorates || []).map((g) => {
  const en = GOVERNORATES[g.id] || {};
  const row = { ...g, name: en.name || g.id, note: en.note || "" };
  delete row.nameHe;
  return row;
});

/* Islands */
out.islandControl = (src.islandControl || []).map((isl) => {
  const en = ISLANDS[isl.id] || {};
  const row = { ...isl, name: en.name || isl.id, note: en.note || "" };
  delete row.nameHe;
  if (Array.isArray(row.media)) {
    row.media = row.media.map((m) => {
      const mm = { ...m };
      delete mm.captionHe;
      mm.caption = en.caption || "";
      if (en.credit) mm.credit = en.credit;
      return mm;
    });
  }
  return row;
});

/* Control epochs */
out.controlEpochs = (src.controlEpochs || []).map((ep) => {
  const row = { ...ep, label: EPOCHS[ep.at] || ep.at };
  delete row.labelHe;
  if (Array.isArray(row.cities)) {
    row.cities = row.cities.map((c) => {
      const cc = { ...c, name: EPOCH_CITIES[c.id] || placeEn(c.nameHe) || c.id };
      delete cc.nameHe;
      return cc;
    });
  }
  return row;
});

/* Timeline */
out.timeline = (src.timeline || []).map((t) => {
  const en = TIMELINE[t.id] || {};
  const row = { ...t };
  row.title = en.title || t.id;
  row.summary = en.summary || "";
  row.detail = en.detail || "";
  row.mapNote = en.mapNote || "";
  row.bullets = [];
  delete row.titleHe;
  delete row.summaryHe;
  delete row.detailHe;
  delete row.mapNoteHe;
  delete row.bulletsHe;
  if (Array.isArray(row.sources)) row.sources = migrateSources(row.sources);
  return row;
});

/* Fronts — matched by position, which is the order they were curated in */
out.fronts = (src.fronts || []).map((f, i) => {
  const en = FRONTS[i] || {};
  const row = { ...f };
  row.id = en.id || `front-${i}`;
  row.name = en.name || row.id;
  row.where = en.where || "";
  row.plain = en.plain || "";
  row.summary = en.summary || "";
  row.detail = en.detail || "";
  delete row.whereHe;
  delete row.plainHe;
  delete row.summaryHe;
  delete row.detailHe;
  if (row.mapFocus) {
    row.mapFocus = { ...row.mapFocus, miniLabel: en.miniLabel || "" };
  }
  return row;
});

/* Casualties */
out.casualties = {
  ...(src.casualties || {}),
  summary: CASUALTIES.summary,
  bullets: CASUALTIES.bullets,
};
delete out.casualties.summaryHe;
delete out.casualties.bulletsHe;
delete out.casualties.noteHe;
// Refreshed on the same 12-hour cadence as the situation strip and the fronts.
out.casualties.cadenceHours = 12;

/* Situation */
out.situation = {
  ...(src.situationHe || {}),
  summary: SITUATION.summary,
  cadenceHours: 12,
};
delete out.situation.summaryHe;
delete out.situationHe;

/* Digests */
out.recentDigests = (src.recentDigests || []).map((d) => {
  const en = DIGESTS[d.fp] || {};
  const row = { ...d, title: en.title || "", text: en.text || "" };
  delete row.titleHe;
  delete row.textHe;
  return row;
});

/* Glossary and standing notes */
out.glossary = GLOSSARY;
out.sourcesNote = NOTES.sourcesNote;
out.uxNote = NOTES.uxNote;
out.transliteration = NOTES.transliteration;
out.disclaimer = NOTES.disclaimer;
out.lang = "en";
out.dir = "ltr";
out.briefCadenceHours = 12;

/* ------------------------------------------------------------------ *
 * Write and report
 * ------------------------------------------------------------------ */

writeFileSync("public/data.json", JSON.stringify(out, null, 2), "utf8");

/* live-reports.json — the scan snapshot */
try {
  const live = JSON.parse(readFileSync("public/live-reports.he.json", "utf8"));
  live.reports = (live.reports || []).map((r) => {
    const row = { ...r };
    const head = translateHead(r.summary, r);
    row.summary = head;
    row.text = translateBody(r.text, head, r);
    const p = placeEn(r.place, r);
    if (p) row.place = p;
    else delete row.place;
    return row;
  });
  live.rawHits = (live.rawHits || []).map((h) => ({
    ...h,
    seenAt: h.seenAt || h.at,
    reason: h.reason || (h.kept ? "kept" : "legacy"),
    note: h.note || "",
  }));
  live.cycleNote = "";
  writeFileSync("public/live-reports.json", JSON.stringify(live), "utf8");
} catch (err) {
  console.warn("live-reports migration skipped:", err.message);
}

/* Residual Hebrew check — the migration is not done until this is zero. */
const finalText = readFileSync("public/data.json", "utf8");
const residual = finalText.match(/[֐-׿]+/g) || [];

console.log("reports:", out.reports.length, "events:", out.events.length);
console.log(
  `headlines — hand ${stats.headHand}, template ${stats.headTemplate}, generic ${stats.headFallback}`,
);
console.log(`bodies — hand ${stats.bodyHand}, template ${stats.bodyTemplate}, generic ${stats.bodyFallback}`);
console.log(`residual Hebrew fragments in data.json: ${residual.length}`);
if (residual.length) {
  console.log("  sample:", [...new Set(residual)].slice(0, 12).join(" "));
}

const missing = [...stats.missing.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`strings still needing a hand translation: ${missing.length}`);
for (const [k, v] of missing.slice(0, 15)) console.log(`  [${v.kind} x${v.n}] ${k}`);
