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
  // The Iran war's American voices (user, 9 Oct: Bessent's words went out
  // from Iran International, never looked for in America's own press).
  S("Scott Bessent", /\bBessent\b|بيسنت|بسنت/, "US", "English", "en", "SecScottBessent", "home.treasury.gov"),
  S("Dan Caine", /\b(?:Dan|Gen\.?|General) Caine\b/, "US", "English", "en", undefined, "war.gov"),
  S("Brad Cooper", /\b(?:Brad|Adm\.?|Admiral) Cooper\b/, "US", "English", "en", "CENTCOM", "centcom.mil"),
  S("Mike Waltz", /\bWaltz\b|والتز/, "US", "English", "en", undefined, "usun.usmission.gov"),
  S("Chris Wright", /\bChris Wright\b|\bEnergy Secretary Wright\b/, "US", "English", "en", "SecretaryWright", "energy.gov"),
  S("John Ratcliffe", /\bRatcliffe\b|راتكليف/, "US", "English", "en", undefined, "cia.gov"),
  S("Howard Lutnick", /\bLutnick\b|لوتنيك/, "US", "English", "en", "howardlutnick", "commerce.gov"),
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

/**
 * An American official the list does not name, by the title the copy gives
 * him: "US Senator Jim Risch said", "US Navy Admiral X told". His words are
 * looked for in America's own press as a listed speaker's are (user, 9 Oct).
 */
const US_TITLED = /\b(?:US|U\.S\.|American|Pentagon|White House|Treasury|State Department|CENTCOM)\b[^.:\n]{0,30}?\b(?:Secretary|spokes(?:man|woman|person)|Senator|Sen\.|Representative|Rep\.|Congress(?:man|woman)|envoy|ambassador|General|Gen\.|Admiral|Adm\.|commander|press secretary)\s+((?:[A-Z][a-z'-]+\.? ){0,2}[A-Z][a-z'-]{2,})/;
const made = new Map<string, Speaker>();
export function titledSpeaker(text: string): Speaker | null {
  const m = US_TITLED.exec(text);
  if (!m) return null;
  const name = m[1].trim();
  const known = SPEAKERS.find((sp) => sp.re.test(name));
  if (known) return known;
  const last = name.split(" ").pop() as string;
  const sp = made.get(name) ?? { name, re: new RegExp(`\\b${last}\\b`), country: "US", lang: "English", edition: "en" as Edition };
  made.set(name, sp);
  return sp;
}
/** A speaker by name: the list's, or an official met by his title. */
export function speakerByName(name: string): Speaker | null {
  return SPEAKERS.find((s) => s.name === name) ?? made.get(name) ?? null;
}

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
  // The one named first speaks: "Hegseth: Trump wants peace" is Hegseth's
  // words about Trump, not Trump's (user, 8 Oct: it went out "citing Donald Trump").
  let best: Speaker | null = null;
  let at = Infinity;
  for (const sp of SPEAKERS) {
    const m = sp.re.exec(t);
    if (!m || m.index >= at) continue;
    const around = t.slice(Math.max(0, m.index - 24), m.index + m[0].length + 40);
    if (SPEECH_EN.test(around) || SPEECH_AR.test(around)) {
      best = sp;
      at = m.index;
    }
  }
  if (best) return best;
  const titled = titledSpeaker(t);
  const at2 = titled ? t.search(titled.re) : -1;
  return titled && at2 >= 0 && (SPEECH_EN.test(t.slice(at2, at2 + 60)) || SPEECH_AR.test(t.slice(at2, at2 + 60))) ? titled : null;
}

/** The known figure who speaks in a headline: the one before its colon, or before "says". */
export function leadSpeaker(summary: string): Speaker | null {
  const h = String(summary || "");
  const lead = /^([^:"“]{2,70}):\s/.exec(h)?.[1] ?? /^(.{2,70}?)\s+(?:says|said|tells|told)\b/.exec(h)?.[1] ?? "";
  return lead ? (SPEAKERS.find((sp) => sp.re.test(lead)) ?? null) : null;
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
