/**
 * Round 30 stage 2: one store, two desks. The Yemen desk must read exactly as
 * before; a card that is the Iran desk's alone never reaches it.
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { briefWindow } from "./brief.ts";
import { deskKey, deskParam, desksOf, isIranCard, onDesk } from "./desk-route.ts";
import { toDeskReportRow } from "./snapshot.ts";
import { createPgStore } from "./store.pg.ts";
import type { LiveReport } from "./types.ts";

let pg: PGlite;
let sql: Sql;

before(async () => {
  pg = new PGlite({ parsers: { 20: Number, 1082: (v: string) => v } });
  await pg.waitReady;
  const files = (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) await pg.exec(await readFile(`migrations/${f}`, "utf8"));
  const run = async <T>(text: string, params: unknown[]): Promise<T[]> => (await pg.query<T>(text, params)).rows;
  const tagged = (async <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  tagged.query = <T>(text: string, params: unknown[] = []) => run<T>(text, params);
  sql = tagged;
});

after(async () => {
  await pg?.close();
});

const provider = () => Promise.resolve(sql);

function card(n: number, over: Partial<LiveReport> = {}): LiveReport {
  return {
    fp: `r30-${n}`,
    at: `2026-10-08T1${n}:00:00+03:00`,
    source: "Reuters",
    url: `https://example.com/news/r30-${n}`,
    type: "strike",
    summary: `Report ${n}`,
    text: "Text.",
    live: true,
    place: "Sanaa",
    lat: 15.35,
    lng: 44.2,
    ...over,
  };
}

test("a card from before the split is Yemen's, and reads back exactly as it did", async () => {
  const store = createPgStore(provider);
  await store.mergeIntoDesk([card(1)]);
  const all = await store.recentDesk(10);
  const yemen = await store.recentDesk(10, undefined, { desk: "yemen" });
  const iran = await store.recentDesk(10, undefined, { desk: "iran" });
  assert.deepEqual(yemen, all);
  assert.equal(yemen.reports.length, 1);
  assert.equal("desks" in yemen.reports[0], false, "a Yemen card carries no desks label");
  assert.equal("desks" in yemen.events[0], false);
  assert.equal(iran.reports.length, 0);
  assert.equal(iran.events.length, 0);
});

test("an Iran card never reaches the Yemen desk; a card on both reaches both", async () => {
  const store = createPgStore(provider);
  await store.mergeIntoDesk([
    card(2, { desks: ["iran"], place: "Bandar Abbas", lat: 27.18, lng: 56.27 }),
    card(3, { desks: ["yemen", "iran"] }),
  ]);
  const yemen = (await store.recentDesk(10, undefined, { desk: "yemen" })).reports.map((r) => r.fp);
  const iran = (await store.recentDesk(10, undefined, { desk: "iran" })).reports.map((r) => r.fp);
  assert.ok(!yemen.includes("r30-2"));
  assert.ok(yemen.includes("r30-3"));
  assert.deepEqual(iran.sort(), ["r30-2", "r30-3"]);
  const iranPins = (await store.recentDesk(10, undefined, { desk: "iran" })).events.map((e) => e.fp);
  const yemenPins = (await store.recentDesk(10, undefined, { desk: "yemen" })).events.map((e) => e.fp);
  assert.ok(iranPins.includes("r30-2") && !yemenPins.includes("r30-2"));
});

test("a Yemen card seen again as Iran's too joins the Iran desk, with its pin", async () => {
  const store = createPgStore(provider);
  await store.mergeIntoDesk([card(4)]);
  assert.equal((await store.recentDesk(10, undefined, { desk: "iran" })).reports.some((r) => r.fp === "r30-4"), false);
  await store.mergeIntoDesk([card(4, { desks: ["yemen", "iran"] })]);
  const iran = await store.recentDesk(10, undefined, { desk: "iran" });
  assert.ok(iran.reports.some((r) => r.fp === "r30-4"));
  assert.ok(iran.events.some((e) => e.fp === "r30-4"));
  // And it stays on the Yemen desk.
  assert.ok((await store.recentDesk(10, undefined, { desk: "yemen" })).reports.some((r) => r.fp === "r30-4"));
});

test("Iran itself acting makes a card Iran's too; 'Iran-backed' does not", () => {
  const no = [
    { summary: "Iran-backed Houthis fire missiles at a ship in the Red Sea", text: "The Iran-aligned group said." },
    { summary: "الحوثيون المدعومون من إيران يستهدفون سفينة", text: "" },
    { summary: "Houthi forces clash with government troops in Taiz", text: "Fighting near the city." },
    { summary: "Iranian-made drones shot down over Marib", text: "" },
  ];
  const yes = [
    { summary: "Iran's foreign ministry condemns the strikes on Sanaa", text: "" },
    { summary: "Tanker seized in the Strait of Hormuz", text: "" },
    { summary: "طهران تدين الغارات على صنعاء", text: "" },
    { summary: "Araghchi calls Omani counterpart about Yemen", text: "" },
  ];
  for (const r of no) assert.equal(isIranCard(r), false, r.summary);
  for (const r of yes) assert.equal(isIranCard(r), true, r.summary);
  assert.deepEqual(desksOf(card(5, yes[0])), ["yemen", "iran"]);
  assert.deepEqual(desksOf(card(6, no[0])), ["yemen"]);
  assert.deepEqual(desksOf(card(7, { desks: ["iran"] })), ["iran"], "a card's own desks are kept");
});

test("a Yemen card's stored shape has no desks field; a shared one has", () => {
  assert.equal("desks" in toDeskReportRow(card(8, { desks: ["yemen"] })), false);
  assert.deepEqual(toDeskReportRow(card(9, { desks: ["yemen", "iran"] })).desks, ["yemen", "iran"]);
});

test("?desk= picks a desk; anything else, or nothing, is Yemen", () => {
  assert.equal(deskParam("iran"), "iran");
  assert.equal(deskParam(null), "yemen");
  assert.equal(deskParam("x"), "yemen");
  assert.equal(onDesk({}, "yemen"), true);
  assert.equal(onDesk({}, "iran"), false);
  assert.equal(onDesk({ desks: ["iran"] }, "yemen"), false);
});

test("Yemen keeps its state keys; another desk's carry its name", () => {
  assert.equal(deskKey("yemen", "brief"), "brief");
  assert.equal(deskKey("iran", "brief"), "iran:brief");
});

test("the brief's window: Yemen's 6 hours as before, Iran's 3", () => {
  const now = new Date("2026-10-08T10:30:00+03:00");
  const six = briefWindow(now);
  assert.deepEqual(briefWindow(now, 6), six);
  const three = briefWindow(now, 3);
  assert.equal(Date.parse(three.nextUpdateAt) - Date.parse(three.updatedAt), 3 * 3600_000);
  assert.equal(Date.parse(six.nextUpdateAt) - Date.parse(six.updatedAt), 6 * 3600_000);
});

test("the map's pins alone, back to a day: the whole war, not the newest cards' (8 Oct)", async () => {
  const store = createPgStore(provider);
  await store.mergeIntoDesk([
    card(10, { fp: "r30-old", at: "2026-07-20T10:00:00+03:00" }),
    card(11, { fp: "r30-older", at: "2026-07-01T10:00:00+03:00" }),
  ]);
  const pins = await store.recentDesk(20_000, undefined, { desk: "yemen", since: "2026-07-13T00:00:00+03:00", reports: false });
  assert.equal(pins.reports.length, 0);
  const fps = pins.events.map((e) => e.fp);
  assert.ok(fps.includes("r30-old"));
  assert.ok(!fps.includes("r30-older"), "before the start day is left out");
  assert.ok(!fps.includes("r30-2"), "another desk's pin is left out");
});

test("a ship hit in the Gulf with no word of Yemen is the Iran desk's alone (8 Oct, the Acers)", () => {
  assert.deepEqual(desksOf(card(12, { type: "vessel", summary: "Tanker Acers attacked off Qatar, casualties reported", text: "", place: undefined })), ["iran"]);
  assert.deepEqual(desksOf(card(13, { type: "vessel", summary: "Container ship attacked in the Red Sea", text: "" })), ["yemen"]);
  // The Houthis named: still Yemen's, and Iran's too where Iran is named.
  assert.deepEqual(desksOf(card(14, { type: "vessel", summary: "Houthis claim attack on tanker in the Gulf of Oman", text: "", place: undefined })), ["yemen"]);
  assert.deepEqual(desksOf(card(15, { type: "vessel", summary: "Tanker seized in the Strait of Hormuz", text: "", place: undefined })), ["iran"]);
});

/* ------------------------------------------------------------------ *
 * Stage 3b: the Iran desk's own reader and scan
 * ------------------------------------------------------------------ */
import { IRAN_PROMPT, iranContentHash, iranSide, isIranWar, passesIranOwnGate } from "./iran-reader.ts";
import { IRAN_READER, YEMEN_READER, decideIranForTest } from "./editor.ts";
import { SYSTEM_PROMPT, YEMEN_PROMPT, contentHash, type Reading } from "./reader.ts";

const reading = (over: Partial<Reading> = {}): Reading => ({
  id: "0",
  publish: true,
  reject_reason: "",
  event_type: "statement",
  confident_roles: true,
  actor: "Araghchi",
  actor_side: "iran",
  targets: [],
  origins: [],
  speaker_lead: "Araghchi",
  interest: "neutral",
  has_time: false,
  headline: "Iran will not negotiate under threat",
  body: "",
  arenas: ["talks"],
  ...over,
});

test("the Iran gate: Iran's war passes, 'Iran-backed Houthis' alone does not", () => {
  assert.equal(isIranWar("IRGC navy seizes a tanker in the Strait of Hormuz"), true);
  assert.equal(isIranWar("الحرس الثوري يعلن احتجاز ناقلة في مضيق هرمز"), true);
  assert.equal(isIranWar("سپاه پاسداران یک نفتکش را توقیف کرد"), true);
  assert.equal(isIranWar("Kataib Hezbollah threatens US forces in Iraq"), true);
  assert.equal(isIranWar("Iran-backed Houthis shell government positions in Marib"), false);
  assert.equal(isIranWar("Houthi forces advance in Al-Bayda"), false);
});

test("the Iran desk's own sources pass on the war's and the economy's words, not on sport", () => {
  assert.equal(passesIranOwnGate("حمله موشکی به پایگاه آمریکا"), true);
  assert.equal(passesIranOwnGate("قیمت دلار در بازار آزاد ریال"), true);
  assert.equal(passesIranOwnGate("پرسپولیس در لیگ برتر فوتبال برد"), false);
});

test("the Iran reader is its own: its prompt, its cache, its queue; Yemen's is unchanged", () => {
  assert.equal(YEMEN_PROMPT.system, SYSTEM_PROMPT);
  assert.equal(YEMEN_READER.queueKey, "reader-queue");
  assert.equal(YEMEN_READER.cachePrefix, "read");
  assert.equal(YEMEN_READER.hash("x"), contentHash("x"));
  assert.notEqual(IRAN_READER.hash("x"), contentHash("x"));
  assert.equal(IRAN_READER.hash("x"), iranContentHash("x"));
  assert.equal(IRAN_READER.queueKey, "iran:reader-queue");
  assert.equal(IRAN_READER.prompt, IRAN_PROMPT);
  assert.ok(IRAN_PROMPT.system.includes("Never add the word \"claim\""));
});

test("a model's word for a side lands on the Iran desk's list", () => {
  assert.equal(iranSide("Kataib Hezbollah"), "iraqi_militias");
  assert.equal(iranSide("Hezbollah"), "hezbollah");
  assert.equal(iranSide("IRGC"), "iran");
  assert.equal(iranSide("the IDF"), "israel");
  assert.equal(iranSide("CENTCOM"), "us");
});

test("an Iran card leads with its speaker, carries its arena and who acted, and is the Iran desk's", () => {
  const v = decideIranForTest(reading(), "عراقجي: إيران لن تتفاوض تحت التهديد");
  assert.equal(v.kind, "publish");
  if (v.kind !== "publish") return;
  assert.match(v.report.summary, /^Araghchi: /);
  assert.deepEqual(v.report.desks, ["iran"]);
  assert.ok(v.report.flags?.includes("arena:talks"));
  assert.ok(v.report.flags?.includes("actor:iran"));
  assert.ok(!/claim/i.test(v.report.summary));
});

test("an Iran card with a figure its source does not give is not published", () => {
  const v = decideIranForTest(
    reading({ event_type: "air_strike", speaker_lead: "", headline: "Israeli strike on Isfahan kills 12", arenas: ["military"], actor_side: "israel" }),
    "Explosions heard in Isfahan, local media report",
  );
  assert.equal(v.kind, "reject");
});

test("one post written by both desks' readers is one card, on both desks", async () => {
  const store = createPgStore(provider);
  // The Iran reader wrote it first ...
  await store.mergeIntoDesk([card(7, { fp: "ir-shared", url: "https://t.me/naya_foriraq/1", desks: ["iran"] })]);
  // ... then the Yemen reader kept the same post.
  await store.mergeIntoDesk([card(7, { fp: "ye-shared", url: "https://t.me/naya_foriraq/1", tags: ["iran-url"] })]);
  const ye = await store.recentDesk(50, undefined, { desk: "yemen" });
  assert.ok(ye.reports.some((r) => r.fp === "ir-shared"));
  // The other way round: Yemen's first, the Iran card joins it.
  await store.mergeIntoDesk([card(8, { fp: "ye-two", url: "https://t.me/naya_foriraq/2" })]);
  await store.mergeIntoDesk([card(8, { fp: "ir-two", url: "https://t.me/naya_foriraq/2", desks: ["iran"] })]);
  const ir = await store.recentDesk(50, undefined, { desk: "iran" });
  assert.ok(ir.reports.some((r) => r.fp === "ye-two"));
});

test("the Iran inbox is taken whole, once", async () => {
  const store = createPgStore(provider);
  await store.putMany("iran-inbox", { "1": [{ url: "a" }], "2": [{ url: "b" }] });
  const got = (await store.takeMany<{ url: string }[]>("iran-inbox")).flat().map((x) => x.url).sort();
  assert.deepEqual(got, ["a", "b"]);
  assert.deepEqual(await store.takeMany("iran-inbox"), []);
});

test("a headline that names its speaker gets no second name in front (8 Oct, 'Marco Rubio::')", () => {
  const v = decideIranForTest(
    reading({ speaker_lead: "Marco Rubio:", actor: "Rubio", actor_side: "us", headline: "US Secretary of State Rubio says the US can carry out any operation against Iran", arenas: ["military"] }),
    "Rubio said in Portugal that the United States can carry out any operation against Iran.",
    "Iran International",
    "opposition",
  );
  assert.equal(v.kind, "publish");
  if (v.kind === "publish") assert.equal(v.report.summary, "US Secretary of State Rubio says the US can carry out any operation against Iran");
});
