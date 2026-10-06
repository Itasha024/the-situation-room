import assert from "node:assert/strict";
import test from "node:test";
import { cardMarks, kindOf } from "./dev-marks.ts";
import { placeProse } from "./prose-places.ts";
import { unknownSpots } from "./editor.ts";
import type { LiveReport } from "./types.ts";

const card = (over: Partial<LiveReport>): LiveReport =>
  ({ fp: "f", at: "2026-09-30T06:00:00Z", source: "Aden al-Ghad", url: "u", type: "combat", summary: "", text: "", ...over }) as LiveReport;

test("one side's capture of a hill is drawn as its advance; told by both sides it is still an advance (30 Sep; 3 Oct)", () => {
  const one = card({ summary: "Yemeni government forces recapture Jabal Qarfan in Al-Wazi'iyah from Houthi forces", lat: 13.178, lng: 43.867, place: "Jabal Qarfan" });
  assert.equal(cardMarks([one], () => []).all[0].kind, "advance");
  // A hill is not the whole district: no flag, whoever tells it (user, 3 Oct; round29.test.ts).
  const both = card({ ...one, alsoReportedBy: [{ source: "Al-Masirah", url: "v" }] as never });
  assert.equal(cardMarks([both], () => []).all[0].kind, "advance");
});

test("a merged card's place outside the governorate its headline names is not drawn (Al-Mansurah, Lahj)", () => {
  const r = card({
    summary: "Yemeni government forces recapture Al-Mansurah mountain in Al-Mudaribah, Lahj",
    places: [
      { name: "Al-Mudaribah", lat: 12.9, lng: 43.97 },
      { name: "Al-Mansurah", lat: 13.28, lng: 43.45 },
    ] as never,
  });
  const names = cardMarks([r], () => []).all.map((m) => m.place);
  assert.deepEqual(names, ["Al-Mudaribah"]);
});

test("the headline's unknown spot beats the dateline's known one (Al-Bazilah, not Kahbub)", () => {
  assert.deepEqual(unknownSpots("Southern forces capture Al-Qarnaynah mountain and repel Houthi attacks in Lahj"), ["Al-Qarnaynah"]);
  assert.deepEqual(unknownSpots("Southern forces capture Al-Bazilah mountain in Lahj"), []); // known since 30 Sep
  assert.deepEqual(unknownSpots("Houthi shelling hits Kahbub in Lahj"), []);
});

test("a Saudi namesake is no place for a Yemeni sentence (Jabal Jarad, 30 Sep)", async () => {
  const cache = { "en|Jabal Jarad|": { name: "Jabal Jarad", lat: 23.1807, lng: 44.6648 } };
  const store = { getJson: async () => cache, putJson: async () => {} } as never;
  const out = await placeProse(store, ["Houthi shelling hit Jabal Jarad and Al-Rahma mosque."], []);
  assert.equal(out["Jabal Jarad"], undefined);
  const saudi = await placeProse(store, ["A drone fell on Jabal Jarad in Saudi Arabia."], []);
  assert.deepEqual(saudi["Jabal Jarad"], [23.1807, 44.6648]);
});

test("two anti-Houthi outlets are one camp: no flag (Al-Mansurah mountain, 29 Sep)", () => {
  const r = card({ summary: "Yemeni government forces recapture Al-Mansurah mountain in Al-Mudaribah, Lahj", lat: 13.1, lng: 43.83, place: "Al-Mansurah", alsoReportedBy: [{ source: "Almashhad", url: "v" }] as never });
  assert.equal(cardMarks([r], () => []).all[0].kind, "advance");
});

test("one side's outlet and a non-aligned one make a capture (user, 2 Oct), of the whole district (3 Oct)", () => {
  const r = card({ summary: "Yemeni government forces take full control of Al-Madaribah district, Lahj", lat: 13.1, lng: 43.83, place: "Al-Madaribah", alsoReportedBy: [{ source: "The National", url: "v" }] as never });
  assert.equal(cardMarks([r], () => []).all[0].kind, "capture");
});

test("piracy and the US–Iran war are not this war; the Houthis at sea are", async () => {
  const { notThisWar } = await import("./editor.ts");
  assert.ok(notThisWar("Egypt releases eight Egyptian sailors kidnapped off Shabwa, Yemen, and held in Somalia", "الإفراج عن البحارة المصريين المختطفين قبالة سواحل شبوة اليمنية"));
  assert.ok(notThisWar("US officials: Trump may order a return to major combat against Iran after the midterms", ""));
  assert.equal(notThisWar("Houthi forces seize a tanker off Hodeidah", ""), null);
  assert.equal(notThisWar("Iran's foreign minister and Trump envoy discuss the Houthis and Bab al-Mandab", ""), null);
});

test("a launch reported alone flies to the hit reported soon after (Sanaa -> Aden, 30 Sep)", () => {
  const launch = card({ fp: "a", at: "2026-09-30T06:25:02Z", source: "Almashhad", type: "strike", summary: "Houthi forces launch two ballistic missiles from Sanaa", lat: 15.3694, lng: 44.191, place: "Sanaa" });
  const hit = card({ fp: "b", at: "2026-09-30T06:39:19Z", source: "Sawt al-Asima", type: "strike", summary: "Houthi forces fire ballistic missiles at Nation's Shield forces base in Aden", lat: 12.79, lng: 45.02, place: "Aden" });
  const all = cardMarks([launch, hit], () => []).all;
  assert.equal(all.length, 1);
  assert.equal(all[0].place, "Aden");
  assert.deepEqual(all[0].fromLl, [15.3694, 44.191]);
  // No launch named: just the hit.
  assert.equal(cardMarks([hit], () => []).all[0].fromLl, undefined);
});

test("a prose missile with no launch area takes the one the window's cards name", async () => {
  const { launchFor } = await import("./dev-marks.ts");
  const aden = { place: "Aden", kind: "missile", side: "houthi", ll: [12.79, 45.02] } as const;
  const sanaa = { kind: "missile", side: "houthi", ll: [15.3694, 44.191], at: 0 } as const;
  assert.deepEqual(launchFor({ ...aden, ll: [...aden.ll] }, [{ ...sanaa, ll: [...sanaa.ll] }]), [15.3694, 44.191]);
  // Two launch areas: it cannot say which.
  assert.equal(launchFor({ ...aden, ll: [...aden.ll] }, [{ ...sanaa, ll: [...sanaa.ll] }, { ...sanaa, ll: [16.94, 43.76] }]), undefined);
});

test("a drone shot down is drawn in the colour of the side that flew it (Saada, 30 Sep)", () => {
  const houthiOutlet = card({ source: "Al-Mihwar", type: "strike", summary: "Yemeni air defences shoot down Saudi drone over Saada", lat: 16.94, lng: 43.76, place: "Saada" });
  const m = cardMarks([houthiOutlet], () => []).all[0];
  assert.equal(m.kind, "interception");
  assert.equal(m.side, "saudi");
  assert.equal(m.shot, "drone");
  const saudiSide = card({ source: "Al Arabiya", type: "strike", summary: "Saudi air defences intercept two Houthi missiles over Jazan", lat: 16.89, lng: 42.55, place: "Jazan" });
  const n = cardMarks([saudiSide], () => []).all[0];
  assert.equal(n.side, "houthi");
  assert.equal(n.shot, "missile");
});

test("an energy site hit gets its own kind; a ship stays a ship (1 Oct)", () => {
  assert.equal(kindOf(card({ type: "strike", summary: "Houthi drones hit Aramco's Yanbu refinery" })), "energy");
  assert.equal(kindOf(card({ type: "port", summary: "Missile strike on Ras Isa oil terminal" })), "energy");
  assert.equal(kindOf(card({ type: "strike", summary: "Saudi air strikes hit a Houthi fuel depot in Hodeidah" })), "energy");
  assert.equal(kindOf(card({ type: "vessel", summary: "Tanker hit by a projectile off Mocha" })), "naval");
  assert.equal(kindOf(card({ type: "strike", summary: "Houthi drone hits a tanker near Yanbu refinery" })), "naval");
  assert.equal(kindOf(card({ type: "strike", summary: "Saudi air strikes on Saada" })), "airstrike");
});

import { sameEventAbroad } from "./copies.ts";
import { placesInCountry } from "./gazetteer.ts";

const yp = (s: string) => placesInCountry(s, "Yemen").map((p) => p.name);
const h = (summary: string) => ({ summary });

test("one event in Saudi Arabia in different words is one card", () => {
  const home = h("Coalition spokesman Turki al-Maliki and Saudi media said a Houthi drone strike hit Taibah electricity station in Medina");
  assert.ok(sameEventAbroad(home, h("Saudi coalition admits to Houthi strike on Taibah electricity station in Medina"), yp));
  assert.ok(sameEventAbroad(home, h("Coalition spokesman: Houthi forces targeted Taibah electricity distribution station in Medina"), yp));
  assert.ok(sameEventAbroad(home, h("Coalition: Houthi attack on Taibah electricity station caused a transformer to go out of service"), yp));
});

test("a reaction, a Yemeni front or a mixed card stays apart", () => {
  const attack = h("Houthi militia targets electricity station feeding the Prophet's Mosque");
  assert.ok(!sameEventAbroad(attack, h("Gulf Cooperation Council secretary-general condemns Houthi targeting of electricity station serving Prophet's Mosque"), yp));
  const mixed = h("Major-General Mohammed Al-Khawlani killed in clashes with Houthi forces in Taiz as a coalition spokesman says a Houthi terrorist attack targeted Taibah electricity distribution station in Medina");
  assert.ok(!sameEventAbroad(mixed, h("Coalition spokesman: Houthi forces targeted Taibah electricity distribution station in Medina"), yp));
  assert.ok(!sameEventAbroad(h("Saudi air strikes hit Al-Salim directorate and Kataf wa al-Boqeia in Saada"), h("Saudi air strikes hit south of Saada, Al-Safra, and Kataf wa al-Boqeia in Saada governorate"), yp));
});

import { fixHeadline } from "./reader.ts";

test("a minister warning of something keeps the verb", () => {
  assert.equal(fixHeadline("Yemen human rights minister warns of Houthi escalation and migrant recruitment"), "Yemen human rights minister warns of Houthi escalation and migrant recruitment");
  assert.equal(fixHeadline("UN spokesman says talks will resume"), "UN spokesman: talks will resume");
});

import { sideWords } from "./editor.ts";

test("sides by their own names, whoever wrote the source", () => {
  assert.equal(sideWords("Clashes reported between Yemeni forces and Saudi-backed forces in eastern Taiz", undefined), "Clashes reported between Houthi forces and Saudi-backed forces in eastern Taiz");
  assert.equal(sideWords("Clashes reported between Yemeni government forces and coalition-backed forces in Taiz", undefined), "Clashes reported between Houthi forces and coalition-backed forces in Taiz");
  assert.equal(sideWords("Yemeni armed forces strikes destroy Houthi artillery in Mocha", "government"), "Yemeni government forces strikes destroy Houthi artillery in Mocha");
  assert.equal(sideWords("Warplanes target Houthi militia elements in Bani Omar", "government"), "Warplanes target Houthi elements in Bani Omar");
  assert.equal(sideWords("Coalition: Houthi militia continues to provoke millions of Muslims", "saudi"), "Coalition: Houthi forces continue to provoke millions of Muslims");
  assert.equal(sideWords("Houthi militia launches attack on Hays", undefined), "Houthi forces launch attack on Hays");
});

import { keepReported } from "./prose.ts";

test("a front's 'holding' lines stay only when its reports say so", () => {
  const sanaa = "Airstrikes were reported to have targeted a Houthi military camp on Jabal Dhaein in the Hamdan directorate, north-west of the capital. Anti-aircraft defenses in Sanaa remain on alert.";
  assert.equal(keepReported(sanaa, [{ summary: "Air strike hits Houthi camp at Jabal Dayn in Hamdan, north-west of Sanaa" }]), "Airstrikes were reported to have targeted a Houthi military camp on Jabal Dhaein in the Hamdan directorate, north-west of the capital.");
  assert.equal(keepReported("Government forces hold defensive lines near Al-Yatamah, while tensions persist between local tribes and Houthi authorities.", []), "");
  const held = "Popular Resistance commander says forces are holding positions in Al-Shamayateen.";
  assert.equal(keepReported(held, [{ summary: "Popular Resistance commander in Al-Shamayateen: forces are holding positions" }]), held);
});

test("one count at one place from several outlets is one report (the spokesman's 27 airstrikes)", async () => {
  const { sameCountAt } = await import("./copies.ts");
  const first = { summary: "Yemeni government forces launch 27 airstrikes in Taiz" };
  assert.ok(sameCountAt(first, { summary: "Yemeni government forces report 27 airstrikes on Houthi military sites in Taiz" }));
  assert.ok(!sameCountAt(first, { summary: "Yemeni government forces launch 15 airstrikes in Taiz" }));
  assert.ok(!sameCountAt(first, { summary: "Saudi warplanes launch 27 airstrikes on Saada" }));
});

test("a speaker named twice in a headline keeps the role; the speaker's own account is the speaker's", async () => {
  const { fixHeadline: fix } = await import("./reader.ts");
  assert.equal(fix("Col Majed Al Nazili: Yemeni government forces spokesman issues warning on Houthi-used roads in Taiz"), "Yemeni government forces spokesman issues warning on Houthi-used roads in Taiz");
  const { speakerIs } = await import("./copies.ts");
  assert.ok(speakerIs("Pakistan Foreign Ministry", "Pakistan's Ministry of Foreign Affairs condemns Houthi targeting of Madinah power facility"));
  assert.ok(!speakerIs("Pakistan Foreign Ministry", "Saudi Arabia thanks Pakistan for its support"));
});
