/**
 * The Gaza – Judea & Samaria desk's own sources (user, 23 Oct). Israeli, Palestinian, Arab and
 * international, official channels first. Every one was read through its public page on 23 Oct
 * (Telegram's t.me/s preview, FxTwitter for X); channels that show nothing to a reader who is not
 * signed in (the Qassam Brigades', Saraya al-Quds') are not read. The Israeli outlets, the IDF and
 * Israel's leaders are read for the Iran desk already (iran-sources.ts): what of theirs is about Gaza or
 * Judea and Samaria comes here through the site scan, not read twice.
 */
import { gnews } from "../yemen-scan.server.ts";

/** The groups the desk's filter buttons go by. */
export type GazaLean = "israel" | "pa" | "factions" | "palestinian" | "arab" | "intl";

export const GAZA_LEAN_LABELS: Record<GazaLean, string> = {
  israel: "Israeli",
  pa: "Palestinian Authority",
  factions: "Hamas and the factions",
  palestinian: "Palestinian",
  arab: "Arab",
  intl: "International",
};

type Src = { id: string; name: string; lean: GazaLean; every: number };
type Feed = { id: string; url: string; name: string; lean: GazaLean; every: number };

export const GAZA_TG: Src[] = [
  { id: "WAFAgency", name: "WAFA", lean: "pa", every: 5 },
  { id: "MOHMediaGaza", name: "Gaza Health Ministry", lean: "factions", every: 5 },
  { id: "qudsn", name: "Quds News Network", lean: "factions", every: 5 },
  { id: "SafaPs", name: "Safa", lean: "factions", every: 5 },
  { id: "palinfo", name: "Palestine Info Center", lean: "factions", every: 10 },
  { id: "QudsNen", name: "Quds News Network (English)", lean: "factions", every: 15 },
  { id: "gazanow", name: "Gaza Now", lean: "palestinian", every: 5 },
  { id: "maannews", name: "Ma'an", lean: "palestinian", every: 10 },
  { id: "timesofgaza", name: "Times of Gaza", lean: "palestinian", every: 10 },
  { id: "eye_on_palestine", name: "Eye on Palestine", lean: "palestinian", every: 10 },
  { id: "jeninnews", name: "Jenin News", lean: "palestinian", every: 10 },
  { id: "nablus_news", name: "Nablus News", lean: "palestinian", every: 10 },
  { id: "mdaisrael", name: "Magen David Adom", lean: "israel", every: 5 },
  { id: "cogatonline", name: "COGAT", lean: "israel", every: 15 },
];

export const GAZA_X: Src[] = [
  { id: "IsraelPolice", name: "Israel Police", lean: "israel", every: 15 },
  { id: "BoardOfPeace", name: "Board of Peace", lean: "intl", every: 15 },
  { id: "UNRWA", name: "UNRWA", lean: "intl", every: 30 },
  { id: "ochaopt", name: "OCHA", lean: "intl", every: 30 },
  { id: "ICRC_ilot", name: "ICRC", lean: "intl", every: 60 },
  { id: "UNSCO_MEPP", name: "UN Middle East envoy's office", lean: "intl", every: 60 },
  { id: "PalestineRCS", name: "Palestine Red Crescent", lean: "palestinian", every: 15 },
  { id: "ShehabAgency", name: "Shehab", lean: "factions", every: 10 },
  { id: "pmofa", name: "Palestinian Foreign Ministry", lean: "pa", every: 30 },
  { id: "MFAEgypt", name: "Egypt Foreign Ministry", lean: "arab", every: 30 },
  { id: "MofaQatar_AR", name: "Qatar Foreign Ministry", lean: "arab", every: 30 },
];

/**
 * The safety net: Google News each hour for the desk's words, in English, Arabic and Hebrew. They catch
 * the exclusives of outlets the desk does not read itself.
 */
export const GAZA_SEARCHES: Feed[] = [
  { id: "gz-en", name: "Google News", lean: "intl", every: 60, url: gnews('(Gaza OR "West Bank" OR "Judea and Samaria" OR Hamas OR UNRWA OR "Board of Peace" OR Hebron OR Jenin OR Nablus OR "Palestinian Authority") when:1h') },
  { id: "gz-ar", name: "Google News", lean: "arab", every: 60, url: gnews('(غزة OR "الضفة الغربية" OR حماس OR الأونروا OR "مجلس السلام" OR الخليل OR جنين OR نابلس OR "السلطة الفلسطينية") when:1h', "ar", "SA", "SA:ar") },
  { id: "gz-he", name: "Google News", lean: "israel", every: 60, url: gnews("(עזה OR \"יהודה ושומרון\" OR חמאס OR פיגוע OR מחבלים OR הרשות הפלסטינית) when:1h", "he", "IL", "IL:he") },
];

/** A source's group by its display name: the filter buttons and the reader's alignment note. */
const BY_NAME = new Map<string, GazaLean>([...GAZA_TG, ...GAZA_X].map((s) => [s.name, s.lean]));
const ISRAELI = /^(?:IDF|N12|Kan|Channel 1[234]|i24|Ynet|Walla|Haaretz|Israel Hayom|the Jerusalem Post|Times of Israel|Amit Segal|Avichay Adraee|Benjamin Netanyahu|Israel Katz|Gideon Saar|Israel Police|COGAT|Magen David Adom)/i;
const ARAB = /^(?:Al Jazeera|Al Arabiya|Al Hadath|Asharq|Sky News Arabia|Al-Araby|Al Mayadeen|Al-Akhbar|Erem|Arab News|Egypt|Qatar|Saudi|Jordan|UAE)/i;
export function gazaLeanOf(source: string): GazaLean {
  return BY_NAME.get(source) ?? (ISRAELI.test(source) ? "israel" : ARAB.test(source) ? "arab" : "intl");
}

/** The reader's note on who a source is. */
export const GAZA_ALIGNMENT: Record<GazaLean, string> = {
  israel: "Israeli (government, army or media)",
  pa: "the Palestinian Authority or its media",
  factions: "Hamas or the armed factions, or media close to them",
  palestinian: "Palestinian, no declared faction",
  arab: "Arab government or media",
  intl: "international, no declared alignment",
};
