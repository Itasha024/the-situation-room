/**
 * The Gaza desk's researched numbers (public/gaza-numbers.json) kept current from its own reports (user, 27 Oct:
 * "make sure all the numbers … update automatically"): every 6 hours one model call reads the reports since the
 * last reading for the boxes' figures, and code keeps only what the cited report bears out — the Iran desk's rules
 * (iran-live-model.ts applyAnswer): every number of a figure is in that report, it is newer than the figure it
 * replaces, an official column takes only an official body's count, a count moves down only when its own body
 * revises it. Lists (decisions, dates, cells foiled) are not touched: they need a person's reading.
 *
 * /api/gaza-numbers serves the moved boxes with their set's key; the page puts a live box in place of the
 * researched one of its title (public/app.js gazaSets). Server-only.
 */

import { askChain, NUMBERS_MODELS } from "./models.ts";
import type { LiveReport } from "./types.ts";
import type { DeskStore } from "./store.ts";
import { type Box, emptyLive, type IranLive, type NumbersFile, putBox } from "./iran-live.ts";
import { applyAnswer, type Doc, type ModelAnswer, slotsOf, userMessage } from "./iran-live-model.ts";
import { gazaWords } from "./gaza-words.ts";
import GAZA_NUMBERS from "../../../public/gaza-numbers.json" with { type: "json" };

export const GAZA_LIVE_KEY = "gaza:live";
const EVERY_MS = 6 * 3600_000;
const RETRY_MS = 3600_000;
/** The Gaza tables' columns that are not a figure: the row's span, a note, a date, a state in words. */
export const GAZA_NOW_COL = /^(?!(?:Time span|Note|Since \/ as of|When|Paid on|As of|Latest step|Status)$)./;

const SUBJECT = /\bkill|dead|death|wound|injur|casualt|toll|truck|aid|crossing|evacuat|arrest|demoli|displac|permit|housing units?|outpost|attacks?\b|foiled|seiz|weapons?|clearance|salar|budget|deficit|debt|shekels?|NIS|\$|dollars?|euros?|donor|troops|stabili[sz]ation|Board of Peace|ISF|committee|recogni[sz]|poll|percent|%|sanction|UNRWA|tonnes|IPC|famine|workers|reconstruction|يوم|شهيد|جريح|شاحنة|معبر|اعتقال|هدم|رواتب|المقاصة/i;

/** The reports that may hold a figure of the boxes: a number and a subject. */
export function gazaDocs(reports: LiveReport[], since: number, limit = 60): Doc[] {
  return reports
    .filter((r) => {
      const t = Date.parse(String(r.at || ""));
      const text = `${r.summary || ""} ${r.text || ""}`;
      return Number.isFinite(t) && t >= since && /\d/.test(text) && SUBJECT.test(text);
    })
    .sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))
    .slice(0, limit)
    .map((r, id) => ({ id, at: String(r.at), source: String(r.source || ""), url: String(r.url || ""), text: `${r.summary || ""}. ${r.text || ""}`.replace(/\s+/g, " ").slice(0, 700) }));
}

export const GAZA_SYSTEM = `You keep the figures of a news desk's numbers panel on Gaza and Judea and Samaria since the ceasefire of 10 October 2025: casualties, aid and the crossings, the day after (the stabilization force, the Board of Peace, the committee, reconstruction, the share of Gaza the IDF holds), security (arrests, weapons, attacks and attacks foiled), Judea and Samaria (extremists' violence, demolitions, housing units, permits), the Palestinian Authority (polls, elections, its money, the clearance revenues, salaries, debts) and sanctions.
You get SLOTS (each a figure on the panel, with the figure it shows now and its date) and REPORTS (each with an index, its time and its text).
Return "updates": a slot's NEW figure only when a report states it explicitly, newer than the figure shown, for exactly what the slot measures (same place, same thing, same unit, same start or period as the slot's figure). Write the value as the panel writes it ("1,551", "NIS 3.2bn", "60%", "up to 400"). "official": true only when a government, a ministry, the IDF, COGAT, the Shin Bet, the police, the UN or its agencies, the World Bank, the IMF or a statistics bureau issued the figure. "source": that body or outlet. A "New bar" slot takes a figure for a period after the last bar's: give "period" ("October", "Q3 2026").
Never estimate, never add numbers up, never take a figure from a different start, period or place. A day's toll is not a running count. If nothing fits, return an empty list.
Return JSON {"updates":[{"slot":"3.4.off","value":"1,551","official":true,"source":"Gaza Health Ministry","doc":12}]}`;

type GazaFile = NumbersFile;
const FILE = GAZA_NUMBERS as unknown as GazaFile;

/** The set each researched box belongs to, by title. */
export function setOfTitle(file: GazaFile = FILE): Map<string, string> {
  return new Map(file.sets.flatMap((s) => s.boxes.map((b) => [b.title, s.key] as [string, string])));
}

/** The boxes the model may move: figures only, never lists. */
const movable = (b: Box) => b.type === "claims" || b.type === "table" || b.type === "stat" || b.type === "bars";

/** Apply the model's answer: the boxes that changed, in the desk's words. Pure. */
export function applyGaza(boxes: Box[], answer: ModelAnswer, docs: Doc[], now: Date): Box[] {
  return applyAnswer(boxes, { updates: answer.updates ?? [] }, docs, now, GAZA_NOW_COL).map((b) => JSON.parse(JSON.stringify(b), (k, v) => (typeof v === "string" && k !== "url" ? gazaWords(v) : v)) as Box);
}

/** Every 6 hours: the reports since the last reading (at most a day and a half), read for the panel's figures. */
export async function refreshGazaNumbers(store: DeskStore, now = new Date(), file: GazaFile = FILE): Promise<Box[] | null> {
  const live: IranLive = { ...emptyLive(), ...((await store.getJson<IranLive>(GAZA_LIVE_KEY)) ?? {}) };
  const last = Date.parse(live.tried.model || "");
  if (Number.isFinite(last) && now.getTime() - last < EVERY_MS) return null;
  const read = Date.parse(String(live.meta.modelRead || ""));
  const since = Math.max(Number.isFinite(read) ? read - 3600_000 : 0, now.getTime() - 36 * 3600_000);
  const { reports } = await store.recentDesk(600, undefined, { events: false, desk: "gaza", floor: new Date(since).toISOString() });
  const boxes = file.sets.flatMap((s) => s.boxes).filter(movable).map((b) => live.boxes[b.title] ?? b);
  const docs = gazaDocs(reports as unknown as LiveReport[], since);
  let got: Box[] | null = [];
  if (docs.length) {
    const ans = await askChain("gaza-numbers", GAZA_SYSTEM, userMessage(slotsOf(boxes, GAZA_NOW_COL), docs), { temperature: 0, models: NUMBERS_MODELS, timeoutMs: 150_000 }).catch(() => null);
    got = ans ? applyGaza(boxes, ans.json as ModelAnswer, docs, now) : null;
  }
  live.tried.model = new Date(got ? now.getTime() : now.getTime() - EVERY_MS + RETRY_MS).toISOString();
  if (got) {
    live.meta.modelRead = now.toISOString();
    for (const b of got) putBox(live, b, now);
    console.log(`[gaza-numbers] ${docs.length} reports, ${got.length} boxes moved: ${got.map((b) => b.title).join(", ") || "none"}`);
  }
  live.updatedAt = now.toISOString();
  await store.putJson(GAZA_LIVE_KEY, live);
  return got;
}

/** The moved boxes as /api/gaza-numbers serves them: each with its set's key, so the page puts it in place. */
export function liveGazaBoxes(live: IranLive | null, file: GazaFile = FILE): Box[] {
  if (!live) return [];
  const setOf = setOfTitle(file);
  return Object.values(live.boxes).flatMap((b) => (setOf.has(b.title) ? [{ ...b, set: setOf.get(b.title) }] : []));
}
