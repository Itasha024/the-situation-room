/** The main desk's tags (option C): place, countries, desks, category. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { facetsOf, placeOf, storyKey } from "./facets.ts";

test("a point falls in its country or sea", () => {
  assert.equal(placeOf(15.47, 45.32), "yemen"); // Marib
  assert.equal(placeOf(24.71, 46.68), "saudi"); // Riyadh
  assert.equal(placeOf(33.32, 35.46), "lebanon"); // Zawtar
  assert.equal(placeOf(35.69, 51.39), "iran"); // Tehran
  assert.equal(placeOf(32.08, 34.78), "israel"); // Tel Aviv
  assert.equal(placeOf(31.5, 34.45), "gaza");
  assert.equal(placeOf(32.22, 35.26), "judea-samaria"); // Nablus
  assert.equal(placeOf(33.31, 44.37), "iraq"); // Baghdad
  assert.equal(placeOf(26.57, 56.25), "hormuz"); // the strait
  assert.equal(placeOf(12.6, 43.35), "redsea"); // Bab al-Mandab
  assert.equal(placeOf(13.0, 48.0), "redsea"); // Gulf of Aden
  assert.equal(placeOf(25.29, 51.53), "gulf"); // Doha
  assert.equal(placeOf(48.85, 2.35), null); // Paris: not followed
  assert.equal(placeOf(NaN, NaN), null);
});

test("a report is about every country it names, its place first", () => {
  const f = facetsOf({ summary: "Iranian diplomat: mediation between Saudi Arabia and Yemen continues", type: "diplomacy", desks: ["iran"] });
  assert.deepEqual(new Set(f.countries), new Set(["iran", "saudi", "yemen"]));
  assert.equal(f.category, "diplomacy");
  assert.deepEqual(f.desks, ["iran"]);

  const g = facetsOf({ summary: "Houthi forces fire 9 ballistic missiles at residential areas in Marib", lat: 15.47, lng: 45.32, type: "strike" }, "yemen");
  assert.equal(g.where, "yemen");
  assert.equal(g.countries[0], "yemen");
  assert.deepEqual(g.desks, ["yemen"]);
  assert.equal(g.category, "strike");
});

test("the US is named by its words, not by the letters 'us' in a sentence", () => {
  assert.ok(facetsOf({ summary: "US Treasury sanctions Iraqi bank" }, "iran").countries.includes("us"));
  assert.ok(!facetsOf({ summary: "Houthi official: they will not stop us" }, "yemen").countries.includes("us"));
});

test("a sea pin joins its desk; ships are shipping", () => {
  const f = facetsOf({ summary: "Iran fires missiles at non-compliant ships in Strait of Hormuz", lat: 26.57, lng: 56.25, type: "vessel", desks: ["iran"] });
  assert.equal(f.where, "hormuz");
  assert.equal(f.category, "shipping");
  const r = facetsOf({ summary: "French frigate downs drone targeting container ship", lat: 12.6, lng: 43.35, type: "vessel", desks: ["iran"] });
  assert.deepEqual(new Set(r.desks), new Set(["iran", "yemen"]));
});

test("nothing named and no point: the desk's own home", () => {
  assert.deepEqual(facetsOf({ summary: "Official: talks will resume next week" }, "iran").countries, ["iran"]);
  assert.deepEqual(facetsOf({ summary: "Official: talks will resume next week" }, "yemen").countries, ["yemen"]);
});

test("Gaza and Judea and Samaria are their own places, without a live desk yet", () => {
  const f = facetsOf({ summary: "IDF raid in Jenin", lat: 32.46, lng: 35.3, type: "combat", desks: ["iran"] });
  assert.equal(f.where, "judea-samaria");
  assert.ok(f.countries.includes("israel"));
  assert.deepEqual(f.desks, ["iran"]);
});

test("the same source's card on both desks is one story", () => {
  assert.equal(storyKey("ir-live-t-me-naya-foriraq-93807"), storyKey("live-t-me-naya-foriraq-93807"));
});
