/**
 * The Arab sites' sweep (user, 24 Oct: "erem news, asharq al-awsat, al-akhbar, al-joumhouria, ad-diyar, nidaa
 * al-watan, al-araby al-jadeed, the national, alhurra, arab news … scan all these sites automatically every 30
 * minutes"). Server-only.
 *
 * Every half hour each site's listing is read and every article of the last hours not swept before whose
 * headline is a desk's is opened and read whole: its own page, else MSN's copy or the reading service (the
 * sites behind Cloudflare, listed by Google News, their links resolved first). The whole article goes to the
 * Iran and Gaza desks' inboxes, where their readers make it a card or fold it into one. Before this, those
 * sites' articles reached the desks as Google's headline and often waited unread until they aged out.
 */
import { isIranDeskItem, passesLebaneseMediaGate } from "./desk/iran-reader.ts";
import { isGazaDeskItem } from "./desk/gaza-reader.ts";
import { LEBANESE_MEDIA, SHARED_RSS } from "./desk/iran-sources.ts";
import { type Listed, fetchListing, pageDate, parseHtmlListing, parseListing, urlKey } from "./desk/sitemap.ts";
import { cleanUrl, isGnews } from "./desk/gnews.ts";
import type { getStore } from "./desk/store.ts";
import { IRAN_INBOX, type RawHit, type YemenFetch, articleOf, feedById, fetchText, fxPage, listedHit } from "./yemen-scan.server.ts";
import { openArticle, toYemen } from "./iran-scan.server.ts";
import { unshorten } from "./desk/full-text.ts";
import { toGaza } from "./gaza-scan.server.ts";

type Store = Awaited<ReturnType<typeof getStore>>;

/** The sites, by their listing in yemen-scan's RSS list. */
export const SWEEP_FEEDS = [
  "erem", "aawsat", "aawsat-en", "akhbar", "akhbar-en-home", "aljoumhouria", "addiyar", "nidaalwatan", "alaraby", "newarab",
  "thenational", "alhurra", "alhurra-en", "arabnews", "aljazeera-ar", "aljazeera-en", "alarabiya-ar", "alarabiya-en",
  "almodon", "elnashra", "albinaa", "skyar", "indyar", "alquds-arabi", "almashhad", "wsj", "nyt",
];
/**
 * Sites closed to the server whose own X account links their articles (27 Oct: Erem answers every address with a
 * Cloudflare challenge, its Telegram channel is silent since May, and Google listed 5 of its articles in two hours):
 * listed from the account's posts, the short link followed to the article's address, no Google look-up spent.
 */
export const SWEEP_X: { handle: string; feed: string; host: RegExp }[] = [{ handle: "EremNews", feed: "erem", host: /(?:^|\.)(?:eremnews\.com|erem\.news)$/ }];
/** The Yemen desk's inbox (site-scan.server.ts; named here so the two modules do not import each other). */
const YEMEN_INBOX = "yemen-inbox";

type FxPost = { url?: string; text?: string; created_at?: string; raw_text?: { text?: string; facets?: { type?: string; replacement?: string; original?: string }[] } };
/** An outlet's X posts as listed articles: the first link on its own site (or its short host), the post as the headline. */
export function xListed(results: unknown[], host: RegExp): Listed[] {
  const out: Listed[] = [];
  for (const r of results as FxPost[]) {
    const at = Date.parse(r.created_at ?? "");
    const links = [...(r.raw_text?.facets ?? []).filter((x) => x.type === "url").map((x) => x.replacement ?? x.original ?? ""), ...(String(r.text ?? "").match(/https?:\/\/\S+/g) ?? [])];
    const link = links.find((u) => {
      try {
        return host.test(new URL(u).hostname.replace(/^www\./, ""));
      } catch {
        return false;
      }
    });
    const title = String(r.raw_text?.text ?? r.text ?? "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
    if (link && title.length >= 12 && Number.isFinite(at)) out.push({ url: link, title, desc: "", at });
  }
  return out;
}
export const SWEEP_KEY = "site-sweep";
const EVERY_MS = 30 * 60_000;
/** An article this old or newer is swept: a listing's last hours, so a site that posts late is still met. */
const BACK_MS = 6 * 3600_000;
const SWEPT_KEEP_MS = 2 * 24 * 3600_000;
/** Articles opened a sweep, and how many at once (the server is small). */
const OPENS_MAX = 60;
const AT_ONCE = 6;

export type SweepSite = { id: string; name: string; listed: number; fresh: number; relevant: number; opened: number; ok: boolean };
export type SweepFind = { site: string; title: string; url: string; at: string; desks: string[]; chars: number };
export type SweepState = { lastRun: number; swept: Record<string, number>; sites?: SweepSite[]; finds?: SweepFind[] };

/** Which desks an article's headline and teaser are for. */
export function desksFor(h: Pick<RawHit, "source" | "text" | "title">): string[] {
  const t = `${h.title ?? ""} ${h.text}`;
  const out: string[] = [];
  if (isIranDeskItem(t) || (LEBANESE_MEDIA.has(h.source) && passesLebaneseMediaGate(t))) out.push("iran");
  if (isGazaDeskItem(t)) out.push("gaza");
  // The Yemen war's articles too (27 Oct: Independent Arabia's "Yemeni forces … 382 Houthis" was swept past).
  if (toYemen([{ source: h.source, text: h.text, title: h.title, url: "", at: "", lean: "", fromTg: false }]).length) out.push("yemen");
  return out;
}

/** One sweep, when half an hour has passed since the last (or `force`). */
export async function runSiteSweep(store: Store, now = Date.now(), force = false): Promise<SweepState | null> {
  const st: SweepState = { lastRun: 0, swept: {}, ...((await store.getJson<SweepState>(SWEEP_KEY)) ?? {}) };
  if (!force && now - st.lastRun < EVERY_MS - 60_000) return null;
  st.lastRun = now;
  await store.putJson(SWEEP_KEY, st);
  for (const [k, t] of Object.entries(st.swept)) if (now - t > SWEPT_KEEP_MS) delete st.swept[k];

  const sites: SweepSite[] = [];
  const todo: { hit: RawHit; desks: string[]; site: SweepSite; cf: boolean; key: string; old?: boolean }[] = [];
  await Promise.allSettled(
    SWEEP_FEEDS.map(async (id) => {
      const feed = feedById(id);
      if (!feed) return;
      const site: SweepSite = { id, name: feed.name, listed: 0, fresh: 0, relevant: 0, opened: 0, ok: false };
      sites.push(site);
      // 25 s: Al-Araby's listing is 1.8 MB and The National's 0.7 MB; at 10 s they failed whenever the server was busy (27 Oct).
      const body = await fetchListing(feed.url, feed.ua, 25_000);
      const listed = body ? (feed.html ? parseHtmlListing(body, feed.url, feed.html) : parseListing(body)) : [];
      site.ok = listed.length > 0;
      site.listed = listed.length;
      for (const it of listed) {
        if (Number.isFinite(it.at) && now - it.at > BACK_MS) continue;
        const hit = listedHit(it, feed, now);
        if (!hit) continue;
        const key = urlKey(hit.url);
        if (st.swept[key]) continue;
        st.swept[key] = now;
        site.fresh += 1;
        const desks = desksFor(hit);
        if (!desks.length) continue;
        site.relevant += 1;
        todo.push({ hit: { ...hit, lean: SHARED_RSS[feed.name] ?? "intl" }, desks, site, cf: isGnews(hit.url) || /news\.google\.com/.test(feed.url), key });
      }
    }),
  );

  for (const x of SWEEP_X) {
    const feed = feedById(x.feed);
    const site = sites.find((y) => y.id === x.feed);
    if (!feed || !site) continue;
    const posts = xListed((await fxPage(x.handle).catch(() => null))?.results ?? [], x.host);
    site.listed += posts.length;
    site.ok ||= posts.length > 0;
    for (const it of posts) {
      if (now - it.at > BACK_MS) continue;
      const short = urlKey(it.url);
      if (st.swept[short]) continue;
      st.swept[short] = now;
      // Erem's short links (erem.news/…) answer with a plain redirect to the article.
      const real = /eremnews\.com\//.test(it.url) ? it.url : await unshorten(it.url).catch(() => "");
      if (!real || !/^https?:\/\//.test(real)) continue;
      const hit = listedHit({ ...it, url: real }, feed, now);
      if (!hit) continue;
      const key = urlKey(hit.url);
      if (st.swept[key]) continue;
      st.swept[key] = now;
      site.fresh += 1;
      const desks = desksFor(hit);
      if (!desks.length) continue;
      site.relevant += 1;
      todo.push({ hit: { ...hit, lean: SHARED_RSS[feed.name] ?? "intl" }, desks, site, cf: true, key });
    }
  }

  // The newest first; each opened whole.
  todo.sort((a, b) => (Date.parse(b.hit.at) || 0) - (Date.parse(a.hit.at) || 0));
  const work = todo.slice(0, OPENS_MAX);
  for (let i = 0; i < work.length; i += AT_ONCE) {
    await Promise.allSettled(
      work.slice(i, i + AT_ONCE).map(async (w) => {
        const h = w.hit;
        if (isGnews(h.url)) {
          const real = await articleOf(h, "key");
          if (!real) return;
          h.url = cleanUrl(real);
        }
        const title = h.title || h.text.split("\n")[0];
        // A front page lists old pieces beside new ones with no date (Al-Akhbar English, 24 Oct: the Kushner
        // piece of 9 Sep and the Katz convoy of 31 Mar were taken as new): the page's own date decides.
        if (h.undated && !w.cf) {
          const pub = pageDate((await fetchText(h.url, 8000)) ?? "");
          if (Number.isFinite(pub) && now - pub > BACK_MS) {
            w.old = true;
            return;
          }
          if (Number.isFinite(pub)) h.at = new Date(pub).toISOString();
        }
        const text = await openArticle(h.url, title, h.source, !w.cf);
        if (text.length >= 300) {
          h.text = `${title}\n${text}`.slice(0, 8600);
          w.site.opened += 1;
        }
      }),
    );
  }
  // An article whose address Google did not give this time (its look-ups spent), or past this sweep's share, is
  // swept again next time while it is in the window.
  for (const w of todo) if (isGnews(w.hit.url) || !work.includes(w)) delete st.swept[w.key];
  const ready = work.filter((w) => !isGnews(w.hit.url) && !w.old);
  const iran = ready.filter((w) => w.desks.includes("iran")).map((w) => w.hit);
  if (iran.length) await store.putMany(IRAN_INBOX, { [`sweep-${now}`]: { hits: iran } });
  const gaza = ready.filter((w) => w.desks.includes("gaza")).map((w) => w.hit);
  if (gaza.length) await toGaza(store, gaza, "sweep");
  const yemen = toYemen(ready.filter((w) => w.desks.includes("yemen")).map((w) => w.hit));
  if (yemen.length) await store.putMany(YEMEN_INBOX, { [`sweep-${now}`]: { at: now, hits: yemen, status: [], sourcesOk: 0, learnedIds: [], iranShared: [], extra: true } satisfies YemenFetch });

  st.sites = sites.sort((a, b) => a.name.localeCompare(b.name));
  st.finds = ready.map((w) => ({ site: w.hit.source, title: w.hit.title ?? "", url: w.hit.url, at: w.hit.at, desks: w.desks, chars: w.hit.text.length }));
  await store.putJson(SWEEP_KEY, st);
  const opened = sites.reduce((s, x) => s + x.opened, 0);
  console.log(`[sweep] ${sites.filter((s) => s.ok).length}/${sites.length} sites listed, ${todo.length} articles for the desks, ${opened} read whole, ${iran.length} to Iran, ${gaza.length} to Gaza, ${yemen.length} to Yemen; not listed: ${sites.filter((s) => !s.ok).map((s) => s.name).join(", ") || "none"}`);
  return st;
}
