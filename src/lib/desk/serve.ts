/**
 * How a desk's stored cards and pins are shown (moved here from /api/desk so
 * the main desk's /api/region serves them exactly the same way). The rows
 * stay as stored; only what is served is mended.
 */
import { checkLinks } from "./links.ts";
import { unglue } from "./reader.ts";
import { respell } from "./spelling.ts";
import { rightOffice } from "./offices.ts";
import { iranLeanOfSource } from "../yemen-scan.server.ts";
import { districtSeat, heardInside, iranEventAllowed, ownSkyOnly, seaPlace } from "./iran-places.ts";
import type { DeskSlice } from "./store.ts";
import type { DeskId } from "../desks.ts";

export function serveSlice(slice: DeskSlice, desk: DeskId): DeskSlice {
  // Cards stored before the link rules keep their row; a link that
  // breaks the rules is just not shown (links.ts).
  checkLinks(slice.reports as never[], slice.reports as never[]);
  // A word a model glued to a name is shown split, and a name in the
  // desk's one spelling; the row is left as it is.
  for (const r of slice.reports) {
    r.summary = rightOffice(respell(unglue(String(r.summary ?? ""))));
    if (r.text) r.text = rightOffice(respell(String(r.text)));
    // The Iran desk's filter buttons go by the source's group.
    if (desk === "iran") (r as Record<string, unknown>).lean = iranLeanOfSource(String(r.source ?? ""));
  }
  // The Iran map's own pins pass its scope as they are served, so a pin stored under older rules never shows.
  if (desk === "iran" && Array.isArray((slice as { events?: unknown[] }).events)) {
    const s = slice as unknown as { events: { desks?: string[]; actor?: string | null; place?: string | null; label?: string | null }[] };
    s.events = s.events.filter((e) => (e.desks ?? []).includes("yemen") || iranEventAllowed(e));
    // A pin on a place heard inside a longer one's name: a card's extra pin goes, its own pin moves to the longer place.
    s.events = s.events.flatMap((e) => {
      const host = (e.desks ?? []).includes("yemen") ? null : heardInside(e);
      if (!host) return [e];
      const x = e as typeof e & { fp?: string; lat?: number; lng?: number };
      return String(x.fp ?? "").includes("-pin-") ? [] : [{ ...x, place: host.name, lat: host.lat, lng: host.lng }];
    });
    // A pin on a district's seat moves to the village its label names.
    s.events = s.events.map((e) => {
      if ((e.desks ?? []).includes("yemen")) return e;
      const v = districtSeat(e);
      return v ? { ...e, place: v.name, lat: v.lat, lng: v.lng } : e;
    });
    // Iran's own air defence and alarms, with no attacker named: side not stated.
    s.events = s.events.map((e) => (ownSkyOnly(e) ? { ...e, actor: "unclear" } : e));
    // At sea or on land, a sea pin in its sea and off the land: the researched pins' rule.
    s.events = s.events.map((e) => {
      const x = e as typeof e & { lat?: number; lng?: number; type?: string | null };
      if ((e.desks ?? []).includes("yemen") || typeof x.lat !== "number" || typeof x.lng !== "number") return e;
      const w = seaPlace({ ...x, lat: x.lat, lng: x.lng });
      return { ...e, lat: w.lat, lng: w.lng, sea: w.sea };
    });
  }
  return slice;
}
