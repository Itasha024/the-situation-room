/**
 * "The conflict in numbers": cumulative figures for this round (from 3 July
 * 2026), refreshed with the 12-hour brief. Server-only.
 *
 * Official numbers only: UN agencies (OCHA, WHO, IOM, UNHCR, UNFPA via the
 * ReliefWeb feed) and official statements the desk logged (health ministries,
 * the coalition, the government). A model reads the new texts against the
 * current tally and returns only figures a text states; code then applies
 * them, and a figure never goes down unless the new one is from the same body
 * revising its own count.
 *
 * Each side's killed/injured counts everyone on that side, fighters and
 * civilians. `civilians` is all civilians from every side in one number.
 */

import type { LiveReport } from "./types.ts";
import { askChain } from "./models.ts";
import type { DeskStore } from "./store.ts";

export const TALLY_KEY = "tally";

type Sides = { houthi: number | null; gov: number | null; saudi: number | null; civilians: number | null; total?: number | null };
export type TallySource = { name: string; url: string; date: string };
export type Tally = {
  since: string;
  killed: Sides;
  injured: Sides;
  idp: number | null;
  refugees: number | null;
  /** Who each figure comes from, keyed like "killed.houthi" or "idp". */
  from: Record<string, TallySource>;
  updatedAt: string;
};

/** The hand-checked figures to 19 September 2026, the starting point. */
export const TALLY_SEED: Tally = {
  since: "2026-07-03",
  killed: { houthi: 278, gov: 216, saudi: 1, civilians: 150 },
  injured: { houthi: null, gov: null, saudi: 73, civilians: null },
  idp: 112000,
  refugees: 3000,
  from: {
    "killed.houthi": { name: "AFP", url: "", date: "2026-09-19" },
    "killed.gov": { name: "AFP", url: "", date: "2026-09-19" },
    "killed.saudi": { name: "Saudi officials", url: "", date: "2026-09-19" },
    "killed.civilians": { name: "Yemeni human rights ministry", url: "", date: "2026-09-19" },
    "injured.saudi": { name: "Coalition", url: "", date: "2026-09-19" },
    idp: { name: "IOM", url: "", date: "2026-09-19" },
    refugees: { name: "UNHCR", url: "", date: "2026-09-19" },
  },
  updatedAt: "2026-09-19T12:00:00+03:00",
};

const FIELDS = [
  "killed.houthi", "killed.gov", "killed.saudi", "killed.civilians",
  "injured.houthi", "injured.gov", "injured.saudi", "injured.civilians",
  "killed.total", "injured.total",
  "idp", "refugees",
] as const;
type Field = (typeof FIELDS)[number];

const RELIEFWEB_RSS =
  "https://reliefweb.int/updates/rss.xml?advanced-search=%28PC255%29&search=killed%20OR%20casualties%20OR%20injured%20OR%20displaced%20OR%20refugees";

/** Statements from bodies whose count is official, as the desk logged them. */
const OFFICIAL_RE =
  /ministry of (?:public )?health|health ministry|human rights ministry|coalition|Saudi Press Agency|\bSPA\b|OCHA|WHO\b|IOM\b|UNHCR|UNICEF|OHCHR|United Nations|UN (?:agency|office|envoy)/i;
const NUMBER_RE = /\b\d[\d,]*\b.{0,40}\b(?:killed|dead|deaths|wounded|injured|casualties|displaced|refugees)\b/i;

type Doc = { name: string; url: string; date: string; text: string };

export async function reliefWebDocs(sinceMs: number): Promise<Doc[]> {
  try {
    const res = await fetch(RELIEFWEB_RSS, {
      // ReliefWeb's bot filter turns fetch's default headers away. It is still
      // flaky, which is why the desk's own logged reports are the main input.
      headers: { "user-agent": "curl/8.5.0", accept: "*/*" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const out: Doc[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = m[1];
      const pick = (tag: string) =>
        (item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1] || "";
      const ms = Date.parse(pick("pubDate"));
      if (!Number.isFinite(ms) || ms < sinceMs) continue;
      const date = new Date(ms).toISOString();
      const text = decode(pick("description")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      out.push({
        name: decode(pick("title")).slice(0, 160),
        url: decode(pick("link")),
        date: date.slice(0, 10),
        text: text.slice(0, 2500),
      });
    }
    return out.slice(0, 12);
  } catch {
    return [];
  }
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&amp;/g, "&");
}

function officialReports(reports: LiveReport[]): Doc[] {
  return reports
    .filter((r) => {
      const t = `${r.summary || ""} ${r.text || ""}`;
      return OFFICIAL_RE.test(t) && NUMBER_RE.test(t);
    })
    // The newest first: the latest statement of a count is the one that stands.
    .sort((a, b) => Date.parse(String(b.at)) - Date.parse(String(a.at)))
    .slice(0, 30)
    .map((r) => ({
      name: String(r.source || "desk report"),
      url: String(r.url || ""),
      date: String(r.at || "").slice(0, 10),
      text: `${r.summary || ""}. ${r.text || ""}`.slice(0, 1200),
    }));
}

const SYSTEM = `You keep the running casualty and displacement count for the current round of the Yemen war, which began on 3 July 2026 (Houthis vs the Yemeni government and the Saudi-led coalition).
You get the CURRENT tally and NEW documents. Return ONLY figures that a document explicitly states as a cumulative total for this round (since early July 2026), from an official body: a UN agency (OCHA, WHO, IOM, UNHCR, UNFPA, UNICEF, OHCHR), a health ministry, a government, the coalition, or Saudi officials.
Fields:
- killed.houthi / injured.houthi: all people on the Houthi side, fighters AND civilians in Houthi areas
- killed.gov / injured.gov: all people on the government side, fighters AND civilians in government areas
- killed.saudi / injured.saudi: all people in or from Saudi Arabia, military AND civilians
- killed.civilians / injured.civilians: all civilians from every side together, ONLY when the document itself says the figure is civilians
- killed.total / injured.total: a total for all sides together that the document does not split by side or call civilians (e.g. "nearly 700 people killed")
- idp: people internally displaced inside Yemen in this round
- refugees: people who fled Yemen in this round
Never add up single incidents yourself, never estimate, never use totals for the whole war since 2014/2015. If a document gives nothing usable, return no update for it.
Return JSON {"updates":[{"field":"killed.houthi","value":123,"source":"<body that issued the number>","doc":<document index>}]}.`;

type Update = { field: Field; value: number; source: string; doc: number };

export async function askModel(current: Tally, docs: Doc[]): Promise<Update[] | null> {
  const user = JSON.stringify({
    current: { killed: current.killed, injured: current.injured, idp: current.idp, refugees: current.refugees },
    documents: docs.map((d, i) => ({ index: i, title: d.name, date: d.date, text: d.text })),
  });
  const got = await askChain("tally", SYSTEM, user, { temperature: 0 });
  if (!got) return null;
  return (Array.isArray(got.json.updates) ? got.json.updates : []) as Update[];
}

function getField(t: Tally, f: Field): number | null {
  if (f === "idp" || f === "refugees") return t[f];
  const [group, side] = f.split(".") as ["killed" | "injured", keyof Sides];
  return t[group][side] ?? null;
}

function setField(t: Tally, f: Field, v: number) {
  if (f === "idp" || f === "refugees") t[f] = v;
  else {
    const [group, side] = f.split(".") as ["killed" | "injured", keyof Sides];
    t[group][side] = v;
  }
}

/** Apply model updates. Pure, so the rules are testable. */
export function applyUpdates(current: Tally, updates: Update[], docs: Doc[], now: Date): Tally {
  const next: Tally = structuredClone(current);
  for (const u of updates) {
    if (!u || !FIELDS.includes(u.field) || !Number.isFinite(u.value) || u.value < 0) continue;
    const doc = docs[u.doc];
    if (!doc) continue;
    // A count is civilian only when the document says so; an unsplit total goes to "All sides".
    if (u.field.endsWith(".civilians") && !/civilian/i.test(doc.text)) continue;
    const value = Math.round(u.value);
    const prev = getField(next, u.field);
    const prevFrom = next.from[u.field];
    // A count only moves backwards when the body that issued it revises it.
    if (prev != null && value < prev && prevFrom?.name !== u.source) continue;
    // A tenfold jump is a whole-war total or a misread, not this round.
    if (prev != null && prev > 50 && value > prev * 10) continue;
    setField(next, u.field, value);
    next.from[u.field] = { name: u.source || doc.name, url: doc.url, date: doc.date };
  }
  next.updatedAt = now.toISOString();
  return next;
}

/** Refresh the stored tally from what was published since the last one. */
export async function refreshTally(store: DeskStore, windowReports: LiveReport[], now = new Date()): Promise<Tally> {
  const current = (await store.getJson<Tally>(TALLY_KEY)) ?? TALLY_SEED;
  const since = Date.parse(current.updatedAt) - 24 * 3600_000;
  const docs = [...(await reliefWebDocs(since)), ...officialReports(windowReports)];
  if (!docs.length) return current;
  const updates = await askModel(current, docs);
  if (!updates) return current;
  const next = applyUpdates(current, updates, docs, now);
  await store.putJson(TALLY_KEY, next);
  return next;
}

export async function readTally(store: DeskStore): Promise<Tally> {
  return (await store.getJson<Tally>(TALLY_KEY)) ?? TALLY_SEED;
}
