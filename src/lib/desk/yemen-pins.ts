/*
 * The Yemen map's pins as they are served (user, 17 Oct: "64 events today, 16 in one pin").
 *
 * Stored pins are not changed; these rules apply as the desk is read, so pins
 * stored under older rules are shown right too:
 *   - A pin on a city or governorate centre moves to the district its label
 *     names inside that governorate: "Saudi forces shell Shada…" in Saada,
 *     "Houthi shelling … in Sabr Al-Mawadim district in Taiz". The gazetteer
 *     knows few districts, so these all sat on Taiz or Saada.
 *   - An "at sea" pin that names no ship or sea is a strike ("Houthi missile
 *     strikes Saudi forces command headquarters in Badr camp in Aden").
 *   - An analysis piece or an official's visit is no event ("Houthis close in
 *     on key Yemen city of Taiz: Why a global trade route is at risk").
 *   - One event told by several outlets is one pin: a later pin on the same
 *     spot, the same day and of the same kind, that tells the same thing, goes.
 */
import { ADM2 } from "./adm2-centres.ts";
import { governorateAt } from "./adm1.ts";
import { placeKey } from "./prose-places.ts";

export type YemenPin = { fp?: string; at?: string; type?: string | null; lat?: number; lng?: number; place?: string | null; label?: string | null };

const STOP = new Set(["al", "the", "and", "of", "in", "on", "at", "district", "governorate", "city", "front", "village", "area"]);

/** Districts by governorate, each with its key. */
const BY_GOV = new Map<string, { name: string; key: string; bones: string; lat: number; lng: number; gov: string }[]>();
/** A name's consonants: "Sabr Al-Mawadim" and "Sabir Al Mawadim", "Al-Shamaitin" and "Ash Shamayatayn" are one. */
const bones = (key: string) => key.replace(/[aeiouyw]/g, "");
for (const d of ADM2) {
  const key = placeKey(d.name);
  if (key.length < 4) continue;
  if (!BY_GOV.has(d.gov)) BY_GOV.set(d.gov, []);
  BY_GOV.get(d.gov)!.push({ name: d.name, key, bones: bones(key), lat: d.lat, lng: d.lng, gov: d.gov });
}

/** Capitalised runs of one to three words in a label: "Sabr Al-Mawadim", "Shada", "Bani Mu'in". */
function runsOf(label: string): string[] {
  // "al-Duraihimi" written small is still a name.
  const words = label.replace(/[’]/g, "'").split(/[\s,.;:()]+/).filter(Boolean)
    .map((w) => w.replace(/^(al|el|ad|as|ash|ar|at|az|an)-([a-z])/, (_, a: string, b: string) => `${a[0].toUpperCase()}${a.slice(1)}-${b.toUpperCase()}`));
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (!/^[A-Z]/.test(words[i]) || STOP.has(words[i].toLowerCase())) continue;
    for (let n = 3; n >= 1; n--) {
      const run = words.slice(i, i + n);
      if (run.length === n && run.every((w, j) => j === 0 || /^[A-Z]/.test(w) || /^(?:al|el|as|ash|ad|ar|at|az|an)-/i.test(w))) out.push(run.join(" "));
    }
  }
  return out;
}

/** The district a label names inside the governorate a pin sits in, when the pin is on that governorate's or city's centre. */
export function districtPin(e: YemenPin): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number" || !e.label) return null;
  const gov = governorateAt(e.lat, e.lng);
  const list = gov ? BY_GOV.get(gov) : undefined;
  if (!list) return null;
  const here = placeKey(String(e.place || "").split(",")[0]);
  // Only a pin on a broad place moves: a pin already on a district or village stays.
  const broad = !here || BROAD.has(here);
  if (!broad) return null;
  for (const run of runsOf(e.label)) {
    const k = ALIAS[placeKey(run)] ?? placeKey(run);
    if (k === here) continue;
    const b = bones(k);
    const hit = list.find((d) => d.key === k) || (b.length >= 4 ? list.find((d) => d.bones === b) : undefined);
    if (hit && Math.hypot(hit.lat - e.lat, hit.lng - e.lng) > 0.02) return { name: hit.name, lat: hit.lat, lng: hit.lng };
  }
  return null;
}
/** Spellings the press uses for a district that the map's list spells another way. */
const ALIAS: Record<string, string> = {
  [placeKey("Sameh")]: placeKey("Sami'"), [placeKey("Sama")]: placeKey("Sami'"),
  [placeKey("Dhwan Ans")]: placeKey("Dawran Anis"), [placeKey("Dhawran Anis")]: placeKey("Dawran Anis"), [placeKey("Dawran Ans")]: placeKey("Dawran Anis"),
};
/** Districts named after their governorate's city: a pin there is on the city centre. */
const BROAD = new Set(["taiz", "sada", "marib", "aden", "lahj", "sana", "hodeida", "ib", "dhamar", "haja", "amran", "bayda", "dhale", "jawf", "abyan", "shabwa", "mukala"].map(placeKey));

const SHIP = /\b(?:ship|ships|vessel|vessels|tanker|tankers|boat|boats|frigate|destroyer|carrier|freighter|dhow|sea|strait|port|harbou?r|maritime|naval|navy|coast guard|Red Sea|Gulf of Aden|Bab al-Mandab)\b/i;
/** A pin's kind as served: "at sea" only when its label names a ship or the sea. */
export function pinType(e: YemenPin): string | null | undefined {
  return e.type === "vessel" && e.label && !SHIP.test(e.label) ? "strike" : e.type;
}

const NOT_EVENT = /:\s*(?:why|how|what)\b|\?\s*$|\b(?:analysis|explainer|inspects?|inspected|tours?|toured)\b|\b(?:publish\w*|releases?|released|shows?|airs?|aired)\s+(?:new\s+)?footage\b|\bfootage\s+(?:shows|of)\b|\btransfers?\s+\d+\s*(?:percent|%)|\bbodies\b.{0,60}\b(?:removed|recovered|retrieved|collected)\b|\b(?:alert|warning)s?\s+(?:lifted|ended)\b|\ball[- ]clear\b/i;
/** An analysis piece, an official's visit, footage of an attack already pinned, or a move of staff: not an event on the map (17 Oct). */
export function notEvent(e: YemenPin): boolean {
  const t = String(e.label || "");
  if (NOT_EVENT.test(t) || ANALYSIS.test(t) || roundup(t)) return true;
  // What followed an attack, unless the words tell the attack too: "Air traffic suspended and explosions shake Riyadh".
  if (AFTER.test(t) && !NEW_ATTACK.test(t) && !DIRECT.test(t.split(/\b(?:following|after|days before|days after)\b/i)[0])) return true;
  if (/\bunexploded ordnance\b/i.test(t) && !/\b(?:kill\w*|wound\w*|injur\w*|dead|died)\b/i.test(t)) return true;
  return NO_FIGHT.test(t) && !FIGHT.test(t);
}
/** A trend or its cost, told without an attack of its own: "attacks on Hormuz shipping at wartime high". */
const ANALYSIS = /\b(?:stockpil\w*|wartime high|record high|raises? (?:\w+ )?concerns?|faces? (?:\w+ )?challenges|counteroffensive stalls|since (?:January|February|March|April|May|June|July|August|September|October|November|December|the war began|the start of the war)|steps? up (?:its |their )?campaign|attacks? surge|surge in attacks|shipping slows|vessels crossed|transits? (?:fell|fall|drop\w*))\b/i;
const DIRECT = /\b(?:intercept\w*|kill\w*|wound\w*|injur\w*|explosions?|launch\w*|strikes?\s+on|attacks?\s+on|bomb\w*|shell\w*|struck|hits?|advanc\w*)\b/i;

/*
 * Not an event at a place (17 Oct): what an attack led to (flights cancelled, events put off, debris
 * floating), troops moved, drills, arrests and raids on homes, praise and mediation, finds of weapons.
 */
const AFTER = /\b(?:cancels?|cancell?ed|cancellations?|suspends?|suspended|suspension|delays?|delayed|postpones?|postponed|resumes?|resumed|remains? (?:shut|closed)|reopens?|reopened|insurance|premiums?|stopped public|leak\w* fuel|float\w*|gather\w* cargo|controlled (?:explosion|detonation)|lifts?\s+(?:the\s+)?(?:emergency\s+|security\s+)?(?:alerts?|warnings?))\b/i;
const NEW_ATTACK = /\b(?:fresh|new|another|renewed)\s+(?:\w+\s+){0,2}(?:strikes?|attacks?|barrage|missiles?)\b/i;
const NO_FIGHT = /\b(?:reinforcements?|deploys?|deployed|deployment|withdraw\w*|transfers?|transferred|mobili[sz]\w*|redeploy\w*|dispatch\w*|arrives?|arrived|drills?|exercises?|manoeuvres?|maneuvers?|parades?|graduat\w*|forms? new|leaflets?|graffiti|abduct\w*|kidnap\w*|arrests?|arrested|detains?|detained|detention|loot\w*|storms? (?:a |the )?(?:citizen'?s? )?(?:home|house)|raid (?:and \w+ )?(?:over \d+ )?(?:homes|houses)|praises?|praised|mediations?|flares?|ammunition trucks|finds?|found)\b/i;
const FIGHT = /\b(?:strikes?|struck|hits?|attack\w*|clash\w*|kill\w*|wound\w*|injur\w*|shell\w*|repel\w*|fire[sd]?|firing|target\w*|destroy\w*|captur\w*|ambush\w*|battles?|fight\w*|besieg\w*|bomb\w*|explo\w*|expel\w*|expuls\w*|pursu\w*|clear(?:s|ed|ing)?|thwart\w*|foil\w*|decapitat\w*|executed|dead|bod(?:y|ies)|operations?)\b/i;
/** A tally or a round of the war across the land: "219 violations over 48 hours", "strikes on Sanaa, Taiz, Ibb and Saada". */
export function roundup(t: string): boolean {
  const target = targetsOf(t).size > 0;
  // A count of ships or attacks over a day or a week: "12 vessels hit in a week", "six vessels hit in one day".
  if (/\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|multiple)\s+(?:\w+\s+)?(?:vessels|ships|tankers|attacks|strikes)\s+(?:\w+\s+)?(?:hit|struck|targeted|attacked)?\s*in (?:a|one|the past|the last) (?:single )?(?:week|day)\b/i.test(t)) return true;
  // "Houthi forces kill second teacher in 24 hours": one event, the second of its kind.
  if (!target && !/\b(?:second|third|fourth|fifth|another)\b/i.test(t) && /\b(?:past|last|over|previous|within|in)\s+(?:the\s+)?(?:24|48|72|96|twenty-four|forty-eight|seventy-two)[\s-]*hours?\b|\b(?:past|last)\s+(?:two|three|four|few|several)\s+days\b|\b(?:past|in a|this|one)\s+week\b|\bin (?:one|a single) day\b|\bsince (?:the start|dawn|morning)\b/i.test(t)) return true;
  // A front's toll in hundreds, with no one attack named: "168 Houthi fighters killed and 210 wounded in clashes in Taiz".
  if (!target && /\b\d{3,}[\d,]*\s+(?:[\w-]+\s+){0,2}(?:killed|dead|wounded|casualties|neutrali[sz]ed)\b/i.test(t)) return true;
  if (/\b\d{2,}[\d,]*\s+(?:(?:Houthi|Saudi|coalition|military|air|precise|enemy|targeted|combat|separate)\s+){0,2}(?:operations|violations|strikes|airstrikes|air strikes|raids|attacks|breaches|targets)\b/i.test(t)) return true;
  // A list of three governorates, unless a target in them is named: "strikes hit Hodeidah airport and networks in Bayda and Ibb".
  // A road named by its towns ("the Aden-Lahj-Taiz road") is one place.
  return !target && govsIn(t.replace(/\b[\w']+(?:-[\w']+){2,}/g, "")).size >= 3;
}

/* The governorate a pin's words name, for a pin set down far outside it (17 Oct: "Jabal Han west of Taiz" sat near Dhamar). */
const GOVS: [string, RegExp, number, number, string][] = [
  ["YE-TA", /\bTa['’]?izz?\b/i, 13.58, 44.02, "Taiz"],
  ["YE-SD", /\bSa['’]?a?d(?:ah?|a)\b/i, 16.94, 43.76, "Saada"],
  ["YE-MA", /\bMa['’]?r[ie]b\b/i, 15.47, 45.32, "Marib"],
  ["YE-JA", /\b(?:Al[- ])?J(?:aw|ou|o)f\b/i, 16.72, 44.76, "Al-Jawf"],
  ["YE-HU", /\bH[ou]d[ae]i?y?dah?\b/i, 14.8, 42.95, "Hodeidah"],
  ["YE-HJ", /\bHajj?ah?\b/i, 15.69, 43.6, "Hajjah"],
  ["YE-LA", /\bLahi?j\b/i, 13.05, 44.88, "Lahj"],
  ["YE-AD", /\bAden\b/i, 12.79, 45.02, "Aden"],
  ["YE-DA", /\b(?:Al[- ])?Dh?al(?:e['’]?a?|i['’]?)\b/i, 13.7, 44.73, "Al-Dhale"],
  ["YE-BA", /\b(?:Al[- ])?Bay(?:d|dh)a[ah]?\b|\bAl-Beida\b/i, 13.99, 45.57, "Al-Bayda"],
  ["YE-IB", /\bIbb\b/i, 13.97, 44.18, "Ibb"],
  ["YE-DH", /\bDhamar\b/i, 14.542997, 44.4000607, "Dhamar"],
  ["YE-SA", /\bSana['’]?a\b(?!\s+forces)/i, 15.3694, 44.191, "Sanaa"],
  ["YE-AM", /\bAmran\b/i, 15.674, 43.938, "Amran"],
  ["YE-MW", /\b(?:Al[- ])?Mahwit\b/i, 15.462, 43.552, "Al-Mahwit"],
  ["YE-RA", /\bRaymah\b/i, 14.62, 43.71, "Raymah"],
  ["YE-SH", /\bShabwah?\b/i, 14.541, 46.862, "Shabwa"],
  ["YE-AB", /\bAbyan\b/i, 13.148, 45.412, "Abyan"],
  ["YE-HD", /\bHa?dh?ra?m(?:a|o)(?:w|u)?t\b|\bMukalla\b/i, 14.54, 49.13, "Hadramawt"],
  ["YE-MR", /\b(?:Al[- ])?Mahra[h]?\b/i, 16.21, 52.17, "Al-Mahrah"],
];
/** Fronts the press names without their governorate, all Taiz's: "forces holding positions in Jabal Han" sat near Dhamar (15 Oct). */
const FRONTS: [RegExp, string][] = [
  [/\b(?:Jabal|Mount) Han\b|\bAl-Shaq[ae]?b\b|\bAl-Shuqa?b\b|\bAl-Aqro?u?dh?\b|\bAl-Sarari\b|\bJabal Sabr\b|\bAl-Hawban\b|\bAl-Dhabab\b|\bAl-Ahkum\b|\bAl-Turba[h]?\b|\bAl-Shamaya?tayn\b/i, "YE-TA"],
];
/** The governorates the words name; "Gulf of Aden" is the sea, "Sanaa forces" the Houthis. */
export function govsIn(t: string): Set<string> {
  const s = String(t).replace(/\bGulf of Aden\b/gi, "");
  return new Set(GOVS.filter(([, re]) => re.test(s)).map(([iso]) => iso));
}
const kmTo = (lat: number, lng: number, a: number, b: number) => Math.hypot((lat - a) * 111, (lng - b) * 111 * Math.cos((lat * Math.PI) / 180));

/** A pin set down far from the one governorate its words name moves there: to the district they name in it, else its centre. */
export function namedGovPin(e: YemenPin & { text?: string | null }): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number") return null;
  const label = String(e.label || "");
  let named = govsIn(label);
  if (!named.size) named = new Set(FRONTS.filter(([re]) => re.test(label)).map(([, iso]) => iso));
  if (!named.size) named = govsIn(String(e.text || "").slice(0, 240));
  if (named.size !== 1) return null;
  const iso = [...named][0];
  const at = governorateAt(e.lat, e.lng);
  // Sanaa city sits inside Sanaa governorate.
  if (at === iso || (iso === "YE-SA" && at === "YE-SN")) return null;
  const list = [...(BY_GOV.get(iso) ?? []), ...(iso === "YE-SA" ? BY_GOV.get("YE-SN") ?? [] : [])];
  const nearest = Math.min(...list.map((d) => kmTo(e.lat!, e.lng!, d.lat, d.lng)));
  if (nearest < 15) return null;
  // A place the words name themselves, near the border, stays: "the Harib front in Shabwa" is Marib's Harib.
  if (nearest <= 40 && placeNamed(e.place, label)) return null;
  for (const run of runsOf(label)) {
    const k = ALIAS[placeKey(run)] ?? placeKey(run);
    const b = bones(k);
    const hit = list.find((d) => d.key === k) || (b.length >= 4 ? list.find((d) => d.bones === b) : undefined);
    if (hit && !BROAD.has(hit.key)) return { name: hit.name, lat: hit.lat, lng: hit.lng };
  }
  const g = GOVS.find(([i]) => i === iso)!;
  return { name: g[4], lat: g[2], lng: g[3] };
}

const words = (s: string) => new Set(String(s).toLowerCase().match(/[a-z]{4,}/g) || []);
function alike(a: string, b: string): boolean {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n / Math.min(A.size, B.size) >= 0.7;
}
const dayOf = (at?: string) => (at ? new Date(Date.parse(at) + 3 * 3600e3).toISOString().slice(0, 10) : "");

/** The sea a ship pin is in, by its longitude: the Red Sea, the Gulf of Aden, the Arabian Sea. */
const seaOf = (e: YemenPin) => (typeof e.lng !== "number" ? "" : e.lng < 43.6 ? "red" : e.lng < 52 ? "aden" : "arabian");

/*
 * One event, one pin (user, 17 Oct: "not one duplicate even"). The outlets tell one attack each their
 * own way and hours apart: Aden's palace hit on 16 Oct was eight pins, Riyadh's airport a dozen. Two
 * pins on the same day and spot are one event when they are the same report, tell it in the same words,
 * name the same target and what hit it, give the same dead and wounded, or are the same side's same
 * kind of attack within two hours. The pin kept is the first told from the outlet's own page; the
 * others are listed under it as "also".
 */
export type Also = { source: string; url: string };
type FullPin = YemenPin & { actor?: string | null; source?: string | null; url?: string | null; text?: string | null; also?: Also[] };

/** A report's address without what does not change the report: "index.php/", tracking, a slash at the end. */
export function reportKey(url: string | null | undefined): string {
  return String(url || "").replace(/^https?:\/\/(?:www\.|mobile\.)?/i, "").replace(/twitter\.com\//i, "x.com/").replace(/\/index\.php\//i, "/").replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
}
/** A Google News redirect or an aggregator: not the outlet's own page. */
const relayed = (p: FullPin) => /news\.google\.com|msn\.com|yahoo\.com/i.test(String(p.url || "")) || /^(?:Google News|Yahoo|MSN|Facebook)$/i.test(String(p.source || ""));

const ACTIONS: [string, RegExp][] = [
  ["air", /\b(?:air ?strikes?|air ?raids?|airstrikes?|warplanes?|fighter jets?|aircraft|raids?|cluster bombs?)\b/i],
  ["missile", /\b(?:missiles?|ballistic|rockets?|projectiles?|barrage)\b/i],
  ["drone", /\b(?:drones?|UAVs?)\b/i],
  ["shell", /\b(?:shell\w*|artillery|mortars?|snip\w*|gunfire|machine-?guns?|tank fire)\b/i],
  ["ground", /\b(?:clash\w*|assault\w*|offensive|advance\w*|repel\w*|repuls\w*|infiltrat\w*|battles?|fighting|storm\w*|captur\w*|retak\w*|seiz\w*|ambush\w*|thwart\w*|foil\w*|incursion)\b/i],
  ["mine", /\b(?:landmines?|mines?|explosive devices?|IEDs?)\b/i],
  ["alert", /\b(?:sirens?|alerts?|warnings?|intercept\w*|shot down|shoots? down|explosions?|blasts?|debris|shrapnel|fragments)\b/i],
];
const actionsOf = (t: string) => new Set(ACTIONS.filter(([, re]) => re.test(t)).map(([k]) => k));
const TARGET = /\b(palace|airport|refiner(?:y|ies)|aramco|port|harbou?r|camp|base|headquarters|hq|school|hospital|market|depot|station|prison|checkpoint|mosque|university|power plant|tanker|ship|vessel|frigate|convoy|bridge|terminal|pipeline)s?\b/gi;
const targetsOf = (t: string) => new Set([...t.matchAll(TARGET)].map((m) => m[1].toLowerCase().replace(/^hq$/, "headquarters")));
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, twenty: 20 };
/** The dead and wounded a report gives: "kills 5, wounds 16", "killing five people and wounding 16". */
function tollOf(t: string): Set<string> {
  const out = new Set<string>();
  const n = (w: string) => (/^\d+$/.test(w) ? Number(w) : NUM[w.toLowerCase()]);
  for (const m of t.matchAll(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|twenty)\s+(?:\w+\s+){0,2}?(killed|dead|died|wounded|injured|hurt)\b/gi)) out.add(`${/kill|dead|died/i.test(m[2]) ? "k" : "w"}${n(m[1])}`);
  for (const m of t.matchAll(/\b(kill\w*|wound\w*|injur\w*)\s+(?:at least\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|twenty)\b/gi)) out.add(`${/kill/i.test(m[1]) ? "k" : "w"}${n(m[2])}`);
  return out;
}
const STOPWORDS = new Set("that this with from over near into after amid were have says said reports report reported forces force yemeni yemen government houthi houthis saudi coalition saudi-led led backed south north east west southern northern eastern western city district governorate province area front".split(" "));
/** The words of the telling, not the names: two reports naming the same three cities are not one report. */
const content = (s: string) => new Set((String(s).match(/\b[a-z][a-z'-]{3,}/g) || []).filter((w) => !STOPWORDS.has(w)));
/** A name both tell that is no side and no governorate: a person, a unit ("127th"), a site. */
const COMMON_NAMES = /^(?:saudi|houthis?|yemeni?|government|coalition|forces?|army|southern|giants|brigades?|national|resistance|shield|nation's|air|ansar|allah|sanaa|taiz|marib|saada|aden|lahj|hodeidah|jawf|dhale|bayda|hajjah|dhamar|amran|shabwa|abyan|ibb|said|says|after|amid)$/i;
function sharesName(a: string, b: string, places: string[] = []): boolean {
  // Not the headline's first word, and not the places the pins stand on: "Hostile artillery fire targeted
  // outskirts of Kfar Shuba" and "…of Zoutar al-Sharqiya" share no name (17 Oct).
  const own = new Set(places.flatMap((p) => String(p || "").toLowerCase().split(/[\s,()-]+/)));
  const names = (s: string) => new Set((s.replace(/^\s*\S+/, "").match(/\b(?:[A-Z][\w'-]{3,}|\d+(?:st|nd|rd|th))\b/g) || []).map((w) => w.toLowerCase().replace(/^al-/, "")).filter((w) => !COMMON_NAMES.test(w) && !own.has(w)));
  const A = names(a);
  return [...names(b)].some((w) => A.has(w));
}
/** The ships a headline names: "tanker Petro Dolphin", "MT VALTHERA", "GFS Pride". */
function shipsOf(t: string): Set<string> {
  const out = new Set<string>();
  for (const m of t.matchAll(/\b(?:MT|MV|M\/T|M\/V|tanker|carrier|bulker|freighter|container ship|vessel)\s+([A-Z][\w-]*(?:\s+[A-Z][\w-]+)?)/g)) if (!/^(?:In|At|Off|Near|With|Carrying|The|A|An|Hit|Was|Is)$/.test(m[1].split(/\s+/)[0])) out.add(m[1].toLowerCase());
  for (const m of t.matchAll(/\b([A-Z][A-Z0-9]{1,}\s+[A-Z][a-z]+|[A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:tanker|container ship|ship|vessel|carrier)\b/g)) out.add(m[1].toLowerCase());
  return out;
}
function sharedWords(a: string, b: string): number {
  const A = content(a), B = content(b);
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n;
}
function sameWords(a: string, b: string): boolean {
  if (alike(a, b)) return true;
  const A = content(a), B = content(b);
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n >= 3 && n / Math.min(A.size, B.size) >= 0.5;
}
/** The same place by name, or within about a kilometre: south Lebanon's villages lie two or three apart. */
const samePlace = (k: YemenPin, p: YemenPin) => !!k.place && String(k.place).toLowerCase() === String(p.place || "").toLowerCase();
const near = (k: YemenPin, p: YemenPin) =>
  typeof k.lat === "number" && typeof p.lat === "number" &&
  ((Math.abs(k.lat - p.lat) < 0.012 && Math.abs((k.lng ?? 0) - (p.lng ?? 0)) < 0.012) || samePlace(k, p));
/** One card's pins on its several places are that many places, never one event's twins. */
const baseFp = (p: YemenPin) => String(p.fp || "").split("-pin-")[0];
const sideOk = (a?: string | null, b?: string | null) => !a || !b || a === "unclear" || b === "unclear" || a === b;
/** Saudi Arabia, north of the border: an alert, an interception and a hit there are one Houthi wave. */
const inSaudi = (p: YemenPin) => typeof p.lat === "number" && typeof p.lng === "number" && p.lng > 36 && p.lng < 52 && p.lat < 28.5 && (p.lat > 17.5 || (p.lat > 16.35 && p.lng < 43.2)) && !governorateAt(p.lat, p.lng) && !(p.lat > 24.4 && p.lng > 50.3);
const hours = (a?: string, b?: string) => Math.abs(Date.parse(String(a)) - Date.parse(String(b))) / 3600e3;

/** Blasts heard and nothing more, with no side named. */
const heardOnly = (p: FullPin) => (!p.actor || p.actor === "unclear") && /\b(?:explosions?|blasts?|booms?)\b/i.test(String(p.label || "")) && !/\b(?:kill\w*|wound\w*|injur\w*|strikes?|struck|hits?|missiles?|drones?|shell\w*)\b/i.test(String(p.label || ""));
/** Two pins that tell one event. */
export function oneEvent(k: FullPin, p: FullPin): boolean {
  if (dayOf(k.at) !== dayOf(p.at) || !sideOk(k.actor, p.actor)) return false;
  if (k.fp && baseFp(k) === baseFp(p)) return samePlace(k, p);
  const a = String(k.label || ""), b = String(p.label || "");
  const tk = targetsOf(a), tp = targetsOf(b);
  const shareTarget = [...tp].some((x) => tk.has(x));
  const ta = tollOf(a), tb = tollOf(b);
  // The same dead and wounded at the same target, wherever each outlet set it down: Aden's palace, pinned on Sanaa's (16 Oct).
  if (shareTarget && [...ta].some((x) => x[0] === "k" && tb.has(x)) && [...ta].some((x) => x[0] === "w" && tb.has(x))) return true;
  if (!near(k, p)) {
    // One telling, set down at two spots of one front (14 Oct: a commander killed "in Marib" and "on Al-Jubah, Marib").
    return typeof k.lat === "number" && typeof p.lat === "number" && kmTo(k.lat, k.lng ?? 0, p.lat, p.lng ?? 0) < 60 && sharedWords(a, b) >= 4 && sameWords(a, b) && sharesName(a, b, [String(k.place || ""), String(p.place || "")]);
  }
  if (k.url && reportKey(k.url) === reportKey(p.url)) return true;
  // South Lebanon's outlets tell each shelling within the hour, in one set of words for every village
  // ("Israeli artillery strikes X in south Lebanon"): two pins there hours apart are two attacks.
  const lebanon = (x: YemenPin) => typeof x.lat === "number" && x.lat > 33.03 && x.lat < 34.7 && (x.lng ?? 0) > 35.1 && (x.lng ?? 0) < 36.65;
  if (lebanon(k) && lebanon(p) && hours(k.at, p.at) > 1) return false;
  if (sameWords(a, b)) return true;
  const A = actionsOf(a), B = actionsOf(b);
  const shareAction = [...A].some((x) => B.has(x));
  // One target each, or two: a round of "airport, palace and camp" ties no attacks together.
  if (shareAction && shareTarget && tk.size <= 2 && tp.size <= 2) return true;
  if ([...tb].some((x) => ta.has(x) && Number(x.slice(1)) >= 2)) return true;
  const otherTargets = tk.size > 0 && tp.size > 0 && !shareTarget;
  if (k.type === p.type && k.actor && k.actor === p.actor && k.actor !== "unclear" && shareAction && !otherTargets && hours(k.at, p.at) <= 3) return true;
  // "Explosions heard in Aden", no one named, within three hours of an attack pinned there: that attack heard.
  if ((heardOnly(k) || heardOnly(p)) && hours(k.at, p.at) <= 3) return true;
  // An alert, an interception and a missile on one Saudi city within three hours: one wave.
  return inSaudi(k) && inSaudi(p) && hours(k.at, p.at) <= 3;
}

/*
 * One ship attack the outlets each tell their way, some pinned on the nearest port (17 Oct): a ship
 * attacked in the same sea within three hours is the same attack, unless the two name two ships
 * (Hormuz sees several hit in a morning).
 */
function shipTwin(a: FullPin, b: FullPin): boolean {
  if (a.type !== "vessel" || b.type !== "vessel" || hours(a.at, b.at) >= 3 || seaOf(a) !== seaOf(b) || !sideOk(a.actor, b.actor)) return false;
  if (a.fp && baseFp(a) === baseFp(b)) return samePlace(a, b);
  const A = shipsOf(String(a.label || "")), B = shipsOf(String(b.label || ""));
  return !(A.size && B.size && ![...A].some((x) => B.has(x)));
}

/** One pin per event; the first told from an outlet's own page is kept, the rest listed under it. */
export function onePinPerEvent<T extends YemenPin>(pins: T[]): T[] {
  const list = pins as (T & FullPin)[];
  // Each event gathers around its first telling: a later pin joins the event whose first pin it tells
  // again, so two attacks never join through a third report naming both. A pin with no side named
  // joins either side's event, but no event takes two sides.
  const order = list.map((_, i) => i).sort((i, j) => Date.parse(String(list[i].at)) - Date.parse(String(list[j].at)) || i - j);
  type Ev = { first: number; side: string; ids: number[] };
  const events: Ev[] = [];
  const byDay = new Map<string, Ev[]>();
  const sideOfPin = (p: FullPin) => (p.actor && p.actor !== "unclear" ? p.actor : "");
  for (const i of order) {
    const p = list[i];
    const s = sideOfPin(p);
    const d = dayOf(p.at);
    // That day's events, and the day before's for a ship attack told across midnight.
    const prev = dayOf(new Date(Date.parse(String(p.at)) - 864e5).toISOString());
    const ev = [...(byDay.get(d) ?? []), ...(byDay.get(prev) ?? [])].find((g) => {
      if (s && g.side && s !== g.side) return false;
      const f = list[g.first];
      return oneEvent(f, p) || shipTwin(f, p);
    });
    if (ev) { ev.ids.push(i); ev.side ||= s; continue; }
    const g = { first: i, side: s, ids: [i] };
    events.push(g);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(g);
  }
  const keep = new Map<number, T>();
  for (const { ids } of events) {
    // The outlet's own page first, then the pin on the most exact spot (a ship at sea, not on the port; a village, not the city), then the first told.
    const vague = (p: FullPin) => Number(relayed(p)) * 4 + (p.type === "vessel" && typeof p.lat === "number" && governorateAt(p.lat, p.lng ?? 0) ? 2 : 0) + (BROAD.has(placeKey(String(p.place || "").split(",")[0])) ? 1 : 0);
    const best = [...ids].sort((i, j) => vague(list[i]) - vague(list[j]) || Date.parse(String(list[i].at)) - Date.parse(String(list[j].at)) || i - j)[0];
    const head = list[best];
    const seen = new Set([String(head.source || "").toLowerCase()]);
    const also: Also[] = [...(head.also ?? [])];
    for (const i of ids) {
      const o = list[i];
      for (const x of [{ source: String(o.source || ""), url: String(o.url || "") }, ...(o.also ?? [])]) {
        const s = x.source.toLowerCase();
        if (!s || seen.has(s) || !x.url || /news\.google\.com/i.test(x.url)) continue;
        seen.add(s);
        also.push(x);
      }
    }
    // The pins folded into this one, so their cards can open it.
    const twins = ids.filter((i) => i !== best).map((i) => String(list[i].fp ?? "")).filter(Boolean);
    keep.set(best, (also.length || twins.length ? { ...head, ...(also.length ? { also } : {}), ...(twins.length ? { twins } : {}) } : head) as T);
  }
  // In the order served.
  return list.map((_, i) => keep.get(i)).filter((p): p is T => !!p);
}

const COUNTRIES = new Set(["Saudi Arabia", "Iran", "Yemen", "Iraq", "Israel", "Lebanon", "Oman", "UAE", "United Arab Emirates", "Qatar", "Kuwait", "Bahrain", "Syria", "Jordan", "Egypt", "Eritrea", "Djibouti", "Somalia"].map((n) => n.toLowerCase()));
/** A pin on a whole country's centre is no place at all: a tanker hit "off Saudi Arabia" sat in the Nejd desert (17 Oct). */
export function countryPin(e: YemenPin): boolean {
  return COUNTRIES.has(String(e.place || "").trim().toLowerCase());
}

/** Every district by key, for an area a label puts in one: "Taif area in Al-Durayhimi district of Hodeidah". */
const ALL_DISTRICTS = [...BY_GOV.values()].flat();
/** A place's name heard in the words: "Harib" in "Harib front", "Shada'a" in "Shada district". */
export function placeNamed(place: string | null | undefined, words: string): boolean {
  // A landmark's common words ("Old Airport", "Presidential Palace") name no place of their own.
  const names = String(place || "").split(",")[0].split(/[\s()-]+/).filter((w) => w.length >= 4 && !/^(?:district|governorate|province|city|mount|jabal|wadi|airport|palace|presidential|prison|central|camp|base|port|school|hospital|square|bridge|station|market|junction|roundabout|area)$/i.test(w));
  if (!names.length) return false;
  const heard = words.split(/[\s,.;:()]+/).map((w) => bones(placeKey(w)));
  return names.every((n) => { const b = bones(placeKey(n)); return b.length >= 3 && heard.some((h) => h === b || (b.length >= 4 && h.startsWith(b))); });
}
/** A district by its name; of two spelt alike (Saada's Adh Dhahir, Ibb's Adh Dhihar), the one in the governorate the words name, else the nearer. */
const districtByName = (name: string, words = "", lat?: number, lng?: number) => {
  const k = ALIAS[placeKey(name)] ?? placeKey(name);
  const exact = ALL_DISTRICTS.filter((d) => d.key === k);
  const list = exact.length ? exact : ALL_DISTRICTS.filter((d) => d.bones === bones(k) && d.bones.length >= 3);
  if (list.length < 2) return list[0];
  const govs = govsIn(words);
  const inGov = list.filter((d) => govs.has(d.gov) || (govs.has("YE-SA") && d.gov === "YE-SN"));
  if (inGov.length) return inGov[0];
  return typeof lat === "number" && typeof lng === "number" ? [...list].sort((a, b) => kmTo(lat, lng, a.lat, a.lng) - kmTo(lat, lng, b.lat, b.lng))[0] : list[0];
};
/**
 * A pin far from the one district its words name moves to that district (17 Oct: "Taif area in
 * Al-Durayhimi district of Hodeidah" sat on Saudi Taif; "Qa al-Haqal area of Dhwan Ans district" on Mahwit).
 */
export function areaInDistrict(e: YemenPin): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number") return null;
  const label = String(e.label || "").replace(/[’]/g, "'");
  const named = new Map<string, { name: string; lat: number; lng: number }>();
  for (const m of label.matchAll(/\b((?:[Aa][lnsdrtz]h?-)?[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)\s+(?:border\s+)?district/g)) {
    const d = districtByName(m[1], label, e.lat, e.lng);
    if (d) named.set(d.name, d);
  }
  // "Taif area in Al-Durayhimi": an area set inside a district without the word.
  const first = String(e.place || "").split(/[\s,]/)[0].replace(/[^\w'-]/g, "");
  if (!named.size && first.length >= 3 && !governorateAt(e.lat, e.lng)) {
    const m = new RegExp(String.raw`\b${first}\b(?:\s+area)?\s+(?:in|of)\s+(?:the\s+)?((?:[Aa][lnsdrtz]h?-)?[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)`).exec(label);
    const d = m ? districtByName(m[1], label, e.lat, e.lng) : undefined;
    if (d) named.set(d.name, d);
  }
  if (named.size !== 1) return null;
  const d = [...named.values()][0];
  return kmTo(e.lat, e.lng, d.lat, d.lng) > 25 ? { name: d.name, lat: d.lat, lng: d.lng } : null;
}

/** A card's extra pin on a place its words do not name, or on a province when the card has its own pin (17 Oct: Narmak and Majidieh, Tabriz and East Azerbaijan). */
export function strayExtraPins<T extends YemenPin & { url?: string | null; text?: string | null }>(pins: T[]): T[] {
  const byUrl = new Map<string, T[]>();
  for (const p of pins) {
    const k = reportKey(p.url);
    if (!k) continue;
    if (!byUrl.has(k)) byUrl.set(k, []);
    byUrl.get(k)!.push(p);
  }
  const drop = new Set<T>();
  for (const list of byUrl.values()) {
    if (list.length < 2) continue;
    const named = (p: T) => {
      const words = `${p.label || ""} ${String(p.text || "").slice(0, 400)}`;
      return String(p.place || "").split(/[\s,()-]+/).filter((w) => w.length >= 4 && !/^(?:province|governorate|district|city|north|south|east|west|shomali|jonubi|sharqi|gharbi|el|al)$/i.test(w))
        .some((w) => {
          const k = placeKey(w), b = bones(k);
          // "Yanbu" is all vowels but two: its whole key, then its consonants.
          return runsOf(words).concat(words.split(/[\s,.;:()]+/)).some((r) => placeKey(r) === k || (b.length >= 3 && bones(placeKey(r)).includes(b)));
        });
    };
    const ok = list.filter(named);
    for (const p of list) {
      if (!String(p.fp || "").includes("-pin-")) continue;
      if (/\b(?:province|governorate)\b/i.test(String(p.place || "")) || (ok.length && !ok.includes(p))) drop.add(p);
    }
  }
  return pins.filter((p) => !drop.has(p));
}

/*
 * Sites the press names that the district list has not, often pinned on their governorate's centre or
 * on a shop or library the place search found (17 Oct: "Ras Isa" on Hodeidah city, "an Aramco building"
 * on a hardware shop in Tabuk, "the Saudi capital" on a library in Mecca).
 */
const SPOTS: [RegExp, string, number, number][] = [
  [/\bRas (?:Isa|Issa|Eisa)\b/i, "Ras Isa", 15.123, 42.626],
  [/\bKamaran\b/i, "Kamaran Island", 15.36, 42.58],
  [/\b(?:Al-)?Salif\b/i, "Al-Salif", 15.31, 42.68],
  [/\b(?:Al-|As-)?Sabaha\b|\bSabahah\b/i, "Al-Sabaha, Sanaa", 15.36, 44.13],
  [/\bJabal Sabr\b|\bMount Sabr\b|\bSaber Mountain\b/i, "Jabal Sabr", 13.518, 44.052],
  [/\bJabal (?:Attan|Atan|Ettan)\b/i, "Jabal Attan, Sanaa", 15.31, 44.17],
  [/\bJabal (?:Nuqum|Nugum|Naqum)\b|\bNaqum\b/i, "Jabal Nuqum, Sanaa", 15.36, 44.24],
  [/\bMa['’]?a?shiq\b|\bMaasheeq\b/i, "Al-Maashiq Palace, Aden", 12.774, 45.04],
  [/\bAl-Anad\b/i, "Al-Anad air base", 13.18, 44.77],
  [/\bRas (?:al-)?Ara\b/i, "Ras al-Ara", 12.65, 43.91],
  [/\bSaudi capital\b/i, "Riyadh", 24.7136, 46.6753],
  [/\bAramco\b[^.]{0,40}\bDhahran\b|\bDhahran\b[^.]{0,40}\bAramco\b/i, "Dhahran", 26.29, 50.11],
];
/** A pin on a broad place, a shop or a library, or outside Yemen with only Yemen's places named, moves to the site its words name. */
export function spotPin(e: YemenPin & { text?: string | null }): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number") return null;
  const label = String(e.label || "");
  const here = placeKey(String(e.place || "").split(",")[0]);
  const shop = shopName(String(e.place || ""));
  const broad = !here || BROAD.has(here) || /\b(?:governorate|province)\b/i.test(String(e.place || "")) || shop;
  for (const [re, name, lat, lng] of SPOTS) {
    if (!re.test(label)) continue;
    if (kmTo(e.lat, e.lng, lat, lng) < 3) return null;
    // A spot moves a broad pin, or one set more than 30 km away (Ras Isa on Qaryat Isa stays).
    if (broad || kmTo(e.lat, e.lng, lat, lng) > 30) return { name, lat, lng };
  }
  return null;
}
/** A place search's hit on a shop, a library or an office: no place a report names. */
export function shopName(place: string): boolean {
  return /\b(?:shop|store|hardware|library|restaurant|hotel|pharmacy|bakery|salon|company|trading|building materials?|mall|cafe|café|office|est\.?|supermarket|clinic|showroom|workshop|agency|services|centre for|center for)\b/i.test(place);
}

/** Saudi Arabia's and the region's places, and the seas: a headline naming one is not about Yemen alone. */
const ABROAD = /\b(?:Saudi Arabia|Saudi|Riyadh|Jeddah|Jazan|Jizan|Najran|Abha|Khamis Mushait|Yanbu|Taif|Dhahran|Dammam|Mecca|Makkah|Medina|Madinah|Sharurah|Asir|Aramco|Kharj|Tabuk|Red Sea|Gulf of Aden|Arabian Sea|Eritrea|Djibouti|Somalia|Oman|UAE|Emirates|Abu Dhabi|Dubai|Israel|Eilat|Iran|Hormuz)\b/i;
/** A pin set down abroad whose words name only Yemen's governorates or fronts: the first of them (14 Oct: "Houthi shelling kills two in Jabal Sabr" sat in Riyadh). */
export function abroadPin(e: YemenPin): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number" || governorateAt(e.lat, e.lng)) return null;
  const label = String(e.label || "");
  // A ship's pin stays at sea.
  if (e.type === "vessel" || SHIP.test(label)) return null;
  if (ABROAD.test(label.replace(SAUDI_BACKED_WORDS, ""))) return null;
  const s = label.replace(/\bGulf of Aden\b/gi, "");
  let first: { at: number; iso: string } | null = null;
  for (const [iso, re] of GOVS) {
    const m = re.exec(s);
    if (m && (!first || m.index < first.at)) first = { at: m.index, iso };
  }
  for (const [re, iso] of FRONTS) {
    const m = re.exec(s);
    if (m && (!first || m.index < first.at)) first = { at: m.index, iso };
  }
  if (!first) return null;
  const g = GOVS.find(([i]) => i === first!.iso)!;
  return { name: g[4], lat: g[2], lng: g[3] };
}
const SAUDI_BACKED_WORDS = /\b(?:Saudi|coalition)[- ](?:backed|aligned|funded|supported|led)\b/gi;

/** Every rule above, in order. */
export function servePins<T extends YemenPin>(pins: T[]): T[] {
  const moved = strayExtraPins(pins.filter((e) => !notEvent(e) && !countryPin(e))).flatMap((e) => {
    const d = spotPin(e) ?? districtPin(e) ?? areaInDistrict(e) ?? namedGovPin(e) ?? abroadPin(e);
    // A shop's or an office's pin whose words name no place we know: not on the map.
    if (!d && shopName(String(e.place || ""))) return [];
    const type = pinType(e);
    return [{ ...e, ...(d ? { place: d.name, lat: d.lat, lng: d.lng } : {}), ...(type !== e.type ? { type } : {}) }];
  });
  return onePinPerEvent(moved);
}
