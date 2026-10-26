import { test } from "node:test";
import assert from "node:assert/strict";
import { gazaWords } from "./gaza-words.ts";
import { GAZA_SYSTEM_PROMPT, gazaSide, isGazaDeskItem, passesGazaOwnGate } from "./gaza-reader.ts";
import { gazaPins } from "./gaza-places.ts";
import { DESKS, deskById } from "../desks.ts";
import { DESK_IDS, deskParam } from "./desk-route.ts";
import { GAZA_READER } from "./editor.ts";
import { serveCard } from "./copy-rules.ts";

// User, 23 Oct: the Gaza – Judea & Samaria desk, stage 1.

test("the desk's own words", () => {
  assert.equal(gazaWords("Settlers attacked olive pickers in the occupied West Bank"), "Israeli extremists attacked olive pickers in Judea and Samaria");
  assert.equal(gazaWords("UN warns of rising settler violence in the West Bank"), "UN warns of rising extremists' violence in Judea and Samaria");
  assert.equal(gazaWords("Hamas accuses Israel of ceasefire violations in Gaza"), "Hamas accuses Israel of attacks in Gaza");
  assert.equal(gazaWords("Settlers set up a new outpost"), "Israeli citizens set up a new outpost");
  assert.ok(!/West Bank/i.test(GAZA_SYSTEM_PROMPT.replace(/the territory others call the West Bank|never "West Bank"|nor "occupied West Bank"/g, "")));
  // A stored card is served in the desk's words.
  const card = { summary: "Settlers torch cars near Nablus in the West Bank", text: "", source: "WAFA", type: "combat", url: "https://t.me/WAFAgency/1" };
  assert.ok(serveCard(card, "gaza"));
  // A Palestinian source tells it as its claim (user, 26 Oct).
  assert.equal(card.summary, "WAFA: Israeli extremists torch cars near Nablus in Judea and Samaria");
});

test("the gate: the desk's words, not Iran's Abbas or an opened crossing elsewhere", () => {
  assert.ok(isGazaDeskItem("غارة إسرائيلية على خان يونس"));
  assert.ok(isGazaDeskItem("IDF raids Jenin camp"));
  assert.ok(isGazaDeskItem("פיגוע ירי ליד חברון"));
  assert.ok(!isGazaDeskItem("عباس عراقجي: لن نفاوض تحت التهديد"));
  assert.ok(!isGazaDeskItem("فتح مطار بيروت أمام الرحلات"));
  assert.ok(passesGazaOwnGate("اقتحام قوات الاحتلال بلدة"));
});

test("the sides as the model names them", () => {
  assert.equal(gazaSide("Israeli settlers"), "israeli_citizens");
  assert.equal(gazaSide("IDF"), "israel");
  assert.equal(gazaSide("Qassam Brigades"), "hamas");
  assert.equal(gazaSide("Saraya al-Quds"), "factions");
  assert.equal(gazaSide("PA security forces"), "pa");
  assert.equal(gazaSide("Popular Forces militia"), "clans");
});

test("pins on the places the copy and the source both name", () => {
  const names = (c: string, s: string) => gazaPins(c, s).map((p) => p.name);
  assert.deepEqual(names("Israeli forces raid Jenin camp, arrest five", "قوات الاحتلال تقتحم مخيم جنين"), ["Jenin Camp"]);
  assert.deepEqual(names("Israeli air strike kills three in Khan Younis", "غارة على خان يونس"), ["Khan Younis"]);
  assert.deepEqual(names("Israeli forces demolish home in Yatta, south of Hebron", "هدم منزل في يطا جنوب الخليل"), ["Yatta"]);
  assert.deepEqual(names("Israeli extremists attack Sinjil and Al-Mughayyir", "هجوم على سنجل والمغير"), ["Sinjil", "Al-Mughayyir"]);
  assert.deepEqual(names("Gunman opens fire in Kfar Saba", "ירי בכפר סבא"), []);
  assert.deepEqual(names("Hamas says talks in Cairo continue", "x"), []);
});

test("the desk is listed, live (26 Oct), and has its own reader", () => {
  assert.ok(DESK_IDS.includes("gaza"));
  assert.equal(deskParam("gaza"), "gaza");
  const d = deskById("gaza");
  assert.equal(d.path, "/gaza-judea-samaria-desk");
  assert.ok(!d.hidden);
  assert.equal(DESKS.filter((x) => !x.hidden).length, 3);
  assert.equal(GAZA_READER.queueKey, "gaza:reader-queue");
  assert.equal(GAZA_READER.desk, "gaza");
});

// User, 23 Oct (round 2): the gate check's misses, the relay rule, the landmarks, one pool, the queue.
test("the gate check's misses now pass, unrelated news still does not", async () => {
  const ir = await import("./iran-reader.ts");
  const { WAR_ONLY } = await import("../yemen-scan.server.ts");
  assert.ok(ir.isIranDeskItem("مسؤول مطلع مقرب من البحرية التابعة لحرس الثورة الإسلامية: الإجراءات أكثر فتكا"));
  assert.ok(ir.isIranDeskItem("السفارة الأميركية تأمر جميع الموظفين الأميركيين وعائلاتهم بمغادرة الإمارات"));
  assert.ok(ir.isIranDeskItem("مصدر أميركي: اختتام اجتماعات تامبا بين لبنان وإسرائيل"));
  assert.ok(ir.passesIranOwnGate("مصادر لبنانية: قصف مدفعي معادي على بلدة كفرتبنيت"));
  assert.ok(passesGazaOwnGate("اطلاق نار من الزوارق في بحر مدينة خانيونس"));
  assert.ok(isGazaDeskItem("وزير الدفاع الإسرائيلي: المخربون ومن يرسلهم سيدفعون ثمنا باهظا"));
  assert.ok(isGazaDeskItem("ALERT: a drone is above the Freedom Flotilla"));
  assert.ok(isGazaDeskItem("مستعمرون يحرقون أشجار الزيتون في برقا"));
  assert.ok(WAR_ONLY.test("وزير الخارجية المصري: ندين الهجمات التي تستهدف السعودية"));
  for (const s of ["French police: one killed in shooting near Paris", "الشرطة الفرنسية: قتيل في إطلاق نار قرب باريس"]) {
    assert.ok(!ir.isIranDeskItem(s) && !isGazaDeskItem(s) && !WAR_ONLY.test(s), s);
  }
});

test("an Israeli outlet passed on by another is a relay on the Gaza and Iran desks", async () => {
  const { relayOf } = await import("./copy-rules.ts");
  assert.ok(relayOf({ headline: "Channel 14: Israel begins demolishing homes in Hebron", source: "Al Jazeera", desk: "gaza" }));
  assert.ok(relayOf({ headline: "Attackers changed target after reaching Hebron, Yedioth Ahronoth reports", source: "Al Jazeera", desk: "gaza" }));
  assert.equal(relayOf({ headline: "Israeli forces raid Jenin camp, arrest five", source: "WAFA", desk: "gaza" }), null);
  assert.equal(relayOf({ headline: "Channel 14: Israel begins demolishing homes", source: "Channel 14", desk: "gaza" }), null);
});

test("landmarks and the places that only say where they are", () => {
  const names = (c: string, s: string) => gazaPins(c, s).map((p) => p.name);
  assert.deepEqual(names("IDF carries out demolition at Kamal Adwan Hospital in northern Gaza", "هدم في مستشفى كمال عدوان شمال غزة"), ["Kamal Adwan Hospital"]);
  assert.deepEqual(names("Strike near Nasser Medical Complex in Khan Younis", "غارة قرب مجمع ناصر الطبي في خانيونس"), ["Nasser Medical Complex"]);
});

test("the Gaza desk's queue: official channels first, its colonists are Israeli citizens", async () => {
  const { gazaTierOf } = await import("./gaza-sources.ts");
  assert.equal(gazaTierOf("Hamas", () => false), 1);
  assert.equal(gazaTierOf("Safa", () => false), 2);
  assert.equal(gazaTierOf("Nuseirat News", () => false), 3);
  assert.equal(gazaTierOf("Egypt Foreign Ministry", () => true), 1);
  assert.equal(gazaTierOf("Al Jazeera", () => false), 2);
  assert.equal(GAZA_READER.nearCopies, true);
  assert.equal(gazaWords("Colonists burn olive trees in Burqa"), "Israeli extremists burn olive trees in Burqa");
});

test("the pin audit of 23 Oct: the place itself, not the town it is told by; no pin for a past day or a trend", () => {
  const names = (c: string) => gazaPins(c, "x").map((p) => p.name);
  assert.deepEqual(names("Israeli air strike destroys residential block in Nuseirat camp, central Gaza"), ["Nuseirat"]);
  assert.deepEqual(names("Israeli forces carry out demolition operation in Tal al-Zaatar, northern Gaza"), ["Tal al-Zaatar"]);
  assert.deepEqual(names("Gaza emergency services: Israeli drone strike on al-Nasr neighborhood west of Gaza City kills two, wounds others"), ["Al-Nasr"]);
  assert.deepEqual(names("Israeli air strike near Thai restaurant in al-Rimal, western Gaza City, kills two"), ["Remal"]);
  assert.deepEqual(names("Palestinian wounded by Israeli gunfire in al-Mintaqa al-Iqlimiyya, south of Mawasi, Khan Younis"), ["Al Mawasi"]);
  assert.deepEqual(names("Israeli forces demolish home in Yatta, south of Hebron"), ["Yatta"]);
  assert.deepEqual(names("Second Israeli drone strike on western Gaza City"), ["Gaza"]);
  assert.deepEqual(names("Elderly man unable to walk after severe wounds from Israeli air strikes on Gaza yesterday"), []);
  assert.deepEqual(names("Palestinian faction sources: infighting, defections and drone killings hit Israeli-backed armed gangs east of the Yellow Line"), []);
  const nasr = gazaPins("Gaza emergency services: Israeli drone strike on al-Nasr neighborhood west of Gaza City kills two", "x")[0];
  assert.ok(nasr.lat > 31.5, "Gaza City's al-Nasr, not the An Nasr near Rafah");
});

test("the whole Gaza Strip is no place for a pin", () => {
  assert.deepEqual(gazaPins("Israeli air strikes on Gaza Strip kill one, wound 13", "x"), []);
  assert.deepEqual(gazaPins("Second Israeli drone strike on western Gaza City", "x").map((p) => p.name), ["Gaza"]);
});

// User, 23 Oct: Israel from the Israeli sources, the Palestinians from their own channels, never Hamas from Iran's media.
test("whose account tells a Gaza card", async () => {
  const { gazaSourceRule, gazaLeadBonus } = await import("./gaza-sourcing.ts");
  const rule = (headline: string, source: string, type = "statement") => gazaSourceRule({ headline, type, source });
  assert.ok(rule("Netanyahu orders full lockdown of Judea and Samaria after Hebron shooting", "NBC News"));
  assert.equal(rule("Netanyahu orders full lockdown of Judea and Samaria after Hebron shooting", "N12"), null);
  assert.ok(rule("Smotrich orders demolition of many Palestinian buildings around Hebron attack site", "Al Jazeera"));
  assert.ok(rule("Israeli army says two gunmen killed in Hebron", "Al Jazeera", "combat"));
  assert.ok(rule("Islamic Jihad: the operation is a message sealed with pure blood", "Al Mayadeen"));
  assert.equal(rule("Islamic Jihad: the operation is a message sealed with pure blood", "Islamic Jihad"), null);
  assert.ok(rule("Hamas official: Hebron operation shows occupiers' crimes bring them no security", "IRNA"));
  // A field event is told by anyone on the spot; an outlet's own interview is its own.
  assert.equal(rule("Israeli forces demolish three homes in Jenin camp", "WAFA", "combat"), null);
  assert.equal(rule("Israeli air strike kills three in Khan Younis", "Al Jazeera", "strike"), null);
  assert.equal(gazaSourceRule({ headline: "Hamas official: talks stalled", type: "statement", source: "Al Jazeera", own: true }), null);
  assert.ok(gazaLeadBonus({ source: "IRNA", summary: "x" }) < gazaLeadBonus({ source: "Al Jazeera", summary: "x" }));
  assert.ok(gazaLeadBonus({ source: "Islamic Jihad", summary: "x", flags: ["actor:factions"] }) > gazaLeadBonus({ source: "Al Mayadeen", summary: "x", flags: ["actor:factions"] }));
  // The relays of Israeli outlets, at the head or the tail.
  const { relayOf } = await import("./copy-rules.ts");
  assert.ok(relayOf({ headline: "Smotrich orders demolition of many Palestinian buildings around Hebron attack site, Channel 12 reports", source: "Al Jazeera", desk: "gaza" }));
  assert.ok(relayOf({ headline: "Channel 14 reports Israeli soldier from rescue unit killed in Hebron operation", source: "Al-Alam", desk: "gaza" }));
});

test("one Palestinian group in the Gaza desk's source filter", async () => {
  const js = (await import("node:fs")).readFileSync(new URL("../../../public/app.js", import.meta.url), "utf8");
  const names = /const GAZA_GROUP_NAMES = (\{[^}]*\})/.exec(js)?.[1] ?? "";
  assert.ok(/palestinian: 'Palestinian'/.test(names) && !/\bpa:|factions:/.test(names), names);
});

// User, 23 Oct: funerals are pinned on this desk; Israeli sources wait with the official channels.
test("funerals pin, Israeli sources read first", async () => {
  const { FUNERAL_RE } = await import("./gaza-places.ts");
  const { israeliSource } = await import("./gaza-sourcing.ts");
  assert.ok(FUNERAL_RE.test("Mourners carry bodies of two men killed in Jenin camp raid"));
  assert.ok(!FUNERAL_RE.test("Israeli forces raid Jenin camp"));
  assert.equal(GAZA_READER.rank?.({ source: "N12" } as never), 1);
  assert.ok(GAZA_READER.newestFirst && GAZA_READER.moreNvidia?.length);
  assert.ok(israeliSource("Ben-Zion Macales"));
});

// User, 23 Oct: "17:53 syria pin landed in iran": a headline that names its country keeps its pins there.
test("a Syrian village is not Iran's namesake", async () => {
  const { iranPins, countriesNamed } = await import("./iran-places.ts");
  const h = "Israeli artillery shells northern outskirts of al-Hamidiyah, Quneitra countryside, southern Syria";
  const said = countriesNamed(h);
  const pins = iranPins(`al-Hamidiyah. ${h}`, "قصف مدفعي يستهدف أطراف بلدة الحميدية في ريف القنيطرة جنوب سوريا", false).filter((p) => said.has(p.country));
  assert.equal(pins[0]?.country, "Syria");
  assert.ok(!pins.some((p) => p.country === "Iran" || p.country === "Lebanon"));
});

test("the side a headline names is not its place", async () => {
  const { countriesNamed } = await import("./iran-places.ts");
  assert.equal(countriesNamed("Israeli artillery shells outskirts of Kfar Tebnit in Nabatieh district").size, 0);
  assert.equal(countriesNamed("Israel strikes Nabatieh").size, 0);
  assert.deepEqual([...countriesNamed("Israeli artillery shells al-Hamidiyah, Quneitra countryside, southern Syria")], ["Syria"]);
  assert.deepEqual([...countriesNamed("Drone strike on a base in Iraq")], ["Iraq"]);
});

test("the brief: Gaza and Judea and Samaria apart, the desk's words, every point referenced (user, 24 Oct)", async () => {
  const { fromGazaAnswer, gazaUnusable } = await import("./gaza-brief.ts");
  const ref = (fp: string, source: string, headline: string) => ({ fp, source, at: "2026-10-24T09:00:00Z", url: `https://x/${fp}`, headline });
  const refOf = { r1: ref("a", "IDF", "IDF: two gunmen who crossed the yellow line were killed"), r2: ref("b", "WAFA", "Settlers attack olive pickers near Turmus Ayya") };
  const got = fromGazaAnswer({ gaza: ["IDF: two gunmen who crossed the yellow line in Beit Lahia were killed [r1]."], js: ["Settlers attacked olive pickers near Turmus Ayya in the West Bank [r2]."] }, refOf);
  assert.equal(got.gaza.points.length, 1);
  assert.match(got.gaza.points[0], /\[\[1\]\]/);
  assert.doesNotMatch(got.js.points[0], /West Bank|[Ss]ettlers/);
  assert.match(got.js.points[0], /Judea and Samaria/);
  assert.equal(gazaUnusable({ gaza: ["X happened [snn]."], js: [] }, refOf, 2), "ids not given: snn");
});

test("the IDF line: a move's way, a map's date, an area's share (user, 24 Oct)", async () => {
  const { lineMoveOf, areaKm2 } = await import("./gaza-line.ts");
  const { dateInName } = await import("../gaza-line.server.ts");
  assert.equal(lineMoveOf("advance_or_capture", "Geolocated footage shows IDF blocks moved 300 m west in Shujaiyya"), "advance");
  assert.equal(lineMoveOf("advance_or_capture", "IDF pulls back from positions east of Khan Younis"), "withdraw");
  assert.equal(lineMoveOf("air_strike", "IDF strike in Shujaiyya"), null);
  assert.equal(dateInName('"Coordination Area" 23 June 2026'), "2026-06-23");
  assert.equal(dateInName("Zone 1- 2026_06_23"), "2026-06-23");
  // A 10 km by 10 km square at Gaza's latitude is about 100 km².
  const dLng = 10 / (111.32 * Math.cos((31.4 * Math.PI) / 180)), dLat = 10 / 110.57;
  const km2 = areaKm2({ type: "Polygon", coordinates: [[[34.3, 31.4], [34.3 + dLng, 31.4], [34.3 + dLng, 31.4 + dLat], [34.3, 31.4 + dLat], [34.3, 31.4]]] });
  assert.ok(Math.abs(km2 - 100) < 2, String(km2));
  const { heldShareIn } = await import("./gaza-line.ts");
  assert.equal(heldShareIn("IDF: troops now control about 58% of the Gaza Strip after moving the yellow line"), 58);
  assert.equal(heldShareIn("Israel holds some 53 percent of Gaza under the ceasefire map"), 53);
  assert.equal(heldShareIn("Gaza markets: luxury goods make up 95% of entries"), null);
  assert.equal(heldShareIn("Palestinian economy shrank 77% in Gaza"), null);
});

// User, 24 Oct: "no taking such things from sources that aren't Israeli or Palestinian unless it's exclusive" (Al-Modon's
// "major military operation in the occupied West Bank" led an Iran card); diplomacy may come from anyone.
test("Gaza and Judea and Samaria events from Israeli or Palestinian sources only", async () => {
  const { arenaSourceRule, palestineArena } = await import("./gaza-sourcing.ts");
  const rule = (headline: string, source: string, type = "combat", own = false) => arenaSourceRule({ headline, type, source, own });
  assert.ok(rule("Israeli army launches major military operation in Judea and Samaria", "Al-Modon"));
  assert.ok(rule("Israeli air strike kills three in Khan Younis", "Al Jazeera", "strike"));
  assert.ok(rule("Israeli extremists attack Palestinian olive pickers across Judea and Samaria", "Independent"));
  assert.equal(rule("Israeli air strike kills three in Khan Younis", "Al Jazeera", "strike", true), null);
  assert.equal(rule("Israeli forces raid Jenin camp, arrest five", "WAFA"), null);
  assert.equal(rule("Israeli forces raid Jenin camp, arrest five", "N12"), null);
  assert.equal(rule("Israeli strike on Barachit, southern Lebanon", "Al-Modon", "strike"), null);
  assert.equal(rule("Kushner and Board of Peace reset Gaza disarmament talks", "Al-Akhbar", "diplomacy"), null);
  assert.ok(palestineArena("Two Palestinians killed in clash"));
  assert.ok(!palestineArena("Israeli strike hits Palestinians in Ain al-Hilweh camp, Lebanon"));
  // A stored card: the lead goes to an Israeli or Palestinian account under it, or the card is not shown.
  const card: Record<string, unknown> = { summary: "Israeli army launches major military operation in Judea and Samaria", type: "combat", source: "Al-Modon", url: "https://www.almodon.com/a", alsoReportedBy: [{ source: "Safa", url: "https://t.me/safaps/1" }] };
  assert.ok(serveCard(card, "gaza"));
  assert.equal(card.source, "Safa");
  assert.equal(serveCard({ summary: "Israeli army launches major military operation in Judea and Samaria", type: "combat", source: "Al-Modon", url: "https://www.almodon.com/a" }, "gaza"), false);
  // And off the Iran desk, Gaza having its own (26 Oct), unless Iran or its allies are in it.
  assert.equal(serveCard({ summary: "Israeli forces raid Jenin camp, arrest five", type: "combat", source: "WAFA", url: "https://t.me/WAFAgency/1" }, "iran"), false);
  const { gazaOnIran } = await import("./copy-rules.ts");
  assert.ok(!gazaOnIran("Iran condemns Israeli raid on Jenin camp"));
  assert.ok(serveCard({ summary: "Israeli army launches major military operation in Judea and Samaria", type: "combat", source: "Al-Modon", url: "https://www.almodon.com/a", flags: ["exclusive"] }, "gaza"));
});

test("the site's words on every desk, the Gaza gate's diplomacy", () => {
  const card: Record<string, unknown> = { summary: "Israeli army raids towns across the occupied West Bank", type: "statement", source: "N12", url: "https://x" };
  serveCard(card, "yemen");
  assert.equal(card.summary, "Israeli army raids towns across Judea and Samaria");
  assert.ok(isGazaDeskItem("Kushner meets Egyptian intelligence chief on next phase of Trump plan"));
  assert.ok(isGazaDeskItem("Witkoff: stabilisation force troops to deploy next month"));
  assert.ok(isGazaDeskItem("كوشنر يلتقي رئيس المخابرات المصرية"));
});

test("stored cards: Israel's words and Judea and Samaria events from their own sources", () => {
  assert.equal(serveCard({ summary: "Israeli Defence Minister proposes evacuating Hebron neighborhood following shooting attack", type: "statement", source: "Axis military relay", url: "https://t.me/x/1" }, "iran"), false);
  assert.equal(serveCard({ summary: "300 Palestinian families threatened with displacement from Jalda area in Hebron", type: "economy", source: "Al-Alam", url: "https://t.me/x/2" }, "iran"), false);
  assert.ok(serveCard({ summary: "UN rapporteur: Hebron evictions breach international law", type: "statement", source: "Al Jazeera", url: "https://t.me/x/3" }, "gaza"));
});

// User, 24 Oct: "should say his role" (Haghighatpour, Salehi, Dawoud), and a quote never loses its speaker.
test("a little-known speaker by role; words keep their speaker", async () => {
  const { bareSpeaker, droppedSpeaker } = await import("./copy-rules.ts");
  assert.equal(bareSpeaker("Haghighatpour: if national interests are not met through talks we will fight"), "Haghighatpour");
  assert.equal(bareSpeaker("Salehi: US can neither break up Iran nor change its regime"), "Salehi");
  assert.equal(bareSpeaker("Former Iranian foreign minister Salehi: US can neither break up Iran"), null);
  assert.equal(bareSpeaker("Araghchi: talks continue"), null);
  assert.equal(bareSpeaker("Hezbollah: we will respond"), null);
  const src = "Bahrain belongs to Iran and will be taken back when the time comes, Hossein Shariatmadari, editor-in-chief of the hardline Kayhan newspaper, said, according to Eslahat News.";
  assert.equal(droppedSpeaker("Bahrain belongs to Iran and will be taken back when the time comes", "statement", src), "Hossein Shariatmadari");
  assert.equal(droppedSpeaker("Kayhan editor Shariatmadari: Bahrain belongs to Iran", "statement", src), null);
});

test("two Gaza stories share more than Gaza and Israel before the reader's 'duplicate' folds them", async () => {
  const { wordsInCommon } = await import("./copies.ts");
  assert.ok(wordsInCommon("Hamas spokesman Hazem Qassem accuses Israel of returning to starvation policy in Gaza", "Kushner and Mladenov reset Gaza disarmament talks, reiterate Israeli conditions contradicting earlier understandings with factions") < 2);
});

test("Palestinian politics passes the Gaza gate (user, 26 Oct)", () => {
  for (const t of [
    "Abbas postpones legislative and presidential elections to September 2027",
    "Fatah Revolutionary Council meets in Ramallah",
    "PFLP rejects the PLO Executive Committee decision",
    "Preventive Security arrests three Hamas members",
    "الانتخابات التشريعية تؤجل إلى أيلول 2027",
    "اللجنة المركزية لحركة فتح تجتمع برئاسة الرئيس",
    "خليل الحية: لن نقبل",
    "מנגנוני הביטחון של הרשות עצרו פעילי חמאס",
  ]) assert.ok(isGazaDeskItem(t), t);
  assert.ok(!isGazaDeskItem("الحية تلدغ طفلا في الصعيد"));
  assert.match(GAZA_SYSTEM_PROMPT, /Palestinian politics/);
});
