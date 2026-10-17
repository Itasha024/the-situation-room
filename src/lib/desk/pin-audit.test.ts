import { test } from "node:test";
import assert from "node:assert/strict";
import { notEvent, onePinPerEvent, reportKey, servePins, strayExtraPins } from "./yemen-pins.ts";
import { clauseOf, yemenPinSide } from "./dev-marks.ts";

// The pin audit of 17 Oct, on the live map's own pins.

test("one attack told by many outlets hours apart is one pin, the others listed under it", () => {
  const ADEN = { lat: 12.79, lng: 45.02, place: "Aden", type: "strike", actor: "houthi" };
  const pins = onePinPerEvent([
    { ...ADEN, fp: "a", at: "2026-10-15T22:29:00Z", source: "Sawt al-Asima", url: "https://sawt-alasima.net/news/123001", label: "Health minister: Houthi missile and drone attack on Aden's Maashiq Palace kills 5, wounds 16" },
    { ...ADEN, fp: "b", at: "2026-10-16T08:58:00Z", source: "Iran International", url: "https://x.com/IranIntl/status/2111018872190988371", label: "Houthi drone strike on presidential palace complex in Aden kills two security personnel" },
    { ...ADEN, fp: "c", at: "2026-10-16T14:01:00Z", source: "France 24", url: "https://x.com/France24_en/status/2111095121303294376", label: "At least six explosions struck near the presidential palace in Aden, killing five people and wounding 16" },
    // Pinned on Sanaa's palace by the place search: the same dead and wounded at the same target.
    { fp: "d", at: "2026-10-16T04:36:00Z", type: "strike", actor: "houthi", lat: 15.3128, lng: 44.2138, place: "Presidential Palace", source: "Saudi Gazette", url: "https://news.google.com/rss/articles/x", label: "Five killed, 16 wounded as Houthis launch deadly attack on Yemen presidential palace" },
    // That evening, another attack on another target.
    { ...ADEN, fp: "e", at: "2026-10-16T19:09:00Z", source: "Aden al-Ghad", url: "https://adngad.net/news/889313", label: "Yemen's transport minister: Houthi missile strike on Aden International Airport endangered civilian aircraft" },
  ]);
  assert.deepEqual(pins.map((p) => p.fp), ["a", "e"]);
  assert.deepEqual((pins[0] as { also?: { source: string }[] }).also?.map((x) => x.source), ["Iran International", "France 24"]);
});

test("the same report pinned twice is one pin; two sides on one spot stay two", () => {
  assert.equal(reportKey("https://crater-sky.com/index.php/posts/241196"), reportKey("https://crater-sky.com/posts/241196"));
  const BAB = { lat: 12.7, lng: 43.47, place: "Bab al-Mandab", type: "combat" };
  const pins = onePinPerEvent([
    { ...BAB, fp: "a", at: "2026-10-15T22:49:00Z", actor: "houthi", url: "https://crater-sky.com/posts/241196", label: "Houthi forces kill Yemeni government fighter Yasser Jamal Jahzar in Bab al-Mandab clashes" },
    { ...BAB, fp: "b", at: "2026-10-16T00:50:00Z", actor: "unclear", url: "https://crater-sky.com/index.php/posts/241196", label: "Yusri Jamal Jahzur killed in Bab al-Mandab front clashes" },
    { ...BAB, fp: "c", at: "2026-10-16T01:00:00Z", actor: "government", url: "https://example.com/1", label: "Government forces shell Houthi positions in Bab al-Mandab" },
  ]);
  assert.deepEqual(pins.map((p) => p.fp), ["a", "c"]);
});

test("an alert, an interception and a missile on one Saudi city within three hours are one wave", () => {
  const RIYADH = { lat: 24.7136, lng: 46.6753, place: "Riyadh", type: "strike", actor: "houthi" };
  const pins = onePinPerEvent([
    { ...RIYADH, fp: "a", at: "2026-10-13T15:41:00Z", label: "Coalition intercepts three drones and a ballistic missile targeting Riyadh" },
    { ...RIYADH, fp: "b", at: "2026-10-13T15:52:00Z", label: "Air defence alerts in Riyadh" },
    { ...RIYADH, fp: "c", at: "2026-10-13T17:23:00Z", label: "Houthi missiles hit targets, huge explosion sounds heard in Riyadh" },
    { ...RIYADH, fp: "d", at: "2026-10-13T05:28:00Z", label: "Turki al-Maliki: Coalition forces intercept and destroy three drones north of Riyadh" },
  ]);
  assert.deepEqual(pins.map((p) => p.fp).sort(), ["a", "d"]);
});

test("roundups, tallies and what followed an attack are no pins; the attack told with them is", () => {
  for (const label of [
    "Houthi Armed Forces spokesperson: Saudi coalition conducted 101 airstrikes in 24 hours",
    "Dozens killed and wounded in ongoing clashes and air strikes in Taiz over past 48 hours",
    "Houthi Armed Forces spokesperson: Saudi airstrikes on Sanaa, Taiz, Ibb, Lahj, Saada and Amran kill and wound civilians",
    "Taiz military axis: 168 Houthi fighters killed and 210 wounded in clashes and air strikes in Taiz",
    "Kuwait Airways cancels flights to Riyadh after strike on King Khalid International Airport",
    "Saudi events delayed following Houthi missile strikes on Riyadh airport",
    "Saudi Civil Defence lifts emergency warning for Riyadh and Al-Kharj",
    "Houthi forces transfer police and security personnel to front lines in Taiz",
    "Houthi forces form new barefoot combat unit and conduct military drills in Sanhan district of Sanaa",
    "Aden security forces arrest event photographers, including journalist Murad Mohammed Saeed",
    "Anonymous leaflets reading #DownWithHouthi distributed across Sanaa neighborhoods",
    "Yemenis stockpile food as Houthi advance cuts off basic supplies to Taiz",
    "Iranian missile and drone attacks on Hormuz shipping at wartime high",
    "Some 40 youths and students from Jibla in Ibb killed in Houthi ranks since September",
  ]) assert.equal(notEvent({ label }), true, label);
  for (const label of [
    "Air traffic suspended and explosions shake Riyadh as Houthi attacks on King Khalid International Airport and Abha airport kill three and injure dozens",
    "Saudi warplanes resume bombing civilian neighborhoods in Taiz",
    "A child wounded in Saada by unexploded ordnance from Saudi air raids",
    "Houthi forces kill second teacher in 24 hours in Taiz",
    "Houthi shelling hits Al-Safwa Hospital in Taiz, at least five civilians killed and more than a dozen wounded in 24 hours",
    "Saudi air strikes hit Hodeidah airport and telecommunications networks in Bayda and Ibb",
    "Yemeni armed forces: Repelled Houthi attack trying to reach Aden-Lahj-Taiz road",
    "Houthi forces deploy third wave of fighters to attack Mount Duhayh in Taiz",
    "Houthi missile strike on Riyadh airport kills 13, wounds 300, catches pilgrims in blast",
  ]) assert.equal(notEvent({ label }), false, label);
});

test("a pin set down far from the place its words name moves there", () => {
  const at = "2026-10-16T10:00:00Z";
  const place = (label: string, p: { lat: number; lng: number; place: string }) => servePins([{ fp: "x", at, type: "combat", label, ...p }])[0]?.place;
  // "Jabal Han west of Taiz" was found as Jabal Mat'han near Dhamar.
  assert.equal(place("Southern forces repel Houthi attacks on strategic Jabal Han front west of Taiz", { lat: 14.2609, lng: 43.8242, place: "Jabal Mat'han" }), "Taiz");
  assert.equal(place("Yemeni military commander: forces holding positions in Jabal Han", { lat: 14.2609, lng: 43.8242, place: "Jabal Mat'han" }), "Taiz");
  // Hodeidah's Taif, not Saudi Taif; Dhwan Ans is Dhamar's Dawran Anis.
  assert.equal(place("Saudi warplane strikes Taif area in al-Duraihimi district of Hodeidah", { lat: 21.27, lng: 40.42, place: "Taif" }), "Ad Durayhimi");
  assert.equal(place("Saudi warplane cluster bomb strike on homes in Al-Ar and Barza villages in Qa al-Haqal area of Dhwan Ans district", { lat: 15.689, lng: 43.303, place: "Al Haqal" }), "Dawran Anis");
  // Two districts spelt alike: Saada's, as the words say, not Ibb's.
  assert.equal(place("Saudi artillery shells Al-Dhaher district in Saada", { lat: 16.94, lng: 43.76, place: "Saada" }), "Adh Dhahir");
  // Abroad with only Yemen's places named; a shop the place search found; "the Saudi capital".
  assert.equal(place("Houthi shelling kills two in Jabal Sabr as Yemeni government forces and coalition strikes target Houthi positions in Taiz and Marib", { lat: 24.684, lng: 46.826, place: "Al Radha" }), "Jabal Sabr");
  assert.equal(servePins([{ fp: "y", at, type: "strike", label: "Saudi Aramco building hit as Houthi attacks intensify", lat: 27.347, lng: 35.71, place: "Al-Gifary Hardware For Building Material Shop" }]).length, 0);
  assert.equal(place("Arab expat injured by debris from intercepted Houthi missile in Saudi capital", { lat: 21.4457, lng: 39.808, place: "Public Library Holy Capital" }), "Riyadh");
  // The Harib front "in Shabwa" is Marib's Harib, on the border: it stays.
  assert.equal(place("Houthi drone strike wounds officer and soldier in Harib front in Shabwa", { lat: 14.93, lng: 45.5, place: "Harib" }), "Harib");
  // A site named, on its governorate's centre.
  assert.equal(place("Saudi air strikes hit oil and storage facilities in Ras Isa, Hodeidah", { lat: 14.8, lng: 42.95, place: "Hodeidah" }), "Ras Isa");
});

test("a card's extra pin on a place it does not name, or on a province, goes", () => {
  const out = strayExtraPins([
    { fp: "ir-1", url: "https://t.me/shin_persian/10980", place: "Narmak", label: "Gunfire or air defence fire heard in Narmak, eastern Tehran" },
    { fp: "ir-1-pin-Majidieh Shomali", url: "https://t.me/shin_persian/10980", place: "Majidieh Shomali", label: "Gunfire or air defence fire heard in Narmak, eastern Tehran" },
    { fp: "ir-2", url: "https://t.me/shin_persian/11192", place: "Tabriz", label: "Two blast-like sounds heard in Tabriz, East Azerbaijan Province, Iran" },
    { fp: "ir-2-pin-East Azerbaijan Province", url: "https://t.me/shin_persian/11192", place: "East Azerbaijan Province", label: "Two blast-like sounds heard in Tabriz, East Azerbaijan Province, Iran" },
    { fp: "y-1", url: "https://x.com/SaudiDCD/status/1", place: "Jazan", label: "Houthi attacks and explosions target Yanbu and Jazan in Saudi Arabia" },
    { fp: "y-1-pin-Yanbu", url: "https://x.com/SaudiDCD/status/1", place: "Yanbu", label: "Houthi attacks and explosions target Yanbu and Jazan in Saudi Arabia" },
  ]);
  assert.deepEqual(out.map((p) => p.fp), ["ir-1", "ir-2", "y-1", "y-1-pin-Yanbu"]);
});

test("each pin of a card telling two sides' attacks takes its own side", () => {
  const label = "Saudi-led coalition intercepts ballistic missile over Yanbu as air strikes target Taif area in Al-Durayhimi and explosions hit Abha";
  assert.equal(clauseOf(label, "Ad Durayhimi"), "air strikes target Taif area in Al-Durayhimi");
  assert.equal(yemenPinSide({ label, place: "Ad Durayhimi", lat: 14.579, lng: 43.037, actor: "houthi" }), "saudi");
  assert.equal(yemenPinSide({ label, place: "Yanbu", lat: 24.02, lng: 38.19, actor: "houthi" }), "houthi");
  // In Saudi Arabia, missile debris is the Houthis' whoever is quoted.
  assert.equal(yemenPinSide({ label: "Saudi civil defence: resident wounded by missile fragments in Riyadh", place: "Riyadh", lat: 24.7136, lng: 46.6753, actor: "saudi" }), "houthi");
  assert.equal(yemenPinSide({ label: "Saudi-backed forces mortar fire wounds two civilians in Hadhran, Taiz", place: "Taiz", lat: 13.58, lng: 44.02, actor: "saudi" }), "government");
  assert.equal(yemenPinSide({ label: "Houthis claim missile attacks on King Khalid International Airport, Najran airport and an air base", place: "Riyadh", lat: 24.7136, lng: 46.6753, actor: "saudi" }), "houthi");
  // Both sides named fighting: the stored side stays.
  assert.equal(yemenPinSide({ label: "Clashes between Yemeni government forces and Houthi forces in Al-Hujariyah, Taiz", place: "Taiz", lat: 13.58, lng: 44.02, actor: "houthi" }), "houthi");
});

test("Syria's Quneitra is not Lebanon's Qnaitra; fire into south Lebanon with no side named is Israel's", async () => {
  const { syrianQuneitra, lebanonFire } = await import("./iran-places.ts");
  assert.equal(syrianQuneitra({ lat: 33.481, lng: 35.4011, label: "Israeli forces shell Jabata al-Khashab nature reserve in northern Quneitra countryside" })?.place, "Quneitra countryside, Syria");
  assert.equal(syrianQuneitra({ lat: 33.481, lng: 35.4011, label: "Israeli strike on Qnaitra near Nabatieh" }), null);
  assert.equal(lebanonFire({ lat: 33.3237, lng: 35.4731, actor: "unclear", label: "Shelling of Ain al-Samahiya between Zoutar al-Sharqiya and Mifdun" }), true);
  assert.equal(lebanonFire({ lat: 33.3237, lng: 35.4731, actor: "unclear", label: "Hezbollah fires rockets at Israeli troops near Khiam" }), false);
  assert.equal(lebanonFire({ lat: 35.69, lng: 51.39, actor: "unclear", label: "Explosions heard in Tehran" }), false);
});

test("a ship's aftermath and a week's roundup are no pins on the Iran map", () => {
  for (const label of [
    "Boats gather cargo from sunken GFS Pride off Oman after projectile strike",
    "Containers and debris seen floating off Oman coast after container ship hit near Strait of Hormuz",
    "Iran escalates maritime attacks in Strait of Hormuz; 12 vessels hit in a week, tanker and container ship struck Tuesday",
    "Six commercial vessels hit in one day in Strait of Hormuz after US jet disabled Iran-linked tanker",
    "Strait of Hormuz attacks surge as Iran steps up campaign against US-backed oil shipping",
    "Explosions reported in southern Isfahan due to unexploded ordnance",
    "Israeli forces drop flares over Mansouri in south Lebanon",
    "Israeli forces bring ammunition trucks into Zibqin al-Sharqiyah, south Lebanon",
  ]) assert.equal(notEvent({ label }), true, label);
  assert.equal(notEvent({ label: "UKMTO: tanker hit by unknown projectile while transiting Strait of Hormuz; crew safe, no environmental impact" }), false);
});
