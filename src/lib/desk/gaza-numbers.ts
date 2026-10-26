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
export type Box =
  | { type: "claims"; title: string; unit?: string; note?: string; rows: { label: string; sub?: string; off: Cell | null; unoff: Cell | null }[] }
  | { type: "table"; title: string; unit?: string; note?: string; cols: string[]; rows: { label: string; sub?: string; cells: (Cell | null)[] }[] }
  | { type: "stat"; title: string; unit?: string; note?: string; value: Cell; caption?: string }
  | { type: "list"; title: string; note?: string; cols: [string, string?][]; rows: (string | Cell)[][]; stats?: [Cell, string][] };

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

  // Killed and wounded.
  type Sum = { n: number; last?: GazaCard };
  const z = (): Sum => ({ n: 0 });
  const sums: Record<string, { off: Sum; unoff: Sum }> = {};
  const add = (key: string, off: boolean, n: number, c: GazaCard) => {
    if (!n) return;
    const s = (sums[key] ??= { off: z(), unoff: z() })[off ? "off" : "unoff"];
    s.n += n;
    s.last ??= c;
  };
  for (const c of all) {
    if (TALLY.test(c.summary)) continue;
    const side = hurtSide(c);
    const cardArea = areaOf(c);
    if (!side) continue;
    const off = officialCard(c);
    // Clause by clause: "Israeli extremists raid Awarta near Nablus; three Palestinians killed south of Khan Younis".
    for (const part of c.summary.split(/;|\.\s/)) {
      const { dead, hurt } = hurtIn(part);
      if (!dead && !hurt) continue;
      const area = GAZA_PLACES.test(part) ? "gaza" : JS_PLACES.test(part) ? "js" : cardArea;
      const where = side === "israeli" ? "israeli" : area;
      if (!where) continue;
      add(`${where}:dead`, off, dead, c);
      add(`${where}:hurt`, off, hurt, c);
    }
  }
  const cell = (key: string, which: "off" | "unoff"): Cell | null => {
    const s = sums[key]?.[which];
    return s && s.n && s.last ? { ...cellOf(s.last, s.n, which), note: "the latest report counted" } : null;
  };
  const row = (label: string, key: string, sub?: string) => ({ label, ...(sub ? { sub } : {}), off: cell(key, "off"), unoff: cell(key, "unoff") });
  const boxes: Box[] = [
    {
      type: "claims",
      title: "Killed and wounded",
      unit: `since ${fmt(from)}`,
      note: "Counted by the desk from single events in its reports, each event once; a day's toll or a running total is not added. Official: the health ministries, the Red Crescent, Magen David Adom, the IDF and the police.",
      rows: [
        row("Palestinians killed", "gaza:dead", "Gaza"),
        row("Palestinians wounded", "gaza:hurt", "Gaza"),
        row("Palestinians killed", "js:dead", "Judea and Samaria"),
        row("Palestinians wounded", "js:hurt", "Judea and Samaria"),
        row("Israelis killed", "israeli:dead"),
        row("Israelis wounded", "israeli:hurt"),
      ],
    },
  ];

  // The Gaza Health Ministry's own running count since the ceasefire of October 2025, as last reported.
  const RUNNING = /\b(\d[\d,]{2,})\s+(?:Palestinians\s+)?killed\s+since\s+(?:the\s+)?(?:ceasefire|truce)/i;
  const running = all.find((c) => RUNNING.test(c.summary));
  if (running) {
    const n = RUNNING.exec(running.summary)![1];
    boxes.push({ type: "stat", title: "Killed in Gaza since the ceasefire", unit: "October 2025", value: { ...cellOf(running, n), k: officialCard(running) ? "off" : "unoff" }, caption: `the Gaza Health Ministry's running count, as reported ${fmt(day(running.at))}` });
  }

  // Incidents by kind and area.
  const kindRows = KINDS.map((k) => {
    const cells = (["gaza", "js"] as const).map((area) => {
      if (k.area && k.area !== area) return null;
      const hits = all.filter((c) => areaOf(c) === area && k.re.test(c.summary) && (!k.actor || k.actor.includes(actorOf(c)) || (k.label === "Israeli extremists' violence" && /\bextremists?\b/i.test(c.summary))));
      return hits.length ? cellOf(hits[0], hits.length, "off", "reports; the newest linked") : null;
    });
    return { label: k.label, cells };
  }).filter((r) => r.cells.some(Boolean));
  if (kindRows.length) boxes.push({ type: "table", title: "Incidents", unit: `reports since ${fmt(from)}`, cols: ["", "Gaza", "Judea and Samaria"], rows: kindRows, note: "Each figure is the number of the desk's reports of that kind; it opens the newest." });

  // The crossings and the aid.
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
  if (crossRows.length) boxes.push({ type: "table", title: "The crossings", cols: ["", "Now"], rows: crossRows, note: "As the latest report on each has it." });
  const trucks = all.find((c) => /\b\d[\d,]*\s+(?:aid\s+)?trucks\b/i.test(c.summary));
  if (trucks) {
    const n = /\b(\d[\d,]*)\s+(?:aid\s+)?trucks\b/i.exec(trucks.summary)![1];
    boxes.push({ type: "stat", title: "Aid trucks", value: cellOf(trucks, n), caption: `the latest count reported, ${fmt(day(trucks.at))}` });
  }

  // The reports themselves.
  for (const l of LISTS) {
    const rows = all.filter((c) => (l.arena && (c.flags ?? []).includes(`arena:${l.arena}`)) || l.re.test(c.summary)).slice(0, 40);
    if (!rows.length) continue;
    boxes.push({ type: "list", title: l.title, cols: [["Date", "l"], ["Report", "l"]], rows: rows.map((c) => [fmt(day(c.at)), cellOf(c, c.summary)]), stats: [[{ v: rows.length }, `report${rows.length === 1 ? "" : "s"} since ${fmt(from)}`]] });
  }
  return { boxes, from, reports: all.length };
}

function fmt(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : ymd;
}
