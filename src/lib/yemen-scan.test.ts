import assert from "node:assert/strict";
import { test } from "node:test";

import { digest } from "./desk/digest.ts";
import { gate } from "./desk/relevance.ts";
import { casualtyPhrase, countsIn, num, tidyHeadline, tierOf } from "./desk/wire-style.ts";

/* ------------------------------------------------------------------ *
 * The interest gate
 * ------------------------------------------------------------------ */

test("airborne early-warning patrols are noise, not an alert", () => {
  const v = gate({
    text:
      "نشاط مكثف لطائرات المراقبة والإنذار المبكر السعودية من طرازي King Air 350i وSaab 2000، مع تحليق 4 طائرات في الوقت نفسه",
    source: "Ali Bk",
    url: "https://t.me/Alibk3/1",
    agency: false,
  });
  assert.equal(v.keep, false);
  assert.equal(v.reason, "air-activity");
});

test("sirens over a named city are still an alert, despite the words 'early warning'", () => {
  const v = gate({
    text: "دوي صافرات الإنذار المبكر في جدة والطائف وينبع",
    source: "Al Hadath",
    url: "https://t.me/alhadath_brk/1",
    agency: false,
  });
  assert.equal(v.keep, true);
  assert.ok(v.tags.includes("alert"));
});

test("an aircraft that is shot down is news again", () => {
  const v = gate({
    text: "إسقاط طائرة استطلاع سعودية من طراز Saab 2000 فوق مأرب",
    source: "Al-Masirah",
    url: "https://t.me/almasirah2/1",
    agency: false,
  });
  assert.equal(v.keep, true);
});

test("rallies, sport and gold prices are dropped with a reason", () => {
  const rally = gate({ text: "مسيرات جماهيرية حاشدة في صنعاء دعما للقوات المسلحة", source: "Saba", url: "u", agency: false });
  assert.equal(rally.keep, false);
  assert.equal(rally.reason, "rally");

  const gold = gate({ text: "أسعار الذهب اليوم في عدن اليمن ترتفع", source: "Almashhad", url: "u", agency: false });
  assert.equal(gold.keep, false);
  assert.equal(gold.reason, "prices");
});

test("a bare breaking tag with no substance is dropped as vague", () => {
  const v = gate({ text: "عاجل | اليمن #عاجل 🔴🔴", source: "Sabereen News", url: "u", agency: false });
  assert.equal(v.keep, false);
  // "empty" is the slug now: a bare tag naming the theatre and nothing else
  // reports no event, so topicality alone must not carry it.
  assert.ok(
    ["vague", "thin", "empty"].includes(v.reason),
    `unexpected reason: ${v.reason}`,
  );
});

test("another theatre is dropped even when it borrows the vocabulary", () => {
  const bare = gate({ text: "قصف عنيف في دير الزور بسوريا", source: "Al-Mayadeen", url: "u", agency: false });
  assert.equal(bare.keep, false);

  // Hormuz is not this desk's waterway, but shipping warnings near Saudi
  // Arabia are adjacent enough that binning them outright would be a judgement
  // the evidence does not support. It stays OUT OF THE FEED and waits in the
  // tray, which is what the third outcome is for.
  const hormuz = gate({
    text: "توتر في مضيق هرمز وتحذيرات للملاحة قرب السعودية",
    source: "Al-Mayadeen",
    url: "u",
    agency: false,
  });
  assert.equal(hormuz.keep, false, "must not reach the feed");
  assert.equal(hormuz.outcome, "tray");
});

test("a Saudi capital named beside ground fighting is metonymy, not a battlefield", () => {
  // "الرياض" here is the Saudi government, the way "Washington" is the
  // administration. Pinning it put Houthi-vs-government ground battles inside
  // Riyadh, on the map and in the headline.
  const metonym = digest(
    "Almashhad",
    "اشتباكات عنيفة بين قوات الحوثي وقوات الحكومة، والرياض تتابع الوضع عن كثب",
  );
  assert.equal(metonym.ok, true);
  assert.equal(metonym.type, "combat");
  assert.deepEqual(metonym.places, [], "ground combat must not pin to a Saudi interior city");
  assert.ok(!/Riyadh/i.test(metonym.headline), `headline named Riyadh: ${metonym.headline}`);

  // Real Yemeni ground fighting still pins.
  const yemen = digest("Almashhad", "اشتباكات عنيفة بين قوات الحوثي وقوات الحكومة في تعز والضالع");
  assert.deepEqual(
    yemen.places.map((p) => p.name),
    ["Taiz", "Al-Dhale"],
  );

  // Cross-border ground action on the frontier is real and stays eligible.
  const frontier = digest("Almashhad", "اشتباكات بين قوات الحوثي والقوات السعودية في جازان ونجران");
  assert.deepEqual(
    frontier.places.map((p) => p.name),
    ["Jazan", "Najran"],
  );

  // The narrowing must not blind the desk to the Saudi home front: alerts are
  // strikes, not ground combat, and must still reach the map.
  const alert = digest("Al Hadath", "صفارات الإنذار تدوي في الرياض والخرج مع سماع دوي انفجارات");
  assert.equal(alert.type, "strike");
  assert.deepEqual(
    alert.places.map((p) => p.name),
    ["Riyadh", "Al-Kharj"],
  );
});

/* ------------------------------------------------------------------ *
 * Wire style mechanics
 * ------------------------------------------------------------------ */

test("numbers follow AP: words to nine, figures from 10", () => {
  assert.equal(num(4), "four");
  assert.equal(num(9), "nine");
  assert.equal(num(10), "10");
  assert.equal(num(112), "112");
});

test("casualty phrases always carry 'at least'", () => {
  const c = countsIn("مقتل 4 وإصابة 12");
  assert.equal(casualtyPhrase(c), "at least four killed and 12 wounded");
});

test("headlines lose their terminal stop and keep sentence case", () => {
  assert.equal(tidyHeadline("reports of a drone launch towards Riyadh."), "Reports of a drone launch towards Riyadh");
});

test("attribution tier follows the outlet", () => {
  assert.equal(tierOf("Reuters"), "agency");
  assert.equal(tierOf("Al-Masirah"), "claim");
  assert.equal(tierOf("Some Telegram Channel"), "unverified");
});

/* ------------------------------------------------------------------ *
 * The composer
 * ------------------------------------------------------------------ */

test("a single-source launch is phrased as a report, not a fact", () => {
  const d = digest("Sabereen News", "إطلاق صاروخ باليستي باتجاه الرياض", "houthi");
  assert.equal(d.ok, true);
  assert.equal(d.type, "strike");
  assert.match(d.headline, /^Reports of a ballistic missile launch towards Riyadh/);
  assert.doesNotMatch(d.headline, /\.$/);
  // The hedge lives in the wording ("was reported launched"), not in a trailing
  // "could not be independently verified" line — that boilerplate was cut as
  // padding that told the reader nothing.
  assert.match(d.body, /was reported launched/);
  assert.doesNotMatch(d.body, /could not be independently verified/);
  assert.doesNotMatch(d.body, /Sabereen News/, "the card already names the source");
});

test("a condemnation of a strike is a statement, not the desk's own launch report", () => {
  // The desk read "Qatar condemns the Houthi missile attack on Riyadh" and
  // published "Reports of a ballistic missile launch towards Riyadh" — turning
  // somebody's reaction into its own account of an event it had no report of.
  const d = digest(
    "Al-Araby Television",
    "دولة قطر تعلن إدانتها استهداف جماعة الحوثي لمدينة الرياض بصاروخ باليستي",
  );
  assert.notEqual(d.type, "strike", "a reaction must never be published as a strike");
  assert.doesNotMatch(d.headline, /launch/i);

  // Word order is the tell: when the event leads and the condemnation follows,
  // the event is still the story.
  const event = digest("Almashhad", "غارات جوية استهدفت مواقع في مأرب، والحكومة أدانت القصف");
  assert.equal(event.type, "strike");
});

test("a wire service reporting the same launch is stated, not hedged", () => {
  const d = digest(
    "Reuters",
    "Houthi forces launched a ballistic missile towards Riyadh, Saudi officials said, and air defences engaged it.",
    "intl",
  );
  assert.equal(d.ok, true);
  assert.equal(d.tier, "agency");
  assert.doesNotMatch(d.headline, /^Reports of/);
});

test("Saudi sirens become one alert line naming the cities", () => {
  const d = digest("Al Hadath", "دوي صافرات الإنذار في جدة والطائف وينبع وخميس مشيط", "gov");
  assert.equal(d.ok, true);
  assert.equal(d.type, "strike");
  assert.match(d.headline, /Jeddah/);
  assert.match(d.headline, /Taif/);
  assert.match(d.headline, /alert|siren/i);
});

test("clashes name both sides and the place", () => {
  const d = digest("Almashhad", "اشتباكات بين ألوية العمالقة والحوثيين في باب المندب وكهبوب", "");
  assert.equal(d.ok, true);
  assert.equal(d.type, "combat");
  assert.match(d.headline, /Giants Brigades/);
  assert.match(d.headline, /Kahbub|Bab al-Mandab/);
});

test("air strikes on Houthi positions read as a strike, not a clash", () => {
  const single = digest("Alsahwa", "غارات جوية على مواقع الحوثيين في الوازعية وتعز", "");
  assert.equal(single.ok, true);
  assert.equal(single.type, "strike");
  // One unaffiliated outlet: the report is the subject, not the strike.
  assert.match(single.headline, /^Reports of air strikes on Houthi positions/);

  const wire = digest("Reuters", "غارات جوية على مواقع الحوثيين في الوازعية وتعز", "intl");
  assert.match(wire.headline, /^Air strikes hit Houthi positions/);
});

test("a spokesman's foiling claim stays a statement and is never pinned", () => {
  const d = digest(
    "Al-Thawrah",
    "العميد يحيى سريع: إفشال محاولات إجرامية في العاصمة صنعاء قام بها العدو السعودي مصبوغة بالصبغة الداعشية ولن تمر دون رد.",
    "houthi",
  );
  assert.equal(d.ok, true);
  assert.equal(d.type, "statement");
  assert.match(d.headline, /^Saree: /, "the speaker leads the card");
  assert.doesNotMatch(d.body, /^[A-Z ]+ —/, "a statement carries no dateline");
  assert.equal(d.places.length, 0, "statements never get a map pin");
});

test("no source-language text ever reaches the published copy", () => {
  const samples = [
    ["Almashhad", "اشتباكات عنيفة في الوازعية غرب تعز ومقتل 12"],
    ["Al Hadath", "دوي صافرات الإنذار في جازان ونجران"],
    ["Saba", "إطلاق مسيّرة باتجاه ميناء المخا"],
  ];
  for (const [src, text] of samples) {
    const d = digest(src, text, "");
    if (!d.ok) continue;
    assert.doesNotMatch(d.headline, /[؀-ۿ֐-׿]/, `headline leaked source script: ${d.headline}`);
    assert.doesNotMatch(d.body, /[؀-ۿ֐-׿]/, `body leaked source script: ${d.body}`);
  }
});

test("partisan vocabulary is neutralised", () => {
  const d = digest("Al-Masirah", "قصف العدو السعودي على العاصمة المحتلة صنعاء بعشر غارات", "houthi");
  if (d.ok) {
    assert.doesNotMatch(d.body, /enemy/i);
    assert.doesNotMatch(d.body, /occupied capital/i);
  }
});

test("a drone launch towards a Yemeni port is a strike with a place", () => {
  const d = digest("Saba", "إطلاق مسيّرة باتجاه ميناء الحديدة", "houthi");
  assert.equal(d.ok, true);
  assert.ok(["strike", "port"].includes(d.type));
  assert.ok(d.places.some((p) => p.name === "Hodeidah"));
});

test("only copies of one event fold into one card", async () => {
  const { sameWords } = await import("./desk/copies.ts");
  // Two outlets on the same strikes: one card.
  assert.ok(sameWords("Saudi air strike targets Haifan district in Taiz", "Saudi jets launch air strike on Haifan district in Taiz"));
  // Different events on the same front: separate cards (the lost Haifan strikes).
  assert.ok(!sameWords("Saudi strikes hit school and areas in Hayfan district", "Abyan sends over 1,400 fighters to frontlines in Taiz and Al-Subaiha"));
  // Two lines of one speech: separate cards, the speaker prefix does not count.
  assert.ok(!sameWords("Houthi leader: Saudi Arabia will pay a price if the siege continues", "Houthi leader: our forces are ready to strike Saudi oil facilities"));
});

test("outlets' takes on one story fold across scans; separate speech lines do not", async () => {
  const { sameStory } = await import("./desk/copies.ts");
  const call = { summary: "Reuters: phone call took place between Trump and Rashad al-Alimi", text: "A phone call took place between US President Donald Trump and Yemeni Presidential Leadership Council head Rashad al-Alimi, Reuters reported." };
  const aid = { summary: "Trump: did not commit to military aid requested by Rashad al-Alimi", text: "US President Donald Trump did not commit to providing military aid requested by Rashad al-Alimi during a phone call, sources told Reuters." };
  const spoke = { summary: "Trump: spoke with Yemeni Presidential Leadership Council head Rashad al-Alimi", text: "US President Donald Trump held a phone call with Yemeni Presidential Leadership Council head Rashad al-Alimi on Sunday to discuss military developments in Yemen." };
  assert.ok(sameStory(call, aid));
  assert.ok(sameStory(call, spoke));
  const l1 = { summary: "Houthi leader: Saudi Arabia opened airports to Israeli reconnaissance planes heading to Yemen", text: "Houthi leader stated that Saudi Arabia opened its airports to Israeli reconnaissance planes to take off toward Yemen." };
  const l2 = { summary: "Houthi leader: Saudi Arabia made every effort to intercept missiles and drones launched toward Israel", text: "Houthi leader stated that Saudi Arabia made every effort to intercept the missiles and drone aircraft launched toward occupied Palestine against Israeli forces." };
  assert.ok(!sameStory(l1, l2));
});

test("a report the reader marks a duplicate joins the published card's Also", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const home = { ...base, fp: "a", url: "https://t.me/naya/1", source: "Naya", at: "2026-09-21T14:00:00Z", type: "strike", summary: "Saudi jets target popular market in Dhubab" };
  const dup = { ...base, fp: "b", url: "https://t.me/alibk/2", source: "Ali Bk", at: "2026-09-21T14:07:00Z", type: "strike", summary: "Saudi air strike hits popular market near Bab al-Mandab", duplicateOf: "a" };
  const other = { ...base, fp: "c", url: "https://t.me/x/3", source: "X", at: "2026-09-21T14:08:00Z", type: "strike", summary: "Saudi strike on Haifan" };
  const reports = [home, dup, other] as never[];
  foldIntoPublished(reports, new Set(["a"]));
  assert.deepEqual((reports as { fp: string }[]).map((r) => r.fp), ["a", "c"]);
  assert.deepEqual((home as { alsoReportedBy?: unknown }).alsoReportedBy, [{ source: "Ali Bk", url: "https://t.me/alibk/2" }]);
});

test("another outlet retelling a stored card joins its Also, even as a follow-up", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, score: 1, tags: [] } as const;
  const home = { ...base, fp: "a", url: "https://www.reuters.com/x", source: "Reuters", at: "2026-09-21T13:28:00Z", type: "diplomacy", summary: "Trump made no pledge of military support to Yemen's president in a call on Houthi advances, sources say", text: "US President Donald Trump spoke by phone with Yemen's president on Sunday about the Houthi advances." };
  const relay = { ...base, fp: "b", url: "https://t.me/shin_persian/10302", source: "Shin Persian", at: "2026-09-21T14:56:00Z", type: "diplomacy", summary: "Trump made no pledge of military support to Yemen's president in a call, sources say", text: "US President Donald Trump spoke with Yemen's president on Sunday.", replyTo: "a" };
  const reports = [relay] as never[];
  const touched = foldIntoPublished(reports, new Set(), [home] as never[]);
  assert.equal((reports as unknown[]).length, 0);
  assert.equal((touched[0] as { fp: string }).fp, "a");
  assert.deepEqual((home as { alsoReportedBy?: unknown }).alsoReportedBy, [{ source: "Shin Persian", url: "https://t.me/shin_persian/10302" }]);
});

test("a card written from the original source takes no Also from the outlets relaying it", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, score: 1, tags: [] } as const;
  const home = { ...base, fp: "live-t-me-naya-foriraq-91160", url: "https://www.reuters.com/x", source: "Reuters", at: "2026-09-21T13:28:00Z", type: "diplomacy", summary: "Trump made no pledge of military support to Yemen's president in a call on Houthi advances, sources say", text: "US President Donald Trump spoke by phone with Yemen's president on Sunday about the Houthi advances." };
  const relay = { ...base, fp: "b", url: "https://t.me/shin_persian/10302", source: "Shin Persian", at: "2026-09-21T14:56:00Z", type: "diplomacy", summary: "Trump made no pledge of military support to Yemen's president in a call, sources say", text: "US President Donald Trump spoke with Yemen's president on Sunday.", duplicateOf: "live-t-me-naya-foriraq-91160" };
  const reports = [relay] as never[];
  foldIntoPublished(reports, new Set(), [home] as never[]);
  assert.equal((reports as unknown[]).length, 0);
  assert.equal((home as { alsoReportedBy?: unknown }).alsoReportedBy, undefined);
});

test("a card links the article itself: no tracking parameters, never a section page", async () => {
  const { cleanUrl, isSectionFront } = await import("./desk/gnews.ts");
  assert.equal(cleanUrl("https://www.nytimes.com/2026/09/20/us/politics/x.html?smid=url-share&utm_source=tw#top"), "https://www.nytimes.com/2026/09/20/us/politics/x.html");
  assert.equal(cleanUrl("https://www.almashhad.news/news/495814?page=2"), "https://www.almashhad.news/news/495814?page=2");
  assert.ok(isSectionFront("https://www.nytimes.com/spotlight/donald-trump?page"));
  assert.ok(isSectionFront("https://www.reuters.com/world/"));
  assert.ok(!isSectionFront("https://www.reuters.com/world/middle-east/trump-call-2026-09-21/"));
  assert.ok(!isSectionFront("https://www.almashhad.news/news/495814"));
  assert.ok(!isSectionFront("https://www.spa.gov.sa/w2680640"));
});

test("one post forwarded by two channels has one copy key", async () => {
  const { copyKey } = await import("./desk/copies.ts");
  const a = "عضو المكتب السياسي لحركة أنصار الله ضيف الله الشامي: الطائرات السعودية تستهدف سوقاً شعبياً في مديرية ذو باب في محافظة تعز.";
  assert.equal(copyKey(`🚫 ${a}`), copyKey(a));
  assert.equal(copyKey(`🔴 عاجل | ${a} #اليمن https://t.me/x`), copyKey(a));
  assert.notEqual(copyKey(a), copyKey(a.replace("ذو باب", "حيفان")));
  const { placesIn } = await import("./desk/gazetteer.ts");
  assert.ok(placesIn(a).some((p) => p.name === "Dhubab"));
});

test("each new line of a speech replies to the speaker's previous line", async () => {
  const { threadSpeeches } = await import("./yemen-scan.server.ts");
  const line = (fp: string, at: string, summary: string) => ({ live: true, text: "", score: 1, tags: [], fp, url: `https://t.me/almasirah2/${fp}`, source: "Al-Masirah", type: "statement", at, summary });
  const a = line("1", "2026-09-21T13:45:00Z", "Houthi leader: Saudi Arabia took the wrong path");
  const b = line("2", "2026-09-21T13:46:00Z", "Houthi leader: Saudi Arabia opened airports to Israeli planes");
  const c = line("3", "2026-09-21T13:48:00Z", "Houthi leader: Saudi Arabia tried to intercept missiles");
  const late = line("4", "2026-09-21T15:30:00Z", "Houthi leader: a new speech");
  const other = line("5", "2026-09-21T13:47:00Z", "Saree: forces struck Riyadh");
  const all = [c, a, other, late, b] as never[];
  threadSpeeches(all, new Set(["1"]));
  assert.equal((b as { replyTo?: string }).replyTo, "1");
  assert.equal((c as { replyTo?: string }).replyTo, "2");
  assert.equal((late as { replyTo?: string }).replyTo, undefined);
  assert.equal((other as { replyTo?: string }).replyTo, undefined);
});

test("a channel citing the WSJ has the WSJ feed read next tick, not at its hour", async () => {
  const { hintOutlets } = await import("./yemen-scan.server.ts");
  const now = Date.parse("2026-09-21T16:00:00Z");
  const state = { scannedOnce: true, lastScanAt: { "web:wsj": now - 3600_000 } as Record<string, number> };
  const hits = [{ text: "وول ستريت جورنال: واشنطن تدرس ضربات ضد الحوثيين", source: "Al-Masirah", url: "https://t.me/almasirah2/1", fromTg: true }];
  assert.deepEqual(hintOutlets(state, hits, now), ["wsj"]);
  assert.equal(state.lastScanAt["hint:web:wsj"], now);
  assert.deepEqual(hintOutlets(state, hits, now + 60_000), []);
});

test("one speaker key per person, whatever the title", async () => {
  const { namedSpeaker } = await import("./yemen-scan.server.ts");
  for (const h of ["Trump: we will defend our allies", "US President Donald Trump: talks go on", "President Trump says strikes are off"]) assert.equal(namedSpeaker(h), "trump");
  assert.equal(namedSpeaker("Saudi Crown Prince Mohammed bin Salman: no truce"), "mbs");
  assert.equal(namedSpeaker("Houthi leader: our demands stand"), "houthi leader");
});

test("a Telegram reply keeps its own link, and names the post it replies to", async () => {
  const { parseTelegram } = await import("./yemen-scan.server.ts");
  const html =
    '<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="naya_foriraq/91168">' +
    '<a class="tgme_widget_message_reply user-color-default" href="https://t.me/naya_foriraq/91167"><div>earlier</div></a>' +
    '<div class="tgme_widget_message_text js-message_text">حصيلة القصف على السوق الشعبي في ذباب ترتفع</div>' +
    '<a class="tgme_widget_message_date" href="https://t.me/naya_foriraq/91168"><time datetime="2026-09-21T10:00:00+00:00"></time></a></div>';
  const [h] = parseTelegram(html, { id: "naya_foriraq", name: "Naya", lean: "houthi" });
  assert.equal(h.url, "https://t.me/naya_foriraq/91168");
  assert.equal(h.replyUrl, "https://t.me/naya_foriraq/91167");
});

test("the same outlet following up within minutes replies to its earlier card", async () => {
  const { linkFollowUps } = await import("./yemen-scan.server.ts");
  const a = { fp: "a", source: "Al Hadath", at: "2026-09-21T20:53:00+03:00", summary: "Indications of fuel shortages in Sanaa, sources say", type: "economy" };
  const b = { fp: "b", source: "Al Hadath", at: "2026-09-21T20:54:00+03:00", summary: "Houthi forces begin allocating fuel stocks for military operations", type: "economy" };
  const c = { fp: "c", source: "Al Hadath", at: "2026-09-21T20:55:00+03:00", summary: "Saudi air raid targets Al-Hazm district", type: "strike" };
  const pool = [a, b, c] as never[];
  linkFollowUps([b, c] as never[], pool);
  assert.equal((b as { replyTo?: string }).replyTo, "a");
  assert.equal((c as { replyTo?: string }).replyTo, undefined);
});

test("a card quoting a US official has his own sources searched this tick, once an hour", async () => {
  const { speakerSearches } = await import("./yemen-scan.server.ts");
  const now = Date.parse("2026-09-21T20:00:00Z");
  const card = { fp: "v", source: "Al Jazeera", at: "2026-09-21T19:50:00Z", summary: "Vance: the US will keep Red Sea shipping open", type: "statement" };
  const state = { scannedOnce: true, lastScanAt: {} as Record<string, number> };
  const feeds = speakerSearches([card] as never[], state as never, now);
  assert.equal(feeds.length, 1);
  assert.match(decodeURIComponent(feeds[0].url), /"Vance" \(Yemen OR Houthi/);
  state.lastScanAt["web:spk-vance"] = now - 10 * 60_000;
  assert.equal(speakerSearches([card] as never[], state as never, now).length, 0);
});

test("another outlet's late lines of the Houthi leader's speech join its thread", async () => {
  const { threadSpeeches } = await import("./yemen-scan.server.ts");
  const l1 = { fp: "m1", source: "Al-Masirah", at: "2026-09-21T17:30:00+03:00", summary: "Houthi leader: Saudi Arabia must end the blockade", type: "statement" };
  const l2 = { fp: "s1", source: "Saba", at: "2026-09-21T21:17:00+03:00", summary: "Houthi leader: Makkah is an Islamic landmark", type: "statement" };
  threadSpeeches([l1, l2] as never[], new Set());
  assert.equal((l2 as { replyTo?: string }).replyTo, "m1");
});

test("capturing a commander is ground fighting; a jet raid and an alert are the launch/strike/alert kind", () => {
  assert.equal(digest("Almashhad", "Giants Brigades capture Houthi battalion commander in Kahbub front").type, "combat");
  assert.equal(digest("Almashhad", "القبض على قيادي حوثي في جبهة كهبوب").type, "combat");
  assert.equal(digest("Al-Masirah", "Saudi warplanes carry out an air raid on Al-Hazm district in Al-Jawf").type, "strike");
  assert.notEqual(digest("Almashhad", "أسرة نازحة تصل إلى مأرب").type, "combat");
});

test("one speaker's lines to the same outlet thread, statements included", async () => {
  const { linkFollowUps } = await import("./yemen-scan.server.ts");
  type LiveReport = { fp: string; source: string; at: string; summary: string; type: string; url: string; replyTo?: string };
  const base = { source: "Al Arabiya Breaking", url: "u", type: "statement" } as unknown as LiveReport;
  const a = { ...base, fp: "a", at: "2026-09-21T13:21:00Z", summary: "UN aid chief Tom Fletcher: humanitarian needs in Yemen are growing rapidly" } as LiveReport;
  const b = { ...base, fp: "b", at: "2026-09-21T13:22:00Z", summary: "UN aid chief Tom Fletcher: we fear rising hunger levels" } as LiveReport;
  const c = { ...base, fp: "c", at: "2026-09-21T13:23:00Z", summary: "Yemen's foreign minister: talks must resume" } as LiveReport;
  linkFollowUps([b, c] as never[], [a, b, c] as never[]);
  assert.equal(b.replyTo, "a");
  assert.equal(c.replyTo, undefined);
});
