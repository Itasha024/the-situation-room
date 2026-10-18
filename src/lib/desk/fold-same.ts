/**
 * One event, one card (18 Oct review: about 150 surplus cards in the Iran
 * desk's latest 400 and 95 in Yemen's). Five rules, each a plain test on two
 * cards, used twice: as a new card is written (foldIntoPublished) and as the
 * desk is read (foldServed), so the copies already stored fold too. Stored
 * rows are never changed by the read.
 *
 * - One official's remarks on one occasion are one card: the speaker's own
 *   channel leads, every other outlet's line goes into it (Araghchi at the OIC
 *   went out as 14 cards, Khatibzadeh's interview as 14, the army spokesman as
 *   11). Another occasion the same day is another card (user, 18 Oct).
 * - One ship incident is one card for 24 hours: the same named ship, or the
 *   same kind of ship in the same stretch of sea ("second supertanker hit a
 *   mine": 16 cards; the LNG tanker off Al-Mukalla: 10).
 * - One district's dead, the same count give or take one, within 12 hours, is
 *   one card even when the sides blame each other: one contested card
 *   (Maqbanah's 8 or 9 dead: 14 cards between the two accounts).
 * - One blast at a site abroad within 12 hours is one card (the PMF depot east
 *   of Baghdad: 11 cards).
 * - One article on a mirror host is the same article (ns1.khabaragency.net and
 *   en.khabaragency1.net), and one channel's same headline is one card.
 */
import { PLACE_BY_NAME, placesIn } from "./gazetteer.ts";
import { speechOwner, wordsInCommon } from "./copies.ts";

export type Card = {
  fp: string;
  at: string;
  source: string;
  url: string;
  type?: string | null;
  summary: string;
  text?: string | null;
  place?: string | null;
  flags?: string[];
  tags?: string[];
  alsoReportedBy?: { source: string; url: string; summary?: string }[];
  [k: string]: unknown;
};

const H = 3600_000;
export const SHIP_MS = 24 * H;
export const DEAD_MS = 12 * H;
export const BLAST_MS = 12 * H;
export const BURST_MS = 10 * 60_000;
export const OWN_HEAD_MS = 24 * H;

/* ------------------------------------------------------------------ *
 * Remarks: who is speaking
 * ------------------------------------------------------------------ */

const TALK = new Set(["statement", "diplomacy"]);
const SAYS = /^(.{2,70}?)\s+(?:says?|said|states?|stated|stresses|stressed|warns?|warned|affirms?|urges?|calls|insists?|rejects?|reiterates?|vows?|declares?|denies|confirms?|adds|notes|emphasi[sz]es|asserts?|tells|told|accuses|claims?|insists|hopes|threatens|describes|believes|condemns|welcomes|demands|sends|addresses|issues)\b/i;

/**
 * Speakers by what the headline calls them: a name or the post. `own` is the
 * speaker's own account, which leads the card when it has the remarks.
 */
const SPEAKERS: { key: string; who: RegExp; own?: RegExp }[] = [
  { key: "araghchi", who: /\b(?:Araghchi|Arakchi)\b/i, own: /Araghchi/i },
  { key: "khatibzadeh", who: /\bKhatibzadeh\b|\bIran(?:ian|'s)? deputy foreign minister\b/i, own: /Khatibzadeh/i },
  { key: "pezeshkian", who: /\bPezeshkian\b|\bIran(?:ian|'s)? president\b/i, own: /Pezeshkian|^Iran(?:ian)? President/i },
  { key: "qalibaf", who: /\b(?:Qalibaf|Ghalibaf)\b|\bIran(?:ian|'s)? parliament speaker\b/i, own: /Qalibaf|Ghalibaf/i },
  { key: "larijani", who: /\bLarijani\b/i, own: /Larijani/i },
  { key: "khamenei", who: /\bKhamenei\b|\bIran(?:ian|'s)? (?:supreme )?leader\b/i, own: /Khamenei/i },
  { key: "mohajerani", who: /\bMohajerani\b|\bIran(?:ian|'s)? government spokes(?:woman|person)\b/i, own: /Mohajerani/i },
  { key: "ebnelreza", who: /\bEbn[eo]l-?reza\b|\b(?:Iran(?:ian|'s)? )?acting defen[cs]e minister\b/i },
  { key: "iran army", who: /^(?:the )?(?:Iran(?:ian|'s)? )?army(?: spokes(?:man|person))?$|\bIran(?:ian|'s)? army spokes(?:man|person)\b|\bShekarchi\b|\bAkraminia\b/i },
  { key: "irgc spokesman", who: /\bIRGC spokes(?:man|person)\b|\bNaeini\b/i },
  // The foreign ministry's spokesman is the ministry speaking.
  { key: "iran foreign ministry", who: /\b(?:Baghaei|Baqaei)\b|\bIran(?:ian|'s)? (?:foreign ministry|ministry of foreign affairs)(?: spokes(?:man|person))?\b/i, own: /^Iran(?:ian)? (?:Foreign Ministry|MFA)|Baghaei/i },
  { key: "imo", who: /^(?:the )?IMO(?: chief| head| secretary[- ]general)?$|\bDom[ií]nguez\b/i, own: /^IMO$/ },
  { key: "iaea", who: /^(?:the )?IAEA(?: chief| head| director[- ]general)?$|\bGrossi\b/i, own: /^IAEA$|Grossi/i },
  { key: "grundberg", who: /\bGrundberg\b|\bUN (?:special )?envoy (?:for|to) Yemen\b/i, own: /Grundberg|Envoy/i },
  { key: "houthi parliament speaker", who: /\b(?:Houthi |Sanaa )?parliament speaker\b|\bspeaker of (?:the )?(?:Houthi |Sanaa )?parliament\b|\bYahya al-Ra['’]?i\b/i },
  { key: "arab league", who: /^(?:the )?Arab League(?: (?:chief|secretary[- ]general|council))?$|\bAboul Gheit\b/i },
  { key: "gcc", who: /^(?:the )?(?:GCC|Gulf Cooperation Council)(?: (?:chief|secretary[- ]general))?$|\bAlbudaiwi\b/i },
  { key: "oic", who: /^(?:the )?(?:OIC|Organi[sz]ation of Islamic Cooperation)(?: (?:chief|secretary[- ]general))?$/i },
];
/** Talk only, unless a spokesman speaks: his count of the day's operations is typed combat as often as statement. */
const SPOKES = /\bspokes(?:man|person|woman)\b/i;

/** A ministry speaking: "Houthi foreign ministry", "Yemen's Ministry of Health", "Saudi Defence Ministry". */
const MINISTRY = /\b(Iran(?:ian|'s)?|Houthi(?:-run)?|Yemeni government|Yemen(?:i|'s)?|Saudi|Iraq(?:i|'s)?)\s+(?:\w+\s+)?(?:(foreign|defen[cs]e|interior|health|oil|information|human rights|transport|finance|economy|intelligence)\s+ministry|ministry of (foreign affairs|defen[cs]e|interior|health|oil|information|human rights|transport|finance|intelligence))\b/i;

/** The words before the colon, or before "says": who is speaking in the headline. */
export function speakerPhrase(summary: string): string {
  const s = String(summary || "").replace(/^(?:Iran|Yemen|Iraq|Breaking|Urgent)\s*:\s*/i, "");
  const colon = /^([^:]{2,70}):\s/.exec(s);
  if (colon) return colon[1].trim();
  return SAYS.exec(s)?.[1].trim() ?? "";
}

/** Whose remarks a talk card carries, by a known speaker or ministry, or "" for none. */
export function remarksOwner(r: { summary: string; type?: string | null }): string {
  const who = speakerPhrase(r.summary);
  if (!who) return "";
  const owner = speechOwner(r.summary)?.key ?? "";
  if (r.type && !TALK.has(r.type) && !SPOKES.test(who) && !owner) return "";
  for (const s of SPEAKERS) if (s.who.test(who)) return s.key;
  const m = MINISTRY.exec(who);
  if (m) {
    const w = m[1].toLowerCase();
    const side = w.startsWith("iran") ? "iran" : w.startsWith("houthi") ? "houthi" : w.startsWith("yemen") ? "yemeni government" : w.startsWith("iraq") ? "iraq" : w;
    const body = (m[2] || m[3]).toLowerCase().replace(/ affairs$/, "").replace(/defense/, "defence");
    return `${side} ${body} ministry`;
  }
  return owner;
}

/** The speaker's own account: it leads the card of their remarks. */
export function ownChannelOf(key: string, source: string): boolean {
  const s = SPEAKERS.find((x) => x.key === key);
  return !!s?.own?.test(String(source || ""));
}

/** The calendar day in Jerusalem, where the desk's day runs. */
export function deskDay(at: string): string {
  const t = Date.parse(at);
  return Number.isFinite(t) ? new Date(t + 3 * H).toISOString().slice(0, 10) : "";
}

/**
 * One speaking occasion lasts a few hours: a speech, an interview, a press
 * conference, a call. An official speaks more than once a day, on other things
 * (user, 18 Oct: "why should it be one card"), so a day is not one occasion.
 */
export const REMARKS_MS = 3 * H;
/** Later relays of the same words share their topic: three words of the line in common. */
const SAME_TOPIC = 3;

const OCCASION = [
  // A call or a meeting: with whom.
  /\b(?:(?:phone|telephone) (?:call|conversation)|call|talks|meeting|met|meets|received|receives|hosted|hosts)\s+(?:with\s+)?(?:his|her|their)?\s*(?:[a-z]+\s+){0,3}?([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,3})/g,
  // A venue: "at the OIC", "on the sidelines of the UN General Assembly".
  /\b(?:at|on the sidelines of|before|addressing)\s+(?:the\s+)?([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,4})/g,
  // An interview: to whom.
  /\b(?:interview(?:ed)? (?:with|to|by)|told|speaking to|spoke to|talking to)\s+(?:the\s+)?([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,2})/g,
];
const OCC_STOP = new Set(["the", "us", "u.s.", "iran", "israel", "tehran", "washington", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "president", "minister", "foreign"]);
/** What occasion a card's words come from, as the names it gives it ("oic", "qatar", "al jazeera"). */
export function occasionOf(r: Card): Set<string> {
  const t = `${r.summary} ${String(r.text ?? "").slice(0, 400)}`;
  const out = new Set<string>();
  for (const re of OCCASION) for (const m of t.matchAll(re)) for (const w of m[1].toLowerCase().split(/\s+/)) if (w.length >= 3 && !OCC_STOP.has(w)) out.add(w);
  if (/\b(?:press|news) conference\b|\bbriefing\b/i.test(t)) out.add("presser");
  if (/\b(?:on|in a post on|wrote on) (?:X|Twitter|Telegram|Truth Social|Instagram)\b/.test(t)) out.add("post");
  return out;
}
/** Two cards name their occasions and none is the same: two occasions. */
function otherOccasion(x: Set<string>, y: Set<string>): boolean {
  if (!x.size || !y.size) return false;
  for (const w of x) if (y.has(w)) return false;
  return true;
}

/**
 * One official's remarks on one occasion, whoever relays them: within three
 * hours of each other, or later the same day on the same topic, unless the
 * two cards name different occasions (a call with Qatar, a speech at the OIC).
 */
export function sameRemarks(a: Card, b: Card): boolean {
  const k = remarksOwner(a);
  if (!k || k !== remarksOwner(b) || deskDay(a.at) !== deskDay(b.at)) return false;
  return oneOccasion(a, b, Math.abs(Date.parse(b.at) - Date.parse(a.at)), occasionOf(a), occasionOf(b));
}
function oneOccasion(a: Card, b: Card, gap: number, oa: Set<string>, ob: Set<string>): boolean {
  if (otherOccasion(oa, ob)) return false;
  if (gap <= REMARKS_MS) return true;
  return wordsInCommon(lineOf(a.summary), lineOf(b.summary)) >= SAME_TOPIC;
}

/**
 * One channel's lines from one unnamed speaker ("Houthi official: ...") posted
 * within ten minutes of each other: one speech (Al-Masirah's seven lines of
 * the parliament speaker's message in five minutes, 17 Oct).
 */
export function sameBurst(a: Card, b: Card): boolean {
  if (a.source !== b.source) return false;
  const x = /^([^:]{2,60}):\s/.exec(a.summary)?.[1].trim().toLowerCase();
  const y = /^([^:]{2,60}):\s/.exec(b.summary)?.[1].trim().toLowerCase();
  return !!x && x === y && Math.abs(Date.parse(a.at) - Date.parse(b.at)) <= BURST_MS;
}

/* ------------------------------------------------------------------ *
 * Ships
 * ------------------------------------------------------------------ */

const INCIDENT = /\b(?:hit|hits|struck|strikes?|attack\w*|mines?|explo\w*|fir(?:e|es|ed|ing)|caught fire|ablaze|burning|seiz\w*|board\w*|hijack\w*|incident|approach\w*|damag\w*|sank|sink\w*|projectile|missiles?|drones?|rpg|shots?|targeted)\b/i;
/** A count over time is no incident: "12 attacks on shipping in the week", "highest since March". */
const TALLY = /\b(?:past|last|this)\s+(?:week|month)|\bweek ending\b|\bsince (?:the war|war began|March|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|January|February|April|May|June|July|August|September|October)\b|\brecord\b|\bhighest\b|\b(?:[3-9]|\d{2,}|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:\w+\s+)?(?:attacks|ships|vessels|tankers)\b/i;
const MARKET = /\b(?:prices?|rates?|insurance|premiums?|markets?|freight|charter|crude futures|brent)\b/i;
const KINDS: [RegExp, string][] = [
  [/\b(?:LNG|LPG|gas)\s+(?:tankers?|carriers?|ships?|vessels?)\b/i, "gas tanker"],
  [/\b(?:super-?tankers?|supratankers?|oil tankers?|crude (?:oil )?tankers?|product tankers?|VLCCs?|tankers?)\b/i, "tanker"],
  [/\bbulk carriers?\b/i, "bulk carrier"],
  [/\bcontainer (?:ships?|vessels?)\b/i, "container ship"],
  [/\b(?:destroyers?|frigates?|warships?|aircraft carriers?|naval vessels?)\b/i, "warship"],
  [/\b(?:fishing boats?|dhows?)\b/i, "boat"],
  [/\b(?:cargo ships?|merchant (?:ships?|vessels?)|commercial (?:ships?|vessels?)|ships?|vessels?|maritime incident|security incident)\b/i, "ship"],
];
/** The stretch of sea, most particular first: "east of Hormuz" is the Gulf of Oman, "off Jubail" the Gulf. */
const SEAS: [RegExp, string][] = [
  [/\b(?:Jubail|Jubayl|Ras Tanura|Dammam|Saudi coast|off Saudi Arabia|(?:eastern )?coast of Saudi Arabia|Persian Gulf|Arabian Gulf|Ras Laffan|Kuwait)\b/i, "gulf"],
  [/\beast of (?:the )?(?:Strait of )?Hormuz\b|\b(?:Gulf of Oman|Sea of Oman|Fujairah|Khor Fakkan|Sohar|Jask|Sirik)\b/i, "gulf of oman"],
  [/\b(?:Hormuz|Bandar Abbas|Qeshm|Larak|Hormozgan)\b/i, "hormuz"],
  [/\b(?:Gulf of Aden|Aden|Mukalla|Hadramawt|Hadramout|Shabwa|Nishtun|Abyan)\b/i, "gulf of aden"],
  [/\b(?:Bab al-Mandab|Bab el-Mandeb|Mandab|Perim|Mayun|Dhubab)\b/i, "bab"],
  [/\b(?:Red Sea|Hodeidah|Hudaydah|Mocha|Mokha|Ras Isa|Salif|Kamaran|Jizan|Jazan|Yanbu|Jeddah)\b/i, "red sea"],
  [/\b(?:Arabian Sea|Socotra|Salalah|Duqm|Mahrah)\b/i, "arabian sea"],
  [/\b(?:off Yemen|Yemen(?:'s|i)? coast|off the Yemeni)\b/i, "yemen"],
];
const YEMEN_SEAS = new Set(["gulf of aden", "bab", "red sea", "arabian sea"]);
function seasMeet(a: string, b: string): boolean {
  if (a === b) return true;
  if (a === "yemen") return YEMEN_SEAS.has(b);
  if (b === "yemen") return YEMEN_SEAS.has(a);
  // The Bab al-Mandab joins the Red Sea to the Gulf of Aden.
  if (a === "bab") return b === "red sea" || b === "gulf of aden";
  if (b === "bab") return a === "red sea" || a === "gulf of aden";
  return false;
}
const CAUSES: [RegExp, string][] = [
  [/\b(?:naval |sea )?mines?\b/i, "mine"],
  [/\b(?:projectiles?|missiles?|drones?|rockets?|rpg|rocket-propelled)\b/i, "projectile"],
  [/\b(?:small (?:boat|craft)|gunfire|shots?|armed men|gunmen)\b/i, "boat"],
  [/\b(?:seiz\w*|board\w*|hijack\w*|detain\w*)\b/i, "seizure"],
];

export type Ship = { kind: string; sea: string; name: string; cause: string };

/** A ship incident a card tells: what kind of ship, where, its name if given, and what hit it. */
export function shipIncident(r: { summary: string; place?: string | null }): Ship | null {
  const s = String(r.summary || "");
  if (!INCIDENT.test(s) || MARKET.test(s) || TALLY.test(s)) return null;
  const hit = KINDS.map(([re, k]) => ({ m: re.exec(s), k })).find((x) => x.m);
  if (!hit?.m) return null;
  const kind = hit.k;
  // Ships in the plural are several incidents or a claim at large ("Iran fires
  // missiles at non-compliant ships"), unless two are told as one ("two oil
  // tankers attacked off Saudi coast").
  if (/s$/i.test(hit.m[0]) && !/\b(?:two|2|both)\s+(?:\w+\s+){0,2}$/i.test(s.slice(0, hit.m.index))) return null;
  const where = `${s} ${r.place ?? ""}`;
  const sea = SEAS.find(([re]) => re.test(where))?.[1] ?? "";
  const named = /\b(?:MT|MV|M\/T|M\/V)\s*([A-Z0-9][\w-]*(?:\s+[A-Z0-9][\w-]*){0,2})/.exec(s);
  const name = named ? named[1].toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const cause = CAUSES.find(([re]) => re.test(s))?.[1] ?? "";
  // No sea and no name: only what hit it can still tie it ("second giant oil tanker exploded after hitting a sea mine").
  if (!sea && !name && !cause) return null;
  return { kind, sea, name, cause };
}

/** One ship incident: the same name, or the same kind in the same stretch of sea and nothing that tells them apart. */
export function sameShip(x: Ship, y: Ship): boolean {
  if (x.name && y.name) return x.name === y.name;
  // One names no sea: the same kind of ship hit by the same thing.
  if (!x.sea || !y.sea) return x.kind === y.kind && x.kind !== "ship" && !!x.cause && x.cause === y.cause;
  if (!seasMeet(x.sea, y.sea)) return false;
  if (x.kind !== y.kind && x.kind !== "ship" && y.kind !== "ship") return false;
  return !(x.cause && y.cause && x.cause !== y.cause);
}

/* ------------------------------------------------------------------ *
 * The dead and wounded of one district
 * ------------------------------------------------------------------ */

const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20 };
const NUM = "(\\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)";
const num = (w: string) => (/^\d/.test(w) ? Number(w) : WORD_NUM[w.toLowerCase()] ?? NaN);
const ONE_PERSON = "(?:civilian|shepherd|child|boy|girl|woman|man|farmer|fisherman|soldier|fighter|member|teacher|doctor|journalist|citizen|officer|commander|driver)";

export type Toll = { dead: number[]; hurt: number[]; total: number[] };

/**
 * The casualties a headline counts: "kills 8 and wounds 6", "Nine killed",
 * "kills civilian shepherd" (one), "wounding two citizens", and the totals
 * told as one ("kills and wounds 14", "20 people killed and wounded", "death
 * and injury toll to 20"), which are no count of the dead.
 */
export function tollOf(s: string): Toll {
  let t = String(s || "");
  const total: number[] = [];
  const takeTotal = (re: RegExp) => {
    t = t.replace(re, (_m, n: string) => {
      total.push(num(n));
      return " ";
    });
  };
  takeTotal(new RegExp(`\\bkill(?:s|ed|ing)?\\s+(?:and|or)\\s+(?:wound|injur)\\w*\\s+(?:at least\\s+|more than\\s+)?${NUM}`, "gi"));
  takeTotal(new RegExp(`\\b${NUM}\\s+(?:\\w+\\s+){0,2}?(?:killed|dead)\\s+(?:and|or)\\s+(?:wounded|injured)`, "gi"));
  takeTotal(new RegExp(`\\b(?:death and injury|casualty) toll (?:to|of|at|rises to)\\s+${NUM}`, "gi"));
  const dead: number[] = [];
  const hurt: number[] = [];
  const grab = (re: RegExp, into: number[]) => {
    for (const m of t.matchAll(re)) into.push(num(m[1]));
  };
  // The words between a figure and "killed" hold no other figure: "nine killed and 16 injured" is 16 hurt, not 9.
  grab(new RegExp(`\\b${NUM}\\s+(?:(?!wounded|injured|killed)[a-z-]+\\s+){0,3}?(?:killed|dead|died|deaths)\\b`, "gi"), dead);
  grab(new RegExp(`\\bkill(?:s|ed|ing)?\\s+(?:at least\\s+)?${NUM}\\b`, "gi"), dead);
  grab(new RegExp(`\\bkill(?:s|ed|ing)?\\s+(a|an)\\s+(?:\\w+\\s+){0,2}?${ONE_PERSON}\\b`, "gi"), dead);
  if (new RegExp(`\\bkill(?:s|ed|ing)?\\s+(?:\\w+\\s+){0,1}${ONE_PERSON}\\b`, "i").test(t) || new RegExp(`\\b(?:a\\s+)?${ONE_PERSON}\\s+(?:was\\s+)?killed\\b`, "i").test(t)) dead.push(1);
  grab(new RegExp(`\\b${NUM}\\s+(?:(?!wounded|injured|killed|dead)[a-z-]+\\s+){0,3}?(?:wounded|injured|hurt)\\b`, "gi"), hurt);
  grab(new RegExp(`\\b(?:wound|injur)(?:s|es|ed|ing)?\\s+(?:at least\\s+)?${NUM}\\b`, "gi"), hurt);
  const ok = (a: number[]) => [...new Set(a.filter((n) => Number.isFinite(n) && n > 0))];
  return { dead: ok(dead), hurt: ok(hurt), total: ok(total) };
}

/** The dead a headline counts. */
export function deadCounts(s: string): number[] {
  return tollOf(s).dead;
}

/** Two tolls of one event: the dead one apart at most, the wounded the same, or one's total the other's sum. */
export function tollsMeet(x: Toll, y: Toll): boolean {
  // One apart only from three up: one dead and two dead are two events.
  if (x.dead.some((n) => y.dead.some((m) => n === m || (Math.min(n, m) >= 3 && Math.abs(n - m) <= 1)))) return true;
  if (!x.dead.length && !y.dead.length && x.hurt.some((n) => y.hurt.includes(n))) return true;
  const sums = (t: Toll) => [...t.total, ...(t.dead.length && t.hurt.length ? [t.dead[0] + t.hurt[0]] : [])];
  return x.total.some((n) => sums(y).includes(n)) || y.total.some((n) => sums(x).includes(n));
}
/** The same toll exactly: for two cards that name only the governorate. */
function tollsEqual(x: Toll, y: Toll): boolean {
  // A single death in a governorate happens more than once a day: two or more.
  const sums = (t: Toll) => [...t.total, ...(t.dead.length && t.hurt.length ? [t.dead[0] + t.hurt[0]] : [])];
  return x.dead.some((n) => n >= 2 && y.dead.includes(n)) || x.total.some((n) => n >= 2 && sums(y).includes(n)) || y.total.some((n) => n >= 2 && sums(x).includes(n));
}

/** Who died: Houthi fighters, soldiers, or civilians. Two tolls of different dead are two events. */
export function victims(s: string): string {
  const t = String(s || "");
  if (/\bHouthi (?:fighters|elements|members|militants|commanders?|field commanders)\b|\bkill\w*\s+(?:\w+\s+){0,3}Houthi/i.test(t)) return "houthi";
  if (/\b(?:soldiers|troops|servicemen|government (?:forces|fighters)|army personnel)\b[^.]{0,20}\b(?:killed|dead|died)|\bkill\w*\s+(?:\w+\s+){0,2}(?:soldiers|troops)\b/i.test(t)) return "soldiers";
  if (/\b(?:civilians?|children|child|women|woman|shepherd|citizens|residents|family|farmers?|fishermen)\b/i.test(t)) return "civilians";
  return "";
}

const WIDE = new Set(["governorate", "country", "sea", "strait", "city", "port city"]);
const VAGUE = /^(?:yemen|saudi arabia|red sea|gulf of aden|iran|iraq|taiz|sanaa|aden|marib|hodeidah|saada|the sea)$/i;
/** A place's key by its consonants, so spellings meet: Madaribah and Mudaribah, Shada and Shadaa. */
export function placeKey(s: string): string {
  const k = s.toLowerCase().replace(/^al[- ]/, "").replace(/[^a-z]/g, "");
  return k.slice(0, 1) + k.slice(1).replace(/[aeiouy]/g, "").replace(/(.)\1+/g, "$1");
}

/**
 * The gazetteer's places in a headline, remembered: the desk reads the same
 * cards every minute, and the gazetteer's thousand names cost seconds a read
 * on the server.
 */
const PLACES_SEEN = new Map<string, ReturnType<typeof placesIn>>();
function placesOf(s: string): ReturnType<typeof placesIn> {
  let p = PLACES_SEEN.get(s);
  if (!p) {
    if (PLACES_SEEN.size > 6000) PLACES_SEEN.clear();
    p = placesIn(s);
    PLACES_SEEN.set(s, p);
  }
  return p;
}

/** The district a card's event is in: "X district" in the headline, a district it names, or its place. */
export function districtOf(r: { summary: string; place?: string | null }): string {
  const s = String(r.summary || "");
  const d = /\b((?:Al-|al-)?[A-Z][\w'’-]+(?: [A-Z][\w'’-]+)?) (?:[Dd]istrict|[Dd]irectorate)\b/.exec(s);
  if (d) return placeKey(d[1]);
  const named = placesOf(s).find((p) => !WIDE.has(p.kind));
  if (named) return placeKey(named.name);
  // A village or an area the gazetteer does not know: "Al-Laspah village in Lahj".
  const v = /\b((?:Al-|al-)?[A-Z][\w'’-]+(?: [A-Z][\w'’-]+)?) (?:village|area)\b/.exec(s);
  if (v) return placeKey(v[1]);
  const p = String(r.place ?? "").trim();
  if (!p || VAGUE.test(p)) return "";
  const known = PLACE_BY_NAME[p];
  return known && WIDE.has(known.kind) ? "" : placeKey(p);
}

/** The governorates and cities a card names, for two cards that give no district. */
export function widePlaces(r: { summary: string; place?: string | null }): string[] {
  const out = new Set(placesOf(String(r.summary || "")).filter((p) => p.kind === "governorate" || p.kind === "city" || p.kind === "port city").map((p) => placeKey(p.name)));
  const p = String(r.place ?? "").trim();
  if (p && PLACE_BY_NAME[p] && WIDE.has(PLACE_BY_NAME[p].kind) && PLACE_BY_NAME[p].kind !== "country") out.add(placeKey(p));
  return [...out];
}

/** Who a headline blames, for telling a contested card: the striker it names. */
export function blamed(s: string): string {
  const t = String(s || "");
  if (/\bHouthis?\b[^.]{0,40}\b(?:shell|drone|missile|attack|sniper|fire|mortar)\w*/i.test(t) || /^Houthi\b/.test(t)) return "houthi";
  if (/\b(?:Saudi|coalition|US|American|Israeli)\b[^.]{0,30}\b(?:air ?strikes?|raids?|warplanes|strikes?|shell\w*|bomb\w*|fire)/i.test(t)) return "saudi";
  if (/\bgovernment (?:forces )?(?:shell\w*|strikes?|attack\w*)/i.test(t)) return "government";
  return "";
}

type Tolled = { district: string; wide: string[]; toll: Toll; blame: string; dead: string };
/**
 * One district's casualties told twice: the same district and tolls that
 * meet. Two cards naming only the governorate need the same toll exactly and
 * no clash of blame, and one of them must name no district.
 */
export function sameToll(x: Tolled, y: Tolled): boolean {
  if (x.dead && y.dead && x.dead !== y.dead) return false;
  if (x.district && y.district) return x.district === y.district && tollsMeet(x.toll, y.toll);
  if (!x.wide.some((w) => y.wide.includes(w) || w === y.district) && !y.wide.includes(x.district)) return false;
  if (x.blame && y.blame && x.blame !== y.blame) return false;
  return tollsEqual(x.toll, y.toll);
}
function tolled(r: { summary: string; place?: string | null }, district?: string): Tolled | null {
  const toll = tollOf(r.summary);
  if (!toll.dead.length && !toll.hurt.length && !toll.total.length) return null;
  return { district: district ?? districtOf(r), wide: widePlaces(r), toll, blame: blamed(r.summary), dead: victims(r.summary) };
}

/** One district's dead told twice: the same district, counts one apart at most. */
export function sameDead(a: Card, b: Card): boolean {
  const x = tolled(a);
  const y = tolled(b);
  return !!x && !!y && sameToll(x, y);
}

/* ------------------------------------------------------------------ *
 * One city site attacked; one target in one district
 * ------------------------------------------------------------------ */

export const SITE_MS = 6 * H;
const NEW_ONE = /\b(?:new|another|second|third|fresh|renewed|again)\b[^.]{0,30}\b(?:attacks?|strikes?|explosions?|blasts?|hits?|drones?|missiles?)\b/i;
/** A Yemeni city's own site: "Aden International Airport" → "aden-airport". */
export function citySite(s: string): string {
  // The attack itself, not the flights resuming, the minister's visit or a condemnation.
  if (NEW_ONE.test(s) || !SITE_ATTACK.test(s) || SITE_AFTER.test(s)) return "";
  const m = /\b(Aden|Sanaa|Sana'a|Hodeidah|Mukalla|Marib|Taiz|Mocha|Mokha|Seiyun|Sayun|Ataq|Saada|Riyan)\s+(?:International\s+)?(airport|port|palace|refinery)\b/i.exec(String(s || ""));
  return m ? `${m[1].toLowerCase().replace(/'/g, "")}-${m[2].toLowerCase()}` : "";
}

const SITE_ATTACK = /\b(?:missiles?|strikes?|struck|drones?|attack\w*|explosions?|shell\w*|hit|hits|bomb\w*|land(?:s|ed)?|target\w*)\b/i;
const SITE_AFTER = /\b(?:inspect\w*|resum\w*|condemn\w*|denounc\w*|arriv\w*|visit\w*|reopen\w*|flights?)\b/i;

// Words that name no target: sides, places at large, weapons, and what any front report says.
const TARGET_STOP = new Set(
  ("the and for with from that this into over after near its has have had was were are will been says said houthi houthis saudi yemeni yemen government forces coalition air strike strikes struck hit hits target targets targeted targeting shell shells shelled shelling attack attacks attacked raid raids district area areas village villages governorate province city town near east west north south eastern western northern southern artillery warplanes drone drones missile missiles fire fired early morning night today yesterday " +
    "front fronts position positions vehicle vehicles gathering gatherings personnel fighter fighters element elements brigade brigades giants resistance national southern footage casualties causing armed ammunition carrying destroy destroys destroyed publish publishes border populated residential report reports media " +
    "israeli israel lebanon lebanese iran iranian army idf american between outskirt outskirts toward towards town").split(" "),
);
/** Governorates and cities: a district's report names its governorate too ("Haifan district in Taiz"). */
const WIDE_NAMES = new Set(
  "taiz sanaa aden marib hodeidah saada lahj dhamar jawf hajjah amran abyan shabwa bayda mahwit raymah dhale hadramawt hadramout mahrah socotra mukalla mocha jazan jizan najran asir riyadh baghdad tehran beirut".split(" "),
);
function targetWords(s: string, district: string): Set<string> {
  return new Set(
    (String(s || "").toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [])
      .map((w) => w.replace(/^al-/, ""))
      .filter((w) => !TARGET_STOP.has(w) && !WIDE_NAMES.has(w))
      .map((w) => w.replace(/(?:ions|ion|s)$/, ""))
      .filter((w) => !TARGET_STOP.has(w) && placeKey(w) !== district && !district.includes(placeKey(w))),
  );
}
/** One target in one district told twice: the same district and two more words in common ("communications towers"). */
export function sameTargetIn(a: { summary: string; place?: string | null }, b: { summary: string; place?: string | null }): boolean {
  const d = districtOf(a);
  if (!d || d !== districtOf(b) || NEW_ONE.test(b.summary)) return false;
  const x = targetWords(a.summary, d);
  let n = 0;
  for (const w of targetWords(b.summary, d)) if (x.has(w)) n += 1;
  return n >= 2;
}

/* ------------------------------------------------------------------ *
 * One rare figure
 * ------------------------------------------------------------------ */

/** A figure of a hundred or more that is not round, a year or a time: "1,292 operations", "159 prisoners". */
export function rareFigures(s: string): string[] {
  const t = String(s || "").replace(/\b\d{1,2}:\d{2}\b/g, " ");
  const out: string[] = [];
  for (const m of t.matchAll(/\b\d{1,3}(?:,\d{3})+\b|\b\d{3,}\b/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (n >= 100 && n % 50 !== 0 && !(n >= 1990 && n <= 2035)) out.push(String(n));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * One blast at a site abroad
 * ------------------------------------------------------------------ */

const BLAST = /\b(?:explosions?|blasts?|exploded|explodes|detonat\w*)\b/i;
const BLAST_CITY = /\b(Baghdad|Basra|Erbil|Kirkuk|Sulaymaniyah|Mosul|Karbala|Najaf|Tehran|Isfahan|Shiraz|Tabriz|Mashhad|Bandar Abbas|Bushehr|Ahvaz|Kermanshah|Karaj|Qom|Beirut|Damascus|Doha|Manama|Dubai|Abu Dhabi|Kuwait City|Muscat)\b/;
const BODIES: [RegExp, string][] = [
  [/\b(?:Popular Mobili[sz]ation|PMF|Hashd|Iraqi paramilitary|paramilitary alliance)\b/i, "pmf"],
];
export function blastAt(r: { summary: string }): { city: string; body: string } | null {
  const s = String(r.summary || "");
  // A ship that exploded is the ship rule's.
  if (!BLAST.test(s) || /\b(?:second|another|new|fresh|third)\s+(?:explosion|blast)\b/i.test(s) || shipIncident(r)) return null;
  const city = BLAST_CITY.exec(s)?.[1].toLowerCase() ?? "";
  const body = BODIES.find(([re]) => re.test(s))?.[1] ?? "";
  return city || body ? { city, body } : null;
}
export function sameBlast(x: { city: string; body: string }, y: { city: string; body: string }): boolean {
  if (x.city && y.city && x.city !== y.city) return false;
  if (x.body && y.body && x.body !== y.body) return false;
  return (!!x.city && x.city === y.city) || (!!x.body && x.body === y.body);
}

/* ------------------------------------------------------------------ *
 * One money figure
 * ------------------------------------------------------------------ */

export const FIGURE_MS = 24 * H;
const COUNTRIES = /\b(Iraq|Iran|Saudi Arabia|Yemen|Qatar|Kuwait|Oman|UAE|Bahrain|Egypt|Israel|India|Pakistan|China|Japan)\b/g;
/**
 * One sum told by several outlets: "Iraq says it lost $60 billion", "Iraq lost
 * $60 billion in US-Iran war", "losses at USD 60 billion" (four cards, 16-17
 * Oct). The same amount in billions or millions, naming the same country first.
 */
export function moneyOf(s: string): string {
  const t = String(s || "");
  const m = /(?:\$|USD|US\$)\s*(\d+(?:\.\d+)?)\s*(billion|bn|million|mn|trillion)\b|\b(\d+(?:\.\d+)?)\s*(billion|million|trillion)\s+(?:dollars|USD)\b/i.exec(t);
  if (!m) return "";
  const n = m[1] ?? m[3];
  const unit = (m[2] ?? m[4]).toLowerCase().replace(/^bn$/, "billion").replace(/^mn$/, "million");
  const land = [...t.matchAll(COUNTRIES)][0]?.[1] ?? "";
  return land ? `${land.toLowerCase()} ${n} ${unit}` : "";
}

/* ------------------------------------------------------------------ *
 * Mirror hosts and one channel's same headline
 * ------------------------------------------------------------------ */

/**
 * An article as one id on any of its site's hosts: ns1.khabaragency.net,
 * en.khabaragency1.net and www.khabaragency.net all serve news254459.html.
 * Only a path with an id of three digits or more: a home page is no article.
 */
export function mirrorKey(url: string): string {
  const m = /^https?:\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?/i.exec(String(url || ""));
  if (!m) return "";
  const path = (m[2] ?? "") + (m[3] ?? "");
  if (!/\d{3,}/.test(path)) return "";
  const labels = m[1].toLowerCase().split(".");
  if (labels.length < 2) return "";
  // The site's own name, without the digits a mirror adds: khabaragency1 → khabaragency.
  const site = labels[labels.length - 2].length <= 3 && labels.length > 2 ? labels[labels.length - 3] : labels[labels.length - 2];
  if (["t", "x", "twitter", "youtube", "facebook", "instagram", "google", "telegram"].includes(site)) return "";
  return `${site.replace(/\d+$/, "")}${path.replace(/\/$/, "")}`;
}

const headKey = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** One channel's same headline, within a day. */
export function sameOwnHeadline(a: Card, b: Card): boolean {
  const x = headKey(a.summary);
  return a.source === b.source && x.length >= 20 && x === headKey(b.summary) && Math.abs(Date.parse(a.at) - Date.parse(b.at)) <= OWN_HEAD_MS;
}

/* ------------------------------------------------------------------ *
 * Which rule joins two cards
 * ------------------------------------------------------------------ */

export type Rule = "mirror" | "own-headline" | "headline" | "remarks" | "burst" | "ship" | "dead" | "blast" | "figure" | "site" | "target";

/** The same headline from two outlets: a field report within two hours, anything else within twelve. */
export const HEADLINE_FIELD_MS = 2 * H;
export const HEADLINE_MS = 12 * H;
const FIELD = new Set(["strike", "combat", "vessel", "alert"]);

type Sig = {
  t: number;
  day: string;
  field: boolean;
  ship: Ship | null;
  blast: { city: string; body: string } | null;
  remarks: string;
  occ: Set<string>;
  mirror: string;
  head: string;
  burst: string;
  toll: Tolled | null;
  money: string;
  rare: string[];
  site: string;
  district: string;
  targets: Set<string>;
};
function sharedTargets(x: Set<string>, y: Set<string>): number {
  let n = 0;
  for (const w of y) if (x.has(w)) n += 1;
  return n;
}
// Worked out once per card: a read compares every pair of 400 cards.
const sigs = new WeakMap<object, Sig>();
// And by what a card says, across reads: a ship's learnt name and cause are its card's own, so it is copied.
const SIG_SEEN = new Map<string, Sig>();
function sig(r: Card): Sig {
  let s = sigs.get(r);
  if (s) return s;
  const key = `${r.at}|${r.source}|${r.type}|${r.place ?? ""}|${r.url}|${r.summary}`;
  const seen = SIG_SEEN.get(key);
  if (seen) {
    s = { ...seen, ship: seen.ship ? { ...seen.ship } : null };
    sigs.set(r, s);
    return s;
  }
  {
    const district = districtOf(r);
    s = {
      district,
      targets: district ? targetWords(r.summary, district) : new Set(),
      t: Date.parse(r.at),
      day: deskDay(r.at),
      field: FIELD.has(String(r.type)),
      ship: shipIncident(r),
      blast: blastAt(r),
      remarks: remarksOwner(r),
      occ: occasionOf(r),
      mirror: mirrorKey(r.url),
      head: headKey(r.summary),
      burst: /^([^:]{2,60}):\s/.exec(r.summary)?.[1].trim().toLowerCase() ?? "",
      toll: tolled(r, district),
      money: moneyOf(r.summary),
      rare: rareFigures(r.summary),
      site: citySite(r.summary),
    };
    sigs.set(r, s);
    if (SIG_SEEN.size > 6000) SIG_SEEN.clear();
    SIG_SEEN.set(key, { ...s, ship: s.ship ? { ...s.ship } : null });
  }
  return s;
}

/**
 * The rule that makes `b` a copy of `a` (a the earlier card), or null. Windows
 * are counted from `a`, so a thread never runs on for days.
 */
export function foldRule(a: Card, b: Card): Rule | null {
  return eventRule(a, b) ?? talkRule(a, b);
}

/** One event told twice: the same article, headline, ship, toll, site, target, blast or figure. */
export function eventRule(a: Card, b: Card): Rule | null {
  if (a === b || a.fp === b.fp) return null;
  const sa = sig(a);
  const sb = sig(b);
  const gap = Math.abs(sb.t - sa.t);
  if (sa.mirror && sa.mirror === sb.mirror) return "mirror";
  if (sa.head.length >= 20 && sa.head === sb.head) {
    if (a.source === b.source && gap <= OWN_HEAD_MS) return "own-headline";
    if (gap <= (sa.field || sb.field ? HEADLINE_FIELD_MS : HEADLINE_MS)) return "headline";
  }
  if (sa.ship && sb.ship && gap <= SHIP_MS && sameShip(sa.ship, sb.ship)) return "ship";
  return looseRule(a, b);
}

/** One speaker's words: their remarks that day, or one channel's burst of their lines. */
export function talkRule(a: Card, b: Card): Rule | null {
  if (a === b || a.fp === b.fp) return null;
  const sa = sig(a);
  const sb = sig(b);
  if (sa.remarks && sa.remarks === sb.remarks && sa.day === sb.day && oneOccasion(a, b, Math.abs(sb.t - sa.t), sa.occ, sb.occ)) return "remarks";
  if (sa.burst && a.source === b.source && sa.burst === sb.burst && Math.abs(sb.t - sa.t) <= BURST_MS) return "burst";
  return null;
}

/**
 * The rules that may join a card to any account already in a card, not only
 * its lead: one event's tolls, site, target, blast and figures. "9 killed in
 * Saudi airstrikes on Taiz" names no district, but an account already joined
 * names Maqbanah.
 */
export function looseRule(a: Card, b: Card): Rule | null {
  const sa = sig(a);
  const sb = sig(b);
  const gap = Math.abs(sb.t - sa.t);
  if (sa.toll && sb.toll && gap <= DEAD_MS && sameToll(sa.toll, sb.toll)) return "dead";
  if (sa.site && sa.site === sb.site && gap <= SITE_MS) return "site";
  // Ships are the ship rule's: a container ship and a tanker on one mine-laid strait are two.
  if (gap <= SITE_MS && !sa.ship && !sb.ship && sa.district && sa.district === sb.district && !NEW_ONE.test(b.summary) && sharedTargets(sa.targets, sb.targets) >= 2) return "target";
  if (sa.blast && sb.blast && gap <= BLAST_MS && sameBlast(sa.blast, sb.blast)) return "blast";
  if (gap <= FIGURE_MS) {
    if (sa.money && sa.money === sb.money) return "figure";
    // The same rare figures, and no new one: "356 operations" then "356 operations neutralise 476 fighters" are two posts.
    const same = sa.rare.length > 0 && sa.rare.length === sb.rare.length && sa.rare.every((x) => sb.rare.includes(x));
    if (same && wordsInCommon(a.summary, b.summary) >= 1) return "figure";
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Joining a copy into its card
 * ------------------------------------------------------------------ */

const lineOf = (summary: string) => String(summary || "").replace(/^[^:]{2,70}:\s+/, "").trim();
function carries(text: string, line: string): boolean {
  const have = text.toLowerCase();
  const words = (line.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []).filter((w) => !/^(?:that|this|with|from|have|been|will|were|said|says|their|they|them|also|into|over|about|after)$/.test(w));
  if (words.length < 3) return have.includes(line.toLowerCase());
  return words.filter((w) => have.includes(w.replace(/(?:es|s|ed|ing)$/, ""))).length / words.length >= 0.7;
}
/** The most lines a card of remarks takes in. */
const MAX_LINES = 12;

/**
 * `copy` joins `home`: its outlet goes under "Also" (one entry per outlet), a
 * speaker's further line goes into the card's text, and a district's dead told
 * with the blame on the other side make the card contested, both accounts
 * shown. The speaker's own channel takes the lead of their remarks. Returns
 * the card that leads.
 */
export function joinInto(home: Card, copy: Card, rule: Rule): Card {
  // A ship's card learns from each account: once one names the ship or what
  // hit it, the next unnamed tanker must fit that (MT ST 3's projectile is not
  // the next day's mine).
  if (rule === "ship") {
    const h = sig(home).ship;
    const c = sig(copy).ship;
    if (h && c) {
      h.name ||= c.name;
      h.cause ||= c.cause;
      h.sea ||= c.sea;
      if (h.kind === "ship") h.kind = c.kind;
    }
  }
  if ((rule === "remarks" || rule === "burst") && ownChannelOf(remarksOwner(home), copy.source) && !ownChannelOf(remarksOwner(home), home.source)) {
    const was = { source: home.source, url: home.url, summary: home.summary };
    const oldText = String(home.text ?? "");
    home.source = copy.source;
    home.url = copy.url;
    home.summary = copy.summary;
    home.text = copy.text ?? "";
    for (const k of ["tier", "citing", "lean", "media"]) if (k in copy) home[k] = copy[k];
    home.alsoReportedBy = addAlso(home.alsoReportedBy, was, home.source);
    const line = lineOf(was.summary);
    if (line && !carries(`${home.summary} ${home.text}`, line)) home.text = appendLine(String(home.text ?? ""), line);
    if (oldText && !carries(String(home.text ?? ""), oldText.slice(0, 200))) home.text = appendLine(String(home.text ?? ""), oldText);
    home.tags = [...new Set([...(home.tags ?? []), "lead-swap", "original"])];
    return home;
  }
  home.alsoReportedBy = addAlso(home.alsoReportedBy, { source: copy.source, url: copy.url, summary: copy.summary }, home.source);
  for (const a of copy.alsoReportedBy ?? []) home.alsoReportedBy = addAlso(home.alsoReportedBy, a, home.source);
  if (rule === "remarks" || rule === "burst") {
    const line = lineOf(copy.summary);
    const text = String(home.text ?? "");
    const lines = text.split("\n").length;
    if (line && lines < MAX_LINES && !carries(`${home.summary} ${text}`, line)) home.text = appendLine(text, line);
  }
  if (rule === "dead") {
    const x = blamed(home.summary);
    const y = blamed(copy.summary);
    if (x && y && x !== y) {
      home.flags = [...new Set([...(home.flags ?? []), "contested"])];
      const told = `Told otherwise by ${copy.source}: ${copy.summary}`;
      if (!String(home.text ?? "").includes(told)) home.text = appendLine(String(home.text ?? ""), told);
    }
  }
  return home;
}
function appendLine(text: string, line: string): string {
  const l = /[.!?]$/.test(line) ? line : `${line}.`;
  return text.trim() ? `${text.trim()}\n${l}` : l;
}
function addAlso(list: Card["alsoReportedBy"], a: { source: string; url: string; summary?: string }, lead: string) {
  if (a.source === lead || (list ?? []).some((x) => x.source === a.source || x.url === a.url)) return list;
  const out = [...(list ?? [])];
  out.push(a);
  return out.slice(0, 12);
}

/* ------------------------------------------------------------------ *
 * The served read
 * ------------------------------------------------------------------ */

/**
 * The desk's cards with their copies folded, as the desk is read. Oldest
 * first, each card joins the first earlier card a rule ties it to; the cards
 * are copies, so the stored rows stay as they are. Returns the cards newest
 * first, as served, and how many folded under each rule.
 */
export function foldServed<T extends Card>(reports: T[]): { reports: T[]; folded: Record<string, number>; into: Map<string, string> } {
  const byTime = reports.map((r) => ({ ...r }) as T).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const kept: T[] = [];
  const folded: Record<string, number> = {};
  // Each folded card's fp, to the fp of the card it joined.
  const into = new Map<string, string>();
  // The accounts in each card an event rule joined, for the rules that may join any of them.
  const members = new Map<T, T[]>();
  const find = (r: T): [T, Rule] | null => {
    // An event first: a ministry's toll of the dead belongs with the dead, not
    // with the ministry's other words that day.
    for (const k of kept) {
      const rule = eventRule(k, r);
      if (rule) return [k, rule];
      for (const m of members.get(k) ?? []) {
        const loose = looseRule(m, r);
        if (loose) return [k, loose];
      }
    }
    for (const k of kept) {
      const rule = talkRule(k, r);
      if (rule) return [k, rule];
    }
    return null;
  };
  for (const r of byTime) {
    const hit = find(r);
    if (!hit) {
      kept.push(r);
      members.set(r, []);
      continue;
    }
    const [home, rule] = hit;
    joinInto(home, r, rule);
    if (rule !== "remarks" && rule !== "burst") members.get(home)!.push(r);
    into.set(r.fp, home.fp);
    folded[rule] = (folded[rule] ?? 0) + 1;
  }
  return { reports: kept.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), folded, into };
}
