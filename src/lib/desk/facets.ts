/**
 * Tags for the main desk (option C): which countries or seas a report is
 * about, which desks (wars) it belongs to, and what kind of report it is.
 * Worked out as a card is served, so every stored card gets them with no
 * migration, and a better rule here re-tags the whole archive at once.
 *
 *   - Where it happened: the pin's own point, inside a country outline
 *     (region-shapes.ts) or one of the seas the desks follow.
 *   - Who and what it is about: names in the headline (an Iranian diplomat
 *     on Saudi–Yemen mediation is Iran, Saudi Arabia and Yemen).
 *   - The desks: the desks the card was written for; a card about a desk's
 *     places that only one desk wrote is still that desk's.
 */
import { categoryOf, type Category, type FocusId, type WarDeskId } from "../region.ts";
import { SHAPES } from "./region-shapes.ts";

export type Facets = {
  /** Where it happened, when the card has a point: a country or a sea. */
  where: FocusId | null;
  /** Every country or sea it is about, the place first. */
  countries: FocusId[];
  desks: WarDeskId[];
  category: Category;
};

function inRing(x: number, y: number, ring: number[][]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const FOCUS_IDS = new Set<string>(["yemen", "saudi", "iran", "israel", "gaza", "judea-samaria", "lebanon", "iraq", "syria", "gulf"]);

/** The country or sea a point is in; null when it is somewhere the desks do not follow. */
export function placeOf(lat: number, lng: number): FocusId | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const s of SHAPES) {
    for (const p of s.polys) {
      if (inRing(lng, lat, p[0]) && !p.slice(1).some((h) => inRing(lng, lat, h))) return FOCUS_IDS.has(s.id) ? (s.id as FocusId) : null;
    }
  }
  // At sea: the strait and the Gulf of Oman, then the Red Sea, Bab al-Mandab and the Gulf of Aden.
  if (lat > 23.5 && lat < 27.8 && lng > 54 && lng < 59.8) return "hormuz";
  if (lat > 20 && lat < 26 && lng > 56 && lng < 62) return "hormuz";
  if (lng > 32 && lng < 44.5 && lat > 11 && lat < 30) return "redsea";
  if (lng >= 43 && lng < 52 && lat > 10.5 && lat < 15.5) return "redsea";
  // The Gulf itself is the Gulf states' water.
  if (lat > 24 && lat < 30.5 && lng > 47.5 && lng < 56.5) return "gulf";
  return null;
}

/** Names in a headline, by place. Word edges keep "Oman" out of "Omani" only where it matters. */
const NAMES: [FocusId, RegExp][] = [
  ["yemen", /\bYemen|\bHouthi|\bSanaa\b|\bAden\b|\bMarib\b|\bTaiz\b|\bHodeidah\b|\bSaada\b|\bHadramout|\bHadramawt|\bAbyan\b|\bShabwa|\bal-Dhale|\bLahj\b|\bal-Alimi\b|\bZindani\b|\bAnsar Allah\b/i],
  ["saudi", /\bSaudi|\bRiyadh\b|\bJeddah\b|\bJizan\b|\bJazan\b|\bNajran\b|\bAsir\b|\bKhamis Mushait\b|\bBin Salman\b|\bMBS\b|\bAramco\b|\bYanbu\b|\bDhahran\b|\bMadinah\b|\bMecca\b|\bMakkah\b/i],
  ["iran", /\bIran|\bTehran\b|\bIRGC\b|\bAraghchi\b|\bPezeshkian\b|\bKhamenei\b|\bGhalibaf\b|\bBaghaei\b|\bBandar Abbas\b|\bIsfahan\b|\bShiraz\b|\bTabriz\b|\bMashhad\b|\bKish\b/i],
  ["gaza", /\bGaza\b|\bKhan Younis\b|\bRafah\b|\bJabalia\b|\bDeir al-Balah\b|\bHamas\b/i],
  ["judea-samaria", /\bJudea\b|\bSamaria\b|\bWest Bank\b|\bJenin\b|\bNablus\b|\bRamallah\b|\bHebron\b|\bTulkarm\b|\bQalqilya\b/i],
  ["israel", /\bIsrael|\bIDF\b|\bNetanyahu\b|\bTel Aviv\b|\bJerusalem\b|\bHaifa\b|\bEilat\b|\bDanon\b|\bKnesset\b/i],
  ["lebanon", /\bLeban|\bHezbollah\b|\bBeirut\b|\bAoun\b|\bQassem\b|\bLitani\b|\bNabatieh\b|\bTyre\b|\bSidon\b|\bBekaa\b/i],
  ["iraq", /\bIraq|\bBaghdad\b|\bErbil\b|\bBasra\b|\bKataib\b|\bPMF\b|\bSudani\b/i],
  ["syria", /\bSyria|\bDamascus\b|\bal-Sharaa\b|\bAleppo\b/i],
  ["gulf", /\bUAE\b|\bEmirat|\bAbu Dhabi\b|\bDubai\b|\bQatar|\bDoha\b|\bBahrain|\bKuwait|\bOman\b|\bOmani\b|\bMuscat\b|\bFujairah\b/i],
  ["hormuz", /\bHormuz\b|\bGulf of Oman\b|\bMusandam\b/i],
  ["redsea", /\bRed Sea\b|\bBab al-Mandab\b|\bBab el-Mandeb\b|\bGulf of Aden\b|\bUKMTO\b|\bSuez\b/i],
  ["us", /\bUS\b|\bU\.S\.|\bUnited States\b|\bAmerican\b|\bTrump\b|\bWashington\b|\bPentagon\b|\bCENTCOM\b|\bHegseth\b|\bRubio\b|\bVance\b|\bWhite House\b|\bUS Treasury\b/],
];

/** The desks a place belongs to, when no desk wrote the card itself. */
const HOME: Partial<Record<FocusId, WarDeskId>> = {
  yemen: "yemen",
  redsea: "yemen",
  iran: "iran",
  hormuz: "iran",
  lebanon: "iran",
  iraq: "iran",
  syria: "iran",
  gaza: "gaza",
  "judea-samaria": "gaza",
};

type Row = { summary?: unknown; text?: unknown; place?: unknown; lat?: unknown; lng?: unknown; type?: unknown; desks?: unknown };

export function facetsOf(r: Row, servedBy?: WarDeskId): Facets {
  const lat = typeof r.lat === "number" ? r.lat : NaN;
  const lng = typeof r.lng === "number" ? r.lng : NaN;
  const where = placeOf(lat, lng);
  const head = `${String(r.summary ?? "")} ${String(r.place ?? "")}`;
  const found = new Set<FocusId>();
  if (where) found.add(where);
  for (const [id, re] of NAMES) if (re.test(head)) found.add(id);
  // A card from Judea and Samaria or Gaza names Israel too only when it says so.
  const stored = Array.isArray(r.desks) ? (r.desks as string[]).filter((d): d is WarDeskId => d === "yemen" || d === "iran" || d === "gaza") : [];
  const desks = new Set<WarDeskId>(stored.length ? stored : servedBy ? [servedBy] : []);
  // Nothing named and no point: the desk's own home.
  if (!found.size) found.add(desks.has("iran") && !desks.has("yemen") ? "iran" : "yemen");
  // Gaza and Judea and Samaria have no live desk yet: their cards stay with the desks that wrote them.
  if (where && HOME[where] && HOME[where] !== "gaza") desks.add(HOME[where]!);
  const countries = where ? [where, ...[...found].filter((c) => c !== where)] : [...found];
  return { where, countries, desks: [...desks], category: categoryOf(r.type) };
}

/**
 * The same story from both desks: the Iran desk keeps its own copy of a card
 * the Yemen desk also wrote ("ir-" before the same source's key). One card
 * stays, with both desks.
 */
export function storyKey(fp: unknown): string {
  return String(fp ?? "").replace(/^ir-/, "");
}
