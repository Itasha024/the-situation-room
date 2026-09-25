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

/** A country's own web domain: an outlet under it is that country's press. */
const COUNTRY_TLD: Record<string, string> = { FR: "fr", IT: "it", DE: "de", UK: "uk", IR: "ir", TR: "tr", RU: "ru", EG: "eg", OM: "om", QA: "qa", AE: "ae", PK: "pk", CN: "cn" };

/** Is this outlet where the speaker's own words are first reported: his office, his country's press, a wire? */
export function speakerOutlet(sp: Pick<Speaker, "country" | "official">, host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  const under = (site: string) => h === site || h.endsWith(`.${site}`);
  if (sp.official && under(sp.official)) return true;
  if ([...(SPEAKER_PRESS[sp.country] ?? []), ...WIRE_SITES].some(under)) return true;
  const tld = COUNTRY_TLD[sp.country];
  return !!tld && h.endsWith(`.${tld}`);
}

/**
 * Where a leader's words were first published: his own post, his office, his
 * country's press and the wires in his language, then in English; and an
 * outlet he gave the words to himself ("told CNN"), wherever it is from. Never
 * any outlet at all: an Italian magazine is not where Macron's interview is.
 * Among the matches, the earliest: the first report of an interview is
 * nearest to it.
 */
export async function searchSpeaker(sp: Speaker, keys: string[], trKeys: string[], reportAt: number, isIsraeli: (outlet: string) => boolean, spokeTo: string[] = []): Promise<Hit | null> {
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
  // The outlet he spoke to, first and by its name: the interview is there, and
  // his own press may only be relaying it. In English, then in his language.
  for (const to of spokeTo.slice(0, 2)) {
    tries.push({ q: `"${to}" ${name} ${k3(keys)} when:3d`, ed: "en", ks: keys });
    if (trKeys.length) tries.push({ q: `"${to}" ${name} ${k3(trKeys)} when:3d`, ed: sp.edition, ks: trKeys });
  }
  tries.push({ q: `(${or(press.slice(0, 12))}) ${name} ${k3(own)} when:2d`, ed: sp.edition, ks: own });
  // His language's edition at large, kept to his country's outlets.
  tries.push({ q: `${name} ${k3(own)} when:2d`, ed: sp.edition, ks: own });
  if (trKeys.length) tries.push({ q: `(${or(press.slice(0, 12))}) ${name} ${k3(keys)} when:2d`, ed: "en", ks: keys });
  const toldHere = (outlet: string) => spokeTo.some((to) => sameOutlet(outlet, to));
  for (const t of tries) {
    const items = await searchGoogleNews(t.q, t.ed);
    const fit = items
      .filter((i: GnewsItem) => new RegExp(name, "i").test(i.title) || (!!sp.official && i.site.includes(sp.official)))
      .filter((i) => shared(i.title, t.ks) >= 2 && !isIsraeli(i.outlet))
      .filter((i) => i.at >= reportAt - 48 * 3600_000 && i.at <= reportAt + 2 * 3600_000)
      .filter((i) => !i.site || speakerOutlet(sp, hostOfSite(i.site)) || toldHere(i.outlet))
      .sort((a, b) => a.at - b.at);
    for (const hit of fit.slice(0, 2)) {
      const url = await resolveGoogleNews(hit.link);
      if (url && (speakerOutlet(sp, hostOfSite(url)) || toldHere(hit.outlet))) return { url, source: hit.outlet || sp.name, title: hit.title };
    }
  }
  return null;
}

/** One outlet by two spellings of its name: "CNN" and "CNN International", "Le Monde" and "Le Monde.fr". */
export function sameOutlet(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\.(?:com|fr|de|it|co\.uk|net|org)\b/g, "").replace(/^(?:the|al-)\s*/, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const x = norm(a);
  const y = norm(b);
  if (x.length < 2 || y.length < 2) return false;
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

const hostOfSite = (u: string) => {
  try {
    return new URL(/^https?:/.test(u) ? u : `https://${u}`).hostname;
  } catch {
    return "";
  }
};

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
    // An undated item from a section page (Sheba) is on its page now: recent.
    .filter((l) => !Number.isFinite(l.at) || (l.at <= reportAt + 3600_000 && l.at >= reportAt - 48 * 3600_000))
    .map((l) => {
      const t = `${l.title} ${l.desc} ${slug(l.url)}`;
      // A name shared counts twice a word: "Houthis" places a story, "talks" does not.
      return { l, s: 2 * shared(t, names) + shared(t, words) };
    })
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s || (b.l.at || 0) - (a.l.at || 0))
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
export type Learned = { site: string; name: string; kind: "site" | "x"; lang: string; country?: string; learnedAt: number; from: string; via?: "own" | "press" };

/**
 * Israeli outlets, by address: never a source and never learned. A name check
 * alone let JFeed through as the "original" of a Houthi message to the EU.
 */
export const ISRAELI_HOST = /(?:^|\.)(?:[a-z0-9-]+\.il|jfeed\.com|jpost\.com|timesofisrael\.com|haaretz\.com|ynetnews\.com|i24news\.tv|israelnationalnews\.com|israelhayom\.com|jns\.org|allisrael\.com|debka\.com)$/i;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

/**
 * Record the outlet (or X account) an original was found at, once, unless the
 * desk reads it already. Only the cited outlet's own site, or a leader's own
 * country's press: an outlet that merely carried the words (Khabar for
 * UNICEF's figures, Fana for a Yemeni minister) is one more relay.
 */
export function learnSource(learned: Learned[], hit: Hit, known: (host: string) => boolean, meta: { lang: string; country?: string; from: string; site?: string; speaker?: boolean }, now = Date.now()): boolean {
  const host = hostOf(hit.url);
  if (!host || ISRAELI_HOST.test(host) || /news\.google\.com$/.test(host)) return false;
  const x = /(?:^|\.)(?:x|twitter)\.com$/.test(host) ? /^\/([^/]+)\//.exec(new URL(hit.url).pathname)?.[1] : undefined;
  const site = x ? x.toLowerCase() : host;
  if (known(x ? `x:${site}` : host) || learned.some((l) => l.site === site)) return false;
  const own = !!meta.site && (host === meta.site || host.endsWith(`.${meta.site}`));
  const press = !!meta.speaker && !!meta.country && fromItsCountry({ site, country: meta.country });
  if (!x && !own && !press) return false;
  const name = hit.source.replace(/[\s|:–—-]+$/, "").trim() || site;
  learned.push({ site, name, kind: x ? "x" : "site", lang: meta.lang, country: meta.country, learnedAt: now, from: meta.from, ...(x ? {} : { via: own ? ("own" as const) : ("press" as const) }) });
  return true;
}

export async function loadLearned(store: DeskStore): Promise<Learned[]> {
  // An outlet learned before the country rule (an Italian magazine for
  // Macron's words, an aggregator for Araghchi's) is not read; nor one learned
  // before the own-site rule with no country to check it by (Khabar, Fana,
  // JFeed, 25 Sep); nor ever an Israeli one.
  return ((await store.getJson<Learned[]>(LEARNED_KEY)) ?? []).filter(
    (l) => !ISRAELI_HOST.test(l.site) && (l.kind === "x" || (fromItsCountry(l) && (!!l.via || !!l.country))),
  );
}

/** A learned outlet belongs to the country whose words it carried: its press, its domain, or a wire. */
function fromItsCountry(l: { site: string; country?: string }): boolean {
  return !l.country || speakerOutlet({ country: l.country, official: undefined }, l.site);
}
