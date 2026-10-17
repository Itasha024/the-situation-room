/*
 * The map pins as each desk serves them (routes/api/desk.ts), as one function per desk so the
 * audits run the very rules the site runs (user, 17 Oct: every pin checked, day by day).
 * Stored pins are never changed here; these rules apply as the desk is read.
 */
import { districtSeat, heardInside, iranEventAllowed, lebanonFire, ownSkyOnly, seaPlace, syrianQuneitra } from "./iran-places.ts";
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
  let s: Pin[] = events.filter((e) => yemenOnly(e) || iranEventAllowed(e));
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
  s = s.map((e) => {
    const q = syrianQuneitra(e);
    const y = q ? { ...e, ...q } : e;
    return lebanonFire(y) ? { ...y, actor: "israel" } : y;
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
