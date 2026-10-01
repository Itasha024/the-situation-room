/**
 * Each source's reliability, 1–5, from its own record (user, 1–2 Oct).
 *
 * Where a source starts: a wire agency or an official body 4, any other
 * non-aligned outlet 3.5, an outlet of either side 3. Then every report it
 * carried since the war began (13 July) scores, once it has been out two days:
 *
 *   5    the other side, a wire agency or an official body also reported it,
 *        or it was later shown true
 *   3.5–4.5  only outlets of its own side did (more of them, more weight;
 *        never below the source's own start)
 *   its start  no one else did: a lone report neither lifts nor lowers it,
 *        since local outlets are often the only ones there
 *   1    it proved false (counted three times)
 *
 * The rating is the start and those scores averaged together, the start
 * standing for ten reports, so a source's record outweighs it once it has
 * more than ten. A statement or diplomacy card is not scored: what people say
 * they said, they said; it counts only when the speaker denies saying it.
 *
 * The groups are three (user, 2 Oct): Houthi-aligned, Government-aligned and
 * non-aligned. Wires, the UN, other countries' bodies and the shipping and
 * energy trackers are non-aligned.
 *
 * Built once a day by `refreshSourceRatings` in the scan tick; the reasons
 * behind a "false" stay on the server and are never shown.
 */

import { isOfficialBody } from "./numbers.ts";
import { deskDay } from "./brief.ts";
import { outletSide as digestSide } from "./digest.ts";
import { outletSide as credSide } from "./credibility.ts";

export type Group = "houthi" | "gov" | "nonaligned";

export const RATINGS_KEY = "source-ratings";
export const VERDICTS_KEY = "verdicts";
/** fp → when a lone report was last compared with later ones (ISO). */
export const LATER_CHECKED_KEY = "later-checked";
/** The war began with the strike on Sanaa airport; the desk counts from then. */
export const RATING_SINCE = "2026-07-13";
/** A report is scored once others have had two days to report it too. */
export const SETTLE_MS = 2 * 86_400_000;
/** The start counts as this many reports. */
const START_WEIGHT = 10;
/** A false report counts this many times. */
const FALSE_WEIGHT = 3;

/** One card, as the rating reads it. */
export type RatedCard = {
  fp: string;
  at: string;
  source: string;
  type?: string;
  summary?: string;
  lat?: number;
  lng?: number;
  also?: { source: string; url?: string }[];
};

/**
 * What the desk found about a card after it ran, kept on the server only.
 *   false           it did not happen, the picture was old, the figure was false
 *   denied          the speaker of a statement denies saying it
 *   confirmed-later a wire, an official body or the other side reported it later
 * `sources` limits a "false" to the outlets that carried the error (default: all on the card).
 */
export type Verdict = {
  verdict: "false" | "denied" | "confirmed-later";
  reason: string;
  /** When the desk found it. */
  at: string;
  sources?: string[];
  /** The card that showed it (a later report's fp). */
  by?: string;
  /** The card itself, kept so a removed card still counts against its outlets. */
  card?: RatedCard;
};
export type Verdicts = Record<string, Verdict>;

export type CatalogueEntry = { name: string; url: string; lean?: string; platform: "Telegram" | "X" | "Website" };

export type SourceRating = { name: string; url: string; platform: string; group: Group; rating: number; start: number; n: number };
export type SourceRatings = { day: string; updatedAt: string; sources: SourceRating[] };

const WIRE = /^(?:Reuters|AP|Associated Press|AFP|Agence France-Presse|Xinhua|Anadolu|dpa|EFE|ANSA|Bloomberg)\b/i;

/**
 * Officials and official bodies: their own words carry their office. A
 * journalist on the same side is not one, whatever they post.
 */
const OFFICIAL =
  /^(?:Yahya Saree|Mohammed Abdulsalam|Yemeni Army (?:spokesman|Media)|Coalition spokesman|Rashad al-Alimi|Muammar al-Eryani|Abu Zaraa al-Mahrami|Abdullah al-Alimi|Shaya al-Zindani|Afrah al-Zouba|Tareq Saleh|Aidarous al-Zubaidi|Hezam al-Asad|Hussein al-Ezzi|Mohammed Ali al-Houthi|Marco Rubio|Ursula von der Leyen|António Guterres|UKMTO|SPA|WAM|Saba(?: \((?:government|Houthi-run)\))?|Southern Transitional Council|National Resistance(?: Political Bureau)?|GCC(?: Secretariat)?|EU|State Department|United Nations|UN(?: in Yemen| OCHA)?|EU in Yemen|European Commission|US (?:Energy Department|Treasury|Embassy Yemen)|Suez Canal Authority|.+ Foreign (?:Ministry|Office))$/i;

/** Placed by hand where the catalogue and the card leans disagree (checked 2 Oct). */
const GROUP_BY_NAME: Record<string, Group> = { gcc: "gov", "gcc secretariat": "gov", "sheba intelligence": "nonaligned" };

export function isWire(name: string): boolean {
  return WIRE.test(String(name || "").trim());
}
export function isOfficial(name: string): boolean {
  const n = String(name || "").trim();
  return OFFICIAL.test(n) || isOfficialBody(n);
}

/** Which of the three groups a source is in: its catalogue lean first, then its name. */
export function groupOf(name: string, lean?: string): Group {
  const fixed = GROUP_BY_NAME[String(name || "").trim().toLowerCase()];
  if (fixed) return fixed;
  const l = String(lean || "").toLowerCase();
  if (l === "houthi") return "houthi";
  if (l === "gov" || l === "south") return "gov";
  if (l === "intl") return "nonaligned";
  const n = String(name || "").trim();
  if (isWire(n)) return "nonaligned";
  const d = digestSide(n);
  if (d === "Houthi-aligned") return "houthi";
  if (d === "Gov/Saudi-aligned") return "gov";
  const c = credSide(n, "");
  if (c === "houthi") return "houthi";
  if (c === "gov") return "gov";
  return "nonaligned";
}

export function startOf(name: string, group: Group): number {
  if (isWire(name) || isOfficial(name)) return 4;
  return group === "nonaligned" ? 3.5 : 3;
}

const STATEMENT = /^(?:statement|diplomacy)$/i;

/**
 * What one report scores for one of the outlets that carried it, or null when
 * it is not scored (a statement, or too new). `groupOfName` names each
 * outlet's group.
 */
export function reportScore(
  card: RatedCard,
  who: string,
  groupOfName: (n: string) => Group,
  verdict: Verdict | undefined,
  now: number,
  start = 3,
): { score: number; weight: number } | null {
  const appliesTo = (v: Verdict) => !v.sources || v.sources.some((s) => same(s, who));
  if (verdict && (verdict.verdict === "false" || verdict.verdict === "denied") && appliesTo(verdict)) return { score: 1, weight: FALSE_WEIGHT };
  if (STATEMENT.test(String(card.type || ""))) return null;
  if (now - Date.parse(card.at) < SETTLE_MS) return null;
  if (verdict?.verdict === "confirmed-later") return { score: 5, weight: 1 };
  const c = confirmation(groupOfName(who), tellers(card).filter((t) => !same(t, who)), groupOfName);
  if (c.confirmed) return { score: 5, weight: 1 };
  if (c.weight) return { score: Math.max(start, Math.min(4.5, 3 + 0.5 * c.weight)), weight: 1 };
  return { score: start, weight: 1 };
}

/**
 * Whether the other outlets confirm a report of an outlet in group `mine`,
 * and how many add weight without confirming. A non-aligned paper carrying
 * one side's report mostly passes on that side's claim ("the Houthis said"):
 * it adds weight, it does not confirm. What confirms is the other side, a
 * wire, or a non-aligned official body; for a non-aligned outlet, both sides
 * or a wire.
 */
export function confirmation(mine: Group, others: string[], groupOfName: (n: string) => Group): { confirmed: boolean; weight: number } {
  const sides = new Set<Group>();
  let weight = 0;
  for (const o of others) {
    const g = groupOfName(o);
    if (isWire(o) || (g !== mine && isOfficial(o) && g === "nonaligned")) return { confirmed: true, weight };
    if (mine !== "nonaligned" && g !== mine && g !== "nonaligned") return { confirmed: true, weight };
    if (g !== "nonaligned") sides.add(g);
    weight++;
  }
  return { confirmed: mine === "nonaligned" && sides.size >= 2, weight };
}

/** Every outlet that carried a card, once each: the lead and its "Also". */
export function tellers(card: RatedCard): string[] {
  const out: string[] = [];
  for (const n of [card.source, ...(card.also ?? []).map((a) => a.source)]) {
    const s = String(n || "").trim();
    if (s && !out.some((o) => same(o, s))) out.push(s);
  }
  return out;
}

const norm = (s: string) => String(s || "").toLowerCase().replace(/\s*\(?(?:breaking|houthi-run)\)?$/, "").replace(/[^a-z0-9؀-ۿ]+/g, "");
function same(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

export function blend(start: number, scores: { score: number; weight: number }[]): number {
  let sum = start * START_WEIGHT;
  let w = START_WEIGHT;
  for (const s of scores) {
    sum += s.score * s.weight;
    w += s.weight;
  }
  return Math.round((sum / w) * 10) / 10;
}

/**
 * Every source in the catalogue, rated from the cards. A source the catalogue
 * does not list but that led or carried cards (an original the desk traced,
 * a learned outlet) is rated too.
 */
export function rateSources(cards: RatedCard[], catalogue: CatalogueEntry[], verdicts: Verdicts, now = Date.now()): SourceRating[] {
  const byKey = new Map<string, CatalogueEntry>();
  for (const c of catalogue) if (!byKey.has(norm(c.name))) byKey.set(norm(c.name), c);
  const groupOfName = (n: string) => groupOf(n, byKey.get(norm(n))?.lean);

  const since = Date.parse(RATING_SINCE);
  const scores = new Map<string, { score: number; weight: number }[]>();
  const names = new Map<string, string>();
  // A card removed for being false is gone from the desk; its verdict keeps it.
  const have = new Set(cards.map((c) => c.fp));
  const removed = Object.entries(verdicts).flatMap(([fp, v]) => (v.card && !have.has(fp) ? [{ ...v.card, fp }] : []));
  for (const card of [...cards, ...removed]) {
    if (!(Date.parse(card.at) >= since)) continue;
    for (const who of tellers(card)) {
      const s = reportScore(card, who, groupOfName, verdicts[card.fp], now, startOf(who, groupOfName(who)));
      const k = norm(who);
      if (!names.has(k)) names.set(k, who);
      if (!s) continue;
      scores.set(k, [...(scores.get(k) ?? []), s]);
    }
  }

  const out: SourceRating[] = [];
  const seen = new Set<string>();
  const add = (name: string, url: string, platform: string, lean?: string) => {
    const k = norm(name);
    if (!k || seen.has(k)) return;
    seen.add(k);
    const group = groupOf(name, lean);
    const start = startOf(name, group);
    const sc = scores.get(k) ?? [];
    out.push({ name, url, platform, group, start, rating: blend(start, sc), n: sc.reduce((a, s) => a + s.weight, 0) });
  };
  for (const c of catalogue) if (!DROPPED.has(norm(c.name))) add(c.name, c.url, c.platform, c.lean);
  // Outlets met only on cards: listed once they have a few scored reports.
  for (const [k, name] of names) if (!seen.has(k) && !DROPPED.has(k) && (scores.get(k)?.length ?? 0) >= 3) add(name, "", "");
  return out;
}

/** Sources the desk stopped reading (user, 1 and 2 Oct): their old cards stay, the list leaves them out. */
export const DROPPED_SOURCES = ["Malik al-Rougui", "Fathi bin Lazraq", "Ahmed al-Rbizy", "Ibrahim Asqin", "Yaseen al-Aqlani", "Taha Saleh", "Suhail", "Himmah"];
const DROPPED = new Set(DROPPED_SOURCES.map((n) => norm(n)));

/**
 * The day's ratings, kept in the process for the card trust figure: read from
 * the store at most every six hours (`primeRatings`), never on a card's path.
 */
let cache: { at: number; byName: Map<string, number> } | null = null;
export function useRatings(r: SourceRatings | null, now = Date.now()): void {
  cache = { at: now, byName: new Map((r?.sources ?? []).map((s) => [norm(s.name), Math.round((s.rating - s.start) * 10) / 10])) };
}
export async function primeRatings(store: { getJson<T>(key: string): Promise<T | null> }, now = Date.now()): Promise<void> {
  if (cache && now - cache.at < 6 * 3_600_000) return;
  useRatings(await store.getJson<SourceRatings>(RATINGS_KEY), now);
}
/** How far an outlet's record has moved it from its start, 0 when not known. */
export function recordOf(name: string): number {
  return cache?.byName.get(norm(name)) ?? 0;
}

/** Due once a day at 00:00 Israel (user, 2 Oct): no ratings yet, or the stored ones are from an earlier day. */
export function ratingsDue(stored: SourceRatings | null, now = new Date()): boolean {
  return !stored || stored.day !== deskDay(now.getTime()).day;
}

/**
 * Pairs worth asking a model about: a card nobody independent carried, and a
 * later card that an independent outlet did, at the same place (25 km) and of
 * the same kind, within a day before to a week after.
 */
export function laterCandidates(
  cards: RatedCard[],
  catalogueLean: (n: string) => string | undefined,
  verdicts: Verdicts,
  now = Date.now(),
  checked: Record<string, string> = {},
  cap = 40,
): { early: RatedCard; later: RatedCard }[] {
  const groupOfName = (n: string) => groupOf(n, catalogueLean(n));
  const placed = cards.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && !STATEMENT.test(String(c.type || "")));
  const out: { early: RatedCard; later: RatedCard }[] = [];
  const since = Math.max(Date.parse(RATING_SINCE), now - 30 * 86_400_000);
  for (const e of placed) {
    const t = Date.parse(e.at);
    // Settled (two days out), not judged already, not asked about in the last three days.
    if (!(t >= since) || now - t < SETTLE_MS || verdicts[e.fp]) continue;
    if (checked[e.fp] && now - Date.parse(checked[e.fp]) < 3 * 86_400_000) continue;
    const g = groupOfName(e.source);
    const mine = tellers(e);
    const before = mine.filter((x) => !same(x, e.source));
    if (confirmation(g, before, groupOfName).confirmed) continue;
    const later = placed.find((l) => {
      if (l.fp === e.fp || l.type !== e.type) return false;
      const dt = Date.parse(l.at) - t;
      if (dt < -86_400_000 || dt > 7 * 86_400_000) return false;
      if (km(e, l) > 25) return false;
      const fresh = tellers(l).filter((x) => !mine.some((y) => same(x, y)));
      return fresh.length > 0 && confirmation(g, [...before, ...fresh], groupOfName).confirmed;
    });
    if (later) out.push({ early: e, later });
    if (out.length >= cap) break;
  }
  return out;
}

function km(a: RatedCard, b: RatedCard): number {
  const r = Math.PI / 180;
  const dLat = ((b.lat as number) - (a.lat as number)) * r;
  const dLng = ((b.lng as number) - (a.lng as number)) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat as number) * r) * Math.cos((b.lat as number) * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Errors the desk found by hand before this record began (30 Sep): satellite
 * pictures of old damage and smoke at Yanbu and Abqaiq, put out as that day's
 * attacks. Every outlet on each card carried the error. Only clear errors are
 * here; a one-sided claim nobody disproved is not one.
 */
const OLD_PICTURE = "a picture of earlier damage or smoke put out as a new attack (30 Sep)";
export const SEED_VERDICTS: Verdicts = {
  "live-t-me-alibk3-37482": { verdict: "false", reason: OLD_PICTURE, at: "2026-09-30T18:00:00Z" },
  "live-t-me-farsna-465511": { verdict: "false", reason: OLD_PICTURE, at: "2026-09-30T18:00:00Z" },
  "live-t-me-irna-1313-457279": { verdict: "false", reason: OLD_PICTURE, at: "2026-09-30T18:00:00Z" },
  "live-t-me-shajab-news-68014": { verdict: "false", reason: OLD_PICTURE, at: "2026-09-30T18:00:00Z" },
};

/** The stored verdicts over the seed: a stored one wins. */
export function withSeed(stored: Verdicts | null): Verdicts {
  return { ...SEED_VERDICTS, ...(stored ?? {}) };
}

/** The groups in the order the Sources list shows them. */
export const GROUP_LABEL: Record<Group, string> = { houthi: "Houthi-aligned", gov: "Government-aligned", nonaligned: "Non-aligned" };
