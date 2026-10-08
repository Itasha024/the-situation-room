/**
 * Iran's and the Houthis' calendars, to the ordinary (Gregorian) one.
 *
 * Iran's channels date in the Solar Hijri calendar ("۷ مهر ۱۴۰۵", "1405/07/07"
 * = 29 September 2026); Al-Masirah and Saba add the lunar Hijri date
 * ("17-04-1447هـ", "17 ربيع الآخر 1447"). A date the reader copies from such a
 * text must be the Gregorian one, and a figure check must know that "29
 * September" is what "۷ مهر" says.
 *
 * The conversion leans on the runtime's own calendars (Intl's "persian" and
 * "islamic-umalqura"), not on hand arithmetic: a guess near the date, then the
 * days around it are asked which one carries it.
 */

type Cal = "persian" | "islamic-umalqura";

const fmtCache = new Map<Cal, Intl.DateTimeFormat>();
function fmt(cal: Cal): Intl.DateTimeFormat {
  let f = fmtCache.get(cal);
  if (!f) {
    f = new Intl.DateTimeFormat(`en-u-ca-${cal}-nu-latn`, { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
    fmtCache.set(cal, f);
  }
  return f;
}

/** A Gregorian day's date in another calendar: [year, month, day]. */
export function toCalendar(cal: Cal, d: Date): [number, number, number] {
  const p = Object.fromEntries(fmt(cal).formatToParts(d).map((x) => [x.type, x.value]));
  return [parseInt(p.year ?? p.relatedYear, 10), parseInt(p.month, 10), parseInt(p.day, 10)];
}

/** A date in another calendar as a Gregorian day (UTC midnight), or null if there is none. */
export function fromCalendar(cal: Cal, y: number, m: number, d: number): Date | null {
  if (!(y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  // Solar Hijri: year 1 began in 622, and its year is a solar one. Lunar: 354 days a year.
  const guess =
    cal === "persian"
      ? Date.UTC(y + 621, 2, 21) + ((m - 1) * 30.5 + (d - 1)) * 86_400_000
      : Date.UTC(622, 6, 16) + ((y - 1) * 354.367 + (m - 1) * 29.53 + (d - 1)) * 86_400_000;
  for (let off = 0; off <= 45; off++) {
    for (const s of off ? [off, -off] : [0]) {
      const t = new Date(Math.round(guess / 86_400_000) * 86_400_000 + s * 86_400_000);
      const [cy, cm, cd] = toCalendar(cal, t);
      if (cy === y && cm === m && cd === d) return t;
    }
  }
  return null;
}

export const PERSIAN_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
/** Lunar Hijri months as Arabic channels write them, each with its variants. */
export const HIJRI_MONTHS: string[][] = [
  ["محرم"],
  ["صفر"],
  ["ربيع الأول", "ربيع الاول"],
  ["ربيع الآخر", "ربيع الثاني", "ربيع الاخر"],
  ["جمادى الأولى", "جمادى الاولى", "جمادي الأولى", "جمادي الاولى"],
  ["جمادى الآخرة", "جمادى الثانية", "جمادى الاخرة", "جمادي الآخرة"],
  ["رجب"],
  ["شعبان"],
  ["رمضان"],
  ["شوال"],
  ["ذو القعدة", "ذي القعدة"],
  ["ذو الحجة", "ذي الحجة"],
];

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Western digits for Persian and Arabic-Indic ones. */
function digits(s: string): string {
  return s.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

export type FoundDate = { text: string; cal: Cal; date: Date; en: string };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const yi = (s: string) => s.replace(/ی/g, "[یي]").replace(/ک/g, "[کك]");

/**
 * The Solar and lunar Hijri dates in a text, each with its Gregorian day.
 * Forms: "۷ مهر ۱۴۰۵", "۷ مهرماه ۱۴۰۵", "1405/07/07" (and "۱۴۰۵-۰۷-۰۷"),
 * "17 ربيع الآخر 1447", "17-04-1447هـ", "1447/4/17 هـ". A day and month with
 * no year take the current year of that calendar at `now`.
 */
export function findCalendarDates(text: string, now = new Date()): FoundDate[] {
  const t = digits(String(text || ""));
  const out: FoundDate[] = [];
  const push = (raw: string, cal: Cal, y: number, m: number, d: number) => {
    const date = fromCalendar(cal, y, m, d);
    if (!date || out.some((o) => o.text === raw)) return;
    out.push({ text: raw, cal, date, en: `${date.getUTCDate()} ${MONTHS_EN[date.getUTCMonth()]} ${date.getUTCFullYear()}` });
  };
  const [py] = toCalendar("persian", now);
  const [hy] = toCalendar("islamic-umalqura", now);
  // "۷ مهر ۱۴۰۵", "۷ مهرماه"
  PERSIAN_MONTHS.forEach((name, i) => {
    const re = new RegExp(`(\\d{1,2})\\s*(?:ام\\s*)?${yi(esc(name))}(?:\\s*ماه)?(?:\\s*(?:سال\\s*)?(1[34]\\d\\d))?`, "g");
    for (const m of t.matchAll(re)) push(m[0].trim(), "persian", m[2] ? Number(m[2]) : py, i + 1, Number(m[1]));
  });
  // "1405/07/07": a Solar Hijri year 13xx/14xx, before 1420 (lunar years are 14xx too, and later).
  for (const m of t.matchAll(/\b(13\d\d|140\d|141\d)[/\-.](\d{1,2})[/\-.](\d{1,2})\b(?!\s*هـ)/g)) push(m[0], "persian", Number(m[1]), Number(m[2]), Number(m[3]));
  // "17 ربيع الآخر 1447"
  HIJRI_MONTHS.forEach((names, i) => {
    const re = new RegExp(`(\\d{1,2})\\s*(?:من\\s*)?(?:${names.map(esc).join("|")})(?:\\s*(?:سنة|عام)?\\s*(14\\d\\d))?`, "g");
    for (const m of t.matchAll(re)) push(m[0].trim(), "islamic-umalqura", m[2] ? Number(m[2]) : hy, i + 1, Number(m[1]));
  });
  // "17-04-1447هـ", "1447/4/17 هـ"
  for (const m of t.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](14[2-9]\d)\s*هـ?/g)) {
    if (/هـ/.test(m[0]) || Number(m[3]) >= 1420) push(m[0].trim(), "islamic-umalqura", Number(m[3]), Number(m[2]), Number(m[1]));
  }
  for (const m of t.matchAll(/\b(14[2-9]\d)[/\-.](\d{1,2})[/\-.](\d{1,2})\s*هـ/g)) push(m[0].trim(), "islamic-umalqura", Number(m[1]), Number(m[2]), Number(m[3]));
  return out;
}

/** A note for the reader: each Iranian or Hijri date in the text, as the Gregorian day it is. */
export function calendarHints(text: string, now = new Date()): string {
  const found = findCalendarDates(text, now);
  if (!found.length) return "";
  return found.map((f) => `"${f.text}" (${f.cal === "persian" ? "Iranian solar calendar" : "Hijri calendar"}) = ${f.en}`).join("; ");
}

/** Iran's months as English copy writes them (Amordad is Mordad). */
const PERSIAN_MONTHS_EN = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"];
const MONTH_EN_RE = "(Farvardin|Ordibehesht|Khordad|Tir|A?mordad|Shahrivar|Mehr|Aban|Azar|Dey|Bahman|Esfand)";
const monthIndex = (name: string) => PERSIAN_MONTHS_EN.findIndex((m) => m.toLowerCase() === name.toLowerCase().replace(/^amordad$/, "mordad"));

/** The Solar Hijri year a month falls in: the latest one not after `now`. */
function persianYearOf(month: number, now: Date): number {
  const [y, m] = toCalendar("persian", now);
  return month <= m ? y : y - 1;
}

const gDay = (d: Date) => `${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const part = (day: number) => (day <= 10 ? "early" : day <= 20 ? "mid" : "late");

/**
 * Iran's calendar left in English copy, put into the ordinary one (8 Oct:
 * "on Thursday 16 Mehr (8 October 2026)", "since early Shahrivar", "the Mah
 * 2026 protests"). The reader is told each date (`calendarHints`) and still
 * copies a few.
 *  - "16 Mehr (8 October 2026)" keeps the Gregorian date only.
 *  - "16 Mehr" and "16 Mehr 1405" become "8 October 2026".
 *  - "early/mid/late Shahrivar", "in/since/during Shahrivar" become the
 *    Gregorian part of the month it falls in ("late August").
 *  - The protests of Dey 1404 ("Dey protests", "Mah protests": ماه is "month")
 *    are the January 2026 protests.
 * A month name with no day, part or preposition is left alone: "Mehr" is also
 * Mehr News, and "Azar" a person.
 */
export function westernDates(text: string, now = new Date()): string {
  let t = String(text || "");
  if (!t) return t;
  t = t.replace(new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)? ${MONTH_EN_RE}(?: (1[34]\d\d))?(?:,? (?:\(|which is |i\.e\. )(\d{1,2} [A-Z][a-z]+ \d{4})\)?)?`, "g"), (all, d: string, mon: string, y: string | undefined, greg: string | undefined) => {
    if (greg) return greg;
    const m = monthIndex(mon) + 1;
    const date = fromCalendar("persian", y ? Number(y) : persianYearOf(m, now), m, Number(d));
    return date ? gDay(date) : all;
  });
  t = t.replace(new RegExp(String.raw`\b(early|mid|late|the end of|the start of|the beginning of)[- ]${MONTH_EN_RE}(?! News)(?: (1[34]\d\d))?\b`, "gi"), (all, when: string, mon: string, y: string | undefined) => {
    const m = monthIndex(mon) + 1;
    const year = y ? Number(y) : persianYearOf(m, now);
    const day = /early|start|beginning/i.test(when) ? 5 : /mid/i.test(when) ? 15 : 27;
    const date = fromCalendar("persian", year, m, day);
    return date ? `${part(date.getUTCDate())} ${MONTHS_EN[date.getUTCMonth()]}` : all;
  });
  t = t.replace(new RegExp(String.raw`\b(in|since|during|until|by|from) ${MONTH_EN_RE}(?! News)(?: (1[34]\d\d))?\b`, "g"), (all, prep: string, mon: string, y: string | undefined) => {
    const m = monthIndex(mon) + 1;
    const date = fromCalendar("persian", y ? Number(y) : persianYearOf(m, now), m, 1);
    return date ? `${prep} ${part(date.getUTCDate())} ${MONTHS_EN[date.getUTCMonth()]}` : all;
  });
  t = t.replace(/\b(?:Dey|Mah)(?:[- ](?:month|Mah))?(?: (?:1404|2026))? (protests?|uprising|unrest|demonstrations)\b/g, "January 2026 $1");
  return t;
}
