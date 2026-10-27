/**
 * The desks' explainers kept current (user, 27 Oct: "make explainers update every 7 days if there's something to
 * update according to reports"): once a week per desk, one model call reads the explainers (public/<desk>-explain.json,
 * or the last stored version) against the week's reports, and rewrites only the explainers whose facts the reports
 * have changed: who holds a post, who was killed or replaced, a new body, a new date. Code keeps a change only when
 * its title is one of the desk's (the Timeline's eras link to the titles), it cites a report of the week, and it
 * keeps most of the text; the cited reports join the explainer's sources. The Gaza desk's words are its own.
 *
 * /api/explain serves the stored version (or the file); the desk's Explainers panel and the guide page read it.
 * Server-only.
 */

import { askChain, NUMBERS_MODELS } from "./models.ts";
import type { DeskStore } from "./store.ts";
import { gazaWords } from "./gaza-words.ts";
import IRAN from "../../../public/iran-explain.json" with { type: "json" };
import YEMEN from "../../../public/yemen-explain.json" with { type: "json" };
import GAZA from "../../../public/gaza-explain.json" with { type: "json" };

export type Explainer = { title: string; cat?: string; dates?: string; sum: string; detail?: string; sources?: { name: string; url: string }[]; timeline?: string[] };
export type ExplainFile = { asOf: string; items: Explainer[] };
/** The stored version: the file's shape, when it was last checked, and what each check changed. */
export type ExplainLive = ExplainFile & { checkedAt?: string; changes?: { at: string; titles: string[] }[] };
export type ExplainDesk = "iran" | "yemen" | "gaza";

export const EXPLAIN_DESKS: ExplainDesk[] = ["iran", "yemen", "gaza"];
export const EXPLAIN_FILES: Record<ExplainDesk, ExplainFile> = { iran: IRAN as ExplainFile, yemen: YEMEN as ExplainFile, gaza: GAZA as ExplainFile };
export const explainKey = (desk: ExplainDesk) => `${desk}:explain`;
const EVERY_MS = 7 * 24 * 3600_000;
/** A failed check tries again after a day, not every cycle. */
const RETRY_MS = 24 * 3600_000;

/** The version to serve: the stored one when it is newer than the file, else the file. */
export function currentExplain(desk: ExplainDesk, live: ExplainLive | null): ExplainFile {
  const file = EXPLAIN_FILES[desk];
  if (!live?.items?.length || String(live.asOf) < String(file.asOf)) return file;
  // A title the file added since is kept; one the file dropped goes.
  const byTitle = new Map(live.items.map((e) => [e.title, e]));
  return { asOf: live.asOf, items: file.items.map((e) => byTitle.get(e.title) ?? e) };
}

type Doc = { id: number; at: string; source: string; url: string; text: string };
type Update = { title?: unknown; sum?: unknown; detail?: unknown; dates?: unknown; docs?: unknown };

export const EXPLAIN_SYSTEM = `You keep a news desk's explainers current. Explainers hold background: who is who, how bodies are built, history, the economy. Each has a title, a summary ("sum"), dates and paragraphs ("detail"; paragraphs separated by a blank line, some starting "Label: ").
You get the EXPLAINERS and the REPORTS of the last week (each with an index).
Return "updates": an explainer ONLY when a report states a fact that makes the explainer wrong or out of date: a new holder of a post, a leader killed, arrested or replaced, a body formed or dissolved, a new agreement, a date set or passed, a new official figure for something the explainer gives. Change only what the reports bear out, keep everything else word for word, keep the same style and length, and write the changed fact plainly with its month ("In October 2026 ..."). Daily events, strikes, statements and claims that change nothing in the background are NOT updates.
For each update give the explainer's exact "title", the full new "sum" and "detail" (all paragraphs, changed or not), "dates" if they change, and "docs": the indexes of the reports that bear the change out.
Most weeks most explainers need nothing. If nothing needs changing, return an empty list.
Return JSON {"updates":[{"title":"...","sum":"...","detail":"...","dates":"...","docs":[3]}]}`;

/** The week's reports as the model reads them: newest first, the summary and the start of the text. */
export function explainDocs(reports: Record<string, unknown>[], limit = 160): Doc[] {
  return reports
    .filter((r) => r.summary && Number.isFinite(Date.parse(String(r.at || ""))))
    .sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))
    .slice(0, limit)
    .map((r, id) => ({ id, at: String(r.at).slice(0, 10), source: String(r.source || ""), url: String(r.url || ""), text: `${r.summary}${r.text ? `. ${String(r.text).slice(0, 220)}` : ""}`.replace(/\s+/g, " ").slice(0, 380) }));
}

export function explainMessage(items: Explainer[], docs: Doc[]): string {
  return [
    "EXPLAINERS:",
    ...items.map((e) => JSON.stringify({ title: e.title, dates: e.dates ?? "", sum: e.sum, detail: e.detail ?? "" })),
    "",
    "REPORTS:",
    ...docs.map((d) => `${d.id}. [${d.at}, ${d.source}] ${d.text}`),
  ].join("\n");
}

/** The model's answer, checked: the explainers that changed, in the desk's words. Pure. */
export function applyExplain(desk: ExplainDesk, items: Explainer[], answer: { updates?: unknown }, docs: Doc[]): Explainer[] {
  const words = (s: string) => (desk === "gaza" ? gazaWords(s) : s);
  const byTitle = new Map(items.map((e) => [e.title, e]));
  const out: Explainer[] = [];
  for (const u of (Array.isArray(answer.updates) ? answer.updates : []) as Update[]) {
    const old = byTitle.get(String(u.title ?? ""));
    if (!old || out.some((e) => e.title === old.title)) continue;
    const cited = (Array.isArray(u.docs) ? u.docs : []).map((n) => docs.find((d) => d.id === Number(n))).filter((d): d is Doc => !!d);
    if (!cited.length) continue;
    const sum = typeof u.sum === "string" ? u.sum.trim() : "";
    const detail = typeof u.detail === "string" ? u.detail.trim() : "";
    // The whole text back, not a fragment: most of it kept, and something changed.
    if (sum.length < 0.6 * old.sum.length || detail.length < 0.7 * String(old.detail || "").length) continue;
    if (detail.length > 1.5 * String(old.detail || "").length + 400) continue;
    if (sum === old.sum && detail === String(old.detail || "")) continue;
    const have = new Set((old.sources ?? []).map((s) => s.url));
    const added = cited.filter((d) => d.url && /^https?:\/\//.test(d.url) && !have.has(d.url)).map((d) => ({ name: d.source || new URL(d.url).hostname, url: d.url }));
    out.push({
      ...old,
      sum: words(sum),
      detail: words(detail),
      ...(typeof u.dates === "string" && u.dates.trim() ? { dates: words(u.dates.trim()) } : {}),
      sources: [...(old.sources ?? []), ...added].slice(0, 14),
    });
  }
  return out;
}

/** Once a week per desk: the week's reports read against the explainers; the changed ones stored. */
export async function refreshExplainers(store: DeskStore, desk: ExplainDesk, now = new Date()): Promise<string[] | null> {
  const live = await store.getJson<ExplainLive>(explainKey(desk));
  const last = Date.parse(live?.checkedAt || "");
  if (Number.isFinite(last) && now.getTime() - last < EVERY_MS) return null;
  const cur = currentExplain(desk, live);
  const floor = new Date(now.getTime() - EVERY_MS).toISOString();
  const { reports } = await store.recentDesk(800, undefined, { events: false, desk, floor });
  const docs = explainDocs(reports as unknown as Record<string, unknown>[]);
  let changed: Explainer[] | null = [];
  if (docs.length >= 10) {
    const ans = await askChain(`explain-${desk}`, EXPLAIN_SYSTEM, explainMessage(cur.items, docs), { temperature: 0, models: NUMBERS_MODELS, timeoutMs: 180_000 }).catch(() => null);
    changed = ans ? applyExplain(desk, cur.items, ans.json, docs) : null;
  }
  const next: ExplainLive = {
    ...cur,
    checkedAt: new Date(changed ? now.getTime() : now.getTime() - EVERY_MS + RETRY_MS).toISOString(),
    changes: live?.changes ?? [],
  };
  if (changed?.length) {
    const by = new Map(changed.map((e) => [e.title, e]));
    next.items = cur.items.map((e) => by.get(e.title) ?? e);
    next.asOf = now.toISOString().slice(0, 10);
    next.changes = [...(next.changes ?? []), { at: now.toISOString(), titles: changed.map((e) => e.title) }].slice(-20);
  }
  await store.putJson(explainKey(desk), next);
  console.log(`[explain] ${desk}: ${docs.length} reports, ${changed ? `${changed.length} changed${changed.length ? `: ${changed.map((e) => e.title).join(", ")}` : ""}` : "no answer"}`);
  return changed ? changed.map((e) => e.title) : null;
}

/** The desk most overdue for its weekly check, one per call, so the three never run together. */
export async function refreshDueExplainers(store: DeskStore, now = new Date()): Promise<void> {
  for (const desk of EXPLAIN_DESKS) {
    const live = await store.getJson<ExplainLive>(explainKey(desk));
    const last = Date.parse(live?.checkedAt || "");
    if (Number.isFinite(last) && now.getTime() - last < EVERY_MS) continue;
    await refreshExplainers(store, desk, now);
    return;
  }
}
