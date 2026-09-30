/**
 * The derived panels' prose.
 *
 * The desk's general status and front write-ups used to be hand-typed in
 * `data.json` and nothing updated them. These compose them instead, from what
 * the desk itself logged in the window.
 *
 * WHAT MAKES THIS READ LIKE WRITING RATHER THAN A TEMPLATE
 * --------------------------------------------------------
 * The clause frame is chosen by the SHAPE of the window — quiet, one dominant
 * front, broad, a control change, a maritime event — not by filling one fixed
 * sentence. Each frame then has several phrasings selected by the data, so two
 * different windows do not come out sounding identical.
 *
 * WHAT IT WILL NEVER DO
 * ---------------------
 * Assert anything the desk did not log, and rehash a single report. The status
 * is a bird's-eye read: tempo, weight, direction. If you can point at one
 * report and say "that is just this report again", the composer has failed,
 * and there is a test for exactly that.
 */

import { num } from "./wire-style.ts";

export type WindowCounts = {
  reports: number;
  strikes: number;
  ground: number;
  alerts: number;
  maritime: number;
  killed: number;
  wounded: number;
};

export type FrontCounts = WindowCounts & { id: string; name: string };

export const EMPTY_COUNTS: WindowCounts = {
  reports: 0,
  strikes: 0,
  ground: 0,
  alerts: 0,
  maritime: 0,
  killed: 0,
  wounded: 0,
};

export function kineticTotal(c: WindowCounts): number {
  return c.strikes + c.ground + c.alerts + c.maritime;
}

/* ------------------------------------------------------------------ *
 * Small prose helpers
 * ------------------------------------------------------------------ */

function plural(n: number, one: string, many = one + "s"): string {
  return `${num(n)} ${n === 1 ? one : many}`;
}

function joinClauses(parts: string[]): string {
  const xs = parts.filter(Boolean);
  if (!xs.length) return "";
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Front names carry their own "and", so they are semicolon-listed. */
function listFronts(names: string[]): string {
  return names.map((n) => n.replace(/^The /, "the ")).join("; ");
}

function activityClause(c: WindowCounts): string {
  return joinClauses([
    c.ground ? plural(c.ground, "ground engagement") : "",
    c.strikes ? plural(c.strikes, "reported strike") : "",
    c.alerts ? plural(c.alerts, "air defence alert") : "",
    c.maritime ? plural(c.maritime, "maritime or port incident") : "",
  ]);
}

/**
 * Direction of travel against the previous window.
 *
 * Deliberately coarse. A desk that calls a two-incident difference a "sharp
 * escalation" is telling the reader something the data does not support, so
 * the bands are wide and the wording stays measured.
 */
type Tempo = "first" | "quiet" | "steady" | "up" | "down" | "sharply-up" | "sharply-down";

export function tempoOf(now: WindowCounts, prev: WindowCounts | null): Tempo {
  const a = kineticTotal(now);
  if (!prev) return a === 0 ? "quiet" : "first";
  const b = kineticTotal(prev);
  if (a === 0) return "quiet";
  if (b === 0) return a >= 4 ? "sharply-up" : "up";
  const ratio = a / b;
  if (ratio >= 2 && a - b >= 4) return "sharply-up";
  if (ratio <= 0.5 && b - a >= 4) return "sharply-down";
  if (ratio >= 1.35) return "up";
  if (ratio <= 0.72) return "down";
  return "steady";
}

const TEMPO_PHRASE: Record<Tempo, string[]> = {
  // Must read naturally before "in the N hours to <time>", like the rest.
  first: ["Fighting was reported", "Activity was reported"],
  quiet: ["No fighting was reported"],
  steady: ["The tempo held roughly steady", "Activity ran at about the same level"],
  up: ["The tempo picked up", "Activity rose"],
  down: ["The tempo eased", "Activity fell back"],
  "sharply-up": ["The tempo rose sharply", "Activity climbed steeply"],
  "sharply-down": ["The tempo dropped away", "Activity fell sharply"],
};

/**
 * Pick a phrasing from the data rather than at random, so the same window
 * always reads the same way and two consecutive windows do not repeat.
 */
function pick(options: string[], seed: number): string {
  return options[Math.abs(seed) % options.length];
}

/* ------------------------------------------------------------------ *
 * The general status — 2–3 lines, bird's-eye
 * ------------------------------------------------------------------ */

export type StatusInput = {
  now: WindowCounts;
  prev: WindowCounts | null;
  /** Fronts with any activity, busiest first. */
  fronts: FrontCounts[];
  /** Human window end, e.g. "12:00 on 20 Sept". */
  windowEnd: string;
  hours: number;
  /** Control units that changed hands this window, if any. */
  controlMoves?: { place: string; to: string }[];
};

export function composeStatus(input: StatusInput): { line: string; quiet: boolean } {
  const { now, prev, fronts, windowEnd, hours } = input;
  const active = fronts.filter((f) => kineticTotal(f) > 0);
  const tempo = tempoOf(now, prev);
  const total = kineticTotal(now);
  const seed = total + now.reports;

  /* Frame 1 — a quiet window. Say so plainly and stop. */
  if (tempo === "quiet") {
    return {
      line:
        `No fighting was reported in the ${hours} hours to ${windowEnd}. ` +
        `Front lines are reported unchanged, and no side claimed a move.`,
      quiet: true,
    };
  }

  const sentences: string[] = [];

  /* Sentence 1 — direction of travel, with the numbers behind it. */
  const head = pick(TEMPO_PHRASE[tempo], seed);
  const comparison =
    prev && kineticTotal(prev) > 0 && tempo !== "first"
      ? `, ${num(total)} reported incidents against ${num(kineticTotal(prev))} in the window before`
      : total
        ? `, across ${plural(total, "incident")}`
        : "";
  sentences.push(`${head} in the ${hours} hours to ${windowEnd}${comparison}.`);

  /* Sentence 2 — where the weight sat, and of what kind. */
  const bits = activityClause(now);
  if (active.length === 1) {
    sentences.push(
      `Almost all of it came from ${listFronts([active[0].name])}: ${activityClause(active[0])}.`,
    );
  } else if (active.length >= 4) {
    sentences.push(
      `The weight was spread across ${num(active.length)} fronts — ${listFronts(
        active.slice(0, 3).map((f) => f.name),
      )} among them — comprising ${bits}.`,
    );
  } else if (active.length) {
    sentences.push(
      `The heaviest reporting came from ${listFronts(active.map((f) => f.name))}, comprising ${bits}.`,
    );
  } else if (bits) {
    sentences.push(`It comprised ${bits}, none of it on the main fronts.`);
  }

  /* Sentence 3 — the one thing that most changes the picture, if anything did. */
  const third = thirdLine(input);
  if (third) sentences.push(third);

  return { line: sentences.join(" "), quiet: false };
}

/**
 * At most one closing line, and only when it adds something the first two did
 * not. Ordered by how much it changes a reader's understanding.
 */
function thirdLine(input: StatusInput): string {
  const { now, controlMoves } = input;

  if (controlMoves && controlMoves.length) {
    const names = controlMoves.map((m) => m.place);
    return controlMoves.length === 1
      ? `Control changed at ${names[0]}, the only line to move in the window.`
      : `Control changed at ${joinClauses(names)}.`;
  }
  if (now.killed >= 1) {
    return now.wounded
      ? `Reported dead in the window: at least ${num(now.killed)}, with at least ${num(now.wounded)} wounded.`
      : `Reported dead in the window: at least ${num(now.killed)}.`;
  }
  if (now.maritime >= 1) {
    return `The maritime and energy corridor featured again, with ${plural(
      now.maritime,
      "incident",
    )} at sea or against port infrastructure.`;
  }
  if (now.alerts >= 2) {
    return `Saudi Arabia was under alert ${plural(now.alerts, "time")} in the window.`;
  }
  return "";
}

/* ------------------------------------------------------------------ *
 * A front's paragraph — 3–4 lines
 * ------------------------------------------------------------------ */

export type FrontInput = {
  front: FrontCounts;
  prev: WindowCounts | null;
  /** What this front is and why it matters, from the gazetteer. */
  standing: string;
  windowEnd: string;
  hours: number;
  /** Windows in a row with activity, for the trend line. */
  activeStreak?: number;
};

export function composeFront(input: FrontInput): string {
  const { front, prev, standing, windowEnd, hours, activeStreak } = input;
  const total = kineticTotal(front);
  const sentences: string[] = [];

  if (standing) sentences.push(standing);

  if (total === 0) {
    sentences.push(`Nothing was reported from this front in the ${hours} hours to ${windowEnd}.`);
    if (activeStreak === 0) sentences.push("It has been quiet across recent windows.");
    return sentences.join(" ");
  }

  sentences.push(
    `In the ${hours} hours to ${windowEnd} there were ${activityClause(front)}${
      front.killed ? `, with at least ${num(front.killed)} reported killed` : ""
    }.`,
  );

  const tempo = tempoOf(front, prev);
  if (tempo === "sharply-up") sentences.push("That is a marked rise on the previous window.");
  else if (tempo === "up") sentences.push("Activity here is up on the previous window.");
  else if (tempo === "sharply-down") sentences.push("Activity has dropped away sharply here.");
  else if (tempo === "down") sentences.push("Activity here is down on the previous window.");
  else if (tempo === "steady" && activeStreak && activeStreak >= 3) {
    sentences.push(`This front has now been active for ${num(activeStreak)} consecutive windows.`);
  }

  return sentences.join(" ");
}
