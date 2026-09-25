import { test } from "node:test";
import assert from "node:assert/strict";
import { HOLD_MS, saidTo, spokeTo, traceOrigins } from "./origin.ts";
import { learnSource, ownCandidates, sameOutlet, type Learned } from "./originals.ts";
import { ownCarrier, speakerOf, SPEAKERS } from "./speakers.ts";
import type { LiveReport } from "./types.ts";

const macron = SPEAKERS.find((s) => s.name === "Emmanuel Macron")!;

test("a foreign leader's words are found in the copy, not a card about him", () => {
  assert.equal(speakerOf("French President Emmanuel Macron: France will send soldiers and defense systems to Saudi Arabia to protect Yanbu facility")?.name, "Emmanuel Macron");
  assert.equal(speakerOf("Trump says the US prefers talks with the Houthis")?.name, "Donald Trump");
  assert.equal(speakerOf("", "قناة كان العبرية: ماكرون: فرنسا سترسل جنودا إلى ينبع")?.name, "Emmanuel Macron");
  assert.equal(speakerOf("Houthi missiles hit Yanbu after the Trump administration's sanctions"), null);
});

test("his own channel, his country's press or a wire is first-hand; so are words said to the carrier", () => {
  assert.equal(ownCarrier(macron, "https://www.lemonde.fr/international/article/2026/09/24/x.html", ["lemonde.fr"]), true);
  assert.equal(ownCarrier(macron, "https://x.com/EmmanuelMacron/status/1", []), true);
  assert.equal(ownCarrier(macron, "https://t.me/alagsa3agel/286628", ["lemonde.fr", "reuters.com"]), false);
  assert.equal(saidTo("Rubio told Al Arabiya that Washington backs Riyadh", "Al Arabiya"), true);
  assert.equal(saidTo("قال روبيو في مقابلة مع العربية", "العربية"), true);
  assert.equal(saidTo("Rubio said on Fox News that Washington backs Riyadh", "Al Arabiya"), false);
});

test("a leader who spoke to a foreign outlet: that outlet is where his words are", () => {
  assert.deepEqual(spokeTo("French President Emmanuel Macron told CNN that France will protect Yanbu"), ["CNN"]);
  assert.deepEqual(spokeTo("Araghchi said in an interview with Le Monde on Thursday that Tehran…"), ["Le Monde"]);
  assert.deepEqual(spokeTo("قال ماكرون في حديث لشبكة CNN إن فرنسا"), ["CNN"]);
  assert.deepEqual(spokeTo("Macron told reporters in Paris that he told him nothing"), []);
  assert.equal(sameOutlet("CNN International", "CNN"), true);
  assert.equal(sameOutlet("Le Monde.fr", "Le Monde"), true);
  assert.equal(sameOutlet("The Guardian", "Guardian"), true);
  assert.equal(sameOutlet("CNN", "CNBC"), false);
  assert.equal(sameOutlet("MSN", "Le Monde"), false);
});

test("the outlet's own articles closest to the claim are the candidates (the CNN case)", () => {
  const at = Date.parse("2026-09-25T08:00:59Z");
  const listing = [
    { url: "https://edition.cnn.com/2026/09/24/politics/trump-saudi-arabia-houthis-war-gas-prices", title: "Trump is staying out of Saudi Arabia's war. Americans could pay at the pump", desc: "", at: Date.parse("2026-09-24T11:07:00Z") },
    { url: "https://edition.cnn.com/2026/09/24/sport/x", title: "Champions League draw", desc: "", at: Date.parse("2026-09-24T12:00:00Z") },
    { url: "https://edition.cnn.com/2026/09/20/old", title: "Trump and Saudi Arabia talks", desc: "", at: Date.parse("2026-09-20T12:00:00Z") },
  ];
  const got = ownCandidates(listing, ["Trump", "Houthis", "Saudi", "intervention", "talks"], at);
  assert.equal(got.length, 1);
  assert.match(got[0].title, /staying out of Saudi Arabia's war/);
});

test("an outlet an original was found at is learned once; one the desk reads is not", () => {
  const learned: Learned[] = [];
  const known = (h: string) => h === "cnn.com" || h === "x:war_cube";
  const meta = { lang: "French", country: "FR", from: "fp1", speaker: true };
  assert.equal(learnSource(learned, { url: "https://www.liberation.fr/international/x", source: "Libération" }, known, meta), true);
  assert.equal(learnSource(learned, { url: "https://www.liberation.fr/politique/y", source: "Libération" }, known, meta), false);
  assert.equal(learnSource(learned, { url: "https://cnn.com/a", source: "CNN" }, known, meta), false);
  assert.equal(learnSource(learned, { url: "https://x.com/EmmanuelMacron/status/9", source: "Emmanuel Macron" }, known, meta), true);
  assert.deepEqual(learned.map((l) => [l.site, l.kind]), [["liberation.fr", "site"], ["emmanuelmacron", "x"]]);
});

test("a relay is held while its original is looked for, and published from the relay after three hours; a second relay of the same words waits with it", async () => {
  const saved = new Map<string, unknown>();
  const store = { getJson: async (k: string) => saved.get(k) ?? null, putJson: async (k: string, v: unknown) => void saved.set(k, JSON.parse(JSON.stringify(v))) } as never;
  const realFetch = globalThis.fetch;
  // Nothing anywhere: every search comes back empty.
  globalThis.fetch = (async () => new Response("<rss></rss>", { status: 200 })) as typeof fetch;
  try {
    const t0 = Date.parse("2026-09-25T08:30:00Z");
    const card = (fp: string, source: string, url: string, summary: string): LiveReport =>
      ({ fp, source, url, summary, text: "", at: "2026-09-25T08:28:23Z", type: "diplomacy", live: true }) as LiveReport;
    const a = card("aqsa", "Al-Aqsa TV", "https://t.me/alagsa3agel/286628", "French President Emmanuel Macron: France will send soldiers and defense systems to Saudi Arabia to protect Yanbu facility");
    const held = new Set<string>();
    const text = new Map([[a.url, "قناة كان العبرية: الرئيس الفرنسي ماكرون: فرنسا سترسل جنودا وأنظمة دفاع إلى السعودية لحماية منشأة ينبع"]]);
    let late = await traceOrigins(store, [a], text, t0, [], { held });
    assert.deepEqual([...held], ["aqsa"]);
    assert.equal(late.length, 0);
    // Another channel's account of the same words, no citation of its own.
    const b = card("naya", "Naya", "https://t.me/naya_foriraq/91600", "Macron says France will send soldiers to Saudi Arabia to protect the Yanbu facility");
    const held2 = new Set<string>();
    late = await traceOrigins(store, [b], new Map([[b.url, "ماكرون: فرنسا سترسل جنودا لحماية ينبع"]]), t0 + 10 * 60_000, [], { held: held2 });
    assert.deepEqual([...held2], ["naya"]);
    // A third that does not name him, telling the same thing: it waits with the first.
    const c = card("mihwar", "Al-Mihwar", "https://t.me/Alomhoar/1", "France will send soldiers and defense systems to Saudi Arabia to protect the Yanbu facility");
    const held3 = new Set<string>();
    await traceOrigins(store, [c], new Map([[c.url, "فرنسا سترسل جنودا إلى السعودية لحماية ينبع"]]), t0 + 15 * 60_000, [], { held: held3 });
    assert.deepEqual([...held3], ["mihwar"]);
    // Three hours on, nothing found: the first goes out from its relay, the third with it.
    late = await traceOrigins(store, [], new Map(), t0 + HOLD_MS + 60_000, [], { held: new Set() });
    assert.deepEqual(late.map((r) => r.fp).sort(), ["aqsa", "mihwar"]);
    late = await traceOrigins(store, [], new Map(), t0 + 10 * 60_000 + HOLD_MS + 60_000, [], { held: new Set() });
    assert.deepEqual(late.map((r) => r.fp), ["naya"]);
    late = [{ fp: "aqsa", citing: "Emmanuel Macron" } as LiveReport];
    assert.equal(late.find((r) => r.fp === "aqsa")?.citing, "Emmanuel Macron");
    // And only once.
    late = await traceOrigins(store, [], new Map(), t0 + HOLD_MS + 40 * 60_000, [], { held: new Set() });
    assert.equal(late.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a leader's words are looked for in his own country's outlets, his office and the wires only", async () => {
  const { speakerOutlet } = await import("./originals.ts");
  assert.equal(speakerOutlet(macron, "www.liberation.fr"), true);
  assert.equal(speakerOutlet(macron, "elysee.fr"), true);
  assert.equal(speakerOutlet(macron, "www.reuters.com"), true);
  assert.equal(speakerOutlet(macron, "www.internazionale.it"), false);
  assert.equal(speakerOutlet(macron, "www.connaissancedesenergies.org"), false);
  assert.equal(speakerOutlet(SPEAKERS.find((s) => s.name === "Abbas Araghchi")!, "breakingthenews.net"), false);
});

test("only the cited outlet's own site is learned, never one that only carried the words, nor an Israeli one (25 Sep)", () => {
  const learned: Learned[] = [];
  const known = () => false;
  // UNICEF's figures found on Khabar, a minister's words on Fana: carriers, not sources.
  assert.equal(learnSource(learned, { url: "https://www.khabaragency.net/news253333.html", source: "وكالة خبر للأنباء" }, known, { lang: "English", from: "a", site: "unicef.org" }), false);
  assert.equal(learnSource(learned, { url: "https://www.fananews.com/language/en/x/", source: "Fana News -" }, known, { lang: "English", from: "b", site: "unicef.org" }), false);
  assert.equal(learnSource(learned, { url: "https://www.jfeed.com/news/houthis-eu", source: "JFeed" }, known, { lang: "English", from: "c", site: "jfeed.com" }), false);
  assert.equal(learnSource(learned, { url: "https://www.unicef.org/press-releases/hunger", source: "UNICEF -" }, known, { lang: "English", from: "d", site: "unicef.org" }), true);
  assert.deepEqual(learned.map((l) => [l.site, l.name, l.via]), [["unicef.org", "UNICEF", "own"]]);
});
