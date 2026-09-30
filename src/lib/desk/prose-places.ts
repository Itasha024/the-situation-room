/**
 * Where each place the 6-hour prose names lies. Server-only.
 *
 * The page links every place in "Latest developments" and the fronts to its
 * own spot on the map, however small ("Jabal al-Bazilah", "Al-Aghbarah"). The
 * page knows the governorates, the districts and a short list of towns; the
 * rest are found here, once, when the prose is written:
 *
 *   1. a card of the desk's own that was pinned there (its place and spot);
 *   2. the gazetteer;
 *   3. OpenStreetMap (Nominatim, Yemen and Saudi Arabia only, inside the
 *      governorate the sentence names, answers cached for good).
 *
 * The answer goes out with the brief as `places`: name -> [lat, lng].
 */

import { governorateAt } from "./adm1.ts";
import { ADM2 } from "./adm2-centres.ts";
import { type Place, placesIn } from "./gazetteer.ts";
import { pickHit } from "./geocode.ts";
import { PEOPLE } from "./spelling.ts";
import type { DeskStore } from "./store.ts";
import type { LiveReport } from "./types.ts";

const CACHE_KEY = "geocode-cache-v4";
const UA = "yemen-war-desk/1.0 (+https://thesituationroom.live)";
/** OpenStreetMap asks per brief: at one a second, a few seconds at most. */
const OSM_BUDGET = 10;

/** A name as a key: no article, no apostrophes or spaces, doubled letters once, "iy" as "y". */
export function placeKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(?:al|el|as|ash|ad|adh|ar|at|ath|az|an)[- ]/, "")
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/iy/g, "y")
    .replace(/ou/g, "u")
    .replace(/ee/g, "i")
    .replace(/h$/, "");
}

/** Words that begin with a capital and name no place. */
const NOT_PLACE = new Set(
  (
    "the a an houthi houthis saudi saudis arabia yemen yemeni yemenis government governments forces force giants brigades brigade " +
    "national resistance southern transitional council presidential leadership international organization organisation migration " +
    "united nations un us u.s american americans iran iranian israel israeli red sea gulf coalition ministry minister president " +
    "leader army armed security belt shield peninsula islah stc who iom unicef ocha wfp unhcr trump rubio european eu " +
    "january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday " +
    "pro while meanwhile however government-aligned houthi-aligned also both separately elsewhere earlier later today tonight " +
    "jabal wadi mount mountain mountains district districts governorate province region city town port front fronts area areas " +
    "north south east west northern eastern western central"
  ).split(" "),
);
const WHEN =
  "January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday";
const PEOPLE_KEYS = new Set(
  PEOPLE.flatMap((p) => p.en.split(/[\s-]+/))
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 4 && !NOT_PLACE.has(w)),
);

/** Words before a place: "in Taiz", "towards Al-Aghbarah", "Taiz and Lahj". */
const BEFORE = /(?:\b(?:in|on|at|near|around|outside|inside|towards?|into|from|across|over|of|between|and|off|via|through|to|past|overlooking)|,)\s*$/i;
/** Words after a place: "the Kahbub front", "Lahj district". */
const AFTER = /^\s*(?:front|fronts|district|governorate|province|region|mountains?|heights|area|city|town|port|island|islands|valley|axis|border|coast|strait|airport|base|camp|junction|road)\b/i;
const PHRASE =
  /(?:\b(?:Jabal|Jebel|Mount|Wadi|Ras|Bab|Bani|Beit|Bayt|Bir|Dar|Ain|Khor|Wadi|Hisn)\s+)?(?:\b(?:[Aa]l|[Ee]l|[Aa][dsrtzn]h?)-)?\b[A-Z][A-Za-z'’]+(?:[- ](?:(?:al|el|ad|as|ash|ar|at|az|an|wa|bin|bani)[- ])?(?:[Aa]l-)?[A-Z][A-Za-z'’]+)*/g;

/** The place names a paragraph of prose names, in order. */
export function placeNamesIn(text: string): string[] {
  const out: string[] = [];
  const t = String(text || "");
  for (const m of t.matchAll(PHRASE)) {
    const name = m[0].replace(/[’]/g, "'").trim();
    const words = name.split(/[\s-]+/).map((w) => w.toLowerCase().replace(/'s$/, ""));
    if (words.every((w) => NOT_PLACE.has(w) || w === "al")) continue;
    if (words.some((w) => PEOPLE_KEYS.has(w)) && !/^(?:Jabal|Wadi|Mount)\b/.test(name)) continue;
    // "Houthi forces", "Saudi Arabia": a leading word that names no place drops.
    // A month or a day never starts a place: "September as Saudi Arabia" was one.
    const trimmed = name
      .replace(new RegExp(`^(?:(?:${WHEN})(?:[- ](?:al|el|as|ash|ad|ar|at|az|an|wa)\\b)?[- ]*)+`, "i"), "")
      .replace(/^(?:(?:Houthi|Saudi|Yemeni|Government|Pro-government|Southern|National|Giants|Iranian|US|UN)\s+)+/i, "");    if (!trimmed || NOT_PLACE.has(trimmed.toLowerCase())) continue;
    const before = t.slice(Math.max(0, (m.index ?? 0) - 16), m.index);
    const after = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 14);
    const shaped = /^(?:Jabal|Jebel|Mount|Wadi)\b/.test(trimmed);
    if (!shaped && !BEFORE.test(before) && !AFTER.test(after)) continue;
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/**
 * A district's centre by its name, inside the governorate the sentence names;
 * with no governorate named, only a name no other district shares.
 */
export function districtAt(key: string, home: string | null): [number, number] | null {
  const hits = ADM2.filter((d) => placeKey(d.name) === key && (!home || d.gov === home));
  return hits.length === 1 ? [hits[0].lat, hits[0].lng] : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nominatim(q: string): Promise<Parameters<typeof pickHit>[0] | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&namedetails=1&countrycodes=ye,sa&accept-language=en&q=" +
    encodeURIComponent(q);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    return (await res.json()) as Parameters<typeof pickHit>[0];
  } catch {
    return null;
  }
}

// Speaking of a place in Saudi Arabia, not of Saudi jets over Yemen.
const SAUDI_WORD =
  /\b(?:in|inside|into|on|across|at|southern|south of|north of)\s+(?:the\s+)?(?:Saudi Arabia|kingdom)\b|\bSaudi (?:border|territory|soil|city|cities|province|region|town|village|facility|facilities|refinery|port|airport)\b/i;

type Cached = { name: string; lat: number; lng: number } | { miss: true };

/** Every place the texts name, with where it lies; a place not found is left out. */
export async function placeProse(store: DeskStore, texts: string[], reports: LiveReport[]): Promise<Record<string, [number, number]>> {
  const out: Record<string, [number, number]> = {};
  // The desk's own pins, by the key of the spot each was pinned at: the first
  // part of its place ("Jabal Qurfan" of "Jabal Qurfan, Taiz"). The later parts
  // only name what holds it, or another place of the report ("Kahbub, Al-Sharirah"
  // is pinned at Kahbub, not at Al-Sharirah).
  const pinned = new Map<string, [number, number]>();
  for (const r of reports) {
    if (!r.place || !Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const k = placeKey(String(r.place).split(",")[0]);
    if (k.length >= 3 && !pinned.has(k)) pinned.set(k, [r.lat as number, r.lng as number]);
  }
  const cache = (await store.getJson<Record<string, Cached>>(CACHE_KEY)) ?? {};
  let asked = 0;
  let dirty = false;
  for (const text of texts) {
    for (const sentence of String(text || "").split(/(?<=[.!?])\s+/)) {
      const near: Place | undefined = placesIn(sentence).find((p) => p.kind === "governorate");
      const home = near ? governorateAt(near.lat, near.lng) : null;
      // A spot outside the governorate the sentence names is not this place.
      const fits = (pt: [number, number]) => !home || governorateAt(pt[0], pt[1]) === home;
      // A spot outside Yemen belongs to this sentence only when it speaks of
      // Saudi Arabia: "Houthi shelling hit Jabal Jarad" is Taiz's Jabal Jarad,
      // never the Saudi mountain of that name (30 Sep, drawn near Riyadh).
      const saudi = SAUDI_WORD.test(sentence) || placesIn(sentence).some((p) => p.country === "Saudi Arabia");
      const inWar = (pt: [number, number]) => Boolean(governorateAt(pt[0], pt[1])) || saudi;
      for (const name of placeNamesIn(sentence)) {
        if (out[name]) continue;
        const k = placeKey(name);
        const bare = placeKey(name.replace(/^(?:Jabal|Jebel|Mount|Wadi)\s+/i, ""));
        const gaz = placesIn(name).find((p) => placeKey(p.name) === k || placeKey(p.name) === bare);
        if (gaz && fits([gaz.lat, gaz.lng])) {
          out[name] = [gaz.lat, gaz.lng];
          continue;
        }
        // A district by its own name, before any card or search: "Majz" is
        // Saada's, not a spot in Marib a card once used.
        const district = districtAt(k, home);
        if (district) {
          out[name] = district;
          continue;
        }
        const own = pinned.get(k) ?? pinned.get(bare);
        if (own && fits(own)) {
          out[name] = own;
          continue;
        }
        // A card that names the place, and no other known spot, and was pinned
        // at a spot of its own (not a whole governorate): "Houthi forces
        // capture Jabal al-Bazilah". A card naming two spots is pinned at one.
        const lower = name.toLowerCase();
        const told = reports.find(
          (r) =>
            Number.isFinite(r.lat) &&
            Number.isFinite(r.lng) &&
            String(r.summary || "").toLowerCase().includes(lower) &&
            !placesIn(String(r.summary || "")).some((p) => p.kind !== "governorate" && placeKey(p.name) !== k && placeKey(p.name) !== bare) &&
            !placesIn(String(r.place || "")).some((p) => p.kind === "governorate" && placeKey(p.name) === placeKey(String(r.place || "").split(",")[0])),
        );
        if (told && fits([told.lat as number, told.lng as number])) {
          out[name] = [told.lat as number, told.lng as number];
          continue;
        }
        const key = `en|${name}|${near?.name ?? ""}`;
        let hit = cache[key];
        if (!hit) {
          if (asked >= OSM_BUDGET) continue;
          if (asked) await sleep(1100);
          asked += 1;
          const rows = await nominatim(name);
          if (!rows) continue;
          hit = pickHit(rows, near) ?? { miss: true };
          // An answer outside Yemen and the Saudi south is no answer for this war's prose.
          if (!("miss" in hit) && !governorateAt(hit.lat, hit.lng) && hit.lat < 16) hit = { miss: true };
          cache[key] = hit;
          dirty = true;
        }
        if (!("miss" in hit) && inWar([hit.lat, hit.lng]) && fits([hit.lat, hit.lng])) out[name] = [hit.lat, hit.lng];
      }
    }
  }
  if (dirty) await store.putJson(CACHE_KEY, cache);
  return out;
}
