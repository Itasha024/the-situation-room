import assert from "node:assert/strict";
import test from "node:test";

import { BASELINE, mergeNumbers } from "./numbers.ts";
import { TALLY_SEED, type Claims } from "./tally.ts";

test("a newer live figure replaces the baseline; an older one does not", () => {
  const t = structuredClone(TALLY_SEED);
  t.killed.total = 700;
  t.from["killed.total"] = { name: "United Nations", url: "https://x/un", date: "2026-09-21" };
  assert.equal(mergeNumbers(t, null).cells["killed.total"].official?.value, 674);
  t.from["killed.total"].date = "2026-09-26";
  assert.equal(mergeNumbers(t, null).cells["killed.total"].official?.value, 700);
});

test("the same figure without a link takes the linked record", () => {
  const n = mergeNumbers(TALLY_SEED, null);
  assert.equal(n.cells["injured.saudi"].official?.value, 73);
  assert.match(String(n.cells["injured.saudi"].official?.url), /aljazeera/);
});

test("a claim filed under the wrong side moves to its own side; a battle's toll is not a total", () => {
  const claims: Claims = {
    updatedAt: "2026-09-24T21:00:00Z",
    fields: {
      "killed.houthi": { houthi: { value: 900, name: "Erem News", url: "https://erem/x", date: "2026-09-26" } },
      "killed.gov": { houthi: { value: 9, name: "Mohammed Abdulsalam", url: "https://t.me/a/1", date: "2026-09-23" } },
    },
  };
  const n = mergeNumbers(TALLY_SEED, claims);
  assert.equal(n.cells["killed.houthi"].houthi?.value, 693);
  assert.equal(n.cells["killed.houthi"].gov?.value, 900);
  assert.equal(n.cells["killed.gov"]?.houthi, undefined);
});

test("official single figures stay, however small", () => {
  assert.equal(mergeNumbers(TALLY_SEED, null).cells["killed.saudi"].official?.value, 1);
});

test("every baseline cell names its source, a date and a link", () => {
  for (const row of Object.values(BASELINE.cells)) {
    for (const cell of Object.values(row)) {
      assert.ok(cell?.name && cell.url.startsWith("https://") && /^\d{4}-\d\d-\d\d$/.test(cell.date));
    }
  }
});
