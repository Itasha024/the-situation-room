import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLedger, figureInText, LEDGER_SEED, nameInText, siteOf } from "./ledger.ts";

const now = new Date("2026-09-30T15:00:00Z");
const doc = (text: string, date = "2026-09-30", name = "Reuters") => ({ name, url: `https://example.com/${date}/${name}`, date, text });

test("a ledger figure stands only when its digits are in the text", () => {
  assert.equal(figureInText("Saudi exports from Yanbu reached 1.2 million barrels a day", 1.2), true);
  assert.equal(figureInText("exports of 1,200,000 barrels a day", 1200000), true);
  assert.equal(figureInText("Some 31 ships crossed Bab al-Mandab", 31), true);
  assert.equal(figureInText("Some 312 ships crossed", 31), false);
  assert.equal(figureInText("exports rose sharply", 5), false);
});

test("a ship or a site is named in the text, whatever a report calls it", () => {
  assert.equal(nameInText("The M/V Eternity C was hit off Hodeidah", "Eternity C"), true);
  assert.equal(nameInText("A tanker was hit off Hodeidah", "Eternity C"), false);
  assert.equal(siteOf("pumping station 8 on the East-West line")?.id, "east-west-pipeline");
  assert.equal(siteOf("SAMREF refinery")?.id, "yanbu");
  assert.equal(siteOf("some plant", "refinery", "Oman"), null);
});

test("the ledger: one row per incident and site, the latest status stands, nothing the text does not say", () => {
  const docs = [
    doc("UKMTO: a tanker was hit by a projectile 40 nm west of Hodeidah; the crew are safe."),
    doc("The Liberian-flagged tanker Sea Crest was struck west of Hodeidah, the Houthis said.", "2026-09-30", "AP"),
    doc("Drones hit pump station 8 on the East-West pipeline; pumping was halted.", "2026-09-29", "Reuters"),
    doc("Aramco said pumping on the East-West pipeline resumed after repairs.", "2026-09-30", "Aramco"),
    doc("Saudi crude exports from Yanbu reached 1.2 million barrels a day in September.", "2026-09-30", "Kpler"),
  ];
  const next = applyLedger(
    LEDGER_SEED,
    {
      ships: [
        { doc: 0, date: "2026-09-30", place: "40 nm west of Hodeidah", what: "hit", type: "tanker" },
        { doc: 1, date: "2026-09-30", ship: "Sea Crest", flag: "Liberia", place: "west of Hodeidah", what: "hit", attacker: "Houthis" },
        // A name the text never wrote: refused.
        { doc: 0, date: "2026-09-30", ship: "Ocean Star", place: "off Mocha", what: "attacked" },
      ],
      sites: [
        { doc: 2, site: "pump station 8", country: "Saudi Arabia", hit: true, status: "down" },
        { doc: 3, site: "East-West pipeline", country: "Saudi Arabia", status: "working" },
        // Its older report comes later in the list and does not undo the newer one.
        { doc: 2, site: "East-West pipeline", country: "Saudi Arabia", hit: true, status: "down" },
      ],
      figures: [
        { doc: 4, cat: "energy", label: "Saudi crude exports from Yanbu", value: 1.2, unit: "million barrels a day" },
        { doc: 4, cat: "energy", label: "Saudi crude exports in total", value: 7, unit: "million barrels a day" },
      ],
    },
    docs,
    now,
  );
  assert.equal(next.ships.length, 1, "the unnamed tanker off Hodeidah is the Sea Crest; Ocean Star refused");
  assert.ok(next.ships.some((s) => s.ship === "Sea Crest" && s.attacker === "Houthis"));
  assert.equal(next.sites.length, 1);
  const pipe = next.sites[0];
  assert.equal(pipe.id, "east-west-pipeline");
  assert.equal(pipe.hits.length, 1, "one hit a day");
  assert.equal(pipe.status, "working");
  assert.equal(pipe.statusSrc?.name, "Aramco");
  assert.deepEqual(next.figures.map((f) => f.value), [1.2]);
  // Read again: nothing doubles.
  const again = applyLedger(next, { ships: [{ doc: 1, date: "2026-09-30", ship: "Sea Crest", place: "west of Hodeidah", what: "sunk" }] }, docs, now);
  assert.equal(again.ships.length, 1);
  assert.equal(again.ships.find((s) => s.ship === "Sea Crest")?.what, "sunk", "a later report can say more");
});
