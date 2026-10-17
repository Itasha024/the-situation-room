/**
 * The numbers' misses found on 17 Oct (user: "find the things the desk didnt pick
 * and fix the mechanisms"), each from a real card of 3–17 Oct.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { mergeNumbers } from "./numbers.ts";
import { applyClaims, applyUpdates, CLAIMS_SEED, hasNumber, TALLY_SEED, type Claims } from "./tally.ts";
import { applyLedger, LEDGER_DOCS, ledgerDocs, offYemenShip, siteOf, withBaseline, type Ledger } from "./ledger.ts";
import type { LiveReport } from "./types.ts";

const NOW = new Date("2026-10-17T12:00:00Z");

test("a figure stands only when the card it cites holds it (8 cells cited a Khabar card of one battle)", () => {
  const docs = [
    { name: "Khabar", url: "https://khabaragency.net/news254418.html", date: "2026-10-16", text: "Fierce battles in Hays: 700 casualties among Houthi fighters, government forces say." },
    { name: "Al-Masirah", url: "https://t.me/almasirah/1", date: "2026-10-16", text: "وزارة الصحة: ١٢٤ شهيداً و٣٢٧ جريحاً منذ 3 سبتمبر" },
  ];
  const c = applyClaims(CLAIMS_SEED, [
    { field: "killed.civilians", by: "houthi", value: 72, source: "Ministry of Health and Environment", doc: 0 },
    { field: "killed.houthi", by: "houthi", value: 124, source: "Ministry of Health", doc: 1 },
    { field: "injured.houthi", by: "houthi", value: 327, source: "Ministry of Health", doc: 1 },
  ], docs, NOW);
  assert.equal(c.fields["killed.civilians"], undefined, "72 is not in the card");
  assert.equal(c.fields["killed.houthi"]?.houthi?.value, 124, "Arabic digits are read");
  assert.equal(c.fields["injured.houthi"]?.houthi?.value, 327);
  const t = applyUpdates(TALLY_SEED, [{ field: "killed.total", value: 959, source: "UN health cluster", doc: 0 }], docs, NOW);
  assert.equal(t.killed.total, TALLY_SEED.killed.total, "959 is not in the card");
});

test("figures as cards write them", () => {
  assert.ok(hasNumber("IOM: 217,303 people displaced", 217303));
  assert.ok(hasNumber("over 233 thousand displaced", 233000));
  assert.ok(hasNumber("أكثر من ٢٣٣ ألف نازح", 233000));
  assert.ok(!hasNumber("1,282 killed", 128));
  assert.ok(!hasNumber("12.5 percent", 12));
});

test("Saudi Arabia's 19 dead stand, though under 20 (coalition, 15 Oct)", () => {
  const claims: Claims = { fields: { "killed.saudi": { gov: { value: 19, name: "Saudi-led coalition", url: "https://www.arabnews.com/node/1", date: "2026-10-15" } } }, updatedAt: NOW.toISOString() };
  assert.equal(mergeNumbers(null, claims).cells["killed.saudi"].gov?.value, 19);
  // A side's 12 for the Houthis is still a day's toll, not a total.
  const small: Claims = { fields: { "killed.houthi": { gov: { value: 12, name: "Saudi-led coalition", url: "u", date: "2026-10-15" } } }, updatedAt: NOW.toISOString() };
  assert.notEqual(mergeNumbers(null, small).cells["killed.houthi"]?.gov?.value, 12);
});

test("one day's toll from another voice does not replace a running count (26 over 251, 2 Oct)", () => {
  const claims: Claims = {
    fields: {
      "killed.gov": { gov: { value: 26, name: "Sawt al-Asima", url: "https://t.me/sawt/1", date: "2026-10-02" } },
      "killed.civilians": { gov: { value: 60, name: "Yemeni Network for Rights and Freedoms", url: "u2", date: "2026-10-01" } },
    },
    updatedAt: NOW.toISOString(),
  };
  const base = structuredClone((await_base()));
  base.cells["killed.gov"] = { gov: { value: 251, name: "Fares al-Hemyari", url: "https://x.com/f/1", date: "2026-09-28" } };
  const n = mergeNumbers(null, claims, base);
  assert.equal(n.cells["killed.gov"].gov?.value, 251);
  // The same voice's newer, bigger count moves it; a newer count above half moves it too.
  assert.equal(n.cells["killed.civilians"].gov?.value, 60);
});

function await_base() {
  return { asOf: "2026-09-25", cells: { "killed.civilians": { gov: { value: 51, name: "Yemeni Network for Rights and Freedoms", url: "u1", date: "2026-09-17" } } } } as Parameters<typeof mergeNumbers>[2] & object;
}

test("ships off the Gulf coast or 'near the strait' of a Hormuz card are the Iran war's", () => {
  assert.ok(offYemenShip("78 nm east of Al Jubayl", ""));
  assert.ok(offYemenShip("eastern coast of Saudi Arabia", ""));
  assert.ok(offYemenShip("near the strait", "Two ships sunk near the Strait of Hormuz after Iranian drone strikes, Reuters says"));
  assert.ok(!offYemenShip("near the strait", "A ship was attacked near the strait of Bab al-Mandab, UKMTO says"));
  assert.ok(!offYemenShip("60 nautical miles south of Mocha, Yemen", "Iran's ally the Houthis"));
  const docs = [{ name: "Reuters", url: "https://reuters.com/x", date: "2026-10-14", text: "Two ships sunk near the Strait of Hormuz after Iranian drone strikes" }];
  const l: Ledger = { since: "2026-07-13", ships: [], sites: [], figures: [], notices: [], updatedAt: "" };
  const next = applyLedger(l, { ships: [{ doc: 0, place: "near the strait", what: "sunk" }] } as never, docs, NOW);
  assert.equal(next.ships.length, 0);
  const stored = withBaseline({ ...l, ships: [{ id: "x", date: "2026-10-17", place: "eastern coast of Saudi Arabia", what: "hit", src: { name: "UKMTO", url: "u", date: "2026-10-17" } }] });
  assert.ok(!stored.ships.some((s) => s.id === "x"), "a row stored before the rule leaves too");
});

test("one Dhahran hit is one row, whatever each outlet called it (13 Oct, ten rows)", () => {
  const names = ["Aramco headquarters in Dhahran", "Aramco HQ in Dhahran", "Aramco administrative building in Dhahran", "Saudi Aramco headquarters", "Aramco's Dhahran headquarters", "Dhahran headquarters"];
  assert.deepEqual([...new Set(names.map((n) => siteOf(n, "", "Saudi Arabia")?.id))], ["dhahran-aramco"]);
  assert.equal(siteOf("Al-Sabaha oil station in Sanaa", "", "Yemen")?.id, "sabaha-sanaa");
  assert.equal(siteOf("oil company station in Bajil district, Hodeidah", "", "Yemen")?.id, "bajil-fuel");
  assert.equal(siteOf("Shadqam gas plant", "", "Saudi Arabia")?.id, "shedgum");
  const l: Ledger = {
    since: "2026-07-13", ships: [], figures: [], notices: [], updatedAt: "",
    sites: names.map((n, i) => ({ id: `s${i}`, name: n, kind: "site", country: "Saudi Arabia" as const, status: "unknown" as const, hits: [{ name: "x", url: `u${i}`, date: i < 4 ? "2026-10-13" : "2026-10-14" }] })),
  };
  const rows = withBaseline(l).sites.filter((s) => s.id === "dhahran-aramco");
  assert.equal(rows.length, 1);
});

test("a busy day's sea and energy cards are all read, not the newest 30 (5 Oct: 73 unread)", () => {
  const cards = Array.from({ length: 80 }, (_, i) => ({ at: new Date(Date.parse("2026-10-05T00:00:00Z") + i * 60_000).toISOString(), source: "UKMTO", url: `u${i}`, summary: `Tanker attacked off Hodeidah ${i}` }) as unknown as LiveReport);
  assert.ok(LEDGER_DOCS >= 80);
  assert.equal(ledgerDocs(cards).length, 80);
});
