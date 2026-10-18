/**
 * Rows of the Iran desk's ship and energy lists found wrong when each was
 * checked against its source (18 Oct audit): a row that is no attack, a
 * duplicate, a wrong date, place, attacker or link. Like the Yemen ledger's
 * `wrong` and `fixes` (ledger-baseline.ts): they stand over the researched
 * file and over the stored lists, whoever adds the row again. A row is found
 * by its first cell's date and its second cell's words as they were.
 */

import type { Cell } from "./iran-live.ts";

type Row = [Cell, ...unknown[]];
export type ListFix = {
  list: "Incidents" | "Attacks on energy sites";
  match?: { date: string; site: string };
  /** A row the list missed: added once, unless a row of that day already names the ship or site. */
  add?: Row;
  why: string;
  drop?: boolean;
  set?: Partial<Record<"0" | "1" | "2" | "3" | "4", Cell | string>>;
};

import ENERGY from "./iran-list-fixes.energy.json" with { type: "json" };
import SHIPS from "./iran-list-fixes.ships.json" with { type: "json" };

export const LIST_FIXES: ListFix[] = [
  ...(ENERGY as Omit<ListFix, "list">[]).map((f) => ({ ...f, list: "Attacks on energy sites" as const })),
  ...(SHIPS as Omit<ListFix, "list">[]).map((f) => ({ ...f, list: "Incidents" as const })),
];

/** The list's rows with its fixes made. */
export function fixRows(title: string, rows: Row[], fixes: ListFix[] = LIST_FIXES): Row[] {
  const mine = fixes.filter((f) => f.list === title);
  if (!mine.length) return rows;
  const out: Row[] = [];
  for (const r of rows) {
    const f = mine.find((x) => x.match && String(r[0]?.date) === x.match.date && String(r[1]).trim() === x.match.site.trim());
    if (!f) {
      out.push(r);
      continue;
    }
    if (f.drop) continue;
    const next = [...r] as Row;
    for (const [i, v] of Object.entries(f.set ?? {})) next[Number(i)] = v;
    out.push(next);
  }
  const key = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const f of mine) {
    if (!f.add) continue;
    if (out.some((r) => String(r[0]?.date) === String(f.add![0]?.date) && key(r[1]) === key(f.add![1]))) continue;
    out.push(structuredClone(f.add));
  }
  return out;
}
