/*
 * The map pins as each desk serves them (routes/api/desk.ts), as one function per desk so the
 * audits run the very rules the site runs (user, 17 Oct: every pin checked, day by day).
 * Stored pins are never changed here; these rules apply as the desk is read.
 */
import { districtSeat, gulfAttack, heardInside, iranEventAllowed, iranPinAllowed, lebanonFire, ownSkyOnly, seaPlace, syrianQuneitra } from "./iran-places.ts";
import { countryPin, notEvent, onePinPerEvent, servePins, strayExtraPins } from "./yemen-pins.ts";
import { yemenPinSide } from "./dev-marks.ts";

type Pin = {
  fp?: string;
  at?: string;
  type?: string | null;
  lat?: number;
  lng?: number;
  place?: string | null;
  label?: string | null;
  text?: string | null;
  actor?: string | null;
  desks?: string[];
  sea?: boolean;
};

/** The Iran map's own pins pass its scope as they are served, so a pin stored under older rules never shows. */
export function serveIranPins<T extends Pin>(events: T[]): T[] {
  const yemenOnly = (e: Pin) => (e.desks ?? []).includes("yemen");
  // A Gulf state's own strike is the Gulf states' pin, purple (user, 20 Oct), before the map's scope is read for its side.
  // A Yemen desk pin takes the side the Yemen map gives it, the Saudi-led coalition's being a Gulf state's here, and
  // passes the Yemen map's rules: no analysis, toll or roundup (20 Oct: they were drawn grey, "Not stated", unread).
  let s: Pin[] = events.map((e) => {
    if (yemenOnly(e)) {
      // A side the Iran desk's reader gave it stands.
      if (e.actor && !["unclear", "other"].includes(e.actor)) return e;
      const side = yemenPinSide(e);
      const actor = side === "saudi" ? "gulf" : side;
      return actor === e.actor ? e : { ...e, actor };
    }
    return e.actor !== "gulf" && gulfAttack(e.label) ? { ...e, actor: "gulf" } : e;
  });
  s = s.filter((e) => (yemenOnly(e) ? !notEvent(e) && !countryPin(e) : iranEventAllowed(e)));
  // A pin on a place heard inside a longer one's name: a card's extra pin goes, its own pin moves to the longer place.
  s = s.flatMap((e) => {
    const host = yemenOnly(e) ? null : heardInside(e);
    if (!host) return [e];
    return String(e.fp ?? "").includes("-pin-") ? [] : [{ ...e, place: host.name, lat: host.lat, lng: host.lng }];
  });
  // A pin on a district's seat moves to the village its label names.
  s = s.map((e) => {
    if (yemenOnly(e)) return e;
    const v = districtSeat(e);
    return v ? { ...e, place: v.name, lat: v.lat, lng: v.lng } : e;
  });
  // Iran's own air defence and alarms, with no attacker named: side not stated.
  s = s.map((e) => (ownSkyOnly(e) ? { ...e, actor: "unclear" } : e));
  // Any fire into south Lebanon with no side named is Israel's, and Syria's Quneitra is off the Lebanese village of its name (17 Oct).
  // Once moved to Syria, the map's scope is read again there (20 Oct: Israeli shelling in Syria's Quneitra countryside was
  // drawn though the map shows no Israeli fire in Syria).
  s = s.flatMap((e) => {
    const q = syrianQuneitra(e);
    if (q && !yemenOnly(e) && !iranPinAllowed(e.actor, { country: "Syria" }, String(e.label ?? ""))) return [];
    const y = q ? { ...e, ...q } : e;
    return [lebanonFire(y) ? { ...y, actor: "israel" } : y];
  });
  // No analysis, aftermath or roundup, and no extra pin on a place the report does not name.
  s = strayExtraPins(s.filter((e) => yemenOnly(e) || !notEvent(e)));
  // At sea or on land, a sea pin in its sea and off the land: the researched pins' rule.
  s = s.map((e) => {
    if (yemenOnly(e) || typeof e.lat !== "number" || typeof e.lng !== "number") return e;
    const w = seaPlace({ ...e, lat: e.lat, lng: e.lng });
    return { ...e, lat: w.lat, lng: w.lng, sea: w.sea };
  });
  // No pin on a whole country's centre, and one pin per event.
  return onePinPerEvent(s.filter((e) => !countryPin(e))) as T[];
}

/**
 * A card shows the place its pin is served on (20 Oct: "Oil tanker hit by projectile near Jubail, Saudi Arabia" was stored
 * at Byblos, Lebanon's Jbeil, and its card said so while its pin stood at Jubail). The rows stay as they are.
 */
export function cardsOnTheirPins(cards: Record<string, unknown>[], pins: Pin[]): void {
  const pinOf = new Map(pins.map((e) => [String(e.fp ?? ""), e]));
  for (const r of cards) {
    const k = pinOf.get(String(r.fp));
    if (k && typeof k.lat === "number" && k.place && k.place !== r.place) Object.assign(r, { place: k.place, lat: k.lat, lng: k.lng });
  }
}

/**
 * The Yemen map's pins: on the place a report names, one per event, no analysis or visits. Who acted,
 * for the pin's colour, is read before the pins of one event are joined (two sides are two events) and
 * again once each sits on its place.
 */
export function serveYemenPins<T extends Pin>(events: T[]): T[] {
  const side = (e: T): T => {
    const actor = yemenPinSide(e);
    return actor === e.actor ? e : { ...e, actor };
  };
  return servePins(events.map(side)).map(side);
}
