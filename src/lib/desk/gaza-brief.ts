/**
 * The Gaza desk's 3-hour brief (user, 24 Oct: "separate brief to Gaza and to
 * Judea and Samaria", no fronts): two numbered lists, most important first,
 * every point with references to the reports it rests on (refs.ts).
 * Server-only.
 *
 * One writing call per window, from the window's Gaza cards and Trump's own
 * statements on Gaza in it, as the Iran brief is written (iran-brief.ts). A
 * list with nothing new keeps its last points, marked with when they were news.
 */

import { askChain, type ChainModel, WRITER_MODELS } from "./models.ts";
import { briefStart, briefWindow } from "./brief.ts";
import { cleanPoints, onePointEach } from "./prose.ts";
import { headlinePoints, NUM_MARK, numberRefs, type Ref, stripRefs } from "./refs.ts";
import { keepSpeaker, writerInput } from "./iran-brief.ts";
import { gazaWords, GAZA_WORD_RULES } from "./gaza-words.ts";
import { newsOnly } from "./told-before.ts";
import { serveCard } from "./copy-rules.ts";
import type { DeskStore } from "./store.ts";
import { TRUMP_KEY, type TrumpFeed } from "./trump.ts";
import type { LiveReport } from "./types.ts";
import { topReports } from "./brief-store.ts";
import { dropEmpty, rankPoints } from "./rank-points.ts";
import { refreshGazaTimelineNow } from "./gaza-timeline-now.ts";

export const GAZA_BRIEF_KEY = "brief:gaza";
const HOURS = 3;
const RETRY_MS = 10 * 60_000;

/** The two lists, in the page's order. */
export const GAZA_AREAS: { id: "gaza" | "js"; name: string; about: string }[] = [
  { id: "gaza", name: "Gaza", about: "The Gaza Strip: IDF strikes and fire, attacks on the IDF, the IDF-held area and the yellow line, Hamas and the other factions, the clans and militias, the dead and wounded, aid and the crossings, the Board of Peace, the stabilisation force, the Gaza committee, disarmament, talks and every statement on Gaza." },
  { id: "js", name: "Judea and Samaria", about: "Judea and Samaria and Jerusalem: IDF raids and arrests, attacks on Israelis, extremists' violence, clashes, demolitions, the Palestinian Authority (its forces, politics and money, the clearance revenues), Israel's decisions there, and every statement on them." },
];

/** NVIDIA first, so Google's small daily share stays the other desks'. */
const GAZA_WRITERS: ChainModel[] = [WRITER_MODELS[3], { provider: "nvidia", id: "nvidia/nemotron-3.5-lightning-30b-a3b" }, ...WRITER_MODELS.slice(5)];

export type AreaBrief = { id: string; name: string; points: string[]; refs: Ref[]; lastNewsAt?: string };
export type GazaBrief = {
  ok: true;
  desk: "gaza";
  cadenceHours: number;
  updatedAt: string;
  nextUpdateAt: string;
  windowStart: string;
  /** Both lists' points together: the All page's brief and the share text read this. */
  situation: { line: string; points: string[]; refs: Ref[]; model?: string };
  areas: AreaBrief[];
  proseTriedAt?: string;
};

const SYSTEM = `You are the editor of a live news desk on Gaza and Judea and Samaria.
You get the reports published since the last update (at least the last ${HOURS} hours, more when it was quiet), and Trump's own statements on Gaza in that time. Each line is: [its id] outlet (its group): headline — body. Trump's own statements have the ids t1, t2…
Write two separate briefs in English wire style (Reuters/AP), each a numbered list for a reader with a minute:
${GAZA_AREAS.map((a) => `- "${a.id}" = ${a.name}: ${a.about}`).join("\n")}
Each list: 0-8 points (fewer when less happened: only what is important and interesting, never padding), each ONE development in 1-2 short sentences (at most 40 words), most important first. Importance is what changes the most: deaths, strikes, attacks, decisions on war, on aid and on the day after come first; reactions, condemnations and general statements last or left out. A report goes in the one list it is about; [] when nothing happened there. Two reports of one event are one point; one speaker's words on one subject are one point.
In every point, after the words each report supports, put that report's id in square brackets, before the full stop: "The IDF struck a car in Khan Yunis [r4]." Every point carries at least one id, and only ids from the lines given. When several reports tell the same fact, give the id of ONE: the speaker's or the side's own account first (the IDF for Israel's army, the Gaza health ministry for its tolls, Hamas's own channel for Hamas), then a wire agency, then the fullest report.
Rules:
- Only facts in the reports. Never invent a place, number, name or claim.
- A point tells what happened, in the past tense: "Israeli forces conducted explosions", never "conduct". What a speaker said keeps "Speaker: …".
- Only what is worth a brief: never a drone or aircraft seen overhead with nothing hit, a road closed, a single routine arrest, or a feature story (community kitchens, a family's story). Fewer points rather than these.
- Name no outlet and never open a point with "X reported": the reference shows the source. Every point ends with a full stop. What someone said opens with the speaker and a colon ("Hamas: …"); never "Speaker: it …": an act of speech is the speaker's own ("Hamas called on the UN to …"), and a deed the speaker claims is told as its claim ("IDF says it killed two gunmen who crossed the yellow line in Beit Lahia."); never drop the speaker, or a claim reads as fact, and keep its reason or condition. After the colon write whole sentences, every verb with its subject ("Gaza health ministry: 12 people were killed in the last day and 30 were wounded.", never "…were killed, and said…"). A side's claim is never plain fact; a fact told by both sides, a wire agency or an official body is.
- Israel's words and acts are cited from Israeli sources; Hamas's, the factions' and the PA's from Palestinian sources; never from Iranian media.
${GAZA_WORD_RULES}
- Never write about what was NOT reported or did not change. Neutral wording, no side's labels ("martyrs", "occupation forces", "Zionist", "terrorists" for a state's forces).
- No clock times. Keep every figure exact. Never mention the desk, reports, cards or "the window". No hype.
- Past tense for events, present for the state of play.
Return ONLY JSON {"gaza":["..."],"js":["..."]}.`;

/** A writer's list made the desk's points: checked, the speaker kept, the desk's words, numbered. */
function listOf(raw: unknown, refOf: Record<string, Ref>, outlets: string[]): { points: string[]; refs: Ref[] } {
  const pts = rankPoints(onePointEach(cleanPoints(raw, 8).map((p) => gazaWords(keepSpeaker(p, refOf))), outlets));
  const got = numberRefs(dropEmpty(pts), (id) => refOf[id]);
  return { points: got.points.filter((p) => new RegExp(NUM_MARK.source).test(p)), refs: got.refs };
}

export function fromGazaAnswer(j: Record<string, unknown>, refOf: Record<string, Ref>): Record<string, { points: string[]; refs: Ref[] }> {
  const outlets = Object.values(refOf).map((r) => r.source);
  const out: Record<string, { points: string[]; refs: Ref[] }> = {};
  for (const a of GAZA_AREAS) {
    const got = listOf(j[a.id], refOf, outlets);
    if (got.points.length && got.refs.length) out[a.id] = got;
  }
  return out;
}

/** Why an answer cannot be used: an id not given, or nothing in either list for a window of many reports. */
export function gazaUnusable(j: Record<string, unknown>, refOf: Record<string, Ref>, nLines: number): string | null {
  const raw = GAZA_AREAS.flatMap((a) => (Array.isArray(j[a.id]) ? (j[a.id] as unknown[]).map(String) : []));
  const bad = raw.flatMap((p) => [...p.matchAll(/\[([^\]\s]{1,12})\]/g)].map((m) => m[1])).filter((id) => !/^\d+$/.test(id) && !refOf[id.toLowerCase()]);
  if (bad.length) return `ids not given: ${bad.slice(0, 4).join(", ")}`;
  const got = fromGazaAnswer(j, refOf);
  const n = Object.values(got).reduce((s, x) => s + x.points.length, 0);
  if (!n) return "no usable points";
  if (nLines >= 8 && n < 3) return `${n} point(s) for ${nLines} reports`;
  if (nLines >= 20 && n < 5) return `${n} point(s) for ${nLines} reports`;
  return null;
}

const ABOUT_GAZA = /\b(?:Gaza|Hamas|Palestin\w*|Judea|Samaria|West Bank|Board of Peace|Abbas|Rafah|Khan Yunis|Jenin|Ramallah|hostages?)\b/i;

let building: Promise<GazaBrief | null> | null = null;

/** The brief of the current window, built or written again when due. Safe to call every cycle. */
export function refreshGazaBrief(store: DeskStore, now = new Date()): Promise<GazaBrief | null> {
  if (building) return building;
  building = build(store, now).finally(() => {
    building = null;
  });
  return building;
}

async function build(store: DeskStore, now: Date): Promise<GazaBrief | null> {
  const w = briefWindow(now, HOURS);
  const saved = (await store.getJson<GazaBrief>(GAZA_BRIEF_KEY)) ?? null;
  if (saved?.updatedAt === w.updatedAt) {
    if (saved.situation?.model) return saved;
    const tried = Date.parse(saved.proseTriedAt || "");
    if (Number.isFinite(tried) && now.getTime() - tried < RETRY_MS) return saved;
    if (now.getTime() > Date.parse(w.nextUpdateAt) - 5 * 60_000) return saved;
  }
  // The first brief reads the last day, so neither list opens empty.
  const end = Date.parse(w.updatedAt);
  const { reports } = await store.recentDesk(1500, undefined, { events: false, desk: "gaza" });
  // The cards as served (audit of 24 Oct): a card the serve rules hide never feeds the brief, and a lead swapped by them is cited.
  const served = (reports as unknown as LiveReport[]).filter((r) => serveCard(r as unknown as Record<string, unknown>, "gaza"));
  // A quiet window reads further back, so a night never leaves a list of one point.
  const start = saved ? briefStart(served.map((r) => Date.parse(String(r.at || ""))), Date.parse(w.startedAt), end) : end - 24 * 3600_000;
  const inWin = (at: string) => {
    const t = Date.parse(at);
    return Number.isFinite(t) && t >= start && t < end;
  };
  // A talk already told in the week before is not news again (told-before.ts, 29 Oct).
  const cards = newsOnly(served.filter((r) => inWin(String(r.at || ""))), served, start);
  const feed = (await store.getJson<TrumpFeed>(TRUMP_KEY)) ?? { statements: [] };
  const trump = feed.statements.filter((s) => !s.off && !s.in && inWin(s.at) && ABOUT_GAZA.test(`${s.headline ?? ""} ${s.text ?? ""}`));

  const { lines, refOf } = writerInput(cards, trump);
  let answer: { json: Record<string, unknown>; model: string } | null = null;
  if (lines.length) answer = await askChain("gaza-brief", SYSTEM, ["REPORTS:", ...lines].join("\n"), { models: GAZA_WRITERS, timeoutMs: 120_000, accept: (j) => gazaUnusable(j, refOf, lines.length) });
  const got = answer ? fromGazaAnswer(answer.json, refOf) : {};

  const old = new Map((saved?.areas ?? []).map((a) => [a.id, a]));
  const areas: AreaBrief[] = GAZA_AREAS.map((a) => {
    const fresh = got[a.id];
    if (fresh) return { id: a.id, name: a.name, ...fresh, lastNewsAt: w.updatedAt };
    // Nothing new here: the last points stand, with the time they were news.
    const o = old.get(a.id);
    return o ? { ...o, name: a.name } : { id: a.id, name: a.name, points: [], refs: [] };
  });
  // No writer at all: the strongest headlines, each with its own card, under Gaza.
  if (!answer && cards.length && !areas.some((a) => a.points.length)) {
    const fb = headlinePoints(topReports(cards, 5));
    areas[0] = { ...areas[0], points: fb.points.map(gazaWords), refs: fb.refs, lastNewsAt: w.updatedAt };
  }
  // The joint list the All page and the share text read: each area's fresh points, numbered again in one run.
  const joint = { points: [] as string[], refs: [] as Ref[] };
  for (const a of areas.filter((x) => x.lastNewsAt === w.updatedAt)) {
    const off = joint.refs.length;
    joint.points.push(...a.points.map((p) => p.replace(/\[\[(\d+)\]\]/g, (_m, n) => `[[${Number(n) + off}]]`)));
    joint.refs.push(...a.refs);
  }
  const brief: GazaBrief = {
    ok: true,
    desk: "gaza",
    cadenceHours: HOURS,
    updatedAt: w.updatedAt,
    nextUpdateAt: w.nextUpdateAt,
    windowStart: w.startedAt,
    situation: { line: joint.points.map(stripRefs).join("\n\n"), points: joint.points, refs: joint.refs, ...(answer ? { model: answer.model } : {}) },
    areas,
    proseTriedAt: now.toISOString(),
  };
  await store.putJson(GAZA_BRIEF_KEY, brief);
  // The Timeline's "Now" box, rewritten every 36 hours from the cards; it must never cost the brief.
  try {
    await refreshGazaTimelineNow(store, reports as unknown as LiveReport[], now);
  } catch (err) {
    console.error("[gaza-timeline-now]", err instanceof Error ? err.message : err);
  }
  console.log(`[gaza-brief] ${w.updatedAt}: ${cards.length} cards, ${trump.length} Trump statements, ${answer ? `written by ${answer.model}` : "no writer"}, ${Object.keys(got).length} lists new`);
  return brief;
}
