/**
 * The gates' daily check (user, 23 Oct: "make sure this doesn't filter important things"). Every item the
 * site read is put through each desk's word gate before any model reads it; what a gate turns away no
 * reader ever sees. Once a day, a sample of what each desk's gate turned away that day (from the server's
 * memory of the last two days' reads, recent-reads.ts) is asked of a free model: "news for this desk?".
 * What it flags is kept in json:gate-audit, a week of days, for the gate's words to be widened.
 */
import type { DeskId } from "../desks.ts";
import type { DeskStore } from "./store.ts";
import { type Read, recentReads } from "./recent-reads.ts";
import { askChain, type ChainModel, NUMBERS_MODELS } from "./models.ts";
import { IRAN_RSS, IRAN_TG, IRAN_X, IRAQI_MEDIA, LEBANESE_MEDIA } from "./iran-sources.ts";
import { isIranDeskItem, passesIraqiMediaGate, passesLebaneseMediaGate } from "./iran-reader.ts";
import { GAZA_TG, GAZA_X } from "./gaza-sources.ts";
import { isGazaDeskItem, passesGazaOwnGate } from "./gaza-reader.ts";

export const GATE_AUDIT_KEY = "gate-audit";
const SAMPLE = 100;
const PER_SOURCE = 3;
const BATCH = 25;
/** After this hour (UTC) the day's reads are mostly in: the check runs once a day from then. */
const FROM_HOUR = 19;
const MODELS: ChainModel[] = [
  { provider: "nvidia", id: "nvidia/nemotron-3-ultra-550b-a55b" },
  { provider: "openrouter", id: "openai/gpt-oss-120b:free" },
  ...NUMBERS_MODELS,
];

const IRAN_OWN = new Set([...IRAN_TG, ...IRAN_X, ...IRAN_RSS].map((s) => s.name));
const GAZA_OWN = new Set([...GAZA_TG, ...GAZA_X].map((s) => s.name));

export type DeskCheck = { desk: DeskId; about: string; passes: (r: Pick<Read, "source" | "text">) => boolean };

/** Each desk's gate as the scan applies it: its own sources on a wide one, the others' on its narrow one. */
export const DESK_GATES: DeskCheck[] = [
  {
    desk: "iran",
    about: "the war with Iran: the US and Israel against Iran and its allies (Hezbollah, the Iraqi militias), Hormuz, the talks, the nuclear file, sanctions on Iran, Lebanon's war with Israel and its politics around Hezbollah, Iraq's militias, US forces in the region",
    passes: (r) =>
      IRAN_OWN.has(r.source) || isIranDeskItem(r.text) || (LEBANESE_MEDIA.has(r.source) && passesLebaneseMediaGate(r.text)) || (IRAQI_MEDIA.has(r.source) && passesIraqiMediaGate(r.text)),
  },
  {
    desk: "gaza",
    about: "Gaza and Judea and Samaria (the West Bank) and Jerusalem: the IDF's operations, attacks on Israelis, clashes, the factions, the Palestinian Authority, aid and the crossings, the Board of Peace, statements, condemnations and sanctions about them",
    passes: (r) => (GAZA_OWN.has(r.source) ? passesGazaOwnGate(r.text) : isGazaDeskItem(r.text)),
  },
  {
    desk: "yemen",
    about: "the war in Yemen: the Houthis against the Yemeni government and Saudi Arabia, the fronts, Houthi strikes on Saudi Arabia, the Red Sea and Bab al-Mandab, statements and diplomacy about them",
    // The Yemen scan's own sources go to its reader's own relevance step; only the others' items meet a gate here.
    passes: (r) => !IRAN_OWN.has(r.source) && !GAZA_OWN.has(r.source) ? true : WAR_RE.test(r.text),
  },
];
/** The Yemen gate for the other desks' sources (yemen-scan's WAR_ONLY), set by the caller to avoid a loop of imports. */
let WAR_RE: RegExp = /$^/;
export function setYemenGate(re: RegExp): void {
  WAR_RE = re;
}

/** What one desk's gate turned away in the window, a few from each source, the newest first. */
export function turnedAway(reads: Read[], check: DeskCheck, since: number): Read[] {
  const per = new Map<string, number>();
  return reads
    .filter((r) => r.at >= since && r.text.replace(/\s+/g, " ").trim().length > 40 && !check.passes(r))
    .sort((a, b) => b.at - a.at)
    .filter((r) => {
      const n = per.get(r.source) ?? 0;
      per.set(r.source, n + 1);
      return n < PER_SOURCE;
    })
    .slice(0, SAMPLE);
}

const SYSTEM = (about: string) => `You check the keyword filter of a news desk. The desk covers ${about}.
You get numbered posts and articles the filter turned away. Name the ones this desk would publish as news: an event, a statement by a party or an official, a decision, a figure. Not opinion, not unrelated news, not ads.
Answer JSON only: {"relevant": [the numbers]}. An empty list when none.`;

export type AuditDay = { day: string; at: string; desks: { desk: DeskId; read: number; turnedAway: number; checked: number; flagged: { source: string; url: string; text: string }[] }[] };

/** The day's check, once a day after FROM_HOUR (UTC), from the worker's memory of the reads. */
export async function runGateAudit(store: DeskStore, now = Date.now(), force = false): Promise<AuditDay | null> {
  const day = new Date(now).toISOString().slice(0, 10);
  const log = (await store.getJson<AuditDay[]>(GATE_AUDIT_KEY)) ?? [];
  if (!force && (new Date(now).getUTCHours() < FROM_HOUR || log.some((d) => d.day === day))) return null;
  const reads = recentReads(now);
  const since = now - 24 * 3600_000;
  const out: AuditDay = { day, at: new Date(now).toISOString(), desks: [] };
  for (const check of DESK_GATES) {
    const away = turnedAway(reads, check, since);
    const flagged: AuditDay["desks"][number]["flagged"] = [];
    let checked = 0;
    for (let i = 0; i < away.length; i += BATCH) {
      const batch = away.slice(i, i + BATCH);
      const user = batch.map((r, j) => `${j + 1}. [${r.source}] ${r.text.replace(/\s+/g, " ").slice(0, 400)}`).join("\n");
      const got = await askChain(`gate-audit ${check.desk}`, SYSTEM(check.about), user, { models: MODELS, timeoutMs: 60_000, accept: (j) => (Array.isArray(j.relevant) ? null : "no list") });
      if (!got) continue;
      checked += batch.length;
      for (const n of got.json.relevant as unknown[]) {
        const r = batch[Number(n) - 1];
        if (r) flagged.push({ source: r.source, url: r.url, text: r.text.replace(/\s+/g, " ").slice(0, 300) });
      }
    }
    const read = reads.filter((r) => r.at >= since).length;
    out.desks.push({ desk: check.desk, read, turnedAway: reads.filter((r) => r.at >= since && !check.passes(r)).length, checked, flagged });
    console.log(`[gate-audit] ${check.desk}: ${checked} of what its gate turned away checked, ${flagged.length} flagged as its news`);
  }
  await store.putJson(GATE_AUDIT_KEY, [out, ...log.filter((d) => d.day !== day)].slice(0, 7));
  return out;
}
