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

  // Hormuz is not this desk's waterway. It used to wait in the tray as
  // "adjacent"; since 23 September the Gulf waters are another theatre unless
  // the item names Yemen or the Houthis, and this one does not.
  const hormuz = gate({
    text: "توتر في مضيق هرمز وتحذيرات للملاحة قرب السعودية",
    source: "Al-Mayadeen",
    url: "u",
    agency: false,
  });
  assert.equal(hormuz.keep, false, "must not reach the feed");
  assert.equal(hormuz.outcome, "exclude");
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
  assert.deepEqual((home as { alsoReportedBy?: unknown }).alsoReportedBy, [{ source: "Ali Bk", url: "https://t.me/alibk/2", summary: "Saudi air strike hits popular market near Bab al-Mandab" }]);
});

test("the reader's duplicate is refused when hours apart or its toll disagrees", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const home = { ...base, fp: "a", url: "https://www.almashhad.news/news/496403", source: "Almashhad", at: "2026-09-24T21:10:27Z", type: "casualties", summary: "Houthi forces suffer 693 deaths since July including 159 officers" };
  const unicef = { ...base, fp: "b", url: "https://t.me/AjaNews/513979", source: "Al Jazeera", at: "2026-09-25T10:44:22Z", type: "casualties", summary: "UNICEF: 15 children killed, 14 wounded and 3 missing in Yemen since September 3", duplicateOf: "a" };
  const reports = [home, unicef] as never[];
  foldIntoPublished(reports, new Set(["a"]));
  assert.deepEqual((reports as { fp: string }[]).map((r) => r.fp), ["a", "b"]);
  assert.equal((home as { alsoReportedBy?: unknown }).alsoReportedBy, undefined);
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
  assert.deepEqual((home as { alsoReportedBy?: unknown }).alsoReportedBy, [{ source: "Shin Persian", url: "https://t.me/shin_persian/10302", summary: "Trump made no pledge of military support to Yemen's president in a call, sources say" }]);
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

test("the same outlet following up within minutes replies to its earlier card on the same spot, not on a shared word", async () => {
  const { linkFollowUps } = await import("./yemen-scan.server.ts");
  const a = { fp: "a", source: "Almashhad", at: "2026-09-24T21:00:00Z", summary: "Yemeni government forces foil Houthi attacks and recapture Jabal Qurfan in Taiz", type: "combat" };
  const b = { fp: "b", source: "Almashhad", at: "2026-09-24T21:10:00Z", summary: "Yemeni government forces recapture Jabal Qurfan in Taiz and kill 5 Houthi fighters", type: "combat" };
  const c = { fp: "c", source: "Almashhad", at: "2026-09-24T21:12:00Z", summary: "Houthi artillery shelling hits Wadi Khar in Beihan, Shabwah", type: "combat" };
  const d = { fp: "d", source: "Almashhad", at: "2026-09-24T21:05:00Z", summary: "Yemeni government forces thwart Houthi infiltration and secure Wadi Al-Muqatrah in Haifan", type: "combat" };
  const pool = [a, b, c, d] as never[];
  linkFollowUps([b, c] as never[], pool);
  assert.equal((b as { replyTo?: string }).replyTo, "a");
  assert.equal((c as { replyTo?: string }).replyTo, undefined, "\"Wadi\" in both is not one place");
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

test("two outlets on one strike, written up in the same words, make one card", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const headline = "Houthi sniper unit targets Saudi force concentrations in Jizan";
  // Neither is a statement, so the story test never looked at them; neither
  // shares a copyKey, because the two channels wrote different Arabic.
  const first = { ...base, fp: "a", url: "https://t.me/Alomhoar/1", source: "Al-Mihwar", at: "2026-09-22T18:46:00Z", type: "combat", summary: headline };
  const second = { ...base, fp: "b", url: "https://t.me/SabrenNewss/2", source: "Sabereen News", at: "2026-09-22T18:47:00Z", type: "combat", summary: headline };
  const reports = [first, second] as never[];
  foldIntoPublished(reports, new Set());
  assert.equal(reports.length, 1, "the second outlet does not get its own card");
  assert.equal((reports[0] as { fp: string }).fp, "a", "the first to report keeps the card");
  assert.deepEqual(
    ((reports[0] as { alsoReportedBy?: { source: string }[] }).alsoReportedBy ?? []).map((x) => x.source),
    ["Sabereen News"],
    "the second outlet is credited rather than dropped",
  );
});

test("one headline twice, hours apart, is two events and stays two cards", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const headline = "Saudi warplanes strike Haifan district in Taiz";
  const morning = { ...base, fp: "a", url: "https://t.me/Alomhoar/1", source: "Al-Mihwar", at: "2026-09-21T10:47:00Z", type: "strike", summary: headline };
  const afternoon = { ...base, fp: "b", url: "https://t.me/SabrenNewss/2", source: "Sabereen News", at: "2026-09-21T13:59:00Z", type: "strike", summary: headline };
  const reports = [morning, afternoon] as never[];
  foldIntoPublished(reports, new Set());
  assert.equal(reports.length, 2, "a second strike on one district is not a copy of the first");
});

test("a newspaper's edition post is cut up, so one Yemen story is not judged by eleven Lebanese ones", async () => {
  const { splitDigest } = await import("./yemen-scan.server.ts");
  const edition = [
    "📰 غلاف «الأخبار» اليوم الأربعاء 23 أيلول 2026",
    "◼️نزار نمر | ترامب ملك الحروب الجانبية: طردهم فأقصوه",
    "◼️ ميسم رزق | من يقرّر هُويات جنود لبنان: قيادة الجيش أم إسرائيل؟",
    "◼️ التشكيلات القضائية: محاصصة بين عبود والحاج والقصر",
    "◼️ غارات سعودية على صنعاء تقتل عشرة مدنيين في حي سكني مكتظ",
  ].join("\n\n");
  const pieces = splitDigest(edition, []);
  assert.equal(pieces.length, 1, "only the story about this war goes forward");
  assert.match(pieces[0].text, /صنعاء/, "and it is the one naming Sanaa");

  // A post already about this war is one report, not several.
  const ours = ["◼️ غارات على صنعاء تقتل عشرة مدنيين", "◼️ اشتباكات في تعز بين القوات الحكومية والحوثيين", "◼️ السعودية تعلن اعتراض صاروخ فوق جازان"].join("\n\n");
  assert.equal(splitDigest(ours, []).length, 0, "a post that is all ours is left whole");

  // An ordinary field report is untouched.
  assert.equal(splitDigest("عاجل | غارة سعودية على مديرية حيفان في تعز", []).length, 0);
});

test("the movement's own outlet takes the card from the paper that relayed it", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, score: 40, tags: [] } as const;
  // Al-Akhbar, a Lebanese paper on their side, reports it first and thinly.
  const relay = { ...base, fp: "a", url: "https://www.al-akhbar.com/x/1", source: "Al-Akhbar", at: "2026-09-22T17:00:00Z", type: "statement", summary: "Houthi spokesperson: Saudi strikes hit a prison in Al-Jawf", text: "" };
  // Al-Masirah, their own channel, carries the same statement in full.
  const own = { ...base, fp: "b", url: "https://t.me/almasirah2/1", source: "Al-Masirah", at: "2026-09-22T17:20:00Z", type: "statement", summary: "Houthi spokesperson: Saudi strikes hit a prison in Al-Jawf", text: "Nine people were killed in the strike on the facility, the spokesperson said." };
  const reports = [relay, own] as never[];
  foldIntoPublished(reports, new Set());
  assert.equal(reports.length, 1, "one statement, one card");
  const card = reports[0] as { fp: string; source: string; text?: string; alsoReportedBy?: { source: string }[]; tags?: string[] };
  assert.equal(card.fp, "a", "the card keeps its identity and its place in the feed");
  assert.equal(card.source, "Al-Masirah", "but it is now the movement's own outlet that carries it");
  assert.match(String(card.text), /Nine people/, "with their fuller version of the words");
  // Written from the original now: the relay is no "Also" (user, 3 Oct, 07:09).
  assert.deepEqual((card.alsoReportedBy ?? []).map((x) => x.source), [], "the card from the original carries no Also");
  assert.ok(card.tags?.includes("lead-swap"), "and the store is told to rewrite the stored row");
});

test("a sympathetic paper does not take a card from the movement's own outlet", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, score: 40, tags: [] } as const;
  const own = { ...base, fp: "a", url: "https://t.me/almasirah2/1", source: "Al-Masirah", at: "2026-09-22T17:00:00Z", type: "statement", summary: "Houthi spokesperson: Saudi strikes hit a prison in Al-Jawf", text: "Nine killed." };
  const relay = { ...base, fp: "b", url: "https://www.al-akhbar.com/x/1", source: "Al-Akhbar", at: "2026-09-22T17:20:00Z", type: "statement", summary: "Houthi spokesperson: Saudi strikes hit a prison in Al-Jawf", text: "Nine killed." };
  const reports = [own, relay] as never[];
  foldIntoPublished(reports, new Set());
  assert.equal(reports.length, 1);
  assert.equal((reports[0] as { source: string }).source, "Al-Masirah", "the original keeps the card");
});

/* ------------------------------------------------------------------ *
 * Folding one event told by several outlets in different words
 * ------------------------------------------------------------------ */

const card = (fp: string, source: string, at: string, type: string, summary: string, extra: Record<string, unknown> = {}) => ({
  live: true, text: "", score: 1, tags: [], fp, url: `https://t.me/${source.replace(/\W/g, "")}/${fp}`, source, at, type, summary, ...extra,
});
const HAIFAN = { place: "Haifan", lat: 13.28, lng: 44.27 };

test("figures, not aircraft or years: numbersIn, numbersClash, countedOrNamed", async () => {
  const { numbersIn, numbersClash, countedOrNamed, casualtyCount } = await import("./desk/copies.ts");
  assert.deepEqual(numbersIn("F-15 and MQ-9 over Mocha in 2026; 22 vessels crossed"), [22]);
  assert.deepEqual(casualtyCount("at least 12 people killed and 30 wounded"), [12, 30]);
  assert.ok(numbersClash("12 killed in strike on Haifan", "17 killed in strike on Haifan"));
  assert.ok(numbersClash("Kpler: 22 vessels crossed Bab al-Mandab", "Kpler: 31 vessels crossed Bab al-Mandab"));
  assert.ok(!numbersClash("12 killed in strike on Haifan", "Strike on Haifan kills 12 killed"));
  assert.ok(countedOrNamed("A Wing Loong II was downed over Mocha"));
  assert.ok(!countedOrNamed("Saudi warplanes strike Haifan district in Taiz"));
});

test("a siren is an alert however it is worded; an impact or a lifted alert is not", async () => {
  const { alertCities } = await import("./desk/copies.ts");
  assert.deepEqual(alertCities({ summary: "Air raid sirens sound in Jeddah, Saudi Arabia" }), ["jeddah"]);
  assert.deepEqual(alertCities({ summary: "Saudi Arabia activates siren mode in Makkah province" }), ["makkah"]);
  assert.deepEqual(alertCities({ summary: "Saudi Civil Defense: Warning alerts issued for Makkah, Taif, Jeddah, Yanbu and Tabuk" }), ["jeddah", "makkah", "taif", "yanbu", "tabuk"]);
  assert.equal(alertCities({ summary: "Sirens sound as a missile hits Jazan" }), null);
  assert.equal(alertCities({ summary: "Saudi civil defence lifts security alert in Najran" }), null);
  assert.equal(alertCities({ summary: "Sirens sound in Tel Aviv" }), null);
});

test("an identical headline with a figure folds hours later; a plain one does not", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const h = "Kpler data: 22 commodity vessels crossed Bab al-Mandab on Tuesday";
  const reports = [card("a", "Asharq Al-Awsat", "2026-09-22T08:00:00Z", "economy", h), card("b", "Naya", "2026-09-22T10:10:00Z", "economy", h)] as never[];
  foldIntoPublished(reports, new Set());
  assert.equal(reports.length, 1);
  const w = "A Wing Loong II was shot down over Mocha";
  const two = [card("c", "Yahya Saree", "2026-09-22T06:00:00Z", "strike", w), card("d", "Al-Mihwar", "2026-09-22T11:14:00Z", "strike", w)] as never[];
  foldIntoPublished(two, new Set());
  assert.equal(two.length, 1);
});

test("one siren burst from several outlets folds by city; a new city or a later burst is its own card", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const taif = card("a", "Ali Bk", "2026-09-24T10:23:00Z", "strike", "Air raid alerts sound over Taif");
  const list = card("b", "Al-Araby TV", "2026-09-24T10:27:00Z", "strike", "Saudi Civil Defense: Warning alerts issued for Makkah, Taif, Jeddah, Yanbu and Tabuk");
  const jeddah = card("c", "Sabereen News", "2026-09-24T10:29:00Z", "strike", "Air raid sirens sound in Jeddah, Saudi Arabia");
  const later = card("d", "Naya", "2026-09-24T10:33:00Z", "strike", "Sirens sound in Taif");
  const impact = card("e", "Al-Mihwar", "2026-09-24T10:28:00Z", "strike", "Explosions sound in Taif, Saudi Arabia, following ballistic missile launches");
  const reports = [taif, list, jeddah, later, impact] as never[];
  foldIntoPublished(reports, new Set());
  assert.deepEqual((reports as { fp: string }[]).map((r) => r.fp).sort(), ["a", "c", "d", "e"]);
  assert.deepEqual((taif as { alsoReportedBy?: { source: string; summary?: string }[] }).alsoReportedBy?.map((x) => x.source), ["Al-Araby TV"]);
});

test("two outlets on one strike, no words in common, one spot, minutes apart: one card", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const a = card("a", "Al-Mihwar", "2026-09-22T10:00:00Z", "strike", "Saudi jets bomb Haifan", HAIFAN);
  const b = card("b", "Sabereen News", "2026-09-22T10:09:00Z", "strike", "Air raid hits district in Taiz countryside", { ...HAIFAN, lat: 13.3 });
  const reports = [a, b] as never[];
  foldIntoPublished(reports, new Set());
  assert.equal(reports.length, 1);
  assert.equal((a as { alsoReportedBy?: { summary?: string }[] }).alsoReportedBy?.[0].summary, "Air raid hits district in Taiz countryside");
});

test("what must stay apart: hours, 25 minutes, clashing tolls, other kinds, one outlet, no real spot", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const pairs: [ReturnType<typeof card>, ReturnType<typeof card>, string][] = [
    [card("a", "Al-Mihwar", "2026-09-21T10:47:00Z", "strike", "Saudi warplanes strike Haifan district in Taiz", HAIFAN), card("b", "Sabereen News", "2026-09-21T13:59:00Z", "strike", "Saudi warplanes strike Haifan district in Taiz", HAIFAN), "three hours apart"],
    [card("a", "Al-Mihwar", "2026-09-22T10:00:00Z", "strike", "Saudi jets bomb Haifan", HAIFAN), card("b", "Naya", "2026-09-22T10:25:00Z", "strike", "Air raid hits district in Taiz countryside", HAIFAN), "25 minutes"],
    [card("a", "Al-Mihwar", "2026-09-22T10:00:00Z", "strike", "12 killed in Saudi strike on Haifan", HAIFAN), card("b", "Naya", "2026-09-22T10:05:00Z", "strike", "17 killed as jets hit Taiz countryside", HAIFAN), "toll clash"],
    [card("a", "Al-Mihwar", "2026-09-22T10:00:00Z", "strike", "Saudi jets bomb Haifan", HAIFAN), card("b", "Naya", "2026-09-22T10:05:00Z", "combat", "Clashes in Taiz countryside", HAIFAN), "strike vs combat"],
    [card("a", "Al-Mihwar", "2026-09-22T10:00:00Z", "strike", "Saudi jets bomb Haifan", HAIFAN), card("b", "Al-Mihwar", "2026-09-22T10:05:00Z", "strike", "Second raid on Taiz countryside", HAIFAN), "same outlet"],
    [card("a", "Al-Mihwar", "2026-09-22T10:00:00Z", "strike", "Missile strike on Saudi Arabia", { place: "Saudi Arabia", lat: 25.62, lng: 42.35 }), card("b", "Naya", "2026-09-22T10:05:00Z", "strike", "Drone hits Saudi facility", { place: "Saudi Arabia", lat: 25.62, lng: 42.35 }), "country centroid"],
    [card("a", "Ali Bk", "2026-09-22T10:00:00Z", "strike", "Sirens sound in Jazan"), card("b", "Naya", "2026-09-22T10:09:00Z", "strike", "Air raid sirens in Jazan"), "alerts 9 minutes apart"],
  ];
  for (const [x, y, why] of pairs) {
    const reports = [x, y] as never[];
    foldIntoPublished(reports, new Set());
    assert.equal(reports.length, 2, why);
  }
});

test("one claim with its figure, relayed by other outlets as a statement or a strike: one card", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const own = card("a", "Yahya Saree", "2026-09-22T09:00:00Z", "statement", "Saree: forces carried out 52 strikes on Saudi military targets in 24 hours");
  const relay = card("b", "Naya", "2026-09-22T09:12:00Z", "strike", "Houthi forces carried out 52 strikes on Saudi military targets, Saree says");
  const reports = [own, relay] as never[];
  foldIntoPublished(reports, new Set());
  assert.equal(reports.length, 1);
});

test("a foreign minister's lines thread across outlets, whatever title each outlet gives him", async () => {
  const { threadSpeeches, namedSpeaker } = await import("./yemen-scan.server.ts");
  assert.equal(namedSpeaker("Saudi Foreign Minister Faisal bin Farhan meets US envoy"), "saudi fm");
  assert.equal(namedSpeaker("Faisal bin Farhan: the kingdom will defend itself"), "saudi fm");
  assert.equal(namedSpeaker("Yemen's foreign minister urges pressure on the Houthis"), "yemen fm");
  const a = card("a", "Al Arabiya Breaking", "2026-09-21T19:46:00Z", "diplomacy", "Saudi Foreign Minister: the kingdom seeks a political solution");
  const b = card("b", "Al Hadath", "2026-09-21T19:48:00Z", "diplomacy", "Faisal bin Farhan: talks with Washington are ongoing");
  const other = card("c", "Al Hadath", "2026-09-21T19:50:00Z", "statement", "Trump: we will stand with our Saudi friends");
  const bare = card("d", "Al Hadath", "2026-09-21T19:52:00Z", "diplomacy", "The kingdom will not accept threats to its security");
  threadSpeeches([a, b, other, bare] as never[], new Set());
  assert.equal((b as { replyTo?: string }).replyTo, "a");
  assert.equal((other as { replyTo?: string }).replyTo, undefined, "another speaker inside the window does not join");
  assert.equal((bare as { replyTo?: string }).replyTo, "c", "a line with no speaker is its channel's neighbour's");
});

test("an X account's own posts and threads are read; reposts and replies to others are not", async () => {
  const { parseFxStatuses } = await import("./yemen-scan.server.ts");
  const acct = { handle: "war_cube", name: "The Cube", lean: "intl", cadence: { everyMin: 15 } } as never;
  const json = {
    results: [
      { id: "1", url: "https://x.com/war_cube/status/1", text: "Unusual fire near Riyadh between two substations", created_timestamp: 1790244000, author: { screen_name: "war_cube" } },
      { id: "2", url: "https://x.com/war_cube/status/2", text: "Map changed, the Kahbub heights now shaded", created_timestamp: 1790244100, author: { screen_name: "war_cube" }, replying_to: { screen_name: "war_cube" } },
      { id: "3", url: "https://x.com/war_cube/status/3", text: "@someone should know about this one", created_timestamp: 1790244200, author: { screen_name: "war_cube" }, replying_to: { screen_name: "someone" } },
      { id: "4", url: "https://x.com/other/status/4", text: "A repost of someone else's footage", created_timestamp: 1790244300, author: { screen_name: "other" }, reposted_by: { screen_name: "war_cube" } },
    ],
  };
  const rows = parseFxStatuses(json, acct);
  assert.deepEqual(rows.map((r: { url: string }) => r.url), ["https://x.com/war_cube/status/1", "https://x.com/war_cube/status/2"]);
  assert.equal((rows[0] as { fromTg: boolean }).fromTg, true);
});

test("Sky News Arabia's account: only what its own sources told it", async () => {
  const { parseFxStatuses, SKY_OWN } = await import("./yemen-scan.server.ts");
  const acct = { handle: "SkyNewsArabia_B", name: "Sky News Arabia", lean: "intl", cadence: { everyMin: 10 }, only: SKY_OWN } as never;
  const post = (id: string, text: string) => ({ id, url: `https://x.com/SkyNewsArabia_B/status/${id}`, text, created_timestamp: 1790244000, author: { screen_name: "SkyNewsArabia_B" } });
  const rows = parseFxStatuses(
    {
      results: [
        post("1", "مصادر لسكاي نيوز عربية: وصول تعزيزات إلى جبهة الخوخة"),
        post("2", "مسؤول يمني لـ«سكاي نيوز عربية»: الحوثيون يحشدون في الحديدة"),
        post("3", "خاص | قائد ميداني: السيطرة على مواقع جديدة في كهبوب"),
        post("4", "تاس: روسيا تعلن إسقاط مسيرات أوكرانية"),
        post("5", "ترامب: سنعقد اجتماعا مهما الأسبوع المقبل"),
        post("6", "Saudi official told Sky News Arabia the talks were postponed"),
      ],
    },
    acct,
  );
  assert.deepEqual(rows.map((r: { url: string }) => r.url.split("/").pop()), ["1", "2", "3", "6"]);
});

test("the sea and energy accounts: this war's waters and Saudi exports only; a picture account waits for its words", async () => {
  const { parseFxStatuses, SEA_WAR } = await import("./yemen-scan.server.ts");
  // UKMTO's 30 Sep warnings, as read off their pictures.
  const hormuz = "UKMTO WARNING\n146-26 - ATTACK\nUKMTO has received a time-late report of an incident within the Strait of Hormuz.\nA verified source has reported that a Tanker has been struck by an unknown projectile.";
  const redSea = "UKMTO WARNING\n147-26 - ATTACK\nUKMTO has received a report of an incident 40NM west of Hodeidah, Yemen.\nThe master reports an explosion in the water close to the vessel.";
  assert.equal(SEA_WAR.test(hormuz), false);
  assert.equal(SEA_WAR.test(redSea), true);
  assert.equal(SEA_WAR.test("Saudi Arabia moves crude exports from Ras Tanura to Yanbu"), true);
  assert.equal(SEA_WAR.test("Suez Canal transits fell to 31 ships a day this week"), true);
  assert.equal(SEA_WAR.test("Russia extends diesel export ban through Oct. 31"), false);
  // A picture account's post passes the parser on its bare text; its words are tried later.
  const ukmto = { handle: "UK_MTO", name: "UKMTO", lean: "intl", cadence: { everyMin: 5 }, only: SEA_WAR, picture: true } as never;
  const card = { id: "9", url: "https://x.com/UK_MTO/status/9", text: "UKMTO WARNING 146 Click here to view the full warning.", created_timestamp: 1790244000, author: { screen_name: "UK_MTO" }, media: { all: [{ type: "photo", url: "https://pbs.twimg.com/media/x.png?name=orig" }] } };
  assert.equal(parseFxStatuses({ results: [card] }, ukmto).length, 1);
  // An X article's bare link reads as its title and opening.
  const energy = { handle: "MoEnergy_Saudi", name: "Saudi Energy Ministry", lean: "gov", cadence: { everyMin: 10 }, only: SEA_WAR } as never;
  const art = (id: string, title: string) => ({ id, url: `https://x.com/MoEnergy_Saudi/status/${id}`, text: "https://t.co/rJfZueCw5S", created_timestamp: 1790244000, author: { screen_name: "MoEnergy_Saudi" }, article: { title, preview_text: "The Ministry of Energy said ..." } });
  const rows = parseFxStatuses({ results: [art("1", "Global Energy Leaders Gather in Riyadh"), art("2", "Pumping on the East-West pipeline restored after the attack")] }, energy);
  assert.deepEqual(rows.map((r: { url: string }) => r.url.split("/").pop()), ["2"]);
  assert.match((rows[0] as { text: string }).text, /^Pumping on the East-West pipeline restored/);
});

test("an X post is new only when its id is past the last one read; a pinned old post is not", async () => {
  const { newerX } = await import("./yemen-scan.server.ts");
  assert.equal(newerX("2103415802196001183", undefined), true);
  assert.equal(newerX("2103415802196001183", "2103415802196001183"), false);
  assert.equal(newerX("2103415802196001190", "2103415802196001183"), true);
  // A pinned post from January sits first in the list and is older.
  assert.equal(newerX("2011000000000000000", "2103415802196001183"), false);
  assert.equal(newerX("999", "1000"), false);
  assert.equal(newerX("1000", "999"), true);
});

test("a copy seen late, with an earlier time than the card on the desk, folds into it", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const headline = "Air traffic suspended at Riyadh airport";
  // Sabereen's post was published at 22:53; Al-Mihwar's 22:51 post was only read an hour later.
  const onDesk = { ...base, fp: "a", url: "https://t.me/SabrenNewss/226897", source: "Sabereen News", at: "2026-09-28T22:53:59Z", type: "strike", summary: headline, place: "Riyadh", lat: 24.71, lng: 46.68 };
  const late = { ...base, fp: "b", url: "https://t.me/Alomhoar/113105", source: "Al-Mihwar", at: "2026-09-28T22:51:39Z", type: "strike", summary: headline, place: "Riyadh", lat: 24.71, lng: 46.68 };
  const reports = [onDesk, late] as never[];
  foldIntoPublished(reports, new Set(["a"]));
  assert.deepEqual((reports as { fp: string }[]).map((r) => r.fp), ["a"]);
  assert.deepEqual((onDesk as { alsoReportedBy?: { source: string }[] }).alsoReportedBy?.map((x) => x.source), ["Al-Mihwar"]);
});

test("a later outlet that adds a figure is kept to write into the card", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const home = { ...base, fp: "a", url: "https://t.me/ajanews/1", source: "Al Jazeera", at: "2026-09-28T19:58:00Z", type: "strike", summary: "Houthi ballistic missile targets Najran in Saudi Arabia", place: "Najran", lat: 17.49, lng: 44.13 };
  const more = { ...base, fp: "b", url: "https://t.me/alomhoar/2", source: "Al-Mihwar", at: "2026-09-28T20:05:00Z", type: "strike", summary: "Houthi ballistic missile targets Najran; 2 wounded by debris", place: "Najran", lat: 17.49, lng: 44.13 };
  const same = { ...base, fp: "c", url: "https://t.me/sabrenNewss/3", source: "Sabereen News", at: "2026-09-28T20:06:00Z", type: "strike", summary: "Houthi ballistic missile targets Najran in Saudi Arabia", place: "Najran", lat: 17.49, lng: 44.13 };
  const reports = [home, more, same] as never[];
  const enrich: unknown[] = [];
  foldIntoPublished(reports, new Set(["a"]), [], enrich as never);
  assert.equal(reports.length, 1);
  assert.equal(enrich.length, 1, "only the account with the new figure is written in");
  assert.equal(((enrich[0] as { fp: string }[])[1]).fp, "b");
});

test("two different posts from one channel stay two cards", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const a = { ...base, fp: "a", url: "https://t.me/asharqnews/1", source: "Asharq News", at: "2026-09-28T17:37:00Z", type: "strike", summary: "Yemeni armed forces announce 356 targeting operations in 24 hours" };
  const b = { ...base, fp: "b", url: "https://t.me/asharqnews/2", source: "Asharq News", at: "2026-09-28T17:47:00Z", type: "strike", summary: "Yemeni armed forces: 356 operations in 24 hours neutralize 476 Houthi fighters" };
  const reports = [a, b] as never[];
  foldIntoPublished(reports, new Set(["a"]));
  assert.equal(reports.length, 2);
});

test("a card already on the desk keeps its first time", async () => {
  const { keepFirstTimes } = await import("./desk/copies.ts");
  const again = [{ fp: "sheba-1", at: "2026-09-29T16:11:00+03:00" }, { fp: "new", at: "2026-09-29T16:11:00+03:00" }];
  const n = keepFirstTimes(again, new Map([["sheba-1", "2026-09-28T13:36:00+03:00"]]));
  assert.equal(n, 1);
  assert.equal(again[0].at, "2026-09-28T13:36:00+03:00");
  assert.equal(again[1].at, "2026-09-29T16:11:00+03:00");
  // Never moved forward.
  const early = [{ fp: "x", at: "2026-09-28T10:00:00+03:00" }];
  assert.equal(keepFirstTimes(early, new Map([["x", "2026-09-28T12:00:00+03:00"]])), 0);
});

test("after the laptop was offline, an hour's Google News query reaches back over the gap", async () => {
  const { widenForGap } = await import("./yemen-scan.server.ts");
  const url = "https://news.google.com/rss/search?q=site%3Aspa.gov.sa%20when%3A1h&hl=ar";
  const now = Date.parse("2026-09-29T16:05:00+03:00");
  assert.equal(widenForGap(url, { everyMin: 10 }, now - 10 * 60_000, now), url);
  assert.equal(widenForGap(url, { everyMin: 30 }, now - 35 * 60_000, now), url);
  assert.match(widenForGap(url, { everyMin: 10 }, now - 61 * 60_000, now), /when%3A3h/);
});

test("one channel's sirens stay two alerts, even when the reader calls them the same", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [] } as const;
  const a = { ...base, fp: "a", url: "https://t.me/x/1", source: "Al Arabiya", at: "2026-09-29T09:00:00+03:00", type: "air_raid_alert", summary: "Sirens sound in Riyadh" };
  const b = { ...base, fp: "b", url: "https://t.me/x/2", source: "Al Arabiya", at: "2026-09-29T09:05:00+03:00", type: "air_raid_alert", summary: "Air raid sirens heard across Riyadh again", duplicateOf: "a" };
  const reports = [a, b] as never[];
  foldIntoPublished(reports, new Set(["a"]));
  assert.equal(reports.length, 2);
  // Word for word the same from one channel still folds.
  const c = { ...b, fp: "c", url: "https://t.me/x/3", summary: "Sirens sound in Riyadh" };
  const again = [a, c] as never[];
  foldIntoPublished(again, new Set(["a"]));
  assert.equal(again.length, 1);
});

test("one clip reposted by another account hours later folds into the first card", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [], place: "Marib", lat: 15.47, lng: 45.32 } as const;
  const clip = (d: number) => ({ kind: "video", duration: d, thumb: `t${d}`, src: "v", from: "x", post: "p" });
  const a = { ...base, fp: "a", url: "https://x.com/a/1", source: "Ali al-Sakani", at: "2026-09-29T15:51:00+03:00", type: "strike", summary: "Airstrikes hit Houthi targets south of Marib", media: clip(26) };
  const b = { ...base, fp: "b", url: "https://x.com/b/2", source: "Mohammed al-Dhabyani", at: "2026-09-29T17:25:00+03:00", type: "strike", summary: "Yemeni warplanes strike Houthi sniper positions south of Marib", media: clip(26) };
  const reports = [a, b] as never[];
  foldIntoPublished(reports, new Set(["a"]));
  assert.equal(reports.length, 1);
  // A clip of another length is another event.
  const c = { ...b, fp: "c", url: "https://x.com/b/3", media: clip(41) };
  const two = [a, c] as never[];
  foldIntoPublished(two, new Set(["a"]));
  assert.equal(two.length, 2);
});

test("a spokesman's other point, folded under his first, is written into the card", async () => {
  const { addsFacts } = await import("./desk/combine.ts");
  const base = { live: true, text: "", score: 1, tags: [], type: "statement" } as const;
  const home = { ...base, fp: "h", url: "u1", source: "Al-Yemen Now", at: "2026-09-29T18:50:00+03:00", summary: "Yemeni armed forces spokesperson states all Houthi military activities are monitored and sites used for military purposes are legitimate targets" };
  const other = { ...base, fp: "o", url: "u2", source: "Al Arabiya", at: "2026-09-29T18:52:00+03:00", summary: "Yemeni armed forces spokesperson: civilians must stay away from military sites used by Houthi militias" };
  const same = { ...base, fp: "s", url: "u3", source: "Al Arabiya", at: "2026-09-29T18:52:00+03:00", summary: "Yemeni armed forces spokesperson: all Houthi military activities are monitored" };
  assert.equal(addsFacts(home as never, other as never), true);
  assert.equal(addsFacts(home as never, same as never), false);
});

test("another outlet's line of an interview the card already carries folds into it", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, score: 1, tags: [], type: "statement" } as const;
  const home = { ...base, fp: "h", url: "https://x.com/South24_net/1", source: "South24", at: "2026-09-29T17:44:00+03:00", summary: "STC official Amr al-Bidh: Houthis seek to establish another Iran in the Horn of Africa", text: "In an interview with Italy's Linkiesta, al-Bidh warned that Houthi control of Bab al-Mandab would let the group close the strait at will, without firing a missile or a drone." };
  const line = { ...base, fp: "l", url: "https://x.com/South24E/2", source: "South24 English", at: "2026-09-29T17:49:00+03:00", text: "", summary: "STC official Amr al-Bidh: Houthi control over Bab al-Mandab grants them ability to close it without missiles or drones" };
  const reports = [home, line] as never[];
  foldIntoPublished(reports, new Set(["h"]));
  assert.equal(reports.length, 1);
  // Something he had not said on the card is written into it: one interview, one card (user's review, 5 Oct).
  const other = { ...line, fp: "o", summary: "STC official Amr al-Bidh: southern forces will retake Mukalla port within weeks" };
  const two = [home, other] as never[];
  const enrich: [unknown, unknown][] = [];
  foldIntoPublished(two, new Set(["h"]), [], enrich as never);
  assert.equal(two.length, 1);
  assert.equal(enrich.length, 1);
});

test("the two Sabas never mix: the government agency is not the Houthi outlet", async () => {
  const { outletSide, homeOutlet } = await import("./desk/credibility.ts");
  assert.equal(outletSide("Saba (government)", ""), "gov");
  assert.equal(homeOutlet("Saba (government)"), false);
  assert.equal(outletSide("Saba (Houthi-run)", ""), "houthi");
  assert.equal(homeOutlet("Saba (Houthi-run)"), true);
  assert.equal(outletSide("Saba", ""), "houthi");
});

test("the reader's duplicate link between two different speakers is refused", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, score: 1, tags: [], type: "statement", text: "" } as const;
  const home = { ...base, fp: "h", url: "u1", source: "South24", at: "2026-09-29T17:44:00+03:00", summary: "STC official Amr al-Bidh: Houthis seek to establish another Iran in the Horn of Africa" };
  const r = { ...base, fp: "r", url: "u2", source: "Almashhad", at: "2026-09-29T19:15:00+03:00", summary: "Yemeni armed forces spokesperson: we monitor all Houthi military activities across all fronts", duplicateOf: "h" };
  const reports = [home, r] as never[];
  foldIntoPublished(reports, new Set(["h"]));
  assert.equal(reports.length, 2);
});

test("two Suhail articles are two links; tracking is not part of a link", async () => {
  const { linkKey } = await import("./yemen-scan.server.ts");
  assert.notEqual(linkKey("https://suhail.net/news_details.php?lang=arabic&sid=33548"), linkKey("https://suhail.net/news_details.php?lang=arabic&sid=33545"));
  assert.equal(linkKey("https://x.com/a/status/1?utm_source=x"), "https://x.com/a/status/1");
});

test("a call with Qatar's emir does not fold into the UAE vice president's visit", async () => {
  const { foldIntoPublished } = await import("./yemen-scan.server.ts");
  const base = { live: true, score: 1, tags: [], type: "diplomacy", text: "" } as const;
  const home = { ...base, fp: "h", url: "u1", source: "South24", at: "2026-09-29T18:40:00+03:00", summary: "UAE Vice President Mansour bin Zayed arrives in Riyadh and meets Saudi Crown Prince Mohammed bin Salman" };
  const r = { ...base, fp: "r", url: "u2", source: "Saudi Gazette", at: "2026-09-29T19:20:00+03:00", summary: "Saudi Crown Prince discusses regional developments with Qatari Emir", duplicateOf: "h" };
  const reports = [home, r] as never[];
  foldIntoPublished(reports, new Set(["h"]));
  assert.equal(reports.length, 2);
});
