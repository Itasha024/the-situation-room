import { test } from "node:test";
import assert from "node:assert/strict";
import { findCitation, keywords, logRoute, overlap, type RouteLog } from "./origin.ts";

test("a relayed outlet is found, the carrier itself is not", () => {
  assert.equal(findCitation("نيويورك تايمز: ترامب تردد في ضرب اليمن بعد طلب سعودي", "Shajab News")?.name, "NYT");
  assert.equal(findCitation("رويترز عن مصادر: هجوم على ناقلة", "Al Jazeera")?.name, "Reuters");
  assert.equal(findCitation("Reuters reported an attack", "Reuters"), null);
});

test("the Saudi Defense Ministry is traced to SPA", () => {
  assert.equal(findCitation("قالت وزارة الدفاع السعودية إن الدفاعات اعترضت صاروخا", "Al Hadath")?.site, "spa.gov.sa");
});

test("'the Middle East' is not the newspaper", () => {
  assert.equal(findCitation("قال إن الوضع في الشرق الأوسط خطير", "Naya"), null);
});

test("a paraphrase is matched on shared names within the time window", () => {
  const keys = keywords("Trump: hesitated on Yemen strikes before Saudi requests", "en", "NYT");
  const at = Date.parse("2026-09-21T10:00:00Z");
  assert.ok(overlap("Trump Gets Caught in a Dilemma Over a Saudi Plea for Military Help", keys, at - 3600_000, at) >= 2);
  assert.equal(overlap("Trump Gets Caught in a Dilemma Over a Saudi Plea", keys, at - 5 * 86400_000, at), 0);
});

test("an original's text is read from its paragraphs, without page furniture", async () => {
  const { articleText } = await import("./origin.ts");
  const html = `<p>ListenSept 21 - US President Donald Trump spoke by phone with Yemeni President Rashad al-Alimi on Sunday, four people familiar with the matter said.</p>
    <p>Subscribe to our newsletter for the latest news and analysis every morning.</p>
    <p>Two of the sources said Trump had made no direct pledge of military support during the call. REUTERS</p><p>Short.</p>`;
  assert.equal(
    articleText(html),
    "Sept 21 - US President Donald Trump spoke by phone with Yemeni President Rashad al-Alimi on Sunday, four people familiar with the matter said.\nTwo of the sources said Trump had made no direct pledge of military support during the call.",
  );
});

test("the whole article is read, deep facts included, without related headlines", async () => {
  const { articleText } = await import("./origin.ts");
  const filler = "<p>" + "Officials in Washington weighed the request from Riyadh over several days of meetings. ".repeat(3) + "</p>";
  const html = `${filler.repeat(20)}<p>Trump Weighs Response as Houthi Missiles Hit Saudi Oil Sites and Markets React</p>
    <p>After the call with Prince Mohammed on Thursday, Mr. Trump changed his mind: target lists were approved and bombs were loaded.</p>`;
  const text = articleText(html);
  assert.ok(text.includes("target lists were approved"));
  assert.ok(!text.includes("Markets React"));
  assert.ok(text.length <= 8000);
});

test("a match days older than the post is refused", () => {
  const keys = keywords("Yemeni president asked US for government support against Houthis", "en", "Reuters");
  const at = Date.parse("2026-09-21T13:29:00Z");
  assert.equal(overlap("China presses Iran to help rein in Houthis after Saudi appeal", keys, Date.parse("2026-09-17T10:00:00Z"), at), 0);
});

test("each site's reading route is counted by host, failures included", () => {
  const log: RouteLog = {};
  logRoute(log, "https://www.nytimes.com/2026/09/20/us/politics/a.html", "copy", 1);
  logRoute(log, "https://www.nytimes.com/2026/09/21/world/b.html", "none", 2);
  logRoute(log, "https://aawsat.com/node/1", "page", 3);
  assert.deepEqual(log["nytimes.com"], { routes: { copy: 1, none: 1 }, lastAt: 2, last: "none" });
  assert.equal(log["aawsat.com"].routes.page, 1);
});
