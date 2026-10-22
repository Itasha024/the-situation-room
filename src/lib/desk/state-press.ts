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

/**
 * Each country's own media as the site names its sources: state agencies and
 * official channels first, then the country's main outlets. A name matches a
 * source that is it or starts with it ("Mehr News" and "Mehr News Agency").
 */
export const STATE_PRESS: Record<string, string[]> = {
  IR: [
    "Khamenei's office", "Iran's Supreme National Security Council", "Iran Foreign Ministry", "IRNA", "IRIB News", "Tasnim", "Fars News",
    "Mehr News", "ISNA", "ILNA", "IMNA", "Mizan", "Press TV", "Tehran Times", "Nour News", "SNN", "Al-Alam", "Atomic Energy Organization of Iran", "IRGC Navy",
  ],
  LB: ["Lebanese presidency", "Lebanon's prime minister's office", "Lebanon Foreign Ministry", "Lebanese Army", "NNA", "National News Agency", "Al-Manar", "LBCI", "MTV Lebanon", "Al Jadeed", "NBN", "Al-Akhbar", "Al Mayadeen", "Nidaa al-Watan", "Ad-Diyar", "Al-Modon"],
  IQ: ["Iraq Foreign Ministry", "INA", "Iraqi News Agency", "Iraqi government", "Shafaq News", "Iraqinews", "Rudaw", "Kurdistan24", "Al-Sumaria", "Baghdad Today"],
  QA: ["Emir of Qatar", "Qatar's Amiri Diwan", "Qatar's prime minister", "Majed al-Ansari", "QNA", "Qatar Foreign Ministry", "Al Jazeera"],
  OM: ["Oman News Agency", "Badr Albusaidi", "Oman Foreign Ministry"],
  AE: ["WAM", "Abu Dhabi Media Office", "Dubai Media Office", "Anwar Gargash", "UAE emergency authority", "UAE Foreign Ministry", "The National"],
  SA: ["SPA", "Saudi Press Agency", "Saudi Foreign Ministry", "Saudi Energy Ministry", "Saudi Defense Ministry", "Al Arabiya", "Asharq Al-Awsat", "Al Ekhbariya", "Arab News", "Saudi Gazette"],
  KW: ["KUNA", "Kuwait Petroleum Corporation", "Kuwait Foreign Ministry"],
  BH: ["BNA", "Bahrain Foreign Ministry"],
  PK: ["Pakistan's prime minister's office", "Shehbaz Sharif", "Ishaq Dar", "Pakistan Foreign Office", "ISPR", "Pakistan Armed Forces", "APP", "Dawn", "Samaa", "Geo"],
  RU: ["Kremlin", "Russia Foreign Ministry", "TASS", "RIA Novosti", "Interfax", "RT"],
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
