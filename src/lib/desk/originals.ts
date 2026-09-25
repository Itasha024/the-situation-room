/**
 * Finding the original of a secondhand report, where the plain outlet search
 * of origin.ts does not reach. Server-only.
 *
 *  - A foreign leader's words ("Macron: France will send soldiers to Yanbu")
 *    are looked for as he said them: his own X account, his office's site, his
 *    country's press in his language (the keys are translated first), then
 *    any outlet at all.
 *  - A named outlet's story that Google's headline search misses ("citing
 *    CNN" for a piece titled "Trump is staying out of Saudi Arabia's war") is
 *    looked for in the outlet's own listing of recent articles: the closest
 *    few are read and a model says which one carries the claim.
 *  - An original found at an outlet the desk does not read becomes one of its
 *    sources (`learned-sources`).
 */

import { type Edition, type GnewsItem, resolveGoogleNews, searchGoogleNews } from "./gnews.ts";
import { askChain } from "./models.ts";
import type { Listed } from "./sitemap.ts";
import { SPEAKERS, type Speaker } from "./speakers.ts";
import type { DeskStore } from "./store.ts";
import { TRIAGE_MODELS } from "./triage.ts";

export type Hit = { url: string; source: string; title?: string };

/** Each country's press, where its leaders' words are first reported. */
export const SPEAKER_PRESS: Record<string, string[]> = {
  FR: ["lemonde.fr", "lefigaro.fr", "francetvinfo.fr", "bfmtv.com", "tf1info.fr", "leparisien.fr", "lci.fr", "europe1.fr", "radiofrance.fr", "lesechos.fr", "france24.com", "rfi.fr", "ouest-france.fr", "afp.com", "liberation.fr"],
  US: ["apnews.com", "reuters.com", "nytimes.com", "washingtonpost.com", "wsj.com", "cnn.com", "foxnews.com", "nbcnews.com", "cbsnews.com", "abcnews.go.com", "politico.com", "axios.com", "bloomberg.com"],
  UK: ["bbc.com", "bbc.co.uk", "theguardian.com", "thetimes.com", "telegraph.co.uk", "news.sky.com", "ft.com", "independent.co.uk", "reuters.com"],
  IR: ["irna.ir", "tasnimnews.ir", "presstv.ir", "mehrnews.com", "farsnews.ir", "isna.ir"],
  EG: ["ahram.org.eg", "youm7.com", "almasryalyoum.com", "sis.gov.eg"],
  OM: ["omannews.gov.om", "timesofoman.com", "omanobserver.om"],
  QA: ["qna.org.qa", "aljazeera.net", "aljazeera.com", "thepeninsulaqatar.com"],
  AE: ["wam.ae", "thenationalnews.com", "alkhaleej.ae"],
  TR: ["aa.com.tr", "trthaber.com", "dailysabah.com", "hurriyet.com.tr"],
  PK: ["dawn.com", "geo.tv", "app.com.pk", "tribune.com.pk"],
  RU: ["tass.ru", "tass.com", "ria.ru", "interfax.ru", "rt.com"],
  CN: ["xinhuanet.com", "news.cn", "globaltimes.cn", "chinadaily.com.cn"],
  UN: ["news.un.org", "un.org", "reuters.com", "apnews.com"],
  EU: ["ec.europa.eu", "eeas.europa.eu", "euronews.com", "politico.eu", "reuters.com"],
  IT: ["repubblica.it", "corriere.it", "ansa.it", "lastampa.it", "ilsole24ore.com"],
  DE: ["spiegel.de", "faz.net", "sueddeutsche.de", "dw.com", "zeit.de", "tagesschau.de"],
};

/** The wires: they report any leader first-hand. */
export const WIRE_SITES = ["reuters.com", "apnews.com", "afp.com", "bloomberg.com"];

const low = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
/** How many of the keys a text carries. */
export function shared(text: string, keys: string[]): number {
  const t = ` ${low(text).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return keys.filter((k) => k.length >= 3 && t.includes(` ${low(k).replace(/[^\p{L}\p{N}]+/gu, " ").trim()}`)).length;
}

const surname = (sp: Speaker) => sp.name.split(" ").slice(-1)[0];

/**
 * The keys in the speaker's language: one short model call. "Yanbu", "Saudi
 * Arabia", "soldiers", "protect" → "Yanbu", "Arabie saoudite", "soldats",
 * "protéger". None when no model answers; the English keys still run.
 */
export async function translateKeys(keys: string[], lang: string): Promise<string[]> {
  if (lang === "English" || !keys.length) return [];
  const got = await askChain(
    "keys",
    `Translate each search keyword into ${lang} as a journalist writing in ${lang} would put it. Place names in their usual ${lang} spelling. Return ONLY JSON {"keys":["..."]}, same order, at most 6.`,
    keys.slice(0, 6).join("\n"),
    { temperature: 0, models: TRIAGE_MODELS.slice(0, 2), timeoutMs: 12_000 },
  );
  const out = Array.isArray(got?.json.keys) ? (got!.json.keys as unknown[]).map((k) => String(k).trim()).filter((k) => k.length >= 2 && k.length <= 40) : [];
  return out.slice(0, 6);
}

type FxStatus = { url?: string; id?: string; text?: string; raw_text?: { text?: string }; created_timestamp?: number; author?: { screen_name?: string }; reposted_by?: unknown };

/** The speaker's own post on X that carries the words, through FxTwitter. */
async function ownPost(sp: Speaker, keys: string[], reportAt: number): Promise<Hit | null> {
  if (!sp.x) return null;
  try {
    const res = await fetch(`https://api.fxtwitter.com/2/profile/${sp.x}/statuses`, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)" } });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const list = ((await res.json()) as { results?: FxStatus[] })?.results ?? [];
    const own = sp.x.toLowerCase();
    const posts = list
      .filter((s) => !s.reposted_by && String(s.author?.screen_name ?? own).toLowerCase() === own)
      .map((s) => ({ s, at: Number(s.created_timestamp) * 1000, text: String(s.raw_text?.text ?? s.text ?? "") }))
      .filter((p) => p.at >= reportAt - 48 * 3600_000 && p.at <= reportAt + 3600_000 && shared(p.text, keys) >= 2)
      .sort((a, b) => shared(b.text, keys) - shared(a.text, keys) || a.at - b.at);
    const best = posts[0];
    if (!best) return null;
    return { url: best.s.url || `https://x.com/${sp.x}/status/${best.s.id}`, source: sp.name, title: best.text.slice(0, 140) };
  } catch {
    return null;
  }
}

/**
 * Where a leader's words were first published: his own post, his office, his
 * country's press in his language, any outlet in his language, then in
 * English. Among the matches, the earliest: the first report of an interview
 * is nearest to it.
 */
export async function searchSpeaker(sp: Speaker, keys: string[], trKeys: string[], reportAt: number, isIsraeli: (outlet: string) => boolean): Promise<Hit | null> {
  const all = [...new Set([...trKeys, ...keys])];
  const post = await ownPost(sp, all, reportAt);
  if (post) return post;
  const name = surname(sp);
  const k3 = (ks: string[]) => ks.filter((k) => !new RegExp(`^${name}$`, "i").test(k)).slice(0, 3).join(" ");
  const press = [...(SPEAKER_PRESS[sp.country] ?? []), ...WIRE_SITES];
  const or = (sites: string[]) => sites.map((s) => `site:${s}`).join(" OR ");
  const tries: { q: string; ed: Edition; ks: string[] }[] = [];
  const own = trKeys.length ? trKeys : keys;
  if (sp.official) tries.push({ q: `site:${sp.official} ${k3(own)} when:3d`, ed: sp.edition, ks: own });
  tries.push({ q: `(${or(press.slice(0, 12))}) ${name} ${k3(own)} when:2d`, ed: sp.edition, ks: own });
  tries.push({ q: `${name} ${k3(own)} when:2d`, ed: sp.edition, ks: own });
  if (trKeys.length) tries.push({ q: `${name} ${k3(keys)} when:2d`, ed: "en", ks: keys });
  for (const t of tries) {
    const items = await searchGoogleNews(t.q, t.ed);
    const fit = items
      .filter((i: GnewsItem) => new RegExp(name, "i").test(i.title) || (!!sp.official && i.site.includes(sp.official)))
      .filter((i) => shared(i.title, t.ks) >= 2 && !isIsraeli(i.outlet))
      .filter((i) => i.at >= reportAt - 48 * 3600_000 && i.at <= reportAt + 2 * 3600_000)
      .sort((a, b) => a.at - b.at);
    for (const hit of fit.slice(0, 2)) {
      const url = await resolveGoogleNews(hit.link);
      if (url) return { url, source: hit.outlet || sp.name, title: hit.title };
    }
  }
  return null;
}

/** The speaker a Cited stands for, when it is one. */
export function speakerNamed(name: string): Speaker | null {
  return SPEAKERS.find((s) => s.name === name) ?? null;
}

/**
 * The outlet's own recent articles, closest first: those it published in the
 * two days before the relay that share the most of the story's names.
 */
export function ownCandidates(listing: Listed[], keys: string[], reportAt: number, n = 4): Listed[] {
  // The address carries words the headline leaves out ("…/trump-saudi-houthis-war-oil-gas-prices").
  const slug = (u: string) => {
    try {
      return new URL(u).pathname.replace(/[-_/]+/g, " ");
    } catch {
      return "";
    }
  };
  const names = keys.filter((k) => /^[A-Z]/.test(k));
  const words = keys.filter((k) => !/^[A-Z]/.test(k));
  return listing
    .filter((l) => l.at <= reportAt + 3600_000 && l.at >= reportAt - 48 * 3600_000)
    .map((l) => {
      const t = `${l.title} ${l.desc} ${slug(l.url)}`;
      // A name shared counts twice a word: "Houthis" places a story, "talks" does not.
      return { l, s: 2 * shared(t, names) + shared(t, words) };
    })
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s || b.l.at - a.l.at)
    .slice(0, n)
    .map((x) => x.l);
}

/**
 * Which of the outlet's articles carries the relay's claim: one model call
 * over the candidates' text. -1 when none, or when no model answers.
 */
export async function whichCarries(claim: string, texts: string[]): Promise<number> {
  if (!texts.length) return -1;
  const got = await askChain(
    "origin-match",
    `A news channel relayed a claim from an outlet. Below are that outlet's recent articles. Which one reports the claim (the same facts, not just the same topic)? Return ONLY JSON {"article": <number>} or {"article": 0} if none does.`,
    [`CLAIM: ${claim}`, ...texts.map((t, i) => `ARTICLE ${i + 1}:\n${t.slice(0, 3500)}`)].join("\n\n"),
    { temperature: 0, models: TRIAGE_MODELS.slice(0, 2), timeoutMs: 20_000 },
  );
  const n = Number(got?.json.article);
  return Number.isInteger(n) && n >= 1 && n <= texts.length ? n - 1 : -1;
}

/* ------------------------------------------------------------------ *
 * Learned sources: an original found where the desk does not read
 * ------------------------------------------------------------------ */

export const LEARNED_KEY = "learned-sources";
export type Learned = { site: string; name: string; kind: "site" | "x"; lang: string; country?: string; learnedAt: number; from: string };

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

/** Record the outlet (or X account) an original was found at, once, unless the desk reads it already. */
export function learnSource(learned: Learned[], hit: Hit, known: (host: string) => boolean, meta: { lang: string; country?: string; from: string }, now = Date.now()): boolean {
  const host = hostOf(hit.url);
  if (!host || /\.il$/.test(host) || /news\.google\.com$/.test(host)) return false;
  const x = /(?:^|\.)(?:x|twitter)\.com$/.test(host) ? /^\/([^/]+)\//.exec(new URL(hit.url).pathname)?.[1] : undefined;
  const site = x ? x.toLowerCase() : host;
  if (known(x ? `x:${site}` : host) || learned.some((l) => l.site === site)) return false;
  learned.push({ site, name: hit.source, kind: x ? "x" : "site", lang: meta.lang, country: meta.country, learnedAt: now, from: meta.from });
  return true;
}

export async function loadLearned(store: DeskStore): Promise<Learned[]> {
  return (await store.getJson<Learned[]>(LEARNED_KEY)) ?? [];
}
