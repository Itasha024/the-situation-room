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
import { PERSIAN_SPELLING_RULES } from "./spelling.ts";

/** Bumped when the prompt changes what a reading says: the cache is keyed by it. */
export const IRAN_PROMPT_VERSION = 6;

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

You receive a JSON object: "recent" (reports already published, each with a ref) and "items" (new posts and articles, in any language: Persian, Arabic, Hebrew, English, Turkish; a video's speech written out follows "[Said in the video]"). For EACH item answer one object in "items", with the same id. You decide whether each item is published, and you write it. Being wrong is worse than being silent: when in doubt, publish=false.

WHAT TO PUBLISH (publish: true)
- Military actions by any side: strikes, launches, interceptions, sirens and alerts, explosions, attacks on ships, seizures, force moves, losses, damage.
- Statements by the parties and their officials about the war, the talks, Hormuz, the nuclear file, sanctions, threats and warnings. Iran's officials, the IRGC, Hezbollah, the Iraqi militias (Kataib Hezbollah, Nujaba, the Islamic Resistance in Iraq and the others: their statements, claims and threats are kept), the US government, Israel's government and the IDF, the Gulf states, mediators (Oman, Qatar, Pakistan, Egypt, Turkey), the UN, the IAEA, the EU.
- Talks: meetings, messages, proposals, the MoU's terms, what mediators say.
- The Strait of Hormuz: ships attacked, seized or stopped; mines; transits, escorts, insurance; rules of Iran's strait authority (PGSA).
- The nuclear file: the IAEA, enrichment, the sites (Natanz, Fordow, Isfahan, Arak, Bushehr), inspections, NPT moves.
- Inside Iran: fuel, power and water shortages, the rial and prices, imports and exports, protests, strikes, arrests, executions, internet blackouts, rifts at the top.
- Sanctions: new US, EU and UN sanctions, waivers, enforcement, shadow-fleet seizures.
- The US in the region (bases, deployments, arms deals, ties with the Gulf, Iraq and Israel) and inside the US when it is about this war (Congress, war powers, polls, gasoline prices).
- Israel's home front: sirens, alerts, the cabinet's war decisions.
- News reports that rest on officials or sources ("the White House asked the Pentagon for strike options, US officials say"), an investigation's findings, a leak, a first figure: something newly FOUND about an earlier event is current.
- An open-source (OSINT) analyst's OWN finding is a report: satellite imagery it read, footage it geolocated, ships it tracked. Say how it was seen only when the post says so.

WHAT NOT TO PUBLISH (publish: false, with a short reject_reason)
- The Houthis' own war in Yemen (Houthis against the Yemeni government or Saudi Arabia, fronts inside Yemen): reject_reason "yemen desk". A Houthi act in Iran's cause (fire on Israel or US ships, tied to Iran) is published.
- Houthi missiles or drones on Saudi Arabia, Saudi interceptions over Riyadh or other Saudi cities, debris falling there, and flights to Saudi cities stopped over them: reject_reason "yemen desk".
- An incident the text dates days back (a UKMTO report of 6 October relayed on the 8th) is not new: duplicate_of the recent report that told it, else publish=false, reject_reason "old".
- Gaza and the West Bank, unless Iran or Hezbollah act in it. Other wars (Ukraine, Sudan) unless Iran is a party.
- Commentary, reject_reason "commentary": explainers, opinion, columns, analysis, and the views of writers, media figures, researchers, analysts, experts, think tanks and FORMER officials ("Atwan: Trump seeks to shift the costs", "an Iran International analyst says", "former US envoy Hochstein says"), whoever carries them. A poll is not commentary.
- Recaps, reject_reason "recap": a post that sums up events already reported one by one, a channel's round-up or news package ("بسته خبری", "مرور اخبار", "حصاد", "أبرز الأحداث", "ملخص"), a programme title, a documentary, an anniversary, a battle map. Old events retold as new.
- Clerics, reject_reason "cleric": a cleric, Friday-prayer leader, preacher, marja or body of clerics preaching, praising or condemning. The exceptions: a cleric who holds an office in this war (the Supreme Leader, the judiciary chief, a minister, a commander), and a party's official religious leadership calling to fight, declaring jihad or ruling on this war.
- Protocol, reject_reason "protocol": an official visiting, touring, receiving a delegation, attending a ceremony, opening a project, unless the item carries a new fact (a figure, a decision, words with content).
- Domestic news with no tie to the war, the economy or politics: sport, weather, culture, crime, traffic, religious occasions; a headline or a post with no fact; "a spokesman said something" with no content.
- Pictures of damage already done are not a new attack: unless a source reports a NEW strike, the event_type is statement and the headline says it is imagery of earlier damage.
- A terse alert ("explosions heard in Isfahan", "sirens in the north") IS a report: publish it as exactly that, no more.

ISRAELI MEDIA
- Items whose source is an Israeli outlet or reporter (N12, Kan, Channel 13, Channel 14, i24 News, Walla, Ynet, Haaretz, Israel Hayom, the Jerusalem Post, Amit Segal, and the Israeli Telegram channels) are published only for Israel's OWN reporting on this war: its reporters, Israeli officials and Israeli sources.
- An item that only repeats a foreign outlet's report ("according to Reuters", "Al Jazeera reports", "a report in the New York Times", "Iranian media say") is rejected, reject_reason "relay": the original is read directly. An Israeli outlet's exclusive ("פרסום ראשון", "exclusive", "revealed") is kept.
- What Israeli officials or sources told the outlet ends the headline: ", Israeli officials say", ", Israeli sources say".

WHO SPEAKS
- A post that opens with a teller and a colon is that teller's words: "الخارجية الأميركية للحدث: ..." (the US State Department told Al Hadath) is "US State Department: ...", "IRGC: ..." is the IRGC's. The teller is the speaker_lead and opens the headline; never drop it, and never write their words as a plain fact.
- What one party says ABOUT another stays the first party's: "US State Department: Hezbollah is spreading reports it got $200 million from Iran" is never "Hezbollah says it received $200 million".
- A channel that relays someone else (#إعلام_العدو, "وسائل إعلام عبرية", "قناة كان العبرية:", a post signed with another channel's link, such as the Houthi army's t.me/army21ye) is not the speaker or the actor: the one it quotes is. Hezbollah military media relays the Houthi army's statements; those are the Houthis'.
- In Persian, انگلیس and انگلیسی mean Britain and British (UKMTO is "UKMTO" or "the UK's maritime agency"), never "English".

WHO DID WHAT TO WHOM: never infer, never assume
- The actor is who the TEXT says acted. Never assign an attack to a side because the outlet is aligned with it or because it fits.
- Keep the weapon exactly: shelling is not an air strike; a drone is not a missile; an interception is not an impact.
- Distinguish where a weapon came FROM (origins) from where it was AIMED or LANDED (targets). If you cannot tell the roles apart, confident_roles=false and targets=[].

HOW TO WRITE
- English wire style. headline <= 110 characters, sentence case, no full stop; it says the one main fact and keeps what makes the item news. No adjectives of praise or blame.
- A short item (four sentences or fewer) is its headline: the whole report goes in the headline (the place, the target, the weapon, the dead and wounded) and body is "". Never a body that says the headline again in more words, and never a body just to add a little: a place, a detail or a figure belongs in the headline.
- A longer item, as a wire story: the headline carries the most important facts; the body adds the next ones (detail, figures, names, places, a quote), never a rephrasing of the headline. A body earns its place with at least two new facts; otherwise body is "".
- A long item is a full article: read ALL of it. The headline carries its most important new development wherever in the text it appears (a decision, a commitment, a reversal, casualties), not only the opening paragraph.
- NEVER shorten an interesting item to fit. A statement, interview or report that makes several newsworthy points keeps EVERY one of them: the strongest in the headline, all the others in the body, one sentence each, as long as the body needs. Write it as a wire story, not a list: vary the attribution ("warned", "accused", "urged", "he added", or none where the sentence is plainly the speaker's) and join related points. Never open sentence after sentence with "He said".
- Keep the text's own WHY: when the item says why the event matters, that clause goes in. One clause of the text's context, never one you add.
- Do not compress: keep who, what, where, casualties (killed and wounded, with their figures), weapon and unit.
- Every number, name, place and date you write must be in the item's text, as the text gives it: "22 barrels" is never "22 million barrels"; a name you cannot read is left out, never guessed ("لتونی" is Latvia, not Luton). Add nothing: no background, no cause, no casualties, no attribution, no role or title the text does not give.
- Wounded is not killed. Write "kill" only when the text says people died.
- NEVER write about what is missing or unverified: no "no casualties were reported", "details were not given", "could not be independently verified", "it was unclear".
- Never name the outlet that carries the item, its correspondent, or that anyone "told" it something: the card shows the source. Not "Khabari Plus quotes Trump", not "Iran International reported that", not "a source told Tasnim": write Trump's words, the fact, "a source said". What officials or sources told an outlet ends the headline: ", US officials say", ", sources say". An outlet is NEVER the speaker_lead and never opens the headline.
- A place a general reader does not know gets a short locator once, in the body only ("Nikshahr in Sistan and Baluchestan province, south-east Iran"). Never for Tehran, Isfahan, Bandar Abbas, Hormuz, Riyadh, Doha, Beirut, Baghdad, Tel Aviv, Haifa.
- Use the parties' plain names: Iran, the IRGC, Israel, the IDF, the US, Hezbollah, the Iraqi militias, killed. Never the sources' loaded words ("the Zionist entity", "the enemy", "the occupation", "martyrs", "the Zionist regime", "mercenaries", "terrorists" for a party's forces): write Israel, the US, killed. Iran's government may be called the Iranian regime, as the site does; Israel and the US are never "a regime".
- A party's claim of harm to civilians ("homes", "a massacre", "a school") is that party's claim, not a fact: who says it goes first, and the victims and figures are kept ("Iranian media: US strike hit a school in Minab, killing 5").
- Damage at nuclear sites is always in the name of who says it ("the IDF says the Fordow halls were hit"). Where the IAEA or independent analysts are cited in the text, add their view.
- Spell each place and person once, the usual English way, and never explain the spelling: no "also spelled", no second spelling in brackets.
${PERSIAN_SPELLING_RULES}
- Dates: Iran's channels date in the Iranian solar calendar (مهر, آبان, "1405/07/07") and some Arab outlets add the Hijri date. Never copy those as a date and never write a Persian month name (Mehr, Shahrivar, Dey): write the Gregorian day the item's "dates" note gives, or leave the date out.
- An item with fix_previous: your earlier copy of it failed that check. Write it again with the fault corrected; the rules above still hold.

STATEMENTS (event_type statement or diplomacy)
- speaker_lead is REQUIRED: the person or body the report is about, as the headline opens with it.
- A statement leads with its speaker, in either form, whichever fits the report: "Araghchi says Iran will not negotiate under threat", "IRGC: ...", or a short exact quote, 'Rubio: "Iran will never have a nuclear weapon"'. A colon ONLY when the item carries that person's own words (a quote, speech, post, interview, statement). The speaker is named once; a quote is never empty.
- A report ABOUT someone (what they did, decided or discussed, or what officials, sources or an outlet say about them) is a plain sentence with no colon: "Trump weighed strikes on Iran before the midterms, US officials say". A state or institution may lead with a verb: "Qatar condemns the attack on Ras Laffan".
- A person a general reader would not know (an MP, a provincial official, a commander, a deputy minister) is named by job and side only in the headline: "An Iranian MP says ...", "Iran's deputy defence minister: ...". The name goes in the body only when the report needs it ("The MP, Ahmad Naderi, said ..."). Known figures by surname: Trump, Vance, Rubio, Hegseth, Witkoff, Netanyahu, Katz, Khamenei, Pezeshkian, Araghchi, Ghalibaf, Larijani, Grossi, Guterres.
- The IDF's spokespeople speak for the IDF: posts by the IDF, IDF Farsi, IDF Arabic, Lt. Col. Ella Waweya (its Arabic spokesperson) and Avichay Adraee are "IDF: ..." or "IDF says ...", unless the post is about the spokesperson herself or himself.
- A side's report of its own attack or of the other side's losses leads with that side: "IDF says it struck ...", "IRGC says it downed ...". Never add the word "claim" or "alleged": the name does that job.
- An organisation or body a general reader would not know (the PGSA, a monitoring group, a provincial council) is said once, in the body only, with what it is. Never for the ones readers know (the UN, the IAEA, the IRGC, the EU, CENTCOM), and never explained in the headline.
- A diplomat's title says where he or she is posted: "Iran's ambassador to Pakistan", never "Iranian ambassador" alone.
- An official's "we" is his organisation, and one person is never "they". The speaker's first person (we, our, us) only after the colon, never "X said that our ...".
- Say what was said, specifically. If the speaker denies an accusation, state the accusation and the denial.
- An UNNAMED official, commander or source is still the speaker: the claim is never written as a fact. "Iranian military source: ...", "US official: ...", "Israeli security source: ...".

WORDS SAID IN A VIDEO
Text after "[Said in the video]" is a machine transcript of the post's video. It is what was spoken and may carry the news the caption lacks: read it under every rule above. The speaker is who the caption or the words themselves name; never guess one from the outlet. A transcript garbles names and numbers: keep only those that are clear, and prefer the caption's spelling. Songs, chants, poems, prayers, sermons and a presenter reading other news are not reports: publish=false. Write the NEWS in the video, never the video: the main things said, each in one sentence. New footage of an attack told before is "new footage of ...", never "ongoing" unless the text says so.

SPEECH LINES
Channels post a live speech one sentence at a time ("Khamenei: ...", "Naim Qassem: ..."). Each line is read on its own. Publish a line ONLY if it carries at least one of: a threat or warning to a named party; an announcement (an operation, escalation, halt, deadline or condition); a new position on talks or a deal; a claim of a specific attack or its result; a figure. Praise, prayer, thanks, history, anniversaries, general accusations and slogans are rejected with reject_reason "speech-rhetoric". A published line always opens with its speaker.

EVENT TYPES AT SEA
maritime_attack is any event that happens TO a named vessel at sea or in port: hit, seized, boarded, detained, fired on, damaged. A vessel merely named in a statement stays statement or diplomacy. A port, an island or a coast is land. Ship traffic figures and shipping trends are economy.

FIELDS
- event_type: air_strike, missile_launch, drone_attack, interception, air_raid_alert, shelling, ground_clash, advance_or_capture, maritime_attack, statement, diplomacy, economy.
- actor_side: who acted or spoke: iran, hezbollah, iraqi_militias (Iraqi and Syrian militias), us, israel, gulf (any Gulf state), houthi, other, unclear.
- arenas: one or two arena ids, by SUBJECT, not by speaker (the US Treasury Secretary on Iran's oil is "sanctions"; a Qatari minister on the talks is "talks"; a threat or a vow to strike or to fight back is "military"; a blockade of Iran's ports or shipping is "hormuz"). "inside_iran" is only for life and politics inside Iran (shortages, prices, protests, arrests, executions, internet, rifts at the top), never for what Iran's officials say about the war: military, talks, hormuz, nuclear, inside_iran, sanctions, axis (Hezbollah, the Iraqi and Syrian militias, the Houthis' Iran side), us_region, inside_us, israel_home.
- targets: English names of places struck or where the event happened, as the text names them. origins: places a weapon or aircraft came from. Statements: both [].
- interest: "for" if the report favours the side of the outlet carrying it, "against" if it harms it (an outlet admitting its own side's losses), else "neutral".
- has_time: the text gives the time of the event.
- confident_roles: false when who did what to whom cannot be told apart.
- follows_up: the ref of a recent report ONLY when this item is a direct development of that exact same incident or statement: the toll of that strike rising, the aftermath at that same place, a reply to that specific statement. Same area or same kind of event is NOT enough. When in doubt, "".
- duplicate_of: the ref of a recent report that tells the SAME event or statement with no new fact: another outlet on the same strike, the same quote, the same official's same words relayed. Still write the item in full. An item that adds a new fact (a toll, a name, a quote, a decision) is not a duplicate: use follows_up. Two strikes, two lines of a speech or two statements are never duplicates. When in doubt, "".
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

/**
 * Israeli media (stage 4c) post about everything in Israel: only the Iran war,
 * narrowly or widely (Iran, its allies' fronts, Hormuz, the nuclear file, the
 * talks), passes. Hebrew has no word edges and joins its prefixes (ב, ה, ו, ל,
 * מ, ש) to the word, so its words match inside longer ones.
 */
const IRAN_WAR_HE = /איראנ|אירנ|טהרן|משמרות המהפכה|חמינאי|פזשכיאן|עראקצ'י|לאריג'אני|קאליבאף|הורמוז|המפרץ הפרסי|בנדר עבאס|נתנז|פורדו|איספהאן|אספהאן|בושהר|אורניום|סבא"א|גרוסי|חיזבאללה|נסראללה|נעים קאסם|המיליציות (?:בעיראק|השיעיות|העיראקיות)|ויטקוף|גרעיני|תוכנית הגרעין|מתקני הגרעין|הסכם הגרעין/;

/** An outlet another newsroom relays: the original is read directly. */
const FOREIGN_OUTLETS = "רויטרס|רוייטרס|AP|אי[- ]?פי|CNN|סי[- ]?אן[- ]?אן|אל[- ]?ג'זירה|אל[- ]?ג׳זירה|אל[- ]?ערבייה|אל[- ]?מיאדין|אל[- ]?אח'באר|א-?שרק אל-?אווסט|ניו[- ]יורק טיימס|וול[- ]סטריט ג'ורנל|וושינגטון פוסט|אקסיוס|פוקס|בלומברג|BBC|בי[- ]בי[- ]סי|פייננשל טיימס|טלגרף|סקיי ניוז|תסנים|פארס|אירנ\"?א|פרס[- ]?TV|פרס טי[- ]?וי|איראן אינטרנשיונל|Reuters|Axios|Al Jazeera|Al Arabiya|Al Mayadeen|New York Times|NYT|Wall Street Journal|WSJ|Washington Post|Bloomberg|Fox News|Financial Times|Telegraph|Sky News|Tasnim|Fars|IRNA|Press TV|Iran International";

/** An outlet's name standing alone: "AP" is not the end of "map". */
const OUTLET = `(?<![A-Za-z])(?:${FOREIGN_OUTLETS})(?![A-Za-z])`;

/** The lead (headline and first words) says the report is another outlet's. */
const FOREIGN_RELAY = new RegExp(
  `(?:לפי|על פי|ע"פ|כך (?:דיווח|דווח|מדווח|נמסר|פורסם)|דיווח(?:ים)? ב|מדווח(?:ים)? ב|פרסום ב|פורסם ב|דיווח של|according to|reported by|told)[\\s\\-־]*(?:ה|ב|ברשת|בעיתון|באתר|בערוץ|סוכנות(?: הידיעות)?)?[\\s\\-־]*${OUTLET}|^${OUTLET}\\s*(?::|reports|says|reported)|${OUTLET}\\s*(?:reports|reported|מדווח|דיווח|דיווחה|מדווחת)`,
  "i",
);

/** The outlet's own scoop: kept even when the story is also elsewhere. */
const EXCLUSIVE = /פרסום ראשון|בלעדי|חשיפת|נחשף ב|exclusive|first reported by (?:N12|Kan|Channel 1[234]|i24|Ynet|Walla|Haaretz|Israel Hayom|the Jerusalem Post)/i;

/**
 * An Israeli outlet's item: about the Iran war, and Israel's own reporting.
 * A lead that only relays a foreign outlet is dropped unless it is marked
 * as the outlet's exclusive.
 */
export function passesIsraeliMediaGate(text: string): boolean {
  const t = String(text || "");
  if (!isIranWar(t) && !IRAN_WAR_HE.test(t)) return false;
  if (EXCLUSIVE.test(t)) return true;
  return !FOREIGN_RELAY.test(t.slice(0, 220));
}

/**
 * The sources' loaded words for Israel and Iran, reworded on the Iran desk's
 * copy (audit of 8 Oct: "Islamic Iran's capability", "the Israel regime" went
 * out). "The Iranian regime" is the site's own wording and stays (user, 8 Oct).
 */
const IRAN_REWORD: [RegExp, string][] = [
  [/\b(?:the )?(?:Israel|Israeli|Zionist) regime\b/gi, "Israel"],
  [/\bIslamic Iran\b/g, "Iran"],
];

export function iranReword(s: string): string {
  let out = String(s || "");
  for (const [re, to] of IRAN_REWORD) out = out.replace(re, to);
  return out.replace(/^the /, "The ").replace(/\bthe the\b/gi, "the");
}

/** An outlet, a magazine or "a report" opening the headline as its teller. */
const OUTLET_OPENS = new RegExp(
  `^(?:${[
    "Reuters", "AP", "AFP", "Axios", "CNN", "CBS", "NBC", "ABC", "BBC(?: Persian)?", "Fox News", "Bloomberg", "Politico",
    "(?:The )?New York Times", "NYT", "(?:The )?Wall Street Journal", "WSJ", "(?:The )?Washington Post", "Financial Times", "FT",
    "(?:The )?Guardian", "(?:The )?Telegraph", "Sky News(?: Arabia)?", "Al[- ]Jazeera", "Al[- ]Arabiya", "Al[- ]Hadath", "Al[- ]Mayadeen",
    "Al[- ]Akhbar", "Asharq Al-Awsat", "Iran International", "Tasnim", "Fars(?: News)?", "IRNA", "ISNA", "Mehr(?: News)?", "Press TV",
    "Nour News", "Akhbar-e Fori", "Khabar Fori", "Khabari Plus", "Radio Farda", "VOA(?: Farsi)?", "Manoto", "WiWo", "WirtschaftsWoche",
    "(?:A |The )?German (?:magazine|newspaper)", "(?:A |The )?(?:US|British|Israeli) (?:newspaper|outlet|channel)",
    "N12", "Kan", "Channel 1[234]", "Ynet", "Walla", "Haaretz", "Israel Hayom", "(?:The )?Jerusalem Post", "i24(?: News)?",
  ].join("|")})(?:'s)?(?:\\s+(?:analyst|correspondent|reporter|poll|investigation|report|survey|sources?))?\\s*(?::|\\bsays\\b|\\bsaid\\b|\\breports?\\b|\\breported\\b|\\bcites\\b|\\bcited\\b|\\bposts\\b|\\bfinds\\b|\\bquotes\\b)`,
  "i",
);

/** Commentary by role: analysts, experts and former officials (the prompt's rule, kept in code). */
const COMMENTARY =
  /\b(?:analysts?|commentators?|columnists?|pundits?|(?<!UN |panel of |IAEA )experts?|think[- ]tank|former (?:\w+ ){0,2}?(?:envoy|official|ambassador|minister|diplomat|negotiator|advis[eo]r|general|commander|president|prime minister|spy chief|intelligence chief)|Atwan|Hochstein)\b/i;

/** The Houthis' war with Saudi Arabia: the Yemen desk's, not this one. */
const YEMEN_THEATRE_WORDS =
  /\b(?:Houthis?|Saudi-led coalition|King Khalid|Khamis Mushait|Jizan|Jazan|Najran|Abha|Saudi civil defen[cs]e|Ansar Allah)\b/i;
/** Missiles over Saudi cities with no attacker named ("Saudi Arabia intercepted two ballistic missiles over Riyadh"). */
const SAUDI_INTERCEPT = /\b(?:Saudi|Riyadh|Jeddah)\b.{0,60}\bintercept\w*|\bintercept\w*.{0,60}\b(?:Saudi|Riyadh|Jeddah)\b/i;
const YEMEN_THEATRE = { test: (s: string) => YEMEN_THEATRE_WORDS.test(s) || SAUDI_INTERCEPT.test(s) };
const IRAN_IN_YEMEN_STORY = /\b(?:Israel\w*|Eilat|US (?:warship|ship|Navy|base|forces)|American (?:warship|ship)|Red Sea shipping)\b/i;

/** "22 million" where the text says 22: a multiplier the text never gave. */
const MULTIPLIER = /\b\d[\d.,]*\s*(?:million|billion|bn|trillion)\b|\$\d[\d.,]*\s*(?:m|bn)\b/i;
const MULTIPLIER_SRC = /million|billion|trillion|\bbn\b|\d\s*m\b|مليون|ملايين|مليار|ملیون|میلیون|میلیارد|مليارات|מיליון|מיליארד/i;

/** A post that opens with its teller: "الخارجية الأميركية للحدث: …", "IRGC: …". */
const OPENS_WITH_SPEAKER = /^[\s‏‎"«]*(?:(?:🔴|⭕️|♦️|🔻|🔺|▪️|عاجل|فوری|#\S+|\|)\s*)*([^:\n|]{2,60}?)\s*:/u;
const SAY_VERB =
  /\b(?:says?|said|warns?|vows?|urges?|calls?|announces?|denies|rejects?|accuses?|condemns?|threatens?|confirms?|claims?|insists?|stresses|tells?|adds|welcomes?|demands?|pledges?|asks?|orders?|signals?|agrees?|insists|argues?|praises?|blames?|declares?|reports?)\b|:/i;

/**
 * The Iran desk's copy rules that the free models kept breaking (audit of
 * 8 Oct): an outlet as the teller, commentary, the Yemen desk's war, a
 * multiplier added to a figure, and a statement stripped of the speaker its
 * text opens with ("Hezbollah has brought only misery to Lebanon" was the US
 * State Department's words to Al Hadath).
 */
export function iranCopyProblem(r: { headline: string; body?: string; speaker_lead?: string | null; event_type?: string }, sourceText: string): string | null {
  const h = String(r.headline || "").trim();
  const copy = `${h} ${r.body ?? ""}`;
  if (COMMENTARY.test(`${h} ${r.speaker_lead ?? ""}`)) return "commentary: analysts, experts and former officials are not reports";
  if (OUTLET_OPENS.test(h)) return "leads with outlet: an outlet is never the teller; lead with the fact, or with the official or source who said it";
  if (YEMEN_THEATRE.test(copy) && !isIranWar(copy) && !IRAN_IN_YEMEN_STORY.test(copy)) return "yemen desk: the Houthis' war with Saudi Arabia is the Yemen desk's";
  const src = String(sourceText || "");
  if (MULTIPLIER.test(h) && !MULTIPLIER_SRC.test(src)) return "figure not in source: the text gives no million or billion";
  if (r.event_type === "statement" && !r.speaker_lead && !SAY_VERB.test(h)) {
    const who = OPENS_WITH_SPEAKER.exec(src)?.[1]?.trim();
    if (who) return `does not lead with its speaker: the text opens with its teller ("${who}"); the headline says who said it`;
  }
  return null;
}
