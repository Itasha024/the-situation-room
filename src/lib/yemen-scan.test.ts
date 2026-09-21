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
