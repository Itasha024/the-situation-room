/**
 * The Maritime and Energy ledger's baseline: what happened from the strike on
 * Sanaa airport (13 July 2026) to 30 September, from the desk's research of
 * that day. Each row stands on the best source there is: the official body
 * first (UKMTO's own warnings, the Saudi Energy Ministry, the Saudi press
 * agency, JODI), then a wire (Reuters, AP, AFP), then anyone else. What only
 * the attacking side reports is marked `claim`, linked to where it first
 * appeared (the Houthi military spokesman's own channel). Where sources disagree,
 * `note` says so. The 6-hour reads (ledger.ts) add to it; a stored row of the
 * same id wins unless the baseline has the better source.
 * No Israeli outlets.
 */

import type { Ledger, LedgerSource } from "./ledger.ts";

const S = (name: string, url: string, date: string, extra: Partial<LedgerSource> = {}): LedgerSource => ({ name, url, date, ...extra });
const UKMTO = (warning: string, id: string, date: string) => S(`UKMTO, warning ${warning}`, `https://x.com/UK_MTO/status/${id}`, date, { tier: "official" });

const NATIONAL_KPLER = "https://www.thenationalnews.com/business/energy/2026/09/29/oil-flows-through-strait-of-hormuz-rise-on-saudi-pivot-as-red-sea-traffic-plunges/";
const REUTERS_KPLER_SEP = "https://www.reuters.com/business/energy/mideast-oil-exports-rebound-september-saudi-arabia-boosts-shipments-2026-09-28/";
const REUTERS_JODI_JUL = "https://www.reuters.com/business/energy/saudi-crude-oil-exports-hit-four-month-high-july-data-shows-2026-09-22/";
/** The Houthi military spokesman's own channel: where each of their claims first appears. */
const SAREE = (post: number, date: string, extra: Partial<LedgerSource> = {}) => S("Yahya Saree, Houthi military spokesman", `https://t.me/army21ye/${post}`, date, { claim: true, ...extra });
const MOE = (id: string, date: string, extra: Partial<LedgerSource> = {}) => S("Saudi Energy Ministry", `https://x.com/MoEnergy_Saudi/status/${id}`, date, { tier: "official", ...extra });

export const LEDGER_BASELINE: Ledger = {
  since: "2026-07-13",
  updatedAt: "2026-09-30T21:00:00+03:00",
  ships: [
    // 1 Oct: a security firm's alert (not UKMTO; UKMTO's warning that day, 147-26, was in Hormuz).
    { id: "2026-10-01-yanbu-port-tanker", date: "2026-10-01", flag: "Liberia", type: "tanker", place: "Yanbu port", what: "hit", crew: "A fire; loading at the port stopped for a time", weapon: "Aerial projectile", note: "Houthi-aligned outlets said a missile hit Aramco's North Yanbu station in the port that evening.", src: S("OSINT Hexagone (a maritime security alert)", "https://x.com/osinthexagone/status/2105763243184603198", "2026-10-01") },
    { id: "2026-09-15-yanbu-port-ship", date: "2026-09-15", type: "Saudi ship", place: "Yanbu port", what: "attacked", attacker: "Houthis", weapon: "During a missile and drone attack on Yanbu", note: "Houthi-aligned channels reported it; no word from the ship's side.", src: S("Shajab News", "https://t.me/shajab_news/67034", "2026-09-15", { claim: true }) },
    { id: "2026-08-31-red-sea-boats", date: "2026-08-31", type: "Saudi ships", place: "Red Sea", what: "attacked", attacker: "Houthis", weapon: "Four explosive boats", note: "Government forces said they destroyed a Houthi explosive boat on 30 Aug before it could be used against ships.", src: S("Shajab News", "https://t.me/shajab_news/66055", "2026-08-31", { claim: true }) },
    { id: "2026-09-06-nereida", date: "2026-09-06", ship: "Nereida", flag: "Comoros", type: "tanker", place: "off Ras Isa", what: "seized", attacker: "the Yemeni government coast guard", weapon: "None: boarded", note: "It had unloaded at Houthi-held Ras Isa without permission and is on the US sanctions list; Houthi outlets called it piracy.", src: S("Almashhad", "https://www.almashhad.news/news/493397", "2026-09-06") },
    { id: "2026-08-17-mocha-landing-ship", date: "2026-08-17", type: "military landing ship and four naval boats (coalition)", place: "off Mocha", what: "hit", attacker: "Houthis", weapon: "Ballistic missiles", note: "The Houthis say the landing ship burned out and several boats sank; no word from the coalition.", src: SAREE(3644, "2026-08-17") },
    { id: "2026-08-14-mocha-dhows", date: "2026-08-14", type: "two dhows", place: "Mocha port", what: "hit", attacker: "Houthis", weapon: "Ballistic missiles, 44 drones and 6 explosive boats", note: "The joint forces say 15 drones were shot down and 3 boats stopped, one aimed at a tanker; four civilians killed and the port closed.", src: S("Ali Bk (from the joint forces)", "https://t.me/Alibk3/33735", "2026-08-14") },
    { id: "2026-08-24-amzan", date: "2026-08-24", ship: "Amzan", flag: "Saudi Arabia", type: "oil tanker", place: "63 nm west of Yanbu", what: "hit", attacker: "Houthis (their claim)", crew: "All safe", weapon: "Ballistic missile, the Houthis say (UKMTO: an unknown projectile)", src: UKMTO("119-26", "2091794775808626896", "2026-08-24") },
    { id: "2026-08-17-mukha-cargo", date: "2026-08-17", type: "cargo ship (no crew on board)", place: "40 nm south-east of Al Mukha", what: "hit", weapon: "Several projectiles", note: "A total loss, UKMTO says. The Houthis said on 18 Aug that they hit a Saudi ship, and Houthi-aligned channels named a cargo ship Amir Khan; it may be this one.", src: UKMTO("117-26", "2089791852798988661", "2026-08-18") },
    { id: "2026-08-11-tihamah", date: "2026-08-11", ship: "Tihamah", flag: "Tanzania", type: "cargo ship", place: "off Al Mukha", what: "hit", attacker: "Houthis", crew: "4 crew and 2 coast guard rescuers killed", weapon: "Missiles; an explosive drone boat was stopped near it afterwards", note: "The government says 6 were killed; a second missile hit the rescue.", src: UKMTO("110-26", "2087130620539326737", "2026-08-11") },
    { id: "2026-08-07-mocha-tanker", date: "2026-08-07", type: "oil tanker", place: "off Mocha", what: "attacked", attacker: "Houthis", crew: "Stopped before it reached the ship", weapon: "Explosive boat", note: "Yemen's navy says it foiled the attack.", src: S("Yemeni navy (Al Arabiya)", "https://t.me/alarabiyaBr/143695", "2026-08-07", { tier: "official" }) },
    { id: "2026-08-05-daisy", date: "2026-08-05", ship: "Daisy", flag: "Dominica", type: "tanker", place: "95 nm south-east of Aden", what: "attacked", weapon: "Ballistic missile, the Houthis say", note: "UKMTO: a loud explosion close to the tanker. The Maritime Executive names it Daisy.", src: UKMTO("106-26", "2085034763048354122", "2026-08-05") },
    { id: "2026-08-05-ncc-wafa", date: "2026-08-05", ship: "NCC Wafa", flag: "Saudi Arabia", type: "tanker", place: "off Yanbu, northern Red Sea", what: "attacked", attacker: "Houthis", weapon: "Ballistic missiles", src: SAREE(3619, "2026-08-05") },
    { id: "2026-08-04-faize-noore-oliya", date: "2026-08-04", ship: "Faize Noore Oliya", flag: "India", type: "cargo ship carrying Saudi oil", place: "9 nm south-west of Al Mukha", what: "sunk", attacker: "a bomb boat (no one claimed it)", crew: "All 14 rescued", weapon: "Uncrewed explosive boat", src: UKMTO("105-26", "2084969698064535630", "2026-08-05") },
    { id: "2026-07-30-bab-tanker", date: "2026-07-30", type: "Saudi oil tanker", place: "Bab al-Mandab", what: "attacked", attacker: "Houthis", weapon: "Anti-ship ballistic missile", note: "First reports only; no statement followed.", src: S("Shajab News", "https://t.me/shajab_news/64856", "2026-07-30", { claim: true }) },
    { id: "2026-07-28-ncc-ghazal", date: "2026-07-28", ship: "NCC Ghazal", flag: "Saudi Arabia", type: "tanker", place: "southern Red Sea, off Jizan", what: "attacked", attacker: "Houthis", weapon: "Ballistic missiles, the Houthis say", note: "UKMTO: an explosion heard near a tanker; ship and crew safe. The Houthis say it turned back.", src: UKMTO("098-26", "2082191432232600035", "2026-07-28") },
    { id: "2026-07-24-ncc-masa", date: "2026-07-24", ship: "NCC Masa", flag: "Saudi Arabia", type: "tanker", place: "southern Red Sea", what: "hit", weapon: "Unknown projectile", note: "Minor hull damage, the Saudi press agency said. UKMTO logged a projectile splash next to a tanker there that day (warning 097-26).", src: S("Saudi Transport General Authority (SPA)", "https://www.spa.gov.sa/en/N2640930", "2026-07-24", { tier: "official" }) },
    { id: "2026-07-22-encelia", date: "2026-07-22", ship: "Encelia", flag: "Saudi Arabia", type: "tanker", place: "70 nm south-west of Al Shuqaiq", what: "hit", attacker: "Houthis", crew: "Fire on board; no one hurt", weapon: "Ballistic and cruise missiles and drones, the Houthis say (UKMTO: an unknown projectile)", src: UKMTO("095-26", "2080043376351535532", "2026-07-22") },
    { id: "2026-07-22-layla", date: "2026-07-22", ship: "Layla", flag: "Saudi Arabia", type: "oil tanker", place: "Red Sea", what: "attacked", attacker: "Houthis", weapon: "Ballistic and cruise missiles and drones", src: SAREE(3587, "2026-07-22") },
  ],
  sites: [
    {
      id: "east-west-pipeline",
      name: "East-West pipeline",
      kind: "pipeline",
      country: "Saudi Arabia",
      hits: [
        SAREE(3602, "2026-07-27", { weapon: "Drones" }),
        // 11 Sep (a Friday): the ministry's post is from that evening, and Reuters dates the attack to Friday.
        MOE("2098478368081502260", "2026-09-11", { weapon: "Drones, from Iraq, Saudi Arabia says", note: "Drones from Iraq, the Saudi foreign ministry says. Three pump stations hit (Reuters, 17 Sep); the pipeline was shut." }),
      ],
      status: "reduced",
      statusSrc: S("Reuters", "https://www.reuters.com/business/energy/saudi-resumes-yanbu-oil-loading-after-pipeline-restart-2026-09-29/", "2026-09-29"),
    },
    {
      id: "yanbu",
      name: "Yanbu terminals and refineries",
      kind: "terminal",
      country: "Saudi Arabia",
      hits: [
        SAREE(3594, "2026-07-25", { weapon: "Dozens of ballistic and cruise missiles and drones", note: "Two missiles shot down, Greek air defence sources say. Fuchs halted its Yanbu lubricants plant after damage and a fire that day (Reuters)." }),
        S("eKathimerini (from Greek security sources)", "https://www.ekathimerini.com/politics/foreign-policy/1313536/greek-operated-patriot-battery-downs-drones-in-saudi-arabia/", "2026-08-27", { weapon: "Drones", note: "A swarm of drones shot down by the Greek-run Patriot battery and Saudi air defence; Reuters placed it over the wider Yanbu area." }),
        S("Naya", "https://t.me/naya_foriraq/90390", "2026-09-13", { claim: true, weapon: "Missiles", note: "A big fire at SABIC's paraffin and petrochemical plant, Houthi-aligned channels say." }),
        SAREE(3721, "2026-09-16", { weapon: "Dozens of ballistic missiles and drones" }),
        SAREE(3749, "2026-09-19", { weapon: "Many ballistic and cruise missiles and drones" }),
        SAREE(3768, "2026-09-24", { weapon: "Ballistic and cruise missiles and drones", note: "A ballistic missile and a drone shot down over Yanbu, Greek security sources say (eKathimerini). Satellite pictures of 25 to 27 Sep show storage tanks hit at the Yanbu gas plant (Fars, 30 Sep)." }),
        S("Al-Akhbar", "https://t.me/Alakhbar_News/96512", "2026-09-27", { claim: true, weapon: "Many ballistic missiles and drones", note: "Satellite pictures show damage to Aramco storage, the paper says; Saudi Arabia said nothing." }),
        S("Sabereen News", "https://t.me/SabrenNewss/227278", "2026-10-01", { claim: true, weapon: "Missile", note: "Aramco's North Yanbu station in the industrial port. Smoke seen over the North Yanbu crude terminal that night (OSINT Hexagone); a tanker in the port reported a projectile and a fire." }),
      ],
      status: "working",
      statusSrc: S("Reuters", "https://www.reuters.com/business/energy/saudi-resumes-yanbu-oil-loading-after-pipeline-restart-2026-09-29/", "2026-09-29"),
    },
    {
      id: "jazan",
      name: "Jazan refinery",
      kind: "refinery",
      country: "Saudi Arabia",
      hits: [
        SAREE(3594, "2026-07-25", { weapon: "Dozens of ballistic and cruise missiles and drones", note: "Smoke seen over the refinery; no Saudi confirmation." }),
        MOE("2086264025185243338", "2026-08-09", { weapon: "A drone, the Houthis say", note: "A fire at the refinery, put out; no one hurt." }),
        // 13 and 18 Aug: from Saba (Houthi-run), whose site cannot be reached; the wire and trade copies instead.
        S("Bloomberg", "https://www.bloomberg.com/news/articles/2026-08-13/houthis-say-they-ve-targeted-aramco-refinery-in-jazan-again", "2026-08-13", { claim: true, weapon: "Two drones" }),
        S("OilPrice.com", "https://oilprice.com/Latest-Energy-News/World-News/Houthis-Claim-Third-Attack-on-Saudi-Aramco-Refinery-in-Two-Weeks.html", "2026-08-18", { claim: true, weapon: "Drones" }),
        S("OilPrice.com (from the Financial Times)", "https://oilprice.com/Latest-Energy-News/World-News/Saudi-Aramcos-Jizan-Refinery-Hit-Again-as-Houthi-Attacks-Escalate.html", "2026-09-07", { note: "Two people with knowledge of it told the FT; Aramco did not comment." }),
        SAREE(3679, "2026-09-08", { weapon: "Dozens of ballistic missiles and drones", note: "With the economic city in Jazan." }),
        S("Naya", "https://t.me/naya_foriraq/90430", "2026-09-14", { claim: true, weapon: "Missiles", note: "Houthi-aligned outlets say oil facilities in Jazan were hit." }),
        S("Naya", "https://t.me/naya_foriraq/90632", "2026-09-15", { claim: true, weapon: "Ballistic missiles", note: "Blasts at the refinery, Houthi-aligned channels say." }),
      ],
      status: "unknown",
    },
    {
      id: "najran-aramco",
      name: "Aramco plant, Najran",
      kind: "bulk plant",
      country: "Saudi Arabia",
      hits: [
        S("Al Jazeera (from Saba)", "https://www.aljazeera.net/news/2026/8/14/%D8%A7%D9%84%D8%AD%D9%88%D8%AB%D9%8A%D9%88%D9%86-%D9%8A%D8%B9%D9%84%D9%86%D9%88%D9%86-%D8%A7%D8%B3%D8%AA%D9%87%D8%AF%D8%A7%D9%81-%D9%85%D9%86%D8%B4%D8%A3%D8%A9", "2026-08-14", { claim: true, weapon: "A drone" }),
        SAREE(3649, "2026-08-20", { weapon: "A drone" }),
        SAREE(3679, "2026-09-08", { weapon: "Dozens of ballistic missiles and drones" }),
        S("Naya", "https://t.me/naya_foriraq/90430", "2026-09-14", { claim: true, weapon: "Missiles", note: "Houthi-aligned outlets say a refinery in Najran was hit." }),
      ],
      status: "unknown",
    },
    {
      id: "south-saudi-oil",
      name: "Oil facilities in southern Saudi Arabia",
      kind: "oil facilities",
      country: "Saudi Arabia",
      hits: [MOE("2097207106990415882", "2026-09-08", { note: "Fires at several oil facilities and utilities; work stopped for a time. 73 hurt in the day's attacks, the coalition says." })],
      status: "unknown",
    },
    {
      // The Saudi defence ministry, on SPA: drones from Iraq at oil sites, shot down (27 and 28 Jul).
      id: "east-saudi-oil",
      name: "Oil facilities in the Eastern Province",
      kind: "oil facilities",
      country: "Saudi Arabia",
      hits: [
        S("Saudi Defence Ministry (SPA)", "https://www.spa.gov.sa/en/N2642332", "2026-07-27", { tier: "official", weapon: "Drones, from Iraq", note: "Drones from Iraq at oil facilities in the Eastern Province and Riyadh, shot down. Houthi-aligned channels said Abqaiq was hit and burning; the Houthis claimed targets on the oil route to Yanbu." }),
        S("Saudi Defence Ministry (SPA)", "https://www.spa.gov.sa/en/N2643452", "2026-07-28", { tier: "official", weapon: "Drones, from Iraq", note: "Drones from Iraq at oil facilities in the Eastern Province, shot down. Houthi-aligned channels said Abqaiq was hit again and its exports stopped." }),
      ],
      status: "working",
      statusSrc: S("Saudi Defence Ministry (SPA)", "https://www.spa.gov.sa/en/N2643452", "2026-07-28", { tier: "official" }),
    },
    {
      id: "riyadh-depot",
      name: "Riyadh airport fuel depot",
      kind: "fuel depot",
      country: "Saudi Arabia",
      hits: [
        S("AFP (France 24)", "https://www.france24.com/en/middle-east/20260919-smoke-flames-seen-near-riyadh-airport-major-flight-disruptions-reported", "2026-09-19", { weapon: "Missiles and drones, the Houthis say; the coalition says it shot down a ballistic missile over Riyadh", note: "A fire on an Aramco fuel tank, put out." }),
        S("Shin Persian", "https://t.me/shin_persian/10320", "2026-09-21", { claim: true }),
      ],
      status: "unknown",
    },
    {
      id: "abha-aramco",
      name: "Aramco bulk plant, Abha",
      kind: "bulk plant",
      country: "Saudi Arabia",
      hits: [SAREE(3679, "2026-09-08", { weapon: "Dozens of ballistic missiles and drones", note: "A satellite picture that day shows smoke rising from the plant (Reuters)." })],
      status: "unknown",
    },
    {
      id: "jubail-gas",
      name: "Gas facilities, Jubail",
      kind: "gas plant",
      country: "Saudi Arabia",
      hits: [S("Anadolu", "https://www.aa.com.tr/en/world/explosion-heard-in-saudi-arabias-jubail-as-fires-reported-at-energy-facilities-sources/4022196", "2026-08-09", { note: "A loud explosion and a fire, unnamed sources say; no Saudi confirmation." })],
      status: "unknown",
    },
    {
      id: "taibah-medina",
      name: "Taibah electricity station, Medina",
      kind: "power station",
      country: "Saudi Arabia",
      hits: [S("Saudi-led coalition (Al Arabiya)", "https://t.me/alarabiyaBr/149261", "2026-10-01", { tier: "official", weapon: "A drone", note: "A transformer damaged, the coalition says; the Houthis deny it." })],
      status: "unknown",
    },
    {
      id: "abqaiq",
      name: "Abqaiq processing plant",
      kind: "processing plant",
      country: "Saudi Arabia",
      hits: [S("Ali Bk", "https://t.me/Alibk3/37488", "2026-09-30", { claim: true, weapon: "Drones", note: "Its own sources, Ali Bk says; drone attacks went on into the afternoon and Dammam airport stopped flights. No Saudi word." })],
      status: "unknown",
    },
    {
      id: "ras-tanura",
      name: "Ras Tanura",
      kind: "terminal",
      country: "Saudi Arabia",
      hits: [S("Sabereen News", "https://t.me/SabrenNewss/226441", "2026-09-24", { claim: true, weapon: "Missiles", note: "Named with Aramco and Yanbu; the Houthis' own statement that day named Riyadh and Yanbu only." })],
      status: "unknown",
    },
    {
      id: "mocha-power",
      name: "Mocha power station",
      kind: "power station",
      country: "Yemen",
      hits: [S("Al Hadath", "https://t.me/alhadath_brk/129519", "2026-08-09", { weapon: "A drone, shot down", note: "Government air defences downed it, Al Hadath's correspondent says." })],
      status: "unknown",
    },
    {
      id: "marib-fuel-station",
      name: "Fuel station, Marib city",
      kind: "fuel station",
      country: "Yemen",
      hits: [S("Almashhad", "https://www.almashhad.news/news/488547", "2026-08-08", { weapon: "Missiles and drones" })],
      status: "unknown",
    },
  ],
  figures: [
    // Saudi crude exports, a month at a time: JODI (the kingdom's own figures) first, then Kpler through Reuters.
    { id: "energy-saudi-exports-2026-06", cat: "energy", group: "exports", series: "saudi-exports", month: "2026-06", label: "Saudi crude exports", value: 3.99, unit: "million barrels a day", period: "June, before the war (about: July's 4.125 was 3.3% more)", span: "June", src: S("Reuters (JODI data)", REUTERS_JODI_JUL, "2026-09-22", { tier: "official" }) },
    { id: "energy-saudi-exports-2026-07", cat: "energy", group: "exports", series: "saudi-exports", month: "2026-07", label: "Saudi crude exports", value: 4.125, unit: "million barrels a day", period: "July", src: S("Reuters (JODI data)", REUTERS_JODI_JUL, "2026-09-22", { tier: "official" }) },
    { id: "energy-saudi-exports-2026-08", cat: "energy", group: "exports", series: "saudi-exports", month: "2026-08", label: "Saudi crude exports", value: 2.446, unit: "million barrels a day", period: "August", src: S("Reuters (Kpler data)", REUTERS_KPLER_SEP, "2026-09-28") },
    { id: "energy-saudi-exports-2026-09", cat: "energy", group: "exports", series: "saudi-exports", month: "2026-09", label: "Saudi crude exports", value: 5.4, unit: "million barrels a day", period: "September, early count", src: S("Reuters (Kpler data)", REUTERS_KPLER_SEP, "2026-09-28") },
    // Oil through Bab al-Mandab, all exporters (Kpler).
    { id: "maritime-bab-oil-before", cat: "maritime", group: "oil", series: "bab-oil", month: "2026-07-before", label: "Oil through Bab al-Mandab", value: 6.2, unit: "million barrels a day", period: "the month to 22 July, before the war", span: "22 Jun – 22 Jul", src: S("CNN (Kpler data)", "https://www.cnn.com/2026/07/22/business/bab-el-mandeb-houthis-saudi-arabia-oil", "2026-07-22") },
    { id: "maritime-bab-oil-2026-08", cat: "maritime", group: "oil", series: "bab-oil", month: "2026-08", label: "Oil through Bab al-Mandab", value: 5.45, unit: "million barrels a day", period: "August", src: S("The National (Kpler data)", NATIONAL_KPLER, "2026-09-29") },
    { id: "maritime-bab-oil-2026-09", cat: "maritime", group: "oil", series: "bab-oil", month: "2026-09", label: "Oil through Bab al-Mandab", value: 2.56, unit: "million barrels a day", period: "September, early count", src: S("The National (Kpler data)", NATIONAL_KPLER, "2026-09-29") },
    // Of it, Saudi oil.
    { id: "maritime-saudi-bab-oil-2026-06", cat: "maritime", group: "oil", series: "saudi-bab-oil", month: "2026-06", label: "Saudi oil through Bab al-Mandab", value: 3.99, unit: "million barrels a day", period: "June, before the war", src: S("The National (Kpler data)", NATIONAL_KPLER, "2026-09-29") },
    { id: "maritime-saudi-bab-oil-2026-08", cat: "maritime", group: "oil", series: "saudi-bab-oil", month: "2026-08", label: "Saudi oil through Bab al-Mandab", value: 0.45, unit: "million barrels a day", period: "August", src: S("The National (Kpler data)", NATIONAL_KPLER, "2026-09-29") },
  ],
  notices: [],
  // Satellite pictures of earlier damage, carried on 30 Sep as new attacks (Ali Bk, Fars, Shajab, IRNA).
  wrong: [
    { site: "yanbu", date: "2026-09-30", why: "satellite pictures of earlier damage" },
    // Shajab's was smoke seen from space; Ali Bk's report of an attack that day stays (a claim).
    { site: "abqaiq", date: "2026-09-30", why: "satellite pictures of earlier damage", url: "https://t.me/shajab_news/68014" },
  ],
};
