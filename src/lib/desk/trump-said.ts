/**
 * Trump's words wherever they turn up (user, 16 Oct). Server-only.
 *
 * The Trump column read only Truth Social and Rapid Response 47, so his
 * Newsmax interview and his Arizona and Montana rallies of 14-15 Oct reached
 * the desk only as relays (Iran International, Asharq, VOA Farsi, Arab News…),
 * written as feed cards. A card of his words now goes to the column instead,
 * and his words are taken from Clash Report or an American source the desk
 * reads (user, 16 Oct: "take stuff from clash report and any other american
 * source we have"), never from the relay.
 *
 * The old search matched a relay to any Truth Social post sharing two to four
 * everyday words ("leaders", "ask", "please"): the Montana rally became his
 * Alaska endorsement. Here a post or article must carry the story's telling
 * words, be about Iran when the story is, and name Trump.
 */

import { searchKeys } from "./origin.ts";
import { shared } from "./originals.ts";
import { aboutIran, desksOf, onTopic, type TrumpStatement } from "./trump.ts";
import type { Read } from "./recent-reads.ts";
import type { GnewsItem } from "./gnews.ts";

/** A card that is Trump's own words: "Trump: …", "Trump says …", not a report about him. */
const SAID = /^Trump(?::|\s+(?:says?|said|tells?|told|claims?|warns?|describes?|calls?|vows?|threatens?|insists?|rules out|repeats?|asks?|urges?|accuses?|boasts?|predicts?|stresses?|signals?|suggests?|reiterates?|denies|confirms?|announces?)\b)/i;
export function trumpSaid(r: { summary?: string; headline?: string }): boolean {
  return SAID.test(String(r.summary || r.headline || "").trim());
}

/** Where his own words are published: his accounts, Clash Report, and American outlets in English. */
const OWN = /^(?:Truth Social(?: \(Trump\))?|Rapid Response 47|POTUS|White House|Clash Report)$/i;
const US_HOSTS = /(?:^|\.)(?:whitehouse\.gov|state\.gov|defense\.gov|trumpstruth\.org|truthsocial\.com|rollcall\.com|apnews\.com|reuters\.com|nytimes\.com|wsj\.com|washingtonpost\.com|cnn\.com|nbcnews\.com|cbsnews\.com|abcnews\.go\.com|foxnews\.com|foxbusiness\.com|newsmax\.com|axios\.com|politico\.com|bloomberg\.com|nypost\.com|cnbc\.com|thehill\.com|usatoday\.com|npr\.org|pbs\.org|time\.com|nationalreview\.com|washingtonexaminer\.com|dailycaller\.com|breitbart\.com|justthenews\.com|mediaite\.com|c-span\.org)$/i;
/** The US government's foreign-language services are relays of him, not his words. */
const US_RELAY = /^(?:VOA Farsi|Radio Farda|Alhurra)$/i;
const X_US = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/(?:clashreport|RapidResponse47|POTUS|WhiteHouse|newsmax|CNN|FoxNews|CBSNews|ABC|NBCNews|nypost|politico|axios|WSJ|nytimes|washingtonpost|business|TreyYingst|JenGriffinFNC|NatashaBertrand|BarakRavid|PressSec)\//i;

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

/** Is this item a source of his words: his own, Clash Report, or an American outlet in English? */
export function trumpSource(r: Pick<Read, "source" | "url" | "text">, usLean: (name: string) => boolean = () => false): boolean {
  if (US_RELAY.test(r.source)) return false;
  const own = OWN.test(r.source) || X_US.test(r.url) || US_HOSTS.test(hostOf(r.url)) || usLean(r.source);
  if (!own) return false;
  // English: an American outlet's Persian or Arabic channel retells him.
  const letters = r.text.replace(/[^\p{L}]/gu, "");
  return !letters.length || (letters.match(/[A-Za-z]/g)?.length ?? 0) / letters.length > 0.8;
}

/** Words every one of his statements shares, or every war story does: they tell nothing of which one it is. */
const GENERIC = new Set(
  "trump president donald said says say told tells now ask asks asked please one left made make makes hard know use must work does very going want wants also would will could just like think told really good great people country countries world time year years today yesterday week back way thing things lot get got come coming take see look need well much many even still never ever again first last new old big long".split(" "),
);

/** What he says of the war in every speech and interview: no help in telling which one a line is from. */
const HIS_WAR_WORDS = new Set(
  "iran iranian iranians islamic republic regime tehran nuclear weapon weapons bomb bombs military army navy leaders leader gone destroyed decimated war deal negotiate negotiating negotiation negotiations talks conflict end oil gas gasoline diesel prices price hormuz strait blockade israel america american us united states never killed kill attack attacked strike strikes".split(" "),
);

/** The story's telling words: its search words less his and the war's everyday ones. */
export function tellingKeys(copy: string): string[] {
  return searchKeys(copy, { name: "Donald Trump" }).filter((k) => !GENERIC.has(k.toLowerCase().replace(/'s$/, "")));
}

/** Does this text carry the story: enough of its telling words, Trump named, about Iran when the story is? */
export function carriesStory(text: string, keys: string[], story: string, own = false): boolean {
  if (!own && !/\bTrump\b|@POTUS|\bPOTUS\b/i.test(text)) return false;
  if (aboutIran(story) && !aboutIran(text)) return false;
  const need = keys.length >= 6 ? 3 : 2;
  return shared(text, keys) >= need;
}

export type Appearance = { kind: "interview" | "rally" | "remarks" | "truth" | "clip" | "unknown"; label: string };

const OUTLETS: [RegExp, string][] = [
  [/\bNewsmax\b|\bFinnerty\b/i, "Newsmax"],
  [/\bFox News\b|\bFox & Friends\b|\bHannity\b|\bIngraham\b|\bBret Baier\b|\bFox Business\b/i, "Fox News"],
  [/\bCNN\b/i, "CNN"],
  [/\bNBC\b|\bMeet the Press\b|\bKECI\b/i, "NBC"],
  [/\bCBS\b|\b60 Minutes\b|\bFace the Nation\b/i, "CBS"],
  [/\bABC\b|\bThis Week\b/i, "ABC"],
  [/\bTIME\b(?= magazine| interview)|\bTime magazine\b/, "TIME"],
  [/\bAxios\b/i, "Axios"],
  [/\bPolitico\b/i, "Politico"],
  [/\bNew York Post\b|\bNY Post\b/i, "the New York Post"],
  [/\bWall Street Journal\b|\bWSJ\b/i, "the Wall Street Journal"],
];

/**
 * Where he said it, from the texts that carry it: an interview with a
 * network, a rally in a town, remarks to reporters, a Truth Social post.
 */
const STATES = "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming";
const STATE = new RegExp(`\\b(${STATES})\\b`);
/** Rally towns the coverage names without their state. */
const TOWNS: Record<string, string> = { Kalispell: "Montana", Missoula: "Montana", Billings: "Montana", "Bullhead City": "Arizona", Phoenix: "Arizona", Tucson: "Arizona", Mesa: "Arizona" };

export function appearanceOf(texts: string[]): Appearance {
  const all = texts.join("\n");
  if (/\brall(?:y|ies)\b|\bcampaign stop\b|\btold the crowd\b/i.test(all)) {
    // A rally is named by its state, as the coverage names it: "Arizona rally", "a rally in Bullhead City, Arizona".
    const near = /[^.\n]{0,80}\brall(?:y|ies)\b[^.\n]{0,80}/i.exec(all)?.[0] ?? all;
    const town = Object.keys(TOWNS).find((t) => near.includes(t)) ?? Object.keys(TOWNS).find((t) => all.includes(t));
    const state = STATE.exec(near)?.[1] ?? (town ? TOWNS[town] : STATE.exec(all)?.[1]);
    return { kind: "rally", label: state ? `Rally in ${state}` : "Rally" };
  }
  const interview = /\binterview|\btold\b|\btells\b|\bsat down|\bspeaking (?:to|with)\b|\bsaid on\b|\bTrump to (?:Newsmax|Fox|CNN|NBC|CBS|ABC|TIME|Axios|Politico)\b|\bon (?:Newsmax|Fox|CNN|NBC|CBS|ABC)\b/i.test(all);
  for (const [re, name] of OUTLETS) if (re.test(all) && interview) return { kind: "interview", label: `Interview with ${name}` };
  if (/\bgaggle\b|\bAir Force One\b|\btold reporters\b|\bOval Office\b|\bMarine One\b|\bpress conference\b/i.test(all)) return { kind: "remarks", label: "Remarks to reporters" };
  if (/\bTruth Social\b/i.test(all)) return { kind: "truth", label: "Truth Social" };
  return { kind: "unknown", label: "" };
}

/** One entry per appearance a day, in Israel's day. */
export function appearanceId(a: Appearance, at: number): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(at));
  return `ap-${day}-${(a.label || "words").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/** Already in the column: a statement of the last two days carrying the story. */
export function inColumn(statements: TrumpStatement[], keys: string[], story: string, at: number): TrumpStatement | null {
  // The nearest in time: he says the same lines at every rally (17 Oct: "gone too far with the leaders" in Montana and in Georgia).
  const gap = (s: TrumpStatement) => Math.abs(Date.parse(s.at) - at);
  return (
    statements
      .filter((s) => gap(s) <= 48 * 3600_000 && carriesStory(`${s.headline ?? ""}\n${s.body ?? ""}\n${s.text}`, keys, story, true))
      .sort((a, b) => gap(a) - gap(b))[0] ?? null
  );
}

export type Found = { url: string; source: string; title: string; text: string; at: number };

export type SearchDeps = {
  /** What the site read in the last two days (recent-reads.ts). */
  reads: () => Read[];
  /** His Truth Social posts (trumpstruth.org's feed). */
  truth: () => Promise<{ url: string; at: number; text: string }[]>;
  search: (q: string) => Promise<GnewsItem[]>;
  resolve: (link: string) => Promise<string>;
  /** A page's text, "" when it does not open. */
  page?: (url: string) => Promise<string>;
  usLean?: (name: string) => boolean;
  /** His appearances Factbase listed, with their transcripts' parts on the two wars (17 Oct). */
  factbase?: () => FactbaseEntry[];
};

/** Roll Call's Factbase: the full transcript of every rally, gaggle and interview of his. */
const FACTBASE = /^(?:Speech|Press Gaggle|Remarks|Interview|Press Conference|Roundtable|Phone Interview|Event):\s*Donald Trump\b/i;

/**
 * A Factbase transcript's address from its title, so no Google link has to be
 * resolved (Google rests the resolver after a few dozen): "Speech: Donald Trump
 * Holds a Midterm Political Rally in Kalispell, Montana - October 14, 2026" is
 * /factbase/trump/transcript/donald-trump-speech-midterm-political-rally-kalispell-montana-october-14-2026/.
 */
export function factbaseGuesses(title: string): string[] {
  const m = /^([^:]+):\s*Donald Trump\s+(.+)$/i.exec(title.trim());
  if (!m) return [];
  const slug = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const kind = slug(m[1]);
  const rest = m[2];
  const out = new Set<string>();
  const tight = rest.replace(/\b(?:holds?|a|an|the|in|at|to|before|after|with|on|for|speaks?)\b/gi, " ");
  const loose = rest.replace(/\bholds? an?\b/gi, " ").replace(/\bin\b/gi, " ");
  for (const r of [tight, loose]) out.add(`https://rollcall.com/factbase/trump/transcript/donald-trump-${kind}-${slug(r)}/`);
  return [...out];
}

/**
 * Trump's own words in a Factbase page: each segment opens with its speaker
 * and its time ("Donald Trump 00:30:45-00:31:06 (21 sec) Weak (1.151) -->")
 * and ends with the page's readability scores. The host's questions, the
 * crowd and the scores are left out.
 */
export function factbaseWords(page: string, questions = false): string {
  const t = page.replace(/\s+/g, " ");
  const seg = /([A-Z][\w.'’ -]{1,40}?) \d\d:\d\d:\d\d-\d\d:\d\d:\d\d \(\d+ sec\)[^>]{0,60}?-->\s*/g;
  const marks = [...t.matchAll(seg)];
  if (!marks.length) return "";
  const out: string[] = [];
  marks.forEach((m, i) => {
    const his = /\bDonald Trump$/.test(m[1].trim());
    // A reporter's question, kept with "with questions": "I think they will, sure" means nothing without it (16 Oct gaggle).
    if (!his && !(questions && /\b(?:Question|Reporter)$/.test(m[1].trim()))) return;
    const end = i + 1 < marks.length ? marks[i + 1].index : t.length;
    const words = t.slice(m.index + m[0].length, end).replace(/\s*Sentiment (?:Readability|Topics)[\s\S]*$/, "").replace(/\s*\bSentiment\s*$/, "").trim();
    if (!words) return;
    // His words run on after his own; a question starts a line, and his answer to it the next.
    const prev = out[out.length - 1];
    if (his && prev !== undefined && !prev.startsWith("Question: ")) out[out.length - 1] = `${prev} ${words}`;
    else out.push(his ? words : `Question: ${words}`);
  });
  return out.join(questions ? "\n" : " ");
}

/** One of his appearances in Factbase's list (rollcall.com/wp-json/factbase/v1/search). */
export type FactbaseRecord = { slug: string; url: string; title: string; type: string; date: string; state?: string };

/** His own appearances in Factbase's list, newest first: not Vance's, not a briefing by his press secretary, not one with no transcript. */
export function parseFactbaseList(json: unknown): FactbaseRecord[] {
  const data = (json as { data?: Record<string, unknown>[] })?.data;
  if (!Array.isArray(data)) return [];
  const out: FactbaseRecord[] = [];
  for (const d of data) {
    const title = String(d.record_title ?? "");
    const url = String(d.factbase_url ?? "");
    if (!/\bDonald Trump\b/.test(title) || /No Transcript|\bVlog\b/i.test(title) || !/^https:\/\/rollcall\.com\/factbase\//.test(url)) continue;
    const loc = d.location as { state?: string } | undefined;
    out.push({ slug: String(d.slug ?? ""), url, title, type: String(d.record_type ?? ""), date: String(d.date ?? ""), ...(loc?.state ? { state: loc.state } : {}) });
  }
  return out;
}

/** The column's name for an appearance: "Rally in Georgia", "Interview with Newsmax", "Remarks to reporters", else its own title. */
export function factbaseLabel(r: FactbaseRecord): Appearance {
  const rest = r.title.replace(/^[^:]+:\s*/, "").replace(/\s+-\s+\w+ \d{1,2}, \d{4}$/, "");
  if (/tele-?rally/i.test(rest)) return { kind: "rally", label: "Tele-rally" };
  if (/\brally\b/i.test(rest)) {
    const state = STATE.exec(rest)?.[1] ?? r.state;
    return { kind: "rally", label: state ? `Rally in ${state}` : "Rally" };
  }
  if (/^(?:Press Gaggle|Press Conference)$/i.test(r.type) || /\breporters\b/i.test(rest)) return { kind: "remarks", label: "Remarks to reporters" };
  const a = appearanceOf([r.title]);
  if (a.kind === "interview") return a;
  return { kind: "remarks", label: rest.replace(/^Donald Trump\s+/, "").replace(/^\w/, (c) => c.toUpperCase()) };
}

/**
 * When an appearance happened, as near as the list allows: it gives the day
 * only (US time), so the time the desk first saw it, kept inside that day and
 * the night after it.
 */
export function factbaseTime(r: FactbaseRecord, firstSeen: number): number {
  const day = Date.parse(`${r.date}T00:00:00-04:00`);
  if (!Number.isFinite(day)) return firstSeen;
  return Math.min(Math.max(firstSeen, day + 9 * 3600_000), day + 26 * 3600_000);
}

/**
 * His words on Iran and the war in a long transcript: those sentences and the
 * four around each, in order. A rally's point runs over several sentences that
 * say "they" ("…their main thing that they ask in negotiation is, 'Will you
 * please allow us to live?'"), with "Iran" a few sentences off.
 */
export function iranParts(text: string, max = 9000): string {
  const sents = text.replace(/\s+/g, " ").split(/(?<=[.!?]["”]?)\s+(?=[A-Z"“])/);
  const keep = new Set<number>();
  sents.forEach((s, i) => {
    if (onTopic(s)) for (let j = i - 4; j <= i + 4; j++) if (j >= 0 && j < sents.length) keep.add(j);
  });
  let out = "";
  let last = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    out += (i === last + 1 ? " " : "\n\n") + sents[i];
    last = i;
    if (out.length > max) break;
  }
  return out.trim().slice(0, max);
}

/** The American outlets searched by name on Google News, a query at a time. */
const US_SITES = ["newsmax.com", "foxnews.com", "cnn.com", "nbcnews.com", "cbsnews.com", "abcnews.go.com", "apnews.com", "reuters.com", "nypost.com", "politico.com", "axios.com", "thehill.com", "washingtonpost.com", "nytimes.com", "rollcall.com", "whitehouse.gov"];

/**
 * His words of this story, where they were first published among the
 * sources of his words: what the site already read (Clash Report, the US
 * outlets' posts, Rapid Response 47), his Truth Social posts, then the
 * American outlets on Google News. The earliest that carry the story, and
 * every other that does, so the entry is written from all he said there.
 */
export async function findTrumpWords(card: { summary: string; text?: string; at: string; url: string }, deps: SearchDeps): Promise<{ found: Found[]; keys: string[] }> {
  const story = `${card.summary}\n${card.text ?? ""}`;
  const keys = tellingKeys(story);
  const at = Date.parse(card.at);
  const near = (t: number) => t >= at - 48 * 3600_000 && t <= at + 3 * 3600_000;
  const found: Found[] = [];
  const add = (f: Found) => {
    if (f.url !== card.url && !found.some((x) => x.url === f.url)) found.push(f);
  };

  for (const r of deps.reads()) {
    if (near(r.at) && trumpSource(r, deps.usLean) && carriesStory(r.text, keys, story, OWN.test(r.source))) add({ url: r.url, source: r.source, title: r.text.slice(0, 140), text: r.text, at: r.at });
  }
  for (const p of await deps.truth().catch(() => [])) {
    // He posts what he says at rallies: a post is the original only by the story's unusual words.
    if (near(p.at) && carriesStory(p.text, keys, story, true) && shared(p.text, keys.filter((k) => !HIS_WAR_WORDS.has(k.toLowerCase().replace(/'s$/, "")))) >= 2) add({ url: p.url, source: "Truth Social", title: p.text.slice(0, 140), text: p.text, at: p.at });
  }
  if (!found.length && keys.length) {
    const words = keys.slice(0, 3).join(" ");
    // A headline that names where he said it ("Trump to Newsmax: …", "… at Montana rally") is taken from any
    // American site that carries it: Yahoo runs Newsmax's own story under Newsmax's headline.
    const venueNamed = (title: string) => ["interview", "rally"].includes(appearanceOf([title]).kind);
    for (const q of [`Trump ${words} (${US_SITES.slice(0, 8).map((s) => `site:${s}`).join(" OR ")}) when:2d`, `Trump ${words} (${US_SITES.slice(8).map((s) => `site:${s}`).join(" OR ")}) when:2d`, `Trump ${words} when:2d`]) {
      const items = (await deps.search(q).catch(() => [])).filter((i) => near(i.at) && carriesStory(i.title, keys, story) && (US_HOSTS.test(hostOf(i.site.startsWith("http") ? i.site : `https://${i.site}`)) || (/^(?:Yahoo|MSN)/i.test(i.outlet) && venueNamed(i.title))));
      // Google's links are resolved only for the one the entry is written from: each costs a request Google counts.
      for (const i of items.sort((a, b) => a.at - b.at).slice(0, 3)) add({ url: i.link, source: i.outlet, title: i.title, text: i.title, at: i.at });
      if (found.length) break;
    }
  }
  return { found: found.sort((a, b) => a.at - b.at), keys };
}

/** Where he spoke on a day, as the American sources tell it: each with what they reported of it, and its transcript's Iran parts when Factbase has it. */
export type DayAppearance = Appearance & { items: Found[]; transcript?: { url: string; text: string } };

/** A Factbase appearance as the desk keeps it: its label, time, page and the parts of his words on Iran and Yemen ("" when none). */
export type FactbaseEntry = Appearance & { slug: string; title: string; url: string; at: number; text: string };

/**
 * His appearances around a time, from American sources only: Roll Call's
 * Factbase transcripts (every rally, gaggle and interview), headlines naming
 * an interview or a rally, and the posts of Clash Report and the US outlets
 * the site read. A researcher asks first where he spoke today (user, 8 Oct).
 */
export async function appearancesNear(at: number, deps: SearchDeps, backMs = 30 * 3600_000): Promise<DayAppearance[]> {
  const near = (t: number) => t >= at - backMs && t <= at + 3 * 3600_000;
  const items: Found[] = [];
  for (const r of deps.reads()) {
    if (near(r.at) && trumpSource(r, deps.usLean) && /\bTrump\b|POTUS/.test(r.text) && onTopic(r.text)) items.push({ url: r.url, source: r.source, title: r.text.slice(0, 200), text: r.text, at: r.at });
  }
  const sites = US_SITES.map((s) => `site:${s}`).join(" OR ");
  for (const q of [
    `site:rollcall.com "Donald Trump" when:2d`,
    `site:rollcall.com factbase Trump when:2d`,
    `"Trump to" (Newsmax OR Fox OR CNN OR NBC OR CBS OR ABC) when:2d`,
    `Trump interview Iran (Newsmax OR "Fox News" OR CNN OR NBC OR CBS OR ABC) when:2d`,
    `Trump (interview OR "told" OR "tells") Iran (${sites}) when:2d`,
    `Trump rally Iran (${sites}) when:2d`,
    `Trump reporters Iran ("Air Force One" OR gaggle OR "Oval Office") (${sites}) when:2d`,
  ]) {
    for (const i of await deps.search(q).catch(() => [])) {
      const host = hostOf(i.site.startsWith("http") ? i.site : `https://${i.site}`);
      if (!near(i.at) || !US_HOSTS.test(host) || !/\bTrump\b/.test(i.title)) continue;
      if (!items.some((x) => x.title === i.title)) items.push({ url: i.link, source: i.outlet, title: i.title, text: i.title, at: i.at });
    }
  }
  const byLabel = new Map<string, DayAppearance>();
  // Factbase first: where he spoke, with the transcript, no search needed (17 Oct: the Georgia rally and the gaggle were missed).
  for (const f of deps.factbase?.() ?? []) {
    if (!near(f.at)) continue;
    const key = byLabel.has(f.label) ? `${f.label} (${f.at})` : f.label;
    byLabel.set(key, { kind: f.kind, label: f.label, items: [{ url: f.url, source: "Roll Call Factbase", title: f.title, text: f.text, at: f.at }], ...(f.text ? { transcript: { url: f.url, text: f.text } } : {}) });
  }
  // Coverage of him speaking there, not a story about the place ("protester attacked at Ohio rally") or a plan ("will rally Georgia").
  const spoke = /\bTrump(?:'s)?\s+(?:\S+\s+){0,2}?(?:says?|said|tells?|told|touts?|torches?|delivers?|remarks|speech|speaks?|boasts?|warns?|pardons?|invites?|announces?|claims?|vows?|slams?|blasts?|rails?|calls?|jokes?|mocks?|predicts?|praises?|attacks?|threatens?)\b|\bTrump (?:to|on)\b|\bTrump:/i;
  for (const it of items) {
    const a = appearanceOf([it.text]);
    if (a.kind === "unknown" || a.kind === "truth" || a.label === "Rally") continue;
    if (!FACTBASE.test(it.title) && !spoke.test(it.title)) continue;
    const had = byLabel.get(a.label) ?? { ...a, items: [] };
    had.items.push(it);
    byLabel.set(a.label, had);
  }
  // An interview's other stories, by its name: each outlet runs several from one sit-down.
  for (const a of byLabel.values()) {
    const outlet = /^Interview with (.+)$/.exec(a.label)?.[1]?.replace(/^the /, "");
    if (!outlet) continue;
    for (const i of await deps.search(`"Trump to ${outlet}" OR "${outlet} interview" Trump when:2d`).catch(() => [])) {
      if (near(i.at) && /\bTrump\b/.test(i.title) && appearanceOf([i.title]).label === a.label && !a.items.some((x) => x.title === i.title)) a.items.push({ url: i.link, source: i.outlet, title: i.title, text: i.title, at: i.at });
    }
  }
  // The transcript, read once: what he said there, in full.
  for (const a of byLabel.values()) {
    const fb = a.items.find((i) => FACTBASE.test(i.title));
    if (!fb || !deps.page || a.transcript) continue;
    for (const url of [...factbaseGuesses(fb.title), fb.url]) {
      const real = url.includes("news.google.com") ? await deps.resolve(url).catch(() => "") : url;
      const raw = real ? await deps.page(real).catch(() => "") : "";
      const text = iranParts(factbaseWords(raw) || raw);
      if (text.length > 200) {
        a.transcript = { url: real, text };
        break;
      }
    }
  }
  return [...byLabel.values()];
}

/**
 * Where a card's words were said, all searches done: the day's appearance it
 * tells of; else the one its own search found a headline for ("Trump to
 * Newsmax: …"), added to the day's list; else his Truth Social post; else null.
 */
export function whereSaid(card: { summary: string; text?: string; at?: string }, apps: DayAppearance[], found: Found[]): { label: string; app?: DayAppearance; words: Found[]; byTime?: true } | null {
  // His post that carries the story's unusual words is the original (14 Oct: the Houthis post).
  const truth = found.find((f) => f.source === "Truth Social");
  if (truth) return { label: "Truth Social", words: [truth] };
  const app = matchAppearance(card, apps);
  if (app) return { label: app.label, app, words: found };
  const viaTime = () => {
    // Nothing names the place and the words are a retelling: the appearance
    // whose reports came out nearest the relay. A late rally is retold all the
    // next day; a channel posts a speech live, before the reports of it.
    // Known by two reports or a transcript. The entry is written from that
    // appearance's own sources, never from the relay.
    const at = Date.parse(card.at ?? "");
    if (!Number.isFinite(at)) return null;
    const best = apps
      .filter((a) => a.kind !== "truth" && a.kind !== "unknown" && (a.items.length >= 2 || a.transcript) && inTime(a, at))
      .sort((a, b) => Math.abs(started(a) - at) - Math.abs(started(b) - at))[0];
    return best ? { label: best.label, app: best, words: found, byTime: true as const } : null;
  };
  for (const f of found) {
    const a = appearanceOf([f.title]);
    if (a.kind !== "interview" && a.kind !== "rally") continue;
    if (a.label === "Rally") continue;
    let day = apps.find((x) => x.label === a.label);
    if (!day) apps.push((day = { ...a, items: [] }));
    if (!day.items.some((i) => i.url === f.url)) day.items.push(f);
    return { label: a.label, app: day, words: found };
  }
  return viaTime() ?? (found.length ? { label: found[0].source, words: found } : null);
}

/** When the reports of an appearance began. */
const started = (a: DayAppearance) => Math.min(...a.items.map((i) => i.at));
/**
 * Could a report at this time tell of this appearance: its reports began at
 * most three hours after it (a speech posted live, reported once it ends)
 * and at most sixteen before it (a late rally retold the next day). Never a
 * speech made after the report (14 Oct: the morning's Houthi line was matched
 * to the evening's Arizona rally).
 */
const inTime = (a: DayAppearance, at: number) => !a.items.length || (started(a) <= at + 3 * 3600_000 && started(a) >= at - 16 * 3600_000);

/**
 * The appearance a relay tells of: the one it names ("at a rally in
 * Montana", "told Newsmax"), else the one whose coverage carries most of
 * its telling words.
 */
export function matchAppearance(card: { summary: string; text?: string; at?: string }, apps: DayAppearance[]): DayAppearance | null {
  const story = `${card.summary}\n${card.text ?? ""}`;
  const at = Date.parse(card.at ?? "");
  if (Number.isFinite(at)) apps = apps.filter((a) => inTime(a, at));
  const named = appearanceOf([story]);
  if (named.kind !== "unknown" && named.kind !== "truth") {
    const same = apps.find((a) => a.label === named.label) ?? (named.label === "Rally" ? apps.filter((a) => a.kind === "rally").sort((a, b) => b.items.length - a.items.length)[0] : undefined);
    if (same) return same;
  }
  // He says the same things in every speech: only his unusual words tell one
  // from another (16 Oct: the Arizona and Montana speeches shared "Iran",
  // "nuclear", "weapon", "leaders", "gone", "oil" with every relay of either).
  const keys = tellingKeys(story).filter((k) => !HIS_WAR_WORDS.has(k.toLowerCase().replace(/'s$/, "")));
  const said = apps
    .filter((a) => a.transcript)
    .map((a) => ({ a, n: shared(a.transcript!.text, keys) }))
    .filter((x) => x.n >= 2)
    .sort((x, y) => y.n - x.n);
  if (said[0] && (said.length === 1 || said[0].n > said[1].n)) return said[0].a;
  const scored = apps
    .map((a) => ({ a, n: Math.max(0, ...a.items.map((i) => shared(i.text, keys))), all: shared(a.items.map((i) => i.text).join(" "), keys) }))
    .filter((x) => x.n >= 2 || x.all >= 3)
    .sort((x, y) => y.all - x.all || y.n - x.n);
  return scored[0]?.a ?? null;
}

/** The reports of his words waiting for the column: the Iran scan puts them here instead of the feed. */
export const SAID_QUEUE = "trump:said-queue";
export type SaidItem = {
  fp: string;
  at: string;
  summary: string;
  text?: string;
  url: string;
  source: string;
  firstAt: number;
  tries: number;
  /** column: written into the column; already: his words were there; truth: his post, which the Truth Social reader adds; not-found: no source of his words in three hours. */
  done?: "column" | "already" | "truth" | "not-found";
  label?: string;
  byTime?: boolean;
  statementId?: string;
};
/** How long a report waits for a source of his words before it is set aside (user, 16 Oct: what then is decided once the search is seen to work). */
export const SAID_WAIT_MS = 3 * 3600_000;

/** Into the queue: new reports only, the last 300 kept. */
export function enqueueSaid(queue: SaidItem[], reports: { fp: string; at: string; summary: string; text?: string; url: string; source: string }[], now: number): SaidItem[] {
  const out = [...queue];
  for (const r of reports) if (!out.some((x) => x.fp === r.fp || x.url === r.url)) out.push({ fp: r.fp, at: r.at, summary: r.summary, text: r.text, url: r.url, source: r.source, firstAt: now, tries: 0 });
  return out.slice(-300);
}

/**
 * Another line of the same speech: a channel posts a speech a line at a time,
 * and lines of one source within thirty minutes are one appearance (14 Oct:
 * Al Jazeera Mubasher's two Arizona lines a minute apart, one of them too
 * retold to match the transcript).
 */
export function sibling(item: Pick<SaidItem, "fp" | "source" | "at">, queue: SaidItem[]): string | null {
  const at = Date.parse(item.at);
  const s = queue.find((x) => x.fp !== item.fp && x.source === item.source && x.label && x.label !== "Truth Social" && !x.byTime && Math.abs(Date.parse(x.at) - at) <= 30 * 60_000);
  return s?.label ?? null;
}

/** A settled item back into the queue as it is now: the scan may have added reports meanwhile. */
export function mergeQueue(stored: SaidItem[], settled: SaidItem[]): SaidItem[] {
  const by = new Map(settled.map((x) => [x.fp, x]));
  const out = stored.map((x) => by.get(x.fp) ?? x);
  for (const x of settled) if (!out.some((y) => y.fp === x.fp)) out.push(x);
  return out.slice(-300);
}

/**
 * Each appearance with his words on Iran or Yemen becomes an entry, whether or
 * not a report of it reached the desk; an entry written from reports of the
 * same appearance gives way to it. Returns how many are new or rewritten.
 */
export function addFactbase(statements: TrumpStatement[], entries: FactbaseEntry[]): number {
  let n = 0;
  for (const e of entries) {
    if (e.text.length < 80) continue;
    const id = `fb-${e.slug}`;
    const at = new Date(e.at).toISOString();
    const had = statements.find((s) => s.id === id);
    if (had) {
      if (had.text === e.text) continue;
      // Dated by the first report of it (trump-feed.server.ts), it keeps that time.
      Object.assign(had, { text: e.text, at: Date.parse(had.at) < e.at ? had.at : at, desks: desksOf(e.text) });
      delete had.headline, delete had.body, delete had.off, delete had.tries;
      n += 1;
      continue;
    }
    for (let i = statements.length - 1; i >= 0; i--) {
      const s = statements[i];
      if (s.id.startsWith("ap-") && s.source === e.label && Math.abs(Date.parse(s.at) - e.at) < 20 * 3600_000) statements.splice(i, 1);
    }
    statements.push({ id, at, text: e.text, url: e.url, source: e.label, desks: desksOf(e.text) });
    n += 1;
  }
  return n;
}
