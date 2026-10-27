import { test } from "node:test";
import assert from "node:assert/strict";
import { paragraphs } from "./copy-rules.ts";
import { fitHeadline } from "./reader.ts";
import { officialLead } from "./editor.ts";

test("a long body is split into paragraphs; a short one is not (user, 27 Oct)", () => {
  const long = "One in Iran. Two by Lt. Col. Smith. Three in the U.S. today. Four here. Five there. Six now. Seven later.";
  assert.equal(paragraphs(long), "One in Iran. Two by Lt. Col. Smith. Three in the U.S. today.\n\nFour here. Five there.\n\nSix now. Seven later.");
  assert.equal(paragraphs("One. Two. Three."), "One. Two. Three.");
  assert.equal(paragraphs("A.\n\nB. C. D. E. F."), "A.\n\nB. C. D. E. F.");
});

test("a long headline's tail: no \"The yazbek … said said\", no cut inside a phrase (user, 27 Oct)", () => {
  const r = fitHeadline({ headline: "Yazbek to MTV: Hezbollah surrounded an army patrol during the pharmacy warehouse raid near Samir Gallery, said army entered high-sensitivity area", body: "" });
  assert.equal(r.body, "Yazbek also said army entered high-sensitivity area.");
  const court = { headline: "Iranian Revolutionary Court in Mashhad sentences Hassan Golshannejad, 36, to death for operational action in favour of Israel after protests", body: "" };
  assert.ok(!/^to death/.test(fitHeadline(court).body ?? ""));
});

test("an official account's own post leads with its name, never \"A source:\" (user, 27 Oct)", () => {
  assert.equal(officialLead("A source: US forces remain present in Hormuz", "CENTCOM"), "CENTCOM: US forces remain present in Hormuz");
  assert.equal(officialLead("A source: US forces remain present in Hormuz", "Reuters"), "A source: US forces remain present in Hormuz");
});
