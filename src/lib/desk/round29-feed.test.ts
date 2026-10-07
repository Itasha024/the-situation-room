/**
 * Round 29, stage 3: the feed rules from the user's 3 Oct review, each tested
 * on the real 3 Oct text it came from (Israel time in the test names).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { decideForTest, houthiAfterAll } from "./editor.ts";
import { gate } from "./relevance.ts";
import { ownAftermath, sameWave } from "./copies.ts";
import { onTheWar } from "./originals.ts";
import { findCitation } from "./origin.ts";
import { SYSTEM_PROMPT, type Reading } from "./reader.ts";

const reading = (over: Partial<Reading>): Reading => ({
  id: "0",
  publish: true,
  reject_reason: "",
  event_type: "advance_or_capture",
  confident_roles: true,
  actor: null,
  actor_side: "government",
  targets: [],
  origins: [],
  speaker_lead: null,
  interest: "neutral",
  has_time: false,
  headline: "",
  body: "",
  follows_up: "",
  duplicate_of: "",
  ...over,
} as Reading);

const ALI_BK_14_16 = "بعد السيطرة على منطقة بني محمد، القوات اليمنية تتقدم نحو الزعازع بمديرية الشمايتين بمحافظة تعز وتقترب أكثر فأكثر من التربة آخر طريق إمداد بين تعز وعدن.";
const AL_AQSA_14_10 = "بعد خوض اشتباكات عنيفة والتقدم في جبل راسن، القوات المسلحة اليمنية التابعة للشرعية  تأسر  عدد \n من مليشيات الحوثيين.";

test("14:16 — a Houthi-aligned outlet's 'Yemeni forces' are the Houthis, never the government", () => {
  const v = decideForTest(
    reading({ headline: "Yemeni government forces advance towards Al-Zaza'a in Al-Shamaytayn district of Taiz after securing Bani Mohammed" }),
    ALI_BK_14_16,
  );
  assert.equal(v.kind, "publish");
  if (v.kind === "publish") assert.match(v.report.summary, /^Houthi media: Houthi forces advance towards Al-Zaza'a/);
  // Al-Aqsa TV says whose forces they are: التابعة للشرعية is the government.
  assert.equal(houthiAfterAll("government", "Yemeni government forces capture Houthi fighters", AL_AQSA_14_10, "houthi"), false);
  // A Saudi-aligned outlet's "Yemeni army" is not turned Houthi.
  assert.equal(houthiAfterAll("government", "Yemeni government forces advance", "الجيش اليمني يتقدم في جبل حبشي", "gov"), false);
  // Sabereen, 5 Oct: the government never fires missiles and drones at Saudi Arabia.
  assert.equal(houthiAfterAll("government", "Yemeni government forces launch missile and drone strikes on Riyadh, Rabigh, Abha", "عمليات على الرياض", "houthi"), true);
  assert.match(SYSTEM_PROMPT, /Ali Bk's "القوات اليمنية تتقدم نحو الزعازع"/);
});

test("09:16 and 07:47 — Iranian summaries and relays of Yemeni officials stay out; Iran's own words stay in", () => {
  const irna = "🗞بسته خبری ایرنا؛ مهم‌ترین خبرهای جهان در شب گذشته - ۱۱ مهر ۱۴۰۵\n\n💢 اولیانوف: برنامه هسته‌ای حق سلب‌نشدنی ایران است\n\n💢 ائتلاف سعودی ۹۴ حمله هوایی و موشکی به یمن طی ۲۴ ساعت گذشته انجام داد";
  const g = gate({ source: "IRNA", url: "https://t.me/irna_1313/457984", agency: false, text: irna } as never);
  assert.equal(g.outcome, "exclude");
  assert.equal(g.reason, "summary");
  const relay = gate({ source: "Press TV", url: "https://t.me/presstv/209460", agency: false, text: "Yemen’s armed forces say they conducted two retaliatory attacks against Saudi Arabia, targeting Aramco facilities in response to recent Saudi airstrikes on Yemen." } as never);
  assert.equal(relay.reason, "iran-relay");
  const own = gate({ source: "Press TV", url: "u", agency: false, text: "Araghchi: Saudi Arabia must stop its attacks on Yemen and lift the siege on Hodeidah" } as never);
  assert.notEqual(own.reason, "iran-relay");
  assert.match(SYSTEM_PROMPT, /reject_reason "recap"/);
  assert.match(SYSTEM_PROMPT, /reject_reason "relay"/);
});

test("11:01 — the daily currency list is not news", () => {
  const g = gate({ source: "Sawt al-Asima", url: "https://www.sawt-alasima.net/news/120747", agency: false, text: "أخبار محلية - نشرة أسعار صرف العملات الأجنبية صباح اليوم 3 أكتوبر 2026" } as never);
  assert.equal(g.outcome, "exclude");
  assert.equal(g.reason, "prices");
  assert.match(SYSTEM_PROMPT, /media department\s+director/);
});

test("10:35, 10:08, 09:29 — the unnamed commander speaks, a video is its news, the post's own why stays", () => {
  assert.match(SYSTEM_PROMPT, /Yemeni military commander: we broke Houthi attempts/);
  assert.match(SYSTEM_PROMPT, /Write the NEWS in the video, never the video/);
  assert.match(SYSTEM_PROMPT, /Keep the text's own WHY/);
});

test("09:55 + 10:00 — one channel's smoke and footage of one strike is one card; a new strike is not", () => {
  const a = { summary: "Smoke rises near targeted oil site in Riyadh following Houthi attack" };
  const b = { summary: "Footage shows smoke rising near the targeted oil site in Riyadh" };
  const none = () => [];
  assert.equal(ownAftermath(a, b, none), true);
  assert.equal(ownAftermath(a, { summary: "New attack on the oil site in Riyadh, smoke rises again" }, none), false);
  // Sirens are never folded this way.
  assert.equal(ownAftermath({ summary: "Sirens sound in Riyadh" }, { summary: "Sirens sound in Riyadh, footage shows" }, none), false);
});

test("13:00-14:00 — a wave of Saudi strikes on Sanaa is one card", () => {
  const s = (summary: string) => ({ type: "strike", summary });
  assert.equal(sameWave(s("Saudi air strikes target Sanaa including Al-Sabeen Square Maternity Hospital"), s("Saudi air strikes target Houthi sites in Sanaa, including Jabal Attan and Al-Nahdayn")), true);
  assert.equal(sameWave(s("Saudi Arabia launches new air strikes against Sanaa"), s("Saudi air strikes renew targeting Al-Nahdayn military compound in Sanaa")), true);
  // Another city, or no striker named, or casualty figures that disagree: not one wave.
  assert.equal(sameWave(s("Saudi air strikes target Sanaa"), s("Saudi air strikes target Hajjah")), false);
  assert.equal(sameWave(s("Airstrikes hit Houthi targets south of Marib"), s("Airstrikes hit Houthi positions in Marib")), false);
  assert.equal(sameWave(s("Saudi air strike on Sanaa kills 3 people"), s("Saudi air strike on Sanaa kills 12 people")), false);
});

test("06:09, 07:09, 10:52, 10:53 — a relay of Axios joins Axios's card, with what it adds, and no 'Also'", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const base = { live: true, text: "", score: 1, tags: [], type: "diplomacy" } as const;
  const axios = { ...base, fp: "ax", url: "https://www.axios.com/2026/10/03/trumps-cabinet-camp-david-iran-war-yemen-houthis", source: "Axios", at: "2026-10-03T05:56:58+03:00", summary: "Trump's top national security aides meet to discuss Saudi-Houthi conflict, officials say" };
  const hadath = { ...base, fp: "hd", url: "https://t.me/alhadath_brk/135506", source: "Al Hadath", at: "2026-10-03T06:09:01+03:00", citing: "Axios", replyTo: "ax", summary: "Trump's top national security aides met secretly at Camp David to discuss Iran and Yemen" };
  const south = { ...base, fp: "s24", url: "https://x.com/South24_net/status/2106291176718684385", source: "South24", at: "2026-10-03T10:52:04+03:00", citing: "Axios", summary: "US military gave Saudi Arabia information on over 200 Houthi targets in the past two weeks" };
  const reports = [axios, hadath, south] as never[];
  const enrich: [unknown, unknown][] = [];
  foldIntoPublished(reports, new Set(["ax"]), [], enrich as never);
  assert.deepEqual((reports as { fp: string }[]).map((r) => r.fp), ["ax"]);
  assert.equal((axios as { alsoReportedBy?: unknown[] }).alsoReportedBy, undefined);
  // South24's 200 targets are written into the Axios card.
  assert.ok(enrich.some(([, r]) => (r as { fp: string }).fp === "s24"));

  // Axios arriving after a relay's card: Axios leads, the relays go.
  const relay = { ...base, fp: "am", url: "https://www.almashhad.news/news/497778", source: "Almashhad", at: "2026-10-03T07:09:37+03:00", citing: "Axios", summary: "Trump's top national security aides met at Camp David to discuss Iran and Yemen", alsoReportedBy: [{ source: "Aden al-Ghad", url: "u" }] };
  const late = { ...axios, fp: "ax2", at: "2026-10-03T07:30:00+03:00", summary: "Trump's top national security aides met at Camp David to discuss Iran and Yemen, officials say" };
  const two = [relay, late] as never[];
  foldIntoPublished(two, new Set(["am"]));
  assert.equal(two.length, 1);
  const card = two[0] as { source: string; url: string; alsoReportedBy?: unknown[] };
  assert.equal(card.source, "Axios");
  assert.equal(card.alsoReportedBy, undefined);
});

test("06:09 Pakistan — an account's post that shares only titles with the story is not its original", () => {
  const keys = ["Dar", "Iran", "Houthis", "political", "engagement", "Pakistan"];
  const unga = "Deputy Prime Minister and Foreign Minister Senator Mohammad Ishaq Dar briefed the media on Pakistan's extensive diplomatic engagements during the High-Level Week of the 81st Session of the United Nations General Assembly";
  assert.equal(onTheWar(unga, keys), false);
  assert.equal(onTheWar("Dar: Iran has proposed political engagement with the Houthis", keys), true);
  // A story with no war words is not held to it.
  assert.equal(onTheWar(unga, ["Dar", "UNGA", "briefing"]), true);
});

test("10:07, 10:58, 10:53, 11:11 — officials' own accounts are where their words are traced", () => {
  const x = (text: string) => findCitation(text, "Sawt al-Asima")?.x;
  assert.equal(x("الدفاع المدني السعودي: سقوط شظايا صاروخ باليستي في أحد رفيدة"), "SaudiDCD");
  assert.equal(x("وزير حقوق الإنسان: أكثر من 600 مدني بين قتيل وجريح خلال شهر من التصعيد الحوثي"), "mashdal");
  assert.equal(x("وزير الدولة البريطاني لشؤون الشرق الأوسط ستيفن داوتي يدين التصعيد الحوثي في تعز"), "SDoughtyMP");
  assert.equal(x("المركز الإعلامي لمحور تعز: الجيش يكسر هجمات الحوثيين على جبل هان"), "axistaiz");
});

test("Saree's 3 Oct statement named Riyadh only: a card may not add Yanbu, Abqaiq or Khurais", async () => {
  const { checkReading } = await import("./reader.ts");
  const saree = "نفذت القوات المسلحة اليمنية عملية عسكرية نوعية بعدد من الصواريخ الباليستية والطائرات المسيرة استهدفت شركة أرامكو في عاصمة العدو السعودي الرياض";
  const r = (headline: string) => reading({ event_type: "missile_launch", actor_side: "houthi", headline });
  assert.match(String(checkReading(r("Houthi forces fire missiles and drones at Aramco sites in Riyadh, Yanbu and Abqaiq"), saree)), /place not in source: Yanbu/);
  assert.equal(checkReading(r("Houthi forces fire ballistic missiles and drones at Aramco in Riyadh"), saree), null);
});
