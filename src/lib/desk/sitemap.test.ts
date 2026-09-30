import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { createServer } from "node:http";
import { fetchListing, parseListing, titleKey, urlKey } from "./sitemap.ts";
import { keywordPick, triage } from "./triage.ts";

test("a news sitemap lists every article with its title and date", () => {
  const xml = `<?xml version="1.0"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
<url><loc>https://www.reuters.com/world/middle-east/saudi-oil-detour-2026-09-24/</loc><news:news><news:publication><news:name>Reuters</news:name></news:publication><news:publication_date>2026-09-24T09:51:00Z</news:publication_date><news:title><![CDATA[Saudi oil takes a detour as Red Sea risk rises]]></news:title></news:news></url>
<url><loc>https://www.reuters.com/sports/x/</loc><news:news><news:publication_date>2026-09-24T09:00:00Z</news:publication_date><news:title>Arsenal win &amp; top the table</news:title></news:news></url>
</urlset>`;
  const l = parseListing(xml);
  assert.equal(l.length, 2);
  assert.equal(l[0].title, "Saudi oil takes a detour as Red Sea risk rises");
  assert.equal(l[0].at, Date.parse("2026-09-24T09:51:00Z"));
  assert.equal(l[1].title, "Arsenal win & top the table");
});

test("RSS and Atom listings are read too", () => {
  const rss = `<rss><channel><item><title>الحوثيون يهددون واشنطن</title><link>https://www.alaraby.co.uk/politics/x</link><description><![CDATA[<p>نص</p>]]></description><pubDate>Wed, 23 Sep 2026 12:38:00 GMT</pubDate></item></channel></rss>`;
  assert.deepEqual(parseListing(rss)[0], { url: "https://www.alaraby.co.uk/politics/x", title: "الحوثيون يهددون واشنطن", desc: "نص", at: Date.parse("2026-09-23T12:38:00Z") });
  const atom = `<feed><entry><title>Houthis fire at ship</title><link rel="alternate" href="https://example.com/a/1"/><updated>2026-09-24T08:00:00Z</updated><summary>More</summary></entry></feed>`;
  assert.equal(parseListing(atom)[0].url, "https://example.com/a/1");
});

test("a gzipped sitemap file is unpacked", async () => {
  const body = gzipSync(`<urlset><url><loc>https://www.nytimes.com/2026/09/24/world/middleeast/yemen.html</loc><news:news><news:title>Yemen talks</news:title></news:news></url></urlset>`);
  const server = createServer((_q, r) => r.end(body)).listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const xml = await fetchListing(`http://127.0.0.1:${port}/news.xml.gz`);
    assert.equal(parseListing(xml ?? "")[0].title, "Yemen talks");
  } finally {
    server.close();
  }
});

test("one article's keys: tracking and trailing slash do not matter", () => {
  assert.equal(urlKey("https://www.wsj.com/world/china-houthis-1a2b?mod=hp"), urlKey("https://wsj.com/world/china-houthis-1a2b/"));
  assert.equal(titleKey("Houthis Increasingly Supplied by China, WSJ"), titleKey("houthis increasingly supplied by china — WSJ"));
});

test("triage keeps what a model picks, and what only this war is called", async () => {
  const items = [
    { id: "0", title: "Saudi oil takes a detour as Red Sea risk rises", source: "Reuters" },
    { id: "1", title: "Arsenal top the table", source: "Reuters" },
    { id: "2", title: "Houthis fire at a tanker", source: "Reuters" },
  ];
  const ask = async () => ({ json: { ours: ["0"] }, model: "fake" });
  const r = await triage(items, ask as never);
  assert.deepEqual([...r.picked].sort(), ["0", "2"]);
  assert.equal(r.judged.size, 3);
});

test("with no model, keywords decide and nothing counts as judged", async () => {
  const items = [
    { id: "0", title: "Saudi air defences intercept a drone", source: "SPA" },
    { id: "1", title: "Arsenal top the table", source: "Reuters" },
  ];
  const r = await triage(items, (async () => null) as never);
  assert.deepEqual([...r.picked], ["0"]);
  assert.equal(r.judged.size, 0);
  assert.equal(keywordPick({ id: "x", title: "اليمن: قتلى في غارات على تعز", source: "Al-Araby" }), true);
});

test("an article page's own date is read from its meta or its date line", async () => {
  const { pageDate } = await import("./sitemap.ts");
  assert.equal(pageDate(`<meta property="article:published_time" content="2026-09-28T10:36:00+03:00">`), Date.parse("2026-09-28T07:36:00Z"));
  assert.equal(pageDate(`<script type="application/ld+json">{"datePublished":"2026-09-27T20:00:00Z"}</script>`), Date.parse("2026-09-27T20:00:00Z"));
  // Sheba prints it under the headline.
  assert.equal(pageDate(`<a href="x">News Agencies</a> |\n   2026-09-16 04:28 AM UTC`), Date.parse("2026-09-16T04:28:00Z"));
  assert.equal(pageDate(`2026-09-16 04:28 PM UTC`), Date.parse("2026-09-16T16:28:00Z"));
  assert.equal(pageDate(`2026-09-16 12:10 AM UTC`), Date.parse("2026-09-16T00:10:00Z"));
  assert.ok(Number.isNaN(pageDate(`<p>No date here</p>`)));
});
