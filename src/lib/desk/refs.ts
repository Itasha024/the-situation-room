/**
 * Numbered points with references (user, 9 Oct): Latest developments, each
 * Yemen front and each Iran arena are a numbered list, most important first,
 * and each point carries small numbers, as in an academic text, that point to
 * the reports it rests on. The list of those reports (source, date and hour)
 * closes the box; a click on a number opens the report in a pop-up.
 *
 * The writer is given each report with an id ("r12", "t3" for one of Trump's
 * statements) and puts the ids in square brackets after the words they
 * support. Here the ids become the box's own numbers, 1, 2, 3 in order of
 * first use, stored in the text as "[[n]]"; an id the writer made up is dropped.
 */

import { isAggregator } from "./credibility.ts";
import { nearness, subjectNation } from "./speaker-press.ts";

/** A report a point rests on: enough for the list and for a pop-up when the page does not hold the card. */
export type Ref = { fp: string; source: string; at: string; url: string; headline: string; body?: string; trump?: boolean; lean?: string; excl?: true };

/**
 * Which of several reports of one fact the point cites (user, 9 Oct: three
 * numbers for one Trump post, "only one number, the most official, credible
 * and full"): the speaker's or the country's own account first (Truth Social
 * for Trump, the US Treasury for its sanctions, the IDF for Israel's army),
 * then its state agency and its own outlets, then a wire; an aggregator last;
 * the fuller report breaks a tie.
 */
export function refRank(ref: Ref, point: string): number {
  if (ref.trump) return /\bTrump\b/i.test(point) ? 100 : 20;
  if (isAggregator(ref.source)) return 0;
  const near = nearness(ref.source, subjectNation(point), ref.lean ?? "");
  return near * 4 + Math.min(3, (ref.headline.length + (ref.body?.length ?? 0)) / 150);
}

/** The writer's marks: "[r3]", "[r3, r7]", "[r3][t1]". */
const ID_MARK = /\s*\[((?:[rt]\d+)(?:\s*[,;]\s*[rt]?\d+)*)\]/gi;
/** The box's own marks, as stored. */
export const NUM_MARK = /\[\[(\d+)\]\]/g;

/** The writer's points (a list, or lines of a string) as plain strings. */
export function pointList(raw: unknown): string[] {
  const xs = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/\n+/) : [];
  return xs
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && "text" in x ? String((x as { text: unknown }).text ?? "") : ""))
    .map((x) => x.replace(/^\s*(?:\d+[.)]|[-•*])\s+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * The points with the writer's ids turned into the box's numbers, and the
 * list of references those numbers stand for. A point left with no words is dropped.
 */
export function numberRefs(points: string[], refOf: (id: string) => Ref | null | undefined): { points: string[]; refs: Ref[] } {
  const refs: Ref[] = [];
  const numOf = new Map<string, number>();
  const out: string[] = [];
  for (const raw of points) {
    // Marks side by side are one group: "[r1][r2][r3]" is "[r1, r2, r3]".
    const p = raw.replace(/\]\s*\[(?=[rt]\d)/gi, ", ");
    // Two references a point at most, one for each fact it joins (user, 9 Oct).
    let left = 2;
    const text = p.replace(ID_MARK, (_m, list: string) => {
      const ids = list.split(/\s*[,;]\s*/).map((x, i, all) => (/^\d+$/.test(x) ? `${(all[0].match(/^[rt]/i) || ["r"])[0]}${x}` : x).toLowerCase());
      // Several reports of one fact: the best one only.
      const known = ids.map((id) => refOf(id)).filter((r): r is Ref => !!r);
      const best = known.reduce<Ref | null>((a, r) => (!a || refRank(r, raw) > refRank(a, raw) ? r : a), null);
      let marks = "";
      for (const ref of best ? [best] : []) {
        if (left <= 0) continue;
        left -= 1;
        const key = ref.fp;
        let n = numOf.get(key);
        if (n === undefined) {
          refs.push(ref);
          n = refs.length;
          numOf.set(key, n);
        }
        if (!marks.includes(`[[${n}]]`)) marks += `[[${n}]]`;
      }
      return marks;
    });
    // A mark the writer put after the full stop moves before it, as every other one is.
    const tidy = text.replace(/([.!?])((?:\[\[\d+\]\])+)\s*$/, "$2$1").replace(/\s+([.,;:!?])/g, "$1").trim();
    if (stripRefs(tidy).length >= 3) out.push(tidy);
  }
  return { points: out, refs };
}

/** The text without its reference marks: for the places, the map and the next writer. */
export function stripRefs(text: string): string {
  return String(text || "").replace(NUM_MARK, "").replace(ID_MARK, "").replace(/\s+([.,;:!?])/g, "$1").replace(/[ \t]+/g, " ").trim();
}

/** A card as a reference. */
export function refOfReport(r: { fp: string; source: string; at: string; url: string; summary: string; lean?: string; flags?: string[] }): Ref {
  const lean = String(r.lean || "");
  const excl = Array.isArray(r.flags) && r.flags.includes("exclusive");
  return { fp: String(r.fp), source: String(r.source || ""), at: String(r.at || ""), url: String(r.url || ""), headline: String(r.summary || ""), ...(lean ? { lean } : {}), ...(excl ? { excl: true as const } : {}) };
}

/** Headlines as points, each with its own card as its one reference. */
export function headlinePoints(reports: { fp: string; source: string; at: string; url: string; summary: string }[]): { points: string[]; refs: Ref[] } {
  const refs = reports.map(refOfReport);
  return { points: refs.map((r, i) => `${r.headline.trim().replace(/[.\s]+$/, "")}[[${i + 1}]].`), refs };
}
