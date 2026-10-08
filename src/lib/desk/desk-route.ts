/**
 * Which desks a card belongs on (Round 30). One scanner reads every source
 * once; each card it keeps is labelled with the desks it is shown on.
 *
 * Until the Iran reader exists (Round 30 stage 3) every card the scanner keeps
 * was judged by the Yemen reader, so every card is Yemen's. A card in which
 * Iran itself acts or is acted on (Tehran speaks, Iran is struck, a ship is
 * seized in Hormuz) is Iran's too. "Iran-backed Houthis" does not make a card
 * Iran's: nearly every Houthi card says it.
 */
import type { DeskId } from "../desks.ts";
import type { LiveReport } from "./types.ts";

export const DESK_IDS: DeskId[] = ["yemen", "iran"];
export const DEFAULT_DESK: DeskId = "yemen";

/** The desk a request asks for (`?desk=`); anything else is Yemen, as before. */
export function deskParam(v: string | null | undefined): DeskId {
  return (DESK_IDS as string[]).includes(String(v)) ? (v as DeskId) : DEFAULT_DESK;
}

/** A card stored before the split, or never labelled, is Yemen's. */
export function desksOfRow(row: object): DeskId[] {
  const r = row as { desks?: unknown };
  const d = Array.isArray(r.desks) ? r.desks.filter((x): x is DeskId => (DESK_IDS as unknown[]).includes(x)) : [];
  return d.length ? d : [DEFAULT_DESK];
}

export const onDesk = (r: object, desk: DeskId): boolean => desksOfRow(r).includes(desk);

/**
 * A state key for one desk. Yemen keeps the keys it has always had, so
 * nothing it stored moves; another desk's keys carry its id first.
 */
export function deskKey(desk: DeskId, key: string): string {
  return desk === DEFAULT_DESK ? key : `${desk}:${key}`;
}

// "Iran-backed", "Iranian-made", "المدعومة من إيران": a label on someone else, not Iran acting.
export const IRAN_LABEL =
  /\bIran(?:ian)?[- ](?:backed|aligned|allied|supported|sponsored|made|built|supplied|designed|funded|armed|linked)\b|(?:ال)?(?:مدعوم|موال|متحالف)\S*\s+(?:من\s+|مع\s+)?ل?[إا]يران|(?:ال)?مدعوم[ةه]?\s+(?:ایران|از\s+ایران)/gi;
const IRAN_ACTS =
  /\b(?:Iran|Iranian|Iranians|Tehran|IRGC|Revolutionary Guards?|Khamenei|Pezeshkian|Araghchi|Hormuz|Bandar Abbas|Kharg|Natanz|Fordow|Isfahan)\b|[إا]يران|الإيراني|طهران|الحرس الثوري|خامنئي|بزشكيان|عراقجي|هرمز|ایران|تهران|سپاه|خامنه‌ای|پزشکیان|عراقچی/i;

/** Seas that belong to the Iran desk: the Gulf, Hormuz, the Gulf of Oman and the Gulf states' coasts. */
export const OFF_YEMEN_SEA =
  /\b(?:Persian Gulf|Arabian Gulf|the Gulf\b(?! of Aden)|Hormuz|Gulf of Oman|Qatar|Bahrain|Kuwait|Fujairah|Khor Fakkan|Ras Tanura|Ras Laffan|Jebel Ali|Dubai|Abu Dhabi|Sharjah|Muscat|Sohar|Iran|Iranian|Bandar Abbas|Kharg|Basra)\b|الخليج العربي|الخليج الفارسي|هرمز|خليج عمان|قطر|البحرين|الكويت|الفجيرة|إيران/i;
// A ship card that names none of these is not Yemen's, whatever kept it.
const YEMEN_SEA = /\b(?:Yemen\w*|Houthis?|Ansar ?Allah|Red Sea|Bab (?:al|el)[- ]Mand[ae]b|Gulf of Aden|Arabian Sea|Hodeidah|Mocha|Aden|Salif|Ras Isa|Socotra|Mukalla)\b|اليمن|الحوثي|أنصار الله|البحر الأحمر|باب المندب|خليج عدن|الحديدة/i;

export function isIranCard(r: Pick<LiveReport, "summary" | "text">): boolean {
  const text = `${r.summary}\n${r.text ?? ""}`.replace(IRAN_LABEL, " ");
  return IRAN_ACTS.test(text);
}

/** The desks a newly kept card is shown on. A card that already has its desks keeps them. */
export function desksOf(r: LiveReport): DeskId[] {
  if (r.desks?.length) return r.desks;
  // A ship hit in the Gulf, Hormuz or the Gulf of Oman with no word of Yemen
  // is the Iran war's alone (8 Oct: the tanker Acers off Qatar on the Yemen desk).
  const all = `${r.summary}\n${r.text ?? ""}\n${r.place ?? ""}`;
  if (r.type === "vessel" && OFF_YEMEN_SEA.test(all) && !YEMEN_SEA.test(all)) return ["iran"];
  return isIranCard(r) ? ["yemen", "iran"] : ["yemen"];
}
