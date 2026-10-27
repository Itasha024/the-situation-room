/**
 * One order of importance for every desk's brief points (user, 27 Oct: "brief should be the most important
 * reports only, and ordered from 01 the most important down to the least … in the all desks brief but also in
 * each desk's brief"). The All page took each desk's points in turn, so a drone over Jabalia stood sixth, above
 * the Yemen and Iran desks' second points. Server-only.
 *
 * Whenever a desk's brief changes, one call ranks all the desks' points together, names the ones not worth a
 * brief, and fixes a point's tense ("Israeli forces conduct explosions" → "conducted"). The desks' briefs are
 * served in that order (routes/api/brief.ts), and the All page's brief is its first points.
 */

import { askChain, type ChainModel } from "./models.ts";
import { BRIEF_KEY, type StoredBrief } from "./brief-store.ts";
import { IRAN_BRIEF_KEY, type IranBrief } from "./iran-brief.ts";
import { GAZA_BRIEF_KEY, type GazaBrief } from "./gaza-brief.ts";
import type { DeskStore } from "./store.ts";
import { band } from "./rank-points.ts";

export const ALL_BRIEF_KEY = "brief:all";
/** The All page's brief: at most this many points. */
export const ALL_MAX = 10;
export type BriefDesk = "iran" | "yemen" | "gaza";
export type AllBrief = {
  /** The three briefs it was made from, by their update times. */
  key: string;
  updatedAt: string;
  /** Every point, most important first, as desk and its index in that desk's points. */
  rank: { desk: BriefDesk; i: number }[];
  /** Points not worth a brief. */
  cut: { desk: BriefDesk; i: number }[];
  /** The points it ranked, so a desk's brief changed since is served in its own order. */
  points: Record<BriefDesk, string[]>;
  /** A point's words, its tense or grammar fixed: "desk:i" to the text, its [[n]] marks kept. */
  fixed: Record<string, string>;
  model?: string;
};

// Gemini first: Nemotron listed the desks one after another on the first night (27 Oct), Iran's points last.
const RANKERS: ChainModel[] = [
  { provider: "gemini", id: "gemini-3.8-flash" },
  { provider: "groq", id: "openai/gpt-oss-120b" },
  { provider: "nvidia", id: "nvidia/nemotron-3-ultra-550b-a55b" },
  { provider: "gemini", id: "gemini-3.5-flash-lite" },
  { provider: "gemini", id: "gemini-3.1-flash-lite" },
];

const SYSTEM = `You are the chief editor of a live news site with three desks: Iran (Israel, the US, Iran and its allies, Lebanon, Iraq, the Gulf), Yemen (the Houthis, the government, the Saudi-led coalition, the Red Sea) and Gaza (Gaza, Judea and Samaria).
You get every point of the three desks' briefs, each as: [its id] (its desk) text.
1. "scores": every id with its importance from 1 to 10, judged against all desks' points alike, never by desk. Importance is what changes the war and the region the most:
   - 8-10: deaths in numbers, a senior commander killed, strikes and missiles on states, capitals, energy sites and shipping, a ship hit or seized, a front's line moving, decisions on war or peace (a ceasefire, talks, a deal, a blockade, sanctions), a leader's own new decision or threat of war;
   - 5-7: other attacks with dead or wounded, ground fighting, major diplomatic moves and meetings of leaders;
   - 1-4: arrests and raids with no one hurt, words with no act, reactions, condemnations, features.
2. "cut": the ids not worth a brief at all: a drone or aircraft seen overhead with nothing hit, a routine raid or arrest, a road closed, a feature or human-interest story (community kitchens, a family's story), a condemnation or a statement with nothing new, a repeat of another point. Never cut a point with a death, a strike on a state or a decision.
3. "fixed": only for a point whose tense or grammar is wrong, its id to the corrected text. A brief tells what happened: past tense ("Israeli forces conduct explosions" → "Israeli forces conducted explosions"); what a speaker said keeps its "Speaker: …" form. Change nothing else: same words, same facts, every [[n]] mark kept where it was.
Answer with JSON only: {"scores":{"y2":9,"i1":8,…},"cut":["g3",…],"fixed":{"i4":"…"}}`;

/** The three briefs' points, as the desks store them. */
export async function briefPoints(store: DeskStore): Promise<{ key: string; points: Record<BriefDesk, string[]> }> {
  const yb = (await store.getJson<StoredBrief>(BRIEF_KEY).catch(() => null))?.brief ?? null;
  const ib = await store.getJson<IranBrief>(IRAN_BRIEF_KEY).catch(() => null);
  const gb = await store.getJson<GazaBrief>(GAZA_BRIEF_KEY).catch(() => null);
  const pts = (b: { situation?: { points?: string[] } } | null) => (Array.isArray(b?.situation?.points) ? b!.situation!.points!.map(String) : []);
  const points = { iran: pts(ib), yemen: pts(yb), gaza: pts(gb) };
  // The points themselves, not the update times: a brief stored again with the same points needs no new order.
  const key = JSON.stringify(points);
  return { key: String(hash(key)), points };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

const LETTER: Record<BriefDesk, string> = { iran: "i", yemen: "y", gaza: "g" };
const DESK_OF: Record<string, BriefDesk> = { i: "iran", y: "yemen", g: "gaza" };
const marks = (t: string) => (t.match(/\[\[\d+\]\]/g) ?? []).join(",");
const wordsOf = (t: string) => new Set(t.toLowerCase().replace(/\[\[\d+\]\]/g, "").match(/[a-z0-9'-]+/g) ?? []);

/** A model's fixed text is kept only when it is the same point: its marks, and nearly all its words. */
export function sameWording(was: string, now: string): boolean {
  if (!now || marks(was) !== marks(now)) return false;
  const A = wordsOf(was), B = wordsOf(now);
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return Math.abs(A.size - B.size) <= 3 && n >= A.size - 3;
}

/** The model's answer as an order: unknown ids out, every point placed (the ones it left out last, in desk order). */
export function readRanking(json: Record<string, unknown>, points: Record<BriefDesk, string[]>): Pick<AllBrief, "rank" | "cut" | "fixed"> {
  const all = (Object.keys(points) as BriefDesk[]).flatMap((d) => points[d].map((_, i) => `${LETTER[d]}${i + 1}`));
  const known = new Set(all);
  const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim().toLowerCase()).filter((x) => known.has(x)) : []);
  // Each point's score (1-10), the writers' bands breaking ties; an order given instead is read as one.
  const sc = json.scores && typeof json.scores === "object" ? (json.scores as Record<string, unknown>) : {};
  const scoreOf = new Map(Object.entries(sc).map(([k, v]) => [k.trim().toLowerCase(), Number(v)]).filter(([k, v]) => known.has(k as string) && Number.isFinite(v)) as [string, number][]);
  const listed = ids(json.rank);
  const textOf = (id: string) => points[DESK_OF[id[0]]][Number(id.slice(1)) - 1];
  const fallback = (id: string) => (listed.includes(id) ? 10 - (listed.indexOf(id) * 9) / Math.max(1, listed.length) : 6 - band(textOf(id)));
  // Words alone never outrank an act (27 Oct: two points of Iran's UN envoy's speech above Gaza's dead): a point of
  // someone's words is held to 5, one with no new fact to 2, a meeting or a price to 6 (rank-points.ts's bands).
  const CAP = [10, 10, 6, 5, 2];
  const score = (id: string) => Math.min(scoreOf.get(id) ?? fallback(id), CAP[band(textOf(id))] ?? 10, wordsOnly(textOf(id)) ? 5 : 10);
  const ranked = [...all].sort((a, b) => score(b) - score(a) || band(textOf(a)) - band(textOf(b)) || all.indexOf(a) - all.indexOf(b));
  const of = (id: string) => ({ desk: DESK_OF[id[0]], i: Number(id.slice(1)) - 1 });
  const fixed: Record<string, string> = {};
  const f = json.fixed && typeof json.fixed === "object" ? (json.fixed as Record<string, unknown>) : {};
  for (const [id, t] of Object.entries(f)) {
    const k = id.trim().toLowerCase();
    if (!known.has(k) || typeof t !== "string") continue;
    const { desk, i } = of(k);
    if (sameWording(points[desk][i], t.trim())) fixed[`${desk}:${i}`] = t.trim();
  }
  return { rank: ranked.map(of), cut: [...new Set(ids(json.cut))].map(of), fixed };
}

/** A speech told as a speech ("Darazi tells the Security Council …", "X: …"): its first sentence has no deed of its speaker's. */
export function wordsOnly(point: string): boolean {
  const first = point.replace(/\s*\[\[\d+\]\]/g, "").split(/(?<=\.)\s/)[0];
  const said = /^[^:]{2,70}:\s/.test(first) || /^[^,;]{0,90}?\b(?:tells?|told|says?|said|warn(?:s|ed)|urg(?:es|ed)|calls? (?:on|for)|called (?:on|for)|accus(?:es|ed)|demand(?:s|ed))\b/i.test(first);
  return said && !/\b(?:killed|struck|seized|launched|fired|shot down|captured|intercepted|sank|says it (?:struck|killed|hit|seized|launched))\b/i.test(first);
}

let running: Promise<void> | null = null;

/** Rank the desks' points again when any desk's brief has changed. Safe to call every tick. */
export function refreshAllBrief(store: DeskStore): Promise<void> {
  running ??= (async () => {
    try {
      const { key, points } = await briefPoints(store);
      const had = await store.getJson<AllBrief>(ALL_BRIEF_KEY).catch(() => null);
      if (had?.key === key) return;
      // The desks' points taken in turn, so no desk reads as first or last.
      const lines: string[] = [];
      const desks = Object.keys(points) as BriefDesk[];
      for (let i = 0; desks.some((d) => points[d][i] !== undefined); i++) for (const d of desks) if (points[d][i] !== undefined) lines.push(`[${LETTER[d]}${i + 1}] (${d}) ${points[d][i]}`);
      if (!lines.length) return;
      const answer = await askChain("all-brief", SYSTEM, lines.join("\n"), { models: RANKERS, timeoutMs: 60_000, accept: (j) => (j.scores && typeof j.scores === "object" && Object.keys(j.scores).length ? null : "no scores") });
      if (!answer) return;
      await store.putJson(ALL_BRIEF_KEY, { key, updatedAt: new Date().toISOString(), points, ...readRanking(answer.json, points), model: answer.model } satisfies AllBrief);
      console.log(`[all-brief] ranked ${lines.length} points (${answer.model})`);
    } finally {
      running = null;
    }
  })();
  return running;
}

/**
 * One desk's points in the site's order (its own order when no ranking fits): the ones not worth a brief
 * dropped while at least two stay, the fixed words in. Each point keeps its own [[n]] marks, so the refs hold.
 */
export function rankedDesk(desk: BriefDesk, points: string[], all: AllBrief | null): string[] {
  if (!all || !sameList(points, all.points?.[desk] ?? [])) return points;
  const cut = new Set(all.cut.filter((x) => x.desk === desk).map((x) => x.i));
  const order = all.rank.filter((x) => x.desk === desk && x.i < points.length).map((x) => x.i);
  for (let i = 0; i < points.length; i++) if (!order.includes(i)) order.push(i);
  return twoAtLeast(order, (i) => !cut.has(i)).map((i) => all.fixed[`${desk}:${i}`] ?? points[i]);
}

/** The items kept, topped up from the rest in order until two stand (or all there are). */
function twoAtLeast<T>(order: T[], keep: (x: T) => boolean): T[] {
  const kept = new Set(order.filter(keep));
  for (const x of order) if (kept.size < 2) kept.add(x);
  return order.filter((x) => kept.has(x));
}

/** The ranking was made from these very points. */
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((p, i) => p === b[i]);

/** The All page's brief: the most important points of every desk, the ones not worth a brief left out. */
export function allBriefPoints(all: AllBrief | null): { desk: BriefDesk; i: number; text: string }[] {
  if (!all?.points) return [];
  const points = all.points;
  const cut = new Set(all.cut.map((x) => `${x.desk}:${x.i}`));
  return all.rank
    .filter((x) => x.i < (points[x.desk]?.length ?? 0) && !cut.has(`${x.desk}:${x.i}`))
    .slice(0, ALL_MAX)
    .map((x) => ({ ...x, text: all.fixed[`${x.desk}:${x.i}`] ?? points[x.desk][x.i] }));
}

/**
 * A desk's part-list (the Gaza desk's Gaza and Judea and Samaria lists) in the same order: each point found in
 * the ranked points by its words, the ones not worth a brief out while two stay. A point not found keeps its place.
 */
export function rankedPart(desk: BriefDesk, points: string[], all: AllBrief | null): string[] {
  const ranked = all?.points?.[desk];
  if (!all || !ranked?.length) return points;
  const bare = (p: string) => p.replace(/\s*\[\[\d+\]\]/g, "").replace(/\s*\[[a-z]?\d+\]/gi, "").trim();
  const at = new Map(ranked.map((p, i) => [bare(p), i]));
  const pos = new Map(all.rank.filter((x) => x.desk === desk).map((x, n) => [x.i, n]));
  const cut = new Set(all.cut.filter((x) => x.desk === desk).map((x) => x.i));
  const rows = points.map((p, j) => ({ p, j, i: at.get(bare(p)) }));
  const order = [...rows].sort((a, b) => (a.i === undefined || b.i === undefined ? a.j - b.j : (pos.get(a.i) ?? a.j) - (pos.get(b.i) ?? b.j)));
  return twoAtLeast(order, (r) => r.i === undefined || !cut.has(r.i)).map((r) => r.p);
}
