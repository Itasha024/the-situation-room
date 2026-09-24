import { test } from "node:test";
import assert from "node:assert/strict";
import { captor, districtNear, proposeControl } from "./control-proposals.ts";

test("who took the ground is the side named before the verb; a repelled attack is no capture", () => {
  assert.equal(captor("Houthi forces take Hayjat al-Abd and cut the Taiz-Aden road"), "houthi");
  assert.equal(captor("Government forces retake Jabal Qarfan from the Houthis"), "plc");
  assert.equal(captor("Giants Brigades take the Kahbub heights"), "plc");
  assert.equal(captor("Government forces repel a Houthi attempt to take Al-Ashbut"), null);
  assert.equal(captor("Saudi jets strike Haifan"), null);
});

test("a capture told by two outlets from different sides is proposed; one side alone is not", () => {
  const base = { live: true, text: "", type: "combat", url: "u", lat: 13.1, lng: 44.15 } as const;
  const a = { ...base, fp: "a", source: "Naya", side: "houthi", at: "2026-09-24T02:29:00Z", summary: "Houthi forces take Hayjat al-Abd" };
  const b = { ...base, fp: "b", source: "Reuters", side: "agency", at: "2026-09-24T05:00:00Z", summary: "Houthi forces seize a key road junction at Hayjat al-Abd" };
  const c = { ...base, fp: "c", source: "Ali Bk", side: "houthi", at: "2026-09-24T03:00:00Z", summary: "Houthi forces take Hayjat al-Abd" };
  assert.equal(districtNear(13.134, 44.147)?.id, "al-maqatirah");
  const p = proposeControl([a, b] as never[]);
  assert.equal(p.length, 1);
  assert.equal(p[0].to, "houthi");
  assert.equal(proposeControl([a, c] as never[]).length, 0);
});
