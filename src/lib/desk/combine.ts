/**
 * One card per event, written from every account of it.
 *
 * The scan already groups the accounts of one event (copies of a post, outlets
 * on one spot, a burst of sirens), and used to print each other outlet's own
 * headline inside the lead's box. The editor asked for ONE report instead:
 * every new fact from every account, written once, under the most fitting
 * source, with the other outlets listed under "Also" as links only.
 *
 * Two things here:
 *
 *   waves    — strike and alert cards of one side against one area, new in the
 *              same scan (Houthi missiles on Jizan, Najran and Yanbu; Saudi
 *              shelling on Razih, Shada and Munabbih), are one card naming every
 *              place. The same scan only, as the editor asked: never across scans.
 *   combine  — one model call writes the group's single headline and body from
 *              all its accounts. Checked in code: every place and every figure
 *              the accounts gave must still be in it, and it must be English.
 *
 * A wave the model could not write is split back into its cards, so no place
 * is lost from the feed or the map for want of a model.
 */

import { createHash } from "node:crypto";
import { respell } from "./spelling.ts";

import { alertCities } from "./copies.ts";
import { governorateAt } from "./adm1.ts";
import { PLACE_BY_NAME, datelineFor, type Place } from "./gazetteer.ts";
import { stripAttribution } from "./origin.ts";
import { MASHUP, redundantBody, roleNamesInProse, stripSpellingNotes, unstutter } from "./reader.ts";
import type { DeskStore } from "./store.ts";
import type { LiveReport } from "./types.ts";

export type Group = { lead: LiveReport; others: LiveReport[] };
export type Written = { headline: string; body: string };
/** Asks a model; null when none answered. */
export type Ask = (system: string, user: string) => Promise<Record<string, unknown> | null>;

/** Model calls per tick; the rest keep their lead card as written. */
export const COMBINE_CALLS = 3;
/** The combine step never holds the tick longer than this. */
export const COMBINE_MS = 20_000;
const PREFIX = "comb";
const KEEP_MS = 3 * 24 * 3600_000;

/** Where a card's event is, as an area a wave is kept within: "SA", a governorate ("YE-SD"), or null. */
export function areaOf(r: LiveReport): string | null {
  const p = r.place ? PLACE_BY_NAME[r.place] : undefined;
  if (p?.country === "Saudi Arabia") return "SA";
  if (p?.country === "sea") return null;
  if (r.lat != null && r.lng != null) {
    const gov = governorateAt(r.lat, r.lng);
    if (gov) return gov;
  }
  if (alertCities(r)) return "SA";
  return null;
}

/** Whoever the headline says did it, past the speaker who says so. */
const SAYS = /^(?:[^:]{2,60}:\s+|.{0,50}?\b(?:says?|said|claims?|claimed|reports?|reported)\s+(?:that\s+)?)/i;
const ACTORS: [RegExp, string][] = [
  [/\bhouthis?\b|ansar allah/i, "houthi"],
  [/\bsaudi\b|\bcoalition\b/i, "saudi"],
  [/\b(?:us|u\.s\.|american|british|uk)\b/i, "us"],
  [/\bgovernment\b|\bgiants\b|national resistance|\bstc\b|southern forces/i, "gov"],
];

/** The side that struck: Houthi on anything in Saudi Arabia, else the first actor the headline names. */
export function actorOf(r: LiveReport): string | null {
  if (areaOf(r) === "SA") return "houthi";
  const s = String(r.summary || "").replace(SAYS, "");
  let best: { at: number; who: string } | null = null;
  for (const [re, who] of ACTORS) {
    const m = re.exec(s);
    if (m && (!best || m.index < best.at)) best = { at: m.index, who };
  }
  return best?.who ?? null;
}

/** "houthi|SA": the wave a strike or alert card belongs to, or null. Clashes and statements never form waves. */
export function waveKey(r: LiveReport): string | null {
  if (r.type !== "strike" && !alertCities(r)) return null;
  const area = areaOf(r);
  const actor = area ? actorOf(r) : null;
  return area && actor ? `${actor}|${area}` : null;
}

/**
 * Groups of one wave together. A single group stays as it was; a wave is the
 * list of groups it took in, oldest first.
 */
export function planWaves(groups: Group[], isNew: (r: LiveReport) => boolean = () => true): Group[][] {
  const out: Group[][] = [];
  const open = new Map<string, Group[]>();
  const t = (g: Group) => Date.parse(g.lead.at);
  for (const g of [...groups].sort((a, b) => t(a) - t(b))) {
    // A card an earlier scan already published is never folded into a wave.
    const k = isNew(g.lead) ? waveKey(g.lead) : null;
    const wave = k ? open.get(k) : undefined;
    if (wave) wave.push(g);
    else {
      const w = [g];
      if (k) open.set(k, w);
      out.push(w);
    }
  }
  return out;
}

/** Every account in a group, lead first. */
export function members(g: Group): LiveReport[] {
  return [g.lead, ...g.others];
}

/** The best account leads: `rank` decides (the speaker's own channel, then the official outlet, the original, an agency…). */
export function pickLead(all: LiveReport[], rank: (r: LiveReport) => number): Group {
  const sorted = [...all].sort((a, b) => rank(b) - rank(a) || Date.parse(a.at) - Date.parse(b.at));
  return { lead: sorted[0], others: sorted.slice(1) };
}

/** The places a group's accounts name, land before sea, once each. */
export function placesOf(all: LiveReport[]): Place[] {
  const out: Place[] = [];
  for (const r of all) {
    for (const name of [r.place, ...(r.places ?? []).map((p) => p.name)]) {
      const p = name ? PLACE_BY_NAME[name] : undefined;
      if (p && !out.includes(p)) out.push(p);
    }
  }
  return out.sort((a, b) => Number(a.country === "sea") - Number(b.country === "sea"));
}

const SYSTEM = `You are the editor of a wire desk covering the war in Yemen. The accounts
below come from several outlets. They tell ONE event, or one wave of attacks by
one side on one area. Write ONE report of it.

- Carry every fact from every account: every place, every figure, every weapon,
  every named unit, person or object, and the outcome (intercepted, hit, killed).
- Attribute each side's claim to that side ("the Houthis said", "Saudi media
  said"). Where accounts give different figures, give both, attributed.
- Add nothing the accounts do not say. No background, no analysis.
- English only; places in the English spelling the accounts use. Spell each
  place once, the usual way; never explain a spelling ("also spelled").
- Headline: one sentence, wire style, sentence case, no full stop, at most 30
  words. It names the places.
- Body: one to four sentences with the facts the headline has no room for.
  Empty when the headline carries everything.
- Do not name the outlets, except to attribute a claim only one side made.

Answer JSON only: {"headline": "...", "body": "..."}`;

function accountsText(all: LiveReport[]): string {
  return all
    .map((r, i) => {
      const hhmm = String(r.at).slice(11, 16);
      const body = String(r.text || "").replace(/^[^—]{2,30}—\s*/, "").trim();
      return `[${i + 1}] ${r.source}, ${hhmm}\nHeadline: ${r.summary}${body ? `\nBody: ${body}` : ""}`;
    })
    .join("\n\n");
}

/**
 * What the accounts had to say, for the "short source is its headline" rule:
 * the longest account, headline and body. A group of one-line posts stays a
 * headline.
 */
export function accountsSource(all: LiveReport[]): string {
  const texts = all.map((r) => {
    const body = String(r.text || "").replace(/^[^—]{2,30}—\s*/, "").trim();
    return `${String(r.summary || "").replace(/[.\s]+$/, "")}. ${body}`.trim();
  });
  return texts.sort((a, b) => b.length - a.length)[0] ?? "";
}

/** The figures an account states: tolls, counts, calibres. Times and dates are not facts to carry. */
function figures(s: string): string[] {
  return (String(s).replace(/\b\d{1,2}:\d{2}\b/g, "").match(/\b\d[\d,.]*\b/g) ?? [])
    .map((n) => n.replace(/[,.]$/, "").replace(/,/g, ""))
    .filter((n) => n.length && !/^(?:19|20)\d\d$/.test(n));
}

/**
 * What is wrong with a combined write-up, or "" when nothing is: English
 * only, every place and every headline figure of the accounts kept.
 */
export function combineProblem(w: Written, all: LiveReport[], places: Place[]): string {
  const out = `${w.headline} ${w.body}`;
  if (!w.headline.trim()) return "no headline";
  if (w.headline.length > 240) return "headline too long";
  // Two events in one headline, the second another party's claim: "Coalition
  // says Houthi claims misleading as Yemeni forces report 257 operations"
  // (3 Oct), "Houthis claim operations in Taiz as Yemeni forces say they hit
  // Houthi targets" (4 Oct). The later account was another story.
  if (MASHUP.test(w.headline)) return "two events in one headline";
  if (/[؀-ۿ]/.test(out)) return "Arabic in the copy";
  const lower = out.toLowerCase();
  const missing = places.filter((p) => !lower.includes(p.name.replace(/^the /i, "").toLowerCase()));
  if (missing.length) return `places left out: ${missing.map((p) => p.name).join(", ")}`;
  // Every name the write-up gives must be in the accounts (user, 2 Oct: a
  // "clashes in Taiz" group came out as an officer's death no account had).
  const said = [...all.map((r) => `${r.summary} ${r.text ?? ""} ${r.place ?? ""}`), ...places.map((p) => p.name)].join(" ").toLowerCase();
  const names = [...new Set(out.match(/(?<=\S\s+)[A-Z][a-z]{3,}/g) ?? [])].filter((n) => !said.includes(n.slice(0, 5).toLowerCase()) && !PLACE_WORDS.has(n.toLowerCase()));
  if (names.length) return `names not in the accounts: ${names.join(", ")}`;
  const have = new Set(figures(out));
  const lost = [...new Set(all.flatMap((r) => figures(r.summary)))].filter((n) => !have.has(n));
  if (lost.length) return `figures left out: ${lost.join(", ")}`;
  return "";
}

/** The model's answer made a card's copy, or null when it fails the checks. */
export function toWritten(json: Record<string, unknown> | null, all: LiveReport[], places: Place[]): Written | null {
  if (!json) return null;
  // The outlets are on the card: "…, says Al-Masirah" is not the headline's.
  const headline = stripAttribution(
    respell(stripSpellingNotes(roleNamesInProse(String(json.headline ?? "").trim()))).replace(/[.\s]+$/, ""),
    all.map((r) => r.source),
  );
  let body = respell(stripSpellingNotes(roleNamesInProse(String(json.body ?? "").trim())));
  // The same rule as a single card: short accounts make a headline-only card.
  if (redundantBody(headline, body, accountsSource(all))) body = "";
  const w = { headline: headline ? headline[0].toUpperCase() + headline.slice(1) : "", body };
  // The lead's side stays the side: a Houthi strike on Badr camp came back as
  // "Yemeni government forces strike Saudi military supplies" (7 Oct), from
  // Al Mayadeen's "القوات المسلحة اليمنية". And "Yemeni forces" on a Houthi
  // card are the Houthis.
  const lead = headlineSide(all[0]?.summary ?? "");
  const wrote = headlineSide(w.headline);
  if (lead && wrote && lead !== wrote) return null;
  if (lead === "houthi") {
    w.headline = w.headline.replace(/\b(?:the )?Yemen(?:i|'s) (?:armed )?(?:forces|army)\b/gi, "Houthi forces").replace(/^the Houthi/, "The Houthi");
    w.body = w.body.replace(/\b(?:the )?Yemen(?:i|'s) (?:armed )?(?:forces|army)\b/gi, "Houthi forces");
  }
  w.headline = unstutter(w.headline);
  w.body = unstutter(w.body);
  return combineProblem(w, all, places) ? null : w;
}

/** Who acts, as a headline opens: "Houthi …", "Yemeni government …", a speaker's side before the colon. */
function headlineSide(s: string): "houthi" | "gov" | "" {
  const t = String(s || "").trim();
  if (/^(?:The )?Houthi\b/i.test(t)) return "houthi";
  if (/^(?:Yemeni )?government (?:forces|army|troops)\b|^Yemeni government (?:forces|army|troops|air ?strikes?|warplanes?)\b/i.test(t)) return "gov";
  return "";
}

/** Words of the gazetteer's place names: a write-up may name the governorate a place is in. */
const PLACE_WORDS = new Set(Object.keys(PLACE_BY_NAME).flatMap((n) => n.toLowerCase().split(/[\s-]+/)));

function keyOf(all: LiveReport[]): string {
  const sig = all.map((r) => `${r.url}\n${r.summary}`).sort().join("\n");
  return createHash("sha256").update(sig).digest("hex").slice(0, 24);
}

/** Distinct outlets in a group: three posts from one channel are one account. */
function outlets(all: LiveReport[]): number {
  return new Set(all.map((r) => r.source)).size;
}

/** The one card: the lead's source and link, the combined copy, every place, the others under "Also". */
export function applyWritten(g: Group, w: Written, places: Place[]): LiveReport {
  const lead = g.lead;
  const one = places.length === 1 ? datelineFor(places[0]) : "";
  lead.summary = w.headline;
  lead.text = one && w.body ? `${one} — ${w.body}` : w.body;
  const land = places.find((p) => p.country !== "sea") ?? places[0];
  if (land) Object.assign(lead, { place: land.name, lat: land.lat, lng: land.lng });
  if (places.length > 1) lead.places = places.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng }));
  lead.tags = [...new Set([...(lead.tags ?? []), "combined"])];
  return lead;
}

/**
 * Writes the groups that need it as one card each, at most `COMBINE_CALLS`
 * model calls a tick, waves first. `plans` come from `planWaves`, each group
 * already led by `pickLead`. Returns the groups to publish: a wave written as
 * one becomes one group; a wave that could not be written is split back.
 */
export async function combineGroups(
  plans: Group[][],
  ask: Ask,
  rank: (r: LiveReport) => number,
  store?: DeskStore,
  isNew: (r: LiveReport) => boolean = () => true,
): Promise<{ groups: Group[]; written: number; asked: number; tried: number }> {
  type Job = { parts: Group[]; group: Group; all: LiveReport[]; places: Place[]; key: string };
  const jobs: Job[] = [];
  const out: Group[] = [];
  for (const parts of plans) {
    const all = parts.flatMap(members);
    const group = parts.length > 1 ? pickLead(all, rank) : parts[0];
    const places = placesOf(all);
    // Written only from one scan's accounts: a card an earlier scan published
    // keeps its text, and a later account of it is only "Also".
    if ((parts.length > 1 || outlets(all) > 1) && all.every(isNew)) jobs.push({ parts, group, all: members(group), places, key: keyOf(all) });
    else if (parts.length > 1) out.push(...parts);
    else out.push(group);
  }
  // Waves first (they are split back if unwritten), then the most accounts.
  jobs.sort((a, b) => Number(b.parts.length > 1) - Number(a.parts.length > 1) || b.all.length - a.all.length);

  const cached = store ? await store.getMany<Written | null>(PREFIX, jobs.map((j) => j.key)).catch(() => ({})) : {};
  const fresh: Record<string, Written | null> = {};
  let asked = 0;
  const results = await Promise.all(
    jobs.map(async (j): Promise<Written | null> => {
      if (j.key in cached) return (cached as Record<string, Written | null>)[j.key];
      if (asked >= COMBINE_CALLS) return null;
      asked += 1;
      const deadline = new Promise<null>((r) => setTimeout(() => r(null), COMBINE_MS));
      const json = await Promise.race([ask(SYSTEM, accountsText(j.all)).catch(() => null), deadline]);
      const w = toWritten(json, j.all, j.places);
      fresh[j.key] = w;
      return w;
    }),
  );
  if (store && Object.keys(fresh).length) {
    await store.putMany(PREFIX, fresh).catch(() => {});
    if (Math.random() < 0.05) await store.prune(PREFIX, KEEP_MS).catch(() => {});
  }

  let written = 0;
  jobs.forEach((j, i) => {
    const w = results[i];
    if (w) {
      applyWritten(j.group, w, j.places);
      written += 1;
      out.push(j.group);
    } else if (j.parts.length > 1) out.push(...j.parts);
    else out.push(j.group);
  });
  return { groups: out, written, asked, tried: jobs.length };
}

/* ------------------------------------------------------------------ *
 * A later account that adds something, written into the card it folds into
 * ------------------------------------------------------------------ */

/** Cards rewritten a tick from a later account's new facts. */
export const ENRICH_CALLS = 4;

/**
 * Does a later account of the same event say something the card does not: a
 * figure it lacks, or a place it does not name? Only then is the card written
 * again; an account that adds nothing only joins "Also".
 */
export function addsFacts(home: LiveReport, r: LiveReport): boolean {
  const h = `${home.summary} ${home.text ?? ""}`;
  const have = new Set(figures(h));
  if (figures(`${r.summary} ${r.text ?? ""}`).some((n) => !have.has(n))) return true;
  const lower = h.toLowerCase();
  // A statement's other point: "civilians must stay away from military
  // sites" folded under "all Houthi activities are monitored" was lost.
  if (r.type === "statement" || r.type === "diplomacy") {
    const said = r.summary.replace(/^[^:]{2,70}:\s+/, "");
    const FILLER = /^(?:that|this|with|from|have|been|will|were|said|says|their|they|them|also|into|over|about|after|would|could|should)$/;
    const fresh = (said.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []).filter((w) => !FILLER.test(w) && !lower.includes(w.replace(/(?:es|s|ed|ing)$/, "")));
    if (new Set(fresh).size >= 3) return true;
  }
  const homePlaces = new Set([home.place, ...(home.places ?? []).map((p) => p.name)].filter(Boolean));
  return [r.place, ...(r.places ?? []).map((p) => p.name)].some(
    (n) => !!n && !homePlaces.has(n) && !lower.includes(n.replace(/^the /i, "").toLowerCase()) && !!PLACE_BY_NAME[n],
  );
}

/**
 * Writes each card again from its own copy and the later accounts that add to
 * it (`pairs` from the fold), at most `ENRICH_CALLS` model calls. The card keeps
 * its identity, source and link; its headline and body now carry every fact.
 * Returns the cards rewritten, tagged "merged" so the store saves the copy.
 */
export async function enrichCards(pairs: [LiveReport, LiveReport][], ask: Ask, store?: DeskStore): Promise<LiveReport[]> {
  const byHome = new Map<LiveReport, LiveReport[]>();
  for (const [home, r] of pairs) byHome.set(home, [...(byHome.get(home) ?? []), r]);
  const jobs = [...byHome].slice(0, ENRICH_CALLS).map(([home, adds]) => {
    const all = [home, ...adds];
    return { home, adds, all, places: placesOf(all), key: `enr-${keyOf(all)}` };
  });
  if (!jobs.length) return [];
  const cached = store ? await store.getMany<Written | null>(PREFIX, jobs.map((j) => j.key)).catch(() => ({})) : {};
  const fresh: Record<string, Written | null> = {};
  const out: LiveReport[] = [];
  await Promise.all(
    jobs.map(async (j) => {
      let w: Written | null;
      if (j.key in cached) w = (cached as Record<string, Written | null>)[j.key];
      else {
        const deadline = new Promise<null>((res) => setTimeout(() => res(null), COMBINE_MS));
        const json = await Promise.race([ask(SYSTEM, accountsText(j.all)).catch(() => null), deadline]);
        w = toWritten(json, j.all, j.places);
        fresh[j.key] = w;
      }
      if (!w) return;
      applyWritten({ lead: j.home, others: j.adds }, w, j.places);
      j.home.tags = [...new Set([...(j.home.tags ?? []), "merged"])];
      out.push(j.home);
    }),
  );
  if (store && Object.keys(fresh).length) await store.putMany(PREFIX, fresh).catch(() => {});
  return out;
}
