/**
 * The fallback for places the gazetteer does not list. The gazetteer is a
 * fixed list, so a strike on a village or district outside it (al-Dhaher,
 * Haydan) got no pin. Such a target is looked up on OpenStreetMap's Nominatim.
 * Server-only.
 *
 *   grounded   only a target the source text itself contains is looked up
 *   bounded    Yemen and Saudi Arabia only; when the text names a governorate
 *              the gazetteer knows, the answer must lie near it
 *   polite     Nominatim's policy: at most one request a second, an
 *              identifying user agent, and every answer (found or not) cached
 *              for good so a name is never asked twice
 */

import { anglicise } from "./anglicise.ts";
import { type Place, placesIn } from "./gazetteer.ts";
import type { DeskStore } from "./store.ts";

// v2: English names from namedetails; v1 held raw transliterations.
const CACHE_KEY = "geocode-cache-v2";
const UA = "yemen-war-desk/1.0 (+https://yemen-war-desk.vercel.app)";
/** Lookups per tick, at one a second, so a busy tick stays short. */
export const GEOCODE_BUDGET = 10;
/** How far from the governorate the text names an answer may lie. */
const NEAR_KM = 130;
/** Without a governorate, all answers must agree to within this. */
const AGREE_KM = 40;

export type GeoHit = { name: string; lat: number; lng: number };
type Cached = GeoHit | { miss: true };

type NominatimRow = { lat: string; lon: string; name?: string; display_name?: string; namedetails?: Record<string, string> };

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * Pick the answer that fits, or none. Pure, so the rule is testable: near the
 * named governorate when there is one; otherwise only an unambiguous answer.
 */
export function pickHit(rows: NominatimRow[], near: Place | undefined): GeoHit | null {
  const pts = rows
    .map((x) => ({ lat: Number(x.lat), lng: Number(x.lon), name: String(x.namedetails?.["name:en"] || x.name || x.display_name || "").split(",")[0].trim() }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.name);
  if (!pts.length) return null;
  const chosen = near
    ? pts.find((p) => km(p, near) <= NEAR_KM)
    : pts.every((p) => km(p, pts[0]) <= AGREE_KM)
      ? pts[0]
      : undefined;
  if (!chosen) return null;
  return { name: anglicise(chosen.name), lat: chosen.lat, lng: chosen.lng };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nominatim(q: string): Promise<NominatimRow[] | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&namedetails=1&countrycodes=ye,sa&accept-language=en&q=" +
    encodeURIComponent(q);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as NominatimRow[];
  } catch {
    return null;
  }
}

/** The kind word a text puts before a place name ("مديرية الظاهر"). */
const KIND_PREFIX = /^(?:مديرية|مديريه|محافظة|محافظه|مدينة|مدينه|منطقة|منطقه|قرية|قريه|جبهة|جبهه)\s+/;

/** Words the model sometimes returns as a "target" that name no place. */
const GENERIC = /^(?:مواقع|موقع|تحصينات|مناطق|منطقة|تجمعات|مواقع و|أهداف|هدف|مدنيين|منازل|مزارع|أحياء|قرى)(?:\s|$)/;

export type NeedsPlace = { targets: string[]; sourceText: string; apply: (hit: GeoHit) => void };

/** Look up the first groundable target of each job, within the tick's budget. */
export async function geocodeJobs(store: DeskStore, jobs: NeedsPlace[]): Promise<number> {
  if (!jobs.length) return 0;
  const cache = (await store.getJson<Record<string, Cached>>(CACHE_KEY)) ?? {};
  let asked = 0;
  let placed = 0;
  let dirty = false;
  for (const job of jobs) {
    const near = placesIn(job.sourceText).find((p) => p.kind === "governorate");
    for (const raw of job.targets) {
      const target = String(raw || "").trim();
      if (target.length < 2 || !job.sourceText.includes(target)) continue;
      const bare = target.replace(KIND_PREFIX, "");
      // A place the gazetteer knows was left unpinned for a reason (unclear
      // roles, not in the text); and "positions", "areas" are not places.
      if (placesIn(bare).length || GENERIC.test(bare)) continue;
      const key = `${bare}|${near?.name ?? ""}`;
      let hit = cache[key];
      if (!hit) {
        if (asked >= GEOCODE_BUDGET) continue;
        if (asked) await sleep(1100);
        asked += 1;
        const rows = await nominatim(near ? `${bare}, ${near.name}` : bare);
        if (!rows) continue; // A failed request is not an answer; asked again later.
        let found = pickHit(rows, near);
        if (!found && near) {
          // "الظاهر, Saada" can miss where the bare name finds it near Saada.
          if (asked >= GEOCODE_BUDGET) continue;
          await sleep(1100);
          asked += 1;
          const again = await nominatim(bare);
          if (!again) continue;
          found = pickHit(again, near);
        }
        hit = found ?? { miss: true };
        cache[key] = hit;
        dirty = true;
      }
      if ("miss" in hit) continue;
      job.apply(hit);
      placed += 1;
      break;
    }
  }
  if (dirty) await store.putJson(CACHE_KEY, cache);
  return placed;
}
