import { test } from "node:test";
import assert from "node:assert/strict";
import { carried, folded, pressCandidates, pressOf } from "./state-press.ts";
import { foreignOfficial } from "./origin.ts";
import { ownPostNo } from "../yemen-scan.server.ts";

// User, 22 Oct: an official's words are found in his country's media, not only on his own channel,
// and every relay is traced there in the media's own language.

test("a country's own media, by the names the site gives its sources", () => {
  assert.ok(pressOf("IRNA", "IR") >= 0);
  assert.ok(pressOf("Mehr News Agency", "IR") >= 0);
  assert.ok(pressOf("Fars News", "IR") >= 0);
  assert.equal(pressOf("Khabar Fori", "IR"), -1); // an aggregator is nobody's original
  assert.equal(pressOf("Al Mayadeen", "IR"), -1);
  assert.ok(pressOf("Al Mayadeen", "LB") >= 0);
  assert.ok(pressOf("TASS", "RU") >= 0);
  // The state's own channels rank before its outlets.
  assert.ok(pressOf("Iran Foreign Ministry (Arabic)", "IR") < pressOf("Press TV", "IR"));
});

test("keywords match in the posts' own letters and digits", () => {
  assert.equal(folded("۲۴ میلیون"), "24 ميليون");
  assert.equal(carried("مقام ارشد امنیتی: ایران حمله آمریکا و اسرائیل را مفروض می‌داند", ["امنیتی", "اسرائیل", "Israel"]), 2);
});

test("the original is short-listed from the owner's channel and the country's media, not the relay's", () => {
  const at = Date.parse("2026-10-21T21:00:00Z");
  const reads = [
    { source: "Fars News", url: "https://t.me/farsna/469911", text: "مقام ارشد امنیتی: ایران حمله آمریکا و اسرائیل را مفروض می‌داند و ژست‌های دیپلماتیک آمریکا", at: at - 30 * 60_000 },
    { source: "Khabar Fori", url: "https://t.me/Khabar_Fouri/552929", text: "مقام ارشد امنیتی: ایران حمله آمریکا و اسرائیل را مفروض می‌داند", at: at - 10 * 60_000 },
    { source: "IRNA", url: "https://t.me/irna_1313/1", text: "بازار ارز امروز", at: at - 60 * 60_000 },
    { source: "Tasnim", url: "https://t.me/Tasnimnews_EN/2", text: "Senior security official: Iran assumes a US and Israeli attack", at: at - 13 * 3600_000 },
  ];
  const keys = ["امنیتی", "اسرائیل", "دیپلماتیک", "attack"];
  const got = pressCandidates(reads, { own: () => false, country: "IR" }, keys, at);
  assert.deepEqual(got.map((c) => c.source), ["Fars News"]); // the aggregator out, IRNA off the story, Tasnim's too old
  // An outlet's own story: its own posts only, never another's retelling.
  const own = pressCandidates(reads, { own: (r) => r.source === "Fars News" }, keys, at);
  assert.equal(own[0].source, "Fars News");
  assert.equal(own[0].own, true);
});

test("another country's official on an outlet not of that country is a relay to trace", () => {
  assert.equal(foreignOfficial("Senior Iranian security official: Israel will not allow the US any diplomatic solution", "Al Mayadeen")?.country, "IR");
  assert.equal(foreignOfficial("Iranian MP: we asked for a delegation to Doha", "Al-Alam"), null); // Al-Alam is Iran's own
  assert.equal(foreignOfficial("Russian deputy FM: Moscow ready to mediate", "Unews")?.country, "RU");
  assert.equal(foreignOfficial("Israeli strikes hit south Lebanon", "LBCI"), null); // no speaker
});

test("a channel's mark is its own post number, never a linked article's", () => {
  assert.equal(ownPostNo("https://t.me/alakhbar_news/98280", "Alakhbar_News"), 98280);
  assert.equal(ownPostNo("https://www.al-akhbar.com/news/905496", "Alakhbar_News"), 0);
  assert.equal(ownPostNo("https://t.me/other/5", "Alakhbar_News"), 0);
});
