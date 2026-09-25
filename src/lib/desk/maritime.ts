/**
 * A ship pin is an attack on a ship. The reader types some land events
 * maritime_attack — an airport, an air base's hangars, an alert in Najran, a
 * port hit, ship-traffic figures — and each became a ship icon on dry land in
 * Saudi Arabia. The reader's type stands only when the copy names a ship and
 * something done to it; otherwise the card is typed by what it does say.
 */
import type { DeskType } from "./digest.ts";
import type { Place } from "./gazetteer.ts";

const SHIP_RE =
  /\bships?\b|\bvessels?\b|\btankers?\b|bulk carrier|container ?ships?|cargo ship|merchant|\bdhows?\b|\bcrew\b|\bMV\b|UKMTO|سفين|سفن|ناقلة|باخرة|زورق/i;
const DONE_TO_RE =
  /attack|projectile|struck|\bhit\b|\bhits\b|target|seiz|board|hijack|explo|fire[sd]? (?:on|at)|missile|drone|damag|\bsank\b|sink|intercept|harass|approached by|capsiz|abduct|detain/i;
const PORT_RE = /\bport\b|harbou?r|oil terminal|\bterminal\b|refinery|ميناء|مرفأ|مصفاة/i;
const STRIKE_RE =
  /airport|air ?base|\balerts?\b|sirens?|intercept|missile|drone|air ?strikes?|strikes?\b|attack|shell|explosion|hangar|غارة|صاروخ|مسيرة|صفارات/i;
const TRADE_RE =
  /cross(?:ed|es|ing)?\b|traffic|shipping|cargo|containerships|carriers|freight|insurance|Kpler|transit|offload|unload|reroute|diver(?:t|sion)/i;

/** The card's type once a maritime_attack reading is checked against its copy. */
export function maritimeType(type: DeskType, text: string): DeskType {
  if (type !== "vessel") return type;
  const t = String(text || "");
  if (SHIP_RE.test(t) && DONE_TO_RE.test(t)) return "vessel";
  if (PORT_RE.test(t) && DONE_TO_RE.test(t)) return "port";
  if (STRIKE_RE.test(t)) return "strike";
  if (TRADE_RE.test(t) || SHIP_RE.test(t)) return "economy";
  return "statement";
}

/**
 * Where a ship pin may stand: at sea, in a strait, off an island or at a
 * port. A ship is never pinned on an inland town, and with nothing but inland
 * places named it is not pinned at all.
 */
export function seaPlace(places: Place[]): Place | undefined {
  return (
    places.find((p) => p.kind === "port city") ||
    places.find((p) => p.country === "sea" || p.kind === "strait" || p.kind === "island" || p.kind === "islands")
  );
}
