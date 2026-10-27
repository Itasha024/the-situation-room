import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLedger, figureInText, LEDGER_SEED, nameInText, siteOf } from "./ledger.ts";

const now = new Date("2026-09-30T15:00:00Z");
const doc = (text: string, date = "2026-09-30", name = "Reuters") => ({ name, url: `https://example.com/${date}/${name}`, date, text });

test("a ledger figure stands only when its digits are in the text", () => {
  assert.equal(figureInText("Saudi exports from Yanbu reached 1.2 million barrels a day", 1.2), true);
  assert.equal(figureInText("exports of 1,200,000 barrels a day", 1200000), true);
  assert.equal(figureInText("Some 31 ships crossed Bab al-Mandab", 31), true);
  assert.equal(figureInText("Some 312 ships crossed", 31), false);
  assert.equal(figureInText("exports rose sharply", 5), false);
});

test("a ship or a site is named in the text, whatever a report calls it", () => {
  assert.equal(nameInText("The M/V Eternity C was hit off Hodeidah", "Eternity C"), true);
  assert.equal(nameInText("A tanker was hit off Hodeidah", "Eternity C"), false);
  assert.equal(siteOf("pumping station 8 on the East-West line")?.id, "east-west-pipeline");
  assert.equal(siteOf("SAMREF refinery")?.id, "yanbu");
  assert.equal(siteOf("some plant", "refinery", "Oman"), null);
});

test("the ledger: one row per incident and site, the latest status stands, nothing the text does not say", () => {
  const docs = [
    doc("UKMTO: a tanker was hit by a projectile 40 nm west of Hodeidah; the crew are safe."),
    doc("The Liberian-flagged tanker Sea Crest was struck west of Hodeidah, the Houthis said.", "2026-09-30", "AP"),
    doc("Drones hit pump station 8 on the East-West pipeline; pumping was halted.", "2026-09-29", "Reuters"),
    doc("Aramco said pumping on the East-West pipeline resumed after repairs.", "2026-09-30", "Aramco"),
    doc("Saudi crude exports from Yanbu reached 1.2 million barrels a day in September.", "2026-09-30", "Kpler"),
  ];
  const next = applyLedger(
    LEDGER_SEED,
    {
      ships: [
        { doc: 0, date: "2026-09-30", place: "40 nm west of Hodeidah", what: "hit", type: "tanker" },
        { doc: 1, date: "2026-09-30", ship: "Sea Crest", flag: "Liberia", place: "west of Hodeidah", what: "hit", attacker: "Houthis" },
        // A name the text never wrote: refused.
        { doc: 0, date: "2026-09-30", ship: "Ocean Star", place: "off Mocha", what: "attacked" },
      ],
      sites: [
        { doc: 2, site: "pump station 8", country: "Saudi Arabia", hit: true, status: "down" },
        { doc: 3, site: "East-West pipeline", country: "Saudi Arabia", status: "working" },
        // Its older report comes later in the list and does not undo the newer one.
        { doc: 2, site: "East-West pipeline", country: "Saudi Arabia", hit: true, status: "down" },
      ],
      figures: [
        { doc: 4, cat: "energy", label: "Saudi crude exports from Yanbu", value: 1.2, unit: "million barrels a day" },
        { doc: 4, cat: "energy", label: "Saudi crude exports in total", value: 7, unit: "million barrels a day" },
      ],
    },
    docs,
    now,
  );
  assert.equal(next.ships.length, 1, "the unnamed tanker off Hodeidah is the Sea Crest; Ocean Star refused");
  assert.ok(next.ships.some((s) => s.ship === "Sea Crest" && s.attacker === "Houthis"));
  assert.equal(next.sites.length, 1);
  const pipe = next.sites[0];
  assert.equal(pipe.id, "east-west-pipeline");
  assert.equal(pipe.hits.length, 1, "one hit a day");
  assert.equal(pipe.status, "working");
  assert.equal(pipe.statusSrc?.name, "Aramco");
  assert.deepEqual(next.figures.map((f) => f.value), [1.2]);
  // Read again: nothing doubles.
  const again = applyLedger(next, { ships: [{ doc: 1, date: "2026-09-30", ship: "Sea Crest", place: "west of Hodeidah", what: "sunk" }] }, docs, now);
  assert.equal(again.ships.length, 1);
  assert.equal(again.ships.find((s) => s.ship === "Sea Crest")?.what, "sunk", "a later report can say more");
});

test("the research baseline sits under the stored ledger; a stored row wins; a Houthi-only report is a claim", async () => {
  const { withBaseline, groupOf, parseFredCsv } = await import("./ledger.ts");
  const { LEDGER_BASELINE } = await import("./ledger-baseline.ts");
  const merged = withBaseline(LEDGER_SEED);
  assert.equal(merged.ships.length, LEDGER_BASELINE.ships.length);
  assert.ok(merged.sites.some((s) => s.id === "east-west-pipeline" && s.status === "working"));
  // Every baseline row links its report, and no Israeli outlet.
  const urls = [...LEDGER_BASELINE.ships.map((s) => s.src.url), ...LEDGER_BASELINE.sites.flatMap((s) => s.hits.map((h) => h.url)), ...LEDGER_BASELINE.figures.map((f) => f.src.url), ...LEDGER_BASELINE.notices.map((n) => n.src.url)];
  assert.ok(urls.every((u) => /^https:\/\//.test(u)));
  assert.ok(!urls.some((u) => /timesofisrael|jpost|haaretz|ynet|i24|israelhayom|kan\.org/.test(u)));
  // A stored row of the same id wins over the baseline's.
  const stored = { ...LEDGER_SEED, ships: [{ ...LEDGER_BASELINE.ships[0], what: "sunk" as const }] };
  assert.equal(withBaseline(stored).ships.find((s) => s.id === LEDGER_BASELINE.ships[0].id)?.what, "sunk");
  // A new hit reported only by the Houthis' outlets is their claim; a wire's report lifts it.
  const docs = [doc("Al-Masirah: Houthi drones hit the Aramco refinery in Jazan.", "2026-10-01", "Al-Masirah"), doc("Reuters: a fire broke out at Aramco's Jazan refinery after a drone strike.", "2026-10-01", "Reuters")];
  const one = applyLedger(merged, { sites: [{ doc: 0, site: "Jazan refinery", country: "Saudi Arabia", hit: true }] }, docs, now);
  assert.equal(one.sites.find((s) => s.id === "jazan")?.hits.find((h) => h.date === "2026-10-01")?.claim, true);
  const two = applyLedger(one, { sites: [{ doc: 1, site: "Jazan refinery", country: "Saudi Arabia", hit: true }] }, docs, now);
  assert.ok(!two.sites.find((s) => s.id === "jazan")?.hits.find((h) => h.date === "2026-10-01")?.claim);
  // A month's figure never overwrites another month's.
  const f = applyLedger(LEDGER_SEED, { figures: [{ doc: 0, cat: "maritime", label: "Oil through Bab al-Mandab", value: 2.5, unit: "million barrels a day", period: "October" }] }, [doc("Oil through Bab al-Mandab fell to 2.5 million barrels a day in October.")], now);
  assert.equal(withBaseline(f).figures.filter((x) => x.label === "Oil through Bab al-Mandab").length, 4);
  assert.equal(f.figures[0].group, "oil");
  assert.equal(groupOf("maritime", "War-risk insurance 3% of value"), "cost");
  assert.equal(groupOf("maritime", "Ships crossing Bab al-Mandab"), "traffic");
  assert.equal(groupOf("energy", "Brent crude $105 a barrel"), "prices");
  assert.deepEqual(parseFredCsv("observation_date,DCOILBRENTEU\n2026-09-21,116.15\n2026-09-22,.\n"), [{ date: "2026-09-21", value: 116.15 }]);
});

test("sources rank official, then wire, then the rest; a claim is lowest; monthly figures find their chart", async () => {
  const { sourceTier, betterSource, seriesOf, withBaseline, WAR_START } = await import("./ledger.ts");
  const { LEDGER_BASELINE } = await import("./ledger-baseline.ts");
  const S = (name: string, extra = {}) => ({ name, url: "https://example.com/x", date: "2026-09-10", ...extra });
  assert.equal(sourceTier(S("UKMTO, warning 119-26")), "official");
  assert.equal(sourceTier(S("Saudi Energy Ministry, via AP")), "official");
  assert.equal(sourceTier(S("Reuters")), "wire");
  assert.equal(sourceTier(S("AFP, via France 24")), "wire");
  assert.equal(sourceTier(S("Reuters", { claim: true })), "claim");
  assert.equal(sourceTier(S("The Maritime Executive")), "other");
  assert.equal(betterSource(S("UKMTO"), S("Al Jazeera")), true);
  assert.equal(betterSource(S("Reuters"), S("UKMTO")), false);
  assert.equal(betterSource(S("Al Jazeera"), S("Saba", { claim: true })), true);
  assert.deepEqual(seriesOf("Saudi crude exports", "million barrels a day", "September"), { series: "saudi-exports", month: "2026-09" });
  assert.deepEqual(seriesOf("Oil through Bab al-Mandab", "million barrels a day", "August"), { series: "bab-oil", month: "2026-08" });
  assert.equal(seriesOf("Saudi crude exports", "million barrels a day", "22-26 Sep"), null);
  // The baseline: the war's start, every attack on its best source, UKMTO's own warnings for the ships.
  assert.equal(WAR_START, "2026-07-13");
  assert.ok(LEDGER_BASELINE.ships.every((s) => s.date >= WAR_START));
  assert.ok(LEDGER_BASELINE.ships.filter((s) => sourceTier(s.src) === "official").length >= 8);
  // A stored row from a lesser source gives way to the baseline's official one.
  const stored = { ...LEDGER_SEED, ships: [{ id: "2026-08-24-amzan", date: "2026-08-24", ship: "Amzan", place: "Red Sea", what: "hit" as const, src: S("Al Jazeera") }] };
  const merged = withBaseline(stored);
  assert.match(merged.ships.find((s) => s.ship === "Amzan")!.src.name, /UKMTO/);
  // A model figure for a month on a chart: a wire's figure is not replaced by a lesser outlet's.
  const docs = [doc("Saudi crude exports were 5.4 million barrels a day in September", "2026-09-28", "Reuters"), doc("Saudi crude exports were 6 million barrels a day in September", "2026-09-29", "CNBC")];
  const l = applyLedger(LEDGER_SEED, { figures: [{ doc: 0, cat: "energy", label: "Saudi crude exports", value: 5.4, unit: "million barrels a day", period: "September" }, { doc: 1, cat: "energy", label: "Saudi crude exports", value: 6, unit: "million barrels a day", period: "September" }] }, docs, now);
  const sep = l.figures.filter((f) => f.series === "saudi-exports" && f.month === "2026-09");
  assert.equal(sep.length, 1);
  assert.equal(sep[0].value, 5.4);
  // "The Houthis said they targeted" in a wire story stays a claim.
  const c = applyLedger(LEDGER_SEED, { sites: [{ doc: 0, site: "Yanbu", hit: true, claimed: true }] }, [doc("The Houthis said they targeted Aramco in Yanbu", "2026-09-24", "Reuters")], now);
  assert.equal(sourceTier(c.sites[0].hits[0]), "claim");
});

test("the baseline links to originals, not to reposts", async () => {
  const { LEDGER_BASELINE } = await import("./ledger-baseline.ts");
  const urls = [...LEDGER_BASELINE.ships.map((s) => s.src.url), ...LEDGER_BASELINE.sites.flatMap((s) => [...s.hits.map((h) => h.url), s.statusSrc?.url ?? ""]), ...LEDGER_BASELINE.figures.map((f) => f.src.url)];
  for (const u of urls) assert.doesNotMatch(u, /boereport|marketscreener|energynewsbeat|npr\.org|dawn\.com|brecorder|kurdistan24/, u);
  // The Houthis' own claims link to their spokesman's channel; a claim he never posted (1 Oct)
  // links to the outlet that carried it.
  const yanbu = LEDGER_BASELINE.sites.find((s) => s.id === "yanbu")!;
  assert.ok(yanbu.hits.filter((h) => h.claim).every((h) => h.url.startsWith("https://t.me/")));
  // Satellite pictures of old damage are not a new attack.
  assert.ok(!yanbu.hits.some((h) => h.date === "2026-09-30"));
});

test("a site stored under another name joins its row; wrong hits stay out; weapons are kept", async () => {
  const { withBaseline, LEDGER_SEED } = await import("./ledger.ts");
  const stored = structuredClone(LEDGER_SEED);
  stored.sites.push(
    { id: "taibah-power-plant", name: "Taibah power plant", kind: "power plant", country: "Saudi Arabia", hits: [{ name: "Al Arabiya", url: "https://t.me/alarabiyaBr/1", date: "2026-10-01" }], status: "unknown" },
    { id: "abqaiq", name: "Abqaiq", kind: "processing plant", country: "Saudi Arabia", hits: [{ name: "Shajab News", url: "https://t.me/shajab_news/68014", date: "2026-09-30" }], status: "unknown" },
  );
  const out = withBaseline(stored);
  assert.equal(out.sites.filter((s) => /Taibah/.test(s.name)).length, 1);
  assert.ok(!out.sites.some((s) => s.hits.some((h) => h.url === "https://t.me/shajab_news/68014")));
  // Ali Bk's report of an attack that day is a claim, not the old picture.
  assert.ok(out.sites.find((s) => s.id === "abqaiq")?.hits.some((h) => h.url === "https://t.me/Alibk3/37488" && h.claim));
  assert.equal(out.sites.find((s) => s.id === "taibah-medina")!.hits[0].weapon, "A drone");
  assert.ok(out.ships.every((s) => s.weapon), "every researched ship attack names its weapon");
});

test("a new hit on one site a day after another stands: time never decides a retelling (user, 7 Oct)", async () => {
  const { withBaseline } = await import("./ledger.ts");
  const stored = structuredClone(LEDGER_SEED);
  stored.sites = [{ id: "taibah-medina", name: "Taibah power plant", kind: "power", country: "Saudi Arabia", status: "working", hits: [
    { url: "a", date: "2026-10-01", name: "Saudi-led coalition (Al Arabiya)", tier: "official" },
    { url: "b", date: "2026-10-02", name: "Nour News", claim: true },
  ] }] as typeof stored.sites;
  const row = withBaseline(stored, { ...stored, sites: [] }).sites.find((s) => s.id === "taibah-medina");
  assert.deepEqual(row?.hits.map((h) => h.url), ["a", "b"]);
});

test("a ship attacked in the Gulf stays out of the Yemen sea count unless the Houthis did it (8 Oct)", async () => {
  const { applyLedger, LEDGER_SEED } = await import("./ledger.ts");
  const doc = { name: "Splash247", url: "https://splash247.com/x", date: "2026-10-08", text: "The tanker Acers was attacked off Qatar." };
  const now = new Date("2026-10-08T12:00:00+03:00");
  const out = applyLedger(LEDGER_SEED, { ships: [{ doc: 0, ship: "Acers", place: "off Qatar", what: "attacked", date: "2026-10-08" }] }, [doc] as never, now);
  assert.equal(out.ships.length, 0);
  const red = applyLedger(LEDGER_SEED, { ships: [{ doc: 0, ship: "Acers", place: "off Qatar", what: "attacked", date: "2026-10-08", attacker: "the Houthis" }] }, [doc] as never, now);
  assert.equal(red.ships.length, 1);
});

test("one incident at sea, one row: three outlets on one tanker off Hadramawt (17 Oct); a tanker and a landing ship stay two", async () => {
  const { sameIncident, seaArea } = await import("./ledger.ts");
  assert.equal(seaArea("140 miles southeast of Al-Mukalla"), "aden");
  assert.equal(seaArea("off Hadramawt coast"), "aden");
  assert.equal(seaArea("Gulf of Aden"), "aden");
  assert.equal(seaArea("Red Sea"), null);
  const a = { date: "2026-10-17", place: "140 miles southeast of Al-Mukalla", type: "LNG tanker" };
  assert.equal(sameIncident(a, { date: "2026-10-17", place: "off Hadramawt coast" }), true);
  assert.equal(sameIncident(a, { date: "2026-10-17", place: "Gulf of Aden" }), true);
  assert.equal(sameIncident(a, { date: "2026-10-17", place: "off Mocha" }), false);
  assert.equal(sameIncident({ date: "2026-08-17", place: "40 nm south-east of Al Mukha", type: "cargo ship" }, { date: "2026-08-17", place: "off Mocha", type: "military landing ship" }), false);
  // Read again from three reports: one row.
  const docs = [
    doc("UKMTO: an LNG tanker reported an approach 140 miles southeast of Al-Mukalla by a small craft; shots were fired.", "2026-10-17", "UKMTO"),
    doc("حادثه امنیتی در خلیج عدن: a tanker in the Gulf of Aden.", "2026-10-17", "ISNA"),
    doc("A tanker came under fire off the coast of Hadramawt.", "2026-10-17", "Al-Masdar Online"),
  ];
  const out = applyLedger(LEDGER_SEED, { ships: [
    { doc: 1, date: "2026-10-17", place: "Gulf of Aden", what: "attacked", weapon: "drone" },
    { doc: 0, date: "2026-10-17", place: "140 miles southeast of Al-Mukalla", what: "attacked", type: "LNG tanker", weapon: "missile" },
    { doc: 2, date: "2026-10-17", place: "off Hadramawt coast", what: "attacked" },
  ] }, docs, now);
  assert.equal(out.ships.length, 1);
  assert.equal(out.ships[0].src.name, "UKMTO", "the official teller leads");
});

test("piracy is not the war's: armed men in a skiff firing two shots (17 Oct), stored rows too", async () => {
  const { piracy, withBaseline } = await import("./ledger.ts");
  assert.equal(piracy({ weapon: "two shots" }), true);
  assert.equal(piracy({ attacker: "Armed men in boat" }), true);
  assert.equal(piracy({ weapon: "gunfire" }), true);
  assert.equal(piracy({ attacker: "Houthis", weapon: "gunfire from a skiff" }), false);
  assert.equal(piracy({ weapon: "Ballistic missile" }), false);
  const stored = structuredClone(LEDGER_SEED);
  stored.ships = [
    { id: "a", date: "2026-10-17", place: "Gulf of Aden", what: "attacked", weapon: "gunfire", src: { name: "ISNA", url: "https://t.me/isna94/409167", date: "2026-10-17" } },
    { id: "b", date: "2026-10-17", place: "off Hadramawt coast", what: "attacked", attacker: "Armed men in boat", src: { name: "Al-Masdar Online", url: "https://x.com/almasdaronline/status/2111507450830430339", date: "2026-10-17" } },
  ];
  assert.ok(!withBaseline(stored).ships.some((s) => s.date === "2026-10-17"));
  const fresh = applyLedger(LEDGER_SEED, { ships: [{ doc: 0, date: "2026-10-17", place: "off Hadramawt coast", what: "attacked", attacker: "Armed men in boat" }] }, [doc("Armed men in a boat fired at a tanker off Hadramawt", "2026-10-17", "Al-Masdar Online")], now);
  assert.equal(fresh.ships.length, 0);
});

test("a site's state never comes from the attacking side's own outlets (2 Oct: Al-Masirah's 'Yanbu down')", async () => {
  const { withBaseline } = await import("./ledger.ts");
  const stored = structuredClone(LEDGER_SEED);
  stored.sites = [{ id: "yanbu", name: "Yanbu", kind: "terminal", country: "Saudi Arabia", hits: [], status: "down", statusSrc: { name: "Al-Masirah", url: "https://t.me/almasirah2/301147", date: "2026-10-02" } }];
  const y = withBaseline(stored).sites.find((s) => s.id === "yanbu")!;
  assert.equal(y.status, "working");
  assert.match(y.statusSrc!.name, /Marine Insight/);
  const docs = [doc("Al-Masirah: Yanbu's terminals are out of service after the strike.", "2026-10-02", "Al-Masirah")];
  const out = applyLedger(withBaseline(LEDGER_SEED), { sites: [{ doc: 0, site: "Yanbu", country: "Saudi Arabia", status: "down" }] }, docs, now);
  assert.equal(out.sites.find((s) => s.id === "yanbu")!.status, "working");
});

test("a site's other spellings are its row: 'Saudi Shaqam gas plant' is Shedgum (10 Oct)", () => {
  assert.equal(siteOf("Saudi Shaqam gas plant")?.id, "shedgum");
  assert.equal(siteOf("Shadgum")?.id, "shedgum");
});

test("a Google News link is swapped for its article, and 'Google News' for the outlet", async () => {
  const { gnewsLinks, swapLinks } = await import("./ledger.ts");
  const g = "https://news.google.com/rss/articles/CBMiabc?oc=5";
  const l = structuredClone(LEDGER_SEED);
  l.sites = [{ id: "dhahran-aramco", name: "Aramco headquarters, Dhahran", kind: "headquarters", country: "Saudi Arabia", hits: [{ name: "Google News", url: g, date: "2026-10-15" }], status: "reduced", statusSrc: { name: "Mathrubhumi English", url: g, date: "2026-10-14" } }];
  assert.deepEqual(gnewsLinks(l), [g]);
  const out = swapLinks(l, { [g]: "https://www.aa.com.tr/en/world/some-story/4087646" });
  assert.equal(out.sites[0].hits[0].url, "https://www.aa.com.tr/en/world/some-story/4087646");
  assert.equal(out.sites[0].hits[0].name, "Anadolu Ajansı");
  assert.equal(out.sites[0].statusSrc!.name, "Mathrubhumi English");
  assert.deepEqual(gnewsLinks(out), []);
});

test("the 18 Oct audit: wrong days, later reports and other names stay out; states checked by hand stand", async () => {
  const { withBaseline } = await import("./ledger.ts");
  assert.equal(siteOf("Saba oil station in Sanaa")?.id, "sabaha-sanaa");
  assert.equal(siteOf("fuel warehouse in Sanaa")?.id, "sabaha-sanaa");
  assert.equal(siteOf("Al-Ahsa gas plant")?.id, "shedgum");
  const H = (name: string, url: string, date: string, claim = false) => ({ name, url, date, ...(claim ? { claim } : {}) });
  const stored = structuredClone(LEDGER_SEED);
  stored.ships = [
    { id: "2026-10-01-yanbu-port-tanker", date: "2026-10-01", place: "Yanbu port", what: "hit", src: H("OSINT Hexagone", "https://x.com/osinthexagone/status/2105763243184603198", "2026-10-01") },
    { id: "2026-10-15-cma-cgm-champs-elysee", date: "2026-10-15", ship: "CMA CGM Champs Elysee", place: "Red Sea", what: "near miss", src: H("The Maritime Executive", "https://maritime-executive.com/x", "2026-10-15") },
    { id: "2026-10-04-60-nautical-miles-south-of-mocha-yemen", date: "2026-10-04", place: "60 nm south of Mocha", what: "near miss", src: { ...H("UKMTO", "https://x.com/UK_MTO/status/2106820205938692327", "2026-10-04"), tier: "official" } },
  ];
  stored.sites = [
    { id: "dhahran-aramco", name: "Aramco headquarters, Dhahran", kind: "headquarters", country: "Saudi Arabia", status: "reduced", statusSrc: H("Anadolu Ajansı", "https://www.aa.com.tr/x/4087646", "2026-10-14"), hits: [H("Bloomberg", "https://www.bloomberg.com/x", "2026-10-13"), H("Anadolu Ajansı", "https://www.aa.com.tr/x/4087646", "2026-10-14"), H("Google News", "https://news.google.com/rss/articles/x", "2026-10-15", true)] },
    { id: "saba-oil-station-in-sanaa", name: "Saba oil station in Sanaa", kind: "fuel station", country: "Yemen", status: "unknown", hits: [H("Al-Araby Al-Jadeed", "https://www.alaraby.co.uk/x", "2026-10-14")] },
    { id: "jeddah", name: "Jeddah bulk plant", kind: "terminal", country: "Saudi Arabia", status: "unknown", hits: [H("Tasnim", "https://t.me/Tasnimnews_en/42377", "2026-10-11", true)] },
  ];
  const l = withBaseline(stored);
  assert.ok(!l.ships.some((s) => s.id === "2026-10-01-yanbu-port-tanker"), "a projectile in the port is the site's hit");
  assert.equal(l.ships.find((s) => /Champs/.test(s.ship ?? ""))?.date, "2026-10-01");
  assert.equal(l.ships.filter((s) => /Champs/.test(s.ship ?? "")).length, 1);
  assert.equal(l.ships.find((s) => s.date === "2026-10-04")?.ship, "Chrystal Sky");
  const dh = l.sites.find((s) => s.id === "dhahran-aramco")!;
  assert.deepEqual(dh.hits.map((h) => h.date), ["2026-10-13"]);
  assert.equal(dh.status, "working");
  assert.equal(dh.statusSrc?.name, "The National");
  assert.deepEqual(l.sites.find((s) => s.id === "sabaha-sanaa")!.hits.map((h) => h.date), ["2026-10-13"]);
  assert.ok(!l.sites.some((s) => s.id === "jeddah" || s.id === "saba-oil-station-in-sanaa"));
  assert.equal(l.sites.find((s) => s.id === "taibah-medina")!.hits[0].date, "2026-09-29");
  assert.equal(l.sites.find((s) => s.id === "riyadh-refinery")?.status ?? "unknown", "unknown");
});

test("Brent: FRED's week-old spot price runs on with the stored daily futures, named in the source (27 Oct)", async () => {
  const { extendBrent } = await import("./ledger.ts");
  const spot = { name: "Brent crude", unit: "dollars a barrel", baseline: { value: 70, from: "a", to: "b" }, days: [{ date: "2026-10-19", value: 110 }, { date: "2026-10-20", value: 115.22 }], source: { name: "US EIA via FRED", url: "u", date: "2026-10-20" } };
  const got = extendBrent(spot, [{ d: "2026-10-20", v: 114 }, { d: "2026-10-26", v: 115.809 }, { d: "2026-10-27", v: 110.78 }]);
  assert.deepEqual(got.days.map((d) => d.date), ["2026-10-19", "2026-10-20", "2026-10-26", "2026-10-27"]);
  assert.equal(got.days.at(-1)!.value, 110.78);
  assert.equal(got.source.date, "2026-10-27");
  assert.match(got.source.name, /FRED to 2026-10-20, then ICE Brent futures/);
  assert.equal(extendBrent(spot, []), spot);
});
