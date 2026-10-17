/**
 * The Yemen numbers as stored, checked again on every 6-hour update (17 Oct).
 *
 * Before Round 34 a figure was stored without checking that its cited card
 * states it: eight cells cited one Khabar card that held none of them, and
 * 72 / 125 cited cards without those numbers. The readers now check; this
 * drops what was stored before, so a wrong figure does not wait for a newer
 * one to replace it:
 * - a figure whose cited card is among the cards read and does not state it;
 * - the figures of one battle or one day taken as running counts (by card);
 * - ships of the Iran war stored in the Yemen ledger.
 * Once (RECHECK_ONCE), the last three weeks of cards are read again with the
 * fixed readers, oldest first, so the newest figure stands last.
 */

import { CLAIMS_KEY, type Claims, hasNumber, NOT_RUNNING, refreshClaims, refreshTally, TALLY_KEY, type Tally } from "./tally.ts";
import { LEDGER_KEY, type Ledger, offYemenShip } from "./ledger.ts";
import type { DeskStore } from "./store.ts";
import type { LiveReport } from "./types.ts";

/** Hormuz ships "near the strait" (Reuters, 14 Oct), stored before the Gulf rule. */
const IRAN_WAR_SHIPS = /^2026-10-14-near-the-strait/;

const RECHECK_KEY = "numbers-recheck";
export const RECHECK_ONCE = "2026-10-17";
const DAY = 86_400_000;

const textOf = (r: LiveReport) => `${r.summary || ""}. ${r.text || ""}`;
/** Kept when its card is not among those read (ReliefWeb, older) or states it. */
export function holds(url: string, v: number, byUrl: Map<string, string>): boolean {
  if (NOT_RUNNING.has(url)) return false;
  const t = byUrl.get(url);
  return t === undefined || hasNumber(t, v);
}

/** The tally and the claims without the figures their cards do not bear out. Pure. */
export function dropUnfounded(tally: Tally | null, claims: Claims | null, cards: LiveReport[]): { tally: Tally | null; claims: Claims | null; dropped: string[] } {
  const byUrl = new Map(cards.map((r) => [String(r.url), textOf(r)]));
  const dropped: string[] = [];
  const t = tally ? structuredClone(tally) : null;
  if (t) {
    for (const [field, src] of Object.entries(t.from)) {
      const [group, side] = field.split(".");
      const flat = group === "idp" || group === "refugees";
      const v = flat ? t[group] : (t[group as "killed" | "injured"] as Record<string, number | null>)[side];
      if (v == null || holds(src.url, v, byUrl)) continue;
      dropped.push(`${field} ${v} (${src.name})`);
      if (flat) t[group] = null;
      else (t[group as "killed" | "injured"] as Record<string, number | null>)[side] = null;
      delete t.from[field];
    }
  }
  const c = claims ? structuredClone(claims) : null;
  if (c) {
    for (const [field, sides] of Object.entries(c.fields)) {
      for (const [side, cl] of Object.entries(sides ?? {})) {
        if (!cl || holds(cl.url, cl.value, byUrl)) continue;
        dropped.push(`${field}.${side} ${cl.value} (${cl.name})`);
        delete (sides as Record<string, unknown>)[side];
      }
    }
  }
  return { tally: t, claims: c, dropped };
}

/** The ledger without the Iran war's ships. Pure. */
export function dropIranShips(ledger: Ledger): Ledger | null {
  const off = ledger.ships.filter((s) => IRAN_WAR_SHIPS.test(s.id) || offYemenShip(s.place, ""));
  return off.length ? { ...ledger, ships: ledger.ships.filter((s) => !off.includes(s)) } : null;
}

/** Three weeks of the Yemen desk's cards, newest first. */
async function threeWeeks(store: DeskStore, now: Date): Promise<LiveReport[]> {
  const since = now.getTime() - 21 * DAY;
  const out: LiveReport[] = [];
  let before: string | undefined;
  for (let i = 0; i < 6; i++) {
    const { reports } = await store.recentDesk(1000, before, { events: false, desk: "yemen" });
    const rs = reports as unknown as LiveReport[];
    if (!rs.length) break;
    out.push(...rs);
    before = String(rs[rs.length - 1].at);
    if (Date.parse(before) < since) break;
  }
  return out.filter((r) => Date.parse(String(r.at)) >= since);
}

export async function recheckNumbers(store: DeskStore, recent: LiveReport[], now = new Date()): Promise<void> {
  const done = (await store.getJson<{ once?: string }>(RECHECK_KEY)) ?? {};
  const once = done.once !== RECHECK_ONCE;
  const cards = once ? await threeWeeks(store, now) : recent;
  const { tally, claims, dropped } = dropUnfounded(await store.getJson<Tally>(TALLY_KEY), await store.getJson<Claims>(CLAIMS_KEY), cards);
  if (dropped.length) {
    console.log(`[numbers-recheck] dropped ${dropped.join("; ")}`);
    if (tally) await store.putJson(TALLY_KEY, once ? { ...tally, updatedAt: new Date(now.getTime() - 21 * DAY).toISOString() } : tally);
    if (claims) await store.putJson(CLAIMS_KEY, claims);
  }
  const ledger = await store.getJson<Ledger>(LEDGER_KEY);
  const cleaned = ledger ? dropIranShips(ledger) : null;
  if (cleaned) await store.putJson(LEDGER_KEY, cleaned);
  if (!once) return;
  // Mark it first: a restart halfway must not start the reading again.
  await store.putJson(RECHECK_KEY, { once: RECHECK_ONCE, at: now.toISOString() });
  const sorted = [...cards].sort((a, b) => Date.parse(String(a.at)) - Date.parse(String(b.at)));
  for (let t = now.getTime() - 21 * DAY; t < now.getTime(); t += 3 * DAY) {
    const chunk = sorted.filter((r) => Date.parse(String(r.at)) >= t && Date.parse(String(r.at)) < t + 3 * DAY);
    if (!chunk.length) continue;
    const at = new Date(Math.min(now.getTime(), t + 3 * DAY));
    await refreshTally(store, chunk, at);
    await refreshClaims(store, chunk, at);
  }
  console.log(`[numbers-recheck] read ${sorted.length} cards of three weeks again`);
}
