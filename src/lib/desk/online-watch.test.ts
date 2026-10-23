import { test } from "node:test";
import assert from "node:assert/strict";
import { areaOf, countHour, isTalk, voicesOf, parseWatchPage, summarise, topicsOf, viewsOf, type WatchPost } from "./online-watch.ts";
import { WATCH_TG } from "./online-sources.ts";

// User, 23 Oct: the Gaza desk's Online watch.

test("posts are tagged by the words people write", () => {
  assert.deepEqual(topicsOf("طوابير صباحية في مواصي خانيونس من أجل الحصول على ربطة خبز"), ["bread", "shelter"]);
  assert.ok(topicsOf("شبان يتصدون لهجوم مستوطنين على أطراف قرية المغير").includes("extremists"));
  assert.ok(topicsOf("جيش الاحتلال يقوم بعملية اعتقالات واسعة في الخليل").includes("raids"));
  assert.ok(topicsOf("دعوة للتظاهر يوم الجمعة في ساحة السرايا").includes("protest"));
  // A short word inside a longer one is not that word ("ضمن" is not annexation, "مساهمة" is not Sahm).
  assert.ok(!topicsOf("ضمن مساهمة الأهالي").includes("israel_politics"));
  assert.ok(!topicsOf("ضمن مساهمة الأهالي").includes("hamas_rule"));
});

test("a post's area: its words, else its channel's", () => {
  assert.equal(areaOf("اقتحام مخيم جنين", "both"), "js");
  assert.equal(areaOf("قصف شرق خانيونس", "both"), "gaza");
  assert.equal(areaOf("خبر عام", "gaza"), "gaza");
});

test("a channel's page as posts", () => {
  const html = `<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="khnmedia/123"><div class="tgme_widget_message_text js-message_text" dir="auto">طوابير الخبز<br/>في المواصي</div><span class="tgme_widget_message_views">12.3K</span><time datetime="2026-10-23T09:00:00+00:00"></time></div></div>`;
  const [p] = parseWatchPage(html, { id: "khnmedia", area: "gaza" });
  assert.equal(p.u, "https://t.me/khnmedia/123");
  assert.equal(p.v, 12300);
  assert.ok(p.t.includes("bread"));
  assert.equal(viewsOf("1.2M"), 1_200_000);
});

test("the summary: rising against the usual hours, calls apart, each area apart", () => {
  const now = Date.parse("2026-10-23T12:30:00Z");
  const post = (h: number, x: string, a: WatchPost["a"] = "gaza", t = topicsOf(x)): WatchPost => ({ u: `https://t.me/c/${h}${x.length}${Math.random()}`, at: new Date(now - h * 3600_000).toISOString(), ch: "c", a, t, x, v: 100 });
  const today = [post(1, "تعبنا والله من طابور ربطة خبز"), post(1, "تعبنا والله من طابور ربطة خبز"), post(2, "تعبنا والله من طابور ربطة خبز"), post(1, "دعوة للتظاهر غدا", "js")];
  const yesterday = [post(25, "تعبنا والله من طابور ربطة خبز")];
  const counts: Record<string, ReturnType<typeof countHour>> = {};
  for (const p of [...today, ...yesterday]) {
    const k = p.at.slice(0, 13);
    counts[k] = countHour([...today, ...yesterday].filter((q) => q.at.slice(0, 13) === k));
  }
  const s = summarise([...today, ...yesterday], counts, now, 3, WATCH_TG.length);
  const gaza = s.areas.find((a) => a.area === "gaza")!;
  const bread = gaza.topics.find((t) => t.id === "bread")!;
  assert.equal(bread.now, 3);
  assert.equal(bread.trend, "rising");
  assert.equal(s.areas.find((a) => a.area === "js")!.calls.length, 1);
  assert.equal(gaza.calls.length, 0);
});

test("the watch's channels: well over a hundred, each once", () => {
  assert.ok(WATCH_TG.length > 150);
  assert.equal(new Set(WATCH_TG.map((c) => c.id.toLowerCase())).size, WATCH_TG.length);
});

// User, 23 Oct: the discussion groups without an account, through Telegram's public comments widget.
test("a post's comments, without who wrote them", async () => {
  const { parseComments } = await import("./online-watch.ts");
  const html = `<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post-id="14044186"><a class="tgme_widget_message_author_name" href="https://t.me/someone">..</a><div class="tgme_widget_message_text js-message_reply_text" dir="auto">quoted</div><div class="tgme_widget_message_text js-message_text" dir="auto">بدنا نعيش، طوابير الخبز من الفجر</div><a class="tgme_widget_message_date" href="https://t.me/gazaalannet/84369?comment=14044186"><time datetime="2026-10-23T13:39:09+00:00">13:39</time></a></div></div>`;
  const [c] = parseComments(html, { id: "gazaalannet", area: "gaza" }, "https://t.me/gazaalannet/84369");
  assert.equal(c.u, "https://t.me/gazaalannet/84369?comment=14044186");
  assert.equal(c.re, "https://t.me/gazaalannet/84369");
  assert.equal(c.c, 1);
  assert.ok(c.t.includes("bread"));
  assert.ok(!JSON.stringify(c).includes("someone"));
});

// User, 23 Oct: "we don't want reports": the tab is the talk.
test("talk, not reports", () => {
  assert.ok(!isTalk({ x: "عاجل | قوات الاحتلال تقتحم مخيم جنين وتعتقل 3 شبان" }));
  assert.ok(isTalk({ x: "حماس: نوجه النداء لكل من يحمل السلاح لتوجيه الرصاص إلى صدور المحتلين" }));
  assert.ok(isTalk({ x: "تعبنا والله، وين المساعدات؟" }));
  assert.ok(isTalk({ x: "عادي", c: 1 }));
  // Netanyahu's threat is news; Syria's protests are not this desk's talk.
  assert.ok(!voicesOf("نتنياهو يتوعد بعملية واسعة في الخليل").includes("threat"));
  assert.deepEqual(voicesOf("خروج مظاهرات في درعا احتجاجا على الوجود الاسرائيلي في سوريا"), []);
});

// User, 23 Oct: "multiple messages of Hamas just from different channels": one item, with its other channels.
test("a statement reposted by many channels is one item", () => {
  const now = Date.parse("2026-10-23T12:30:00Z");
  const x = "حماس: نوجه النداء لكل من يحمل السلاح من أحرار شعبنا وشبابنا الثائر لتوجيه الرصاص إلى صدور المحتلين";
  const mk = (ch: string, pre: string): WatchPost => ({ u: `https://t.me/${ch}/1`, at: new Date(now - 3600_000).toISOString(), ch, a: "gaza", t: topicsOf(pre + x), x: pre + x, v: 10 });
  const posts = [mk("a", "⭕️ "), mk("b", "🔵 متابعة شهاب | "), mk("c", "")];
  const s = summarise(posts, {}, now, 3, 3);
  const g = s.areas.find((a) => a.area === "gaza")!;
  assert.equal(g.top.length, 1);
  assert.equal((g.top[0] as WatchPost & { n: number }).n, 3);
});

test("the briefs in the desk's words", async () => {
  const { cleanBrief } = await import("./online-brief.ts");
  assert.equal(cleanBrief("Channels reported the martyrdom of the assailants in the West Bank.}"), "Channels reported the killing of the assailants in Judea and Samaria.");
  assert.equal(cleanBrief("threats against Israeli citizens, soldiers, and Israeli citizens"), "threats against Israeli citizens and soldiers");
});

// User, 23 Oct: "anger at Hamas contains a message about the traffic": the model's sorting wins over the words.
test("the model's sorting first, the words until then", async () => {
  const { talkOf, kindsOf } = await import("./online-watch.ts");
  const traffic = { x: "الامن الداخلي: ازدحام مروري على شارع صلاح الدين", q: 1 as const, r: 1 as const, kv: [] };
  assert.equal(talkOf(traffic), false);
  assert.deepEqual(kindsOf({ x: "تعبنا", q: 1, kv: [] }), ["other"]);
  assert.deepEqual(kindsOf({ x: "x", q: 1, kv: ["call"] }), ["call"]);
  assert.equal(talkOf({ x: "عاجل قصف", c: 1 }), true);
});

test("text cut whole, never half an emoji", async () => {
  const { cut } = await import("./online-classify.ts");
  const broken = "🔥🔥".slice(0, 3);
  assert.equal(JSON.stringify(cut(broken, 10)), JSON.stringify("🔥"));
  assert.equal(cut("أ🔥ب", 2), "أ🔥");
});
