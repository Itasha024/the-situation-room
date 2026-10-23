import { test } from "node:test";
import assert from "node:assert/strict";
import { isExclusive, ownArticleSourcing } from "./exclusive.ts";
import { ownNewsApart, siteOwnNews } from "./site-articles.ts";
import { papersFirst } from "../iran-scan.server.ts";
import { LEBANESE_MEDIA } from "./iran-sources.ts";
import { pressOf } from "./state-press.ts";

// User, 23 Oct: Nidaa al-Watan's report of seven Hezbollah explosives trucks never reached the desk;
// Al-Akhbar's morning paper mostly went unread; the papers' morning order; Al Jadeed's evening scoops;
// Al-Binaa, which NNA's press review carried.

const NIDAA_AR =
  "كشفت معلومات ديبلوماسية استندت إلى تقرير وصل إلى إحدى السفارات الأجنبية في بيروت، أن شاحنة المتفجّرات التي ضُبطت في ضهر البيدر لم تكن الوحيدة، وأحصى التقرير أن سبع شاحنات مرّت على تلك الطريق من البقاع إلى بيروت";
const NIDAA = {
  url: "https://www.nidaalwatan.com/article/403529",
  source: "Nidaa al-Watan",
  summary: "Diplomatic report: seven Hezbollah explosives trucks crossed from the Beqaa to Beirut, not one",
  text:
    "Diplomatic information based on a report reaching a foreign embassy in Beirut says the seized explosives truck was not the only one; seven trucks travelled the same route from the Beqaa to Beirut, and the two men in the truck were not the only operatives. The report says Hezbollah formed separate cells of two or three people each, with no cell knowing the others, complicating the investigation.",
};
const LBCI = {
  url: "https://t.me/LBCI_NEWS/322089",
  source: "LBCI",
  summary: "Lebanese cabinet keeps Deir al-Baydar explosives case out of Judicial Council, orders investigations to continue; Lebanese Forces ministers walk out",
  text: "Justice Minister Adel Nassar insisted on referring the case to the Judicial Council while Parliament Speaker Nabih Berri and Hezbollah opposed the move.",
};

test("a paper's own article: its unnamed diplomatic sources are its own news", () => {
  assert.ok(ownArticleSourcing(NIDAA_AR));
  assert.ok(ownArticleSourcing(NIDAA.text));
  assert.ok(!ownArticleSourcing("Diplomatic sources told Reuters the talks had stalled."));
  assert.ok(!ownArticleSourcing("مصادر دبلوماسية لوكالة رويترز: المحادثات متعثرة"));
  assert.ok(siteOwnNews(NIDAA));
  // Its post is not its article: the post names it, and ownInformation reads that.
  assert.ok(!siteOwnNews({ ...NIDAA, url: "https://x.com/NidaaWatan/status/1" }));
});

test("the paper's own news stays a card of its own, a retelling still joins", () => {
  assert.ok(ownNewsApart(LBCI, NIDAA));
  const retold = { ...NIDAA, summary: LBCI.summary, text: `${LBCI.text} Diplomatic sources said the cabinet decision was expected.` };
  assert.ok(!ownNewsApart(LBCI, retold));
});

test("the papers' links in turn, in the morning order, before the rest", () => {
  const at = (h: number) => new Date(Date.parse("2026-10-23T06:00:00Z") - h * 3600_000).toISOString();
  const gn = (source: string, site: string, h: number) => ({ source, site, url: `https://news.google.com/rss/articles/${source}${h}`, at: at(h) });
  const hits = [
    ...[0, 1, 2, 3].map((h) => gn("Ad-Diyar", "addiyar.com", h)),
    ...[0, 1, 2].map((h) => gn("Elnashra", "elnashra.com", h)),
    gn("Al-Joumhouria", "aljoumhouria.com", 1),
    ...[7, 8].map((h) => gn("Al-Akhbar", "al-akhbar.com", h)),
    gn("Nidaa al-Watan", "nidaalwatan.com", 6),
    { source: "Reuters", site: "reuters.com", url: "https://news.google.com/rss/articles/r", at: at(0) },
  ];
  const order = papersFirst(hits).map((h) => h.source);
  assert.deepEqual(order.slice(0, 5), ["Al-Akhbar", "Nidaa al-Watan", "Al-Joumhouria", "Ad-Diyar", "Elnashra"]);
  assert.equal(order[5], "Al-Akhbar");
  assert.equal(order.at(-1), "Reuters");
  assert.equal(order.length, hits.length);
});

test("the Lebanese channels' own scoops are exclusives", () => {
  assert.ok(isExclusive("معلومات الجديد: الجانب الاميركي يرغب في أن يغادر الوساطة لمصلحة بقاء المفاوضات", "Al Jadeed"));
  assert.ok(isExclusive("مصادر دبلوماسية للجديد: وصول رسائل دولية إلى لبنان بضرورة تحييد نفسه", "Al Jadeed"));
  assert.ok(isExclusive("‏جعجع لـMTV: نحتاج إلى نية سياسية واضحة بتفكيك حزب الله", "MTV Lebanon"));
  assert.ok(!isExclusive("الجيش الإسرائيلي: فرضنا طوقاً أمنياً شاملاً على مدينة الخليل", "Al Jadeed"));
  assert.ok(!isExclusive("وزير العدل: شحنة المتفجرات المضبوطة كان يمكن استخدامها", "MTV Lebanon"));
});

test("Al-Binaa is read as a Lebanese paper", () => {
  assert.ok(LEBANESE_MEDIA.has("Al-Binaa"));
  assert.ok(pressOf("Al-Binaa", "LB") >= 0);
});
