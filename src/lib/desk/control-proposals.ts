/**
 * Proposed changes to district control, from the window's capture reports.
 * Server-only; nothing here changes the map.
 *
 * public/control.json is edited by hand. What the 6-hour clock does is point
 * at the districts where the reports say ground changed hands, under the
 * desk's rule for a change: at least two outlets from different sides telling
 * the same capture, or one side's claim that the losing side acknowledges.
 * The proposals are shown on /api/status; applying them waits for the
 * operator's word.
 */

import { ADM2 } from "./adm2-centres.ts";
import { kmApart } from "./copies.ts";
import type { LiveReport } from "./types.ts";

export const PROPOSALS_KEY = "control-proposals";

export type Proposal = {
  district: string;
  name: string;
  gov: string;
  /** Who the reports say now holds it. */
  to: "houthi" | "plc";
  at: string;
  outlets: string[];
  sides: string[];
  headlines: string[];
};

/** Ground changing hands, not an attack on it. */
const CAPTURE = /\b(?:took|takes?|taken|seize[sd]?|seizing|captur(?:e|es|ed)\s+(?:the\s+)?(?:[A-Z][\w'’-]*|positions?|areas?|villages?|heights?|mount|jabal|hills?|camp|town|district)|retake[sn]?|retook|recapture[sd]?|(?:full\s+)?control of|(?<!(?:were|was|been|being|are|is)\s)(?:drove|drives|expel(?:s|led)?|oust(?:s|ed)?|push(?:es|ed)|forced?)\s[^,;.]{0,40}?\b(?:out\s+of|from)\s|clear(?:s|ed)?\s+the|liberat\w+)\b/i;
const NOT_CAPTURE = /\b(?:attempt|tried|try|fail\w*|repel\w*|foil\w*|claims?\s+(?:that\s+)?(?:it|they)\s+would)\b/i;
const HOUTHI = /\bhouthis?\b|\bansar allah\b/i;
const GOV = /\bgovernment\b|\bgiants\b|\bnation's shield\b|\barmy\b|\bresistance\b|\bsubayhah\b|\bstc\b|\bsouthern forces\b|\bcoalition\b|\bjoint forces\b/i;

/** Who a capture headline says took the ground: the side named before the verb. */
export function captor(summary: string): "houthi" | "plc" | null {
  const m = CAPTURE.exec(summary);
  if (!m || NOT_CAPTURE.test(summary)) return null;
  const before = summary.slice(0, m.index);
  const h = before.search(HOUTHI);
  const g = before.search(GOV);
  if (h < 0 && g < 0) return null;
  if (g < 0) return "houthi";
  if (h < 0) return "plc";
  // "Government forces take positions from the Houthis": the first named.
  return h < g ? "houthi" : "plc";
}

/** The district a pin falls in: its nearest district centre, within 30 km. */
export function districtNear(lat: number, lng: number): (typeof ADM2)[number] | null {
  let best: (typeof ADM2)[number] | null = null;
  let d = 30;
  for (const x of ADM2) {
    const k = kmApart({ lat, lng }, x);
    if (k < d) [best, d] = [x, k];
  }
  return best;
}

export function proposeControl(reports: LiveReport[]): Proposal[] {
  const groups = new Map<string, { r: LiveReport; to: "houthi" | "plc"; district: (typeof ADM2)[number] }[]>();
  for (const r of reports) {
    if (r.type !== "combat" || typeof r.lat !== "number" || typeof r.lng !== "number") continue;
    const to = captor(r.summary);
    const district = to ? districtNear(r.lat, r.lng) : null;
    if (!to || !district) continue;
    const k = `${district.id}|${to}`;
    const g = groups.get(k) ?? [];
    g.push({ r, to, district });
    groups.set(k, g);
  }
  const out: Proposal[] = [];
  for (const g of groups.values()) {
    const outlets = [...new Set(g.map((x) => x.r.source))];
    const sides = [...new Set(g.map((x) => x.r.side ?? "neutral"))];
    // Two outlets from different sides; an agency or a neutral outlet counts as a side.
    if (outlets.length < 2 || sides.length < 2) continue;
    const { district, to } = g[0];
    out.push({
      district: district.id,
      name: district.name,
      gov: district.gov,
      to,
      at: g.map((x) => x.r.at).sort().pop() as string,
      outlets,
      sides,
      headlines: g.map((x) => x.r.summary).slice(0, 4),
    });
  }
  return out;
}
