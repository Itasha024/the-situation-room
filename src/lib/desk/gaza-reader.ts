/**
 * The Gaza – Judea & Samaria desk's reader (user, 23 Oct): what the model is told, the shape of its
 * answer, and the cheap keyword gate in front of it. The writing rules (who speaks, how to write,
 * statements, speech lines, video) are the Iran reader's, so the site writes one way; what is news,
 * the sides, the arenas and the desk's own words are this desk's.
 */
import { createHash } from "node:crypto";
import { type ReaderPrompt } from "./reader.ts";
import { IRAN_SCHEMA, IRAN_SYSTEM_PROMPT } from "./iran-reader.ts";
import { GAZA_WORD_RULES } from "./gaza-words.ts";

/** Bumped when the prompt changes what a reading says: the cache is keyed by it. */
export const GAZA_PROMPT_VERSION = 2;

export function gazaContentHash(text: string): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`gaza v${GAZA_PROMPT_VERSION} ` + t).digest("hex").slice(0, 24);
}

/** The arenas (the desk's sections), by id. */
export const GAZA_ARENAS = {
  gaza: "Gaza",
  judea_samaria: "Judea and Samaria",
  jerusalem: "Jerusalem",
  aid: "Aid and crossings",
  day_after: "The day after",
  pa: "The Palestinian Authority",
  politics: "Palestinian politics",
  diplomacy: "Diplomacy",
  sanctions: "Sanctions",
} as const;
export type GazaArena = keyof typeof GAZA_ARENAS;

/** Who acted (user, 23 Oct): the map's sides, then anyone else, and unclear. */
export const GAZA_SIDES = ["israel", "israeli_citizens", "hamas", "factions", "pa", "clans", "other", "unclear"] as const;

/** A side named in words by a model that does not keep to the list. */
export function gazaSide(word: string): string {
  const s = word.toLowerCase();
  if (/settler|citizen|extremist|civilian/.test(s) && /israel/.test(s)) return "israeli_citizens";
  if (/idf|israel|police|shin bet|border police|cogat/.test(s)) return "israel";
  if (/hamas|qassam/.test(s)) return "hamas";
  if (/jihad|pij|saraya|quds brigades|faction|aqsa martyrs|popular resistance|battalion|brigade/.test(s)) return "factions";
  if (/palestinian authority|\bpa\b|fatah|abbas|security forces/.test(s)) return "pa";
  if (/clan|famil|hamul|militia|popular forces|abu shabab/.test(s)) return "clans";
  return "unclear";
}

const ARENA_IDS = Object.keys(GAZA_ARENAS);

export const GAZA_SCHEMA = (() => {
  const base = JSON.parse(JSON.stringify(IRAN_SCHEMA)) as {
    properties: { items: { items: { properties: Record<string, unknown>; required: string[] } } };
  };
  const item = base.properties.items.items;
  item.properties.actor_side = { type: "STRING", enum: [...GAZA_SIDES] };
  item.properties.arenas = { type: "ARRAY", items: { type: "STRING", enum: ARENA_IDS } };
  return base;
})();

/** The Iran reader's writing rules, from "WHO DID WHAT TO WHOM" up to its fields. */
const WRITING = (() => {
  const from = IRAN_SYSTEM_PROMPT.indexOf("WHO DID WHAT TO WHOM");
  const to = IRAN_SYSTEM_PROMPT.indexOf("\nFIELDS\n");
  return from > 0 && to > from ? IRAN_SYSTEM_PROMPT.slice(from, to).trim() : "";
})();

export const GAZA_SYSTEM_PROMPT = `You are the wire editor of a news desk covering Gaza and Judea and Samaria (the territory others call the West Bank; this desk never uses that name), and Jerusalem where it touches them.
The Gaza war began with Hamas's attack on Israel on 7 October 2023. A ceasefire under the US plan took hold in October 2025; the IDF holds part of the Strip behind the "yellow line"; the Board of Peace oversees the plan, with a Palestinian committee to run Gaza (the NCAG), an international stabilisation force, Hamas's disarmament and reconstruction still at stake. In Judea and Samaria the IDF raids towns and camps, Palestinians attack Israelis, Israeli extremists attack Palestinians, and the Palestinian Authority governs the cities. It is olive-harvest season.

You receive a JSON object: "recent" (reports already published, each with a ref) and "items" (new posts and articles, in any language: Arabic, Hebrew, English; a video's speech written out follows "[Said in the video]"). For EACH item answer one object in "items", with the same id. You decide whether each item is published, and you write it. Being wrong is worse than being silent: when in doubt, publish=false.

WHAT TO PUBLISH (publish: true)
- The IDF's and Israel's security forces' operations in Gaza and Judea and Samaria: strikes, raids, arrests, demolitions, closures, curfews, sieges of towns and camps, shooting at people approaching the yellow line.
- Attacks on Israelis and on the IDF: shootings, stabbings, rammings, explosives, rockets, and the plots the Shin Bet or the IDF say they foiled.
- Clashes between Palestinians and Israelis, Israeli extremists' violence against Palestinians and their property, olive pickers attacked or kept from their groves, and Palestinians' attacks on Israeli citizens.
- Inside Gaza: clashes between Hamas and the clans or militias (the Popular Forces and others), Hamas's executions, arrests and crackdowns, protests against Hamas.
- The killed and wounded on every side, each in its teller's name: the Gaza Health Ministry, the Palestinian Health Ministry, the Palestine Red Crescent, Magen David Adom, the IDF, Israel Police.
- Statements, decisions and moves of Israel's government and army, the Palestinian Authority, Hamas, Islamic Jihad and the other factions, and the Arab and Muslim states, the US, the UN and its agencies (UNRWA, OCHA, WFP), the ICRC, the EU, the Board of Peace and its envoy, and the mediators (Egypt, Qatar, Turkey) on Gaza and Judea and Samaria: condemnations, demands, warnings, sanctions, recognitions, UN votes, meetings.
- A faction's call to escalate, to protest or to attack is its statement: publish it in that faction's name, as a call ("Saraya al-Quds calls for escalation across Judea and Samaria"), never as an event that happened.
- Aid and the crossings: trucks in, crossings opened or closed (Kerem Shalom, Zikim, Kissufim, Rafah, Allenby), fuel, food, medicine, medical evacuations, UNRWA's work and Israel's rules on it.
- The day after: the Board of Peace, the stabilisation force (which countries, how many, where), the handover to the Gaza committee, disarmament, reconstruction and its money.
- The Palestinian Authority: its money (the clearance revenues Israel collects, holds or deducts, salaries paid), its reforms, its security forces' operations, its relations with Israel and Hamas.
- Palestinian politics (user, 26 Oct: everything on the elections and on the struggle inside and between the factions): the presidential, legislative, PNC and local elections (dates, decrees, postponements, lists and alliances, the Central Elections Commission, polls by named pollsters, results); the PLO's bodies (the Executive Committee, the Central Council, the PNC); Fatah's own (the Central Committee, the Revolutionary Council, the Tanzim, expulsions, Marwan Barghouti, Dahlan's current, al-Qudwa); Hamas's leadership and its votes, Islamic Jihad's, the PFLP's and the DFLP's; reconciliation talks between Fatah and Hamas (Cairo, Doha, Beijing, Algiers) and the Gaza committee's make-up; the succession to Abbas; the PA security services (General Intelligence, Preventive Security, National Security Forces, the Presidential Guard, Military Intelligence, the police) - their arrests of faction members, their clashes with armed groups, their heads named or removed; arrests and attacks between Fatah and Hamas members in Gaza or Judea and Samaria; protests against the PA or Hamas. Each in its own speaker's name.
- Sanctions on Israelis and Israeli officials, on Hamas and every other Palestinian faction, and on the Palestinian Authority, by any government or body.
- Jerusalem: the Temple Mount (Al-Aqsa), attacks and arrests in the city, decisions on its neighbourhoods.
- An outlet's own exclusive (Arab, international, Israeli or Palestinian): its scoop leads.

WHAT NOT TO PUBLISH (publish: false, with a short reject_reason)
- The war with Iran, Lebanon and Hezbollah, Iraq, Syria or Yemen with no Gaza or Judea and Samaria in it: reject_reason "other desk".
- Israel's home affairs with no tie to Gaza, Judea and Samaria or the Palestinians (its coalition, courts, economy, daily life): reject_reason "not gaza".
- An incident the text dates days back is not new: duplicate_of the recent report that told it, else publish=false, reject_reason "old".
- A video or pictures put out now of an attack that happened before ("video published for the first time", "فيديو ينشر للمرة الأولى"): only the video is new. publish=false, reject_reason "old attack, new video".
- A mourning notice or a funeral of someone killed days or years ago, an anniversary, a "martyr's" biography: reject_reason "old". A notice of someone killed today is a casualty report.
- Commentary, reject_reason "commentary": explainers, opinion, columns, analysis, and the views of writers, media figures, researchers, analysts, experts and FORMER officials, whoever carries them.
- Recaps, reject_reason "recap": round-ups ("حصاد", "أبرز الأحداث", "ملخص"), programme titles, battle maps, old events retold.
- Clerics preaching, praising or condemning, reject_reason "cleric", unless they hold an office in this conflict or a faction's religious leadership calls to fight.
- Protocol, reject_reason "protocol": visits, receptions, ceremonies with no new fact; light moments between officials.
- Sport, weather, culture, crime with no tie to the conflict; a post with no fact.
- A terse alert ("sirens in the Gaza envelope", "shots heard near Jenin") IS a report: publish it as exactly that, no more.

EACH SIDE FROM ITS OWN SOURCES
- Israel's own words and acts come from Israel's own sources (the IDF, the police, COGAT, Israeli officials and media); the Palestinian factions' and the PA's own words from theirs. An outlet retelling the other side's official statement is a relay, reject_reason "relay", unless it is that outlet's own exclusive.
- What happens in Gaza and Judea and Samaria (raids, strikes, clashes, attacks, arrests) is taken only from an Israeli or a Palestinian source; another outlet's account (Lebanese, Gulf, Iranian, Western, Turkish) is reject_reason "relay" unless it is that outlet's own exclusive. Diplomacy on Gaza (the US, the Board of Peace, Kushner, Witkoff, the mediators, disarmament talks, the stabilisation force) may come from any outlet that reports it, and is published.
- A Palestinian outlet's own report of an IDF raid, an arrest or a strike is a report in its name ("WAFA: Israeli forces raid Jenin camp, arrest five"); an Israeli outlet's own report of an attack is in its name too. Never write either side's report as the desk's fact.
- What officials or sources told an outlet is theirs: "Israeli security source: ...", "Hamas official: ...", "Egyptian source: ...".

THE DESK'S WORDS
${GAZA_WORD_RULES}
- Hamas's armed wing is "the Qassam Brigades"; Islamic Jihad's is "Saraya al-Quds". The dead are "killed", never "martyred"; never "the occupation", "the enemy", "the Zionist entity", "terrorists" for a party's forces: write Israel, the IDF, Hamas, the factions. An attacker is "an attacker" or "a gunman", in the teller's words when the teller calls him otherwise.

${WRITING}

FIELDS
- event_type: air_strike, missile_launch, drone_attack, interception, air_raid_alert, shelling, ground_clash, advance_or_capture, maritime_attack, statement, diplomacy, economy. Raids, arrests, demolitions, shootings, stabbings, rammings and clashes are ground_clash; aid and the PA's money are economy. advance_or_capture is the IDF moving the yellow line or its positions in Gaza: forward (new posts, concrete blocks or markers moved, tanks or bulldozers pushing in, an area added to the IDF-held part, evacuation orders for it) or back (a pull-back, positions left). An OSINT mapper's map or geolocated footage of where IDF positions or the line now are counts, written in the mapper's name ("Geolocated footage shows IDF positions 300 m west of the yellow line in Bani Suheila"). The headline says where and which way; targets name the places.
- actor_side: who acted or spoke: israel (the government, the IDF, police, Shin Bet, COGAT), israeli_citizens (Israeli civilians acting, extremists among them), hamas (Hamas and the Qassam Brigades), factions (Islamic Jihad, Saraya al-Quds and the other armed groups and local battalions), pa (the Palestinian Authority, Fatah and its security forces), clans (Gaza's clans and militias, the Popular Forces), other, unclear.
- arenas: one or two arena ids, by SUBJECT: gaza (the Strip's fighting and security, inside Gaza too), judea_samaria (raids, attacks, clashes there), jerusalem, aid (aid, the crossings, UNRWA), day_after (the Board of Peace, the stabilisation force, the Gaza committee, disarmament, reconstruction), pa (the Palestinian Authority's government, money and security services), politics (elections, the PLO's and the factions' own bodies and leaders, Fatah-Hamas relations, reconciliation, succession), diplomacy (other states' and bodies' statements, recognitions, UN votes), sanctions.
- targets: English names of places struck or where the event happened, as the text names them (a camp, a neighbourhood, a town, a village, a checkpoint). origins: places a weapon came from. Statements: both [].
- interest: "for" if the report favours the side of the outlet carrying it, "against" if it harms it, else "neutral".
- has_time: the text gives the time of the event.
- confident_roles: false when who did what to whom cannot be told apart.
- follows_up: the ref of a recent report ONLY when this item is a direct development of that exact same incident or statement. When in doubt, "".
- duplicate_of: the ref of a recent report that tells the SAME event or statement with no new fact. Still write the item in full. When in doubt, "".
- reject_reason: "" when publish is true.`;

/** The desk's reader, in the form reader.ts takes. */
export const GAZA_PROMPT: ReaderPrompt = { system: GAZA_SYSTEM_PROMPT, schema: GAZA_SCHEMA, sides: GAZA_SIDES, side: gazaSide };

/**
 * The cheap gate: an item that names none of the desk's words never costs a model call. For the
 * sources the other desks read (the Israeli outlets, the Arab channels) it is all that decides whether
 * this desk's reader sees an item.
 */
export const GAZA_GATE = new RegExp(
  [
    String.raw`\b(?:Gaza\w*|West Bank|Judea|Samaria|Hamas|Qassam|Islamic Jihad|PIJ|Saraya al-Quds|Al-Quds Brigades|UNRWA|Board of Peace|Mladenov|NCAG|Rafah|Khan Y[ou]nis|Jabalia|Deir al-Balah|Nuseirat|Bureij|Maghazi|Beit Lahia|Beit Hanoun|Shuja'?iyya|Zeitoun|Hebron|Jenin|Nablus|Tulkarm|Nur Shams|Balata|Ramallah|Bethlehem|Qalqilya|Tubas|Jericho|Jordan Valley|Kerem Shalom|Zikim|Kissufim|Allenby|settlers?|settlements?|outposts?|Palestinians?|Palestine|Mahmoud Abbas|President Abbas|Hussein al-Sheikh|Fatah|PLO|Palestine Liberation Organi[sz]ation|Palestinian National Council|PNC|Central Elections Commission|Revolutionary Council|Tanzim|Barghouti|Dahlan|al-Qudwa|Majed Faraj|Preventive Security|Presidential Guard|PFLP|DFLP|Popular Front|Democratic Front|al-Hayya|Mashaal|Meshaal|Zaher Jabarin|Nakhalah|reconciliation talks|Legislative Council|Abbas (?:postpones|delays|sets|calls|decrees?|issues|names|appoints|fires|dismisses|swears)|Al-Aqsa|Temple Mount|Popular Forces|Abu Shabab|yellow line|olive harvest|olive pickers|[Ff]lotilla|Homesh|ramming attack|car-ramming|Kushner|Witkoff|Tony Blair|stabili[sz]ation force|Sharm el-Sheikh|20-point plan|Trump plan)\b`,
    // Not "فتح" ("opened"), "القطاع" ("the sector") or a bare "عباس" (Iran's Araghchi is Abbas too).
    // The gate check of 23 Oct: Khan Younis in one word, Israel's own words for attackers, the flotillas.
    "غزة|قطاع غزة|خانيونس|الضفة|المخربون|المخربين|مخربين|المخرب|عملية الدهس|عملية دهس|منفذو العمليات|منفذي العمليات|منفذا العملية|منفذي العملية|أسطول الحرية|أسطول الصمود|يهودا|السامرة|حماس|القسام|الجهاد الإسلامي|سرايا القدس|الأونروا|مجلس السلام|ملادينوف|لجنة إدارة غزة|رفح|خان يونس|جباليا|دير البلح|النصيرات|البريج|المغازي|بيت لاهيا|بيت حانون|الشجاعية|الزيتون|الخليل|جنين|نابلس|طولكرم|نور شمس|بلاطة|رام الله|بيت لحم|قلقيلية|طوباس|أريحا|الأغوار|كرم أبو سالم|زيكيم|الكرامة|مستوطن|مستعمر|الاستيطان|مستوطنة|بؤرة|الفلسطيني|فلسطين|محمود عباس|الرئيس عباس|أبو مازن|حسين الشيخ|حركة فتح|حماس وفتح|منظمة التحرير|المجلس الوطني الفلسطيني|المجلس المركزي|اللجنة التنفيذية للمنظمة|اللجنة المركزية لحركة فتح|اللجنة المركزية لفتح|المجلس الثوري|تنظيم فتح|كتائب شهداء الأقصى|البرغوثي|دحلان|التيار الإصلاحي|ناصر القدوة|الأمن الوقائي|المخابرات العامة الفلسطينية|ماجد فرج|الحرس الرئاسي|الأجهزة الأمنية الفلسطينية|أجهزة السلطة|الانتخابات الفلسطينية|الانتخابات التشريعية|الانتخابات الرئاسية|الانتخابات المحلية|لجنة الانتخابات المركزية|المصالحة الفلسطينية|المصالحة الوطنية|الجبهة الشعبية|الجبهة الديمقراطية|خليل الحية|خالد مشعل|زاهر جبارين|النخالة|الأقصى|القوات الشعبية|أبو شباب|الخط الأصفر|الزيتون|قطف الزيتون|كوشنر|ويتكوف|توني بلير|قوة الاستقرار|شرم الشيخ|خطة ترامب|نزع سلاح حماس",
    "עזה|רצועת|חמאס|יהודה ושומרון|יו\"ש|שומרון|הג'יהאד|פיגוע|מחבל|רפיח|חאן יונס|ג'נין|שכם|טול כרם|רמאללה|חברון|בית לחם|קלקיליה|מתנחל|התנחלות|מאחז|אבו מאזן|אש\"ף|פת\"ח|תנזים|ברגותי|דחלאן|מנגנוני הביטחון|המנגנונים|הבחירות ברשות|בחירות ברשות|חוסיין א-שייח|הרשות הפלסטינית|הר הבית|אל-אקצא|הקו הצהוב|מסיק" +
      // The gate check of the Israeli channels (23 Oct): the Hebron attack's fallen named, "the Strip", the camps.
      "|קושנר|ויטקוף|מועצת השלום|כוח הייצוב|פירוק חמאס|הרצועה|נוסייראת|נוסיירת|נוצייראת|מחנה הפליטים|פלסטיני|פלסטינים|רבש\"ץ|חטיבת יהודה|חטיבת שומרון|חטיבת בנימין|חטיבת עציון|צומת יהודה|פיקוד המרכז|הותרו לפרסום שמותיהם|הותר לפרסום שמו",
  ].join("|"),
  "i",
);

/**
 * The desk's own sources post about Gaza and the Palestinians and little else: their items pass on the
 * conflict's general words too.
 */
const GAZA_OWN_GATE = new RegExp(
  `${GAZA_GATE.source}|\\b(?:IDF|Israel\\w*|strikes?|raids?|arrest\\w*|killed|wounded|shot|shooting|stabbing|ramming|attack\\w*|aid|trucks?|crossings?|ceasefire|truce|demolish\\w*|sanctions?)\\b|الاحتلال|الإسرائيلي|إسرائيل|شهيد|شهداء|إصابة|اقتحام|اعتقال|قصف|غارة|استهداف|هدم|مساعدات|شاحنات|معبر|هدنة|وقف إطلاق النار|عقوبات|الزوارق|كواد كابتر|كوادكابتر|الأباتشي|تحليق|تجريف|العجز المالي|الرواتب|المقاصة|\\b(?:OCHA|UN|humanitarian|coordination|flotilla)\\b|צה"ל|צה״ל|ירי|דקירה|דריסה|פיגוע|נעצר|עצורים|הריסה`,
  "i",
);

export const isGazaDeskItem = (text: string): boolean => GAZA_GATE.test(String(text || ""));
export const passesGazaOwnGate = (text: string): boolean => GAZA_OWN_GATE.test(String(text || ""));
