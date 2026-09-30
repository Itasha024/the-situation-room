/**
 * Search the whole archive of reports, the way a reader means it.
 *
 * "uav" should bring every drone report, "saria" everything Yahya Saree said
 * or did, "saudi fm and rubio" their meetings, and nothing that merely shares
 * a word. Steps:
 *
 *   1. UNDERSTAND, without a model first. The query splits into its ideas at
 *      "and", "with" and commas; each idea takes the desk's words for it: a
 *      table of synonyms, short forms ("fm", "mbs"), and a who-is-who learned
 *      from the archive itself ("US Secretary of State Marco Rubio" ties the
 *      name to the title both ways). When every idea is known this way (or
 *      is a place the desk pins), that is the whole search: instant.
 *   2. Only for a word the desk does not know, a fast model adds the ideas'
 *      words (spellings, synonyms, what a name stands for), and dates when the
 *      query names a time.
 *   3. FIND. Every report (a few thousand short cards, held in memory) that
 *      carries every idea. A headline that names the thing itself stands.
 *   4. A SECOND LOOK only for the loose matches: a model drops those plainly
 *      about something else.
 *
 * All on the free tiers: the models are the fast ones, every answer is kept
 * for a while, and a daily cap leaves the desk's own jobs their quota.
 */

import { type ChainModel, askChain } from "./models.ts";

export type SearchDoc = {
  fp: string;
  at: string;
  source: string;
  summary: string;
  text?: string;
  place?: string;
  also?: string;
};

/** What a query asks for: ideas that must all be in a report, each as its words. */
export type Understood = {
  about: string;
  groups: string[][];
  since?: string;
  until?: string;
  model?: string;
  /** Every idea is one the desk knows (its table, a short form, a name or title, a place): no model needed. */
  known?: boolean;
};

/** Reading the query: Groq answers a short prompt in under a second. */
export const SEARCH_MODELS: ChainModel[] = [
  { provider: "groq", id: "openai/gpt-oss-120b" },
  { provider: "gemini", id: "gemini-3.1-flash-lite" },
  { provider: "gemini", id: "gemini-flash-lite-latest" },
  { provider: "groq", id: "openai/gpt-oss-20b" },
];
/** A second look at the doubtful few: Groq first, fast; Gemini when Groq is busy. */
export const KEEP_MODELS: ChainModel[] = [
  { provider: "groq", id: "openai/gpt-oss-120b" },
  { provider: "gemini", id: "gemini-3.1-flash-lite" },
  { provider: "gemini", id: "gemini-flash-lite-latest" },
];

/** Lower case, no accents or apostrophes, hyphens as spaces: "Al-Wazi'iyah" = "al waziiyah". */
export function norm(s: string): string {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘`ʿʾ]/g, "")
    .replace(/[-‐–—_/]/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * The desk's own words, for when no model answers: each line is one idea, and
 * a query word that names any of its words searches for all of them.
 */
const LOCAL: string[][] = [
  ["drone", "uav", "unmanned", "unmanned aerial vehicle", "quadcopter", "samad", "shahed", "mq 9", "reaper", "loitering"],
  ["missile", "ballistic", "cruise missile", "rocket", "hypersonic"],
  ["saree", "sarea", "saria", "sari", "yahya saree", "houthi military spokesperson", "houthi armed forces spokesperson", "houthi spokesperson"],
  ["houthi", "ansar allah", "ansarallah", "ansarullah"],
  ["air strike", "airstrike", "air raid", "warplane", "fighter jet", "bombing"],
  ["interception", "intercepted", "intercept", "shot down", "shoot down", "air defence", "air defense", "patriot"],
  ["ship", "vessel", "tanker", "shipping", "red sea", "bab al mandab", "ukmto", "navy", "naval"],
  ["casualties", "killed", "dead", "wounded", "injured", "death toll"],
  ["capture", "captured", "seized", "took control", "recaptured", "advance"],
  ["shelling", "shelled", "artillery", "mortar", "howitzer"],
  ["abdulmalik", "abdul malik al houthi", "abdul malik", "houthi leader"],
  ["alimi", "al alimi", "rashad al alimi", "yemens president", "presidential leadership council head"],
  ["stc", "southern transitional council", "southern forces", "zubaidi", "al zubaidi"],
  ["giants", "giants brigades", "amaliqa"],
  ["oil", "energy", "aramco", "oil facility", "oil facilities", "oil field", "oil terminal", "refinery", "fuel depot", "fuel tank", "gas plant", "pumping station", "pump station", "yanbu", "ras tanura", "abqaiq", "pipeline"],
  // An attack by any word for it (1 Oct: "uav attacks on saudi oil" found one card of dozens).
  ["attack", "attacks", "attacked", "hit", "hits", "struck", "strike", "strikes", "targeted", "targeting", "targets", "bombed", "shelled"],
  // The kingdom, and the places a card names instead of it.
  ["saudi", "saudi arabia", "kingdom", "riyadh", "jazan", "jizan", "najran", "abha", "khamis mushait", "asir", "taif", "jeddah", "mecca", "yanbu", "tabuk", "dammam", "eastern province", "abqaiq", "ras tanura", "aramco"],
  ["prisoner", "prisoner exchange", "prisoner swap", "detainee", "captive"],
  ["talks", "negotiation", "truce", "ceasefire", "peace talks", "mediation"],
  ["displaced", "displacement", "idp", "refugee"],
  ["iran", "iranian", "irgc", "revolutionary guard"],
];

/** Words that never make an idea on their own. */
const STOP = new Set("a an the of in on at to for and or by with from about all any what who when where which news report reports latest recent is are was were be it its this that these those did does do s".split(" "));

/** The short forms readers type, as the desk writes them. */
const ABBR: Record<string, string[]> = {
  fm: ["foreign minister"], sos: ["secretary of state"], secstate: ["secretary of state"], pm: ["prime minister"],
  mod: ["defence minister", "defense minister", "ministry of defence", "ministry of defense"], mofa: ["foreign ministry", "ministry of foreign affairs"],
  ksa: ["saudi"], saudia: ["saudi"], usa: ["us", "united states", "american", "washington"], us: ["us", "united states", "american", "washington"],
  uk: ["uk", "britain", "british"], un: ["un", "united nations"], unsc: ["security council"], uae: ["uae", "emirates", "emirati"],
  mbs: ["mohammed bin salman", "saudi crown prince"], plc: ["presidential leadership council"], gcc: ["gcc", "gulf cooperation council"],
  cia: ["cia"], idf: ["israeli army", "israeli military"], iaf: ["israeli air force"], sg: ["secretary general"],
};

/**
 * Who is who, learned from the archive itself: every "US Secretary of State
 * Marco Rubio", "Saudi Foreign Minister Faisal bin Farhan", "Houthi military
 * spokesperson Yahya Saree" ties a name to a title both ways. A card often
 * gives only one of the two, so a search for either finds both. No model: the
 * desk's own copy is the source.
 */
export type People = { byName: Map<string, Set<string>>; byTitle: Map<string, Set<string>> };
const NATION = String.raw`(?:Saudi|US|U\.S\.|American|Yemeni|Houthi|Iranian|Omani|Qatari|Emirati|UAE|British|UK|French|Russian|Chinese|Egyptian|Israeli|UN|Kuwaiti|Bahraini|Jordanian|Pakistani|Turkish|Southern|STC|Government|Coalition)`;
const TITLE = String.raw`(?:Secretary of State|Secretary[- ]General|Foreign Minister|Defen[cs]e Minister|Deputy Prime Minister|Prime Minister|Interior Minister|Information Minister|Crown Prince|Vice President|President|Ambassador|Special Envoy|Envoy|(?:military |armed forces |Armed Forces |official )?[Ss]pokes(?:person|man)|Chief of (?:the )?(?:General )?Staff|Governor|negotiator|leader)`;
const HONOR = String.raw`(?:(?:Prince|Sheikh|Dr\.?|General|Gen\.|Maj\.? Gen\.|Brig\.? Gen\.|Major General|Brigadier General|Colonel|Admiral)\s+)?`;
const NAME = String.raw`([A-Z][a-z'’]+(?:[- ](?:(?:bin|bint|ibn|al|el|abu|abd)[- ])?[A-Z][a-z'’]+){1,3})`;
const WHO_RE = new RegExp(String.raw`(?:\b(${NATION})\s+)?\b(${TITLE})\s+(${HONOR})${NAME}`, "g");
/** Capitalised words that are no name. */
const NOT_NAME = /^(?:the|saudi|houthi|houthis|yemen|yemeni|us|un|arabia|riyadh|sanaa|aden|washington|iran|israel|minister|forces|army|government|council|state|kingdom|on|in|at|says|said|meets|visits|holds|receives|calls|warns|discusses)$/i;

/** Names too many people share to stand for one of them alone. */
const GIVEN = /^(?:bin|ibn|al|abdullah|abdallah|mohammed|muhammad|mohamed|ali|ahmed|ahmad|salman|hassan|hussein|abdul|saleh|khalid|faisal|omar|ibrahim|yahya|abdulaziz|zayed|hamad|nasser|saeed|sultan|fahd|turki)$/;

export function learnPeople(texts: string[]): People {
  const byName = new Map<string, Set<string>>();
  const byTitle = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, k: string, v: string) => {
    if (!k || !v || k === v) return;
    const s = m.get(k) ?? new Set<string>();
    s.add(v);
    m.set(k, s);
  };
  for (const t of texts) {
    for (const m of String(t || "").matchAll(WHO_RE)) {
      const nation = m[1] ? norm(m[1].replace(/U\.S\./, "US")) : "";
      const title = norm(m[2]);
      // "Marco Rubio Discusses" -> "Marco Rubio"
      const tokens = m[4].split(/\s+/);
      while (tokens.length && NOT_NAME.test(tokens[tokens.length - 1])) tokens.pop();
      if (!tokens.length || NOT_NAME.test(tokens[0])) continue;
      const full = norm(tokens.join(" "));
      if (full.split(" ").length < 2 && !/prince|sheikh/i.test(m[3] || "")) continue;
      // The title with its country is what ties a name down; a bare "spokesperson" names many.
      const titles = nation ? [`${nation} ${title}`] : [];
      const names = [full];
      const last = full.split(" ").pop()!;
      if (last.length >= 4 && !GIVEN.test(last) && !NOT_NAME.test(last)) names.push(last);
      if (/prince/i.test(m[3] || "")) names.push(`prince ${full.split(" ")[0]}`);
      for (const n of names) {
        for (const o of names) add(byName, n, o);
        for (const ti of titles) add(byName, n, ti);
      }
      for (const ti of titles) add(byTitle, ti, full);
    }
  }
  return { byName, byTitle };
}

/** The words for one idea of a query: the desk's table, short forms, and who is who. */
function ideaTerms(idea: string, people?: People): string[] | null {
  const words = idea.split(" ");
  // "saudi fm" -> "saudi foreign minister"
  const long = words.map((w) => (ABBR[w] && !ABBR[w].includes(w) ? ABBR[w][0] : w)).join(" ");
  const terms = new Set<string>([idea, long]);
  for (const w of words) if (ABBR[w]) for (const x of ABBR[w]) terms.add(words.length === 1 ? x : long);
  const table = LOCAL.find((g) => g.some((t) => t === idea || t === long || (!t.includes(" ") && idea.length >= 4 && !idea.includes(" ") && close(idea, t))));
  if (table) for (const t of table) terms.add(t);
  if (people) {
    for (const k of [...terms]) {
      for (const v of people.byName.get(k) ?? []) terms.add(v);
      for (const v of people.byTitle.get(k) ?? []) {
        terms.add(v);
        // "Prince Faisal", "bin Farhan": the other ways the same person is named.
        for (const o of people.byName.get(v) ?? []) terms.add(o);
      }
    }
  }
  // A foreign minister is often only "his Saudi counterpart" in the other side's card.
  for (const t of [...terms]) {
    const m = t.match(/^(\w+) (?:foreign minister|secretary of state)$/);
    if (m) terms.add(`${m[1]} counterpart`);
  }
  return terms.size > 1 || table || words.length > 1 ? [...terms] : null;
}

/**
 * What a query asks for, without a model: its ideas split at "and", "with",
 * commas ("saudi fm and rubio" is two), each a known phrase, name or title
 * with all its words, else each of its words an idea of its own.
 */
export function understandLocally(q: string, people?: People, places?: Set<string>): Understood {
  const groups: string[][] = [];
  let known = true;
  const ideas = q.split(/\s*(?:,|&|\+|\band\b|\bwith\b|\bvs\.?(?=\s)|\bversus\b)\s*/i).map(norm);
  for (const raw of ideas) {
    const idea = raw.split(" ").filter((w) => w && !STOP.has(w)).join(" ");
    if (!idea) continue;
    const whole = idea.includes(" ") ? ideaTerms(idea, people) : null;
    // A phrase the desk knows as one thing ("saudi fm", "yahya saree") is one idea.
    if (whole && whole.some((t) => t !== idea && !idea.split(" ").includes(t))) {
      groups.push(whole);
      continue;
    }
    if (places?.has(idea)) {
      groups.push([idea]);
      continue;
    }
    for (const w of idea.split(" ")) {
      const g = ideaTerms(w, people);
      if (!g && !places?.has(w)) known = false;
      groups.push(g ?? [w]);
    }
  }
  return { about: q, groups: groups.map((g) => [...new Set(g)].slice(0, 40)), known: known && groups.length > 0 };
}

/** A model's reading and the desk's own, together: each of the model's ideas also takes the desk's words for it. */
export function mergeUnderstood(model: Understood, local: Understood): Understood {
  const groups = model.groups.map((g) => {
    const out = new Set(g);
    for (const lg of local.groups) if (lg.some((t) => out.has(t))) for (const t of lg) out.add(t);
    return [...out].slice(0, 50);
  });
  return { ...model, groups };
}

/** Terms a reader can trust without a second look: the query's own words, the desk's table, who is who, and phrases. */
export function strongTerms(q: string, local: Understood): Set<string> {
  const out = new Set<string>();
  for (const g of local.groups) {
    // A one-word idea's table words are its synonyms ("uav": drone). A phrase's
    // are looser ("prisoner swap": prisoner), so only its phrases count.
    const single = !g[0].includes(" ");
    for (const t of g) if (t.length >= 3 && (single || t.includes(" "))) out.add(t);
  }
  return out;
}

/** One letter wrong, missing or extra, for words of five letters or more (two for nine or more). */
export function close(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 2) return false;
  const max = Math.max(a.length, b.length) >= 9 ? 2 : 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

const UNDERSTAND = `You turn a reader's search on a live news desk about the current Yemen war (from July 2026: the Houthis against the Yemeni government, the southern forces and the Saudi-led coalition; Houthi attacks on Saudi Arabia and on shipping) into search terms for its archive of short English report cards.
Work out what the reader is looking for, whatever language or spelling they use. Split it into the IDEAS a matching card must ALL carry (usually one; two or three for "X in Y" or "X on Y"), and for each idea list the words and phrases a card would use for it:
- synonyms and the specific names used in reports ("uav" -> drone, uav, unmanned aerial vehicle, samad, shahed, mq 9, reaper, quadcopter);
- for a person: every spelling of the name (the desk writes "Yahya Saree"; also saree, sarea, saria, sari) AND the titles the desk reports them under, since cards often give only the title (Yahya Saree: houthi spokesperson, houthi military spokesperson, houthi armed forces spokesperson, yemeni armed forces spokesperson; Mohammed Abdulsalam: houthi negotiator, houthi spokesperson);
- the names this war's readers mean: "abdulmalik", "abdul malik" or "sayyed" is the Houthi leader Abdul-Malik al-Houthi (cards: houthi leader, abdul malik al houthi); "alimi" is Rashad al-Alimi, head of the Presidential Leadership Council (cards: yemens president, presidential leadership council head); "zubaidi" is the STC's Aidarous al-Zubaidi;
- for a place: its spellings (hodeidah, hudaydah, al hudaydah); a place and a thing there ("hodeidah port", "marib dam") are two ideas, the place and the thing;
- "say", "said", "statement", "about", "news", "latest" are no idea of their own: a person's cards are what they said and did;
- for a group: its names (houthi, ansar allah; stc, southern transitional council, southern forces).
Cast a wide net within each idea: besides phrases, give its key single words and their forms (prisoner swap -> prisoner, prisoners, detainee, detainees, captives, exchange, swap, release; air strikes -> air strike, airstrike, air raid, strike, raid, warplane, bombing), since a later step drops cards about something else. Every word of the query that carries meaning belongs to an idea: "saudi strikes on sanaa" is three ideas, saudi (saudi, coalition) + strikes + sanaa.
But never add, on your own, words that fit most cards on this desk: no "houthi", "saudi", "yemen", "attack", "strike", "forces", "war" unless the query asks for it; "drone" must not bring "missile".
Only if the query itself names a time ("yesterday", "last week", "in August", "on 25 September") give "since"/"until" as YYYY-MM-DD; otherwise leave them out.
"about": the query's meaning in one short English line, adding nothing the reader did not ask (no side, place or time of your own).
Return ONLY JSON {"about":"...","groups":[["word","..."],["..."]],"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}. Words in English, lower case, at most 25 per idea.`;

/** A query that names a time; only then are dates taken from the model. */
const TIME_WORDS = /\b(?:today|yesterday|tonight|morning|evening|night|week|weeks|month|months|year|day|days|ago|last|past|since|before|after|until|between|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|\d{1,4})\b/i;

/** What the reader wants, from a model; null when none answered. */
export async function understandByModel(q: string, today: string): Promise<Understood | null> {
  const got = await askChain("search", UNDERSTAND, `Today is ${today}.\nSearch: ${q}`, { models: SEARCH_MODELS, temperature: 0, timeoutMs: 5_000, fast: true });
  if (!got) return null;
  const j = got.json;
  const groups = (Array.isArray(j.groups) ? j.groups : [])
    .map((g) => [...new Set((Array.isArray(g) ? g : [g]).map((t) => norm(String(t))).filter((t) => t.length >= 2 && !STOP.has(t)))].slice(0, 30))
    .filter((g) => g.length)
    .slice(0, 4);
  if (!groups.length) return null;
  const timed = TIME_WORDS.test(q);
  const day = (v: unknown) => (timed && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return { about: String(j.about || q).slice(0, 200), groups, since: day(j.since), until: day(j.until), model: got.model };
}

/** A term found as whole words ("drone" in "drones" too: a plural or a verb ending). */
function termRe(term: string): RegExp {
  const esc = term.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(" ");
  return new RegExp(`(?:^| )${esc}(?:s|es|ed|ing)?(?= |$)`);
}

/**
 * The candidates: every report that carries each idea, best first. A word in
 * the headline counts more than one in the text; a longer, more specific term
 * more than a short one. When no report carries all of three or more ideas,
 * one may be missing.
 */
export function findCandidates(docs: SearchDoc[], u: Understood, max = 300): { doc: SearchDoc; score: number }[] {
  const gs = u.groups.map((g) => g.map((t) => ({ re: termRe(t), w: 1 + Math.min(2, t.split(" ").length - 1) + (t.length >= 6 ? 0.5 : 0) })));
  const since = u.since ? Date.parse(`${u.since}T00:00:00+03:00`) : -Infinity;
  const until = u.until ? Date.parse(`${u.until}T23:59:59+03:00`) : Infinity;
  const scored: { doc: SearchDoc; score: number; missing: number }[] = [];
  for (const d of docs) {
    const at = Date.parse(d.at);
    if (at < since || at > until) continue;
    const head = norm(d.summary);
    const rest = norm(`${d.text || ""} ${d.place || ""} ${d.source || ""} ${d.also || ""}`);
    let score = 0;
    let missing = 0;
    for (const g of gs) {
      let best = 0;
      for (const { re, w } of g) {
        if (re.test(head)) best = Math.max(best, 3 * w);
        else if (best < w && re.test(rest)) best = w;
      }
      if (!best) missing++;
      score += best;
    }
    if (score > 0) scored.push({ doc: d, score, missing });
  }
  let out = scored.filter((x) => x.missing === 0);
  if (!out.length && gs.length >= 3) out = scored.filter((x) => x.missing <= 1);
  return out
    .sort((a, b) => b.score - a.score || Date.parse(b.doc.at) - Date.parse(a.doc.at))
    .slice(0, max)
    .map(({ doc, score }) => ({ doc, score }));
}

const KEEP = `A reader searched the archive of a Yemen-war news desk. You get what they are looking for and a numbered list of report cards: headline — start of the text [outlet]. These cards carry the search words only loosely (a related word, or in the text rather than the headline); the cards that plainly match were kept already. Keep a card only when what the reader asked for is really part of what it reports: "coalition intercepts two drones and two missiles" is kept for "drones"; "Houthi leader: missiles hit Riyadh" is kept for "what did abdulmalik say about saudi". Drop it when the match is a passing word, another sense of the word, another person with that title, or a different thing at that place (for "hodeidah port", a strike on a telecom network in Hodeidah; for "prisoner swap", a strike on a prison).
A person is often named by title: Yahya Saree is the Houthis' military spokesman, and Houthi outlets (Al-Masirah, Saba (Houthi-run), Al-Mihwar) call the Houthi forces "the Yemeni armed forces"; a government outlet's "Yemeni armed forces spokesperson" is the government army's spokesman, not Saree.
Return ONLY JSON {"drop":[the numbers of the cards to drop]}.`;

/** The candidates the reader wants, by a model; null when none answered. */
export async function keepByModel(q: string, u: Understood, cands: SearchDoc[]): Promise<Set<string> | null> {
  if (!cands.length) return new Set();
  const list = cands
    .map((d, i) => `${i + 1}. ${d.summary}${d.text ? ` — ${String(d.text).replace(/\s+/g, " ").slice(0, 70)}` : ""} [${d.source}]`)
    .join("\n");
  const got = await askChain("search-keep", KEEP, `Search: ${q}\nLooking for: ${u.about}\n\n${list}`, { models: KEEP_MODELS, temperature: 0, timeoutMs: 8_000, fast: true });
  if (!got || !Array.isArray(got.json.drop)) return null;
  const drop = new Set<number>();
  for (const n of got.json.drop) {
    const i = Number(n) - 1;
    if (Number.isInteger(i) && i >= 0 && i < cands.length) drop.add(i);
  }
  return new Set(cands.filter((_, i) => !drop.has(i)).map((d) => d.fp));
}

/**
 * Whether a card's headline names every idea of the query itself, each by one
 * of its sure words ("hodeidah port": Hodeidah and the port, not Hodeidah alone).
 */
export function headlineHas(d: SearchDoc, strong: Set<string>, u: Understood): boolean {
  const head = norm(d.summary);
  return u.groups.every((g) => g.some((t) => strong.has(t) && head.includes(t) && termRe(t).test(head)));
}
