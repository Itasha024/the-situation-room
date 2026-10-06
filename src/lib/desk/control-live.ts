/**
 * District control, moved on the 6-hour clock by the capture reports.
 * Server-only.
 *
 * public/control.json stays the hand baseline. Every 6 hours the window's
 * combat cards are read against the districts they fall in, and a live layer
 * (`control-live`) records what changed; /api/brief serves it and the page
 * lays it over the baseline, so the shading, the district notes and the
 * shares follow. The rule, per district:
 *
 *  - taken: two or more outlets from different sides, or a wire agency, tell
 *    the capture of the whole district (full control of it, or its holder
 *    driven out) → it goes to the captor;
 *  - contested: only one side tells it, or what was taken is the district's
 *    centre, a town, positions, heights or villages in it (user, 2 Oct: in
 *    Yemen a district falls once its rural areas are cleared too; Hays's centre
 *    fell first, full control of the district was told later);
 *  - a contested district stays so until one side's full control of it is
 *    told the same way. Silence moves nothing.
 */

import { ADM2 } from "./adm2-centres.ts";
import { ADM2_SHAPES } from "./adm2-shapes.ts";
import { CONTROL, GOV_CONTROL } from "./control-data.ts";
import { captor, districtNear } from "./control-proposals.ts";
import type { LiveReport } from "./types.ts";
import { groupOf } from "./source-rating.ts";

export const CONTROL_LIVE_KEY = "control-live";

export type Side = "houthi" | "plc" | "contested";
export type LiveDistrict = { side: Side; since: string; src: { outlet: string; url?: string }[]; note: string };
export type ControlChange = { at: string; district: string; name: string; from: Side; to: Side; outlets: string[]; headlines: string[] };
export type ControlLive = { districts: Record<string, LiveDistrict>; changes: ControlChange[]; asOf: string };

const WIRES = /^(?:reuters|associated press|ap|afp|agence france-presse|xinhua|anadolu|dpa|efe|ansa)\b/i;

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ'’`]/g, "").replace(/\b(?:al|ad|ar|as|ash|at|az|adh|an)[\s-]+/g, "").replace(/[^a-z]+/g, " ").trim();
}

/** What the verb took: the words after it, up to "near", "in", a comma and the like. */
const TOOK = /\b(?:took|takes?|taken|seize[sd]?|seizing|captur(?:e|es|ed)|retake[sn]?|retook|recapture[sd]?|control of|enter(?:s|ed)?|liberat\w+)\s+(?:the\s+)?([^,;.]{0,60})/i;
const STOP_AT = /\s(?:near|around|outside|in|on|at|from|east|west|north|south|after|as|and|while|towards?)\s/i;
/** A town, its centre or ground inside the district: contested, not taken. */
const PART = /\b(?:positions?|heights?|hills?|villages?|sites?|areas?|mount|jabal|posts?|trenches|outskirts|parts?|town|city|centre|center|capital|port|airport|base|camp)\b/i;
/** The whole district: "full control of", "the whole/entire", "in full", "fully", "X district". */
const FULL = /\b(?:full|complete|total)\s+control\s+(?:of|over)\s+(?:the\s+)?([^,;.]{0,60})/i;
const ALL = /^\s*(?:all\s+of|the\s+whole\s+of|the\s+whole|the\s+entire|whole|entire)\s+(?:the\s+)?/i;
const IN_FULL = /\b(?:fully|completely|entirely|in\s+full)\b/i;
/** The holder driven out: "drove the Houthis out of X", "expelled government forces from X". */
const OUT = /\b(?:drove|drive[sn]?|driving|push(?:ed|es)?|forced?|expel(?:s|led)?|oust(?:s|ed)?)\b[^,;.]{0,40}?\b(?:out\s+of|from)\s+(?:the\s+)?([^,;.]{0,60})/i;

/** The words name the district itself ("Hays district", "Bayhan", "the district"), not a town in it. */
function isDistrict(obj: string, districtName: string): boolean {
  const o = ` ${obj} `.split(STOP_AT)[0].replace(ALL, "");
  if (PART.test(o)) return false;
  return /\bdistrict\b/i.test(o) || norm(o).startsWith(norm(districtName));
}

/**
 * Did the card tell the capture of the whole district: full control of it, the
 * holder driven out of it, or "X district" taken? A bare name ("take Hays") is
 * also the district's town, so it counts only with "the whole", "fully", "in full".
 */
export function tookWhole(summary: string, districtName: string): boolean {
  const full = FULL.exec(summary);
  if (full && isDistrict(full[1], districtName)) return true;
  const out = OUT.exec(summary);
  if (out && isDistrict(out[1], districtName)) return true;
  const m = TOOK.exec(summary);
  if (!m) return false;
  const obj = ` ${m[1]} `.split(STOP_AT)[0];
  return (ALL.test(obj) || IN_FULL.test(summary) || /\bdistrict\b/i.test(obj)) && isDistrict(obj, districtName);
}

const BY_NORM = new Map(ADM2.filter((d) => norm(d.name).length >= 5).map((d) => [norm(d.name), d]));
const BY_ID = new Map(ADM2.map((d) => [d.id, d]));
/** A pin set on a governorate or its capital says nothing about which district. */
const VAGUE = new Set(["taiz", "lahj", "dhale", "dali", "marib", "jawf", "bayda", "hodeidah", "hudaydah", "hajjah", "saada", "shabwa", "abyan", "aden", "sanaa", "ibb", "dhamar", "yemen"]);
/** Captured people or kit, not ground. */
const NOT_GROUND = /^\s*(?:an?\s+|two\s+|three\s+|\d+\s+|several\s+|dozens\s+of\s+)?(?:houthi\s+|government\s+)?(?:fighters?|commanders?|members?|prisoners?|militants?|soldiers?|cells?|weapons?|arms|ammunition|boats?|vessels?|drones?|ships?|tankers?|men|leaders?|officers?|people|group|spy|spies)\b/i;

/**
 * A building, not ground: "Houthi forces seize Al-Juba hospital in Marib for
 * military use" turned Ma'rib district contested on 29 September. Taking over
 * a hospital, a school or a house where a side already stands moves no line.
 */
const BUILDING = /\b(?:hospitals?|schools?|clinics?|mosques?|house|houses|homes?|buildings?|complex|compound|university|college|warehouses?|farms?|residential|offices?|headquarters|hotel|stadium|factory|market)\b/i;

function inRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The district a pin falls in, by the districts' outlines. */
export function districtAt(lat: number, lng: number): (typeof ADM2)[number] | null {
  for (const [id, rings] of ADM2_SHAPES) if (rings.some((r) => inRing(lng, lat, r))) return BY_ID.get(id) ?? null;
  return null;
}

/** The district a card is about: the one its pin falls in, or one it names. */
export function districtOf(r: LiveReport): (typeof ADM2)[number] | null {
  if (typeof r.lat === "number" && typeof r.lng === "number" && !VAGUE.has(norm(String(r.place || "")))) {
    const at = districtAt(r.lat, r.lng) ?? districtNear(r.lat, r.lng);
    if (at) return at;
  }
  const words = ` ${norm(String(r.summary || ""))} `;
  // A governorate's name ("in Marib", "in Taiz") is not its capital's district.
  for (const [n, d] of BY_NORM) if (!VAGUE.has(n) && words.includes(` ${n} `)) return d;
  return null;
}

/** Who holds a district now: the live layer, else the hand baseline, else its governorate. */
export function sideNow(id: string, gov: string, live: ControlLive | null): Side {
  const s = live?.districts[id]?.side ?? CONTROL.find((d) => d.id === id)?.side ?? GOV_CONTROL[gov] ?? "contested";
  return s === "houthi" || s === "plc" ? s : "contested";
}

/** named: the headline names the card's place or the district, so its claim is about that ground. */
type Claim = { r: LiveReport; to: "houthi" | "plc"; whole: boolean; named: boolean };

/** Two outlets from different sides, or a wire agency. A merged card carries every outlet that told it. */
function confirmed(claims: Claim[]): boolean {
  const tellers = claims.flatMap((c) => [c.r.source, ...(c.r.alsoReportedBy ?? []).map((a) => a.source)]).filter(Boolean);
  // The Sources list's three groups: Houthi-aligned, government-aligned, non-aligned (2 Oct).
  const sides = new Set(tellers.map((o) => groupOf(o)));
  const wire = claims.some((c) => c.r.side === "agency") || tellers.some((o) => WIRES.test(o));
  return (new Set(tellers).size >= 2 && sides.size >= 2) || wire;
}

/**
 * What the headline says was taken is ground: not fighters, kit or boats
 * ("seized weapons"), and not a building (a hospital taken over moves no line).
 */
export function tookGround(summary: string): boolean {
  const took = TOOK.exec(String(summary || ""));
  return !took || !(NOT_GROUND.test(took[1]) || BUILDING.test(` ${took[1]} `.split(STOP_AT)[0]));
}

/** The claim names the card's place or its district, so it is about that ground. */
function namesGround(r: LiveReport, d: (typeof ADM2)[number]): boolean {
  const words = ` ${norm(String(r.summary || ""))} `;
  const place = norm(String(r.place || ""));
  return (place.length >= 3 && words.includes(` ${place} `)) || words.includes(` ${norm(d.name)} `);
}

/**
 * One card's capture told the way control needs it before a district changes
 * side, and the only kind the developments' maps draw as ground taken (a flag,
 * the district in the taker's colour). The same rule as control's, whole (user,
 * 3 Oct: flags of ground taken where the conditions were not met):
 *  - a combat report of ground taken, not people, kit or a building;
 *  - the whole district: full control of it, its holder driven out, or "X
 *    district" taken; a town, its centre, a hill or a village is an advance;
 *  - the claim names the place or the district;
 *  - two outlets not on the same side (a non-aligned outlet counts as its own),
 *    or a wire. Two anti-Houthi outlets (Aden al-Ghad and Almashhad) are one side.
 * Anything less is drawn as the side's advance.
 */
export function captureConfirmed(r: LiveReport): boolean {
  if (r.type !== "combat") return false;
  const summary = String(r.summary || "");
  if (!tookGround(summary)) return false;
  const d = districtOf(r);
  if (!d || !namesGround(r, d) || !tookWhole(summary, d.name)) return false;
  return confirmed([{ r, to: "plc", whole: true, named: true }]);
}

/** Apply one window's capture reports to the live layer. Returns the new layer. */
export function updateControlLive(prev: ControlLive | null, reports: LiveReport[], now = new Date()): ControlLive {
  const out: ControlLive = { districts: { ...(prev?.districts ?? {}) }, changes: [...(prev?.changes ?? [])], asOf: now.toISOString() };
  const byDistrict = new Map<string, { d: (typeof ADM2)[number]; claims: Claim[] }>();
  for (const r of reports) {
    if (r.type !== "combat") continue;
    const summary = String(r.summary || "");
    const to = captor(summary);
    if (!to) continue;
    if (!tookGround(summary)) continue;
    const d = districtOf(r);
    if (!d) continue;
    const g = byDistrict.get(d.id) ?? { d, claims: [] };
    g.claims.push({ r, to, whole: tookWhole(summary, d.name), named: namesGround(r, d) });
    byDistrict.set(d.id, g);
  }
  for (const { d, claims } of byDistrict.values()) {
    const from = sideNow(d.id, d.gov, out);
    let to: Side = from;
    let used: Claim[] = [];
    const wholeOf = (s: Side) => claims.filter((c) => c.to === s && c.whole && c.named);
    if (from === "contested") {
      // It stays contested until one side's full control of it is told the same way (user, 2 Oct).
      const won = (["houthi", "plc"] as const).filter((s) => wholeOf(s).length && confirmed(wholeOf(s)));
      if (won.length === 1) [to, used] = [won[0], wholeOf(won[0])];
    } else {
      // The holder's own gains inside its district change nothing; the other side's claims do.
      const rival = claims.filter((c) => c.to !== from && c.named);
      const whole = rival.filter((c) => c.whole);
      if (rival.length) [to, used] = whole.length && confirmed(whole) ? [whole[0].to, whole] : ["contested", rival];
    }
    if (to === from || !used.length) continue;
    const at = used.map((c) => c.r.at).sort().pop() as string;
    out.districts[d.id] = {
      side: to,
      since: at.slice(0, 10),
      src: used.slice(0, 4).map((c) => ({ outlet: c.r.source, ...(c.r.url ? { url: c.r.url } : {}) })),
      note: used[0].r.summary,
    };
    out.changes.unshift({ at, district: d.id, name: d.name, from, to, outlets: [...new Set(used.map((c) => c.r.source))], headlines: used.map((c) => c.r.summary).slice(0, 3) });
  }
  out.changes = out.changes.slice(0, 60);
  return out;
}

/** The control picture for the writers: the baseline's changed and contested districts, with the live layer over it. */
export function mergedControl(live: ControlLive | null): { id: string; name: string; gov: string; side: string; since?: string; note?: string }[] {
  const rows = new Map(CONTROL.map((d) => [d.id, { ...d }]));
  for (const [id, l] of Object.entries(live?.districts ?? {})) {
    const base = ADM2.find((d) => d.id === id);
    if (!base) continue;
    rows.set(id, { id, name: base.name, gov: base.gov, side: l.side, since: l.since, note: l.note });
  }
  return [...rows.values()];
}
