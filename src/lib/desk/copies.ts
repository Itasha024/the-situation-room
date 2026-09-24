/**
 * Is one report a copy of another? Kept apart from the scanner so it can be
 * tested without the store. `public/app.js` carries the same rule.
 */

/** Content words of a headline, without the speaker it opens with. */
function headWords(summary: string): Set<string> {
  const said = String(summary || "").replace(/^[^:]{2,60}:\s/, "");
  return new Set(
    (said.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !HEAD_STOP.has(w)).map((w) => w.replace(/s$/, "")),
  );
}
const HEAD_STOP = new Set("the and for with from that this into over after amid near its his her their has have had was were are will been says said say".split(" "));

/**
 * Two headlines tell the same event when most of their words are shared. Only
 * such copies fold into one card: two strikes on one front, or two lines of
 * one speech, are different reports.
 */
export function sameWords(a: string, b: string): boolean {
  const x = headWords(a);
  const y = headWords(b);
  if (!x.size || !y.size) return false;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return both / (x.size + y.size - both) >= 0.4;
}

/** Words that tell nothing about which story a report is: roles, sides, days. */
const STORY_STOP = new Set(
  (
    "the and for with from that this into over after amid near its his her their has have had was were are will been " +
    "says said say stated state also sunday monday tuesday wednesday thursday friday saturday today yemen yemeni houthi " +
    "houthis saudi arabia leader president head according officials official sources source reuters"
  ).split(" "),
);
function storyWords(s: string): Set<string> {
  return new Set(
    (s.toLowerCase().replace(/\bal-/g, "").match(/[a-z][a-z'-]{2,}/g) || [])
      .filter((w) => !STORY_STOP.has(w))
      .map((w) => w.replace(/(?:ing|ed|s)$/, "")),
  );
}
function storyNames(s: string): Set<string> {
  return new Set(
    (s.match(/\b[A-Z][a-z]{2,}(?:-[A-Z][a-z]+)?\b/g) || [])
      .map((w) => w.toLowerCase().replace(/^al-/, ""))
      .filter((w) => !STORY_STOP.has(w)),
  );
}

/**
 * Two statement or diplomacy reports tell the same story: most of the smaller
 * one's words are in the other, or they name the same three people and share
 * a good part of their words. Five outlets' takes on one Reuters story fold
 * into one card; two lines of one speech do not (their words differ).
 */
export function sameStory(a: { summary: string; text?: string }, b: { summary: string; text?: string }): boolean {
  const ta = `${a.summary} ${a.text ?? ""}`;
  const tb = `${b.summary} ${b.text ?? ""}`;
  const x = storyWords(ta);
  const y = storyWords(tb);
  if (x.size < 3 || y.size < 3) return false;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  const overlap = both / Math.min(x.size, y.size);
  if (overlap >= 0.5) return true;
  const na = storyNames(ta);
  let names = 0;
  for (const w of storyNames(tb)) if (na.has(w)) names += 1;
  return names >= 3 && overlap >= 0.3;
}

/**
 * Two outlets, one event, and the reader wrote both up in the same words.
 *
 * `sameStory` only ever ran on statements and diplomacy, so a strike or a
 * clash relayed a minute later by a second channel went out as its own card
 * even when its headline matched the first one character for character. This
 * is the strict test — same sentence, once case and spacing are set aside —
 * so it folds those and nothing looser.
 */
export function sameHeadline(a: { summary: string }, b: { summary: string }): boolean {
  const key = (s: string) =>
    String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.!?…]+$/, "")
      .trim();
  const x = key(a.summary);
  return x.length >= 20 && x === key(b.summary);
}

/**
 * The same post forwarded by several channels: letters and digits only, with
 * links, handles, hashtags, emoji and the "urgent" tag gone. Two posts with
 * one key are one account, whichever scan saw each.
 */
export function copyKey(text: string): string {
  const core = String(text || "")
    .replace(/https?:\/\/\S+|[@#][\p{L}\p{N}_]+/gu, " ")
    .replace(/عاجل|العاجل/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 200);
  if (core.length < 40) return "";
  let h = 5381;
  for (let i = 0; i < core.length; i += 1) h = ((h * 33) ^ core.charCodeAt(i)) >>> 0;
  return h.toString(36) + core.length.toString(36);
}

/* ------------------------------------------------------------------ *
 * One event, two outlets, different words: ground, alerts and figures
 * ------------------------------------------------------------------ */

type Spot = { lat: number; lng: number };

/** Great-circle distance in km. */
export function kmApart(a: Spot, b: Spot): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

type Grounded = { place?: string; lat?: number; lng?: number };

/** A country or a sea is no place to fold on: two strikes 400 km apart share "Yemen". */
const VAGUE_PLACE = /^(?:yemen|saudi arabia|red sea|gulf of aden|arabian sea|bab al-mandab|iran|oman|the sea|at sea|sea)$/i;

export function vagueGround(r: Grounded): boolean {
  return !r.place || VAGUE_PLACE.test(r.place.trim()) || !Number.isFinite(r.lat) || !Number.isFinite(r.lng);
}

/** Both reports name one spot: the same place, or pins within this many km. */
export const GROUND_KM = 25;

export function sameGround(a: Grounded, b: Grounded): boolean {
  if (vagueGround(a) || vagueGround(b)) return false;
  if (a.place!.trim().toLowerCase() === b.place!.trim().toLowerCase()) return true;
  return kmApart(a as Spot, b as Spot) <= GROUND_KM;
}

/**
 * A siren or an alert, however it is worded: "Air raid sirens sound in
 * Jeddah", "Saudi Arabia activates siren mode", "Warning alerts issued for
 * Makkah". Lifting an alert is another event.
 */
export const ALERT_RE = /\b(?:sirens?|siren mode|alerts?|air raid warnings?)\b/i;
const LIFTED = /\blift(?:s|ed|ing)?\b|\bend(?:s|ed)?\b.*\balert/i;
/** An impact is a harder fact than a siren: a headline with one is never folded as an alert. */
const IMPACT = /\b(?:hits?|struck|strikes?|impacts?|explosions?|blasts?|killed|dead|wounded|injured|damage[ds]?|debris|shrapnel|fell|fire)\b/i;

const SAUDI_CITIES: [RegExp, string][] = [
  [/\briyadh\b/i, "riyadh"], [/\bjeddah\b/i, "jeddah"], [/\b(?:mecca|makkah)\b/i, "makkah"], [/\btaif\b/i, "taif"],
  [/\bj[ai]zan\b/i, "jazan"], [/\bnajran\b/i, "najran"], [/\babha\b/i, "abha"], [/\bkhamis mushait\b/i, "khamis"],
  [/\byanbu\b/i, "yanbu"], [/\btabuk\b/i, "tabuk"], [/\bdammam\b/i, "dammam"], [/\bal-kharj\b/i, "kharj"],
  [/\bmedina|madinah\b/i, "madinah"], [/\bsharurah\b/i, "sharurah"], [/\basir\b/i, "asir"], [/\bdhahran\b/i, "dhahran"],
];

/** The Saudi cities an alert names ([] for "Saudi Arabia" alone), or null when it is no Saudi alert. */
export function alertCities(r: { summary: string }): string[] | null {
  const s = String(r.summary || "");
  if (!ALERT_RE.test(s) || LIFTED.test(s) || IMPACT.test(s)) return null;
  const cities = SAUDI_CITIES.filter(([re]) => re.test(s)).map(([, c]) => c);
  if (!cities.length && !/\bsaudi\b/i.test(s)) return null;
  return cities;
}

/** Two alerts about the same cities, or one of them names none. */
export function citiesOverlap(a: string[], b: string[]): boolean {
  return !a.length || !b.length || a.some((c) => b.includes(c));
}

/**
 * The figures a headline states. Years and designators (F-15, MQ-9, Wing
 * Loong II, 737) are not figures: they would fold two events on the aircraft
 * and not the event.
 */
export function numbersIn(s: string): number[] {
  const out: number[] = [];
  for (const m of String(s || "").matchAll(/(?<![\w.-])(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\w-]*[A-Za-z])/g)) {
    const before = s.slice(Math.max(0, m.index! - 2), m.index);
    if (/[A-Za-z]-?$/.test(before)) continue;
    const n = Number(m[1].replace(/,/g, ""));
    if (m[1].length === 4 && n >= 1900 && n <= 2100) continue;
    out.push(n);
  }
  return out;
}

/** Casualty figures: "at least 7 killed", "12 wounded". */
export function casualtyCount(s: string): number[] {
  return [...String(s || "").matchAll(/(\d{1,3}(?:,\d{3})*|\d+)\s+(?:\w+\s+){0,3}?(?:killed|dead|died|wounded|injured|casualties)/gi)].map((m) =>
    Number(m[1].replace(/,/g, "")),
  );
}

/** Both give casualty figures and none agree: two events, or two tallies. */
export function numbersClash(a: string, b: string): boolean {
  const x = casualtyCount(a);
  const y = casualtyCount(b);
  if (x.length && y.length) return !x.some((n) => y.includes(n));
  const p = numbersIn(a);
  const q = numbersIn(b);
  // "22 vessels" and "31 vessels": the same noun with another figure.
  const noun = (s: string, n: number) => new RegExp(`\\b${n}\\s+([a-z]+)`, "i").exec(s)?.[1]?.toLowerCase();
  for (const n of p) for (const m of q) if (n !== m && noun(a, n) && noun(a, n) === noun(b, m)) return true;
  return false;
}

/** Both state one figure of at least `min`: the same claim repeated. */
export function sameCount(a: string, b: string, min = 3): boolean {
  const q = new Set(numbersIn(b));
  return numbersIn(a).some((n) => n >= min && q.has(n));
}

/**
 * A headline that carries a figure or a named object does not happen twice in
 * a day: "Kpler data: 22 commodity vessels…", "a Wing Loong II over Mocha".
 * "Saudi warplanes strike Haifan district" does.
 */
const NAMED_OBJECT = /\b(?:Wing Loong(?: II)?|MQ-\d+|F-\d+[A-Z]?|Shahed(?:-\d+)?|Samad(?:-\d+)?|Quds(?:-\d+)?|Zulfiqar|Toufan|Burkan(?:-\d+)?|Palestine-\d|Hatem(?:-\d+)?|Patriot|THAAD|Kpler|[A-Z][a-z]+ (?:tanker|frigate|destroyer|vessel|carrier))\b/;

export function countedOrNamed(s: string): boolean {
  return numbersIn(s).length > 0 || NAMED_OBJECT.test(String(s || ""));
}
