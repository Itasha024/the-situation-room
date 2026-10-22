import { test } from "node:test";
import assert from "node:assert/strict";
import { checkReading, dropChannelLabels, fitHeadline, personAsCountry, type Reading } from "./reader.ts";
import { articleLink, isShortLink, msnArticle, msnId, msnNames, ownStory, sameProvider, unshorten } from "./full-text.ts";
import { LIVE_BLOG } from "./origin.ts";
import { linkKey } from "../yemen-scan.server.ts";

// The user's review of 22 Oct: long originals lost, headlines only, repeats, labels and states speaking for people.

test("a headline over the limit keeps its main fact and gives the rest to the body", () => {
  const r = fitHeadline({
    headline:
      "Senior Iranian security official: Iran considers a US and Israeli attack a foregone conclusion; Israel will never allow the US any diplomatic solution",
    body: "",
  });
  assert.ok(r.headline.length <= 140, r.headline);
  assert.equal(r.headline, "Senior Iranian security official: Iran considers a US and Israeli attack a foregone conclusion");
  assert.match(r.body, /^The senior Iranian security official also said Israel will never allow the US any diplomatic solution\./);
  // A body that already tells the cut part is left as it is.
  const told = fitHeadline({
    headline: "Iran's navy seized two tankers in the Strait of Hormuz on Wednesday, the IRGC said, after warning ships to keep away from its waters near Larak",
    body: "The IRGC said it acted after warning ships to keep away from its waters near Larak island.",
  });
  assert.ok(told.headline.length <= 140);
  assert.equal(told.body, "The IRGC said it acted after warning ships to keep away from its waters near Larak island.");
  // Short headlines are untouched.
  const short = { headline: "IRGC: two tankers seized in Hormuz", body: "" };
  assert.equal(fitHeadline(short), short);
});

test("a long reading no longer fails on its headline once fitted", () => {
  const r = {
    publish: true,
    event_type: "statement",
    speaker_lead: "Senior Iranian security official",
    headline: fitHeadline({
      headline:
        "Senior Iranian security official: Iran considers a US and Israeli attack a foregone conclusion; Israel will never allow the US any diplomatic solution",
      body: "",
    }).headline,
    body: "",
    targets: [],
    origins: [],
  } as unknown as Reading;
  const problem = checkReading(r, "مقام ارشد امنیتی: ایران حمله آمریکا و اسرائیل را مفروض می‌داند", false);
  assert.ok(!problem || !/headline length/i.test(problem), problem ?? "");
});

test("a channel's labels are not copy", () => {
  assert.equal(
    dropChannelLabels("OSINT: ballistic missile transport observed on five trucks in Pouneh tunnel, Khorramabad"),
    "Ballistic missile transport observed on five trucks in Pouneh tunnel, Khorramabad",
  );
  assert.equal(dropChannelLabels("OSINT sources report large explosion in Strait of Hormuz"), "Reports of large explosion in Strait of Hormuz");
  assert.equal(dropChannelLabels("BREAKING: IRGC says two tankers seized"), "IRGC says two tankers seized");
  assert.equal(dropChannelLabels("Araghchi: Iran will not negotiate under threat"), "Araghchi: Iran will not negotiate under threat");
});

test("one person's words are never the state's", () => {
  const src = "🔴عاجل\n\n⭕️ زيني وند: طالبنا بإيفاد وفد رفيع المستوى إلى الدوحة بهدف توضيح مختلف جوانب ملف الطيارين";
  assert.match(personAsCountry("Iran says Qatar's explanations on missing pilots insufficient, demands high-level delegation", src) ?? "", /one person's words/);
  assert.equal(personAsCountry("Iranian MP: Iran asked Qatar to send a high-level delegation over the pilots", src), null);
  // The state itself speaking is the state.
  assert.equal(personAsCountry("Iran says the blockade violates international law", "الخارجية الإيرانية: الحصار البحري انتهاك للقانون الدولي"), null);
});

test("the link in a post is its article; channel links and pictures are not", () => {
  assert.equal(articleLink("Persian Gulf oil exports surpass pre-war high as market adapts to Iran's attacks https://trib.al/A4rnDlo"), "https://trib.al/A4rnDlo");
  assert.equal(articleLink("مشروح خبر https://snn.ir/006BhI\nپخش زنده http://snn.ir/fa/livetv"), "https://snn.ir/006BhI");
  assert.equal(articleLink("Watch https://x.com/IranIntl/status/1 and https://t.me/farsna"), "");
  assert.equal(articleLink("سایت https://snn.ir/ | ایتا https://eitaa.com/snn_ir"), "");
});

test("an outlet's post of its own story takes the article's address", () => {
  assert.equal(ownStory("https://nypost.com/2026/10/21/business/gulf-oil/", "Nypost", "NY Post"), true);
  assert.equal(ownStory("https://www.wsj.com/world/middle-east/diplomats-race-4dd00ab4", "WSJ", "WSJ"), true);
  assert.equal(ownStory("https://www.nytimes.com/2026/10/21/us/politics/x.html", "NYT", "OSINT Hexagone"), false);
});

test("short links are followed to where they land", async () => {
  assert.equal(isShortLink("https://nyti.ms/48dUCBL"), true);
  assert.equal(isShortLink("https://on.wsj.com/4yzYvMo"), true);
  assert.equal(isShortLink("https://www.nytimes.com/2026/10/21/us/politics/a.html"), false);
  const hops: Record<string, string> = {
    "https://nyti.ms/48dUCBL": "https://www.nytimes.com/2026/10/21/us/politics/us-israel-renewed-iran-strikes.html?smid=tw-nytimes",
  };
  const fake = (async (u: string) => new Response(null, { status: 301, headers: { location: hops[String(u)] ?? "" } })) as unknown as typeof fetch;
  assert.equal(await unshorten("https://nyti.ms/48dUCBL", fake), hops["https://nyti.ms/48dUCBL"]);
  // The same article under its share tag and without it is one link.
  assert.equal(
    linkKey("https://www.wsj.com/world/middle-east/diplomats-race-to-head-off-escalation-with-iran-4dd00ab4?mod=e2tw"),
    "https://www.wsj.com/world/middle-east/diplomats-race-to-head-off-escalation-with-iran-4dd00ab4",
  );
});

test("MSN's licensed copy counts only under the same outlet", () => {
  assert.equal(msnId("https://www.msn.com/en-us/news/other/diplomats-race-to-head-off-escalation-with-iran/ar-AA2fLQ3m"), "AA2fLQ3m");
  assert.deepEqual(msnNames("https://on.wsj.com/4yzYvMo"), ["Wall Street Journal", "WSJ"]);
  assert.deepEqual(msnNames("https://news.google.com/rss/articles/x", "WSJ"), ["Wall Street Journal", "WSJ"]);
  assert.equal(msnNames("https://www.nytimes.com/x"), null);
  const a = msnArticle(JSON.stringify({ title: "Diplomats race", provider: { name: "The Wall Street Journal" }, body: "<p>DUBAI—Middle East mediators are scrambling to revive talks with Iran.</p>" }));
  assert.ok(a && sameProvider(a.provider, ["Wall Street Journal", "WSJ"]));
  assert.equal(sameProvider("Fox News", ["Wall Street Journal", "WSJ"]), false);
});

test("a whole live blog is not one story", () => {
  assert.equal(LIVE_BLOG.test("https://www.aljazeera.com/news/liveblog/2026/10/22/iran-war-live-irgc-vows-invasion"), true);
  // Middle East Eye's update pages are one entry each.
  assert.equal(LIVE_BLOG.test("https://www.middleeasteye.net/live-blog/live-blog-update/irgc-says-iran-has-missiles"), false);
});
