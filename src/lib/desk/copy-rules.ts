/**
 * Copy rules from the review of 18 Oct (the latest 400 cards per desk; notes
 * in review-18oct-findings.md). Each kind of fault the review found is a rule
 * here, used twice: on a new card (editor.ts decide/decideIran turn it away or
 * fix it) and, where it is safe, on a stored card as it is served
 * (`serveCard`, from /api/desk). Duplicates are copies.ts's, not these.
 */
import { anglicise } from "./anglicise.ts";
import type { DeskType } from "./digest.ts";
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
const COMMENTATOR_LEAD =
  /^(?:[^:]{0,50}\b)?(?:analysts?|commentators?|researchers?|writers?|journalists?|columnists?|experts?|academics?|professors?|ex-PM|former (?:\w+ ){0,2}?(?:prime minister|PM|minister|official|ambassador|general|officer|envoy|president|diplomat))\b[^:]{0,50}:/i;
const COMMENTATORS = /\bex-PM\b|\b(?:Citrinowicz|Andreas (?:Craig|Krieg)|Nusbacher|Khalid Al-Nasi|Ali al-Asali)\b/i;
const COMMENTATOR_BODY = /^[^.]{0,80}\b(?:a|an) (?:former (?:\w+ ){0,3}?(?:officer|official|minister|diplomat|general)|analyst|researcher|commentator|military expert|writer|journalist|fellow at)\b/i;
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
  if (OFF_TOPIC.test(h) && !WAR_WORD.test(h)) return "off-topic: nothing of the war in it";
  if (/\bblood donation\b|\bdonation campaign\b/i.test(h)) return "off-topic: a civic campaign is not a report";
  if (OUTLET_ANALYSIS.test(h)) return "analysis: an outlet's own assessment is not a report";
  if (COMMENTATOR_LEAD.test(h) || COMMENTATORS.test(h)) return "commentary: analysts, writers and former officials are not reports";
  if (/^[^:]{2,60}:\s/.test(h) && COMMENTATOR_BODY.test(String(body || ""))) return "commentary: the speaker is an analyst or a former official";
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

export type RelayInput = { headline: string; body?: string; source: string; lean?: string; desk: "yemen" | "iran"; own?: boolean };

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
const LEBANESE_OUTLET = /^(?:NBN|LBCI|Al-Manar|Al Manar|NNA|National News Agency|MTV Lebanon|Al Mayadeen|Al-Akhbar|Ali Shoaib|Unews|Lebanon 24|L'Orient)/i;
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
const IRAN_OFFICES: { name: string; office: string }[] = [
  { name: "Araghchi", office: "Iran's foreign minister" },
  { name: "Khatibzadeh", office: "Iran's deputy foreign minister" },
  { name: "Gharibabadi", office: "Iran's deputy foreign minister" },
  { name: "Ebnolreza", office: "Iran's acting defence minister" },
  { name: "Baghaei", office: "Iran's foreign ministry spokesman" },
];

/**
 * Titles (7 and 8, Iran): Araghchi is foreign minister, not UN ambassador;
 * a bare surname opening a headline gets its office; "Sardar" is the IRGC's
 * word for a general; Iraq's prime minister is Ali al-Zaidi (since 14 May).
 */
export function officeTitles(s: string): string {
  let out = String(s || "");
  out = out.replace(/\b(?:Iran's |Iranian )?(?:UN ambassador|ambassador to the UN|envoy to the UN)( Abbas)? Araghchi\b/g, "Iran's foreign minister$1 Araghchi");
  out = out.replace(/\b(Iraq(?:i|'s) (?:Prime Minister|PM)) (?:Mohammed (?:Shia['’]? )?)?(?:Al-|al-)?Sudani\b/g, "$1 Ali al-Zaidi");
  // "Acting defence minister Sardar Ebnolreza": the office says it. Elsewhere Sardar is General.
  out = out.replace(/\b((?:minister|commander|chief|spokesman|adviser|deputy|head)\s+)Sardar\s+/gi, "$1");
  out = out.replace(/\bSardar\s+(?=[A-Z])/g, "General ");
  for (const { name, office } of IRAN_OFFICES) {
    out = out.replace(new RegExp(`^(?:Saeed |Said |Kazem |Majid |Abbas |Esmaeil |Ismail )?${name}:`), `${office[0].toUpperCase()}${office.slice(1)} ${name}:`);
  }
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
export function ungarble(headline: string): string {
  const h = String(headline || "");
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

/** Garbled copy a second writing should mend (new cards only). */
export function garbled(headline: string, sourceText = ""): string | null {
  const h = String(headline || "");
  // "Clash in Abyan linked to vehicle linked to former Al-Qaeda leader".
  if (/\b(\w+ed (?:to|by|in|on|with))\b(?:\s+\S+){1,4}?\s+\1\b/i.test(h)) return "garbled: a phrase written twice";
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
 * Stored cards, as they are served.
 * ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

/**
 * A stored card as it is served: false when the review's rules would have
 * kept it off this desk (not news, home affairs, the wrong desk, a Truth
 * Social card that is not Trump's); otherwise its copy and type fixed in
 * place. The row in the database is left as it is.
 */
export function serveCard(r: Row, desk: "yemen" | "iran"): boolean {
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
    return out;
  };
  let h = ungarble(fix(summary));
  if (desk === "yemen" && houthi) h = houthiClaim(h, type, source);
  r.summary = h;
  if (text) r.text = cleanBody(fix(text), source);
  const t = rightType(type, h);
  if (t !== type) r.type = t;
  // An Arabic outlet name ("وردنا") is shown in Latin letters.
  if (/[؀-ۿ]/.test(source)) r.source = anglicise(source);
  return true;
}
