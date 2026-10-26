import { test } from "node:test";
import assert from "node:assert/strict";
import { dropFrontLead } from "./front-lead.ts";

test("drops the front's own name at the start", () => {
    assert.equal(dropFrontLead("In Saudi Arabia, a Houthi ballistic missile targeted King Khalid air base.", "Saudi Arabia"), "A Houthi ballistic missile targeted King Khalid air base.");
    assert.equal(dropFrontLead("In Sanaa governorate, coalition air strikes destroyed a depot.", "Sanaa"), "Coalition air strikes destroyed a depot.");
    assert.equal(dropFrontLead("On the Red Sea coast, a rocket struck a building.", "Red Sea coast"), "A rocket struck a building.");
    assert.equal(dropFrontLead("In the Bab al-Mandab front, a fighter was killed.", "Bab al-Mandab"), "A fighter was killed.");
    assert.equal(dropFrontLead("In Al-Jawf governorate, a landmine killed a civilian.", "Al-Jawf"), "A landmine killed a civilian.");
  });
test("keeps the part of the front at the end", () => {
    assert.equal(dropFrontLead("In western Taiz governorate, government forces advanced.", "Taiz"), "Government forces advanced (western Taiz).");
  });
test("leaves other openings", () => {
    assert.equal(dropFrontLead("In Al-Wazi'iyah, forces advanced.", "Taiz"), "In Al-Wazi'iyah, forces advanced.");
    assert.equal(dropFrontLead("Houthi media: strikes hit Saada.", "Saada"), "Houthi media: strikes hit Saada.");
  });
