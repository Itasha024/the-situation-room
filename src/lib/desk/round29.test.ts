import { test } from "node:test";
import assert from "node:assert/strict";
import { captureConfirmed, tookGround } from "./control-live.ts";
import { cardMarks, kindOf } from "./dev-marks.ts";
import { withBaseline } from "./ledger.ts";
import { LEDGER_BASELINE } from "./ledger-baseline.ts";

/* Round 29: the user's review of 3 Oct. */

const card = (fp: string, source: string, summary: string, lat: number, lng: number, extra: Record<string, unknown> = {}) =>
  ({ fp, source, summary, lat, lng, live: true, text: "", type: "combat", url: `https://x/${fp}`, at: "2026-10-03T05:00:00Z", ...extra }) as never;
const both = { alsoReportedBy: [{ source: "Al-Masirah", url: "https://t.me/almasirah2/1" }] };

test("a flag of ground taken needs the whole district, as control does (user, 3 Oct)", () => {
  // The whole district, told by both sides: a flag.
  assert.equal(captureConfirmed(card("a", "Al Arabiya", "Government forces take full control of Al-Hazm district after heavy fighting", 16.2, 44.8, both)), true);
  // A town, a hill or a district centre, even told by both sides: an advance.
  assert.equal(captureConfirmed(card("b", "Al Arabiya", "Government forces capture the town of Al-Hazm", 16.2, 44.8, both)), false);
  assert.equal(captureConfirmed(card("c", "Al Arabiya", "Government forces seize hills overlooking Al-Hazm", 16.2, 44.8, both)), false);
  // One side's word of the whole district: still an advance.
  assert.equal(captureConfirmed(card("d", "Al Arabiya", "Government forces take full control of Al-Hazm district", 16.2, 44.8)), false);
  // Not a combat report: no flag.
  assert.equal(captureConfirmed(card("e", "Al Arabiya", "Government forces take full control of Al-Hazm district", 16.2, 44.8, { ...both, type: "strike" })), false);
});

test("seized weapons, boats or a building are no ground taken", () => {
  assert.equal(tookGround("Coast guard seizes weapons bound for the Houthis off Mocha"), false);
  assert.equal(tookGround("Houthi forces seize Al-Juba hospital in Marib for military use"), false);
  assert.equal(tookGround("Government forces seize Jabal Habashi"), true);
  assert.notEqual(kindOf(card("f", "Almashhad", "Coast guard seizes weapons bound for the Houthis off Mocha", 13.3, 43.2)), "capture");
  assert.equal(kindOf(card("g", "Almashhad", "Government forces seize Jabal Habashi", 13.5, 43.8)), "capture");
});

test("the developments' maps draw a town taken as an advance, the whole district as ground taken", () => {
  const { all } = cardMarks(
    [
      card("h", "Al Arabiya", "Government forces capture the town of Al-Hazm", 16.2, 44.8, both),
      card("i", "Al Arabiya", "Government forces take full control of Al-Hazm district", 16.2, 44.8, both),
    ],
    () => [],
  );
  assert.deepEqual(all.map((m) => m.kind).sort(), ["advance", "capture"]);
});

test("the hand-checked maritime row keeps its words over a stored copy: two dhow boats", () => {
  const base = LEDGER_BASELINE.ships.find((s) => s.id === "2026-08-14-mocha-dhows");
  assert.ok(base);
  assert.match(base.type ?? "", /two dhow boats/);
  const stored = { ...structuredClone(LEDGER_BASELINE), ships: [{ ...structuredClone(base), type: "two dhows and fishing boats" }], sites: [], figures: [], notices: [] };
  const got = withBaseline(stored as never).ships.find((s) => s.id === "2026-08-14-mocha-dhows");
  assert.equal(got?.type, "two dhow boats and fishing boats");
});

test("6 Oct: a peak and positions taken are advances, and Nation's Shield is the government's", () => {
  const aj = { alsoReportedBy: [{ source: "Al Jazeera", url: "https://t.me/AjaNews/515696" }] };
  const { all } = cardMarks(
    [
      card("j", "Nation's Shield", "Nation's Shield forces seize Jabal Habashi peak in Taiz", 13.52, 43.83, { place: "Jabal Habashi", ...aj }),
      card("k", "Yemeni Army Media", "Nation's Shield forces capture strategic positions in Al-Wazi'iyah, Taiz", 13.18, 43.75, { place: "Al-Wazi'iyah", ...aj }),
    ],
    () => [],
  );
  assert.deepEqual(all.map((m) => [m.kind, m.side]), [["advance", "government"], ["advance", "government"]]);
});
