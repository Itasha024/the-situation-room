/**
 * Whose account a Gaza – Judea & Samaria card is told from (user, 23 Oct): Israel's officials, army and media
 * from the Israeli sources, never Al Jazeera's "…, Channel 12 reports" or NBC's "Netanyahu orders…"; Hamas,
 * the factions and the PA from the Palestinian channels, never IRNA's or Al-Alam's retelling, and not
 * Al Mayadeen's when Islamic Jihad's own channel has it. The desk reads all of them first-hand.
 */
import { gazaLeanOf } from "./gaza-sources.ts";
import { iranLeanOf } from "./iran-sources.ts";
import { leadOf } from "./copy-rules.ts";
import { sourceNation } from "./speaker-press.ts";

const ISRAELI_NAME = /^(?:Kan\b|Israel 1\b|Hazfon\b|US2020US$|Channel 1[1-4]\b|Maariv\b|Yedioth|Ynet|Army Radio|Galei Tzahal|Times of Israel)/i;
const IRANIAN = /^(?:IRNA|Tasnim|Fars|ISNA|Mehr|IRIB|Press TV|Nour News|Tehran Times|Al-Alam|ILNA|IMNA|SNN)\b/i;

export function israeliSource(source: string): boolean {
  const s = String(source || "").trim();
  return gazaLeanOf(s) === "israel" || iranLeanOf(s) === "israel" || sourceNation(s) === "israel" || ISRAELI_NAME.test(s);
}
export function palestinianSource(source: string): boolean {
  const l = gazaLeanOf(String(source || "").trim());
  return l === "pa" || l === "factions" || l === "palestinian";
}
export function iranianSource(source: string): boolean {
  return IRANIAN.test(String(source || "").trim());
}

/** Israel's leaders and bodies: whatever they do or say is told from Israel's own sources. */
const ISRAELI_LEADER = new RegExp(
  [
    String.raw`^(?:Israel(?:'s|i)?\s+)?(?:(?:Prime|Defen[cs]e|Finance|Foreign|National Security|Justice|Interior|Health)\s+Minister\s+)?(?:Benjamin\s+|Bezalel\s+|Itamar\s+|Israel\s+|Gideon\s+|Isaac\s+|Ron\s+|Eyal\s+|David\s+)?(?:Netanyahu|Smotrich|Ben[- ]?Gvir|Katz|Sa'?ar|Herzog|Dermer|Zamir|Zini|Barnea|Levin)\b`,
    String.raw`^(?:the\s+)?(?:Israeli|Israel's)\s+(?:prime minister|PM|government|cabinet|security cabinet|ministers?|\w+ minister|Knesset|Supreme Court|High Court|attorney general|Prison Service|Shin Bet|Civil Administration)\b`,
    String.raw`^(?:the\s+)?(?:Shin Bet|COGAT|Knesset|Israel Prison Service|Civil Administration)\b`,
    String.raw`^(?:Preliminary|Initial|Israeli|IDF|Army|Military) (?:investigation|probe|inquiry)\b`,
  ].join("|"),
  "i",
);
/** The army and police speaking (their field acts are told by anyone on the spot). */
const ISRAELI_FORCE_SAYS = /\b(?:IDF|Israeli (?:military|army|police|forces)|Israel(?:'s)? (?:military|army|police)|Israel Police|army spokes(?:man|person))\s+(?:says|said|states|announces|announced|confirms|confirmed|claims|claimed|reports|statement|investigation|probe)\b|^(?:IDF|Israeli (?:military|army|police)|Israel Police)\s*:/i;
/** Hamas, the factions, the PA and Gaza's bodies speaking. */
const PALESTINIAN_VOICE =
  /^(?:the\s+)?(?:Hamas|Islamic Jihad|Palestinian Islamic Jihad|PIJ|Saraya al-Quds|al-Quds Brigades|Qassam|al-Qassam|Ezzedine|Izz ad-Din|Abu Obeida|Abu Hamza|PFLP|DFLP|Popular Front|Democratic Front|Fatah|Palestinian factions|factions|Popular Resistance Committees|al-Aqsa Martyrs|Mujahideen Brigades|Lions' Den|Jenin Brigade|Tulkarm Brigade|Basem Naim|Hazem Qassem|Abd(?:ul|el|al)?[- ]?Rahman Shadid|Khalil al-Hayya|Mousa Abu Marzouk|Musa Abu Marzouk|Osama Hamdan|Taher al-Nunu|Mahmoud Mardawi|Ziad al-Nakhalah|Mohammad al-Hindi|Mahmoud Abbas|Abbas(?! Araghchi)|Hussein al-Sheikh|Mohammad Mustafa|Nabil Abu Rudeineh|PA\b|Palestinian (?:Authority|presidency|president|prime minister|PM|government|Foreign Ministry|Health Ministry|Ministry|Red Crescent)|Palestine Red Crescent|Gaza(?:'s)? (?:government media office|Government Media Office|health ministry|Health Ministry|civil defen[cs]e|Civil Defen[cs]e|interior ministry|Interior Ministry)|Government Media Office)\b/i;

export type GazaSourcing = { headline: string; type: string; source: string; own?: boolean };

/** Why this source does not tell this card, or null. */
export function gazaSourceRule(x: GazaSourcing): string | null {
  if (x.own) return null;
  const s = String(x.source || "").trim();
  const h = String(x.headline || "").trim();
  const spoken = x.type === "statement" || x.type === "diplomacy" || !!leadOf(h);
  if (!israeliSource(s) && (ISRAELI_LEADER.test(h) || ISRAELI_FORCE_SAYS.test(h))) return `Israel is told from the Israeli sources the desk reads, not ${s}`;
  const lead = leadOf(h) || h;
  if (spoken && !palestinianSource(s) && PALESTINIAN_VOICE.test(lead)) return `the Palestinians' words are taken from their own channels, not ${s}`;
  return null;
}

/** Gaza and Judea and Samaria named: their places, camps and Jerusalem. */
const ARENA_PLACE =
  /\b(?:Gaza|Khan Y(?:ou|u|o)nis|Rafah|Jabalia|Deir al-Balah|Nuseirat|Bureij|Maghazi|Beit Lahia|Beit Hanoun|Mawasi|Zeitoun|Shujaiya|Netzarim|Philadelphi|Judea|Samaria|West Bank|Jenin|Nablus|Tulkarm|Nur Shams|Balata|Jalazone|Askar|Hebron|Ramallah|al-Bireh|Qalqilya|Tubas|Tammun|Jericho|Bethlehem|Salfit|Jordan Valley|Jerusalem|al-Aqsa|Kerem Shalom|Zikim|Allenby|Ofer)\b|غزة|الضفة|القدس|جنين|نابلس|الخليل|طولكرم/i;
const PALESTINIANS = /\bPalestinians?\b|فلسطيني/i;
const ABROAD = /\b(?:Lebanon|Lebanese|Syria|Jordan(?! Valley)|Egypt|Ain al-Hilweh|Rashidieh|Beddawi|Yarmouk)\b/i;

/** A card on Gaza or Judea and Samaria: a place of theirs named, or Palestinians with no other country. */
export function palestineArena(headline: string): boolean {
  const h = String(headline || "");
  return ARENA_PLACE.test(h) || (PALESTINIANS.test(h) && !ABROAD.test(h));
}

/**
 * What happens in Gaza and Judea and Samaria is told from the Israeli and Palestinian sources only, on every
 * desk, unless the outlet has it as its own exclusive (user, 24 Oct: Al-Modon's "major army operation in the
 * West Bank" led an Iran-desk card). Their own sources carry every raid, strike and clash first-hand.
 */
export function arenaSourceRule(x: GazaSourcing): string | null {
  if (x.own || (x.type !== "strike" && x.type !== "combat")) return null;
  const s = String(x.source || "").trim();
  if (!palestineArena(x.headline) || israeliSource(s) || palestinianSource(s)) return null;
  return `Gaza and Judea and Samaria are told from the Israeli and Palestinian sources, not ${s}`;
}

/**
 * Which account of a story leads its card on this desk: Israel's own sources for Israel's words, the
 * Palestinians' own channels for theirs, Iranian outlets last (user, 23 Oct: "definitely not Hamas from Iran's media").
 */
export function gazaLeadBonus(r: { source: string; type?: string | null; summary: string; flags?: string[] }): number {
  const s = r.source;
  const actor = (r.flags ?? []).find((f) => f.startsWith("actor:"))?.slice(6) ?? "";
  let n = 0;
  if (iranianSource(s)) n -= 2000;
  else if (/^(?:Al Mayadeen|Al-Manar|Al-Akhbar|Hezbollah)/i.test(s)) n -= 600;
  if (israeliSource(s) && (actor === "israel" || actor === "israeli_citizens" || ISRAELI_LEADER.test(r.summary))) n += 700;
  if (palestinianSource(s) && actor !== "israel" && actor !== "israeli_citizens") n += 700;
  return n;
}
