/**
 * Foreign leaders and officials whose words reach the desk through someone
 * else: a channel posting "Macron: France will send soldiers to Yanbu" relays
 * an interview he gave in France. Such a card is secondhand even when it names
 * no outlet, and the original — his own post, his office's statement, or his
 * country's press on the day — is looked for in his language.
 *
 * Yemeni and Saudi speakers are not here: their channels are the desk's own
 * sources.
 */

import type { Edition } from "./gnews.ts";

export type Speaker = {
  name: string;
  /** How the name is written in the copy, English and Arabic. */
  re: RegExp;
  country: string;
  /** The language his words are first published in, and the Google News edition for it. */
  lang: string;
  edition: Edition;
  /** His own X account (read through FxTwitter). */
  x?: string;
  /** His office's own site. */
  official?: string;
};

const S = (name: string, re: RegExp, country: string, lang: string, edition: Edition, x?: string, official?: string): Speaker => ({ name, re, country, lang, edition, x, official });

export const SPEAKERS: Speaker[] = [
  S("Emmanuel Macron", /\bMacron\b|ماكرون/, "FR", "French", "fr", "EmmanuelMacron", "elysee.fr"),
  S("Jean-Noël Barrot", /\bBarrot\b|بارو\b/, "FR", "French", "fr", "jnbarrot", "diplomatie.gouv.fr"),
  S("Donald Trump", /\bTrump\b|ترامب/, "US", "English", "en", "realDonaldTrump", "whitehouse.gov"),
  S("Marco Rubio", /\bRubio\b|روبيو/, "US", "English", "en", "SecRubio", "state.gov"),
  S("Pete Hegseth", /\bHegseth\b|هيغسيث|هيجسيث/, "US", "English", "en", "PeteHegseth", "war.gov"),
  S("JD Vance", /\bVance\b|فانس/, "US", "English", "en", "JDVance", "whitehouse.gov"),
  S("Steve Witkoff", /\bWitkoff\b|ويتكوف/, "US", "English", "en"),
  S("Karoline Leavitt", /\bLeavitt\b|ليفيت/, "US", "English", "en", "PressSec", "whitehouse.gov"),
  S("Keir Starmer", /\bStarmer\b|ستارمر/, "UK", "English", "gb", "Keir_Starmer", "gov.uk"),
  S("Yvette Cooper", /\bYvette Cooper\b|إيفيت كوبر/, "UK", "English", "gb", "YvetteCooperMP", "gov.uk"),
  S("John Healey", /\bHealey\b|هيلي/, "UK", "English", "gb", "JohnHealey_MP", "gov.uk"),
  S("Masoud Pezeshkian", /\bPezeshkian\b|بزشكيان/, "IR", "Persian", "en", "drpezeshkian", "president.ir"),
  S("Abbas Araghchi", /\bAraghchi\b|عراقجي/, "IR", "Persian", "en", "araghchi", "mfa.gov.ir"),
  S("Ali Khamenei", /\bKhamenei\b|خامنئي/, "IR", "Persian", "en", "khamenei_ir", "khamenei.ir"),
  S("Esmaeil Baghaei", /\bBaghaei\b|بقائي/, "IR", "Persian", "en", "IRIMFA_SPOX", "mfa.gov.ir"),
  S("Abdel Fattah al-Sisi", /\bSisi\b|السيسي/, "EG", "Arabic", "ar", "AlsisiOfficial", "presidency.eg"),
  S("Badr Abdelatty", /\bAbdelatty\b|عبد ?العاطي/, "EG", "Arabic", "ar", undefined, "mfa.gov.eg"),
  S("Badr Albusaidi", /\bBusaidi\b|البوسعيدي/, "OM", "Arabic", "ar", "badralbusaidi", "fm.gov.om"),
  S("Majed al-Ansari", /\bMajed al-Ansari\b|ماجد الأنصاري/, "QA", "Arabic", "ar", "majedalansari", "mofa.gov.qa"),
  S("Anwar Gargash", /\bGargash\b|قرقاش/, "AE", "Arabic", "ar", "AnwarGargash"),
  S("Recep Tayyip Erdogan", /\bErdo[gğ]an\b|أردوغان/, "TR", "Turkish", "tr", "RTErdogan", "tccb.gov.tr"),
  S("Hakan Fidan", /\bFidan\b|فيدان/, "TR", "Turkish", "tr", "HakanFidan", "mfa.gov.tr"),
  S("Shehbaz Sharif", /\bShehbaz\b|شهباز/, "PK", "English", "en", "CMShehbaz", "pmo.gov.pk"),
  S("Ishaq Dar", /\bIshaq Dar\b|إسحاق دار/, "PK", "English", "en", "MIshaqDar50", "mofa.gov.pk"),
  S("Vladimir Putin", /\bPutin\b|بوتين/, "RU", "Russian", "ru", undefined, "kremlin.ru"),
  S("Sergey Lavrov", /\bLavrov\b|لافروف/, "RU", "Russian", "ru", undefined, "mid.ru"),
  S("Maria Zakharova", /\bZakharova\b|زاخاروفا/, "RU", "Russian", "ru", undefined, "mid.ru"),
  S("Wang Yi", /\bWang Yi\b|وانغ يي/, "CN", "Chinese", "en", undefined, "fmprc.gov.cn"),
  S("António Guterres", /\bGuterres\b|غوتيريش|جوتيريش/, "UN", "English", "en", "antonioguterres", "un.org"),
  S("Hans Grundberg", /\bGrundberg\b|غروندبرغ|جروندبرج/, "UN", "English", "en", "OSE_Yemen", "osesgy.unmissions.org"),
  S("Stéphane Dujarric", /\bDujarric\b|دوجاريك/, "UN", "English", "en", undefined, "un.org"),
  S("Ursula von der Leyen", /\bvon der Leyen\b|فون ?دير ?لاين/, "EU", "English", "en", "vonderleyen", "ec.europa.eu"),
  S("Kaja Kallas", /\bKallas\b|كالاس/, "EU", "English", "en", "kajakallas", "eeas.europa.eu"),
  S("Giorgia Meloni", /\bMeloni\b|ميلوني/, "IT", "Italian", "it", "GiorgiaMeloni", "governo.it"),
  S("Friedrich Merz", /\bMerz\b|ميرتس/, "DE", "German", "de", "bundeskanzler", "bundesregierung.de"),
];

/** Where a speaker's words are said: "Macron:", "Macron said", "قال ماكرون". */
const SPEECH_EN = /\b(?:said|says|told|tells|announced|announces|stated|declared|warned|warns|pledged|vowed|added|confirmed|stressed|called|urged|:)/i;
const SPEECH_AR = /(?:قال|أعلن|صرح|أكد|حذر|تعهد|أضاف|دعا|:)/;

/**
 * The foreign speaker whose words a card relays, or null. His name must stand
 * within a few words of a speech verb or a colon, so a card about him ("strikes
 * after Trump's warning") is not his words.
 */
export function speakerOf(summary: string, text = ""): Speaker | null {
  const t = `${summary}\n${text}`.slice(0, 600);
  for (const sp of SPEAKERS) {
    const m = sp.re.exec(t);
    if (!m) continue;
    const around = t.slice(Math.max(0, m.index - 24), m.index + m[0].length + 40);
    if (SPEECH_EN.test(around) || SPEECH_AR.test(around)) return sp;
  }
  return null;
}

/**
 * Is the carrier the speaker's own voice, or his country's press? Then the
 * card is not secondhand: an Elysée post, Le Monde, or a wire reporting Macron.
 */
export function ownCarrier(sp: Speaker, carrierUrl: string, countrySites: string[]): boolean {
  let host = "";
  try {
    host = new URL(carrierUrl).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
  if (sp.x && /(?:^|\.)(?:x|twitter)\.com$/.test(host) && carrierUrl.toLowerCase().includes(`/${sp.x.toLowerCase()}/`)) return true;
  if (sp.official && (host === sp.official || host.endsWith(`.${sp.official}`))) return true;
  return countrySites.some((s) => host === s || host.endsWith(`.${s}`));
}
