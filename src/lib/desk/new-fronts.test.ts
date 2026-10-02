import assert from "node:assert/strict";
import test from "node:test";
import { updateExtraFronts, whereOf, type ExtraFront } from "./new-fronts.ts";
import { cleanProse } from "./prose.ts";
import { repelAttacker } from "./dev-marks.ts";

const now = new Date("2026-09-22T00:00:00Z");
const r = (i: number, source: string, place = "Al-Bayda", lat = 13.99, lng = 45.57, hoursAgo = 3) =>
  ({ fp: `f${i}`, source, place, lat, lng, type: "combat", summary: `clash ${i}`, text: "", url: "u", at: new Date(now.getTime() - hoursAgo * 3600_000).toISOString() }) as never;

test("a cluster of fighting no tracked front covers opens a front", () => {
  const reports = [r(1, "A"), r(2, "B"), r(3, "A", "Al-Bayda", 14.02, 45.6), r(4, "C")];
  const out = updateExtraFronts(reports, [], () => false, now);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Al-Bayda");
  assert.equal(out[0].id, "x-al-bayda");
});

test("too few reports, one outlet, or a covered place opens nothing", () => {
  assert.equal(updateExtraFronts([r(1, "A"), r(2, "B"), r(3, "A")], [], () => false, now).length, 0);
  assert.equal(updateExtraFronts([r(1, "A"), r(2, "A"), r(3, "A"), r(4, "A")], [], () => false, now).length, 0);
  assert.equal(updateExtraFronts([r(1, "A"), r(2, "B"), r(3, "A"), r(4, "C")], [], () => true, now).length, 0);
});

test("an opened front closes after a quiet week", () => {
  const old: ExtraFront = { id: "x-al-bayda", name: "Al-Bayda", spot: [13.99, 45.57], places: ["Al-Bayda"], openedAt: "2026-09-01T00:00:00Z", lastActiveAt: "2026-09-14T00:00:00Z" };
  assert.equal(updateExtraFronts([], [old], () => false, now).length, 0);
  assert.equal(updateExtraFronts([r(1, "A")], [old], () => false, now)[0].lastActiveAt > old.lastActiveAt, true);
});

test("prose that mentions the desk or logging is thrown out", () => {
  assert.equal(cleanProse("The desk logged 12 strikes in the 12 hours to midnight across the fronts.", 5), "");
  assert.ok(cleanProse("Saudi jets struck Houthi positions in Al-Jawf, the Houthis said. Fighting continued west of Taiz.", 5).startsWith("Saudi jets"));
});

test("prose names people by role", () => {
  const t = cleanProse("Houthi spokesperson Brigadier General Yahya Saree said Saudi forces carried out 157 strikes. Abdul Malik al-Houthi said the war would widen.", 5);
  assert.equal(t, "The Houthi Armed Forces spokesperson said Saudi forces carried out 157 strikes. The Houthi leader said the war would widen.");
});

test("the prose never writes about what was not reported; the rest of the paragraph stands", () => {
  const t = cleanProse("No new fighting was reported on the Taiz front. Government forces hold the city's western approaches after last week's advance.", 4);
  assert.equal(t, "Government forces hold the city's western approaches after last week's advance.");
  assert.equal(cleanProse("No fighting was reported in Marib over the period in question at all.", 4), "");
  assert.equal(cleanProse("One. Two strikes hit Saada. Three were reported. Four more. Five here.", 3).split(". ").length, 3);
});

test("two clusters in one governorate are one front with two spots; in two governorates, two fronts", () => {
  // Saada: Razih (16.93, 43.25) and Kitaf (17.02, 44.02), ~80 km apart.
  const razih = [r(1, "A", "Razih", 16.93, 43.25), r(2, "B", "Razih", 16.94, 43.26), r(3, "A", "Razih", 16.92, 43.24), r(4, "C", "Razih", 16.93, 43.25)];
  const kitaf = [r(5, "A", "Kitaf", 17.02, 44.02), r(6, "B", "Kitaf", 17.03, 44.03), r(7, "C", "Kitaf", 17.01, 44.01), r(8, "A", "Kitaf", 17.02, 44.02)];
  const one = updateExtraFronts([...razih, ...kitaf], [], () => false, now);
  assert.equal(one.length, 1);
  assert.equal(one[0].spots?.length, 2);
  assert.equal(one[0].name, "Saada");
  assert.deepEqual(one[0].places.sort(), ["Kitaf", "Razih"]);
  // Al-Bayda's cluster is another governorate: its own front.
  const two = updateExtraFronts([...razih, r(9, "A"), r(10, "B"), r(11, "A", "Al-Bayda", 14.02, 45.6), r(12, "C")], [], () => false, now);
  assert.equal(two.length, 2);
  // Fronts stored before merging, two in Saada, become one.
  const stored = updateExtraFronts([], [
    { id: "x-razih", name: "Razih", spot: [16.93, 43.25], places: ["Razih"], openedAt: "2026-09-20T00:00:00Z", lastActiveAt: "2026-09-21T00:00:00Z" },
    { id: "x-kitaf", name: "Kitaf", spot: [17.02, 44.02], places: ["Kitaf"], openedAt: "2026-09-21T00:00:00Z", lastActiveAt: "2026-09-21T12:00:00Z" },
  ], () => false, now);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].spots?.length, 2);
});

test("an opened front says where it is, as the hand-written fronts do", () => {
  const f: ExtraFront = { id: "x-al-dhaher", name: "Saada", spot: [16.95, 43.6], gov: "YE-SD", places: ["Al-Dhaher", "Razih", "Saada"], openedAt: "", lastActiveAt: "" };
  assert.equal(whereOf(f), "Saada governorate, the Houthis' northern heartland on the Saudi border: around Al-Dhaher and Razih");
  assert.equal(whereOf({ ...f, gov: "YE-XX", places: ["Brom"] }), "Around Brom");
});

import { cleanDevMap } from "./prose.ts";
import { placeFinder, proseDue } from "./brief-store.ts";

test("the developments map keeps only places the text names, with known kinds and sides", () => {
  const text = "Houthi forces captured Jabal al-Bazilah in Taiz. A Houthi drone struck Jazan airport.";
  const out = cleanDevMap(
    [
      { place: "Jabal al-Bazilah", kind: "capture", side: "Houthi" },
      { place: "Jazan", kind: "drone", side: "houthi", from: "Saada" },
      { place: "Marib", kind: "fighting", side: "government" },
      { place: "Taiz", kind: "parade", side: "houthi" },
      { place: "Taiz", kind: "shelling", side: "aliens" },
    ],
    text,
  );
  assert.deepEqual(out.map((m) => `${m.place}/${m.kind}/${m.side}/${m.from ?? ""}`), ["Jabal al-Bazilah/capture/houthi/", "Jazan/drone/houthi/Saada"]);
});

test("a long overview is cut at a whole sentence, and a sentence about the desk drops alone", () => {
  const long = Array.from({ length: 12 }, (_, i) => `Houthi forces shelled government positions near village number ${i + 1} in western Taiz.`).join(" ");
  const t = cleanProse(long, 4, true, 300);
  assert.ok(t.length > 0 && t.length <= 300 && t.endsWith("."));
  assert.equal(cleanProse("The desk logged 12 strikes. Saudi jets struck Houthi positions in Al-Jawf, the Houthis said.", 4), "Saudi jets struck Houthi positions in Al-Jawf, the Houthis said.");
});

test("vague main-development lines drop, a front's paragraph keeps its words", () => {
  const t = cleanProse("Intense fighting spans multiple fronts. Houthi forces captured Kahbub in Lahj.", 5, true);
  assert.equal(t, "Houthi forces captured Kahbub in Lahj.");
});

test("a map place finds its spot by name, or by the longest name inside it", () => {
  const find = placeFinder({ Marib: [15.4, 45.3], "Jabal al-Qarnaynah": [13.2, 43.7] });
  assert.deepEqual(find("Marib city"), [15.4, 45.3]);
  assert.deepEqual(find("Jabal Al-Qarnaynah"), [13.2, 43.7]);
  assert.equal(find("Nowhere"), null);
});

test("prose by a fallback model is asked again every 10 minutes for two hours, then every 20 until the next update", () => {
  const b = { updatedAt: "2026-09-29T09:00:00.000Z", nextUpdateAt: "2026-09-29T15:00:00.000Z", situation: { line: "x", quiet: false, model: "openai/gpt-oss-20b" } } as never;
  assert.equal(proseDue(b, new Date("2026-09-29T09:05:00Z")), true);
  assert.equal(proseDue({ ...(b as object), proseTriedAt: "2026-09-29T09:05:00Z" } as never, new Date("2026-09-29T09:10:00Z")), false);
  assert.equal(proseDue(b, new Date("2026-09-29T10:05:00Z")), true);
  assert.equal(proseDue(b, new Date("2026-09-29T11:05:00Z")), true);
  assert.equal(proseDue({ ...(b as object), proseTriedAt: "2026-09-29T12:00:00Z" } as never, new Date("2026-09-29T12:15:00Z")), false);
  assert.equal(proseDue({ ...(b as object), proseTriedAt: "2026-09-29T12:00:00Z" } as never, new Date("2026-09-29T12:21:00Z")), true);
  assert.equal(proseDue(b, new Date("2026-09-29T14:57:00Z")), false);
  assert.equal(proseDue({ ...(b as object), situation: { line: "x", quiet: false, model: "gemini-3.8-flash" } } as never, new Date("2026-09-29T09:05:00Z")), false);
});

test("a repelled attack is drawn from the attacker's side", () => {
  const text = "Government forces repelled Houthi infiltration attempts in Al-Aghbara. Houthi forces repelled an attack on Harib.";
  const out = cleanDevMap([{ place: "Al-Aghbara", kind: "repelled", side: "government" }, { place: "Harib", kind: "repelled", side: "houthi" }], text);
  assert.deepEqual(out.map((m) => m.side), ["houthi", "government"]);
});

test("the writer's paragraphs are kept, and the sentence cap runs across them", () => {
  const t = "Houthi forces captured Jabal al-Bazilah in Taiz. Government forces shelled Al-Wazi'iyah.\n\nA Houthi drone struck Jazan airport.";
  assert.equal(cleanProse(t, 5), "Houthi forces captured Jabal al-Bazilah in Taiz. Government forces shelled Al-Wazi'iyah.\n\nA Houthi drone struck Jazan airport.");
  assert.equal(cleanProse(t, 2), "Houthi forces captured Jabal al-Bazilah in Taiz. Government forces shelled Al-Wazi'iyah.");
});

test("a repelled attack is drawn from the attacker's side", () => {
  assert.equal(repelAttacker("Giants Brigades repel Houthi infiltration in Kahbub"), "houthi");
  assert.equal(repelAttacker("Houthi attack on Al-Aghbara repelled"), "houthi");
  assert.equal(repelAttacker("Southern forces repel attack in Al-Mudaribah"), "houthi");
  assert.equal(repelAttacker("Houthi forces repel government advance in Rasin"), "government");
  assert.equal(repelAttacker("Clashes in Taiz"), null);
});

import { headlinesLine } from "./brief-store.ts";

test("a front the writer left out reads its own headlines, not a count", () => {
  const own = [
    { summary: "Houthi forces attack government positions in Aden", at: "2026-10-01T20:00:00Z", score: 60 },
    { summary: "Houthi forces attack government positions in Aden.", at: "2026-10-01T19:00:00Z", score: 50 },
    { summary: "Clashes reported north of Aden", at: "2026-10-01T18:00:00Z", score: 40 },
  ] as never[];
  assert.equal(headlinesLine(own), "Houthi forces attack government positions in Aden. Clashes reported north of Aden.");
  assert.equal(headlinesLine([]), "");
});

import { isCountedLine } from "./brief-store.ts";

test("the counted line is known as such; a writer's line or a headline is not", () => {
  assert.equal(isCountedLine("In the 6 hours to 00:00 on 2 Oct there were one ground engagement. Activity here is up on the previous window."), true);
  assert.equal(isCountedLine("Aden, the port capital. Nothing was reported from this front in the 6 hours to 00:00."), true);
  assert.equal(isCountedLine("Houthi forces shelled positions north of Aden."), false);
  assert.equal(headlinesLine([{ summary: "Saudi jets strike Houthis", at: "2026-10-01T20:00:00Z" }] as never[]), "Saudi jets strike Houthis.");
});

import { headlinesSituation } from "./brief-store.ts";

test("with no writer, the overview is the strongest headlines, a repeat kept once, never a count", () => {
  const rs = [
    { summary: "Houthi forces strike coalition headquarters and cement factory in Aden", at: "2026-10-02T02:00:00Z", score: 80 },
    { summary: "Houthi drones target coalition headquarters and Star Cement factory in Buraiqa, Aden", at: "2026-10-02T01:00:00Z", score: 70 },
    { summary: "Saudi airstrikes hit Sanaa", at: "2026-10-02T01:30:00Z", score: 60 },
  ] as never[];
  const t = headlinesSituation(rs);
  assert.equal(t, "Houthi forces strike coalition headquarters and cement factory in Aden. Saudi airstrikes hit Sanaa.");
  assert.equal(headlinesSituation([]), "");
});

test("the headline overview leaves out reactions when there are events", () => {
  const rs = [
    { summary: "Kuwait and Bahrain condemn Houthi attack on Taibah power station in Medina", at: "2026-10-02T02:00:00Z", score: 90, type: "statement" },
    { summary: "Saudi Arabia condemns the strikes", at: "2026-10-02T02:10:00Z", score: 85, type: "strike" },
    { summary: "Saudi airstrikes hit Sanaa", at: "2026-10-02T01:30:00Z", score: 60, type: "strike" },
  ] as never[];
  assert.equal(headlinesSituation(rs), "Saudi airstrikes hit Sanaa.");
});

import { askChain } from "./models.ts";

test("an update past its share of the strong writers does not ask them", async () => {
  const real = globalThis.fetch;
  let asked = 0;
  globalThis.fetch = (async () => {
    asked++;
    throw new Error("no network in tests");
  }) as typeof fetch;
  const env = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test";
  try {
    const budget = { "gemini-3.8-flash": 5, "gemini-3.7-flash": 5 };
    const got = await askChain("t", "s", "u", { models: [{ provider: "gemini", id: "gemini-3.8-flash" }, { provider: "gemini", id: "gemini-3.7-flash" }], budget });
    assert.equal(got, null);
    assert.equal(asked, 0);
    const fresh: Record<string, number> = {};
    await askChain("t", "s", "u", { models: [{ provider: "gemini", id: "gemini-3.8-flash" }], budget: fresh });
    assert.equal(asked, 1);
    assert.equal(fresh["gemini-3.8-flash"], 1);
  } finally {
    globalThis.fetch = real;
    if (env === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = env;
  }
});
