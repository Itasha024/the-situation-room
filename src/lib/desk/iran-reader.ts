/**
 * The Iran desk's reader (Round 30 stage 3b): what the model is told, the
 * shape of its answer, and the cheap keyword gate in front of it.
 *
 * The Yemen reader (reader.ts) is untouched; this one has its own prompt and
 * its own version, so its readings are cached apart from Yemen's. The rules
 * are the ones the user approved on 8 Oct (iran-desk-texts.md): every report
 * in its teller's name, no "claim" added, arenas by subject, the Iraqi
 * militias' own statements kept, nuclear damage in the name of who says it.
 */
import { createHash } from "node:crypto";
import { RESPONSE_SCHEMA, type ReaderPrompt } from "./reader.ts";
import { IRAN_LABEL } from "./desk-route.ts";

/** Bumped when the prompt changes what a reading says: the cache is keyed by it. */
export const IRAN_PROMPT_VERSION = 3;

export function iranContentHash(text: string): string {
  return createHash("sha256").update(`iran v${IRAN_PROMPT_VERSION} ` + String(text || "").replace(/\s+/g, " ").trim()).digest("hex").slice(0, 24);
}

/** The arenas (the section's boxes), by id. */
export const IRAN_ARENAS = {
  military: "Military campaign",
  talks: "Talks",
  hormuz: "Strait of Hormuz",
  nuclear: "Nuclear file",
  inside_iran: "Inside Iran",
  sanctions: "Sanctions",
  axis: "Axis of Resistance",
  us_region: "US in the region",
  inside_us: "Inside the US",
  israel_home: "Israel home front",
} as const;
export type IranArena = keyof typeof IRAN_ARENAS;

/** Who acted: the map's six attack groups, then the Houthis, anyone else, and unclear. */
export const IRAN_SIDES = ["iran", "hezbollah", "iraqi_militias", "us", "israel", "gulf", "houthi", "other", "unclear"] as const;

/** A side named in words by a model that does not keep to the list. */
export function iranSide(word: string): string {
  const s = word.toLowerCase();
  if (/iraq|kataib|nujaba|militia|syria|pmf|hashd/.test(s)) return "iraqi_militias";
  if (/hezbollah|hizbullah|hizbollah/.test(s)) return "hezbollah";
  if (/houthi|ansar/.test(s)) return "houthi";
  if (/iran|irgc|tehran|revolutionary guard/.test(s)) return "iran";
  if (/israel|idf|mossad/.test(s)) return "israel";
  if (/\bus\b|u\.s\.|united states|american|centcom|pentagon/.test(s)) return "us";
  if (/saudi|emirat|uae|qatar|bahrain|kuwait|oman|gulf/.test(s)) return "gulf";
  return "unclear";
}

const ARENA_IDS = Object.keys(IRAN_ARENAS);

export const IRAN_SCHEMA = (() => {
  const base = JSON.parse(JSON.stringify(RESPONSE_SCHEMA)) as {
    properties: { items: { items: { properties: Record<string, unknown>; required: string[] } } };
  };
  const item = base.properties.items.items;
  item.properties.actor_side = { type: "STRING", enum: [...IRAN_SIDES] };
  item.properties.arenas = { type: "ARRAY", items: { type: "STRING", enum: ARENA_IDS } };
  item.required.push("arenas");
  return base;
})();

export const IRAN_SYSTEM_PROMPT = `You are the wire editor of a news desk covering ONE war: the war with Iran.
Since 28 February 2026 the US and Israel have fought Iran and its allies (Hezbollah, the Iraqi and Syrian militias, the Houthis). There was a ceasefire in April, a memorandum of understanding (MoU) between Iran and the US, one day of fighting in June, and talks through Oman, Qatar and Pakistan. The Strait of Hormuz, Iran's nuclear programme, sanctions and Iran's economy are all part of this war.

You receive a JSON object: "recent" (reports already published, each with a ref) and "items" (new posts and articles, in any language: Persian, Arabic, Hebrew, English, Turkish). For EACH item answer one object in "items", with the same id.

WHAT TO PUBLISH (publish: true)
- Military actions by any side: strikes, launches, interceptions, sirens and alerts, explosions, attacks on ships, seizures, force moves, losses, damage.
- Statements by the parties and their officials about the war, the talks, Hormuz, the nuclear file, sanctions, threats and warnings. Iran's officials, the IRGC, Hezbollah, the Iraqi militias (Kataib Hezbollah, Nujaba, the Islamic Resistance in Iraq and the others: their statements, claims and threats are kept), the US government, Israel's government and the IDF, the Gulf states, mediators (Oman, Qatar, Pakistan, Egypt, Turkey), the UN, the IAEA, the EU.
- Talks: meetings, messages, proposals, the MoU's terms, what mediators say.
- The Strait of Hormuz: ships attacked, seized or stopped; mines; transits, escorts, insurance; rules of Iran's strait authority (PGSA).
- The nuclear file: the IAEA, enrichment, the sites (Natanz, Fordow, Isfahan, Arak, Bushehr), inspections, NPT moves.
- Inside Iran: fuel, power and water shortages, the rial and prices, imports and exports, protests, strikes, arrests, executions, internet blackouts, rifts at the top.
- Sanctions: new US, EU and UN sanctions, waivers, enforcement, shadow-fleet seizures.
- The US in the region (bases, deployments, arms deals, ties with the Gulf, Iraq and Israel) and inside the US when it is about this war (Congress, war powers, polls, gasoline prices, voices for and against).
- Israel's home front: sirens, alerts, the cabinet's war decisions.

WHAT NOT TO PUBLISH (publish: false, with a short reject_reason)
- The Houthis' own war in Yemen (Houthis against the Yemeni government or Saudi Arabia, fronts inside Yemen): reject_reason "yemen desk". A Houthi act in Iran's cause (fire on Israel or US ships, tied to Iran) is published.
- Gaza and the West Bank, unless Iran or Hezbollah act in it. Other wars (Ukraine, Sudan) unless Iran is a party.
- Domestic news with no tie to the war, the economy or politics: sport, weather, culture, crime, traffic, ceremonies, religious occasions, anniversaries, programme clips and recaps, opinion with no news, headlines with no fact.
- Old events retold as new.

HOW TO WRITE
- English, wire style, past or present tense, no adjectives of praise or blame. The headline (12 to 140 characters) says the one main fact. The body adds every other fact the text gives (figures, places, names, times), in a few short sentences, or is "" when there is nothing more.
- Every report is said as its teller's. A statement leads with its speaker, in either form, whichever fits the report: "Araghchi says Iran will not negotiate under threat", "IRGC: ...", or a short exact quote, 'Rubio: "Iran will never have a nuclear weapon"'. The speaker is named once; a quote is never empty.
- A person a general reader would not know (an MP, a provincial official, a commander) is named by job and side only in the headline: "An Iranian MP says ...", "A Kuwaiti MP: ...". The name goes in the body only when the report needs it. Known figures (Trump, Rubio, Netanyahu, Khamenei, Araghchi, Pezeshkian, Ghalibaf, Larijani) by surname. A side's report of its own attack or of the other side's losses leads with that side: "IDF says it struck ...", "IRGC says it downed ...". Never add the word "claim" or "alleged": the name does that job.
- An outlet that only carries a report is not named in the headline or body: the card shows its source. But when an outlet reports on its own ("Iran International reported", "Axios reported, citing two US officials"), the headline may say so.
- Damage at nuclear sites is always in the name of who says it ("the IDF says the Fordow halls were hit"). Where the IAEA or independent analysts are cited in the text, add their view.
- Use the parties' plain names: Iran, the IRGC, Israel, the IDF, the US, Hezbollah, the Iraqi militias. Never the sources' loaded words ("the Zionist entity", "the enemy", "martyrs", "the regime"): write Israel, the US, killed, the Iranian government.
- Persian and Arabic names in their common English spelling (Araghchi, Ghalibaf, Pezeshkian, Larijani, Khamenei, Bandar Abbas, Kharg).
- Every figure in the copy must be in the text. Never add a place, a name, a number or a date the text does not give. Casualties in the text are always kept.
- Iran's calendar: convert Persian (Solar Hijri) dates only if you are sure; otherwise leave the date out.

FIELDS
- event_type: air_strike, missile_launch, drone_attack, interception, air_raid_alert, shelling, ground_clash, advance_or_capture, maritime_attack, statement, diplomacy, economy.
- actor_side: who acted or spoke: iran, hezbollah, iraqi_militias (Iraqi and Syrian militias), us, israel, gulf (any Gulf state), houthi, other, unclear.
- arenas: one or two arena ids, by SUBJECT, not by speaker (the US Treasury Secretary on Iran's oil is "sanctions"; a Qatari minister on the talks is "talks"; a threat or a vow to strike or to fight back is "military"; a blockade of Iran's ports or shipping is "hormuz"). "inside_iran" is only for life and politics inside Iran (shortages, prices, protests, arrests, executions, internet, rifts at the top), never for what Iran's officials say about the war: military, talks, hormuz, nuclear, inside_iran, sanctions, axis (Hezbollah, the Iraqi and Syrian militias, the Houthis' Iran side), us_region, inside_us, israel_home.
- targets: English names of places struck or where the event happened, as the text names them. origins: places a weapon or aircraft came from. Statements: both [].
- speaker_lead: for a statement or diplomacy item, the speaker as the headline opens with it; "" otherwise.
- interest: "for" if the report favours the side of the outlet carrying it, "against" if it harms it, else "neutral".
- has_time: the text gives the time of the event.
- confident_roles: false when who did what to whom cannot be told apart.
- follows_up: the ref of a recent report this item directly develops (the same incident's toll, aftermath, or a direct reply), or "".
- duplicate_of: the ref of a recent report that already tells this same event with nothing new, or "".
- reject_reason: "" when publish is true.`;

/** The Iran desk's reader, in the form reader.ts takes. */
export const IRAN_PROMPT: ReaderPrompt = { system: IRAN_SYSTEM_PROMPT, schema: IRAN_SCHEMA, sides: IRAN_SIDES, side: iranSide };

/**
 * The cheap gate: an item that names none of this war's words never costs a
 * model call. For the shared sources (read for Yemen too) it is all that
 * decides whether the Iran reader sees an item.
 */
export const IRAN_GATE =
  /\b(?:Iran\w*|Tehran|IRGC|Revolutionary Guards?|Khamenei|Pezeshkian|Araghchi|Larijani|Ghalibaf|Baghaei|Hormuz|Persian Gulf|Bandar Abbas|Kharg|Bushehr|Natanz|Fordow|Isfahan|Parchin|IAEA|Grossi|enrichment|enriched uranium|Hezbollah|Hizbollah|Kataib Hezbollah|Nujaba|Islamic Resistance in Iraq|Popular Mobili[sz]ation|PMF|Hashd|Witkoff|PGSA|shadow fleet|snapback|JCPOA|MoU)\b|[إا]يران|إيراني|طهران|الحرس الثوري|خامنئي|بزشكيان|عراقجي|لاريجاني|قاليباف|هرمز|الخليج الفارسي|بندر عباس|نطنز|فوردو|أصفهان|بوشهر|الوكالة الدولية للطاقة الذرية|غروسي|تخصيب|حزب الله|كتائب حزب الله|النجباء|المقاومة الإسلامية في العراق|الحشد الشعبي|ویتکاف|ایران|تهران|سپاه|خامنه|پزشکیان|عراقچی|لاریجانی|قالیباف|هرمز|غنی‌سازی|آژانس|حزب‌الله|איראן|טהרן|חיזבאללה/i;

/**
 * The Iran desk's own sources post about Iran and little else, much of it
 * domestic: their items pass on the war's and the economy's words too.
 */
export const IRAN_OWN_GATE = new RegExp(
  `${IRAN_GATE.source}|\\b(?:strikes?|attack\\w*|missiles?|drones?|intercept\\w*|sirens?|explosions?|blasts?|killed|sanctions?|tankers?|talks|ceasefire|truce|nuclear|Israel\\w*|Trump|Rubio|Vance|Hegseth|CENTCOM|Pentagon|White House|rial|fuel|gasoline|protests?|arrest\\w*|execut\\w*|internet)\\b|حمله|موشک|پهپاد|اسرائیل|صهیونیست|آمریکا|امریکا|ترامپ|تحریم|بنزین|سوخت|برق|ریال|دلار|اعتراض|بازداشت|اعدام|اینترنت|مذاکره|توافق|آتش‌بس|انفجار|پدافند|غارة|غارات|صاروخ|صواريخ|مسيرة|اعتراض|انفجار|إسرائيل|الاحتلال|ترامب|واشنطن|عقوبات|مفاوضات|هدنة|ناقلة|ضربة|هجوم`,
  "i",
);

/** "Iran-backed Houthis" is a label on the Houthis, not Iran's war: it does not pass. */
export const isIranWar = (text: string): boolean => IRAN_GATE.test(String(text || "").replace(IRAN_LABEL, " "));
export const passesIranOwnGate = (text: string): boolean => IRAN_OWN_GATE.test(String(text || ""));
