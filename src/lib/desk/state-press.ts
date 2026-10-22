/**
 * Where a relay's original is first looked for: what the site already read in
 * the last hours, from the speaker's or outlet's own channel and from the
 * speaker's country's own media (user, 22 Oct: "you can spend 3 hours
 * searching for pezeshkian channel posting his things and you wont find it
 * but you can spend half a minute searching for his things in iranian media").
 *
 * The old look-up matched English keywords against the posts, so a Persian
 * IRNA post or Fars's own Telegram never matched: of 600 relays traced on the
 * Iran desk, 426 went out from the relay (Pezeshkian found 8 times in 78,
 * Lavrov 0 in 35, Iran's foreign ministry 0 in 13). Here the keywords are put
 * into the country's languages first, the posts that carry them are short-
 * listed, and a model says which of them reports the relay's words.
 */

import type { Read } from "./recent-reads.ts";
import { IRAN_TG, IRAN_X } from "./iran-sources.ts";

/**
 * Iran's officials and bodies on their own X and Telegram accounts (user, 22 Oct: "iran also has the
 * many x accounts i gave you of officials like araghci etc"): one official's words are often first on
 * another's account (the spokesman quoting the minister), so every one of them is Iran's own.
 */
const IRAN_OFFICIAL_ACCOUNTS = [...IRAN_X, ...IRAN_TG]
  .filter((s) => s.lean === "axis" && !s.lebaneseMedia && !s.iraqiMedia && !/Tasnim|relay|Khabar|Fori|Unews|Emtedad|Press TV Hebrew|Al-Alam|ISNA|ILNA|IMNA|Ad-Diyar/i.test(s.name))
  .map((s) => s.name);

/**
 * Each country's own media as the site names its sources: state agencies and
 * official channels first, then the country's main outlets. A name matches a
 * source that is it or starts with it ("Mehr News" and "Mehr News Agency").
 */
export const STATE_PRESS: Record<string, string[]> = {
  IR: [
    "Khamenei's office", "Iran's Supreme National Security Council", "Iran Foreign Ministry", "IRNA", "IRIB News", "Tasnim", "Fars News",
    "Mehr News", "ISNA", "ILNA", "IMNA", "Mizan", "Press TV", "Tehran Times", "Nour News", "SNN", "Al-Alam", "Atomic Energy Organization of Iran", "IRGC Navy",
    ...IRAN_OFFICIAL_ACCOUNTS,
  ],
  LB: ["Lebanese presidency", "Lebanon's prime minister's office", "Lebanon Foreign Ministry", "Lebanese Army", "NNA", "National News Agency", "Al-Manar", "LBCI", "MTV Lebanon", "Al Jadeed", "NBN", "Al-Akhbar", "Al Mayadeen", "Nidaa al-Watan", "Ad-Diyar", "Al-Modon"],
  IQ: ["Iraq Foreign Ministry", "INA", "Iraqi News Agency", "Iraqi government", "Naya", "Shafaq News", "Iraqinews", "Rudaw", "Kurdistan24", "Al-Sumaria", "Baghdad Today"],
  QA: ["Emir of Qatar", "Qatar's Amiri Diwan", "Qatar's prime minister", "Majed al-Ansari", "QNA", "Qatar Foreign Ministry", "Al Jazeera"],
  OM: ["Oman News Agency", "Badr Albusaidi", "Oman Foreign Ministry"],
  AE: ["WAM", "Abu Dhabi Media Office", "Dubai Media Office", "Anwar Gargash", "UAE emergency authority", "UAE Foreign Ministry", "The National"],
  SA: ["SPA", "Saudi Press Agency", "Saudi Foreign Ministry", "Saudi Energy Ministry", "Saudi Defense Ministry", "Al Arabiya", "Asharq Al-Awsat", "Al Ekhbariya", "Arab News", "Saudi Gazette"],
  KW: ["KUNA", "Kuwait Petroleum Corporation", "Kuwait Foreign Ministry"],
  BH: ["BNA", "Bahrain Foreign Ministry"],
  PK: ["Pakistan's prime minister's office", "Shehbaz Sharif", "Ishaq Dar", "Pakistan Foreign Office", "ISPR", "Pakistan Armed Forces", "APP", "Dawn", "Samaa", "Geo"],
  RU: ["Kremlin", "Russia Foreign Ministry", "Maria Zakharova", "TASS", "RIA Novosti", "Interfax", "RT", "Sputnik"],
  CN: ["China Foreign Ministry", "Xinhua", "Global Times", "CGTN"],
  TR: ["Turkey Foreign Ministry", "Anadolu", "TRT"],
  EG: ["Egypt Foreign Ministry", "Egyptian presidency", "Al-Ahram"],
  US: [
    "White House", "Truth Social (Trump)", "State Department", "Pentagon", "CENTCOM", "Treasury", "Scott Bessent", "Marco Rubio", "Pete Hegseth",
    "Reuters", "AP", "Bloomberg", "WSJ", "NYT", "Washington Post", "Axios", "CNN", "CBS", "NBC News", "ABC", "Fox News", "Politico",
  ],
  UK: ["UK Foreign Office", "Downing Street", "UKMTO", "BBC", "The Telegraph", "The Guardian", "Financial Times", "The Times", "Sky News"],
  IL: ["Israel PM Office", "IDF", "IDF Farsi", "IDF Arabic", "Avichay Adraee", "Ella Waweya", "Mossad Farsi", "N12", "Kan", "Channel 13", "Channel 14", "Ynet", "Walla", "Haaretz", "Israel Hayom", "Jerusalem Post", "i24 News"],
  YE: ["Al-Masirah", "Saba", "Yahya Saree", "Houthi Armed Forces"],
  SY: ["SANA", "Syria Foreign Ministry"],
  JO: ["Petra", "Jordan Foreign Ministry"],
  FR: ["Elysée", "France Foreign Ministry", "AFP", "Le Monde", "France 24"],
  DE: ["Germany Foreign Office", "DW"],
  IT: ["ANSA", "Italy Foreign Ministry"],
};

/** The languages a country's own media write in, beyond English. */
export const PRESS_LANGS: Record<string, string[]> = {
  IR: ["Persian", "Arabic"],
  LB: ["Arabic"], IQ: ["Arabic"], QA: ["Arabic"], OM: ["Arabic"], AE: ["Arabic"], SA: ["Arabic"], KW: ["Arabic"], BH: ["Arabic"], YE: ["Arabic"], SY: ["Arabic"], JO: ["Arabic"], EG: ["Arabic"],
  RU: ["Russian"], CN: ["Chinese"], TR: ["Turkish"], IL: ["Hebrew", "Arabic"], FR: ["French"], DE: ["German"], IT: ["Italian"], PK: ["Urdu"],
};

/**
 * Channels that post others' news, mostly without saying whose (user, 22 Oct: "many times a relay
 * report wont state the og source"): their items are looked for among the site's own reads of the
 * outlets that do report, except what they tell first-hand (firstHand below).
 */
const RELAY_CHANNELS =
  /^(?:Khabar Fori|Khabari Plus|Akhbar-e Fori|Tehran Fori|Unews|Emtedad|Tasnim \(Arabic relay\)|Axis military relay|Sabereen News|Ali Bk|Al-Mihwar|Alfaqaar|Shajab News|Bin Saeed|Saudi News|Al-Yemen Now|Clash Report|OSINT ?defender|OSINT Hexagone|Egypt OSINT|Shin Persian|War Cube|Sentdefender)$/i;
export const isRelayChannel = (source: string): boolean => RELAY_CHANNELS.test(String(source || "").trim());

/** Sirens, blasts, interceptions, strikes and clashes as they happen: what a channel on the ground tells first. */
const ON_THE_GROUND =
  /\b(?:sirens?|explosions?|blasts?|intercept(?:ed|ion|s)?|air ?raid|alarms?|air strikes?|airstrikes?|strikes? (?:on|hit)|struck|shelling|gunfire|clashes|drones? (?:attack|strike|hit|launched)|missiles? (?:launched|fired|hit|attack)|rockets? (?:fired|launched)|attack(?:ed|s)? on)\b|صفارات|انفجار|دوي|اعتراض|غارة|غارات|قصف|استهداف|اشتباكات|آژیر|صدای انفجار|رهگیری|پدافند|אזעק|פיצוץ|יירוט/i;

/**
 * A relay channel's own news (user, 22 Oct: relays "can be og source if they report an exclusive
 * thing, or in sirens attacks and stuff like that"): its exclusive, or an attack, siren or blast it
 * reports, not someone's words ("Araghchi: the attack on…" is a statement, told by his ministry).
 */
export function firstHand(t: { summary?: string; text?: string; flags?: string[] }): boolean {
  const s = String(t.summary || "").trim();
  if (t.flags?.includes("exclusive") || /\bexclusive\b|حصري|اختصاصی/i.test(s)) return true;
  if (/^[^:"“]{3,90}:\s/.test(s)) return false;
  return ON_THE_GROUND.test(s) || (!s && ON_THE_GROUND.test(String(t.text || "").slice(0, 300)));
}

/** A country's name or adjective at the head of a speaker's role: "Iranian MP", "Iran's deputy FM", "Lavrov". */
export const ROLE_COUNTRY: [RegExp, string][] = [
  [/\b(?:Iranian|Iran's|IRGC|Iran|SNSC|Tehran|Khamenei|Pezeshkian|Araghchi|Baghaei|Ghalibaf|Larijani|Rezaei|Gharibabadi|Khatibzadeh|Mohajerani)\b/, "IR"],
  [/\b(?:Russian|Russia's|Russia|Kremlin|Lavrov|Zakharova|Putin|Peskov)\b/, "RU"], [/\b(?:Iraqi|Iraq's|Iraq|PMF|Kataib Hezbollah|Nujaba|al-Zaidi)\b/, "IQ"],
  [/\b(?:Lebanese|Lebanon's|Lebanon|Hezbollah|Berri|Aoun|Nawaf Salam|Qassem|Raggi)\b/, "LB"], [/\b(?:Qatari|Qatar's)\b/, "QA"], [/\b(?:Pakistani|Pakistan's)\b/, "PK"], [/\b(?:Saudi)\b/, "SA"],
  [/\b(?:Omani|Oman's)\b/, "OM"], [/\b(?:Emirati|UAE)\b/, "AE"], [/\b(?:Israeli|Israel's|IDF)\b/, "IL"], [/\b(?:US|American|Pentagon|White House)\b/, "US"],
  [/\b(?:Turkish|Turkey's)\b/, "TR"], [/\b(?:Chinese|China's)\b/, "CN"], [/\b(?:Egyptian|Egypt's)\b/, "EG"], [/\b(?:Syrian|Syria's)\b/, "SY"], [/\b(?:Houthi)\b/, "YE"],
];

/** The first country named in these words ("Lebanese minister on Iran ties" is Lebanon's). */
export function countryIn(words: string): string | undefined {
  let best: { at: number; c: string } | undefined;
  for (const [re, c] of ROLE_COUNTRY) {
    const m = re.exec(words);
    if (m && (!best || m.index < best.at)) best = { at: m.index, c };
  }
  return best?.c;
}

/** The country a headline's teller belongs to: the words before its colon, else its first words. */
export function leadCountry(summary: string): string | undefined {
  const s = String(summary || "").trim();
  return countryIn(/^([^:"“]{3,90}):\s/.exec(s)?.[1] ?? s.slice(0, 60));
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Is this source one of the country's own media? */
export function pressOf(source: string, country: string): number {
  const names = STATE_PRESS[country] ?? [];
  const s = norm(source);
  // The list's order is its rank: the state's own channels before its outlets.
  const i = names.findIndex((n) => {
    const x = norm(n);
    return x.length >= 2 && (s === x || s.startsWith(`${x} `) || (x.length >= 4 && s.startsWith(x)));
  });
  return i;
}

/** Persian and Arabic digits as Latin, and Persian letters as the Arabic ones, so figures and names match. */
export function folded(text: string): string {
  return String(text || "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[یى]/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .toLowerCase();
}

/** How many of the keys a post carries, in any of its languages. */
export function carried(text: string, keys: string[]): number {
  const t = ` ${folded(text).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return keys.filter((k) => {
    const w = folded(k).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    return w.length >= 2 && t.includes(` ${w}`);
  }).length;
}

export type PressCandidate = Read & { own: boolean; rank: number; hits: number };

/**
 * A relay channel's item that names no source: whoever reported it before it, among what the site
 * read (from twelve hours before to ten minutes after: two scans may read them in either order),
 * the country's own media first, then any outlet that is not itself a relay. Three of its keywords
 * in any language, so a story's surroundings do not match.
 */
export function earlierTellers(
  reads: Read[],
  o: { country?: string; notSource: string; onlyBefore?: boolean },
  keys: string[],
  reportAt: number,
  n = 5,
): PressCandidate[] {
  const out: PressCandidate[] = [];
  for (const r of reads) {
    if (r.source === o.notSource || r.at < reportAt - 12 * 3600_000 || r.at > reportAt + (o.onlyBefore ? 0 : 10 * 60_000)) continue;
    // Another relay's item counts only where it told it first-hand.
    if (isRelayChannel(r.source) && !firstHand({ text: r.text })) continue;
    const hits = carried(r.text, keys);
    if (hits < 3) continue;
    const rank = o.country ? pressOf(r.source, o.country) : -1;
    out.push({ ...r, own: false, rank: rank < 0 ? 999 : rank, hits });
  }
  return out.sort((a, b) => +(a.rank === 999) - +(b.rank === 999) || b.hits - a.hits || a.at - b.at).slice(0, n);
}

/**
 * The posts that may be the original: the owner's own and the country's own
 * media's, from twelve hours before the relay to half an hour after, carrying
 * two of its keywords in any language. The owner's own first, then the
 * country's media by rank, then the fuller match.
 */
export function pressCandidates(
  reads: Read[],
  o: { own: (r: Read) => boolean; country?: string },
  keys: string[],
  reportAt: number,
  notUrl = "",
  n = 5,
): PressCandidate[] {
  const out: PressCandidate[] = [];
  for (const r of reads) {
    if (r.url === notUrl || r.at < reportAt - 12 * 3600_000 || r.at > reportAt + 30 * 60_000) continue;
    const own = o.own(r);
    const rank = own ? -1 : o.country ? pressOf(r.source, o.country) : -1;
    if (!own && rank < 0) continue;
    const hits = carried(r.text, keys);
    if (hits < 2) continue;
    out.push({ ...r, own, rank, hits });
  }
  return out.sort((a, b) => +b.own - +a.own || b.hits - a.hits || a.rank - b.rank || a.at - b.at).slice(0, n);
}
