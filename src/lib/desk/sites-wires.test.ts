/**
 * Sites and wires, from fetch to report (18 Oct audit: the desks carried few
 * of their articles and exclusives). Real articles, as their sites and Google
 * News listed them, go through the desk's own steps: the listing the scan
 * reads, the article it opens, the gate before the reader, and the address
 * the card links. Each must reach the reader under its own outlet and its
 * article's own link — or, for a site that gives only its own news, stay out
 * when it has none.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { extractLead, feedById, fetchText, keepHeld, listedHit, parseRss, withLeads, yemenCandidates, articleOf, fetchRank, type RawHit } from "../yemen-scan.server.ts";
import { fetchListing, parseListing } from "./sitemap.ts";
import { isExclusive, ownInformation } from "./exclusive.ts";
import { RESOLVE_LIMIT, canResolve, cleanUrl, knownResolve, resetResolver, resolveGoogleNews, resolvesLeft } from "./gnews.ts";
import { bingResolve, headlineOverlap, parseBingRss, pickBing, resetBing } from "./bing.ts";
import { relinkStoredCards, relinkedSource, RELINK_KEY } from "./relink.ts";
import { TRIAGE_BATCH, triage } from "./triage.ts";
import type { DeskStore } from "./store.ts";
import * as FX from "./sites-wires-fixtures.ts";

/** Al Jazeera's "Saudi support: how far can Egypt's military go?" (18 Oct), as its feed links it, without the feed's tag. */
const AJ_EGYPT = (parseListing(FX.ALJAZEERA_FEED).find((i) => /المصري/.test(i.title))?.url ?? "").split("?")[0];
const REUTERS_FII = "https://www.reuters.com/world/middle-east/saudi-arabia-plans-hybrid-format-marquee-fii-conference-after-attacks-sources-2026-10-13/";

/** The web as the scan meets it: each address answers with its fixture; anything else is refused. */
function withWeb<T>(pages: Record<string, string | ((init?: RequestInit) => Response)>, run: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const u = String(input instanceof Request ? input.url : input);
    const key = Object.keys(pages).find((k) => u === k || u.startsWith(k));
    const page = key === undefined ? undefined : pages[key];
    if (typeof page === "function") return page(init);
    return page === undefined ? new Response("no", { status: 403 }) : new Response(page, { status: 200 });
  }) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = real;
  });
}

/** One site's listing read and each article opened, as fetchYemenSources does for a picked item. */
async function readSite(feedId: string, listingUrl: string, pages: Record<string, string>): Promise<RawHit[]> {
  const feed = feedById(feedId);
  assert.ok(feed, `feed ${feedId} is read`);
  return withWeb({ [listingUrl]: pages[listingUrl], ...pages }, async () => {
    const body = await fetchListing(feed.url, feed.ua);
    assert.ok(body, `${feedId} listing opens`);
    const hits = parseListing(body).map((it) => listedHit(it, feed)).filter((h): h is RawHit => !!h);
    for (const h of hits) {
      const html = await fetchText(h.url);
      if (html) h.text = `${h.text}\n${extractLead(html)}`;
      h.picked = true;
    }
    return hits;
  });
}

test("Asharq Al-Awsat: its own feed is read; a piece on its own sources reaches the reader under its own name and link", async () => {
  const feed = feedById("aawsat");
  assert.equal(feed?.url, "https://aawsat.com/feed");
  const hits = await readSite("aawsat", "https://aawsat.com/feed", {
    "https://aawsat.com/feed": FX.AAWSAT_FEED,
    "https://aawsat.com/node/5330309": FX.AAWSAT_TRIBES,
    "https://aawsat.com/node/5330407": FX.AAWSAT_ADEN,
  });
  assert.equal(hits.length, 2);
  const { candidates } = yemenCandidates(hits, []);
  const tribes = candidates.find((c) => c.url === "https://aawsat.com/node/5330309");
  assert.ok(tribes, "the Sanaa tribes piece (local sources told Asharq Al-Awsat) goes to the reader");
  assert.equal(tribes.source, "Asharq Al-Awsat");
  assert.match(tribes.text, /مصادر محلية وقبلية لـ«الشرق الأوسط»/);
  // The Aden airport piece relays the security office's statement: nothing of
  // its own, so it stays out. The page's next story (Lahj, "told Asharq
  // Al-Awsat") is not this article's and no longer lends it its sources.
  const aden = hits.find((h) => h.url === "https://aawsat.com/node/5330407");
  assert.ok(aden && !/وأفادت مصادر حكومية يمنية/.test(aden.text), "the next story is not read as this article");
  assert.ok(!candidates.some((c) => c.url === "https://aawsat.com/node/5330407"));
});

test("Al Jazeera: its website is read; words said to it reach the reader, a minister's statement it relays does not", async () => {
  const feed = feedById("aljazeera-ar");
  assert.ok(feed);
  const egyptPage = Object.fromEntries([[AJ_EGYPT, FX.ALJAZEERA_EGYPT]]);
  const hits = await readSite("aljazeera-ar", feed.url, {
    [feed.url]: FX.ALJAZEERA_FEED,
    ...egyptPage,
    "https://www.aljazeera.net/news/2026/10/17/": FX.ALJAZEERA_MINISTER,
  });
  assert.equal(hits.length, 2);
  // The link the card carries is the article's, its feed tag dropped.
  for (const h of hits) assert.doesNotMatch(h.url, /traffic_source/);
  const egypt = hits.find((h) => h.url.startsWith(AJ_EGYPT));
  assert.ok(egypt);
  assert.doesNotMatch(egypt.text, /Navigation menu/, "the menu is not read as a paragraph");
  const { candidates } = yemenCandidates(hits, []);
  const c = candidates.find((x) => x.url.startsWith(AJ_EGYPT));
  assert.ok(c, "the piece with an expert speaking to Al Jazeera Net goes to the reader");
  assert.equal(c.source, "Al Jazeera");
  assert.ok(!candidates.some((x) => x.url.includes("/2026/10/17/")), "the Yemeni minister's statement comes from her own post, not Al Jazeera");
});

test("Reuters: a story from its sitemap reaches the reader under Reuters and its own link", async () => {
  const feed = feedById("reuters");
  assert.ok(feed);
  const url = "https://www.reuters.com/world/middle-east/missiles-hit-aden-airport-saudi-led-coalition-intercepts-missile-headed-yanbu-2026-10-16/";
  const hits = await readSite("reuters", feed.url, { [feed.url]: FX.REUTERS_SITEMAP });
  assert.equal(hits.length, 1);
  const { pre, candidates } = yemenCandidates(hits, []);
  const c = candidates.find((x) => x.url === url);
  assert.ok(c);
  assert.equal(c.source, "Reuters");
  const composed = pre.get(url);
  if (composed?.report) {
    assert.equal(composed.report.source, "Reuters");
    assert.equal(composed.report.url, url);
  }
});

test("Al Arabiya: its site through Google News; an exclusive interview passes the own-news gate under Al Arabiya", async () => {
  const feed = feedById("alarabiya-ar");
  assert.ok(feed && /site%3Aalarabiya\.net/.test(feed.url));
  const [it] = parseListing(FX.ALARABIYA_GNEWS);
  assert.equal(it.site, "https://www.alarabiya.net");
  const hit = listedHit(it, feed);
  assert.ok(hit);
  assert.equal(hit.source, "Al Arabiya");
  assert.equal(hit.site, "alarabiya.net");
  assert.equal(hit.title, "مقابلة خاصة | ماجد الأنصاري: أمن الخليج ليس محل تفاوض.. ودولنا قادرة على الدفاع عن نفسها");
  assert.ok(isExclusive(hit.text, hit.source), "مقابلة خاصة is an exclusive interview");
  assert.ok(ownInformation(hit.text, hit.source));
  assert.ok(!isExclusive("عقد الوزيران لقاء خاصا لبحث التصعيد", "Al Arabiya"), "a private meeting is not an exclusive");
  const { candidates } = yemenCandidates([{ ...hit, picked: true }], []);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].source, "Al Arabiya");
  // Opened before what triage merely picked.
  assert.ok(fetchRank(hit, true) > fetchRank({ picked: true, source: "Yemenat" }, false));
});

test("A Reuters exclusive listed by Google: Google refusing, Bing News gives the article on reuters.com", async () => {
  resetResolver();
  resetBing();
  const [it] = parseListing(FX.REUTERS_GNEWS);
  const hit = listedHit(it, { id: "us-talk", url: "", name: "US media", cadence: { everyMin: 30 } });
  assert.ok(hit);
  assert.equal(hit.source, "Reuters");
  assert.equal(hit.site, "reuters.com");
  assert.ok(isExclusive(hit.text, hit.source));
  const url = await withWeb(
    {
      // Google's robot check, as the server met it on 18 Oct.
      "https://news.google.com/articles/": () => new Response("sorry", { status: 429 }),
      "https://www.bing.com/news/search": FX.BING_FII,
    },
    () => articleOf(hit),
  );
  assert.equal(url, REUTERS_FII);
  assert.equal(canResolve("lead"), false, "Google rests after its 429");
  // The Iran desk's own Google searches name the site too, so Bing can look there.
  const [viaIran] = parseRss(FX.REUTERS_GNEWS, "Google News");
  assert.equal(viaIran.source, "Reuters");
  assert.equal(viaIran.site, "reuters.com");
  resetResolver();
});

test("Google's links: one shared budget, the most needed first, each link looked up once", async () => {
  resetResolver();
  const link = "https://news.google.com/rss/articles/CBMiTEST?oc=5";
  let calls = 0;
  const pages = {
    "https://news.google.com/articles/": () => {
      calls += 1;
      return new Response('<div data-n-a-sg="SIG" data-n-a-ts="1760000000"></div>', { status: 200 });
    },
    "https://news.google.com/_/DotsSplashUi/data/batchexecute": () =>
      new Response(`)]}'\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"${REUTERS_FII}\\",1]",null,null,null,"generic"]]`, { status: 200 }),
  };
  assert.equal(await withWeb(pages, () => resolveGoogleNews(link, "card")), REUTERS_FII);
  assert.equal(knownResolve(link), REUTERS_FII);
  assert.equal(await withWeb(pages, () => resolveGoogleNews(link, "backlog")), REUTERS_FII);
  assert.equal(calls, 1, "a link found once costs nothing again");
  assert.equal(resolvesLeft(), RESOLVE_LIMIT - 1);
  // Old cards leave the scan its share; the scan may spend to the last.
  for (let i = 0; i < RESOLVE_LIMIT - 15; i += 1) await withWeb(pages, () => resolveGoogleNews(`https://news.google.com/rss/articles/X${i}`, "lead"));
  assert.equal(canResolve("backlog"), false);
  assert.equal(canResolve("card"), true);
  assert.equal(canResolve("lead"), true);
  resetResolver();
});

test("Bing's answer: only the outlet's own article under the same headline", () => {
  const items = parseBingRss(FX.BING_FII);
  assert.ok(items.some((i) => i.url === REUTERS_FII));
  const title = "EXCLUSIVE: Saudi Arabia to let executives attend FII conference remotely after attacks, sources say";
  assert.equal(pickBing(items, title, "reuters.com"), REUTERS_FII);
  // The copy on another site under the very same headline is not Reuters'.
  assert.equal(pickBing(items, title, "thestandard.com.hk").includes("thestandard.com.hk"), true);
  assert.equal(pickBing(items, "Houthis fire missiles at Jazan", "reuters.com"), "");
  assert.ok(headlineOverlap("Missiles hit Aden airport", "missiles hit Aden airport, coalition says") >= 0.99);
});

test("Bing refusing: no search for an hour", async () => {
  resetBing();
  const got = await withWeb({ "https://www.bing.com/": () => new Response("<html>challenge</html>", { status: 200 }) }, () => bingResolve("Missiles hit Aden airport", "reuters.com"));
  assert.equal(got, "");
  const again = await withWeb({ "https://www.bing.com/": FX.BING_FII }, () => bingResolve("Saudi Arabia plans hybrid format for marquee FII conference after attacks", "reuters.com"));
  assert.equal(again, "", "resting after the challenge page");
  resetBing();
});

test("The Iran desk is handed the article the scan opened and the address it found", () => {
  const items: RawHit[] = [{ source: "Al Arabiya", url: "https://news.google.com/rss/articles/CBMiA", text: "مقابلة خاصة | ماجد الأنصاري", at: "", lean: "gulf", fromTg: false }];
  withLeads(items, { "https://news.google.com/rss/articles/CBMiA": { lead: "قال وزير الدولة القطري ماجد الأنصاري في مقابلة خاصة مع العربية إن أمن الخليج ليس محل تفاوض وإن دوله قادرة على الدفاع عن نفسها.", at: 0, real: "https://www.alarabiya.net/arab-and-world/gulf/2026/10/17/x?utm_source=g" } });
  assert.equal(items[0].url, "https://www.alarabiya.net/arab-and-world/gulf/2026/10/17/x");
  assert.match(items[0].text, /مقابلة خاصة مع العربية/);
  assert.equal(cleanUrl(`${AJ_EGYPT}?traffic_source=rss`), AJ_EGYPT);
});

/** A store of a few cards, as relink.ts sees it. */
function cardStore(rows: { fp: string; url: string; source: string; at: string }[]) {
  const json = new Map<string, unknown>();
  const moved: { fp: string; url: string; source: string }[] = [];
  const store = {
    gnewsLinks: async (limit: number, skip: string[] = []) => rows.filter((r) => r.url.startsWith("https://news.google.com/") && !skip.includes(r.fp)).slice(0, limit),
    relink: async (fp: string, url: string, source: string) => {
      if (rows.some((r) => r.url === url)) return false;
      const r = rows.find((x) => x.fp === fp);
      if (!r) return false;
      r.url = url;
      r.source = source;
      moved.push({ fp, url, source });
      return true;
    },
    getJson: async (k: string) => (json.get(k) ?? null) as never,
    putJson: async (k: string, v: unknown) => void json.set(k, v),
  } as unknown as DeskStore;
  return { store, moved, json };
}

test("Cards stored under Google's link take their article's own, the newest first, a few a tick", async () => {
  const now = Date.parse("2026-10-18T00:00:00Z");
  const rows = [
    { fp: "new", url: "https://news.google.com/rss/articles/NEW", source: "Google News", at: "2026-10-17T22:00:00Z" },
    { fp: "old", url: "https://news.google.com/rss/articles/OLD", source: "WSJ", at: "2026-10-01T10:00:00Z" },
    { fp: "dead", url: "https://news.google.com/rss/articles/DEAD", source: "AP", at: "2026-10-02T10:00:00Z" },
    { fp: "dup", url: "https://news.google.com/rss/articles/DUP", source: "AP", at: "2026-10-03T10:00:00Z" },
    { fp: "held", url: REUTERS_FII, source: "Reuters", at: "2026-10-13T10:00:00Z" },
  ];
  const { store, moved, json } = cardStore(rows);
  const needs: string[] = [];
  const answers: Record<string, string> = {
    "https://news.google.com/rss/articles/NEW": "https://www.reuters.com/world/middle-east/x-2026-10-17/",
    "https://news.google.com/rss/articles/OLD": "https://www.wsj.com/world/middle-east/y-1a2b3c",
    "https://news.google.com/rss/articles/DUP": REUTERS_FII,
  };
  const deps = { resolve: async (l: string, need: string) => (needs.push(need), answers[l] ?? ""), can: () => true, known: () => "" };
  assert.equal(await relinkStoredCards(store, now, deps as never, 3), 2);
  assert.deepEqual(needs, ["card", "backlog", "backlog"]);
  assert.deepEqual(moved[0], { fp: "new", url: "https://www.reuters.com/world/middle-east/x-2026-10-17/", source: "Reuters" });
  assert.equal(moved[1].source, "WSJ", "an outlet's own name is kept");
  // The dead link counts a try; the duplicate's address is another card's, and it is left as it is.
  assert.deepEqual(json.get(RELINK_KEY), { dead: 1 });
  await relinkStoredCards(store, now, deps as never, 3);
  await relinkStoredCards(store, now, deps as never, 3);
  assert.equal((json.get(RELINK_KEY) as Record<string, number>).dead, 3);
  assert.equal((json.get(RELINK_KEY) as Record<string, number>).dup, 3);
  // Google out of budget: nothing spent, nothing counted against the cards.
  needs.length = 0;
  rows.push({ fp: "late", url: "https://news.google.com/rss/articles/LATE", source: "AP", at: "2026-10-17T23:00:00Z" });
  assert.equal(await relinkStoredCards(store, now, { ...deps, can: () => false } as never, 3), 0);
  assert.deepEqual(needs, []);
  assert.equal(relinkedSource("Google News", "https://www.aljazeera.com/news/1"), "Al Jazeera");
  assert.equal(relinkedSource("Google News", "https://www.alarabiya.net/x/2026/10/17/y"), "Al Arabiya");
});

test("Triage: small enough calls for the free tiers, the keywords when no model answers", async () => {
  assert.ok(TRIAGE_BATCH <= 25);
  const items = Array.from({ length: 60 }, (_, i) => ({ id: String(i), title: i % 2 ? `Houthi missile hits Aden airport ${i}` : `Football results ${i}`, source: "X" }));
  const sizes: number[] = [];
  const { picked, judged } = await triage(items, (async (_tag: string, _sys: string, user: string) => {
    sizes.push(user.split("\n").length);
    return null;
  }) as never);
  assert.ok(sizes.every((n) => n <= TRIAGE_BATCH));
  assert.equal(judged.size, 0);
  assert.equal(picked.size, 30);
});

test("Google items wait for their article's address, a day at most, the newest first", () => {
  const now = Date.parse("2026-10-18T12:00:00+03:00");
  const item = (n: number, h: number): RawHit => ({ source: "AP", url: `https://news.google.com/rss/articles/${n}`, text: "t", at: new Date(now - h * 3600_000).toISOString(), lean: "", fromTg: false });
  const kept = keepHeld([item(1, 2), item(2, 30), item(1, 2), item(3, 1), { ...item(4, 1), url: "https://apnews.com/article/x" }], now);
  assert.deepEqual(kept.map((h) => h.url.slice(-1)), ["3", "1"]);
  assert.equal(keepHeld(Array.from({ length: 300 }, (_, i) => item(i, 1)), now).length, 120);
});
