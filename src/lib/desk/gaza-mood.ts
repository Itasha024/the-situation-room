/**
 * The mood monitor (user, 27 Oct: "the mood after IDF forces got into some place … go into groups of this area and
 * look … not the reports of the entry themselves"). Each big event on the Gaza desk is followed for a day: the
 * public Telegram channels of its town and the main Palestinian channels are searched for it, and what people and
 * channels say about it (not the reports of it), the comments under the posts and the emoji people pressed are read
 * into a mood. Pure functions here; the reading is in gaza-mood.server.ts.
 */
import { GAZA_GAZ } from "./gaza-gazetteer.ts";

export type MoodArea = "gaza" | "js";

/** A post or a comment found about an event. */
export type MoodPost = {
  /** Its link. */
  u: string;
  at: string;
  /** The channel's handle. */
  ch: string;
  /** The text, cut. */
  x: string;
  /** Views (posts only). */
  v: number;
  /** The emoji people pressed under it, and how many. */
  rx?: Record<string, number>;
  /** A comment under a channel's post. */
  c?: 1;
};

/* ------------------------------------------------------------------ *
 * The channels, by town (found and checked on 23 Oct for the Online watch, each showing posts of that day).
 * ------------------------------------------------------------------ */

type Town = { id: string; area: MoodArea; at: [number, number]; ch: string[] };
export const TOWNS: Town[] = [
  { id: "jenin", area: "js", at: [32.46, 35.3], ch: ["jeninnews1", "jenencamb", "Jeninal3mliaat", "aldeeerrrjenin", "nashit_jenin", "Qabatyia", "rueib_alkian"] },
  { id: "nablus", area: "js", at: [32.22, 35.26], ch: ["nabuls_news", "Nablispost", "balata_alhadat", "Balata12", "dooz_palestine", "rassd"] },
  { id: "tulkarm", area: "js", at: [32.31, 35.03], ch: ["TulkaremNet", "noursams", "a7rartullkarm", "samsalmohaiam", "alrasdalkarmi77", "sarayatulkarm"] },
  { id: "tubas", area: "js", at: [32.32, 35.37], ch: ["TubasTimes", "A7rartoubas", "tubasalkdraa", "Faracamp", "aqappaA7rar"] },
  { id: "qalqilya", area: "js", at: [32.19, 34.97], ch: ["ahrar_qalqilia", "qalqilya_alhadath", "bawabatqalqilia", "qalfirst"] },
  { id: "salfit", area: "js", at: [32.08, 35.18], ch: ["selfetnews", "radioalzaytona"] },
  { id: "ramallah", area: "js", at: [31.9, 35.2], ch: ["ramallahmix1", "ramallahnew", "birzeitpress1", "sawtalmughayyir", "koformalik12", "amen24fm"] },
  { id: "jerusalem", area: "js", at: [31.78, 35.23], ch: ["alqudstodaytv", "AlQastalps"] },
  { id: "bethlehem", area: "js", at: [31.7, 35.2], ch: ["bethlahem_alhadath", "bethlehemnewss"] },
  { id: "hebron", area: "js", at: [31.53, 35.09], ch: ["khalelnews", "DuraCity", "ahrarsurif"] },
  { id: "jericho", area: "js", at: [31.86, 35.46], ch: ["jerichocm", "jerichomix2022"] },
  { id: "north_gaza", area: "gaza", at: [31.54, 34.5], ch: ["shamal_online1", "saedalzaneen8", "anas1020304050"] },
  { id: "gaza_city", area: "gaza", at: [31.51, 34.45], ch: ["AlShatiNews", "gazalivee", "Barqgaza", "GAZA20249", "hamza20300"] },
  { id: "central_gaza", area: "gaza", at: [31.42, 34.36], ch: ["Nuseirat1", "alburaij", "burijofficial", "megazipress", "Derbalh"] },
  { id: "khan_younis", area: "gaza", at: [31.34, 34.3], ch: ["madinat_khanyuns", "khnmedia", "nailkhn"] },
  { id: "rafah", area: "gaza", at: [31.29, 34.25], ch: ["rafahbordernews", "rafahaonlain"] },
];

/** The main Palestinian channels, searched for every event: what the whole public reads and answers. */
export const MAIN_CHANNELS = ["QudsN", "ShehabTelegram2", "Palinfo", "paltoday_tv", "safaps", "SamaNewsAgency", "ultrapalestine", "meshheek", "alresalahpress", "AwdehTV"];

const km = (a: [number, number], b: [number, number]) => {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180, dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

/** The nearest town of the event's area (a pin in Gaza looks only at Gaza's towns). */
export function townOf(lat: number | undefined, lng: number | undefined, area: MoodArea): Town | null {
  if (lat == null || lng == null) return null;
  return TOWNS.filter((t) => t.area === area).sort((a, b) => km(a.at, [lat, lng]) - km(b.at, [lat, lng]))[0] ?? null;
}

/** The channels searched for an event: its town's own first, then the main ones. */
export function channelsFor(ev: Pick<MoodEvent, "lat" | "lng" | "area">): string[] {
  const town = townOf(ev.lat, ev.lng, ev.area);
  return [...new Set([...(town?.ch ?? []), ...MAIN_CHANNELS])];
}

/** The Arabic names of a place, as the gazetteer has them ("مخيم جنين" and "جنين" both). */
/** Places too big to search by: every post of the day names them. */
const BIG = /^(?:gaza|gaza city|gaza strip|khan y[ou]+nis|rafah|deir al-balah|hebron|nablus|jenin|ramallah|al-bireh|jerusalem|east jerusalem|bethlehem|tulkarm|qalqilya|jericho|tubas|salfit|judea and samaria)$/i;

export function arabicNames(place: string | undefined): string[] {
  if (!place || BIG.test(place.trim())) return [];
  const p = place.toLowerCase();
  const hits = GAZA_GAZ.filter((g) => g[0].toLowerCase() === p || g[4].some((n) => n.toLowerCase() === p));
  const out = new Set<string>();
  for (const g of hits) for (const n of g[5]) if (/[؀-ۿ]/.test(n) && n.length <= 24) out.add(n.replace(/^مخيم\s+/, "").trim());
  // One spelling: Telegram's search finds "غزة" but not "غزه".
  return [...out].filter((n) => !/ه$/.test(n) || !out.has(n.replace(/ه$/, "ة"))).slice(0, 2);
}

/* ------------------------------------------------------------------ *
 * The events worth following: big, on the ground or a decision, from the last day and a half.
 * ------------------------------------------------------------------ */

export type DeskCard = { fp: string; at: string; summary: string; place?: string; lat?: number; lng?: number; type?: string; flags?: string[]; alsoReportedBy?: unknown[] };

export type MoodEvent = {
  fp: string;
  at: string;
  headline: string;
  place?: string;
  lat?: number;
  lng?: number;
  area: MoodArea;
  /** Why it was picked, and how big. */
  score: number;
};

const DEATH = /\b(?:kill(?:ed|s|ing)?|dead|death|bod(?:y|ies)|funeral|martyr)/i;
const ENTRY = /\b(?:raid(?:s|ed)?|storm(?:s|ed)?|incursion|enter(?:s|ed)?|advance(?:s|d)?|push(?:es|ed)? into|operation|siege|besieg|curfew)\b/i;
const DECISION = /\b(?:cabinet|government|knesset|minister|smotrich|ben[- ]gvir|netanyahu|katz)\b[^.]{0,80}\b(?:approv|decid|decision|announc|sovereignty|annex|settlement|outpost|law|bill|order|plan|declar)/i;
const ATTACK_ON_ISRAELIS = /\b(?:stabbing|ramming|shooting attack|car-ramming|attack(?:ed)? (?:on )?israeli|wounded israeli|israeli (?:soldier|citizen|civilian)s? (?:killed|wounded|hurt))/i;
const HARM = /\b(?:demolish|demolition|arson|torch|set fire|uproot|expel|evict|airstrike|air strike|strike on|shelling|bomb(?:ed|ing))/i;
const LOW = /\b(?:truck|aid|gas|flour|price|weather|congratulat|meets|met with|phone call|condolence)/i;

/** How big an event is for the street: told by many, deaths, an entry, a decision, an attack on Israelis. */
export function moodScore(c: DeskCard): number {
  const flags = c.flags ?? [];
  if (flags.includes("arena:aid") || c.type === "economy") return 0;
  const s = c.summary || "";
  let n = 1 + Math.min(8, (c.alsoReportedBy ?? []).length);
  if (DEATH.test(s)) n += 4;
  if (ENTRY.test(s)) n += 2;
  if (DECISION.test(s)) n += 5;
  if (ATTACK_ON_ISRAELIS.test(s)) n += 4;
  if (HARM.test(s)) n += 2;
  if (LOW.test(s) && !DEATH.test(s)) n -= 4;
  if ((c.type === "statement" || c.type === "diplomacy") && !DECISION.test(s)) n -= 3;
  return n;
}

const areaOfCard = (c: DeskCard): MoodArea | null => {
  const f = c.flags ?? [];
  if (f.includes("arena:gaza")) return "gaza";
  if (f.includes("arena:judea_samaria") || f.includes("arena:jerusalem")) return "js";
  return null;
};

/** The events to follow: the biggest, one a town in 12 hours (an event told twice is one), up to `max`. */
export function pickEvents(cards: DeskCard[], now: number, max = 8, minScore = 7): MoodEvent[] {
  const fresh = cards
    .filter((c) => now - Date.parse(c.at) < 24 * 3600_000 && Date.parse(c.at) <= now)
    .map((c) => ({ c, area: areaOfCard(c), score: moodScore(c) }))
    .filter((x): x is { c: DeskCard; area: MoodArea; score: number } => !!x.area && x.score >= minScore)
    .sort((a, b) => b.score - a.score || Date.parse(b.c.at) - Date.parse(a.c.at));
  const out: MoodEvent[] = [];
  for (const { c, area, score } of fresh) {
    const town = townOf(c.lat, c.lng, area)?.id;
    const twin = out.find((e) => e.area === area && Math.abs(Date.parse(e.at) - Date.parse(c.at)) < 12 * 3600_000 && (town ? townOf(e.lat, e.lng, area)?.id === town : !e.place && !c.place && DECISION.test(e.headline) === DECISION.test(c.summary)));
    if (twin) continue;
    out.push({ fp: c.fp, at: c.at, headline: c.summary, place: c.place, lat: c.lat, lng: c.lng, area, score });
    if (out.length >= max) break;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Telegram's public pages: posts with their emoji, and the comments widget.
 * ------------------------------------------------------------------ */

const decode = (s: string) =>
  s.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

export function viewsOf(s: string): number {
  const m = /([\d.,]+)\s*([KkMm])?/.exec(String(s || ""));
  if (!m) return 0;
  const n = Number(m[1].replace(/,/g, ""));
  return Math.round(n * (/[Kk]/.test(m[2] ?? "") ? 1e3 : /[Mm]/.test(m[2] ?? "") ? 1e6 : 1));
}

/** The emoji under a post: `<span class="tgme_reaction"><i class="emoji" …><b>🤬</b></i>4</span>`. */
export function reactionsOf(block: string): Record<string, number> | undefined {
  const box = /tgme_widget_message_reactions[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1];
  if (!box) return undefined;
  const out: Record<string, number> = {};
  for (const m of box.matchAll(/<span class="tgme_reaction[^"]*">[\s\S]*?<b>([^<]+)<\/b>[\s\S]*?<\/i>\s*([\d.,]+[KkMm]?)/g)) out[m[1].trim()] = (out[m[1].trim()] ?? 0) + viewsOf(m[2]);
  return Object.keys(out).length ? out : undefined;
}

/** A cut of text by whole characters, no half emoji (a half emoji broke the model's requests, 23 Oct). */
export function cut(s: string, n: number): string {
  const whole = String(s || "").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "").replace(/\s+/g, " ").trim();
  return Array.from(whole).slice(0, n).join("");
}

/** A channel's public page (or its search page) as posts. */
export function parsePosts(html: string, ch: string): MoodPost[] {
  const out: MoodPost[] = [];
  for (const block of String(html || "").split(/(?=<div class="tgme_widget_message_wrap)/)) {
    const post = /data-post="([^"]+)"/.exec(block)?.[1];
    const at = /<time datetime="([^"]+)"/.exec(block)?.[1];
    if (!post || !at) continue;
    const x = cut(decode(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? ""), 500);
    if (!x) continue;
    const v = viewsOf(/<span class="tgme_widget_message_views">([^<]*)<\/span>/.exec(block)?.[1] ?? "");
    const rx = reactionsOf(block);
    out.push({ u: `https://t.me/${post}`, at: new Date(at).toISOString(), ch, x, v, ...(rx ? { rx } : {}) });
  }
  return out;
}

/** A post's comments, from Telegram's public comments widget (no sign-in); who wrote each is not kept. */
export function parseComments(html: string, ch: string): MoodPost[] {
  const out: MoodPost[] = [];
  for (const block of String(html || "").split(/(?=<div class="tgme_widget_message_wrap)/)) {
    const link = /<a class="tgme_widget_message_date" href="([^"]+\?comment=\d+)"/.exec(block)?.[1];
    const at = /<time datetime="([^"]+)"/.exec(block)?.[1];
    if (!link || !at) continue;
    const x = cut(decode(/<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? ""), 300);
    if (!x) continue;
    out.push({ u: link, at: new Date(at).toISOString(), ch, x, v: 0, c: 1 });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The emoji, summed and read: a cheap mood that needs no model.
 * ------------------------------------------------------------------ */

/** What each emoji says, roughly. One not here counts in the total only. */
export const EMOJI_MOOD: Record<string, MoodKind> = {
  "🤬": "anger", "😡": "anger", "👎": "anger", "💩": "anger", "🖕": "anger",
  "💔": "grief", "😢": "grief", "😭": "grief", "🥺": "grief", "🕊": "grief",
  "❤": "solidarity", "❤️": "solidarity", "🙏": "solidarity", "🤝": "solidarity", "💯": "solidarity", "👍": "solidarity",
  "🔥": "defiance", "👏": "defiance", "💪": "defiance", "⚡": "defiance", "🏆": "defiance",
  "😂": "mockery", "🤣": "mockery", "🤡": "mockery",
  "😱": "fear", "😨": "fear", "🤯": "fear",
};

export function sumReactions(posts: MoodPost[]): { total: number; top: [string, number][]; byMood: Partial<Record<MoodKind, number>> } {
  const all: Record<string, number> = {};
  for (const p of posts) for (const [e, n] of Object.entries(p.rx ?? {})) all[e] = (all[e] ?? 0) + n;
  const byMood: Partial<Record<MoodKind, number>> = {};
  for (const [e, n] of Object.entries(all)) {
    const k = EMOJI_MOOD[e];
    if (k) byMood[k] = (byMood[k] ?? 0) + n;
  }
  const top = Object.entries(all).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { total: Object.values(all).reduce((a, b) => a + b, 0), top, byMood };
}

/* ------------------------------------------------------------------ *
 * The model's read.
 * ------------------------------------------------------------------ */

export type MoodKind = "anger" | "grief" | "defiance" | "praise_attack" | "fear" | "despair" | "blame_israel" | "blame_pa" | "blame_hamas" | "solidarity" | "mockery" | "calm";
export const MOOD_KINDS: MoodKind[] = ["anger", "grief", "defiance", "praise_attack", "fear", "despair", "blame_israel", "blame_pa", "blame_hamas", "solidarity", "mockery", "calm"];
export const MOOD_LABEL: Record<MoodKind, string> = {
  anger: "Anger",
  grief: "Grief and mourning",
  defiance: "Defiance, calls to stand firm",
  praise_attack: "Praise of attacks",
  fear: "Fear and alarm",
  despair: "Despair, fatigue",
  blame_israel: "Blame on Israel",
  blame_pa: "Blame on the PA",
  blame_hamas: "Blame on Hamas",
  solidarity: "Solidarity, support",
  mockery: "Mockery",
  calm: "Calls for calm",
};
export type CallKind = "protest" | "strike" | "confront" | "attack" | "mobilise" | "other";

export type MoodRead = {
  /** Whether the posts found talk about this event at all. */
  about: boolean;
  /** The items about this event (reports or reactions): their emoji are the mood's count. */
  rel: number[];
  mood: { k: MoodKind; w: number }[];
  intensity: number;
  summary: string;
  calls: { kind: CallKind; en: string; u: string; ch: string; c?: 1 }[];
  quotes: { en: string; u: string; ch: string; c?: 1 }[];
  /** The posts that were only reports of the event, left out of the mood. */
  reports: number;
};

export const MOOD_SYSTEM = `You read Palestinian Telegram channels and the comments under their posts for a desk that follows the PUBLIC MOOD after events in Gaza and in Judea and Samaria.
You get one event (as the desk reported it) and numbered posts and comments found about it, each with its channel, views and the emoji people pressed.
Leave out every item that only REPORTS the event or other news (what happened, casualties, the army's moves, statements relayed as news): count them in "reports". Read only the REACTIONS: what people, channels, factions and comments SAY about it — anger, grief, mourning notices, calls, threats, praise, blame, fear, despair, jokes, prayers, opinions.
Answer JSON only:
{"about": true|false (false when nothing found is a reaction to THIS event),
 "mood": [{"k": one of ${MOOD_KINDS.map((k) => `"${k}"`).join(", ")}, "w": share 0-100}] (the shares of the reactions, largest first, summing to about 100; "praise_attack" only for praise of an attack on Israelis; "blame_pa"/"blame_hamas" only when the item blames them),
 "intensity": 1-5 (1 quiet, 5 very heated: many reactions, strong words, calls to act),
 "summary": "2-3 short sentences in plain English: what the reactions say and how widely, and who says it (local channels, faction media, commenters). Never retell the event, never discuss which words outlets use. When the reactions are few, say so plainly. Spell places as the EVENT does.",
 "calls": [{"i": item number, "kind": "protest"|"strike"|"confront"|"attack"|"mobilise"|"other", "en": "the call in English, short"}] (ONLY explicit calls on the public to DO something: go out, protest, strike, confront, mobilise, attack; a faction's threat counts as "attack". A prayer, a curse, a wish or an official's vow to investigate is NOT a call; none found: []),
 "quotes": [{"i": item number, "en": "a short English rendering"}] (up to 4 items in someone's OWN voice that show the mood best: a feeling, an opinion, a prayer, a curse, a joke, a call. NEVER an item that tells what happened or what someone announced; none found: []),
 "reports": number,
 "rel": [the item numbers of every item about THIS event, reports and reactions alike]}
Words: write "Judea and Samaria" (never "West Bank"), "Israeli citizens" (never "settlers"), "Israeli forces" or "the IDF" (never "occupation forces"), "killed" (never "martyred"), "attacks" (never "ceasefire violations"). Quote people's words as theirs; do not adopt them.`;

/** The model's numbered items: posts first, most-seen first, then comments. */
export function moodItems(posts: MoodPost[], max = 45): MoodPost[] {
  const own = posts.filter((p) => !p.c).sort((a, b) => b.v - a.v).slice(0, 30);
  const cmts = posts.filter((p) => p.c).slice(0, max - own.length);
  return [...own, ...cmts];
}

export function moodPrompt(ev: MoodEvent, items: MoodPost[]): string {
  const rx = (p: MoodPost) => (p.rx ? ` [${Object.entries(p.rx).map(([e, n]) => `${e}${n}`).join(" ")}]` : "");
  return [`EVENT (${ev.at.slice(0, 16).replace("T", " ")} UTC${ev.place ? `, ${ev.place}` : ""}): ${ev.headline}`, "", "ITEMS:", ...items.map((p, i) => `${i}. [${p.c ? "comment" : "post"} @${p.ch}${p.v ? `, ${p.v} views` : ""}${rx(p)}] ${cut(p.x, 260)}`)].join("\n");
}

/** The model's answer made safe: known kinds only, items it named, shares that add up. */
export function readMood(json: Record<string, unknown>, items: MoodPost[], words: (s: string) => string = (s) => s): MoodRead | null {
  if (typeof json.about !== "boolean") return null;
  const kinds = new Set<string>(MOOD_KINDS);
  const mood = (Array.isArray(json.mood) ? json.mood : [])
    .map((m) => ({ k: String((m as { k?: unknown }).k), w: Math.max(0, Math.min(100, Number((m as { w?: unknown }).w) || 0)) }))
    .filter((m): m is { k: MoodKind; w: number } => kinds.has(m.k) && m.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, 6);
  const sum = mood.reduce((a, m) => a + m.w, 0) || 1;
  for (const m of mood) m.w = Math.round((m.w / sum) * 100);
  const item = (i: unknown) => items[Number(i)];
  const calls = (Array.isArray(json.calls) ? json.calls : []).flatMap((c) => {
    const o = c as { i?: unknown; kind?: unknown; en?: unknown };
    const p = item(o.i);
    if (!p || typeof o.en !== "string" || !o.en.trim()) return [];
    const kind = (["protest", "strike", "confront", "attack", "mobilise"].includes(String(o.kind)) ? o.kind : "other") as CallKind;
    return [{ kind, en: words(o.en.trim()), u: p.u, ch: p.ch, ...(p.c ? { c: 1 as const } : {}) }];
  }).slice(0, 6);
  const quotes = (Array.isArray(json.quotes) ? json.quotes : []).flatMap((q) => {
    const o = q as { i?: unknown; en?: unknown };
    const p = item(o.i);
    if (!p || typeof o.en !== "string" || !o.en.trim()) return [];
    return [{ en: words(o.en.trim()), u: p.u, ch: p.ch, ...(p.c ? { c: 1 as const } : {}) }];
  }).slice(0, 4);
  const intensity = Math.max(1, Math.min(5, Math.round(Number(json.intensity) || 1)));
  const rel = (Array.isArray(json.rel) ? json.rel : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < items.length);
  return { about: json.about && mood.length > 0, rel, mood, intensity, summary: words(String(json.summary ?? "").trim()), calls, quotes, reports: Math.max(0, Number(json.reports) || 0) };
}
