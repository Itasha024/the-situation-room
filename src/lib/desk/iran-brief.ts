/**
 * The Iran desk's 3-hour brief (Round 30 stage 6; user, 9 Oct): "Latest
 * developments" and the ten arenas, each a numbered list, most important
 * first, every point with references to the reports it rests on (refs.ts).
 * Server-only.
 *
 * One writing call per window, from the window's Iran cards and Trump's own
 * statements in it. Built at 00, 03, 06 … Israel time, by the Iran cycle; a
 * window no model wrote is asked again every 10 minutes. An arena with nothing
 * new keeps its last points, marked with when they were news. The NVIDIA
 * models lead, so Google's small daily share stays the Yemen desk's.
 */

import { askChain, type ChainModel, WRITER_MODELS } from "./models.ts";
import { briefWindow } from "./brief.ts";
import { cleanPoints } from "./prose.ts";
import { headlinePoints, numberRefs, type Ref, refOfReport, stripRefs } from "./refs.ts";
import type { DeskStore } from "./store.ts";
import { shownCard, TRUMP_KEY, type TrumpFeed, type TrumpStatement } from "./trump.ts";
import type { LiveReport } from "./types.ts";
import { topReports } from "./brief-store.ts";

export const IRAN_BRIEF_KEY = "brief:iran";
const HOURS = 3;

/** The ten arenas, as approved (iran-desk.tsx carries the same names). */
export const ARENAS: { id: string; name: string; about: string }[] = [
  { id: "military", name: "Military campaign", about: "Strikes and interceptions by any side, force moves, losses." },
  { id: "talks", name: "Talks", about: "Iran–US, Oman, Qatar and any other channel; the MoU's terms; mediators' statements." },
  { id: "hormuz", name: "Strait of Hormuz", about: "Ship incidents, seizures, mines, transits, escorts, insurance." },
  { id: "nuclear", name: "Nuclear file", about: "The IAEA, enrichment, the sites, inspections, NPT moves." },
  { id: "inside-iran", name: "Inside Iran", about: "Fuel and gas, the economy and the rial, imports and exports, protests, arrests, executions, power struggles." },
  { id: "sanctions", name: "Sanctions", about: "New US, EU and UN sanctions, waivers, enforcement, shadow-fleet seizures." },
  { id: "axis", name: "Axis of Resistance", about: "Hezbollah, the Iraqi and Syrian militias, the Houthis' Iran side." },
  { id: "us-region", name: "US in the region", about: "US ties with the Gulf states, Iraq and Israel; bases, deployments, arms deals." },
  { id: "inside-us", name: "Inside the US", about: "Congress, war powers, polls, gasoline prices, voices for and against the war." },
  { id: "israel", name: "Israel home front", about: "Sirens, the home front, the cabinet's war decisions." },
];

export type ArenaBrief = { id: string; name: string; points: string[]; refs: Ref[]; lastNewsAt?: string };
export type IranBrief = {
  ok: true;
  desk: "iran";
  cadenceHours: number;
  updatedAt: string;
  nextUpdateAt: string;
  windowStart: string;
  situation: { line: string; points: string[]; refs: Ref[]; model?: string };
  arenas: ArenaBrief[];
  proseTriedAt?: string;
};

/** The NVIDIA writers first; Google's strong models are the Yemen desk's update share. */
const IRAN_WRITERS: ChainModel[] = [...WRITER_MODELS.slice(3), ...WRITER_MODELS.slice(0, 3)];
const RETRY_MS = 10 * 60_000;

const SYSTEM = `You are the editor of a live news desk on the Iran war (the US–Iran war since 28 February 2026: the strikes, the Strait of Hormuz, the talks, the nuclear file, sanctions, Iran's allies, and the war at home in Iran, the US, Israel and the Gulf).
You get the reports published in the last ${HOURS} hours, and Trump's own statements on Iran in that time. Each line is: [its id] outlet (its group): headline — body. Trump's own statements have the ids t1, t2…
Write in English wire style (Reuters/AP):
- "points": the latest developments of these ${HOURS} hours as a numbered list for a reader with a minute: 3-8 points, each ONE development in 1-2 short sentences (at most 40 words), ordered from the most important to the least. Importance is what changes the war most. What a leader or government actually said or decided outranks reports of what they might do: Trump's own words on Iran usually come first, unless they are minor. Strikes and their deaths, attacks at sea, decisions on war and on talks come before reactions, commentary and local items, which come last or are left out. Two reports of one event are one point.
- "arenas": for each arena id below, a list of 0-4 points on that arena from these ${HOURS} hours, most important first, written the same way. Only reports that belong to that arena; [] when none does. A report may serve more than one arena.
ARENAS:
${ARENAS.map((a) => `- ${a.id} = ${a.name}: ${a.about}`).join("\n")}
In every point, after the words each report supports, put that report's id in square brackets, before the full stop: "The IRGC Navy seized a tanker off Fujairah [r4][r9]." Every point carries at least one id, and only ids from the lines given.
Rules:
- Only facts in the reports. Never invent a place, number, name or claim.
- Name no outlet: the reference shows it. A side's claim is written as that side's ("the IRGC says it hit…", "Israel's military says…", "a US official says…"), never as plain fact; a fact reported by both sides, a wire agency or an official body is plain fact. A statement keeps its speaker ("Iran's foreign ministry said…").
- Never write about what was NOT reported or did not change. Neutral wording, no side's labels ("Zionist regime", "martyrs", "aggression", "terrorists" for a state's forces).
- No clock times. Keep every figure exact. Never mention the desk, reports, cards or "the window". No hype.
- Past tense for events, present for the state of play.
Return ONLY JSON {"points":["..."],"arenas":{"<id>":["..."]}}.`;

/** The cards and Trump's statements of the window, as the writer's lines and the reference each id stands for. */
export function writerInput(reports: LiveReport[], trump: TrumpStatement[]): { lines: string[]; refOf: Record<string, Ref> } {
  const refOf: Record<string, Ref> = {};
  const lines: string[] = [];
  const cards = [...reports].filter((r) => r.summary).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-160);
  cards.forEach((r, i) => {
    const id = `r${i + 1}`;
    refOf[id] = refOfReport(r);
    const lean = (r as LiveReport & { lean?: string }).lean;
    const body = String(r.text || "").replace(/\s+/g, " ").slice(0, 200);
    lines.push(`[${id}] ${r.source}${lean ? ` (${lean})` : ""}: ${r.summary}${body ? ` — ${body}` : ""}`);
  });
  [...trump].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).forEach((s, i) => {
    const id = `t${i + 1}`;
    const shown = shownCard({ headline: s.headline || `Trump: ${s.text}`, body: s.body });
    refOf[id] = { fp: s.id, source: s.source, at: s.at, url: s.url, headline: shown.headline, ...(shown.body ? { body: shown.body } : {}), trump: true };
    lines.push(`[${id}] Trump (${s.source}): ${shown.headline}${s.text ? ` — ${s.text.replace(/\s+/g, " ").slice(0, 400)}` : ""}`);
  });
  return { lines, refOf };
}

/** The writer's answer as the brief's lists; null parts mean the writer gave nothing usable. */
export function fromAnswer(j: Record<string, unknown>, refOf: Record<string, Ref>): { situation: { points: string[]; refs: Ref[] } | null; arenas: Record<string, { points: string[]; refs: Ref[] }> } {
  const look = (id: string) => refOf[id];
  const pts = numberRefs(cleanPoints(j.points, 8), look);
  const aj = (j.arenas && typeof j.arenas === "object" ? j.arenas : {}) as Record<string, unknown>;
  const arenas: Record<string, { points: string[]; refs: Ref[] }> = {};
  for (const a of ARENAS) {
    const got = numberRefs(cleanPoints(aj[a.id], 4), look);
    // A point with no reference the writer could show is not kept in an arena.
    if (got.points.length && got.refs.length) arenas[a.id] = got;
  }
  return { situation: pts.points.length ? pts : null, arenas };
}

let building: Promise<IranBrief | null> | null = null;

/** The brief of the current window, built or written again when due. Safe to call every cycle. */
export function refreshIranBrief(store: DeskStore, now = new Date()): Promise<IranBrief | null> {
  if (building) return building;
  building = build(store, now).finally(() => {
    building = null;
  });
  return building;
}

async function build(store: DeskStore, now: Date): Promise<IranBrief | null> {
  const w = briefWindow(now, HOURS);
  const saved = (await store.getJson<IranBrief>(IRAN_BRIEF_KEY)) ?? null;
  const same = saved?.updatedAt === w.updatedAt;
  if (same) {
    if (saved.situation?.model) return saved;
    const tried = Date.parse(saved.proseTriedAt || "");
    if (Number.isFinite(tried) && now.getTime() - tried < RETRY_MS) return saved;
    if (now.getTime() > Date.parse(w.nextUpdateAt) - 5 * 60_000) return saved;
  }
  // The first brief reads the last day, so no arena opens empty.
  const start = saved ? Date.parse(w.startedAt) : Date.parse(w.updatedAt) - 24 * 3600_000;
  const end = Date.parse(w.updatedAt);
  const inWin = (at: string) => {
    const t = Date.parse(at);
    return Number.isFinite(t) && t >= start && t < end;
  };
  const { reports } = await store.recentDesk(1500, undefined, { events: false, desk: "iran" });
  const cards = (reports as unknown as LiveReport[]).filter((r) => inWin(String(r.at || "")));
  const feed = (await store.getJson<TrumpFeed>(TRUMP_KEY)) ?? { statements: [] };
  const trump = feed.statements.filter((s) => !s.off && inWin(s.at));

  const { lines, refOf } = writerInput(cards, trump);
  let answer: { json: Record<string, unknown>; model: string } | null = null;
  if (lines.length) answer = await askChain("iran-brief", SYSTEM, ["REPORTS:", ...lines].join("\n"), { models: IRAN_WRITERS, timeoutMs: 120_000 });
  const got = answer ? fromAnswer(answer.json, refOf) : { situation: null, arenas: {} };

  // No writer: the strongest headlines as the points, each with its own card.
  const fallback = cards.length ? headlinePoints(topReports(cards, 5)) : null;
  const situation = got.situation
    ? { line: got.situation.points.map(stripRefs).join("\n\n"), ...got.situation, model: answer!.model }
    : fallback
      ? { line: fallback.points.map(stripRefs).join("\n\n"), ...fallback }
      : (saved?.situation ?? { line: "", points: [], refs: [] });
  const old = new Map((saved?.arenas ?? []).map((a) => [a.id, a]));
  const arenas: ArenaBrief[] = ARENAS.map((a) => {
    const fresh = got.arenas[a.id];
    if (fresh) return { id: a.id, name: a.name, ...fresh, lastNewsAt: w.updatedAt };
    // Nothing new here: the last points stand, with the time they were news.
    const o = old.get(a.id);
    return o ? { ...o, name: a.name } : { id: a.id, name: a.name, points: [], refs: [] };
  });
  const brief: IranBrief = {
    ok: true,
    desk: "iran",
    cadenceHours: HOURS,
    updatedAt: w.updatedAt,
    nextUpdateAt: w.nextUpdateAt,
    windowStart: w.startedAt,
    situation,
    arenas,
    proseTriedAt: now.toISOString(),
  };
  await store.putJson(IRAN_BRIEF_KEY, brief);
  console.log(`[iran-brief] ${w.updatedAt}: ${cards.length} cards, ${trump.length} Trump statements, ${answer ? `written by ${answer.model}` : "no writer"}, ${Object.keys(got.arenas).length} arenas new`);
  return brief;
}
