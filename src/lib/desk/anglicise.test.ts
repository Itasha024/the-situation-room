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
