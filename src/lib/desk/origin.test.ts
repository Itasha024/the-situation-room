import { test } from "node:test";
import assert from "node:assert/strict";
import { articleText, findCitation, keywords, logRoute, overlap, type RouteLog } from "./origin.ts";

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

test("an article's text is its paragraphs, not the stylesheet inside one", () => {
  // wsj.com styles its links with a <style> block sitting inside the first
  // paragraph. Stripping tags alone left the CSS behind, so every rescued WSJ
  // story opened with '.css-qxhvg8-OverridedLink{-webkit-text-decoration:none'.
  const html =
    "<p>DUBAI—<style>.css-qxhvg8{-webkit-text-decoration:none;text-decoration:none;color:var(--x);}</style>" +
    "Debris discovered in Yemen indicates that Saudi Arabia has fired a Chinese-made missile in combat.</p>" +
    "<p><script>track({ label: 'a string long enough to pass for a paragraph of copy, which it is not.' });</script></p>";
  const out = articleText(html);
  assert.match(out, /^DUBAI— ?Debris discovered in Yemen/);
  assert.doesNotMatch(out, /text-decoration|css-qxhvg8|track\(/);
});

// ---- Round 13: any outlet, unnamed groups, no false citings, the copy ----
import { discoverSite, domainOf, editionOf, findGroup, namedOutlets, sameTitle, searchKeys, searchPlan, stripAttribution } from "./origin.ts";

test("'British media' is searched across Britain's outlets (Sabereen 226405)", () => {
  const g = findGroup("وسائل إعلام بريطانية: بن سلمان نصح واشنطن بعدم التسرع في العودة إلى الاتفاق مع إيران", "https://t.me/SabrenNewss/226405");
  assert.equal(g?.name, "British media");
  assert.equal(g?.kind, "group");
  assert.ok(g?.sites?.includes("ft.com") && g.sites.includes("theguardian.com"));
  const q = searchPlan(g!, ["Salman", "Washington", "Iran", "agreement"])[0].q;
  assert.match(q, /^\(site:ft\.com OR site:theguardian\.com OR .*\) Salman Washington Iran agreement when:2d$/);
});

test("an outlet the desk has never met is taken from the reader's English copy", () => {
  assert.deepEqual(namedOutlets("TAIF — Italian newspaper La Repubblica reported that the decision to relocate aircraft followed an attack.")[0], {
    name: "La Repubblica",
    strong: true,
    told: false,
  });
  assert.equal(namedOutlets("An Iranian newspaper Javan Online reported that Houthi forces are close")[0]?.name, "Javan Online");
  assert.deepEqual(namedOutlets("US officials tell NBC News that Pentagon leaders are divided")[0], { name: "NBC News", strong: false, told: true });
  assert.equal(namedOutlets("ADEN — Bloomberg reports that the Houthis have expanded a network")[0]?.name, "Bloomberg");
  assert.equal(namedOutlets("Houthis are increasingly supplied by China, Wall Street Journal says")[0]?.name, "Wall Street Journal");
});

test("a person, a role or a nationality is not an outlet", () => {
  assert.deepEqual(namedOutlets("Rubio: we are determined to fulfill our commitments to Saudi Arabia"), []);
  assert.deepEqual(namedOutlets("Senior government sources told the Italian newspaper that Italy moved aircraft"), []);
  assert.deepEqual(namedOutlets("Yemen's president told Saudi Crown Prince Mohammed that the front held"), []);
});

test("an outlet's site is learned from Google News, and a name it does not list is none", async () => {
  const items = (outlet: string, site: string, n: number) => Array.from({ length: n }, () => ({ title: "x", link: "", at: 0, outlet, site }));
  const fake = async (q: string) =>
    q.includes("Repubblica")
      ? [...items("repubblica.it", "https://www.repubblica.it", 5), ...items("la Repubblica", "https://roma.repubblica.it", 3), ...items("Reuters", "https://www.reuters.com", 3)]
      : [...items("Wales Online", "https://www.walesonline.co.uk", 6), ...items("Borneo Bulletin", "https://borneobulletin.com.bn", 7)];
  assert.equal(await discoverSite("La Repubblica", fake), "repubblica.it");
  assert.equal(await discoverSite("Javan Online", fake), "");
});

test("a foreign original is searched in its own edition, on the names it shares with the summary", () => {
  assert.equal(editionOf("repubblica.it"), "it");
  assert.equal(editionOf("telegraph.co.uk"), "gb");
  assert.equal(domainOf("https://roma.repubblica.it/x"), "repubblica.it");
  assert.equal(domainOf("https://news.bbc.co.uk/x"), "bbc.co.uk");
  const [first] = searchPlan({ name: "La Repubblica", site: "repubblica.it", lang: "en", kind: "outlet", country: "IT" }, ["Taif", "Eurofighter", "attack", "damages"]);
  assert.equal(first.ed, "it");
  assert.equal(first.q, "site:repubblica.it Taif Eurofighter when:3d");
});

test("an interview is looked for on the network, then across its country's outlets", () => {
  const plan = searchPlan({ name: "Fox News", site: "foxnews.com", lang: "en", kind: "outlet", country: "US", told: true }, ["Rubio", "Saudi", "commitments"]);
  assert.match(plan[0].q, /^site:foxnews\.com /);
  assert.ok(plan.some((t) => /site:nytimes\.com OR/.test(t.q)));
});

test("a wire's story is accepted from the paper that carried it (AFP, Dhubab)", () => {
  const plan = searchPlan({ name: "AFP", site: "afp.com", lang: "en", kind: "outlet", country: "FR", wire: true }, ["Dhubab", "Perim", "Houthi"]);
  const byName = plan.find((t) => t.q.startsWith('"AFP"'))!;
  assert.equal(byName.credit({ title: "", link: "", at: 0, outlet: "France 24", site: "https://www.france24.com" }), "AFP");
});

test("the search words carry the story, not the dateline or the agency's own name (AP, Mocha)", () => {
  const keys = searchKeys("Iranian advisers aided Houthi offensive in western Yemen\nMOCHA — Associated Press reported that Iranian Revolutionary Guard advisers participated", { name: "AP" });
  assert.ok(!keys.some((k) => /associated|press|mocha|reported/i.test(k)), keys.join(" "));
  // The headline's own words lead; the war's common words (Houthi, Yemen) come last.
  assert.deepEqual(keys.slice(0, 2), ["advisers", "aided"]);
  assert.ok(keys.indexOf("Houthi") > keys.indexOf("advisers"));
});

test("a wire's own story is not relaying an outlet it mentions past its lead (Reuters and the FT)", () => {
  const lead = "The World Food Programme said on Tuesday it would cut rations in Houthi-held areas of Yemen as funding runs short across the region. ".repeat(4);
  const text = `${lead}Earlier this month the Financial Times reported that donors were reviewing their pledges.`;
  assert.equal(findCitation(text, "Reuters", "https://www.reuters.com/world/middle-east/wfp-yemen-2026-09-23/")?.name, "WFP");
  assert.equal(findCitation(`${lead}The Financial Times reported...`, "Reuters", "https://www.reuters.com/x")?.name, "WFP");
  assert.equal(findCitation("Houthis weigh talks, the Financial Times reported on Monday", "Reuters", "https://www.reuters.com/x")?.name, "Financial Times");
});

test("La Repubblica and NBC are known by their Arabic names", () => {
  assert.equal(findCitation("صحيفة لاريبوبليكا الإيطالية: إيطاليا نقلت طائراتها سرا من قاعدة الطائف", "Al-Masirah", "https://t.me/almasirah2/299581")?.name, "La Repubblica");
  assert.equal(findCitation("مسؤولون أمريكيون لشبكة إن بي سي: انقسام في البنتاغون", "Almashhad", "https://t.me/x/1")?.name, "NBC News");
});

test("an outlet neither opens nor closes a headline; a person's words keep their name", () => {
  assert.equal(stripAttribution("La Repubblica: Taif base attack damages Eurofighter jet", ["Al-Masirah", "La Repubblica"]), "Taif base attack damages Eurofighter jet");
  assert.equal(stripAttribution("Iranian newspaper Javan Online: Houthi forces close to controlling all of Yemen"), "Houthi forces close to controlling all of Yemen");
  assert.equal(stripAttribution("Yemen's Houthis are increasingly supplied by China, Wall Street Journal says", ["WSJ"]), "Yemen's Houthis are increasingly supplied by China");
  assert.equal(
    stripAttribution("Bin Salman advised Washington against rushing to return to the understanding agreement with Iran, British media report"),
    "Bin Salman advised Washington against rushing to return to the understanding agreement with Iran",
  );
  assert.equal(stripAttribution("Rubio: we are determined to fulfill our commitments to Saudi Arabia", ["Al Hadath", "Fox News"]), "Rubio: we are determined to fulfill our commitments to Saudi Arabia");
  assert.equal(stripAttribution("Pentagon split on Houthi strikes, Houthi leader says"), "Pentagon split on Houthi strikes, Houthi leader says");
});

test("the same headline, trimmed by a sister title, is still the same story", () => {
  assert.ok(sameTitle("Yemen's Houthis, Threatening Global Oil, Are Increasingly Supplied by China", "Yemen's Houthis Threatening Global Oil Are Increasingly Supplied by China"));
  assert.ok(!sameTitle("Houthis strike Taif", "Houthis strike Jizan"));
});

test("words said TO the carrier are its own, not a relay of US media", () => {
  assert.equal(findGroup("مسؤول أمريكي للعربية: واشنطن تدرس خيارات الرد", "https://t.me/alarabiyaBr/1"), null);
  assert.equal(findGroup("US official told Al Arabiya that options are being weighed", "https://t.me/alarabiyaBr/1"), null);
  assert.equal(findGroup("مسؤولون أمريكيون: البنتاغون منقسم بشأن الضربات", "https://t.me/x/1")?.name, "US officials");
});

test("an original must name the war's ground: a UNICEF release on Jordan is not the Yemen one", async () => {
  const { theatre } = await import("./origin.ts");
  assert.equal(theatre("United Kingdom adds £2.85 Million to Partnership with UNICEF to Improve Education for Vulnerable Children in Jordan"), false);
  assert.equal(theatre("Child malnutrition rises in Yemen as fighting intensifies, says UNICEF"), true);
  assert.equal(theatre("million children under five face risk acute malnutrition Yemen"), true);
});
