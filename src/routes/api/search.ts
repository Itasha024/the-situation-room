import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { checkLinks } from "@/lib/desk/links";
import { unglue } from "@/lib/desk/reader";
import {
  type Lexicon,
  type People,
  type SearchDoc,
  type Understood,
  findCandidates,
  headlineHas,
  keepByModel,
  learnLexicon,
  learnPeople,
  mergeUnderstood,
  norm,
  strongTerms,
  understandByModel,
  understandLocally,
} from "@/lib/desk/search";
import { respell } from "@/lib/desk/spelling";
import { getStore } from "@/lib/desk/store";

/**
 * Search every report the desk has carried (the archive since July), as the
 * reader means it: see src/lib/desk/search.ts. A read, never a scan.
 *
 *   GET /api/search?q=uav  ->  { ok, q, about, total, reports: [card rows, newest first] }
 */

type Row = Record<string, unknown> & { fp: string; at: string; source?: string; summary?: string; text?: string };

/** The archive, held for five minutes: the stored cards and the older ones in data.json. */
type Corpus = { at: number; rows: Row[]; docs: SearchDoc[]; people: People; places: Set<string>; lex: Lexicon };
let corpus: Corpus | null = null;
let loading: Promise<Corpus> | null = null;

async function loadCorpus(): Promise<Corpus> {
  const store = await getStore();
  const slice = await store.recentDesk(20_000, undefined, { events: false });
  const rows = slice.reports as unknown as Row[];
  checkLinks(rows as never[], rows as never[]);
  for (const r of rows) {
    r.summary = respell(unglue(String(r.summary ?? "")));
    if (r.text) r.text = respell(String(r.text));
  }
  // The cards from before the database, as the page shows them.
  try {
    const d = JSON.parse(await readFile(join(process.cwd(), "public", "data.json"), "utf8")) as { reports?: Row[] };
    const have = new Set(rows.map((r) => r.fp));
    const urls = new Set(rows.map((r) => String(r.url || "")));
    for (const r of d.reports ?? []) {
      if (!r || !r.fp || have.has(r.fp) || urls.has(String(r.url || ""))) continue;
      rows.push(r);
    }
  } catch {
    /* no data.json beside the server: the database alone */
  }
  const docs: SearchDoc[] = rows.map((r) => ({
    fp: String(r.fp),
    at: String(r.at),
    source: String(r.source || ""),
    summary: String(r.summary || ""),
    text: r.text ? String(r.text) : "",
    place: r.place ? String(r.place) : "",
    also: Array.isArray(r.alsoReportedBy) ? (r.alsoReportedBy as { source?: string }[]).map((a) => a.source || "").join(" ") : "",
  }));
  // Who is who, from the cards' own words.
  const people = learnPeople(rows.map((r) => `${r.summary ?? ""}. ${r.text ?? ""}`));
  // Every place a card is pinned on: a search for one needs no model.
  const places = new Set<string>();
  for (const r of rows) {
    const p = norm(String(r.place || ""));
    if (p.length >= 3) {
      places.add(p);
      places.add(p.replace(/^(?:al|ad|ar|as|ash|at|az) /, ""));
    }
  }
  // Its outlets and its words: a search names an outlet, or misspells a word, without a model.
  const outlets = new Set<string>();
  for (const r of rows) {
    if (r.source) outlets.add(String(r.source));
    for (const a of Array.isArray(r.alsoReportedBy) ? (r.alsoReportedBy as { source?: string }[]) : []) if (a.source) outlets.add(a.source);
  }
  const lex = learnLexicon(docs, [...outlets]);
  return { at: Date.now(), rows, docs, people, places, lex };
}

async function archive(): Promise<Corpus> {
  if (corpus && Date.now() - corpus.at < 5 * 60_000) return corpus;
  if (!loading) {
    loading = loadCorpus()
      .then((c) => {
        corpus = c;
        return c;
      })
      .finally(() => (loading = null));
  }
  // A stale copy answers at once while the new one is read.
  return corpus ?? loading;
}

/** Answers kept: what a query means for a week, its results for ten minutes. */
const meant = new Map<string, Understood>();
const answered = new Map<string, { at: number; fps: string[]; about: string }>();

/** A day's model searches, so the desk's own jobs keep their quota. */
const DAILY_MODEL_SEARCHES = 300;
let day = "";
let modelSearches = 0;

/** Each visitor: 20 searches in 10 minutes. */
const visits = new Map<string, number[]>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const list = (visits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= 20) return false;
  list.push(now);
  visits.set(ip, list);
  if (visits.size > 5000) visits.clear();
  return true;
}

/**
 * The answer at once, before any model: the words the desk knows for the query
 * (or what a model made of it before), found in headlines only, so nothing
 * unrelated shows. The full search follows and replaces it.
 */
/** A search whose every idea the desk knows: the reports whose headlines name it, at once. */
function knownSearch(q: string, docs: SearchDoc[], local: Understood): { fps: string[]; about: string } {
  const key = norm(q);
  const strong = strongTerms(q, local);
  const fps = findCandidates(docs, local, 500)
    .filter((x) => headlineHas(x.doc, strong, local))
    .sort((a, b) => Date.parse(b.doc.at) - Date.parse(a.doc.at))
    .map((x) => x.doc.fp);
  const out = { at: Date.now(), fps, about: local.about };
  answered.set(key, out);
  if (answered.size > 500) answered.clear();
  return out;
}

async function quick(q: string): Promise<{ fps: string[]; about: string; full: boolean }> {
  const key = norm(q);
  const hit = answered.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return { ...hit, full: true };
  const { docs, people, places, lex } = await archive();
  const local = understandLocally(q, people, places, lex);
  // Every word known to the desk: this is the whole answer, no model needed.
  if (local.known) return { ...knownSearch(q, docs, local), full: true };
  const u = meant.has(key) ? mergeUnderstood(meant.get(key)!, local) : local;
  // Only headlines that name the thing itself: nothing unrelated, even for a moment.
  const strong = strongTerms(q, local);
  const fps = findCandidates(docs, u, 300)
    .filter((x) => headlineHas(x.doc, strong, local))
    .sort((a, b) => Date.parse(b.doc.at) - Date.parse(a.doc.at))
    .map((x) => x.doc.fp);
  return { fps, about: u.about, full: false };
}

/**
 * The full search: the desk's own reading of the query (its table, short
 * forms, who is who) and a fast model's, together; every report that carries
 * each idea; and a model's second look only at the ones matched by a loose
 * word alone. A headline that names the thing itself needs no second look.
 */
async function search(q: string): Promise<{ fps: string[]; about: string }> {
  const key = norm(q);
  const hit = answered.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit;
  const { docs, people, places, lex } = await archive();
  const local = understandLocally(q, people, places, lex);
  if (local.known) return knownSearch(q, docs, local);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Aden" });
  if (today !== day) {
    day = today;
    modelSearches = 0;
  }
  const useModel = modelSearches < DAILY_MODEL_SEARCHES;
  let m = meant.get(key) ?? null;
  if (!m && useModel) {
    modelSearches++;
    m = await understandByModel(q, today);
    if (m) {
      meant.set(key, m);
      if (meant.size > 2000) meant.clear();
    }
  }
  const u = m ? mergeUnderstood(m, local) : local;
  const cands = findCandidates(docs, u, 300);
  // A headline that names the thing itself (the query's words, the desk's
  // synonyms for a word, a name or title) stands; the rest get a second look.
  const strong = strongTerms(q, local);
  const trusted = (d: SearchDoc) => headlineHas(d, strong, local);
  const doubt = cands.filter((x) => !trusted(x.doc)).slice(0, 150);
  const keep = new Set<string>(cands.filter((x) => trusted(x.doc)).map((x) => x.doc.fp));
  if (doubt.length) {
    if (m && useModel) {
      const chunks: typeof doubt[] = [];
      for (let i = 0; i < doubt.length; i += 100) chunks.push(doubt.slice(i, i + 100));
      const kept = await Promise.all(chunks.map((c) => keepByModel(q, u, c.map((x) => x.doc))));
      kept.forEach((k, i) => {
        // A chunk no model read keeps its cards with a term in the headline.
        const own = k ?? new Set(chunks[i].filter((x) => x.score >= 3).map((x) => x.doc.fp));
        for (const fp of own) keep.add(fp);
      });
    } else {
      for (const x of doubt) if (x.score >= 3 || cands.length <= 40) keep.add(x.doc.fp);
    }
  }
  const at = new Map(docs.map((d) => [d.fp, Date.parse(d.at)]));
  const fps = [...keep].sort((a, b) => (at.get(b) ?? 0) - (at.get(a) ?? 0));
  const out = { at: Date.now(), fps, about: u.about };
  answered.set(key, out);
  if (answered.size > 500) answered.clear();
  return out;
}

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: ({ request }) => metered("search", async () => {
        try {
          const url = new URL(request.url);
          // The page asks this when the search bar opens, so the archive is in memory before the first letter.
          if (url.searchParams.get("warm") === "1") {
            await archive();
            return json({ ok: true });
          }
          const q =String(url.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 120);
          if (norm(q).length < 2) return json({ ok: false, error: "Type at least two letters." }, 400);
          const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
          const fast = url.searchParams.get("fast") === "1";
          if (!fast && !answered.has(norm(q)) && !allowed(ip)) return json({ ok: false, error: "Too many searches. Try again in a few minutes." }, 429);
          const { fps, about, full }: { fps: string[]; about: string; full?: boolean } = fast ? await quick(q) : { ...(await search(q)), full: true };
          const { rows } = await archive();
          const byFp = new Map(rows.map((r) => [r.fp, r]));
          const reports = fps.map((fp) => byFp.get(fp)).filter(Boolean);
          return json({ ok: true, q, about, full, total: reports.length, reports }, 200, { "cache-control": "public, max-age=60", "cdn-cache-control": "public, s-maxage=300" });
        } catch (err) {
          const message = err instanceof Error ? err.message : "search failed";
          return json({ ok: false, error: message }, 500);
        }
      }),
    },
  },
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}
