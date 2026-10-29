/**
 * The Iran desk's 3-hour brief (Round 30 stage 6; user, 9 Oct): "Latest
 * developments" and the eight arenas, each a numbered list, most important
 * first, every point with references to the reports it rests on (refs.ts).
 * Server-only.
 *
 * One writing call per window, from the window's Iran cards and Trump's own
 * statements in it. Built at 00, 03, 06 … Israel time, by the Iran cycle; a
 * window no model wrote is asked again every 10 minutes. An arena with nothing
 * new keeps its last points, marked with when they were news. The NVIDIA
 * models lead, so Google's small daily share stays the Yemen desk's.
 */

import { newsOnly } from "./told-before.ts";
import { serveCard } from "./copy-rules.ts";
import { askChain, type ChainModel, WRITER_MODELS } from "./models.ts";
import { refreshIranTimelineNow } from "./iran-timeline-now.ts";
import { briefStart, briefWindow, freshPoints, markTold, sixHourMark, TOLD_TAG, toldBefore } from "./brief.ts";
import { cleanPoints, onePointEach, oncePer } from "./prose.ts";

export { oncePer };
import { headlinePoints, NUM_MARK, numberRefs, type Ref, refOfReport, stripRefs } from "./refs.ts";
import { isWireSource, namesNation, sourceNation, subjectNation } from "./speaker-press.ts";
import { yemenOnly } from "./iran-reader.ts";
import type { DeskStore } from "./store.ts";
import { shownCard, TRUMP_KEY, type TrumpFeed, type TrumpStatement } from "./trump.ts";
import type { LiveReport } from "./types.ts";
import { topReports } from "./brief-store.ts";
import { dropEmpty, rankPoints } from "./rank-points.ts";

export const IRAN_BRIEF_KEY = "brief:iran";
const HOURS = 3;

/** The arenas (user, 9 Oct evening: Hormuz first and "Military campaign" folded into it; "The U.S." one arena; Lebanon in place of Israel). iran-desk.tsx carries the same names. */
export const ARENAS: { id: string; name: string; about: string }[] = [
  { id: "hormuz", name: "Strait of Hormuz", about: "The war at sea and around the Gulf: ship attacks, seizures and fires, the US blockade, Iran's rules for passage, mines, transits, escorts, insurance, strikes and interceptions around the strait and the Gulf states." },
  { id: "talks", name: "Talks", about: "Iran–US, Oman, Qatar and any other channel; the MoU's terms; mediators' statements." },
  { id: "nuclear", name: "Nuclear file", about: "The IAEA, enrichment, the sites, inspections, NPT moves." },
  { id: "inside-iran", name: "Inside Iran", about: "Fuel and gas, the economy and the rial, imports and exports, protests, arrests, executions, power struggles." },
  { id: "sanctions", name: "Sanctions", about: "New US, EU and UN sanctions, waivers, enforcement, shadow-fleet seizures." },
  { id: "lebanon", name: "Lebanon", about: "Israel's strikes and ground war in Lebanon, Hezbollah's attacks and everything else Hezbollah does, the Lebanese dead and wounded, Israeli–Lebanese talks and the ceasefire there, Lebanon's government on the war." },
  { id: "axis", name: "Axis of Resistance", about: "The Iraqi and Syrian militias, the Houthis' Iran side, Iran's ties with its allies. Hezbollah is Lebanon's arena." },
  { id: "us", name: "The U.S.", about: "What the US itself does and says on the war: its forces, bases, warships and the blockade's enforcement, its arms deals and dealings with the Gulf states, Iraq and Israel; and at home: Congress, war powers, polls, gasoline prices, voices for and against the war." },
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

/**
 * Gemini 3.5 Flash first (Nemotron's first brief repeated points and named outlets, 9 Oct), then
 * NVIDIA; the two newest Flash models stay the Yemen desk's update share.
 */
const IRAN_WRITERS: ChainModel[] = [WRITER_MODELS[2], ...WRITER_MODELS.slice(3)];
const RETRY_MS = 10 * 60_000;

const SYSTEM = `You are the editor of a live news desk on the Iran war (the US–Iran war since 28 February 2026: the strikes, the Strait of Hormuz, the talks, the nuclear file, sanctions, Iran's allies, and the war at home in Iran, the US, Israel and the Gulf).
You get the reports published since the last update (at least the last ${HOURS} hours, more when it was quiet), and Trump's own statements on Iran in that time. Each line is: [its id] outlet (its group): headline — body. Trump's own statements have the ids t1, t2…
Write in English wire style (Reuters/AP):
- "points": the latest developments of these hours as a numbered list for a reader with a minute: 4-8 points (fewer only when less happened: only what is important and interesting since the last update, never padding), each ONE development in 1-2 short sentences (at most 40 words), ordered from the most important to the least. Importance is what changes the war most. A point with no new fact (someone condemned, congratulated, discussed "regional issues", expressed support or solidarity, or a general statement) is the least important and is left out whenever there are points with a fact. What a leader or government actually said or decided outranks reports of what they might do: Trump's own words on Iran usually come first, unless they are minor. Strikes and their deaths, attacks at sea, decisions on war and on talks come before reactions, commentary and local items, which come last or are left out. Two reports of one event are one point.
- "arenas": for each arena id below, a list of 0-8 points on that arena (up to 8 only when that many important, interesting things happened there since the last update) from these hours, most important first, written the same way. Only reports that belong to that arena; [] when none does. A report goes in the one arena it is most about (two at most): Trump's words go where their subject is, not in every arena. Commentary and analysis go nowhere.
ARENAS:
${ARENAS.map((a) => `- ${a.id} = ${a.name}: ${a.about}`).join("\n")}
In every point, after the words each report supports, put that report's id in square brackets, before the full stop: "The IRGC Navy seized a tanker off Fujairah [r4]." Every point carries at least one id, and only ids from the lines given. When several reports tell the same fact, give the id of ONE: the speaker's or the country's own account first (Trump's own post for his words, the US Treasury for its sanctions, the IDF for Israel's army, Iran's own agencies for Iran's officials), then a wire agency, then the fullest report. Connected reports make one point (user, 29 Oct): several things one speaker said, or one event told in steps, are joined into one point, each fact followed by its own report's id ("Araghchi: Iran will not talk under threat [r3]; the Strait stays open to neutral ships [r7]."), Like events are grouped too (user, 29 Oct): several strikes, raids or attacks by one side in one area (Israeli fire across Gaza, raids across Judea and Samaria, Saudi strikes on several districts, Russian or US statements on one subject) are ONE short point with each place's or fact's id ("Israeli strikes and fire killed five across Gaza: in Khan Yunis [r2], al-Maghazi [r5] and Gaza City [r9]."), never one point each, so they never push out other news. Up to six ids in a point, one for each different fact.
Rules:
- Only facts in the reports. Never invent a place, number, name or claim.
- A report marked \"(told in an earlier brief)\" was in an earlier brief: never a point of its own, only background to a new one. Fewer points rather than old ones.
- A point tells what happened, in the past tense: "Israeli forces conducted explosions", never "conduct". What a speaker said keeps "Speaker: …".
- Only what is worth a brief: never a drone or aircraft seen overhead with nothing hit, a road closed, a routine raid or arrest with no one hurt, or a feature story (community kitchens, a family's story). Fewer points rather than these.
- Name no outlet and never open a point with "X reported": the reference shows the source. Write the point in your own words, never a headline and body glued together. Every point ends with a full stop. At most 40 words. What someone said opens with the speaker and a colon ("US official: …"); never "Speaker: it …": an act of speech is the speaker's own ("Hamas called on the UN to …"), and a deed the speaker claims is told as its claim ("IRGC Navy says it struck two LPG carriers south of Hormuz and blames US forces."); never drop the speaker, or a statement reads as fact, and keep its reason or condition ("German FM Wadephul: Germany, France and Britain are ready to negotiate with Iran to keep it from nuclear weapons.", never "France, Britain and Germany are ready to negotiate with Iran."); after the colon write whole sentences, every verb with its subject ("IRGC Navy: seven oil tankers were damaged in Hormuz overnight; it will strike US bases if the US keeps escorting ships.", never "…were damaged overnight, and threatened to strike…"); a well-known person by name alone ("Vance: …", "Araghchi: …"), never "US official Vance"; a side's claim is never plain fact. A fact reported by both sides, a wire agency or an official body is plain fact.
- ONE point per event and per speaker: an attack with its claims, blame and threats is one point; everything one person or body said in these hours on one subject is one point (two remarks by the Treasury Secretary on the blockade are one). Never two points that tell the same thing, in a list or across the arenas.
- Each country's words and acts are cited from its own sources or a wire: the IDF, Israeli officials and Israeli media for Israel; Lebanese sources for Israel's strikes in Lebanon; Trump's own post and US officials for the US; Iran's officials and agencies for Iran. Another country's outlet retelling them is never cited, unless it is that outlet's own exclusive. A point with no such report is left out.
- The Houthis' war with Saudi Arabia and Yemen's own fronts go nowhere: they are the Yemen desk's.
- Never write about what was NOT reported or did not change. Neutral wording, no side's labels ("Zionist regime", "martyrs", "aggression", "terrorists" for a state's forces).
- No clock times. Keep every figure exact. Never mention the desk, reports, cards or "the window". No hype.
- Past tense for events, present for the state of play.
Return ONLY JSON {"points":["..."],"arenas":{"<id>":["..."]}}.`;

/** The cards and Trump's statements of the window, as the writer's lines and the reference each id stands for. */
export function writerInput(reports: LiveReport[], trump: TrumpStatement[], told: Set<string> = new Set()): { lines: string[]; refOf: Record<string, Ref> } {
  const refOf: Record<string, Ref> = {};
  const lines: string[] = [];
  const cards = [...reports].filter((r) => r.summary).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-160);
  cards.forEach((r, i) => {
    const id = `r${i + 1}`;
    refOf[id] = refOfReport(r);
    const lean = (r as LiveReport & { lean?: string }).lean;
    const body = String(r.text || "").replace(/\s+/g, " ").slice(0, 200);
    lines.push(`[${id}] ${r.source}${lean ? ` (${lean})` : ""}${told.has(String(r.fp)) ? TOLD_TAG : ""}: ${r.summary}${body ? ` — ${body}` : ""}`);
  });
  [...trump].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).forEach((s, i) => {
    const id = `t${i + 1}`;
    const shown = shownCard({ headline: s.headline || `Trump: ${s.text}`, body: s.body });
    refOf[id] = { fp: s.id, source: s.source, at: s.at, url: s.url, headline: shown.headline, ...(shown.body ? { body: shown.body } : {}), trump: true };
    lines.push(`[${id}] Trump (${s.source})${told.has(s.id) ? TOLD_TAG : ""}: ${shown.headline}${s.text ? ` — ${s.text.replace(/\s+/g, " ").slice(0, 400)}` : ""}`);
  });
  return { lines, refOf };
}

/** Words that say who a speaker is without naming them: not enough to show the point keeps the speaker. */
const ROLE_WORD = /^(?:Foreign|Minister|Ministry|Defence|Defense|Prime|President|Spokesman|Spokesperson|Official|Officials|Senior|Deputy|Chief|Head|Envoy|Ambassador|Secretary|State|General|Commander|Office|The)$/;

/**
 * A point keeps who said it (user, 23 Oct: "France, Britain, and Germany are
 * ready to negotiate with Iran" lost the German FM, so it read as fact). When
 * the report it cites opens with a speaker and the point names none of them,
 * the speaker opens the point.
 */
export function keepSpeaker(point: string, refOf: Record<string, Ref>): string {
  if (/^[^:]{2,60}:\s/.test(stripRefs(point))) return point;
  const id = /\[([rt]\d+)\]/i.exec(point)?.[1]?.toLowerCase();
  const ref = id ? refOf[id] : undefined;
  if (!ref || ref.trump) return point;
  const lead = /^([^:]{2,60}):\s/.exec(ref.headline ?? "")?.[1]?.trim();
  if (!lead || lead.toLowerCase() === String(ref.source).toLowerCase() || /\b(?:reports?|breaking|urgent|exclusive|watch|video)\b/i.test(lead)) return point;
  const names = (lead.match(/[A-Z][\w'’.-]*/g) ?? []).filter((w) => !ROLE_WORD.test(w));
  const text = stripRefs(point);
  if (names.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text))) return point;
  if (!names.length && text.toLowerCase().includes(lead.toLowerCase())) return point;
  return `${lead}: ${point}`;
}

/** The writer's answer as the brief's lists; null parts mean the writer gave nothing usable. */
export function fromAnswer(j: Record<string, unknown>, refOf: Record<string, Ref>): { situation: { points: string[]; refs: Ref[] } | null; arenas: Record<string, { points: string[]; refs: Ref[] }> } {
  // Each country's words and acts from its own sources (user, 9 Oct): never Iran's outlets retelling America or Israel.
  const look = (id: string, point = "") => ownRef(point, refOf[id]);
  const outlets = Object.values(refOf).map((r) => r.source);
  const pts = marked(numberRefs(rankPoints(onePointEach(cleanPoints(j.points, 10).filter((p) => !yemenOnly(stripRefs(p))).map((p) => keepSpeaker(p, refOf)), outlets)), look));
  const aj = (j.arenas && typeof j.arenas === "object" ? j.arenas : {}) as Record<string, unknown>;
  const arenas: Record<string, { points: string[]; refs: Ref[] }> = {};
  // A report serves two arenas at most: Trump's one post was in five (9 Oct).
  const uses = new Map<string, number>();
  for (const a of ARENAS) {
    const own = dropEmpty(onePointEach(cleanPoints(aj[a.id], 8).map((p) => keepSpeaker(p, refOf)), outlets).filter((p) => fits(a.id, stripRefs(p)))).filter((p) => {
      const ids = [...p.matchAll(/[rt]\d+/gi)].map((m) => m[0].toLowerCase());
      if (ids.length && ids.every((id) => (uses.get(id) ?? 0) >= 2)) return false;
      for (const id of ids) uses.set(id, (uses.get(id) ?? 0) + 1);
      return true;
    });
    // Lebanon's arena cites Lebanon's own sources, Israel's for Israel's acts, a wire, or an exclusive (user, 9 Oct).
    const got = marked(numberRefs(own.slice(0, 8), a.id === "lebanon" ? (id, p) => israelRef(look(id, p)) : look));
    // A point with no reference the writer could show is not kept in an arena.
    if (got.points.length && got.refs.length) arenas[a.id] = got;
  }
  return { situation: pts.points.length ? pts : null, arenas };
}

const TOPIC: Record<string, RegExp> = {
  sanctions: /\b(?:sanction\w*|designat\w*|blacklist\w*|OFAC|Treasury|embargo\w*|asset freeze|waiver\w*|seiz\w+|confiscat\w+)\b/i,
  nuclear: /\b(?:nuclear|enrich\w*|uranium|IAEA|Grossi|atomic|NPT|Fordow|Natanz|Isfahan|Arak|centrifuge\w*|inspect\w*|safeguards)\b/i,
  hormuz: /\b(?:Hormuz|strait|tanker\w*|ship\w*|vessel\w*|maritime|mine[sd]?|UKMTO|Gulf of Oman|Persian Gulf|Musandam|navy|naval|escort\w*|transit\w*|insur\w+|cargo|crew|blockade\w*|ports?|carriers?|LPG|LNG|oil exports?)\b/i,
  lebanon: /\b(?:Leban\w*|Hezbollah|Beirut|Dahieh|Litani|UNIFIL|Nabatieh|Tyre|Sidon|Bekaa|Baalbek|Hermel|Qassem|Aoun|Berri|Nawaf Salam)\b/i,
};

/** What each arena takes, in code (first-brief review, 9 Oct): the Yemen desk's war goes nowhere; "The U.S." is the US's own doing. */
export function fits(arena: string, point: string): boolean {
  if (yemenOnly(point)) return false;
  if (arena === "us") return namesNation("us", point);
  // An arena on one subject takes only points that name it (a blockade point sat under Sanctions, 9 Oct).
  const topic = TOPIC[arena];
  return !topic || topic.test(point);
}

/** A report Lebanon's arena may cite: Lebanon's own sources, Israel's, a wire, or any outlet's exclusive. Never Iran's outlets retelling either. */
export function israelRef(ref: Ref | undefined): Ref | undefined {
  if (!ref) return undefined;
  if (ref.excl || isWireSource(ref.source)) return ref;
  const n = sourceNation(ref.source, ref.lean ?? "");
  return n === "israel" || n === "lebanon" || n === "us" ? ref : undefined;
}

/**
 * A report a point may cite: America's and Israel's words and acts are never
 * cited from Iran's outlets (Al-Alam telling a US congressman's call, 9 Oct),
 * unless the point is about Iran's own ground (a strike on Isfahan) and no one
 * is quoted; a wire or an exclusive always may.
 */
export function ownRef(point: string, ref: Ref | undefined): Ref | undefined {
  if (!ref || ref.trump || ref.excl || isWireSource(ref.source)) return ref;
  const text = stripRefs(point);
  const subj = subjectNation(text);
  if (subj !== "us" && subj !== "israel") return ref;
  if (sourceNation(ref.source, ref.lean ?? "") !== "iran") return ref;
  const quoted = /\b(?:said|says|told|stated|called|calls|warned|announced|confirmed|claimed|added|urged|pledged|vowed|denied)\b/i.test(text);
  return !quoted && namesNation("iran", text) ? ref : undefined;
}

/**
 * Why a writer's answer cannot be used, or null (user, 12 Oct: one point held the whole window, with
 * made-up ids "[snn]", "[irib]"): an id not given, or one point for a window of many reports.
 */
export function unusable(j: Record<string, unknown>, refOf: Record<string, Ref>, nLines: number): string | null {
  const raw = Array.isArray(j.points) ? j.points.map(String) : [];
  const bad = raw.flatMap((p) => [...p.matchAll(/\[([^\]\s]{1,12})\]/g)].map((m) => m[1])).filter((id) => !/^\d+$/.test(id) && !refOf[id.toLowerCase()]);
  if (bad.length) return `ids not given: ${bad.slice(0, 4).join(", ")}`;
  const got = fromAnswer(j, refOf).situation;
  if (!got) return "no usable points";
  if (nLines >= 8 && got.points.length < 3) return `${got.points.length} point(s) for ${nLines} reports`;
  return null;
}

/** Only points that kept a reference. */
function marked(x: { points: string[]; refs: Ref[] }): { points: string[]; refs: Ref[] } {
  return { points: x.points.filter((p) => new RegExp(NUM_MARK.source).test(p)), refs: x.refs };
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
  const end = Date.parse(w.updatedAt);
  const { reports } = await store.recentDesk(1500, undefined, { events: false, desk: "iran" });
  // The cards as served (audit of 24 Oct): a card the serve rules hide never feeds the brief, and a lead swapped by them is cited.
  const served = (reports as unknown as LiveReport[]).filter((r) => serveCard(r as unknown as Record<string, unknown>, "iran"));
  // A quiet window reads further back (gaza-brief.ts, 27 Oct).
  // The arenas are written at the 6-hour marks only, from the last 6 hours (user, 27 Oct); the points every 3.
  const six = sixHourMark(w.updatedAt);
  const start = saved ? Math.min(briefStart(served.map((r) => Date.parse(String(r.at || ""))), Date.parse(w.startedAt), end), six ? end - 6 * 3600_000 : Infinity) : end - 24 * 3600_000;
  const inWin = (at: string) => {
    const t = Date.parse(at);
    return Number.isFinite(t) && t >= start && t < end;
  };
  // A talk already told in the week before is not news again (told-before.ts, 29 Oct).
  const cards = newsOnly(served.filter((r) => inWin(String(r.at || ""))), served, start);
  const feed = (await store.getJson<TrumpFeed>(TRUMP_KEY)) ?? { statements: [] };
  const trump = feed.statements.filter((s) => !s.off && !s.in && inWin(s.at));

  // A report goes in one brief only (user, 29 Oct): the points and the arenas each keep their own record.
  const told = await toldBefore(store, "iran", w.updatedAt);
  const toldArenas = await toldBefore(store, "iran-arenas", w.updatedAt);
  const { lines, refOf } = writerInput(cards, trump, told);
  let answer: { json: Record<string, unknown>; model: string } | null = null;
  if (lines.length) answer = await askChain("iran-brief", SYSTEM, ["REPORTS:", ...lines].join("\n"), { models: IRAN_WRITERS, timeoutMs: 120_000, accept: (j) => unusable(j, refOf, lines.length) });
  const got = answer ? fromAnswer(answer.json, refOf) : { situation: null, arenas: {} };
  if (got.situation) got.situation = freshPoints(got.situation, told);
  for (const id of Object.keys(got.arenas)) {
    got.arenas[id] = freshPoints(got.arenas[id], toldArenas);
    if (!got.arenas[id].points.length) delete got.arenas[id];
  }

  // No writer: the strongest headlines as the points, each with its own card.
  const fallback = cards.some((r) => !told.has(String(r.fp))) ? headlinePoints(topReports(cards.filter((r) => !told.has(String(r.fp))), 5)) : null;
  const situation = got.situation?.points.length
    ? { line: got.situation.points.map(stripRefs).join("\n\n"), ...got.situation, model: answer!.model }
    : fallback
      ? { line: fallback.points.map(stripRefs).join("\n\n"), ...fallback }
      : { line: "", points: [], refs: [] };
  const old = new Map((saved?.arenas ?? []).map((a) => [a.id, a]));
  const arenas: ArenaBrief[] = ARENAS.map((a) => {
    const fresh = got.arenas[a.id];
    const o = old.get(a.id);
    if (fresh && (six || !o?.points?.length)) return { id: a.id, name: a.name, ...fresh, lastNewsAt: w.updatedAt };
    // Between the 6-hour marks the arena's last points stand: it is still that arena's one brief. At a mark with
    // nothing new it is left empty: a report is in one brief only (user, 29 Oct).
    return o && !six ? { ...o, name: a.name } : { id: a.id, name: a.name, points: [], refs: [] };
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
  await markTold(store, "iran", situation.points, situation.refs, w.updatedAt);
  for (const a of arenas) if (a.lastNewsAt === w.updatedAt) await markTold(store, "iran-arenas", a.points, a.refs, w.updatedAt);
  // The Timeline's "Now" box, rewritten every 36 hours from the cards; it must never cost the brief.
  try {
    await refreshIranTimelineNow(store, reports as unknown as LiveReport[], now);
  } catch (err) {
    console.error("[iran-timeline-now]", err instanceof Error ? err.message : err);
  }
  console.log(`[iran-brief] ${w.updatedAt}: ${cards.length} cards, ${trump.length} Trump statements, ${answer ? `written by ${answer.model}` : "no writer"}, ${Object.keys(got.arenas).length} arenas new`);
  return brief;
}
