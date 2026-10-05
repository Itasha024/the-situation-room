/**
 * Round 28: the operator's review of 3 Oct and the cards, tables and maps since
 * (5 Oct). Each test is a real case; docs/desk-lessons.md says what went wrong.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { captureFlag, clausesOf, tookWhole, updateControlLive } from "./control-live.ts";
import { cardMarks } from "./dev-marks.ts";

const card = (fp: string, source: string, summary: string, lat: number, lng: number, extra: Record<string, unknown> = {}) =>
  ({ fp, source, summary, lat, lng, live: true, text: "", type: "combat", url: `https://x/${fp}`, at: "2026-10-05T08:00:00Z", ...extra }) as never;
const NOW = new Date("2026-10-05T15:00:00Z");

/* ---------------- District control and the developments' flags ---------------- */

test("a compound headline: the side, the ground and the district come from one clause (Jabal Habashi, 5 Oct)", () => {
  assert.deepEqual(clausesOf("Yemeni government army and resistance forces destroy Houthi vehicles in Jabal Habashi, while Houthi forces expel Saudi mobilization from Al-Mawasit district in Taiz"), [
    "Yemeni government army and resistance forces destroy Houthi vehicles in Jabal Habashi",
    "Houthi forces expel Saudi mobilization from Al-Mawasit district in Taiz",
  ]);
  const jh = card("jh", "Almashhad", "Yemeni government army and resistance forces destroy Houthi vehicles in Jabal Habashi, while Houthi forces expel Saudi mobilization from Al-Mawasit district in Taiz", 13.47, 43.89, {
    place: "Jabal Habashi",
    alsoReportedBy: [{ source: "Al Mayadeen", url: "https://t.me/almayadeen/399851", summary: "Houthi military source: Saudi mobilization expelled from Al-Mawasit district in Taiz" }],
  });
  const live = updateControlLive({ districts: {}, changes: [], asOf: "" }, [jh], NOW);
  assert.equal(live.districts["jabal-habashi"], undefined);
  assert.equal(captureFlag(jh), null);
});

test("a gathering pushed back is not the district's holder driven out", () => {
  assert.equal(tookWhole("Houthi forces expel Saudi mobilization from Al-Mawasit district", "Al-Mawasit"), false);
  assert.equal(tookWhole("Houthi forces expel government forces from Al-Mawasit district", "Al-Mawasit"), true);
});

test("an outlet in Also counts only for the part of the headline its own headline tells", () => {
  // Al Mayadeen (Houthi-aligned) told the Houthi half; it is no second side for a government capture.
  const c = card("a", "Almashhad", "Government forces take full control of Jabal Habashi district, while Houthi forces enter Al-Ayn town in Al-Mawasit district", 13.47, 43.89, {
    place: "Jabal Habashi",
    alsoReportedBy: [{ source: "Al Mayadeen", url: "https://x/m", summary: "Houthi forces enter Al-Ayn town in Al-Mawasit district" }],
  });
  assert.equal(captureFlag(c), null);
});

test("a flag needs the whole district, confirmed: camps, airports, villages and hills are advances (5 Oct)", () => {
  const cards = [
    card("1", "Sheba Intelligence", "Yemeni government forces advance toward Mocha and capture Dhubab Airport", 12.94, 43.41, { place: "Dhubab", alsoReportedBy: [{ source: "Almashhad", url: "u", summary: "Government forces capture Dhubab airport" }] }),
    card("2", "Al-Araby TV", "Yemeni government forces capture Umm Rish camp in Al-Jubah in Marib", 15.47, 45.32, { place: "Marib", alsoReportedBy: [{ source: "Al Hadath", url: "u" }] }),
    card("3", "Almashhad", "Yemeni government forces capture Anaqib in Jabal Habashi, Taiz", 13.47, 43.89, { place: "Jabal Habashi", alsoReportedBy: [{ source: "Al Jazeera", url: "u" }] }),
    card("4", "Shin Persian", "Pro-government forces seize Houthi vehicles in Dhubab district", 12.94, 43.41, { place: "Dhubab", alsoReportedBy: [{ source: "South24 English", url: "u" }] }),
  ];
  const { all } = cardMarks(cards, () => []);
  assert.equal(all.filter((m) => m.kind === "capture").length, 0);
  assert.ok(all.some((m) => m.kind === "advance" && m.side === "government"));
});

test("the whole district taken, told by two groups, is a flag in that district (Dhubab, 5 Oct)", () => {
  const c = card("d", "South24 English", "Southern Giants Forces, Nation's Shield forces and tribes take control of Dhubab district", 12.94, 43.41, {
    place: "Dhubab",
    alsoReportedBy: [{ source: "Yemen Future", url: "u", summary: "Yemeni government forces capture Dhubab district and strategic sites in Bab al-Mandab" }],
  });
  assert.deepEqual(captureFlag(c), { to: "plc", district: "dhubab", name: captureFlag(c)?.name });
  const { all } = cardMarks([c], () => []);
  const flag = all.find((m) => m.kind === "capture");
  assert.equal(flag?.district, "dhubab");
  assert.equal(flag?.side, "government");
});

test("a side named only as the one that withdrew is not the one that advanced (Taiz, 5 Oct)", () => {
  const c = card("t", "Al-Masdar Online", "Taiz military axis forces advance in Al-Aqroud, Jabal Habashi, and Samie as Houthi forces withdraw", 13.58, 44.02, { place: "Taiz" });
  const { all } = cardMarks([c], () => []);
  assert.ok(all.length);
  assert.ok(all.every((m) => m.side === "government" && m.kind !== "capture"));
});

/* ---------------- One event, one card ---------------- */

const live = (fp: string, source: string, at: string, type: string, summary: string, extra: Record<string, unknown> = {}) =>
  ({ fp, source, at, type, summary, url: `https://t.me/${source.replace(/\W/g, "")}/${fp}`, live: true, text: "", score: 40, tags: [], ...extra }) as never;
const RIYADH = { place: "Riyadh", lat: 24.7136, lng: 46.6753 };
const SANAA = { place: "Sanaa", lat: 15.3694, lng: 44.191 };

test("one channel's posts on one event with nothing new are one card (Ali Bk, Riyadh smoke, 3 Oct 09:55 and 10:00)", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const a = live("a", "Ali Bk", "2026-10-03T06:55:00Z", "strike", "Smoke rises near targeted oil site in Riyadh following Houthi attack", RIYADH);
  const b = live("b", "Ali Bk", "2026-10-03T07:00:00Z", "strike", "Footage shows smoke rising near the targeted oil site in Riyadh", RIYADH);
  const reports = [a, b];
  foldIntoPublished(reports, new Set(["a"]));
  assert.equal(reports.length, 1);
});

test("one channel's new strike on the same place stays its own card", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const a = live("a", "Ali Bk", "2026-10-03T06:55:00Z", "strike", "Smoke rises near targeted oil site in Riyadh following Houthi attack", RIYADH);
  const b = live("b", "Ali Bk", "2026-10-03T09:30:00Z", "strike", "New wave of drones strikes the oil site in Riyadh again", RIYADH);
  const reports = [a, b];
  foldIntoPublished(reports, new Set(["a"]));
  assert.equal(reports.length, 2);
});

test("a wave of strikes on Sanaa told by several outlets within the hour is one card (3 Oct, 13:00 to 14:00)", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const a = live("a", "SNN", "2026-10-03T10:03:00Z", "strike", "Saudi Arabia launches new air strikes against Sanaa", SANAA);
  const b = live("b", "Aden al-Ghad", "2026-10-03T10:23:00Z", "strike", "Saudi air strikes target Houthi sites in Sanaa, including Jabal Attan and Al-Nahdayn", SANAA);
  const c = live("c", "Al Hadath", "2026-10-03T10:51:00Z", "strike", "Saudi air strikes renew targeting Al-Nahdayn military compound in Sanaa", SANAA);
  const reports = [a, b, c];
  foldIntoPublished(reports, new Set(["a"]));
  assert.equal(reports.length, 1);
  assert.deepEqual(((reports[0] as { alsoReportedBy?: { source: string }[] }).alsoReportedBy ?? []).map((x) => x.source), ["Aden al-Ghad", "Al Hadath"]);
});

/* ---------------- Sides and words ---------------- */

test("a Houthi-aligned outlet's 'Yemeni forces' are the Houthis (Ali Bk, 3 Oct 14:16)", async () => {
  const { houthiYemeniForces } = await import("./editor.ts");
  assert.ok(houthiYemeniForces({ source: "Ali Bk", lean: "houthi", text: "القوات اليمنية تتقدم باتجاه الزعزاع في مديرية الشمايتين بعد تأمين بني محمد" }));
  // Bin Saeed is Houthi-aligned (5 Oct: "the Saudi enemy", "the Yemeni armed forces" for the Houthis).
  assert.ok(houthiYemeniForces({ source: "Bin Saeed", lean: "houthi", text: "هجوم جديد للقوات المسلحة اليمنية يستهدف العاصمة السعودية الرياض" }));
  // Its own post naming the government side ("forces of the legitimacy") is read as written (Al-Aqsa TV, 3 Oct 14:10).
  assert.ok(!houthiYemeniForces({ source: "Al-Aqsa TV", lean: "houthi", text: "أسر عناصر من قوات الشرعية بعد اشتباكات وتقدم في جبل راسن" }));
  // A government-aligned outlet's "Yemeni army" is the government's.
  assert.ok(!houthiYemeniForces({ source: "Almashhad", lean: "gov", text: "الجيش اليمني يستعيد مواقع في تعز" }));
});

test("the desk's groups: Bin Saeed is Houthi-aligned, Yemen's human rights ministry is the government's", async () => {
  const { groupOf } = await import("./source-rating.ts");
  assert.equal(groupOf("Bin Saeed"), "houthi");
  assert.equal(groupOf("Yemen Human Rights Ministry"), "gov");
});

test("an Iranian channel relaying the Houthi spokesman or summing up the day is not taken (3 Oct, 07:47 and 09:16)", async () => {
  const { gate } = await import("./relevance.ts");
  const relay = gate({ source: "Press TV", url: "u", agency: false, text: "Yemeni Armed Forces spokesman Yahya Saree says Saudi jets carried out 94 airstrikes on Yemen in 24 hours" });
  assert.equal(relay.reason, "iran-relay");
  const recap = gate({ source: "Nour News", url: "u", agency: false, text: "Summary of the day's events in Yemen: Saudi raids on Sanaa, fires in Riyadh, clashes in Taiz" });
  assert.equal(recap.outcome, "exclude");
});
