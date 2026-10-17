import { test } from "node:test";
import assert from "node:assert/strict";
import { pinSideOf } from "./dev-marks.ts";

// Headlines from the Yemen map on 17 Oct: the pin takes the colour of the side that acted.
const side = (label: string, type = "strike") => pinSideOf({ type, label });

test("the side that acted, not the one hit", () => {
  assert.equal(side("Houthi forces strike military targets in Khamis Mushait and Abha in southern Saudi Arabia"), "houthi");
  assert.equal(side("Coalition air strikes target Houthi build-ups and military vehicles in Al-Shaqab front in Taiz"), "saudi");
  assert.equal(side("Yemeni government drone strikes target Houthi gatherings and military vehicles in Marib"), "government");
  assert.equal(side("Southern Giants Brigades target Houthi vehicles, personnel, and positions on Al-Mudaribah front", "combat"), "government");
});

test("the Houthis' own word for their forces is Yemeni", () => {
  assert.equal(side("Yemeni ballistic missiles target a military gathering of Saudi-backed forces in Lahj"), "houthi");
  assert.equal(side("Yemeni government forces escalate operations against Houthi forces in Marib", "combat"), "government");
});

test("a speaker before a colon is not who acted, nor are the dead", () => {
  assert.equal(side("Aden security: two Houthi ballistic missiles land inside Aden International Airport"), "houthi");
  assert.notEqual(side("Taiz military axis: 168 Houthi fighters killed and 210 wounded in clashes and air strikes in Taiz", "combat"), "houthi");
});

test("an air strike with no one named is the coalition's; nothing named is not stated", () => {
  assert.equal(side("Air strikes target communications towers in Jabal Habashi district of Taiz"), "saudi");
  // An alert in Saudi Arabia meets a Houthi attack (user, 17 Oct: pins with no colour).
  assert.equal(side("Air defence alerts in Khamis Mushait"), "houthi");
  assert.equal(side("Landmine explosion kills woman and wounds three family members in Al-Shamaitin district of Taiz", "combat"), null);
  assert.equal(side("Israeli strikes hit Hodeidah port"), "israel");
});

test("warplanes are the coalition's whoever they hit; the Houthi spokesman's claims are theirs", () => {
  assert.equal(side("Warplanes shell Houthi positions around Jabal Han west of Taiz"), "saudi");
  assert.equal(pinSideOf({ type: "strike", label: "Strikes hit Saudi build-ups in Al-Yatemah in Al-Jawf", source: "Yahya Saree" }), "houthi");
});

test("alerts, interceptions and attacks in Saudi Arabia are the Houthis' (17 Oct)", () => {
  assert.equal(side("Air defence alerts in Abha"), "houthi");
  assert.equal(side("Early warning sirens sound in Khamis Mushait"), "houthi");
  assert.equal(side("Saudi Civil Defense activates early warning in Jazan, Khamis Mushait and Abha after detecting missiles"), "houthi");
  assert.equal(side("Yemeni attack targets Khamis Mushait, Saudi warning issued"), "houthi");
  assert.equal(side("Missiles hit Aden airport, Saudi coalition intercepts ballistic missile targeting Yanbu"), "houthi");
  assert.equal(side("Explosions reported in Abha, Khamis Mushait and Jazan", "combat"), "houthi");
  assert.equal(side("French frigate Languedoc shoots down drone targeting container ship in Bab al-Mandab", "vessel"), "houthi");
  assert.equal(side("Missile fired from Ibb towards Taiz"), "houthi");
  assert.equal(side("2 missiles hit airport in Yemen's port city of Aden, officials say"), "houthi");
});

test("a strike others make stays theirs (17 Oct)", () => {
  assert.equal(side("Houthi Armed Forces spokesperson: Saudi airstrikes on Sanaa, Taiz, Ibb, Lahj and Saada"), "saudi");
  assert.equal(side("Yemeni government drone strikes target Houthi gatherings and military vehicles in Marib"), "government");
  assert.equal(side("US drone strike hits vehicle in Marib"), "us");
  assert.equal(side("Landmine explosion kills woman in Al-Shamaitin district of Taiz", "combat"), null);
});
