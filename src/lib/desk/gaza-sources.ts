/**
 * The Gaza – Judea & Samaria desk's own sources (user, 23 Oct). Israeli, Palestinian, Arab and
 * international, official channels first. Every one was read through its public page on 23 Oct
 * (Telegram's t.me/s preview, FxTwitter for X); channels that show nothing to a reader who is not
 * signed in (the Qassam Brigades', Saraya al-Quds') are not read. The Israeli outlets, the IDF and
 * Israel's leaders are read for the Iran desk already (iran-sources.ts): what of theirs is about Gaza or
 * Judea and Samaria comes here through the site scan, not read twice.
 */
/** Google News' search feed, as yemen-scan's gnews builds it; its own copy, so the reader (editor.ts) can import this file. */
function gnews(q: string, hl = "en-US", gl = "US", ceid = "US:en") {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

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

/**
 * A source's place in the queue when more comes in than the reader takes (user, 23 Oct: official first):
 * 1 official, 2 faction media and agencies, 3 local channels and journalists. Nothing is dropped for it.
 */
type Src = { id: string; name: string; lean: GazaLean; every: number; tier?: 1 | 2 | 3 };
type Feed = { id: string; url: string; name: string; lean: GazaLean; every: number };

/**
 * Telegram (user, 23 Oct: the 52 channels sent; 48 read on their public page, ShehabTelegram, spokesman_2020,
 * sarayaps and risheq show nothing to a reader who is not signed in). qudsn and QudsN are one channel
 * (Telegram ignores case), as are palinfo and Palinfo.
 */
export const GAZA_TG: Src[] = [
  // Official: bodies, governments, the factions' own channels and spokesmen.
  { id: "WAFAgency", name: "WAFA", lean: "pa", every: 5, tier: 1 },
  { id: "palmoh", name: "Palestinian Health Ministry (Ramallah)", lean: "pa", every: 10, tier: 1 },
  { id: "MOHMediaGaza", name: "Gaza Health Ministry", lean: "factions", every: 5, tier: 1 },
  { id: "mediagovps", name: "Gaza Government Media Office", lean: "factions", every: 10, tier: 1 },
  { id: "moigovps", name: "Gaza Interior Ministry", lean: "factions", every: 10, tier: 1 },
  { id: "dcdgaza", name: "Gaza Civil Defence", lean: "factions", every: 10, tier: 1 },
  { id: "almoqawma87", name: "Hamas", lean: "factions", every: 5, tier: 1 },
  { id: "hazzemq", name: "Hazem Qassem (Hamas spokesman)", lean: "factions", every: 15, tier: 1 },
  { id: "Drbasemnaim", name: "Basem Naim (Hamas)", lean: "factions", every: 15, tier: 1 },
  { id: "AbedAlrahman_Shadeed", name: "Abdulrahman Shadid (Hamas)", lean: "factions", every: 15, tier: 1 },
  { id: "jehad_ps", name: "Islamic Jihad", lean: "factions", every: 10, tier: 1 },
  { id: "alsarayadafa", name: "Saraya al-Quds (Judea and Samaria)", lean: "factions", every: 10, tier: 1 },
  { id: "ahfadalbahaa", name: "Saraya al-Quds (Ahfad al-Bahaa)", lean: "factions", every: 10, tier: 1 },
  { id: "asramediia", name: "Prisoners Media Office", lean: "factions", every: 30, tier: 1 },
  { id: "mdaisrael", name: "Magen David Adom", lean: "israel", every: 5, tier: 1 },
  { id: "cogatonline", name: "COGAT", lean: "israel", every: 15, tier: 1 },
  // Faction media and the agencies.
  { id: "qudsn", name: "Quds News Network", lean: "factions", every: 5, tier: 2 },
  { id: "Qudsn_Brk", name: "Quds News Network (urgent)", lean: "factions", every: 5, tier: 2 },
  { id: "QudsNen", name: "Quds News Network (English)", lean: "factions", every: 15, tier: 2 },
  { id: "SafaPs", name: "Safa", lean: "factions", every: 5, tier: 2 },
  { id: "palinfo", name: "Palestine Info Center", lean: "factions", every: 10, tier: 2 },
  { id: "ShehabTelegram2", name: "Shehab (urgent)", lean: "factions", every: 5, tier: 2 },
  { id: "alresalahpress", name: "Al-Resalah", lean: "factions", every: 10, tier: 2 },
  { id: "paltoday_tv", name: "Palestine Today TV", lean: "factions", every: 10, tier: 2 },
  { id: "mo3taps", name: "Palestine Information Center (Mo3ta)", lean: "factions", every: 15, tier: 2 },
  { id: "P_S_PI", name: "Palestine Al-Aqsa", lean: "factions", every: 15, tier: 2 },
  { id: "R1Gaza", name: "Radea", lean: "factions", every: 15, tier: 2 },
  { id: "alhares", name: "Al-Hares", lean: "factions", every: 15, tier: 2 },
  { id: "almajdps0", name: "Al-Majd Security", lean: "factions", every: 15, tier: 2 },
  { id: "AwdehTV", name: "Awdah TV", lean: "pa", every: 10, tier: 2 },
  { id: "maannews", name: "Ma'an", lean: "palestinian", every: 10, tier: 2 },
  { id: "SamaNewsAgency", name: "Sama News Agency", lean: "palestinian", every: 10, tier: 2 },
  { id: "Sadanews12", name: "Sada News", lean: "palestinian", every: 10, tier: 2 },
  { id: "msdrnews", name: "Masdar News", lean: "palestinian", every: 10, tier: 2 },
  { id: "ultrapalestine", name: "Ultra Palestine", lean: "palestinian", every: 10, tier: 2 },
  { id: "ajyalfm", name: "Ajyal Network", lean: "palestinian", every: 10, tier: 2 },
  { id: "radioalam", name: "Radio Alam", lean: "palestinian", every: 10, tier: 2 },
  { id: "alam24press", name: "Alam 24", lean: "palestinian", every: 10, tier: 2 },
  { id: "JusorNews", name: "Jusoor News", lean: "palestinian", every: 10, tier: 2 },
  { id: "today1213news", name: "Akhbar al-Yawm", lean: "palestinian", every: 10, tier: 2 },
  // Local channels and journalists.
  { id: "gazanow", name: "Gaza Now", lean: "palestinian", every: 5, tier: 3 },
  { id: "timesofgaza", name: "Times of Gaza", lean: "palestinian", every: 10, tier: 3 },
  { id: "eye_on_palestine", name: "Eye on Palestine", lean: "palestinian", every: 10, tier: 3 },
  { id: "AlShatiNews", name: "Al-Shati News", lean: "palestinian", every: 10, tier: 3 },
  { id: "Nuseirat1", name: "Nuseirat News", lean: "palestinian", every: 10, tier: 3 },
  { id: "jeninnews", name: "Jenin News", lean: "palestinian", every: 10, tier: 3 },
  { id: "jeninnews1", name: "Jenin News (jeninnews1)", lean: "palestinian", every: 10, tier: 3 },
  { id: "jenencamb", name: "Jenin Camp 24", lean: "palestinian", every: 10, tier: 3 },
  { id: "noursams", name: "Nur Shams", lean: "palestinian", every: 10, tier: 3 },
  { id: "TulkaremNet", name: "Tulkarem Net", lean: "palestinian", every: 10, tier: 3 },
  { id: "TubasTimes", name: "Tubas Times", lean: "palestinian", every: 10, tier: 3 },
  { id: "nablus_news", name: "Nablus News", lean: "palestinian", every: 10, tier: 3 },
  { id: "hamza20300", name: "Hamza al-Masri", lean: "palestinian", every: 10, tier: 3 },
  { id: "osama1984osama", name: "Osama al-Kahlout", lean: "palestinian", every: 15, tier: 3 },
  { id: "anas1020304050", name: "Anas al-Sharif", lean: "palestinian", every: 15, tier: 3 },
  { id: "safypress90", name: "Safinaz al-Louh", lean: "palestinian", every: 15, tier: 3 },
  { id: "hpress", name: "Hassan Eslaih", lean: "palestinian", every: 15, tier: 3 },
  { id: "muthanapress84", name: "Muthana al-Najjar", lean: "palestinian", every: 15, tier: 3 },
];

export const GAZA_X: Src[] = [
  { id: "IsraelPolice", name: "Israel Police", lean: "israel", every: 15, tier: 1 },
  { id: "BoardOfPeace", name: "Board of Peace", lean: "intl", every: 15, tier: 1 },
  { id: "UNRWA", name: "UNRWA", lean: "intl", every: 30, tier: 1 },
  { id: "ochaopt", name: "OCHA", lean: "intl", every: 30, tier: 1 },
  { id: "ICRC_ilot", name: "ICRC", lean: "intl", every: 60, tier: 1 },
  { id: "UNSCO_MEPP", name: "UN Middle East envoy's office", lean: "intl", every: 60, tier: 1 },
  { id: "PalestineRCS", name: "Palestine Red Crescent", lean: "palestinian", every: 15, tier: 1 },
  { id: "ShehabAgency", name: "Shehab", lean: "factions", every: 10, tier: 2 },
  { id: "pmofa", name: "Palestinian Foreign Ministry", lean: "pa", every: 30, tier: 1 },
  { id: "MFAEgypt", name: "Egypt Foreign Ministry", lean: "arab", every: 30, tier: 1 },
  { id: "MofaQatar_AR", name: "Qatar Foreign Ministry", lean: "arab", every: 30, tier: 1 },
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

/** A source's place in the queue (official first): its own tier; another desk's official body 1, any other outlet 2. */
const TIER = new Map<string, number>([...GAZA_TG, ...GAZA_X].map((s) => [s.name, s.tier ?? 2]));
export function gazaTierOf(source: string, official: (s: string) => boolean): number {
  return TIER.get(source) ?? (official(source) ? 1 : 2);
}

/** WAFA's own site (user, 23 Oct): its front page lists the day's stories; the server can open it. */
export const WAFA_SITE = "https://www.wafa.ps/";

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
