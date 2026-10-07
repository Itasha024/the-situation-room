/**
 * Any country's official bodies, by the words the relays use for them, not a
 * fixed list of names: "الخارجية المصرية", "وزير الدفاع الباكستاني", "Egypt's
 * Foreign Ministry", "the British government", "Pakistan's defence minister".
 * Each is traced to where that body publishes first: the ministry's own X
 * account and site, then the country's national agency and press, then the
 * wires. Yemen and Israel are not here: Yemen's own bodies are the desk's
 * sources, Israel's never are.
 */

import type { Cited } from "./origin.ts";

type Country = {
  code: string;
  /** "Egypt|Egyptian" in English; the Arabic stem ("مصر" matches مصر, المصري, المصرية). */
  en: string;
  ar: string;
  name: string;
  /** The foreign ministry's site and X account. */
  mfa?: string;
  mfaX?: string;
  /** The national agency (the government's own statements run there first) and the main press. */
  agency: string;
  press: string[];
};

const C = (code: string, name: string, en: string, ar: string, agency: string, press: string[], mfa?: string, mfaX?: string): Country => ({ code, name, en, ar, agency, press, mfa, mfaX });

export const COUNTRIES: Country[] = [
  C("SA", "Saudi", "Saudi(?: Arabia)?|Saudi Arabian", "سعود", "spa.gov.sa", ["aawsat.com", "arabnews.com", "okaz.com.sa", "alarabiya.net"], "mofa.gov.sa", "KSAMOFA"),
  C("EG", "Egypt", "Egypt|Egyptian", "مصر", "mena.org.eg", ["ahram.org.eg", "youm7.com", "almasryalyoum.com", "sis.gov.eg"], "mfa.gov.eg", "MfaEgypt"),
  C("PK", "Pakistan", "Pakistan|Pakistani", "باكستان", "app.com.pk", ["dawn.com", "geo.tv", "tribune.com.pk"], "mofa.gov.pk", "ForeignOfficePk"),
  C("IR", "Iran", "Iran|Iranian", "إيران", "irna.ir", ["tasnimnews.ir", "presstv.ir", "mehrnews.com", "farsnews.ir", "isna.ir"], "mfa.gov.ir", "IRIMFA_EN"),
  C("OM", "Oman", "Oman|Omani", "عمان", "omannews.gov.om", ["timesofoman.com", "omanobserver.om"], "fm.gov.om", "FMofOman"),
  C("AE", "UAE", "UAE|Emirati|United Arab Emirates", "إمارات", "wam.ae", ["thenationalnews.com", "alkhaleej.ae", "gulfnews.com"], "mofa.gov.ae", "mofauae"),
  C("QA", "Qatar", "Qatar|Qatari", "قطر", "qna.org.qa", ["aljazeera.net", "aljazeera.com", "thepeninsulaqatar.com"], "mofa.gov.qa", "MofaQatar_AR"),
  C("KW", "Kuwait", "Kuwait|Kuwaiti", "كويت", "kuna.net.kw", ["alraimedia.com", "arabtimesonline.com"], "mofa.gov.kw", "MOFAKuwait"),
  C("BH", "Bahrain", "Bahrain|Bahraini", "بحرين", "bna.bh", ["gdnonline.com", "alwatannews.net"], "mofa.gov.bh", "bahdiplomatic"),
  C("IQ", "Iraq", "Iraq|Iraqi", "عراق", "ina.iq", ["shafaq.com", "rudaw.net"], "mofa.gov.iq", "Iraqimofa"),
  C("JO", "Jordan", "Jordan|Jordanian", "أردن", "petra.gov.jo", ["jordantimes.com", "alghad.com"], "mfa.gov.jo", "ForeignMinistry"),
  C("TR", "Turkey", "Turkey|Türkiye|Turkiye|Turkish", "ترك", "aa.com.tr", ["trthaber.com", "dailysabah.com", "hurriyet.com.tr"], "mfa.gov.tr", "MFATurkiye"),
  C("SO", "Somalia", "Somalia|Somali", "صومال", "sonna.so", ["hiiraan.com", "garoweonline.com"], "mfa.gov.so", "MOFASomalia"),
  C("DJ", "Djibouti", "Djibouti|Djiboutian", "جيبوت", "adi.dj", ["lanationdj.com"]),
  C("ER", "Eritrea", "Eritrea|Eritrean", "إريتر", "shabait.com", []),
  C("SD", "Sudan", "Sudan|Sudanese", "سودان", "suna-sd.net", ["sudantribune.com"]),
  C("LB", "Lebanon", "Lebanon|Lebanese", "لبنان", "nna-leb.gov.lb", ["naharnet.com", "lorientlejour.com"]),
  C("SY", "Syria", "Syria|Syrian", "سوري", "sana.sy", []),
  C("US", "US", "US|U\\.S\\.|United States|American", "(?:أمريك|أميرك)", "state.gov", ["apnews.com", "reuters.com", "nytimes.com", "washingtonpost.com", "wsj.com", "cnn.com", "politico.com", "axios.com"], "state.gov", "StateDept"),
  C("UK", "UK", "UK|British|Britain|United Kingdom", "بريطان", "gov.uk", ["bbc.com", "theguardian.com", "thetimes.com", "telegraph.co.uk", "news.sky.com", "ft.com"], "gov.uk", "FCDOGovUK"),
  C("FR", "France", "France|French", "فرنس", "afp.com", ["lemonde.fr", "lefigaro.fr", "france24.com", "rfi.fr"], "diplomatie.gouv.fr", "francediplo"),
  C("DE", "Germany", "Germany|German", "ألمان", "dpa.com", ["spiegel.de", "faz.net", "dw.com", "tagesschau.de"], "auswaertiges-amt.de", "AuswaertigesAmt"),
  C("IT", "Italy", "Italy|Italian", "إيطالي", "ansa.it", ["repubblica.it", "corriere.it"], "esteri.it", "ItalyMFA"),
  C("RU", "Russia", "Russia|Russian", "روس", "tass.com", ["tass.ru", "ria.ru", "interfax.ru", "rt.com"], "mid.ru", "mfa_russia"),
  C("CN", "China", "China|Chinese", "صين", "news.cn", ["xinhuanet.com", "globaltimes.cn", "chinadaily.com.cn"], "fmprc.gov.cn", "MFA_China"),
  C("IN", "India", "India|Indian", "هند", "pib.gov.in", ["thehindu.com", "hindustantimes.com", "indianexpress.com"], "mea.gov.in", "MEAIndia"),
  C("JP", "Japan", "Japan|Japanese", "يابان", "kyodonews.net", ["japantimes.co.jp", "nhk.or.jp"], "mofa.go.jp", "MofaJapan_en"),
  C("GR", "Greece", "Greece|Greek", "يونان", "amna.gr", ["ekathimerini.com"], "mfa.gr", "GreeceMFA"),
];

type Role = { key: string; label: string; en: string; ar: string; foreign?: boolean };
/** The bodies and posts, in English and Arabic. Arabic puts the post first: "وزير الدفاع الباكستاني". */
const ROLES: Role[] = [
  { key: "mfa", label: "Foreign Ministry", foreign: true, en: "foreign (?:ministry|minister|office|secretary)|ministry of foreign affairs|minister of foreign affairs", ar: "(?:وزارة\\s+|وزير\\s+|وزيرة\\s+)?(?:ال)?خارجية" },
  { key: "mod", label: "Defence Ministry", en: "defen[cs]e (?:ministry|minister|secretary)|ministry of defen[cs]e|minister of defen[cs]e", ar: "(?:وزارة\\s+|وزير\\s+)(?:ال)?دفاع" },
  { key: "moi", label: "Interior Ministry", en: "interior (?:ministry|minister)|ministry of (?:the )?interior", ar: "(?:وزارة\\s+|وزير\\s+)(?:ال)?داخلية" },
  { key: "pm", label: "Prime Minister", en: "prime minister|premier", ar: "رئيس\\s+(?:ال)?وزراء" },
  { key: "pres", label: "Presidency", en: "president(?:ial office)?|presidency", ar: "(?:ال)?رئاسة|(?:ال)?رئيس" },
  { key: "gov", label: "Government", en: "government|cabinet", ar: "(?:ال)?حكومة" },
  { key: "emb", label: "Embassy", en: "embassy|ambassador", ar: "(?:ال)?سفارة|(?:ال)?سفير" },
  { key: "army", label: "Armed Forces", en: "army|armed forces|military|navy", ar: "(?:ال)?جيش|(?:ال)?قوات\\s+(?:ال)?مسلحة|(?:ال)?بحرية" },
];

/**
 * One matcher per country and post. Yemen is left out; so is Saudi Arabia's
 * foreign and defence ministry, which the table in origin.ts already sends to
 * SPA, and the few US bodies it names (the Pentagon, the White House).
 */
export const OFFICIAL_BODIES: [RegExp, Cited][] = COUNTRIES.flatMap((c) =>
  ROLES.map((r): [RegExp, Cited] => {
    // The country's name as written ("US", never "us"); the post in any case.
    const en = String.raw`\b(?:(?:[Tt]he\s+)?(?:${c.en})(?:'s|’s)?\s+(?i:${r.en})|(?i:${r.en})\s+of\s+(?:the\s+)?(?:${c.en}))\b`;
    const ar = String.raw`(?:${r.ar})\s+(?:ال)?${c.ar}`;
    const site = r.foreign && c.mfa ? c.mfa : c.agency;
    return [
      new RegExp(`${en}|${ar}`),
      { name: `${c.name} ${r.label}`, site, lang: "en", kind: "official", country: c.code, generic: true, ...(r.foreign && c.mfaX ? { x: c.mfaX } : {}) },
    ];
  }),
);

/**
 * International bodies with their own accounts (the user's list, 30 Sep):
 * each is looked up there first when a relay carries its words.
 */
export const BODIES: [RegExp, Cited][] = [
  [/وزارة الطاقة الأمريكية|وزارة الطاقة الأميركية|US (?:Energy Department|Department of Energy)|Energy Secretary/i, { name: "US Energy Department", site: "energy.gov", lang: "en", kind: "official", country: "US", x: "ENERGY" }],
  [/وزارة الخزانة الأمريكية|الخزانة الأمريكية|الخزانة الأميركية|US Treasury|Treasury Department|OFAC/i, { name: "US Treasury", site: "home.treasury.gov", lang: "en", kind: "official", country: "US", x: "USTreasury" }],
  [/السفارة الأمريكية (?:لدى|في) اليمن|السفير الأمريكي (?:لدى|في) اليمن|US Embassy (?:in|to) Yemen|US ambassador to Yemen/i, { name: "US Embassy Yemen", site: "ye.usembassy.gov", lang: "en", kind: "official", country: "US", x: "USEmbassyYemen" }],
  [/وزارة الطاقة السعودية|وزير الطاقة السعودي|Saudi (?:Energy Ministry|Ministry of Energy|energy minister)/i, { name: "Saudi Energy Ministry", site: "spa.gov.sa", lang: "en", kind: "official", country: "SA", x: "MoEnergy_Saudi" }],
  [/هيئة قناة السويس|Suez Canal Authority/i, { name: "Suez Canal Authority", site: "suezcanal.gov.eg", lang: "en", kind: "official", country: "EG", x: "SuezAuthorityEG" }],
  [/المفوضية الأوروبية|European Commission/i, { name: "European Commission", site: "ec.europa.eu", lang: "en", kind: "official", country: "EU", x: "EU_Commission" }],
  [/بعثة الاتحاد الأوروبي (?:لدى|في|إلى) اليمن|EU (?:delegation|mission|ambassador) (?:in|to) Yemen/i, { name: "EU in Yemen", site: "eeas.europa.eu", lang: "en", kind: "official", country: "EU", x: "EUinYemen" }],
  [/أسبيدس|اسبيدس|\bAspides\b/i, { name: "EUNAVFOR Aspides", site: "eeas.europa.eu", lang: "en", kind: "official", country: "EU", x: "EUNAVFORASPIDES" }],
  [/أتالانتا|\bAtalanta\b|EUNAVFOR/i, { name: "EUNAVFOR Atalanta", site: "eunavfor.eu", lang: "en", kind: "official", country: "EU", x: "EUNAVFOR" }],
  [/القوات البحرية المشتركة|Combined Maritime Forces|\bCMF\b|\bJMIC\b/, { name: "Combined Maritime Forces", site: "combinedmaritimeforces.com", lang: "en", kind: "official", country: "US", x: "CMF_Bahrain" }],
  [/الأمم المتحدة في اليمن|UN (?:in|office in) Yemen|UN Resident Coordinator/i, { name: "UN in Yemen", site: "yemen.un.org", lang: "en", kind: "official", country: "UN", x: "UNinYE" }],
  [/الأمين العام للأمم المتحدة|UN Secretary[- ]General/i, { name: "UN Secretary-General", site: "un.org", lang: "en", kind: "official", country: "UN", x: "antonioguterres" }],
  // The user's 3 Oct review: each of these was told by a relay while its own
  // account had it first (10:07, 10:58, 10:53, 11:11), and the Coast Guard is
  // the government's official account at sea.
  [/الدفاع المدني السعودي|المديرية العامة للدفاع المدني|الدفاع المدني (?:ب|في )?(?:منطقة|المملكة)|Saudi Civil Defen[cs]e/i, { name: "Saudi Civil Defense", site: "998.gov.sa", lang: "ar", kind: "official", country: "SA", x: "SaudiDCD" }],
  [/وزير حقوق الإنسان|مشدل|(?:Yemen(?:'s|i))? (?:human rights minister|minister of human rights)/i, { name: "Yemen's human rights minister", site: "sabanew.net", lang: "ar", kind: "official", country: "YE", x: "mashdal" }],
  [/ستيفن داوتي|Stephen Doughty|UK (?:Middle East|MENA) minister|وزير (?:الدولة )?البريطاني لشؤون الشرق الأوسط/i, { name: "UK Middle East minister", site: "gov.uk", lang: "en", kind: "official", country: "UK", x: "SDoughtyMP" }],
  [/محور تعز|Taiz (?:military )?axis/i, { name: "Taiz military axis", site: "sabanew.net", lang: "ar", kind: "official", country: "YE", x: "axistaiz" }],
  [/خفر السواحل اليمني|مصلحة خفر السواحل|Yemen(?:i|'s) Coast Guard/i, { name: "Yemeni Coast Guard", site: "sabanew.net", lang: "ar", kind: "official", country: "YE", x: "d74054" }],
];

/** The UN in general: last, after its agencies and envoy (origin.ts). */
export const UN_BODY: [RegExp, Cited] = [/الأمم المتحدة|\bUnited Nations\b/i, { name: "United Nations", site: "news.un.org", lang: "en", kind: "official", country: "UN", x: "UN", generic: true }];

/** Each country's own press, by code: where its officials' words run first. */
export const OFFICIAL_PRESS: Record<string, string[]> = Object.fromEntries(COUNTRIES.map((c) => [c.code, [...new Set([c.agency, ...c.press])]]));
