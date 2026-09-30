/**
 * The Maritime and Energy ledger's baseline: what happened from 3 July 2026 to
 * the ledger's first 6-hour read (30 Sep), from the desk's research of that
 * day. Each row carries the report it stands on; `claim` marks what only the
 * side that says it did it reports. Where the sources disagree, `note` says so.
 * The 6-hour reads (ledger.ts) add to it; a stored row of the same id wins.
 * No Israeli outlets: where one was the only English carrier, the original or
 * another carrier is linked.
 */

import type { Ledger, LedgerSource } from "./ledger.ts";

const S = (name: string, url: string, date: string, claim?: boolean): LedgerSource => ({ name, url, date, ...(claim ? { claim } : {}) });

const AJ = "https://www.aljazeera.com/news/2026";

export const LEDGER_BASELINE: Ledger = {
  since: "2026-07-03",
  updatedAt: "2026-09-30T18:00:00+03:00",
  ships: [
    { id: "2026-08-24-amzan", date: "2026-08-24", ship: "Amzan", flag: "Saudi Arabia", type: "oil tanker", place: "63 nm west of Yanbu", what: "hit", attacker: "Houthis", crew: "All safe (Bahri)", src: S("Al Jazeera", `${AJ}/8/24/yemens-houthis-report-attack-on-saudi-ship`, "2026-08-24") },
    { id: "2026-08-18-red-sea", date: "2026-08-18", flag: "Saudi Arabia", type: "ship", place: "Red Sea", what: "attacked", attacker: "Houthis", src: S("Democracy Now", "https://www.democracynow.org/2026/8/18/headlines/yemens_houthis_claim_another_attack_on_saudi_ship_in_red_sea", "2026-08-18", true) },
    { id: "2026-08-11-tihamah", date: "2026-08-11", ship: "Tihamah", flag: "Tanzania", type: "deck cargo ship", place: "Bab al-Mandab", what: "hit", attacker: "Houthis", crew: "4 crew and 2 coast guard rescuers killed, 10 or more hurt", note: "The government says 6 were killed; a second missile hit the rescue.", src: S("Al Jazeera", `${AJ}/8/12/six-killed-in-houthi-attack-on-bab-al-mandeb-ship-yemens-government-says`, "2026-08-12") },
    { id: "2026-08-05-daisy", date: "2026-08-05", ship: "Daisy", flag: "Dominica", type: "tanker", place: "Gulf of Aden", what: "hit", attacker: "Houthis", note: "Minor damage.", src: S("The Maritime Executive", "https://maritime-executive.com/article/attack-on-tanker-reported-in-the-gulf-of-aden", "2026-08-05") },
    { id: "2026-08-05-ncc-wafa", date: "2026-08-05", ship: "NCC Wafa", flag: "Saudi Arabia", type: "tanker", place: "Red Sea", what: "attacked", attacker: "Houthis", src: S("Kurdistan24", "https://www.kurdistan24.net/en/story/930653/slug", "2026-08-06", true) },
    { id: "2026-08-04-faize-noore-oliya", date: "2026-08-04", ship: "Faize Noore Oliya", flag: "India", type: "cargo ship carrying Saudi oil", place: "off Hodeidah", what: "sunk", attacker: "a bomb boat (no one claimed it)", crew: "All 14 rescued", src: S("The Maritime Executive", "https://maritime-executive.com/article/indian-cargo-vessel-sunk-by-projectile-off-hodeidah-14-rescued", "2026-08-05") },
    { id: "2026-07-28-ncc-ghazal", date: "2026-07-28", ship: "NCC Ghazal", flag: "Saudi Arabia", type: "product tanker", place: "Red Sea", what: "attacked", attacker: "Houthis", note: "EOS Risk Group says it was struck and turned back to port; the Africa Center says it was missed.", src: S("The Maritime Executive", "https://maritime-executive.com/article/saudi-tanker-hit-by-houthi-missiles-in-the-red-sea", "2026-07-28") },
    { id: "2026-07-24-ncc-masa", date: "2026-07-24", ship: "NCC Masa", flag: "Saudi Arabia", type: "tanker", place: "Red Sea", what: "hit", note: "Minor hull damage, the Saudi press agency said.", src: S("Reuters", "https://www.reuters.com/world/middle-east/saudi-vessel-sustains-minor-hull-damage-after-red-sea-attack-state-news-agency-2026-07-24/", "2026-07-24") },
    { id: "2026-07-22-encelia", date: "2026-07-22", ship: "Encelia", flag: "Saudi Arabia", type: "product tanker", place: "70 nm south-west of Al Shuqaiq", what: "hit", attacker: "Houthis", crew: "Fire on board; crew fought it (UKMTO)", src: S("Al Jazeera", `${AJ}/7/22/yemens-houthis-claim-attack-on-two-saudi-oil-tankers`, "2026-07-22") },
    { id: "2026-07-22-layla", date: "2026-07-22", ship: "Layla", flag: "Saudi Arabia", type: "oil tanker", place: "Red Sea", what: "attacked", attacker: "Houthis", src: S("Al Jazeera", `${AJ}/7/22/yemens-houthis-claim-attack-on-two-saudi-oil-tankers`, "2026-07-22", true) },
  ],
  sites: [
    {
      id: "east-west-pipeline",
      name: "East-West pipeline (Petroline)",
      kind: "pipeline",
      country: "Saudi Arabia",
      hits: [
        S("Reuters (MarketScreener)", "https://www.marketscreener.com/news/yemen-s-houthis-say-their-drones-targeted-saudi-crude-oil-transport-infrastructure-ce7f51dcdf88f021", "2026-07-27", true),
        S("BBC", "https://www.bbc.com/news/articles/c62m933465eo", "2026-09-10"),
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
        S("The National", "https://www.thenationalnews.com/news/mena/2026/07/25/houthis-attack-saudi-aramco-sites-with-yemen-at-risk-of-renewed-war/", "2026-07-25", true),
        S("L'Orient Today", "https://today.lorientlejour.com/article/1547742/yemens-houthis-say-they-attacked-aramco-facilities-in-yanbu-no-saudi-confirmation.html", "2026-09-16", true),
        S("Dawn", "https://www.dawn.com/news/2031137", "2026-09-19", true),
        S("Al-Masirah", "https://t.me/almasirah2/300054", "2026-09-24", true),
        S("Ali Bk", "https://t.me/Alibk3/37482", "2026-09-30", true),
      ],
      status: "working",
      statusSrc: S("Reuters", "https://www.reuters.com/business/energy/saudi-resumes-yanbu-oil-loading-after-pipeline-restart-2026-09-29/", "2026-09-29"),
    },
    {
      id: "jazan",
      name: "Jazan refinery and terminal",
      kind: "refinery",
      country: "Saudi Arabia",
      hits: [
        S("The National", "https://www.thenationalnews.com/news/mena/2026/07/25/houthis-attack-saudi-aramco-sites-with-yemen-at-risk-of-renewed-war/", "2026-07-25"),
        S("Al Jazeera", `${AJ}/8/9/saudi-arabia-says-fire-extinguished-at-aramco-facility-in-jizan`, "2026-08-09"),
        S("NBC News", "https://www.nbcnews.com/world/middle-east/yemens-houthis-attack-saudi-aramco-jazan-refinery-rcna591561", "2026-08-13", true),
      ],
      status: "unknown",
    },
    {
      id: "najran-aramco",
      name: "Aramco plant, Najran",
      kind: "bulk plant",
      country: "Saudi Arabia",
      hits: [
        S("Dawn", "https://www.dawn.com/news/2022829/yemeni-houthis-claim-they-targeted-aramco-in-saudi-arabias-najran-with-drone", "2026-08-14", true),
        S("Business Recorder", "https://www.brecorder.com/news/40435781/yemens-houthis-say-they-attacked-najran-airport-aramco-facilities-in-saudi-arabia", "2026-08-20", true),
      ],
      status: "unknown",
    },
    {
      id: "south-saudi-oil",
      name: "Oil facilities in southern Saudi Arabia",
      kind: "oil facilities",
      country: "Saudi Arabia",
      hits: [S("AP", "https://apnews.com/article/saudi-arabia-yemen-houthis-4ad9446f0bb8c096750c84b6e1ba86b8", "2026-09-08")],
      status: "unknown",
    },
    {
      id: "riyadh-depot",
      name: "Riyadh fuel depot (King Khalid airport)",
      kind: "fuel depot",
      country: "Saudi Arabia",
      hits: [
        S("Reuters", "https://www.reuters.com/world/middle-east/flames-black-smoke-seen-near-riyadh-airport-eyewitness-says-2026-09-19/", "2026-09-19"),
        S("Shin Persian", "https://t.me/shin_persian/10320", "2026-09-21", true),
      ],
      status: "unknown",
    },
  ],
  figures: [
    // Oil through the strait (Kpler, via The National).
    { id: "maritime-oil-through-bab-al-mandab-september", cat: "maritime", group: "oil", label: "Oil through Bab al-Mandab", value: 2.56, unit: "million barrels a day", period: "September", src: S("The National (Kpler data)", "https://www.thenationalnews.com/business/energy/2026/09/29/oil-flows-through-strait-of-hormuz-rise-on-saudi-pivot-as-red-sea-traffic-plunges/", "2026-09-29") },
    { id: "maritime-oil-through-bab-al-mandab-august", cat: "maritime", group: "oil", label: "Oil through Bab al-Mandab", value: 5.45, unit: "million barrels a day", period: "August", src: S("The National (Kpler data)", "https://www.thenationalnews.com/business/energy/2026/09/29/oil-flows-through-strait-of-hormuz-rise-on-saudi-pivot-as-red-sea-traffic-plunges/", "2026-09-29") },
    { id: "maritime-oil-through-bab-al-mandab-june", cat: "maritime", group: "oil", label: "Oil through Bab al-Mandab", value: 3.99, unit: "million barrels a day", period: "June, before this round", src: S("The National (Kpler data)", "https://www.thenationalnews.com/business/energy/2026/09/29/oil-flows-through-strait-of-hormuz-rise-on-saudi-pivot-as-red-sea-traffic-plunges/", "2026-09-29") },
    { id: "maritime-oil-through-hormuz-bab-al-mandab-and-suez-september", cat: "maritime", group: "oil", label: "Oil through Hormuz, Bab al-Mandab and Suez together", value: 9.99, unit: "million barrels a day", period: "September (12.17 in August)", src: S("The National (Kpler data)", "https://www.thenationalnews.com/business/energy/2026/09/29/oil-flows-through-strait-of-hormuz-rise-on-saudi-pivot-as-red-sea-traffic-plunges/", "2026-09-29") },
    // Traffic counts other than PortWatch's.
    { id: "maritime-commodity-ships-through-bab-al-mandab-kpler-22-sep", cat: "maritime", group: "traffic", label: "Cargo ships through Bab al-Mandab (Kpler)", value: 22, unit: "ships in a day (10-day average 26)", period: "Tuesday 22 Sep", src: S("Asharq Al-Awsat", "https://aawsat.com/%D8%A7%D9%84%D8%B9%D8%A7%D9%84%D9%85/%D8%A3%D9%88%D8%B1%D9%88%D8%A8%D8%A7/5321484-%D9%83%D8%A8%D9%84%D8%B1-%D8%AD%D8%B1%D9%83%D8%A9-%D8%A7%D9%84%D8%B4%D8%AD%D9%86-%D8%B9%D8%A8%D8%B1-%D9%85%D8%B6%D9%8A%D9%82%C2%A0%D9%87%D8%B1%D9%85%D8%B2-%D9%84%D8%A7-%D8%AA%D8%B2%D8%A7%D9%84-%D8%AF%D9%88%D9%86-%D9%85%D8%AA%D9%88%D8%B3%D8%B7-10-%D8%A3%D9%8A%D8%A7%D9%85", "2026-09-23") },
    { id: "maritime-ships-through-bab-al-mandab-houthi-transport-ministry-5-days-to-27-sep", cat: "maritime", group: "traffic", label: "Ships through Bab al-Mandab, by the Houthi transport ministry", value: 198, unit: "ships", period: "5 days to 27 Sep", src: S("Saba", "https://t.me/SabaNewsyeMedia/282009", "2026-09-28") },
    { id: "maritime-ships-through-bab-al-mandab-houthi-transport-ministry-11-21-sep", cat: "maritime", group: "traffic", label: "Ships through Bab al-Mandab, by the Houthi transport ministry", value: 408, unit: "ships (393 on 1-10 Sep)", period: "11-21 Sep", src: S("Al-Masirah", "https://t.me/almasirah2/299856", "2026-09-23") },
    // Escorts and warships.
    { id: "maritime-ships-asking-aspides-for-escort-near-bab-al-mandab-a-month", cat: "maritime", group: "security", label: "Ships asking EU Aspides for an escort near Bab al-Mandab", value: 130, unit: "a month", period: "Sep", src: S("Aden al-Ghad (Aspides to Al Arabiya)", "https://www.adngad.net/news/884978", "2026-09-30") },
    { id: "maritime-ships-that-asked-aspides-for-protection-since-2024", cat: "maritime", group: "security", label: "Ships that asked EU Aspides for protection", value: 2640, unit: "ships", period: "since 2024", src: S("Aden al-Ghad (Aspides to Al Arabiya)", "https://www.adngad.net/news/884978", "2026-09-30") },
    // The cost of the route.
    { id: "maritime-war-risk-insurance-tankers-at-yanbu-late-sep", cat: "maritime", group: "cost", label: "War-risk insurance, tankers calling at Yanbu", value: 3, unit: "% of the ship's value (under 1% in early July)", period: "late Sep", src: S("Reuters", "https://www.reuters.com/business/energy/saudi-oil-export-strategy-hits-new-hurdle-red-sea-insurance-costs-soar-2026-09-24/", "2026-09-24") },
    { id: "maritime-war-risk-insurance-ports-south-of-yanbu-such-as-jazan-late-sep", cat: "maritime", group: "cost", label: "War-risk insurance, ports south of Yanbu such as Jazan", value: 7, unit: "% of the ship's value, at most", period: "late Sep", src: S("Reuters", "https://www.reuters.com/business/energy/saudi-oil-export-strategy-hits-new-hurdle-red-sea-insurance-costs-soar-2026-09-24/", "2026-09-24") },
    { id: "maritime-suez-canal-revenue-egypt-lost-since-the-red-sea-attacks-began", cat: "maritime", group: "cost", label: "Suez Canal revenue Egypt lost, President Sisi said", value: 20, unit: "billion dollars", period: "since the Red Sea attacks began", src: S("Mareb Press", "https://x.com/marebpress/status/2105242623413780660", "2026-09-30") },
    // A side's own count.
    { id: "maritime-saudi-oil-ships-the-houthis-say-they-targeted-20-jul-20-aug", cat: "maritime", group: "attacks", label: "Saudi oil ships the Houthis say they targeted", value: 8, unit: "ships (5 in the Red Sea, 3 in the Gulf of Aden and Arabian Sea)", period: "20 Jul - 19 Aug", src: S("Business Recorder", "https://www.brecorder.com/news/40435781/yemens-houthis-say-they-attacked-najran-airport-aramco-facilities-in-saudi-arabia", "2026-08-20", true) },
    // Energy: exports.
    { id: "energy-saudi-crude-exports-september", cat: "energy", group: "exports", label: "Saudi crude exports", value: 6, unit: "million barrels a day (3.4 in August)", period: "September", src: S("CNBC (Kpler data)", "https://www.cnbc.com/2026/09/25/saudi-arabia-oil-iran-war-pipeline-strait-hormuz-red-sea-houthis.html", "2026-09-25") },
    { id: "energy-saudi-exports-through-hormuz-september", cat: "energy", group: "exports", label: "Saudi exports through Hormuz, as the Red Sea route shrank", value: 2.58, unit: "million barrels a day (about 1 in August)", period: "September", src: S("The National (Kpler data)", "https://www.thenationalnews.com/business/energy/2026/09/29/oil-flows-through-strait-of-hormuz-rise-on-saudi-pivot-as-red-sea-traffic-plunges/", "2026-09-29") },
    { id: "energy-crude-loaded-at-yanbu-and-al-muajjiz-to-27-sep", cat: "energy", group: "exports", label: "Crude loaded at Yanbu and Al Muajjiz after the restart", value: 10, unit: "million barrels (satellite images)", period: "to 27 Sep", src: S("SAFETY4SEA (Reuters)", "https://safety4sea.com/saudi-arabia-resumes-yanbu-oil-loadings-as-red-sea-risks-persist/", "2026-09-30") },
    { id: "energy-middle-east-oil-exports-september", cat: "energy", group: "exports", label: "Middle East oil exports", value: 12.8, unit: "million barrels a day (18.8 in February, before the Iran war)", period: "September", src: S("Kpler", "https://www.kpler.com/blog/latams-oil-trade-is-being-rerouted-by-the-middle-east-crisis", "2026-09-29") },
    // Energy: the pipeline.
    { id: "energy-east-west-pipeline-flow-before-the-10-sep-attack", cat: "energy", group: "pipeline", label: "East-West pipeline flow before the 10 Sep attack", value: 5.5, unit: "million barrels a day (7 at full capacity)", period: "to 10 Sep", src: S("SAFETY4SEA (Reuters)", "https://safety4sea.com/saudi-arabia-resumes-yanbu-oil-loadings-as-red-sea-risks-persist/", "2026-09-30") },
    { id: "energy-east-west-pipeline-flow-expected-after-the-restart-coming-days", cat: "energy", group: "pipeline", label: "East-West pipeline flow expected after the restart", value: 4, unit: "million barrels a day, at most (3 to 4); full flow in about a month", period: "coming days", src: S("SAFETY4SEA (Reuters)", "https://safety4sea.com/saudi-arabia-resumes-yanbu-oil-loadings-as-red-sea-risks-persist/", "2026-09-30") },
    { id: "energy-east-west-pipeline-pump-stations-offline-29-sep", cat: "energy", group: "pipeline", label: "East-West pipeline pump stations offline", value: 3, unit: "of 11 stations", period: "29 Sep", src: S("Shajab News", "https://t.me/shajab_news/67917", "2026-09-29") },
  ],
  notices: [
    { id: "2026-09-28-houthi-bab-al-mandab-open-except-saudi", date: "2026-09-28", text: "The Houthi transport ministry says Bab al-Mandab is safe for all ships except Saudi ones.", src: S("Al Mayadeen", "https://t.me/almayadeen/398685", "2026-09-28") },
    { id: "2026-09-28-eu-observer-saudi-red-sea-coalition", date: "2026-09-28", text: "The EU asks for observer status in the Saudi-led Red Sea maritime coalition.", src: S("Almashhad", "https://www.almashhad.news/news/497013", "2026-09-28") },
    { id: "2026-09-25-houthi-fishing-ban-bab-al-mandab", date: "2026-09-25", text: "The Houthis order fishermen on the Red Sea coast to stop working near Bab al-Mandab.", src: S("Khabar Agency", "https://www.khabaragency.net/news253386.html", "2026-09-25") },
    { id: "2026-09-24-france-protect-yanbu", date: "2026-09-24", text: "France will send troops and air defences to protect the Yanbu oil port, President Macron says.", src: S("Le Monde", "https://www.lemonde.fr/en/france/article/2026/09/24/france-to-send-military-means-to-protect-saudi-oil-port-macron-says_6757914_7.html", "2026-09-24") },
    { id: "2026-09-23-marad-2026-013", date: "2026-09-23", text: "US MARAD advisory 2026-013: ships linked to the US, the UK, Israel or Saudi Arabia face a higher risk of Houthi attack in the southern Red Sea, Bab al-Mandab and the Gulf of Aden. In force to 22 March 2027.", src: S("US Maritime Administration", "https://www.maritime.dot.gov/msci/2026-013-red-sea-bab-el-mandeb-strait-gulf-aden-arabian-sea-and-somali-basin-houthi-attacks", "2026-09-23") },
    { id: "2026-09-21-kallas-aspides-10-ships", date: "2026-09-21", text: "EU foreign policy chief Kallas says the Red Sea mission, Aspides, needs more than 10 warships.", src: S("Reuters", "https://www.reuters.com/world/eus-kallas-says-red-sea-naval-mission-needs-more-than-10-ships-2026-09-21/", "2026-09-21") },
    { id: "2026-09-18-italy-warships-bab-al-mandab", date: "2026-09-18", text: "Italy will send warships to protect shipping through Bab al-Mandab.", src: S("Al Jazeera", "https://www.aljazeera.com/economy/2026/9/18/italy-to-deploy-warships-to-protect-shipping-through-bab-al-mandeb", "2026-09-18") },
    { id: "2026-07-22-houthi-missiles-deployed-bab-al-mandab", date: "2026-07-22", text: "The US Navy says the Houthis have placed missiles and drones near Bab al-Mandab, ready to attack ships.", src: S("CNBC", "https://www.cnbc.com/2026/07/22/houthis-red-sea-bab-el-mandeb-saudi-oil-iran.html", "2026-07-22") },
    { id: "2026-07-20-houthi-blockade-saudi", date: "2026-07-20", text: "The Houthis declare a blockade of Saudi ports and Saudi ships at Bab al-Mandab.", src: S("AP", "https://apnews.com/article/yemen-saudi-arabia-maritime-embargo-fd7c4a3911f7eee18251483fc8af768c", "2026-07-20") },
  ],
};
