/**
 * Which front a report belongs to, by where it happened, not by the words it
 * uses (30 Sep: a Kahbub card that named Taiz was drawn on the Marib and
 * Al-Dhale maps). A front is a governorate, or one of three areas of their
 * own: Saudi Arabia, the Bab al-Mandab strait (Dhubab, Perim and the Lahj
 * coast facing it, with the strait's waters) and the Red Sea coast (Mocha
 * north along the Hodeidah coast, with its waters). A report goes to the front
 * of the district its pin sits in; one pinned only on a governorate, or not
 * at all, goes by the one front its text names, if it names only one.
 */

import { governorateAt } from "./adm1.ts";
import { districtAt } from "./control-live.ts";
import { districtNear } from "./control-proposals.ts";
import type { LiveReport } from "./types.ts";

export type TrackedId = "bab" | "red-sea-coast" | "west-taiz" | "marib" | "dhale" | "lahj" | "jawf" | "saudi-home";

/** The districts of the two coastal areas, left out of their governorates' fronts. */
const AREA_DISTRICTS: Record<string, TrackedId> = {
  dhubab: "bab",
  "al-madaribah-wa-al-aarah": "bab",
  "al-makha": "red-sea-coast",
  "al-khukhah": "red-sea-coast",
  hays: "red-sea-coast",
  "at-tuhayta": "red-sea-coast",
  "ad-durayhimi": "red-sea-coast",
  "al-hawak": "red-sea-coast",
  "al-mina": "red-sea-coast",
  "al-hali": "red-sea-coast",
  "as-salif": "red-sea-coast",
  kamaran: "red-sea-coast",
};

/** Governorates that are a tracked front of their own. */
const GOV_FRONT: Record<string, TrackedId> = {
  "YE-TA": "west-taiz",
  "YE-MA": "marib",
  "YE-DA": "dhale",
  "YE-LA": "lahj",
  "YE-JA": "jawf",
};

/** By name, for a report with no pin of its own. The two areas beat the governorates they sit in. */
const NAMES: [TrackedId, RegExp][] = [
  ["bab", /Bab al-Mandab|Bab el-Mandeb|Kahbub|Mayun|Perim|Dhubab|Ras al-Arah|Al-Arah\b|Madaribah|Mudaribah|Jahannam|Al-Aqrab/i],
  ["red-sea-coast", /Mocha|Al-Makha\b|Khokha|Khawkhah|\bHays\b|Tuhayta|Durayhimi|Hodeidah|Hudaydah|As-Salif|Kamaran|Ras Isa|Hanish/i],
  ["west-taiz", /\bTaiz\b|Wazi'iyah|Mawza|Maqbanah|Sabir|Al-Dharifah|Al-Aghbara|Al-Barh/i],
  ["marib", /\bMarib\b|Wadi Dhanah|\bBalaq\b|Sirwah|Harib|Raghwan|Majzar/i],
  ["dhale", /Al-Dhale|Dhale\b|Murays|Qataba|Damt/i],
  ["lahj", /\bLahj\b|Tuban|Al-Hawtah|Al-Musaymir|Radfan|Tur al-Bahah|Al-Qabbaytah|Karish/i],
  ["jawf", /Al-Jawf|Al-Hazm\b|Yatmah|Al-Lubanat/i],
  ["saudi-home", /Riyadh|Al-Kharj|Jeddah|Mecca|Taif|Abha|Khamis Mushait|Jazan|Jizan|Najran|Asir|Dhahran al-Janub|Al-Tuwal|Al-Khubah|Farasan|Sharurah|Saudi border|border with Saudi|inside Saudi|Saudi territory|the kingdom/i],
];

/** A pin on a governorate or its capital's name says nothing about where inside it. */
const VAGUE = /^(?:Taiz|Lahj|Al-Dhale|Dhale|Marib|Al-Jawf|Jawf|Hodeidah|Yemen|Saudi Arabia|Red Sea|Al-Bayda|Hajjah|Saada|Shabwa|Abyan|Sanaa|Ibb|Dhamar|Hadramawt|Amran)$/i;

/** Saudi Arabia, roughly: north of Yemen's outline, from the Red Sea to the Empty Quarter. */
function inSaudi(lat: number, lng: number): boolean {
  return lat >= 16.3 && lat <= 32.5 && lng >= 34.5 && lng <= 55.7;
}

/** The front of a point: its district's area, its governorate's front, or the waters of the two areas. */
export function trackedAt(lat: number, lng: number): TrackedId | null {
  const gov = governorateAt(lat, lng);
  if (gov) {
    const d = districtAt(lat, lng);
    if (d && AREA_DISTRICTS[d.id]) return AREA_DISTRICTS[d.id];
    return GOV_FRONT[gov] ?? null;
  }
  if (lat >= 11.9 && lat < 13.15 && lng >= 42.9 && lng <= 43.9) return "bab";
  if (lat >= 13.15 && lat < 16.3 && lng >= 41.5 && lng <= 43.3) return "red-sea-coast";
  // A pin on the shore, just outside the simplified outline: its nearest district.
  const near = lat < 16.3 ? districtNear(lat, lng) : null;
  if (near) return AREA_DISTRICTS[near.id] ?? GOV_FRONT[near.gov] ?? null;
  if (inSaudi(lat, lng)) return "saudi-home";
  return null;
}

/** The governorate of a point, with the capital counted as Sanaa governorate: one Sanaa front. */
export function govKey(lat: number, lng: number): string | null {
  const g = governorateAt(lat, lng) ?? (lat < 16.3 ? (districtNear(lat, lng)?.gov ?? null) : null);
  return g === "YE-SA" ? "YE-SN" : g;
}

/** Does the report carry a pin that says where it happened? */
export function pinned(r: LiveReport): boolean {
  return typeof r.lat === "number" && typeof r.lng === "number" && !VAGUE.test(String(r.place || "").trim());
}

/** The one tracked front a report's words name, or null for none or several. */
export function trackedByName(r: LiveReport): TrackedId | null {
  const blob = `${r.place || ""} ${r.summary} ${r.text || ""}`;
  let hit = NAMES.filter(([, re]) => re.test(blob)).map(([id]) => id);
  if (hit.includes("bab") || hit.includes("red-sea-coast")) hit = hit.filter((id) => id !== "west-taiz" && id !== "lahj");
  return hit.length === 1 ? hit[0] : null;
}

/** The tracked front a report belongs to: by its pin, else by the one front its words name. */
export function trackedOf(r: LiveReport): TrackedId | null {
  if (pinned(r)) {
    const at = trackedAt(r.lat as number, r.lng as number);
    if (at || govKey(r.lat as number, r.lng as number)) return at;
  }
  // A governorate-wide pin: the text may name a sharper area inside it.
  const named = trackedByName(r);
  if (named) return named;
  if (typeof r.lat === "number" && typeof r.lng === "number") return trackedAt(r.lat, r.lng);
  return null;
}
