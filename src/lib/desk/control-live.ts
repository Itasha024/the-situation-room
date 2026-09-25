/**
 * District control, moved on the 12-hour clock by the capture reports.
 * Server-only.
 *
 * public/control.json stays the hand baseline. Every 12 hours the window's
 * combat cards are read against the districts they fall in, and a live layer
 * (`control-live`) records what changed; /api/brief serves it and the page
 * lays it over the baseline, so the shading, the district notes and the
 * shares follow. The rule, per district:
 *
 *  - taken: two or more outlets from different sides, or a wire agency, tell
 *    the capture of the district's town or of the district itself → it goes to
 *    the captor;
 *  - contested: only one side tells it, both sides claim ground there, or what
 *    was taken is positions, heights or villages rather than the district;
 *  - a contested district goes back to one side under the "taken" rule.
 */

import { ADM2 } from "./adm2-centres.ts";
import { ADM2_SHAPES } from "./adm2-shapes.ts";
import { CONTROL, GOV_CONTROL } from "./control-data.ts";
import { captor, districtNear } from "./control-proposals.ts";
import type { LiveReport } from "./types.ts";
import { outletSide } from "./digest.ts";

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
/** The capture of a place that stands for the district, not of ground inside it. */
const WHOLE = /\b(?:town|city|district|centre|center|capital|port|airport)\b/i;
const PART = /\b(?:positions?|heights?|hills?|villages?|sites?|areas?|mount|jabal|posts?|trenches|outskirts|parts?)\b/i;

/** Did the card tell the capture of the district itself (its town, or it by name)? */
export function tookWhole(summary: string, districtName: string): boolean {
  const m = TOOK.exec(summary);
  if (!m) return false;
  const obj = ` ${m[1]} `.split(STOP_AT)[0];
  if (PART.test(obj)) return false;
  return WHOLE.test(obj) || norm(obj).startsWith(norm(districtName));
}

const BY_NORM = new Map(ADM2.filter((d) => norm(d.name).length >= 5).map((d) => [norm(d.name), d]));
const BY_ID = new Map(ADM2.map((d) => [d.id, d]));
/** A pin set on a governorate or its capital says nothing about which district. */
const VAGUE = new Set(["taiz", "lahj", "dhale", "dali", "marib", "jawf", "bayda", "hodeidah", "hudaydah", "hajjah", "saada", "shabwa", "abyan", "aden", "sanaa", "ibb", "dhamar", "yemen"]);
/** Captured people or kit, not ground. */
const NOT_GROUND = /^\s*(?:an?\s+|two\s+|three\s+|\d+\s+|several\s+|dozens\s+of\s+)?(?:houthi\s+|government\s+)?(?:fighters?|commanders?|members?|prisoners?|militants?|soldiers?|cells?|weapons?|arms|ammunition|boats?|vessels?|drones?|ships?|tankers?|men|leaders?|officers?|people|group|spy|spies)\b/i;

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
  for (const [n, d] of BY_NORM) if (words.includes(` ${n} `)) return d;
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
  const sides = new Set(tellers.map((o) => outletSide(o) || "neutral"));
  const wire = claims.some((c) => c.r.side === "agency") || tellers.some((o) => WIRES.test(o));
  return (new Set(tellers).size >= 2 && sides.size >= 2) || wire;
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
    const took = TOOK.exec(summary);
    if (took && NOT_GROUND.test(took[1])) continue;
    const d = districtOf(r);
    if (!d) continue;
    const g = byDistrict.get(d.id) ?? { d, claims: [] };
    const words = ` ${norm(summary)} `;
    const place = norm(String(r.place || ""));
    const named = (place.length >= 3 && words.includes(` ${place} `)) || words.includes(` ${norm(d.name)} `);
    g.claims.push({ r, to, whole: tookWhole(summary, d.name), named });
    byDistrict.set(d.id, g);
  }
  for (const { d, claims } of byDistrict.values()) {
    const from = sideNow(d.id, d.gov, out);
    let to: Side = from;
    let used: Claim[] = [];
    if (from === "contested") {
      // Back to one side only under the "taken" rule, and only if the other side claims nothing there.
      const sides = new Set(claims.map((c) => c.to));
      if (sides.size === 1 && confirmed(claims) && claims.some((c) => c.whole && c.named)) [to, used] = [claims[0].to, claims];
    } else {
      // The holder's own gains inside its district change nothing; the other side's claims do.
      const rival = claims.filter((c) => c.to !== from && c.named);
      if (rival.length) [to, used] = [confirmed(rival) && rival.some((c) => c.whole) ? rival[0].to : "contested", rival];
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
