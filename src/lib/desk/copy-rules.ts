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
import { arenaSourceRule, gazaSourceRule, palestineArena } from "./gaza-sourcing.ts";
import { gazaLeanOf, gazaOfficial } from "./gaza-sources.ts";
import { isOfficial } from "./source-rating.ts";
import { aboutFootage } from "./media.ts";
import { FIRST_FOOTAGE_RE } from "./pin-rule.ts";
import { respell } from "./spelling.ts";
import { isWireSource, type Nation, namesNation, officialVoice, sourceNation, subjectNation } from "./speaker-press.ts";

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
// A relative telling a loss is a feature too (user, 29 Oct: "Mother of slain Hammam Abu Labda recounts her second son killed": "definitely not relevant").
const FEATURE = /\b(?:mother|father|wife|widow|husband|sister|brother|son|daughter|family|relatives?|parents?)\b[^.:]{0,60}\b(?:recounts?|recalls?|remembers?|tells? (?:of|the story)|describes? (?:the )?(?:loss|pain|grief))\b|\b(?:dedicates?|dedicated|donates?|donated|treats?|treating|offers?|offered)\b[^.:]{0,80}\b(?:for free|free of charge)\b|\bvolunteer(?:s|ed|ing)?\b(?! (?:fighters?|battalions?|forces|units?|brigades?))|\bcharit(?:y|able)\b|\bpet owners?\b|\b(?:survivor|witness|resident)s?\b[^.:]{0,60}\brecalls?\b|(?::|^) ?Why\b[^.]{0,90}$|^How\b/i;
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
const SPORT = /\b(?:Champions League|club (?:loses|lost|beats|beat|wins|won|draws|drew)|football|soccer|futsal|U-?1[5-9]|U-?2[0-3]|under-1[5-9]|under-2[0-3]|Gulf Cup|Asian Cup|World Cup|national team|kick-?off)\b/i;
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
  // The review of 29 Oct's cards (all three desks): fly-overs and flares, road and crossing bulletins, envoys'
  // talks with nothing done, and household economics far from the war.
  if (NON_EVENT.test(h) && !HARM.test(h)) return "no event: an aircraft overhead or flares are not a report";
  if (BULLETIN.test(h) && !HARM.test(h)) return "bulletin: crossings', roads' and checkpoints' hours and court schedules are not reports";
  if (NGO_EVENT.test(h) && !HARM.test(h)) return "no event: an institute's launch, workshop or conference is not a report";
  if (ROUTINE.test(h) && !HARM.test(h) && !/\b(?:attack\w*|clash\w*|ston(?:e|es|ed|ing)|fire[sd]?|shot|explo\w+|st(?:ole|olen|eal\w*)|poison\w*)\b/i.test(h)) return "no event: routine works or traffic with nothing done to anyone";
  if (BARE_DEATH.test(h) && !/\d|\b(?:Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Dozens|Several|Palestinians|Israelis|Lebanese|Iranians|Yemenis|Soldiers|Hezbollah|Hamas|IDF|IRGC)\b/.test(h) && !/\b(?:commander|leader|official|journalist|doctor|paramedic|child|boy|girl|woman|officer|member|fighter|operative|head|chief)\b/i.test(h)) return "death notice: a name with no role, no how and no where is not a report";
  if (TALKS_ONLY.test(h) && !HARM.test(h)) return "protocol: a meeting where matters were discussed is not news";
  if ((type === "economy" || type === "statement") && HOME_ECONOMY.test(h) && !ECONOMY_OF_WAR.test(h)) return "off-desk: prices, rates and companies' results far from the war are not this desk's";
  return null;
}

/**
 * A finished act in the past tense (user, 27 and 29 Oct: "conducted", never "conduct"; the review of 29 Oct found
 * "Israeli forces raid…", "artillery shells…" on a third of the cards). Only a verb right after the one who acted
 * is changed, so a noun ("strikes on", "the raid") and quoted words stay as they are.
 */
const ACTOR = String.raw`(?:forces|troops|soldiers|army|police|artillery|gunboats?|vehicles|bulldozers|aircraft|warplanes?|jets|drones|helicopters?|fighters|militants|gunmen|extremists|citizens|Houthis|IDF|IRGC|navy|militias?|brigades?|units?|air defen[cs]es|strikes|Hezbollah|Hamas)`;
const PAST: Record<string, string> = {
  raid: "raided", raids: "raided", arrest: "arrested", arrests: "arrested", detain: "detained", detains: "detained",
  demolish: "demolished", demolishes: "demolished", bulldoze: "bulldozed", bulldozes: "bulldozed",
  shell: "shelled", shells: "shelled", hit: "hit", hits: "hit", kill: "killed", kills: "killed", wound: "wounded", wounds: "wounded",
  storm: "stormed", storms: "stormed", seize: "seized", seizes: "seized", abduct: "abducted", abducts: "abducted",
  target: "targeted", targets: "targeted", launch: "launched", launches: "launched", intercept: "intercepted", intercepts: "intercepted",
  repel: "repelled", repels: "repelled", recapture: "recaptured", recaptures: "recaptured", capture: "captured", captures: "captured",
  destroy: "destroyed", destroys: "destroyed", attack: "attacked", attacks: "attacked", assault: "assaulted", assaults: "assaulted",
  burn: "burned", burns: "burned", close: "closed", closes: "closed", besiege: "besieged", besieges: "besieged",
  open: "opened", opens: "opened", fire: "fired", fires: "fired", bomb: "bombed", bombs: "bombed", down: "downed", downs: "downed",
  conduct: "conducted", conducts: "conducted", carry: "carried", carries: "carried", set: "set", sets: "set", advance: "advanced", advances: "advanced",
  expel: "expelled", expels: "expelled", evict: "evicted", evicts: "evicted", injure: "injured", injures: "injured", steal: "stole", steals: "stole",
};
const PRESENT_ACT = new RegExp(String.raw`(\b${ACTOR}\s+)(${Object.keys(PAST).join("|")})\b(?!\s+(?:on|at|in|of|by|from|to|towards?|against)\b)`, "gi");
export function pastTense(headline: string): string {
  const h = String(headline || "");
  // Words inside quotes are someone's own, and so is what someone says, warns or vows.
  if (/\b(?:says?|said|warns?|vows?|threatens?|claims?|pledges?)\b/i.test(h)) return h;
  return h
    .split(/("[^"]*"|“[^”]*”)/)
    .map((part, i) =>
      i % 2
        ? part
        : part
            // "artillery fire", "anti-aircraft fire" are nouns.
            .replace(PRESENT_ACT, (m, who: string, verb: string) => (/^fires?$/i.test(verb) && /artillery|aircraft/i.test(who) ? m : `${who}${PAST[verb.toLowerCase()] ?? verb}`))
            // "killed and wound" → "killed and wounded".
            .replace(AND_PRESENT, (_m, done: string, verb: string) => `${done}${PAST[verb.toLowerCase()] ?? verb}`),
    )
    .join("");
}
const AND_PRESENT = new RegExp(String.raw`(\b(?:${[...new Set(Object.values(PAST))].join("|")})\s+and\s+)(${Object.keys(PAST).join("|")})\b`, "gi");

const HARM =/\b(?:killed|killing|kills?|wounded|injured|struck|hit|hits|bomb\w*|missiles?|shot down|intercept\w*|seized|arrested|abducted|demolish\w*|raid\w*|shell(?:ed|s|ing)?\b(?! .*flares))/i;
const NON_EVENT = /\b(?:reconnaissance|surveillance|spy)\b[^.:]{0,30}\b(?:drones?|aircraft|planes?|flights?|balloons?)\b|\b(?:warplanes?|aircraft|jets|drones?|helicopters?)\s+(?:fly|flew|flying|seen|spotted|circl\w+|hover\w*)\b|\b(?:illumination )?flares\b|\bfly(?:ing)? over\b|\boverflights?\b|\bsonic boom/i;
const BULLETIN = /\bcrossings?\b[^.]{0,80}\b(?:open|opened|closed|reopen\w*)\b|\bcheckpoints?\b[^.]{0,60}\b(?:open|opening hours?)\b[^.]{0,20}\d|\bflying checkpoint\b|\broads? (?:closed|blocked) at\b|\bcourt (?:to )?hold\w* [^.]{0,40}\bhearings?\b|\bmove[sd]? from\b[^.]{0,60}\btoward/i;
const TALKS_ONLY = /^(?:[^:]{0,80}?\b(?:ambassador|envoy|delegate|representative|coast guard chief|governor|deputy|undersecretary|committee|chief)\b[^:]{0,80}?\b(?:discuss(?:es|ed)?|meets?|met|receives?|received|coordinat\w+|visits?|visited)\b)/i;
/**
 * An institute's, centre's or NGO's launch, workshop or conference (user, 29 Oct: "Geneva Centre for Security Governance
 * Director: Yemeni tribal code of honor for civilian protection launched in Geneva": "not interesting").
 */
const NGO_EVENT = /\b(?:Centre|Center|Institute|Foundation|Forum|Network|Initiative|NGO|Association|Society|Observatory|Coalition for)\b[^.]{0,120}\b(?:launch(?:ed|es|ing)?|workshop|seminar|symposium|training|panel|conference|code of (?:honou?r|conduct)|charter|report on)\b|\b(?:workshop|seminar|symposium|training course)\b/i;
/** Routine works and traffic with nothing done to anyone (user, 29 Oct: "Israeli forces filled in absorption pit in Qalqilya", "Israeli citizens' buses cross the Jenin-Nablus road under army escort": "these aren't interesting"). */
const ROUTINE = /\b(?:sheep|goats|cattle|cows|camels|livestock|herds?|flocks?)\b(?![^.]{0,60}\b(?:stole|stolen|steal\w*|killed|poison\w*|seiz\w+))|\b(?:fill(?:ed|s|ing)? in|level(?:l?ed|s|l?ing))\b[^.]{0,40}\b(?:pits?|holes?|trench\w*|ditch\w*)\b|\b(?:absorption|cess|sewage) pits?\b|\bpav(?:e|es|ed|ing)\b[^.]{0,40}\broads?\b|\bunder (?:army|military|police|IDF|security) (?:escort|protection|guard)\b|\b(?:buses|cars|vehicles|traffic)\b[^.]{0,40}\b(?:cross|pass|drive|drove|use)\w*\b[^.]{0,40}\b(?:roads?|roundabouts?|junctions?|highways?|streets?)\b/i;
/**
 * A name and a death, nothing else (user, 29 Oct: "Palestinian media: Ihab Abu Taqiya from Abu Muslama killed":
 * "if it doesn't say his role or something like that, not relevant"): no role, no how, no where beyond his family's
 * town. A role ("commander", "journalist"), a cause ("in a strike", "by Israeli fire") or a count keeps it.
 */
const BARE_DEATH = /^(?:[^:]{2,40}:\s*)?(?:(?:the )?(?:young man |youth |man |citizen )?(?:[A-Z][\w'’-]+\s+){1,5}(?:\([^)]*\)\s+)?(?:(?:from|of) (?:[A-Z][\w'’-]+\s*){1,4})?)(?:was |is )?(?:killed|dies|died|martyred|succumbs?|succumbed)(?: (?:of|to) (?:his |her )?wounds)?\.?$/;
const HOME_ECONOMY = /\b(?:inflation|interest rates?|Federal Reserve|the Fed\b|gasoline|petrol prices|households?\b|VAT\b|earnings|price rises|record output|pumps at record|cruise ships?|airlines?' losses|food prices)\b/i;
/** Household economics stays when the war is in it (user, 29 Oct: "not necessarily not news, depends"): China raising fuel prices "as oil climbs on Iran war" is the war's cost; the Fed's rate is not. */
const ECONOMY_OF_WAR = /\b(?:war|Iran\w*|Hormuz|Houthis?|Yemen\w*|Gaza|Red Sea|blockade|sanction\w*|missiles?|drones?|strikes?|attacks?|Israel\w*|Leban\w+|Palestin\w*|tankers?|shipping)\b/i;

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
/** Russia's state media. */
const RUSSIAN_STATE = /^(?:TASS|RIA(?: Novosti)?|RT(?: Arabic)?|Sputnik)\b/i;
/** A headline led by a country or person the nations list does not hold (Australia, Obama, China…). */
const FOREIGN_SPEAKER = /^(?:the )?(?:Australian?|Obama|Biden|Harris|Pakistan(?:i)?|Chinese|China|French|France|German(?:y)?|EU|European|Japan(?:ese)?|India(?:n)?|Canad(?:a|ian)|Turk(?:ey|ish)|Egypt(?:ian)?|Jordan(?:ian)?|Syria(?:n)?|Federal Reserve|Fed)\b/i;
const UKMTO_TOLD =/\b(?:UKMTO|UKTMO|UK Maritime Trade|United Kingdom Maritime Trade|British maritime security agency)\b/i;

const HEBREW_OUTLET = String.raw`(?:Israel's |Israeli )?(?:Channel 1[1-4]|Kan(?: News| 11)?|N12|Ynet|Yedioth Ahronoth|Yediot Aharonot|Maariv|Haaretz|Israel Hayom|Walla|i24(?: News)?|Army Radio|Galei Tzahal|Times of Israel|Jerusalem Post|Hebrew media|Israeli media|Israeli Broadcasting Authority)`;
const HEBREW_OUTLET_LEAD = new RegExp(String.raw`^${HEBREW_OUTLET}\s*(?::|reports?\b|reported\b|says\b)`, "i");
const HEBREW_OUTLET_TELLS = new RegExp(String.raw`(?:,\s*|\bas\s+|\baccording to\s+)${HEBREW_OUTLET}\s+(?:reports?|reported|says|said)?\s*$|\b(?:according to|citing)\s+${HEBREW_OUTLET}\b`, "i");

export type RelayInput = { headline: string; body?: string; source: string; lean?: string; desk: DeskId; own?: boolean; type?: string };

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
  return otherSide(h, s, x.type, x.lean);
}

/**
 * Every side's story from that side's own sources, one rule for every outlet (user, 9 Oct: "every country's news from
 * its own sources … another outlet only for its own exclusive"; 29 Oct: "make general rules, not one for Iranian or
 * Russian outlets", after Trump's rally from TASS, Obama from IRNA, the Fed from Nour News, Australia's travel warning
 * from VOA Farsi). An outlet's own scoop is let through by the caller, and a wire tells anyone's.
 * - Words: what a country's or a side's people said is told by its own outlets, whoever else passes it on.
 * - Acts: a side's own media (state and party media: Iran's, Russia's, the axis', the Palestinian factions' and
 *   agencies') tell their own side's acts, or what was done on their soil, never a third country's.
 */
const PALESTINE_WORDS = /\b(?:Palestin\w*|Hamas|Islamic Jihad|PIJ|Saraya al-Quds|Qassam|Fatah|PA|Abbas|Gaza\w*|Judea|Samaria|Ramallah|Jenin|Nablus|Hebron|Tulkarm|Qalqilya|Bethlehem|Jericho|Khan Y[ou]+nis|Rafah|Deir al-Balah|Jabalia|Nuseirat|Bureij|Maghazi|Beit Lahia|Beit Hanoun|Salfit|Tubas)\b/;
type Side = Nation | "palestine";
function homeSide(source: string, lean = ""): { side: Side; party: boolean } | null {
  const s = String(source || "").trim();
  if (IRANIAN_OUTLET.test(s)) return { side: "iran", party: true };
  if (RUSSIAN_STATE.test(s)) return { side: "russia", party: true };
  if (["pa", "factions", "palestinian"].includes(gazaLeanOf(s))) return { side: "palestine", party: true };
  // A Lebanese outlet close to Hezbollah is Lebanon's (Israel's shelling of the south is its own soil).
  const n = sourceNation(s, lean === "axis" ? "" : lean);
  if (n) return { side: n, party: /^(?:Al-Manar|Al Manar|Unews)\b/i.test(s) };
  return lean === "axis" ? { side: "iran", party: true } : null;
}
const namesSide = (side: Side, text: string): boolean => (side === "palestine" ? PALESTINE_WORDS.test(text) : namesNation(side, text) || (side === "lebanon" && LEBANON_PLACE.test(text)));
function sideOf(text: string): Side | "other" | null {
  const n = subjectNation(text);
  const p = PALESTINE_WORDS.exec(text);
  const at = n ? (NATION_FIRST.exec(text)?.index ?? Infinity) : Infinity;
  if (p && p.index < at) return "palestine";
  return n ?? (FOREIGN_SPEAKER.test(text) ? "other" : null);
}
/** Where the first country named in a text stands (for comparing with the Palestinian words). */
const NATION_FIRST = /\b(?:US|U\.S\.|American|Washington|Trump|White House|Pentagon|Iran\w*|Tehran|IRGC|Israel\w*|IDF|Netanyahu|Saudi\w*|Riyadh|UAE|Emirat\w*|Qatar\w*|Oman\w*|Iraq\w*|Leban\w*|Hezbollah|Yemen\w*|Houthis?|Russia\w*|Kremlin|Putin|UK|British|Britain)\b/;
export function otherSide(headline: string, source: string, type?: string, lean = ""): string | null {
  const h = String(headline || "");
  const s = String(source || "").trim();
  if (isWireSource(s) || officialVoice(s)) return null;
  const home = homeSide(s, lean);
  if (!home) return null;
  const lead = leadOf(h);
  const ownWords = (t: string) => namesSide(home.side, t) || (home.side === "iran" && (IRAN_ACTOR_WORD.test(t) || /\b(?:Mokhber|Khatibzadeh|Gharibabadi|Ebnolreza|Velayati|Shamkhani|Qaani|Vahidi|Mousavi|Hatami)\b/.test(t)));
  // Someone speaks first: a speaker of another side is told by that side's own outlets.
  // The outlet's own name, or "sources", before the colon is no speaker: the rest is judged.
  const teller = !lead || s.toLowerCase().startsWith(lead.toLowerCase()) || /\bsources?\b|\bmedia\b/i.test(lead);
  const speaker = lead && !teller ? sideOf(lead) : null;
  if (lead && !teller && speaker && speaker !== home.side && !ownWords(lead)) return `relay: ${lead} is told from its own side's sources, not ${s}`;
  // Who the story is about: its first words ("Obama blames…", "US Federal Reserve holds…", "UAE calls for…").
  const rest = teller && lead ? h.slice(h.indexOf(":") + 1).trim() : h;
  const subject = rest.split(/\s+/).slice(0, 4).join(" ");
  const about = sideOf(subject) ?? sideOf(rest);
  if (!about || about === home.side) return null;
  // Israel's forces and citizens in Gaza and Judea and Samaria act on the Palestinians' own soil.
  if (home.side === "palestine" && about === "israel" && !THIRD_LAND.test(rest)) return null;
  // Words: what another side said is told by its own outlets.
  const spoken = SPEECH.test(rest.split(/[,;]/)[0]);
  if (spoken && WORDS_TYPES.has(String(type ?? "")) && !ownWords(subject)) return `relay: ${s} tells its own side's story; this one is told from its own side's sources`;
  // A side's own media on another country: its words and figures are that country's to tell; an act, by where it
  // happened ("explosions hit Ras Tanura in Saudi Arabia", "US warplanes over Erbil in northern Iraq"), not by who
  // did it ("US strike hit a school in Minab" is Iran's own soil).
  if (home.party && (spoken || type === "economy") && !ownWords(subject)) return `relay: ${s} tells its own side's words only, not another country's`;
  const land = landOf(rest);
  if (home.party && !spoken && land && land !== home.side && !ownWords(rest)) return `relay: ${s} tells what happens on its own side's soil, not in another country`;
  return null;
}
/** The country an act happened in: a country named after "in", "over", "at", "off", "near". */
function landOf(text: string): Side | "other" | null {
  for (const m of text.matchAll(/\b(?:in|over|at|off|near|inside|across)\s+(?:the\s+|northern\s+|southern\s+|eastern\s+|western\s+|central\s+)?([^,;.]{2,40})/gi)) {
    const side = sideOf(m[1].split(/\s+/).slice(0, 4).join(" "));
    if (side) return side;
  }
  return null;
}
const WORDS_TYPES = new Set(["statement", "diplomacy", "politics"]);
const SPEECH = /\b(?:says?|said|calls?|called|urges?|urged|warns?|warned|blames?|blamed|condemns?|condemned|demands?|stresses|stressed|affirms?|affirmed|denies|denied|threatens?|vows?|announces?|announced|accuses?|tells?|told|wants?|insists?|rejects?|welcomes?|praises?|hails?)\b/i;
const THIRD_LAND = /\b(?:Leban\w*|Syria\w*|Iran\w*|Yemen\w*|Iraq\w*|Egypt\w*|Jordan(?!\s+Valley)\w*|Saudi\w*|Qatar\w*|Turk\w*|US|U\.S\.|American|Washington)\b/;

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

/**
 * A Palestinian source's account of an event is its claim, not the desk's fact (user, 26 Oct: "every palestinian
 * report dont present it as fact"): "Gaza Health Ministry (Hamas-run): three killed …", "Palestinian media: Israeli
 * forces raid Nablus". A headline that already names its teller ("X: …", "says", "according to") is left as it is.
 */
const PAL_EVENT = /\b(?:kill\w*|dead|wound\w*|injur\w*|strikes?|struck|shell\w*|fire[sd]?|firing|shot|shoots?|raid\w*|storm\w*|arrest\w*|detain\w*|abduct\w*|demolish\w*|bulldoz\w*|attack\w*|advance\w*|incursion|bomb\w*|drones?|quadcopter|torch\w*|burn\w*|assault\w*|beat(?:s|en)?|displac\w*|seiz\w*|uproot\w*|clash\w*)\b/i;
export function palestinianClaim(headline: string, type: string, source: string): string {
  let h = String(headline || "");
  if (!["pa", "factions", "palestinian"].includes(gazaLeanOf(source))) return h;
  // One teller's name for the Palestinian outlets (29 Oct review): "Local sources: …", "…, local sources say" and a
  // fan channel standing as the armed wing ("Saraya al-Quds:" from Ahfad al-Bahaa) are "Palestinian media: …".
  const fan = /Ahfad al-Bahaa/i.test(source);
  if (/^(?:Local|Palestinian local|Field) sources?:\s/i.test(h) || (fan && /^Saraya al-Quds:\s/i.test(h))) h = h.replace(/^[^:]+:\s*/, "Palestinian media: ");
  else if (/,\s*(?:local|Palestinian) sources say\.?$/i.test(h)) h = `Palestinian media: ${h.replace(/,\s*(?:local|Palestinian) sources say\.?$/i, "")}`;
  // A deed on the ground is told as its teller's whatever the reader typed it (29 Oct: WAFA's 19 houses demolished in Salfit, typed humanitarian, stood as fact).
  if ((TALK_TYPES.has(type) && !HARD_DEED.test(h)) || !PAL_EVENT.test(h) || /^[^:]{2,60}:\s/.test(h) || /\b(?:says?|said|claims?|claimed|according to|reports?|reported|alleges?|accus\w+)\b/i.test(h)) return h;
  const who = /Health Ministry/i.test(source) ? `${source}${/Ramallah/i.test(source) ? "" : " (Hamas-run)"}` : /Civil Defen[cs]e|Media Office|Interior Ministry/i.test(source) ? `${source} (Hamas-run)` : !fan && /^(?:Hamas|Islamic Jihad|Saraya|Al-Qassam|WAFA)/i.test(source) ? source : "Palestinian media";
  return `${who}: ${h}`;
}
const HARD_DEED = /\b(?:killed|wounded|injured|demolish\w*|bulldoz\w*|raid(?:s|ed)?|arrest(?:s|ed)|detain(?:s|ed)|shot|shell(?:s|ed)|struck|seiz(?:es|ed)|burn(?:s|ed|t)|uproot\w*|stormed)\b/i;
const TALK_TYPES = new Set(["statement", "diplomacy", "politics", "analysis", "economy", "humanitarian"]);

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
    // A speaker's "enemy" is his word, quoted (29 Oct: the IRGC deputy commander's "ready to respond to any
    // adventure by the enemy" was refused three times for the word and lost).
    .replace(/\b(the|any|an) (enem(?:y|ies)(?:['’]s)?)\b(?!["”])/gi, '$1 "$2"')
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

/**
 * Gaza and Judea and Samaria have their own desk (user, 26 Oct: the Gaza desk live): a card on them leaves the
 * Iran desk unless Iran or its allies are in its headline.
 */
const AXIS_IN = /\b(?:Iran\w*|Tehran|IRGC|Khamenei|Araghchi|Pezeshkian|Hezbollah|Lebanon|Lebanese|Houthis?|Yemen\w*|Iraq\w*|Syria\w*|axis)\b/i;
export function gazaOnIran(summary: string): boolean {
  return palestineArena(summary) && !AXIS_IN.test(summary);
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

/**
 * A speaker few readers know, led by name alone (user, 24 Oct: "Haghighatpour:", "Salehi:", "Dawoud:" — "should
 * say his role"): the name, so the card is written again with the role; null when the lead is famous, an office
 * the table titles, a body or a country, or already carries a role.
 */
/**
 * A lead that is not a person: a country, a body, an outlet, an armed group (29 Oct: "South Korea:", "Coalition:",
 * "WHO:", "Shehab:", "Saraya al-Quds:", "Kuwaiti Foreign Ministry:", "The Atlantic:" were all sent back as unknown
 * people, and 40 items were lost with them). The name rules are for people only.
 */
const COUNTRY_NAMES = /^(?:the )?(?:Afghanistan|Albania|Algeria|Argentina|Armenia|Australia|Austria|Azerbaijan|Bahrain|Bangladesh|Belarus|Belgium|Brazil|Britain|Bulgaria|Canada|Chile|China|Colombia|Croatia|Cuba|Cyprus|Czechia|Denmark|Djibouti|Egypt|Eritrea|Ethiopia|Finland|France|Georgia|Germany|Greece|Hungary|India|Indonesia|Iran|Iraq|Ireland|Israel|Italy|Japan|Jordan|Kazakhstan|Kenya|Kuwait|Lebanon|Libya|Malaysia|Mexico|Morocco|Netherlands|New Zealand|Nigeria|North Korea|Norway|Oman|Pakistan|Palestine|Philippines|Poland|Portugal|Qatar|Romania|Russia|Saudi Arabia|Serbia|Singapore|Slovakia|Somalia|South Africa|South Korea|Spain|Sudan|Sweden|Switzerland|Syria|Taiwan|Tunisia|Turkey|Türkiye|UAE|UK|Ukraine|United Kingdom|United States|US|Uzbekistan|Venezuela|Vietnam|Yemen)\b/i;
const BODY_WORDS = /\b(?:Coalition|WHO|UNICEF|UNRWA|OCHA|WFP|ICRC|HRANA|AEOI|Ministry|Ministries|Authority|Authorities|Office|Council|Committee|Commission|Organi[sz]ation|Agency|Center|Centre|Network|News|Media|Press|Times|Post|Journal|Gazette|Atlantic|Monitor|TV|Radio|Channel|Front|Brigades?|Battalions?|Forces|Army|Navy|Police|Guard|Movement|Party|Bloc|Government|Presidency|Parliament|Embassy|Consulate|Mission|Directorate|Department|Bureau|Union|League|Federation|Association|Foundation|Institute|Group|Company|Corporation|Bank|Fund|Court|Prosecution|Municipality|Saraya|Qassam|Quds|Shehab|Safa|WAFA|Maan|Hamas|Hezbollah|Houthis?|Fatah|Jihad|Kataib|Crossings|Club|Society|Syndicate|Observatory|Campaign)\b/;
/** An outlet by its name (29 Oct: "Al-Alam:", "Al-Resalah:", "MTV:" were sent back as unknown people). */
const OUTLET_NAMES = /^(?:[A-Z0-9]{2,6}|(?:Al|Ad|An|Ar|As|El)[- ](?:Alam|Resalah|Akhbar|Manar|Mayadeen|Masirah|Arabiya|Hadath|Jazeera|Mashhad|Modon|Binaa|Joumhouria|Nashra|Ayyam|Thawrah|Thawra|Watan|Quds|Araby|Ahram|Sharq|Awsat|Jadeed|Diyar|Hurra|Mihwar|Qahera|Nahar|Sabah|Rai|Masry|Shorouk|Bayan|Khaleej|Riyadh|Yaum|Youm|Hayat|Ghad|Sumaria|Etejah|Ahd|Furat|Sharqiya|Mirbad)(?: [A-Z][\w-]+)?|Asharq(?: [A-Z][\w-]+)?|Nidaa al-Watan|Lebanon Debate|Ma.an|Safa|Shehab|Elnashra)$/;
export function notAPerson(name: string): boolean {
  const n = String(name || "").trim();
  return COUNTRY_NAMES.test(n) || BODY_WORDS.test(n) || OUTLET_NAMES.test(n) || /^(?:President|Prime Minister|PM|King|Emir|Crown Prince|Sultan|Pope)\s/.test(n);
}

export function bareSpeaker(headline: string): string | null {
  const m = /^([A-Z][\p{L}'’-]+(?: [A-Z][\p{L}'’-]+)?):\s/u.exec(String(headline || ""));
  if (!m || FAMOUS.test(m[1]) || knownRole(m[1]) || notAPerson(m[1])) return null;
  if (IRAN_OFFICES.some((o) => o.name === m[1].split(" ").pop())) return null;
  if (subjectNation(m[1]) || /^(?:IRGC|IDF|CENTCOM|Hezbollah|Hamas|UN|UNIFIL|IAEA|EU|NATO|OPEC|UKMTO|Houthis?|Kataib|Nujaba|Treasury|Pentagon|Kremlin|Ansarallah|Reuters|Axios|Sources?|Officials?)$/i.test(m[1])) return null;
  // A role word in the lead already ("Spokesman Baghaei:" is two words with its role).
  if (/^(?:Spokes\w+|Minister|Commander|General|President|Envoy|Ambassador|MP|Speaker|Senator|Governor|Mayor|Sheikh|Imam|Judge)\b/i.test(m[1])) return null;
  return m[1];
}

/**
 * Words with their speaker dropped (user, 24 Oct: "Bahrain belongs to Iran and will be taken back…" over Iran
 * International's "…, Hossein Shariatmadari, editor-in-chief of the hardline Kayhan newspaper, said"): the
 * speaker the source names, when the headline names none.
 */
export function droppedSpeaker(headline: string, type: string, sourceText: string): string | null {
  const h = String(headline || "");
  if (type !== "statement" || /^[^:]{2,80}:\s/.test(h)) return null;
  const m = /,\s((?:[A-Z][\p{L}'’-]+ ){0,2}[A-Z][\p{L}'’-]+),\s[^.]{3,140}?,\s(?:said|says|told|wrote|warned|declared)\b/u.exec(String(sourceText || ""));
  if (!m) return null;
  const surname = m[1].split(" ").pop()!;
  return h.includes(surname) ? null : m[1];
}

/**
 * A role the source does not give (user, 29 Oct: Al-Alam's "العميد محبي" — the IRGC's spokesman — went out as
 * "IRGC Navy commander Mahabi", the posts before his being the Navy's). Each role word in the speaker's lead needs
 * its word in the source, in any of its languages; one that has none was made up. Returns the made-up word.
 */
const ROLE_WORDS: [RegExp, RegExp][] = [
  [/\b(?:navy|naval)\b/i, /navy|naval|marine|بحري|بحرية|دریایی|دريايي|ימי|הים/i],
  [/\bspokes(?:man|woman|person)\b/i, /spokes|متحدث|ناطق|سخنگو|דובר/i],
  [/\bcommander\b/i, /command|chief|head|قائد|قيادي|آمر|فرمانده|سردار|מפקד|אלוף/i],
  [/\bdeputy\b/i, /deputy|vice|second|نائب|مساعد|معاون|جانشین|סגן/i],
  [/\bambassador\b/i, /ambassador|envoy|سفير|سفیر|שגריר/i],
  [/\badvis[eo]r\b/i, /advis|counsel|مستشار|مشاور|יועץ/i],
  [/\bair force\b/i, /air force|aerospace|airforce|الجوي|الجوية|هوافضا|هوایی|האוויר/i],
  [/\bintelligence\b/i, /intelligence|استخبار|مخابرات|اطلاعات|מודיעין/i],
];
export function inventedRole(headline: string, type: string, sourceText: string): string | null {
  const text = String(sourceText || "");
  if (text.trim().length < 20 || !["statement", "diplomacy", "politics"].includes(type)) return null;
  const h = String(headline || "");
  // The speaker's lead: up to the colon, or the words before the first verb.
  const lead = /^[^:]{2,80}(?=:\s)/.exec(h)?.[0] ?? (/^(?:[A-Z][\p{L}.'’-]*\s+|(?:of|the|al-|for)\s+|[a-z]+\s+(?=[A-Z]))+/u.exec(h)?.[0] ?? "");
  for (const [word, inText] of ROLE_WORDS) {
    const m = word.exec(lead);
    if (m && !inText.test(text)) return m[0];
  }
  return null;
}

/**
 * Party leaders and figures the channels name by surname alone, which the copy often does not explain (user, 27 Oct:
 * LBCI's "الجميّل من الكفور" went out as "Gemayel:" — "should have said his role"). Only surnames one person goes by.
 */
const KNOWN_ROLES: Record<string, string> = {
  Gemayel: "Kataeb leader Samy Gemayel",
  Geagea: "Lebanese Forces leader Samir Geagea",
  Bassil: "Free Patriotic Movement leader Gebran Bassil",
  Frangieh: "Marada leader Suleiman Frangieh",
  Mikati: "Former Lebanese PM Najib Mikati",
  Raad: "Hezbollah bloc head Mohammad Raad",
  Haykal: "Lebanese army commander Rodolphe Haykal",
  Eisenkot: "Former IDF chief Gadi Eisenkot",
  Lapid: "Israeli opposition leader Yair Lapid",
  Bennett: "Former Israeli PM Naftali Bennett",
  Gantz: "Former Israeli defence minister Benny Gantz",
  Liberman: "Yisrael Beytenu leader Avigdor Liberman",
  // Not "Jumblatt": the father and the son both speak (29 Oct: Taymour's words went out as Walid's).
  // The IRGC's spokesman, whom Al-Alam names by rank and surname alone (29 Oct: "IRGC Navy commander Mahabi").
  Mohebbi: "IRGC spokesman Brig. Gen. Hossein Mohebbi",
  Mohabi: "IRGC spokesman Brig. Gen. Hossein Mohebbi",
  Mahabi: "IRGC spokesman Brig. Gen. Hossein Mohebbi",
  Rai: "Maronite Patriarch Bechara al-Rai",
  Berri: "Lebanese Parliament Speaker Nabih Berri",
  Salam: "Lebanese PM Nawaf Salam",
  Rajji: "Lebanese FM Youssef Rajji",
  Yazbek: "Lebanese Forces MP Ghayath Yazbek",
  Sayegh: "Kataeb MP Salim al-Sayegh",
};
/** Lebanon's parties as the channels name them, with a few words a reader needs (the audit of 27 Oct: "Kataeb:"). */
const KNOWN_GROUPS: Record<string, string> = {
  Kataeb: "Lebanon's Kataeb Party",
  "Kataeb Party": "Lebanon's Kataeb Party",
  "Lebanese Forces": "Lebanese Forces party",
  Marada: "Lebanon's Marada movement",
  "Free Patriotic Movement": "Lebanon's Free Patriotic Movement",
  Amal: "Lebanon's Amal movement",
  "Amal Movement": "Lebanon's Amal movement",
};
/** The table's role for a lead that is the surname alone or the same person's full name. */
export function knownRole(lead: string): string | null {
  if (KNOWN_GROUPS[lead]) return KNOWN_GROUPS[lead];
  const surname = lead.split(" ").pop()!;
  const known = KNOWN_ROLES[surname];
  return known && (lead === surname || known.endsWith(` ${lead}`)) ? known : null;
}

/** A bare-surname lead with no role: its role from the table, or from the card's copy. */
export function speakerByRole(headline: string, copy = ""): string {
  const h = String(headline || "");
  const m = /^([A-Z][\p{L}'’-]+(?: [A-Z][\p{L}'’-]+)?):\s/u.exec(h);
  if (!m || FAMOUS.test(m[1])) return h;
  const known = knownRole(m[1]);
  if (known) return `${known}${h.slice(m[1].length)}`;
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
  return paragraphs(t);
}

/**
 * A long body in one block is split into paragraphs of three sentences (user, 27 Oct, Pezeshkian's speech: "try
 * spacing such long reports to paragraphs logically"). A body the writer already split is left as it is.
 */
export function paragraphs(text: string): string {
  const t = String(text || "").trim();
  if (!t || /\n\s*\n/.test(t)) return t;
  const parts: string[] = [];
  let cur = "";
  // A sentence ends at . ! ? (and a closing quote) before a capital or a quote; "Lt. Col.", "U.S." and "No. 2" do not end one.
  for (const m of t.matchAll(/[^]*?(?:[.!?]["”’)]?(?=\s+["“A-Z])|$)/g)) {
    if (!m[0]) continue;
    cur += m[0];
    if (/\b(?:Lt|Col|Gen|Maj|Capt|Brig|Mr|Mrs|Ms|Dr|Sgt|Adm|Gov|Sen|Rep|St|No|vs|Jr|Sr|[A-Z](?:\.[A-Z])+)\.$/.test(cur.trim())) continue;
    parts.push(cur.trim());
    cur = "";
  }
  if (cur.trim()) parts.push(cur.trim());
  if (parts.length < 5) return t;
  const out: string[] = [];
  // Threes, and never one sentence left alone at the end (four left: two and two).
  for (let i = 0; i < parts.length; ) {
    const n = parts.length - i === 4 ? 2 : 3;
    out.push(parts.slice(i, i + n).join(" "));
    i += n;
  }
  return out.join("\n\n");
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
  // The first person anywhere outside quotes, too (user, 29 Oct: "it doesn't say who says the things, just the
  // things themselves" — LBCI's "Explosives file must go to the Judicial Council, we trust the judges").
  const bare = h.replace(/["“][^"”]*["”]/g, " ");
  return /^(?:We|We're|We've|Our|Us|I|I'm|I've|My|Ready (?:for|to)|No basis|Not ready|Never|Will not|Won't|Cannot)\b/.test(h) || /\b(?:we|our|ours|us|my)\b|\bI(?= [a-z])/.test(bare);
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
/**
 * A speaker lead the line then says again (26 Oct, Arab News: "Saudi defence minister Prince Khalid bin
 * Salman: Saudi defence minister leads delegation to Tehran"): the line alone.
 */
export function doubledLead(headline: string): string {
  const m = /^([^:]{6,90}):\s+(.+)$/.exec(String(headline || ""));
  if (!m) return headline;
  const words = (s: string) => s.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
  if (m[1].split(/\s+/).length < 3 || words(m[1]) !== words(m[2])) return headline;
  return m[2].charAt(0).toUpperCase() + m[2].slice(1);
}

/**
 * A headline that opens with "It" names no one (user, 27 Oct: the IDF's "It eliminated four Hamas and Islamic
 * Jihad operatives …"): the account it came from says it.
 */
export function ownSubject(h: string, source: string): string {
  const m = /^It\s+(?=[a-z]+ed\s)/.exec(h);
  const s = String(source || "").trim();
  if (!m || !s) return h;
  const who = /^(?:IDF|UN|EU|PA|IRGC|White House|State Department|Pentagon|Lebanese Army)\b/.test(s) ? `The ${s}` : s;
  return `${who} says it ${h.slice(m[0].length)}`;
}

/** The source is the one who said or found it: an official body, or the outlet's exclusive. */
export function ownWord(source: string, flags: unknown): boolean {
  if (Array.isArray(flags) && flags.includes("exclusive")) return true;
  return isOfficial(source) || gazaOfficial(source) || officialVoice(source) != null;
}

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
    if (gazaOnIran(summary)) return false;
  }
  if (desk === "yemen" && gulfCoastShip(type, `${summary}\n${text}`)) return false;
  const lebanon = lebanonContext(`${summary} ${text}`, source);
  const houthi = r.side === "houthi" || HOUTHI_OUTLET.test(source);
  const fix = (s: string) => {
    let out = officeTitles(partisanWords(respell(s), lebanon, desk === "iran"));
    if (desk === "yemen") out = houthiWords(out, houthi);
    // The Gaza desk's own words on every stored card of every desk (gaza-words.ts; 24 Oct: "West Bank" on an Iran card).
    out = gazaWords(out);
    return doubledLead(out);
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
  // Israel's and the Palestinians' own words likewise, from their own sources (a stored "Israeli Defence Minister proposes …" from an axis relay).
  const sideRule = (src: string) => gazaSourceRule({ headline: summary, type, source: src }) ?? arenaSourceRule({ headline: summary, type, source: src });
  if (desk !== "yemen" && !flags.includes("exclusive") && !exclusiveUrl(String(r.url ?? "")) && sideRule(source)) {
    const also = (Array.isArray(r.alsoReportedBy) ? r.alsoReportedBy : []) as { source: string; url: string }[];
    const next = also.find((a) => a?.url && !sideRule(a.source));
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
  h = ownSubject(h, String(r.source ?? source));
  if (desk === "yemen" && houthi) h = houthiClaim(h, type, source);
  if (desk === "gaza") h = palestinianClaim(h, type, String(r.source ?? source));
  // A finished act in the past tense, and Iran's and Russia's outlets on their own country's story only (29 Oct review).
  h = pastTense(h);
  // One rule for every side (otherSide): an account from the right side under the card leads it; with none, the card
  // is not shown unless it is the outlet's own scoop.
  if (!flags.includes("exclusive") && !exclusiveUrl(String(r.url ?? "")) && otherSide(h, String(r.source ?? source), type, String(r.lean ?? ""))) {
    const also = (Array.isArray(r.alsoReportedBy) ? r.alsoReportedBy : []) as { source: string; url: string }[];
    const next = also.find((a) => a?.url && a.source && !otherSide(h, a.source, type));
    if (!next) return false;
    r.alsoReportedBy = [{ source: String(r.source ?? source), url: String(r.url ?? "") }, ...also.filter((a) => a !== next)];
    r.source = next.source;
    r.url = next.url;
  }
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
  // An official's own word, or an outlet's own exclusive, needs no "Also" (user, 27 Oct).
  if (Array.isArray(r.alsoReportedBy) && r.alsoReportedBy.length && ownWord(String(r.source ?? ""), r.flags)) r.alsoReportedBy = [];
  const t = rightType(type, h);
  if (t !== type) r.type = t;
  // An Arabic outlet name ("وردنا") is shown in Latin letters.
  if (/[؀-ۿ]/.test(source)) r.source = anglicise(source);
  return true;
}
