import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import * as rule from "./pin-rule.ts";

const off: string[] = [
  "Saudi Arabia accuses Houthis of drone attack on Medina power station as Taiz air strikes surge",
  "Satellite images show Aramco's fuel storage station in Abha was hit, a Houthi-aligned channel says",
  "Satellite imagery shows fires burning at eight locations in Abqaiq, Saudi Arabia",
  "Satellite images show damage to Italian Typhoon aircraft hangars at King Fahd Air Base in Saudi Arabia",
  "Houthi forces send military reinforcements in civilian cars to Taiz",
  "Yemeni government forces inspect frontlines in Al-Subayhah",
  "Trump warns Iran as Houthi attacks escalate regional conflict and block oil exports",
  "Houthi forces detain youths in Ibb governorate",
  "Houthi spokesman threatens to strike Saudi oil facilities",
];
const on: string[] = [
  "Houthis attack a tanker as it passes Bab al-Mandab",
  "The Houthis say ballistic missiles hit the Khamis Mushait air base; satellite images show a possible impact near King Khalid air base",
  "Yemeni warplanes strike Houthi reinforcements and positions in Al-Juba, Marib",
  "Southern Armed Forces shell Houthi movements and reinforcements in Karsh front, north of Lahj",
  "Saudi Civil Defense issues threat alert in Riyadh and Al-Kharj",
  "Child wounded by Houthi gunfire during funeral in Hodeidah",
  "Houthi drones target coalition headquarters in Aden",
  "Giants Brigades seize explosives factory and arrest 5 elements in Beihan, Shabwah",
];

test("a pin is a new event of the four kinds: pictures, build-ups, visits, threats and arrests are not", () => {
  for (const h of off) assert.equal(rule.notNewEvent(h), true, h);
  for (const h of on) assert.equal(rule.notNewEvent(h), false, h);
});

test("the page's map uses the same patterns as the server", () => {
  const app = fs.readFileSync(new URL("../../../public/app.js", import.meta.url), "utf8");
  for (const [name, re] of [["OLD_PICTURE_RE", rule.OLD_PICTURE_RE], ["NOT_EVENT_RE", rule.NOT_EVENT_RE], ["NEW_HIT_RE", rule.NEW_HIT_RE], ["FUTURE_RE", rule.FUTURE_RE], ["ALERT_PIN_RE", rule.ALERT_RE], ["ROUNDUP_RE", rule.ROUNDUP_RE]] as const) {
    const m = new RegExp(`const ${name} = (/.*/i);`).exec(app);
    assert.ok(m, name);
    assert.equal(m![1], String(re), name);
  }
});

test("oldPicture: earlier damage only, never a new hit before it", async () => {
  const { oldPicture } = await import("./pin-rule.ts");
  assert.equal(oldPicture("Satellite images show damage at Yanbu refinery"), true);
  assert.equal(oldPicture("Footage shows the aftermath of strikes on Abqaiq"), true);
  assert.equal(oldPicture("Missiles hit Al-Anad base; satellite images show an impact"), false);
  assert.equal(oldPicture("Saudi warplanes strike Hodeidah port"), false);
  assert.equal(oldPicture("Houthis threaten to strike Riyadh"), false);
});

test("a video put out now of an earlier attack is no pin and no report (23 Oct)", async () => {
  const { notNewEvent } = await import("./pin-rule.ts");
  const { notNews } = await import("./copy-rules.ts");
  const { iranPinAllowed } = await import("./iran-places.ts");
  const h = "Iranian missile hits Al Dhafra US base in UAE, Iranian channel posts first footage";
  assert.equal(notNewEvent(h), true);
  assert.ok(notNews(h));
  assert.ok(notNews("Missile strike", "فيديو ينشر للمرة الأولى يوثق اللحظات الأولى لسقوط صاروخ ايراني على قاعدة الظفرة"));
  assert.equal(iranPinAllowed("iran", { country: "UAE", lat: 24.25, lng: 54.55 }, h), false);
  // A new strike stays one.
  assert.equal(notNewEvent("Iranian missile hits Al Dhafra US base in UAE"), false);
  assert.equal(notNews("Iranian missile hits Al Dhafra US base in UAE"), null);
});
