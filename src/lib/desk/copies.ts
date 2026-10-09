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

/** How many story words two headlines share. */
export function wordsInCommon(a: string, b: string): number {
  const x = storyWords(a);
  let n = 0;
  for (const w of storyWords(b)) if (x.has(w)) n += 1;
  return n;
}

const STATE_UP =/\b(?:normal\w*|uninterrupted|continu\w*|restor\w*|resum\w*|recover\w*|reopen\w*)\b/i;
const STATE_DOWN = /\b(?:stop\w*|halt\w*|fires?|attack\w*|damage\w*|out of service|suspend\w*|shut\w*|closed?|disrupt\w*)\b/i;
/** One says a thing works again, the other that it stopped: "pipeline operating normally" and "fire at the pipeline". */
function stateClash(a: string, b: string): boolean {
  const up = (s: string) => STATE_UP.test(s) && !STATE_DOWN.test(s);
  const down = (s: string) => STATE_DOWN.test(s) && !STATE_UP.test(s);
  return (up(a) && down(b)) || (down(a) && up(b));
}
/**
 * One decision or economic fact told by several outlets, judged on the
 * headlines alone (the bodies' surroundings matched a transport minister's
 * meeting to a state minister's): the same story, the same places if both
 * name any, and no clash of state or figures. Saudi Arabia's regularising of
 * Yemenis' residency went out as eight cards on 5 Oct.
 */
export function sameDecision(a: { summary: string; at?: string }, b: { summary: string; at?: string }): boolean {
  // Decisions, not events: a strike or an attack is judged by the field rules.
  if (EVENT_WORDS.test(a.summary) || EVENT_WORDS.test(b.summary)) return false;
  if (!sameStory({ summary: a.summary }, { summary: b.summary })) return false;
  if (stateClash(a.summary, b.summary) || numbersClash(a.summary, b.summary)) return false;
  const places = (s: string) => new Set([...storyNames(s.replace(/^\S+\s*/, ""))].filter((w) => !TITLE_WORDS.has(w)));
  const pa = places(a.summary);
  const pb = places(b.summary);
  if (pa.size && pb.size && ![...pb].some((w) => pa.has(w))) return false;
  const shared = wordsInCommon(a.summary, b.summary);
  if (shared >= 3) return true;
  // Two words only ("status", "Yemenis") hold within ninety minutes, both naming where.
  const gap = a.at && b.at ? Math.abs(Date.parse(a.at) - Date.parse(b.at)) : Infinity;
  return shared >= 2 && pa.size > 0 && pb.size > 0 && gap <= 90 * 60_000;
}
const EVENT_WORDS = /\b(?:strikes?|struck|hit|hits|attack\w*|clash\w*|shell\w*|intercept\w*|kill\w*|wound\w*|explosions?|missiles?|drones?)\b/i;
const TITLE_WORDS = new Set("king prince international airport port ministry minister foreign university centre center council company corporation authority general".split(" "));

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

const ROLE_WORDS = /^(?:STC|Houthi|Houthis|Saudi|Yemen|Yemen's|Yemeni|UN|US|UAE|Iran|Iranian|Official|Minister|Spokesman|Spokesperson|Leader|President|Council|Presidential|Member|Head|Chief|Deputy|Foreign|Defence|Defense|Armed|Forces|Government)$/;

/** The speaker before the colon: "STC official Amr al-Bidh" → ["al-Bidh", "Amr"]. */
function speakerNames(summary: string): { lead: string; names: string[] } | null {
  const m = /^([^:]{2,70}):\s+/.exec(String(summary || ""));
  if (!m) return null;
  const names = m[1].split(/\s+/).filter((w) => /^(?:al-|Al-)?[A-Z][\w'-]+$/.test(w) && !ROLE_WORDS.test(w));
  return { lead: m[1].toLowerCase(), names };
}

// Iran by name, not "Iranian": on the Iran desk "an Iranian police commander"
// is no counterpart (9 Oct: the Faryab killing went out three times).
const PARTNERS: [RegExp, string][] = [
  [/\bQatar(?:i)?\b/i, "qatar"], [/\b(?:UAE|Emirat(?:i|es))\b/i, "uae"], [/\bOman(?:i)?\b/i, "oman"], [/\bKuwait(?:i)?\b/i, "kuwait"],
  [/\bBahrain(?:i)?\b/i, "bahrain"], [/\bEgypt(?:ian)?\b/i, "egypt"], [/\bJordan(?:ian)?\b/i, "jordan"], [/\b(?:Iran|Tehran)\b/i, "iran"],
  [/\bTurk(?:ey|ish|iye)\b/i, "turkey"], [/\bPakistan(?:i)?\b/i, "pakistan"], [/\b(?:US|U\.S\.|American|Washington|Trump|Rubio)\b/, "us"],
  [/\b(?:Russia|Russian|Putin)\b/i, "russia"], [/\b(?:China|Chinese)\b/i, "china"], [/\b(?:UK|British|Britain)\b/, "uk"],
  [/\b(?:France|French|Macron)\b/i, "france"], [/\b(?:UN|United Nations|Grundberg|Guterres)\b/, "un"], [/\bIraq(?:i)?\b/i, "iraq"],
];

/**
 * Two diplomatic reports with different counterparts: the Crown Prince's call
 * with Qatar's emir was folded into the UAE vice president's visit.
 */
export function otherPartners(home: { summary: string; text?: string }, r: { summary: string }): boolean {
  const h = `${home.summary} ${home.text ?? ""}`;
  return PARTNERS.some(([re]) => re.test(r.summary) && !re.test(h));
}

/**
 * Two statements whose speakers differ ("STC official Amr al-Bidh" and "Yemeni
 * armed forces spokesperson"): never one event, whatever the reader said.
 */
export function differentSpeakers(a: { summary: string }, b: { summary: string }): boolean {
  const x = speakerNames(a.summary);
  const y = speakerNames(b.summary);
  if (!x || !y) return false;
  if (x.names.length && y.names.length) return !y.names.some((n) => x.names.includes(n));
  return x.lead !== y.lead;
}

/**
 * Another outlet's card of words a card on the desk already carries, from the
 * same speaker: South24 English posted one line of the STC official's
 * interview after South24's card held all nine.
 */
export function retellsSpeaker(home: { summary: string; text?: string }, r: { summary: string }): boolean {
  const a = speakerNames(home.summary);
  const b = speakerNames(r.summary);
  if (!a || !b) return false;
  const same = a.names.length && b.names.length ? b.names.some((n) => a.names.includes(n)) : a.lead === b.lead;
  if (!same) return false;
  const have = `${home.summary} ${home.text ?? ""}`.toLowerCase();
  const said = (r.summary.slice(r.summary.indexOf(":") + 1).toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []).filter(
    (w) => !/^(?:that|this|with|from|have|been|will|were|said|says|their|they|them|also|into|over|about|after|would|could|should)$/.test(w),
  );
  if (said.length < 3) return false;
  const found = said.filter((w) => have.includes(w.replace(/(?:es|s|ed|ing)$/, ""))).length;
  return found / said.length >= 0.7;
}

type Filmed =Grounded & { type?: string; media?: { kind?: string; duration?: number } | null };

/**
 * One clip reposted by another account: the same length to the second, of
 * the same kind of event on the same spot. The warplanes' strike south of
 * Marib went out twice, 90 minutes apart, from two accounts carrying one
 * 26-second video.
 */
export function sameFootage(a: Filmed, b: Filmed): boolean {
  const da = a.media?.kind === "video" ? Number(a.media.duration) : NaN;
  const db = b.media?.kind === "video" ? Number(b.media.duration) : NaN;
  return da >= 8 && Math.abs(da - db) <= 1 && a.type === b.type && sameGround(a, b);
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

const COUNTED = /\b(\d{1,4})\s+(?:new\s+|more\s+|Saudi\s+|Houthi\s+|government\s+|coalition\s+)?(air ?strikes?|air ?raids?|raids?|strikes?|drones?|missiles?|sorties|targets|positions|sites|killed|dead|deaths|wounded|injured|ships|vessels|tankers)\b/gi;
const NOT_PLACE = new Set(["houthi", "houthis", "yemeni", "yemen", "saudi", "arabia", "government", "forces", "coalition", "army", "military", "spokesperson", "spokesman", "minister", "ministry", "official", "officials", "says", "report", "reports", "launch", "launched", "conduct", "against", "positions", "sites", "fronts"]);
const countedKeys = (s: string) => {
  const out = new Set<string>();
  for (const m of String(s || "").matchAll(COUNTED)) {
    if (+m[1] < 5) continue;
    out.add(`${+m[1]} ${m[2].toLowerCase().replace(/\s+/g, "").replace(/s$/, "")}`);
  }
  return out;
};
const placeWords = (s: string) => new Set((String(s || "").match(/\b[A-Z][\w'-]{3,}/g) ?? []).map((w) => w.toLowerCase()).filter((w) => !NOT_PLACE.has(w)));

/**
 * One count told by several outlets: "forces launch 27 airstrikes in Taiz"
 * and "27 airstrikes hit Houthi fronts in Taiz". The same figure (5 or more)
 * of the same thing at the same named place is one report, whoever carries
 * it; the first stays and the rest go under its "Also" (user, 2 Oct: the
 * spokesman's 27 airstrikes came out as six cards).
 */
export function sameCountAt(a: { summary: string }, b: { summary: string }): boolean {
  const x = countedKeys(a.summary);
  if (!x.size || ![...countedKeys(b.summary)].some((k) => x.has(k))) return false;
  const p = placeWords(a.summary);
  return [...placeWords(b.summary)].some((w) => p.has(w));
}

export function countedOrNamed(s: string): boolean {
  return numbersIn(s).length > 0 || NAMED_OBJECT.test(String(s || ""));
}

/**
 * A card already on the desk keeps the time it went out with. A site whose
 * pages carry no dates sent its old articles again each scan stamped "now",
 * and they rose to the top of the feed as new. Only ever moves a time back.
 * `first` maps fp → the time it was published. Returns how many were set back.
 */
export function keepFirstTimes(reports: { fp: string; at: string }[], first: Map<string, string>): number {
  let n = 0;
  for (const r of reports) {
    const f = first.get(r.fp);
    if (f && Date.parse(f) < Date.parse(r.at)) {
      r.at = f;
      n += 1;
    }
  }
  return n;
}

/* ------------------------------------------------------------------ *
 * One event abroad, told by many outlets in different words
 * ------------------------------------------------------------------ */

/** Words that tell nothing about which event it is: sides, roles, bodies, places at large. */
const ABROAD_STOP = new Set(
  (
    "coalition government forces force army armed militia minister ministry spokesman spokesperson council presidential " +
    "prime kingdom arab gulf red sea iran iranian united nations popular resistance southern brigade brigades axis command " +
    "commander major general colonel media news agency channel local residents military security national attack attacks " +
    "targeted targeting target terrorist drone drones strike strikes hit says said"
  ).split(" "),
);
function abroadWords(s: string): Set<string> {
  return new Set([...storyWords(s)].filter((w) => !ABROAD_STOP.has(w)));
}
/** Someone else's word on the event (a condemnation, a welcome) is its own card. */
const REACTION = /\b(?:condemn|denounc|deplor|welcom|prais|express(?:es|ed)? solidarity|stands? with)\w*/i;

/** How long after the first account another outlet's different words still tell the same event abroad. */
export const ABROAD_WINDOW_MS = 75 * 60_000;

/**
 * One event in Saudi Arabia told by several outlets in their own words, within
 * the hour: the coalition spokesman on the drone that hit Taibah electricity
 * station in Medina went out as eight cards in five minutes (the attack, the
 * transformer, the investigation, the Prophet's Mosque), none with a pin, so
 * no spot or headline test joined them. Both must name the same Saudi city or
 * site, share most of their words, and name no Yemeni place the other does
 * not (a card on a general killed in Taiz that also mentions Medina is no
 * home for the Medina accounts). A reaction from someone else stays its own
 * card, and figures that disagree mean two events. The Yemeni fronts are left
 * to the spot tests: there, one district's clashes an hour apart are two events.
 * Sirens are left to the alert test.
 */
export function sameEventAbroad(a: { summary: string; text?: string }, b: { summary: string; text?: string }, yemeniPlaces: (s: string) => string[]): boolean {
  const ta = `${a.summary} ${a.text ?? ""}`;
  const tb = `${b.summary} ${b.text ?? ""}`;
  const ca = SAUDI_CITIES.filter(([re]) => re.test(ta)).map(([, c]) => c);
  const cb = SAUDI_CITIES.filter(([re]) => re.test(tb)).map(([, c]) => c);
  const site = /\b(?:Taibah|Prophet's Mosque|Grand Mosque|Two Holy Mosques|Ras Tanura|Abqaiq|Aramco)\b/i;
  const sa = site.exec(ta)?.[0].toLowerCase();
  const sb = site.exec(tb)?.[0].toLowerCase();
  if (!ca.some((c) => cb.includes(c)) && !(sa && sa === sb)) return false;
  // Sirens have their own test (alertCities): two bursts minutes apart are two alerts.
  if (alertCities(a) || alertCities(b)) return false;
  if (REACTION.test(a.summary) !== REACTION.test(b.summary)) return false;
  const ya = yemeniPlaces(a.summary);
  const yb = yemeniPlaces(b.summary);
  if (ya.some((p) => !yb.includes(p)) || yb.some((p) => !ya.includes(p))) return false;
  if (numbersClash(ta, tb)) return false;
  const x = abroadWords(a.summary);
  const y = abroadWords(b.summary);
  if (x.size < 2 || y.size < 2) return false;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return both / Math.min(x.size, y.size) >= 0.5;
}

/**
 * One channel's own posts on one event abroad (user, 3 Oct 09:55 and 10:00):
 * Ali Bk's "smoke rises near the targeted oil site in Riyadh" and, five
 * minutes later, "footage shows smoke rising near the targeted oil site" are
 * one event with nothing new. A channel's own posts stay apart otherwise (its
 * sirens at 09:00 and at 13:00 are two alerts), so only a later post that is
 * the aftermath — smoke, fire, footage — and tells no new strike folds.
 */
export const OWN_AFTERMATH_MS = 2 * 3600_000;
const AFTERMATH = /\b(?:smoke|fires?|burn\w*|blaze|flames|footage|scenes|video|images|aftermath)\b/i;
const NEW_STRIKE = /\b(?:new|another|second|third|fresh|renewed|again)\b[^.]{0,30}\b(?:attacks?|strikes?|explosions?|blasts?|hits?|drones?|missiles?)\b|\bre-?target\w*/i;
export function ownAftermath(a: { summary: string; text?: string }, b: { summary: string; text?: string }, yemeniPlaces: (s: string) => string[]): boolean {
  return AFTERMATH.test(b.summary) && !NEW_STRIKE.test(b.summary) && sameEventAbroad(a, b, yemeniPlaces);
}

/**
 * A wave of strikes on one city is one event (user, 3 Oct: "the reports about
 * Saudi attacks in Sanaa are basically same event so no need a hundred
 * reports"). Between 13:00 and 14:00 Sabereen, SNN, South24, Aden al-Ghad and
 * Al Hadath each had a card on the same Saudi strikes on Sanaa. Strikes by
 * the same side on the same city within two hours join one card, and the card
 * is written again with each new target; casualty figures that disagree keep
 * two cards.
 */
export const WAVE_WINDOW_MS = 2 * 3600_000;
const WAVE_CITY = /\b(Sanaa|Hodeidah|Saada|Aden|Marib|Taiz|Hajjah|Amran|Dhamar|Ibb|Al-Jawf|Mukalla|Lahj|Al-Bayda|Shabwa|Abyan)\b/;
/** Who struck, as the headline says it: the Houthis named as the target are not the striker. */
function striker(s: string): string {
  if (/\b(?:Saudi|coalition)\b/i.test(s)) return "saudi";
  if (/\b(?:US|U\.S\.|American)\b/.test(s)) return "us";
  if (/\bgovernment\b|\bYemeni (?:warplanes|aircraft|air force|army)\b/i.test(s)) return "gov";
  if (/^Houthi\b/.test(s)) return "houthi";
  return "";
}
export function sameWave(a: { type: string; summary: string; text?: string }, b: { type: string; summary: string; text?: string }): boolean {
  if (a.type !== "strike" || b.type !== "strike") return false;
  const ca = WAVE_CITY.exec(a.summary)?.[1];
  if (!ca || ca !== WAVE_CITY.exec(b.summary)?.[1]) return false;
  const sa = striker(a.summary);
  if (!sa || sa !== striker(b.summary)) return false;
  return !numbersClash(`${a.summary} ${a.text ?? ""}`, `${b.summary} ${b.text ?? ""}`);
}

/**
 * One named event told again and again through the day (3-4 Oct review): the
 * government's repulse of the night attack on Jabal Han went out six times
 * between 10:35 and 16:35, the capture of Al-Hisn in Jabal Sameh nine times,
 * the Houthi missile on Badr camp in Aden four times in an hour. The same side
 * doing the same thing at the same named spot within six hours is one event,
 * whoever tells it; a "new" or "renewed" strike is not, nor are figures that
 * disagree.
 */
export const SAME_TARGET_MS = 6 * 3600_000;
const SPOT_HEAD = "camp|airport|hospital|base|refinery|station|port|palace|compound|mosque|school|factory|market|prison|junction|bridge|field|pipeline|complex|terminal";
/** Words that name no one spot: sides, cities, governorates, and the heads themselves. */
const NOT_A_SPOT = new Set(
  (
    "houthi houthis saudi yemeni yemen government forces coalition army military national popular resistance giants brigades nation shield southern " +
    "mount jabal wadi habashi sabr ras international square maternity maternal child children district front fronts city area areas governorate province countryside entrance eastern western northern southern central old " +
    "sanaa hodeidah saada aden marib taiz hajjah amran dhamar jawf mukalla lahj bayda shabwa abyan riyadh jeddah yanbu jizan jazan najran abha khamis mushait dammam medina mecca taif arabia " +
    SPOT_HEAD.replace(/\|/g, " ")
  ).split(" "),
);
/** The named spots a headline gives: "Jabal Han", "Badr camp" → "s:han", "s:badr"; a plain "Al-" name → "n:…". */
export function namedSpots(s: string, sitesOnly = false): Set<string> {
  const out = new Set<string>();
  const t = String(s || "");
  for (const m of t.matchAll(/\b(?:Jabal|Mount|Wadi)\s+(?:Al-|al-)?([A-Z][\w'’-]+)/g)) {
    const k = m[1].toLowerCase();
    if (!NOT_A_SPOT.has(k)) out.add(`s:${k}`);
  }
  for (const m of t.matchAll(new RegExp(`\\b((?:(?:Al-|al-)?[A-Z][\\w'’-]+\\s+){1,4})(?:${SPOT_HEAD})\\b`, "g"))) {
    for (const w of m[1].trim().split(/\s+/)) {
      const k = w.replace(/^al-/i, "").toLowerCase();
      if (k.length >= 3 && !NOT_A_SPOT.has(k)) out.add(`s:${k}`);
    }
  }
  // A Yemeni city's own site: "Aden International Airport" was no spot (both
  // words are cities' or generic), and the missiles on it went out as some
  // twenty cards on 7 Oct.
  for (const m of t.matchAll(/\b(Aden|Sanaa|Sana'a|Hodeidah|Mukalla|Marib|Taiz|Mocha|Mokha|Seiyun|Ataq|Saada)\s+(?:International\s+)?(airport|port|palace|refinery)\b/gi)) {
    out.add(`s:${m[1].toLowerCase().replace(/'/g, "")}-${m[2].toLowerCase()}`);
  }
  // Of the plain "Al-" names only the first, the object: "seize Al-Safiyah in
  // Al-Shamaytayn" and "seize Al-Burkani in Al-Shamaytayn" are two villages.
  const first = sitesOnly ? null : /\bAl-([A-Z][\w'’-]{2,})/.exec(t.replace(/\b(?:Jabal|Mount|Wadi)\s+Al-/g, ""));
  if (first && !NOT_A_SPOT.has(first[1].toLowerCase())) out.add(`n:${first[1].toLowerCase()}`);
  return out;
}
const ACTIONS: [RegExp, string][] = [
  [/\b(?:repel\w*|repuls\w*|thwart\w*|foil\w*|withstand\w*|broke|break\w*)\b/i, "repel"],
  [/\b(?:captur\w*|seiz\w*|liberat\w*|recaptur\w*|retak\w*|take control|took control|control)\b/i, "capture"],
  [/\b(?:intercept\w*|shoot down|shot down|shoots down)\b/i, "intercept"],
  [/\b(?:strikes?|struck|hit|hits|target\w*|raids?|bomb\w*|shell\w*|launch\w*|fire[sd]?)\b/i, "strike"],
];
function actionOf(s: string): string {
  for (const [re, a] of ACTIONS) if (re.test(s)) return a;
  return "";
}
/** Who acts, as the headline opens: the side named first, or the striker. */
function actorOf(s: string): string {
  const t = String(s || "").replace(/^[^:]{2,60}:\s*/, "");
  if (/^(?:Yemeni )?government|^Yemeni (?:government|military|army)|^(?:Giants|Nation's Shield|National Resistance|Popular Resistance|Southern) /i.test(t)) return "gov";
  if (/^Houthi/i.test(t)) return "houthi";
  return striker(t);
}
/**
 * The town a capture names first, city or not: "capture Mocha city", "seize
 * Mocha, Dhubab and Al-Khokha" → "s:mocha". Mocha's fall went out as ten
 * cards on 5 Oct; a town is no spot for a strike, but taking it is one event.
 */
const TAKE_OBJECT = /\b(?:captur|seiz|liberat|recaptur|retak)\w*\s+(?:the\s+)?(?:city of\s+)?(?:Al-|al-)?([A-Z][\w'’-]{2,})/g;
function takenTown(s: string, act: string): string[] {
  if (act !== "capture") return [];
  const m = TAKE_OBJECT.exec(String(s || ""));
  TAKE_OBJECT.lastIndex = 0;
  return m && !/^(?:Houthi|Saudi|Yemeni|Government|Strategic|Key|Several|New|Positions?|Sites?|Areas?)$/i.test(m[1]) ? [`s:${m[1].toLowerCase()}`] : [];
}
/** A plain "Al-" name is often a whole district: it holds for three hours, a named site or hill for six. */
const NAME_ONLY_MS = 3 * 3600_000;
export function sameTarget(a: { type: string; summary: string; text?: string; at?: string }, b: { type: string; summary: string; text?: string; at?: string }): boolean {
  if (alertCities(a) || alertCities(b)) return false;
  if (NEW_STRIKE.test(b.summary)) return false;
  const act = actionOf(a.summary);
  if (!act || act !== actionOf(b.summary)) return false;
  // A strike needs a site: two strikes on one district hours apart are two.
  const sitesOnly = act === "strike";
  const sa = new Set([...namedSpots(a.summary, sitesOnly), ...takenTown(a.summary, act)]);
  const shared = [...namedSpots(b.summary, sitesOnly), ...takenTown(b.summary, act)].filter((k) => sa.has(k));
  if (!shared.length) return false;
  const gap = a.at && b.at ? Math.abs(Date.parse(a.at) - Date.parse(b.at)) : 0;
  if (!shared.some((k) => k.startsWith("s:")) && gap > NAME_ONLY_MS) return false;
  const who = actorOf(a.summary);
  if (!who || who !== actorOf(b.summary)) return false;
  return !numbersClash(`${a.summary} ${a.text ?? ""}`, `${b.summary} ${b.text ?? ""}`);
}

/**
 * One attack on a Yemeni city's site told as it unfolded: the explosion, the
 * missiles, the smoke, the shelling of "a militia site at the airport" (7
 * Oct, Aden airport: some twenty cards in four hours, the sides often
 * written wrong, so the actor cannot be the test). Field reports on the same
 * city site within three hours, neither a new strike, are one event.
 */
export const SITE_ATTACK_MS = 3 * 3600_000;
const ATTACK_WORDS = /\b(?:strikes?|struck|hit|hits|target\w*|missiles?|drones?|explosions?|smoke|shell\w*|attack\w*|bomb\w*)\b/i;
export function sameSiteAttack(a: { type: string; summary: string; text?: string }, b: { type: string; summary: string; text?: string }): boolean {
  const field = (t: string) => t === "strike" || t === "combat";
  if (!field(a.type) || !field(b.type)) return false;
  if (NEW_STRIKE.test(b.summary) || !ATTACK_WORDS.test(a.summary) || !ATTACK_WORDS.test(b.summary)) return false;
  const site = (s: string) => [...namedSpots(s, true)].filter((k) => /^s:[a-z]+-[a-z]+$/.test(k));
  const sa = new Set(site(a.summary));
  if (!site(b.summary).some((k) => sa.has(k))) return false;
  return !numbersClash(`${a.summary} ${a.text ?? ""}`, `${b.summary} ${b.text ?? ""}`);
}

/**
 * Speakers whose speeches and statements their own outlets carry line by
 * line: another outlet's line is a copy of theirs (user, 21 Sep: "speech
 * lines come only from the speaker's official outlet"). On 4 Oct the
 * president's speech went out as some 45 cards and the coalition's evening
 * statement as 15, from Al Arabiya, Al Hadath, Al Jazeera, Saudi News...
 */
export const SPEECH_COPY_MS = 4 * 3600_000;
/**
 * `own`: the outlet is the speaker's own account, so every statement on it is
 * his, headline prefix or not (5 Oct: the government forces' spokesman's lines
 * from Al Arabiya, Asharq, Al Hadath and Yemen Shabab TV beside his own
 * channel's; Abdulsalam's from Al-Masirah beside his X account).
 */
const SPEECH_OWNERS: { key: string; who: RegExp; outlets: RegExp; own?: RegExp }[] = [
  { key: "alimi", who: /^(?:Yemen(?:'s|i)? president|Yemeni president|(?:Rashad )?al-Alimi|Presidential (?:Leadership )?Council (?:head|chairman))\b/i, outlets: /^(?:Saba \(government\)|Yemen TV)$/ },
  { key: "maliki", who: /^(?:The coalition|(?:Saudi-led )?coalition(?: spokes(?:man|person))?|Turki al-Maliki)\b(?=[^:]{0,40}(?::|\b(?:says|vows|announces|warns|affirms|stresses)\b))/i, outlets: /^(?:SPA|Coalition spokesman|Coalition \(SPA\))$/, own: /^(?:Coalition spokesman|Coalition \(SPA\))$/ },
  { key: "mashat", who: /^(?:The )?(?:Houthi (?:supreme )?political council (?:head|chairman|president)|(?:Mahdi )?al-Mashat)\b/i, outlets: /^(?:Saba \(Houthi-run\)|Al-Masirah)$/ },
  { key: "houthi leader", who: /^(?:The )?Houthi leader\b|^Abdul-?Malik al-Houthi\b/i, outlets: /^Al-Masirah$/ },
  { key: "gov spokesman", who: /^(?:Yemeni (?:government )?(?:forces|army|armed forces|military) spokes(?:man|person)|Yemeni Army spokes(?:man|person)|(?:Brig(?:adier)?\.? (?:Gen(?:eral)?\.? )?)?Abdu(?:h)? Majli)\b/i, outlets: /^(?:Yemeni Army spokesman|Yemeni Army Media)$/, own: /^(?:Yemeni Army spokesman|Yemeni Army Media)$/ },
  { key: "abdulsalam", who: /^(?:Houthi (?:chief negotiator|spokes(?:man|person))|Ansar Allah spokes(?:man|person)|Mohammed Abdulsalam)\b/i, outlets: /^Mohammed Abdulsalam$/, own: /^Mohammed Abdulsalam$/ },
];
export function speechOwner(summary: string): { key: string; outlets: RegExp; own?: RegExp } | null {
  const s = String(summary || "").replace(/^Yemen (?=Yemen)/, "");
  return SPEECH_OWNERS.find((o) => o.who.test(s)) ?? null;
}
/** Is this card the speaker's own, from his outlet? */
export function speechFrom(o: { source: string; summary: string }, who: { key: string; outlets: RegExp; own?: RegExp }): boolean {
  if (!who.outlets.test(o.source)) return false;
  return !!who.own?.test(o.source) || speechOwner(o.summary)?.key === who.key;
}

const GENERIC_BODY = new Set(["foreign", "ministry", "ministers", "minister", "office", "affairs", "government", "defence", "defense", "interior", "state", "department", "official", "the", "and", "for", "news", "agency", "embassy", "mission", "council", "expatriates", "kingdom", "republic"]);
/**
 * The body a source is, speaking in the headline: "Pakistan Foreign Ministry" is
 * the speaker of "Pakistan's Ministry of Foreign Affairs condemns…". Its own
 * name (not "foreign", "ministry") opens the headline, within its first three words.
 */
export function speakerIs(source: string, headline: string): boolean {
  const own = String(source || "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3 && !GENERIC_BODY.has(w));
  if (!own.length) return false;
  const lead = String(headline || "").toLowerCase().split(/[^a-z]+/).filter(Boolean).slice(0, 3);
  return own.every((w) => lead.some((x) => x.startsWith(w.slice(0, Math.max(4, w.length - 1)))));
}

/**
 * One strike abroad told by many outlets (9 Oct review): the drones on the
 * Iranian Kurdish camps in Erbil went out as some fifteen cards between 22:29
 * and 02:07, from Akhbar-e Fori, Khabari Plus, Al Hadath, Press TV, IRNA,
 * Tasnim, Al Arabiya, Asharq Al-Awsat… Field reports on the same city of the
 * Iran war's theatre within four hours are one event, unless one is a "new"
 * strike, the strikers named differ, or the figures disagree. Yemen's own
 * cities keep their own, stricter rules (sameWave, sameTarget).
 */
export const STRIKE_ABROAD_MS = 4 * 3600_000;
const ABROAD_CITY =
  /\b(Erbil|Sulaymaniyah|Kirkuk|Baghdad|Basra|Tehran|Isfahan|Shiraz|Tabriz|Mashhad|Bandar Abbas|Bushehr|Kharg|Ahvaz|Kermanshah|Karaj|Qom|Natanz|Fordow|Arak|Zahedan|Chabahar|Faryab|Haifa|Tel Aviv|Beersheba|Eilat|Dimona|Doha|Manama|Kuwait City|Dubai|Abu Dhabi|Fujairah|Muscat|Beirut|Dahiyeh)\b/;
function strikerAbroad(s: string): string {
  const t = String(s || "").replace(/^[^:]{2,60}:\s*/, "");
  if (/^(?:the )?(?:Iranian|Iran's|IRGC)\b/.test(t) || /\bIranian (?:drones?|missiles?|strikes?)\b/.test(t)) return "iran";
  if (/^(?:the )?Israeli\b|\bIsraeli (?:air)?strikes?\b|\bIDF\b/.test(t)) return "israel";
  if (/^(?:the )?(?:US|U\.S\.|American)\b|\bUS (?:air)?strikes?\b/.test(t)) return "us";
  return "";
}
export function sameStrikeAbroad(a: { type: string; summary: string; text?: string }, b: { type: string; summary: string; text?: string }): boolean {
  const field = (t: string) => t === "strike" || t === "combat";
  if (!field(a.type) || !field(b.type)) return false;
  if (alertCities(a) || alertCities(b) || NEW_STRIKE.test(b.summary)) return false;
  const ca = ABROAD_CITY.exec(a.summary)?.[1];
  if (!ca || ca !== ABROAD_CITY.exec(b.summary)?.[1]) return false;
  const sa = strikerAbroad(a.summary);
  const sb = strikerAbroad(b.summary);
  if (sa && sb && sa !== sb) return false;
  return !numbersClash(`${a.summary} ${a.text ?? ""}`, `${b.summary} ${b.text ?? ""}`);
}

/** Who tells, not what: two statements by one spokesperson share these whatever they say. */
const ROLE_STOP = /^(?:government|spokesperson|spokesman|minister|ministry|official|forces|force|army|military|armed|council|leader|commander|navigation|security|media|office|agency|group|organi[sz]ation|report|warn|urge|announce|call|declare|confirm|deny)$/;
function eventWords(s: string): Set<string> {
  return new Set([...storyWords(s)].filter((w) => !ROLE_STOP.test(w)));
}
/** The places a headline puts its event at: "in Faryab", "near Hays", "of Kahbub". */
function headPlaces(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of String(s || "").matchAll(/\b(?:in|near|at|on|over|off|of|outside)\s+(?:the\s+)?((?:Al-|al-)?[A-Z][\w'’-]+)/g)) {
    const k = m[1].toLowerCase().replace(/^al-/, "");
    if (!STORY_STOP.has(k) && !/^(?:yemen|iran|saudi|houthi|israel|us|the)$/.test(k)) out.add(k);
  }
  return out;
}
/** Each names a place the other does not: two events ("near Hays" and "in Jabal Ras"). */
function placesApart(a: string, b: string): boolean {
  const pa = headPlaces(a);
  const pb = headPlaces(b);
  return [...pa].some((p) => !pb.has(p)) || [...pb].some((p) => !pa.has(p));
}

/** How much of the shorter headline's story words the other carries. */
function headOverlap(a: string, b: string): { share: number; size: number } {
  const x = eventWords(a);
  const y = eventWords(b);
  const size = Math.min(x.size, y.size);
  if (!size) return { share: 0, size };
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return { share: both / size, size };
}

/**
 * One outlet telling its own story again (9 Oct): Iran International's PMF
 * drones unit at 09:05 and 10:21 (it posts from three accounts), The
 * National's UAE food retailers at 06:30 and 08:13, Bloomberg's "no strike
 * before the midterms" at 23:57 and 05:00. Statements, diplomacy and economy
 * within twelve hours whose headlines share most words; a field report only
 * within half an hour (a channel's two strikes on one district hours apart
 * are two strikes), and never an alert.
 */
export const OWN_RETELL_MS = 12 * 3600_000;
export const OWN_RETELL_FIELD_MS = 30 * 60_000;
export function ownRetelling(a: { type: string; summary: string; at?: string }, b: { type: string; summary: string; at?: string }): boolean {
  if (alertCities(a) || alertCities(b) || NEW_STRIKE.test(b.summary)) return false;
  const gap = a.at && b.at ? Math.abs(Date.parse(a.at) - Date.parse(b.at)) : 0;
  const talky = (t: string) => t === "statement" || t === "diplomacy" || t === "economy";
  const field = !talky(a.type) || !talky(b.type);
  if (gap > (field ? OWN_RETELL_FIELD_MS : OWN_RETELL_MS)) return false;
  if (numbersClash(a.summary, b.summary) || differentSpeakers(a, b) || placesApart(a.summary, b.summary)) return false;
  if (REACTION.test(a.summary) !== REACTION.test(b.summary)) return false;
  // A later post with a new figure brings something new: "356 operations"
  // then "356 operations neutralise 476 fighters" are two posts.
  const figs = (t: string) => (t.replace(/\b\d+\s*(?:hours?|hrs?|days?|weeks?)\b/gi, " ").match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/,/g, ""));
  const had = new Set(figs(a.summary));
  if (figs(b.summary).some((n) => !had.has(n))) return false;
  const { share, size } = headOverlap(a.summary, b.summary);
  // Half the words hold for a statement when there are enough of them.
  return (size >= 3 && share >= 0.6) || (!field && size >= 5 && share >= 0.5);
}

/**
 * One event that two readers typed apart (9 Oct): the Faryab police
 * commander's killing as MEK's "combat" and Al-Alam's "statement"; the
 * Hormuz mine blasts from Al-Alam and Khabari Plus a minute apart. Headlines
 * sharing nearly all their words and a name, within ninety minutes.
 */
export const ONE_EVENT_MS = 90 * 60_000;
export function oneEventTwoTypes(a: { type?: string; summary: string }, b: { type?: string; summary: string }): boolean {
  // The market's move on a statement is its own story ("oil eases after Trump rules out a strike").
  if ((a.type === "economy") !== (b.type === "economy")) return false;
  if (alertCities(a) || alertCities(b) || NEW_STRIKE.test(b.summary)) return false;
  if (numbersClash(a.summary, b.summary) || differentSpeakers(a, b) || placesApart(a.summary, b.summary)) return false;
  // A reaction is not the event it reacts to: Algeria's condemnation of the Abha attack.
  if (REACTION.test(a.summary) !== REACTION.test(b.summary)) return false;
  const { share, size } = headOverlap(a.summary, b.summary);
  if (size < 4 || share < 0.6) return false;
  const na = storyNames(a.summary);
  return [...storyNames(b.summary)].some((n) => na.has(n));
}

/**
 * One claim told twice with its rare figure (9 Oct): the government forces'
 * "1,729 precision strikes" went out from Sheba Intelligence at 00:36 and
 * Yemen Future at 03:20. A figure of a hundred or more, the same in both
 * headlines, with two more story words shared, within twelve hours: one story.
 * Years and clock times are not figures.
 */
export const RARE_FIGURE_MS = 12 * 3600_000;
function rareFigures(s: string): Set<string> {
  const out = new Set<string>();
  const t = String(s || "").replace(/\b\d{1,2}:\d{2}\b/g, " ");
  for (const m of t.matchAll(/\b\d{1,3}(?:,\d{3})+\b|\b\d{3,}\b/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (n >= 100 && !(n >= 1990 && n <= 2035)) out.add(String(n));
  }
  return out;
}
export function sameRareFigure(a: { summary: string }, b: { summary: string }): boolean {
  if (alertCities(a) || alertCities(b)) return false;
  const fa = rareFigures(a.summary);
  if (![...rareFigures(b.summary)].some((n) => fa.has(n))) return false;
  if (numbersClash(a.summary, b.summary) || differentSpeakers(a, b)) return false;
  const x = eventWords(a.summary);
  let shared = 0;
  for (const w of eventWords(b.summary)) if (x.has(w)) shared += 1;
  return shared >= 2;
}
