/**
 * The Gaza – Judea & Samaria desk's numbers (plan stage 6; user, 26 Oct: "continue the gaza desk as we said with
 * all its categories"), counted from the desk's own cards since it began reading (23 Oct 2026), each event once
 * (the cards as served, folded), each figure linked to the report it rests on. The boxes take the Iran desk's
 * shapes (public/app.js irBox): claims, table, stat and list.
 *
 * - Killed and wounded, Gaza and Judea and Samaria apart, Palestinians and Israelis apart; Official is what the
 *   health ministries, the Red Crescent, Magen David Adom, the IDF and the police told, Unofficial the rest.
 *   A tally (today's dead, the toll since …) is never added up: only single events.
 * - Incidents by kind and area: strikes and fire, raids, arrests, demolitions, extremists' violence, attacks on
 *   Israelis, clan and militia clashes.
 * - The crossings, each as its latest report has it, and the latest count of aid trucks.
 * - The day after, Palestinian politics, sanctions and the PA's money: the reports themselves, newest first.
 */

export type GazaCard = {
  fp: string;
  at: string;
  source: string;
  url: string;
  type?: string | null;
  summary: string;
  text?: string | null;
  flags?: string[];
  alsoReportedBy?: { source: string; url?: string }[];
};
export type Cell = { v: string | number | null; url?: string; src?: string; date?: string; k?: "off" | "unoff"; note?: string };
/** A box's dated figures, drawn as its chart from the chart sign by its name (public/app.js irChart). */
export type Point = { d: string; v: number };
export type Box = { set?: string; setName?: string; series?: Point[]; seriesUnit?: string; zero?: boolean } & (
  | { type: "claims"; title: string; unit?: string; note?: string; rows: { label: string; sub?: string; off: Cell | null; unoff: Cell | null }[] }
  | { type: "table"; title: string; unit?: string; note?: string; cols: string[]; rows: { label: string; sub?: string; cells: (Cell | null)[] }[] }
  | { type: "stat"; title: string; unit?: string; note?: string; value: Cell; caption?: string }
  | { type: "list"; title: string; note?: string; cols: [string, string?][]; rows: (string | Cell)[][]; stats?: [Cell, string][] });

export const GAZA_NUMBERS_FROM = "2026-10-23";

const NUM_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, dozens: 24,
};
const N = "(\\d[\\d,]*|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)";
const num = (s: string) => (/^\d/.test(s) ? Number(s.replace(/,/g, "")) : NUM_WORDS[s.toLowerCase()] ?? NaN);
const PERSON = "(?:Palestinians?|people|persons?|civilians?|children|child|girls?|boys?|women|woman|men|man|teenagers?|youths?|soldiers?|reservists?|officers?|Israelis?|settlers?|citizens?|members?|fighters?|operatives?|guards?|students?|journalists?|paramedics?|farmers?|fishermen|worker|workers|brothers|sisters)";

/** The most killed and wounded a single report tells: "kills three", "two killed", "wounds 10", "a girl killed". */
export function hurtIn(s: string): { dead: number; hurt: number } {
  const t = String(s || "");
  const pick = (res: RegExp[]) => {
    let best = 0;
    for (const re of res) for (const m of t.matchAll(re)) { const v = num(m[1]); if (Number.isFinite(v) && v > best && v < 500) best = v; }
    return best;
  };
  const dead = pick([
    new RegExp(`\\bkill(?:s|ed|ing)\\s+(?:at least\\s+|more than\\s+)?${N}\\b`, "gi"),
    new RegExp(`\\b${N}\\s+(?:[\\w'-]+\\s+){0,3}?(?:killed|dead)\\b`, "gi"),
    new RegExp(`\\bkill(?:s|ed|ing)\\s+(a|an)\\s+(?:[\\w'-]+\\s+){0,2}?${PERSON}\\b`, "gi"),
    new RegExp(`\\b(a|an|one)\\s+(?:[\\w'-]+\\s+){0,2}?${PERSON}\\s+(?:was\\s+|is\\s+)?killed\\b`, "gi"),
    new RegExp(`\\bkilling of\\s+(?:at least\\s+)?${N}\\s+(?:[\\w'-]+\\s+){0,2}?${PERSON}\\b`, "gi"),
  ]);
  const hurt = pick([
    new RegExp(`\\b(?:wound|injur)(?:s|es|ed|ing)\\s+(?:at least\\s+|more than\\s+|over\\s+)?${N}\\b`, "gi"),
    new RegExp(`\\b${N}\\s+(?:[\\w'-]+\\s+){0,3}?(?:wounded|injured|hurt)\\b`, "gi"),
    new RegExp(`\\b(?:wound|injur)(?:s|es|ed|ing)\\s+(a|an)\\s+(?:[\\w'-]+\\s+){0,2}?${PERSON}\\b`, "gi"),
  ]);
  return { dead, hurt };
}

/** A day's or a war's tally, a recovery of bodies, a recap: no single event, never added up. */
const TALLY = /\b(?:today|yesterday|past (?:24|48|72) hours|in 24 hours|(?:past|last|this) (?:week|month|days)|over the past|since|so far|toll|total|cumulative|this week|this month|bodies|remains|recovered|retrieved|died of (?:earlier )?wounds|succumbed)\b/i;
/** An earlier toll retold: "raids Hebron after attack killing two soldiers", "names soldiers killed", a funeral, an inquiry. */
const RETOLD = /\b(?:after|following|over|for|avenge|revenge for)\s+(?:the\s+|an?\s+|last\s+\w+'s\s+)?(?:attack|killing|shooting|deaths?)\b|\bnames?\b[^.;]{0,40}\bkilled\b|\bnamed\b|\binvestigation\b|\binquiry\b|\bfunerals?\b|\bmourn\w*|\bvows?\b/i;
const OFFICIAL = /\b(?:Health Ministry|Ministry of Health|MoH|Civil Defen[cs]e|Red Crescent|PRCS|Magen David Adom|MDA|IDF|Israel Police|Shin Bet|COGAT|Government Media Office|Avichay Adraee|Ella Waweya)\b/i;
const officialCard = (c: GazaCard) => OFFICIAL.test(c.source) || (c.alsoReportedBy ?? []).some((a) => OFFICIAL.test(a.source));
const GAZA_PLACES = /\b(?:Gaza\w*|Khan Y(?:ou|u|o)nis|Rafah|Jabalia|Deir al-Balah|Nuseirat|Bureij|Maghazi|Beit Lahia|Beit Hanoun|Mawasi|Shuja'?iyya|Zeitoun|Tuffah|Sheikh Radwan|Netzarim|yellow line)\b/i;
const JS_PLACES = /\b(?:Judea|Samaria|West Bank|Hebron|Nablus|Jenin|Ramallah|al-Bireh|Tulkarm|Nur Shams|Qalqilya|Bethlehem|Jericho|Tubas|Salfit|Jordan Valley|Jerusalem|Qabatiya|Sinjil|Turmus Ayya|Huwara|Beita|Masafer Yatta)\b/i;

export function areaOf(c: GazaCard): "gaza" | "js" | null {
  const f = c.flags ?? [];
  if (f.includes("arena:gaza")) return "gaza";
  if (f.includes("arena:judea_samaria") || f.includes("arena:jerusalem")) return "js";
  if (GAZA_PLACES.test(c.summary)) return "gaza";
  if (JS_PLACES.test(c.summary)) return "js";
  return null;
}
const actorOf = (c: GazaCard) => (c.flags ?? []).find((f) => f.startsWith("actor:"))?.slice(6) ?? "";

const ISRAELI_HURT = /\b(?:Israeli (?:soldiers?|reservists?|officers?|civilians?|citizens?|man|woman|men|women|police(?:man| officer)?s?|border police)|IDF (?:soldiers?|officers?|reservists?)|soldiers?|reservists?)\b[^.;]{0,60}\b(?:killed|wounded|injured|hurt)\b|\b(?:kill(?:s|ed|ing)?|wound(?:s|ed|ing)?|injur(?:es|ed|ing)?)\b[^.;]{0,40}\b(?:Israeli (?:soldiers?|civilians?|citizens?)|IDF soldiers?|soldiers?)\b/i;
const BY_ISRAEL = /\bIsraeli (?:fire|strikes?|air ?strikes?|drones?|forces|army|troops|tanks?|gunfire|artillery|shelling|extremists|settlers|navy|quadcopter)\b|\bIDF\b|\bby Israel\b/i;

/** Whose dead a card counts: the Palestinians' (by Israel's fire or extremists), Israelis', or none it can tell. */
export function hurtSide(c: GazaCard): "palestinian" | "israeli" | null {
  const s = c.summary;
  if (ISRAELI_HURT.test(s) && !/\bPalestinians?\b[^.;]{0,30}\b(?:killed|wounded)/i.test(s)) return "israeli";
  const a = actorOf(c);
  if (a === "israel" || a === "israeli_citizens" || BY_ISRAEL.test(s)) return "palestinian";
  if (/\bPalestinians?\b/i.test(s)) return "palestinian";
  return null;
}

const day = (at: string) => new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
const cellOf = (c: GazaCard, v: number | string, k: "off" | "unoff" = "off", note?: string): Cell => ({ v, url: c.url, src: c.source, date: day(c.at), k, ...(note ? { note } : {}) });

type Kind = { label: string; re: RegExp; area?: "gaza" | "js"; actor?: string[] };
const KINDS: Kind[] = [
  { label: "Israeli strikes and fire", re: /\b(?:air ?strikes?|strikes?|shell(?:s|ed|ing)|artillery|gunfire|opens? fire|fire (?:at|on|toward)|drones? (?:drop|strike|fire)|bomb(?:s|ed|ing)?)\b/i, actor: ["israel"] },
  { label: "Raids", re: /\b(?:raids?|raided|storm(?:s|ed)?|incursions?|enters?|sweep)\b/i, actor: ["israel"] },
  { label: "Arrests", re: /\b(?:arrests?|arrested|detain(?:s|ed)?|abduct(?:s|ed)?)\b/i },
  { label: "Demolitions and bulldozing", re: /\b(?:demolish(?:es|ed)?|demolitions?|bulldoz(?:e|es|ed|ing)|raze[sd]?|blows? up|detonat(?:es|ed))\b/i },
  { label: "Israeli extremists' violence", re: /\bextremists?\b/i, actor: ["israeli_citizens"] },
  { label: "Attacks on Israelis", re: /\b(?:shooting attack|stabbing|ramming|car-ramming|attack(?:s|ed)? (?:on|against) (?:Israelis?|soldiers|IDF|a checkpoint)|explosive device|IED|rocket|sniper)\b/i, actor: ["hamas", "factions"] },
  { label: "Clan and militia clashes", re: /\b(?:clans?|famil(?:y|ies) clash|militias?|Popular Forces|Abu Shabab|gangs?|armed groups? clash)\b/i, area: "gaza" },
];

const CROSSINGS: [string, RegExp][] = [
  ["Kerem Shalom", /\bKerem Shalom\b|كرم أبو سالم/i],
  ["Zikim", /\bZikim\b|زيكيم/i],
  ["Kissufim", /\bKissufim\b|كيسوفيم/i],
  ["Rafah", /\bRafah\b|معبر رفح/i],
  ["Allenby (King Hussein Bridge)", /\bAllenby\b|King Hussein Bridge|جسر الملك حسين/i],
];
const OPEN = /\b(?:open(?:s|ed|ing)?|reopen(?:s|ed|ing)?|resum(?:es|ed))\b/i;
const SHUT = /\b(?:clos(?:e|es|ed|ing|ure)|shut(?:s|down)?|remains? closed|suspend(?:s|ed)?|halt(?:s|ed)?)\b/i;

const LISTS: { title: string; re: RegExp; arena?: string }[] = [
  { title: "The day after", arena: "day_after", re: /\b(?:Board of Peace|stabili[sz]ation force|NCAG|Gaza committee|technocrat|disarm\w*|reconstruction|Mladenov|Kushner|Witkoff|Tony Blair|20-point plan|Trump plan|Sharm el-Sheikh)\b/i },
  { title: "Palestinian politics", arena: "politics", re: /\b(?:elections?|Fatah|PLO|Palestinian National Council|Central Council|Revolutionary Council|Tanzim|Barghouti|Dahlan|al-Qudwa|reconciliation|Central Elections Commission|al-Hayya|Mashaal|Meshaal|Preventive Security|General Intelligence|succession|vice president)\b/i },
  { title: "Sanctions", arena: "sanctions", re: /\bsanction\w*\b/i },
  { title: "The PA's money", re: /\b(?:clearance (?:revenues?|funds|money)|tax revenues|withh[oe]ld\w* (?:funds|revenues|money)|salar(?:y|ies)|PA (?:budget|finances|financial crisis|debts?)|Palestinian Authority(?:'s)? (?:budget|finances|funds|financial crisis)|Smotrich\b[^.]{0,40}\b(?:funds|money|revenues))\b|المقاصة|الرواتب/i },
];

/** The desk's numbers from its served cards (newest first or any order). */
export function gazaNumbers(cards: GazaCard[], from = GAZA_NUMBERS_FROM): { boxes: Box[]; from: string; reports: number } {
  const floor = Date.parse(`${from}T00:00:00+03:00`);
  const all = cards.filter((c) => Date.parse(c.at) >= floor).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  // The live figures only (user, 26 Oct: everything counts from the ceasefire of 10 Oct 2025, so the researched
  // sets carry the rest, public/gaza-numbers.json); each box says the category it joins.
  const boxes: Box[] = [];

  // The Gaza Health Ministry's own running count since the ceasefire of October 2025, as last reported.
  const RUNNING = /\b(\d[\d,]{2,})\s+(?:Palestinians\s+)?killed\s+since\s+(?:the\s+)?(?:ceasefire|truce)/i;
  const running = all.find((c) => RUNNING.test(c.summary));
  if (running) {
    const n = RUNNING.exec(running.summary)![1];
    // Its chart: the ministry's count at the ceasefire and as researched (public/gaza-timeline.json, gaza-numbers.json),
    // then each day's highest count the cards told (user, 26 Oct: graphs that update with the figures).
    const told = dayMax(all.flatMap((c) => { const m = RUNNING.exec(c.summary); return m ? [{ d: day(c.at), v: Number(m[1].replace(/,/g, "")) }] : []; }));
    const series = keepRising([...KILLED_SEED, ...told]);
    boxes.push({ set: "cas", type: "stat", title: "Killed in Gaza since the ceasefire", unit: "since 10 Oct 2025", value: { ...cellOf(running, n), k: "unoff" }, caption: `Gaza's Hamas-run Health Ministry says, as reported ${fmt(day(running.at))}`, series, seriesUnit: "killed since the ceasefire, as the ministry says" });
  }

  // The crossings.
  // The clause that names the crossing tells its state: "Kerem Shalom crossing opens; Rafah, Zikim and Kissufim
  // remain closed". Rafah alone is the city: it counts as the crossing beside a crossing word or another crossing.
  const crossState = (name: string, re: RegExp, s: string): string | null => {
    for (const part of s.split(/;|\.\s/)) {
      if (!re.test(part)) continue;
      if (name === "Rafah" && !/\bcrossings?\b|Kerem Shalom|Zikim|Kissufim|معبر/i.test(part)) continue;
      if (/\bpartial\w*|one-way|limited\b/i.test(part)) return "Partly open";
      if (SHUT.test(part) && !/\breopen/i.test(part)) return "Closed";
      if (OPEN.test(part) || /\b(?:enter(?:ed|s)?|via|through)\b/i.test(part)) return "Open";
    }
    return null;
  };
  const crossRows = CROSSINGS.map(([name, re]) => {
    for (const c of all) {
      const v = crossState(name, re, c.summary);
      if (v) return { label: name, cells: [cellOf(c, v)] };
    }
    return null;
  }).filter((r): r is { label: string; cells: Cell[] } => !!r);
  if (crossRows.length) boxes.push({ set: "aid", type: "table", title: "The crossings", cols: ["", "Now"], rows: crossRows, note: "As the latest report on each has it." });

  // The latest count of aid trucks, with the time it covers as the report tells it (user, 26 Oct: the figure did
  // not say its span): the clause itself is the caption.
  const TRUCKS = /\b(\d[\d,]*)\s+(?:aid\s+|humanitarian\s+|commercial\s+)?trucks\b/i;
  const trucks = all.find((c) => TRUCKS.test(c.summary));
  if (trucks) {
    const clause = trucks.summary.split(/;|\.\s/).find((p) => TRUCKS.test(p)) ?? trucks.summary;
    const n = TRUCKS.exec(clause)![1];
    // Its chart: the trucks each day's reports told for that one day (a week's or a month's total left out).
    const series = dayMax(all.flatMap((c) => {
      const cl = c.summary.split(/;|\.\s/).find((p) => TRUCKS.test(p));
      if (!cl || /\b(?:week|month|since|so far|total|cumulative|past \d+ days)\b/i.test(cl)) return [];
      const v = Number(TRUCKS.exec(cl)![1].replace(/,/g, ""));
      return v > 0 && v < 2000 ? [{ d: day(c.at), v }] : [];
    }));
    boxes.push({ set: "aid", type: "stat", title: "Aid trucks, latest report", unit: spanOf(clause, trucks.at), value: cellOf(trucks, n, officialCard(trucks) ? "off" : "unoff"), caption: `${clause.trim()} (${trucks.source}, ${fmt(day(trucks.at))})`, series, seriesUnit: "trucks a day, as reported", zero: true });
  }
  return { boxes, from, reports: all.length };
}

/** The Health Ministry's count of the killed since the ceasefire before the desk read it (researched, sourced). */
const KILLED_SEED: Point[] = [
  { d: "2025-10-10", v: 0 },
  { d: "2026-06-17", v: 1005 },
  { d: "2026-10-22", v: 1538 },
];
/** One point a day, its highest figure. */
export function dayMax(pts: Point[]): Point[] {
  const m = new Map<string, number>();
  for (const p of pts) if (Number.isFinite(p.v)) m.set(p.d, Math.max(m.get(p.d) ?? -Infinity, p.v));
  return [...m].map(([d, v]) => ({ d, v })).sort((a, b) => a.d.localeCompare(b.d));
}
/** A running count only grows: a day's figure below an earlier one (a misread, a partial count) is left out. */
export function keepRising(pts: Point[]): Point[] {
  let top = -Infinity;
  return dayMax(pts).filter((p) => (p.v >= top ? ((top = p.v), true) : false));
}

/** The time a count covers, from its words: "today", "this week", "since Sunday", else the day it was told. */
export function spanOf(s: string, at: string): string {
  const t = String(s || "");
  const m = /\b(?:in the past|over the past|in the last|during the past)\s+(?:24|48|72)\s+hours\b|\b(?:today|yesterday|this week|last week|this month|last month|daily|a day|per day|each day|since [A-Z]?\w+(?: \d{1,2})?)\b/i.exec(t);
  return m ? m[0].toLowerCase() : `told ${fmt(day(at))}`;
}

function fmt(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : ymd;
}
