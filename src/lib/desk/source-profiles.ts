/**
 * What each source usually brings and what to take from it (user, 27 Oct: "every source can bring exclusive reports,
 * even sources that don't do that often … can't classify sources by exclusive or not, but do know what each source
 * usually brings and what to take from it").
 *
 * A profile is guidance, never a gate on exclusives: any outlet's own scoop is recognised by what the piece says
 * (exclusive.ts). The profile tells the reader what the outlet is good for, gives its names in Arabic and Hebrew so
 * "مصادر لـ«…»" / "נודע ל…" are read as its own, and marks the few outlets most of whose posts are other agencies'
 * news, from which only their own information is taken (`own`).
 */

export type SourceProfile = {
  /** What it usually brings. */
  brings: string;
  /** What to take from it. */
  take: string;
  /** Most of what it carries is other agencies' news: only its own information goes on the desk. */
  own?: true;
  /** A newsroom with its own reporters: "two officials said" at its head is its own sourcing. */
  newsroom?: true;
  en?: string[];
  ar?: string[];
  he?: string[];
};

const OWN_TAKE = "its own sourced information, interviews given to it and what its reporters saw; not other agencies' news it repeats";

export const PROFILES: Record<string, SourceProfile> = {
  // Arab sites and papers.
  "Erem News": { brings: "Gulf, Iran, Houthi and Iraqi scoops from unnamed sources", take: OWN_TAKE, own: true, newsroom: true, en: ["Erem News", "Erem"], ar: ["إرم نيوز", "إرم"] },
  "Al-Araby Al-Jadeed": { brings: "Egyptian, Qatari and Hamas sourcing on mediation, Gaza talks and the region", take: OWN_TAKE, own: true, newsroom: true, en: ["Al-Araby Al-Jadeed", "The New Arab", "Al-Araby"], ar: ["العربي الجديد"] },
  "The New Arab": { brings: "the English site of Al-Araby Al-Jadeed: Egyptian, Qatari and Hamas sourcing", take: OWN_TAKE, own: true, newsroom: true, en: ["The New Arab", "Al-Araby Al-Jadeed", "Al-Araby"], ar: ["العربي الجديد"] },
  "Asharq Al-Awsat": { brings: "Saudi, Lebanese, Iraqi and Yemeni sourcing; interviews with officials", take: OWN_TAKE, own: true, newsroom: true, en: ["Asharq Al-Awsat"], ar: ["الشرق الأوسط"] },
  "Independent Arabia": { brings: "Saudi-leaning reporting with its own sources across the region", take: OWN_TAKE, own: true, newsroom: true, en: ["Independent Arabia"], ar: ["إندبندنت عربية", "اندبندنت عربية"] },
  "Al-Akhbar": { brings: "Hezbollah-close sourcing in Lebanon, Syria and Yemen; the axis' read of events", take: "its own sources' information, as that camp's account", own: true, newsroom: true, en: ["Al-Akhbar"], ar: ["الأخبار"] },
  "Al-Modon": { brings: "Lebanese political and diplomatic sourcing", take: OWN_TAKE, own: true, en: ["Al-Modon", "Almodon", "Al Modon"], ar: ["المدن"] },
  "Nidaa al-Watan": { brings: "Lebanese sovereignty-camp sourcing; diplomatic and security information", take: OWN_TAKE, own: true, en: ["Nidaa al-Watan", "Nidaa Al Watan"], ar: ["نداء الوطن"] },
  "Ad-Diyar": { brings: "Lebanese political sourcing and diplomatic information", take: OWN_TAKE, own: true, en: ["Ad-Diyar", "Addiyar", "Al-Diyar"], ar: ["الديار"] },
  "Lebanon Debate": { brings: "Lebanese political and security sourcing", take: OWN_TAKE, own: true, en: ["Lebanon Debate", "LebanonDebate"], ar: ["ليبانون ديبايت"] },
  Elnashra: { brings: "Lebanese political sourcing", take: OWN_TAKE, own: true, en: ["Elnashra", "El Nashra", "Al-Nashra"], ar: ["النشرة"] },
  "Al-Joumhouria": { brings: "Lebanese political and diplomatic sourcing", take: OWN_TAKE, own: true, en: ["Al-Joumhouria", "Al Joumhouria", "Aljoumhouria", "Al-Jumhuriya"], ar: ["الجمهورية"] },
  "Al-Binaa": { brings: "the axis' Lebanese line and its sourcing", take: "its own sources' information, as that camp's account", own: true, en: ["Al-Binaa", "Al Binaa", "Albinaa"], ar: ["البناء"] },
  "Al-Quds Al-Arabi": { brings: "Palestinian, Jordanian and Gulf sourcing", take: "its own sourced information", newsroom: true, en: ["Al-Quds Al-Arabi", "Al Quds Al Arabi"], ar: ["القدس العربي"] },
  "Rai al-Youm": { brings: "commentary and occasional sourced reports", take: "only its sourced information, never its opinion", en: ["Rai al-Youm", "Rai Alyoum"], ar: ["رأي اليوم"] },
  Alhurra: { brings: "US-funded reporting with US and Iraqi sourcing", take: OWN_TAKE, own: true, newsroom: true, en: ["Alhurra", "Al-Hurra", "Al Hurra"], ar: ["الحرة"] },
  "Arab News": { brings: "Saudi official lines and interviews", take: OWN_TAKE, own: true, en: ["Arab News"], ar: ["عرب نيوز"] },
  "The National": { brings: "UAE-based reporting with Gulf and Western sourcing", take: "its own sourced information and interviews", newsroom: true, en: ["The National"] },
  "Middle East Eye": { brings: "scoops from Arab, Turkish and Western officials", take: "its own sourced information", newsroom: true, en: ["Middle East Eye", "MEE"] },
  "Al-Monitor": { brings: "Iran, Iraq, Gulf and US policy sourcing", take: "its own sourced information", newsroom: true, en: ["Al-Monitor"] },
  // Arab TV.
  "Al Jazeera": { brings: "field correspondents in Gaza and the region; Qatari and Hamas sourcing", take: "its correspondents' reports and what officials told it", own: true, newsroom: true, en: ["Al Jazeera"], ar: ["الجزيرة نت", "الجزيرة"] },
  "Al Arabiya": { brings: "Saudi-close sourcing; interviews with Gulf and US officials", take: "what officials and sources told it", own: true, newsroom: true, en: ["Al Arabiya"], ar: ["العربية نت", "العربية.نت", "العربية"] },
  "Al Hadath": { brings: "Saudi-close breaking sourcing on Iran, Yemen, Lebanon and Gaza", take: "what its sources told it", newsroom: true, en: ["Al Hadath", "Al-Hadath"], ar: ["الحدث"] },
  "Asharq News": { brings: "Saudi-owned Bloomberg partner: economic and diplomatic sourcing", take: "what its sources told it", newsroom: true, en: ["Asharq News", "Asharq"], ar: ["الشرق"] },
  "Sky News Arabia": { brings: "UAE-close breaking sourcing", take: "only what its sources told it; its breaking posts are mostly others' news", newsroom: true, en: ["Sky News Arabia"], ar: ["سكاي نيوز عربية"] },
  "Al Mayadeen": { brings: "the axis' officials and sources (Iran, Hezbollah, the Houthis, Palestinian factions)", take: "their positions and claims, as the axis' line", newsroom: true, en: ["Al Mayadeen", "Al-Mayadeen"], ar: ["الميادين"] },
  "Al-Manar": { brings: "Hezbollah's own line", take: "Hezbollah's statements and claims, as its own", en: ["Al-Manar"], ar: ["المنار"] },
  "Al-Alam": { brings: "Iran's Arabic state line", take: "Iranian officials' words, as Iran's account", en: ["Al-Alam"], ar: ["العالم"] },
  "Al Jadeed": { brings: "evening Lebanese political scoops (around 20:00)", take: "its own information and what sources told it", newsroom: true, en: ["Al Jadeed", "Al-Jadeed"], ar: ["الجديد"] },
  "MTV Lebanon": { brings: "Lebanese sovereignty-camp scoops and interviews", take: "its own information and interviews", newsroom: true, en: ["MTV"], ar: ["ام تي في"] },
  LBCI: { brings: "Lebanese political and security information", take: "its own information and interviews", newsroom: true, en: ["LBCI"], ar: ["ال بي سي"] },
  // Palestinian.
  WAFA: { brings: "the PA's official statements and its account of Israeli raids", take: "the PA's words; its accounts of events as Palestinian claims", en: ["WAFA"], ar: ["وفا"] },
  "Quds News Network": { brings: "fast Palestinian field reports and faction-close posts", take: "field reports as Palestinian claims", en: ["Quds News Network", "QNN"], ar: ["شبكة قدس", "قدس"] },
  Safa: { brings: "Hamas-close field reports from Gaza and Judea and Samaria", take: "field reports as Palestinian claims", en: ["Safa"], ar: ["صفا"] },
  Shehab: { brings: "Hamas-close field reports", take: "field reports as Palestinian claims", en: ["Shehab"], ar: ["شهاب"] },
  "Ma'an": { brings: "Palestinian field reports and PA sourcing", take: "field reports as Palestinian claims; what sources told it", en: ["Ma'an", "Maan"], ar: ["معا"] },
  // Wires and international.
  Reuters: { brings: "scoops from officials and sources worldwide", take: "its own sourced reports; it also carries everyone's statements", newsroom: true, en: ["Reuters"], ar: ["رويترز"] },
  AP: { brings: "field reporting and officials' accounts", take: "its own reporting and sourcing", newsroom: true, en: ["AP", "Associated Press"], ar: ["أسوشيتد برس"] },
  Axios: { brings: "US-Israel-Gulf diplomacy scoops (Barak Ravid)", take: "its scoops: what officials told it and documents it obtained", newsroom: true, en: ["Axios"], ar: ["أكسيوس"] },
  Bloomberg: { brings: "energy, markets and diplomacy scoops", take: "what people familiar and officials told it", newsroom: true, en: ["Bloomberg"], ar: ["بلومبرغ"] },
  WSJ: { brings: "US policy, Iran and Gulf scoops", take: "what officials told it and documents it saw", newsroom: true, en: ["Wall Street Journal", "WSJ", "the Journal"], ar: ["وول ستريت جورنال"] },
  NYT: { brings: "US policy, intelligence and Israel scoops", take: "what officials told it and documents it saw", newsroom: true, en: ["New York Times", "NYT", "the Times"], ar: ["نيويورك تايمز"] },
  "Washington Post": { brings: "US policy and intelligence scoops", take: "what officials told it", newsroom: true, en: ["Washington Post", "the Post"], ar: ["واشنطن بوست"] },
  CNN: { brings: "US officials' accounts and field reporting", take: "what officials told it", newsroom: true, en: ["CNN"], ar: ["سي إن إن"] },
  "Financial Times": { brings: "Gulf, energy and diplomacy sourcing", take: "what people familiar told it", newsroom: true, en: ["Financial Times", "FT"], ar: ["فايننشال تايمز"] },
  Politico: { brings: "Washington policy sourcing", take: "what officials told it", newsroom: true, en: ["Politico"] },
  // Israeli media: officials' and security sources' briefings.
  N12: { brings: "Israeli officials' and security sources' briefings; political scoops", take: "what Israeli officials and sources told it", newsroom: true, en: ["N12", "Channel 12"], he: ["חדשות 12", "N12"] },
  Kan: { brings: "Israeli officials' briefings and Arab-affairs reporting", take: "what Israeli officials and sources told it", newsroom: true, en: ["Kan", "Kan News"], he: ["כאן", "כאן חדשות"] },
  "Channel 13": { brings: "Israeli political and security scoops", take: "what Israeli officials and sources told it", newsroom: true, en: ["Channel 13"], he: ["חדשות 13", "רשת 13"] },
  "Channel 14": { brings: "the Israeli right's political sourcing", take: "what Israeli officials told it", newsroom: true, en: ["Channel 14"], he: ["ערוץ 14", "עכשיו 14"] },
  "i24 News": { brings: "Israeli officials' and Gulf sourcing", take: "what officials told it", newsroom: true, en: ["i24 News", "i24NEWS", "i24"] },
  Ynet: { brings: "Israeli security and political reporting", take: "what Israeli officials and sources told it", newsroom: true, en: ["Ynet", "Yedioth Ahronoth"], he: ["ynet", "ידיעות אחרונות"] },
  Walla: { brings: "Israeli security and political reporting", take: "what Israeli officials told it", newsroom: true, en: ["Walla"], he: ["וואלה"] },
  Haaretz: { brings: "Israeli security, legal and political reporting", take: "what Israeli officials and documents told it", newsroom: true, en: ["Haaretz"], he: ["הארץ"] },
  "Israel Hayom": { brings: "Israeli government-close sourcing", take: "what Israeli officials told it", newsroom: true, en: ["Israel Hayom"], he: ["ישראל היום"] },
  "Jerusalem Post": { brings: "Israeli officials' and security sourcing", take: "what Israeli officials told it", newsroom: true, en: ["Jerusalem Post", "JPost"] },
  // Iranian.
  Tasnim: { brings: "the IRGC's line and official Iranian statements", take: "Iran's official words and claims, as Iran's account", en: ["Tasnim"], ar: ["تسنيم"] },
  Fars: { brings: "the IRGC's line", take: "Iran's official words and claims, as Iran's account", en: ["Fars"], ar: ["فارس"] },
  "Nour News": { brings: "the Supreme National Security Council's line and leaks", take: "its own information, as the Iranian security establishment's account", newsroom: true, en: ["Nour News"], ar: ["نور نيوز"] },
  "Iran International": { brings: "opposition-side sourcing inside Iran", take: "its own sourced information, as an opposition outlet's account", newsroom: true, en: ["Iran International"] },
  // Yemen.
  "Al-Masirah": { brings: "the Houthis' own statements and claims", take: "the Houthis' words and claims, as theirs", en: ["Al-Masirah"], ar: ["المسيرة"] },
  "Sheba Intelligence": { brings: "Yemen security sourcing", take: "its own sourced information", newsroom: true, en: ["Sheba Intelligence", "Sheba"], ar: ["شبا"] },
  Suhail: { brings: "Islah-close Yemeni sourcing", take: "its own sourced information", en: ["Suhail"], ar: ["سهيل"] },
};

const norm = (s: string) => String(s || "").toLowerCase().replace(/\s*\((?:x|telegram|english|arabic|urgent)\)\s*$/i, "").replace(/^the\s+/, "").replace(/[^a-z0-9֐-ۿ]+/g, "");
const BY = new Map<string, SourceProfile>();
for (const [name, p] of Object.entries(PROFILES)) {
  BY.set(norm(name), p);
  for (const n of p.en ?? []) if (!BY.has(norm(n))) BY.set(norm(n), p);
}

/** The profile of the source carrying an item: by its name, "Al Jazeera (X)" and "The New Arab" alike. */
export function profileOf(source: string): SourceProfile | undefined {
  return BY.get(norm(source));
}

/** Its line for the reader, after the outlet's alignment. */
export function profileNote(source: string): string {
  const p = profileOf(source);
  return p ? `; usually brings ${p.brings}; take ${p.take}` : "";
}

/** The readers' rule on scoops and profiles (reader.ts, iran-reader.ts, gaza-reader.ts). */
export const SCOOP_RULE = `- ANY outlet can have its own scoop, even one that rarely does: what sources or officials told IT, what it learned, obtained or saw, an interview given to it, documents it reviewed. Such an item is its exclusive and is published, whoever the outlet is. An item's outlet line may say what that outlet usually brings and what to take from it: use it to tell its own information from news it only repeats, never to drop a scoop because the outlet is not known for scoops.
- A scoop is carried whole (user, 27 Oct: an Al Jadeed exclusive lost half its sentence): every claim in it goes in the headline or the body, in its own words when they read well; nothing it says is dropped or merged away. Who told it keeps its kind: "Diplomatic sources: …", "Political sources: …", "Security sources: …", never bare "sources" and never left out.`;
