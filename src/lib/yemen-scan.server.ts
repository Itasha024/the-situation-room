/**
 * Server-only live source scanner for the Yemen desk. Never import from client.
 *
 * Reads the operator's source catalogue on a per-source cadence, runs every raw
 * item through the interest gate and the English wire-style composer
 * (`src/lib/desk/*`), and keeps only what survives both.
 *
 * Two things this file deliberately records for every raw item, kept or dropped:
 *   seenAt — when THIS desk first saw it, which is what the scan box sorts on
 *   reason — why it was kept or dropped, so the operator can audit the judgement
 */

import { createHash } from "node:crypto";
import { placesInCountry, type Place } from "./desk/gazetteer.ts";
import { digest } from "./desk/digest.ts";
import { FINAL_EXCLUDES, NOISE_REASONS, type Outcome } from "./desk/relevance.ts";
import { refreshBrief } from "./desk/brief-store.ts";
import { deskDay } from "./desk/brief.ts";
import { backupDaily } from "./desk/backup.ts";
import { type Candidate, confidenceOf, editCandidates, onRadar, queueForReading } from "./desk/editor.ts";
import { dbMeter, getStore, migrateBlob, resetDbMeter } from "./desk/store.ts";
import { desksOf } from "./desk/desk-route.ts";
import { cleanUrl, isGnews, resolveGoogleNews } from "./desk/gnews.ts";
import { type ReRead, findCitation, keywords, readOriginal, stripAttribution, traceOrigins } from "./desk/origin.ts";
import { isOfficialBody } from "./desk/numbers.ts";
import { leadSpeaker } from "./desk/speakers.ts";
import { ABROAD_WINDOW_MS, alertCities, citiesOverlap, countedOrNamed, differentSpeakers, keepFirstTimes, numbersClash, otherPartners, OWN_AFTERMATH_MS, ownAftermath, retellsSpeaker, SAME_TARGET_MS, SITE_ATTACK_MS, sameSiteAttack, sameCount, sameDecision, wordsInCommon, sameCountAt, sameEventAbroad, speakerIs, sameFootage, sameGround, sameHeadline, sameStory, sameTarget, sameWave, SPEECH_COPY_MS, speechFrom, speechOwner, sameWords, WAVE_WINDOW_MS, STRIKE_ABROAD_MS, sameStrikeAbroad, OWN_RETELL_MS, ownRetelling, ONE_EVENT_MS, oneEventTwoTypes, RARE_FIGURE_MS, sameRareFigure } from "./desk/copies.ts";
import { type OutletSide, homeOutlet, isAggregator, outletSide } from "./desk/credibility.ts";
import type { LiveReport, Media, RawScanHit, ScanPayload, ScanState, SourceStatus } from "./desk/types.ts";
import { pgSafe } from "./desk/store.pg.ts";
import { type Listed, fetchListing, parseHtmlListing, pageDate, parseListing, titleKey, urlKey } from "./desk/sitemap.ts";
import { DROPPED_OUTLET, type Learned, loadLearned } from "./desk/originals.ts";
import { nearerSource } from "./desk/speaker-press.ts";
import { type CatalogueEntry, type RatedCard, type SourceRatings, type Verdicts, LATER_CHECKED_KEY, RATINGS_KEY, VERDICTS_KEY, laterCandidates, primeRatings, rateSources, ratingsDue, tellers, useRatings, withSeed } from "./desk/source-rating.ts";
import { OWN_ONLY, isExclusive, ownInformation } from "./desk/exclusive.ts";
import { aboutFootage, attachMedia, readNotice, tgMedia, xMedia } from "./desk/media.ts";
import { listenToVideos } from "./desk/listen.ts";
import { triage } from "./desk/triage.ts";
import { askChain, type ChainModel, COMBINE_MODELS } from "./desk/models.ts";
import { addsFacts, combineGroups, enrichCards, members, pickLead, planWaves } from "./desk/combine.ts";
import { checkLinks, judgeLinks, linkOk, namedSpeaker, speakerKey, speakersOf } from "./desk/links.ts";
import { TRIAGE_MODELS } from "./desk/triage.ts";
import type { DeskId } from "./desks.ts";
import { type IranLean, SHARED_RSS, SHARED_TG, SHARED_X, iranLeanOf } from "./desk/iran-sources.ts";
import { isIranWar } from "./desk/iran-reader.ts";
import { colonSpeaker, tidySpeaker } from "./desk/reader.ts";

export { checkLinks, namedSpeaker, speakerKey };

// The wire types moved to ./desk/types.ts so the store and the scanner can
// share them without importing each other. Re-exported so existing imports
// (brief.ts, the API routes) keep working unchanged.
export type { LiveReport, RawScanHit, ScanPayload, SourceStatus } from "./desk/types.ts";

export type Channel = { id: string; name: string; lean: "houthi" | "gov" | "south" | "intl" };
export type Cadence = { everyMin: number } | { everyHours: number } | { atHours: number[] } | { atHour: number };
type ChannelScan = Channel & { cadence: Cadence };
/** `whole`: the site's own listing of everything, triaged by a model. */
/** `html`: no feed; the site's section page is read and every link matching this pattern is an article. */
type RssFeed = { url: string; name: string; id: string; cadence: Cadence; whole?: boolean; ua?: string; site?: string; lang?: "ar"; html?: RegExp };

const C5: Cadence = { everyMin: 5 };
const C15: Cadence = { everyMin: 15 };
/**
 * Websites are read every half hour.
 *
 * They used to be read every 90 minutes or every three hours, and two of them
 * only at fixed times of day, on the reasoning that a newspaper is not a
 * breaking channel. That was wrong about what these sites are: aawsat.com,
 * al-akhbar.com, reuters.com and the rest post through the day, and the pieces
 * worth having — the interview, the exclusive, the despatch with a byline —
 * are exactly the ones that do not arrive on anyone's Telegram. A three-hour
 * gap meant the desk met them cold, hours late, or not at all once they had
 * slipped off the feed's first page.
 *
 * The fetch itself is one request per site, so the cost of this is small; what
 * it buys is the desk seeing an article while it is still news.
 */
const C30: Cadence = { everyMin: 30 };
/** The weeklies and the quieter sections: hourly is still six times a day. */
const C1H: Cadence = { everyHours: 1 };
/** Al-Akhbar, a morning paper in Beirut (the same clock as Jerusalem's): once a day, when it is out. */
const AKHBAR_DAILY: Cadence = { atHour: 7 };

/** Operator-supplied Telegram list — exclusive catalog. */
const TG: ChannelScan[] = [
  { id: "Alomhoar", name: "Al-Mihwar", lean: "houthi", cadence: C5 },
  { id: "Alibk3", name: "Ali Bk", lean: "houthi", cadence: C5 },
  { id: "SabrenNewss", name: "Sabereen News", lean: "houthi", cadence: C5 },
  { id: "naya_foriraq", name: "Naya", lean: "houthi", cadence: C5 },
  { id: "shin_persian", name: "Shin Persian", lean: "houthi", cadence: C5 },
  // The breaking-news channel, not the main one: the main channel posts
  // programme clips ("Marib and Taiz: the battle map") that read as live
  // fighting and were published as clashes happening now.
  { id: "AlarabyTvBrk", name: "Al-Araby TV", lean: "intl", cadence: C5 },
  { id: "shajab_news", name: "Shajab News", lean: "houthi", cadence: C5 },
  { id: "bin_1saeed", name: "Bin Saeed", lean: "gov", cadence: C5 },
  { id: "AjaNews", name: "Al Jazeera", lean: "intl", cadence: C5 },
  { id: "alhadath_brk", name: "Al Hadath", lean: "gov", cadence: C5 },
  { id: "alarabiyaBr", name: "Al Arabiya", lean: "gov", cadence: C5 },
  // Two agencies share the name: this is the Houthi-run one in Sanaa.
  { id: "SabaNewsyeMedia", name: "Saba (Houthi-run)", lean: "houthi", cadence: C5 },
  { id: "army21ye", name: "Yahya Saree", lean: "houthi", cadence: C5 },
  { id: "abdulsalamsalah", name: "Mohammed Abdulsalam", lean: "houthi", cadence: C5 },
  { id: "almasirah2", name: "Al-Masirah", lean: "houthi", cadence: C5 },
  { id: "alagsa3agel", name: "Al-Aqsa TV", lean: "houthi", cadence: C5 },
  // Their sites refuse automated readers (403); their channels post each
  // story's headline and first line, minutes after publication.
  { id: "Alakhbar_News", name: "Al-Akhbar", lean: "houthi", cadence: C5 },
  { id: "eremnews", name: "Erem News", lean: "gov", cadence: C15 },
  { id: "ajMubasher", name: "Al Jazeera Mubasher", lean: "intl", cadence: C5 },
  { id: "asharqnews", name: "Asharq News", lean: "gov", cadence: C5 },
  { id: "almayadeen", name: "Al Mayadeen", lean: "houthi", cadence: C5 },
  // Iran's state and IRGC-affiliated media, the Houthis' sponsor: mostly Iran's
  // own news, in Persian (Press TV in English). Every 15 minutes; the gate and
  // the reader keep only what is about this war. Tasnim (t.me/Tasnimnews) is
  // not here: its channel shows no posts to a reader who is not signed in, its
  // site does not answer from outside Iran, and Google News does not list it.
  { id: "farsna", name: "Fars News", lean: "houthi", cadence: C15 },
  { id: "mehrnews", name: "Mehr News", lean: "houthi", cadence: C15 },
  { id: "iribnews", name: "IRIB News", lean: "houthi", cadence: C15 },
  { id: "irna_1313", name: "IRNA", lean: "houthi", cadence: C15 },
  { id: "snntv", name: "SNN", lean: "houthi", cadence: C15 },
  { id: "Nournews_ir", name: "Nour News", lean: "houthi", cadence: C15 },
  { id: "presstv", name: "Press TV", lean: "houthi", cadence: C15 },
  // The user's 3 Oct list. Al-Faqaar films the strikes on Saudi Arabia from the
  // Houthi side. Clash Report is a fast aggregator, never a primary source: its
  // card gives way to the first account from a source of its own (AGGREGATOR).
  { id: "Alfaqaar313", name: "Alfaqaar", lean: "houthi", cadence: C5 },
  { id: "clashreport", name: "Clash Report", lean: "intl", cadence: C15 },
];

/**
 * X accounts, read through FxTwitter's public API (api.fxtwitter.com, the
 * open-source embed service): an account's latest 20 posts as JSON, no login,
 * no key. x.com itself serves nothing without one, the Nitter mirrors are
 * down or behind bot checks, and Twitter's syndication endpoint answers 429 —
 * all tried on 24 September. Public posts only, read at a polite interval.
 */
/** `picture`: the account posts its words as a picture (UKMTO's warning cards), read by a vision model before `only` is tried. */
/** `article`: a newspaper's account. A post linking its own article stands for that article, which is read whole like the site's. */
export type XAccount = { handle: string; name: string; lean: Channel["lean"]; cadence: Cadence; only?: RegExp; picture?: boolean; article?: boolean };
const C10: Cadence = { everyMin: 10 };
const X = (handle: string, name: string, lean: Channel["lean"], cadence: Cadence, only?: RegExp, picture?: boolean): XAccount => ({ handle, name, lean, cadence, ...(only ? { only } : {}), ...(picture ? { picture } : {}) });
/** A newspaper's or a broadcaster's account: only this war, and its articles read whole. */
const XA = (handle: string, name: string, lean: Channel["lean"], cadence: Cadence): XAccount => ({ ...X(handle, name, lean, cadence, WAR_ONLY), article: true });
/**
 * Sky News Arabia's breaking account posts about 150 times a day, most of it
 * other agencies' news. Only what its own sources told it goes on: "مصادر
 * لسكاي نيوز عربية", "لـ«سكاي نيوز عربية»", "خاص", "told Sky News Arabia".
 */
export const SKY_OWN = /لـ?\s*[«"“]?\s*سكاي\s*نيوز\s*عربية|علمت\s*[«"“]?\s*سكاي|(?:^|[\s|:«"(])(?:خاص|حصري|حصريا|حصرياً)(?=[\s|:»")]|$)|(?:told|to|tells)\s+Sky\s+News\s+Arabia|Sky\s+News\s+Arabia\s+(?:has\s+)?learned|exclusive/i;
/**
 * Read by tier, to spare the processor and FxTwitter's goodwill: the accounts
 * that break news every 10 minutes, the officials and the slower channels
 * every half hour. Only posts newer than the last one read go on.
 */
/**
 * A government's or a body's post about this war: Yemen, the Houthis, the
 * Saudi–Houthi fighting, the Red Sea, Bab al-Mandab, the Gulf of Aden, or Saudi
 * energy under attack. In English, Arabic, Turkish and Persian.
 */
export const WAR_ONLY = /\b(?:Yemen\w*|Houthis?|Ansar ?Allah|Sanaa|Sana'a|Aden|Hodeidah|Marib|Taiz|Red Sea|Bab (?:al|el)[- ]Mandeb|Bab (?:al|el)[- ]Mandab|Gulf of Aden|Aramco|Yanbu|Jazan|Jizan|Najran|East[- ]West pipeline|Yemen'?s|Husi\w*|Kızıldeniz|Babülmendep)\b|اليمن|يمني|الحوثي|أنصار الله|صنعاء|عدن|الحديدة|مأرب|تعز|البحر الأحمر|باب المندب|خليج عدن|أرامكو|ينبع|جازان|نجران|یمن|حوثی|انصارالله|دریای سرخ|باب‌المندب/i;
/**
 * The sea and energy accounts' posts about this war: WAR_ONLY, plus Suez
 * traffic and Saudi exports moving between the Gulf and the Red Sea.
 */
/** The civil defence's attack posts: the war's places, or a drone, missile, interception, debris or siren. */
export const SAUDI_ALERT = new RegExp(`${WAR_ONLY.source}|\\b(?:drones?|missiles?|projectiles?|intercept\\w*|debris|sirens?)\\b|مسير|صاروخ|مقذوف|اعتراض|شظايا|صافرات|الإنذار المبكر`, "i");
export const SEA_WAR = new RegExp(`${WAR_ONLY.source}|\\b(?:Suez|Ras Tanura|Ju'?aymah|Saudi (?:crude|oil|exports?|tankers?))\\b|قناة السويس|رأس تنورة`, "i");
const X_ACCOUNTS: XAccount[] = [
  X("war_cube", "The Cube", "intl", C5),
  X("marebpress", "Mareb Press", "gov", C5),
  X("almasdaronline", "Al-Masdar Online", "gov", C5),
  X("sabanew_", "Saba (government)", "gov", C5),
  // Every 10 minutes: the military spokesmen, the ministries, the reporters on the fronts.
  X("Yah_Saree", "Yahya Saree", "houthi", C10),
  X("abdusalamsalah", "Mohammed Abdulsalam", "houthi", C10),
  X("spokespersonyem", "Yemeni Army spokesman", "gov", C10),
  X("Yem_army_media", "Yemeni Army Media", "gov", C10),
  X("YemenMOD", "Yemen Defence Ministry", "gov", C10),
  X("CJFCSpox", "Coalition spokesman", "gov", C10),
  X("modgovksa", "Saudi Defence Ministry", "gov", C10),
  X("KSAMOFA", "Saudi Foreign Ministry", "gov", C10),
  X("maldhabyani", "Mohammed al-Dhabyani", "gov", C10),
  X("BashaReport", "Basha Report", "gov", C10),
  X("SaudiNews50", "Saudi News", "gov", C10),
  X("2decnews", "2 December News", "gov", C10),
  X("South24_net", "South24", "gov", C10),
  X("yementvyem", "Yemen TV", "gov", C10),
  X("SkyNewsArabia_B", "Sky News Arabia", "intl", C10, SKY_OWN),
  X("ALyemennow", "Al-Yemen Now", "gov", C10),
  X("TVyemenshabab", "Yemen Shabab TV", "gov", C10),
  X("defenseliney", "Defense Line", "intl", C10),
  // Every 30 minutes: the leaders, the ministries' other voices, the parties.
  X("PresidentRashad", "Rashad al-Alimi", "gov", C30),
  X("ERYANIM", "Muammar al-Eryani", "gov", C30),
  X("AbuZar3a", "Abu Zaraa al-Mahrami", "gov", C30),
  X("ALalimiBawzer", "Abdullah al-Alimi", "gov", C30),
  X("Shaya_Zindani", "Shaya al-Zindani", "gov", C30),
  X("afrah_alzouba", "Afrah al-Zouba", "gov", C30),
  X("tarikyemen", "Tareq Saleh", "gov", C30),
  X("yemen_mofa", "Yemen Foreign Ministry", "gov", C30),
  // Its casualty and abuse statements count as official (a ministry), 1 Oct.
  X("mohr_yemen", "Yemen Human Rights Ministry", "gov", C15),
  X("nrfyemen", "National Resistance", "gov", C30),
  X("P_B_N_R", "National Resistance Political Bureau", "gov", C30),
  X("diralwatan", "Nation's Shield", "gov", C30),
  X("STCSouthArabia", "Southern Transitional Council", "gov", C30),
  X("AidrosAlzubidi", "Aidarous al-Zubaidi", "gov", C30),
  X("Alsakaniali", "Ali al-Sakani", "gov", C30),
  X("South24E", "South24 English", "gov", C30),
  X("GCCSG", "GCC Secretariat", "gov", C30),
  X("FaresALhemyari", "Fares al-Hemyari", "gov", C30),
  X("yemenmofa2025", "Sanaa Foreign Ministry", "houthi", C30),
  X("hezamalasad", "Hezam al-Asad", "houthi", C30),
  X("hussinalezzi5", "Hussein al-Ezzi", "houthi", C30),
  X("Moh_Alhouthi", "Mohammed Ali al-Houthi", "houthi", C30),
  // Governments, agencies and international bodies (the user's list, 30 Sep):
  // mostly their own diplomacy, so only posts about this war go on. Each is
  // also where a relay of that body's words is looked up first (officials.ts).
  X("spagov", "SPA", "gov", C10, WAR_ONLY),
  X("wamnews", "WAM", "gov", C10, WAR_ONLY),
  // Saudi Civil Defence (sirens, debris, strikes on Saudi towns) and the Interior Ministry (user, 2 Oct).
  X("SaudiDCD", "Saudi Civil Defence", "gov", C10, SAUDI_ALERT),
  X("MOISaudiArabia", "Saudi Interior Ministry", "gov", C15, WAR_ONLY),
  X("StateDept", "State Department", "intl", C10, WAR_ONLY),
  X("UNinYE", "UN in Yemen", "intl", C10, WAR_ONLY),
  X("MfaEgypt", "Egypt Foreign Ministry", "intl", C15, WAR_ONLY),
  X("MFAEgOfficial", "Egypt Foreign Ministry", "intl", C15, WAR_ONLY),
  X("IRIMFA_EN", "Iran Foreign Ministry", "houthi", C15, WAR_ONLY),
  X("FMofOman", "Oman Foreign Ministry", "intl", C15, WAR_ONLY),
  X("mofauae", "UAE Foreign Ministry", "gov", C15, WAR_ONLY),
  X("Iraqimofa", "Iraq Foreign Ministry", "intl", C15, WAR_ONLY),
  X("MOFAKuwait", "Kuwait Foreign Ministry", "intl", C15, WAR_ONLY),
  X("bahdiplomatic", "Bahrain Foreign Ministry", "intl", C15, WAR_ONLY),
  X("MofaQatar_AR", "Qatar Foreign Ministry", "intl", C15, WAR_ONLY),
  X("ForeignMinistry", "Jordan Foreign Ministry", "intl", C15, WAR_ONLY),
  X("MOFASomalia", "Somalia Foreign Ministry", "intl", C15, WAR_ONLY),
  X("ForeignOfficePk", "Pakistan Foreign Office", "intl", C15, WAR_ONLY),
  X("MFATurkiye", "Turkish Foreign Ministry", "intl", C15, WAR_ONLY),
  X("TC_Disisleri", "Turkish Foreign Ministry", "intl", C15, WAR_ONLY),
  X("SecRubio", "Marco Rubio", "intl", C15, WAR_ONLY),
  X("ENERGY", "US Energy Department", "intl", C15, WAR_ONLY),
  X("USTreasury", "US Treasury", "intl", C15, WAR_ONLY),
  X("USEmbassyYemen", "US Embassy Yemen", "intl", C15, WAR_ONLY),
  X("SuezAuthorityEG", "Suez Canal Authority", "intl", C15, WAR_ONLY),
  X("EU_Commission", "European Commission", "intl", C15, WAR_ONLY),
  X("vonderleyen", "Ursula von der Leyen", "intl", C15, WAR_ONLY),
  X("EUinYemen", "EU in Yemen", "intl", C15, WAR_ONLY),
  X("UNOCHA", "UN OCHA", "intl", C15, WAR_ONLY),
  X("antonioguterres", "António Guterres", "intl", C15, WAR_ONLY),
  X("UN", "United Nations", "intl", C15, WAR_ONLY),
  // The sea and energy (Stage 5, 30 Sep). UKMTO posts each warning as a
  // picture; its words are read off it, and only this war's waters go on
  // (a Hormuz or Gulf warning stays out unless it names the Houthis).
  X("UK_MTO", "UKMTO", "intl", C5, SEA_WAR, true),
  X("MoEnergy_Saudi", "Saudi Energy Ministry", "gov", C10, SEA_WAR),
  X("Kpler", "Kpler", "intl", C15, SEA_WAR),
  X("TankerTrackers", "TankerTrackers", "intl", C15, SEA_WAR),
  X("MarineTraffic", "MarineTraffic", "intl", C15, SEA_WAR),
  X("vortexa", "Vortexa", "intl", C15, SEA_WAR),
  X("JavierBlas", "Javier Blas", "intl", C15, SEA_WAR),
  X("osinthexagone", "OSINT Hexagone", "intl", C15, SEA_WAR),
  X("EGYOSINT", "Egypt OSINT", "intl", C15, SEA_WAR),
  // The user's 3 Oct list. Yemen's own: the Taiz military axis, the human
  // rights minister, the coast guard in Aden; and the UK's Middle East minister.
  X("axistaiz", "Taiz military axis", "gov", C10),
  X("d74054", "Yemen Coast Guard", "gov", C10),
  X("mashdal", "Yemen's human rights minister", "gov", C30),
  X("SDoughtyMP", "UK Middle East minister", "intl", C30, WAR_ONLY),
  // Washington: every word on this war, from the officials' own accounts.
  X("CENTCOM", "CENTCOM", "intl", C10, WAR_ONLY),
  X("WhiteHouse", "White House", "intl", C15, WAR_ONLY),
  X("POTUS", "Donald Trump", "intl", C15, WAR_ONLY),
  X("RapidResponse47", "White House Rapid Response", "intl", C15, WAR_ONLY),
  X("JDVance", "JD Vance", "intl", C30, WAR_ONLY),
  X("VP", "JD Vance", "intl", C30, WAR_ONLY),
  X("marcorubio", "Marco Rubio", "intl", C30, WAR_ONLY),
  // Reporters with officials' ear. Barak Ravid's posts carry his Axios
  // stories in his own words (axios.com refuses automated readers).
  X("BarakRavid", "Barak Ravid", "intl", C15, WAR_ONLY),
  X("NatashaBertrand", "Natasha Bertrand", "intl", C30, WAR_ONLY),
  X("TreyYingst", "Trey Yingst", "intl", C30, WAR_ONLY),
  X("JenGriffinFNC", "Jennifer Griffin", "intl", C30, WAR_ONLY),
  // Fast aggregators, never primary (AGGREGATOR).
  X("clashreport", "Clash Report", "intl", C10, WAR_ONLY),
  X("sentdefender", "OSINTdefender", "intl", C15, WAR_ONLY),
  // The newspapers and broadcasters: a post about this war opens its article.
  XA("Reuters", "Reuters", "intl", C10),
  XA("WSJ", "WSJ", "intl", C15),
  XA("nytimes", "NYT", "intl", C15),
  XA("washingtonpost", "Washington Post", "intl", C15),
  XA("axios", "Axios", "intl", C15),
  XA("business", "Bloomberg", "intl", C15),
  XA("ftworldnews", "Financial Times", "intl", C30),
  XA("Intel_Online", "Intelligence Online", "intl", C30),
  XA("CNN", "CNN", "intl", C15),
  XA("FoxNews", "Fox News", "intl", C15),
  XA("CBSNews", "CBS", "intl", C30),
  XA("ABC", "ABC", "intl", C30),
  XA("NBCNews", "NBC News", "intl", C30),
  XA("nypost", "NY Post", "intl", C30),
  XA("politico", "Politico", "intl", C30),
  XA("Telegraph", "The Telegraph", "intl", C30),
  XA("France24_en", "France 24", "intl", C30),
  XA("France24_ar", "France 24", "intl", C30),
  XA("arabnews", "Arab News", "gov", C15),
  XA("aawsat_News", "Asharq Al-Awsat", "gov", C15),
  XA("aawsat_eng", "Asharq Al-Awsat", "gov", C30),
  XA("TheNationalNews", "The National", "gov", C30),
  XA("alaraby_ar", "Al-Araby Al-Jadeed", "intl", C15),
  XA("alhurranews", "Alhurra", "intl", C15),
];

/** Newer than the last post read: X ids grow with time. A pinned post is old and falls out here. */
export function newerX(id: string, seen: string | undefined): boolean {
  if (!/^\d+$/.test(id)) return false;
  if (!seen) return true;
  return id.length !== seen.length ? id.length > seen.length : id > seen;
}

type FxStatus = {
  url?: string;
  id?: string;
  text?: string;
  raw_text?: { text?: string };
  created_timestamp?: number;
  replying_to?: { screen_name?: string } | null;
  reposted_by?: unknown;
  author?: { screen_name?: string };
  media?: Parameters<typeof xMedia>[0];
  article?: { title?: string; preview_text?: string };
  card?: { url?: string; title?: string; description?: string; domain?: string } | null;
};

/** One account's own posts as raw items: reposts and replies to others left out. */
export function parseFxStatuses(json: unknown, acct: XAccount): RawHit[] {
  const list = (json as { results?: FxStatus[] })?.results;
  if (!Array.isArray(list)) return [];
  const own = acct.handle.toLowerCase();
  const out: RawHit[] = [];
  for (const s of list) {
    if (s.reposted_by || String(s.author?.screen_name ?? own).toLowerCase() !== own) continue;
    // A reply to someone else is a conversation; a reply to itself is a thread.
    const to = s.replying_to?.screen_name?.toLowerCase();
    if (to && to !== own) continue;
    // An X article's post is a bare link: its title and opening stand for it.
    const art = s.article?.title ? `${s.article.title}
${s.article.preview_text ?? ""}` : "";
    const text = decodeEntities(art || String(s.raw_text?.text ?? s.text ?? "")).trim();
    const url = s.url || (s.id ? `https://x.com/${acct.handle}/status/${s.id}` : "");
    if (!url || text.length < 12) continue;
    const card = acct.article && s.card?.url && !/(?:^|\.)(?:x|twitter)\.com$/i.test(s.card.domain ?? "") ? s.card : null;
    const cardText = card ? `${card.title ?? ""} ${card.description ?? ""}`.trim() : "";
    if (acct.only && !acct.picture && !acct.only.test(`${text} ${cardText}`)) continue;
    const ms = Number(s.created_timestamp) * 1000;
    // A newspaper's post linking its article stands for the article: read whole
    // as the site's own listing would give it, never the post's line alone.
    if (card) {
      out.push({
        source: acct.name,
        url: card.url as string,
        text: decodeEntities(cardText || text).slice(0, 1200),
        at: jerusalemIso(Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date()),
        lean: "",
        fromTg: false,
        ...(card.title ? { title: decodeEntities(card.title) } : {}),
        xPost: url,
      });
      continue;
    }
    const media = xMedia(s.media, url);
    out.push({
      source: acct.name,
      url,
      text,
      at: jerusalemIso(Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date()),
      lean: acct.lean,
      // A post, whole as it stands: no article to fetch behind it.
      fromTg: true,
      ...(media ? { media } : {}),
    });
  }
  return out;
}

export function gnews(q: string, hl = "en-US", gl = "US", ceid = "US:en") {
  const enc = encodeURIComponent(q);
  return `https://news.google.com/rss/search?q=${enc}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

const YE_AR = "(اليمن OR الحوث OR الحوثي OR صنعاء OR السعودية OR باب المندب)";
const YE_EN = "(Yemen OR Houthi OR Houthis OR \"Red Sea\" OR \"Bab el-Mandeb\" OR Saudi)";

/**
 * Every website is read WHOLE: the listing a site keeps of all it published —
 * its RSS feed, or the news sitemap it gives search engines — and a model picks
 * from the headlines (triage.ts) which articles to open. A keyword search
 * (`site:X (Yemen OR Houthi …)`) used to stand in for the site, and never saw
 * an article whose headline lacked those words.
 *
 * The sites that refuse any automated reader (Cloudflare: Asharq Al-Awsat,
 * Erem, Al-Akhbar) and the ones with no working listing (the WSJ's Dow Jones
 * feeds stopped in January 2025; SPA) are listed through Google News with
 * `site:` alone and no keywords — every article Google has of theirs in the
 * window, not the ones that happen to say "Yemen". Nothing is bypassed.
 *
 * `site` is the domain an outlet hint (a channel citing it) reads early.
 */
const RSS: RssFeed[] = [
  { id: "sawt-alasima", lang: "ar", url: "https://sawt-alasima.net/feed", name: "Sawt al-Asima", cadence: C5, whole: true, site: "sawt-alasima.net" },
  { id: "yemenat", lang: "ar", url: "https://yemenat.net/feed", name: "Yemenat", cadence: C5, whole: true, site: "yemenat.net" },
  { id: "adngad", lang: "ar", url: "https://adngad.net/feed", name: "Aden al-Ghad", cadence: C5, whole: true, site: "adngad.net" },
  { id: "ypagency", url: "https://en.ypagency.net/feed", name: "Yemen Press Agency", cadence: C5, whole: true, site: "ypagency.net" },
  { id: "althawra", url: "https://en.althawranews.net/feed", name: "Al-Thawrah", cadence: C5, whole: true, site: "althawranews.net" },
  { id: "saudigazette", url: "https://saudigazette.com.sa/rssFeed/74", name: "Saudi Gazette", cadence: C5, whole: true, site: "saudigazette.com.sa" },
  // Oil and shipping news, read whole: triage keeps what this war does to Saudi and Yemeni energy and the Red Sea.
  { id: "oilprice", url: "https://oilprice.com/rss/main", name: "OilPrice.com", cadence: C10, whole: true, site: "oilprice.com" },
  // Shipping trade press and Kpler's own analysis (found in the 5d research, 30 Sep).
  { id: "maritime-executive", url: "https://maritime-executive.com/articles.rss", name: "The Maritime Executive", cadence: C10, whole: true, site: "maritime-executive.com" },
  { id: "gcaptain", url: "https://gcaptain.com/feed/", name: "gCaptain", cadence: C15, whole: true, site: "gcaptain.com" },
  { id: "splash247", url: "https://splash247.com/feed/", name: "Splash247", cadence: C15, whole: true, site: "splash247.com" },
  { id: "seatrade", url: "https://www.seatrade-maritime.com/rss.xml", name: "Seatrade Maritime", cadence: C15, whole: true, site: "seatrade-maritime.com" },
  { id: "hellenicshipping", url: "https://www.hellenicshippingnews.com/feed/", name: "Hellenic Shipping News", cadence: C15, whole: true, site: "hellenicshippingnews.com" },
  { id: "kpler-blog", url: "https://www.kpler.com/blog/rss.xml", name: "Kpler", cadence: C30, whole: true, site: "kpler.com" },
  { id: "thenational", url: "https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml", name: "The National", cadence: C10, whole: true, site: "thenationalnews.com" },
  { id: "almashhad", lang: "ar", url: "https://www.almashhad.news/feed", name: "Almashhad", cadence: C5, whole: true, site: "almashhad.news" },
  // A browser's user agent is refused (403); a plain client is served.
  { id: "alaraby", lang: "ar", url: "https://www.alaraby.co.uk/rss.xml", ua: "curl/8.5.0", name: "Al-Araby Al-Jadeed", cadence: C5, whole: true, site: "alaraby.co.uk" },
  { id: "aawsat", lang: "ar", url: gnews("site:aawsat.com when:1h", "ar", "SA", "SA:ar"), name: "Asharq Al-Awsat", cadence: C10, whole: true, site: "aawsat.com" },
  // Once a day, when the morning paper is out, a day wide: the site is behind
  // Cloudflare, and its channel (every 15 minutes) carries each story's
  // headline as it is published.
  { id: "akhbar", lang: "ar", url: gnews("site:al-akhbar.com when:1d", "ar", "LB", "LB:ar"), name: "Al-Akhbar", cadence: AKHBAR_DAILY, whole: true, site: "al-akhbar.com" },
  { id: "erem", lang: "ar", url: gnews("site:eremnews.com when:2h", "ar", "AE", "AE:ar"), name: "Erem News", cadence: C10, whole: true, site: "eremnews.com" },
  { id: "alhurra", lang: "ar", url: "https://www.alhurra.com/rss", name: "Alhurra", cadence: C5, whole: true, site: "alhurra.com" },
  { id: "arabnews", url: "https://www.arabnews.com/rss.xml", name: "Arab News", cadence: C5, whole: true, site: "arabnews.com" },
  { id: "reuters", url: "https://www.reuters.com/arc/outboundfeeds/news-sitemap/?outputType=xml", name: "Reuters", cadence: C10, whole: true, site: "reuters.com" },
  { id: "wsj", url: gnews("site:wsj.com when:1h"), name: "WSJ", cadence: C10, whole: true, site: "wsj.com" },
  { id: "wapo", url: "https://feeds.washingtonpost.com/rss/world", name: "Washington Post", cadence: C10, whole: true, site: "washingtonpost.com" },
  { id: "wapo-nat", url: "https://feeds.washingtonpost.com/rss/national", name: "Washington Post", cadence: C10, whole: true },
  { id: "wapo-pol", url: "https://feeds.washingtonpost.com/rss/politics", name: "Washington Post", cadence: C10, whole: true },
  { id: "nyt", url: "https://www.nytimes.com/sitemaps/new/news.xml.gz", name: "NYT", cadence: C10, whole: true, site: "nytimes.com" },
  { id: "nypost", url: "https://nypost.com/feed/", name: "NY Post", cadence: C10, whole: true, site: "nypost.com" },
  { id: "axios", url: "https://api.axios.com/feed/", name: "Axios", cadence: C10, whole: true, site: "axios.com" },
  { id: "cnn", url: "https://edition.cnn.com/sitemap/news.xml", name: "CNN", cadence: C10, whole: true, site: "cnn.com" },
  { id: "abc", url: "https://abcnews.go.com/abcnews/internationalheadlines", name: "ABC", cadence: C10, whole: true, site: "abcnews.go.com" },
  { id: "cbs", url: "https://www.cbsnews.com/latest/rss/world", name: "CBS", cadence: C10, whole: true, site: "cbsnews.com" },
  { id: "fox", url: "https://moxie.foxnews.com/google-publisher/world.xml", name: "Fox News", cadence: C10, whole: true, site: "foxnews.com" },
  { id: "fox-pol", url: "https://moxie.foxnews.com/google-publisher/politics.xml", name: "Fox News", cadence: C10, whole: true },
  { id: "spa", lang: "ar", url: gnews("site:spa.gov.sa when:1h", "ar", "SA", "SA:ar"), name: "SPA", cadence: C10, whole: true, site: "spa.gov.sa" },
  // Sheba Intelligence: exclusives on the Houthis, the Red Sea and the Horn,
  // from its section pages (no feed; its sitemap re-dates old articles).
  ...["news", "reports", "investigations", "politics", "daily-news-brief"].map((sec): RssFeed => ({
    id: `sheba-${sec}`,
    url: `https://shebaintelligence.uk/${sec}`,
    name: "Sheba Intelligence",
    cadence: C10,
    whole: true,
    site: "shebaintelligence.uk",
    html: /^https:\/\/shebaintelligence\.uk\/[a-z0-9-]{25,}$/,
  })),
  // Yemen Future (يمن فيوتشر), a non-governmental Yemeni news site (user, 2 Oct): no feed
  // and no real sitemap, so its front page is read, which lists the newest of every section.
  {
    id: "yemenfuture",
    lang: "ar",
    url: "https://yemenfuture.net/",
    name: "Yemen Future",
    cadence: C10,
    whole: true,
    site: "yemenfuture.net",
    html: /^https:\/\/yemenfuture\.net\/(?:news|territories|gulf|world|rights|economy|researches|file)\/\d+$/,
  },
  // Al-Akhbar's English edition carries the paper's pieces in full (the
  // Arabic site, and its PDF edition, refuse every reader). Once a day at
  // 07:00, the whole edition: the front page and every section that carries
  // the war, since a Yemen story often sits inside a Lebanon or world piece.
  // Its sitemap has no headlines, so the pages are read instead. The front
  // page and the Yemen section every half hour: the site posts through the
  // day, not only the morning edition (user, 7 Oct).
  ...["", "category/yemen", "category/peninsula", "category/arab", "category/world", "category/politics"].map((sec): RssFeed => ({
    id: `akhbar-en-${sec.replace("category/", "") || "home"}`,
    url: `https://en.al-akhbar.com/${sec}`,
    name: "Al-Akhbar",
    cadence: sec === "" || sec === "category/yemen" ? C30 : AKHBAR_DAILY,
    whole: true,
    site: "en.al-akhbar.com",
    html: /^https:\/\/en\.al-akhbar\.com\/news\/[a-z0-9-]{20,}/,
  })),
  // Round 29 stage 5b (user, 3 Oct list): the remaining sites, each tested from
  // the server first. AP, Intelligence Online and the Telegraph refuse readers
  // (Cloudflare, a paywall answer) and the State Department refuses its feed,
  // so those four are listed through Google News, nothing bypassed.
  { id: "france24-me", url: "https://www.france24.com/en/middle-east/rss", name: "France 24", cadence: C15, whole: true, site: "france24.com" },
  { id: "france24-ar", lang: "ar", url: "https://www.france24.com/ar/rss", name: "France 24", cadence: C15, whole: true },
  { id: "bbc-me", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", name: "BBC", cadence: C15, whole: true, site: "bbc.com" },
  { id: "bbc-ar", lang: "ar", url: "https://feeds.bbci.co.uk/arabic/rss.xml", name: "BBC", cadence: C15, whole: true },
  { id: "almonitor", url: "https://www.al-monitor.com/rss", name: "Al-Monitor", cadence: C15, whole: true, site: "al-monitor.com" },
  { id: "mee", url: "https://www.middleeasteye.net/rss", name: "Middle East Eye", cadence: C15, whole: true, site: "middleeasteye.net" },
  { id: "skyar", lang: "ar", url: "https://www.skynewsarabia.com/rss.xml", name: "Sky News Arabia", cadence: C10, whole: true, site: "skynewsarabia.com" },
  { id: "indyar", lang: "ar", url: "https://www.independentarabia.com/rss.xml", name: "Independent Arabia", cadence: C10, whole: true, site: "independentarabia.com" },
  { id: "newarab", url: "https://www.newarab.com/rss", ua: "curl/8.5.0", name: "The New Arab", cadence: C15, whole: true, site: "newarab.com" },
  { id: "aawsat-en", url: "https://english.aawsat.com/feed", name: "Asharq Al-Awsat", cadence: C10, whole: true, site: "english.aawsat.com" },
  { id: "alhurra-en", url: "https://www.alhurra.com/en/rss", name: "Alhurra", cadence: C15, whole: true },
  { id: "ft-me", url: "https://www.ft.com/world/mideast?format=rss", name: "Financial Times", cadence: C30, whole: true, site: "ft.com" },
  { id: "bloomberg", url: "https://feeds.bloomberg.com/politics/news.rss", name: "Bloomberg", cadence: C30, whole: true, site: "bloomberg.com" },
  { id: "politico", url: "https://rss.politico.com/defense.xml", name: "Politico", cadence: C30, whole: true, site: "politico.com" },
  { id: "nbc", url: "https://feeds.nbcnews.com/nbcnews/public/world", name: "NBC News", cadence: C30, whole: true, site: "nbcnews.com" },
  { id: "guardian-me", url: "https://www.theguardian.com/world/middleeast/rss", name: "The Guardian", cadence: C15, whole: true, site: "theguardian.com" },
  { id: "ap", url: gnews("site:apnews.com when:1h"), name: "AP", cadence: C15, whole: true, site: "apnews.com" },
  { id: "intel-online", url: gnews("(site:intelligenceonline.com OR site:intelligenceonline.fr) when:1d"), name: "Intelligence Online", cadence: C1H, whole: true, site: "intelligenceonline.com" },
  { id: "telegraph", url: gnews("site:telegraph.co.uk/world-news when:2h"), name: "The Telegraph", cadence: C30, whole: true, site: "telegraph.co.uk" },
  // US government: CENTCOM and the Pentagon's releases, the White House's and the State Department's.
  { id: "centcom-web", url: "https://www.centcom.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=808&max=20", name: "CENTCOM", cadence: C10, whole: true, site: "centcom.mil" },
  { id: "pentagon", url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=20", name: "Pentagon", cadence: C15, whole: true, site: "defense.gov" },
  { id: "whitehouse", url: "https://www.whitehouse.gov/news/feed/", name: "White House", cadence: C15, whole: true, site: "whitehouse.gov" },
  { id: "state", url: gnews("site:state.gov when:2h"), name: "State Department", cadence: C15, whole: true, site: "state.gov" },
  // Clearwater Dynamics' public maritime alerts, non-aligned (no feed: its alerts page).
  { id: "cwd", url: "https://www.cwdynamics.com/alerts/", name: "Clearwater Dynamics", cadence: C10, whole: true, site: "cwdynamics.com", html: /^https:\/\/www\.cwdynamics\.com\/alerts\/alert\/\d+$/ },
  // Yemeni sites: Aden's Crater Sky and Al-Ayyam (front pages; Crater Sky's feed is broken), Yemen Monitor, Khabar, and the government's Saba.
  { id: "cratersky", lang: "ar", url: "https://crater-sky.com/", name: "Crater Sky", cadence: C10, whole: true, site: "crater-sky.com", html: /^https:\/\/crater-sky\.com\/posts\/\d+$/ },
  { id: "alayyam", lang: "ar", url: "https://www.alayyam.info/", name: "Al-Ayyam", cadence: C10, whole: true, site: "alayyam.info", html: /^https:\/\/www\.alayyam\.info\/news\/[A-Z0-9-]{10,}$/ },
  { id: "yemenmonitor", lang: "ar", url: "https://www.yemenmonitor.com/feed", name: "Yemen Monitor", cadence: C10, whole: true, site: "yemenmonitor.com" },
  { id: "khabar", lang: "ar", url: "https://khabaragency.net/rss.xml", name: "Khabar Agency", cadence: C10, whole: true, site: "khabaragency.net" },
  { id: "sabanew", lang: "ar", url: "https://sabanew.net/rss.php?lang=ar", name: "Saba (government)", cadence: C10, whole: true, site: "sabanew.net" },
  // YouTube, through each channel's free feed: titles and descriptions only
  // (no free, allowed route to the speech itself). Clash Report keeps no channel the feed finds.
  { id: "yt-fox", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXIJgqnII2ZOINSWNOGFThA", name: "Fox News", cadence: C30, whole: true },
  { id: "yt-whitehouse", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYxRlFDqcWM4y7FfpiAN3KQ", name: "White House", cadence: C30, whole: true },
  // Safety nets: one keyword search across each language's sites, hourly. A
  // listing can drop an article (a sitemap's cap, an edited URL); these catch it.
  {
    id: "net-ar",
    url: gnews(`(site:aawsat.com OR site:alaraby.co.uk OR site:al-akhbar.com OR site:eremnews.com OR site:alhurra.com) ${YE_AR} when:1d`, "ar", "SA", "SA:ar"),
    name: "Arabic press",
    cadence: C30,
  },
  {
    id: "us-talk",
    url: gnews(`(site:reuters.com OR site:wsj.com OR site:washingtonpost.com OR site:nytimes.com OR site:nypost.com OR site:axios.com OR site:cnn.com OR site:abcnews.go.com OR site:cbsnews.com OR site:foxnews.com OR site:arabnews.com) ${YE_EN} when:1d`),
    name: "US media",
    cadence: C30,
  },
  // US officials' words on this war, whether or not a card has quoted them yet.
  {
    id: "us-officials",
    url: gnews(`(Trump OR Vance OR Rubio OR Hegseth OR Witkoff OR Leavitt OR CENTCOM) (Yemen OR Houthi OR Houthis OR "Red Sea" OR "Bab al-Mandab" OR Sanaa OR Aden) when:2h`),
    name: "US media",
    cadence: C15,
  },
];

const LEARNED_NAME = "Learned outlets";
/** The rows the Yemen scan hands the Iran scan, one per tick (iran-scan.server.ts takes them). */
export const IRAN_INBOX = "iran-inbox";
/** The Iran scan's last payload (its cards and its scan box). */
export const IRAN_PAYLOAD = "iran:payload";

/**
 * Outlets where the origin search found an original the desk had not been
 * reading (originals.ts): each is listed hourly from then on, through Google
 * News, several sites to a query and one query per language.
 */
function learnedFeeds(learned: Learned[]): RssFeed[] {
  const eds: Record<string, [string, string, string]> = { ar: ["ar", "SA", "SA:ar"], fr: ["fr", "FR", "FR:fr"], en: ["en-US", "US", "US:en"] };
  const byEd = new Map<string, string[]>();
  for (const l of learned) {
    if (l.kind !== "site") continue;
    const ed = l.lang === "Arabic" ? "ar" : l.lang === "French" ? "fr" : "en";
    byEd.set(ed, [...(byEd.get(ed) ?? []), l.site]);
  }
  const out: RssFeed[] = [];
  for (const [ed, sites] of byEd) {
    for (let i = 0; i < sites.length; i += 8) {
      const q = `(${sites.slice(i, i + 8).map((x) => `site:${x}`).join(" OR ")}) when:2h`;
      out.push({ id: `learned-${ed}-${i / 8}`, url: gnews(q, ...eds[ed]), name: LEARNED_NAME, cadence: C30, whole: true, ...(ed === "ar" ? { lang: "ar" as const } : {}) });
    }
  }
  return out;
}

/**
 * Every source the desk reads, once each by name, for the Sources list: the
 * Telegram channels, the X accounts, the sites and the outlets it learned.
 * The safety-net searches ("Arabic press", "US media") are not sources.
 */
export function sourceCatalogue(learned: Learned[] = []): CatalogueEntry[] {
  const out: CatalogueEntry[] = [];
  const seen = new Set<string>();
  const add = (e: CatalogueEntry) => {
    const k = e.name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(e);
  };
  for (const c of TG) add({ name: c.name, url: `https://t.me/${c.id}`, lean: c.lean, platform: "Telegram" });
  for (const a of X_ACCOUNTS) add({ name: a.name, url: `https://x.com/${a.handle}`, lean: a.lean, platform: "X" });
  for (const f of RSS) {
    if (!f.site) continue;
    add({ name: f.name, url: `https://${f.site}`, platform: "Website" });
  }
  for (const l of learned) {
    if (!l.name) continue;
    add(l.kind === "x" ? { name: l.name, url: `https://x.com/${l.site.replace(/^x:/, "")}`, platform: "X" } : { name: l.name, url: `https://${l.site}`, platform: "Website" });
  }
  return out;
}

/** Does the desk read this host (a site listing) or this X account ("x:handle") already? */
function readsHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www./, "");
  if (h.startsWith("x:")) return X_ACCOUNTS.some((a) => `x:${a.handle.toLowerCase()}` === h);
  if (h === "t.me") return true;
  return RSS.some((f) => {
    const site = f.site ?? (/news.google.com/.test(f.url) ? "" : new URL(f.url).hostname.replace(/^www./, ""));
    return !!site && (h === site || h.endsWith(`.${site}`) || site.endsWith(`.${h}`));
  });
}

/** An outlet's own recent articles, from the listing the desk reads it by; one fetch per site per tick. */
const listingMemo = new Map<string, { at: number; items: Promise<Listed[]> }>();
function siteListing(site: string): Promise<Listed[]> {
  const hit = listingMemo.get(site);
  if (hit && Date.now() - hit.at < 4 * 60_000) return hit.items;
  const feeds = RSS.filter((f) => f.whole && (f.site === site || (f.site ?? "").endsWith(`.${site}`) || (!!f.site && site.endsWith(`.${f.site}`))));
  const items = (async () => {
    const lists = await Promise.all(feeds.map(async (f) => {
      const body = await fetchListing(f.url, f.ua);
      // A site with no feed (Sheba, Al-Akhbar English) is listed from its section pages.
      return body ? (f.html ? parseHtmlListing(body, f.url, f.html) : parseListing(body)) : [];
    }));
    return lists.flat();
  })();
  listingMemo.set(site, { at: Date.now(), items });
  return items;
}

/* ------------------------------------------------------------------ *
 * Cadence bookkeeping
 * ------------------------------------------------------------------ */

export function cadenceLabel(c: Cadence): string {
  if ("everyMin" in c) return `every ${c.everyMin} min`;
  if ("everyHours" in c) return `every ${c.everyHours} h`;
  if ("atHours" in c) return `at ${c.atHours.map((h) => `${String(h).padStart(2, "0")}:00`).join(" / ")}`;
  if ("atHour" in c) return `daily at ${String(c.atHour).padStart(2, "0")}:00`;
  return "";
}

function jerusalemClock(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Aden",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), minute: Number(p.minute) };
}

/**
 * Is this source due?
 *
 * `state` comes from the store rather than module memory: a Vercel cold start
 * used to reset the cadence map, so the scanner either believed it had never
 * run (re-fetching all 38 sources every request) or lost the fact that it had.
 */
export function cadenceDue(state: ScanState, id: string, cadence: Cadence, now: number): boolean {
  if (!state.scannedOnce) return true;
  const last = state.lastScanAt[id] || 0;
  const age = now - last;
  if ("everyMin" in cadence) return age >= cadence.everyMin * 60_000 - 20_000;
  if ("everyHours" in cadence) return age >= cadence.everyHours * 3_600_000 - 90_000;
  // A fixed time of day: due once its latest time has passed and it has not
  // been read since. A read missed while the desk was down (07:00 on 27 and 28
  // September) is made up at the first scan after, not skipped for the day.
  const { hour, minute } = jerusalemClock(new Date(now));
  const hours = "atHours" in cadence ? cadence.atHours : "atHour" in cadence ? [cadence.atHour] : null;
  if (!hours) return true;
  const sinceLatest = Math.min(...hours.map((h) => ((hour - h + 24) % 24) * 3_600_000 + minute * 60_000));
  return last < now - sinceLatest - 60_000;
}

/* ------------------------------------------------------------------ *
 * Payload shapes
 * ------------------------------------------------------------------ */

export function jerusalemIso(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Aden",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+03:00`;
}

/* ------------------------------------------------------------------ *
 * Fetch / parse
 * ------------------------------------------------------------------ */

export function decodeEntities(s: string) {
  return pgSafe(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fpOf(url: string, title: string) {
  const slug = (url || title)
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .slice(0, 72);
  return "live-" + slug;
}

/** 1–5, the figure shown on the card. Derived from tier and gate score. */
function confidenceFrom(tier: string, score: number): number {
  const base = tier === "agency" ? 4 : tier === "claim" ? 2.8 : 2.2;
  const bump = Math.min(0.9, (score / 100) * 0.9);
  return Math.round((base + bump) * 10) / 10;
}

function isIsraeliSource(source: string, url: string): boolean {
  return /israel|jpost|haaretz|ynet|walla\.co|maariv|kan\.org|\.inn\.co|israelnationalnews|timesofisrael|i24news|jfeed|\bjns\.org|allisrael|debka|\.il\//i.test(
    `${source} ${url}`,
  );
}

function bestPlace(places: Place[]): Place | undefined {
  const land = places.find((p) => p.country !== "sea");
  return land || places[0];
}

type Composed = {
  report: LiveReport | null;
  outcome: Outcome;
  reason: string;
  note: string;
  note2?: string;
  tags: string[];
  topicality: number;
};

function toLiveReport(source: string, url: string, rawText: string, at: string, fpSeed: string, lean = "", officialDown = false): Composed {
  const no = (reason: string, note: string, outcome: Outcome = "exclude"): Composed => ({
    report: null,
    outcome,
    reason,
    note,
    tags: [],
    topicality: 0,
  });

  if (isIsraeliSource(source, url) || DROPPED_OUTLET.test(` ${source} ${url} `)) {
    return no("excluded-source", "Outlet excluded from this desk's catalogue.");
  }
  try {
    const u = new URL(url);
    if (!u.pathname || u.pathname === "/" || /^\/[a-z]{2}\/?$/.test(u.pathname)) {
      return no("no-article", "Link points at a section front, not a specific report.");
    }
  } catch {
    return no("bad-url", "Item had no usable link.");
  }

  const d = digest(source, rawText, lean, 0, officialDown);
  // A composition failure on a relevant item lands in the tray, not the bin:
  // the desk not being able to phrase something is not a reason to lose it.
  if (!d.ok) {
    // On the wide radar (an official speaking, an alert in Saudi Arabia): the
    // reader decides, not the keyword gate.
    // Not for what is out by rule whoever speaks: an Iranian channel's relay
    // of the Houthi spokesman, a round-up, a price list (Fars and SNN on 7 Oct
    // went out through the radar after the gate had dropped them).
    if (d.outcome === "exclude" && !FINAL_EXCLUDES.has(d.reason) && onRadar(rawText)) {
      return { report: null, outcome: "tray", reason: "radar", note: "Official statement or alert: sent to the reader.", tags: [...d.tags, "radar"], topicality: 0 };
    }
    return { report: null, outcome: d.outcome, reason: d.reason, note: d.note, tags: d.tags, topicality: 0 };
  }

  const place = bestPlace(d.places);
  const row: LiveReport = {
    fp: fpOf(url, fpSeed),
    at,
    source,
    url,
    type: d.type,
    summary: d.headline,
    text: d.body,
    live: true,
    confidence: confidenceFrom(d.tier, d.score),
    score: d.score,
    tier: d.tier,
    tags: d.tags,
  };
  if (place) {
    row.place = place.name;
    row.lat = place.lat;
    row.lng = place.lng;
  }
  return {
    report: row,
    outcome: d.outcome,
    reason: d.reason,
    note: d.note,
    tags: d.tags,
    topicality: d.score,
  };
}

export async function fetchText(url: string, ms = 8000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "YemenDesk/2.0 (OSINT desk)",
        accept: "text/html,application/rss+xml,application/xml,text/xml,*/*",
        "accept-language": "ar,en;q=0.8",
      },
    });
    if (!res.ok) {
      // An unread body left open can trip undici when the socket closes.
      await res.body?.cancel().catch(() => {});
      return null;
    }
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * The article's own body, as the publisher ships it to anyone who asks.
 *
 * Nearly every news site carries a `<script type="application/ld+json">`
 * NewsArticle block for search engines, and for a great many of them —
 * including most Arabic outlets and the wires — its `articleBody` is the whole
 * story, sitting in the same HTML whose visible paragraphs are a teaser. That
 * is why a WSJ-style report used to come out three lines long: the desk was
 * reading the teaser and never looked at the block underneath it.
 *
 * JSON-LD is allowed to nest (`@graph`, arrays of types), so this walks the
 * parsed object rather than pattern-matching the text.
 */
function jsonLdBody(html: string): string {
  let best = "";
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue; // a malformed block is one site's bug, not a reason to stop
    }
    const walk = (v: unknown, depth = 0) => {
      if (!v || depth > 6) return;
      if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
      if (typeof v !== "object") return;
      const o = v as Record<string, unknown>;
      const body = o.articleBody ?? o.text;
      if (typeof body === "string" && body.length > best.length) best = body;
      for (const x of Object.values(o)) walk(x, depth + 1);
    };
    walk(parsed);
  }
  return best ? decodeEntities(best) : "";
}

/** The AMP copy of this article, which publishers serve unpaywalled and clean. */
export function amphtmlOf(html: string, pageUrl: string): string {
  const href =
    (html.match(/<link[^>]+rel=["']amphtml["'][^>]*href=["']([^"']+)["']/i) || [])[1] ||
    (html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']amphtml["']/i) || [])[1] ||
    "";
  if (!href) return "";
  try {
    return new URL(decodeEntities(href), pageUrl).toString();
  } catch {
    return "";
  }
}

/**
 * As much of the article as the page will give up, best source first.
 *
 * The paragraph harvest used to stop at five, which is a teaser by
 * construction: a report about a Saudi oil facility that runs eleven
 * paragraphs was reaching the desk as its first two. The cap is now on
 * characters, not paragraphs, so a long piece arrives long and a short one
 * stays short.
 */
export function extractLead(html: string, cap = ARTICLE_CHARS): string {
  const meta = (p: string) =>
    (html.match(new RegExp(`(?:property|name)=["']${p}["'][^>]*content=["']([^"']{40,})["']`, "i")) || [])[1] ||
    (html.match(new RegExp(`content=["']([^"']{40,})["'][^>]*(?:property|name)=["']${p}["']`, "i")) || [])[1] ||
    "";
  const og = decodeEntities(meta("og:description") || meta("description") || "");
  // The body Google is shown. When the page has one it is the article itself.
  const ld = jsonLdBody(html);
  // Stylesheets and scripts come out before the paragraphs are read: stripping
  // tags alone leaves their contents behind, and a site that styles its links
  // inline puts a `<style>` block inside its first paragraph.
  const body = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // A Next.js page (en.al-akhbar.com) carries its article in the script
  // payload, the tags escaped: "<p>Egyptian sources told …".
  const payload = html.includes("\\u003cp")
    ? html.replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&").replace(/\\"/g, '"').replace(/\\n/g, " ")
    : "";
  const paras = [...`${body} ${payload}`.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/gi)]
    // A muted paragraph is another story's teaser: Sawt al-Asima's "related
    // news" under its STC mobilisation piece became two cards on Al-Aghbara
    // under that piece's link (1 Oct).
    .filter((m) => !/class=["'][^"']*\btext-muted\b/i.test(m[1]))
    .map((m) => decodeEntities(m[2]))
    .filter((p) => p.length > 50 && !/copyright|subscribe|cookie|javascript|sign in|all rights reserved/i.test(p));
  const parts: string[] = [];
  if (og) parts.push(og);
  if (ld.length > og.length) parts.push(ld);
  // The article's own box, where a site keeps its text outside <p> tags.
  const box = (body.match(/<(span|div)[^>]*(?:id|class)=["'][^"']*(?:lblarticalDetails|contnews)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || "";
  const boxed = decodeEntities(box.replace(/<br\s*\/?>/gi, " "));
  if (boxed.length > 80) parts.push(boxed);
  for (const p of paras) {
    if (parts.join(" ").length >= cap) break;
    if (!parts.some((x) => x.includes(p.slice(0, 50)))) parts.push(p);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, cap);
}

/* ------------------------------------------------------------------ *
 * Volume. The feed is meant to be a stream: these bound one cycle's work,
 * they are not an editorial filter. Anything relevant that arrives inside
 * them reaches the store, which accumulates.
 * ------------------------------------------------------------------ */

/** Items read from one RSS feed per cycle. Google News lists up to 100. */
const RSS_ITEMS = 100;

/** Every source the clock reads, with its lastScanAt key: the status page's list. */
export function sourceList(): { key: string; name: string }[] {
  return [
    ...TG.map((c) => ({ key: `tg:${c.id}`, name: c.name })),
    ...X_ACCOUNTS.map((a) => ({ key: `x:${a.handle}`, name: a.name })),
    ...RSS.map((f) => ({ key: `web:${f.id}`, name: f.name })),
  ];
}
/** Extra `?before=` pages read from one channel to reach the last post seen. */
const TG_BACKFILL_PAGES = 4;
/**
 * X pages back the same way: FxTwitter gives 20 posts a page, and a busy
 * account (or any account after the laptop lost its internet for an hour)
 * posts more than that between two reads.
 */
const X_BACKFILL_PAGES = 5;
/** A Google News query is widened when its last read is this much later than its clock allows. */
const GAP_MS = 15 * 60_000;
const cadenceMs = (c: Cadence) => ("everyMin" in c ? c.everyMin * 60_000 : "everyHours" in c ? c.everyHours * 3600_000 : 24 * 3600_000);
/** After a gap (the laptop offline or asleep), an hour's Google News query reaches back over it. */
export function widenForGap(url: string, cadence: Cadence, lastRead: number, now: number): string {
  if (!lastRead || !/news\.google\.com/.test(url) || !/when%3A1h/.test(url)) return url;
  const gap = now - lastRead;
  if (gap <= cadenceMs(cadence) + GAP_MS) return url;
  return url.replace(/when%3A1h/, `when%3A${Math.min(24, Math.ceil(gap / 3600_000) + 1)}h`);
}
/**
 * One-time replay: the desk was down from the last Vercel tick (26 Sept,
 * 21:15 UTC) until it came back on its own server (28 Sept, 16:40), and a busy
 * channel posted more in those 40 hours than the backfill pages reach. Each
 * channel (`channels: null` = every Telegram channel) pages back to `since`
 * once; already-published posts dedupe on insert, and what the reader cannot
 * reach in one tick waits in its queue. Inert after `until`. `key` names the
 * run: a new replay takes a new key, or channels that ran an earlier one skip.
 * Earlier runs: the 21 September speech and Haifan strikes (replay5); the
 * 26-28 September move to the laptop (replay7). replay8: the laptop lost its
 * internet on 29 September 13:45-14:45 and slept on a flat battery 15:04-16:05.
 */
const REPLAY: { since: number; until: number; channels: Set<string> | null; pages: number; key: string } = {
  since: Date.parse("2026-09-29T13:40:00+03:00"),
  until: Date.parse("2026-09-30T03:00:00+03:00"),
  channels: null,
  pages: 15,
  key: "replay8",
};
const inReplay = (id: string) => !REPLAY.channels || REPLAY.channels.has(id);
/** X accounts page back this far on a replay (FxTwitter's cursor, ~20 posts a page). */
const REPLAY_X_PAGES = 10;
/** Replay pages fetched at once across all channels, so Telegram is never hammered. */
const REPLAY_PARALLEL = 6;
let replaySlots = REPLAY_PARALLEL;
const replayWaiters: (() => void)[] = [];
async function replayFetch(url: string): Promise<string | null> {
  if (replaySlots > 0) replaySlots -= 1;
  else await new Promise<void>((r) => replayWaiters.push(r));
  try {
    return await fetchText(url);
  } finally {
    const next = replayWaiters.shift();
    if (next) next();
    else replaySlots += 1;
  }
}
const replaying = (state: ScanState, id: string, now: number) => now < REPLAY.until && !state.lastScanAt[`${REPLAY.key}:${id}`];

/** Where a short link lands: its redirects followed, nothing of the page read. The link itself when that fails. */
async function finalUrl(url: string): Promise<string> {
  if (!/^https?:\/\/(?:[^/]+\.)?(?:reut\.rs|wapo\.st|nyti\.ms|on\.wsj\.com|bloom\.bg|trib\.al|bit\.ly|cnn\.it|fxn\.ws|abcn\.ws|cbsn\.ws|nbcnews\.to|nyp\.st|politi\.co|f24\.my|ow\.ly|buff\.ly|dlvr\.it|ift\.tt|aje\.io|tinyurl\.com|t\.co)\//i.test(url)) return url;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)" }, signal: AbortSignal.timeout(8_000) });
    return res.url || url;
  } catch {
    return url;
  }
}

/** One page of an X account through FxTwitter; a 404 or timeout is tried once more (it answers unevenly). */
export async function fxPage(handle: string, cursor?: string): Promise<{ results?: unknown[]; cursor?: { bottom?: string | null } } | null> {
  // Six at a time: some 120 accounts fall due on the same minute, and FxTwitter answers a burst with 404s.
  if (fxSlots > 0) fxSlots -= 1;
  else await new Promise<void>((r) => fxWaiters.push(r));
  try {
    return await fxPageNow(handle, cursor);
  } finally {
    const next = fxWaiters.shift();
    if (next) next();
    else fxSlots += 1;
  }
}
let fxSlots = 6;
const fxWaiters: (() => void)[] = [];
async function fxPageNow(handle: string, cursor?: string): Promise<{ results?: unknown[]; cursor?: { bottom?: string | null } } | null> {
  const url = `https://api.fxtwitter.com/2/profile/${handle}/statuses${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)", accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return (await res.json()) as { results?: unknown[]; cursor?: { bottom?: string | null } };
      await res.body?.cancel().catch(() => {});
    } catch {
      // Tried again below.
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}
/** Nothing older than this is news for a live desk, however a feed lists it. */
const MAX_ITEM_AGE_MS = 72 * 3600 * 1000;
/** Article pages fetched per cycle to fill thin teasers. Cached by URL. */
const BODY_FETCHES = 90;
/**
 * How much of one article the desk keeps. Only web articles reach this — a
 * Telegram post is already its whole text — so the reader's token bill grows
 * by the handful of articles in a cycle, not by every item in it. A wire story
 * runs 2–4k characters; below that the desk was reading a teaser and writing a
 * three-line report from it.
 */
const ARTICLE_CHARS = 8000;
/** An article's text plus the feed's own title and teaser above it. */
const ITEM_CHARS = 8600;
/**
 * An exclusive is the outlet's own reporting, every fact of it wanted: a long
 * Axios or Asharq Al-Awsat piece runs past 8k, and its last paragraphs were
 * cut. A handful a day, so the cost is small.
 */
const EXCLUSIVE_CHARS = 12_000;
/** Reports kept in the cycle payload (the scan box and carry-forward). */
const PAYLOAD_REPORTS = 300;
/**
 * Raw items kept in the cycle payload for the scan box: the last three hours,
 * at most 150. Every tick re-reads the payload and every visitor downloads it.
 */
const PAYLOAD_RAW_HITS = 150;
const RAW_HITS_MS = 3 * 3600 * 1000;

/** The old whole-cache blob, moved into rows once. */
const LEAD_CACHE_KEY = "lead-cache";
const LEAD_PREFIX = "lead";
/** Well past the oldest item a listing is read for (MAX_ITEM_AGE_MS): never looked up again. */
const LEAD_KEEP_MS = 7 * 24 * 3600 * 1000;
/** url → the lead paragraph pulled from it ("" when the page had none). */
/** `pub`: when the article page says it was published (ms), for listings with no dates. */
type LeadCache = Record<string, { lead: string; at: number; real?: string; tries?: number; pub?: number }>;
/** Google News links resolved to their article per cycle (two requests each). */
const GNEWS_RESOLVES = 30;
/** A Google News item waits this many cycles for its article's address. */
const GNEWS_HOLD_TRIES = 3;
/** Below this many characters an article page has given the desk a teaser. */
const AMP_RETRY_UNDER = 700;
/** Below this, the page is walled or empty and the story is looked for elsewhere. */
const WALLED_UNDER = 500;
/** Walled articles chased through other outlets per cycle: a search and up to three pages each. */
const WALLED_RESCUES = 4;

export type RawHit = {
  source: string;
  url: string;
  text: string;
  at: string;
  lean: string;
  fromTg: boolean;
  /** The channel post this one replies to, on Telegram. */
  replyUrl?: string;
  /** The feed's own headline, kept apart from the blob so a walled article can
   *  be looked for under it elsewhere. */
  title?: string;
  /** From a whole site's listing, picked by triage. */
  picked?: boolean;
  /** Listed with no date (a section page): its time is when first seen, until its page gives one. */
  undated?: boolean;
  /** The whole article as its feed carries it: axios.com turns readers away (403), its feed does not. */
  feedBody?: string;
  /** The post's picture or video (X, Telegram): a candidate for the card, looked at before it is shown. */
  media?: Media;
  /** A newspaper's X post that linked this article (its id orders the account's posts). */
  xPost?: string;
};

/* ------------------------------------------------------------------ *
 * Whole-site listings: what the desk has already judged
 * ------------------------------------------------------------------ */

const SEEN_KEY = "site-seen";
/** A listed article older than this is not looked at (judged before, or stale). */
const SEEN_WINDOW_MS = 30 * 3600_000;
/** The first read of a site takes only its last few hours, as a channel's does. */
const FIRST_SIGHT_MS = 4 * 3600_000;
/** Judged articles remembered per site: more than any listing holds in the window. */
const SEEN_MAX = 1500;
/**
 * feed id → article key → 0 not ours, -1 picked and done, 1 picked by triage (before first-seen
 * times were kept), or the time (ms) it was first seen and picked. An undated
 * article (a section page) carries that time on every later read: Sheba's
 * articles went out again each scan stamped with the scan's time.
 */
type Seen = Record<string, Record<string, number>>;
/** A seen entry that was picked. */
const wasPicked = (v: number | undefined) => v !== undefined && v >= 1;
/** A picked article whose card had its chance: never sent again. */
const DONE = -1;
/** How long a picked article is sent again, in case its card failed. */
const PICKED_RETRY_MS = 3600_000;

async function loadSeen(): Promise<Seen> {
  try {
    return (await (await getStore()).getJson<Seen>(SEEN_KEY)) ?? {};
  } catch {
    return {};
  }
}

async function saveSeen(seen: Seen): Promise<void> {
  for (const id of Object.keys(seen)) {
    const keys = Object.keys(seen[id]);
    for (const k of keys.slice(0, Math.max(0, keys.length - SEEN_MAX))) delete seen[id][k];
  }
  try {
    await (await getStore()).putJson(SEEN_KEY, seen);
  } catch {
    // Unsaved, the same headlines are judged again next tick: a cost, not a loss.
  }
}

/** One listed article as a raw item. Google News titles carry " - Outlet". */
function listedHit(it: Listed, feed: RssFeed, firstSeen?: number): RawHit | null {
  let title = decodeEntities(it.title);
  let source = feed.name;
  if (isGnews(it.url)) ({ title, source } = outletFromGoogleTitle(title, feed.name));
  const url = it.url.trim();
  if (title.length < 12 || !/^https?:\/\//i.test(url) || isIsraeliSource(source, url)) return null;
  const desc = decodeEntities(it.desc);
  const at = Number.isFinite(it.at) ? jerusalemIso(new Date(it.at)) : jerusalemIso(firstSeen ? new Date(firstSeen) : undefined);
  return { source, url, text: `${title} ${desc}`.trim().slice(0, 1200), at, lean: "", fromTg: false, title, ...(Number.isFinite(it.at) ? {} : { undated: true }), ...(it.body ? { feedBody: decodeEntities(it.body) } : {}) };
}

function outletFromGoogleTitle(title: string, fallback: string): { title: string; source: string } {
  const m = title.match(/^(.*)\s[-–—]\s+(.{3,48})$/);
  if (!m) return { title, source: fallback };
  const outlet = m[2].trim();
  const mapped =
    /fox news/i.test(outlet) ? "Fox News"
    : /alaraby|new arab|العربي الجديد/i.test(outlet) ? "Al-Araby Al-Jadeed"
    : /al[- ]?akhbar|الأخبار/i.test(outlet) ? "Al-Akhbar"
    : /aawsat|الشرق الأوسط|asharq al-awsat/i.test(outlet) ? "Asharq Al-Awsat"
    : /alhurra|الحرة/i.test(outlet) ? "Alhurra"
    : /erem|إرم/i.test(outlet) ? "Erem News"
    : /okaz|عكاظ/i.test(outlet) ? "Okaz"
    : /al-?watan|الوطن/i.test(outlet) ? "Al-Watan"
    : /reuters/i.test(outlet) ? "Reuters"
    : /associated press|^AP$/i.test(outlet) ? "AP"
    : /politico/i.test(outlet) ? "Politico"
    : /cnbc/i.test(outlet) ? "CNBC"
    : /wsj|wall street/i.test(outlet) ? "WSJ"
    : /new york times/i.test(outlet) ? "NYT"
    : /washington post/i.test(outlet) ? "Washington Post"
    : /new york post/i.test(outlet) ? "NY Post"
    : /^axios/i.test(outlet) ? "Axios"
    : /^cnn\b/i.test(outlet) ? "CNN"
    : /^abc news/i.test(outlet) ? "ABC"
    : /^cbs news/i.test(outlet) ? "CBS"
    : /arab news/i.test(outlet) ? "Arab News"
    : /saudi press agency|^spa$/i.test(outlet) ? "SPA"
    : fallback === "US media" || fallback === LEARNED_NAME ? outlet.replace(/\s+/g, " ").slice(0, 28)
    : fallback;
  return { title: m[1].trim(), source: mapped };
}

export function parseRss(xml: string, source: string): RawHit[] {
  const items: RawHit[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const b of blocks.slice(0, RSS_ITEMS)) {
    let title = decodeEntities((b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const desc = decodeEntities((b.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || "");
    const linkRaw =
      (b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] ||
      (b.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1] ||
      "";
    const guid = decodeEntities((b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || "");
    const dateRaw = (b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || "";
    let url = decodeEntities(linkRaw || guid).replace(/&amp;/g, "&").trim();
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    let src = source;
    if (/news\.google\.com/i.test(url)) {
      const g = outletFromGoogleTitle(title, source);
      title = g.title;
      src = g.source;
      // Keep Google's per-article link. <source url> is only the outlet's
      // homepage; swapping it in made every Google item a "section front".
    }
    if (title.length < 12) continue;
    if (isIsraeliSource(src, url)) continue;
    const blob = `${title} ${desc}`.slice(0, 1200);
    let at = jerusalemIso();
    const parsed = Date.parse(dateRaw);
    if (Number.isFinite(parsed)) at = jerusalemIso(new Date(parsed));
    items.push({ source: src, url, text: blob, at, lean: "", fromTg: false, title });
  }
  return items;
}

/** The post number in a t.me/<channel>/<n> URL, or 0. */
export function tgPostNo(url: string): number {
  const m = /\/(\d+)(?:\?|$)/.exec(url);
  return m ? Number(m[1]) : 0;
}

/** The newest post number on a channel page, without parsing its posts. */
export function newestTgPost(html: string, channel: string): number {
  const own = channel.toLowerCase();
  let max = 0;
  for (const m of html.matchAll(/data-post="([^"/]+)\/(\d+)"/g)) {
    if (m[1].toLowerCase() === own) max = Math.max(max, Number(m[2]));
  }
  return max;
}

/**
 * A newspaper posts its edition as one message: a cover, then a dozen
 * headlines from a dozen different sections, sometimes with a link each.
 *
 * Judged whole, such a post is whatever most of it is about — Al-Akhbar's
 * daily edition reads as Lebanese politics and is thrown out as another
 * theatre, taking any Yemen story in it down with it. The desk was losing the
 * paper it was told to read, in the one message that carries it.
 *
 * So a digest is cut into its headlines and only the ones that name this war
 * go forward, each judged on its own. Anything that is not a digest, and any
 * digest with nothing of ours in it, is left exactly as it was.
 */
/** Words that place a piece in this war: an exclusive about something else is not forced in. */
const THIS_WAR = /اليمن|يمني|الحوث|صنعاء|عدن|تعز|مأرب|الحديدة|السعودي|البحر الأحمر|باب المندب|أنصار الله|Yemen|Houthi|Sanaa|Sana'a|Aden|Taiz|Marib|Hodeidah|Saudi|Red Sea|Bab al-Mandab|Ansar Allah/i;

const DIGEST_MARK = /[◼⬛⬜🖋]️?/gu;
const OURS = /اليمن|يمني|الحوث|صنعاء|السعود|عدن|تعز|مأرب|الحديدة|Yemen|Houthi|Saudi|Sanaa|Aden|Taiz|Marib/i;

/** The edition's footer ("اقرأ عدد اليوم عبر الرابط"), not a story. */
const DIGEST_FOOTER = /اقرأ عدد اليوم|ـــــ/;
/** A teaser post: two or three paragraphs, then "read the whole piece" and its link. */
const TEASER = /لقراءة\s+(?:الموضوع|المقال|الخبر|التقرير|الحوار|المقابلة)?\s*كامل/;

export function splitDigest(text: string, links: string[]): { text: string; href?: string }[] {
  const parts = text.split(DIGEST_MARK).map((t) => t.trim()).filter((t) => t.length >= 25 && !DIGEST_FOOTER.test(t));
  if (parts.length < 3) return [];
  const ours = parts.filter((t) => OURS.test(t));
  if (!ours.length || ours.length === parts.length) return [];
  return ours.map((t) => {
    const i = parts.indexOf(t);
    return { text: t, href: links.length === parts.length ? links[i] : undefined };
  });
}
export function parseTelegram(html: string, ch: Channel): RawHit[] {
  const items: RawHit[] = [];
  const parts = html.split("tgme_widget_message_wrap");
  // t.me/s lists a channel's latest ~20 posts OLDEST FIRST. Reading a prefix of
  // the page (as this once did, `slice(1, 16)`) kept the oldest posts and
  // silently dropped the newest ones — so every part is read.
  for (const p of parts.slice(1)) {
    const hrefs = [...p.matchAll(new RegExp(`href="(https://t\\.me/${ch.id}/\\d+)"`, "gi"))].map((m) => m[1]);
    const textHtml = (p.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
    const datetime = (p.match(/datetime="([^"]+)"/) || [])[1] || "";
    const text = decodeEntities(textHtml);
    if (!text || text.length < 12) continue;
    // The post's own link: a reply's first link is the post it replies to.
    const own = (p.match(/data-post="([^"]+)"/) || [])[1];
    const url = own ? `https://t.me/${own}` : (hrefs[0] || "").split("?")[0];
    if (!url) continue;
    const replyUrl = (p.match(/class="tgme_widget_message_reply[^"]*"[^>]*href="([^"?]+)/) || [])[1];
    let at = jerusalemIso();
    const parsed = Date.parse(datetime);
    if (Number.isFinite(parsed)) at = jerusalemIso(new Date(parsed));
    const media = tgMedia(p, url);
    const base = { source: ch.name, at, lean: ch.lean, fromTg: true, ...(replyUrl && replyUrl !== url ? { replyUrl } : {}), ...(media ? { media } : {}) };
    // An edition post carries a dozen stories; each of ours becomes its own
    // candidate so one is never judged by the other eleven.
    const outside = [...p.matchAll(/href="(https?:\/\/[^"]+)"/gi)]
      .map((m) => decodeEntities(m[1]))
      .filter((h) => !/t\.me\//.test(h));
    // A teaser (Al-Akhbar's morning pieces): its text is the story's opening,
    // its link the article; the card is the article's, not the channel post's.
    if (TEASER.test(text) && outside.length) {
      items.push({ ...base, url: outside[outside.length - 1].trim(), text });
      continue;
    }
    // An edition's story links, when the post lists one per headline.
    const articles = outside.filter((h) => /\/NewspaperArticles\//i.test(h));
    const pieces = splitDigest(text, articles.length ? articles : outside);
    if (pieces.length) {
      pieces.forEach((piece, n) => {
        items.push({ ...base, url: piece.href || `${url}#${n + 1}`, text: piece.text });
      });
      continue;
    }
    items.push({ ...base, url, text });
  }
  // A digest headline and its teaser name one article: the fuller text stays.
  const byUrl = new Map<string, RawHit>();
  for (const it of items) {
    const was = byUrl.get(it.url);
    if (!was || it.text.length > was.text.length) byUrl.set(it.url, it);
  }
  return [...byUrl.values()];
}

/* ------------------------------------------------------------------ *
 * Story clustering — one line per story per day
 * ------------------------------------------------------------------ */

function frontBucket(r: LiveReport): string {
  const s = `${r.place || ""} ${r.summary || ""} ${r.text || ""}`;
  if (/Kahbub|Bab al-Mandab|Mayun|Dhubab/i.test(s)) return "bab";
  if (/Al-Wazi'iyah|Al-Dharifah|Sharirah|Al-Alqamah/i.test(s)) return "waziyah";
  if (/Marib|Wadi Dhanah|East Balaq|Balaq/i.test(s)) return "marib";
  if (/Al-Jawf|Al-Hazm\b/i.test(s)) return "jawf";
  if (/Hodeidah|Al-Khokha|Hays/i.test(s)) return "hudaydah";
  if (/Lahj|Al-Aghbara|Al-Mudaribah|Aden/i.test(s)) return "lahj-south";
  if (/Sanaa|Azal/i.test(s)) return "sanaa";
  if (/Yanbu|Jeddah|Aramco|crude|oil|Suez|pipeline/i.test(s) || r.type === "economy") return "energy";
  if (/Jazan|Najran|Khamis|Abha|Taif|Mecca|Riyadh|Al-Kharj|Farasan|Al-Ula|Sharurah/i.test(s)) return "ksa-strike";
  return `${r.type || "x"}-other`;
}

/** Overnight sirens on both sides of midnight are one story. */
function nightYmd(at: string): string {
  const ymd = String(at || "").slice(0, 10);
  const hour = parseInt(String(at || "").slice(11, 13), 10);
  if (!ymd || !Number.isFinite(hour) || hour >= 5) return ymd;
  const d = Date.parse(at);
  if (!Number.isFinite(d)) return ymd;
  return jerusalemIso(new Date(d - 5 * 3600 * 1000)).slice(0, 10);
}

function hourOfIso(iso: string): number {
  const h = parseInt(String(iso || "").slice(11, 13), 10);
  return Number.isFinite(h) ? h : 0;
}

/** A channel's side by its name; outlets not on the list are international. */
function sideOfSource(name: string): OutletSide {
  return outletSide(name, TG.find((c) => c.name === name)?.lean ?? "intl");
}

const FIELD_TYPES = new Set(["combat", "strike", "economy", "vessel", "port"]);
/** Copies of one event arrive within this long of each other. */
const COPY_WINDOW_MS = 30 * 60 * 1000;

function storyKey(r: LiveReport): string {
  const s = r.summary;
  // An alert is keyed by the city it names, and folds only within a burst.
  const cities = alertCities(r);
  if (cities) return `${nightYmd(r.at)}|alert|${cities[0] ?? "ksa"}`;
  if (/crude shipments|East-West pipeline|Yanbu loadings/i.test(s)) return "oil-cancel";
  if (/asked Syria for fighters/i.test(s)) return "syria-fighters";
  const ymd = String(r.at || "").slice(0, 10);
  const bucket = frontBucket(r);
  if (r.type === "combat" || r.type === "strike" || r.type === "economy" || r.type === "vessel" || r.type === "port") {
    return `${ymd}|${r.type}|${bucket}`;
  }
  if (r.type === "statement" || r.type === "diplomacy") {
    // One speech arrives as many posts, each quoting a different line. Keyed
    // on the headline those never matched, so one speech became six cards.
    // A NAMED speaker within a three-hour slot is one story.
    const who = namedSpeaker(s);
    if (who) return `${ymd}|stmt|${who}|${Math.floor(hourOfIso(r.at) / 3)}`;
    const stem = s.replace(/[^a-zA-Z]/g, "").slice(0, 28).toLowerCase();
    return `${ymd}|stmt|${stem || linkKey(r.url)}`;
  }
  return linkKey(r.url);
}

/** How far back a new statement is matched against cards already published. */
const STORY_WINDOW_MS = 18 * 3600 * 1000;
/**
 * How far back an identical headline folds. Relays run a minute or two behind
 * the first channel, so this is generous by their standard and deliberately
 * mean by the day's: two strikes on one district three hours apart are two
 * strikes, and must stay two cards.
 */
const SAME_HEADLINE_WINDOW_MS = 45 * 60_000;
/** Sirens across outlets within this long are one alert. */
const ALERT_BURST_MS = 8 * 60_000;
/** Two outlets on one field event, in different words, on one spot. */
const GROUND_WINDOW_MS = 20 * 60_000;
/** Two outlets on one attack on a named district. */
const SAME_DISTRICT_MS = 45 * 60_000;
/** "Saudi shelling hits Al-Dhahir district" and "Saudi rocket fire hits Al-Dhahir district": one district, one attacker. */
export function sameDistrictAttack(a: string, b: string): boolean {
  const district = (s: string) => /\b((?:al-)?[a-z][\w'-]+(?: [a-z][\w'-]+)?) district\b/i.exec(s)?.[1].toLowerCase().replace(/^al-/, "") ?? "";
  const by = (s: string) => (/\b(?:Saudi|coalition)\b/i.test(s) ? "s" : "") + (/\bHouthis?\b/i.test(s) ? "h" : "") + (/\bgovernment\b/i.test(s) ? "g" : "");
  const da = district(a);
  return !!da && da === district(b) && by(a) === by(b) && by(a).length === 1;
}
/** An identical headline carrying a figure or a named object does not happen twice in a night. */
const SAME_HEADLINE_COUNTED_MS = 8 * 3600_000;
/** One claim repeated with its figure by other outlets. */
const CLAIM_WINDOW_MS = 30 * 60_000;
/** The reader's "same event as": no further back than this. */
const DUPLICATE_WINDOW_MS = 6 * 3600_000;
/** A relay and the card of the outlet it cites: one story within the day. */
const RELAY_HOME_MS = 24 * 3600_000;
/** Two relays of one body's statement: the same story within two hours, or any of its words within twenty minutes. */
const SAME_STATEMENT_MS = 2 * 3600_000;
const SAME_STATEMENT_NEAR_MS = 20 * 60_000;
/** One economic or policy decision told again by other outlets. */
const POLICY_WINDOW_MS = 6 * 3600_000;
/** "Axios", "axios", "The Wall Street Journal" and "Wall Street Journal" are one outlet; "Defense" and "Defence" one ministry. */
export function sameOutlet(a: string, b: string): boolean {
  const k = (s: string) => String(s || "").toLowerCase().replace(/^the\s+/, "").replace(/defense/g, "defence").replace(/[^a-z0-9؀-ۿ]+/g, "");
  const x = k(a);
  const y = k(b);
  return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x))));
}
/** One clip reposted by another account. */
const FOOTAGE_WINDOW_MS = 12 * 3600_000;

/**
 * A statement or diplomacy report that tells a story already on the desk, as
 * another outlet's take, is not a new card: its outlet joins that card's
 * "Also". Grouping inside one scan never saw the cards of earlier scans, so
 * one Reuters story became seven cards over half an hour. `published` are the
 * fps already on the desk; only reports not among them can fold. `stored` are
 * recent desk rows the payload no longer carries; the ones given a new "Also"
 * are returned, so the store can save it. A folded account that adds facts
 * goes into `enrich` beside its card, to be written into it.
 */
/**
 * A link as one article: tracking goes, its id stays. Cut at "?", every
 * Suhail article ("news_details.php?lang=arabic&sid=33548") was one link, and
 * all but the first of a scan were lost.
 */
export function linkKey(u: string): string {
  const [base, q] = String(u || "").split("?");
  if (!q) return base;
  const kept = q.split("&").filter((p) => p && !/^(?:utm_[a-z]+|fbclid|gclid|ref|cmp|outputType|at_[a-z]+)=/i.test(p));
  return kept.length ? `${base}?${kept.sort().join("&")}` : base;
}

/** Where each report a fold took went (url → its card), for the scan's own accounting. */
export const foldTrail = new Map<string, string>();

/** The Yemeni places a headline names, for telling an event abroad from a front at home. */
function yemeniPlaceNames(s: string): string[] {
  return placesInCountry(s, "Yemen").map((p) => p.name);
}

export function foldIntoPublished(
  reports: LiveReport[],
  published: Set<string>,
  stored: LiveReport[] = [],
  enrich?: [LiveReport, LiveReport][],
): LiveReport[] {
  const talk = (r: LiveReport) => r.type === "statement" || r.type === "diplomacy";
  const byTime = [...reports].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  // Cards already on the desk that this cycle's payload no longer carries.
  const inPayload = new Set(reports.map((r) => r.fp));
  const homes = [...byTime, ...stored.filter((s) => !inPayload.has(s.fp))];
  const gone = new Set<LiveReport>();
  const touched = new Set<LiveReport>();
  for (const r of byTime) {
    if (published.has(r.fp)) continue;
    const t = Date.parse(r.at);
    const same = (o: LiveReport) => o !== r && !gone.has(o) && o.fp !== r.fp;
    // A post already in a card's "Also" is that card's, whatever the reader
    // writes of it on a later look: Bin Saeed's post of Saree's statement was
    // folded into Aden al-Ghad's card, read again a scan later in other words,
    // and went out as its own card (7 Oct 10:49).
    if (homes.some((o) => same(o) && (o.alsoReportedBy ?? []).some((a) => a.url === r.url))) {
      gone.add(r);
      continue;
    }
    // The spokesman's words from another outlet once his own post is on the
    // desk: that post is the card, and an outlet quoting him adds nothing, even
    // a summing-up of his morning's statements hours later (user, 7 Oct 10:49:
    // Bin Saeed at 10:49 on statements Saree posted from 05:47).
    if (!OWN_CHANNELS.has(r.source)) {
      const spk = [...OWN_CHANNELS].filter((s) => quotesOwnChannel(`${r.summary} ${r.text ?? ""}`, s));
      const his = homes
        .filter((o) => same(o) && spk.includes(o.source) && Math.abs(t - Date.parse(o.at)) <= OWN_WORDS_MS && wordsInCommon(o.summary, r.summary) >= 2)
        .sort((x, y) => wordsInCommon(y.summary, r.summary) - wordsInCommon(x.summary, r.summary))[0];
      if (his) {
        gone.add(r);
        foldTrail.set(r.url, `${his.source}: ${his.summary.slice(0, 90)}`);
        foldTrail.set(r.fp, `${his.source}: ${his.summary.slice(0, 90)}`);
        continue;
      }
    }
    // A channel's own posts are never one another's copies unless word for
    // word: its sirens over Riyadh at 09:00 and again at 13:00 are two alerts,
    // and a similar post from it most likely brings something new.
    // A statement or a meeting with a counterpart the card never names is
    // another event (a call with Qatar's emir is not the UAE's visit).
    const open = (o: LiveReport) => same(o) && (o.source !== r.source || sameHeadline(o, r)) && !(talk(r) && otherPartners(o, r));
    // A card already on the desk is a home whichever was posted first: a copy
    // seen late (the channel read after an outage) carries an earlier time than
    // the card it copies, and went out as a second card.
    const known = (o: LiveReport) => published.has(o.fp) || !inPayload.has(o.fp);
    const before = (o: LiveReport, ms: number) => (Date.parse(o.at) <= t || known(o)) && Math.abs(t - Date.parse(o.at)) <= ms;
    // The reader said it: this is another outlet on an event already published.
    // Held to the code's own test: within hours, and no casualty figures that
    // disagree (UNICEF's 15 children killed was folded into a card on 693
    // Houthi deaths from the night before).
    let home = r.duplicateOf
      ? homes.find(
          (o) =>
            open(o) && o.fp === r.duplicateOf && Math.abs(t - Date.parse(o.at)) <= DUPLICATE_WINDOW_MS && !differentSpeakers(o, r) &&
            // The same story in words too, or the same spot: "Houthi forces execute a
            // teacher in Taiz" was folded into "1,729 operations" on the reader's word (9 Oct).
            (wordsInCommon(o.summary, r.summary) >= 2 || sameGround(o, r)) &&
            !numbersClash(`${o.summary} ${o.text ?? ""}`, `${r.summary} ${r.text ?? ""}`),
        )
      : undefined;
    // The spokesman's own post after an outlet's card quoting him: his post
    // takes that card over (below), rather than going out beside it.
    if (!home && OWN_CHANNELS.has(r.source)) {
      home = homes.find(
        (o) => same(o) && !OWN_CHANNELS.has(o.source) && quotesOwnChannel(`${o.summary} ${o.text ?? ""}`, r.source) && Math.abs(t - Date.parse(o.at)) <= OWN_TAKEOVER_MS && wordsInCommon(o.summary, r.summary) >= 2,
      );
    }
    // A relay of an outlet whose own card is on the desk (user, 3 Oct 06:09,
    // 07:09, 10:52, 10:53): Al Hadath, Almashhad and South24 each had a card
    // "according to Axios" beside Axios's own card, Almashhad's with Axios in
    // its "Also". The relay is the original's: it joins that card, and what it
    // adds is written into it. Its story, its thread, or the one card that
    // outlet has on the desk that day.
    if (!home && r.citing) {
      const theirs = homes.filter((o) => same(o) && sameOutlet(o.source, r.citing!) && Math.abs(t - Date.parse(o.at)) <= RELAY_HOME_MS);
      home = theirs.find((o) => o.fp === r.replyTo || sameStory(o, r)) ?? (theirs.length === 1 && talk(r) && talk(theirs[0]) ? theirs[0] : undefined);
      // Its headline worded apart from the outlet's own: Axios' "aides meet to
      // discuss Saudi-Houthi conflict" went out four more times as "secret
      // meeting at Camp David" (3 Oct), Axios having three cards that day. The
      // outlet's card it shares clearly most words with is its card.
      if (!home && talk(r)) {
        const scored = theirs.filter(talk).map((o) => ({ o, n: wordsInCommon(o.summary, r.summary) })).sort((a, b) => b.n - a.n);
        if (scored[0] && scored[0].n >= 3 && (scored.length === 1 || scored[0].n >= scored[1].n + 2)) home = scored[0].o;
      }
    }
    // Two outlets relaying one body's statement when the body's own post is
    // not on the desk: one card. The Saudi defence ministry's Mecca Alliance
    // statement went out from Al-Araby TV, Naya, Ali Bk and Al Jazeera
    // Mubasher within six minutes; Rubio's from five outlets in eleven (5 Oct).
    if (!home && r.citing && talk(r)) {
      home = homes.find(
        (o) =>
          same(o) && o.source !== r.source && !!o.citing && sameOutlet(o.citing, r.citing!) && talk(o) && before(o, SAME_STATEMENT_MS) &&
          (sameStory(o, r) || (Math.abs(t - Date.parse(o.at)) <= SAME_STATEMENT_NEAR_MS && wordsInCommon(o.summary, r.summary) >= 2)),
      );
    }
    // And the outlet itself, arriving after a relay's card on its story.
    if (!home && !r.citing) {
      home = homes.find((o) => same(o) && !!o.citing && sameOutlet(r.source, o.citing) && Math.abs(t - Date.parse(o.at)) <= RELAY_HOME_MS && sameStory(o, r));
    }
    // The same post forwarded by another channel, seen in a later scan.
    if (!home && r.copyKey) home = homes.find((o) => same(o) && o.copyKey === r.copyKey && (Date.parse(o.at) <= t || known(o)));
    // One event, two outlets, and the reader wrote both up in the same words.
    // The story test below runs only on statements, so a strike or a clash
    // relayed a minute later went out as a second card with an identical
    // headline. The same channel posting its own line twice folds here too.
    if (!home) {
      home = homes.find(
        (o) => open(o) && before(o, SAME_HEADLINE_WINDOW_MS) && sameHeadline(o, r),
      );
    }
    // The same headline from another outlet hours later, when it carries a
    // figure or a named object: "22 vessels", "a Wing Loong II". A plain
    // "strike on Haifan" twice in a day is two strikes and never folds here.
    if (!home && countedOrNamed(r.summary)) {
      home = homes.find(
        (o) => open(o) && o.source !== r.source && before(o, SAME_HEADLINE_COUNTED_MS) && nightYmd(o.at) === nightYmd(r.at) && sameHeadline(o, r),
      );
    }
    // One siren burst told by several outlets, city by city: one alert.
    const cities = alertCities(r);
    if (!home && cities) {
      home = homes.find((o) => {
        const oc = open(o) && before(o, ALERT_BURST_MS) ? alertCities(o) : null;
        return !!oc && citiesOverlap(oc, cities);
      });
    }
    // One field event, two outlets, no words in common: the same kind of
    // event on the same spot within minutes, and no casualty figures that
    // disagree. Two strikes on one district hours apart stay two cards.
    if (!home && FIELD_TYPES.has(r.type)) {
      home = homes.find(
        (o) =>
          open(o) && o.source !== r.source && o.type === r.type && before(o, GROUND_WINDOW_MS) &&
          sameGround(o, r) && !numbersClash(`${o.summary} ${o.text ?? ""}`, `${r.summary} ${r.text ?? ""}`),
      );
    }
    // The same district named by two outlets for the same kind of attack by
    // the same side, within 45 minutes: Al-Masirah's "Saudi rockets on al-Dhahir"
    // and Al Mayadeen's relay of Saba's line 26 minutes later (7 Oct). The
    // governorate alone is too wide for this; the district is not.
    if (!home && FIELD_TYPES.has(r.type)) {
      home = homes.find(
        (o) =>
          open(o) && o.source !== r.source && o.type === r.type && before(o, SAME_DISTRICT_MS) && sameDistrictAttack(o.summary, r.summary) &&
          !numbersClash(`${o.summary} ${o.text ?? ""}`, `${r.summary} ${r.text ?? ""}`),
      );
    }
    // One event in Saudi Arabia, many outlets, each in its own words: the
    // Medina power station went out as eight cards in five minutes.
    if (!home) {
      home = homes.find((o) => open(o) && o.source !== r.source && before(o, ABROAD_WINDOW_MS) && sameEventAbroad(o, r, yemeniPlaceNames));
    }
    // The same channel's later post on that event, only its smoke or footage.
    if (!home) {
      home = homes.find((o) => same(o) && o.source === r.source && before(o, OWN_AFTERMATH_MS) && ownAftermath(o, r, yemeniPlaceNames));
    }
    // A wave of strikes on one city, from any outlet, the same channel's next
    // target too: one card, written again with what each account adds.
    const wave = !home ? homes.find((o) => same(o) && before(o, WAVE_WINDOW_MS) && sameWave(o, r)) : undefined;
    if (wave) home = wave;
    // One named event told again through the day: Jabal Han's night attack
    // repelled, six cards; Al-Hisn taken, nine (3-4 Oct review).
    const told = !home ? homes.find((o) => same(o) && before(o, SAME_TARGET_MS) && sameTarget(o, r)) : undefined;
    if (told) home = told;
    // One attack on a Yemeni city's site told as it unfolded (Aden airport, 7 Oct).
    const site = !home ? homes.find((o) => same(o) && before(o, SITE_ATTACK_MS) && sameSiteAttack(o, r)) : undefined;
    if (site) home = site;
    // One strike abroad, many outlets: the drones on Erbil's Iranian Kurdish
    // camps went out as some fifteen cards in four hours (9 Oct).
    if (!home) home = homes.find((o) => open(o) && o.source !== r.source && before(o, STRIKE_ABROAD_MS) && sameStrikeAbroad(o, r));
    // An outlet telling its own story again, from another of its accounts or
    // hours later (Iran International's PMF drones unit at 09:05 and 10:21).
    if (!home) {
      home = homes.find((o) => same(o) && o.source === r.source && !(talk(r) && otherPartners(o, r)) && before(o, OWN_RETELL_MS) && ownRetelling(o, r));
    }
    // One event two readers typed apart: a "combat" and a "statement" on the
    // Faryab police commander's killing.
    if (!home) home = homes.find((o) => open(o) && o.source !== r.source && before(o, ONE_EVENT_MS) && oneEventTwoTypes(o, r));
    // One claim with its rare figure told again hours later: "1,729 precision strikes" (9 Oct).
    if (!home) home = homes.find((o) => open(o) && o.source !== r.source && before(o, RARE_FIGURE_MS) && sameRareFigure(o, r));
    // A speech's line from another outlet when the speaker's own outlet is
    // carrying the speech: a copy, not a card (user, 21 Sep; on 4 Oct the
    // president's speech went out as some 45 cards from a dozen outlets).
    if (!home && talk(r)) {
      const who = speechOwner(r.summary);
      if (who && !who.outlets.test(r.source)) {
        const own = homes.filter((o) => same(o) && speechFrom(o, who) && Math.abs(t - Date.parse(o.at)) <= SPEECH_COPY_MS);
        home = own.sort((x, y) => Math.abs(t - Date.parse(x.at)) - Math.abs(t - Date.parse(y.at)))[0];
      }
    }
    // Another account reposting the same clip hours later: one event.
    if (!home && FIELD_TYPES.has(r.type)) {
      home = homes.find((o) => open(o) && o.source !== r.source && before(o, FOOTAGE_WINDOW_MS) && sameFootage(o, r));
    }
    // Another outlet's "follow-up" that only retells the card it follows.
    if (!home && r.replyTo) {
      const p = homes.find((o) => open(o) && o.fp === r.replyTo);
      if (p && p.source !== r.source && sameStory(p, r)) home = p;
    }
    if (!home && talk(r)) {
      home = homes.find(
        (o) => open(o) && o.source !== r.source && talk(o) && before(o, STORY_WINDOW_MS) && (sameStory(o, r) || retoldInAlso(o, r)),
      );
    }
    // One decision told by many outlets, each reader typing it as it saw fit:
    // Saudi Arabia's regularising of Yemenis' residency went out as eight
    // cards on 5 Oct, as "economy", "diplomacy" and "statement".
    if (!home && (talk(r) || r.type === "economy")) {
      home = homes.find(
        (o) =>
          open(o) && o.source !== r.source && (talk(o) || o.type === "economy") && (r.type === "economy" || o.type === "economy") &&
          before(o, POLICY_WINDOW_MS) && sameDecision(o, r),
      );
    }
    // Another outlet's line of a speaker's words the card already carries.
    if (!home && talk(r)) {
      home = homes.find((o) => open(o) && o.source !== r.source && talk(o) && before(o, STORY_WINDOW_MS) && retellsSpeaker(o, r));
    }
    // One claim repeated with its figure — Saree's 52 strikes, from Saree, Naya
    // and Saba — whatever type each reader gave it.
    if (!home) {
      home = homes.find(
        (o) =>
          open(o) && o.source !== r.source && before(o, CLAIM_WINDOW_MS) && sameCount(o.summary, r.summary) &&
          sameStory(o, r) && !numbersClash(o.summary, r.summary),
      );
    }
    // The same count at the same place from another outlet hours later: the
    // spokesman's "27 airstrikes in Taiz" is on the desk already (copies.ts).
    if (!home) {
      home = homes.find(
        (o) => open(o) && o.source !== r.source && before(o, DUPLICATE_WINDOW_MS) && sameCountAt(o, r) && !differentSpeakers(o, r),
      );
    }
    // Two known figures' words are two cards: Hegseth's interview was folded
    // into a card on Trump's post from five hours earlier (8 Oct).
    if (home && otherFigure(home.summary, r.summary)) home = undefined;
    if (!home) continue;
    gone.add(r);
    // By id too: a relay traced to its original carries the original's link.
    foldTrail.set(r.url, `${home.source}: ${home.summary.slice(0, 90)}`);
    foldTrail.set(r.fp, `${home.source}: ${home.summary.slice(0, 90)}`);
    // An outlet's exclusive leads always, with no "Also": the others only
    // retell it (user, 8 Oct). An exclusive arriving after a card on its
    // story takes that card over.
    if (isExclusiveCard(home) && home.source !== r.source) continue;
    if (isExclusiveCard(r)) {
      home.summary = r.summary;
      home.text = r.text;
      home.url = r.url;
      home.source = r.source;
      home.tier = r.tier;
      home.citing = undefined;
      home.alsoReportedBy = undefined;
      home.flags = [...new Set([...(home.flags ?? []), "exclusive"])];
      home.tags = [...new Set([...(home.tags ?? []), "lead-swap"])];
      touched.add(home);
      continue;
    }
    // The movement's own outlet carrying a statement a sympathetic paper
    // reported first: the statement is the movement's, and the paper was
    // relaying it. The card keeps its place in the feed and its identity, and
    // changes hands — the relay moving to "Also" rather than being dropped.
    // Likewise the speaker's own account after a relay's card: Pakistan's
    // foreign ministry on X after Al Arabiya's card on its statement (user, 2 Oct).
    const ownWords =
      (isOfficialBody(r.source) && !isOfficialBody(home.source) && speakerIs(r.source, home.summary)) ||
      // The spokesman's own channel over any outlet quoting him (user, 7 Oct):
      // Saree's posts of 05:47-06:48 went into Al-Masirah's and Al-Araby's
      // cards on his words as their "Also".
      (OWN_CHANNELS.has(r.source) && !OWN_CHANNELS.has(home.source));
    if (OWN_CHANNELS.has(r.source) && !OWN_CHANNELS.has(home.source)) {
      home.summary = r.summary;
      home.text = r.text;
      home.url = r.url;
      home.source = r.source;
      home.tier = r.tier;
      home.citing = undefined;
      // Outlets quoting him relay him; only what they add stays in "Also".
      home.alsoReportedBy = (home.alsoReportedBy ?? []).filter((a) => !quotesOwnChannel(a.summary ?? "", r.source));
      home.tags = [...new Set([...(home.tags ?? []), "lead-swap", "original"])];
      touched.add(home);
      continue;
    }
    // The outlet a relay's card cites, arriving after it: the original leads,
    // and a card from the original needs no "Also" (user, 3 Oct 07:09).
    const theOriginal = !!home.citing && !r.citing && sameOutlet(r.source, home.citing);
    if (theOriginal) {
      home.summary = r.summary;
      home.text = r.text;
      home.url = r.url;
      home.source = r.source;
      home.tier = r.tier;
      home.citing = undefined;
      home.alsoReportedBy = undefined;
      home.tags = [...new Set([...(home.tags ?? []), "lead-swap", "original"])];
      touched.add(home);
      continue;
    }
    // An aggregator's card gives way to the first source of its own (user, 3 Oct).
    const overAggregator = isAggregator(home.source) && !isAggregator(r.source);
    if (
      ownWords ||
      overAggregator ||
      // The report's own country's sources, the most official first (user, 8 Oct).
      nearerSource(home.summary, accountOf(r.source), accountOf(home.source)) ||
      (homeOutlet(r.source) &&
        !homeOutlet(home.source) &&
        sideOfSource(r.source) === sideOfSource(home.source) &&
        scoreReport(r) >= scoreReport(home))
    ) {
      const relayed = { source: home.source, url: home.url, summary: home.summary };
      home.summary = r.summary;
      home.text = r.text;
      home.url = r.url;
      home.source = r.source;
      home.tier = r.tier;
      home.alsoReportedBy = [relayed, ...(home.alsoReportedBy ?? [])].slice(0, 8);
      home.tags = [...new Set([...(home.tags ?? []), "lead-swap"])];
      if (home.side) home.confidence = confidenceOf(home, home.alsoReportedBy.map((a) => sideOfSource(a.source)));
      touched.add(home);
      continue;
    }
    // A wave's new targets, and what a relay carries that the original's card
    // lacks (South24's "over 200 Houthi targets", from the Axios piece the
    // desk could not open), go into the card even when it is the original.
    const relayed = !!r.citing && sameOutlet(home.source, r.citing);
    if (enrich && addsFacts(home, r) && (wave || told || site || relayed)) enrich.push([home, r]);
    // A card written from the original source needs no "Also": the others
    // only relay it.
    if (isOriginal(home) || relayed) continue;
    // The later account says something the card does not (a figure, a place):
    // the card is written again from both, so nothing new is lost to "Also".
    if (!wave && !told && !site && enrich && addsFacts(home, r)) enrich.push([home, r]);
    const also =[...(home.alsoReportedBy ?? []), ...(r.alsoReportedBy ?? []), { source: r.source, url: r.url, summary: r.summary }];
    const seen = new Set([home.source]);
    home.alsoReportedBy = also.filter((a) => !seen.has(a.source) && (seen.add(a.source), true)).slice(0, 8);
    // More outlets, more trust: counted by side, as in the cycle's own grouping.
    if (home.side) home.confidence = confidenceOf(home, home.alsoReportedBy.map((a) => sideOfSource(a.source)));
    if (!inPayload.has(home.fp)) touched.add(home);
  }
  for (let i = reports.length - 1; i >= 0; i -= 1) if (gone.has(reports[i])) reports.splice(i, 1);
  return [...touched];
}

/**
 * US officials whose remarks are looked for at their own sources — the White
 * House, State, the Pentagon, the wires, the TV networks — as soon as a card
 * quotes them: a relay carries one line, the original carries all of them.
 */
const SPEAKER_SEARCH: Record<string, string> = { trump: "Trump", vance: "Vance", rubio: "Rubio", hegseth: "Hegseth", witkoff: "Witkoff", leavitt: "Leavitt" };
const SPEAKER_SEARCH_GAP_MS = 60 * 60_000;
const SPEAKER_SEARCHES_PER_TICK = 2;

/** One Google News search per quoted official, read this tick alongside the feeds. */
export function speakerSearches(reports: LiveReport[], state: ScanState, now: number): RssFeed[] {
  const out: RssFeed[] = [];
  for (const r of reports) {
    if (out.length >= SPEAKER_SEARCHES_PER_TICK) break;
    if ((r.type !== "statement" && r.type !== "diplomacy") || now - Date.parse(r.at) > 3 * 3600_000) continue;
    const key = namedSpeaker(r.summary);
    const name = SPEAKER_SEARCH[key];
    const id = `spk-${key}`;
    if (!name || out.some((f) => f.id === id) || now - (state.lastScanAt[`web:${id}`] ?? 0) < SPEAKER_SEARCH_GAP_MS) continue;
    out.push({ id, url: gnews(`"${name}" (Yemen OR Houthi OR Houthis OR Saudi OR "Red Sea") when:1d`), name: "US media", cadence: C30 });
  }
  return out;
}

/** A follow-up this soon after the same outlet's card on the same story replies to it. */
const FOLLOW_MS = 15 * 60_000;

/**
 * "Fighting on Jabal Qurfan" then, minutes later from the same outlet, "Jabal
 * Qurfan recaptured": the second follows the first. Same source, within 15
 * minutes, and the rules of links.ts — a shared place or named thing, or one
 * speaker's lines. A word in common is not enough: "control", "wadi",
 * "missile" tied Kahbub to Marib and Beihan to Haifan.
 */
export function linkFollowUps(fresh: LiveReport[], pool: LiveReport[]): void {
  const who = speakersOf([...pool, ...fresh]);
  for (const r of fresh) {
    if (r.replyTo) continue;
    const t = Date.parse(r.at);
    const prev = pool
      .filter((x) => x.fp !== r.fp && x.source === r.source && Date.parse(x.at) < t && t - Date.parse(x.at) <= FOLLOW_MS)
      .filter((x) => linkOk(r, x, who))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    if (prev) r.replyTo = prev.fp;
  }
}

/** Outlet feeds read early per tick because a channel cited them. */
const HINTS_PER_TICK = 3;

/**
 * A channel relaying "the WSJ reports ..." hints that the outlet has a story:
 * the outlet's own feeds are read next tick instead of at their hour.
 */
export function hintOutlets(state: ScanState, hits: { text: string; source: string; url: string; fromTg?: boolean }[], now: number): string[] {
  const sites = new Set<string>();
  for (const h of hits) {
    if (!h.fromTg) continue;
    const c = findCitation(h.text, h.source, h.url);
    if (c) sites.add(c.site);
  }
  const out: string[] = [];
  for (const feed of RSS) {
    if (out.length >= HINTS_PER_TICK) break;
    const site = feed.site;
    const last = state.lastScanAt[`web:${feed.id}`] ?? 0;
    // Already hinted, or read in the last ten minutes: nothing to add.
    if (!site || !sites.has(site) || (state.lastScanAt[`hint:web:${feed.id}`] ?? 0) > last || now - last < 10 * 60_000) continue;
    state.lastScanAt[`hint:web:${feed.id}`] = now;
    out.push(feed.id);
  }
  return out;
}

/** Written from the original source's own article: a relay's card moved to it. */
export function isOriginal(r: LiveReport): boolean {
  return !!r.tags?.includes("original") || (r.fp.startsWith("live-t-me-") && !r.url.startsWith("https://t.me/"));
}

/** A speaker silent this long has finished; the next line starts a new thread. */
const SPEECH_GAP_MS = 45 * 60 * 1000;
/** A speakerless line and its channel's named line this close are one speaker's. */
const NEIGHBOUR_MS = 3 * 60_000;
/** Lines of a speech another outlet posts after it ended, as long as this after its last line. */
const LATE_RELAY_MS = 6 * 3600 * 1000;

/**
 * A live speech arrives one line per post, and each newsworthy line is its own
 * card replying to the speaker's previous line, so the feed shows the speech
 * as one thread from its first line. A line that arrives late (a replay, a
 * slow scan) takes its place in time: the line after it is re-pointed to it.
 * `stored` are desk rows the payload no longer carries; the ones re-pointed
 * are returned, so the store can save them.
 */
export function threadSpeeches(reports: LiveReport[], _published: Set<string>, stored: LiveReport[] = []): LiveReport[] {
  const inPayload = new Set(reports.map((r) => r.fp));
  const all = [...reports, ...stored.filter((s) => !inPayload.has(s.fp))];
  // A foreign minister's lines are typed diplomacy as often as statement.
  const talk = all
    .filter((r) => r.type === "statement" || r.type === "diplomacy")
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  // A line that names no speaker ("our forces will respond") is the speaker's
  // whose line the same channel posted within three minutes of it.
  const speaker = new Map<LiveReport, string>();
  for (const r of talk) {
    let who = namedSpeaker(r.summary);
    if (!who) {
      const t = Date.parse(r.at);
      const next = talk.find((o) => o !== r && o.source === r.source && Math.abs(Date.parse(o.at) - t) <= NEIGHBOUR_MS && namedSpeaker(o.summary));
      if (next) who = namedSpeaker(next.summary);
    }
    if (who) speaker.set(r, who);
  }
  const lines = talk.filter((r) => speaker.has(r));
  const byFp = new Map(lines.map((r) => [r.fp, r]));
  const last = new Map<string, LiveReport>();
  const touched: LiveReport[] = [];
  for (const r of lines) {
    const who = speaker.get(r)!;
    const prev = last.get(who);
    last.set(who, r);
    // Another outlet posting lines of the speech after it ended (Saba's summary,
    // hours later) still belongs to it.
    const gap = prev && prev.source !== r.source && who === "houthi leader" ? LATE_RELAY_MS : SPEECH_GAP_MS;
    if (!prev || Date.parse(r.at) - Date.parse(prev.at) > gap || r.replyTo === prev.fp) continue;
    // A reply to something else than this speech stays; one to an earlier
    // line of it moves to the line now just before it.
    const to = r.replyTo ? byFp.get(r.replyTo) : undefined;
    if (r.replyTo && !(to && speaker.get(to) === who && Date.parse(to.at) < Date.parse(prev.at))) continue;
    r.replyTo = prev.fp;
    if (!inPayload.has(r.fp)) touched.push(r);
  }
  return touched;
}

/** An outlet's desk groups, for which account leads a card. */
function accountOf(source: string) {
  const yemen = TG.find((c) => c.name === source)?.lean ?? X_ACCOUNTS.find((x) => x.name === source)?.lean ?? "";
  return { source, lean: iranLeanOf(source) ?? "", side: yemen === "houthi" || yemen === "gov" || yemen === "south" ? "yemen" : "" };
}

/** Which of two reports on the same story to keep. */
function scoreReport(x: LiveReport): number {
  return (
    (x.score || 0) * 2 +
    (x.tier === "agency" ? 60 : x.tier === "claim" ? 20 : 0) +
    String(x.summary || "").length +
    (x.place ? 25 : 0) +
    // A speaker's own channel is the original of his words.
    (OWN_CHANNELS.has(x.source) ? 120 : 0)
  );
}
const OWN_CHANNELS = new Set(["Yahya Saree", "Mohammed Abdulsalam"]);
/** How long a spokesman's own post is the home of his words told by others. */
const OWN_WORDS_MS = 12 * 3600_000;
/** How far back an outlet's card quoting him is taken over by his own post. */
const OWN_TAKEOVER_MS = 6 * 3600_000;
/** Does this text carry the words of the spokesman whose own channel `who` is? */
export function quotesOwnChannel(text: string, who: string): boolean {
  const t = String(text || "");
  if (who === "Yahya Saree") return /Saree|سريع|Houthi (?:Armed Forces|military|army) spokes|Yemeni (?:Armed Forces|armed forces|military) spokes|المتحدث (?:الرسمي )?باسم القوات المسلحة/i.test(t);
  if (who === "Mohammed Abdulsalam") return /Abdulsalam|Abdul-?Salam|عبدالسلام|عبد السلام|Houthi (?:chief )?(?:spokes|negotiator)/i.test(t);
  return false;
}
/** Official bodies' own outlets: the original of their statements. */
const OFFICIAL_OUTLETS = new Set(["SPA", "Saba", "Saba (Houthi-run)", "Saba (government)"]);

/**
 * Which account of an event leads its card: the speaker's own channel, then
 * an official body's own outlet for its statement, the original a relay
 * cited, an agency, then the best-written account.
 */
export function leadRank(r: LiveReport): number {
  const spoken = r.type === "statement" || r.type === "diplomacy";
  return (
    (OWN_CHANNELS.has(r.source) ? 4000 : 0) +
    (spoken && OFFICIAL_OUTLETS.has(r.source) ? 2000 : 0) +
    (isOriginal(r) ? 1000 : 0) +
    (r.tier === "agency" ? 500 : 0) +
    scoreReport(r)
  );
}

/* ------------------------------------------------------------------ *
 * Persist to the desk snapshot
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * One scan cycle
 * ------------------------------------------------------------------ */

/**
 * The last day of desk rows, as reports: a new outlet on a story whose card
 * has left the payload still folds into that card instead of becoming another.
 */
async function storedCards(desk: DeskId = "yemen"): Promise<LiveReport[]> {
  try {
    const store = await getStore();
    const since = Date.now() - STORY_WINDOW_MS;
    return (await store.recentDesk(150, undefined, { events: false, desk })).reports
      .filter((r) => Date.parse(String(r.at)) >= since)
      .map((r) => ({ ...(r as unknown as LiveReport), text: String((r as { text?: string }).text ?? ""), live: true as const }));
  } catch {
    return [];
  }
}

/** A lead's row id: its URL, hashed (URLs run long). */
const leadId = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 24);
let leadMigrated = false;
let leadPrunedAt = 0;

/**
 * The leads of these URLs only, one row each. The cache was one 9.5 MB blob,
 * read and written whole every tick: most of the database egress that ran out
 * the free plan.
 */
async function loadLeadCache(urls: string[]): Promise<LeadCache> {
  try {
    const store = await getStore();
    if (!leadMigrated) {
      await migrateBlob(store, LEAD_CACHE_KEY, LEAD_PREFIX, leadId);
      leadMigrated = true;
    }
    const rows = await store.getMany<LeadCache[string]>(LEAD_PREFIX, urls.map(leadId));
    const out: LeadCache = {};
    for (const u of urls) if (rows[leadId(u)]) out[u] = rows[leadId(u)];
    return out;
  } catch {
    return {};
  }
}

/** Only the entries this tick set are written; entries a week old are dropped. */
async function saveLeadCache(cache: LeadCache, changed: Set<string>): Promise<void> {
  try {
    const store = await getStore();
    await store.putMany(LEAD_PREFIX, Object.fromEntries([...changed].filter((u) => cache[u]).map((u) => [leadId(u), cache[u]])));
    if (Date.now() - leadPrunedAt > 3600_000) {
      leadPrunedAt = Date.now();
      await store.prune(LEAD_PREFIX, LEAD_KEEP_MS);
    }
  } catch {
    /* a lost cache only costs refetches */
  }
}

/**
 * Where a cycle's time goes, one line per stage in the server log
 * ("[lap] sources 41s"). A cycle that runs long is otherwise one number.
 */
let lapAt = 0;
function lap(stage: string): void {
  const t = Date.now();
  if (stage !== "start") console.log(`[lap] ${stage} ${Math.round((t - lapAt) / 1000)}s`);
  lapAt = t;
}

/**
 * What one read of the Yemen desk's sources found, ready for its reader: the
 * items (triaged, opened, one per address), each source's status, and the
 * items from the sources both desks share that are about the war with Iran.
 * The site scan (site-scan.server.ts) puts it in the Yemen inbox.
 */
export type YemenFetch = {
  /** When the scan started: the cycle's time on the desk. */
  at: number;
  hits: RawHit[];
  status: SourceStatus[];
  sourcesOk: number;
  /** The learned outlets' feeds, so the status page keeps only real sources. */
  learnedIds: string[];
  /** For the Iran desk, after the Yemen reader has read them. */
  iranShared: RawHit[];
};

/** One cycle in one go: the old path (site-scan mode "off"). */
async function scanOnce(state: ScanState, prev: ScanPayload | null): Promise<ScanPayload> {
  return readYemen(state, prev, await fetchYemenSources(state, prev));
}

/** The Yemen desk's sources read once: the site scan's part for this desk. */
export async function fetchYemenSources(state: ScanState, prev: ScanPayload | null): Promise<YemenFetch> {
  lap("start");
  const now = Date.now();
  const cycleSeenAt = jerusalemIso(new Date(now));
  const dueTg = TG.filter((ch) => cadenceDue(state, `tg:${ch.id}`, ch.cadence, now));
  // A feed an outlet hint named (a channel citing the WSJ) is read now, not at its hour.
  const hinted = (id: string) => (state.lastScanAt[`hint:web:${id}`] ?? 0) > (state.lastScanAt[`web:${id}`] ?? 0);
  let learned: Learned[] = [];
  try {
    learned = await loadLearned(await getStore());
  } catch {
    // Unread, the learned outlets wait for the next tick.
  }
  const dueRss = [
    ...RSS.filter((feed) => hinted(feed.id) || cadenceDue(state, `web:${feed.id}`, feed.cadence, now)),
    ...learnedFeeds(learned).filter((feed) => cadenceDue(state, `web:${feed.id}`, feed.cadence, now)),
    ...speakerSearches(prev?.reports ?? [], state, now),
  ];
  let sourcesOk = 0;
  const hits: RawHit[] = [];
  // Items from the sources both desks read that are about the war with Iran:
  // handed to the Iran desk's scan (iran-scan.server.ts), which reads them
  // with its own reader. Each source is still fetched once (Round 30).
  const iranInbox: RawHit[] = [];
  const toIran = (rows: RawHit[], lean: IranLean | undefined) => {
    if (!lean) return;
    for (const r of rows) if (isIranWar(`${r.title ?? ""} ${r.text}`)) iranInbox.push({ ...r, lean, picked: undefined });
  };
  const status: SourceStatus[] = [];
  const jobs: Promise<void>[] = [];

  // X accounts an original was found at join the half-hourly tier.
  const learnedX = learned.filter((l) => l.kind === "x" && !X_ACCOUNTS.some((x) => x.handle.toLowerCase() === l.site)).map((l) => X(l.site, l.name, "intl", C30));
  for (const acct of [...X_ACCOUNTS, ...learnedX].filter((a) => cadenceDue(state, `x:${a.handle}`, a.cadence, now))) {
    jobs.push(
      (async () => {
        let rows: RawHit[] = [];
        let ok = false;
        try {
          const page = await fxPage(acct.handle);
          if (page) {
            const all = parseFxStatuses(page, acct);
            // Only what is new since the last read; on first sight, the last few hours.
            const seenId = state.lastXPost?.[acct.handle];
            const idOf = (r: RawHit) => /\/status\/(\d+)/.exec(r.xPost ?? r.url)?.[1] ?? "";
            rows = all.filter((r) => newerX(idOf(r), seenId) && (seenId || Date.parse(r.at) > now - FIRST_SIGHT_MS));
            // The Iran desk takes this account's posts on its war, whatever the Yemen filter keeps.
            const ixLean = SHARED_X[acct.handle];
            if (ixLean) {
              const every = acct.only ? parseFxStatuses(page, { ...acct, only: undefined }) : all;
              toIran(every.filter((r) => newerX(idOf(r), seenId) && (seenId || Date.parse(r.at) > now - FIRST_SIGHT_MS)), ixLean);
            }
            // A replay pages back to its start once, for what the downtime missed.
            const replayKey = `x:${acct.handle}`;
            if (seenId && replaying(state, replayKey, now)) {
              let cursor = page.cursor?.bottom ?? undefined;
              let oldestAt = Math.min(...all.map((r) => Date.parse(r.at)).filter(Number.isFinite));
              for (let n = 0; cursor && n < REPLAY_X_PAGES && oldestAt >= REPLAY.since; n += 1) {
                const older = await fxPage(acct.handle, cursor);
                const more = older ? parseFxStatuses(older, acct) : [];
                if (!more.length) break;
                rows.push(...more.filter((r) => Date.parse(r.at) >= REPLAY.since && !rows.some((x) => x.url === r.url)));
                oldestAt = Math.min(...more.map((r) => Date.parse(r.at)).filter(Number.isFinite));
                cursor = older?.cursor?.bottom ?? undefined;
              }
              rows.push(...all.filter((r) => Date.parse(r.at) >= REPLAY.since && !rows.some((x) => x.url === r.url)));
              state.lastScanAt[`${REPLAY.key}:${replayKey}`] = now;
            } else if (seenId && all.length >= 5 && rows.length >= all.length - 1) {
              // Every post on the page is new (a pinned old one aside): more
              // fell below it since the last read. Page back to the last seen.
              let cursor = page.cursor?.bottom ?? undefined;
              let paged = 0;
              for (; cursor && paged < X_BACKFILL_PAGES; paged += 1) {
                const older = await fxPage(acct.handle, cursor);
                const more = older ? parseFxStatuses(older, acct) : [];
                const fresh = more.filter((r) => newerX(idOf(r), seenId) && !rows.some((x) => x.url === r.url));
                rows.push(...fresh);
                if (!more.length || fresh.length < more.length - 1) break;
                cursor = older?.cursor?.bottom ?? undefined;
              }
              console.log(`[x] ${acct.handle}: paged back ${paged + 1} page(s) to the last post read`);
            }
            // A warning posted as a picture: its words are read off it. One
            // left unread holds the account back, to be read again next tick.
            let unread = false;
            if (acct.picture) {
              const read: RawHit[] = [];
              for (const r of rows) {
                const pic = r.media?.kind === "photo" ? r.media.thumb : undefined;
                const words = pic ? await readNotice(pic) : null;
                if (pic && !words) {
                  unread = true;
                  break;
                }
                const text = words ?? r.text;
                if (!acct.only || acct.only.test(text)) read.push({ ...r, text });
              }
              if (unread) console.log(`[x] ${acct.handle}: a warning's picture went unread; again next tick`);
              rows = unread ? [] : read;
            }
            // A newspaper's short link (reut.rs, wapo.st) is followed to its
            // article, so the site's own listing of it is the same item.
            if (acct.article) rows = await Promise.all(rows.map(async (r) => (r.xPost ? { ...r, url: cleanUrl(await finalUrl(r.url)) } : r)));
            const newest = all.map((r) => idOf(r)).reduce((m, id) => (newerX(id, m || undefined) ? id : m), seenId ?? "");
            if (newest && !unread) (state.lastXPost ??= {})[acct.handle] = newest;
            ok = true;
          }
        } catch {
          // Unread this tick; the status says so.
        }
        if (ok) sourcesOk += 1;
        hits.push(...rows);
        state.lastScanAt[`x:${acct.handle}`] = Date.now();
        status.push({ id: acct.handle, name: acct.name, kind: "x", ok, cadence: cadenceLabel(acct.cadence), hits: rows.length });
      })(),
    );
  }
  for (const ch of dueTg) {
    jobs.push(
      (async () => {
        const html = await fetchText(`https://t.me/s/${ch.id}`);
        const ok = !!(html && html.includes("tgme_widget_message"));
        const seen = state.lastTgPost?.[ch.id] ?? 0;
        // Nothing posted since the last read: the page is not parsed at all
        // (most ticks, for most channels; Vercel bills the processor time).
        const inRun = inReplay(ch.id) && replaying(state, ch.id, now);
        const quiet = ok && seen > 0 && !inRun && newestTgPost(html as string, ch.id) <= seen;
        const rows = ok && !quiet ? parseTelegram(html as string, ch) : [];
        // A busy channel can post more between two scans than its first page
        // holds. Page back until we reach the last post already read, so a
        // burst never leaves a gap. First sight of a channel: no backfill.
        for (let page = 0; ok && seen && page < TG_BACKFILL_PAGES; page += 1) {
          const oldest = Math.min(...rows.map((r) => tgPostNo(r.url)).filter(Boolean));
          if (!Number.isFinite(oldest) || oldest <= seen + 1) break;
          const older = await fetchText(`https://t.me/s/${ch.id}?before=${oldest}`);
          const more = older ? parseTelegram(older, ch).filter((r) => tgPostNo(r.url) < oldest) : [];
          if (!more.length) break;
          rows.push(...more);
        }
        // Bumped to run once more after the geocoder landed, to pin what the
        // first pass published without a place.
        const replayKey = `${REPLAY.key}:${ch.id}`;
        if (ok && inRun) {
          // A page that fails to load leaves the replay unfinished, to go on next tick.
          let done = true;
          for (let page = 0; page < REPLAY.pages; page += 1) {
            const oldest = Math.min(...rows.map((r) => tgPostNo(r.url)).filter(Boolean));
            const oldestAt = Math.min(...rows.map((r) => Date.parse(r.at)).filter(Number.isFinite));
            if (!Number.isFinite(oldest) || oldestAt < REPLAY.since) break;
            const older = await replayFetch(`https://t.me/s/${ch.id}?before=${oldest}`);
            if (!older) {
              done = false;
              break;
            }
            const more = parseTelegram(older, ch).filter((r) => tgPostNo(r.url) < oldest);
            if (!more.length) break;
            rows.push(...more);
          }
          if (done) state.lastScanAt[replayKey] = now;
        }
        const newest = Math.max(seen, ok ? newestTgPost(html as string, ch.id) : 0, ...rows.map((r) => tgPostNo(r.url)));
        if (newest > 0) (state.lastTgPost ??= {})[ch.id] = newest;
        if (ok) sourcesOk += 1;
        hits.push(...rows);
        toIran(rows, SHARED_TG[ch.id]);
        state.lastScanAt[`tg:${ch.id}`] = Date.now();
        status.push({ id: ch.id, name: ch.name, kind: "tg", ok, cadence: cadenceLabel(ch.cadence), hits: rows.length });
      })(),
    );
  }
  // What each whole site listed that the desk had not judged before: its
  // headlines go to triage together, after every listing is in.
  const seen = await loadSeen();
  const unjudged: { feed: RssFeed; hit: RawHit; key: string }[] = [];
  for (const feed of dueRss) {
    jobs.push(
      (async () => {
        // What we had already read from this feed, before this read moves it on.
        const lastRead = state.lastScanAt[`web:${feed.id}`] ?? 0;
        if (feed.whole) {
          // A replay reads each listing once as far back as its start; a
          // Google News query is widened to two days for that read.
          const replayKey = `web:${feed.id}`;
          const inRun = replaying(state, replayKey, now);
          const url = inRun && /news\.google\.com/.test(feed.url) ? feed.url.replace(/when%3A\w+/, "when%3A2d") : widenForGap(feed.url, feed.cadence, lastRead, now);
          let body = await fetchListing(url, feed.ua);
          let listed = body ? (feed.html ? parseHtmlListing(body, feed.url, feed.html) : parseListing(body)) : [];
          // A site whose own listing fails today (Arab News answers some
          // readers 403) is listed through Google News for this read instead.
          if (!listed.length && feed.site && !/news.google.com/.test(feed.url)) {
            body = await fetchListing(feed.lang === "ar" ? gnews(`site:${feed.site} when:1d`, "ar", "SA", "SA:ar") : gnews(`site:${feed.site} when:1d`));
            listed = body ? parseListing(body) : [];
          }
          const ok = listed.length > 0;
          const mine = (seen[feed.id] ??= {});
          const firstSight = Object.keys(mine).length === 0;
          // A listing reaches back days (a sitemap, Axios); what is older than
          // this was judged before, or is not news any more. On first sight
          // only the last few hours are read, as a channel is.
          const window = firstSight ? FIRST_SIGHT_MS : inRun ? Math.max(SEEN_WINDOW_MS, now - REPLAY.since) : SEEN_WINDOW_MS;
          if (ok && inRun) state.lastScanAt[`${REPLAY.key}:${replayKey}`] = now;
          const rows: RawHit[] = [];
          let fresh = 0;
          for (const it of listed) {
            // An undated article on a section page: on first sight the whole
            // page is what was there before; only what appears later is new.
            if (!Number.isFinite(it.at) && firstSight) {
              mine[`u${urlKey(it.url)}`] = 0;
              continue;
            }
            if (Number.isFinite(it.at) && now - it.at > window) {
              // Older than a first read reaches: set aside unjudged, so the
              // next read does not take the whole day back as new.
              if (firstSight && now - it.at <= SEEN_WINDOW_MS) mine[`u${urlKey(it.url)}`] = 0;
              continue;
            }
            const key = `u${urlKey(it.url)}`;
            const verdict = mine[key];
            // A picked article goes round again only for its first hour, in case
            // its card failed; after that it is done. Sheba lists its articles
            // for days, and an old one sent each scan joined new Taiz cards as
            // "Also" (the four Iranian experts, 28 Sep, under 29 Sep strikes).
            if (verdict !== undefined && (verdict === 1 || (verdict > 1 && now - verdict > PICKED_RETRY_MS))) {
              mine[key] = DONE;
              continue;
            }
            // Undated and picked before: it is as new as when first seen, not now.
            const hit = listedHit(it, feed, verdict !== undefined && verdict > 1 ? verdict : undefined);
            if (!hit) continue;
            if (wasPicked(verdict)) rows.push({ ...hit, picked: true });
            else if (verdict === undefined) {
              fresh += 1;
              unjudged.push({ feed, hit, key });
            }
          }
          if (ok) sourcesOk += 1;
          hits.push(...rows);
          toIran(unjudged.filter((u) => u.feed === feed).map((u) => u.hit), SHARED_RSS[feed.name]);
          // Every article in the window is new to the desk: the listing may
          // have filled up since the last read and dropped some unseen.
          const inWindow = listed.filter((it) => !Number.isFinite(it.at) || now - it.at <= window).length;
          const rolled = !firstSight && !!lastRead && inWindow >= 20 && fresh === inWindow;
          state.lastScanAt[`web:${feed.id}`] = Date.now();
          status.push({ id: feed.id, name: feed.name, kind: "web", ok, cadence: cadenceLabel(feed.cadence), hits: rows.length, rolled, listed: listed.length, fresh });
          return;
        }
        const body = await fetchText(widenForGap(feed.url, feed.cadence, lastRead, now), 8000);
        let rows: RawHit[] = [];
        const ok = !!(body && /<item[\s>]/i.test(body));
        if (ok && body) rows = parseRss(body, feed.name);
        if (ok) sourcesOk += 1;
        hits.push(...rows);
        toIran(rows, SHARED_RSS[feed.name]);
        // A feed answers with one page. If everything on that page was
        // published since the last read, the page filled up in between and
        // whatever fell off the bottom was never seen. Telegram pages back to
        // the post it last saw; a feed URL has no such handle, so the honest
        // thing is to make the possibility visible rather than assume it away.
        const times = rows.map((r) => Date.parse(r.at)).filter(Number.isFinite);
        const rolled = !!lastRead && times.length > 0 && Math.min(...times) > lastRead;
        state.lastScanAt[`web:${feed.id}`] = Date.now();
        status.push({ id: feed.id, name: feed.name, kind: "web", ok, cadence: cadenceLabel(feed.cadence), hits: rows.length, rolled });
      })(),
    );
  }
  await Promise.allSettled(jobs);
  state.scannedOnce = true;
  lap("sources");

  // A model reads the new headlines and picks what could be this war's; the
  // rest are remembered as judged and never fetched. Headlines no model got to
  // (a spent quota) are judged by keyword now and asked about again next tick.
  if (unjudged.length) {
    const { picked, judged } = await triage(
      unjudged.map((u, i) => ({ id: String(i), title: u.hit.title ?? "", desc: u.hit.text.slice((u.hit.title ?? "").length).trim(), source: u.feed.name })),
    );
    const pickedBy: Record<string, number> = {};
    unjudged.forEach((u, i) => {
      const id = String(i);
      // An exclusive on this war is always read, whatever the triage made of it.
      const forced = !picked.has(id) && isExclusive(u.hit.text, u.feed.name) && THIS_WAR.test(u.hit.text);
      if (judged.has(id) || forced) seen[u.feed.id][u.key] = picked.has(id) || forced ? now : 0;
      if (!picked.has(id) && !forced) return;
      hits.push({ ...u.hit, picked: true });
      pickedBy[u.feed.id] = (pickedBy[u.feed.id] ?? 0) + 1;
    });
    for (const s of status) if (s.listed !== undefined) s.picked = pickedBy[s.id] ?? 0;
  }
  for (const s of status) {
    if (s.listed === undefined) continue;
    (state.sites ??= {})[s.id] = { at: now, ok: s.ok, listed: s.listed, fresh: s.fresh ?? 0, picked: s.picked ?? 0, rolled: !!s.rolled };
  }
  await saveSeen(seen);
  lap("triage");

  // A feed that lists last week's articles is not reporting last week's news.
  const fresh = hits.filter((h) => {
    const t = Date.parse(h.at);
    return !Number.isFinite(t) || now - t <= MAX_ITEM_AGE_MS;
  });
  hits.length = 0;
  hits.push(...fresh);

  // Thin RSS teasers get their lead paragraph pulled so the gate has something
  // to judge. The same items reappear cycle after cycle, so leads are cached by
  // URL and each article page is fetched once.
  // An exclusive is opened whatever its teaser: a 2,000-character teaser is
  // still a fraction of the piece.
  const exclusive = (h: RawHit) => !h.fromTg && isExclusive(h.text, h.source);
  const leadable = (h: RawHit) => !(h.fromTg || (h.text.length >= 2000 && !isGnews(h.url) && !exclusive(h)) || /\.pdf(\?|$)/i.test(h.url));
  const leadCache = await loadLeadCache(hits.filter(leadable).map((h) => h.url));
  const leadChanged = new Set<string>();
  const addLead = (h: RawHit, lead: string) => {
    if (lead.length > 80) h.text = `${h.text}\n${lead}`.slice(0, exclusive(h) ? EXCLUSIVE_CHARS + 600 : ITEM_CHARS);
  };
  // An undated listing's article takes the date its own page gives.
  const datePage = (h: RawHit, pub: number | undefined) => {
    if (h.undated && pub && Number.isFinite(pub) && pub <= now + 10 * 60_000) {
      h.at = jerusalemIso(new Date(pub));
      h.undated = false;
    }
  };
  const toFetch: RawHit[] = [];
  for (const h of hits) {
    // A Google News item is resolved to its article even with a long teaser:
    // Google's redirect sends readers to a robot check.
    if (!leadable(h)) continue;
    const cached = leadCache[h.url];
    // A Google News entry cached before links were resolved holds Google's
    // own page, not the article: it is fetched again.
    if (cached && !(isGnews(h.url) && !cached.real)) {
      addLead(h, cached.lead);
      datePage(h, cached.pub);
      // The card links the publisher's article, not Google's redirect.
      if (cached.real) h.url = cleanUrl(cached.real);
    } else toFetch.push(h);
  }
  // Google News items first need their article's address: a few per cycle,
  // since each costs two requests to Google.
  let resolves = 0;
  let rescues = 0;
  // What triage picked from a whole site is opened first.
  toFetch.sort((a, b) => Number(!!b.picked) - Number(!!a.picked));
  const fetchable = toFetch.filter((h) => !isGnews(h.url) || resolves++ < GNEWS_RESOLVES).slice(0, BODY_FETCHES);
  await Promise.allSettled(
    fetchable.map(async (h) => {
      const key = h.url;
      const real = isGnews(key) ? await resolveGoogleNews(key) : "";
      if (isGnews(key) && !real) {
        leadCache[key] = { lead: "", at: now, tries: (leadCache[key]?.tries ?? 0) + 1 };
        leadChanged.add(key);
        return; // retried next cycle
      }
      const page = real || key;
      const html = await fetchText(page, 6000);
      if (!html && !real && !h.feedBody) return; // not cached: a failed fetch is retried next cycle
      // A paywalled article still yields its address; its lead may be empty.
      const cap = exclusive(h) ? EXCLUSIVE_CHARS : ARTICLE_CHARS;
      let lead = html ? extractLead(html, cap) : "";
      // The page will not open (axios.com, 403) but the feed gave the article whole.
      if (h.feedBody && h.feedBody.length > lead.length) lead = h.feedBody.slice(0, cap);
      // Still a teaser. If the publisher offers an AMP copy — which they serve
      // openly, for readers arriving from search — read that instead: it is the
      // same article without the subscription wall drawn over it. One extra
      // request, only for the articles that came back short.
      if (html && lead.length < AMP_RETRY_UNDER) {
        const amp = amphtmlOf(html, page);
        if (amp && amp !== page) {
          const ampHtml = await fetchText(amp, 6000);
          const ampLead = ampHtml ? extractLead(ampHtml, cap) : "";
          if (ampLead.length > lead.length) lead = ampLead;
        }
      }
      // The article will not open at all, or opens on a teaser. Measured today:
      // wsj.com answers 401 to every reader, and arabnews.com, aawsat.com and
      // al-akhbar.com answer 403 — to any header, so there is nothing to be
      // gained by dressing the desk up as a browser, and it does not.
      //
      // What a desk does instead is find the story elsewhere. `readOriginal`
      // already knows how: the same headline searched on Google News, the copies
      // that carry it read in full, and a Wayback capture if no copy will open.
      // The card still says WSJ, because WSJ is who reported it; only the words
      // the desk had to read come from wherever it could read them.
      if (lead.length < WALLED_UNDER && h.title && rescues < WALLED_RESCUES) {
        rescues += 1;
        const lang = /[؀-ۿ]/.test(h.title) ? "ar" : "en";
        // Last, the story as other outlets told it: the WSJ's own paywalled
        // item is written up by others within hours.
        const cover = { name: h.source, keys: keywords(h.title, lang, h.source), at: Date.parse(h.at) };
        const full = await readOriginal({ url: page, source: h.source, title: h.title }, lang, undefined, cover);
        if (full.length > lead.length) lead = full.replace(/\s+/g, " ").trim().slice(0, cap);
      }
      const pub = html ? pageDate(html) : NaN;
      leadCache[key] = { lead, at: now, ...(real ? { real } : {}), ...(Number.isFinite(pub) ? { pub } : {}) };
      leadChanged.add(key);
      addLead(h, lead);
      datePage(h, pub);
      if (real) h.url = cleanUrl(real);
    }),
  );
  await saveLeadCache(leadCache, leadChanged);
  // A section page lists old articles beside new ones: one its page dates
  // before the window is old news, not a new card.
  {
    const stale = hits.filter((h) => !h.fromTg && !h.undated && leadCache[h.url]?.pub && now - (leadCache[h.url].pub as number) > SEEN_WINDOW_MS && Math.abs(Date.parse(h.at) - (leadCache[h.url].pub as number)) < 1000);
    for (const h of stale) hits.splice(hits.indexOf(h), 1);
    if (stale.length) console.log(`[scan] ${stale.length} listed article(s) dated by their page as old, left out`);
  }
  lap("article leads");
  // One article under two addresses — Google's redirect and the outlet's own
  // link, from two listings — is one item: the WSJ's China story went out as
  // two cards. An unresolved Google item takes the address its outlet's own
  // copy of the same headline has.
  const direct = new Map<string, string>();
  for (const h of hits) if (h.title && !isGnews(h.url)) direct.set(`${h.source}|${titleKey(h.title)}`, h.url);
  for (const h of hits) {
    const own = h.title && isGnews(h.url) ? direct.get(`${h.source}|${titleKey(h.title)}`) : undefined;
    if (own) h.url = own;
  }
  const oneEach = new Map<string, RawHit>();
  for (const h of hits) {
    const k = h.fromTg ? h.url : cleanUrl(h.url);
    const had = oneEach.get(k);
    if (!had || h.text.length > had.text.length) oneEach.set(k, had ? { ...h, picked: h.picked || had.picked } : h);
  }
  hits.length = 0;
  hits.push(...oneEach.values());
  // An item still on Google's redirect waits a few cycles for its address,
  // then goes out as it is rather than be missed.
  const resolved = hits.filter((h) => !isGnews(h.url) || (leadCache[h.url]?.tries ?? 0) >= GNEWS_HOLD_TRIES);
  hits.length = 0;
  hits.push(...resolved);
  return { at: now, hits, status, sourcesOk, learnedIds: learnedFeeds(learned).map((f) => f.id), iranShared: iranInbox };
}

/**
 * The keyword gate before the Yemen reader: what reaches the reader, and each
 * item's gate verdict for the scan box. Leaders' words come from their own
 * outlet; relays pass only when it was down.
 */
export function yemenCandidates(hits: RawHit[], status: SourceStatus[]): { pre: Map<string, Composed>; candidates: Candidate[] } {
  const officialDown = !status.some((s) => s.id === "almasirah2" && s.ok);
  const pre = new Map<string, Composed>();
  const candidates: Candidate[] = [];
  for (const h of hits) {
    const c = toLiveReport(h.source, h.url, h.text, h.at, h.text.slice(0, 80), h.lean, officialDown);
    pre.set(h.url, c);
    // A whole site's article that triage picked goes to the reader even when
    // no keyword matched it: that is what reading the site whole is for.
    const picked = h.picked && !["excluded-source", "no-article", "bad-url"].includes(c.reason);
    if (c.outcome === "exclude" && !picked) continue;
    // Erem, Asharq Al-Awsat, Al-Araby, Al-Akhbar, Alhurra, Arab News: only what
    // they have on their own. An original a relay pointed to is read regardless.
    if (!h.fromTg && OWN_ONLY.has(h.source) && !ownInformation(h.text, h.source)) continue;
    candidates.push({
      source: h.source,
      url: h.url,
      text: h.text,
      at: h.at,
      lean: h.lean,
      fp: fpOf(h.url, h.text.slice(0, 80)),
      score: c.report?.score ?? c.topicality,
      tags: c.tags,
    });
  }
  return { pre, candidates };
}

/** The Yemen desk's reader and cards, from one read of its sources (its inbox). */
export async function readYemen(state: ScanState, prev: ScanPayload | null, got: YemenFetch): Promise<ScanPayload> {
  const { at: now, hits, status, sourcesOk, iranShared: iranInbox } = got;
  const cycleSeenAt = jerusalemIso(new Date(now));

  /**
   * Two stages. The keyword gate (via `toLiveReport`) is only a cheap
   * pre-filter: what it excludes never costs a model call. Everything else is
   * decided by the reader (`editCandidates`), and only its verdict publishes —
   * the keyword composer turned programme clips, other countries' wars and
   * launch bases into reports. `DESK_READER_REQUIRED=0` restores the old
   * composer as a fallback, for local work without a key.
   */
  // A post stamped in the future (a wrong clock or a misread date) is dated to
  // this scan instead of floating above the whole feed.
  for (const h of hits) if (Date.parse(h.at) > now + 10 * 60_000) h.at = cycleSeenAt;
  // A video's spoken words join its post before the gate and the reader see it (listen.ts).
  try {
    const heard = await listenToVideos(await getStore(), hits, now);
    if (heard) console.log(`[listen] ${heard} post(s) given their video's words`);
  } catch (err) {
    console.error("[listen] failed:", err instanceof Error ? err.message : err);
  }
  lap("listen");
  const { pre, candidates } = yemenCandidates(hits, status);
  const { verdicts, modelNote } = await editCandidates(await getStore(), candidates, now);
  const floor = process.env.DESK_READER_REQUIRED === "0";
  lap(`reader (${candidates.length} candidates)`);

  const reports: LiveReport[] = [];
  const rawHits: RawScanHit[] = [];
  for (const h of hits) {
    const c = pre.get(h.url) as Composed;
    const v = verdicts.get(h.url);
    let outcome: Outcome = c.outcome;
    let reason = c.reason;
    let note = c.note;
    let kept = false;
    if (v?.kind === "publish") {
      if (isExclusive(h.text, h.source)) v.report.flags = [...new Set([...(v.report.flags ?? []), "exclusive"])];
      reports.push(v.report);
      [outcome, reason, note, kept] = ["feed", "kept", "", true];
    } else if (v?.kind === "reject") {
      [outcome, reason, note] = ["exclude", v.reason, v.note];
    } else if (v?.kind === "pending") {
      [outcome, reason, note] = ["tray", "pending", v.note];
      if (floor && c.report && c.outcome === "feed") {
        reports.push(c.report);
        kept = true;
      }
    }
    rawHits.push({
      source: h.source,
      url: h.url,
      snippet: h.text.replace(/\s+/g, " ").trim().slice(0, 280),
      at: h.at,
      seenAt: cycleSeenAt,
      kind: h.fromTg ? "tg" : "web",
      kept,
      outcome,
      topicality: c.topicality,
      reachable: true,
      reason,
      note,
      tags: c.tags,
    });
  }
  // What the Yemen reader kept is on the Iran desk already when it is about
  // Iran (desk-route.ts); the rest of the Iran items go to the Iran scan.
  try {
    const keptUrls = new Set(rawHits.filter((h) => h.kept).map((h) => h.url));
    const handOver = new Map<string, RawHit>();
    for (const h of iranInbox) if (!keptUrls.has(h.url)) handOver.set(h.url, h);
    if (handOver.size) await (await getStore()).putMany(IRAN_INBOX, { [String(now)]: { hits: [...handOver.values()] } });
  } catch (err) {
    console.error("[iran] inbox:", err instanceof Error ? err.message : err);
  }
  // Items read from the queue — seen in an earlier cycle, read only now.
  for (const [url, v] of verdicts) if (v.kind === "publish" && !pre.has(url)) reports.push(v.report);
  const { uniqReports, touched, combined, combineTried } = await shapeCards({ ...YEMEN_PIPE, hint: (h) => hintOutlets(state, h, now) }, reports, hits, prev, now, floor);
  if (prev && Array.isArray(prev.rawHits)) {
    const haveH = new Set(rawHits.map((h) => linkKey(h.url)));
    for (const h of prev.rawHits) {
      const u = linkKey(String(h.url || ""));
      if (u && !haveH.has(u)) {
        rawHits.push({ ...h, seenAt: h.seenAt || h.at });
        haveH.add(u);
      }
    }
  }
  if (prev && Array.isArray(prev.sourceStatus)) {
    const haveS = new Set(status.map((s) => s.id));
    // Only sources that still exist. Carrying every id forward kept a feed
    // deleted two days earlier on the status page, still advertising the
    // daily 07:00 read it was dropped for failing — the page went on
    // describing a capability the desk no longer had.
    const real = new Set([...TG.map((c) => c.id), ...RSS.map((f) => f.id), ...got.learnedIds]);
    for (const s of prev.sourceStatus) {
      if (s?.id && !haveS.has(s.id) && real.has(s.id)) status.push(s);
    }
  }

  const tried = status.length;
  const skipped = Math.max(0, TG.length + X_ACCOUNTS.length + RSS.length - tried);
  const cycleNote = skipped
    ? `${tried} sources this cycle; ${skipped} on a slower schedule (dailies and agencies).`
    : `All ${tried} sources scanned this cycle.`;
  // Say plainly when the reader could not run: a quiet feed must not look
  // like a quiet war.
  const readerNote = (modelNote ? ` Reader: ${modelNote}.` : "") + (combineTried ? ` Combined ${combined} of ${combineTried} groups into one card each.` : "");

  return {
    ok: true,
    // The scan's start, on the round five minutes the clock runs it at: what
    // the sources said as of then. The reader's work after that is not "newer".
    scannedAt: jerusalemIso(new Date(now)),
    reports: uniqReports.slice(0, PAYLOAD_REPORTS),
    ...(touched.length ? { touched } : {}),
    sourcesTried: tried,
    sourcesOk,
    // Newest-seen first: what the scanner just pulled sits at the top of the box.
    rawHits: rawHits
      .filter((h) => !(now - Date.parse(h.seenAt || h.at) > RAW_HITS_MS))
      .sort((a, b) => Date.parse(b.seenAt || b.at) - Date.parse(a.seenAt || a.at) || Date.parse(b.at) - Date.parse(a.at))
      .slice(0, PAYLOAD_RAW_HITS),
    sourceStatus: status.sort((a, b) => a.name.localeCompare(b.name)),
    cycleNote: cycleNote + readerNote,
    reasons: NOISE_REASONS,
  };
}

/**
 * A desk's cards from its reader's verdicts: the steps every desk shares
 * (user, 8 Oct: "every general rule goes on the Iran desk too"). A relay is
 * traced to its original, which replaces it; copies of one story become one
 * card with "Also"; a card keeps the time it first went out; pictures, video
 * words, follow-ups and later facts are added. `pipe` holds the desk's own keys,
 * so one desk's traces, queue and allowances never mix with another's.
 */
export type DeskPipe = {
  desk: DeskId;
  /** Where an original read in full waits for the desk's reader. */
  queueKey?: string;
  /** The desk's store of relays waiting for their original. */
  originCacheKey?: string;
  /** The writer's prompt when several accounts become one card. */
  combineSystem?: string;
  /** The war, as the picture check is told it. */
  war?: string;
  /** The desk's count of picture looks a day. */
  visionKey?: string;
  /** Outlets a relay named, read early next tick (Yemen's site hints). */
  hint?: (hits: RawHit[]) => void;
  /** The models that write a card from several accounts, and that judge its links. */
  combineModels?: ChainModel[];
  linkModels?: ChainModel[];
  /** The desk's share of the trace's Google searches (Yemen: all of it). */
  traceShare?: number;
};
export const YEMEN_PIPE: DeskPipe = { desk: "yemen" };

export async function shapeCards(
  pipe: DeskPipe,
  reports: LiveReport[],
  hits: RawHit[],
  prev: ScanPayload | null,
  now: number,
  floor = false,
): Promise<{ uniqReports: LiveReport[]; touched: LiveReport[]; combined: number; combineTried: number }> {
  // Every report the reader approved, to account for at the end: each becomes
  // a card, joins one, or waits for its original. One that did none of these
  // is named in the log (the Riyadh schools report vanished with no trace).
  const approved = reports.map((r) => ({ fp: r.fp, url: r.url, source: r.source, summary: r.summary }));
  const heldFps = new Set<string>();
  foldTrail.clear();

  // A relayed report is traced to its original, which then replaces it as the
  // source; `late` are stored reports whose original turned up only now.
  let late: LiveReport[] = [];
  const reread: ReRead[] = [];
  try {
    const held = new Set<string>();
    late = await traceOrigins(await getStore(), reports, new Map(hits.map((h) => [h.url, h.text])), now, reread, {
      held,
      listingOf: siteListing,
      knownHost: readsHost,
      cacheKey: pipe.originCacheKey,
      share: pipe.traceShare,
    });
    // A relay whose original is still being looked for is not published yet.
    for (let i = reports.length - 1; i >= 0; i -= 1) if (held.has(reports[i].fp)) reports.splice(i, 1);
    for (const fp of held) heldFps.add(fp);
    if (held.size) console.log(`[origin] ${held.size} relay(s) held while their original is looked for`);
    // Originals read in full go to the reader next cycle; the card is then
    // rewritten from the original's text under the same fp.
    await queueForReading(await getStore(), reread, now, pipe.queueKey);
  } catch (err) {
    // Untraced reports keep their relay as source; nothing else changes.
    console.error("[origin] trace failed:", err instanceof Error ? err.stack || err.message : err);
  }
  lap("origins");
  pipe.hint?.(hits);
  // An outlet does not open a headline, nor close it ("…, WSJ says"): the
  // source line says who reported it. Only after tracing, which reads the name.
  // Anyone who speaks gets the colon, after every rewrite too (8 Oct: a traced
  // card went out "Trump says …").
  // The speaker named once, by job when not widely known, and on the right side (tidySpeaker).
  for (const r of reports) r.summary = colonSpeaker(tidySpeaker(stripAttribution(r.summary, [r.source, r.citing])));
  // A card written from its original replaces the relay's version of it.
  const fromOriginal = new Set(reports.filter((r) => r.tags?.includes("original")).map((r) => r.fp));
  for (let i = reports.length - 1; i >= 0; i -= 1) {
    if (fromOriginal.has(reports[i].fp) && !reports[i].tags?.includes("original")) {
      foldTrail.set(reports[i].url, "its original's card");
      reports.splice(i, 1);
    }
  }

  /**
   * One CARD per story, but every account kept.
   *
   * The desk used to keep the best-sourced report of a story and delete the
   * rest, which is the opposite of collecting everything in one place. Now the
   * best-sourced account leads the card and the others are attached to it, so
   * a card can say "3 sources" and open them — nothing is discarded for being
   * a second account of the same event.
   */
  const seenUrl = new Set<string>();
  const byStory = new Map<string, { lead: LiveReport; others: LiveReport[] }>();
  reports
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || scoreReport(b) - scoreReport(a))
    .forEach((r) => {
      const u = linkKey(r.url);
      if (seenUrl.has(u) || seenUrl.has(r.fp)) {
        foldTrail.set(r.url, `another report with its ${seenUrl.has(u) ? "link" : "id"} this scan`);
        return;
      }
      seenUrl.add(u);
      seenUrl.add(r.fp);
      // Field events group only as copies of one post: outlets relaying the
      // same event within minutes. A later development on the same front is
      // its own card (the reader may mark it a reply), never folded in.
      // Statements likewise: one speaker's separate lines are separate cards;
      // only two outlets' copies of the same line fold together.
      let sk = storyKey(r);
      const alertRule = sk.includes("|alert|");
      const copyRule = FIELD_TYPES.has(r.type) && !alertRule;
      if (copyRule || alertRule || sk.includes("|stmt|")) {
        const t = Date.parse(r.at);
        const apart = (g: { lead: LiveReport }) => Math.abs(Date.parse(g.lead.at) - t);
        // Same words; or, for a field event, another outlet on the same spot
        // within minutes with no clashing figures; an alert, within its burst.
        // A channel's own posts group only when word for word the same.
        const fits = (g: { lead: LiveReport; others: LiveReport[] }) =>
          [g.lead, ...g.others].every((o) => o.source !== r.source || sameHeadline(o, r)) &&
          (alertRule
            ? apart(g) <= ALERT_BURST_MS
            : copyRule
              ? (apart(g) <= COPY_WINDOW_MS && sameWords(g.lead.summary, r.summary)) ||
                (apart(g) <= GROUND_WINDOW_MS && g.lead.source !== r.source && sameGround(g.lead, r) &&
                  !numbersClash(`${g.lead.summary} ${g.lead.text ?? ""}`, `${r.summary} ${r.text ?? ""}`))
              : sameWords(g.lead.summary, r.summary));
        let n = 0;
        while (byStory.has(`${sk}#${n}`) && !fits(byStory.get(`${sk}#${n}`)!)) n += 1;
        sk = `${sk}#${n}`;
      }
      const group = byStory.get(sk);
      if (!group) {
        byStory.set(sk, { lead: r, others: [] });
      } else if (scoreReport(r) > scoreReport(group.lead)) {
        group.others.push(group.lead);
        group.lead = r;
      } else {
        group.others.push(r);
      }
    });

  // One card per event: the most fitting account leads, a wave of strikes on
  // one area is one card, and the group is written once from every account
  // (combine.ts). The other outlets are "Also", as links only.
  const earlier = new Set((prev?.reports ?? []).map((r) => r.fp));
  const isNew = (r: LiveReport) => !earlier.has(r.fp);
  const { groups, written: combined, tried: combineTried } = await combineGroups(
    planWaves(
      [...byStory.values()].map((g) => pickLead(members(g), leadRank)),
      isNew,
    ),
    async (system, user) => (await askChain("combine", system, user, { temperature: 0.1, timeoutMs: 15_000, models: pipe.combineModels ?? COMBINE_MODELS }))?.json ?? null,
    leadRank,
    await getStore(),
    isNew,
    pipe.combineSystem,
  );
  lap("combine");
  for (const { lead, others } of groups) {
    if (!others.length) continue;
    // Distinct outlets only: three posts from one channel is one account.
    const outlets = new Map<string, { source: string; url: string }>();
    for (const o of others) if (o.source !== lead.source && o.citing !== lead.source) outlets.set(o.source, { source: o.source, url: o.url });
    // An exclusive leads with no "Also" (user, 8 Oct): 9 Oct's Middle East Eye card carried BBC.
    if (isOriginal(lead) || isExclusiveCard(lead)) outlets.clear();
    if (outlets.size) {
      lead.alsoReportedBy = [...outlets.values()].slice(0, 6);
    }
    // Corroboration moves the trust figure — counted by side inside
    // `credibility`, so five channels of one side count once.
    if (lead.side) {
      const sides = others.filter((o) => o.source !== lead.source).map((o) => o.side ?? "neutral");
      lead.confidence = confidenceOf(lead, sides);
    }
  }
  const uniqReports = groups.map((g) => g.lead).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // Carry forward what earlier cycles found, so a quiet cycle does not empty the desk.
  if (prev && Array.isArray(prev.reports)) {
    const have = new Set(uniqReports.map((r) => linkKey(r.url)));
    // By fp too: a report traced to its original has a new url, and its stale
    // relay copy must not ride along beside it.
    const haveFp = new Set(uniqReports.map((r) => r.fp));
    for (const r of prev.reports) {
      // Only reports the reader wrote are carried forward; the keyword
      // composer's output is not re-published.
      if (!r.side && !floor) continue;
      const u = linkKey(String(r.url || ""));
      if (!u || have.has(u) || haveFp.has(r.fp)) continue;
      uniqReports.push(r);
      have.add(u);
      haveFp.add(r.fp);
    }
    uniqReports.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  // Originals found late replace the relay copy the payload carries; saving
  // them lets the store move the stored row to the original too.
  for (const r of late) {
    const i = uniqReports.findIndex((x) => x.fp === r.fp);
    if (i >= 0) uniqReports[i] = r;
    else uniqReports.push(r);
  }
  const published = new Set((prev?.reports ?? []).map((r) => r.fp));
  const stored = await storedCards(pipe.desk);
  // A card already on the desk is not new again: it keeps the time it went
  // out with, and is no new card (an undated site article seen again).
  {
    const first = new Map<string, string>();
    for (const r of [...stored, ...(prev?.reports ?? [])]) {
      const f = first.get(r.fp);
      // Stored rows read back in UTC; the payload writes Jerusalem time.
      if (Number.isFinite(Date.parse(r.at)) && (!f || Date.parse(r.at) < Date.parse(f))) first.set(r.fp, jerusalemIso(new Date(r.at)));
    }
    try {
      const ask = uniqReports.filter((r) => !first.has(r.fp)).map((r) => r.fp);
      const store = await getStore();
      const db = ask.length && store.timesOf ? await store.timesOf(ask) : {};
      for (const [fp, at] of Object.entries(db)) {
        first.set(fp, jerusalemIso(new Date(at)));
        published.add(fp);
      }
    } catch (err) {
      console.error("[scan] stored times:", err instanceof Error ? err.message : err);
    }
    const back = keepFirstTimes(uniqReports, first);
    if (back) {
      console.log(`[scan] ${back} card(s) already on the desk kept their first time`);
      uniqReports.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    }
  }
  // A Telegram reply to a card on the desk is the same thread: it follows that card.
  const byUrl = new Map([...stored, ...uniqReports].map((r) => [r.url, r]));
  for (const h of hits) {
    const r = h.replyUrl ? uniqReports.find((x) => x.url === h.url) : undefined;
    const to = h.replyUrl ? byUrl.get(h.replyUrl) : undefined;
    if (r && to && to.fp !== r.fp && !r.replyTo && Date.parse(to.at) <= Date.parse(r.at)) r.replyTo = to.fp;
  }
  const newCards = uniqReports.filter((r) => !published.has(r.fp));
  // A new card from a post with a picture or video that shows the event
  // carries it (media.ts): a merged card takes the first of its accounts'.
  try {
    const mediaByUrl = new Map(hits.filter((h) => h.media).map((h) => [h.url, { media: h.media as Media, postText: h.text }]));
    if (mediaByUrl.size) {
      const used = new Set([...stored, ...uniqReports].map((r) => r.media?.thumb).filter((t): t is string => !!t));
      const cands = newCards.flatMap((r) => {
        const own = mediaByUrl.get(r.url) ?? (r.alsoReportedBy ?? []).map((a) => mediaByUrl.get(a.url)).find(Boolean);
        return own && !r.media ? [{ r, ...own }] : [];
      });
      const given = await attachMedia(await getStore(), cands, used, new Date(), pipe.war, pipe.visionKey);
      if (given) console.log(`[media] ${given} card(s) given a picture or video`);
    }
  } catch (err) {
    console.error("[media] failed:", err instanceof Error ? err.message : err);
  }
  // "Footage shows …" with no footage to show tells the reader of a video he
  // cannot see: such a new card goes out with its media or not at all.
  for (const r of newCards.filter((x) => aboutFootage(x) && !x.media)) {
    console.log(`[media] dropped, footage not shown: ${r.summary}`);
    uniqReports.splice(uniqReports.indexOf(r), 1);
    newCards.splice(newCards.indexOf(r), 1);
  }
  lap("media");
  linkFollowUps(newCards, [...stored, ...uniqReports]);
  const enrich: [LiveReport, LiveReport][] = [];
  const touched = [...foldIntoPublished(uniqReports, published, stored, enrich), ...threadSpeeches(uniqReports, published, stored)];
  // A later outlet on a published event added a figure or a place: the card
  // is written again with it, rather than the new fact sitting under "Also".
  if (enrich.length) {
    try {
      const rewritten = await enrichCards(
        enrich,
        async (system, user) => (await askChain("combine", system, user, { temperature: 0.1, timeoutMs: 15_000, models: pipe.combineModels ?? COMBINE_MODELS }))?.json ?? null,
        await getStore(),
        pipe.combineSystem,
      );
      for (const h of rewritten) if (!touched.includes(h) && !uniqReports.includes(h)) touched.push(h);
      if (rewritten.length) console.log(`[fold] ${rewritten.length} card(s) written again with a later account's facts`);
    } catch (err) {
      console.error("[fold] enrich failed:", err instanceof Error ? err.message : err);
    }
  }
  {
    const placed = new Set(uniqReports.flatMap((r) => [r.fp, r.url]));
    const also = new Set([...uniqReports, ...touched].flatMap((r) => (r.alsoReportedBy ?? []).map((a) => a.url)));
    for (const g of groups) for (const o of g.others) also.add(o.url);
    for (const a of approved) {
      if (placed.has(a.fp) || placed.has(a.url) || heldFps.has(a.fp) || also.has(a.url) || published.has(a.fp)) continue;
      const into = foldTrail.get(a.url) ?? foldTrail.get(a.fp);
      console.log(`[scan] approved but no card: ${a.source} ${a.url} — ${a.summary}${into ? ` (folded into ${into})` : ""}`);
    }
  }
  // Every link, whatever made it, passes the rules of links.ts; then one
  // model call picks, among the cards the rules allow, the one each new card
  // develops — or none — which also finds the links nobody made.
  checkLinks([...uniqReports, ...touched], [...stored, ...uniqReports]);
  try {
    const judged = await judgeLinks(
      newCards.filter((r) => uniqReports.includes(r)),
      [...stored, ...uniqReports],
      async (system, user) => (await askChain("links", system, user, { temperature: 0, models: pipe.linkModels ?? TRIAGE_MODELS.slice(0, 2), timeoutMs: 12_000 }))?.json ?? null,
    );
    if (judged.length) console.log(`[links] judge changed ${judged.length} link(s)`);
  } catch (err) {
    console.error("[links] judge failed:", err instanceof Error ? err.message : err);
  }
  lap("links");
  return { uniqReports, touched, combined, combineTried };
}

/* ------------------------------------------------------------------ *
 * Reading, and running a cycle
 *
 * These are deliberately separate. Serving a page READS; only the tick
 * SCANS. Previously a page view could trigger a scan, which meant the desk
 * only advanced while someone was watching it — and on a read-only host the
 * results were thrown away afterwards.
 * ------------------------------------------------------------------ */

const EMPTY_PAYLOAD: ScanPayload = {
  ok: true,
  scannedAt: "",
  reports: [],
  sourcesTried: 0,
  sourcesOk: 0,
  rawHits: [],
  sourceStatus: [],
  cycleNote: "The desk has not completed a scan yet.",
  reasons: NOISE_REASONS,
};

/**
 * What the desk currently holds. Pure read — never fetches a source.
 * Returns an empty payload (not an error) before the first tick, so the page
 * renders its curated snapshot rather than an error state.
 */
export async function scanYemenSources(): Promise<ScanPayload> {
  try {
    const store = await getStore();
    return (await store.loadPayload()) ?? EMPTY_PAYLOAD;
  } catch {
    return EMPTY_PAYLOAD;
  }
}

export type TickResult = {
  ok: boolean;
  scannedAt: string;
  sourcesTried: number;
  sourcesOk: number;
  reportsInPayload: number;
  reportsAdded: number;
  eventsAdded: number;
  unplaced: { fp: string; summary: string; place?: string }[];
  store: string;
  cycleNote?: string;
  /** True when this tick closed a 6-hour window and composed its brief. */
  briefBuilt?: boolean;
  usage?: TickUsage;
  error?: string;
};

/**
 * One scan cycle: fetch every due source, compose, persist, report honestly.
 *
 * This is the only thing that scans. It is idempotent with respect to cadence
 * — calling it more often than the schedule simply finds fewer sources due —
 * so an over-eager clock costs nothing.
 */
/**
 * Node 24's fetch (undici) now and then throws an assertion from a socket that
 * closes while its response is paused — about one tick in ten, measured locally,
 * on no one request. Uncaught, it ended the whole tick. That one error is logged
 * and let go: the request it belonged to still ends at its own timeout. Every
 * other uncaught error ends the process as before.
 */
let undiciGuard = false;
function guardUndici(): void {
  if (undiciGuard || typeof process === "undefined" || typeof process.on !== "function") return;
  undiciGuard = true;
  process.on("uncaughtException", (err: Error & { code?: string }) => {
    if (err?.code === "ERR_ASSERTION" && /undici/.test(err.stack ?? "")) {
      console.error("[tick] undici assertion let go:", err.message.slice(0, 80));
      return;
    }
    throw err;
  });
}

/** The cards as the rating reads them, from the store's rows. */
function ratedCards(rows: Record<string, unknown>[]): RatedCard[] {
  return rows.map((r) => ({
    fp: String(r.fp),
    at: String(r.at),
    source: String(r.source ?? ""),
    type: typeof r.type === "string" ? r.type : undefined,
    summary: typeof r.summary === "string" ? r.summary : undefined,
    ...(typeof r.lat === "number" && typeof r.lng === "number" ? { lat: r.lat, lng: r.lng } : {}),
    also: Array.isArray(r.alsoReportedBy) ? (r.alsoReportedBy as { source: string; url?: string }[]) : [],
  }));
}

/**
 * Once a day: first the lone reports a later card may have borne out (a
 * model says whether the two tell one event), then every source rated. Both
 * stored; nothing about why a report counted against a source is shown.
 */
export async function refreshSourceRatings(store: Awaited<ReturnType<typeof getStore>>, now = new Date()): Promise<boolean> {
  const stored = await store.getJson<SourceRatings>(RATINGS_KEY);
  if (!ratingsDue(stored, now)) return false;
  const slice = await store.recentDesk(8000, undefined, { events: false });
  const cards = ratedCards(slice.reports);
  const catalogue = sourceCatalogue(await loadLearned(store));
  const leanOf = new Map(catalogue.map((c) => [c.name.toLowerCase(), c.lean]));
  const own = (await store.getJson<Verdicts>(VERDICTS_KEY)) ?? {};
  const checked = (await store.getJson<Record<string, string>>(LATER_CHECKED_KEY)) ?? {};
  const pairs = laterCandidates(cards, (n) => leanOf.get(n.toLowerCase()), withSeed(own), now.getTime(), checked);
  if (pairs.length) {
    const list = pairs.map((p, i) => `${i + 1}. A (${p.early.at.slice(0, 16)}, ${p.early.source}): ${p.early.summary}\n   B (${p.later.at.slice(0, 16)}, ${tellers(p.later).join(", ")}): ${p.later.summary}`).join("\n");
    const res = await askChain(
      "source-ratings",
      'Each pair is two news headlines. Say for each whether B reports the very same event as A (same place, same kind of event, same day or B following it up), not merely a similar one. Answer JSON: {"same":[true|false, ...]} in the order given.',
      list,
      { models: COMBINE_MODELS, temperature: 0 },
    );
    const same = Array.isArray(res?.json.same) ? (res.json.same as unknown[]) : [];
    let added = 0;
    pairs.forEach((p, i) => {
      if (same[i] !== true) return;
      own[p.early.fp] = { verdict: "confirmed-later", reason: "a later report from outside its side told the same event", at: now.toISOString(), by: p.later.fp };
      added++;
    });
    if (added) await store.putJson(VERDICTS_KEY, own);
    if (res) {
      for (const p of pairs) checked[p.early.fp] = now.toISOString();
      for (const [fp, at] of Object.entries(checked)) if (now.getTime() - Date.parse(at) > 40 * 86_400_000) delete checked[fp];
      await store.putJson(LATER_CHECKED_KEY, checked);
    }
    console.log(`[source-ratings] ${pairs.length} lone reports checked against later ones, ${added} borne out`);
  }
  const sources = rateSources(cards, catalogue, withSeed(own), now.getTime());
  // Stamped with the hour it is due, 00:00 Israel, though the tick runs it a few minutes after.
  const { day, startedAt } = deskDay(now.getTime());
  const made: SourceRatings = { day, updatedAt: new Date(startedAt).toISOString(), sources };
  await store.putJson(RATINGS_KEY, made);
  useRatings(made, now.getTime());
  console.log(`[source-ratings] ${sources.length} sources rated`);
  return true;
}

/** The last ticks' database traffic and CPU, for the status page. */
export const TICK_USAGE_KEY = "tick-usage";
export type TickUsage = { at: string; tookMs: number; cpuMs: number; dbReadKB: number; dbWrittenKB: number; queries: number };

export async function runScanCycle(scan: (state: ScanState, prev: ScanPayload | null) => Promise<ScanPayload> = scanOnce): Promise<TickResult> {
  guardUndici();
  resetDbMeter();
  const started = Date.now();
  const cpu0 = typeof process !== "undefined" && process.cpuUsage ? process.cpuUsage() : null;
  const store = await getStore();
  const state = await store.loadScanState();
  const prev = await store.loadPayload();
  await primeRatings(store).catch(() => {});

  const payload = await scan(state, prev);
  // Which desks each card is shown on (Round 30): one read, every desk it concerns.
  for (const r of [...payload.reports, ...(payload.touched ?? [])]) r.desks = desksOf(r);
  // Iran's war alone is the Iran desk's reader's: not kept here at all.
  payload.reports = payload.reports.filter((r) => r.desks?.length);
  // A post the Iran desk's reader wrote up first: this card joins that one (store.pg.ts).
  try {
    const iran = await store.getJson<{ reports?: { url: string }[] }>(IRAN_PAYLOAD);
    const urls = new Set((iran?.reports ?? []).map((r) => r.url));
    for (const r of [...payload.reports, ...(payload.touched ?? [])]) if (urls.has(r.url) && !r.tags?.includes("iran-url")) r.tags = [...(r.tags ?? []), "iran-url"];
  } catch {
    // Unread, a shared post stays on the desk that stored it first.
  }

  // Persist in dependency order, and surface every failure. The old code
  // fire-and-forgot this and swallowed the error, which is why a read-only
  // host looked healthy while saving nothing.
  const merge = await store.mergeIntoDesk([...payload.reports, ...(payload.touched ?? [])]);
  delete payload.touched;
  lap("save cards");
  // Carry the gazetteer misses into the payload so the scan box can show them.
  if (merge.unplaced.length) payload.unplaced = merge.unplaced.slice(0, 20);
  state.lastTickAt = Date.now();
  await store.saveScanState(state);

  let error = merge.error;
  try {
    await store.savePayload(payload);
  } catch (err) {
    error = err instanceof Error ? err.message : "payload write failed";
  }

  // The brief moves on the clock, not on page views: a no-op until a 6-hour
  // window closes, then composed from everything the desk logged in it.
  let briefBuilt = false;
  try {
    briefBuilt = (await refreshBrief(store, new Date(), { retryProse: true })).built;
  } catch (err) {
    error ??= `brief: ${err instanceof Error ? err.message : "failed"}`;
  }

  lap("save + brief");
  // The first tick of each day snapshots the live tables; a failed backup
  // must not fail the scan, so it is logged, not surfaced.
  if (store.kind === "pg") {
    try {
      await backupDaily();
    } catch (err) {
      console.error("[desk] daily backup failed:", err instanceof Error ? err.message : err);
    }
  }

  lap("backup");
  // Once a day, each source's rating from its record (source-rating.ts).
  try {
    await refreshSourceRatings(store);
  } catch (err) {
    console.error("[desk] source ratings failed:", err instanceof Error ? err.message : err);
  }
  // What this tick cost: Supabase bills egress, Vercel bills CPU.
  const cpu = cpu0 ? process.cpuUsage(cpu0) : null;
  const usage: TickUsage = {
    at: new Date().toISOString(),
    tookMs: Date.now() - started,
    cpuMs: cpu ? Math.round((cpu.user + cpu.system) / 1000) : 0,
    dbReadKB: Math.round(dbMeter.read / 1024),
    dbWrittenKB: Math.round(dbMeter.written / 1024),
    queries: dbMeter.queries,
  };
  try {
    const log = (await store.getJson<TickUsage[]>(TICK_USAGE_KEY)) ?? [];
    await store.putJson(TICK_USAGE_KEY, [usage, ...log].slice(0, 48));
  } catch {
    /* the meter must never cost the tick */
  }

  return {
    ok: !error,
    usage,
    scannedAt: payload.scannedAt,
    sourcesTried: payload.sourcesTried,
    sourcesOk: payload.sourcesOk,
    reportsInPayload: payload.reports.length,
    reportsAdded: merge.reportsAdded,
    eventsAdded: merge.eventsAdded,
    unplaced: merge.unplaced,
    store: store.kind,
    cycleNote: payload.cycleNote,
    briefBuilt,
    ...(error ? { error } : {}),
  };
}

export const SCAN_SOURCE_COUNT = TG.length + RSS.length;
export { digest };

/** A source's filter group on the Iran desk, by its published name (iran-sources.ts). */
export function iranLeanOfSource(name: string): IranLean {
  const own = iranLeanOf(name);
  if (own) return own;
  const tg = TG.find((c) => c.name === name);
  if (tg && SHARED_TG[tg.id]) return SHARED_TG[tg.id];
  const x = X_ACCOUNTS.find((a) => a.name === name);
  if (x && SHARED_X[x.handle]) return SHARED_X[x.handle];
  // A Yemen desk source the Iran list does not name: its Yemen side decides
  // (the Houthis' outlets are Axis-aligned, the government's and Saudi's Gulf).
  const side = outletSide(name, tg?.lean ?? x?.lean ?? "");
  return side === "houthi" ? "axis" : side === "gov" ? "gulf" : "intl";
}

/** A catalogue outlet's declared lean, by its published name ("" if unknown). */
export function sourceLean(name: string): string {
  return TG.find((c) => c.name === name)?.lean ?? "";
}

/** Headlines whose speakers are two different known figures. */
function otherFigure(a: string, b: string): boolean {
  const x = leadSpeaker(a);
  const y = leadSpeaker(b);
  return !!x && !!y && x.name !== y.name;
}

/**
 * A report told again in the words of one of the card's "Also" lines: Khabari
 * Plus's "US Army lost 81 aircraft…" at 23:15 matched Al Jazeera's line on the
 * 13:34 card, not the card's own headline (8 Oct).
 */
function retoldInAlso(home: LiveReport, r: LiveReport): boolean {
  return (home.alsoReportedBy ?? []).some((a) => !!a.summary && sameStory({ summary: a.summary }, { summary: r.summary }));
}

/** A card the reader marked as its outlet's own exclusive. */
export function isExclusiveCard(r: LiveReport): boolean {
  return !!r.flags?.includes("exclusive") || !!r.tags?.includes("exclusive");
}
