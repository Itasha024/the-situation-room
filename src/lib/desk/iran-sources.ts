/**
 * The Iran desk's sources (Round 30 stage 3), from the user's list of 8 Oct.
 *
 * One scanner reads every source once (desk-route.ts). A source the Yemen desk
 * already reads is named here by its id and is read for both desks; a source
 * new with the Iran desk is listed in full and is read for the Iran desk only.
 *
 * Every source sits in one of the Iran desk's six filter groups (`IranLean`),
 * the buttons above its Latest reports. Each was test-read from the server on
 * 8 Oct; the ones that do not answer are listed at the end with the reason.
 */

/** The Iran desk's filter buttons. */
export type IranLean = "axis" | "opposition" | "israel" | "us" | "gulf" | "intl";

export const IRAN_LEAN_LABELS: Record<IranLean, string> = {
  axis: "Iran and Axis-aligned",
  opposition: "Iranian opposition",
  israel: "Israeli",
  us: "US",
  gulf: "Gulf and Arab",
  intl: "International",
};

/**
 * `israeliMedia`: an Israeli outlet or reporter (stage 4c). Israel's own
 * reporting on the Iran war is kept; a report that only repeats a foreign
 * outlet is dropped (the original is read directly), and exclusives are kept.
 */
export type IranSource = { id: string; name: string; lean: IranLean; every: 5 | 10 | 15 | 30; note?: string; israeliMedia?: true };

/** Telegram channels the Yemen desk reads that the Iran desk reads too (t.me ids). */
export const SHARED_TG: Record<string, IranLean> = {
  Alomhoar: "axis",
  Alibk3: "axis",
  SabrenNewss: "axis",
  naya_foriraq: "axis",
  shin_persian: "axis",
  AlarabyTvBrk: "gulf",
  shajab_news: "axis",
  bin_1saeed: "gulf",
  AjaNews: "gulf",
  alhadath_brk: "gulf",
  alarabiyaBr: "gulf",
  Alakhbar_News: "axis",
  eremnews: "gulf",
  ajMubasher: "gulf",
  asharqnews: "gulf",
  almayadeen: "axis",
  farsna: "axis",
  mehrnews: "axis",
  iribnews: "axis",
  irna_1313: "axis",
  snntv: "axis",
  Nournews_ir: "axis",
  presstv: "axis",
  Alfaqaar313: "axis",
  clashreport: "intl",
};

/** New Telegram channels, the Iran desk's alone. */
export const IRAN_TG: IranSource[] = [
  // Tasnim: its own channel (Tasnimnews) shows no posts to a reader not signed
  // in, and its site does not answer from outside Iran. Its English channel
  // links each post to tasnimnews.ir; the Arabic one relays Tasnim Arabic.
  { id: "Tasnimnews_EN", name: "Tasnim", lean: "axis", every: 5 },
  { id: "Tasnim_ar", name: "Tasnim (Arabic relay)", lean: "axis", every: 5, note: "a relay of Tasnim Arabic, not Tasnim's own" },
  { id: "Khabar_Fouri", name: "Khabar Fori", lean: "axis", every: 5 },
  { id: "khabari", name: "Khabari Plus", lean: "axis", every: 5 },
  { id: "isna94", name: "ISNA", lean: "axis", every: 5 },
  { id: "imnanews_ir", name: "IMNA", lean: "axis", every: 15 },
  { id: "akhbarefori", name: "Akhbar-e Fori", lean: "axis", every: 5 },
  { id: "alalamarabic", name: "Al-Alam", lean: "axis", every: 5 },
  { id: "Tehran_Fouri", name: "Tehran Fori", lean: "axis", every: 5 },
  { id: "ilnair", name: "ILNA", lean: "axis", every: 15 },
  { id: "emtedadnet", name: "Emtedad", lean: "axis", every: 15 },
  { id: "PressTVhebrew", name: "Press TV Hebrew", lean: "axis", every: 15 },
  // Lebanese, Iran-aligned; now and then a scoop of its own.
  { id: "unewschannel", name: "Unews", lean: "axis", every: 5 },
  // Hezbollah's own statements.
  // An Axis relay channel, not Hezbollah: it reposts the Houthi army and Hebrew media (audit, 8 Oct).
  { id: "C_Military1", name: "Axis military relay", lean: "axis", every: 5 },
  { id: "rahbar_ir", name: "Khamenei's office", lean: "axis", every: 15 },
  { id: "s_a_araghchi", name: "Abbas Araghchi", lean: "axis", every: 15 },
  // The president's son and adviser; mostly his own writing, so only the war's posts pass.
  { id: "ypezeshkian", name: "Yousef Pezeshkian", lean: "axis", every: 30 },
  { id: "IranintlTV", name: "Iran International", lean: "opposition", every: 5 },
  { id: "ManotoTV", name: "Manoto", lean: "opposition", every: 15 },
  { id: "VahidOnline", name: "Vahid Online", lean: "opposition", every: 5 },
  { id: "iliaen", name: "Ilia Hashemi", lean: "opposition", every: 15 },
  { id: "anjmotahed", name: "United Students", lean: "opposition", every: 15 },
  { id: "SimaINTV", name: "Simay-e Azadi (MEK)", lean: "opposition", every: 15 },
  { id: "idfinfarsi", name: "IDF Farsi", lean: "israel", every: 5 },
  { id: "IDFSpokespersonArabic", name: "IDF Arabic", lean: "israel", every: 10 },
  { id: "farsivoa", name: "VOA Farsi", lean: "us", every: 5 },
  { id: "bbcpersian", name: "BBC Persian", lean: "intl", every: 5 },
  { id: "netblocks", name: "NetBlocks", lean: "intl", every: 15 },
  // Israeli media (stage 4c): reporters' and newsrooms' channels.
  { id: "amitsegal", name: "Amit Segal", lean: "israel", every: 5, israeliMedia: true },
  { id: "N12chat", name: "N12", lean: "israel", every: 5, israeliMedia: true },
  { id: "kanarab", name: "Kan (Arab affairs)", lean: "israel", every: 10, israeliMedia: true },
  { id: "US2020US", name: "US2020US", lean: "israel", every: 10, israeliMedia: true },
  { id: "israel1", name: "Israel 1", lean: "israel", every: 10, israeliMedia: true },
  { id: "hazfon1", name: "Hazfon 1", lean: "israel", every: 10, israeliMedia: true },
  // i24's Hebrew site serves only its own app; its channel is public.
  { id: "i24news_he", name: "i24 News", lean: "israel", every: 10, israeliMedia: true },
];

/** X accounts the Yemen desk reads that the Iran desk reads too (handles). */
export const SHARED_X: Record<string, IranLean> = {
  war_cube: "intl",
  GCCSG: "gulf",
  modgovksa: "gulf",
  SkyNewsArabia_B: "gulf",
  spagov: "gulf",
  wamnews: "gulf",
  SaudiDCD: "gulf",
  MOISaudiArabia: "gulf",
  KSAMOFA: "gulf",
  StateDept: "us",
  MfaEgypt: "gulf",
  MFAEgOfficial: "gulf",
  IRIMFA_EN: "axis",
  FMofOman: "gulf",
  mofauae: "gulf",
  Iraqimofa: "gulf",
  MOFAKuwait: "gulf",
  bahdiplomatic: "gulf",
  MofaQatar_AR: "gulf",
  ForeignMinistry: "gulf",
  ForeignOfficePk: "intl",
  MFATurkiye: "intl",
  TC_Disisleri: "intl",
  SecRubio: "us",
  marcorubio: "us",
  ENERGY: "us",
  USTreasury: "us",
  EU_Commission: "intl",
  vonderleyen: "intl",
  antonioguterres: "intl",
  UN: "intl",
  SDoughtyMP: "intl",
  UK_MTO: "intl",
  MoEnergy_Saudi: "gulf",
  Kpler: "intl",
  TankerTrackers: "intl",
  MarineTraffic: "intl",
  vortexa: "intl",
  JavierBlas: "intl",
  osinthexagone: "intl",
  EGYOSINT: "intl",
  CENTCOM: "us",
  WhiteHouse: "us",
  POTUS: "us",
  RapidResponse47: "us",
  JDVance: "us",
  VP: "us",
  BarakRavid: "us",
  NatashaBertrand: "us",
  TreyYingst: "us",
  JenGriffinFNC: "us",
  clashreport: "intl",
  sentdefender: "intl",
  Reuters: "intl",
  WSJ: "us",
  nytimes: "us",
  washingtonpost: "us",
  axios: "us",
  business: "us",
  ftworldnews: "intl",
  Intel_Online: "intl",
  CNN: "us",
  FoxNews: "us",
  CBSNews: "us",
  ABC: "us",
  NBCNews: "us",
  nypost: "us",
  politico: "us",
  Telegraph: "intl",
  France24_en: "intl",
  France24_ar: "intl",
  arabnews: "gulf",
  aawsat_News: "gulf",
  aawsat_eng: "gulf",
  TheNationalNews: "gulf",
  alaraby_ar: "gulf",
  // US-funded, as VOA and Radio Farda.
  alhurranews: "us",
};

/** New X accounts, the Iran desk's alone. */
export const IRAN_X: IranSource[] = [
  // Iran: the state, the Guards, the officials.
  { id: "shoaam_ir", name: "Iran's Supreme National Security Council", lean: "axis", every: 15 },
  { id: "PGSA_IRAN", name: "Persian Gulf Strait Authority", lean: "axis", every: 15 },
  { id: "Rahbarenghelab_", name: "Khamenei's office", lean: "axis", every: 15 },
  { id: "niroo_daryayi", name: "IRGC Navy", lean: "axis", every: 15 },
  { id: "saghabesfahani", name: "Esmaeil Saghab Esfahani", lean: "axis", every: 30 },
  { id: "Drvelayati_ir", name: "Ali Akbar Velayati", lean: "axis", every: 30 },
  { id: "MokhberOfficial", name: "Mohammad Mokhber", lean: "axis", every: 30 },
  { id: "Ebrahimazizi33", name: "Ebrahim Azizi", lean: "axis", every: 30 },
  { id: "F_Mohajerani", name: "Fatemeh Mohajerani (government spokeswoman)", lean: "axis", every: 15 },
  { id: "nabaviantwt", name: "Mahmoud Nabavian", lean: "axis", every: 30 },
  { id: "AhmadReza_Radan", name: "Ahmad-Reza Radan (police chief)", lean: "axis", every: 30 },
  { id: "IranAmbPak", name: "Iran's ambassador to Pakistan", lean: "axis", every: 30 },
  { id: "IRIMFA_SPOX", name: "Esmaeil Baghaei (foreign ministry spokesman)", lean: "axis", every: 15 },
  { id: "hatami_org", name: "Amir Hatami (army chief)", lean: "axis", every: 15 },
  { id: "vahidi_org", name: "Ahmad Vahidi", lean: "axis", every: 15 },
  { id: "ejei_org", name: "Gholam-Hossein Mohseni-Ejei (judiciary chief)", lean: "axis", every: 30 },
  { id: "ypezeshkian", name: "Yousef Pezeshkian", lean: "axis", every: 30 },
  { id: "AmoliLarijaniir", name: "Sadegh Amoli Larijani", lean: "axis", every: 30 },
  { id: "aeoi_ir", name: "Atomic Energy Organization of Iran", lean: "axis", every: 15 },
  { id: "mb_ghalibaf", name: "Mohammad Bagher Ghalibaf (speaker)", lean: "axis", every: 15 },
  { id: "IRIMFA_AR", name: "Iran Foreign Ministry (Arabic)", lean: "axis", every: 15 },
  { id: "Gharibabadi", name: "Kazem Gharibabadi", lean: "axis", every: 15 },
  { id: "EbrahimRezaei14", name: "Ebrahim Rezaei", lean: "axis", every: 30 },
  { id: "tabaei1356", name: "Mehdi Tabatabaei", lean: "axis", every: 30 },
  { id: "TehranTimes79", name: "Tehran Times", lean: "axis", every: 15 },
  { id: "MizanNewsAgency", name: "Mizan (judiciary agency)", lean: "axis", every: 15 },
  { id: "ir_rezaee", name: "Mohsen Rezaei", lean: "axis", every: 15 },
  { id: "drpezeshkian", name: "Masoud Pezeshkian", lean: "axis", every: 15 },
  { id: "araghchi", name: "Abbas Araghchi", lean: "axis", every: 10 },
  { id: "DrSaeedJalili", name: "Saeed Jalili", lean: "axis", every: 30 },
  // The opposition.
  { id: "IranIntlbrk", name: "Iran International", lean: "opposition", every: 5 },
  { id: "IranIntl_En", name: "Iran International", lean: "opposition", every: 10 },
  { id: "IranIntl", name: "Iran International", lean: "opposition", every: 10 },
  { id: "PahlaviReza", name: "Reza Pahlavi", lean: "opposition", every: 30 },
  { id: "Mojahedinar", name: "MEK (Arabic)", lean: "opposition", every: 30 },
  { id: "PMOIRAN", name: "MEK", lean: "opposition", every: 30 },
  { id: "NCRIUS", name: "NCRI US office", lean: "opposition", every: 30 },
  { id: "manototv", name: "Manoto", lean: "opposition", every: 15 },
  // Israel.
  { id: "MossadSpokesman", name: "Mossad Farsi", lean: "israel", every: 15 },
  // The IDF (added 8 Oct). Lt. Col. Ella Waweya has been its Arabic spokesperson
  // since February 2026; Avichay Adraee, her predecessor, still posts now and then.
  { id: "IDF", name: "IDF", lean: "israel", every: 10 },
  { id: "IDFFarsi", name: "IDF Farsi", lean: "israel", every: 10 },
  { id: "CaptainElla1", name: "Ella Waweya (IDF Arabic spokesperson)", lean: "israel", every: 10 },
  { id: "avichayadraee", name: "Avichay Adraee", lean: "israel", every: 30 },
  // The US.
  { id: "RadioFarda_", name: "Radio Farda", lean: "us", every: 10 },
  { id: "USEmbMuscat", name: "US Embassy Muscat", lean: "us", every: 30 },
  { id: "USEmbassyManama", name: "US Embassy Manama", lean: "us", every: 30 },
  { id: "usembassybeirut", name: "US Embassy Beirut", lean: "us", every: 30 },
  { id: "USEmbassyQ8", name: "US Embassy Kuwait", lean: "us", every: 30 },
  { id: "USEmbassyDoha", name: "US Embassy Doha", lean: "us", every: 30 },
  { id: "USAinUAE", name: "US Mission to the UAE", lean: "us", every: 30 },
  { id: "USEmbBaghdad", name: "US Embassy Baghdad", lean: "us", every: 30 },
  { id: "USEmbassyJordan", name: "US Embassy Amman", lean: "us", every: 30 },
  // The Gulf, Lebanon, Pakistan.
  { id: "ADMediaOffice", name: "Abu Dhabi Media Office", lean: "gulf", every: 10 },
  { id: "DXBMediaOffice", name: "Dubai Media Office", lean: "gulf", every: 10 },
  { id: "NCEMAUAE", name: "UAE emergency authority (NCEMA)", lean: "gulf", every: 10 },
  { id: "AnwarGargash", name: "Anwar Gargash", lean: "gulf", every: 30 },
  { id: "TamimBinHamad", name: "Emir of Qatar", lean: "gulf", every: 30 },
  { id: "AmiriDiwan", name: "Qatar's Amiri Diwan", lean: "gulf", every: 15 },
  { id: "MBA_AlThani_", name: "Qatar's prime minister", lean: "gulf", every: 15 },
  { id: "majedalansari", name: "Majed al-Ansari (Qatar foreign ministry)", lean: "gulf", every: 15 },
  { id: "QatarNewsAgency", name: "QNA", lean: "gulf", every: 10 },
  { id: "badralbusaidi", name: "Badr Albusaidi (Oman's foreign minister)", lean: "gulf", every: 10 },
  { id: "OmanNewsAgency", name: "Oman News Agency", lean: "gulf", every: 10 },
  { id: "kpcofficialkw", name: "Kuwait Petroleum Corporation", lean: "gulf", every: 30 },
  { id: "HibaNasr", name: "Hiba Nasr", lean: "gulf", every: 10 },
  { id: "Alihashem", name: "Ali Hashem", lean: "gulf", every: 15 },
  { id: "YoussefRaggi", name: "Youssef Raggi (Lebanon's foreign minister)", lean: "gulf", every: 15 },
  { id: "mofalebanon1", name: "Lebanon Foreign Ministry", lean: "gulf", every: 15 },
  { id: "grandserail", name: "Lebanon's prime minister's office", lean: "gulf", every: 15 },
  { id: "nawafsalam", name: "Nawaf Salam", lean: "gulf", every: 15 },
  { id: "LBpresidency", name: "Lebanese presidency", lean: "gulf", every: 15 },
  { id: "LebarmyOfficial", name: "Lebanese Army", lean: "gulf", every: 15 },
  { id: "MIshaqDar50", name: "Ishaq Dar (Pakistan's foreign minister)", lean: "intl", every: 15 },
  { id: "PakPMO", name: "Pakistan's prime minister's office", lean: "intl", every: 15 },
  { id: "CMShehbaz", name: "Shehbaz Sharif", lean: "intl", every: 15 },
];

/** Websites and feeds the Yemen desk reads that the Iran desk reads too (by their names in the scanner). */
export const SHARED_RSS: Record<string, IranLean> = {
  "Clearwater Dynamics": "intl",
  "Arab News": "gulf",
  "The National": "gulf",
  "Al-Araby Al-Jadeed": "gulf",
  "Asharq Al-Awsat": "gulf",
  "Al-Akhbar": "axis",
  "Erem News": "gulf",
  Alhurra: "us",
  SPA: "gulf",
  "Sky News Arabia": "gulf",
  "Independent Arabia": "gulf",
  "The New Arab": "gulf",
  "Al-Monitor": "intl",
  "Middle East Eye": "intl",
  Reuters: "intl",
  AP: "intl",
  WSJ: "us",
  NYT: "us",
  "Washington Post": "us",
  "NY Post": "us",
  Axios: "us",
  CNN: "us",
  ABC: "us",
  CBS: "us",
  "NBC News": "us",
  "Fox News": "us",
  Politico: "us",
  Bloomberg: "us",
  "Financial Times": "intl",
  "The Telegraph": "intl",
  BBC: "intl",
  "France 24": "intl",
  "Intelligence Online": "intl",
  CENTCOM: "us",
  Pentagon: "us",
  "White House": "us",
  "State Department": "us",
  "OilPrice.com": "intl",
  "The Maritime Executive": "intl",
  gCaptain: "intl",
  Splash247: "intl",
  "Seatrade Maritime": "intl",
  "Hellenic Shipping News": "intl",
  Kpler: "intl",
};

/**
 * New feeds, the Iran desk's alone.
 *
 * trumpstruth.org keeps every post of Trump's on Truth Social as an RSS feed,
 * minutes after it is posted: Truth Social itself shows nothing to an
 * automated reader. It feeds the pinned Trump card (stage 4).
 */
/** Google News's public listing of one site's last hour, in Hebrew. */
const gnSite = (site: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(`site:${site} when:1h`)}&hl=iw&gl=IL&ceid=IL:he`;

export const IRAN_RSS: { id: string; url: string; name: string; lean: IranLean; every: 5 | 10 | 15 | 30; israeliMedia?: true }[] = [
  { id: "trumpstruth", url: "https://trumpstruth.org/feed", name: "Truth Social (Trump)", lean: "us", every: 5 },
  { id: "iaea", url: "https://www.iaea.org/feeds/topnews", name: "IAEA", lean: "intl", every: 30 },
  // Israeli media (stage 4c), each site's own feed.
  { id: "walla", url: "https://rss.walla.co.il/feed/1", name: "Walla", lean: "israel", every: 10, israeliMedia: true },
  { id: "ynet", url: "https://www.ynet.co.il/Integration/StoryRss2.xml", name: "Ynet", lean: "israel", every: 10, israeliMedia: true },
  { id: "jpost-iran", url: "https://www.jpost.com/rss/rssfeedsiran", name: "Jerusalem Post", lean: "israel", every: 15, israeliMedia: true },
  { id: "jpost-mideast", url: "https://www.jpost.com/rss/rssfeedsmiddleeastnews.aspx", name: "Jerusalem Post", lean: "israel", every: 15, israeliMedia: true },
  { id: "haaretz-he", url: "https://www.haaretz.co.il/srv/rss---feedly", name: "Haaretz", lean: "israel", every: 10, israeliMedia: true },
  { id: "haaretz-en", url: "https://www.haaretz.com/srv/haaretz-latest-headlines", name: "Haaretz", lean: "israel", every: 15, israeliMedia: true },
  { id: "n12", url: "https://rcs.mako.co.il/rss/31750a2610f26110VgnVCM1000005201000aRCRD.xml", name: "N12", lean: "israel", every: 10, israeliMedia: true },
  { id: "c14", url: "https://www.c14.co.il/feed/", name: "Channel 14", lean: "israel", every: 10, israeliMedia: true },
  // Their own sites turn the server away (403, Cloudflare): Google News's
  // public listing of each site stands in, as for Asharq Al-Awsat on Yemen.
  { id: "israelhayom", url: gnSite("israelhayom.co.il"), name: "Israel Hayom", lean: "israel", every: 15, israeliMedia: true },
  { id: "kan", url: gnSite("kan.org.il"), name: "Kan", lean: "israel", every: 15, israeliMedia: true },
  { id: "c13", url: gnSite("13tv.co.il"), name: "Channel 13", lean: "israel", every: 15, israeliMedia: true },
];

/**
 * Tried on 8 Oct and not read, with the reason, so they are not tried again
 * blind. `archive.md` answers the server with a CAPTCHA (it answers a person in
 * a browser, as it does the user); the desk does not get past those.
 */
export const IRAN_NOT_READ: { what: string; why: string }[] = [
  { what: "Tasnim's own Telegram (Tasnimnews) and Arabic channel (tasnimnews_ar)", why: "show no posts to a reader not signed in" },
  { what: "tasnimnews.com", why: "does not answer from outside Iran" },
  { what: "archive.md / archive.ph", why: "answers the server with a CAPTCHA (429)" },
  { what: "YouTube transcripts", why: "the caption files come back empty to a server; titles and descriptions only" },
  { what: "whitehouse.gov/remarks", why: "transcripts posted days late (latest 28 Sep on 8 Oct)" },
  { what: "israelhayom.co.il, kan.org.il, 13tv.co.il (their own feeds)", why: "turn the server away (403, Cloudflare); read through Google News's listing of each site" },
  { what: "now14.co.il", why: "Cloudflare; Channel 14 is read from c14.co.il's feed" },
  { what: "i24news.tv in Hebrew", why: "an app with no public feed; read from its Telegram channel" },
  { what: "ukmto.org", why: "answers with a CAPTCHA; UKMTO is read from its X account (UK_MTO)" },
  { what: "the IAEA's Iran page", why: "Cloudflare; the IAEA is read from its news feed" },
  { what: "Telegram channels of Kan, Israel Hayom, Channel 13 and Channel 14", why: "none found that still posts" },
];

/** The display names of the Israeli outlets and reporters (stage 4c). */
export const ISRAELI_MEDIA: ReadonlySet<string> = new Set([...IRAN_TG, ...IRAN_RSS].filter((s) => s.israeliMedia).map((s) => s.name));

/** Every Iran-desk source's filter group, by the source's display name. */
export function iranLeanOf(name: string): IranLean | undefined {
  for (const s of [...IRAN_TG, ...IRAN_X, ...IRAN_RSS]) if (s.name === name) return s.lean;
  return SHARED_RSS[name];
}
