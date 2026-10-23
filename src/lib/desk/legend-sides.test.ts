/*
 * Every pin colour on the three maps has a row in its legend (user, 18 Oct: the Yemen pin "Southern forces
 * seize Al-Aradi hill in Bab al-Mandab" was purple, and the Yemen legend's Who had no purple row).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { yemenPinSide } from "./dev-marks.ts";

const app = fs.readFileSync(new URL("../../../public/app.js", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../../../public/home.js", import.meta.url), "utf8");

function yemenBlock() {
  const from = app.indexOf("const YEMEN_PIN_SIDES = () =>");
  const end = app.indexOf("\n}\n", app.indexOf("function yemenSideRows(")) + 3;
  assert.ok(from > 0 && end > from);
  const ctx: Record<string, unknown> = {
    COLORS: { houthi: "#h", plc: "#p", saudi: "#s" },
    sideLegendRow: (c: string, n: string, on: boolean, attr: string) => `<row ${attr} c="${c}" on="${on}">${n}</row>`,
  };
  vm.createContext(ctx);
  vm.runInContext(`${app.slice(from, end)}\nthis.out = { YEMEN_PIN_SIDES, yemenSideOf, yemenSideRows, YEMEN_GROUND_SIDES, yemenSidesOn };`, ctx);
  return ctx.out as any;
}

test("Yemen legend: every side with a pin has a Who row of its colour, on the desk and the All page", () => {
  const y = yemenBlock();
  const sides: [string, string, string][] = y.YEMEN_PIN_SIDES();
  // The ground's rows carry the colours of the Houthis', the government's and the Saudi pins.
  const ground: Record<string, string> = { houthi: "#h", government: "#p", saudi: "#s" };
  for (const [k, c] of sides) if (y.YEMEN_GROUND_SIDES.includes(k)) assert.equal(c, ground[k], k);
  for (const [k, c, n] of sides) {
    const side = y.yemenSideOf({ actor: k });
    assert.equal(side, k);
    if (y.YEMEN_GROUND_SIDES.includes(k)) continue;
    const rows = y.yemenSideRows(new Set([side]));
    assert.ok(rows.includes(`data-side="${k}"`) && rows.includes(`c="${c}"`) && rows.includes(n), `${k} has a row`);
  }
  // Only the sides on the map.
  assert.equal(y.yemenSideRows(new Set(["houthi"])), "");
  assert.ok(!y.yemenSideRows(new Set(["israel"])).includes("data-side=\"us\""));
  // The Southern forces are the government's side, with no colour or row of their own (user, 20 Oct).
  assert.equal(y.yemenSideOf({ actor: "stc" }), "government");
  assert.equal(y.yemenSideOf({ actor: "southern" }), "government");
  assert.ok(!sides.some(([k]) => k === "southern"));
  assert.ok(!/#c084fc/i.test(app.slice(app.indexOf("const YEMEN_PIN_SIDES"), app.indexOf("const yemenSidesOn"))));
  assert.equal(y.yemenSideOf({ actor: "who" }), "unclear");
  // Both legends draw the rows.
  assert.match(app, /\$\{yemenSideRows\(yemenSidesSeen\)\}/);
  assert.match(home, /A\('yemenSideRows'\)\(seen\)/);
});

test("the served Yemen pin: the Southern forces' pins are the government's (user, 20 Oct)", () => {
  assert.equal(yemenPinSide({ label: "Forces seize Al-Aradi hill in Bab al-Mandab", place: "Bab al-Mandab", lat: 12.6, lng: 43.4, actor: "stc" }), "government");
  assert.equal(yemenPinSide({ label: "Southern forces seize Al-Aradi hill in Bab al-Mandab", place: "Bab al-Mandab", lat: 12.6, lng: 43.4, actor: "unclear" }), "government");
  assert.equal(yemenPinSide({ label: "Shabwa Defense Forces: drones strike Houthi positions in Ayn, Harib, Bayhan and Marakha Al-Olaya fronts", place: "Harib", lat: 15.0, lng: 45.4, actor: "stc" }), "government");
  // Their air defence meets a Houthi drone: the Houthis' (20 Oct, Aden).
  assert.equal(yemenPinSide({ label: "Southern forces anti-aircraft units engage drone over Maasheq Palace in Crater in Aden", place: "Aden", lat: 12.78, lng: 45.03, actor: "stc" }), "houthi");
});

test("Iran legend: every side a pin can take has a Who row, Not stated when such pins are shown", () => {
  // A let since the Gaza desk swaps in its own sides (user, 23 Oct).
  const from = app.indexOf("let IRAN_PIN_SIDES = [");
  const end = app.indexOf("];", from) + 2;
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  vm.runInContext(`${app.slice(from, end)}\nconst IRAN_PIN_INK = Object.fromEntries(IRAN_PIN_SIDES.map(([k, c]) => [k, c]));\n${/const iranSideOf = .*;/.exec(app)![0]}\nthis.out = { IRAN_PIN_SIDES, iranSideOf };`, ctx);
  const { IRAN_PIN_SIDES, iranSideOf } = ctx.out as any;
  const keys = new Set(IRAN_PIN_SIDES.map(([k]: string[]) => k));
  // Any stored actor, the Yemen desk's sides included, lands on a side with a row.
  for (const a of ["iran", "hezbollah", "iraqi_militias", "houthi", "us", "israel", "gulf", "unclear", "government", "saudi", "southern", "stc", null]) assert.ok(keys.has(iranSideOf({ actor: a })), String(a));
  // The desk's and the All page's legends leave out only "Not stated", and only with no such pin.
  assert.match(app, /IRAN_PIN_SIDES\.filter\(\(\[k\]\) => k !== 'other' \|\| counts\.other\)/);
  assert.match(home, /IRAN_PIN_SIDES'\) \|\| \[\]\)\.filter\(\(\[k\]\) => k !== 'other' \|\| D\.events\.some/);
});

test("Gaza legend: every side the reader can name has a Who row (user, 23 Oct)", async () => {
  const { GAZA_SIDES } = await import("./gaza-reader.ts");
  const from = app.indexOf("const GAZA_PIN_SIDES = [");
  const end = app.indexOf("];", from) + 2;
  const ctx: Record<string, unknown> = {};
  vm.createContext(ctx);
  vm.runInContext(`${app.slice(from, end)}\nthis.out = GAZA_PIN_SIDES;`, ctx);
  const keys = new Set((ctx.out as string[][]).map(([k]) => k));
  for (const s of GAZA_SIDES) if (s !== "unclear") assert.ok(keys.has(s), s);
  assert.ok(keys.has("other"));
});
