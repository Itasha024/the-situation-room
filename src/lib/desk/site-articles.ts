/**
 * The big Arab sites' and the wires' own articles, against the posts that got
 * there first (18 Oct measure: Al Jazeera's "who is Akhlaghi", two Asharq
 * Al-Awsat pieces and Arab News on the new defence minister were all folded
 * into a Fars Telegram card and shown nowhere, not even under "Also"; at least
 * ten such articles were lost in twelve hours).
 *
 * - A site article with its own information (an exclusive, its own sources,
 *   words said to it), or a wire's own story with more in it, takes the lead
 *   from a channel's post or a relay on the same event.
 * - Otherwise it is always listed under "Also": by its link, not its name
 *   (the outlet's channel already being there, or leading, does not hide its
 *   article), on an exclusive's or an original's card too, and past the cap.
 */
import { OWN_ONLY, isExclusive, ownArticleSourcing, ownInformation } from "./exclusive.ts";
import { isOfficialBody } from "./numbers.ts";
import { arenaSourceRule, gazaLeadBonus, gazaSourceRule } from "./gaza-sourcing.ts";

/** Spokesmen whose own channel is the original of their words (yemen-scan OWN_CHANNELS). */
const SPOKESMEN = new Set(["Yahya Saree", "Mohammed Abdulsalam"]);

/** The sites by host, and the wires. */
export const SITE_HOSTS: Record<string, string> = {
  "aljazeera.net": "Al Jazeera",
  "aljazeera.com": "Al Jazeera",
  "alarabiya.net": "Al Arabiya",
  "english.alarabiya.net": "Al Arabiya",
  "aawsat.com": "Asharq Al-Awsat",
  "english.aawsat.com": "Asharq Al-Awsat",
  "aawsat.news": "Asharq Al-Awsat",
  "eremnews.com": "Erem News",
  "al-akhbar.com": "Al-Akhbar",
  "en.al-akhbar.com": "Al-Akhbar",
  "alaraby.co.uk": "Al-Araby Al-Jadeed",
  "newarab.com": "Al-Araby Al-Jadeed",
  "alhurra.com": "Alhurra",
  "arabnews.com": "Arab News",
  "almodon.com": "Al-Modon",
  "nidaalwatan.com": "Nidaa al-Watan",
  "addiyar.com": "Ad-Diyar",
  "lebanondebate.com": "Lebanon Debate",
  "elnashra.com": "Elnashra",
  "aljoumhouria.com": "Al-Joumhouria",
  "al-binaa.com": "Al-Binaa",
  "alquds.co.uk": "Al-Quds Al-Arabi",
  "aljarida.com": "Al-Jarida",
  "asharq.com": "Asharq News",
  "reuters.com": "Reuters",
  "reut.rs": "Reuters",
  "apnews.com": "AP",
  "afp.com": "AFP",
  "bloomberg.com": "Bloomberg",
};
const WIRES = new Set(["Reuters", "AP", "AFP", "Bloomberg"]);
const SITE_NAMES = new Set(Object.values(SITE_HOSTS));

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** A channel's or account's post, not an article on a site. */
export function isPost(url: string): boolean {
  return /^(?:t\.me|telegram\.me|x\.com|twitter\.com|mobile\.twitter\.com|youtube\.com|m\.youtube\.com|facebook\.com|instagram\.com)$/.test(hostOf(url));
}

/**
 * The outlet whose site this article is on, or "" for a post or another
 * site. Al Arabiya, Erem and the Lebanese papers are read through Google
 * News's listing, so a Google link counts under one of their names.
 */
export function siteOutlet(r: { url?: string | null; source?: string | null }): string {
  const url = String(r.url ?? "");
  if (!url || isPost(url)) return "";
  const h = hostOf(url);
  for (let d = h; d.includes("."); d = d.slice(d.indexOf(".") + 1)) if (SITE_HOSTS[d]) return SITE_HOSTS[d];
  if (h === "news.google.com" && SITE_NAMES.has(String(r.source ?? ""))) return String(r.source);
  return "";
}

type Row = {
  url: string;
  source: string;
  summary: string;
  text?: string | null;
  citing?: string | null;
  flags?: string[];
  tags?: string[];
  type?: string | null;
  desks?: string[];
};

const exclusiveRow = (r: Row) => !!r.flags?.includes("exclusive") || !!r.tags?.includes("exclusive");
const words = (s: string) => new Set(String(s || "").toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]{3,}/gu) ?? []);
const figuresOf = (s: string) => new Set(String(s || "").match(/\d[\d,.]*/g) ?? []);

/** A wire's story says more than the post: a figure it lacks, or a body twice as full. */
function saysMore(home: Row, r: Row): boolean {
  const h = `${home.summary} ${home.text ?? ""}`;
  const have = figuresOf(h);
  if ([...figuresOf(`${r.summary} ${r.text ?? ""}`)].some((n) => !have.has(n))) return true;
  return words(`${r.summary} ${r.text ?? ""}`).size >= 2 * Math.max(8, words(h).size);
}

/**
 * Does the site article `r` take the lead of the card `home`? Only from a
 * post or a relay, never from another site's article, and never from a card
 * written from its original source or an exclusive (unless `r` is one).
 */
export function siteTakesLead(home: Row, r: Row): boolean {
  const outlet = siteOutlet(r);
  if (!outlet || siteOutlet(home)) return false;
  if (sideRefusesLead(home, r)) return false;
  if (!isPost(home.url) && !home.citing) return false;
  // An official body's or a spokesman's own post is the original of its words.
  if (isOfficialBody(home.source) || SPOKESMEN.has(home.source)) return false;
  // The article relays what the card's own source said: the card stays its.
  if (r.citing && home.source && r.citing === home.source) return false;
  // A relay citing this very outlet: its original arriving, which takes the card with no "Also" (yemen-scan theOriginal).
  if (home.citing && outlet.toLowerCase().includes(String(home.citing).toLowerCase().replace(/^the /, ""))) return false;
  const text = `${r.summary}\n${r.text ?? ""}`;
  const excl = exclusiveRow(r) || isExclusive(text, r.source);
  if (exclusiveRow(home) && !excl) return false;
  if (home.tags?.includes("original") && !excl) return false;
  if (excl) return true;
  if (WIRES.has(outlet)) return !r.citing && saysMore(home, r);
  return ownInformation(text, outlet) || (OWN_ONLY.has(outlet) && ownArticleSourcing(text));
}

/**
 * The side rules on a card changing hands (user, 24 Oct): a later account that could not lead the card by
 * them never takes it over, and on the Gaza desk the side's own source keeps the lead over another outlet's
 * (gaza-sourcing.ts). An exclusive leads whoever tells it.
 */
export function sideRefusesLead(home: Row, r: Row): boolean {
  if (exclusiveRow(r) || isExclusive(`${r.summary}\n${r.text ?? ""}`, r.source)) return false;
  const desks = r.desks ?? home.desks ?? [];
  const gaza = desks.includes("gaza");
  const told = { headline: String(r.summary || home.summary || ""), type: String(r.type ?? home.type ?? ""), source: String(r.source || "") };
  if (!desks.includes("yemen") && arenaSourceRule(told)) return true;
  if (!gaza) return false;
  if (gazaSourceRule(told)) return true;
  return gazaLeadBonus({ ...r, type: told.type }) < gazaLeadBonus({ ...home, type: String(home.type ?? "") });
}

/** A site article carrying its outlet's own information, whatever it is grouped with: it outranks posts for the lead. */
export function siteOwnNews(r: Row): boolean {
  const outlet = siteOutlet(r);
  if (!outlet) return false;
  const text = `${r.summary}\n${r.text ?? ""}`;
  if (exclusiveRow(r) || isExclusive(text, r.source)) return true;
  return !WIRES.has(outlet) && (ownInformation(text, outlet) || (OWN_ONLY.has(outlet) && ownArticleSourcing(text)));
}

/** Words of four letters or more in `s`. */
const contentWords = (s: string) => [...words(s)];

/**
 * A site article with its own information that is mostly news the card does not carry stays a card of
 * its own, never a line under another outlet's card (user, 23 Oct: Nidaa al-Watan's seven explosives
 * trucks went under LBCI's cabinet card, and no one saw them). A retelling with its own correspondent
 * still joins the card, and takes its lead as before.
 */
export function ownNewsApart(home: Row & { alsoReportedBy?: Also[] }, r: Row): boolean {
  if (!siteOwnNews(r) || siteOutlet(home) === siteOutlet(r)) return false;
  // Its headline, the news it leads with, against all the card says.
  const have = words([home.summary, home.text ?? "", ...(home.alsoReportedBy ?? []).map((a) => a.summary ?? "")].join(" "));
  const mine = contentWords(r.summary);
  if (mine.length < 5) return false;
  return mine.filter((w) => !have.has(w)).length / mine.length >= 0.6;
}

type Also = { source: string; url: string; summary?: string };
/** The most "Also" entries that are posts; site articles are never cut. */
export const ALSO_CAP = 8;

/**
 * `adds` joined to a card's "Also". Posts and other outlets once per name;
 * site articles once per link, even under the lead's own name (Al Jazeera's
 * article under Al Jazeera's channel post). Site articles first, never cut.
 */
export function mergeAlso(list: Also[] | undefined, adds: Also[], lead: { source: string; url: string }, cap = ALSO_CAP): Also[] | undefined {
  const all = [...(list ?? []), ...adds];
  const names = new Set([lead.source]);
  const urls = new Set([lead.url]);
  const sites: Also[] = [];
  const rest: Also[] = [];
  for (const a of all) {
    if (!a?.url || urls.has(a.url)) continue;
    if (siteOutlet(a)) {
      urls.add(a.url);
      sites.push(a);
    } else if (!names.has(a.source)) {
      names.add(a.source);
      urls.add(a.url);
      rest.push(a);
    }
  }
  // A post whose outlet's article is listed adds nothing beside it.
  const out = [...sites, ...rest.filter((a) => !sites.some((s) => s.source === a.source)).slice(0, cap)];
  return out.length ? out : undefined;
}

/** Only the site articles of a card's "Also": what an exclusive's or an original's card keeps. */
export function siteAlsoOnly(list: Also[] | undefined): Also[] | undefined {
  const out = (list ?? []).filter((a) => siteOutlet(a));
  return out.length ? out : undefined;
}

/**
 * The site article takes the card: its headline, text and link lead, and the
 * post it replaces goes first under "Also", the other entries kept.
 */
export function leadFromSite<T extends Row & { alsoReportedBy?: Also[]; [k: string]: unknown }>(home: T, r: Row & { [k: string]: unknown }): T {
  const was = { source: home.source, url: home.url, summary: home.summary };
  home.source = r.source;
  home.url = r.url;
  home.summary = r.summary;
  home.text = r.text ?? "";
  home.citing = r.citing ?? undefined;
  for (const k of ["tier", "lean", "media"]) if (k in r) (home as Record<string, unknown>)[k] = r[k];
  const excl = exclusiveRow(r) || isExclusive(`${r.summary}\n${r.text ?? ""}`, r.source);
  if (excl) home.flags = [...new Set([...(home.flags ?? []), "exclusive"])];
  const prior = [was, ...(home.alsoReportedBy ?? []), ...(((r.alsoReportedBy as Also[] | undefined) ?? []))];
  // An exclusive's card keeps only the sites under it (user, 8 Oct: the others only retell it).
  home.alsoReportedBy = excl ? siteAlsoOnly(mergeAlso(undefined, prior, home)) : mergeAlso(undefined, prior, home);
  home.tags = [...new Set([...(home.tags ?? []), "lead-swap", "site-lead"])];
  return home;
}
