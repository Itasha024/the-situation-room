import { test } from "node:test";
import assert from "node:assert/strict";
import { kindIn, pickHit } from "./geocode.ts";
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
  const rows = [
    { lat: "13.3", lon: "44.2", name: "Az Zahir" },
    { lat: "17.2", lon: "43.4", name: "Az Zahir" },
  ];
  assert.equal(pickHit(rows, undefined), null);
});

test("the one district of that name is taken when the text says district", () => {
  const text = "قصف مدفعي على مناطق مأهولة في مديرية الظاهر وأجزاء من مديرية حيدان";
  const kinds = kindIn(text, "الظاهر");
  assert.deepEqual(kinds, ["district", "county"]);
  const hit = pickHit(
    [
      { lat: "15.07", lon: "43.60", name: "Az Zahir", addresstype: "hamlet" },
      { lat: "16.69", lon: "43.28", name: "Al Dhaher district", addresstype: "district" },
      { lat: "14.03", lon: "44.17", name: "Az Zahir", addresstype: "village" },
    ],
    undefined,
    kinds,
  );
  assert.equal(hit?.lat, 16.69);
});

test("an Arabic answer name is rendered in English", () => {
  const hit = pickHit([{ lat: "13.33", lon: "44.27", name: "حيفان" }], undefined);
  assert.ok(hit && !/[؀-ۿ]/.test(hit.name));
});
