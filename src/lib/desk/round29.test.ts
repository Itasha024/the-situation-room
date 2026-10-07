import { isExclusive } from "./exclusive.ts";
import { namedSpeaker } from "./links.ts";
import { parseHtmlListing, parseListing } from "./sitemap.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { captureConfirmed, tookGround } from "./control-live.ts";
import { cardMarks, kindOf } from "./dev-marks.ts";
import { applyLedger, notEnergySite, siteOf, withBaseline, LEDGER_SEED, type Ledger } from "./ledger.ts";
import { LEDGER_BASELINE } from "./ledger-baseline.ts";
import { officialLead, ownClaim } from "./editor.ts";

/* Round 29: the user's review of 3 Oct. */

const card = (fp: string, source: string, summary: string, lat: number, lng: number, extra: Record<string, unknown> = {}) =>
  ({ fp, source, summary, lat, lng, live: true, text: "", type: "combat", url: `https://x/${fp}`, at: "2026-10-03T05:00:00Z", ...extra }) as never;
const both = { alsoReportedBy: [{ source: "Al-Masirah", url: "https://t.me/almasirah2/1" }] };

test("a flag of ground taken needs the whole district, as control does (user, 3 Oct)", () => {
  // The whole district, told by both sides: a flag.
  assert.equal(captureConfirmed(card("a", "Al Arabiya", "Government forces take full control of Al-Hazm district after heavy fighting", 16.2, 44.8, both)), true);
  // A town, a hill or a district centre, even told by both sides: an advance.
  assert.equal(captureConfirmed(card("b", "Al Arabiya", "Government forces capture the town of Al-Hazm", 16.2, 44.8, both)), false);
  assert.equal(captureConfirmed(card("c", "Al Arabiya", "Government forces seize hills overlooking Al-Hazm", 16.2, 44.8, both)), false);
  // One side's word of the whole district: still an advance.
  assert.equal(captureConfirmed(card("d", "Al Arabiya", "Government forces take full control of Al-Hazm district", 16.2, 44.8)), false);
  // Not a combat report: no flag.
  assert.equal(captureConfirmed(card("e", "Al Arabiya", "Government forces take full control of Al-Hazm district", 16.2, 44.8, { ...both, type: "strike" })), false);
});

test("seized weapons, boats or a building are no ground taken", () => {
  assert.equal(tookGround("Coast guard seizes weapons bound for the Houthis off Mocha"), false);
  assert.equal(tookGround("Houthi forces seize Al-Juba hospital in Marib for military use"), false);
  assert.equal(tookGround("Government forces seize Jabal Habashi"), true);
  assert.notEqual(kindOf(card("f", "Almashhad", "Coast guard seizes weapons bound for the Houthis off Mocha", 13.3, 43.2)), "capture");
  assert.equal(kindOf(card("g", "Almashhad", "Government forces seize Jabal Habashi", 13.5, 43.8)), "capture");
});

test("the developments' maps draw a town taken as an advance, the whole district as ground taken", () => {
  const { all } = cardMarks(
    [
      card("h", "Al Arabiya", "Government forces capture the town of Al-Hazm", 16.2, 44.8, both),
      card("i", "Al Arabiya", "Government forces take full control of Al-Hazm district", 16.2, 44.8, both),
    ],
    () => [],
  );
  assert.deepEqual(all.map((m) => m.kind).sort(), ["advance", "capture"]);
});

test("the hand-checked maritime row keeps its words over a stored copy: two dhow boats", () => {
  const base = LEDGER_BASELINE.ships.find((s) => s.id === "2026-08-14-mocha-dhows");
  assert.ok(base);
  assert.match(base.type ?? "", /two dhow boats/);
  const stored = { ...structuredClone(LEDGER_BASELINE), ships: [{ ...structuredClone(base), type: "two dhows and fishing boats" }], sites: [], figures: [], notices: [] };
  const got = withBaseline(stored as never).ships.find((s) => s.id === "2026-08-14-mocha-dhows");
  assert.equal(got?.type, "two dhow boats and fishing boats");
});

test("6 Oct: a peak and positions taken are advances, and Nation's Shield is the government's", () => {
  const aj = { alsoReportedBy: [{ source: "Al Jazeera", url: "https://t.me/AjaNews/515696" }] };
  const { all } = cardMarks(
    [
      card("j", "Nation's Shield", "Nation's Shield forces seize Jabal Habashi peak in Taiz", 13.52, 43.83, { place: "Jabal Habashi", ...aj }),
      card("k", "Yemeni Army Media", "Nation's Shield forces capture strategic positions in Al-Wazi'iyah, Taiz", 13.18, 43.75, { place: "Al-Wazi'iyah", ...aj }),
    ],
    () => [],
  );
  assert.deepEqual(all.map((m) => [m.kind, m.side]), [["advance", "government"], ["advance", "government"]]);
});

/* Stage 2: the Maritime and Energy tables (user, 3 Oct). */

const hitOn = (date: string, name: string, url: string, claim = true) => ({ date, name, url, ...(claim ? { claim } : {}) });
const storedSite = (id: string, name: string, hits: ReturnType<typeof hitOn>[]) => ({ id, name, kind: "site", country: "Saudi Arabia" as const, hits, status: "unknown" as const });

test("airports and placeless names are no energy sites; a fuel depot by an airport is", () => {
  for (const n of ["Abha airport", "power stations", "Saudi Aramco facilities", "Aramco refinery", "Khamis Mushait air base"]) assert.equal(notEnergySite(n), true, n);
  for (const n of ["Riyadh airport fuel depot", "Mocha power station", "Fuel station, Marib city", "Rabigh refinery"]) assert.equal(notEnergySite(n), false, n);
  assert.equal(siteOf("Abha airport", "airport", "Saudi Arabia"), null);
});

test("one site whatever a report calls it", () => {
  const id = (n: string) => siteOf(n, "site", "Saudi Arabia")?.id;
  for (const n of ["Aramco refinery in Riyadh", "aramco oil facility in riyadh", "Aramco company in Saudi capital", "refineries in Riyadh", "Aramco in Riyadh and Khurais"]) assert.equal(id(n), "riyadh-refinery", n);
  assert.equal(id("Aramco oil storage tanks in Riyadh"), "riyadh-depot");
  assert.equal(id("Saudi oil transport pipeline"), "east-west-pipeline");
  assert.equal(id("Saudi oil pipeline"), "east-west-pipeline");
  assert.equal(id("power plant in Medina"), "taibah-medina");
  assert.equal(id("Aramco refinery in Rabigh"), "rabigh");
  assert.equal(id("Rabigh refinery in Jeddah"), "rabigh");
  assert.equal(id("Khurais oil field"), "khurais");
});

test("3 Oct told nine ways is one Riyadh attack, from Reuters; later reports add no rows", () => {
  const stored: Ledger = {
    ...structuredClone(LEDGER_SEED),
    sites: [
      storedSite("aramco-refinery-in-riyadh", "Aramco refinery in Riyadh", [hitOn("2026-10-03", "Ali Bk", "https://t.me/Alibk3/37763")]),
      storedSite("oil-site-in-riyadh", "Oil site in Riyadh", [hitOn("2026-10-03", "Ali Bk", "https://t.me/Alibk3/37754")]),
      storedSite("aramco-facilities-in-riyadh", "Aramco facilities in Riyadh", [hitOn("2026-10-04", "Press TV", "https://t.me/presstv/209460"), hitOn("2026-10-06", "Naya", "https://t.me/naya_foriraq/92724")]),
      storedSite("abha-airport", "Abha airport", [hitOn("2026-10-06", "Al-Masirah", "https://t.me/almasirah2/301771")]),
      storedSite("power-stations", "Power stations", [hitOn("2026-10-04", "The Cube", "https://x.com/war_cube/status/2106763064435429725")]),
      storedSite("abqaiq", "Abqaiq", [hitOn("2026-09-30", "Ali Bk", "https://t.me/Alibk3/37510")]),
    ],
  };
  const out = withBaseline(stored);
  const riyadh = out.sites.find((s) => s.id === "riyadh-refinery");
  assert.deepEqual(riyadh?.hits.map((h) => [h.date, h.name]), [["2026-10-03", "Reuters"]]);
  assert.equal(out.sites.some((s) => /airport|power-stations|aramco-/.test(s.id)), false);
  // The user's links: 30 Sep Abqaiq, 1 Oct Taibah.
  assert.equal(out.sites.find((s) => s.id === "abqaiq")?.hits.find((h) => h.date === "2026-09-30")?.url, "https://t.me/Alibk3/37488");
  assert.equal(out.sites.find((s) => s.id === "taibah-medina")?.hits[0]?.url, "https://x.com/CJFCSpox/status/2105696227568353710");
  // 21 Sep and 27 Sep retold, 2 Oct reactions: gone.
  const days = (id: string) => out.sites.find((s) => s.id === id)?.hits.map((h) => h.date) ?? [];
  assert.equal(days("riyadh-depot").includes("2026-09-21"), false);
  assert.equal(days("yanbu").includes("2026-09-27"), false);
  assert.equal(days("taibah-medina").includes("2026-10-02"), false);
});

test("a later report of a strike is dated by the strike and adds no hit", () => {
  const base: Ledger = { ...structuredClone(LEDGER_SEED), sites: [storedSite("riyadh-refinery", "Aramco refinery, Riyadh", [hitOn("2026-10-03", "Reuters", "https://reuters.com/x", false)])] };
  const docs = [
    { name: "Yahya Saree", url: "https://x.com/Yah_Saree/status/1", date: "2026-10-04", headline: "Houthi forces launched ballistic missiles and drones at Aramco in Riyadh and Khurais", text: "Aramco in Riyadh and Khurais" },
    { name: "Ali Bk", url: "https://t.me/Alibk3/2", date: "2026-10-04", headline: "Fire continues to burn at Aramco refinery in Riyadh", text: "Fire continues to burn at Aramco refinery in Riyadh" },
    { name: "Shajab News", url: "https://t.me/shajab_news/3", date: "2026-10-05", headline: "Smoke at the Rabigh refinery after a Houthi strike yesterday", text: "Rabigh refinery smoke" },
  ];
  const next = applyLedger(base, { sites: [
    { doc: 0, site: "Aramco in Riyadh", country: "Saudi Arabia", hit: true, retold: true, claimed: true },
    { doc: 1, site: "Aramco refinery in Riyadh", country: "Saudi Arabia", hit: true, claimed: true },
    { doc: 2, site: "Rabigh refinery", country: "Saudi Arabia", hit: true, date: "2026-10-04", claimed: true },
  ] }, docs, new Date("2026-10-05T12:00:00Z"));
  assert.deepEqual(next.sites.find((s) => s.id === "riyadh-refinery")?.hits.map((h) => h.date), ["2026-10-03"]);
  assert.deepEqual(next.sites.find((s) => s.id === "rabigh")?.hits.map((h) => h.date), ["2026-10-04"]);
});

test("a tanker attack told again the next day is the same row", () => {
  const base: Ledger = { ...structuredClone(LEDGER_SEED), ships: [{ id: "2026-10-04-mocha", date: "2026-10-04", place: "60 nm south of Mocha", what: "near miss", src: { name: "UKMTO", url: "https://x.com/UK_MTO/status/1", date: "2026-10-04" } }] };
  const docs = [{ name: "Seatrade Maritime", url: "https://seatrade/x", date: "2026-10-05", headline: "Product tanker attacked in Red Sea amid escalating hostilities", text: "A product tanker was attacked in the Red Sea" }];
  const next = applyLedger(base, { ships: [{ doc: 0, place: "Red Sea", what: "attacked", date: "2026-10-04", retold: true }] }, docs, new Date("2026-10-05T12:00:00Z"));
  assert.equal(next.ships.length, 1);
  // No earlier row: a retold attack adds none.
  const none = applyLedger(structuredClone(LEDGER_SEED), { ships: [{ doc: 0, place: "Red Sea", what: "attacked", retold: true }] }, docs, new Date());
  assert.equal(none.ships.length, 0);
});

test("a Houthi-aligned outlet's own attack claim is led by who claims it (8 Oct, Al-Mihwar)", () => {
  assert.equal(ownClaim("Houthi ballistic missiles strike Saudi forces in Al-Turbah area of Lahj", "houthi", "missile_launch", "Al-Mihwar"),
    "Houthi-aligned media: Houthi ballistic missiles strike Saudi forces in Al-Turbah area of Lahj");
  assert.equal(ownClaim("Houthi forces shell Saudi positions in Jazan", "houthi", "shelling", "Al-Masirah"), "Houthi media: Houthi forces shell Saudi positions in Jazan");
  // Already attributed, another side, or not an attack: unchanged.
  assert.equal(ownClaim("Houthi military: missiles hit Riyadh", "houthi", "missile_launch", "Al-Masirah"), "Houthi military: missiles hit Riyadh");
  assert.equal(ownClaim("Houthis say missiles hit Riyadh", "houthi", "missile_launch", "Ali Bk"), "Houthis say missiles hit Riyadh");
  assert.equal(ownClaim("Saudi forces shell Razeh", "saudi", "shelling", "Al-Masirah"), "Saudi forces shell Razeh");
});

test("an official body's own post leads with that body (8 Oct, Sanaa foreign ministry)", () => {
  assert.equal(officialLead("Saudi Arabia continues crimes against Yemen", "Sanaa Foreign Ministry"), "Houthi foreign ministry: Saudi Arabia continues crimes against Yemen");
  assert.equal(officialLead("Saudi Foreign Ministry condemns attack on Abha airport", "Saudi Foreign Ministry"), "Saudi Foreign Ministry condemns attack on Abha airport");
  assert.equal(officialLead("Clashes in Taiz", "Al-Masirah"), "Clashes in Taiz");
});

test("stage 5b listings: Al-Ayyam's coded Arabic and a YouTube video's description are read", () => {
  const html = `<a href="/news/7L6K6AWI-029HUC">&#x200B;&#x647;&#x62C;&#x648;&#x645; &#x62D;&#x648;&#x62B;&#x64A; &#x639;&#x644;&#x649; &#x645;&#x637;&#x627;&#x631; &#x639;&#x62F;&#x646;</a>`;
  const [a] = parseHtmlListing(html, "https://www.alayyam.info/", /^https:\/\/www\.alayyam\.info\/news\/[A-Z0-9-]{10,}$/);
  assert.equal(a.title, "هجوم حوثي على مطار عدن");
  const atom = `<feed><entry><title>Press Secretary Briefs the Press</title><link rel="alternate" href="https://www.youtube.com/watch?v=x1"/><published>2026-10-07T18:00:00+00:00</published><media:group><media:description>Yemen and the Red Sea</media:description></media:group></entry></feed>`;
  const [y] = parseListing(atom);
  assert.equal(y.url, "https://www.youtube.com/watch?v=x1");
  assert.equal(y.desc, "Yemen and the Red Sea");
});

test("stage 6a: the English majors' own reporting is an exclusive; a relay is not", () => {
  assert.ok(isExclusive("Houthi drones were bought through Oman, according to documents seen by Reuters.", "Reuters"));
  assert.ok(isExclusive("Axios can reveal that Witkoff met Saudi officials on Yemen.", "Axios"));
  assert.ok(isExclusive("Two US officials who spoke to the Journal said the strikes will widen.", "Wall Street Journal"));
  assert.ok(!isExclusive("Witkoff met Saudi officials on Yemen, Axios reported.", "Fox News"));
  assert.ok(!isExclusive("Houthi drones were bought through Oman, according to documents seen by Reuters.", "The National"));
  assert.ok(!isExclusive("Exclusive footage shows the strike on Sanaa.", "Fox News"));
});

test("stage 6a: Witkoff and the press secretary are searched for like the others", () => {
  assert.equal(namedSpeaker("Witkoff says talks with the Houthis are close"), "witkoff");
  assert.equal(namedSpeaker("Karoline Leavitt: the US will answer any Houthi attack"), "leavitt");
});

test("stage 6b: a major's unnamed officials are its own scoop; a site's licence terms are not an exclusive", () => {
  // Reuters, 7 Oct: on its own site, "two officials said" is Reuters' reporting.
  assert.ok(isExclusive("Turkey sending technical and defensive support to Saudi Arabia to help fight Houthis, officials say\nTurkey is sending mainly defensive and technical support to Saudi Arabia to help it fight Yemen's Iran-aligned Houthis, two officials said on Wednesday.", "Reuters"));
  assert.ok(isExclusive("Saudi Arabia plans major offensive against Houthis, but US declines to join, officials say\nSaudi Arabia is preparing a major offensive.", "Axios"));
  // Retold by another outlet, or not a major: not an exclusive here.
  assert.ok(!isExclusive("Turkey is sending support to Saudi Arabia, two officials told Reuters on Wednesday.", "Fox News"));
  assert.ok(!isExclusive("Turkey is sending support to Saudi Arabia, two officials said, Reuters reported.", "CNN"));
  assert.ok(!isExclusive("Turkey is sending support to Saudi Arabia, two officials said on Wednesday.", "OilPrice.com"));
  // A named minister speaking in public is not a scoop.
  assert.ok(!isExclusive("Turkish Foreign Minister Hakan Fidan said Ankara backs Riyadh.", "Reuters"));
  // SPA, 6 Oct: every page ends with "a non-exclusive licence" in its terms.
  assert.ok(!isExclusive("واس أجرى وزير الدفاع اتصالًا هاتفيًا بوزير الدفاع الإيطالي. فإنك تمنحنا ترخيصا غير حصريا، ومجانيا", "SPA"));
  assert.ok(!isExclusive("By submitting any content to the SPA website, you grant us a non-exclusive, free, permanent licence.", "SPA"));
});

test("stage 6b: a feed that carries the whole article gives it as the article's body", () => {
  const xml = `<rss><channel><item><title>Saudi Arabia plans major offensive against Houthis</title><link>https://www.axios.com/2026/10/02/saudis-yemen-houthis-bab-al-mandeb-strait</link><description>&lt;p&gt;Short teaser.&lt;/p&gt;</description><content:encoded><![CDATA[<p>${"Saudi Arabia is preparing a major offensive against the Houthis. ".repeat(20)}</p>]]></content:encoded><pubDate>Fri, 02 Oct 2026 20:00:00 +0000</pubDate></item></channel></rss>`;
  const [it] = parseListing(xml);
  assert.equal(it.desc, "Short teaser.");
  assert.ok((it.body ?? "").length > 1000);
  assert.ok(!/<p>/.test(it.body ?? ""));
});
