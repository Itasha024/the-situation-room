/**
 * The Iran desk's Trump feed (Round 30 stage 5): Trump's own words on Iran and
 * the war, and nothing else (user, 9 Oct): his Truth Social posts and his
 * words on camera, never an outlet's report about him. Each statement carries
 * the time he said it, its source and a link to the original.
 *
 * Kept from the day the desk's feed starts (8 Oct), newest first: the desk
 * shows the latest, the pop-up the whole list.
 */
import { IRAN_GATE } from "./iran-reader.ts";

export type TrumpStatement = {
  /** "ts-<post id>" or "rr-<X status id>". */
  id: string;
  /** When he posted or spoke (UTC). */
  at: string;
  text: string;
  /** The original post or clip. */
  url: string;
  /** "Truth Social", or the account that posted the clip. */
  source: string;
  /** `Trump: "…"`: his main points, in his voice (9 Oct). Written once per text. */
  headline?: string;
  /** Only the parts of what he said that bear on Iran and the war, in quotes; none when the headline holds it all. */
  body?: string;
  /** The writer found nothing in it on Iran or the war: not shown. */
  off?: boolean;
  /** Times the writer was asked and gave nothing usable. */
  tries?: number;
};

export type TrumpFeed = { statements: TrumpStatement[]; checkedAt?: string; down?: string[]; lastClipId?: string };

export const TRUMP_KEY = "trump:feed";
const KEEP = 3000;

/** A Truth Social post's time, from its id: the high bits are milliseconds since 1970. */
export function truthTime(id: string): string | null {
  if (!/^\d{15,20}$/.test(id)) return null;
  const ms = Number(BigInt(id) >> 16n);
  return ms > Date.parse("2022-01-01") && ms < Date.parse("2100-01-01") ? new Date(ms).toISOString() : null;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

/** A post's words: its paragraphs, its links taken out. */
export function postText(html: string): string {
  return decode(
    html
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Not his words: a repost of someone else's ("RT @…", "RT: …"), a link shared
 * under its own headline ("Melania Trump makes history …:"), a picture or a
 * video with nothing said.
 */
export function notHisWords(text: string, html: string): boolean {
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 12) return true;
  if (/^RT\b[\s:@]/.test(text)) return true;
  const linked = /<a\b/i.test(html);
  if (linked && /[:：]\s*$/.test(text) && text.length < 220) return true;
  return false;
}

/** About Iran or the war with it: the Iran gate's names and places, or the war's own words. */
const WAR_WORDS = /\b(?:Hormuz|blockade|Ayatollah|the Strait|Islamic Republic|Hezbollah|nuclear weapons?)\b/i;
export const aboutIran = (text: string) => IRAN_GATE.test(text) || WAR_WORDS.test(text);

/**
 * His own part of a post: what follows "From Dick Morris: “…" is someone
 * else's, and Iran named only there is not his word on Iran (4 Oct).
 */
export const hisOwnPart = (text: string) => text.split(/(?:^|\n|\s)(?:From|Via|By)\s+[^:\n]{2,60}:\s*["“]/)[0];

/** trumpstruth.org's feed (every Truth Social post, minutes after it goes up) → his statements on Iran. */
export function parseTruthFeed(xml: string): TrumpStatement[] {
  const out: TrumpStatement[] = [];
  for (const b of xml.split(/<item[\s>]/i).slice(1)) {
    const id = (/<truth:originalId>\s*(\d+)\s*</i.exec(b) || [])[1] ?? "";
    const url = decode((/<truth:originalUrl>\s*([^<\s]+)\s*</i.exec(b) || [])[1] ?? "");
    const html = (/<description[^>]*>([\s\S]*?)<\/description>/i.exec(b) || [])[1] ?? "";
    const pub = (/<pubDate>([^<]+)</i.exec(b) || [])[1] ?? "";
    if (!id || !/^https:\/\/truthsocial\.com\//.test(url)) continue;
    const text = postText(html);
    if (notHisWords(text, html) || !aboutIran(hisOwnPart(text))) continue;
    const t = Date.parse(pub);
    const at = truthTime(id) ?? (Number.isFinite(t) ? new Date(t).toISOString() : null);
    if (!at) continue;
    out.push({ id: `ts-${id}`, at, text, url, source: "Truth Social" });
  }
  return out;
}

/**
 * Rapid Response 47 posts his words on camera as `President Trump: "…"` or
 * `.@POTUS on Iran: "…"`: those on Iran are his statements; its clips of
 * other officials, and its own lines, are not.
 */
const HIS_CLIP = /^\s*(?:🚨\s*)?(?:\.?@POTUS|President\s+(?:Donald\s+J\.?\s+)?Trump|PRESIDENT\s+(?:DONALD\s+J\.?\s+)?TRUMP)\b[^:"“\n]{0,60}[:：]?\s*["“]/;
export function clipStatement(post: { url: string; text: string; at: string }, source = "Rapid Response 47"): TrumpStatement | null {
  const id = /\/status\/(\d+)/.exec(post.url)?.[1];
  if (!id || !HIS_CLIP.test(post.text)) return null;
  const text = post.text.replace(/https?:\/\/\S+/g, " ").replace(/[ \t]+/g, " ").trim();
  if (!aboutIran(text)) return null;
  return { id: `rr-${id}`, at: post.at, text, url: post.url, source };
}

/** New statements into the list: each once, newest first, none before the feed's first day. */
export function mergeStatements(old: TrumpStatement[], fresh: TrumpStatement[], from: string, keep = KEEP): TrumpStatement[] {
  const floor = Date.parse(from);
  const byId = new Map<string, TrumpStatement>();
  for (const s of old) byId.set(s.id, s);
  // A post edited since keeps its id: the newest words stand, and are written again.
  for (const s of fresh) {
    const was = byId.get(s.id);
    byId.set(s.id, was && was.text === s.text ? { ...was, ...s, headline: was.headline, body: was.body, off: was.off, tries: was.tries } : s);
  }
  return [...byId.values()]
    .filter((s) => !(Date.parse(s.at) < floor))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id))
    .slice(0, keep);
}

/** The day in Israel a statement falls on ("2026-10-08"): the pop-up's day headings. */
export function israelDay(at: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

/** His sign-off ("President DONALD J. TRUMP", "DJT") is not part of what he said. */
export const withoutSignOff = (text: string) =>
  text.replace(/\s*(?:Thank you for your attention to this matter!\s*)?(?:President\s+)?(?:DONALD\s+J\.?\s+TRUMP|DJT)\s*$/i, "").trim();

/** His words in quotes, once: quotes already round them are not doubled. */
export const quoted = (words: string) => {
  const w = words.trim().replace(/^["“]+|["”]+$/g, "").trim();
  return w ? `“${w}”` : "";
};

const unquote = (w: string) => w.trim().replace(/^["“]+|["”]+$/g, "").trim();

/** "Trump: …" with no quotes round his words: the colon says he is speaking (user, 9 Oct). */
export const headlineWords = (h: string) => `Trump: ${unquote(h.replace(/^Trump:\s*/, ""))}`;

/** His words below the headline: one quote before the first word, one at the end before the full stop (user, 9 Oct). */
export function quoteBody(paras: string[]): string {
  const ps = paras.map(unquote).filter(Boolean);
  if (!ps.length) return "";
  const last = ps.length - 1;
  ps[0] = `“${ps[0]}`;
  ps[last] = /\.$/.test(ps[last]) ? `${ps[last].slice(0, -1)}”.` : `${ps[last]}”`;
  return ps.join("\n\n");
}

/** A card as the page shows it, whichever form it was written in. */
export const shownCard = (c: { headline: string; body?: string }) => {
  const body = c.body ? quoteBody(c.body.split(/\n\n+/)) : "";
  return { headline: headlineWords(c.headline), ...(body ? { body } : {}) };
};

/** A clip's words: what follows 'President Trump on Iran:'. */
export const clipWords = (text: string) => text.replace(/^[^"“]*["“]/, "").replace(/["”]\s*$/, "").trim();

/** Without a writer: his first sentence as the headline, all his words as the body. */
export function plainCard(s: TrumpStatement): { headline: string; body?: string } {
  const words = s.id.startsWith("rr-") ? clipWords(s.text) : withoutSignOff(s.text);
  const first = /^[\s\S]{20,220}?[.!?](?=\s|$)/.exec(words)?.[0] ?? words.slice(0, 200).replace(/\s+\S*$/, "…");
  const rest = words.slice(first.length).trim();
  return shownCard({ headline: `Trump: ${first}`, ...(rest.length > 40 ? { body: words } : {}) });
}

export const TRUMP_SYSTEM = `You edit a news desk's feed of Donald Trump's own words on Iran and the war with Iran.
You get one thing he said (a Truth Social post or his words on camera). Return JSON only:
{"relevant": true|false, "headline": "...", "body": "..."}

- relevant: false only when nothing in it bears on Iran, the war, the Strait of Hormuz, the blockade, Iran's nuclear programme, the talks with Iran or the war's effects (gasoline and oil prices because of the war count).
- headline: "Trump: " then his main points on Iran and the war, without quotation marks, as if he is speaking, in the first person. Build it from his own sentences, shortened; rephrase only where needed to join them or make the point clear. Lead with the hardest news in it (a decision, a threat, a deadline, a deal, a number). One or two sentences, at most 220 characters. No outlet, no "said", no "posted".
- body: only the parts of what he said that bear on Iran and the war, in his own words, without quotation marks, a paragraph per point, separated by a blank line. Leave out every part on other subjects (elections, rivals, the media) unless it explains his point on Iran. Keep his facts and numbers. Put the capital letters he uses for emphasis in normal case. "" when the headline already holds everything relevant.
- Keep his meaning exactly: a question, a comparison or a "what if" stays one, and is never turned into a claim or a threat he did not make.
- Each body paragraph is a whole sentence of his, starting with a capital letter.
- Never add facts, context or comment of your own.`;

/** The writer's answer, checked: a headline in his voice, a body in quotes, or "off" when nothing bears on Iran. */
export function checkWritten(json: Record<string, unknown>): { headline: string; body?: string; off?: boolean } | null {
  if (json.relevant === false) return { headline: "", off: true };
  const h = typeof json.headline === "string" ? json.headline.replace(/\s+/g, " ").trim() : "";
  if (!/^Trump:\s*\S/.test(h) || h.length > 300) return null;
  const words = h.replace(/^Trump:\s*/, "");
  const raw = typeof json.body === "string" ? json.body.trim() : "";
  // '"One." "Two."' in one paragraph is two of his sentences: a paragraph each.
  const body = raw ? raw.replace(/\\"/g, '"').replace(/["”]\s+["“]/g, "\n").split(/\n+/).map((x) => x.trim()).filter(Boolean).join("\n\n") : "";
  const bare = (x: string) => x.replace(/[“”"\s]/g, "");
  return shownCard({ headline: `Trump: ${words}`, ...(body && bare(body) !== bare(words) ? { body } : {}) });
}

