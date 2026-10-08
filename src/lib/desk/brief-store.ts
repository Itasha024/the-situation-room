/**
 * The stored 6-hour brief. Server-only.
 *
 * WHY THIS EXISTS: the brief used to be built inside the `/api/brief` route,
 * on the first page view after a window closed. Two things followed from that:
 *
 *   1. With nobody visiting, no brief was built — the general status, fronts
 *      and numbers only moved when a browser asked, and a window nobody looked
 *      at left no history, so the next brief compared itself against whatever
 *      stale window happened to be stored.
 *   2. It counted `scan.reports` — the LAST CYCLE's reports only — so "the 12
 *      hours to 12:00" really meant "the last five minutes before someone
 *      opened the page".
 *
 * Now the clock builds it (`runScanCycle` calls `refreshBrief` every tick; it
 * is a no-op until a window closes), from everything the desk accumulated in
 * the window. The route only reads.
 */

import { oldPicture } from "./pin-rule.ts";
import type { LiveReport } from "./types.ts";
import { type Brief, type BriefHistory, buildBrief, briefWindow, coveredByTrackedFront, frontIdsOf, inFrontArea } from "./brief.ts";
import { type ExtraFront, EXTRA_FRONTS_KEY, updateExtraFronts } from "./new-fronts.ts";
import { battleFirst, controlContext, isOther, keepReported, type DevMark, type Prose, writeProse } from "./prose.ts";
import { anyAwake, type ChainModel, WRITER_MODELS } from "./models.ts";
import type { DeskStore } from "./store.ts";
import { refreshClaims, refreshTally } from "./tally.ts";
import { refreshLedger } from "./ledger.ts";
import { CONTROL_LIVE_KEY, type ControlLive, mergedControl, updateControlLive } from "./control-live.ts";
import { refreshTimelineNow } from "./timeline-now.ts";
import { placeKey, placeProse } from "./prose-places.ts";
import { placesIn } from "./gazetteer.ts";
import { addMark, cardMarks, type Launch, launchFor, nearAny } from "./dev-marks.ts";

export const BRIEF_KEY = "brief";

export type StoredBrief = { brief: Brief; history: BriefHistory };

/** Enough rows to cover a busy 6-hour window with the caps raised. */
const WINDOW_ROWS = 3000;

/**
 * Return the brief for the current window, building and storing it first if
 * the stored one belongs to an earlier window. Safe to call every tick.
 */
export async function refreshBrief(
  store: DeskStore,
  now = new Date(),
  { retryProse = false }: { retryProse?: boolean } = {},
): Promise<{ brief: Brief; built: boolean }> {
  const w = briefWindow(now);
  const saved = (await store.getJson<StoredBrief>(BRIEF_KEY)) ?? null;
  // Only the clock (the tick) arms the early writing, never a page visit.
  if (retryProse) armClock(store, w);
  if (saved?.brief?.updatedAt === w.updatedAt) {
    // Only the clock asks again (a model call is too slow for a page visit).
    if (!retryProse || !proseDue(saved.brief, now)) return { brief: saved.brief, built: false };
    // After the first two hours only the strong writers are asked, and only once one is back (Google's reset).
    const late = now.getTime() - Date.parse(saved.brief.updatedAt) >= RETRY_FOR_MS;
    if (late && !anyAwake(STRONG_MODELS, now.getTime())) return { brief: saved.brief, built: false };
    // A backup writer's text already stands: only a strong writer can better it.
    const strongOnly = late || !!saved.brief.situation?.model;
    return { brief: await reprose(store, saved, now, false, strongOnly ? STRONG_MODELS : WRITER_MODELS), built: false };
  }

  // One build at a time: while it waits for a strong writer, visits get the last window.
  if (building && saved) return { brief: saved.brief, built: false };
  if (building) return building;
  building = buildWindow(store, now, w, saved).finally(() => {
    building = null;
  });
  return building;
}

let building: Promise<{ brief: Brief; built: boolean }> | null = null;

/* ------------------------------------------------------------------ *
 * Written before the hour
 *
 * The prose of the window that closes at 00/06/12/18 is written early, from
 * the cards logged so far, so it is ready at the round time. The lead is how
 * long the writers took last time (with room for a busy minute), between 12
 * and 20 minutes, so a busy Google leaves time for NVIDIA. At the hour the
 * brief is built from every card of the window, takes that prose and is stored
 * at once, never held for a better writer: the clock asks again later (2 Oct:
 * the 12:00 update waited 5 minutes for Google's busy models). Cards of the
 * last minutes still count in the numbers, the maps and the fronts' marks.
 * ------------------------------------------------------------------ */

const PROSE_MS_KEY = "brief-prose-ms";
const LEAD_MIN_MS = 12 * 60_000;
const LEAD_MAX_MS = 20 * 60_000;
let armedFor = "";
let pre: { updatedAt: string; job: Promise<Prose | null> } | null = null;

function armClock(store: DeskStore, w: ReturnType<typeof briefWindow>): void {
  if (armedFor === w.nextUpdateAt) return;
  armedFor = w.nextUpdateAt;
  const at = Date.parse(w.nextUpdateAt);
  void (async () => {
    const took = (await store.getJson<number>(PROSE_MS_KEY).catch(() => null)) ?? 5 * 60_000;
    const lead = Math.min(LEAD_MAX_MS, Math.max(LEAD_MIN_MS, took * 1.3 + 90_000));
    const wait = at - lead - Date.now();
    if (wait < 0) return;
    setTimeout(() => {
      const next = briefWindow(new Date(at + 1000));
      pre = { updatedAt: next.updatedAt, job: prewrite(store, next, at).catch(() => null) };
    }, wait).unref?.();
    // Published on the hour itself, not at the next tick.
    setTimeout(() => void refreshBrief(store, new Date(), { retryProse: true }).catch(() => {}), at - Date.now() + 2000).unref?.();
  })();
}

/** The next window's prose from the cards so far; strong writers asked again until a minute before the hour. */
async function prewrite(store: DeskStore, w: ReturnType<typeof briefWindow>, at: number): Promise<Prose | null> {
  const t0 = Date.now();
  const saved = (await store.getJson<StoredBrief>(BRIEF_KEY)) ?? null;
  const { all, inWindow } = await windowReports(store, w);
  const extraFronts = updateExtraFronts(all, (await store.getJson<ExtraFront[]>(EXTRA_FRONTS_KEY)) ?? [], coveredByTrackedFront, new Date(at));
  const brief = buildBrief(inWindow, new Date(at), { extraFronts });
  let controlLines = controlContext();
  try {
    controlLines = controlContext(mergedControl(updateControlLive((await store.getJson<ControlLive>(CONTROL_LIVE_KEY)) ?? null, inWindow, new Date(at))));
  } catch {}
  let best: Prose | null = null;
  for (;;) {
    const p = await withShare(store, w.updatedAt, (budget) => writeProse(
      inWindow,
      brief.fronts.map((f) => ({ id: f.id, name: f.name, incidents: f.strikes + f.ground + f.alerts + f.maritime, previous: saved?.brief.fronts?.find((x) => x.id === f.id)?.line || "" })),
      saved?.brief.situation?.line || "",
      (r) => frontIdsOf(r, extraFronts),
      controlLines,
      // Once a backup writer has the text, only a strong writer is worth asking again.
      best ? STRONG_MODELS : WRITER_MODELS,
      budget,
    )).catch(() => null);
    if (p?.situation && (!best || (p.model && STRONG.has(p.model)))) best = p;
    if (best?.model && STRONG.has(best.model)) break;
    if (Date.now() + 2 * 60_000 > at) break;
    await new Promise((r) => setTimeout(r, 60_000));
  }
  const ms = Date.now() - t0;
  console.log(`[desk] prose written early: ${best?.model || "no model"} in ${Math.round(ms / 1000)}s`);
  if (best?.model && STRONG.has(best.model)) await store.putJson(PROSE_MS_KEY, ms).catch(() => {});
  return best;
}

async function buildWindow(store: DeskStore, now: Date, w: ReturnType<typeof briefWindow>, saved: StoredBrief | null): Promise<{ brief: Brief; built: boolean }> {
  const early = pre?.updatedAt === w.updatedAt ? await pre.job : null;
  const { all, inWindow } = await windowReports(store, w);

  // The brief that was current until now becomes this one's comparison point.
  const history: BriefHistory = saved
    ? {
        prevWindow: saved.brief.numbers,
        prevFronts: Object.fromEntries(
          (saved.brief.fronts || []).map((f) => [f.id, f]),
        ) as unknown as BriefHistory["prevFronts"],
        streaks: bumpStreaks(saved),
      }
    : {};

  // Fronts opened for new clusters of fighting over the last 48 hours.
  const extraFronts = updateExtraFronts(
    all,
    (await store.getJson<ExtraFront[]>(EXTRA_FRONTS_KEY)) ?? [],
    coveredByTrackedFront,
    now,
  );
  await store.putJson(EXTRA_FRONTS_KEY, extraFronts);
  history.extraFronts = extraFronts;

  const brief = buildBrief(inWindow, now, history);
  // District control moves first, so the prose is written from where the lines now run.
  let controlLines = controlContext();
  try {
    const live = updateControlLive((await store.getJson<ControlLive>(CONTROL_LIVE_KEY)) ?? null, inWindow, now);
    await store.putJson(CONTROL_LIVE_KEY, live);
    controlLines = controlContext(mergedControl(live));
  } catch (err) {
    console.error("[desk] control update failed:", err instanceof Error ? err.message : err);
  }
  const proseArgs = {
    previousSituation: saved?.brief.situation?.line || "",
    previousFront: (id: string) => saved?.brief.fronts?.find((p) => p.id === id)?.line || "",
    previousNewsAt: (id: string) => saved?.brief.fronts?.find((p) => p.id === id)?.lastNewsAt || saved?.brief.updatedAt,
    frontsOf: (r: LiveReport) => frontIdsOf(r, extraFronts),
    inArea: (ll: [number, number], id: string) => inFrontArea(ll, id, extraFronts),
    controlLines,
  };
  // Stored on the hour with the prose written early (or now, when none was): a
  // backup writer's text is asked again by the clock, 10 minutes on.
  await proseInto(store, brief, inWindow, all, proseArgs, early);
  brief.proseTriedAt = new Date().toISOString();
  await store.putJson(BRIEF_KEY, { brief, history } satisfies StoredBrief);
  // The official numbers move on the same 6-hour clock. A failed fetch keeps
  // the last tally; it must never cost the brief.
  try {
    await refreshTally(store, inWindow, now);
  } catch (err) {
    console.error("[desk] tally refresh failed:", err instanceof Error ? err.message : err);
  }
  // Each side's own figures, on the same clock, and just as unable to cost the brief.
  try {
    await refreshClaims(store, inWindow, now);
  } catch (err) {
    console.error("[desk] claims refresh failed:", err instanceof Error ? err.message : err);
  }
  // The Maritime and Energy ledger, and PortWatch's ship traffic, on the same clock.
  try {
    await refreshLedger(store, inWindow, now);
  } catch (err) {
    console.error("[desk] ledger refresh failed:", err instanceof Error ? err.message : err);
  }
  // The Timeline's "Now" box, rewritten every three days from the cards.
  try {
    await refreshTimelineNow(store, all, now, controlLines);
  } catch (err) {
    console.error("[desk] timeline now failed:", err instanceof Error ? err.message : err);
  }
  return { brief, built: true };
}

/** A front active again this window extends its streak; a quiet one resets. */
function bumpStreaks(saved: StoredBrief): BriefHistory["streaks"] {
  const out: Record<string, number> = {};
  for (const f of saved.brief.fronts || []) {
    const active = f.strikes + f.ground + f.alerts + f.maritime > 0;
    const prior = saved.history?.streaks?.[f.id] ?? 0;
    out[f.id] = active ? prior + 1 : 0;
  }
  return out as BriefHistory["streaks"];
}

/** The cards of the window that just closed, [startedAt, updatedAt), and the last rows overall. */
async function windowReports(store: DeskStore, w: { startedAt: string; updatedAt: string }): Promise<{ all: LiveReport[]; inWindow: LiveReport[] }> {
  const start = Date.parse(w.startedAt);
  const end = Date.parse(w.updatedAt);
  // The Yemen desk's cards only: an Iran card is no news of the Yemen war (8 Oct).
  const { reports } = await store.recentDesk(WINDOW_ROWS, undefined, { events: false, desk: "yemen" });
  // A picture of earlier damage is no new attack: it feeds neither the text nor the numbers (Stage D, user 2 Oct).
  const all = reports.map((r) => r as unknown as LiveReport).filter((r) => !oldPicture(String(r.summary ?? "")));
  const inWindow = all.filter((r) => {
    const t = Date.parse(String(r.at || ""));
    return Number.isFinite(t) && t >= start && t < end;
  });
  return { all, inWindow };
}

const SHARE_KEY = "strong-share";

/**
 * Run a writing job on this update's share of the strong writers (models.ts
 * PER_UPDATE). The count is kept in the store, so a restart or a deploy does
 * not hand an update a second share; the last four updates are kept.
 */
async function withShare<T>(store: DeskStore, update: string, job: (budget: Record<string, number>) => Promise<T>): Promise<T> {
  const read = async () => (await store.getJson<Record<string, Record<string, number>>>(SHARE_KEY).catch(() => null)) ?? {};
  const budget = { ...((await read())[update] ?? {}) };
  const before = { ...budget };
  try {
    return await job(budget);
  } finally {
    if (Object.keys(budget).some((k) => budget[k] !== before[k])) {
      const all = await read();
      const was = all[update] ?? {};
      // Another job of the same update may have spent meanwhile: both counts add up.
      all[update] = Object.fromEntries([...new Set([...Object.keys(was), ...Object.keys(budget)])].map((k) => [k, (was[k] ?? 0) + (budget[k] ?? 0) - (before[k] ?? 0)]));
      const keep = Object.keys(all).sort().slice(-4);
      await store.putJson(SHARE_KEY, Object.fromEntries(keep.map((k) => [k, all[k]]))).catch(() => {});
    }
  }
}

/** The strong writers: the first Gemini Flash models of the chain. */
const STRONG_MODELS: ChainModel[] = WRITER_MODELS.slice(0, 3);
const STRONG = new Set(STRONG_MODELS.map((m) => m.id));
const RETRY_FOR_MS = 2 * 60 * 60_000;
const RETRY_EVERY_MS = 10 * 60_000;
const LATE_EVERY_MS = 20 * 60_000;

/**
 * Prose written by a fallback model (the strong ones busy) or by no model is
 * asked for again every 10 minutes for the window's first two hours, then
 * every 20 minutes until the next update. The two hours alone ended before
 * Google's daily reset (10:00 Israel), so the 00:00 and 06:00 updates kept
 * the fallback text all day (2 Oct).
 */
export function proseDue(brief: Brief, now: Date): boolean {
  if (brief.situation?.model && STRONG.has(brief.situation.model)) return false;
  const since = now.getTime() - Date.parse(brief.updatedAt);
  const next = Date.parse(brief.nextUpdateAt || "") || Date.parse(brief.updatedAt) + 6 * 3600_000;
  if (!(since >= 0 && now.getTime() < next - 5 * 60_000)) return false;
  const tried = Date.parse(brief.proseTriedAt || "");
  return !Number.isFinite(tried) || now.getTime() - tried >= (since < RETRY_FOR_MS ? RETRY_EVERY_MS : LATE_EVERY_MS);
}

/**
 * Ask for the prose again, for the current brief only: its paragraphs, places
 * and maps. Control, numbers and the timeline stay as they are. Kept only when
 * a strong model wrote it (or `force`, from a script).
 */
export async function reprose(store: DeskStore, saved: StoredBrief, now: Date, force = false, models: ChainModel[] = WRITER_MODELS): Promise<Brief> {
  const brief: Brief = { ...saved.brief, proseTriedAt: now.toISOString() };
  const { all, inWindow } = await windowReports(store, { startedAt: brief.windowStart, updatedAt: brief.updatedAt });
  const extraFronts = saved.history?.extraFronts ?? [];
  let controlLines = controlContext();
  try {
    const live = await store.getJson<ControlLive>(CONTROL_LIVE_KEY);
    if (live) controlLines = controlContext(mergedControl(live));
  } catch {}
  const next: Brief = { ...brief, fronts: brief.fronts.map((f) => ({ ...f })) };
  const model = await proseInto(store, next, inWindow, all, {
    previousSituation: brief.situation?.line || "",
    previousFront: (id) => (saved.history?.prevFronts as Record<string, { line?: string }> | undefined)?.[id]?.line || "",
    previousNewsAt: (id) => (saved.history?.prevFronts as Record<string, { lastNewsAt?: string }> | undefined)?.[id]?.lastNewsAt || brief.windowStart,
    frontsOf: (r) => frontIdsOf(r, extraFronts),
    inArea: (ll, id) => inFrontArea(ll, id, extraFronts),
    controlLines,
    models,
  });
  // A backup writer's prose replaces the counted fallback text, never a strong writer's.
  const keep = !!model && (force || STRONG.has(model) || !brief.situation?.model);
  // Not kept, a front still on the counted line takes this answer's line (or its headlines).
  const better = new Map(next.fronts.map((f) => [f.id, f]));
  const out = keep
    ? next
    : {
        ...brief,
        // Nobody wrote the overview before: it takes this round's (the headlines when no model answered).
        ...(!brief.situation?.model && next.situation?.line ? { situation: next.situation } : {}),
        fronts: brief.fronts.map((f) => (isCountedLine(f.line) && better.get(f.id)?.line && !isCountedLine(better.get(f.id)!.line) ? { ...f, line: better.get(f.id)!.line, ...(better.get(f.id)!.map ? { map: better.get(f.id)!.map } : {}) } : f)),
      };
  if (!keep) {
    // The old maps still follow today's rules: a ship or energy mark no card of the window now draws goes (2 Oct: a round-up's Medina hit at Taiz).
    const cards = cardMarks(inWindow, (r) => frontIdsOf(r, extraFronts));
    const still = (list: DevMark[], own: DevMark[]) => list.filter((m) => nearAny(m, sameKind(m, own)));
    if (out.devMap) out.devMap = still(out.devMap, cards.all);
    out.fronts = out.fronts.map((f) => (f.map ? { ...f, map: still(f.map, cards.byFront[f.id] ?? []) } : f));
  }
  console.log(`[desk] prose asked again: ${model || "no model"}${keep ? ", kept" : ", not kept"}`);
  await store.putJson(BRIEF_KEY, { brief: out, history: saved.history } satisfies StoredBrief);
  return out;
}

/**
 * The current window's fronts again, after the fronts themselves changed (30
 * Sep: governorates and the three areas): the opened fronts become
 * governorates, each front's counts come from its own area, a front kept keeps
 * its paragraph, and the prose is then asked again. LIVE DATABASE WRITE.
 */
export async function refront(store: DeskStore, saved: StoredBrief, now: Date): Promise<Brief> {
  const { all, inWindow } = await windowReports(store, { startedAt: saved.brief.windowStart, updatedAt: saved.brief.updatedAt });
  const extraFronts = updateExtraFronts(all, saved.history?.extraFronts ?? [], coveredByTrackedFront, new Date(saved.brief.updatedAt));
  await store.putJson(EXTRA_FRONTS_KEY, extraFronts);
  const history: BriefHistory = { ...saved.history, extraFronts };
  const fresh = buildBrief(inWindow, new Date(saved.brief.updatedAt), history);
  const old = new Map(saved.brief.fronts.map((x) => [x.id, x]));
  const brief: Brief = { ...saved.brief, fronts: fresh.fronts.map((x) => ({ ...x, ...(old.get(x.id)?.line ? { line: old.get(x.id)!.line } : {}) })) };
  const next: StoredBrief = { brief, history };
  await store.putJson(BRIEF_KEY, next);
  return reprose(store, next, now, true);
}

/** The counted fallback line (synthesis.ts composeFront), not anyone's writing. */
export function isCountedLine(line: string | undefined): boolean {
  return /\bIn the \d+ hours to .+? there (?:was|were) |\bNothing was reported from this front/.test(line || "");
}

/**
 * A front the writer left out: its own reports' headlines, newest first, in
 * place of the counted line ("there were one ground engagement", 2 Oct).
 */
const NOT_EVENT = new Set<string>(["statement", "diplomacy", "economy"]);

export function headlinesLine(own: LiveReport[], max = 3): string {
  return topHeadlines(own, max).join(" ");
}

/** The strongest headlines, two that say the same thing kept once. */
function topHeadlines(reports: LiveReport[], max: number): string[] {
  // Events only: a reaction ("Kuwait and Bahrain condemn the attack") is not the news of the update (user, 2 Oct).
  const events = reports.filter((r) => !NOT_EVENT.has(r.type) && !isOther(String(r.summary || "")));
  if (events.length) reports = events;
  const words = (h: string) => new Set(h.toLowerCase().match(/[a-z؀-ۿ]{4,}/g) || []);
  const kept: { h: string; w: Set<string> }[] = [];
  for (const r of [...reports].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.at.localeCompare(a.at))) {
    const h = String(r.summary || "").trim().replace(/[.\s]+$/, "");
    if (!h) continue;
    const w = words(h);
    const same = kept.some((k) => {
      const shared = [...w].filter((x) => k.w.has(x)).length;
      return h.toLowerCase() === k.h.toLowerCase() || shared / Math.max(1, Math.min(w.size, k.w.size)) >= 0.6;
    });
    if (same) continue;
    kept.push({ h, w });
    if (kept.length >= max) break;
  }
  return kept.map((k) => `${k.h}.`);
}

/**
 * The overview when no model wrote it: the window's strongest headlines, the
 * fighting first. Never the counted text ("The tempo eased … 37 reported
 * incidents"), which read as a machine's (2 Oct).
 */
export function headlinesSituation(reports: LiveReport[], max = 4): string {
  return battleFirst(topHeadlines(reports, max).join(" ")).replace(/\n\n/g, " ");
}

/**
 * Write the prose into the brief, then find every place it and its maps name.
 * The composed lines stay where the model gave nothing usable. Returns the
 * model that wrote it, or null.
 */
async function proseInto(
  store: DeskStore,
  brief: Brief,
  inWindow: LiveReport[],
  all: LiveReport[],
  o: { previousSituation: string; previousFront: (id: string) => string; previousNewsAt: (id: string) => string | undefined; frontsOf: (r: LiveReport) => string[]; inArea: (ll: [number, number], id: string) => boolean; controlLines: string[]; models?: ChainModel[] },
  /** Prose already written (before the hour): only its places and maps are done here. */
  given: Prose | null = null,
): Promise<string | null> {
  let model: string | null = null;
  let devMap: DevMark[] = [];
  const frontMaps: Record<string, DevMark[]> = {};
  try {
    const prose = given ?? await withShare(store, brief.updatedAt, (budget) => writeProse(
      inWindow,
      brief.fronts.map((f) => ({
        id: f.id,
        name: f.name,
        incidents: f.strikes + f.ground + f.alerts + f.maritime,
        previous: o.previousFront(f.id),
      })),
      o.previousSituation,
      o.frontsOf,
      o.controlLines,
      o.models,
      budget,
    ));
    // Only an answer with the overview counts as written: one without it is asked again.
    if (prose?.situation) model = prose.model || null;
    if (prose?.situation) {
      brief.situation = { ...brief.situation, line: prose.situation, more: prose.more || undefined, model: prose.model };
      devMap = prose.devMap;
    } else {
      const line = headlinesSituation(inWindow);
      if (line) brief.situation = { ...brief.situation, line, more: undefined, model: undefined };
    }
    for (const f of brief.fronts) {
      const own = inWindow.filter((r) => o.frontsOf(r).includes(f.id));
      if (!own.length) {
        // Nothing reported on this front in the window: its last real text
        // stands as written, marked with when it was news. A model asked to
        // restate it padded it ("air defences remain on alert").
        const prev = o.previousFront(f.id);
        f.line = prev ? keepReported(prev, []) || prev : "";
        f.lastNewsAt = o.previousNewsAt(f.id);
        continue;
      }
      f.lastNewsAt = brief.updatedAt;
      if (prose?.fronts[f.id]) {
        f.line = keepReported(prose.fronts[f.id], own) || prose.fronts[f.id];
        if (prose.frontMaps[f.id]) frontMaps[f.id] = prose.frontMaps[f.id];
      } else f.line = headlinesLine(own) || f.line;
    }
  } catch (err) {
    console.error("[desk] prose failed:", err instanceof Error ? err.message : err);
  }
  // Every place the prose and its maps name, found once, so the page can light each one.
  try {
    const marks = [...devMap, ...Object.values(frontMaps).flat()];
    const extra = marks.flatMap((m) => [`in ${m.place}.`, ...(m.from ? [`from ${m.from}.`] : [])]);
    brief.places = await placeProse(store, [brief.situation?.line || "", ...brief.fronts.map((f) => f.line || ""), ...extra], all);
    const found = placeFinder(brief.places);
    const located = (list: DevMark[]) =>
      list.flatMap((m): DevMark[] => {
        const ll = found(m.place);
        const fromLl = m.from ? found(m.from) : null;
        return ll ? [{ ...m, ll, ...(fromLl ? { fromLl } : {}) }] : [];
      });
    // The prose's marks first (captures, launch areas), then every other event the cards recorded.
    const cards = cardMarks(inWindow, o.frontsOf);
    const main: DevMark[] = [];
    // A prose mark far from every report of the window is a misplaced name (a Saudi
    // "Jabal Jarad" for Taiz's): the same 40 km rule as the fronts.
    for (const m of merged(located(devMap).filter((m) => nearAny(m, sameKind(m, cards.all))), cards.all, cards.launches)) addMark(main, m);
    brief.devMap = main;
    for (const f of brief.fronts) {
      const own = cards.byFront[f.id] ?? [];
      const list: DevMark[] = [];
      // Only what happened inside the front's own area: a Kahbub card that names Taiz stays off the Marib map.
      for (const m of merged((frontMaps[f.id] ? located(frontMaps[f.id]) : []).filter((m) => nearAny(m, sameKind(m, own))), own, cards.launches)) if (m.ll && o.inArea(m.ll, f.id)) addMark(list, m);
      if (list.length) f.map = list;
      else delete f.map;
    }
  } catch (err) {
    console.error("[desk] prose places failed:", err instanceof Error ? err.message : err);
  }
  return model;
}

/**
 * The prose's marks laid over the cards': one event drawn once. A prose mark
 * names the spot ("Jabal Qarfan"), so it replaces the card's mark of the same
 * kind and side within 20 km (the card pinned on the district). A prose capture
 * stays a capture only where a card's capture was confirmed; otherwise it is the
 * side's advance, as the cards' own are.
 */
const FIRED = new Set(["missile", "drone", "interception"]);
/** A ship is drawn only near a card about a ship ("Kahbub" is a hill, not a port), an energy site near a card about one. */
const sameKind = (m: DevMark, cards: DevMark[]) => (m.kind === "naval" || m.kind === "energy" ? cards.filter((c) => c.kind === m.kind) : cards);
function merged(prose: DevMark[], cards: DevMark[], launches: Launch[] = []): DevMark[] {
  const rest = [...cards];
  const out: DevMark[] = [];
  for (const m0 of prose) {
    const confirmed = cards.some((c) => c.kind === "capture" && c.side === m0.side && nearAny(m0, [c], 3));
    const m: DevMark = m0.kind === "capture" && !confirmed ? { ...m0, kind: "advance" } : { ...m0 };
    // Whose missile or drone was shot down, the cards say: the prose's "side" is not sure of it.
    const card = m.kind === "interception" ? cards.find((c) => c.kind === "interception" && nearAny(m, [c], 20)) : undefined;
    if (card) Object.assign(m, { side: card.side, ...(card.shot ? { shot: card.shot } : {}) });
    // The prose's advance where a card's capture by that side was confirmed: the capture stands, drawn once.
    if (m.kind === "advance" && cards.some((c) => c.kind === "capture" && c.side === m.side && nearAny(m, [c], 20))) continue;
    for (let i = rest.length - 1; i >= 0; i--) {
      const c = rest[i];
      // A card's confirmed capture is never swallowed by the prose's advance.
      if (c.kind === m.kind && c.side === m.side && nearAny(m, [c], 20)) {
        // The card knew where it was fired from: the prose's mark keeps that path.
        if (!m.fromLl && c.fromLl) m.fromLl = c.fromLl;
        rest.splice(i, 1);
      }
    }
    if (!m.fromLl) {
      const from = launchFor(m, launches);
      if (from) m.fromLl = from;
    }
    out.push(m);
  }
  // A missile or drone mark on the very spot another one was fired from is its
  // launch area, not a target ("launched two ballistic missiles from Sanaa").
  const all = [...out, ...rest];
  const launched = all.filter((x) => x.fromLl).map((x) => ({ side: x.side, ll: x.fromLl as [number, number] }));
  return all.filter((x) => !(FIRED.has(x.kind) && !x.fromLl && launched.some((l) => l.side === x.side && nearAny(x, [{ ...x, ll: l.ll }], 10))));
}


/**
 * A place of a map entry: the gazetteer's own spot for that very name (checked
 * against OpenStreetMap), else among the ones the prose found, by the same
 * name or the longest found name inside it ("Marib city" -> "Marib").
 */
export function placeFinder(places: Record<string, [number, number]> = {}): (name: string) => [number, number] | null {
  const keyed = Object.entries(places).map(([n, ll]) => [placeKey(n), ll] as const).filter(([k]) => k.length >= 3);
  return (name) => {
    const k = placeKey(name);
    const gaz = placesIn(name).find((p) => p.kind !== "governorate" && placeKey(p.name) === k);
    if (gaz) return [gaz.lat, gaz.lng];
    const same = keyed.find(([x]) => x === k);
    if (same) return same[1];
    const inside = keyed.filter(([x]) => k.includes(x)).sort((a, b) => b[0].length - a[0].length)[0];
    return inside ? inside[1] : null;
  };
}
