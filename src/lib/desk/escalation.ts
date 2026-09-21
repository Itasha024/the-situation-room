/**
 * The escalation meter: one 0-100 reading of how intense the war was over the
 * last 24 hours, updated with each 12-hour brief and kept as a history.
 *
 * WHY DISTINCT EVENTS, NOT CARDS: the desk's coverage grew from a few curated
 * events a day in July to a hundred cards a day in September. Counting cards
 * would read that growth as escalation. The index counts distinct events
 * (one kind of action in one area on one day, however many outlets carried it)
 * and scores them on fixed scales bound by geography, so more coverage of the
 * same fighting does not move it, and a wider or heavier war does.
 */

import type { LiveReport } from "./types.ts";

export type EscalationParts = {
  /** Areas with strikes or fighting (about 50 km cells). */
  breadth: number;
  /** Areas with ground fighting, and changes of control. */
  ground: number;
  /** Areas struck from the air, by missile or drone. */
  strikes: number;
  /** Attacks on Saudi soil. */
  cross: number;
  /** Attacks on ships and ports. */
  maritime: number;
  /** Deaths reported in single incidents. */
  deaths: number;
};

export type EscalationPoint = {
  /** End of the 24-hour window (a 12-hour boundary). */
  at: string;
  score: number;
  band: Band;
  parts: EscalationParts;
  /** Too few reports in the window to read it: shown as a gap, never as calm. */
  sparse?: boolean;
};

export type Band = "Calm" | "Low" | "Elevated" | "High" | "Severe";
export const ESCALATION_KEY = "escalation";

export function bandOf(score: number): Band {
  if (score < 20) return "Calm";
  if (score < 40) return "Low";
  if (score < 60) return "Elevated";
  if (score < 80) return "High";
  return "Severe";
}

type Kind = "strike" | "ground" | "maritime" | "other";

function kindOf(type: string): Kind {
  if (/^(?:strike|missile|launch|drone)$/.test(type)) return "strike";
  if (/^(?:combat|clash|capture)$/.test(type)) return "ground";
  if (/^(?:vessel|port)$/.test(type)) return "maritime";
  return "other";
}

const SAUDI_PLACE =
  /\b(?:Saudi Arabia|Najran|Jizan|Jazan|Asir|Abha|Khamis Mushait|Dhahran al-Janub|Riyadh|Jeddah|Yanbu|Taif|Dhahran|Ras Tanura|Abqaiq|Sharurah|Mecca|Medina)\b/i;

/** On Saudi soil: by place name, or by coordinates north of the border. */
export function onSaudiSoil(r: Pick<LiveReport, "place" | "lat" | "lng" | "summary">): boolean {
  const place = String(r.place || "");
  if (place && SAUDI_PLACE.test(place)) return true;
  const { lat, lng } = r;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  return lat > 19.1 || (lat > 17.5 && lng < 46.5) || (lat > 16.55 && lng < 42.95);
}

const CONTROL_RE = /\b(?:captur|seiz|took control|take control|retook|recaptur|overr[au]n|liberat|fell to|advance[sd]? (?:into|on))/i;
const CUMULATIVE_RE = /\b(?:since|total|toll (?:rises|rose|reached|climbs)|so far|in all|cumulative|this year|round began)\b/i;
const DEATHS_RE = /\b(\d{1,3})\s+(?:\w+\s+){0,3}?(?:were\s+|have been\s+|was\s+)?(?:killed|dead|died)\b/i;
const WORD_NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozens: 24, scores: 40 };
const DEATHS_WORD_RE = /\b(two|three|four|five|six|seven|eight|nine|ten|dozens|scores)\s+(?:of\s+)?(?:\w+\s+){0,3}?(?:were\s+|have been\s+)?(?:killed|dead|died)\b/i;
const DEESCALATE_RE = /\b(?:ceasefire|truce|cessation of hostilities|de-escalat\w*|prisoner (?:swap|exchange)|agree[ds]? to (?:halt|stop|end))\b/i;
const NOT_DEAL_RE = /\b(?:reject\w*|violat\w*|collaps\w*|breach\w*|calls? for|urg\w+|demand\w*|without)\b/i;

/** Deaths a report gives for one incident (not a cumulative toll). */
export function incidentDeaths(text: string): number {
  if (CUMULATIVE_RE.test(text)) return 0;
  const m = DEATHS_RE.exec(text);
  if (m) return Math.min(Number(m[1]), 150);
  const w = DEATHS_WORD_RE.exec(text);
  return w ? WORD_NUM[w[1].toLowerCase()] ?? 0 : 0;
}

function areaOf(r: LiveReport): string {
  if (typeof r.lat === "number" && typeof r.lng === "number") {
    return `${Math.round(r.lat * 2) / 2},${Math.round(r.lng * 2) / 2}`;
  }
  return String(r.place || "").toLowerCase().trim();
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Below this many reports in 24 hours the window is not read (thin coverage, not calm). */
export const MIN_REPORTS = 12;

/** Weights of the parts; they sum to 1. */
const WEIGHTS: EscalationParts = { breadth: 0.24, ground: 0.2, strikes: 0.16, cross: 0.14, maritime: 0.1, deaths: 0.16 };

/**
 * Score the reports of one 24-hour window. Follow-ups (replies) and folded
 * duplicates are the same events told again, so they count once.
 */
export function scoreWindow(reports: LiveReport[], endAt: string): EscalationPoint {
  const events = new Map<string, { kind: Kind; saudi: boolean; control: boolean; deaths: number; area: string }>();
  let deescalate = 0;
  for (const r of reports) {
    if (r.replyTo || r.duplicateOf) continue;
    const kind = kindOf(String(r.type || ""));
    if (kind === "other") {
      if (DEESCALATE_RE.test(r.summary || "") && !NOT_DEAL_RE.test(r.summary || "")) deescalate += 1;
      continue;
    }
    const area = areaOf(r);
    if (!area) continue;
    const saudi = kind === "strike" && onSaudiSoil(r);
    const key = `${kind}|${area}`;
    const prev = events.get(key);
    const deaths = incidentDeaths(r.summary || "") || incidentDeaths(String(r.text || "").slice(0, 400));
    const control = kind === "ground" && (String(r.type) === "capture" || CONTROL_RE.test(r.summary || ""));
    if (prev) {
      prev.deaths = Math.max(prev.deaths, deaths);
      prev.control = prev.control || control;
      prev.saudi = prev.saudi || saudi;
    } else {
      events.set(key, { kind, saudi, control, deaths, area });
    }
  }
  const list = [...events.values()];
  const areas = new Set(list.filter((e) => e.kind !== "maritime").map((e) => e.area));
  const groundAreas = list.filter((e) => e.kind === "ground");
  const controls = groundAreas.filter((e) => e.control).length;
  const strikeAreas = list.filter((e) => e.kind === "strike" && !e.saudi).length;
  const cross = list.filter((e) => e.saudi).length;
  const maritime = list.filter((e) => e.kind === "maritime").length;
  const deaths = list.reduce((s, e) => s + e.deaths, 0);

  // Fixed scales: 14 areas at once is a war on every front; 8 ground fronts,
  // 10 struck areas, 3 attacks on Saudi soil, 2 at sea, 100 dead in a day.
  const parts: EscalationParts = {
    breadth: clamp01(areas.size / 14),
    ground: clamp01((groundAreas.length + controls) / 8),
    strikes: clamp01(strikeAreas / 10),
    cross: cross === 0 ? 0 : clamp01(0.25 + cross / 4),
    maritime: maritime === 0 ? 0 : clamp01(0.3 + maritime / 3),
    deaths: clamp01(Math.log1p(deaths) / Math.log1p(100)),
  };
  let score = 0;
  for (const k of Object.keys(WEIGHTS) as (keyof EscalationParts)[]) score += WEIGHTS[k] * parts[k];
  score = score * 100 - Math.min(15, deescalate * 8);
  score = Math.round(Math.max(0, Math.min(100, score)));
  for (const k of Object.keys(parts) as (keyof EscalationParts)[]) parts[k] = Math.round(parts[k] * 100) / 100;
  const sparse = reports.length < MIN_REPORTS;
  return { at: endAt, score, band: bandOf(score), parts, ...(sparse ? { sparse } : {}) };
}

/** Add a point to the history, replacing one with the same end time. Keeps 400 points. */
export function pushPoint(history: EscalationPoint[], p: EscalationPoint): EscalationPoint[] {
  const out = history.filter((h) => h.at !== p.at);
  out.push(p);
  out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return out.slice(-400);
}

/** What the page shows: now, the comparisons and a 30-day line. */
export type EscalationView = {
  now: EscalationPoint;
  previous: number | null;
  dayAgo: number | null;
  weekAgo: number | null;
  monthAgo: number | null;
  line: { at: string; score: number | null }[];
};

export function escalationView(history: EscalationPoint[]): EscalationView | null {
  const read = history.filter((h) => !h.sparse);
  if (!read.length) return null;
  const now = read[read.length - 1];
  const t = Date.parse(now.at);
  const near = (ms: number) => {
    const want = t - ms;
    const hit = read.find((h) => Math.abs(Date.parse(h.at) - want) < 6 * 3600_000);
    return hit ? hit.score : null;
  };
  return {
    now,
    previous: near(12 * 3600_000),
    dayAgo: near(24 * 3600_000),
    weekAgo: near(7 * 24 * 3600_000),
    monthAgo: near(30 * 24 * 3600_000),
    // Thin windows stay in the line as gaps (null), so it never draws calm where there was no data.
    line: history.filter((h) => Date.parse(h.at) >= t - 30 * 24 * 3600_000).map((h) => ({ at: h.at, score: h.sparse ? null : h.score })),
  };
}
