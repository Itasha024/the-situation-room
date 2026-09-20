/**
 * Hand translations of the curated panels: governorates, control shares, fronts,
 * the retrospective timeline, the casualty tally, the situation strip, the
 * glossary and the control epochs.
 *
 * These are the parts a reader uses to orient, so they are translated as prose,
 * not substituted word by word. Keyed by the Hebrew identifier they carried in
 * the original data.json.
 */

/* ---- Control shares -------------------------------------------------- */

export const CONTROL = {
  houthi: {
    name: "Houthi forces",
    note: "North-west Yemen, the Red Sea coast including Mocha, and the islands of Mayun and Hanish. Holds most of the population.",
  },
  plc: {
    name: "Internationally recognised government",
    note: "The south and east by area, with separate Saudi air support. Pressure claimed on the Kahbub heights, without retaking the Mocha coast.",
  },
  contested: {
    name: "Contested or mixed",
    note: "Western Taiz, Marib, Al-Jawf, Al-Bayda and Lahj. Kahbub remains an unresolved battle.",
  },
  saudi: { name: "Saudi Arabia", note: "Saudi territory, shown separately from the Yemeni parties." },
};

/* ---- Governorates ---------------------------------------------------- */

export const GOVERNORATES = {
  "YE-SA": { name: "Sanaa city", note: "The Houthis' de facto capital and the seat of their institutions." },
  "YE-SN": { name: "Sanaa governorate", note: "The ring of districts around the capital. Firmly under Houthi control." },
  "YE-SD": { name: "Saada", note: "The Houthi movement's historic stronghold, on the Saudi border." },
  "YE-HJ": { name: "Hajjah", note: "North-west Yemen. A supply corridor and a stretch of the Saudi border." },
  "YE-AM": { name: "Amran", note: "North of Sanaa. Fully under Houthi control." },
  "YE-MW": { name: "Al-Mahwit", note: "The western highlands, under Houthi control." },
  "YE-DH": { name: "Dhamar", note: "South of Sanaa, a Houthi logistics corridor." },
  "YE-IB": { name: "Ibb", note: "The central highlands, one of Yemen's most densely populated governorates." },
  "YE-RA": { name: "Raymah", note: "Western Yemen, under Houthi control." },
  "YE-HU": {
    name: "Hodeidah",
    note: "Yemen's main Red Sea port and its humanitarian import artery, under sustained military pressure.",
  },
  "YE-BA": { name: "Al-Bayda", note: "Mixed pockets in central Yemen, on the corridor between Marib and the south." },
  "YE-JA": { name: "Al-Jawf", note: "North-east Yemen. An active front facing Marib." },
  "YE-MA": {
    name: "Marib",
    note: "The government's oil and gas stronghold, under mounting Houthi pressure since September 2026.",
  },
  "YE-TA": {
    name: "Taiz",
    note: "A long-besieged city. The west of the governorate is the scene of the Houthi coastal offensive and the government counter-attack.",
  },
  "YE-AD": {
    name: "Aden",
    note: "Seat of the Presidential Leadership Council, with Saudi and coalition reinforcements and friction with southern separatist forces.",
  },
  "YE-LA": { name: "Lahj", note: "North of Aden. A south-western front facing Bab al-Mandab." },
  "YE-AB": { name: "Abyan", note: "The coast east of Aden, held by the internationally recognised government." },
  "YE-DA": {
    name: "Al-Dhale",
    note: "The southern highlands, north-west of Aden, realigned after the southern separatist structures were folded in.",
  },
  "YE-SH": {
    name: "Shabwa",
    note: "An oil and gas governorate in the east, government-held, with a Saudi presence and formerly separatist southern units.",
  },
  "YE-HD": {
    name: "Hadramawt",
    note: "Yemen's largest governorate and its main oil region, bordering Saudi Arabia, with Saudi backing for local and government forces.",
  },
  "YE-MR": {
    name: "Al-Mahrah",
    note: "The easternmost governorate, bordering Oman and Saudi Arabia, with a Saudi presence and reported interest in a pipeline to the Arabian Sea.",
  },
  "YE-SU": { name: "Socotra", note: "An Indian Ocean archipelago held by the government and southern forces." },
  "SA-01": { name: "Riyadh Province", note: "A province of Saudi Arabia." },
  "SA-02": { name: "Makkah Province", note: "A province of Saudi Arabia." },
  "SA-03": { name: "Madinah Province", note: "A province of Saudi Arabia." },
  "SA-04": { name: "Eastern Province", note: "A province of Saudi Arabia." },
  "SA-05": { name: "Al-Qassim Province", note: "A province of Saudi Arabia." },
  "SA-06": { name: "Hail Province", note: "A province of Saudi Arabia." },
  "SA-07": { name: "Tabuk Province", note: "A province of Saudi Arabia." },
  "SA-08": { name: "Northern Borders Province", note: "A province of Saudi Arabia." },
  "SA-09": { name: "Jazan Province", note: "A province of Saudi Arabia." },
  "SA-10": { name: "Najran Province", note: "A province of Saudi Arabia." },
  "SA-11": { name: "Al-Bahah Province", note: "A province of Saudi Arabia." },
  "SA-12": { name: "Al-Jawf Province", note: "A province of Saudi Arabia." },
  "SA-14": { name: "Asir Province", note: "A province of Saudi Arabia." },
};

/* ---- Islands --------------------------------------------------------- */

export const ISLANDS = {
  mayun: {
    name: "Mayun (Perim)",
    note: "An island inside the Bab al-Mandab strait. International reporting on 11 and 12 September 2026 said it passed to Houthi control after government forces withdrew; later local claims that no side holds it effectively have not been independently verified.",
    caption:
      "Aerial view of Mayun (Perim) island in the Bab al-Mandab strait. Shown to place the island — not a photograph of the seizure itself.",
    credit: "The New York Times",
  },
  hanish: {
    name: "Hanish Islands",
    note: "An island group off Yemen's west coast. September 2026 reporting attributed a Houthi seizure alongside the advance along the coast.",
  },
};

/* ---- Control epochs -------------------------------------------------- */

export const EPOCHS = {
  "2026-07-03": "Round opens — the Iranian aircraft in Sanaa",
  "2026-09-03": "Coastal ground offensive begins",
  "2026-09-10": "Mocha, Hays and Al-Khokha fall",
  "2026-09-11": "Dhubab and Mayun seized",
  "2026-09-18": "Current position",
};

export const EPOCH_CITIES = {
  mocha: "Mocha",
  dhubab: "Dhubab",
  hays: "Hays",
  khokha: "Al-Khokha",
  mayun: "Mayun",
  hanish: "Hanish Islands",
  zuqar: "Zuqar",
  kamaran: "Kamaran",
  taiz: "Taiz",
  marib: "Marib",
  hodeidah: "Hodeidah",
  sanaa: "Sanaa",
  aden: "Aden",
  lahj: "Lahj",
  waziyah: "Al-Wazi'iyah",
  kahbub: "Kahbub",
  hazm: "Al-Hazm",
};

/* ---- Timeline -------------------------------------------------------- */

export const TIMELINE = {
  houthi_origins: {
    title: "Roots of the Houthi movement",
    summary:
      "In northern Yemen, around Saada, a Zaydi religious and social movement grew up around the al-Houthi family — the root of what later became the Houthis.",
    detail:
      "Unified Yemen was created in 1990 from the merger of north and south. In the far northern highlands, and especially in Saada governorate on the Saudi border, Zaydi communities — a Shia tradition particular to Yemen — felt pushed aside by the centre in Sanaa. Hussein Badreddin al-Houthi led study circles and activism known as the Believing Youth: at first a religious and social identity rather than a national army. Poverty in the north, President Ali Abdullah Saleh's suspicion of the movement, and regional tensions after 2003 gradually turned it into an armed political force. This period is the foundation of today's Houthi movement.",
    mapNote: "The focus is Saada and the northern highlands — still far from Sanaa and the coast.",
  },
  saada_wars: {
    title: "The Saada wars",
    summary:
      "Between 2004 and 2010 Yemeni government forces fought the Houthis in Saada through six rounds. Hussein al-Houthi was killed, but the movement survived and grew stronger.",
    detail:
      "The first round broke out in 2004 after Saleh's government tried to detain Hussein al-Houthi. He was killed that year — and rather than dissolving the movement, his death consolidated it around his brothers and tribal allies. Six rounds of fighting followed, at times drawing in Saudi forces on the border. Neither side won outright: the Houthis learned to fight, built local networks and accumulated weapons and experience. The political wound in the north never closed, so when the state faltered in 2011 they were no longer merely local rebels.",
    mapNote: "Fighting concentrated in and around Saada — not yet a war for all of Yemen.",
  },
  arab_spring_2011: {
    title: "The Arab Spring and Saleh's fall",
    summary:
      "The 2011 protests weakened Saleh's rule. He was replaced by Abd Rabbu Mansour Hadi, and the Houthis used the vacuum to expand south from Saada.",
    detail:
      "As in other Arab states, crowds turned out in Yemen against a long-serving ruler. Saleh was pushed into a negotiated exit brokered by the Gulf states, and the interim president, Hadi, tried to run a national dialogue and write a new constitution. In practice the army and the state split, security weakened, and groups such as al-Qaeda in the Arabian Peninsula exploited the chaos. The Houthis, already hardened by the Saada wars, pushed south, took more ground in the north, and at times cooperated with remnants of Saleh's camp. This is the point at which they stopped being a local story and became a national actor.",
    mapNote: "Gradual expansion south from Saada towards Sanaa.",
  },
  phase_2014_sanaa: {
    title: "The fall of Sanaa",
    summary:
      "In September 2014 the Houthis took Sanaa. The government collapsed, Hadi fled, and Yemen entered full national war.",
    detail:
      "After capturing Amran to the north of the capital, Houthi fighters entered Sanaa, partly backed by forces tied to Saleh, who wanted revenge on the system that removed him. They seized ministries, weapons and institutions. UN-brokered agreements did not hold. In February 2015 Hadi fled first to Aden and then to Saudi Arabia. From this point there were in effect two Yemens: a Houthi-held north-west with Sanaa as its de facto capital, and a government and southern camp reliant on outside support. That fracture line runs through to today's map.",
    mapNote: "The north-west passes to Houthi control, with the capital in their hands.",
  },
  phase_2015_coalition: {
    title: "The Saudi-led intervention",
    summary:
      "In March 2015 a Saudi-led coalition opened an air campaign to restore Hadi's government — the start of the regional war over Yemen.",
    detail:
      "Saudi Arabia and its allies feared Houthi control, seen as close to Iran, over their southern border and over sea lanes. The campaign, named Decisive Storm and then Restoring Hope, combined air strikes, a partial naval blockade and support for local forces in the south. Aden was taken back from the Houthis in 2015 and became the seat of the internationally recognised government — but Sanaa and most of the north-west stayed in Houthi hands. Instead of a quick decision, a long war of attrition opened, at very heavy civilian cost.",
    mapNote: "The south returns to the government; the north-west stays Houthi.",
  },
  phase_2015_2018_fronts: {
    title: "Fixed fronts: Taiz, Marib and the south",
    summary:
      "Years of relative stalemate: Taiz under partial siege, Marib a government energy stronghold, and a widening split in the south between the government and separatist forces.",
    detail:
      "The front lines set. Taiz — a large city in south-western Yemen between the highlands and the coast — became a symbol of civilian suffering, with fighting, partial siege and difficult aid access. Marib in the east stayed important for its oil and gas and its government administration. In the south the Southern Transitional Council emerged, a separatist force seeking an independent or autonomous south, which at times fought Hadi's government as well as the Houthis. The anti-Houthi camp was never a single ordered bloc.",
    mapNote: "Front lines harden; the south is politically split.",
  },
  phase_stockholm_2018: {
    title: "The Stockholm Agreement and Hodeidah",
    summary:
      "In late 2018 a UN-brokered agreement covered the port of Hodeidah, to head off a major battle over Yemen's humanitarian import artery.",
    detail:
      "Hodeidah is the main Red Sea port; food, fuel and aid for much of the population come through it. Coalition and government forces were closing on the port and the UN warned of humanitarian catastrophe. In December 2018, at talks in Sweden, the parties agreed a local ceasefire, a redeployment around the port and a monitoring mechanism, along with a prisoner exchange and understandings on Taiz. Implementation was partial and cumbersome — but the big battle for the port was averted. The west coast stayed fragile from then on, even as fighting continued elsewhere.",
    mapNote: "The west coast is relatively frozen around the port — not a national peace.",
  },
  phase_2022_truce_plc: {
    title: "The 2022 truce and the Presidential Council",
    summary:
      "A UN-brokered truce in April 2022 slowed the fighting, and a Presidential Leadership Council replaced Hadi.",
    detail:
      "The truce cut air strikes and temporarily opened routes to the ports and the airport — real relief for civilians, without ending the war. In parallel Hadi handed his powers to a Presidential Leadership Council under Rashad al-Alimi, an attempt to unify the anti-Houthi camp under a collective leadership recognised internationally as Yemen's legitimate government. The truce eroded and never became a permanent peace, but it changed the tempo: less daily escalation, until broader fighting resumed in the years that followed.",
    mapNote: "Fighting slows, with no major change of control on the map.",
  },
  phase_red_sea_2023_2025: {
    title: "The Red Sea and Bab al-Mandab",
    summary:
      "From late 2023 the Houthis attacked shipping in the Red Sea and the Bab al-Mandab strait, and the US, Britain and partners answered with strikes and naval operations.",
    detail:
      "After the war in Gaza began, the Houthis declared attacks on vessels they said were linked to Israel or its allies. In practice global trade routes through the Bab al-Mandab strait — the chokepoint between the Red Sea and the Arabian Sea — were disrupted. Shipping lines rerouted around Africa and freight rates rose. The US and Britain led military responses and maritime protection operations. Yemen's internal conflict connected to a regional and global front. Bab al-Mandab and the west coast are an international corridor, not only a Yemeni border.",
    mapNote: "The focus shifts to the sea, at Bab al-Mandab and in the Red Sea.",
  },
  phase_2026_01_stc_plc: {
    title: "Realignment in the south before the 2026 round",
    summary:
      "In early 2026 a political and military reshuffle in the south narrowed the split between separatist forces and the Presidential Council, in preparation for renewed fighting in the west.",
    detail:
      "Years of friction between the Southern Transitional Council and the government had weakened the ability to face the Houthis on a single front. Open-source reporting from early 2026 described separatist structures being dissolved or reintegrated and realigned under the Presidential Council in Aden, alongside reinforcements and coordination. This was not peace in the south, but an attempt to stop fighting each other before the big round on the coast. Both sides therefore entered the September 2026 escalation in the west better prepared.",
    mapNote: "The south is more aligned against the coastal front — still no decision.",
  },
  phase_2026_09_offensive: {
    title: "September 2026: the Red Sea coast, and the present",
    summary:
      "In September 2026 the Houthis broke back onto the west coast, took the port city of Mocha and closed on the Bab al-Mandab strait, while fighting continued in western Taiz and Lahj and mass displacement spread from the coast.",
    detail:
      "After years of relative stalemate since the 2022 truce, a broad round of fighting opened on the Red Sea coast. Houthi forces advanced south and captured Mocha, a port city in south-western Yemen, then reported further progress towards Bab al-Mandab and a presence on sensitive islands including Mayun and Hanish, though some of those reports remain disputed or only partly verified. Control of the coast and of the approaches to the strait affects international shipping and the government's ability to hold the country's south-west. Government forces and tribal allies counter-attacked around Al-Wazi'iyah in western Taiz, near Hays and in Lahj, and tried to halt the advance. Pressure continued around Marib, the energy stronghold in the east, alongside fire and launches tied to Saudi Arabia and to the sea. UN agencies reported tens and then hundreds of thousands displaced from the west coast. The coast and the strait are the heart of the current round.",
    mapNote: "The west coast, Bab al-Mandab, Taiz, Lahj and Marib.",
  },
};

/* ---- Fronts ---------------------------------------------------------- */

export const FRONTS = [
  {
    id: "bab",
    name: "Bab al-Mandab and the south-west coast",
    where: "The Bab al-Mandab strait in south-western Yemen, between the Red Sea and the Arabian Sea",
    plain:
      "Ships pass here between the Red Sea and the Indian Ocean. Mayun and Hanish are in Houthi hands; the high ground facing them in Lahj, on the Kahbub heights, is an open battle.",
    summary:
      "A fourth consecutive day of fighting for the Kahbub heights in Lahj, which overlook the strait. Arab News, citing a government official, says the Houthis made no gains. The islands and the coast facing the strait remain in Houthi hands according to reporting from mid-September.",
    detail:
      "Houthi forces hold Mocha, Dhubab, Mayun and Hanish according to reporting from 11 and 12 September. Fighting continues on the Kahbub heights, at Madaribah and Al-Arah: Xinhua reported high ground changing hands and more than 40 killed on 17 September, citing sources on both sides, while Arab News on 18 September quoted a government official saying the militia had not advanced by a centimetre. There is no verified change of control in the strait itself. UKMTO says the maritime threat remains focused on vessels with a Saudi connection.",
    miniLabel: "Bab al-Mandab strait",
  },
  {
    id: "red-sea-coast",
    name: "Red Sea coast (Mocha to Dhubab)",
    where: "The Red Sea coastal strip in south-western Yemen",
    plain:
      "The corridor that connects the interior to the coast. Mocha's fall opened the road south towards the strait.",
    summary: "",
    detail:
      "The fall of Mocha on 10 September was the turning point of this round: from there the axis opened south to Dhubab and Mayun. Air strikes on supply routes between Al-Wazi'iyah and Mocha have been reported since, without the government claiming any re-entry into the port city.",
    miniLabel: "Bab al-Mandab strait",
  },
  {
    id: "west-taiz",
    name: "Western Taiz and Al-Wazi'iyah",
    where: "The districts between Taiz city and the Red Sea coast",
    plain:
      "The fight here is over the corridor linking the interior to the coast. The ground is mixed — neither side holds all of it.",
    summary:
      "The government army, via Al Jazeera on 18 September, repeats a claim of 30 Houthi fighters killed and 60 wounded in Al-Wazi'iyah in 24 hours, around the Al-Dharifah junction. It is a one-sided claim, with no verified change to the line.",
    detail:
      "Local reporting describes an attack blocked at Al-Kadha and drones shot down, and three children killed at Al-Tarirah, with attribution disputed between sources. This is the connecting front: whoever holds it links or cuts Taiz city from the coast at Mocha.",
    miniLabel: "Al-Wazi'iyah and the Al-Dharifah junction",
  },
  {
    id: "marib",
    name: "Marib",
    where: "Eastern Yemen — an oil and gas city",
    plain: "The city and the main district are government-held. Houthi pressure comes from the west, with no change of control.",
    summary:
      "Al Jazeera, 18 September: a claim of combined sniper and artillery fire against a crew and a 106mm gun in the west of the governorate — a one-sided claim. BBC Verify documented F-15 wreckage west of the city.",
    detail: "",
    miniLabel: "Western Marib",
  },
  {
    id: "dhale",
    name: "Al-Dhale",
    where: "The southern highlands of Yemen, north-west of Aden",
    plain:
      "Anadolu reported a Houthi drone shot down on the Murays front. No ground battle has changed control here.",
    summary: "",
    detail: "",
    miniLabel: "Murays",
  },
  {
    id: "jawf",
    name: "Al-Jawf and Al-Hazm",
    where: "North-eastern Yemen, close to the Saudi border",
    plain:
      "The Houthis hold the governorate capital, Al-Hazm. Government forces are pressing from the desert through the Al-Lubanat camp, with no verified decision.",
    summary:
      "Al-Araby, 16 September: government forces claim control of the desert half of the Al-Lubanat camp, while the hill section remains Houthi-held. Al-Hazm itself has not fallen.",
    detail:
      "Control of the camp would open a corridor of about 50km to Al-Hazm, held by the Houthis since 2020. There is no independent confirmation that the governorate capital has fallen. This is a secondary front beside the Saudi border, running alongside the pressure on Marib.",
    miniLabel: "Al-Lubanat",
  },
];

/* ---- Casualties ------------------------------------------------------ */

export const CASUALTIES = {
  summary: "",
  bullets: [
    "Houthi forces, killed: 278 (AFP). Wounded: no official cumulative figure for the round.",
    "Internationally recognised government, killed: 216 (AFP).",
    "Saudi Arabia, killed: 1 (a Yemeni resident in the kingdom, official). Wounded: 73 (coalition, official).",
    "All conflict casualties: 504 killed and 2,379 wounded (WHO).",
    "Civilians, killed: 150 (government human rights ministry). Civilian casualties: 55 in 19 incidents (OHCHR).",
    "Internally displaced inside Yemen: more than 112,000 (IOM).",
    "Refugees reaching Djibouti: about 3,000 (UNHCR).",
    "Health facilities fully functioning: about 60% of 5,415 assessed (WHO).",
  ],
};

/* ---- Situation strip -------------------------------------------------- */

export const SITUATION = {
  summary:
    "Active war with no decisive outcome. Air defence alerts were sounded overnight in Riyadh and Al-Kharj for the first time, with explosions heard in Olaya. In Sanaa, an explosion hit a Houthi security compound in Azal, and Saree blamed Saudi Arabia without giving detail. Fighting continues in Taiz, Lahj and Marib.",
};

/* ---- Recent digests --------------------------------------------------- */

export const DIGESTS = {
  "tl-2026-09-19-riyadh-azal-syria": {
    title: "Overnight 18-19 September: Riyadh, Azal, Syria",
    text: "First air defence alerts in Riyadh and Al-Kharj, with explosions in Olaya. An explosion at a Houthi security compound in Azal killed four according to local sources, and Saree blamed Saudi Arabia without giving detail. Al-Akhbar reported that Syria turned down a Saudi request for fighters.",
  },
  "tl-2026-09-18-evening-kahbub-icg-unhcr": {
    title: "Evening of 18 September: Kahbub, ICG, UNHCR and WHO",
    text: "Al Jazeera: a claimed attack blocked at Kahbub and a drone downed at Rajum. Crisis Group calls for a pause. UNHCR counts about 3,000 arrivals in Djibouti; WHO finds 60% of health facilities functioning. UKMTO reports no new attack on shipping today.",
  },
  "tl-2026-09-18-sudayr-artillery-iom112": {
    title: "18 September: Al-Sudayr, new artillery, IOM at 112,000",
    text: "A claim of point-blank fighting at Al-Sudayr in Lahj; a government source describes the Jahannam and Al-Aqrab systems and a priority on Bab al-Mandab; the IOM counts at least 112,000 displaced and about 3,000 arrivals in Djibouti.",
  },
  "tl-2026-09-14-night-marib-kahbub": {
    title: "Overnight 14-15 September: western Marib, Al-Suwayda, Kahbub, IOM at 94,000",
    text: "A claimed roadside bomb foiled west of Marib; missiles near the Al-Suwayda camp; entrenchment on the Kahbub heights; a Tihama force formed under Tareq Saleh; the IOM counts about 94,000 displaced.",
  },
};

/* ---- Glossary and standing notes -------------------------------------- */

export const GLOSSARY = [
  { ar: "صنعاء", en: "Sanaa" },
  { ar: "عدن", en: "Aden" },
  { ar: "مأرب", en: "Marib" },
  { ar: "تعز", en: "Taiz" },
  { ar: "الحديدة", en: "Hodeidah" },
  { ar: "المخا", en: "Mocha" },
  { ar: "ميون", en: "Mayun" },
  { ar: "باب المندب", en: "Bab al-Mandab" },
  { ar: "الضالع", en: "Al-Dhale" },
  { ar: "حضرموت", en: "Hadramawt" },
  { ar: "رشاد العليمي", en: "Rashad al-Alimi" },
  { ar: "يحيى سريع", en: "Yahya Saree" },
];

export const NOTES = {
  sourcesNote:
    "Live scanning of the operator's catalogue only: 16 Telegram channels plus scheduled news sites. No Israeli outlets and no X. Every card must carry a link to its source. Statements are never pinned to the map.",
  uxNote: "Interface model: Liveuamap for the feed and map, DeepState for layers, ISW for a fixed legend and confidence.",
  transliteration: "English exonyms as used by the international wire services.",
  disclaimer: "",
};
