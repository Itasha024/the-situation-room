import { test } from "node:test";
import assert from "node:assert/strict";
import { anglicise } from "./anglicise.ts";

test("Arabic places left in English copy become English", () => {
  const out = anglicise("Saudi forces shelled villages in مديرية الظاهر and parts of مديرية حيدان");
  assert.equal(out, "Saudi forces shelled villages in Al-Dhahr district and parts of Haydan district");
  assert.ok(!/[؀-ۿ]/.test(anglicise("Saudi aircraft strike مديرية حيفان in تعز")));
});

test("known places take the gazetteer's name", () => {
  assert.equal(anglicise("Clashes in تعز and مأرب"), "Clashes in Taiz and Marib");
});

import { reword } from "./editor.ts";

test("the sources' partisan words are reworded, not left to sink the report", () => {
  assert.equal(reword("Missiles fired at the Saudi enemy positions"), "Missiles fired at Saudi forces positions");
  assert.equal(reword("Houthi forces fired at enemy positions"), "Houthi forces fired at opposing positions");
  assert.equal(reword("despite the US-Saudi aggression"), "despite the Saudi-led coalition");
});
