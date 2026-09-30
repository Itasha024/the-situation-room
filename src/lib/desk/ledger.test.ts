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

test("the research baseline sits under the stored ledger; a stored row wins; a Houthi-only report is a claim", async () => {
  const { withBaseline, groupOf, parseFredCsv } = await import("./ledger.ts");
  const { LEDGER_BASELINE } = await import("./ledger-baseline.ts");
  const merged = withBaseline(LEDGER_SEED);
  assert.equal(merged.ships.length, LEDGER_BASELINE.ships.length);
  assert.ok(merged.sites.some((s) => s.id === "east-west-pipeline" && s.status === "reduced"));
  // Every baseline row links its report, and no Israeli outlet.
  const urls = [...LEDGER_BASELINE.ships.map((s) => s.src.url), ...LEDGER_BASELINE.sites.flatMap((s) => s.hits.map((h) => h.url)), ...LEDGER_BASELINE.figures.map((f) => f.src.url), ...LEDGER_BASELINE.notices.map((n) => n.src.url)];
  assert.ok(urls.every((u) => /^https:\/\//.test(u)));
  assert.ok(!urls.some((u) => /timesofisrael|jpost|haaretz|ynet|i24|israelhayom|kan\.org/.test(u)));
  // A stored row of the same id wins over the baseline's.
  const stored = { ...LEDGER_SEED, ships: [{ ...LEDGER_BASELINE.ships[0], what: "sunk" as const }] };
  assert.equal(withBaseline(stored).ships.find((s) => s.id === LEDGER_BASELINE.ships[0].id)?.what, "sunk");
  // A new hit reported only by the Houthis' outlets is their claim; a wire's report lifts it.
  const docs = [doc("Al-Masirah: Houthi drones hit the Aramco refinery in Jazan.", "2026-10-01", "Al-Masirah"), doc("Reuters: a fire broke out at Aramco's Jazan refinery after a drone strike.", "2026-10-01", "Reuters")];
  const one = applyLedger(merged, { sites: [{ doc: 0, site: "Jazan refinery", country: "Saudi Arabia", hit: true }] }, docs, now);
  assert.equal(one.sites.find((s) => s.id === "jazan")?.hits.find((h) => h.date === "2026-10-01")?.claim, true);
  const two = applyLedger(one, { sites: [{ doc: 1, site: "Jazan refinery", country: "Saudi Arabia", hit: true }] }, docs, now);
  assert.ok(!two.sites.find((s) => s.id === "jazan")?.hits.find((h) => h.date === "2026-10-01")?.claim);
  // A month's figure never overwrites another month's.
  const f = applyLedger(LEDGER_SEED, { figures: [{ doc: 0, cat: "maritime", label: "Oil through Bab al-Mandab", value: 2.5, unit: "million barrels a day", period: "October" }] }, [doc("Oil through Bab al-Mandab fell to 2.5 million barrels a day in October.")], now);
  assert.equal(withBaseline(f).figures.filter((x) => x.label === "Oil through Bab al-Mandab").length, 4);
  assert.equal(f.figures[0].group, "oil");
  assert.equal(groupOf("maritime", "War-risk insurance 3% of value"), "cost");
  assert.equal(groupOf("maritime", "Ships crossing Bab al-Mandab"), "traffic");
  assert.equal(groupOf("energy", "Brent crude $105 a barrel"), "prices");
  assert.deepEqual(parseFredCsv("observation_date,DCOILBRENTEU\n2026-09-21,116.15\n2026-09-22,.\n"), [{ date: "2026-09-21", value: 116.15 }]);
});
