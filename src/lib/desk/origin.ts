/**
 * Following a report back to where it was first published. Server-only.
 *
 * Channels relay: "according to the New York Times ...", "the Saudi Defense
 * Ministry said ...", "British media report ...". When a post names where its
 * news came from, the desk looks for that original, reads it in full, and the
 * card is written from it: the original REPLACES the relaying post as the
 * report's source, link and text. When it cannot be found yet, the card
 * credits the relay "citing" the original, and the search is retried hourly
 * for a day.
 *
 * Any outlet, not a list of them. `CITABLE` is only a shortcut for the names
 * the channels use most, and the Arabic spellings of them. A name the desk has
 * never met — "Italian newspaper La Repubblica", "US officials told NBC News" —
 * is taken from the reader's English copy and looked up on Google News, whose
 * items carry each outlet's own site: the site is learned, kept in the outlet
 * registry, and searched like any known one. A name Google does not know as an
 * outlet (a person: "Rubio: ...") is remembered as not one, so it costs one
 * search, once. An unnamed citation ("British media") is searched across that
 * country's outlets.
 *
 * Code finds the citation and checks the match; no model call is spent.
 */

import { BROWSER_UA, type Edition, type GnewsItem, resolveCount, resolveGoogleNews, resolverResting, searchCount, searchGoogleNews } from "./gnews.ts";
import { FULL_TEXT_MAX } from "./reader.ts";
import type { DeskStore } from "./store.ts";
import type { LiveReport } from "./types.ts";
import type { Listed } from "./sitemap.ts";
import { ownCarrier, speakerOf } from "./speakers.ts";
import {
  type Hit,
  ISRAELI_HOST,
  type Learned,
  LEARNED_KEY,
  SPEAKER_PRESS,
  WIRE_SITES,
  learnSource,
  loadLearned,
  ownCandidates,
  searchSpeaker,
  speakerNamed,
  translateKeys,
  whichCarries,
} from "./originals.ts";

export type Cited = {
  name: string;
  /** The outlet's or body's own site; "" when not known (an outlet Google does not list). */
  site: string;
  lang: "en" | "ar";
  /** A group is an unnamed citation, "British media": any of `sites`. */
  kind: "outlet" | "official" | "group";
  /** Home country: its outlets carry an official's words when his own site has none. */
  country?: string;
  sites?: string[];
  /** A wire: a paper carrying it under its byline is the wire's own text. */
  wire?: boolean;
  /** Said TO the outlet (an interview): the network's site first, then its country's outlets. */
  told?: boolean;
  /** A foreign leader's words (speakers.ts): looked for as he said them, in his language. */
  speaker?: string;
};

/** Each country's main outlets: where "British media" or "a US official" is looked for. */
export const COUNTRY_SITES: Record<string, string[]> = {
  US: ["nytimes.com", "wsj.com", "washingtonpost.com", "apnews.com", "reuters.com", "cnn.com", "nbcnews.com", "cbsnews.com", "abcnews.go.com", "foxnews.com", "axios.com", "politico.com", "bloomberg.com"],
  UK: ["ft.com", "theguardian.com", "thetimes.com", "telegraph.co.uk", "bbc.com", "economist.com", "independent.co.uk", "news.sky.com"],
  IR: ["tasnimnews.ir", "presstv.ir", "irna.ir", "mehrnews.com", "farsnews.ir", "javanonline.ir", "kayhan.ir"],
  IT: ["repubblica.it", "corriere.it", "ansa.it", "lastampa.it", "ilsole24ore.com"],
  FR: ["lemonde.fr", "lefigaro.fr", "france24.com", "liberation.fr", "lesechos.fr"],
  DE: ["spiegel.de", "faz.net", "sueddeutsche.de", "dw.com", "zeit.de"],
};
COUNTRY_SITES.West = [...COUNTRY_SITES.US.slice(0, 8), ...COUNTRY_SITES.UK.slice(0, 5), "lemonde.fr", "spiegel.de"];
const COUNTRY_EDITION: Record<string, Edition> = { US: "en", UK: "gb", IR: "en", IT: "it", FR: "fr", DE: "de", West: "en" };

const O = (name: string, site: string, country: string, extra: Partial<Cited> = {}): Cited => ({ name, site, lang: "en", kind: "outlet", country, ...extra });
const B = (name: string, site: string, country = "", extra: Partial<Cited> = {}): Cited => ({ name, site, lang: "en", kind: "official", country, ...extra });

/**
 * Names the channels use most, with their Arabic spellings. A shortcut, not
 * the limit: any other name is found through the registry (see top).
 * Official bodies publish through their own sites; the Saudi Defense Ministry
 * and the coalition publish through SPA.
 */
const CITABLE: [RegExp, Cited][] = [
  [/نيويورك تايمز|New York Times|\bNYT\b/i, O("NYT", "nytimes.com", "US")],
  [/وول ستريت جورنال|Wall Street Journal|\bWSJ\b/i, O("WSJ", "wsj.com", "US")],
  [/واشنطن بوست|Washington Post/i, O("Washington Post", "washingtonpost.com", "US")],
  [/رويترز|Reuters/i, O("Reuters", "reuters.com", "US", { wire: true })],
  [/أسوشيتد برس|اسوشيتد برس|Associated Press|\bAP\b/, O("AP", "apnews.com", "US", { wire: true })],
  [/أكسيوس|اكسيوس|Axios/i, O("Axios", "axios.com", "US")],
  [/بلومبرغ|بلومبيرغ|Bloomberg/i, O("Bloomberg", "bloomberg.com", "US", { wire: true })],
  [/فاينانشال تايمز|فايننشال تايمز|Financial Times/i, O("Financial Times", "ft.com", "UK")],
  [/الغارديان|Guardian/i, O("The Guardian", "theguardian.com", "UK")],
  [/بوليتيكو|Politico/i, O("Politico", "politico.com", "US")],
  [/سي إن إن|سي ان ان|\bCNN\b/i, O("CNN", "cnn.com", "US")],
  [/فوكس نيوز|Fox News/i, O("Fox News", "foxnews.com", "US")],
  [/إن بي سي|ان بي سي|\bNBC\b/i, O("NBC News", "nbcnews.com", "US")],
  [/سي بي إس|سي بي اس|\bCBS\b/i, O("CBS News", "cbsnews.com", "US")],
  [/إيه بي سي|اي بي سي|\bABC News\b/i, O("ABC News", "abcnews.go.com", "US")],
  [/نيوزويك|Newsweek/i, O("Newsweek", "newsweek.com", "US")],
  [/سيمافور|Semafor/i, O("Semafor", "semafor.com", "US")],
  [/المونيتور|Al-Monitor/i, O("Al-Monitor", "al-monitor.com", "US")],
  [/(?<!نيويورك |فاينانشال |فايننشال )التايمز|(?<!New York |Financial )\bThe Times\b(?! of)/, O("The Times", "thetimes.com", "UK")],
  [/التلغراف|تلغراف|Telegraph/i, O("The Telegraph", "telegraph.co.uk", "UK")],
  [/الإيكونوميست|إيكونوميست|Economist/i, O("The Economist", "economist.com", "UK")],
  [/الإندبندنت(?! عربية)|اندبندنت(?! عربية)|Independent(?! Arabia)/, O("The Independent", "independent.co.uk", "UK")],
  // Sky News Arabia is Emirati and its own outlet; Sky News is British.
  [/سكاي نيوز(?! عربية)|Sky News(?! Arabia)/i, O("Sky News", "news.sky.com", "UK")],
  [/لويدز ليست|Lloyd'?s List/i, O("Lloyd's List", "lloydslist.com", "UK")],
  // One of the desk's own sites, spelled as the relays spell it ("Shaba Intelligence").
  [/شي?با\s*(?:إنتليجنس|انتليجنس|للاستخبارات)|Sh[ae]ba\s+Intelligence/i, O("Sheba Intelligence", "shebaintelligence.uk", "UK")],
  [/تريد ?ويندز|TradeWinds/i, O("TradeWinds", "tradewindsnews.com", "UK")],
  [/لاريبوبليكا|لا ريبوبليكا|ريبوبليكا|Repubblica/i, O("La Repubblica", "repubblica.it", "IT")],
  [/كورييري ديلا سيرا|كورييري|Corriere/i, O("Corriere della Sera", "corriere.it", "IT")],
  [/لوموند|لو موند|Le Monde/i, O("Le Monde", "lemonde.fr", "FR")],
  [/لوفيغارو|لو فيغارو|Le Figaro/i, O("Le Figaro", "lefigaro.fr", "FR")],
  [/دير شبيغل|شبيغل|Spiegel/i, O("Der Spiegel", "spiegel.de", "DE")],
  [/وكالة تسنيم|Tasnim/i, O("Tasnim", "tasnimnews.ir", "IR")],
  [/وكالة فارس|Fars News/i, O("Fars", "farsnews.ir", "IR")],
  [/(?:وكالة )?إرنا|\bIRNA\b/i, O("IRNA", "irna.ir", "IR")],
  [/وكالة مهر|Mehr News/i, O("Mehr", "mehrnews.com", "IR")],
  [/جوان أونلاين|جوان اونلاين|صحيفة جوان|Javan/i, O("Javan", "javanonline.ir", "IR")],
  [/برس تي في|Press TV/i, O("Press TV", "presstv.ir", "IR")],
  [/كيهان|Kayhan/i, O("Kayhan", "kayhan.ir", "IR")],
  [/قناة الميادين|الميادين نت|Al Mayadeen/i, O("Al Mayadeen", "almayadeen.net", "LB", { lang: "ar" })],
  [/القدس العربي|Al-Quds Al-Arabi/i, O("Al-Quds Al-Arabi", "alquds.co.uk", "UK", { lang: "ar" })],
  [/رأي اليوم|Rai Al-Youm/i, O("Rai Al-Youm", "raialyoum.com", "UK", { lang: "ar" })],
  [/ذا ناشيونال|The National\b/, O("The National", "thenationalnews.com", "AE")],
  // Bare "الشرق الأوسط" is "the Middle East"; only the paper counts.
  [/صحيفة\s+"?الشرق الأوسط|Asharq Al-Awsat/i, O("Asharq Al-Awsat", "aawsat.com", "SA", { lang: "ar" })],
  [/الأخبار اللبنانية|صحيفة الأخبار|Al-Akhbar/i, O("Al-Akhbar", "al-akhbar.com", "LB", { lang: "ar" })],
  [/وزارة الدفاع السعودية|الدفاع السعودية|Saudi (?:Defen[cs]e|defen[cs]e) Ministry|Saudi Ministry of Defen[cs]e/i, B("Saudi Defense Ministry", "spa.gov.sa", "SA")],
  [/المتحدث (?:الرسمي )?باسم (?:قوات )?التحالف|تحالف دعم الشرعية|coalition spokesman/i, B("Coalition (SPA)", "spa.gov.sa", "SA")],
  [/الخارجية السعودية|Saudi (?:Foreign Ministry|Ministry of Foreign Affairs)/i, B("Saudi Foreign Ministry", "spa.gov.sa", "SA")],
  [/وكالة الأنباء السعودية|\(واس\)|\bواس\b|Saudi Press Agency/i, B("SPA", "spa.gov.sa", "SA")],
  [/الخارجية الإماراتية|UAE (?:Foreign Ministry|Ministry of Foreign Affairs)/i, B("UAE Foreign Ministry", "wam.ae", "AE")],
  [/الخارجية العمانية|Omani? (?:Foreign Ministry|Ministry of Foreign Affairs)/i, B("Oman Foreign Ministry", "omannews.gov.om", "OM")],
  [/الخارجية الإيرانية|Iranian? (?:Foreign Ministry|Ministry of Foreign Affairs)/i, B("Iran Foreign Ministry", "irna.ir", "IR")],
  [/الخارجية الباكستانية|Pakistani? (?:Foreign Office|Foreign Ministry)/i, B("Pakistan Foreign Office", "mofa.gov.pk", "PK")],
  [/سنتكوم|القيادة المركزية الأمريكية|CENTCOM|Central Command/i, B("CENTCOM", "centcom.mil", "US")],
  [/الخارجية الأمريكية|الخارجية الأميركية|State Department/i, B("State Department", "state.gov", "US")],
  [/المبعوث الأممي|غروندبرغ|UN envoy|Grundberg/i, B("UN envoy's office", "osesgy.unmissions.org")],
  [/مجلس الأمن الدولي|Security Council/i, B("UN Security Council", "press.un.org")],
  [/عمليات التجارة البحرية البريطانية|\bUKMTO\b/i, B("UKMTO", "ukmto.org", "UK")],
  [/وزارة الدفاع البريطانية|\bUK (?:Defen[cs]e Ministry|Ministry of Defen[cs]e)\b|\bMoD\b/, B("UK Ministry of Defence", "gov.uk", "UK")],
  [/الاتحاد الأوروبي|\bEEAS\b|European Union/i, B("EU", "eeas.europa.eu")],
  // Wires and broadcasters the channels relay by name.
  [/فرانس برس|وكالة الصحافة الفرنسية|\bAFP\b|Agence France[- ]Presse/i, O("AFP", "afp.com", "FR", { wire: true })],
  [/بي بي سي|\bBBC\b/i, O("BBC", "bbc.com", "UK")],
  [/الأناضول|أناضول|Anadolu/i, O("Anadolu", "aa.com.tr", "TR", { wire: true })],
  [/تي آر تي|\bTRT\b/i, O("TRT", "trt.net.tr", "TR")],
  [/الجزيرة نت|موقع الجزيرة|Al Jazeera Net/i, O("Al Jazeera", "aljazeera.net", "QA", { lang: "ar" })],
  [/ميدل إيست آي|Middle East Eye/i, O("Middle East Eye", "middleeasteye.net", "UK")],
  [/العربي الجديد/, O("Al-Araby Al-Jadeed", "alaraby.co.uk", "UK", { lang: "ar" })],
  // The UN bodies that publish the displacement, hunger and casualty figures
  // the desk keeps being asked to carry. Each publishes its own release; a
  // channel quoting "the UNHCR said" is quoting a document with a URL.
  [/المفوضية السامية للأمم المتحدة لشؤون اللاجئين|مفوضية (?:الأمم المتحدة )?(?:السامية )?لشؤون اللاجئين|\bUNHCR\b/i, B("UNHCR", "unhcr.org")],
  [/مكتب تنسيق الشؤون الإنسانية|أوتشا|\bOCHA\b/i, B("UN OCHA", "unocha.org")],
  [/برنامج الأغذية العالمي|\bWFP\b|World Food Programme/i, B("WFP", "wfp.org")],
  [/منظمة الصحة العالمية|World Health Organization|\bWHO\b/, B("WHO", "who.int")],
  [/اليونيسف|\bUNICEF\b/i, B("UNICEF", "unicef.org")],
  [/المنظمة البحرية الدولية|\bIMO\b/, B("IMO", "imo.org")],
  // Governments whose statements arrive through whoever saw them first.
  [/الخارجية البريطانية|وزارة الخارجية البريطانية|Foreign(?:,| and) Commonwealth|\bFCDO\b|British Foreign Office/i, B("UK Foreign Office", "gov.uk", "UK")],
  [/البنتاغون|وزارة الدفاع الأمريكية|Pentagon|\bDoD\b/i, B("Pentagon", "defense.gov", "US")],
  [/البيت الأبيض|White House/i, B("White House", "whitehouse.gov", "US")],
];

/**
 * Israeli outlets are never a source of the desk's, so a report citing one is
 * not traced to it.
 */
const ISRAELI = /إسرائيل|عبرية|يديعوت|هآرتس|معاريف|القناة (?:12|13|14|الثانية عشرة)|Israel|Hebrew|Haaretz|Yedioth|Ynet|Maariv|Jerusalem Post|Times of Israel|i24|Channel (?:12|13|14)\b|\bKan\b/i;

/** A citation marker: the name must be what the post is relaying, not a subject. */
const RELAY = /(?:نقلا عن|نقلاً عن|وفقا ل|وفقاً ل|بحسب|حسب|عن|قالت|ذكرت|أفادت|أعلنت|كشفت|أكدت|:|according to|citing|told|tells?|said|reported|reports)/i;

/**
 * How much of a website article a citation may come from. A post is its own
 * short text; an article's own reporting runs past its lead, and a Reuters
 * story that mentions the FT in its eighth paragraph is not relaying the FT.
 */
const LEAD_CHARS = 400;
const isPost = (url: string) => /^https:\/\/t\.me\//.test(url) || !url;

/** An unnamed citation: "British media", "وسائل إعلام أمريكية", "a US newspaper". */
const GROUP_AR =
  /(?:وسائل (?:ال)?إعلام|صحف|صحيفة|مواقع|موقع|وكالات|وكالة|قنوات|قناة|مجلة|تقارير|مصادر إعلامية)\s+(بريطانية|أمريكية|أميركية|غربية|إيرانية|إيطالية|فرنسية|ألمانية)/;
const GROUP_EN =
  /\b(British|UK|U\.?S\.?|American|Western|Iranian|Italian|French|German)\s+(?:media|press|newspapers?|papers?|outlets?|dail(?:y|ies)|reports?|television|broadcasters?)\b(?!\s+(?:[A-Z]|al-))/;
/** "US officials said", "مسؤول أمريكي": the country's outlets are where those words appeared. */
/** Said TO an outlet ("a US official told Al Arabiya"): the outlet is the source, not a search. */
const OFFICIALS_AR = /مسؤول(?:ون|ين)?\s+(أمريكي(?:ون|ين)?|أميركي(?:ون|ين)?|بريطاني(?:ون|ين)?)(?!\s+ل)/;
const OFFICIALS_EN = /\b(U\.?S\.?|American|British|UK)\s+(?:(?:defen[cs]e|administration|military|government|senior)\s+)?officials?\b(?!\s+(?:told|tells?|to)\b)/;
const COUNTRY_OF: [RegExp, string][] = [
  [/بريطاني|British|UK/, "UK"],
  [/أمريكي|أميركي|American|U\.?S\.?/, "US"],
  [/غربي|Western/, "West"],
  [/إيراني|Iranian/, "IR"],
  [/إيطالي|Italian/, "IT"],
  [/فرنسي|French/, "FR"],
  [/ألماني|German/, "DE"],
];
const ADJECTIVE: Record<string, string> = { UK: "British", US: "US", West: "Western", IR: "Iranian", IT: "Italian", FR: "French", DE: "German" };
function group(label: string, country: string, kind: "group" | "official" = "group"): Cited | null {
  const sites = COUNTRY_SITES[country];
  return sites ? { name: label, site: "", lang: "en", kind, country, sites } : null;
}

/** The first source the text relays from, other than the outlet carrying it. */
export function findCitation(text: string, carrier: string, carrierUrl = ""): Cited | null {
  let t = String(text || "");
  if (!isPost(carrierUrl)) t = t.slice(0, LEAD_CHARS);
  for (const [re, cited] of CITABLE) {
    const m = re.exec(t);
    if (!m) continue;
    if (carrierUrl.includes(cited.site) || carrier.toLowerCase() === cited.name.toLowerCase()) continue;
    // Within a few words of a relay word, before or after ("رويترز عن",
    // "قالت صحيفة نيويورك تايمز", "Reuters reported", "NYT:").
    const around = t.slice(Math.max(0, m.index - 30), m.index + m[0].length + 12);
    if (!RELAY.test(around)) continue;
    const told = /(?:told|tells?|interview with|speaking to|لـ|ل\s*$)/i.test(t.slice(Math.max(0, m.index - 20), m.index));
    return told ? { ...cited, told } : cited;
  }
  return null;
}

/** "British media", "US officials": searched across that country's outlets. */
export function findGroup(text: string, carrierUrl = ""): Cited | null {
  const t = String(text || "");
  if (!isPost(carrierUrl)) return null; // an outlet's own "US officials said" is its own reporting
  const media = GROUP_AR.exec(t) ?? GROUP_EN.exec(t);
  const officials = media ? null : (OFFICIALS_AR.exec(t) ?? OFFICIALS_EN.exec(t));
  const m = media ?? officials;
  if (!m) return null;
  const country = COUNTRY_OF.find(([re]) => re.test(m[1]))?.[1];
  if (!country) return null;
  return group(media ? `${ADJECTIVE[country]} media` : `${country === "UK" ? "British" : "US"} officials`, country, media ? "group" : "official");
}

/** A name that reads like an outlet but is a role, a party or a place. */
const NOT_OUTLET =
  /^(?:President|Prime|Crown|Prince|King|Minister|Secretary|Leader|Envoy|Ambassador|Spokes\w*|Commander|General|Senator|Rep|Mr|Mrs|Ms|Sheikh|Houthis?|Ansar|Government|Council|Ministry|Forces|Army|Navy|Coalition|Parliament|Congress|Yemen\w*|Saudi|Iran\w*|Israel\w*|US|United|American|British|Western|Arab\w*|Gulf|Italian|French|German|Russian|Chinese|Turkish|Egyptian|Emirati|Qatari|Omani|Lebanese|Iraqi|Syrian|Pakistani|Indian|European|He|She|They|It|His|Her|Their|A|An|In|On|At|This|That|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Sources?|Officials?|Military|Security|Local|Residents?|Witnesses|Trump|Rubio|Hegseth|Vance|Witkoff|Netanyahu|Guterres|Grundberg|Donald|Marco|Mohammed|Muhammad|Mohamed|Bin|Abdul\w*|Abu|Faisal|Analysis|Opinion|Exclusive|Breaking|Update|Explainer|Watch|Video|Live|Pentagon|White|State|Department|Defen[cs]e|Foreign)$/;

const P = String.raw`((?:[A-Z][\w'’&.-]*|al-[A-Z][\w'-]*)(?:\s+(?:[A-Z][\w'’&.-]*|al-[A-Z][\w'-]*|of|de|di|del|della|la|el|al)){0,4})`;
/** "Italian newspaper La Repubblica", "the outlet Javan Online": certainly an outlet. */
const NAMED_STRONG = new RegExp(String.raw`\b(?:newspaper|paper|daily|weekly|outlet|website|news site|magazine|news agency|agency|broadcaster|channel|network|television|TV|radio)\s+(?:the\s+)?${P}`, "g");
/** "told NBC News", "Bloomberg reports", "…, Wall Street Journal says": an outlet if Google knows it as one. */
const NAMED_WEAK = [
  new RegExp(String.raw`\b(?:told|tells?|telling|according to|citing|quoted by|in an interview with|interview with|speaking to|spoke to)\s+(?:the\s+)?${P}`, "g"),
  new RegExp(String.raw`(?:^|[.;:]\s+|—\s+|\n)(?:the\s+)?${P}\s+(?:reports?|reported|revealed|reveals|wrote|writes|published|quoted)\b`, "g"),
  new RegExp(String.raw`^(?:the\s+)?${P}:\s`, "g"),
  new RegExp(String.raw`,\s+(?:the\s+)?${P}\s+(?:says|say|reports?|reported)\.?$`, "g"),
];

/** Outlet names the reader wrote into its English copy, strongest first. */
export function namedOutlets(copy: string): { name: string; strong: boolean; told: boolean }[] {
  const out: { name: string; strong: boolean; told: boolean }[] = [];
  const add = (raw: string, strong: boolean, told: boolean) => {
    const name = raw.replace(/\s+(?:of|de|di|del|della|la|el|al)$/i, "").replace(/'s$/, "").trim();
    const first = name.split(/\s+/)[0];
    if (name.length < 2 || NOT_OUTLET.test(first) || out.some((o) => o.name === name)) return;
    out.push({ name, strong, told });
  };
  for (const m of copy.matchAll(NAMED_STRONG)) add(m[1], true, false);
  NAMED_WEAK.forEach((re, i) => {
    for (const m of copy.matchAll(re)) add(m[1], false, i === 0 && /told|tells?|interview|speaking|spoke/.test(m[0]));
  });
  return out;
}

/** A name's distinctive words: "La Repubblica" → repubblica, "NBC News" → nbc. */
const NAME_FILLER = new Set("the la le il el al of de di del della news online daily newspaper times post press agency tv network channel radio media group".split(" "));
export const nameWords = (name: string) =>
  name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !NAME_FILLER.has(w));

/** Does a Google News item come from the named outlet? By its name or its site. */
export function fromOutlet(i: Pick<GnewsItem, "outlet" | "site">, name: string): boolean {
  const want = nameWords(name);
  const hay = `${i.outlet} ${i.site}`.toLowerCase();
  return want.length > 0 && want.every((w) => hay.includes(w));
}

/** A site's registrable domain: roma.repubblica.it → repubblica.it, news.bbc.co.uk → bbc.co.uk. */
export function domainOf(url: string): string {
  const host = hostOf(url);
  const parts = host.split(".");
  const n = parts.length >= 3 && /^(?:co|com|org|net|gov|ac)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2 ? 3 : 2;
  return parts.slice(-n).join(".");
}

/** The edition an outlet's own headlines are in, from its domain. */
export function editionOf(site: string, lang: "en" | "ar" = "en"): Edition {
  if (lang === "ar") return "ar";
  const tld = site.split(".").pop() ?? "";
  if (/\.co\.uk$|\.uk$/.test(site)) return "gb";
  return ({ it: "it", fr: "fr", de: "de", es: "es", tr: "tr", ru: "ru" } as Record<string, Edition>)[tld] ?? "en";
}
const COUNTRY_TLD: Record<string, string> = { it: "IT", fr: "FR", de: "DE", uk: "UK", ir: "IR", us: "US" };

/**
 * The outlet registry: every name the desk has looked up, and the site Google
 * News lists it under — or that it is no outlet at all. Kept, so a name costs
 * one search, once.
 */
export const REGISTRY_KEY = "outlet-registry";
type Registered = { site: string; at: number } | { none: true; at: number };
export type Registry = Record<string, Registered>;
const NONE_FOR = 30 * 86400_000;
const regKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The site an outlet publishes on, found by its name: Google News lists every
 * item under the outlet's own home page, so the site most of the items for
 * "La Repubblica" come from, whose name or address carries the name, is it.
 */
export async function discoverSite(name: string, search = searchGoogleNews): Promise<string> {
  if (!nameWords(name).length) return "";
  const items = await search(`"${name}"`, "en");
  const count = new Map<string, number>();
  for (const i of items) {
    if (!i.site || !fromOutlet(i, name)) continue;
    const d = domainOf(i.site);
    count.set(d, (count.get(d) ?? 0) + 1);
  }
  const [best] = [...count].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 2 ? best[0] : "";
}

/** A name from the reader's copy as a citation, through the registry. "" site = unknown to Google. */
async function resolveNamed(
  n: { name: string; strong: boolean; told: boolean },
  registry: Registry,
  now: number,
  allow: () => boolean,
): Promise<Cited | null> {
  // A name the table knows by another spelling.
  const known = CITABLE.find(([re]) => re.test(n.name))?.[1];
  if (known) return n.told ? { ...known, told: true } : known;
  if (ISRAELI.test(n.name)) return null;
  const key = regKey(n.name);
  let reg: Registered | undefined = registry[key];
  if (reg && "none" in reg && now - reg.at > NONE_FOR) reg = undefined;
  if (!reg) {
    if (!allow()) return null;
    const site = await discoverSite(n.name);
    reg = registry[key] = site && !/\.il$/.test(site) ? { site, at: now } : { none: true, at: now };
  }
  if ("none" in reg) {
    // Named an outlet in so many words ("newspaper Javan Online") though Google
    // does not list it: its story is still searched for by name.
    return n.strong ? { name: n.name, site: "", lang: "en", kind: "outlet", told: n.told } : null;
  }
  const country = COUNTRY_TLD[reg.site.split(".").pop() ?? ""] ?? Object.entries(COUNTRY_SITES).find(([, s]) => s.includes(reg.site))?.[0];
  return { name: n.name, site: reg.site, lang: "en", kind: "outlet", country, told: n.told };
}

const STOP_EN = new Set(
  "the a an of in on at to for and or but with from by as is are was were be been has have had its it this that after before over into amid says said say new report reports we our us they their them he his she her you your will would could should can may might not also which who what when where about than then more most very just all any some such only".split(" "),
);
const STOP_AR = new Set("في من على إلى عن مع أن إن التي الذي هذا هذه بعد قبل حول ضد كما وقد قد لا لم ما هو هي".split(" "));
/** Words about the reporting, not the story: never a search key. */
const MEDIA_WORDS =
  "newspaper paper media outlet outlets daily agency report reported reporting reports told tell tells according citing interview website channel network broadcaster magazine sources source quoted revealed".split(" ");

/** The words a search and a match are judged on. */
export function keywords(text: string, lang: "en" | "ar", skip: string): string[] {
  const skipWords = new Set(skip.toLowerCase().split(/\s+/));
  const words =
    lang === "en"
      ? (String(text).match(/[A-Za-z][A-Za-z'-]{2,}/g) || [])
          .map((w) => w.replace(/'s$/, ""))
          .filter((w) => !STOP_EN.has(w.toLowerCase()) && !skipWords.has(w.toLowerCase()))
      : (String(text).match(/[ء-ي]{4,}/g) || []).filter((w) => !STOP_AR.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  // The story's own names first, then its other names, then the rest in order;
  // the words every war story shares ("Trump", "Houthi") last. A name is
  // capitalised where a sentence does not start: "Taif", not "Senior".
  const names = new Set(lang === "en" ? [...String(text).matchAll(/(?<=[a-z0-9,;'’]\s)([A-Z][A-Za-z'-]{2,})/g)].map((m) => m[1].replace(/'s$/, "")) : []);
  const own = (w: string) => !COMMON.has(stem(w));
  const ranked =
    lang === "en"
      ? [
          ...words.filter((w) => names.has(w) && own(w)),
          ...words.filter((w) => /^[A-Z][a-z]/.test(w) && own(w)),
          ...words.filter((w) => own(w)),
          ...words.filter((w) => names.has(w)),
          ...words,
        ]
      : words;
  for (const w of ranked) {
    const k = lang === "en" ? stem(w) : w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

/**
 * The search words for a relayed story: its English headline and copy, less
 * every outlet's name and the words about the reporting. An AP story was
 * searched for as "Iranian Houthi Yemen MOCHA Associated" — the dateline and
 * the agency's own name took two of four places — and never found.
 */
export function searchKeys(copy: string, cited: Pick<Cited, "name">): string[] {
  const clean = (s: string) => {
    // A dateline: "MOCHA — ".
    let t = s.replace(/(^|\n)[A-Z][A-Z' ,.-]{2,40}\s+—\s+/g, "$1");
    for (const [re] of CITABLE) t = t.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), " ");
    return t.replace(new RegExp(cited.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  };
  // The headline first: the reader's headline paraphrases the original's, and
  // the body's names ("Sunday", "Crown Prince") are the story's surroundings.
  const skip = [cited.name, ...MEDIA_WORDS].join(" ");
  const [head, ...body] = String(copy || "").split("\n");
  const out: string[] = [];
  for (const w of [...keywords(clean(head), "en", skip), ...keywords(clean(body.join("\n")), "en", skip)]) {
    if (!out.some((o) => stem(o) === stem(w))) out.push(w);
  }
  return out;
}

/** The Arabic search words: the post less the names of outlets. */
function arabicKeys(text: string): string[] {
  let t = String(text || "");
  for (const [re] of CITABLE) t = t.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), " ");
  return keywords(t.replace(GROUP_AR, " "), "ar", "");
}

/** Does a search result tell the same story? Shared words and a fitting time. */
/** A word's stem: "Houthis" is "Houthi", "Iran's" is "Iran". */
const stem = (w: string) => w.toLowerCase().replace(/['’]s$/, "").replace(/(?<=\w{4})(?:es|s)$/, "");
const stems = (title: string) => new Set((title.match(/[A-Za-zء-ي][A-Za-z'ء-ي-]{2,}/g) || []).map(stem));

/**
 * Words every story of this war shares. Two of them in common is no match: an
 * oil-prices piece and the Pentagon-split scoop both say "Trump" and "Saudi".
 */
const COMMON = new Set(
  "trump donald president houthi yemen yemeni saudi arabia iran iranian israel israeli united state states washington red sea war military force attack strike official government us u.s american".split(" ").map(stem),
);

/**
 * How long before the relay the original may have run. Almashhad carried NBC's
 * Pentagon-split scoop two days after NBC did; four days is another story.
 */
const LOOKBACK_MS = 72 * 3600_000;

/** Does a search result tell the same story? Shared words and a fitting time. */
export function overlap(title: string, want: string[], resultAt: number, reportAt: number): number {
  if (!Number.isFinite(resultAt) || resultAt > reportAt + 6 * 3600_000 || resultAt < reportAt - LOOKBACK_MS) return 0;
  const have = stems(title);
  return [...new Set(want.map(stem))].filter((w) => have.has(w)).length;
}

/** The shared words that are not every war story's: "Pentagon", "divided", "Taif". */
export function distinctive(text: string, want: string[]): number {
  const have = stems(text);
  return [...new Set(want.map(stem))].filter((w) => !COMMON.has(w) && have.has(w)).length;
}

/**
 * A headline that shares only the war's common words ("Trump", "Saudi") may
 * be the story in other words — "Trump Gets Caught in a Dilemma Over a Saudi
 * Plea" was the NYT original of "Trump hesitated on Yemen strikes after Saudi
 * requests" — or another story entirely: an oil-prices piece was taken for the
 * Pentagon-split scoop. The page decides: its text, or the summary its page
 * carries even behind a paywall, must share three of the story's own words.
 */
async function confirmed(url: string, keys: string[]): Promise<boolean> {
  const html = await page(url);
  const text = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<meta[^>]*content="([^"]*)"[^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ");
  return distinctive(text, keys) >= 3;
}

/** The war's own ground and parties: a story about it names one of them. */
const THEATRE = /\b(?:Yemen|Yemeni|Houthis?|Ansar Allah|Saudi|Red Sea|Bab al-Mandab|Gulf of Aden|Aden|Sanaa|Hodeidah|Taiz|Marib|Mocha|Lahj|Hadramout|Jizan|Najran)\b/i;
export const theatre = (text: string): boolean => THEATRE.test(text);

/** Shared words, each weighted by how early it ranks in `want`. */
export function weight(title: string, want: string[]): number {
  const have = stems(title);
  return want.reduce((s, w, i) => s + (have.has(stem(w)) ? 1 / (1 + i) : 0), 0);
}

const inWindow = (at: number, reportAt: number) => Number.isFinite(at) && at <= reportAt + 6 * 3600_000 && at >= reportAt - LOOKBACK_MS;

/** A paraphrase shares few words with the original's headline: two is a match. */
const MIN_SHARED = 2;

// v3: video pages and matches over 36 hours old refused, originals read in
// full; v2 matches weighted by the post's leading names; v1 held looser matches.
const CACHE_KEY = "origin-cache-v3";
const CACHE_MAX = 600;
/** Searches per tick: each costs a Google search plus a link resolution. */
export const ORIGIN_BUDGET = 10;
/** Originals read per tick: each costs a page, and maybe a search and three copies. */
export const READ_BUDGET = 6;
/** Reconstructions per tick: each reads up to four other outlets' pages. */
const COVERAGE_BUDGET = 2;
/** Registry look-ups per tick: a new name costs one Google search. */
const DISCOVER_BUDGET = 4;
/** The trace stops starting work after this long, so the tick finishes in time. */
const TRACE_MS = 100_000;
/** Google News links resolved per tick by the trace: more and Google answers 429. */
const RESOLVE_BUDGET = 15;
/** Google News searches per tick by the trace: a citation may take several. */
const SEARCH_BUDGET = 40;
const RETRY_MS = 3600_000;
const GIVE_UP_MS = 24 * 3600_000;
/** A found original that will not read is tried again after 1, 2, 4 hours, then left. */
const READ_TRIES = 4;

export type Found = {
  url: string;
  source: string;
  title?: string;
  readBy?: string;
  /** Reads that came back empty, and when the next may be tried. */
  fails?: number;
  nextReadAt?: number;
  /** Found at an outlet that only carried the words: never learned as a source. */
  carrier?: boolean;
};

/** The original, read in full and queued for the reader to write the card from. */
export type ReRead = { source: string; url: string; text: string; at: string; lean: string; fp: string; score: number; tags: string[] };
/**
 * A report waiting for its original. `holdUntil`: until then the relay is not
 * published at all (the desk's rule: nothing goes out from a relay while the
 * original may still be found); `released` once it went out, found or not.
 * `follows`: another relay of the same words, settled with the first one.
 */
type Waiting = {
  cited: Cited;
  keys: string[];
  arKeys?: string[];
  trKeys?: string[];
  firstAt: number;
  lastAt: number;
  report: LiveReport;
  holdUntil?: number;
  released?: boolean;
  follows?: string;
};
type Entry = { found: Found; at: number; cited?: Cited; keys?: string[]; report?: LiveReport; held?: boolean } | Waiting;

/** How long a relay is held back while its original is looked for. */
export const HOLD_MS = 3 * 3600_000;
/** A held report is searched again this often: often at first, then less. */
const holdEvery = (age: number) => (age < 3600_000 ? 10 * 60_000 : 20 * 60_000);
/** Held reports searched per tick, before any other retry. */
const HOLD_BUDGET = 6;

export type TraceOptions = {
  /** Reports held back this tick: the caller does not publish them. */
  held?: Set<string>;
  /** An outlet's own recent articles (its listing), by site. */
  listingOf?: (site: string) => Promise<Listed[]>;
  /** Does the desk already read this host? */
  knownHost?: (host: string) => boolean;
};

/** Paths that are never the article itself: video, photo and live pages, a bare front page. */
const NOT_ARTICLE = /\/(?:video|videos|pictures|graphics|live)\//i;
function articlePath(url: string): boolean {
  try {
    const p = new URL(url).pathname;
    return p.length > 1 && !NOT_ARTICLE.test(p);
  } catch {
    return false;
  }
}

/** The capitalised names among the keys: what matches across languages ("Taif", "Eurofighter"). */
/** The rare names among the keys: what an Italian headline shares with an English summary ("Taif", "Eurofighter"). */
const rareNames = (keys: string[]) => keys.filter((w) => /^[A-Z]/.test(w) && !COMMON.has(stem(w)) && !/^(?:Italian|French|German|British|Iranian|Italy|France|Germany|Britain)$/.test(w));

type Try = { q: string; ed: Edition; min: number; keys: string[]; credit: (i: GnewsItem) => string | null; anywhere?: boolean };

/**
 * Where to look, in order: the outlet's own site in its own language; then the
 * outlet's story wherever it ran under its name (a wire's copies); then, for an
 * official's words or an interview, the outlets of his country.
 */
export function searchPlan(cited: Cited, keys: string[], arKeys: string[] = []): Try[] {
  const plan: Try[] = [];
  const k = (ks: string[], n = 4) => ks.slice(0, n).join(" ");
  // Every word must be in a result: four find the story told in its words, two
  // the story told in others. The second only runs when the first found nothing.
  const push = (t: Try) => {
    plan.push(t);
    if (t.min && t.keys.length > 2) plan.push({ ...t, q: t.q.replace(k(t.keys), k(t.keys, 2)) });
  };
  if (cited.site) {
    const ed = editionOf(cited.site, cited.lang);
    const foreign = !["en", "gb", "ar"].includes(ed);
    // A foreign-language original shares only its rare names with an English
    // summary, and Google matches them in its text, not its headline: two rare
    // names on the outlet's own site are the match, its first result the story.
    if (foreign) {
      const ks = rareNames(keys);
      if (ks.length >= 2) push({ q: `site:${cited.site} ${k(ks, 2)} when:3d`, ed, min: 0, keys: ks, credit: () => cited.name });
    } else {
      push({ q: `site:${cited.site} ${k(keys)} when:3d`, ed, min: MIN_SHARED, keys, credit: () => cited.name });
      // The story's own names, from anywhere in its copy: the reader's headline
      // is a paraphrase ("expands secret procurement"), the names are not
      // ("China", "Aden", "Hodeidah").
      const names = rareNames(keys);
      if (names.length >= 2) plan.push({ q: `site:${cited.site} ${k(names, 3)} when:3d`, ed, min: MIN_SHARED, keys, credit: () => cited.name });
    }
    if (cited.lang === "ar" && arKeys.length >= 2) push({ q: `site:${cited.site} ${k(arKeys)} when:3d`, ed: "ar", min: MIN_SHARED, keys: arKeys, credit: () => cited.name });
    if (ed === "ar" && keys.length >= 2) push({ q: `site:${cited.site} ${k(keys)} when:3d`, ed: "en", min: MIN_SHARED, keys, credit: () => cited.name });
  }
  const sites = cited.sites ?? [];
  if (sites.length) {
    const or = sites.map((s) => `site:${s}`).join(" OR ");
    push({ q: `(${or}) ${k(keys)} when:2d`, ed: COUNTRY_EDITION[cited.country ?? ""] ?? "en", min: MIN_SHARED, keys, credit: (i) => i.outlet || null });
  }
  if (cited.kind !== "group" && nameWords(cited.name).length) {
    // Under its name elsewhere: the original on another of its addresses, or a
    // wire's story as a paper carried it.
    push({
      q: `"${cited.name}" ${k(keys)} when:3d`,
      ed: "en",
      min: MIN_SHARED,
      keys,
      credit: (i) => (fromOutlet(i, cited.name) || cited.wire ? cited.name : null),
    });
  }
  if ((cited.kind === "official" || cited.told) && cited.country && COUNTRY_SITES[cited.country] && !sites.length) {
    const or = COUNTRY_SITES[cited.country].map((s) => `site:${s}`).join(" OR ");
    push({ q: `(${or}) ${k(keys)} when:2d`, ed: COUNTRY_EDITION[cited.country] ?? "en", min: MIN_SHARED, keys, credit: (i) => i.outlet || null });
  }
  if (cited.kind === "official" || cited.told) {
    // Last, anywhere: the words carried by any outlet, on a close match.
    push({ q: `${k(keys)} when:2d`, ed: "en", min: 3, keys, credit: (i) => i.outlet || null, anywhere: true });
  }
  return plan;
}

/**
 * `claim` is the relay's own account. A story found "anywhere" shares words,
 * not necessarily facts: Fana's "Iran President Meets Prime Minister, Minister
 * of Foreign Affairs in New York" stood in for a Yemeni minister's words at a
 * UNICEF event. Such a find counts only when a model reads its page and finds
 * the claim there.
 */
async function search(cited: Cited, keys: string[], arKeys: string[], reportAt: number, claim = ""): Promise<Found | null> {
  for (const t of searchPlan(cited, keys, arKeys)) {
    const items = await searchGoogleNews(t.q, t.ed);
    // Enough shared words to count, then the best fit: a word ranked early (the
    // post's leading names, "Trump") weighs more than one from deep in the body.
    const ranked = items
      .filter((i) => (t.min ? overlap(i.title, t.keys, i.at, reportAt) >= t.min : overlap(i.title, [], i.at, reportAt) === 0 && inWindow(i.at, reportAt)) && t.credit(i))
      // The headline sharing most of the story's own words first; then more
      // words in all; then the fit with its leading names.
      .sort((a, b) =>
        t.min
          ? distinctive(b.title, t.keys) - distinctive(a.title, t.keys) ||
            overlap(b.title, t.keys, b.at, reportAt) - overlap(a.title, t.keys, a.at, reportAt) ||
            weight(b.title, t.keys) - weight(a.title, t.keys)
          : 0,
      );
    // A video page or a section front is not the article: try the next fit.
    for (const hit of ranked.slice(0, 2)) {
      const url = await resolveGoogleNews(hit.link);
      if (!url || !articlePath(url) || ISRAELI.test(hit.outlet) || ISRAELI_HOST.test(hostOf(url))) continue;
      // Three of the story's own words in the headline is the story; fewer —
      // "China Expands Drug Chemicals Control" for "China expands secret
      // procurement" — and its page must show them.
      const strong = distinctive(hit.title, t.keys) >= 3;
      if (t.min && !strong && !(await confirmed(url, t.keys))) continue;
      // The story's war must be in it: UNICEF's "2.2 million children under
      // five in Yemen" matched a UNICEF release on Jordan's schools by its
      // common words alone.
      if (theatre(t.keys.join(" ")) && !theatre(hit.title) && !theatre(await page(url))) continue;
      if (t.anywhere) {
        const body = claim ? articleText(await page(url)) : "";
        if (!body || (await whichCarries(claim, [`${hit.title}\n${body}`])) !== 0) continue;
        return { url, source: t.credit(hit) ?? cited.name, title: hit.title, carrier: true };
      }
      return { url, source: t.credit(hit) ?? cited.name, title: hit.title };
    }
  }
  return null;
}

async function page(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) });
    if (res.ok) return await res.text();
    // An unread body left open can trip undici when the socket closes.
    await res.body?.cancel().catch(() => {});
    return "";
  } catch {
    return "";
  }
}

/** An article page's paragraphs, without the page's furniture. */
export function articleText(html: string): string {
  // Stylesheets and scripts first. Stripping tags alone leaves what was between
  // them, and sites that style their links inline — wsj.com does — put a
  // `<style>` block inside the first paragraph, so every rescued WSJ story
  // began "DUBAI—.css-qxhvg8-OverridedLink{-webkit-text-decoration:none…".
  const clean = String(html || "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  return [...clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&#x27;|&#39;|&rsquo;|&lsquo;/g, "'")
        .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;|&#160;/g, " ")
        .replace(/^Listen\s*/, "")
        .replace(/\s*REUTERS\s*$/, "")
        .trim(),
    )
    .filter((t) => t.length > 60 && !/cookie|subscribe|sign up|newsletter|all rights reserved|©/i.test(t))
    // A paragraph is a sentence: a line with no closing stop is a related
    // headline or a caption, not the story.
    .filter((t) => /[.!?؟"'”’)»]$/.test(t))
    .filter((t, i, all) => all.indexOf(t) === i)
    // Whole paragraphs, the whole article: its key fact may be near the end.
    .reduce((out, t) => (out.length + t.length < FULL_TEXT_MAX ? (out ? `${out}\n${t}` : t) : out), "");
}

/**
 * A headline reduced to its letters, so the same story under two outlets'
 * punctuation compares equal.
 *
 * The backslashes matter: written `[^p{L}p{N}]` the class is not "anything but
 * a letter or a digit", it is "anything but the five characters p { L } N".
 * Every lowercased headline came out as a run of the letter p — "Trump spoke
 * with Yemen's president Al-Alimi" was "ppp" — so unrelated stories with the
 * same number of p's compared equal, and `readOriginal` returned a different
 * article's text as this report's body. Caught by a rescued Arab News item
 * about a call with Yemen's president coming back as Trump meeting Qatar's PM.
 */
const titleKey = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The same headline, give or take a word: Dow Jones runs a WSJ story on
 * MarketWatch and Barron's under its headline, sometimes trimmed. Long
 * headlines only, and nearly all their words shared.
 */
export function sameTitle(a: string, b: string): boolean {
  if (titleKey(a) === titleKey(b)) return true;
  const wa = new Set(a.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const wb = new Set(b.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  if (wa.size < 6 || wb.size < 6) return false;
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(wa.size, wb.size) >= 0.85;
}

/** How each site's original was read, and how often it could not be: the admin record. */
export const ROUTES_KEY = "origin-routes";
export type Route = "page" | "copy" | "wayback" | "coverage" | "none";
export type RouteLog = Record<string, { routes: Partial<Record<Route, number>>; lastAt: number; last: Route }>;
export function logRoute(log: RouteLog, url: string, route: Route, now = Date.now()): void {
  const host = hostOf(url);
  if (!host) return;
  const e = (log[host] ??= { routes: {}, lastAt: 0, last: route });
  e.routes[route] = (e.routes[route] ?? 0) + 1;
  e.lastAt = now;
  e.last = route;
}
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Sites that open on a teaser: WSJ, Bloomberg, FT, NYT and the like. */
const PAYWALLED = /(?:^|\.)(?:wsj\.com|bloomberg\.com|ft\.com|nytimes\.com|washingtonpost\.com|economist\.com|thetimes\.com|telegraph\.co\.uk|barrons\.com|theinformation\.com|foreignpolicy\.com)$/;

/** What a reconstruction needs: whose article, what it was about, when. */
export type Coverage = { name: string; keys: string[]; at: number };

/**
 * The article as other outlets told it. A paywalled WSJ or Bloomberg piece is
 * written up at length by others within hours — Arabic papers often translate
 * it nearly whole — and each names it. Up to four of those accounts, each
 * labelled, stand in for the text the desk could not open; the card still
 * credits and links the original.
 */
async function reconstruct(f: Found, c: Coverage): Promise<string> {
  if (!nameWords(c.name).length || c.keys.length < 2) return "";
  const items = (await searchGoogleNews(`"${c.name}" ${c.keys.slice(0, 3).join(" ")} when:3d`, "en"))
    .filter((i) => !fromOutlet(i, c.name) && !ISRAELI.test(i.outlet) && overlap(i.title, c.keys, i.at, c.at) >= MIN_SHARED)
    .filter((i, n, all) => all.findIndex((x) => x.outlet === i.outlet) === n)
    .slice(0, 4);
  const accounts = await Promise.all(
    items.map(async (i) => {
      const url = await resolveGoogleNews(i.link);
      const text = url && !ISRAELI_HOST.test(hostOf(url)) ? articleText(await page(url)) : "";
      return text.length >= 300 ? `[${i.outlet}] ${text.slice(0, Math.floor(FULL_TEXT_MAX / 4))}` : "";
    }),
  );
  const kept = accounts.filter(Boolean);
  if (!kept.length) return "";
  return `Several outlets' accounts of one ${f.source} article follow. Write the ${f.source} article's facts, not the accounts.\n${kept.join("\n")}`;
}

/**
 * The original's full text. Wires such as Reuters refuse automated readers, so
 * when the page itself will not open, the same story is read from a paper
 * that carries the wire under the same headline (The Straits Times,
 * MarketScreener, MarketWatch for the WSJ, ...), then from a capture the
 * Wayback Machine already holds, and last from other outlets' write-ups of it.
 * No page is forced: a refusal moves on to the next route.
 */
export async function readOriginal(
  f: Found,
  lang: Edition = "en",
  note: (r: Route) => void = () => {},
  coverage?: Coverage,
): Promise<string> {
  const own = articleText(await page(f.url));
  // A paywalled page opens on its first paragraphs: enough to count as read,
  // not enough to write the whole story from. The other routes are tried too.
  const enough = PAYWALLED.test(hostOf(f.url)) ? 1500 : 400;
  if (own.length >= enough) return note("page"), own;
  const rest = async () => {
    // A copy the Wayback Machine already holds; a new capture is never asked for.
    const text = articleText(await page(await archived(f.url)));
    if (text.length >= enough) return note("wayback"), text;
    const cover = coverage ? await reconstruct(f, coverage) : "";
    if (cover.length >= enough) return note("coverage"), cover;
    const best = [own, text, cover].sort((a, b) => b.length - a.length)[0];
    note(best.length >= 400 ? (best === own ? "page" : best === text ? "wayback" : "coverage") : "none");
    return best;
  };
  if (!f.title) return rest();
  const copies = (await searchGoogleNews(`"${f.title}"`, lang)).filter(
    (i) => i.outlet && i.outlet !== f.source && !fromOutlet(i, f.source) && sameTitle(i.title, f.title!),
  );
  for (const i of copies.slice(0, 3)) {
    const url = await resolveGoogleNews(i.link);
    const text = url ? articleText(await page(url)) : "";
    if (text.length >= Math.min(enough, 1500)) return note("copy"), text;
  }
  return rest();
}

/** The raw page of an existing Wayback Machine capture, or "". */
async function archived(url: string): Promise<string> {
  try {
    const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(6000) });
    const snap = res.ok ? ((await res.json()) as { archived_snapshots?: { closest?: { url?: string; available?: boolean } } }).archived_snapshots?.closest : undefined;
    return snap?.available && snap.url ? snap.url.replace(/\/web\/(\d+)\//, "/web/$1id_/") : "";
  } catch {
    return "";
  }
}

/**
 * An outlet does not open a headline, and a headline does not end on who
 * reported it: "La Repubblica: Taif base attack damages Eurofighter jet" and
 * "Houthis are increasingly supplied by China, Wall Street Journal says" lose
 * the attribution; the card's source line carries it. A person's words keep
 * their "Name:" — only outlets and "media" are stripped.
 */
export function stripAttribution(headline: string, outlets: (string | undefined)[] = []): string {
  const h = String(headline || "").trim();
  const named = outlets.filter((o): o is string => !!o && nameWords(o).length > 0);
  const isOutlet = (s: string) =>
    /\b(?:media|press|newspapers?|paper|daily|outlets?|reports?|agency|broadcaster|network|television|online)\b/i.test(s) ||
    CITABLE.some(([re, c]) => c.kind === "outlet" && re.test(s)) ||
    named.some((o) => nameWords(o).every((w) => s.toLowerCase().includes(w)));
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const open = /^([^:]{2,60}):\s+(.+)$/.exec(h);
  if (open && isOutlet(open[1]) && !/\b(?:minister|president|leader|spokes\w*|official|envoy|commander)\b/i.test(open[1])) return cap(open[2]);
  const end = /^(.+?),\s+((?:the\s+)?[^,]{2,50}?)\s+(?:says|say|reports?|reported|said)\.?$/i.exec(h);
  if (end && isOutlet(end[2])) return end[1];
  const after = /^(.+?),\s+(?:says|reports?|reported|said|according to)\s+((?:the\s+)?[^,]{2,50}?)\.?$/i.exec(h);
  if (after && isOutlet(after[2])) return after[1];
  return h;
}

/**
 * Trace this cycle's reports, and retry ones still waiting. Returns the stored
 * reports whose original turned up only now, to be re-saved with it.
 */
export async function traceOrigins(
  store: DeskStore,
  reports: LiveReport[],
  sourceText: Map<string, string>,
  now = Date.now(),
  reread: ReRead[] = [],
  opts: TraceOptions = {},
): Promise<LiveReport[]> {
  const started = Date.now();
  const inTime = () => Date.now() - started < TRACE_MS;
  // Google's link resolver is shared with the scan: a tick spends a few, and none while Google asks for a rest.
  const resolved0 = resolveCount();
  const searched0 = searchCount();
  const canWork = () => inTime() && !resolverResting() && resolveCount() - resolved0 < RESOLVE_BUDGET && searchCount() - searched0 < SEARCH_BUDGET;
  const cache = (await store.getJson<Record<string, Entry>>(CACHE_KEY)) ?? {};
  const registry = (await store.getJson<Registry>(REGISTRY_KEY)) ?? {};
  const regBefore = JSON.stringify(registry);
  let learned: Learned[] | null = null;
  let dirtyLearned = false;
  let budget = ORIGIN_BUDGET;
  let holds = HOLD_BUDGET;
  let reads = READ_BUDGET;
  let covers = COVERAGE_BUDGET;
  let discovers = DISCOVER_BUDGET;
  let dirty = false;
  const apply = (r: LiveReport, f: Found) => {
    // The original stands alone: no "Also" line of relays.
    r.url = f.url;
    r.source = f.source;
    r.citing = undefined;
    r.alsoReportedBy = undefined;
  };
  let routes: RouteLog | undefined;
  /**
   * The first report traced to an original has the original read and queued,
   * so the card is written from the original text, not the relay. Another
   * relay of the same original joins that card instead. A read that fails is
   * tried again after one, two, four hours, then left: the same unopenable
   * page is not fetched every tick at the expense of the next original.
   */
  const readFrom = async (r: LiveReport, e: Extract<Entry, { found: Found }>) => {
    const f = e.found;
    const owner = Object.entries(cache).find(([fp, x]) => fp !== r.fp && "found" in x && x.found.url === f.url && x.found.readBy)?.[1];
    if (owner && "found" in owner) {
      r.duplicateOf = owner.found.readBy;
      return;
    }
    if (f.readBy || (f.fails ?? 0) >= READ_TRIES || (f.nextReadAt ?? 0) > now || reads <= 0 || !canWork()) return;
    reads -= 1;
    dirty = true;
    const cover = e.keys && covers > 0 ? { name: f.source, keys: e.keys, at: Date.parse(r.at) } : undefined;
    const text = await readOriginal(f, e.cited ? editionOf(hostOf(f.url), e.cited.lang) : "en", (route) => {
      logRoute((routes ??= {}), f.url, route, now);
      if (route === "coverage") covers -= 1;
    }, cover);
    if (text.length < 400) {
      if (resolverResting()) return; // not the page's fault: tried again next tick
      f.fails = (f.fails ?? 0) + 1;
      f.nextReadAt = now + RETRY_MS * 2 ** (f.fails - 1);
      e.report ??= { ...r };
      return;
    }
    f.readBy = r.fp;
    e.report = undefined;
    reread.push({
      source: f.source,
      url: f.url,
      text: `${f.title ?? ""}
${text}`.trim(),
      at: r.at,
      lean: "intl",
      fp: r.fp,
      score: r.score ?? 0,
      tags: [...(r.tags ?? []), "original"],
    });
  };

  /** What this report relays from: the table, a name the reader wrote, a foreign leader's words, or an unnamed group. */
  const citationOf = async (r: LiveReport, text: string): Promise<Cited | null> => {
    const lead = isPost(r.url) ? `${r.summary}\n${r.text ?? ""}` : `${r.summary}\n${(r.text ?? "").slice(0, LEAD_CHARS)}`;
    // Words said at a body's event ("told a UNICEF event in New York") are the
    // speaker's own, not the body's: the minister's own ministry posting them
    // is the original.
    const spokeAt = (c: Cited) => c.told && c.kind === "official";
    const cited = findCitation(text, r.source, r.url) ?? findCitation(lead, r.source, r.url);
    if (cited) return spokeAt(cited) ? null : cited;
    for (const n of namedOutlets(lead)) {
      if (nameWords(n.name).some((w) => r.source.toLowerCase().includes(w) || r.url.toLowerCase().includes(w))) continue;
      const c = await resolveNamed(n, registry, now, () => discovers-- > 0 && inTime());
      if (c) return spokeAt(c) ? null : c;
    }
    const sp = speakerOf(r.summary, isPost(r.url) ? text : "");
    // His words on his own channel, in his country's press or on a wire are
    // first-hand; so are words said to the carrier itself.
    if (sp && !ownCarrier(sp, r.url, [...(SPEAKER_PRESS[sp.country] ?? []), ...WIRE_SITES]) && !saidTo(`${text}\n${lead}`, r.source)) {
      return { name: sp.name, site: sp.official ?? "", lang: "en", kind: "official", country: sp.country, speaker: sp.name };
    }
    return findGroup(text, r.url) ?? findGroup(lead, r.url);
  };

  /**
   * Look for the original: a leader's words as he said them; otherwise the
   * outlet's site, its name elsewhere, its country's press; last, the outlet's
   * own recent articles, read and matched by a model.
   */
  const find = async (e: Waiting): Promise<Found | null> => {
    const at = Date.parse(e.report.at);
    const sp = e.cited.speaker ? speakerNamed(e.cited.speaker) : null;
    if (sp) {
      if (!e.trKeys) e.trKeys = await translateKeys(e.keys, sp.lang);
      const hit = await searchSpeaker(sp, e.keys, e.trKeys, at, (o) => ISRAELI.test(o));
      return hit && !ISRAELI_HOST.test(hostOf(hit.url)) ? { url: hit.url, source: hit.source, title: hit.title } : null;
    }
    const claim = `${e.report.summary}. ${e.report.text ?? ""}`.trim();
    const own = async (): Promise<Found | null> => {
      if (!e.cited.site || !opts.listingOf || !canWork()) return null;
      const cands = ownCandidates(await opts.listingOf(e.cited.site), e.keys, at);
      if (!cands.length) return null;
      const urls = await Promise.all(cands.map(async (c) => (/news\.google\.com/.test(c.url) ? await resolveGoogleNews(c.url) : c.url)));
      const texts = await Promise.all(urls.map(async (u) => (u ? articleText(await page(u)) : "")));
      const i = await whichCarries(claim, texts.map((t, j) => `${cands[j].title}\n${t || cands[j].desc}`));
      return i >= 0 && urls[i] ? { url: urls[i], source: e.cited.name, title: cands[i].title } : null;
    };
    // A site the desk reads itself (Sheba) is looked for in its own listing
    // first: that is where the story is, and it costs no search.
    const ours = !!e.cited.site && !!opts.knownHost?.(e.cited.site);
    if (ours) {
      const hit = await own();
      if (hit) return hit;
    }
    const found = await search(e.cited, e.keys, e.arKeys ?? [], at, claim);
    if (found || ours) return found;
    return own();
  };

  /** A found original at an outlet the desk does not read becomes one of its sources. */
  const learn = async (f: Found, e: { cited?: Cited }, fp: string) => {
    if (!opts.knownHost || f.carrier) return;
    learned ??= await loadLearned(store);
    const sp = e.cited?.speaker ? speakerNamed(e.cited.speaker) : null;
    const hit: Hit = { url: f.url, source: f.source, title: f.title };
    const meta = { lang: sp?.lang ?? (e.cited?.lang === "ar" ? "Arabic" : "English"), country: e.cited?.country, from: fp, site: e.cited?.site, speaker: !!sp };
    if (learnSource(learned, hit, opts.knownHost, meta, now)) {
      console.log(`[origin] learned a source: ${f.source} (${hostOf(f.url)})`);
      dirtyLearned = true;
    }
  };

  /** Held speaker reports still waiting: a second channel's account of the same words waits with them. */
  const heldSpeakers = () =>
    Object.entries(cache)
      .filter((x): x is [string, Waiting] => !("found" in x[1]) && !!x[1].holdUntil && !x[1].released && !x[1].follows && !!x[1].cited.speaker)
      .sort((a, b) => a[1].firstAt - b[1].firstAt);

  for (const r of reports) {
    const text = sourceText.get(r.url);
    const prior = cache[r.fp];
    if (prior && "found" in prior) {
      apply(r, prior.found);
      await readFrom(r, prior);
      continue;
    }
    if (prior) {
      r.citing = prior.cited.name;
      if (prior.holdUntil && !prior.released) opts.held?.add(r.fp);
      continue; // waiting: retried below
    }
    if (!text) continue;
    const cited = await citationOf(r, text);
    if (!cited) {
      const copy = `${r.summary}\n${r.text ?? ""}`;
      const leader = opts.held
        ? heldSpeakers().find(([, e]) => {
            const same = e.keys.filter((k) => copy.toLowerCase().includes(k.toLowerCase()));
            // Three of its words, a name among them, within the hold.
            return same.length >= 3 && same.some((k) => /^[A-Z]/.test(k)) && Math.abs(Date.parse(r.at) - Date.parse(e.report.at)) < HOLD_MS;
          })
        : undefined;
      if (leader) {
        const [lfp, le] = leader;
        cache[r.fp] = { cited: le.cited, keys: le.keys, firstAt: now, lastAt: now, report: { ...r }, holdUntil: le.holdUntil, follows: lfp };
        opts.held?.add(r.fp);
        dirty = true;
      }
      continue;
    }
    const keys = searchKeys(`${r.summary}\n${r.text ?? ""}`, cited);
    const arKeys = /[ء-ي]/.test(text) ? arabicKeys(text) : [];
    if (keys.length < 2) continue;
    r.citing = cited.name;
    const entry: Waiting = { cited, keys, arKeys, firstAt: now, lastAt: 0, report: { ...r }, ...(opts.held ? { holdUntil: now + HOLD_MS } : {}) };
    cache[r.fp] = entry;
    dirty = true;
    if (budget > 0 && canWork()) {
      budget -= 1;
      entry.lastAt = now;
      const found = await find(entry);
      if (found) {
        const e = (cache[r.fp] = { found, at: now, cited, keys });
        apply(r, found);
        await readFrom(r, e);
        await learn(found, e, r.fp);
        continue;
      }
    }
    // Not found yet: the relay is held back while the search goes on.
    if (entry.holdUntil) opts.held?.add(r.fp);
  }

  const late: LiveReport[] = [];
  /** Another relay held with this one: dropped when the original is found, released with it when not. */
  const settleFollowers = (lfp: string, found: Found | null) => {
    for (const [fp, e] of Object.entries(cache)) {
      if ("found" in e || e.follows !== lfp || e.released) continue;
      e.released = true;
      dirty = true;
      if (found) cache[fp] = { found: { ...found, readBy: lfp }, at: now, cited: e.cited, keys: e.keys, held: true };
      else late.push({ ...e.report });
    }
  };

  // Held reports first: searched every few minutes for three hours, then
  // published from the relay if the original never turned up.
  const held = Object.entries(cache)
    .filter((x): x is [string, Waiting] => !("found" in x[1]) && !!x[1].holdUntil && !x[1].released && !x[1].follows)
    .sort((a, b) => a[1].firstAt - b[1].firstAt);
  for (const [fp, e] of held) {
    if (now >= (e.holdUntil ?? 0)) {
      e.released = true;
      dirty = true;
      late.push({ ...e.report, citing: e.cited.name });
      settleFollowers(fp, null);
      console.log(`[origin] no original for ${fp} in ${HOLD_MS / 3600_000} h: published from the relay`);
      continue;
    }
    if (holds <= 0 || !canWork() || now - e.lastAt < holdEvery(now - e.firstAt)) continue;
    holds -= 1;
    e.lastAt = now;
    dirty = true;
    const found = await find(e);
    if (!found) continue;
    const r = { ...e.report };
    const fe = (cache[fp] = { found, at: now, cited: e.cited, keys: e.keys, held: true });
    apply(r, found);
    await readFrom(r, fe);
    await learn(found, fe, fp);
    settleFollowers(fp, found);
    late.push(r);
  }

  // Released reports: hourly, for a day after the report, the published relay
  // is swapped for its original if it turns up. Then originals found but not
  // yet read, when their next try is due.
  for (const [fp, e] of Object.entries(cache)) {
    if (budget <= 0 || !canWork()) break;
    if ("found" in e || e.follows || (e.holdUntil && !e.released) || now - e.firstAt > GIVE_UP_MS || now - e.lastAt < RETRY_MS) continue;
    budget -= 1;
    e.lastAt = now;
    dirty = true;
    const found = await find(e);
    if (!found) continue;
    const r = { ...e.report };
    const fe = (cache[fp] = { found, at: now, cited: e.cited, keys: e.keys });
    apply(r, found);
    await readFrom(r, fe);
    await learn(found, fe, fp);
    late.push(r);
  }
  for (const e of Object.values(cache)) {
    if (reads <= 0 || !canWork()) break;
    if (!("found" in e) || !e.report || e.found.readBy || (e.found.nextReadAt ?? 0) > now || (e.found.fails ?? 0) >= READ_TRIES) continue;
    await readFrom({ ...e.report }, e);
  }

  if (routes) {
    const log = (await store.getJson<RouteLog>(ROUTES_KEY)) ?? {};
    for (const [host, e] of Object.entries(routes)) {
      const into = (log[host] ??= { routes: {}, lastAt: 0, last: e.last });
      for (const [k, n] of Object.entries(e.routes)) into.routes[k as Route] = (into.routes[k as Route] ?? 0) + (n ?? 0);
      into.lastAt = e.lastAt;
      into.last = e.last;
    }
    await store.putJson(ROUTES_KEY, log);
  }
  if (JSON.stringify(registry) !== regBefore) await store.putJson(REGISTRY_KEY, registry);
  if (dirtyLearned && learned) await store.putJson(LEARNED_KEY, learned);
  if (dirty) {
    const stamp = (e: Entry) => ("found" in e ? e.at : e.firstAt);
    const kept = Object.entries(cache)
      .sort((a, b) => stamp(b[1]) - stamp(a[1]))
      .slice(0, CACHE_MAX);
    await store.putJson(CACHE_KEY, Object.fromEntries(kept));
  }
  return late;
}

/** Words said to the carrier itself ("told Al Arabiya", "في مقابلة مع العربية"): first-hand. */
export function saidTo(text: string, carrier: string): boolean {
  const first = carrier.split(/\s+/).find((w) => w.length >= 3 && !/^(?:al|the)$/i.test(w));
  if (!first) return false;
  const name = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(String.raw`(?:\btold|\binterview with|\bin remarks to|\bspeaking to|لـ|في مقابلة مع|في حديث (?:ل|مع))\s*(?:the\s+)?[«"]?(?:al-?\s?)?${name}`, "i").test(text);
}
