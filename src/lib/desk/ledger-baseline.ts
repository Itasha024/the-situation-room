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
const CLAIM = { claim: true } as const;

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
    { id: "2026-08-24-amzan", date: "2026-08-24", ship: "Amzan", flag: "Saudi Arabia", type: "oil tanker", place: "63 nm west of Yanbu", what: "hit", attacker: "Houthis (their claim)", crew: "All safe", src: UKMTO("119-26", "2091794775808626896", "2026-08-24") },
    { id: "2026-08-17-mukha-cargo", date: "2026-08-17", type: "cargo ship (no crew on board)", place: "40 nm south-east of Al Mukha", what: "hit", note: "A total loss, UKMTO says. The Houthis said on 18 Aug that they hit a Saudi ship; it may be this one.", src: UKMTO("117-26", "2089791852798988661", "2026-08-18") },
    { id: "2026-08-11-tihamah", date: "2026-08-11", ship: "Tihamah", flag: "Tanzania", type: "cargo ship", place: "off Al Mukha", what: "hit", attacker: "Houthis", crew: "4 crew and 2 coast guard rescuers killed", note: "The government says 6 were killed; a second missile hit the rescue.", src: UKMTO("110-26", "2087130620539326737", "2026-08-11") },
    { id: "2026-08-05-daisy", date: "2026-08-05", ship: "Daisy", flag: "Dominica", type: "tanker", place: "95 nm south-east of Aden", what: "attacked", note: "UKMTO: a loud explosion close to the tanker. The Maritime Executive names it Daisy.", src: UKMTO("106-26", "2085034763048354122", "2026-08-05") },
    { id: "2026-08-05-ncc-wafa", date: "2026-08-05", ship: "NCC Wafa", flag: "Saudi Arabia", type: "tanker", place: "Red Sea", what: "attacked", attacker: "Houthis", src: SAREE(3619, "2026-08-05") },
    { id: "2026-08-04-faize-noore-oliya", date: "2026-08-04", ship: "Faize Noore Oliya", flag: "India", type: "cargo ship carrying Saudi oil", place: "9 nm south-west of Al Mukha", what: "sunk", attacker: "a bomb boat (no one claimed it)", crew: "All 14 rescued", src: UKMTO("105-26", "2084969698064535630", "2026-08-05") },
    { id: "2026-07-28-ncc-ghazal", date: "2026-07-28", ship: "NCC Ghazal", flag: "Saudi Arabia", type: "tanker", place: "southern Red Sea, off Jizan", what: "attacked", attacker: "Houthis", note: "UKMTO: an explosion heard near a tanker; ship and crew safe.", src: UKMTO("098-26", "2082191432232600035", "2026-07-28") },
    { id: "2026-07-24-ncc-masa", date: "2026-07-24", ship: "NCC Masa", flag: "Saudi Arabia", type: "tanker", place: "southern Red Sea", what: "hit", note: "Minor hull damage, the Saudi press agency said. UKMTO logged a projectile splash next to a tanker there that day (warning 097-26).", src: S("Saudi Transport General Authority (SPA)", "https://www.spa.gov.sa/en/N2640930", "2026-07-24", { tier: "official" }) },
    { id: "2026-07-22-encelia", date: "2026-07-22", ship: "Encelia", flag: "Saudi Arabia", type: "tanker", place: "70 nm south-west of Al Shuqaiq", what: "hit", attacker: "Houthis", crew: "Fire on board; no one hurt", src: UKMTO("095-26", "2080043376351535532", "2026-07-22") },
    { id: "2026-07-22-layla", date: "2026-07-22", ship: "Layla", flag: "Saudi Arabia", type: "oil tanker", place: "Red Sea", what: "attacked", attacker: "Houthis", src: SAREE(3587, "2026-07-22") },
  ],
  sites: [
    {
      id: "east-west-pipeline",
      name: "East-West pipeline",
      kind: "pipeline",
      country: "Saudi Arabia",
      hits: [
        SAREE(3602, "2026-07-27"),
        MOE("2098478368081502260", "2026-09-10", { note: "Drones from Iraq, the Saudi foreign ministry says. Pump stations hit; the pipeline was shut." }),
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
        SAREE(3594, "2026-07-25", { note: "Two missiles shot down, Greek air defence sources say." }),
        SAREE(3721, "2026-09-16"),
        SAREE(3749, "2026-09-19"),
        SAREE(3768, "2026-09-24", { note: "Satellite pictures of 25 to 27 Sep show storage tanks hit at the Yanbu gas plant (Fars, 30 Sep)." }),
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
        SAREE(3594, "2026-07-25", { note: "Smoke seen over the refinery; no Saudi confirmation." }),
        MOE("2086264025185243338", "2026-08-09", { note: "A fire at the refinery, put out; no one hurt." }),
        // 13 and 18 Aug: from Saba (Houthi-run), whose site cannot be reached; the wire and trade copies instead.
        S("Bloomberg", "https://www.bloomberg.com/news/articles/2026-08-13/houthis-say-they-ve-targeted-aramco-refinery-in-jazan-again", "2026-08-13", CLAIM),
        S("OilPrice.com", "https://oilprice.com/Latest-Energy-News/World-News/Houthis-Claim-Third-Attack-on-Saudi-Aramco-Refinery-in-Two-Weeks.html", "2026-08-18", CLAIM),
      ],
      status: "unknown",
    },
    {
      id: "najran-aramco",
      name: "Aramco plant, Najran",
      kind: "bulk plant",
      country: "Saudi Arabia",
      hits: [
        S("Al Jazeera (from Saba)", "https://www.aljazeera.net/news/2026/8/14/%D8%A7%D9%84%D8%AD%D9%88%D8%AB%D9%8A%D9%88%D9%86-%D9%8A%D8%B9%D9%84%D9%86%D9%88%D9%86-%D8%A7%D8%B3%D8%AA%D9%87%D8%AF%D8%A7%D9%81-%D9%85%D9%86%D8%B4%D8%A3%D8%A9", "2026-08-14", CLAIM),
        SAREE(3649, "2026-08-20"),
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
        S("Saudi Defence Ministry (SPA)", "https://www.spa.gov.sa/en/N2642332", "2026-07-27", { tier: "official", note: "Drones from Iraq at oil facilities in the Eastern Province and Riyadh, shot down." }),
        S("Saudi Defence Ministry (SPA)", "https://www.spa.gov.sa/en/N2643452", "2026-07-28", { tier: "official", note: "Drones from Iraq at oil facilities in the Eastern Province, shot down." }),
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
        S("AFP (France 24)", "https://www.france24.com/en/middle-east/20260919-smoke-flames-seen-near-riyadh-airport-major-flight-disruptions-reported", "2026-09-19", { note: "A fire on an Aramco fuel tank, put out." }),
        S("Shin Persian", "https://t.me/shin_persian/10320", "2026-09-21", CLAIM),
      ],
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
};
