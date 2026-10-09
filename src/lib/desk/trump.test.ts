import { test } from "node:test";
import assert from "node:assert/strict";
import { clipStatement, israelDay, mergeStatements, parseTruthFeed, postText, truthTime } from "./trump.ts";

const item = (id: string, html: string, pub = "Fri, 09 Oct 2026 04:02:21 +0000") => `<item>
  <title><![CDATA[x]]></title>
  <description><![CDATA[${html}]]></description>
  <pubDate>${pub}</pubDate>
  <truth:originalUrl>https://truthsocial.com/@realDonaldTrump/${id}</truth:originalUrl>
  <truth:originalId>${id}</truth:originalId>
</item>`;

test("a Truth Social post is timed by its id, when he posted it", () => {
  assert.match(truthTime("117408228489272278") ?? "", /^2026-10-09T00:56:/);
  assert.equal(truthTime("42208"), null);
});

test("only his own words on Iran and the war go in: no reposts, shared headlines, pictures or other subjects", () => {
  const xml = `<rss><channel>${[
    item("117406823254412991", "<p>Gasoline prices will come down fast. A small price to pay for Iran not having a Nuclear Weapon! President DJT</p>"),
    item("117408959105269388", "<p>Mike Rogers completely obliterated Mohammad El-Sayed in the big debate tonight. President DJT</p>"),
    item("117408228489272278", '<p>Melania Trump makes history presiding over UN Security Council — remarking on Iran war deaths: <a href="https://nypost.com/x"><span>nypost.com/x</span></a></p>'),
    item("117408228489272279", "<p>RT @WhiteHouse: Iran will never have a nuclear weapon</p>"),
    item("117408228489272280", '<p><a href="https://truthsocial.com/x">https://truthsocial.com/x</a></p>'),
    item("117406186276133332", "<p>We had very productive talks with Iran.</p><p>The blockade stays in place &amp; we will not be attacking Iran at any time prior to the Midterm Elections.</p>"),
  ].join("")}</channel></rss>`;
  const got = parseTruthFeed(xml);
  assert.deepEqual(got.map((s) => s.id), ["ts-117406823254412991", "ts-117406186276133332"]);
  assert.equal(got[1].text, "We had very productive talks with Iran.\n\nThe blockade stays in place & we will not be attacking Iran at any time prior to the Midterm Elections.");
  assert.equal(got[0].url, "https://truthsocial.com/@realDonaldTrump/117406823254412991");
  assert.equal(got[0].source, "Truth Social");
});

test("Iran named only in someone else's words he posts is not his statement on Iran", () => {
  const xml = item("117383043797111826", "<p>The Polls have ALWAYS underestimated MAGA. I AM ON THE BALLOT! President DONALD J. TRUMP</p><p>From Dick Morris: “Through the Iran War and gas price rises and falls, your job approval is the same.”</p>");
  assert.deepEqual(parseTruthFeed(xml), []);
});

test("a post's link is taken out of its words", () => {
  assert.equal(postText('<p>Read this on Iran! <a href="https://x.com/a"><span class="invisible">https://</span>x.com/a</a></p>'), "Read this on Iran!");
});

test("Rapid Response 47's clip of his words on Iran is his statement; its clips of others and its own lines are not", () => {
  const at = "2026-10-08T14:41:00Z";
  const his = clipStatement({ url: "https://x.com/RapidResponse47/status/2108211064164802992", text: 'President Trump on Iran: "They want to make a deal so badly." https://t.co/abc', at });
  assert.equal(his?.id, "rr-2108211064164802992");
  assert.equal(his?.text, 'President Trump on Iran: "They want to make a deal so badly."');
  assert.ok(clipStatement({ url: "https://x.com/RapidResponse47/status/2", text: '.@POTUS: "Iran will never have a nuclear weapon."', at }));
  assert.equal(clipStatement({ url: "https://x.com/RapidResponse47/status/3", text: '.@StephenM: "Iran is funding terror."', at }), null);
  assert.equal(clipStatement({ url: "https://x.com/RapidResponse47/status/4", text: "President Trump is starving the Iranian regime of money", at }), null);
  assert.equal(clipStatement({ url: "https://x.com/RapidResponse47/status/5", text: 'President Trump: "Gasoline is going down."', at }), null);
});

test("the list: each statement once, newest first, nothing before the feed's first day, kept when a source is down", () => {
  const s = (id: string, at: string, text = "Iran") => ({ id, at, text, url: `https://truthsocial.com/@realDonaldTrump/${id}`, source: "Truth Social" });
  const from = "2026-10-08T00:00:00+03:00";
  const old = [s("ts-2", "2026-10-08T16:17:00Z"), s("ts-1", "2026-10-08T10:00:00Z")];
  const merged = mergeStatements(old, [s("ts-3", "2026-10-08T18:59:00Z"), s("ts-2", "2026-10-08T16:17:00Z", "Iran, edited"), s("ts-0", "2026-10-07T20:00:00Z")], from);
  assert.deepEqual(merged.map((x) => x.id), ["ts-3", "ts-2", "ts-1"]);
  assert.equal(merged[1].text, "Iran, edited");
  // A source that did not answer adds nothing and takes nothing away.
  assert.deepEqual(mergeStatements(merged, [], from).map((x) => x.id), ["ts-3", "ts-2", "ts-1"]);
});

test("a statement's day is Israel's: a minute after midnight there is the next day", () => {
  assert.equal(israelDay("2026-10-08T20:59:00Z"), "2026-10-08");
  assert.equal(israelDay("2026-10-08T21:01:00Z"), "2026-10-09");
});
