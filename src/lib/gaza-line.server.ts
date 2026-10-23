/**
 * The mapped IDF-held area of Gaza, read from the mapping projects that publish it as data (gaza-line.ts).
 * Server-only. Checked every 6 hours by the Gaza cycle; a newer map replaces the stored one.
 *
 * Research of 24 Oct 2026 (none of them is current to the week; the mappers' reports fill the gap):
 *  - the UN's "Coordination Area" (UN DSS, published by UNICEF): the zone behind the yellow and orange
 *    lines, where movement needs the IDF's say; 23 June 2026, 237.8 km², about 65%;
 *  - UNRWA's "IDF Red Area" behind the yellow line proper: 12 May 2026, 203 km², about 56%. UNRWA's
 *    newer layers are found by its account's newest item with "yellow" in the title.
 */

import { areaKm2, GAZA_KM2 } from "./desk/gaza-line.ts";
import type { getStore } from "./desk/store.ts";

export const GAZA_AREA_KEY = "gaza:idf-area";
const EVERY_MS = 6 * 3600_000;

type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
export type MappedArea = { name: string; by: string; url: string; asOf: string; km2: number; share: number; geometry: Geometry };
export type IdfArea = { held: MappedArea | null; zone: MappedArea | null; checkedAt: string };

const ZONE_LAYERS = [
  "https://services3.arcgis.com/7J7WB6yJX0pYke9q/arcgis/rest/services/UNICEF_Gaza_Warehouse_Map_2026_WFL1/FeatureServer/5",
  "https://services3.arcgis.com/7J7WB6yJX0pYke9q/arcgis/rest/services/UNICEF_Gaza_Strip_Sites_Within_and_Near_Orange_Line/FeatureServer/12",
];
const HELD_DEFAULT = "https://services.arcgis.com/635TEs8sPmgDjkwb/arcgis/rest/services/Yellow_line_updateMay2026/FeatureServer/0";
const UNRWA_SEARCH = "https://www.arcgis.com/sharing/rest/search?q=owner:UNRWA-DSRM%20AND%20type:%22Feature%20Service%22&sortField=modified&sortOrder=desc&num=20&f=json";

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "user-agent": "Mozilla/5.0 (desk)" } });
    return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "Coordination Area" 23 June 2026, Zone 1- 2026_06_23, updateMay2026: the date a map's name gives. */
export function dateInName(s: string): string | null {
  const t = String(s || "");
  let m = /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d\d)\b/i.exec(t);
  if (m) return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[2].toLowerCase()), +m[1])).toISOString().slice(0, 10);
  m = /\b(20\d\d)[_-](\d\d)[_-](\d\d)\b/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** A layer's polygons as GeoJSON, simplified to about 5 m, with their names; null when it cannot be read. */
async function polygons(layer: string): Promise<{ name: string; geometry: Geometry }[] | null> {
  const j = await getJson(`${layer}/query?where=1%3D1&outFields=*&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.00005&f=geojson`);
  const feats = Array.isArray(j?.features) ? (j!.features as { properties?: Record<string, unknown>; geometry?: Geometry }[]) : null;
  if (!feats) return null;
  return feats
    .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
    .map((f) => ({ name: String(f.properties?.Name ?? f.properties?.name ?? ""), geometry: f.geometry! }));
}

async function lastEdit(layer: string): Promise<string | null> {
  const j = await getJson(`${layer}?f=json`);
  const t = Number((j?.editingInfo as { lastEditDate?: number } | undefined)?.lastEditDate);
  return Number.isFinite(t) && t > 0 ? new Date(t).toISOString().slice(0, 10) : null;
}

function mapped(name: string, by: string, url: string, asOf: string, geometry: Geometry): MappedArea {
  const km2 = Math.round(areaKm2(geometry) * 10) / 10;
  return { name, by, url, asOf, km2, share: Math.round((km2 / GAZA_KM2) * 1000) / 10, geometry };
}

/** The UN's coordination area: the newest one the UNICEF layers carry. */
async function readZone(): Promise<MappedArea | null> {
  let best: MappedArea | null = null;
  for (const layer of ZONE_LAYERS) {
    for (const p of (await polygons(layer)) ?? []) {
      if (!/coordination area/i.test(p.name)) continue;
      const asOf = dateInName(p.name) ?? (await lastEdit(layer));
      if (!asOf || (best && best.asOf >= asOf)) continue;
      best = mapped("The UN's coordination area (behind the yellow and orange lines)", "UN DSS, via UNICEF", layer, asOf, p.geometry);
    }
  }
  return best;
}

/** Behind the yellow line: UNRWA's newest yellow-line layer, else the May 2026 one. */
async function readHeld(): Promise<MappedArea | null> {
  const s = await getJson(UNRWA_SEARCH);
  const items = (Array.isArray(s?.results) ? s!.results : []) as { title?: string; url?: string; modified?: number }[];
  const found = items.filter((i) => /yellow/i.test(i.title ?? "") && i.url).map((i) => `${i.url}/0`);
  let best: MappedArea | null = null;
  for (const layer of [...new Set([...found, HELD_DEFAULT])]) {
    const polys = (await polygons(layer)) ?? [];
    // The biggest polygon is the area itself (a layer may carry small zones beside it); a line or a
    // band between the lines is not the area.
    const big = polys.map((p) => ({ ...p, km2: areaKm2(p.geometry) })).sort((a, b) => b.km2 - a.km2)[0];
    if (!big || big.km2 < 150) continue;
    // UNRWA names its layers by month only ("updateMay2026"): the day it last edited the layer is the date.
    const asOf = (await lastEdit(layer)) ?? dateInName(big.name);
    if (asOf && (!best || asOf > best.asOf)) best = mapped("Behind the yellow line", "UNRWA", layer, asOf, big.geometry);
  }
  return best;
}

/** The stored maps, read again when 6 hours old. A map that cannot be read keeps the one stored. */
export async function refreshIdfArea(store: Awaited<ReturnType<typeof getStore>>, now = Date.now()): Promise<IdfArea | null> {
  const saved = await store.getJson<IdfArea>(GAZA_AREA_KEY);
  if (saved && now - Date.parse(saved.checkedAt) < EVERY_MS) return saved;
  const [zone, held] = await Promise.all([readZone().catch(() => null), readHeld().catch(() => null)]);
  const keep = (fresh: MappedArea | null, old: MappedArea | null | undefined) => (fresh && (!old || fresh.asOf >= old.asOf) ? fresh : old ?? null);
  const out: IdfArea = { zone: keep(zone, saved?.zone), held: keep(held, saved?.held), checkedAt: new Date(now).toISOString() };
  await store.putJson(GAZA_AREA_KEY, out);
  console.log(`[gaza-line] zone ${out.zone ? `${out.zone.asOf} ${out.zone.share}%` : "none"}, held ${out.held ? `${out.held.asOf} ${out.held.share}%` : "none"}`);
  return out;
}
