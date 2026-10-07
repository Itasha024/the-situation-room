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

const ROLE_WORDS = /^(?:STC|Houthi|Houthis|Saudi|Yemen|Yemen's|Yemeni|UN|US|UAE|Iran|Iranian|Official|Minister|Spokesman|Spokesperson|Leader|President|Council|Presidential|Member|Head|Chief|Deputy|Foreign|Defence|Defense|Armed|Forces|Government)$/;

/** The speaker before the colon: "STC official Amr al-Bidh" → ["al-Bidh", "Amr"]. */
function speakerNames(summary: string): { lead: string; names: string[] } | null {
  const m = /^([^:]{2,70}):\s+/.exec(String(summary || ""));
  if (!m) return null;
  const names = m[1].split(/\s+/).filter((w) => /^(?:al-|Al-)?[A-Z][\w'-]+$/.test(w) && !ROLE_WORDS.test(w));
  return { lead: m[1].toLowerCase(), names };
}

const PARTNERS: [RegExp, string][] = [
  [/\bQatar(?:i)?\b/i, "qatar"], [/\b(?:UAE|Emirat(?:i|es))\b/i, "uae"], [/\bOman(?:i)?\b/i, "oman"], [/\bKuwait(?:i)?\b/i, "kuwait"],
  [/\bBahrain(?:i)?\b/i, "bahrain"], [/\bEgypt(?:ian)?\b/i, "egypt"], [/\bJordan(?:ian)?\b/i, "jordan"], [/\bIran(?:ian)?\b/i, "iran"],
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
