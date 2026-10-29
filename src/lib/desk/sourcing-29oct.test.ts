import { test } from "node:test";
import assert from "node:assert/strict";
import { relayOf } from "./copy-rules.ts";

// 29 Oct: Iran's and Russia's outlets tell their own country's story only (Trump from TASS, Obama from IRNA,
// the Fed from Nour News, Australia's travel warning from VOA Farsi).
const relay = (headline: string, source: string, type: string) => relayOf({ headline, source, type, desk: "iran" });

test("an Iranian or Russian outlet telling another country's story is a relay", () => {
  assert.ok(relay("He wants to rename the Strait of Hormuz the Trump Strait, says more oil is flowing", "TASS", "statement"));
  assert.ok(relay("Obama blames Trump's tariffs and war on Iran for inflation and higher prices", "IRNA", "statement"));
  assert.ok(relay("Australian government: Australia issues travel warning for Iran, urges citizens to leave", "VOA Farsi", "statement"));
  assert.ok(relay("US Federal Reserve holds interest rate at about 3.9% amid the war against Iran", "Nour News", "economy"));
});

test("their own country's words and acts stay", () => {
  assert.equal(relay("Explosion heard in Bandar Abbas after US strikes", "IRNA", "strike"), null);
  assert.equal(relay("Araghchi meets Omani foreign minister in Muscat", "IRNA", "diplomacy"), null);
  assert.equal(relay("Pezeshkian: the US must lift sanctions before talks", "Tasnim", "statement"), null);
  assert.equal(relay("Lavrov: Russia ready to mediate between Iran and the US", "TASS", "statement"), null);
  assert.equal(relay("IRGC navy seizes tanker in the Strait of Hormuz", "Tasnim", "vessel"), null);
  // Their own scoop is theirs to tell.
  assert.equal(relayOf({ headline: "US envoy: talks with Iran resume next week", source: "Tasnim", type: "diplomacy", desk: "iran", own: true }), null);
});

import { notNews, pastTense, palestinianClaim } from "./copy-rules.ts";

test("a finished act is in the past tense; nouns and someone's words stay", () => {
  assert.equal(pastTense("Palestinian media: Israeli forces raid homes in Tafuh"), "Palestinian media: Israeli forces raided homes in Tafuh");
  assert.equal(pastTense("Israeli artillery shells outskirts of Barashit"), "Israeli artillery shelled outskirts of Barashit");
  assert.equal(pastTense("Giants Brigades drone strikes kill and wound Houthi fighters in Lahj"), "Giants Brigades drone strikes killed and wounded Houthi fighters in Lahj");
  assert.equal(pastTense("Houthi forces launch missile attack towards Saudi Arabia"), "Houthi forces launched missile attack towards Saudi Arabia");
  assert.equal(pastTense("Intermittent artillery fire between Meidoun and Zoutar al-Sharqiya"), "Intermittent artillery fire between Meidoun and Zoutar al-Sharqiya");
  assert.equal(pastTense("Israeli artillery fire on outskirts of Meidoun"), "Israeli artillery fire on outskirts of Meidoun");
  assert.equal(pastTense("Iran says its forces attack the enemy daily"), "Iran says its forces attack the enemy daily");
});

test("fly-overs, bulletins, talks with nothing done and household economics are not news", () => {
  assert.ok(notNews("US warplanes fly over Erbil in northern Iraq", "", "strike"));
  assert.ok(notNews("Intensive low-altitude reconnaissance flights over Nuseirat camp", "", "strike"));
  assert.ok(notNews("Palestinian media: Israeli forces fire illumination flares over northwestern Beit Lahia", "", "strike"));
  assert.ok(notNews("Crossings Authority: Kerem Shalom and Rafah crossings open; Zikim and Kissufim closed", "", "statement"));
  assert.ok(notNews("Yemen's ambassador to China discusses Houthi military escalation", "", "diplomacy"));
  assert.ok(notNews("US Federal Reserve holds interest rate at about 3.9%", "", "economy"));
  assert.equal(notNews("Israeli drone strike kills two in Khan Younis", "", "strike"), null);
  assert.equal(notNews("Araghchi meets Omani foreign minister in Muscat", "", "diplomacy"), null);
  assert.equal(notNews("Israeli drone struck a car flying over Bint Jbeil road", "", "strike"), null);
});

test("Palestinian outlets have one teller's name; a fan channel is not the armed wing", () => {
  assert.equal(palestinianClaim("Local sources: Israeli forces arrested Jamal Ghazal in Nablus", "arrest", "Palestine Today TV"), "Palestinian media: Israeli forces arrested Jamal Ghazal in Nablus");
  assert.equal(palestinianClaim("Saraya al-Quds: Israeli artillery shelled southern Khan Younis", "strike", "Saraya al-Quds (Ahfad al-Bahaa)"), "Palestinian media: Israeli artillery shelled southern Khan Younis");
  assert.equal(palestinianClaim("Israeli forces raided Halhul, north of Hebron, local sources say", "raid", "Palestine Today TV"), "Palestinian media: Israeli forces raided Halhul, north of Hebron");
});
