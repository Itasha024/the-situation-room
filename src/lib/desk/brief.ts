/**
 * The 12-hour brief.
 *
 * The general situation, the front lines and the conflict-in-numbers are the three
 * panels a reader uses to orient. They are rebuilt on a fixed 12-hour cadence —
 * 00:00 and 12:00 Asia/Jerusalem — so the page can state, plainly, when it last
 * refreshed and when it next will. No panel is ever silently stale.
 *
 * What is derived here comes only from what the desk itself logged in the window:
 * counts of reported strikes, ground engagements, alerts and casualty figures.
 * Cumulative tallies attributed to AFP, WHO, IOM and OHCHR stay curated in
 * data.json — the desk does not invent an authority it does not have.
 */

import type { LiveReport } from "../yemen-scan.server.ts";
import {
  type FrontCounts,
  type WindowCounts,
  composeFront,
  composeStatus,
  kineticTotal,
} from "./synthesis.ts";
import { num } from "./wire-style.ts";
import { type ExtraFront, inExtraFront } from "./new-fronts.ts";

export const CADENCE_HOURS = 12;

/* ------------------------------------------------------------------ *
 * Window boundaries
 * ------------------------------------------------------------------ */

function jerusalemParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
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

function isoAtJerusalemHour(base: Date, hour: number, dayOffset = 0): string {
  const p = jerusalemParts(base);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + dayOffset));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}T${String(hour).padStart(2, "0")}:00:00+03:00`;
}

/** The 12-hour boundary that has just passed, and the next one. */
export function briefWindow(now = new Date()): { updatedAt: string; nextUpdateAt: string; startedAt: string } {
  const { hour } = jerusalemParts(now);
  const slot = hour < 12 ? 0 : 12;
  const updatedAt = isoAtJerusalemHour(now, slot);
  const nextUpdateAt = slot === 0 ? isoAtJerusalemHour(now, 12) : isoAtJerusalemHour(now, 0, 1);
  const startedAt = slot === 0 ? isoAtJerusalemHour(now, 12, -1) : isoAtJerusalemHour(now, 0);
  return { updatedAt, nextUpdateAt, startedAt };
}

/* ------------------------------------------------------------------ *
 * Fronts the desk tracks
 * ------------------------------------------------------------------ */

export type FrontId = "bab" | "red-sea-coast" | "west-taiz" | "marib" | "dhale" | "jawf" | "saudi-home" | "energy";

/** What each front is and why it matters. Opens the front's paragraph. */
const FRONT_STANDING: Record<FrontId, string> = {
  bab: "The strait and the high ground above it carry the shipping lane between the Red Sea and the Gulf of Aden.",
  "red-sea-coast": "The Red Sea coast controls access to Hodeidah, the main import route for the north.",
  "west-taiz": "Western Taiz is the hinge between the coast and the highlands, and the approach to Taiz city.",
  marib: "Marib holds Yemen's main oil and gas infrastructure and the government's northern stronghold.",
  dhale: "Al-Dhale and Lahj sit astride the roads north from Aden.",
  jawf: "Al-Jawf is the northern desert flank, linking Marib to the Saudi border.",
  "saudi-home": "The Saudi home front is where long-range fire and air defence alerts register inside the kingdom.",
  energy: "Energy and shipping is where the fighting reaches oil exports and the Red Sea corridor.",
};

const FRONT_MATCH: { id: FrontId; name: string; re: RegExp }[] = [
  { id: "bab", name: "Bab al-Mandab and the south-west coast", re: /Bab al-Mandab|Kahbub|Mayun|Dhubab|Jahannam|Al-Aqrab|\bRum\b/i },
  { id: "red-sea-coast", name: "Red Sea coast", re: /Mocha|Al-Khokha|Hays|Hodeidah|Kamaran|Al-Haymah|Midi/i },
  { id: "west-taiz", name: "Western Taiz and Al-Wazi'iyah", re: /Al-Wazi'iyah|Al-Dharifah|Sharirah|Al-Alqamah|Al-Aghbara|Maqbanah|Al-Barh|\bTaiz\b/i },
  { id: "marib", name: "Marib", re: /\bMarib\b|Wadi Dhanah|East Balaq|\bBalaq\b|Sirwah|Al-Hazmah|Al-Wadi district|Harib/i },
  { id: "dhale", name: "Al-Dhale and Lahj", re: /Al-Dhale|Murays|\bLahj\b|Al-Mudaribah|Jabal al-Aswad|Qahaza|Al-Musaymir|Al-Subayhah/i },
  { id: "jawf", name: "Al-Jawf", re: /Al-Jawf|Al-Hazm\b|Yatmah/i },
  { id: "saudi-home", name: "The Saudi home front", re: /Riyadh|Al-Kharj|Jeddah|Mecca|Taif|Abha|Khamis Mushait|Jazan|Najran|Al-Ula|Farasan|Sharurah|Olaya/i },
  { id: "energy", name: "Energy and shipping", re: /Yanbu|Aramco|Abqaiq|Ras Tanura|crude|pipeline|tanker|shipping|Suez|Red Sea corridor/i },
];

/** Does a tracked front already cover this report? */
export function coveredByTrackedFront(r: LiveReport): boolean {
  const blob = `${r.place || ""} ${r.summary} ${r.text}`;
  return FRONT_MATCH.some(({ re }) => re.test(blob));
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
  spot?: [number, number];
};

export type Brief = {
  ok: true;
  cadenceHours: number;
  /** The 12-hour boundary this brief represents. */
  updatedAt: string;
  nextUpdateAt: string;
  /** Start of the window the counts cover. */
  windowStart: string;
  windowLabel: string;
  situation: { line: string; quiet: boolean };
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
 * Without it every brief reads as if the conflict began twelve hours ago.
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

  const isAlert = (r: LiveReport) => /air raid sirens|air defence alerts/i.test(r.summary);
  const counts = {
    reports: inWindow.length,
    strikes: inWindow.filter((r) => r.type === "strike" && !isAlert(r)).length,
    ground: inWindow.filter((r) => r.type === "combat").length,
    alerts: inWindow.filter(isAlert).length,
    maritime: inWindow.filter((r) => r.type === "vessel" || r.type === "port").length,
  };
  const cas = tally(inWindow);

  const tracked = FRONT_MATCH.map(({ id, name, re }) => ({ id, name, spot: undefined as [number, number] | undefined, has: (r: LiveReport) => re.test(`${r.place || ""} ${r.summary} ${r.text}`) }));
  const opened = extraFronts.map((x) => ({ id: x.id, name: x.name, spot: x.spot, has: (r: LiveReport) => inExtraFront(r, x) }));
  const fronts: FrontActivity[] = [...tracked, ...opened].map(({ id, name, spot, has }) => {
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
      ...(spot ? { extra: true, spot } : {}),
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
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "short",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${time} on ${day}`;
}

/** The ids of every front (tracked or opened) a report belongs to. */
export function frontIdsOf(r: LiveReport, extraFronts: ExtraFront[] = []): string[] {
  const blob = `${r.place || ""} ${r.summary} ${r.text}`;
  return [
    ...FRONT_MATCH.filter(({ re }) => re.test(blob)).map(({ id }) => id as string),
    ...extraFronts.filter((x) => inExtraFront(r, x)).map((x) => x.id),
  ];
}
