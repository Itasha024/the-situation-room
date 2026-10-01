/**
 * The 6-hour brief.
 *
 * The general situation, the front lines and the conflict-in-numbers are the three
 * panels a reader uses to orient. They are rebuilt on a fixed 6-hour cadence —
 * 00:00, 06:00, 12:00 and 18:00 in Yemen (UTC+3) — so the page can state, plainly, when it last
 * refreshed and when it next will. No panel is ever silently stale.
 *
 * What is derived here comes only from what the desk itself logged in the window:
 * counts of reported strikes, ground engagements, alerts and casualty figures.
 * Cumulative tallies attributed to AFP, WHO, IOM and OHCHR stay curated in
 * data.json — the desk does not invent an authority it does not have.
 */

import type { DevMark } from "./prose.ts";
import type { LiveReport } from "../yemen-scan.server.ts";
import { alertCities } from "./copies.ts";
import {
  type FrontCounts,
  type WindowCounts,
  composeFront,
  composeStatus,
  kineticTotal,
} from "./synthesis.ts";
import { num } from "./wire-style.ts";
import { type ExtraFront, inExtraFront, spotsOf, whereOf } from "./new-fronts.ts";
import { govKey, type TrackedId, trackedAt, trackedOf } from "./front-areas.ts";

export const CADENCE_HOURS = 6;

/* ------------------------------------------------------------------ *
 * Window boundaries
 * ------------------------------------------------------------------ */

/** The desk's clock: Israel's, summer time included (it ends on 25 Oct 2026). */
export const DESK_TZ = "Asia/Jerusalem";

function deskParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: DESK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

/** Minutes Israel's clock is ahead of UTC at instant `t` (180 in summer, 120 in winter). */
function deskOffset(t: number): number {
  const { year, month, day, hour, minute } = deskParts(new Date(t));
  return Math.round((Date.UTC(year, month - 1, day, hour % 24, minute) - Math.floor(t / 60_000) * 60_000) / 60_000);
}

/** The instant Israel's clock shows `hour`:00 on that day (hour may run past 23 or below 0). */
function deskInstant(year: number, month: number, day: number, hour: number): number {
  const wall = Date.UTC(year, month - 1, day, hour);
  let t = wall - deskOffset(wall - 3 * 3600_000) * 60_000;
  t = wall - deskOffset(t) * 60_000;
  return t;
}

/** The desk's day ("2026-10-02") at instant `t` and the instant it began (00:00 Israel). */
export function deskDay(t: number): { day: string; startedAt: number } {
  const { year, month, day } = deskParts(new Date(t));
  const p = (n: number) => String(n).padStart(2, "0");
  return { day: `${year}-${p(month)}-${p(day)}`, startedAt: deskInstant(year, month, day, 0) };
}

function deskIso(t: number): string {
  const { year, month, day, hour, minute } = deskParts(new Date(t));
  const off = deskOffset(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}T${p(hour % 24)}:${p(minute)}:00+${p(Math.floor(off / 60))}:${p(off % 60)}`;
}

/**
 * The boundary that has just passed, and the next one: 00, 06, 12 and 18 on
 * Israel's clock, which moves with it when summer time ends (25 Oct).
 */
export function briefWindow(now = new Date()): { updatedAt: string; nextUpdateAt: string; startedAt: string } {
  const { year, month, day, hour } = deskParts(now);
  const slot = Math.floor((hour % 24) / CADENCE_HOURS) * CADENCE_HOURS;
  const at = deskInstant(year, month, day, slot);
  const next = deskInstant(year, month, day, slot + CADENCE_HOURS);
  const start = deskInstant(year, month, day, slot - CADENCE_HOURS);
  return { updatedAt: deskIso(at), nextUpdateAt: deskIso(next), startedAt: deskIso(start) };
}

/* ------------------------------------------------------------------ *
 * Fronts the desk tracks
 * ------------------------------------------------------------------ */

export type FrontId = TrackedId;

const FRONT_STANDING: Record<FrontId, string> = {
  bab: "The strait and the high ground above it carry the shipping lane between the Red Sea and the Gulf of Aden.",
  "red-sea-coast": "The Red Sea coast, from Mocha north to Hodeidah, controls the main import route for the north.",
  "west-taiz": "Taiz is the hinge between the coast and the highlands, and its city has been besieged for a decade.",
  marib: "Marib holds Yemen's main oil and gas infrastructure and the government's northern stronghold.",
  dhale: "Al-Dhale sits astride the road north from Aden to the highlands.",
  lahj: "Lahj covers the approaches to Aden from the north and west.",
  jawf: "Al-Jawf is the northern desert flank, linking Marib to the Saudi border.",
  "saudi-home": "Saudi Arabia is where Houthi missiles and drones, air-defence alerts, fighting on the border and the war's effects at home register inside the kingdom.",
};

/** The fixed fronts, in order: each a governorate, or one of the three areas (front-areas.ts). */
const TRACKED: { id: FrontId; name: string }[] = [
  { id: "bab", name: "Bab al-Mandab" },
  { id: "red-sea-coast", name: "Red Sea coast" },
  { id: "west-taiz", name: "Taiz" },
  { id: "marib", name: "Marib" },
  { id: "dhale", name: "Al-Dhale" },
  { id: "lahj", name: "Lahj" },
  { id: "jawf", name: "Al-Jawf" },
  { id: "saudi-home", name: "Saudi Arabia" },
];

/** Does a tracked front already cover this report? */
export function coveredByTrackedFront(r: LiveReport): boolean {
  return trackedOf(r) !== null;
}

/* ------------------------------------------------------------------ *
 * The brief
 * ------------------------------------------------------------------ */

export type FrontActivity = {
  id: string;
  name: string;
  strikes: number;
  ground: number;
  alerts: number;
  maritime: number;
  killed: number;
  wounded: number;
  /** One sentence of derived activity, or "" when the window was quiet. */
  line: string;
  /** A front opened for a new cluster of fighting (new-fronts.ts): its map spot. */
  extra?: boolean;
  /** Where an opened front is, under its name (the hand-written fronts carry their own). */
  where?: string;
  spot?: [number, number];
  /** A front opened in one governorate from several clusters: a spot for each. */
  spots?: [number, number][];
  /** What happened where on this front, for its animated map (prose.ts DevMark). */
  map?: DevMark[];
  /** When this front last had reports: a front with none this window keeps its last text, marked with this time. */
  lastNewsAt?: string;
};

export type Brief = {
  ok: true;
  cadenceHours: number;
  /** The 6-hour boundary this brief represents. */
  updatedAt: string;
  nextUpdateAt: string;
  /** Start of the window the counts cover. */
  windowStart: string;
  windowLabel: string;
  situation: { line: string; /** The fuller account behind "Read more". */ more?: string; quiet: boolean; /** The model that wrote the prose, when one did. */ model?: string };
  /** Where each place the prose names lies, for the page to light it: name -> [lat, lng] (prose-places.ts). */
  places?: Record<string, [number, number]>;
  /** The main developments that happened at a place, for the animated map; only those found. */
  devMap?: DevMark[];
  /** When the prose was last asked for again because a fallback model wrote it (brief-store.ts). */
  proseTriedAt?: string;
  fronts: FrontActivity[];
  numbers: {
    line: string;
    reports: number;
    strikes: number;
    ground: number;
    alerts: number;
    maritime: number;
    killed: number;
    wounded: number;
  };
};

function intIn(s: string | undefined, re: RegExp): number {
  const m = String(s || "").match(re);
  return m ? Number(m[1]) || 0 : 0;
}

/** Casualty figures the desk actually published in the window, summed. */
function tally(reports: LiveReport[]) {
  let killed = 0;
  let wounded = 0;
  for (const r of reports) {
    const blob = `${r.summary} ${r.text}`;
    killed += intIn(blob, /at least (?:[a-z-]+ )?\b(\d+)\b killed/i) || wordKilled(blob);
    wounded += intIn(blob, /\b(\d+)\b wounded/i) || wordWounded(blob);
  }
  return { killed, wounded };
}

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};

function wordKilled(blob: string): number {
  const m = blob.match(/\b(one|two|three|four|five|six|seven|eight|nine)\b killed/i);
  return m ? WORD_NUM[m[1].toLowerCase()] || 0 : 0;
}
function wordWounded(blob: string): number {
  const m = blob.match(/\b(one|two|three|four|five|six|seven|eight|nine)\b wounded/i);
  return m ? WORD_NUM[m[1].toLowerCase()] || 0 : 0;
}

function plural(n: number, one: string, many = one + "s"): string {
  return `${num(n)} ${n === 1 ? one : many}`;
}

function joinClauses(parts: string[]): string {
  const xs = parts.filter(Boolean);
  if (!xs.length) return "";
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/**
 * Carried between windows so the status can say which way the war is moving.
 * Without it every brief reads as if the conflict began six hours ago.
 */
export type BriefHistory = {
  /** Theatre-wide counts from the previous window. */
  prevWindow?: WindowCounts | null;
  /** Previous-window counts per front id. */
  prevFronts?: Partial<Record<string, WindowCounts>>;
  /** Consecutive windows each front has been active. */
  streaks?: Partial<Record<string, number>>;
  /** Fronts opened for new clusters of fighting. */
  extraFronts?: ExtraFront[];
  /** Control units that changed hands in this window. */
  controlMoves?: { place: string; to: string }[];
};

export function buildBrief(
  reports: LiveReport[],
  now = new Date(),
  history: BriefHistory = {},
): Brief {
  const { prevWindow = null, prevFronts, streaks, controlMoves, extraFronts = [] } = history;
  const { updatedAt, nextUpdateAt, startedAt } = briefWindow(now);
  const start = Date.parse(startedAt);
  const inWindow = reports.filter((r) => {
    const t = Date.parse(r.at);
    return Number.isFinite(t) && t >= start;
  });

  const isAlert = (r: LiveReport) => alertCities(r) !== null;
  const counts = {
    reports: inWindow.length,
    strikes: inWindow.filter((r) => r.type === "strike" && !isAlert(r)).length,
    ground: inWindow.filter((r) => r.type === "combat").length,
    alerts: inWindow.filter(isAlert).length,
    maritime: inWindow.filter((r) => r.type === "vessel" || r.type === "port").length,
  };
  const cas = tally(inWindow);

  const tracked = TRACKED.map(({ id, name }) => ({ id, name, spot: undefined as [number, number] | undefined, spots: undefined as [number, number][] | undefined, has: (r: LiveReport) => trackedOf(r) === id }));
  const opened = extraFronts.map((x) => ({ id: x.id, name: x.name, spot: x.spot, spots: spotsOf(x), where: whereOf(x), has: (r: LiveReport) => inExtraFront(r, x) }));
  const fronts: FrontActivity[] = [...tracked, ...opened].map(({ id, name, spot, spots, has, ...rest }) => {
    const rows = inWindow.filter(has);
    const f: FrontActivity = {
      id,
      name,
      strikes: rows.filter((r) => r.type === "strike" && !isAlert(r)).length,
      ground: rows.filter((r) => r.type === "combat").length,
      alerts: rows.filter(isAlert).length,
      maritime: rows.filter((r) => r.type === "vessel" || r.type === "port").length,
      killed: tally(rows).killed,
      wounded: tally(rows).wounded,
      line: "",
      ...(spot ? { extra: true, spot, ...(spots && spots.length > 1 ? { spots } : {}), ...("where" in rest && rest.where ? { where: rest.where } : {}) } : {}),
    };
    f.line = composeFront({
      front: { ...f, reports: rows.length, id, name },
      prev: prevFronts?.[id] ?? null,
      standing: FRONT_STANDING[id as FrontId] || "",
      windowEnd: fmtWindow(updatedAt),
      hours: CADENCE_HOURS,
      activeStreak: streaks?.[id],
    });
    return f;
  });

  const busiest = [...fronts]
    .filter((f) => f.strikes + f.ground + f.alerts + f.maritime > 0)
    .sort((a, b) => b.strikes + b.ground + b.alerts + b.maritime - (a.strikes + a.ground + a.alerts + a.maritime));

  const numbersBits = joinClauses([
    counts.ground ? plural(counts.ground, "ground engagement") : "",
    counts.strikes ? plural(counts.strikes, "reported strike") : "",
    counts.alerts ? plural(counts.alerts, "air defence alert in Saudi Arabia", "air defence alerts in Saudi Arabia") : "",
    counts.maritime ? plural(counts.maritime, "maritime or port incident") : "",
  ]);

  const windowLabel = `${fmtWindow(startedAt)} to ${fmtWindow(updatedAt)}`;

  /**
   * The general status: a bird's-eye read of the window, composed rather than
   * assembled. It replaces the hand-typed paragraph that used to sit in
   * data.json and never changed.
   */
  const status = composeStatus({
    now: { ...counts, killed: cas.killed, wounded: cas.wounded },
    prev: prevWindow,
    fronts: busiest.map((f) => ({ ...f, reports: 0, id: f.id, name: f.name })),
    windowEnd: fmtWindow(updatedAt),
    hours: CADENCE_HOURS,
    controlMoves,
  });

  return {
    ok: true,
    cadenceHours: CADENCE_HOURS,
    updatedAt,
    nextUpdateAt,
    windowStart: startedAt,
    windowLabel,
    situation: status,
    fronts,
    numbers: {
      line: numbersBits
        ? `Reported in the ${CADENCE_HOURS} hours to ${fmtWindow(updatedAt)}: ${numbersBits}${
            cas.killed ? `, with at least ${num(cas.killed)} reported killed` : ""
          }${cas.wounded ? ` and at least ${num(cas.wounded)} wounded` : ""}.`
        : `No fighting was reported in the ${CADENCE_HOURS} hours to ${fmtWindow(updatedAt)}.`,
      ...counts,
      killed: cas.killed,
      wounded: cas.wounded,
    },
  };
}

function fmtWindow(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: DESK_TZ,
    day: "numeric",
    month: "short",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: DESK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${time} on ${day}`;
}

/** The front a report belongs to (one at most): a tracked one, else an opened one of its governorate. */
export function frontIdsOf(r: LiveReport, extraFronts: ExtraFront[] = []): string[] {
  const t = trackedOf(r);
  if (t) return [t];
  const x = extraFronts.find((f) => inExtraFront(r, f));
  return x ? [x.id] : [];
}

/** Is a point inside a front's own area? Marks outside it are left off that front's map. */
export function inFrontArea(ll: [number, number], id: string, extraFronts: ExtraFront[] = []): boolean {
  const t = trackedAt(ll[0], ll[1]);
  if (t) return t === id;
  const x = extraFronts.find((f) => f.id === id);
  return !!x && govKey(ll[0], ll[1]) === x.gov;
}
