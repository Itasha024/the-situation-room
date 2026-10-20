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
import { PLACE_BY_NAME, placesIn } from "./gazetteer.ts";

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
      if (run.length === n && run.every((w, j) => j === 0 || /^[A-Z]/.test(w) || /^(?:al|el|as|ash|ad|ar|at|az|an)-/i.test(w) || (/^wa$/i.test(w) && j < n - 1))) out.push(run.join(" "));
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
  ...Object.fromEntries(["Al-Mudaribah", "Al-Madaribah", "Al-Modaribah", "Al-Modarba", "Mudaribah", "Madaribah", "Al-Madharabh"].map((n) => [placeKey(n), placeKey("Al Madaribah Wa Al Aarah")])),
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
  // (A funeral struck or fired on is an event: "Child wounded by Houthi gunfire during funeral".)
  const atFuneral = /\b(?:during|at|on) (?:a |the )?funeral\b|\bfuneral\s+(?:\w+\s+)?(?:hit|struck|targeted|bombed|attacked|shelled)\b/i.test(t);
  if (NOT_EVENT.test(t) || ANALYSIS.test(t) || (ASIDE.test(t) && !atFuneral) || roundup(t)) return true;
  // An operation announced with no place: "Saudi-led coalition launches wide military operation against Houthi forces".
  if (/\blaunch\w* (?:a |the |new )?(?:wide|wide-scale|large-scale|major|broad|new|full-scale)?[- ]?(?:scale )?(?:military )?(?:operation|offensive|campaign)\b/i.test(t) && !govsIn(t).size && !/\b(?:in|on|at|towards?|near|around|across)\s+(?:the\s+)?[A-Z]/.test(t)) return true;
  // What followed an attack, unless the words tell the attack too: "Air traffic suspended and explosions shake Riyadh".
  if (AFTER.test(t) && !NEW_ATTACK.test(t) && !DIRECT.test(t.split(/\b(?:following|after|days before|days after)\b/i)[0])) return true;
  if (/\bunexploded ordnance\b/i.test(t) && !/\b(?:kill\w*|wound\w*|injur\w*|dead|died)\b/i.test(t)) return true;
  // The audit of 20 Oct: a toll that rose, people fleeing, a day long gone, a "could".
  if (tollUpdate(t) || fleeingStory(t) || longAgo(t, e.at) || HYPOTHETICAL.test(t)) return true;
  return NO_FIGHT.test(t) && !FIGHT.test(t);
}
/**
 * A death toll that rose is the attack already pinned, told again (20 Oct: the Houthi strike on the Shabwa training
 * camp pinned five times as its toll went from 18 to 67), unless the words go on to a new attack ("... rises to 60
 * as coalition intercepts ballistic missile aimed at Riyadh").
 */
const TOLL = /^(?:[^:]{2,60}:\s*)?(?:the\s+)?(?:death\s+|casualty\s+)?toll\b.{0,120}?\b(?:rises?|rose|risen|climbs?|climbed|reach(?:es|ed)?|exceeds?|exceeded|jumps?|jumped|hits|tops|surpass\w*|increases?|increased|grows?|grew)\b/i;
export function tollUpdate(t: string): boolean {
  if (!TOLL.test(t)) return false;
  const rest = t.split(/\s+(?:as|while|amid|after)\s+|;\s*/i).slice(1).join(" ");
  return !(rest && DIRECT.test(rest));
}
/** A story of people fleeing (20 Oct: the Guardian's "Yemeni families flee across Bab al-Mandab to Djibouti as Houthi forces battle government troops near Mocha", 13:00): the fighting is its background, not an event at a place and time. */
export function fleeingStory(t: string): boolean {
  return /^(?:[^:]{2,60}:\s*)?(?:[\w'-]+\s+){0,3}(?:families|residents|civilians|refugees|migrants|people|thousands|hundreds|villagers|children|women)\s+(?:[\w'-]+\s+){0,2}(?:flee\w*|fled|displaced|escap\w*|cross(?:es|ed|ing)?|leav(?:e|es|ing)|left|seek\w* (?:refuge|shelter|safety))\b/i.test(t);
}
/** Words of what could or would happen, not what did: "controlling the Strait of Hormuz can affect the lives of billions" (20 Oct). */
const HYPOTHETICAL = /\b(?:can|could|would|might)\s+(?!have\b|not\s+be\s+(?:independently\s+)?(?:verified|confirmed)\b)(?:not\s+)?\w+/i;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/**
 * An event the words date two days or more before the report ("US forces destroyed an Iranian-affiliated dhow ... on 6 October",
 * told on 14 Oct; "Iran targets a non-compliant vessel ... on 9 October", told on 18 Oct): not a new event at the report's time.
 */
export function longAgo(t: string, at: string | null | undefined): boolean {
  const when = Date.parse(String(at || ""));
  if (!Number.isFinite(when)) return false;
  const m = /\bon\s+(?:(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)|(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?)\b/i.exec(t);
  if (!m) return false;
  const day = Number(m[1] ?? m[4]);
  const month = MONTHS.indexOf(String(m[2] ?? m[3]).toLowerCase());
  const year = new Date(when).getUTCFullYear();
  let then = Date.UTC(year, month, day, 12);
  if (then > when + 2 * 864e5) then = Date.UTC(year - 1, month, day, 12);
  return when - then >= 1.5 * 864e5;
}
/** A trend or its cost, told without an attack of its own: "attacks on Hormuz shipping at wartime high". */
/**
 * Told about an event, not the event (17 Oct): burials and mourning, condemnations, a threat declared
 * over, a mobilisation announced, devices defused, rifts among leaders, flights halted.
 */
const ASIDE = /\b(?:bur(?:y|ies|ied|ial)|funerals?|mourn\w*|laid to rest|condemn\w*|denounc\w*|threat (?:is )?over|all clear|announce\w* (?:a |the )?(?:national |general )?mobili[sz]ation|defus\w*|dismantl\w* (?:\w+ )?(?:IEDs?|explosive|devices?|mines?)|rifts?|defect\w*|danger (?:has )?(?:passed|removed|over)|travel warning|^moment of|food convoys?|visit\w* (?:the )?wounded|offload\w*|sends? (?:over |more than )?[\d,]+ fighters|reinforc(?:es|ed|ing) (?:its |their )?(?:\w+ )?presence|plans? to expand|carriers shift|(?:mass\w*|gather\w*) (?:\w+ ){0,3}fighters|issue\w* (?:a )?message|recruit\w*|conscript\w*|move\w* casualties|denies|denied|highlights|threat\b.{0,30}\b(?:has )?(?:ended|passed)|urges? (?:\w+ )?(?:Americans|citizens|nationals|travellers|travelers)|travel advisory|publish\w* (?:a |the )?photos?|photos? from|mine-clearing|clear\w* (?:hundreds of |dozens of )?(?:Houthi )?(?:land)?mines|launch\w* (?:a )?campaign|dig\w* (?:\w+ ){0,2}trenches|(?:defensive )?berm|on high alert|high (?:state of )?readiness|(?:return\w*|hand\w* over|recover\w*|retriev\w*|collect\w*|remov\w*) (?:[\w'’]+ ){0,4}bod(?:y|ies))\b/i;
const ANALYSIS = /\b(?:tensions? (?:surface|rise|mount|grow)\w*|stockpil\w*|wartime high|record high|raises? (?:\w+ )?concerns?|faces? (?:\w+ )?challenges|counteroffensive stalls|since (?:January|February|March|April|May|June|July|August|September|October|November|December|the war began|the start of the war)|steps? up (?:its |their )?campaign|attacks? surge|surge in attacks|shipping slows|vessels crossed|transits? (?:fell|fall|drop\w*))\b/i;
const DIRECT = /\b(?:infiltrat\w*|blow\w* up|intercept\w*|kill\w*|wound\w*|injur\w*|explosions?|launch\w*|strikes?\s+on|attacks?\s+on|bomb\w*|shell\w*|struck|hits?|advanc\w*)\b/i;

/*
 * Not an event at a place (17 Oct): what an attack led to (flights cancelled, events put off, debris
 * floating), troops moved, drills, arrests and raids on homes, praise and mediation, finds of weapons.
 */
// The damage an earlier attack did is no new attack (user, 18 Oct: SNN's "US attack caused serious damage to Bushehr airport terminal").
// Repairs and the stranded after an attack (20 Oct: "minister orders repair of Haija al-Abd culvert damaged in Houthi strike").
const AFTER = /\b(?:caused (?:\w+ ){0,2}damage|repair\w*|stranded|damage (?:caused|done|left) by|extent of (?:the )?damage|damage assessment|assess\w* (?:the )?damage|satellite (?:imagery|images?)|for (?:a )?second consecutive day|closes?|closed|closure|disruptions?|halted|halts|grounded|disruption to air navigation|no aircraft in (?:the )?airspace|flight tracking|cancels?|cancell?ed|cancellations?|suspends?|suspended|suspension|delays?|delayed|postpones?|postponed|resumes?|resumed|remains? (?:shut|closed)|reopens?|reopened|insurance|premiums?|stopped public|leak\w* fuel|float\w*|gather\w* cargo|controlled (?:explosion|detonation)|lifts?\s+(?:the\s+)?(?:emergency\s+|security\s+)?(?:alerts?|warnings?))\b/i;
const NEW_ATTACK = /\b(?:fresh|new|another|renewed)\s+(?:\w+\s+){0,2}(?:strikes?|attacks?|barrage|missiles?)\b/i;
// Threats, slogans and calls (20 Oct: "Houthi commander threatens Amjad Khaled over contacts with Taiz figures").
const NO_FIGHT = /\b(?:vows?|vowed|threatens?|threatened|slogans?|calls? on|military movements?|reinforcements?|deploys?|deployed|deployment|transfers?|transferred|mobili[sz]\w*|redeploy\w*|dispatch\w*|arrives?|arrived|drills?|exercises?|manoeuvres?|maneuvers?|parades?|graduat\w*|forms? new|leaflets?|graffiti|abduct\w*|kidnap\w*|arrests?|arrested|detains?|detained|detention|loot\w*|storms? (?:a |the )?(?:citizen'?s? )?(?:home|house)|raid (?:and \w+ )?(?:over \d+ )?(?:homes|houses)|praises?|praised|mediations?|flares?|ammunition trucks|finds?|found)\b/i;
const FIGHT = /\b(?:recaptur\w*|retak\w*|seiz\w*|advanc\w*|liberat\w*|massacre|withdraw\w*|take control|took control|strikes?|struck|hits?|attack\w*|clash\w*|kill\w*|wound\w*|injur\w*|shell\w*|repel\w*|fire[sd]?|firing|target\w*|destroy\w*|captur\w*|ambush\w*|battles?|fight\w*|besieg\w*|bomb\w*|explo\w*|expel\w*|expuls\w*|pursu\w*|clear(?:s|ed|ing)?|thwart\w*|foil\w*|decapitat\w*|executed|dead|bod(?:y|ies)|operations?)\b/i;
/** A tally or a round of the war across the land: "219 violations over 48 hours", "strikes on Sanaa, Taiz, Ibb and Saada". */
export function roundup(t: string): boolean {
  const target = targetsOf(t).size > 0;
  // "Saudi strikes hit multiple provinces", "civilian targets in Sanaa and seven provinces".
  if (!target && /\b(?:multiple|several|many|various|\d+|two|three|four|five|six|seven|eight|nine|ten)\s+(?:Yemeni\s+)?(?:provinces|governorates)\b/i.test(t)) return true;
  // A count of ships or attacks over a day or a week: "12 vessels hit in a week", "six vessels hit in one day".
  if (/\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|several|multiple)\s+(?:\w+\s+)?(?:vessels|ships|tankers|attacks|strikes)\s+(?:\w+\s+)?(?:hit|struck|targeted|attacked)?\s*in (?:a|one|the past|the last) (?:single )?(?:week|day)\b/i.test(t)) return true;
  // "Houthi forces kill second teacher in 24 hours": one event, the second of its kind.
  if (!target && !/\b(?:second|third|fourth|fifth|another)\b/i.test(t) && /\b(?:past|last|over|previous|within|in)\s+(?:the\s+)?(?:24|48|72|96|twenty-four|forty-eight|seventy-two)[\s-]*hours?\b|\b(?:past|last|over|in)\s+(?:two|three|four|few|several)\s+(?:days|weeks)\b|\b(?:past|in a|this|one)\s+week\b|\bin (?:one|a single) day\b|\bsince (?:the start|dawn|morning)\b/i.test(t)) return true;
  // A front's toll in hundreds, with no one attack named: "168 Houthi fighters killed and 210 wounded in clashes in Taiz".
  if (!target && /\b\d{3,}[\d,]*\s+(?:[\w-]+\s+){0,3}(?:killed|dead|wounded|casualties|neutrali[sz]ed)\b/i.test(t)) return true;
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
  [/\b(?:Jabal|Mount) Han\b|\bAl-Shaq[ae]?b\b|\bAl-Shuqa?b\b|\bAl-Aqro?u?dh?\b|\bAl-Sarari\b|\bJabal Sabr\b|\bAl-Hawban\b|\bAl-Dhabab\b|\bAl-Ahkum\b|\bAl-Turba[h]?\b|\bAl-Shamaya?tayn\b|\bAl-S[ai]lw\b|\b(?:Jabal|Mount) M[ou]t[r]?an\b|\bBani Yusuf\b|\bAl-Kadha\b|\bHadh?ran\b|\bAl-Wafi\b|\bJabal Habashi\b|\bAl-Ma'?a?fi[r]\b|\bAl-Mawasit\b/i, "YE-TA"],
];
/** The governorates the words name; "Gulf of Aden" is the sea, "Sanaa forces" the Houthis. */
export function govsIn(t: string): Set<string> {
  const s = String(t).replace(/\bGulf of Aden\b/gi, "");
  return new Set(GOVS.filter(([, re]) => re.test(s)).map(([iso]) => iso));
}
/*
 * The governorates the words put the event in: not where fighters come from ("fighter from Al-Dhale
 * killed at Bab al-Mandab", "Al-Dhale emergency forces commander"), where a missile was fired from, or
 * what an operation aims at ("to retake Sanaa", "towards Hodeidah") (17 Oct).
 */
export function govsWhere(t: string): Set<string> {
  // A road named by its towns is no place: "near the Aden-Taiz supply line".
  const s = String(t).replace(/\bGulf of Aden\b/gi, "").replace(/\b[\w']+(?:[-–][\w']+)+\s+(?:road|highway|supply (?:line|route)|line|route|axis)\b/gi, "");
  const out = new Set<string>();
  for (const [iso, re] of GOVS) {
    for (const m of s.matchAll(new RegExp(re.source, "gi"))) {
      const before = s.slice(Math.max(0, m.index - 40), m.index);
      const after = s.slice(m.index + m[0].length, m.index + m[0].length + 30);
      if (/\b(?:from|towards?|to (?:retake|capture|liberate|seize|take)|on the road to|single)\s+(?:the\s+)?(?:\w+\s+)?$/i.test(before) && !/\b(?:in|at|on)\s+$/i.test(before)) continue;
      if (/^['’]?\s*(?:emergency|fighters?|commanders?|forces|soldiers?|tribes?|tribesmen|buries|governor\b|security|defen[cs]e|natives?|sons?|youths?|students?|men)\b/i.test(after)) continue;
      out.add(iso);
      break;
    }
  }
  return out;
}
const kmTo = (lat: number, lng: number, a: number, b: number) => Math.hypot((lat - a) * 111, (lng - b) * 111 * Math.cos((lat * Math.PI) / 180));
/** A place the desk's own gazetteer knows by this name. */
const known = (place: string | null | undefined) => !!PLACE_BY_NAME[String(place || "")];

/** A pin set down far from the one governorate its words name moves there: to the district they name in it, else its centre. */
export function namedGovPin(e: YemenPin & { text?: string | null }): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number") return null;
  // A ship stays at sea; a pin abroad whose words name the place abroad stays.
  if (e.type === "vessel") return null;
  const label = String(e.label || "");
  if (!governorateAt(e.lat, e.lng) && ABROAD.test(label.replace(SAUDI_BACKED_WORDS, ""))) return null;
  let named = govsWhere(label);
  // Taiz's fronts the press names alone are near the city: a closer test than a governorate's name.
  const front = !named.size && FRONTS.some(([re]) => re.test(label));
  if (front) named = new Set(FRONTS.filter(([re]) => re.test(label)).map(([, iso]) => iso));
  if (named.size !== 1) return null;
  const iso = [...named][0];
  const at = governorateAt(e.lat, e.lng);
  // Sanaa city sits inside Sanaa governorate.
  if (at === iso || (iso === "YE-SA" && at === "YE-SN")) return null;
  const list = [...(BY_GOV.get(iso) ?? []), ...(iso === "YE-SA" ? BY_GOV.get("YE-SN") ?? [] : [])];
  const nearest = Math.min(...list.map((d) => kmTo(e.lat!, e.lng!, d.lat, d.lng)));
  if (nearest < (front ? 15 : 40)) return null;
  // A place the words name themselves stays, when the desk knows it or it lies within 60 km:
  // "Bab al-Mandab complex in Lahj", "the Harib front in Shabwa", "Bab al-Mandab and Razih in Saada".
  if (placeNamed(e.place, label) && (known(e.place) || nearest <= 60)) return null;
  // A district of that governorate the words name.
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
// Kept per time: the pins' pairs ask it for the same times again and again (20 Oct, the site's processor time).
const daysOf = new Map<string, string>();
const dayOf = (at?: string): string => {
  if (!at) return "";
  let d = daysOf.get(at);
  if (d === undefined) {
    d = new Date(Date.parse(at) + 3 * 3600e3).toISOString().slice(0, 10);
    if (daysOf.size > 50_000) daysOf.clear();
    daysOf.set(at, d);
  }
  return d;
};

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
  ["air", /\b(?:air ?strikes?|air ?raids?|airstrikes?|warplanes?|fighter jets?|aircraft|raids?|cluster bombs?)\b|\b(?:Saudi|coalition|Saudi-led coalition|Israeli|US)\s+(?:\w+\s+)?strikes?\b/i],
  ["missile", /\b(?:missiles?|ballistic|rockets?|projectiles?|barrage)\b/i],
  ["drone", /\b(?:drones?|UAVs?)\b/i],
  ["shell", /\b(?:shell\w*|artillery|mortars?|snip\w*|gunfire|machine-?guns?|tank fire)\b/i],
  ["ground", /\b(?:counter\w*|clash\w*|assault\w*|offensive|advance\w*|repel\w*|repuls\w*|infiltrat\w*|battles?|fighting|storm\w*|captur\w*|retak\w*|seiz\w*|ambush\w*|thwart\w*|foil\w*|incursion)\b/i],
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
const baseFp = (p: YemenPin) => {
  const fp = String(p.fp || "");
  const i = fp.indexOf("-pin-");
  return i < 0 ? fp : fp.slice(0, i);
};
const sideOk = (a?: string | null, b?: string | null) => !a || !b || a === "unclear" || b === "unclear" || a === b;
/** Saudi Arabia, north of the border: an alert, an interception and a hit there are one Houthi wave. */
const inSaudi = (p: YemenPin) => typeof p.lat === "number" && typeof p.lng === "number" && p.lng > 36 && p.lng < 52 && p.lat < 28.5 && (p.lat > 17.5 || (p.lat > 16.35 && p.lng < 43.2)) && !governorateAt(p.lat, p.lng) && !(p.lat > 24.4 && p.lng > 50.3);
const hours = (a?: string, b?: string) => Math.abs(Date.parse(String(a)) - Date.parse(String(b))) / 3600e3;

/** The places a headline says were taken: "capture Bab al-Mandab and Mayun island" gives bab al-mandab, mayun. */
function taken(t: string): Set<string> {
  const out = new Set<string>();
  for (const m of t.matchAll(/\b(?:captur\w*|recaptur\w*|seiz\w*|retak\w*|tak\w* (?:full )?control of|took (?:full )?control of|control of|clear\w*|secur\w*|liberat\w*)\s+((?:the\s+)?[A-Z][\w'-]+(?:[\s-]+(?:al-)?[A-Z][\w'-]+)?(?:\s+(?:and|,)\s+[A-Z][\w'-]+(?:[\s-]+(?:al-)?[A-Z][\w'-]+)?)*)/g)) {
    for (const n of m[1].split(/\s+and\s+|,\s*/)) {
      const k = n.replace(/^the\s+/i, "").replace(/\s+(?:island|strait|district|front|camp|airport|city)$/i, "").trim().toLowerCase();
      if (k.length >= 4 && !/^(?:houthi|houthis|government|saudi|the)$/.test(k)) out.add(k);
    }
  }
  return out;
}
/** Blasts heard and nothing more, with no side named. */
const heardOnly = (p: FullPin) => (!p.actor || p.actor === "unclear") && /\b(?:explosions?|blasts?|booms?)\b/i.test(String(p.label || "")) && !/\b(?:kill\w*|wound\w*|injur\w*|strikes?|struck|hits?|missiles?|drones?|shell\w*)\b/i.test(String(p.label || ""));
/**
 * A label's targets, tolls, captures and actions, read once per label (20 Oct: every pair of pins read
 * both labels' again, the site's processor time on the small server). Read-only sets.
 */
const keptSets = new Map<(t: string) => Set<string>, Map<string, Set<string>>>();
function kept(f: (t: string) => Set<string>, t: string): ReadonlySet<string> {
  let m = keptSets.get(f);
  if (!m) keptSets.set(f, (m = new Map()));
  let s = m.get(t);
  if (!s) {
    s = f(t);
    if (m.size > 20_000) m.clear();
    m.set(t, s);
  }
  return s;
}
/** Two pins that tell one event. */
export function oneEvent(k: FullPin, p: FullPin): boolean {
  // One card's two pins moved onto one spot are one pin, whatever side each part of its sentence reads as.
  if (k.fp && baseFp(k) === baseFp(p)) return samePlace(k, p) || (near(k, p) && dayOf(k.at) === dayOf(p.at));
  if (dayOf(k.at) !== dayOf(p.at) || !sideOk(k.actor, p.actor)) return false;
  const a = String(k.label || ""), b = String(p.label || "");
  const tk = kept(targetsOf, a), tp = kept(targetsOf, b);
  const shareTarget = [...tp].some((x) => tk.has(x));
  const ta = kept(tollOf, a), tb = kept(tollOf, b);
  // The same dead and wounded at the same target, wherever each outlet set it down: Aden's palace, pinned on Sanaa's (16 Oct).
  if (shareTarget && [...ta].some((x) => x[0] === "k" && tb.has(x)) && [...ta].some((x) => x[0] === "w" && tb.has(x))) return true;
  // One side's capture of one place, told all day ("capture Bab al-Mandab strait and Mayun island",
  // "announce clearing Bab al-Mandab and Mayun island", "Giants recapture Mayun island", 10 Oct).
  const ca = kept(taken, a), cb = kept(taken, b);
  if (k.actor && k.actor === p.actor && k.actor !== "unclear" && [...ca].some((x) => cb.has(x)) && typeof k.lat === "number" && typeof p.lat === "number" && kmTo(k.lat, k.lng ?? 0, p.lat, p.lng ?? 0) < 60) return true;
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
  const A = kept(actionsOf, a), B = kept(actionsOf, b);
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
      const f = list[g.first];
      if (s && g.side && s !== g.side && !(f.fp && baseFp(f) === baseFp(p))) return false;
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
      // Listed under the pin only when its report names the pin's own place, within three hours (the link
      // audit of 17 Oct: a quarter of the outlets listed told another front's fight or another city's alert).
      if (i !== best && !(samePlace(o, head) || placeNamed(head.place, String(o.label || ""))) ) continue;
      if (i !== best && hours(o.at, head.at) > 3 && !samePlace(o, head)) continue;
      for (const x of [{ source: String(o.source || ""), url: String(o.url || "") }, ...(i === best ? [] : (o.also ?? []))]) {
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

const COUNTRIES = new Set(["The Kingdom", "Kingdom", "Saudi Arabia", "Iran", "Yemen", "Iraq", "Israel", "Lebanon", "Oman", "UAE", "United Arab Emirates", "Qatar", "Kuwait", "Bahrain", "Syria", "Jordan", "Egypt", "Eritrea", "Djibouti", "Somalia"].map((n) => n.toLowerCase()));
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
  const heard = words.split(/[\s,.;:()-]+/).map((w) => placeKey(w));
  // The whole name, or its consonants when there are four or more ("Maran" is not "Amran").
  // Most of a long name will do: "King Khalid airport" names King Khalid International Airport.
  const hits = names.filter((n) => {
    const k = placeKey(n), b = bones(k);
    return heard.some((h) => h === k || (b.length >= 4 && (bones(h) === b || bones(h).startsWith(b))));
  }).length;
  return hits >= Math.ceil(names.length / 2) && hits > 0;
}
/** A district by its name; of two spelt alike (Saada's Adh Dhahir, Ibb's Adh Dhihar), the one in the governorate the words name, else the nearer. */
const districtByName = (name: string, words = "", lat?: number, lng?: number) => {
  const k = ALIAS[placeKey(name)] ?? placeKey(name);
  const exact = ALL_DISTRICTS.filter((d) => d.key === k);
  const list = exact.length ? exact : ALL_DISTRICTS.filter((d) => d.bones === bones(k) && d.bones.length >= 4);
  const govs = govsIn(words);
  const inGov = list.filter((d) => govs.has(d.gov) || (govs.has("YE-SA") && d.gov === "YE-SN"));
  if (inGov.length) return inGov[0];
  // Spelt only alike, in another governorate than the words name: no match (17 Oct: Taiz's Al-Hujariyah is not Hadramawt's Hajar).
  if (!exact.length && govs.size) return undefined;
  if (list.length < 2) return list[0];
  return typeof lat === "number" && typeof lng === "number" ? [...list].sort((a, b) => kmTo(lat, lng, a.lat, a.lng) - kmTo(lat, lng, b.lat, b.lng))[0] : list[0];
};
/**
 * A pin far from the one district its words name moves to that district (17 Oct: "Taif area in
 * Al-Durayhimi district of Hodeidah" sat on Saudi Taif; "Qa al-Haqal area of Dhwan Ans district" on Mahwit).
 */
export function areaInDistrict(e: YemenPin): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number") return null;
  if (e.type === "vessel") return null;
  const label = String(e.label || "").replace(/[’]/g, "'");
  const named = new Map<string, { name: string; lat: number; lng: number; gov?: string }>();
  // "Taif area in Al-Durayhimi (district)": the pin's own place set inside a district.
  const first = String(e.place || "").split(",")[0].replace(/^(?:al|el|ad|as|ash|ar|at|az|an)[- ]/i, "").split(/\s/)[0].replace(/[^\w'-]/g, "");
  // (Not "Harib in Marib": a governorate's name is no district; not a place the desk knows in Yemen.)
  // (A known place moves only when the words put it in another governorate: "Al-Suwayda in Hayfan south of Taiz".)
  const home = governorateAt(e.lat, e.lng);
  const wordsGovs = govsWhere(label);
  const homeKnown = known(e.place) && !!home && (!wordsGovs.size || wordsGovs.has(home));
  if (first.length >= 3 && !homeKnown) {
    const m = new RegExp(String.raw`\b${first}\b(?:\s+area)?\s+(?:in|of)\s+(?:the\s+)?((?:[Aa][lnsdrtz]h?-)?[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)`).exec(label);
    const d = m && !govsIn(m[1]).size ? districtByName(m[1], label, e.lat, e.lng) : undefined;
    if (d) named.set(d.name, d);
  }
  // A pin whose own place the words name, beside other districts, stays ("Kamaran island and Al-Qanawis district").
  const broad = BROAD.has(placeKey(String(e.place || "").split(",")[0]));
  if (!named.size && (broad || !placeNamed(e.place, label))) {
    for (const m of label.matchAll(/\b((?:[Aa][lnsdrtz]h?-)?[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)\s+(?:border\s+)?district/g)) {
      const d = districtByName(m[1], label, e.lat, e.lng);
      if (d) named.set(d.name, d);
    }
  }
  if (named.size !== 1) return null;
  const d = [...named.values()][0];
  const govs = govsWhere(label);
  if (govs.size && d.gov && !govs.has(d.gov) && !(govs.has("YE-SA") && d.gov === "YE-SN")) return null;
  // A pin in a governorate the words name does not leave it for a district of another.
  const at = governorateAt(e.lat, e.lng);
  if (at && govs.has(at) && d.gov && d.gov !== at) return null;
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
  // "Jabal Naman overlooks supply lines between Al-Wazi'iyah and Al-Modarba" (25 Sep): on the Lahj–Taiz line west of Al-Subayhah.
  [/\b(?:Jabal|Mount) N(?:a|u|ou)ma?ne?\b|\bN(?:ou|u)mane? mountain/i, "Jabal Naman", 13.03, 43.84],
  // Yemen's "western coast" front, not Saudi Arabia's west coast; Saudi Arabia's Eastern Province oil region.
  [/\b(?:western coast(?:al)?(?: fronts?)?|West(?:ern)? Coast(?: front)?|western coastal)\b/i, "Yemen's west coast (Mocha)", 13.32, 43.25],
  [/\bEastern Province\b/i, "Eastern Province, Saudi Arabia", 26.1, 49.9],
  [/\bAramco\b[^.]{0,40}\bDhahran\b|\bDhahran\b[^.]{0,40}\bAramco\b/i, "Dhahran", 26.29, 50.11],
];
/** A pin on a broad place, a shop or a library, or outside Yemen with only Yemen's places named, moves to the site its words name. */
export function spotPin(e: YemenPin & { text?: string | null }): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number") return null;
  const label = String(e.label || "");
  const here = placeKey(String(e.place || "").split(",")[0]);
  const shop = shopName(String(e.place || ""));
  const broad = !here || BROAD.has(here) || /\b(?:governorate|province)\b/i.test(String(e.place || "")) || shop;
  // A village or town the words name is the pin's own place: it stays ("Ras Isa and As-Sabahah", "Kamaran island").
  if (!broad && placeNamed(e.place, label)) return null;
  const at = governorateAt(e.lat, e.lng);
  // A pin the place search lost: a shop, a garbled name, or abroad on a place the words do not name.
  const lost = shop || garbled(String(e.place || "")) || (!at && !placeNamed(e.place, label));
  const spots = SPOTS.filter(([re, name]) => re.test(label) && (lost || !LOST_ONLY.has(name)));
  if (!spots.length) return null;
  // One near already: it stays.
  if (spots.some(([, , lat, lng]) => kmTo(e.lat!, e.lng!, lat, lng) < 30)) return null;
  for (const [, name, lat, lng] of spots) {
    // A governorate's centre moves only to a site in that governorate ("Sanaa and Ras Isa" is two places).
    // (A site on the shore, outside the drawn coastline, counts as its nearest governorate's within 100 km.)
    const g = governorateAt(lat, lng);
    const same = g ? g === at || (at === "YE-SN" && g === "YE-SA") || (at === "YE-SA" && g === "YE-SN") : kmTo(e.lat, e.lng, lat, lng) <= 100;
    if (broad && !shop && at && !same) continue;
    return { name, lat, lng };
  }
  return null;
}
/**
 * A pin on a district's name set down far from that district (22 Sep: Razih at 16.15 N, 90 km from Saada's
 * Razih), or on a garbled name ("Mdrsa" for a school in Al-Modarba) whose words name a district: that district.
 * Only a name one district bears and the desk's gazetteer does not place elsewhere.
 */
export function misplacedDistrict(e: YemenPin): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number" || e.type === "vessel") return null;
  const place = String(e.place || "").replace(/\s+district$/i, "");
  if (PLACE_BY_NAME[place]) return null;
  const label = String(e.label || "");
  // Never into another governorate than the words name ("Al-Wadi district in Marib" is not Abyan's Al Wadi').
  const govs = govsWhere(label);
  const fits = (d: { gov: string }) => !govs.size || govs.has(d.gov) || (govs.has("YE-SA") && d.gov === "YE-SN");
  const k = ALIAS[placeKey(place)] ?? placeKey(place);
  const same = ALL_DISTRICTS.filter((d) => d.key === k);
  if (same.length === 1 && placeNamed(e.place, label) && fits(same[0]) && kmTo(e.lat, e.lng, same[0].lat, same[0].lng) > 25) return same[0];
  if (!garbled(String(e.place || ""))) return null;
  // The district the garbled name itself spells ("Al-Skn Hrf Sfyan" is Harf Sufyan), then one its words name.
  const b = bones(placeKey(String(e.place || "")));
  const inName = ALL_DISTRICTS.filter((d) => d.bones.length >= 4 && b.includes(d.bones) && fits(d));
  if (inName.length === 1 && kmTo(e.lat, e.lng, inName[0].lat, inName[0].lng) > 15) return inName[0];
  for (const run of runsOf(label)) {
    const key = ALIAS[placeKey(run)] ?? placeKey(run);
    const d = ALL_DISTRICTS.filter((x) => x.key === key);
    if (d.length === 1 && fits(d[0]) && kmTo(e.lat, e.lng, d[0].lat, d[0].lng) > 15) return d[0];
  }
  return null;
}
/** The site within 5 km, else the district within 20 km, a garbled name stands for. */
function plainName(e: YemenPin): string | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number") return null;
  const spot = SPOTS.find(([, , lat, lng]) => kmTo(e.lat!, e.lng!, lat, lng) < 5);
  if (spot) return spot[1];
  const gov = governorateAt(e.lat, e.lng);
  const d = ALL_DISTRICTS.filter((x) => !gov || x.gov === gov).map((x) => ({ x, km: kmTo(e.lat!, e.lng!, x.lat, x.lng) })).sort((a, b) => a.km - b.km)[0];
  return d && d.km < 20 ? d.x.name : null;
}
/** Sites that only take a pin the place search lost ("western coastal fronts" in Saudi Arabia's west). */
const LOST_ONLY = new Set(["Yemen's west coast (Mocha)", "Eastern Province, Saudi Arabia"]);
/** A place name the place search spelt without its vowels: "Qma Jbl Sbr", "Al-Shrqyh", "Fndhkh". */
export function garbled(place: string): boolean {
  return String(place).split(/[\s,()'`-]+/).some((w) => w.length >= 3 && !/[aeiouAEIOU]/.test(w) && !/^[A-Z0-9]+$/.test(w));
}
/** A place search's hit on a shop, a library or an office: no place a report names. */
export function shopName(place: string): boolean {
  return /\b(?:shop|store|hardware|library|restaurant|hotel|pharmacy|bakery|salon|company|trading|building materials?|mall|cafe|café|office|est\.?|supermarket|clinic|showroom|workshop|agency|services|centre for|center for)\b/i.test(place);
}

/**
 * A Houthi attack on Saudi Arabia set down in Yemen, where it was fired from (17 Oct: "Houthi forces
 * launched ballistic missiles and drones at Aramco in Riyadh and Khurais" sat in Amran): the first
 * Saudi place its words name, when they name no governorate of Yemen as the place hit.
 */
export function saudiTargetPin(e: YemenPin): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number" || !governorateAt(e.lat, e.lng) || e.type === "vessel") return null;
  const label = String(e.label || "");
  if (govsWhere(label).size || placeNamed(e.place, label)) return null;
  if (!/\b(?:missiles?|drones?|ballistic|strikes?|attacks?|target\w*|hit)\b/i.test(label)) return null;
  const saudi = placesIn(label).find((p) => p.country === "Saudi Arabia");
  return saudi ? { name: saudi.name, lat: saudi.lat, lng: saudi.lng } : null;
}

/**
 * A ship "60 nautical miles south of Mocha" set down on Mocha: moved out to sea by the distance and
 * bearing its words give (the page did this for cards; the pins kept the town, 5 Oct).
 */
const BEARING: Record<string, [number, number]> = { north: [1, 0], south: [-1, 0], east: [0, 1], west: [0, -1], northeast: [0.707, 0.707], northwest: [0.707, -0.707], southeast: [-0.707, 0.707], southwest: [-0.707, -0.707] };
export function offshorePin(e: YemenPin): { lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number") return null;
  const label = String(e.label || "");
  if (e.type !== "vessel" && !SHIP.test(label)) return null;
  // Only a pin still on the land (one put out to sea already stays).
  const known = PLACE_BY_NAME[String(e.place || "")];
  if (!governorateAt(e.lat, e.lng) && !(known && known.country !== "sea" && kmTo(e.lat, e.lng, known.lat, known.lng) < 5)) return null;
  const m = /\b(\d{1,3}(?:\.\d+)?)\s*(nautical miles?|nm|miles?|km|kilomet(?:re|er)s?)\s+(north|south|east|west)[- ]?(east|west)?\s+of\b/i.exec(label);
  if (!m) return null;
  const km = Number(m[1]) * (/^n/i.test(m[2]) ? 1.852 : /^mile/i.test(m[2]) ? 1.609 : 1);
  const b = BEARING[(m[3] + (m[4] ?? "")).toLowerCase()];
  if (!b || km > 400) return null;
  return { lat: e.lat + (b[0] * km) / 111, lng: e.lng + (b[1] * km) / (111 * Math.cos((e.lat * Math.PI) / 180)) };
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
  // Where the event is, not where its fighters come from ("Shabwa Defence forces").
  const where = govsWhere(s);
  for (const [iso, re] of GOVS) {
    const m = re.exec(s);
    if (m && where.has(iso) && (!first || m.index < first.at)) first = { at: m.index, iso };
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

/**
 * A place for a card stored with none (17 Oct: 1,775 strike, fight and ship cards since 18 Sep had no
 * pin, "Saudi Arabia strikes Haifan directorate in Taiz", "Houthi forces take control of Mount Rasin in
 * Taiz"): from its own headline, by the rules above — a site, a Saudi place a Houthi attack hit, a place
 * the desk knows inside the governorate named, a district, a Taiz front, else the one governorate named.
 * Null when the words name none, or tell no event.
 */
export function placeFromWords(label: string, type?: string | null): { name: string; lat: number; lng: number } | null {
  const t = String(label || "");
  if (!t || notEvent({ label: t })) return null;
  const spot = SPOTS.find(([re, name]) => re.test(t) && !LOST_ONLY.has(name));
  if (spot) return { name: spot[1], lat: spot[2], lng: spot[3] };
  const govs = govsWhere(t);
  const known = placesIn(t).filter((p) => p.kind !== "governorate" && p.kind !== "country" && p.kind !== "sea");
  // A Houthi attack on Saudi Arabia: the Saudi place hit.
  // (Not the bases a raid flew from: "Saudi warplanes launched from Khamis Mushait and Taif bases".)
  const saudi = known.find((p) => p.country === "Saudi Arabia" && !new RegExp(String.raw`\b(?:from|off from)\s+(?:the\s+)?${p.name}`, "i").test(t));
  if (saudi && !govs.size && !/\b(?:launched|took off|taking off|flew|flying|strikes?)\s+from\b/i.test(t) && /\b(?:Houthi|Yemeni|missiles?|drones?|ballistic|intercept\w*|alerts?|sirens?|explosions?)\b/i.test(t)) return { name: saudi.name, lat: saudi.lat, lng: saudi.lng };
  const yemen = known.filter((p) => p.country === "Yemen" && (!govs.size || govs.has(governorateAt(p.lat, p.lng) ?? "")));
  if (yemen.length) return { name: yemen[0].name, lat: yemen[0].lat, lng: yemen[0].lng };
  for (const run of runsOf(t)) {
    const k = ALIAS[placeKey(run)] ?? placeKey(run);
    const d = ALL_DISTRICTS.filter((x) => x.key === k && !BROAD.has(x.key) && (!govs.size || govs.has(x.gov) || (govs.has("YE-SA") && x.gov === "YE-SN")));
    if (d.length === 1) return { name: d[0].name, lat: d[0].lat, lng: d[0].lng };
  }
  if (type === "vessel") return null;
  if (!govs.size && FRONTS.some(([re]) => re.test(t))) return { name: "Taiz", lat: 13.58, lng: 44.02 };
  if (govs.size === 1) {
    const g = GOVS.find(([i]) => govs.has(i))!;
    return { name: g[4], lat: g[2], lng: g[3] };
  }
  return null;
}

/** Every rule above, in order. */
export function servePins<T extends YemenPin>(pins: T[]): T[] {
  const moved = strayExtraPins(pins.filter((e) => !notEvent(e) && !countryPin(e))).flatMap((e) => {
    const d = spotPin(e) ?? saudiTargetPin(e) ?? districtPin(e) ?? areaInDistrict(e) ?? misplacedDistrict(e) ?? namedGovPin(e) ?? abroadPin(e);
    // A shop's or an office's pin whose words name no place we know: not on the map.
    if (!d && shopName(String(e.place || ""))) return [];
    // Abroad, for an event its words put "in Yemen" without a place: no place to pin
    // ("Pakistani fighter jets targeted Houthi targets in Yemen as part of Mecca alliance" sat on Mecca).
    if (!d && typeof e.lat === "number" && !governorateAt(e.lat, e.lng ?? 0) && /\bin Yemen\b/i.test(String(e.label || "")) && !/\b(?:Houthi|Yemeni)\s+(?:\w+\s+)?(?:missiles?|drones?|attacks?|strikes?)\b/i.test(String(e.label || ""))) return [];
    const type = pinType(e);
    const at = { ...e, ...(d ? { place: d.name, lat: d.lat, lng: d.lng } : {}), ...(type !== e.type ? { type } : {}) };
    const sea = offshorePin(at);
    const moved = sea ? { ...at, ...sea } : at;
    // A garbled name the place search gave ("Qma Jbl Sbr") is shown as the site or district it lies in.
    const name = garbled(String(moved.place || "")) ? plainName(moved) : null;
    return [name ? { ...moved, place: name } : moved];
  });
  return onePinPerEvent(moved);
}
