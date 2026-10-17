/*
 * The Yemen map's pins as they are served (user, 17 Oct: "64 events today, 16 in one pin").
 *
 * Stored pins are not changed; these rules apply as the desk is read, so pins
 * stored under older rules are shown right too:
 *   - A pin on a city or governorate centre moves to the district its label
 *     names inside that governorate: "Saudi forces shell Shada…" in Saada,
 *     "Houthi shelling … in Sabr Al-Mawadim district in Taiz". The gazetteer
 *     knows few districts, so these all sat on Taiz or Saada.
 *   - An "at sea" pin that names no ship or sea is a strike ("Houthi missile
 *     strikes Saudi forces command headquarters in Badr camp in Aden").
 *   - An analysis piece or an official's visit is no event ("Houthis close in
 *     on key Yemen city of Taiz: Why a global trade route is at risk").
 *   - One event told by several outlets is one pin: a later pin on the same
 *     spot, the same day and of the same kind, that tells the same thing, goes.
 */
import { ADM2 } from "./adm2-centres.ts";
import { governorateAt } from "./adm1.ts";
import { placeKey } from "./prose-places.ts";

export type YemenPin = { fp?: string; at?: string; type?: string | null; lat?: number; lng?: number; place?: string | null; label?: string | null };

const STOP = new Set(["al", "the", "and", "of", "in", "on", "at", "district", "governorate", "city", "front", "village", "area"]);

/** Districts by governorate, each with its key. */
const BY_GOV = new Map<string, { name: string; key: string; bones: string; lat: number; lng: number }[]>();
/** A name's consonants: "Sabr Al-Mawadim" and "Sabir Al Mawadim", "Al-Shamaitin" and "Ash Shamayatayn" are one. */
const bones = (key: string) => key.replace(/[aeiouyw]/g, "");
for (const d of ADM2) {
  const key = placeKey(d.name);
  if (key.length < 4) continue;
  if (!BY_GOV.has(d.gov)) BY_GOV.set(d.gov, []);
  BY_GOV.get(d.gov)!.push({ name: d.name, key, bones: bones(key), lat: d.lat, lng: d.lng });
}

/** Capitalised runs of one to three words in a label: "Sabr Al-Mawadim", "Shada", "Bani Mu'in". */
function runsOf(label: string): string[] {
  const words = label.replace(/[’]/g, "'").split(/[\s,.;:()]+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (!/^[A-Z]/.test(words[i]) || STOP.has(words[i].toLowerCase())) continue;
    for (let n = 3; n >= 1; n--) {
      const run = words.slice(i, i + n);
      if (run.length === n && run.every((w, j) => j === 0 || /^[A-Z]/.test(w) || /^(?:al|el|as|ash|ad|ar|at|az|an)-/i.test(w))) out.push(run.join(" "));
    }
  }
  return out;
}

/** The district a label names inside the governorate a pin sits in, when the pin is on that governorate's or city's centre. */
export function districtPin(e: YemenPin): { name: string; lat: number; lng: number } | null {
  if (typeof e.lat !== "number" || typeof e.lng !== "number" || !e.label) return null;
  const gov = governorateAt(e.lat, e.lng);
  const list = gov ? BY_GOV.get(gov) : undefined;
  if (!list) return null;
  const here = placeKey(String(e.place || "").split(",")[0]);
  // Only a pin on a broad place moves: a pin already on a district or village stays.
  const broad = !here || BROAD.has(here);
  if (!broad) return null;
  for (const run of runsOf(e.label)) {
    const k = ALIAS[placeKey(run)] ?? placeKey(run);
    if (k === here) continue;
    const b = bones(k);
    const hit = list.find((d) => d.key === k) || (b.length >= 4 ? list.find((d) => d.bones === b) : undefined);
    if (hit && Math.hypot(hit.lat - e.lat, hit.lng - e.lng) > 0.02) return { name: hit.name, lat: hit.lat, lng: hit.lng };
  }
  return null;
}
/** Spellings the press uses for a district that the map's list spells another way. */
const ALIAS: Record<string, string> = { [placeKey("Sameh")]: placeKey("Sami'"), [placeKey("Sama")]: placeKey("Sami'") };
/** Districts named after their governorate's city: a pin there is on the city centre. */
const BROAD = new Set(["taiz", "sada", "marib", "aden", "lahj", "sana", "hodeida", "ib", "dhamar", "haja", "amran", "bayda", "dhale", "jawf", "abyan", "shabwa", "mukala"].map(placeKey));

const SHIP = /\b(?:ship|ships|vessel|vessels|tanker|tankers|boat|boats|frigate|destroyer|carrier|freighter|dhow|sea|strait|port|harbou?r|maritime|naval|navy|coast guard|Red Sea|Gulf of Aden|Bab al-Mandab)\b/i;
/** A pin's kind as served: "at sea" only when its label names a ship or the sea. */
export function pinType(e: YemenPin): string | null | undefined {
  return e.type === "vessel" && e.label && !SHIP.test(e.label) ? "strike" : e.type;
}

const NOT_EVENT = /:\s*(?:why|how|what)\b|\?\s*$|\b(?:analysis|explainer|inspects?|inspected|tours?|toured)\b|\b(?:publish\w*|releases?|released|shows?|airs?|aired)\s+(?:new\s+)?footage\b|\bfootage\s+(?:shows|of)\b|\btransfers?\s+\d+\s*(?:percent|%)/i;
/** An analysis piece, an official's visit, footage of an attack already pinned, or a move of staff: not an event on the map (17 Oct). */
export function notEvent(e: YemenPin): boolean {
  return NOT_EVENT.test(String(e.label || ""));
}

const words = (s: string) => new Set(String(s).toLowerCase().match(/[a-z]{4,}/g) || []);
function alike(a: string, b: string): boolean {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n / Math.min(A.size, B.size) >= 0.7;
}
const dayOf = (at?: string) => (at ? new Date(Date.parse(at) + 3 * 3600e3).toISOString().slice(0, 10) : "");

/** The pins with one event told by several outlets kept once: the first one served (the newest) stays. */
export function onePinPerEvent<T extends YemenPin>(pins: T[]): T[] {
  const kept: T[] = [];
  for (const p of pins) {
    const twin = kept.some((k) =>
      k.type === p.type && dayOf(k.at) === dayOf(p.at) &&
      typeof k.lat === "number" && typeof p.lat === "number" &&
      // The same spot, or the same place by name: one card's district pin and its own pin (17 Oct).
      ((Math.abs(k.lat - p.lat) < 0.01 && Math.abs((k.lng ?? 0) - (p.lng ?? 0)) < 0.01) ||
        (!!k.place && String(k.place).toLowerCase() === String(p.place || "").toLowerCase())) &&
      alike(String(k.label || ""), String(p.label || "")));
    if (!twin) kept.push(p);
  }
  return kept;
}

const COUNTRIES = new Set(["Saudi Arabia", "Iran", "Yemen", "Iraq", "Israel", "Lebanon", "Oman", "UAE", "United Arab Emirates", "Qatar", "Kuwait", "Bahrain", "Syria", "Jordan", "Egypt", "Eritrea", "Djibouti", "Somalia"].map((n) => n.toLowerCase()));
/** A pin on a whole country's centre is no place at all: a tanker hit "off Saudi Arabia" sat in the Nejd desert (17 Oct). */
export function countryPin(e: YemenPin): boolean {
  return COUNTRIES.has(String(e.place || "").trim().toLowerCase());
}

/** Every rule above, in order. */
export function servePins<T extends YemenPin>(pins: T[]): T[] {
  const moved = pins.filter((e) => !notEvent(e) && !countryPin(e)).map((e) => {
    const d = districtPin(e);
    const type = pinType(e);
    return { ...e, ...(d ? { place: d.name, lat: d.lat, lng: d.lng } : {}), ...(type !== e.type ? { type } : {}) };
  });
  return onePinPerEvent(moved);
}
