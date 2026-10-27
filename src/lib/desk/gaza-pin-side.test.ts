// The Gaza map's sides from the live pins of 27 Oct (user: "in gaza you have israeli action as hamas pin").
import { test } from "node:test";
import assert from "node:assert/strict";
import { gazaNotAPin, gazaPinSide } from "./gaza-pin-side.ts";

const CASES: [string, string, string][] = [
  ["Gaza Health Ministry says Ahmed Yassin Basiso died of wounds from Israeli shelling on Al-Thawra Street", "hamas", "israel"],
  ["Reports of Israeli fire on group of civilians near Fash Farsh west of Khan Younis", "unclear", "israel"],
  ["Israeli vehicles fire east and south of Khan Younis, south of Gaza", "unclear", "israel"],
  ["Explosions reported east of Gaza City; Israeli artillery shells northeast of Bureij camp", "unclear", "israel"],
  ["Israeli extremists attack olive pickers in Deir Jarir and Beit Ur al-Tahta, wounding four", "pa", "israeli_citizens"],
  ["Palestinian Authority security forces arrest freed prisoners across Tulkarm", "pa", "pa"],
  ["PA security forces arrest released prisoner Luay al-Ashqar in Saida; Israeli forces raid Attil", "pa", "pa"],
  ["Hamas's Rad' force says it clashed with collaborators near displaced persons' tents in Ard", "hamas", "hamas"],
  ["Saraya al-Quds says Israeli forces kill Hossam al-Zamli in al-Iqlimi area south of Khan Younis", "factions", "israel"],
  ["Palestinian source: Dargham Abu Sunayma killed by drone strike while confronting collaborators", "clans", "israel"],
  ["Gaza Interior Ministry: two internal security officers killed during arrest operation in Deir al-Balah", "hamas", "hamas"],
  ["182 Israeli citizens entered the Temple Mount compound today under Israeli force protection", "israeli_citizens", "israeli_citizens"],
  ["IDF: troops killed two gunmen who crossed the yellow line in Beit Lahia", "unclear", "israel"],
  ["Body of Murad Yaqub al-Hawari from Aida Camp found in water well in Wadi Rahhal", "unclear", "unclear"],
  ["Palestinian driver from al-Mughayyir escapes attack by two Israeli extremist vehicles", "israeli_citizens", "israeli_citizens"],
];

test("a pin's side is who acted, not who told it", () => {
  for (const [h, stored, want] of CASES) assert.equal(gazaPinSide(h, stored), want, h);
});

test("roundups and events held are no pins", () => {
  assert.ok(gazaNotAPin("Wall and Settlement Resistance Commission: 13 Israeli attacks across four governorates in a day"));
  assert.ok(gazaNotAPin("Olive harvest solidarity event held in Attaba village east of Tulkarm"));
  assert.ok(gazaNotAPin("Hebron residents face ongoing closures and extremist attacks amid displacement fears"));
  assert.ok(!gazaNotAPin("Israeli extremists steal olive harvest east of al-Samou; 482 attacks on olive pickers documented"));
  assert.ok(!gazaNotAPin("Israeli extremists attack olive pickers in Ein Yabrud east of Ramallah"));
});

test("kinds from the same audit: overhead flights no strike, shooting before property, troop moves a raid", async () => {
  const { gazaKindOf } = await import("./gaza-kinds.ts");
  assert.ok(gazaNotAPin("Reconnaissance drones continue over Hebron since midnight"));
  assert.ok(gazaNotAPin("Helicopters reported over Al-Shati camp airspace"));
  assert.ok(!gazaNotAPin("One killed in Israeli drone strike on Al-Mawasi, Rafah"));
  assert.ok(!gazaNotAPin("Israeli bulldozers raze land in Wadi al-Mugharat; Hebron offensive day four: 619 families affected"));
  assert.ok(!gazaNotAPin("Israeli extremists fire live rounds, detain Palestinians west of Dura; forces conduct arrest campaign in Hebron"));
  assert.equal(gazaKindOf("Israeli forces demolish block near Indonesian Hospital; drones fly over Al-Saftawi"), "demolition");
  assert.equal(gazaKindOf("Israeli extremists fire at Palestinians near Khirbet Hamza outpost west of Dura"), "gunfire");
  assert.equal(gazaKindOf("Israeli forces fire tear gas heavily on Stadium Street in Qalqilya"), "raid");
  assert.equal(gazaKindOf("Israeli forces evict two families from homes, convert them into military posts"), "raid");
  assert.equal(gazaKindOf("Israeli forces withdraw from Arraba and Meithalun towns"), "raid");
  assert.equal(gazaKindOf("One killed in Israeli drone strike on Al-Mawasi, Rafah"), "strike");
});
