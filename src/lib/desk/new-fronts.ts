/**
 * Fronts that open up. The tracked fronts (brief.ts FRONT_MATCH) are fixed;
 * when fighting or strikes cluster somewhere none of them covers, a new front
 * is opened for it, and it closes again after a week with nothing reported.
 *
 * A second cluster in the governorate of a front already opened joins that
 * front — one card, one list of places, a spot for each cluster — rather than
 * opening a second front beside it: two clusters in Saada are the Saada front.
 */

import { governorateAt } from "./adm1.ts";
import { kmApart } from "./copies.ts";
import type { LiveReport } from "./types.ts";

export type ExtraFront = {
  id: string;
  name: string;
  /** The first cluster's spot; `spots` has one per cluster. */
  spot: [number, number];
  spots?: [number, number][];
  /** The governorate (ISO, "YE-SD") the front lies in. */
  gov?: string;
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

/** A front spanning several clusters is named for its governorate. */
const GOVERNORATE: Record<string, string> = {
  "YE-AB": "Abyan", "YE-AD": "Aden", "YE-AM": "Amran", "YE-BA": "Al-Bayda", "YE-DA": "Al-Dhale", "YE-DH": "Dhamar",
  "YE-HD": "Hadramawt", "YE-HJ": "Hajjah", "YE-HU": "Hodeidah", "YE-IB": "Ibb", "YE-JA": "Al-Jawf", "YE-LA": "Lahj",
  "YE-MA": "Marib", "YE-MR": "Al-Mahra", "YE-MW": "Al-Mahwit", "YE-RA": "Raymah", "YE-SA": "Sanaa", "YE-SD": "Saada",
  "YE-SH": "Shabwa", "YE-SN": "Sanaa", "YE-SU": "Socotra", "YE-TA": "Taiz",
};

const at = (p: [number, number]) => ({ lat: p[0], lng: p[1] });

function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isField(r: LiveReport): boolean {
  return (r.type === "combat" || r.type === "strike") && typeof r.lat === "number" && typeof r.lng === "number";
}

export function spotsOf(f: ExtraFront): [number, number][] {
  return f.spots?.length ? f.spots : [f.spot];
}

/** Does this report belong to an opened front (by name, or near one of its spots)? */
export function inExtraFront(r: LiveReport, f: ExtraFront): boolean {
  const place = String(r.place || "").toLowerCase();
  if (place && f.places.some((p) => p.toLowerCase() === place)) return true;
  return isField(r) && spotsOf(f).some((s) => kmApart({ lat: r.lat as number, lng: r.lng as number }, at(s)) <= NEAR_KM);
}

/** The name most reports used; ties go to the first seen. */
function commonest(names: string[]): string | undefined {
  const n = new Map<string, number>();
  for (const x of names) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Fold `b` into `a`: a spot each, one list of places, named for the governorate. */
function merge(a: ExtraFront, b: ExtraFront): void {
  a.spots = [...spotsOf(a), ...spotsOf(b).filter((s) => !spotsOf(a).some((x) => kmApart(at(x), at(s)) <= NEAR_KM))];
  a.places = [...new Set([...a.places, ...b.places])];
  if (b.lastActiveAt > a.lastActiveAt) a.lastActiveAt = b.lastActiveAt;
  if (b.openedAt < a.openedAt) a.openedAt = b.openedAt;
  if (a.gov && GOVERNORATE[a.gov] && a.spots.length > 1) a.name = GOVERNORATE[a.gov];
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
  const fronts: ExtraFront[] = [];
  // Fronts opened before merging existed: two in one governorate become one.
  for (const f of existing.map((x) => ({ ...x, places: [...x.places], gov: x.gov ?? governorateAt(x.spot[0], x.spot[1]) ?? undefined }))) {
    const same = f.gov ? fronts.find((o) => o.gov === f.gov) : undefined;
    if (same) merge(same, f);
    else fronts.push(f);
  }

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
    const here = { lat: seed.lat as number, lng: seed.lng as number };
    const group = loose.filter((r) => !used.has(r) && kmApart(here, { lat: r.lat as number, lng: r.lng as number }) <= NEAR_KM);
    const outlets = new Set(group.map((r) => r.source));
    if (group.length < MIN_REPORTS || outlets.size < MIN_OUTLETS) continue;
    group.forEach((r) => used.add(r));
    const names = group.map((r) => r.place).filter(Boolean) as string[];
    const top = commonest(names);
    if (!top) continue;
    const spot: [number, number] = [
      Math.round((group.reduce((s, r) => s + (r.lat as number), 0) / group.length) * 1000) / 1000,
      Math.round((group.reduce((s, r) => s + (r.lng as number), 0) / group.length) * 1000) / 1000,
    ];
    const cluster: ExtraFront = {
      id: `x-${slug(top)}`,
      name: top,
      spot,
      gov: governorateAt(spot[0], spot[1]) ?? undefined,
      places: [...new Set(names)],
      openedAt: now.toISOString(),
      lastActiveAt: group.map((r) => r.at).sort().pop() as string,
    };
    // A front already open in this governorate takes the cluster as its second spot.
    const same = fronts.find((f) => f.id === cluster.id || (cluster.gov && f.gov === cluster.gov));
    if (same) merge(same, cluster);
    else fronts.push(cluster);
  }

  // A week with nothing reported closes it.
  return fronts.filter((f) => now.getTime() - Date.parse(f.lastActiveAt) <= RETIRE_MS);
}
