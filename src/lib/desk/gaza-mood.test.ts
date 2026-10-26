import { test } from "node:test";
import assert from "node:assert/strict";
import { arabicNames, channelsFor, moodScore, parsePosts, pickEvents, reactionsOf, readFound, readMood, stirring, sumReactions, watchChannels } from "./gaza-mood.ts";

const PAGE = `<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="QudsN/1"><div class="tgme_widget_message_text js-message_text" dir="auto">غضب في جنين</div><div class="tgme_widget_message_reactions js-message_reactions"><span class="tgme_reaction"><i class="emoji" style="x"><b>🤬</b></i>4</span><span class="tgme_reaction"><i class="emoji" style="x"><b>💔</b></i>1.2K</span></div><div class="tgme_widget_message_footer"><span class="tgme_widget_message_views">3.4K</span><time datetime="2026-10-26T18:00:00+00:00">x</time></div></div></div>`;

test("a post's text, views and emoji are read from the public page", () => {
  const [p] = parsePosts(PAGE, "QudsN");
  assert.equal(p.u, "https://t.me/QudsN/1");
  assert.equal(p.v, 3400);
  assert.deepEqual(p.rx, { "🤬": 4, "💔": 1200 });
  assert.deepEqual(reactionsOf("<div></div>"), undefined);
  const s = sumReactions([p]);
  assert.equal(s.total, 1204);
  assert.equal(s.byMood.grief, 1200);
});

test("events: big ones picked, aid and meetings left, one a town", () => {
  const now = Date.parse("2026-10-26T20:00:00Z");
  const card = (fp: string, summary: string, extra: Record<string, unknown> = {}) => ({ fp, at: "2026-10-26T15:00:00Z", summary, flags: ["arena:judea_samaria"], alsoReportedBy: [1, 2, 3, 4], lat: 32.46, lng: 35.3, place: "Jenin", ...extra });
  assert.ok(moodScore(card("a", "Israeli forces raid Jenin camp, two killed")) >= 7);
  assert.equal(moodScore(card("b", "Aid trucks enter", { flags: ["arena:aid"] })), 0);
  const evs = pickEvents([card("a", "Israeli forces raid Jenin camp, two killed"), card("c", "Israeli forces raid Jenin, one killed", { at: "2026-10-26T16:00:00Z" }), card("d", "Abbas meets Iraqi PM", { type: "diplomacy" })], now);
  assert.deepEqual(evs.map((e) => e.fp), ["c"]);
  assert.ok(channelsFor(evs[0]).includes("jeninnews1"));
});

test("big towns are not search words; villages are", () => {
  assert.deepEqual(arabicNames("Gaza"), []);
  assert.deepEqual(arabicNames("Jenin"), []);
  assert.ok(arabicNames("Beit Lahia").includes("بيت لاهيا"));
});

test("the model's read: known kinds, named items, shares that add up, the desk's words", () => {
  const items = [{ u: "https://t.me/a/1", at: "", ch: "a", x: "", v: 1 }, { u: "https://t.me/a/2?comment=3", at: "", ch: "a", x: "", v: 0, c: 1 as const }];
  const r = readMood({ about: true, mood: [{ k: "anger", w: 30 }, { k: "bogus", w: 50 }, { k: "grief", w: 30 }], intensity: 9, summary: "Anger at the settlers", calls: [{ i: 1, kind: "protest", en: "March tonight" }, { i: 7, en: "x" }], quotes: [{ i: 0, en: "God help us" }], reports: 4, rel: [0, 1, 9] }, items, (s) => s.replace(/settlers/g, "Israeli citizens"));
  assert.ok(r);
  assert.deepEqual(r.mood, [{ k: "anger", w: 50 }, { k: "grief", w: 50 }]);
  assert.equal(r.intensity, 5);
  assert.equal(r.summary, "Anger at the Israeli citizens");
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].c, 1);
  assert.deepEqual(r.rel, [0, 1]);
  assert.equal(readMood({}, items), null);
});

test("both ways: every Palestinian channel is searched, and events are found from the most-reacted posts (27 Oct)", () => {
  const ch = channelsFor({ lat: 32.46, lng: 35.3, area: "js" });
  assert.equal(ch[0], "jeninnews1");
  assert.ok(ch.length > 50 && ch.includes("WAFAgency") && ch.includes("Palinfo"));
  assert.equal(new Set(ch.map((c) => c.toLowerCase())).size, ch.length);
  assert.ok(watchChannels().length > ch.length);
  const now = Date.parse("2026-10-26T20:00:00Z");
  const posts = [
    { u: "https://t.me/a/1", at: "2026-10-26T18:00:00.000Z", ch: "a", x: "اقتحام بلدة قباطية", v: 9000, rx: { "🤬": 300 } },
    { u: "https://t.me/a/2", at: "2026-10-26T18:30:00.000Z", ch: "a", x: "خبر", v: 100 },
    { u: "https://t.me/b/1", at: "2026-10-25T01:00:00.000Z", ch: "b", x: "قديم", v: 99999 },
  ];
  const top = stirring(posts, now);
  assert.deepEqual(top.map((p) => p.u), ["https://t.me/a/1", "https://t.me/a/2"]);
  const [ev] = readFound({ events: [{ h: "Israeli forces raid Qabatiya", place: "Qabatiya", area: "js", items: [0], terms: ["قباطية", "Gaza"] }, { h: "No posts", area: "js", items: [9] }] }, top);
  assert.equal(ev.found, 1);
  assert.deepEqual(ev.terms, ["قباطية"]);
  assert.equal(ev.seed?.length, 1);
  assert.ok(ev.fp.startsWith("mood-") && ev.lat != null);
});
