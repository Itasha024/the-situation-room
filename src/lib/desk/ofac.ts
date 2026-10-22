/**
 * US sanctions on Iran and Hezbollah, read from OFAC itself (user, 17 Oct: the
 * Treasury's 15 Oct sanctions never reached the numbers). Server-only fetch,
 * pure parsing.
 *
 * The Iran desk's numbers are a researched file (public/iran-numbers.json, as
 * of 11 Oct) that nothing moved. OFAC's Recent Actions page lists every action
 * with its date, and each action's page lists every person, firm, ship and
 * aircraft added, with its sanctions program in brackets ([IRAN-EO13902]).
 * So the count is OFAC's own list, never a model's reading of a report.
 */

import type { DeskStore } from "./store.ts";
import { askChain, NUMBERS_MODELS } from "./models.ts";

export const OFAC_KEY = "iran:ofac";
export const OFAC_BASE = "https://ofac.treasury.gov";
export const OFAC_LIST = `${OFAC_BASE}/recent-actions`;
/** OFAC is read at most this often; it posts a few actions a week. */
export const OFAC_EVERY_MS = 60 * 60_000;
/** How far back the list is followed, and the most action pages opened in one go. */
const KEEP_DAYS = 45;
const OPEN_MAX = 8;
const LIST_PAGES = 5;

export type OfacListItem = { id: string; url: string; title: string; date: string; category: string };
export type OfacPress = { title: string; url: string };
export type OfacAdded = { people: number; firms: number; vessels: number; aircraft: number };
export type OfacAction = OfacListItem & {
  /** On Iran or Hezbollah: the title or a press release names them, or an entry carries an Iran program. */
  iran: boolean;
  press: OfacPress[];
  /** Iran- and Hezbollah-linked entries added to the SDN list. */
  added: OfacAdded;
  /** A few of the names added, banks first. */
  names: string[];
  /** Iran measures in the action's text other than listings: alerts, determinations, general licences. */
  measures: string[];
  /** The Treasury press release's opening paragraphs, its own words (23 Oct). */
  lead?: string;
  /** Why, in one short plain line written from `lead` only (user, 23 Oct: "explain it better based only on the official statement"). */
  why?: string;
  /** Tries at writing `why`. */
  whyTries?: number;
};
export type OfacStore = { checkedAt: string; actions: OfacAction[] };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&#8217;/g, "’")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** "October 15, 2026" → "2026-10-15". */
function isoOf(s: string): string {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (m) {
    const mon = MONTHS.indexOf(m[1].toLowerCase());
    if (mon >= 0) return `${m[3]}-${String(mon + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const n = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  return n ? `${n[3]}-${n[1].padStart(2, "0")}-${n[2].padStart(2, "0")}` : "";
}

/** The Recent Actions list: one row per action, newest first. */
export function parseRecentActions(html: string): OfacListItem[] {
  const out: OfacListItem[] = [];
  for (const row of html.split(/class="[^"]*\bviews-row\b[^"]*"/).slice(1)) {
    const a = /<a href="(\/recent-actions\/(\d{8}(?:_\d+)?))"[^>]*>([\s\S]*?)<\/a>/.exec(row);
    const date = isoOf(/([A-Za-z]+ \d{1,2}, \d{4})/.exec(row)?.[1] || "");
    if (!a || !date || out.some((x) => x.id === a[2])) continue;
    const category = /<a href="\/recent-actions\/[a-z-]+"[^>]*>([^<]*)<\/a>/.exec(row)?.[1] || "";
    out.push({ id: a[2], url: `${OFAC_BASE}${a[1]}`, title: text(a[3]), date, category: text(category) });
  }
  return out;
}

const ON_IRAN = /\bIran(?:ian)?\b|Hizballah|Hezbollah|\bIRGC\b|Revolutionary Guard|Economic (?:Outcast|Fury)/i;
/** Iran's programs as OFAC tags them ([IRAN-EO13902], [IRGC], [IFSR], [IRAN-CON-ARMS-EO]...). */
const IRAN_TAG = /\[(?:IRAN[A-Z0-9-]*|IRGC|IFSR|HRIT-IR)\]/;
const HEZBOLLAH = /HIZBALLAH|HEZBOLLAH/i;

/** One action's page: its date, press releases and the entries added, Iran-linked ones counted. */
export function parseAction(item: OfacListItem, html: string): OfacAction {
  const date = isoOf(/Release Date[\s\S]*?field__item">([^<]+)</.exec(html)?.[1] || "") || item.date;
  const pressBlock = /Press Release Link[\s\S]*?<\/div>\s*<\/div>/.exec(html)?.[0] || "";
  const press = [...pressBlock.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ url: decode(m[1]).replace(/\/$/, ""), title: text(m[2]) }))
    .filter((p) => !/\/media\/|download/i.test(p.url));
  const body = /field--name-field-recent-actions-body[\s\S]*?<div class="field__item">([\s\S]*?)<\/div>\s*(?:<\/div>|<div class="field)/.exec(html)?.[1]
    ?? /Recent Actions Body[\s\S]*?<div class="field__item">([\s\S]*)/.exec(html)?.[1]
    ?? html;
  // Every press release on Iran: the whole action is Iran's, whatever program an entry is listed under (A7, 1 Oct).
  const allIran = press.length > 0 && press.every((p) => ON_IRAN.test(p.title));
  const added: OfacAdded = { people: 0, firms: 0, vessels: 0, aircraft: 0 };
  const banks: string[] = [];
  const others: string[] = [];
  const sections = body.split(/<h4[^>]*>/i).slice(1);
  for (const sec of sections) {
    const head = text(sec.split(/<\/h4>/i)[0]);
    const kind = /^The following (individuals|entities|vessels|aircraft) have been added/i.exec(head)?.[1].toLowerCase();
    if (!kind) continue;
    const rest = sec.split(/<\/h4>/i)[1] || "";
    const block = rest.split(/<hr|<h3/i)[0];
    const entries = block
      .split(/<br\s*\/?>\s*<br\s*\/?>|<\/p>\s*<p[^>]*>/i)
      .map(text)
      .filter((e) => e.length > 10);
    for (const e of entries) {
      if (!(allIran || IRAN_TAG.test(e) || HEZBOLLAH.test(e))) continue;
      const key = kind === "individuals" ? "people" : kind === "entities" ? "firms" : kind === "vessels" ? "vessels" : "aircraft";
      added[key] += 1;
      if (kind === "entities") (/Financial Institution|\bBANK\b/i.test(e) ? banks : others).push(nameOf(e));
    }
  }
  // An alert, a determination or an advisory, by the name OFAC gives it ("Notice to Foreign Financial Institutions ...").
  const plain = text(body);
  const measures: string[] = [];
  for (const m of plain.matchAll(/Iran-related (?:OFAC )?(Alert|Determination|Advisory)\s*,?\s*["“]\s*([^"”]{8,200}?)\s*[.,]?\s*["”]/gi)) {
    measures.push(`OFAC ${m[1].toLowerCase()}: ${m[2]}`);
  }
  if (!measures.length) {
    for (const seg of item.title.split(/;\s*/)) {
      const m = /Iran-related (?:OFAC )?(Alert|Determination|Advisory)/i.exec(seg);
      if (m) measures.push(`OFAC ${m[1].toLowerCase()} on Iran`);
    }
  }
  const iran = ON_IRAN.test(item.title) || press.some((p) => ON_IRAN.test(p.title)) || Object.values(added).some((n) => n > 0);
  return { ...item, date, iran, press, added, names: [...banks, ...others].slice(0, 3), measures };
}

const SMALL = /^(?:and|for|of|the|in|de|del|la)$/i;
/** "INTERNATIONAL DEVELOPMENT BANK FOR INVESTMENT AND FINANCE (Arabic: ...), Arasat Ave..." → "International Development Bank for Investment and Finance". */
export function nameOf(entry: string): string {
  const raw = entry.split(/\s\(|,\s/)[0].trim();
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i && SMALL.test(w) ? w : w.replace(/^[a-z]/, (c) => c.toUpperCase())))
    .join(" ")
    .replace(/\b(Co|Ltd|Llc|Fze|Fzco|Dmcc|S\.a)\b/g, (w) => w.toUpperCase());
}

export const addedTotal = (a: OfacAdded) => a.people + a.firms + a.vessels + a.aircraft;

/** "16 people, 10 firms" in plain words, the order OFAC lists them. */
export function addedWords(a: OfacAdded): string {
  const part = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : "");
  return [part(a.people, "person", "people"), part(a.firms, "firm", "firms"), part(a.vessels, "ship", "ships"), part(a.aircraft, "aircraft", "aircraft")].filter(Boolean).join(", ");
}

/**
 * An action's own title with no press release yet: only its Iran parts, in plain words (21 Oct: "Iran-related
 * Designations; Belarus and North Korea Designations Removals; Issuance of ... General Licenses" for one action).
 */
export function iranTitle(title: string): string {
  const parts = title.split(/;\s*/).filter((p) => ON_IRAN.test(p));
  const plain = parts.map((p) => /Designations?$/i.test(p) && !/Removal/i.test(p) ? "New sanctions on Iran-linked people, firms or ships" : /General License/i.test(p) ? "Licences to wind down dealings with those sanctioned" : pressWhy(p));
  return [...new Set(plain)].join("; ") || pressWhy(title);
}

/** A press release's title in the desk's plain, neutral words. */
export function pressWhy(title: string): string {
  return title
    .replace(/^Operation Economic (?:Outcast|Fury)\s*(?::|–|-)?\s*/i, "")
    .replace(/^(?:Targets|Neutralizes|Disrupts|Dismantles|Designates|Sanctions)\s+/i, "")
    .replace(/Iranian Regime[’']s/gi, "Iran's")
    .replace(/\bIranian Regime\b/gi, "Iran's government")
    .replace(/\bRegime[’']s\b/gi, "government's")
    .replace(/’/g, "'")
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

type Fetcher = (url: string) => Promise<string | null>;
type Asker = (lead: string) => Promise<string | null>;

/** A Treasury press release's opening: the paragraphs from "WASHINGTON", officials' quotes left out, about 1,200 characters. */
export function pressLead(html: string): string {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "");
  // The paragraph that opens with it (the page's description repeats the start in its head).
  const at = body.search(/<p[^>]*>(?:\s|<[^>]+>)*WASHINGTON(?:\s|<[^>]+>)*(?:—|–|-|&mdash;)/i);
  if (at < 0) return "";
  const paras = body.slice(at).split(/<\/p>/i).map(text).filter((p) => p.length > 40 && !/^[“"]/.test(p));
  // The release's own line under its title ("Law Firms, Shipping Agents, and Vessels Helped Conceal ..."), first.
  const sub = /<em>([^<]{20,200})<\/em>\s*<\/p>\s*$/i.exec(body.slice(Math.max(0, at - 600), at))?.[1];
  let out = sub ? text(sub) : "";
  for (const p of paras.slice(0, 5)) {
    if (/^(?:OPERATION|BACKGROUND|SANCTIONS IMPLICATIONS)\b/.test(p)) break;
    if (out.length + p.length > 1400) break;
    out += (out ? "\n\n" : "") + p;
  }
  return out.replace(/^WASHINGTON\s*(?:—|–|-)\s*/, "");
}

const WHY_SYSTEM = `You explain one US Treasury sanctions action on Iran to a general reader. You get the opening of the Treasury's own press release. Return JSON only: {"why": "..."}.
- One short plain line, at most 20 words: who was sanctioned (the kind and the country, e.g. "a Panama- and Greece-based law firm and UAE and Singapore shipping agents") and what, by the Treasury's account, they did for Iran.
- Only facts in the text. No names of officials, no quotes, no slogans or operation names.
- No sanctions jargon: never "designations", "designated", "E.O.", "SDN", "general license", "OFAC", "pursuant to".
- Neutral words: "Iran's government" for "the Iranian regime"; "helped" for "supported"; keep "shadow fleet", "oil", "weapons" as written.`;

/** The plain "why" from the press release's opening, or null. */
export async function askWhy(lead: string): Promise<string | null> {
  const got = await askChain("ofac-why", WHY_SYSTEM, lead, {
    models: NUMBERS_MODELS,
    timeoutMs: 45_000,
    accept: (j) => (typeof j.why === "string" && j.why.trim().length > 15 && j.why.length <= 200 ? null : "no usable why"),
  });
  const w = got && typeof got.json.why === "string" ? cleanWhy(got.json.why) : "";
  return w || null;
}
export const cleanWhy = (w: string) => w.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "").replace(/\.$/, "").replace(/^[a-z]/, (c) => c.toUpperCase());

const UA = "Mozilla/5.0 (compatible; TheDesk/2.0; +https://thesituationroom.live)";
async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(20_000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Is the list's row worth opening? Iran by name, or designations that may be Hezbollah's (Counter Terrorism). */
export function worthOpening(item: OfacListItem): boolean {
  return ON_IRAN.test(item.title) || /Counter Terrorism|Designations?\b/i.test(item.title) && !/Removal|Removals$/i.test(item.title);
}

/**
 * Read OFAC's list and open the actions not yet read. A failed read keeps what
 * was stored; OFAC is read once an hour at most. Returns what is stored.
 */
export async function refreshOfac(store: DeskStore, now = new Date(), fetchHtml: Fetcher = get, ask: Asker = askWhy): Promise<OfacStore | null> {
  const saved = (await store.getJson<OfacStore>(OFAC_KEY)) ?? null;
  if (saved && now.getTime() - Date.parse(saved.checkedAt) < OFAC_EVERY_MS) return saved;
  const since = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  // Ten actions a page: the pages are followed back to `since` (a busy week fills one).
  const list: OfacListItem[] = [];
  for (let page = 0; page < LIST_PAGES; page++) {
    const listHtml = await fetchHtml(page ? `${OFAC_LIST}?page=${page}` : OFAC_LIST);
    if (!listHtml) {
      if (!page) return saved;
      break;
    }
    const rows = parseRecentActions(listHtml);
    list.push(...rows.filter((r) => !list.some((x) => x.id === r.id)));
    if (!rows.length || rows.at(-1)!.date < since || (saved && rows.every((r) => saved.actions.some((a) => a.id === r.id)))) break;
  }
  if (!list.length) {
    console.error("[ofac] the Recent Actions list had no rows; its page may have changed");
    return saved;
  }
  const known = new Map((saved?.actions ?? []).map((a) => [a.id, a]));
  const actions: OfacAction[] = [];
  let opened = 0;
  for (const item of list.filter((x) => x.date >= since)) {
    const had = known.get(item.id);
    // OFAC links the press release some hours after the action (21 Oct): a recent Iran action read without one is read again.
    const recent = now.getTime() - Date.parse(`${item.date}T00:00:00Z`) < 5 * 86_400_000;
    if (had && had.iran && !had.press.length && recent && opened < OPEN_MAX) {
      opened++;
      const html = await fetchHtml(item.url);
      actions.push(html ? { ...parseAction(item, html), why: had.why, whyTries: had.whyTries } : had);
      continue;
    }
    if (had) {
      actions.push(had);
      continue;
    }
    if (!worthOpening(item)) {
      actions.push({ ...item, iran: false, press: [], added: { people: 0, firms: 0, vessels: 0, aircraft: 0 }, names: [], measures: [] });
      continue;
    }
    if (opened >= OPEN_MAX) continue;
    opened++;
    const html = await fetchHtml(item.url);
    if (html) actions.push(parseAction(item, html));
  }
  // The why in plain words, from the press release only: a few a run, twelve tries each (an hour apart: the free models run out of a night).
  let wrote = 0;
  for (const a of actions) {
    if (wrote >= 3 || !a.iran || a.why || (a.whyTries ?? 0) >= 12 || addedTotal(a.added) === 0) continue;
    const p = a.press.find((x) => ON_IRAN.test(x.title));
    if (!p) continue;
    wrote++;
    if (!a.lead) {
      const html = await fetchHtml(p.url);
      a.lead = html ? pressLead(html) : "";
    }
    if (!a.lead) { a.whyTries = (a.whyTries ?? 0) + 1; continue; }
    const w = await ask(a.lead).catch(() => null);
    if (w) a.why = w;
    else a.whyTries = (a.whyTries ?? 0) + 1;
  }
  const out: OfacStore = { checkedAt: now.toISOString(), actions };
  await store.putJson(OFAC_KEY, out);
  const fresh = actions.filter((a) => a.iran && !known.has(a.id));
  if (fresh.length) console.log(`[ofac] ${fresh.map((a) => `${a.date} ${addedWords(a.added) || "no listings"}`).join("; ")}`);
  return out;
}

/* ---------- the numbers boxes ---------- */

type Cell = { v: string; k: "off" | "unoff"; src: string; url: string; date: string; note?: string };
type ListBox = { type: string; title: string; rows: unknown[][]; stats?: [Cell, string][]; [k: string]: unknown };
type NumbersFile = { asOf: string; sets: { key: string; boxes: ListBox[] }[] };

export const US_BOX = "US sanctions on Iran and Hezbollah";
export const OUTCAST_BOX = "Economic Outcast";
const OUTCAST_FROM = "2026-08-24";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (d: string) => `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}`;
const newest = (rows: unknown[][]) => rows.map((r) => String((r[0] as Cell | undefined)?.date || "")).sort().at(-1) || "";
const plusCount = (v: string, n: number) => (+String(v).replace(/,/g, "") + n).toLocaleString("en-US");

/**
 * The researched sanctions boxes with OFAC's later actions on top: a row per
 * action that listed Iran- or Hezbollah-linked people, firms or ships, its
 * count added to the running totals; other Iran measures (an alert, a
 * determination) go to the Economic Outcast box. Actions on or before the
 * box's own newest row are the research's and are never added twice.
 */
export function liveSanctionBoxes(file: NumbersFile, live: OfacStore | null): { boxes: ListBox[]; through: string } | null {
  const set = file.sets.find((s) => s.key === "sanc");
  const us = set?.boxes.find((b) => b.title === US_BOX);
  if (!set || !us || !live?.actions?.length) return null;
  const outcast = set.boxes.find((b) => b.title === OUTCAST_BOX);
  const usFrom = newest(us.rows);
  const later = live.actions.filter((a) => a.iran && a.date > usFrom).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const listed = later.filter((a) => addedTotal(a.added) > 0);
  const nextUs: ListBox = structuredClone(us);
  const rowOf = (a: OfacAction) => {
    const p = a.press.find((x) => ON_IRAN.test(x.title)) || a.press[0];
    const who = [addedWords(a.added), a.names.length ? `among them ${a.names.join(", ")}` : ""].filter(Boolean).join(": ");
    const why = a.why || a.press.filter((x) => ON_IRAN.test(x.title)).map((x) => pressWhy(x.title)).join("; ") || iranTitle(a.title);
    return [{ v: dm(a.date), k: "off", src: "US Treasury (OFAC)", url: p?.url || a.url, date: a.date } satisfies Cell, who, why];
  };
  nextUs.rows = [...listed.map(rowOf), ...us.rows];
  const sum = (from: string) => listed.filter((a) => a.date >= from).reduce((n, a) => n + addedTotal(a.added), 0);
  const through = listed[0]?.date || "";
  if (through && nextUs.stats) {
    nextUs.stats = nextUs.stats.map(([c, label]) => {
      if (label === "Since 28 Feb") return [{ ...c, v: plusCount(c.v, sum("2026-02-28")), date: through }, label];
      if (label === "Economic Outcast") return [{ ...c, v: plusCount(c.v, sum(OUTCAST_FROM)), date: through, note: `${dm(OUTCAST_FROM)} – ${dm(through)}` }, label];
      return [c, label];
    });
  }
  const boxes = [nextUs];
  if (outcast) {
    const outFrom = newest(outcast.rows);
    const more = later.filter((a) => a.date > outFrom && a.measures.some((m) => /Alert|Determination|Advisory/i.test(m)));
    const next: ListBox = structuredClone(outcast);
    next.rows = [
      ...more.map((a) => [{ v: dm(a.date), k: "off", src: "US Treasury (OFAC)", url: a.url, date: a.date } satisfies Cell, a.measures.filter((m) => /Alert|Determination|Advisory/i.test(m)).join("; ")]),
      ...outcast.rows,
    ];
    boxes.push(next);
  }
  return { boxes, through: [through, ...later.map((a) => a.date)].filter(Boolean).sort().at(-1) || "" };
}
