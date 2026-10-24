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
import { fetchListing, parseHtmlListing, parseListing, urlKey } from "./desk/sitemap.ts";
import { cleanUrl, isGnews } from "./desk/gnews.ts";
import type { getStore } from "./desk/store.ts";
import { IRAN_INBOX, type RawHit, articleOf, feedById, listedHit } from "./yemen-scan.server.ts";
import { openArticle } from "./iran-scan.server.ts";
import { toGaza } from "./gaza-scan.server.ts";

type Store = Awaited<ReturnType<typeof getStore>>;

/** The sites, by their listing in yemen-scan's RSS list. */
export const SWEEP_FEEDS = [
  "erem", "aawsat", "aawsat-en", "akhbar", "akhbar-en-home", "aljoumhouria", "addiyar", "nidaalwatan", "alaraby", "newarab",
  "thenational", "alhurra", "alhurra-en", "arabnews", "aljazeera-ar", "aljazeera-en", "alarabiya-ar", "alarabiya-en",
  "almodon", "elnashra", "albinaa", "skyar", "indyar", "alquds-arabi", "almashhad",
];
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
  const todo: { hit: RawHit; desks: string[]; site: SweepSite; cf: boolean }[] = [];
  await Promise.allSettled(
    SWEEP_FEEDS.map(async (id) => {
      const feed = feedById(id);
      if (!feed) return;
      const site: SweepSite = { id, name: feed.name, listed: 0, fresh: 0, relevant: 0, opened: 0, ok: false };
      sites.push(site);
      const body = await fetchListing(feed.url, feed.ua);
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
        todo.push({ hit: { ...hit, lean: SHARED_RSS[feed.name] ?? "intl" }, desks, site, cf: isGnews(hit.url) || /news\.google\.com/.test(feed.url) });
      }
    }),
  );

  // The newest first; each opened whole.
  todo.sort((a, b) => (Date.parse(b.hit.at) || 0) - (Date.parse(a.hit.at) || 0));
  const work = todo.slice(0, OPENS_MAX);
  for (let i = 0; i < work.length; i += AT_ONCE) {
    await Promise.allSettled(
      work.slice(i, i + AT_ONCE).map(async (w) => {
        const h = w.hit;
        if (isGnews(h.url)) {
          const real = await articleOf(h);
          if (!real) return;
          h.url = cleanUrl(real);
        }
        const title = h.title || h.text.split("\n")[0];
        const text = await openArticle(h.url, title, h.source, !w.cf);
        if (text.length >= 300) {
          h.text = `${title}\n${text}`.slice(0, 8600);
          w.site.opened += 1;
        }
      }),
    );
  }
  const ready = work.filter((w) => !isGnews(w.hit.url));
  const iran = ready.filter((w) => w.desks.includes("iran")).map((w) => w.hit);
  if (iran.length) await store.putMany(IRAN_INBOX, { [`sweep-${now}`]: { hits: iran } });
  const gaza = ready.filter((w) => w.desks.includes("gaza")).map((w) => w.hit);
  if (gaza.length) await toGaza(store, gaza, "sweep");

  st.sites = sites.sort((a, b) => a.name.localeCompare(b.name));
  st.finds = ready.map((w) => ({ site: w.hit.source, title: w.hit.title ?? "", url: w.hit.url, at: w.hit.at, desks: w.desks, chars: w.hit.text.length }));
  await store.putJson(SWEEP_KEY, st);
  const opened = sites.reduce((s, x) => s + x.opened, 0);
  console.log(`[sweep] ${sites.filter((s) => s.ok).length}/${sites.length} sites listed, ${todo.length} articles for the desks, ${opened} read whole, ${iran.length} to Iran, ${gaza.length} to Gaza; not listed: ${sites.filter((s) => !s.ok).map((s) => s.name).join(", ") || "none"}`);
  return st;
}
