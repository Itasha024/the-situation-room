/**
 * The big Arab sites' and the wires' own articles against the posts that got
 * there first (18 Oct measure). Real cards and articles from that day: the
 * Fars Telegram card on the new defence minister swallowed Asharq Al-Awsat,
 * The New Arab, Reuters, Al Jazeera and Arab News, none of them shown anywhere.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { type Card, foldServed, joinInto } from "./fold-same.ts";
import { mergeAlso, siteOutlet, siteTakesLead } from "./site-articles.ts";

// The Fars card as served on 18 Oct, its "Also" already at the old cap of eight.
const FARS_ALSO = [
  { source: "Iran International", url: "https://x.com/IranIntl_En/status/2111721672667750710" },
  { source: "IMNA", url: "https://t.me/imnanews_ir/211194" },
  { source: "Al-Alam", url: "https://t.me/alalamarabic/511468" },
  { source: "Sabereen News", url: "https://t.me/SabrenNewss/228931" },
  { source: "Press TV", url: "https://t.me/presstv/211259" },
  { source: "Naya", url: "https://t.me/naya_foriraq/94033" },
  { source: "Kan (Arab affairs)", url: "https://t.me/kanarab/51963" },
  { source: "Arab News", url: "https://x.com/arabnews/status/2111733423219896642" },
];
const fars = () => ({
  live: true as const,
  score: 1,
  tags: [] as string[],
  fp: "live-t-me-farsna-469088",
  url: "https://t.me/farsna/469088",
  source: "Fars News",
  at: "2026-10-18T07:30:55Z",
  type: "politics",
  summary: "Iran confirms Mehrdad Akhlaghi as defence minister with 237 votes in favour",
  text: "Iran's parliament confirmed Mehrdad Akhlaghi as defence minister with 237 votes in favour and 15 against.",
  alsoReportedBy: FARS_ALSO.map((a) => ({ ...a })),
});
const article = (fp: string, source: string, url: string, at: string, summary: string, text = "") => ({
  live: true as const,
  score: 1,
  tags: [] as string[],
  fp,
  url,
  source,
  at,
  type: "politics",
  summary,
  text,
  duplicateOf: "live-t-me-farsna-469088",
});

test("the sites and wires by their links, Google's listing under their names, never a post", () => {
  assert.equal(siteOutlet({ url: "https://english.aawsat.com/node/5330760", source: "Asharq Al-Awsat" }), "Asharq Al-Awsat");
  assert.equal(siteOutlet({ url: "https://www.newarab.com/news/iran-approves-mehrdad-akhlaqi-minister-defence", source: "The New Arab" }), "Al-Araby Al-Jadeed");
  assert.equal(siteOutlet({ url: "https://reut.rs/3WcA5Le", source: "Reuters" }), "Reuters");
  assert.equal(siteOutlet({ url: "https://www.aljazeera.com/news/2026/10/18/who-is-mehrdad-akhlagh-irans-new-tech-focused-defence-minister", source: "Al Jazeera" }), "Al Jazeera");
  assert.equal(siteOutlet({ url: "https://news.google.com/rss/articles/CBMi", source: "Al Arabiya" }), "Al Arabiya");
  assert.equal(siteOutlet({ url: "https://news.google.com/rss/articles/CBMi", source: "Google News" }), "");
  assert.equal(siteOutlet({ url: "https://t.me/AjaNews/517327", source: "Al Jazeera" }), "");
  assert.equal(siteOutlet({ url: "https://x.com/aawsat_News/status/2111735550558240776", source: "Asharq Al-Awsat" }), "");
  assert.equal(siteOutlet({ url: "https://www.adngad.net/news/889539", source: "Aden al-Ghad" }), "");
});

test("Akhlaghi, 18 Oct: the sites' articles folded into the Fars post are all listed under Also, past the cap", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const home = fars();
  const reports = [
    article("aw", "Asharq Al-Awsat", "https://english.aawsat.com/node/5330760", "2026-10-18T08:45:00Z", "Iran parliament confirms Mehrdad Akhlaghi as defence minister"),
    article("na", "The New Arab", "https://www.newarab.com/news/iran-approves-mehrdad-akhlaqi-minister-defence", "2026-10-18T10:40:00Z", "Iran appoints Mehrdad Akhlaqi Ketabchi as defence minister"),
    article("rt", "Reuters", "https://reut.rs/3WcA5Le", "2026-10-18T10:00:00Z", "Iran's parliament approves Mehrdad Akhlaghi as defence minister"),
    // Arab News's post is in the card already; its article is its own entry.
    article("an", "Arab News", "https://www.arabnews.com/middle-east/irans-new-defense-minister-threatens-enormous-damage-if-us-attacks-3006982", "2026-10-18T11:30:00Z", "Iran parliament confirms Akhlaghi as defence minister, 237 votes in favour"),
  ];
  const touched = foldIntoPublished(reports as never[], new Set([home.fp]), [home] as never[]);
  assert.equal(reports.length, 0);
  assert.ok((touched as { fp: string }[]).some((t) => t.fp === home.fp));
  const urls = (home.alsoReportedBy ?? []).map((a) => a.url);
  for (const u of [
    "https://english.aawsat.com/node/5330760",
    "https://www.newarab.com/news/iran-approves-mehrdad-akhlaqi-minister-defence",
    "https://reut.rs/3WcA5Le",
    "https://www.arabnews.com/middle-east/irans-new-defense-minister-threatens-enormous-damage-if-us-attacks-3006982",
  ]) assert.ok(urls.includes(u), u);
  // The Fars post still leads: none of them carries information of its own.
  assert.equal(home.source, "Fars News");
  // Arab News's article stands in for its post; the other posts stay.
  assert.ok(!urls.includes("https://x.com/arabnews/status/2111733423219896642"));
  assert.ok(urls.includes("https://t.me/presstv/211259"));
});

test("a site article with its own sources takes the card from the post that got there first", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const home = fars();
  const own = article(
    "aw2",
    "Asharq Al-Awsat",
    "https://english.aawsat.com/world/5330760-iran%E2%80%99s-new-defense-minister-threatens-%E2%80%98enormous-damage%E2%80%99-if-us-attacks",
    "2026-10-18T09:40:00Z",
    "Iran's new defence minister Akhlaghi threatens enormous damage if US attacks",
    "Asharq Al-Awsat's correspondent in Tehran said lawmakers from the hardline bloc backed him after the Guards' commanders lobbied for him; the vote was 237 in favour.",
  );
  const reports = [own];
  foldIntoPublished(reports as never[], new Set([home.fp]), [home] as never[]);
  assert.equal(reports.length, 0);
  // The card keeps its place and identity, and the article leads it.
  assert.equal(home.fp, "live-t-me-farsna-469088");
  assert.equal(home.source, "Asharq Al-Awsat");
  assert.equal(home.url, own.url);
  assert.ok(home.tags.includes("site-lead"));
  // The Fars post goes first under "Also"; the others stay.
  assert.equal(home.alsoReportedBy![0].url, "https://t.me/farsna/469088");
  assert.ok(home.alsoReportedBy!.some((a) => a.source === "Press TV"));
  assert.ok(!(home as { flags?: string[] }).flags?.includes("exclusive"));
});

test("a site's exclusive takes the card too, and an exclusive keeps no post under it (user, 8 Oct)", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const home = fars();
  const excl = article("aw3", "Asharq Al-Awsat", "https://english.aawsat.com/node/5330790", "2026-10-18T09:50:00Z",
    "Iran confirms Akhlaghi as defence minister; Iranian sources told Asharq Al-Awsat the Guards put him forward",
    "Iranian sources told Asharq Al-Awsat that the Revolutionary Guards put Akhlaghi forward after the vote of 237 in favour.");
  const reports = [excl];
  foldIntoPublished(reports as never[], new Set([home.fp]), [home] as never[]);
  assert.equal(home.source, "Asharq Al-Awsat");
  assert.ok((home as { flags?: string[] }).flags?.includes("exclusive"));
  assert.equal(home.alsoReportedBy, undefined);
});

test("an exclusive's card lists a site article under it, and no post", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  // The New Arab's Krimly interview (15 Oct), flagged exclusive.
  const home = {
    live: true as const, score: 1, tags: [] as string[], flags: ["exclusive"],
    fp: "krimly", url: "https://www.newarab.com/news/saudi-arabia-accuses-iran-encouraging-houthi-escalation", source: "The New Arab",
    at: "2026-10-15T14:56:07Z", type: "statement",
    summary: "Saudi deputy minister for public diplomacy: Saudi Arabia accuses Iran of encouraging Houthi escalation",
    text: "Saudi deputy minister for public diplomacy Rayed Krimly said Riyadh remains in contact with Tehran but sees no readiness for concessions.",
  } as { alsoReportedBy?: { url: string }[] } & Record<string, unknown>;
  const post = { ...article("p", "Al Hadath", "https://t.me/alhadath_brk/136000", "2026-10-15T15:20:00Z", "Krimly: Saudi Arabia accuses Iran of encouraging Houthi escalation"), type: "statement", duplicateOf: "krimly" };
  const site = { ...article("s", "Al Jazeera", "https://www.aljazeera.net/news/2026/10/15/krimly-iran-houthis", "2026-10-15T15:30:00Z", "Saudi official Krimly accuses Iran of encouraging Houthi escalation"), type: "statement", duplicateOf: "krimly" };
  const reports = [post, site];
  foldIntoPublished(reports as never[], new Set(["krimly"]), [home] as never[]);
  assert.equal(reports.length, 0);
  assert.deepEqual((home.alsoReportedBy ?? []).map((a) => a.url), ["https://www.aljazeera.net/news/2026/10/15/krimly-iran-houthis"]);
  assert.equal(home.source, "The New Arab");
});

test("Reuters on the Najran helicopter (18 Oct) is listed under Arab News's article, not cut", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const home = {
    live: true as const, score: 1, tags: [] as string[], fp: "najran",
    url: "https://www.arabnews.com/saudi-arabia/two-officers-killed-helicopter-najran", source: "Arab News", at: "2026-10-18T09:00:00Z", type: "casualties",
    summary: "Two officers killed after Saudi National Guard reconnaissance helicopter crashes in Najran", text: "",
  } as { alsoReportedBy?: { url: string }[] } & Record<string, unknown>;
  const reuters = { ...article("r", "Reuters", "https://www.reuters.com/world/middle-east/saudi-led-coalition-says-helicopter-crash-najran-kills-two-crew-members-2026-10-18/", "2026-10-18T09:40:00Z", "Saudi-led coalition says helicopter crash in Najran kills two crew members"), type: "casualties", duplicateOf: "najran" };
  const reports = [reuters];
  foldIntoPublished(reports as never[], new Set(["najran"]), [home] as never[]);
  assert.equal(reports.length, 0);
  // A site article does not take another site's card.
  assert.equal(home.source, "Arab News");
  assert.deepEqual((home.alsoReportedBy ?? []).map((a) => a.url), [reuters.url]);
});

test("as the desk is read: Al Jazeera's article joins the card its own channel leads, by its link", () => {
  const c = (fp: string, at: string, source: string, url: string, summary: string, more: Partial<Card> = {}): Card => ({ fp, at, source, url, type: "statement", summary, text: "", ...more });
  const channel = c("aj1", "2026-10-18T01:40:00Z", "Al Jazeera", "https://t.me/AjaNews/517400", "IRGC: two oil tankers caught fire after hitting naval mines in Strait of Hormuz", { type: "maritime" });
  const site = c("aj2", "2026-10-18T01:54:18Z", "Al Jazeera", "https://www.aljazeera.com/news/2026/10/18/iran-says-two-tankers-catch-fire", "IRGC: two oil tankers caught fire after hitting naval mines in Strait of Hormuz", { type: "maritime" });
  const out = foldServed([channel, site]).reports;
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].alsoReportedBy, [{ source: "Al Jazeera", url: site.url, summary: site.summary }]);
});

test("as the desk is read: a site's exclusive takes a relay's card on the same remarks", () => {
  // Asharq Al-Awsat's Khatibzadeh in Beirut (15 Oct, exclusive) after a relay's post of his words.
  const relay: Card = { fp: "rel", at: "2026-10-15T17:30:00Z", source: "Al Hadath", url: "https://t.me/alhadath_brk/135000", type: "statement", summary: "Araghchi aide Khatibzadeh: negotiations are pointless, Iran is preparing for worst-case scenarios", text: "" };
  const excl: Card = {
    fp: "aw", at: "2026-10-15T17:56:18Z", source: "Asharq Al-Awsat", url: "https://english.aawsat.com/node/5330067", type: "statement",
    summary: "Araghchi aide Khatibzadeh in Beirut: negotiations pointless, Iran preparing for worst-case scenarios",
    text: "Iranian Foreign Minister Abbas Araghchi's aide Saeed Khatibzadeh arrived in Beirut and met Parliament Speaker Nabih Berri and Hezbollah leadership.",
    flags: ["exclusive"],
  };
  const out = foldServed([relay, excl]).reports;
  assert.equal(out.length, 1);
  assert.equal(out[0].source, "Asharq Al-Awsat");
  assert.equal(out[0].url, excl.url);
  assert.ok(out[0].flags?.includes("exclusive"));
  // An exclusive keeps no post under it (user, 8 Oct).
  assert.equal(out[0].alsoReportedBy, undefined);
});

test("never from the speaker's own account, an official body's or a spokesman's post", () => {
  const own: Card = { fp: "a", at: "2026-10-17T11:26:00Z", source: "Abbas Araghchi", url: "https://x.com/araghchi/status/1", type: "statement", summary: "Araghchi: Either we build regional security together, or we will bear insecurity together", text: "" };
  const site: Card = { fp: "b", at: "2026-10-17T12:00:00Z", source: "Al Jazeera", url: "https://www.aljazeera.com/news/2026/10/17/araghchi", type: "statement", summary: "Araghchi: Either we build regional security together, or we will bear insecurity together", text: "", flags: ["exclusive"] };
  const home = joinInto({ ...own }, site, "remarks");
  assert.equal(home.source, "Abbas Araghchi");
  assert.equal(home.alsoReportedBy?.[0].url, site.url);
  const saree = { url: "https://x.com/Yahya_Saree/status/1", source: "Yahya Saree", summary: "Saree: 3 operations" };
  assert.equal(siteTakesLead(saree, { ...site, flags: ["exclusive"] }), false);
  assert.equal(siteTakesLead({ url: "https://x.com/SPAregions/status/1", source: "SPA", summary: "x" }, { ...site, flags: ["exclusive"] }), false);
});

test("Also: posts once per outlet and capped, site articles once per link and never cut", () => {
  const lead = { source: "Fars News", url: "https://t.me/farsna/469088" };
  const posts = Array.from({ length: 12 }, (_, i) => ({ source: `Channel ${i}`, url: `https://t.me/c${i}/1` }));
  const sites = [
    { source: "Asharq Al-Awsat", url: "https://english.aawsat.com/node/5330760" },
    { source: "Asharq Al-Awsat", url: "https://english.aawsat.com/node/5330779" },
    { source: "Asharq Al-Awsat", url: "https://english.aawsat.com/node/5330760" },
  ];
  const out = mergeAlso(undefined, [...posts, ...sites], lead)!;
  assert.equal(out.filter((a) => a.url.includes("aawsat")).length, 2);
  assert.equal(out.filter((a) => a.url.startsWith("https://t.me/")).length, 8);
  assert.equal(out[0].url, "https://english.aawsat.com/node/5330760");
});
