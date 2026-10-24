/**
 * Copy rules from the review of 18 Oct (the latest 400 cards per desk; notes
 * in review-18oct-findings.md). Each kind of fault the review found is a rule
 * here, used twice: on a new card (editor.ts decide/decideIran turn it away or
 * fix it) and, where it is safe, on a stored card as it is served
 * (`serveCard`, from /api/desk). Duplicates are copies.ts's, not these.
 */
import { anglicise } from "./anglicise.ts";
import type { DeskType } from "./digest.ts";
import type { DeskId } from "../desks.ts";
import { gazaWords } from "./gaza-words.ts";
import { arenaSourceRule } from "./gaza-sourcing.ts";
import { aboutFootage } from "./media.ts";
import { FIRST_FOOTAGE_RE } from "./pin-rule.ts";
import { respell } from "./spelling.ts";
import { isWireSource, officialVoice, sourceNation, subjectNation } from "./speaker-press.ts";

/* ------------------------------------------------------------------ *
 * Non-news: analysis, market wraps, price ticks, round-ups, Friday
 * prayers, rhetoric, features, protocol, old news, off-topic items.
 * ------------------------------------------------------------------ */

/** "Brent crude oil price reaches $110", "Oil prices ease but head for another weekly gain", "Exchange rate: dollar price announced". */
const PRICE_TICK =
  /^(?:(?:Brent|WTI)(?: crude)?(?: oil)?|(?:crude )?oil)(?: prices?| futures)? (?:reach|reaches|reached|exceeds?|hits?|tops?|rises?|rose|falls?|fell|drops?|climbs?|pass(?:es)?|cross(?:es)?|stands?|stays?|eases?|heads?|edges?|slips?|jumps?|surges?|holds?|steadies|extends?|dips?|gains?|retreats?|declines?|soars?|is at|at \$)\b|^Exchange rate\b|\bdollar (?:price|rate) (?:announced|in|at|reaches)\b|\b(?:gold|coin) prices?\b/i;
/** Market wraps: "WTI outpaces Brent as US crude draw ignites fresh buying", "Dubai crude spreads hit six-month low". */
const MARKET_WRAP = /\b(?:Brent|WTI)\b[^.]{0,60}\b(?:weekly|outpaces?|futures)\b|\bcrude spreads?\b|\b(?:tanker|freight|charter) rates\b|\bweekly (?:gain|loss|rise|drop)\b|\bstocks? (?:rise|fall|close|open|rally|slide)\b/i;
/** An economy card that forecasts or sums up: "Sanctions relief unlikely to ease tanker crisis", "US war has cost average household almost $2,000". */
const ECON_ANALYSIS = /\b(?:unlikely|likely|expected|poised) to\b|\bcould\b|\bmight\b|\bhas cost\b|\bcost (?:the )?average\b|\btrade (?:hits|reaches) (?:a )?record\b/i;
/** "Summary of recent maritime attacks in the region". */
const ROUNDUP = /^(?:summary|round-?up|recap|wrap-?up|digest|timeline)\b|\bsummary of (?:recent|the latest|today'?s|the day'?s|the week'?s|events)\b|\b(?:round-?up|recap) of\b/i;
/** Friday-prayer imams (293, 308): a sermon is not a report, whatever it praises. */
const FRIDAY = /\bFriday[- ]prayers?\b|\bFriday (?:sermon|imam)\b|\bprayer (?:leader|imam)\b/i;
/** Rhetoric with nothing new in it (72, 76, 79, 343, 391; Yemen 31). */
const RHETORIC =
  /\bon (?:high|full|maximum) alert to (?:respond|counter|confront)\b|\b(?:respond|counter|confront) (?:to )?any (?:threats?|aggression)\b|\bunity and cohesion\b|\bmany achievements\b|\bwaged war on Yemen for\b|\bdepends on one person\b/i;
/** Clerics and tribes declaring mobilisation or support (Yemen 106, 234, 242, 289). */
const CLERICS_TRIBES =
  /\btribes?\b[^.:]{0,60}\b(?:declares?|announces?|affirms?|reaffirms?|supports?|pledges?|mobili[sz]ation)\b|\btribal (?:figure|sheikh|leader|elder)s?\b|\b(?:Association|League|Council|Union) of (?:Muslim )?(?:Scholars|Ulema|Clerics)\b/i;
/** Protocol: condolences, attending a session, "discusses regional developments with X counterpart" (Yemen 12, 273, 308, 150). */
const PROTOCOL =
  /\b(?:offers?|sends?|extends?) condolences\b|\bcondolences? (?:on|over|for)\b|\battends? (?:the )?(?:[\w-]+ ){0,5}?(?:session|opening|meeting|summit|conference|ceremony)\b|\bdiscuss(?:es|ed)? (?:the )?(?:latest |regional |bilateral |mutual )+(?:developments|relations|ties|cooperation|security|issues)(?: (?:with|in) [^,;:]{0,50})?$/i;
/** Features: "Riyadh pet owners seek advice…", "survivor … recalls", "…: Why a global trade route is at risk". */
const FEATURE = /\bpet owners?\b|\b(?:survivor|witness|resident)s?\b[^.:]{0,60}\brecalls?\b|(?::|^) ?Why\b[^.]{0,90}$|^How\b/i;
/** Old news retold: a letter to a man dead since 2024, satellite pictures of damage done before. */
const OLD_NEWS = /\b(?:message|letter|cable) to (?:Yahya )?Sinwar\b|\b(?:message|letter) to (?:Hassan )?Nasrallah\b|\bsatellite (?:imagery|images|pictures|photos) (?:shows?|reveals?) (?:the )?damage\b/i;
/** Off-topic on either desk: quakes, weather, executions for crime, blood drives (Yemen 166, 347, 215, 136). */
const OFF_TOPIC =
  /\bearthquakes?\b|\bthunderstorms?\b|\bweather (?:centre|center|forecast|warning)\b|\bmeteorolog\w*|\brain(?:fall|s)?\b(?! of)|\bflash floods?\b|\bexecut(?:es|ed)\b[^.]{0,40}\b(?:citizens|convicts|men|people)\b|\bblood donation\b/i;
const WAR_WORD = /\b(?:missiles?|drones?|strikes?|air ?strikes?|attacks?|shell\w*|explosions?|killed|wounded|Houthis?|Israel\w*|US|war|blockade|Hormuz|spy|spies|espionage)\b/i;
/** Commentary by role or by a commentator the desk knows (Yemen 51, 123, 252, 317, 325, 337, 357, 365, 376; Iran 123, 357). */
// Round 4 of 20 Oct: "Former UK defence secretary Michael Fallon:", "Former Iranian MP:", "Sanaa Center head:" (a think tank).
const COMMENTATOR_LEAD =
  /^(?:[^:]{0,50}\b)?(?:analysts?|commentators?|researchers?|writers?|journalists?|columnists?|experts?|academics?|professors?|ex-PM|think[- ]tanks?|(?:research|studies|strategic|policy) (?:center|centre|institute)|Sanaa Center|former (?:\w+ ){0,2}?(?:prime minister|PM|minister|official|ambassador|general|officer|envoy|president|diplomat|secretary|MP|lawmaker|parliamentarian|governor|commander))\b[^:]{0,50}:/i;
const COMMENTATORS = /\bex-PM\b|\b(?:Citrinowicz|Andreas (?:Craig|Krieg)|Nusbacher|Khalid Al-Nasi|Ali al-Asali)\b/i;
const COMMENTATOR_BODY = /^[^.]{0,80}\b(?:(?:a|an) (?:former (?:\w+ ){0,3}?(?:officer|official|minister|diplomat|general|ambassador|governor|MP|lawmaker)|analyst|researcher|commentator|military expert|writer|journalist|fellow at)|^former (?:\w+ ){0,2}?(?:ambassador|minister|official|diplomat|governor|MP|lawmaker))\b/i;
/** A paper's editorial or a column, told in the body (20 Oct: Okaz's editorial "a final alarm bell for all Yemenis"). */
const EDITORIAL = /^[^.]{0,140}\b(?:in (?:an?|its) (?:editorial|op-ed|opinion (?:piece|column)|column)|editorial (?:said|says|argued|argues|wrote|writes))\b/i;
/** Sport between the warring countries is not the war (20 Oct: "Yemen faces Saudi Arabia in Gulf U-17 clash in Doha"). */
const SPORT = /\b(?:football|soccer|futsal|U-?1[5-9]|U-?2[0-3]|under-1[5-9]|under-2[0-3]|Gulf Cup|Asian Cup|World Cup|national team|kick-?off)\b/i;
/** A statistics release with nothing of the war in it (20 Oct: "Saudi Arabia's Operating Revenues Index rises 3% year on year in August"). */
const STATS = /\byear[- ]on[- ]year\b|\b(?:revenues?|PMI|GDP|inflation|price|production|industrial|activity) index\b|\bindex (?:rises|rose|falls|fell|grows|grew|climbs|edges)\b/i;
/** A major outlet's own analysis led as the teller: "Reuters warns of Houthi efforts to seize Taiz" (Yemen 386). */
const OUTLET_ANALYSIS = /^(?:Reuters|AP|AFP|Bloomberg|WSJ|The Wall Street Journal|NYT|The New York Times|The Economist|Financial Times|CNN|BBC)\b[^:]{0,20}\b(?:warns?|analysis|predicts?|expects?|forecasts?)\b/i;

/** Why a card is not news, or null. `type` is the card's type (DeskType or the reader's event_type). */
export function notNews(headline: string, body = "", type = ""): string | null {
  const h = String(headline || "").trim();
  const lead = `${h} ${String(body || "").split(/(?<=\.)\s/)[0] ?? ""}`;
  if (ROUNDUP.test(h)) return "round-up: a summary of events reported one by one is not a report";
  if (PRICE_TICK.test(h)) return "price tick: a price or a market's move is not news of the war";
  if (MARKET_WRAP.test(h) && (type === "economy" || type === "statement")) return "market wrap: indices and spreads are not news of the war";
  if (type === "economy" && ECON_ANALYSIS.test(h)) return "analysis: a forecast or a sum is not a report";
  if (FRIDAY.test(h)) return "Friday prayer: a sermon is not a report";
  if (RHETORIC.test(h)) return "rhetoric: a vow or a boast with nothing new in it";
  if (CLERICS_TRIBES.test(h) && !/\b(?:killed|wounded|attack\w*|clash\w*|strike\w*)\b/i.test(h)) return "clerics and tribes: a declaration of support or mobilisation is not a report";
  if (PROTOCOL.test(h)) return "protocol: condolences, attendance and courtesy talks are not news";
  if (FEATURE.test(h)) return "feature: not a report of the day's events";
  if (OLD_NEWS.test(lead)) return "old news retold";
  if (FIRST_FOOTAGE_RE.test(lead)) return "old attack, new video: footage put out now of an attack told before is not a report";
  if (OFF_TOPIC.test(h) && !WAR_WORD.test(h)) return "off-topic: nothing of the war in it";
  if (/\bblood donation\b|\bdonation campaign\b/i.test(h)) return "off-topic: a civic campaign is not a report";
  if (OUTLET_ANALYSIS.test(h)) return "analysis: an outlet's own assessment is not a report";
  if (COMMENTATOR_LEAD.test(h) || COMMENTATORS.test(h)) return "commentary: analysts, writers and former officials are not reports";
  if (/^[^:]{2,60}:\s/.test(h) && COMMENTATOR_BODY.test(String(body || ""))) return "commentary: the speaker is an analyst or a former official";
  if (EDITORIAL.test(String(body || "")) || /\beditorial\b/i.test(h)) return "commentary: a paper's editorial or a column is not a report";
  if (SPORT.test(h) && !WAR_WORD.test(h)) return "off-topic: sport is not the war";
  if (type === "economy" && STATS.test(h) && !WAR_WORD.test(h)) return "off-topic: a statistics release with nothing of the war in it";
  return null;
}

/* ------------------------------------------------------------------ *
 * Iran's home affairs (the Iran desk): rain, schools, crime, protests.
 * ------------------------------------------------------------------ */

const HOME =
  /\b(?:rain|snow|floods?|flooding|earthquakes?|weather|schools?|education\w*|universit\w*|students?|exams?|water crisis|drought|municipality|nepotism|brib\w*|murder\w*|killing of (?:a )?cleric|prosecutor|Evin|prisons?|political prisoners|corridor|(?:economic|trade) cooperation|Tajikistan|Afghanistan|protest\w*|pensions?|wages|teachers|nurses|air pollution|traffic)\b/i;
const HOME_WAR =
  /\b(?:US|U\.S\.|America\w*|Israel\w*|Trump|war|strikes?|attack\w*|missiles?|drones?|bomb\w*|Hormuz|blockade|sanction\w*|spy|spies|espionage|Mossad|ceasefire|navy|tankers?|ships?|nuclear|IAEA|Houthis?|Hezbollah)\b/i;

/** An Iran desk card on Iran's home affairs with nothing of the war in its headline (394 rain, 165 schools, 136 a murder, 110 arrests over January's protests). */
export function homeAffairs(headline: string): string | null {
  const h = String(headline || "");
  return HOME.test(h) && !HOME_WAR.test(h) ? "not the war: Iran's home affairs (weather, schools, crime, protests, trade corridors) are not this desk's" : null;
}

/* ------------------------------------------------------------------ *
 * Relays published instead of the original.
 * ------------------------------------------------------------------ */

/** Who speaks: the words before a colon, or before "says". */
export function leadOf(headline: string): string {
  const h = String(headline || "").trim();
  return /^([^:"“]{2,80}):\s/.exec(h)?.[1] ?? /^((?:\S+\s+){0,6}?\S+)\s+(?:says|said|tells|told|warns|likens|vows|urges|threatens|claims|releases|reports|report|confirms|announces|cancels|rerouted|redirected)\b/.exec(h)?.[1] ?? "";
}

const US_VOICE = /\b(?:US|U\.S\.|American|CENTCOM|Central Command|Pentagon|Treasury|State Department|White House|Trump|Vance|Hegseth|Rubio|Bessent|Witkoff|Leavitt|Secretary of (?:Defense|War|State))\b/;
const ISRAEL_VOICE = /\b(?:Israel(?:i)?|IDF|Netanyahu|Katz|Saar|Zamir|Mossad|Hebrew|Channel 1[234]|N12|Kan)\b/;
/** A government's services in other languages, and opposition outlets: never a US body's own voice (VOA Farsi, Radio Farda, the MEK). */
const NOT_OWN = /^(?:VOA Farsi|Radio Farda|Alhurra|MEK|Simay-e Azadi|Iran International|BBC Persian|Manoto)\b/i;
const AGGREGATORS = /^(?:Clash Report|OSINTdefender|OSINT Hexagone|Megatron|Visegrad24|Axis military relay|Startupfortune)$/i;
/** Iranian outlets, state and diaspora, English and Persian. */
const IRANIAN_OUTLET =
  /^(?:IRNA|Tasnim|Fars|ISNA|Mehr|IRIB|Press TV|Nour News|Tehran Times|Al-Alam|ILNA|IMNA|SNN|Khabari Plus|Akhbar-e Fori|Shin Persian|Emtedad|Iran International|VOA Farsi|Radio Farda|Vahid Online|Kayhan|Javan|Entekhab)\b/i;
const UKMTO_TOLD = /\b(?:UKMTO|UKTMO|UK Maritime Trade|United Kingdom Maritime Trade|British maritime security agency)\b/i;

const HEBREW_OUTLET = String.raw`(?:Israel's |Israeli )?(?:Channel 1[1-4]|Kan(?: News| 11)?|N12|Ynet|Yedioth Ahronoth|Yediot Aharonot|Maariv|Haaretz|Israel Hayom|Walla|i24(?: News)?|Army Radio|Galei Tzahal|Times of Israel|Jerusalem Post|Hebrew media|Israeli media|Israeli Broadcasting Authority)`;
const HEBREW_OUTLET_LEAD = new RegExp(String.raw`^${HEBREW_OUTLET}\s*(?::|reports?\b|reported\b|says\b)`, "i");
const HEBREW_OUTLET_TELLS = new RegExp(String.raw`(?:,\s*|\bas\s+|\baccording to\s+)${HEBREW_OUTLET}\s+(?:reports?|reported|says|said)?\s*$|\b(?:according to|citing)\s+${HEBREW_OUTLET}\b`, "i");

export type RelayInput = { headline: string; body?: string; source: string; lean?: string; desk: DeskId; own?: boolean };

/**
 * A relay the desk reads first-hand instead: a US body or Trump through Al
 * Jazeera, VOA Farsi, Al Hadath, Radio Farda, the MEK or an aggregator;
 * UKMTO through anyone; Israel through non-Israeli outlets; an Iranian outlet
 * on the Yemen desk telling anyone but Iran.
 */
export function relayOf(x: RelayInput): string | null {
  const s = String(x.source || "").trim();
  // The speaker's own account ("JD Vance", "Muammar al-Eryani") is no relay.
  if (x.own || isWireSource(s) || officialVoice(s) || US_VOICE.test(s)) return null;
  const h = String(x.headline || "");
  const lead = leadOf(h);
  const copy = `${h} ${x.body ?? ""}`;
  const mine = NOT_OWN.test(s) || AGGREGATORS.test(s) ? null : sourceNation(s, x.lean ?? "");
  if (UKMTO_TOLD.test(copy) && !/^UKMTO$/i.test(s)) return "relay: UKMTO is read from its own notices, not retold";
  const usLead = (lead && US_VOICE.test(lead) && subjectNation(lead) === "us") || /^(?:the )?(?:US |U\.S\. )?(?:Central Command|CENTCOM|Treasury|State Department|Pentagon|military)\b/.test(h) || /\b(?:CENTCOM|Central Command|Pentagon|US Treasury|State Department|White House) says\b/.test(h);
  if (usLead && mine !== "us") return `relay: the US is told from its own accounts and press, not ${s}`;
  if (lead && ISRAEL_VOICE.test(lead) && subjectNation(lead) === "israel" && mine !== "israel") return `relay: Israel is told from its own sources, not ${s}`;
  // An Israeli outlet's report passed on by another (23 Oct, Gaza desk: Al Jazeera's "Channel 14: Israel begins
  // demolishing homes…", "…, Yedioth Ahronoth reports"): the desk reads the Israeli outlets themselves.
  if (x.desk !== "yemen" && mine !== "israel" && (HEBREW_OUTLET_LEAD.test(h) || HEBREW_OUTLET_TELLS.test(h))) return `relay: the Israeli outlets are read directly, not through ${s}`;
  const iranSpeaks = subjectNation(lead || h) === "iran" || IRAN_ACTOR_WORD.test(lead) || /\b(?:Mokhber|Khatibzadeh|Gharibabadi|Ebnolreza|Velayati|Shamkhani|Qaani|Vahidi|Mousavi|Hatami)\b/.test(lead);
  if (x.desk === "yemen" && IRANIAN_OUTLET.test(s) && !iranSpeaks) return `relay: an Iranian outlet on the Yemen desk tells Iran's own words only, not ${s}'s retelling`;
  return null;
}

/* ------------------------------------------------------------------ *
 * Wrong source attached.
 * ------------------------------------------------------------------ */

const NAME_STOP = new Set(
  "Iran Iranian Israel Israeli Saudi Arabia Arabian Yemen Yemeni Houthi Houthis Gulf Strait Hormuz Red Sea President Minister Foreign Defence Defense Prime Army Navy Forces Force Armed Ministry Council State Secretary General Chief Office Officials Official United States America American British Lebanon Lebanese Iraq Iraqi Syria Syrian Tehran Riyadh Washington White House Pentagon Treasury Central Command Coalition Government Military Supreme Leader Revolutionary Guards Guard Corps Senate Congress News Agency International National Middle East Oman Omani Qatar Turkey Turkish Russia Russian China Chinese Europe European Union".split(" "),
);

/**
 * A card linked to the wrong page: a Truth Social card that is not Trump's
 * (232: Khatibzadeh's words under Trump's post), or, on a page whose text was
 * read, a headline none of whose names the page holds (388: Gen. Randy George
 * on a page about Hegseth's British visitor).
 */
export function wrongSource(headline: string, source: string, linkedText = ""): string | null {
  const h = String(headline || "");
  const lead = /^([^:]{2,70}):\s/.exec(h)?.[1] ?? "";
  if (/Truth Social|Donald J\. Trump/i.test(source) && lead && !/\b(?:Trump|US President|President of the United States)\b/i.test(lead)) {
    return `wrong source: a Truth Social post is Trump's, not ${lead}'s`;
  }
  // A person's own post linked as the original of someone's answer to him (Round 4 of 20 Oct: Iran's judiciary
  // spokesman on "Rubio's remarks in Greece" went out under Marco Rubio's own X post).
  const surname = source.trim().split(/\s+/).pop() ?? "";
  const person = /^[A-Z][a-z]+(?: [A-Z][a-z'-]+){1,2}$/.test(source.trim()) && FAMOUS.test(surname) ? surname : "";
  if (person && lead && !new RegExp(`\\b${person}\\b`, "i").test(lead) && new RegExp(`\\b${person}(?:['’]s)?\\b`, "i").test(h.slice(lead.length))) {
    return `wrong source: ${source}'s own post is not where ${lead} spoke`;
  }
  const t = String(linkedText || "");
  const latin = (t.match(/[A-Za-z]/g) ?? []).length;
  if (t.length < 400 || latin < t.length * 0.5) return null;
  const names = [...new Set((h.match(/\b[A-Z][a-z]{3,}(?:-[A-Z][a-z]+)?\b/g) ?? []).filter((w, i) => i > 0 || /:/.test(h)).filter((w) => !NAME_STOP.has(w)))];
  if (names.length < 2) return null;
  const low = t.toLowerCase();
  return names.some((n) => low.includes(n.toLowerCase())) ? null : `wrong source: the linked page names none of ${names.slice(0, 3).join(", ")}`;
}

/* ------------------------------------------------------------------ *
 * Houthi wording and partisan words.
 * ------------------------------------------------------------------ */

/** The Houthis' outlets, by name, for stored cards that carry no side. */
export const HOUTHI_OUTLET = /Masirah|^Saba(?! \(government\))|Saba \(Houthi|Thawrah|Ansarollah|Saree|Yemen Press Agency|^YPA$|Alfaqaar|Ali Bk|^Naya$|Sabereen|Shajab|Al-Mihwar|Abdulsalam/i;
const ON_SAUDI = /\b(?:Saudi|Riyadh|Jeddah|Yanbu|Rabigh|Jizan|Jazan|Najran|Abha|Khamis Mushait|Aramco|Dammam|Eastern Province|Taif|Medina|Al-Ahsa|Khurais|Abqaiq)\b/;

/**
 * The Houthis' own words, in the desk's: "Yemeni missiles" and "Yemeni air
 * blockade" from Houthi outlets are Houthi (a government force fires no
 * ballistic missiles); "Saudi government forces" are government forces;
 * "Saudi build-ups" are Saudi forces; "liberate" is take; "Iran-backed
 * Houthis" are the Houthis.
 */
export function houthiWords(s: string, houthiSource: boolean): string {
  let out = String(s || "");
  out = out.replace(/\bYemeni ballistic missiles?\b/g, (m) => m.replace("Yemeni", "Houthi"));
  if (houthiSource || ON_SAUDI.test(out)) {
    out = out
      .replace(/\bYemeni (?:(ballistic|cruise|hypersonic|winged) )?(missiles?|drones?|attacks?|strikes?|operations?|air blockade|naval blockade|blockade|drone attacks?|missile attacks?|attack by drones?)\b/g, (_m, kind: string | undefined, what: string) => `Houthi ${kind ? `${kind} ` : ""}${what}`)
      .replace(/\bYemeni (?:armed )?forces\b(?! (?:and|or) (?:Saudi|coalition))/g, (m) => (/government/.test(out) ? m : "Houthi forces"));
  }
  return out
    .replace(/\bSaudi government forces\b/g, "government forces")
    .replace(/\bSaudi (?:troop )?(?:build-?ups|mobili[sz]ations|concentrations|gatherings)\b/g, "Saudi forces")
    .replace(/\bliberat(e|es|ed|ing)\b/g, (_m, e: string) => `captur${e}`)
    .replace(/\bliberation of\b/g, "capture of")
    .replace(/\bIran-backed (Houthis?)\b/g, "$1")
    .replace(/\bHouthi forces forces\b/g, "Houthi forces");
}

const CLAIM_VERB = /\b(?:strikes?|hits?|targets?|takes?|took|captures?|seizes?|shoots? down|downs?|destroys?|repels?|advances?|controls?|pierces?|attacks?|bombs?|liberates?)\b/i;
const TELLER_WORD = /\b(?:say|says|said|claim|claims|claimed|reports?|reported|according|footage|video|spokes\w+)\b/i;

/** A Houthi outlet's own claim of a Houthi attack, with no teller: who claims it goes first (Yemen 0, 22, 207, 385). */
export function houthiClaim(headline: string, type: string, source: string): string {
  const h = String(headline || "");
  if (!["strike", "combat", "vessel", "air_strike", "shelling", "missile_launch", "drone_attack", "ground_clash", "advance_or_capture", "maritime_attack", "interception"].includes(type)) return h;
  if (!/^(?:Houthi|Yemeni)\b/.test(h) || !CLAIM_VERB.test(h) || /^[^:]{2,60}:\s/.test(h) || TELLER_WORD.test(h)) return h;
  const who = /Saree/i.test(source) ? "Houthi military spokesman" : /Masirah|^Saba|Thawrah|Ansarollah|Yemen Press Agency|^YPA$/i.test(source) ? "Houthi media" : "Houthi-aligned media";
  return `${who}: ${h}`;
}

/** Lebanon in a card: a Lebanese outlet or a Lebanese place. */
const LEBANESE_OUTLET = /^(?:NBN|LBCI|Al-Manar|Al Manar|NNA|National News Agency|MTV Lebanon|Al Mayadeen|Al-Akhbar|Ali Shoaib|Unews|Lebanon 24|L'Orient|Al-Modon|Nidaa al-Watan|Ad-Diyar|Lebanon Debate|Elnashra|Al-Joumhouria|Al-Binaa)/i;
const LEBANON_PLACE = /\b(?:Lebanon|Lebanese|Beirut|Dahiyeh|Bint Jbeil|Tyre|Sidon|Nabatieh|Nabatiyeh|Marjayoun|Bekaa|Baalbek|Khiam|Naqoura|Litani|Kfar \w+|Zoutar|Zawtar|Kfar Shuba|Kfar Shouba|Kfar Tibnit|Tolain|Wadi al-Hujeir)\b/i;
export const lebanonContext = (copy: string, source: string): boolean => LEBANESE_OUTLET.test(String(source || "").trim()) || LEBANON_PLACE.test(String(copy || ""));

/**
 * Partisan words: Lebanon's "hostile artillery" (معادية) is Israel's; the
 * Iran desk's "opponents" (العدو) is Israel in Lebanon and the speaker's own
 * word, quoted, elsewhere; "non-compliant", "smuggled" and "unauthorized"
 * ships are their teller's words, quoted.
 */
export function partisanWords(s: string, lebanon: boolean, iranDesk = false): string {
  let out = String(s || "");
  // "Hostile Israeli drone dropped two rockets on Mifdun" (NBN, 18 Oct): the word says nothing more.
  out = out.replace(/\b[Hh]ostile (Israeli)\b/g, "$1");
  if (lebanon) out = out.replace(/\b[Hh]ostile (artillery|shelling|fire|drones?|aircraft|warplanes?|forces|army|strikes?|raids?|bulldozers?|incursion|troops)\b/g, "Israeli $1");
  if (iranDesk) {
    out = out
      .replace(/\b(?:the )?opponents(?:['’]s|['’])\s/g, lebanon ? "Israel's " : 'the "enemy\'s" ')
      .replace(/\b(?:the )?opposing side\b/g, lebanon ? "Israel" : 'the "enemy"')
      .replace(/\bopposing (forces|positions|targets|aircraft|vessels|ships)\b/g, lebanon ? "Israeli $1" : '"enemy" $1')
      .replace(/\bIran's opponents\b/g, "Iran's enemies")
      .replace(/\b(?:the )?opponents (?=[a-z])(?!(?:of|to|and|in|on|for|have|has|are|were|is|was|will|would|can|could|thought|think|say|said)\b)/g, lebanon ? "Israeli " : '"enemy" ')
      .replace(/(^|[^"])\b(?:the )?opponents\b/g, (_m, pre: string) => `${pre}${lebanon ? "Israeli forces" : 'the "enemy"'}`)
      .replace(/^the "/, 'The "');
  }
  return out
    .replace(/(?<!")\b(non-compliant|unauthori[sz]ed|smuggled)\b(?!")(?=\s+(?:oil |fuel |crude |commercial |foreign )?(?:tankers?|ships?|vessels?|boats?|cargo|crossings?|transits?|VLCCs?))/gi, '"$1"');
}

/* ------------------------------------------------------------------ *
 * Wrong type.
 * ------------------------------------------------------------------ */

const SHIP = /\b(?:ships?|vessels?|tankers?|supertankers?|VLCCs?|containerships?|bulk carriers?|freighters?|dhows?|LNG carriers?)\b/i;
const SHIP_HIT = /\b(?:hit|hits|struck|mines?|mined|caught fire|on fire|ablaze|burning|attacked|targeted|fired on|disabled|explosions?|exploded|sank|sinking|sunk|seized|damaged|projectile)\b/i;
const A_COUNT = /\b\d[\d,]* (?:attacks|incidents|ships|vessels|strikes|operations|raids)\b[^.]{0,80}\b(?:week|month|since|past|so far|in total)\b|\bweek ending\b|\bin (?:the )?(?:past|last) (?:24 hours|week|month)\b|\brecord high\b|\bthis month\b/i;
const HEARD = /\b(?:explosions?|blasts?|sonic boom|loud (?:sounds?|bangs?|booms?))\b/i;
const STRIKE_WORDS = /\b(?:air ?strikes?|airstrikes|raids?|shelling|bombing|bombardment|bombs?|missile (?:and drone )?attacks?|drone attacks?|cluster bombs?|artillery)\b/i;
const HURT = /\b(?:kill\w*|wound\w*|injur\w*|dead|deaths?|casualt\w*|subjected)\b/i;
const REACTION = /\b(?:condemns?|denounces?|calls? (?:for|on)|urges?|demands?|holds? [^.]{0,40} responsible|accuses?|blames?|warns?|orders?|investigat\w*|controlled explosions?|unexploded|will conduct|expected)\b/i;
/** No fire: an appeal, a call-up, a transfer of police, a checkpoint, a house raided (Yemen 68, 103, 200, 343). */
const NO_FIRE = /\bcall(?:s|ed)? on\b|\burg(?:e|es|ed)\b|\bappeal\w*|\bnot to respond\b|\bconscription\b|\brecruit\w*|\bdeploy\w* (?:security|police|prison)|\btransfer\w* (?:\d+ percent of )?(?:police|security|prison)|\bwithdr[ae]w\w* (?:security|police|prison)|\bblock\w* travel\w*|\bstorms? (?:a |the )?(?:citizen'?s? )?(?:home|house)\b|\braid\w* (?:a |the )?(?:citizen'?s? )?(?:home|house)\b/i;
const FIRE = /\b(?:clash\w*|fight\w*|shell\w*|fire[sd]?|firing|kill\w*|wound\w*|injur\w*|gunfire|sniper|explosions?)\b/i;
/** A notice or a count by a shipping body is no diplomacy (Iran 138, 250). */
const NOTICE = /^(?:UKMTO|IMO|UK Maritime|United Kingdom Maritime|JMIC|Ambrey|Windward|Kpler|Lloyd's List)\b/i;
const NOT_DONE = /\bnot (?:been )?(?:targeted|fired|attacked|hit|struck)\b|\bno (?:ships?|vessels?) (?:were )?(?:hit|attacked)\b/i;

/**
 * The card's type by what its headline says (11, Iran; 6, Yemen): a ship hit,
 * mined or on fire is a vessel card; explosions heard are a strike, not a
 * statement; a strike with casualties is a strike; an appeal or a transfer is
 * no combat; a count is no strike; a count or a notice is no diplomacy.
 */
export function rightType(type: DeskType, headline: string): DeskType {
  const h = String(headline || "");
  const count = A_COUNT.test(h) || /\b\d{1,3},\d{3}\b|\b\d{3,} (?:air ?)?(?:strikes|operations|attacks|raids|sorties)\b/i.test(h);
  if ((type === "economy" || type === "statement" || type === "diplomacy") && SHIP.test(h) && SHIP_HIT.test(h) && !count && !NOT_DONE.test(h)) return "vessel";
  if (type === "strike" && count) return "statement";
  if (type === "statement" && !count && !REACTION.test(h)) {
    if (STRIKE_WORDS.test(h) && HURT.test(h)) return "strike";
    if (HEARD.test(h) && !/^[^:]{2,60}:\s/.test(h)) return "strike";
  }
  if (type === "combat" && NO_FIRE.test(h) && !FIRE.test(h)) return "statement";
  if (type === "diplomacy" && NOTICE.test(h)) return "statement";
  return type;
}

/* ------------------------------------------------------------------ *
 * Wrong desk.
 * ------------------------------------------------------------------ */

const IRAN_ACTOR_WORD =
  /\b(?:Iran|Iranian|Iranians|Tehran|IRGC|Revolutionary Guards?|Quds Force|Khamenei|Pezeshkian|Araghchi|Baghaei|Khatibzadeh|Ghalibaf|Larijani|Hormuz|Bandar Abbas|Kharg)\b/i;
const IRAN_LABEL_WORDS = /\bIran(?:ian)?[- ](?:backed|aligned|allied|supported|sponsored|made|built|supplied|designed|funded|armed|linked)\b|\bIranian (?:arms|weapons|missiles|drones|components)\b(?! (?:shipments?|consignments?|smuggl\w*))|\bIranian (?=Houthi)/gi;
const YEMEN_WAR = /\b(?:Houthis?|Ansar ?Allah|Yemen\w*|Saudi-led coalition|Taiz|Aden|Sanaa|Saada|Marib|Hodeidah|Jizan|Jazan|Najran|Abha|Khamis Mushait|Saudi soldiers?)\b/i;

/** Iran itself in the headline or the first sentence (not a label on someone else). */
export function iranInLead(summary: string, text = ""): boolean {
  const first = String(text || "").replace(/^[A-Z][A-Z '’`-]+ — /, "").split(/(?<=[.!?])\s/)[0] ?? "";
  return IRAN_ACTOR_WORD.test(`${summary}\n${first}`.replace(IRAN_LABEL_WORDS, " "));
}

/** A card of the Houthis' war with no Iran in its headline or first sentence: not the Iran desk's (117, 216, 333, 372, 373, 382). */
export function yemenOnIran(summary: string, text = ""): boolean {
  const all = `${summary}\n${text}`;
  // The Houthis' fire on Israel or US ships is the Iran war's (Eilat).
  return YEMEN_WAR.test(all) && !iranInLead(summary, text) && !/\b(?:Israel\w*|Eilat|US (?:warships?|ships?|Navy|bases?|forces)|American (?:warships?|ships?))\b/.test(summary);
}

/** Ships off the Saudi Gulf coast (Jubail, Dammam, the eastern coast): the Iran war's, not Yemen's. */
export const GULF_COAST_SEA = /\b(?:Jubail|Jubayl|Al-Jubail|Al Jubayl|Dammam|Khafji|Ras al-Khair|Ras Tanura|east(?:ern)? coast of Saudi Arabia|Saudi Gulf coast|Saudi coast in (?:the )?Gulf)\b/i;
const YEMEN_SEA_WORD = /\b(?:Yemen\w*|Houthis?|Red Sea|Bab (?:al|el)[- ]Mand[ae]b|Gulf of Aden|Arabian Sea|Hodeidah|Mocha|Aden|Mukalla|Hadram[ae]wt)\b/i;
export function gulfCoastShip(type: string, copy: string): boolean {
  return type === "vessel" && GULF_COAST_SEA.test(copy) && !YEMEN_SEA_WORD.test(copy);
}

/* ------------------------------------------------------------------ *
 * Titles: one spelling and the right office for Iran's officials.
 * ------------------------------------------------------------------ */

/** Offices as the cards themselves and the wires give them, 18 Oct. A change of office is a change here. */
const IRAN_OFFICES: { name: string; office: string; first?: string }[] = [
  { name: "Araghchi", office: "Iran's foreign minister" },
  { name: "Khatibzadeh", office: "Iran's deputy foreign minister" },
  { name: "Gharibabadi", office: "Iran's deputy foreign minister" },
  { name: "Ebnolreza", office: "Iran's acting defence minister" },
  { name: "Baghaei", office: "Iran's foreign ministry spokesman" },
  // ILNA, 18 Oct: "سرلشکر وحیدی، فرمانده کل سپاه".
  { name: "Vahidi", office: "IRGC commander", first: "Ahmad |General |Major General " },
  // SNN and VOA Farsi, 18 Oct: "معاون اجرایی رئیس‌جمهور" Mohammad Jafar Ghaempanah.
  { name: "Ghaempanah", office: "Iran's executive vice president", first: "Mohammad Jafar |Mohammad-Jafar |Mohammad |Jafar " },
  { name: "Dar", office: "Pakistani FM", first: "Ishaq |Mohammad Ishaq |Muhammad Ishaq " },
  // Al Mayadeen and ILNA, 18 Oct: "وزير الدفاع مهرداد أخلاقي", voted in by the Majlis.
  { name: "Akhlaghi", office: "Iran's defence minister", first: "Mehrdad " },
  // Akhbar-e Fori, 18 Oct: "حسن قشقاوی، سخنگوی کمیسیون امنیت ملی مجلس".
  { name: "Qashqavi", office: "Iran's parliament security committee spokesman", first: "Hassan |Hasan " },
  // Iran International, 18 Oct: "حمیدرضا حاجی‌بابایی، نایب‌رییس مجلس".
  { name: "Hajibabaei", office: "Iran's deputy parliament speaker", first: "Hamidreza |Hamid Reza " },
  // IMNA, 18 Oct: "محسن رضایی … دبیر شورای عالی امنیت ملی".
  { name: "Rezaei", office: "Iran's Supreme National Security Council secretary", first: "Mohsen " },
  // Iran International, 18 Oct: "نقدی، مشاور عالی فرمانده‌کل سپاه".
  { name: "Naghdi", office: "IRGC commander's senior adviser", first: "Mohammad Reza |Mohammadreza |General " },
  // Iran International, 18 Oct: Hossein Shariatmadari, Kayhan's editor.
  { name: "Shariatmadari", office: "Kayhan editor", first: "Hossein " },
];

/**
 * Figures a reader of the news knows by surname: a headline may open with
 * the bare name. Anyone else is named by role (user, 18 Oct: "Dar:",
 * "Ghaempanah:", "Vahidi:" told the reader nothing).
 */
export const FAMOUS = /^(?:Trump|Vance|Rubio|Hegseth|Witkoff|Bessent|Leavitt|Kushner|Netanyahu|Katz|Saar|Zamir|Herzog|Khamenei|Mojtaba Khamenei|Pezeshkian|Araghchi|Ghalibaf|Larijani|Qalibaf|Grossi|Guterres|Grundberg|Putin|Lavrov|Erdogan|Macron|Starmer|Merz|Xi|Modi|Sharif|Bin Salman|MBS|Abdulsalam|Saree|Qassem|Naim Qassem|Aoun|Berri|Nawaf Salam|Al-Alimi|al-Alimi|Al-Houthi|al-Houthi|Sanders|Schumer|Johnson|Graham|Cruz)$/;

/**
 * The role the card's own copy gives a bare-surname speaker: "Ghaempanah:
 * …" with "Iran's executive vice president, Mohammad Jafar Ghaempanah, said"
 * in the body. Null when the copy gives none.
 */
export function roleInCopy(name: string, copy: string): string | null {
  const n = escRe(name);
  const job = "(?:[Mm]inister|[Ss]pokes(?:man|person|woman)|[Cc]ommander|[Pp]resident|[Aa]mbassador|[Ee]nvoy|[Ss]peaker|[Gg]overnor|[Aa]dviser|[Cc]hief)";
  // A nation's word first ("Iran's", "Pakistani"), then up to three words of the office.
  const ROLE = `((?:[A-Z][a-z]+(?:['’]s)?) (?:(?!said |told |and )[A-Za-z-]+ ){0,3}${job})`;
  const before = new RegExp(`${ROLE},? (?:[A-Z][\\p{L}'-]+ ){0,2}${n}\\b`, "u").exec(copy);
  const after = before ? null : new RegExp(`\\b${n}, (?:the )?${ROLE}\\b`, "u").exec(copy);
  const role = (before ?? after)?.[1];
  // The word before the office names a country or a side: "Iran's", "Pakistani", "IRGC".
  return role && (subjectNation(role) || /^(?:IRGC|Hezbollah|Houthi)\b/.test(role)) ? role : null;
}

/** A bare-surname lead with no role: its role from the table, or from the card's copy. */
export function speakerByRole(headline: string, copy = ""): string {
  const h = String(headline || "");
  const m = /^([A-Z][\p{L}'’-]+(?: [A-Z][\p{L}'’-]+)?):\s/u.exec(h);
  if (!m || FAMOUS.test(m[1])) return h;
  const surname = m[1].split(" ").pop()!;
  if (IRAN_OFFICES.some((o) => o.name === surname)) return h; // officeTitles does those
  // A body, a country or a group is not a person: "Hezbollah:", "IRGC:", "Iran:".
  if (subjectNation(m[1]) || /^(?:IRGC|IDF|CENTCOM|Hezbollah|Hamas|UN|UNIFIL|IAEA|EU|NATO|OPEC|UKMTO|Houthis?|Kataib|Nujaba|Treasury|Pentagon|Kremlin|Ansarallah)$/i.test(m[1])) return h;
  const role = roleInCopy(surname, String(copy || ""));
  return role ? `${role[0].toUpperCase()}${role.slice(1)} ${surname}:${h.slice(m[0].length - 1)}` : h;
}

/**
 * A message of congratulations told the wrong way round: "IRGC commander
 * congratulates Vahidi on appointment as defence minister" (ILNA, 18 Oct)
 * when Vahidi IS the IRGC commander and congratulated the new minister. The
 * table's office says who sent it: written again with the sender first.
 */
export function rightWayRound(headline: string): string {
  const h = String(headline || "");
  const m = /^(.{2,60}?) (congratulat(?:es|ed)) (?:(?:General|Major General|Mr|Dr)\.? )?(?:[A-Z][\p{L}'-]+ )?([A-Z][\p{L}'-]+) on (?:his |her |the )?(appointment|election|confirmation) as (.+)$/u.exec(h);
  if (!m) return h;
  const [, who, verb, name, what, post] = m;
  const known = IRAN_OFFICES.find((o) => o.name === name);
  if (!known) return h;
  const office = known.office.replace(/^Iran's /, "").toLowerCase();
  const sender = who.replace(/^Iran's |^Iranian /i, "").toLowerCase();
  // The one congratulated holds the sender's office, not the new post: the roles are swapped.
  if (sender !== office || post.toLowerCase().includes(office)) return h;
  return `${known.office[0].toUpperCase()}${known.office.slice(1)} ${name} ${verb} new ${post.replace(/^(?:the |new )/i, "")} on ${what === "appointment" ? "his appointment" : what}`;
}

/**
 * Titles (7 and 8, Iran): Araghchi is foreign minister, not UN ambassador;
 * a bare surname opening a headline gets its office; "Sardar" is the IRGC's
 * word for a general; Iraq's prime minister is Ali al-Zaidi (since 14 May);
 * Lebanon's is Nawaf Salam (since February 2025), not Najib Mikati (user, 22 Oct).
 */
export function officeTitles(s: string): string {
  let out = String(s || "");
  out = out.replace(/\b(?:Iran's |Iranian )?(?:UN ambassador|ambassador to the UN|envoy to the UN)( Abbas)? Araghchi\b/g, "Iran's foreign minister$1 Araghchi");
  out = out.replace(/\b(Iraq(?:i|'s) (?:Prime Minister|PM)) (?:Mohammed (?:Shia['’]? )?)?(?:Al-|al-)?Sudani\b/g, "$1 Ali al-Zaidi");
  // The prime minister named as Mikati: the rest of the card's Mikati is him too, unless it says "former".
  const pmMikati = /(?<!\b[Ff]ormer )\b(Leban(?:ese|on's) (?:Prime Minister|PM)) (?:Najib )?Mikati\b/g;
  if (pmMikati.test(out)) {
    out = out.replace(pmMikati, "$1 Nawaf Salam");
    out = out.replace(/(?<!\b[Ff]ormer (?:Lebanese )?(?:(?:Prime Minister|PM) )?)\b(?:Najib )?Mikati\b/g, "Salam");
  }
  // "Acting defence minister Sardar Ebnolreza": the office says it. Elsewhere Sardar is General.
  out = out.replace(/\b((?:minister|commander|chief|spokesman|adviser|deputy|head)\s+)Sardar\s+/gi, "$1");
  out = out.replace(/\bSardar\s+(?=[A-Z])/g, "General ");
  // A famous name keeps its bare surname ("Araghchi: …"); anyone else is named by role.
  for (const { name, office, first } of IRAN_OFFICES) {
    if (FAMOUS.test(name)) continue;
    out = out.replace(new RegExp(`^(?:${first ?? "Saeed |Said |Kazem |Majid |Abbas |Esmaeil |Ismail "})?${name}:`), `${office[0].toUpperCase()}${office.slice(1)} ${name}:`);
  }
  out = rightWayRound(out);
  return out;
}

/* ------------------------------------------------------------------ *
 * Garbling.
 * ------------------------------------------------------------------ */

/**
 * The speaker said twice ("Houthi forces: Houthi missile and drone attacks",
 * "Yemen's information ministry: Yemeni government denies", "Yemeni
 * government: Yemen calls on"); an outlet's own body calling itself
 * "Houthi-aligned media"; a dateline with nothing after it.
 */
/** Verbs that tell what a finding means: the second verb of "X restricted access … strengthens speculation". */
const MEANS = "strengthens|strengthen|fuels|raises|suggests|signals|indicates|sparks|deepens|heightens|boosts|adds to|points to|shows|confirms|reinforces|feeds|stokes";
/** Words that join two clauses: with one of them the headline is no garble. */
const JOINER = /(?:,|;|:|—|–|\b(?:and|but|that|which|who|as|after|while|when|because|since|amid|so|or|if|than|where)\b)/i;

/**
 * Two finite verbs with no joiner (Iran International, 17 Oct): "Institute
 * for Science and International Security restricted access to Kuh-e Kolang
 * nuclear site strengthens speculation on stored materials". The name before
 * the first verb is the speaker: "Institute for Science and International
 * Security: restricted access to Kuh-e Kolang nuclear site strengthens
 * speculation …". Null when the headline is not of that kind.
 */
export function twoVerbs(headline: string): string | null {
  const h = String(headline || "");
  if (h.includes(":")) return null;
  const m = new RegExp(`^((?:[A-Z][\\p{L}'’.-]*|of|for|and|the|on|in)(?: (?:[A-Z][\\p{L}'’.-]*|of|for|and|the|on|in)){0,8}) ([a-z]+ed) (.+?) (${MEANS})\\b(.*)$`, "u").exec(h);
  if (!m) return null;
  const [, who, verb, mid, means, rest] = m;
  // The name ends in a name word, and nothing between the two verbs joins them.
  if (!/[A-Z][\p{L}'’.-]*$/u.test(who) || JOINER.test(` ${mid} `)) return null;
  // "has", "was" … before the first verb make it a finite verb of its own: no garble.
  if (/\b(?:has|have|had|was|were|is|are|been|be)$/i.test(who)) return null;
  return `${who}: ${verb} ${mid} ${means}${rest}`;
}

export function ungarble(headline: string): string {
  const h = twoVerbs(headline) ?? String(headline || "");
  const m = /^([^:]{2,60}):\s+((?:the )?(?:Yemen(?:i|'s)?|Houthis?|Iran(?:ian|'s)?|Saudi|US|Israel(?:i)?)(?: government| forces| armed forces| army)?)\s+(\S+)(.*)$/.exec(h);
  if (!m) return h;
  const [, lead, again, next, rest] = m;
  const n = subjectNation(lead);
  // A body speaking, not a person ("Araghchi: Iran will not negotiate" stays).
  if (!n || subjectNation(again) !== n || !/\b(?:government|ministry|forces|army|council|spokes\w+|office|military|authorit\w+)\b/i.test(lead)) return h;
  // "… : Yemeni government denies reports" → "… denies reports".
  if (/^(?:denies|calls|says|warns|urges|rejects|condemns|announces|confirms|demands|accuses|affirms|welcomes|stresses|reports|vows|threatens)$/.test(next)) return `${lead} ${next}${rest}`;
  // "Houthi forces: Houthi missile and drone attacks …" → "Houthi forces: missile and drone attacks …".
  if (/^[a-z]/.test(next) && !/\b(?:government|forces|army)$/.test(again) && again.split(" ")[0].toLowerCase() === lead.split(" ")[0].toLowerCase()) return `${lead}: ${next}${rest}`;
  return h;
}

/** A body that is only a dateline ("KING FAHD INTERNATIONAL AIRPORT — "), or an outlet calling itself "Houthi-aligned media". */
export function cleanBody(text: string, source: string): string {
  let t = String(text || "");
  if (/^[A-Z][A-Z0-9 '’`.-]+ —\s*$/.test(t)) return "";
  if (HOUTHI_OUTLET.test(String(source || ""))) {
    t = t.replace(/(^|— |\. )Houthi(?:-aligned|-run)? media (?:said|reported|says|reports)(?: that)? (\S)/g, (_m, pre: string, c: string) => `${pre}${c.toUpperCase()}`);
  }
  return t;
}

/**
 * A headline that tells only that someone spoke, not what (user, 21 Oct: "Araghchi details Iran's latest
 * reply to the US" — "this is not a report, bring what he says"). Never one after a colon: "Araghchi: …"
 * carries the words.
 */
const SAYS_NOTHING = /^[^:]{0,70}?\b(?:details|detailed|outlines|outlined|explains|explained|elaborates on|speaks (?:about|on)|talks about|comments on|commented on|sheds light on|briefs (?:the )?[\w-]+(?: \w+)? on|briefed (?:the )?[\w-]+(?: \w+)? on|gives (?:an? |his |her )?(?:interview|speech|details|account)|in (?:an? )?(?:long |lengthy |televised )?interview)\b(?![^:]{0,40}:)/i;
/**
 * After the colon only the name of the talk, not what was said (user, 24 Oct: "Pakistan Foreign Office
 * spokesperson: Weekly briefing on tensions at the Pakistan–Iran border and current status" — "the fact he
 * talks isn't a report").
 */
const TALK_LABEL = /^[^:]{2,60}:\s+(?:(?:the|a|an|his|her|its|their)\s+)?(?:(?:weekly|daily|regular|monthly|special|live|full|latest|first|televised|joint)\s+)*(?:(?:press|news|media)\s+)?(?:briefings?|conferences?|speech(?:es)?|address(?:es)?|interviews?|remarks|statements?|session|appearance|comments)\b(?:\s+(?:on|about|regarding|over|to|at|in|for)\b([^.;]*))?\s*$/i;
/** A topic with a verb in it is news ("…briefing: border to reopen"); a bare topic is not. */
const HAS_VERB = /\b(?:will|would|is|are|was|were|has|have|had|be|been|says?|said|warns?|warned|calls?|called|to [a-z]{3,}|[a-z]{3,}(?:ed|es))\b/i;
export function saysNothing(headline: string): boolean {
  const h = String(headline || "").trim().replace(/[.\s]+$/, "");
  const label = TALK_LABEL.exec(h);
  if (label && !HAS_VERB.test(label[1] ?? "")) return true;
  return !/^[^:]{2,60}:\s/.test(h) && SAYS_NOTHING.test(h);
}
/** Words with no speaker: "We have no trust at all in …", "Ready for diplomacy and self-defence" (21 Oct). */
export function noSpeaker(headline: string): boolean {
  const h = String(headline || "");
  if (/^[^:]{2,60}:\s/.test(h) || /\b(?:says?|said|told|tells|claims?|according to)\b/i.test(h)) return false;
  return /^(?:We|We're|We've|Our|Us|I|I'm|I've|My|Ready (?:for|to)|No basis|Not ready|Never|Will not|Won't|Cannot)\b/.test(h);
}
const KEY_WORDS = (s: string) => new Set(String(s || "").toLowerCase().match(/[a-z]{4,}/g) ?? []);
/**
 * A stored card whose headline says nothing or names no one: another outlet's line under it that carries the
 * speaker and the words leads instead (that outlet then the source); a speaker who is the source itself
 * ("Abbas Araghchi" posting on his channel) is put in front. Null: nothing to mend; false: the card is not
 * shown (it says only that someone spoke, and nothing under it says what).
 */
export function sayWhat(r: Row): boolean | null {
  const h = String(r.summary ?? "");
  const empty = saysNothing(h), nobody = !empty && noSpeaker(h);
  if (!empty && !nobody) return null;
  const mine = KEY_WORDS(h);
  const also = (Array.isArray(r.alsoReportedBy) ? r.alsoReportedBy : []) as Row[];
  let best: Row | null = null, bestN = 0;
  for (const a of also) {
    const s = String(a?.summary ?? "");
    if (!a?.url || !/^[^:]{2,60}:\s\S/.test(s) || saysNothing(s.replace(/^[^:]{2,60}:\s/, "")) || noSpeaker(s) || s.length < 25) continue;
    let n = 0;
    for (const w of KEY_WORDS(s)) if (mine.has(w)) n++;
    if (n > bestN) { best = a; bestN = n; }
  }
  // A speaker's own post with no name in it: the poster spoke.
  const own = String(r.source ?? "");
  const person = /^[A-Z][\p{L}'’-]+ (?:[A-Z][\p{L}'’-]+ )?([A-Z][\p{L}'’-]+)$/u.exec(own);
  // A fuller line of the same words under the card leads first (MTV's "Araghchi: ready for diplomacy but
  // will keep defending ourselves; no basis to expect progress in talks now" over "Ready for diplomacy …").
  if (best && bestN >= 2 && String(best.summary).length > h.length + 15) {
    r.summary = String(best.summary);
    return true;
  }
  if (nobody && person && FAMOUS.test(person[1])) {
    r.summary = `${person[1]}: ${/^(?:I|I'm|I've)\b|^[A-Z]{2}/.test(h) ? h : h[0].toLowerCase() + h.slice(1)}`;
    return true;
  }
  // The same story: two of its words at least (an unrelated line of the same day is no answer).
  // The card keeps its own source and link (its id and time go by them; a swapped link was dropped as another post).
  if (best && bestN >= 2) {
    r.summary = String(best.summary);
    return true;
  }
  // Words of nobody, or a card that only says someone spoke, with nothing better: off the desk unless its body says it.
  return String(r.text ?? "").trim().length >= 60 ? null : false;
}

/** Garbled copy a second writing should mend (new cards only). */
export function garbled(headline: string, sourceText = ""): string | null {
  const h = String(headline || "");
  // "Clash in Abyan linked to vehicle linked to former Al-Qaeda leader".
  if (/\b(\w+ed (?:to|by|in|on|with))\b(?:\s+\S+){1,4}?\s+\1\b/i.test(h)) return "garbled: a phrase written twice";
  if (saysNothing(h)) return "garbled: the headline says only that someone spoke; write what was said (the claim, demand, figure or decision), with the speaker and a colon";
  if (noSpeaker(h)) return "garbled: the headline's words are nobody's; open with the speaker and a colon";
  // "Houthis missile attack hits Aden …; coalition says …, Iran says …" (CNBC, 16 Oct): three stories in one.
  if ((h.match(/\b(?:says|said|claims|reports)\b/g) ?? []).length >= 2 && /;/.test(h)) return "garbled: one headline tells several parties' stories; keep the first";
  // The headline says sanctions; the text says they were eased (Reuters, 16 Oct).
  const t = String(sourceText || "");
  if (/\bsanctions?\b/i.test(h) && !/\b(?:eas\w*|lift\w*|relief|waiv\w*|remov\w*|relax\w*|suspend\w*)\b/i.test(h) && /\b(?:eas(?:e|ed|es|ing) (?:of )?(?:US )?sanctions|sanctions? (?:relief|easing|waiver)|lift(?:ed|s|ing)? (?:the )?sanctions|waive[sd]? (?:the |some )?sanctions)\b/i.test(t) && !/\b(?:new|impose[sd]?|imposing|more|fresh|additional) sanctions\b/i.test(t)) {
    return "headline against the text: the text says sanctions were eased";
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Wrong place: a body's seat is not where it happened.
 * ------------------------------------------------------------------ */

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A place the copy names only as a body's seat: "Sanaa health official: 7
 * wounded … in Taiz", "a spokesman for Sanaa's Health Ministry" (Yemen 76),
 * "Sanaa forces", "Aden government". The report is not in Sanaa.
 */
export function bodyPlaceOnly(name: string, copy: string): boolean {
  const n = escRe(String(name || "").replace(/^the /i, ""));
  if (!n) return false;
  const all = String(copy || "").match(new RegExp(`\\b${n}\\b`, "gi"))?.length ?? 0;
  if (!all) return false;
  const seat = String(copy || "").match(new RegExp(`\\b${n}(?:['’]s)?(?:-based)? (?:[A-Za-z]+ ){0,2}?(?:ministry|ministries|official|officials|government|authorities|authority|administration|spokes(?:man|person|woman)|forces|agency|council)\\b`, "gi"))?.length ?? 0;
  return seat >= all;
}

/* ------------------------------------------------------------------ *
 * Late times: an X post's time is in its id.
 * ------------------------------------------------------------------ */

/** When an X post was written, from its status id (Twitter's snowflake), or null. */
export function xPostTime(url: string): number | null {
  const m = /(?:x|twitter)\.com\/[^/]+\/status(?:es)?\/(\d{15,20})/.exec(String(url || ""));
  if (!m) return null;
  try {
    const ms = Number((BigInt(m[1]) >> 22n) + 1288834974657n);
    return ms > Date.UTC(2015, 0, 1) && ms < Date.UTC(2100, 0, 1) ? ms : null;
  } catch {
    return null;
  }
}

/** Twelve hours: an item older than this when read is no card, unless it is an original taking over one. */
export const LATE_MS = 12 * 3600_000;

/* ------------------------------------------------------------------ *
 * Round 4 of 20 Oct: times, exclusives by link, bodies off the story.
 * ------------------------------------------------------------------ */

/** "https://www.newarab.com/news/exclusive-mediators-submit-new-peace-proposal-iran-us": the outlet labels it an exclusive in its link. */
export function exclusiveUrl(url: string): boolean {
  const path = /^https?:\/\/[^/]+(\/[^?#]*)/i.exec(String(url || ""))?.[1] ?? "";
  return /(?:^|[/_-])exclusive(?:[_-]|$)/i.test(path) && !/\/(?:video|videos|watch|photos?|gallery)\//i.test(path);
}

const BODY_STOP = new Set(
  "about after again against also among amid backed being between carried city coalition district during forces front government governorate houthi houthis local media military other popular region reported reports resistance saudi saudi-led says said sources their there these those under while with yemen yemeni".split(" "),
);
const bodyWords = (s: string) =>
  new Set(
    (String(s || "").toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [])
      .map((w) => w.replace(/^al-/, "").replace(/(?:ing|ed|es|s)$/, ""))
      .filter((w) => w.length >= 4 && !BODY_STOP.has(w)),
  );
/**
 * A field report's body that tells another event: no sentence of it shares a
 * word with the headline once its dateline is gone (Crater Sky, 20 Oct 17:23:
 * "Saudi-led coalition intercepts and destroys drone over Riyadh region" over
 * "RIYADH — Government forces ... carried out a raid ... in Al-Masrakh").
 */
export function bodyOffTopic(headline: string, body: string, type = ""): boolean {
  if (!["strike", "combat", "vessel", "alert"].includes(String(type))) return false;
  const text = String(body || "").replace(/^[A-Z][A-Z .'’`-]{1,40}\s+[—–-]\s+/, "");
  const h = bodyWords(headline);
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 20);
  if (!sentences.length || h.size < 2) return false;
  if (!sentences.every((s) => ![...bodyWords(s)].some((w) => h.has(w)))) return false;
  // And it is elsewhere: the body names a city the headline does not, and none the headline names
  // (a front's body listing its villages is the same fight).
  const cities = (s: string) => new Set([...s.matchAll(CITY)].map((m) => m[0].toLowerCase()));
  const hc = cities(headline);
  const bc = cities(text);
  return hc.size > 0 && bc.size > 0 && ![...bc].some((c) => hc.has(c)) && ![...hc].some((c) => bc.has(c));
}
const CITY = /\b(?:Riyadh|Jeddah|Jazan|Najran|Abha|Khamis Mushait|Dammam|Mecca|Medina|Taiz|Marib|Sanaa|Aden|Lahj|Hodeidah|Saada|Shabwa|Abyan|Ibb|Bayda|Jawf|Hajjah|Dhale|Mocha|Mukalla|Hadramawt|Tehran|Isfahan|Bandar Abbas|Beirut|Baghdad|Haifa|Tel Aviv|Doha|Dubai|Abu Dhabi)\b/gi;

/**
 * A link whose own words tell another story (Round 4 of 20 Oct: Bloomberg's card on the RAF's Typhoons for
 * Saudi Arabia linked "how-musk-s-starlink-and-us-spy-satellites-support-ukraine-s-defense"). Only a
 * worded English slug of five words or more, sharing none with the card.
 */
export function wrongLink(summary: string, text: string, url: string): boolean {
  const path = /^https?:\/\/[^/]+(\/[^?#]*)/i.exec(String(url || ""))?.[1] ?? "";
  const slug = path.split("/").filter(Boolean).pop() ?? "";
  if (/%[0-9a-f]{2}/i.test(slug) || /\/(?:de|fr|es|it|ar|fa|tr|ru|he|ur|zh)\//i.test(path)) return false;
  const words = slug.toLowerCase().split(/[-_]+/).filter((w) => /^[a-z]{2,}$/.test(w));
  // English words only: a German or a transliterated slug says nothing to an English card.
  if (words.length < 5 || !words.some((w) => /^(?:the|and|for|of|to|in|on|with|after|over|says|as|is|are|how|why|what|from|amid)$/.test(w))) return false;
  const stem = (s: string) => new Set((s.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !/^(?:the|and|for|with|from|after|over|says|said|are|how|why|what|amid|news|latest)$/.test(w)).map((w) => w.replace(/(?:ing|ed|es|s)$/, "")));
  const card = stem(`${summary} ${text}`);
  return ![...stem(words.join(" "))].some((w) => card.has(w));
}

const H3 = 3 * 3600_000;
/** A card's id as the desk slugs a link: "https://x.com/yemen_mofa/status/1" → "x-com-yemen-mofa-status-1". */
export function slugOf(url: string): string {
  return String(url || "")
    .toLowerCase()
    .replace(/^https?:\/\/(?:www\.)?/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
/** The link a card was first written from, by its id ("live-x-com-marebpress-status-…", "ir-live-…"). */
export function bornFrom(fp: string, url: string): boolean {
  const f = String(fp || "").replace(/^(?:ir-)?live-/, "").replace(/-pin-.*$/, "");
  const s = slugOf(url);
  if (f.length < 12 || s.length < 12) return false;
  return s.startsWith(f) || f.startsWith(s) || s.replace(/^(?:www-)/, "").startsWith(f.replace(/^www-/, ""));
}

/**
 * A card's time against its lead's own time (Round 4 of 20 Oct). An X post's
 * time is in its id:
 * - a lead posted more than three hours AFTER the card's time took over a card
 *   on another story (Yemen's foreign ministry on the Saudi ambassador's words,
 *   posted at 18:58, led a card on a Washington protest timed 01:29; Fox News's
 *   "Netanyahu meets Hegseth" of 15:25 led a 01:12 card): the card goes back to
 *   its first account, kept under "Also" by the card's id, and the late post is
 *   a card of its own at its own time. The same story told again later (seven
 *   hours, four words in common) keeps its card;
 *   When the first account is not under "Also", the card is shown at its
 *   lead's time;
 * - a lead posted more than twelve hours BEFORE the card's time is old news
 *   relayed late (Iran's foreign ministry on Egypt, posted 07:30 on 19 Oct,
 *   went out at 07:04 on 20 Oct): the card is shown at its post's time.
 * Returns the cards, with any card split off; the rows stay as they are.
 */
export function postTimes<T extends Record<string, unknown>>(rows: T[]): T[] {
  const out: T[] = [];
  for (const r of rows) {
    const posted = xPostTime(String(r.url ?? ""));
    const at = Date.parse(String(r.at ?? ""));
    if (!posted || !Number.isFinite(at)) {
      out.push(r);
      continue;
    }
    const also = (Array.isArray(r.alsoReportedBy) ? r.alsoReportedBy : []) as { source: string; url: string; summary?: string }[];
    if (posted < at - LATE_MS && !also.length && !wrongSource(String(r.summary ?? ""), String(r.source ?? ""))) {
      out.push({ ...r, at: new Date(posted).toISOString() });
      continue;
    }
    if (posted > at + H3 && !bornFrom(String(r.fp ?? ""), String(r.url ?? ""))) {
      const first = also.find((a) => bornFrom(String(r.fp ?? ""), a.url));
      const sameStory = first && wordsShared(String(r.summary ?? ""), String(first.summary ?? "")) >= 4 && posted - at <= LATE_MS;
      if (first && first.summary && !sameStory) {
        const late = { ...r, fp: `${r.fp}~late`, at: new Date(posted).toISOString(), alsoReportedBy: undefined } as T;
        const back = { ...r, source: first.source, url: first.url, summary: first.summary, text: "", alsoReportedBy: also.filter((a) => a !== first) } as T;
        if (!(back.alsoReportedBy as unknown[]).length) delete back.alsoReportedBy;
        delete back.media;
        out.push(back, late);
        continue;
      }
      // The first account is not kept: the card is its lead's story, shown at its lead's time.
      if (!first) {
        out.push({ ...r, at: new Date(posted).toISOString() });
        continue;
      }
    }
    out.push(r);
  }
  return out;
}
const wordsShared = (a: string, b: string) => {
  const x = bodyWords(a);
  let n = 0;
  for (const w of bodyWords(b)) if (x.has(w)) n += 1;
  return n;
};

/**
 * An outlet's exclusive is never another card's "Also" (Round 4 of 20 Oct: The
 * New Arab's "Exclusive: breakthrough expected in US–Iran mediation" sat under
 * Nour News's "Pakistan's army chief to arrive in Tehran tomorrow"). It is
 * shown as a card of its own, labelled, at the card's time; the fold rules
 * then join it with the rest of that scoop (fold-same.ts "scoop").
 */
export function exclusivesOut<T extends Record<string, unknown>>(rows: T[]): T[] {
  const out: T[] = [];
  for (const r of rows) {
    const also = (Array.isArray(r.alsoReportedBy) ? r.alsoReportedBy : []) as { source: string; url: string; summary?: string }[];
    const mine = Array.isArray(r.flags) && (r.flags as string[]).includes("exclusive");
    const scoops = mine ? [] : also.filter((a) => exclusiveUrl(a.url) && a.summary);
    if (!scoops.length) {
      out.push(r);
      continue;
    }
    out.push({ ...r, alsoReportedBy: also.filter((a) => !scoops.includes(a)) } as T);
    for (const a of scoops) {
      out.push({ ...r, fp: `${r.fp}~${slugOf(a.url).slice(-24)}`, source: a.source, url: a.url, summary: a.summary, text: "", alsoReportedBy: undefined, flags: [...((r.flags as string[] | undefined) ?? []).filter((f) => f.startsWith("arena:")), "exclusive"], media: undefined, replyTo: undefined } as T);
    }
  }
  return out;
}

/**
 * A site's or a channel's numbered articles are told in their order: a card
 * timed hours before the article numbered just below it was not out yet
 * (Saba's viewstory/154307, published 12:18 on 20 Oct, was timed 00:25, after
 * 154306 at 14:37; a twelve-hour clock read as midnight). The card is shown
 * at its neighbour's time. Only a card written from that article (its id),
 * whose neighbour is within five numbers and over two hours later.
 */
export function idOrderTimes<T extends Record<string, unknown>>(rows: T[]): T[] {
  type K = { key: string; n: number; at: number; r: T };
  const groups = new Map<string, K[]>();
  for (const r of rows) {
    const url = String(r.url ?? "");
    if (xPostTime(url)) continue;
    const m = /^https?:\/\/(?:www\.)?([^/?#]+)(\/[^?#]*?)(\d{4,})(?:\.html?)?\/?$/i.exec(url);
    if (!m || !bornFrom(String(r.fp ?? ""), url)) continue;
    const key = `${m[1].toLowerCase()}${m[2].toLowerCase()}`;
    const at = Date.parse(String(r.at ?? ""));
    if (!Number.isFinite(at)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ key, n: Number(m[3]), at, r });
  }
  const moved = new Map<T, string>();
  for (const list of groups.values()) {
    list.sort((a, b) => a.n - b.n);
    for (let i = 1; i < list.length; i++) {
      const below = list[i - 1];
      const me = list[i];
      if (me.n - below.n <= 5 && below.at - me.at > 2 * 3600_000) {
        me.at = below.at;
        moved.set(me.r, new Date(below.at).toISOString());
      }
    }
  }
  return moved.size ? rows.map((r) => (moved.has(r) ? { ...r, at: moved.get(r)! } : r)) : rows;
}

/* ------------------------------------------------------------------ *
 * Stored cards, as they are served.
 * ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

/**
 * A stored card as it is served: false when the review's rules would have
 * kept it off this desk (not news, home affairs, the wrong desk, a Truth
 * Social card that is not Trump's); otherwise its copy and type fixed in
 * place. The row in the database is left as it is.
 */
export function serveCard(r: Row, desk: DeskId): boolean {
  const summary = String(r.summary ?? "");
  const text = String(r.text ?? "");
  const source = String(r.source ?? "");
  const type = String(r.type ?? "") as DeskType;
  if (notNews(summary, text, type)) return false;
  if (wrongSource(summary, source)) return false;
  if (desk === "iran") {
    if (homeAffairs(summary)) return false;
    if (yemenOnIran(summary, text)) return false;
  }
  if (desk === "yemen" && gulfCoastShip(type, `${summary}\n${text}`)) return false;
  const lebanon = lebanonContext(`${summary} ${text}`, source);
  const houthi = r.side === "houthi" || HOUTHI_OUTLET.test(source);
  const fix = (s: string) => {
    let out = officeTitles(partisanWords(respell(s), lebanon, desk === "iran"));
    if (desk === "yemen") out = houthiWords(out, houthi);
    // The Gaza desk's own words on every stored card of every desk (gaza-words.ts; 24 Oct: "West Bank" on an Iran card).
    out = gazaWords(out);
    return out;
  };
  // A link to another story: the first other account leads, or the card is not shown (Round 4 of 20 Oct).
  if (wrongLink(summary, text, String(r.url ?? ""))) {
    const also = (Array.isArray(r.alsoReportedBy) ? r.alsoReportedBy : []) as { source: string; url: string }[];
    const next = also.find((a) => a?.url && !wrongLink(summary, text, a.url));
    if (!next) return false;
    r.source = next.source;
    r.url = next.url;
    r.alsoReportedBy = also.filter((a) => a !== next);
  }
  // Gaza and Judea and Samaria from the Israeli and Palestinian sources (user, 24 Oct): another outlet's
  // account gives the lead to one of theirs under it, or is not shown, unless it is its own exclusive.
  const flags = Array.isArray(r.flags) ? (r.flags as string[]) : [];
  if (desk !== "yemen" && !flags.includes("exclusive") && !exclusiveUrl(String(r.url ?? "")) && arenaSourceRule({ headline: summary, type, source })) {
    const also = (Array.isArray(r.alsoReportedBy) ? r.alsoReportedBy : []) as { source: string; url: string }[];
    const next = also.find((a) => a?.url && !arenaSourceRule({ headline: summary, type, source: a.source }));
    if (!next) return false;
    r.alsoReportedBy = [{ source, url: String(r.url ?? "") }, ...also.filter((a) => a !== next)];
    r.source = next.source;
    r.url = next.url;
  }
  // A card about its footage is shown with that footage or not at all (user, 18 Oct: "Houthi media publishes new footage …" with no video).
  if (aboutFootage({ summary }) && !r.media) return false;
  // Says only that someone spoke, or names no one (21 Oct): the words and the speaker from a line under it.
  if (sayWhat(r) === false) return false;
  let h = speakerByRole(ungarble(fix(String(r.summary ?? ""))), text);
  if (desk === "yemen" && houthi) h = houthiClaim(h, type, source);
  r.summary = h;
  // The other outlets' lines under the card get the same offices and titles.
  if (Array.isArray(r.alsoReportedBy)) {
    for (const a of r.alsoReportedBy as Row[]) if (a && typeof a.summary === "string") a.summary = ungarble(officeTitles(a.summary));
  }
  if (text) r.text = cleanBody(fix(text), source);
  // A field report's body about another event (Crater Sky, 20 Oct: "intercepts drone over Riyadh" over a raid in Al-Masrakh).
  if (r.text && bodyOffTopic(h, String(r.text), type)) r.text = "";
  // An outlet's exclusive by its link (The New Arab's /news/exclusive-…), labelled as one.
  if (exclusiveUrl(String(r.url ?? "")) && !(Array.isArray(r.flags) && r.flags.includes("exclusive"))) r.flags = [...((r.flags as string[] | undefined) ?? []), "exclusive"];
  const t = rightType(type, h);
  if (t !== type) r.type = t;
  // An Arabic outlet name ("وردنا") is shown in Latin letters.
  if (/[؀-ۿ]/.test(source)) r.source = anglicise(source);
  return true;
}
