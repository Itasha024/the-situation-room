import { test } from "node:test";
import assert from "node:assert/strict";
import { pickHit } from "./geocode.ts";
import { PLACE_BY_NAME } from "./gazetteer.ts";

const saada = PLACE_BY_NAME["Saada"];

test("a lookup near the governorate the text names is taken", () => {
  const hit = pickHit(
    [
      { lat: "15.3", lon: "44.2", name: "Al Dhaher" },
      { lat: "16.687", lon: "43.275", name: "Al Dhaher district" },
    ],
    saada,
  );
  assert.equal(hit?.name, "Al Dhaher district");
});

test("scattered answers with no governorate to judge by are refused", () => {
  const hit = pickHit(
    [
      { lat: "13.3", lon: "44.2", name: "Az Zahir" },
      { lat: "17.2", lon: "43.4", name: "Az Zahir" },
    ],
    undefined,
  );
  assert.equal(hit, null);
});

test("an Arabic answer name is rendered in English", () => {
  const hit = pickHit([{ lat: "13.33", lon: "44.27", name: "حيفان" }], undefined);
  assert.ok(hit && !/[؀-ۿ]/.test(hit.name));
});
