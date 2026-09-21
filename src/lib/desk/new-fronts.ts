/**
 * Fronts that open up. The tracked fronts (brief.ts FRONT_MATCH) are fixed;
 * when fighting or strikes cluster somewhere none of them covers, a new front
 * is opened for it, and it closes again after a week with nothing reported.
 */

import type { LiveReport } from "./types.ts";

export type ExtraFront = {
  id: string;
  name: string;
  spot: [number, number];
  /** Place names seen in its reports, to match later ones by name. */
  places: string[];
  openedAt: string;
  lastActiveAt: string;
};

export const EXTRA_FRONTS_KEY = "fronts-extra";

const WINDOW_MS = 48 * 3600_000;
const RETIRE_MS = 7 * 24 * 3600_000;
const MIN_REPORTS = 4;
const MIN_OUTLETS = 2;
/** About 35 km: one district and its neighbours. */
const NEAR_KM = 35;

function km(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isField(r: LiveReport): boolean {
  return (r.type === "combat" || r.type === "strike") && typeof r.lat === "number" && typeof r.lng === "number";
}

/** Does this report belong to an opened front (by name or distance)? */
export function inExtraFront(r: LiveReport, f: ExtraFront): boolean {
  const place = String(r.place || "").toLowerCase();
  if (place && f.places.some((p) => p.toLowerCase() === place)) return true;
  return isField(r) && km([r.lat as number, r.lng as number], f.spot) <= NEAR_KM;
}

/**
 * Update the opened fronts from the last 48 hours of reports.
 * `covered(r)` says whether a tracked front already covers a report.
 */
export function updateExtraFronts(
  reports: LiveReport[],
  existing: ExtraFront[],
  covered: (r: LiveReport) => boolean,
  now = new Date(),
): ExtraFront[] {
  const t0 = now.getTime() - WINDOW_MS;
  const recent = reports.filter((r) => isField(r) && Date.parse(r.at) >= t0 && Date.parse(r.at) <= now.getTime());
  const fronts = existing.map((f) => ({ ...f, places: [...f.places] }));

  // Opened fronts that saw action stay open.
  for (const f of fronts) {
    const hits = recent.filter((r) => inExtraFront(r, f));
    if (!hits.length) continue;
    const last = hits.map((r) => r.at).sort().pop() as string;
    if (last > f.lastActiveAt) f.lastActiveAt = last;
    for (const r of hits) if (r.place && !f.places.includes(r.place)) f.places.push(r.place);
  }

  // Uncovered reports, clustered around each other.
  const loose = recent.filter((r) => !covered(r) && !fronts.some((f) => inExtraFront(r, f)));
  const used = new Set<LiveReport>();
  for (const seed of loose) {
    if (used.has(seed)) continue;
    const at: [number, number] = [seed.lat as number, seed.lng as number];
    const group = loose.filter((r) => !used.has(r) && km(at, [r.lat as number, r.lng as number]) <= NEAR_KM);
    const outlets = new Set(group.map((r) => r.source));
    if (group.length < MIN_REPORTS || outlets.size < MIN_OUTLETS) continue;
    group.forEach((r) => used.add(r));
    const names = group.map((r) => r.place).filter(Boolean) as string[];
    const top = names.sort((a, b) => names.filter((x) => x === b).length - names.filter((x) => x === a).length)[0];
    if (!top || fronts.some((f) => f.id === `x-${slug(top)}`)) continue;
    const spot: [number, number] = [
      group.reduce((s, r) => s + (r.lat as number), 0) / group.length,
      group.reduce((s, r) => s + (r.lng as number), 0) / group.length,
    ];
    fronts.push({
      id: `x-${slug(top)}`,
      name: top,
      spot: [Math.round(spot[0] * 1000) / 1000, Math.round(spot[1] * 1000) / 1000],
      places: [...new Set(names)],
      openedAt: now.toISOString(),
      lastActiveAt: group.map((r) => r.at).sort().pop() as string,
    });
  }

  // A week with nothing reported closes it.
  return fronts.filter((f) => now.getTime() - Date.parse(f.lastActiveAt) <= RETIRE_MS);
}
