import { test } from "node:test";
import assert from "node:assert/strict";
import { foldServed, visitOf } from "./fold-same.ts";
import { doubledLead } from "./copy-rules.ts";

const card = (fp: string, at: string, source: string, summary: string, type = "diplomacy") => ({ fp, at, source, url: `https://example.com/${fp}`, type, summary });

test("one visit told by many outlets is one card (26 Oct: the Saudi delegation to Tehran, 12 cards)", () => {
  assert.equal(visitOf("Saudi defence minister leads Mecca Agreement delegation to Tehran for talks with Iran"), "saudi>tehran");
  assert.equal(visitOf("Saudi, Turkish, Pakistani officials meet Iranian leaders in Tehran"), "saudi>tehran");
  assert.equal(visitOf("Senior Iranian official to Al Jazeera: Qatari delegation arrived in Tehran today"), "qatar>tehran");
  assert.equal(visitOf("Iran's oil exports fell in September"), "");
  const f = foldServed([
    card("a", "2026-10-26T03:02:00Z", "SPA", "Saudi, Turkish, Pakistani defence and intelligence chiefs to meet Iranian officials in Tehran Monday"),
    card("b", "2026-10-26T03:25:00Z", "Al Arabiya", "Saudi defence minister Khalid bin Salman leads delegation to Tehran for Mecca Agreement talks"),
    card("c", "2026-10-26T06:05:00Z", "Reuters", "Saudi, Pakistani and Turkish defence and intelligence chiefs meet Iranian officials in Tehran"),
    card("d", "2026-10-26T06:00:00Z", "Al Jazeera", "Qatari mediators hold talks in Washington"),
  ]);
  assert.equal(f.reports.length, 2);
});

test("one decision told by several outlets is one card (the Iraqi PM's order on the Maysan council head)", () => {
  const f = foldServed([
    card("a", "2026-10-25T19:25:00Z", "INA", "Iraqi PM orders investigation into Maysan provincial council head over threat of civil disobedience and separation", "statement"),
    card("b", "2026-10-26T00:49:00Z", "Iran International", "Iraqi PM orders investigation into Maysan provincial council head over threat to close Al-Sheeb crossing with Iran", "statement"),
  ]);
  assert.equal(f.reports.length, 1);
});

test("a lead the line says again is dropped", () => {
  assert.equal(
    doubledLead("Saudi defence minister Prince Khalid bin Salman: Saudi defence minister leads delegation to Tehran for Mecca Agreement talks"),
    "Saudi defence minister leads delegation to Tehran for Mecca Agreement talks",
  );
  assert.equal(doubledLead("Araghchi: Iran presented a seven-day plan"), "Araghchi: Iran presented a seven-day plan");
});

test("one death in Gaza told by several local reporters is one card", () => {
  const f = foldServed([
    card("a", "2026-10-26T04:00:00Z", "Alam 24", "Israeli fire kills three, including 7-year-old girl Jouri Islam Al-Soufi, in Al-Mawasi, Khan Younis", "combat"),
    card("b", "2026-10-26T05:10:00Z", "Hamza al-Masri", "Israeli gunfire kills Palestinian child Jouri Islam Al-Soufi and a 24-year-old man", "combat"),
    card("c", "2026-10-26T05:30:00Z", "Safa", "Israeli strike on Islamic University in Gaza City kills three security guards", "strike"),
    card("d", "2026-10-26T05:40:00Z", "WAFA", "Israeli strikes on Islamic University in Gaza kill three security guards", "strike"),
    card("e", "2026-10-26T06:00:00Z", "Saraya al-Quds", "Eight Palestinians killed in Gaza today", "statement"),
  ]);
  assert.equal(f.reports.length, 3);
});

test("the Gaza desk's live numbers: the running count, the crossings, the aid trucks with their span", async () => {
  const { gazaNumbers, hurtIn } = await import("./gaza-numbers.ts");
  assert.deepEqual(hurtIn("Israeli fire kills three, including a girl, wounds over 10 in Al-Mawasi"), { dead: 3, hurt: 10 });
  const c = (fp: string, at: string, source: string, summary: string, flags: string[] = []) => ({ fp, at, source, url: `https://t.me/x/${fp}`, summary, flags });
  const g = gazaNumbers([
    c("a", "2026-10-26T04:00:00Z", "Safa", "Israeli fire kills three, wounds 10 in Al-Mawasi, Khan Younis", ["arena:gaza", "actor:israel"]),
    c("b", "2026-10-26T05:00:00Z", "WAFA", "Israeli extremists raid Awarta near Nablus; two Palestinians killed south of Khan Younis", ["arena:judea_samaria", "actor:israeli_citizens"]),
    c("c", "2026-10-26T06:00:00Z", "Gaza Health Ministry", "4 killed, 14 wounded in Israeli attacks on Gaza in past 24 hours; 1,551 killed since ceasefire", ["arena:gaza"]),
    c("d", "2026-10-26T07:00:00Z", "Sama", "Kerem Shalom crossing opens; Rafah, Zikim and Kissufim remain closed", ["arena:aid"]),
    c("e", "2026-10-26T08:00:00Z", "COGAT", "COGAT: 212 aid trucks entered Gaza today via Kerem Shalom and Zikim", ["arena:aid"]),
  ]);
  // The desk counts no tolls of its own now (26 Oct): the researched sets hold them from the ceasefire on.
  assert.equal(g.boxes.some((b) => b.title === "Killed and wounded"), false);
  const running = g.boxes.find((b) => b.title === "Killed in Gaza since the ceasefire");
  assert.ok(running && running.type === "stat" && running.value.v === "1,551");
  const cross = g.boxes.find((b) => b.title === "The crossings");
  assert.ok(cross && cross.type === "table");
  const trucks = g.boxes.find((b) => b.title === "Aid trucks, latest report");
  assert.ok(trucks && trucks.type === "stat" && trucks.value.v === "212" && trucks.unit === "today" && trucks.set === "aid");
  if (cross && cross.type === "table") assert.deepEqual(cross.rows.map((r) => `${r.label}:${r.cells[0]?.v}`), ["Kerem Shalom:Open", "Zikim:Open", "Kissufim:Closed", "Rafah:Closed"]);
});

// 26 Oct, evening (user's list): the Gaza Now box rewritten as the other desks' are, the hostages' category gone, the
// live boxes' charts, the explainers' and the timeline's links each way.
import { GAZA_NOW_BASE, GAZA_TOPICS, gazaNowShape } from "./gaza-timeline-now.ts";
import { dayMax, keepRising } from "./gaza-numbers.ts";
import GZEX from "../../../public/gaza-explain.json" with { type: "json" };
import GZTL from "../../../public/gaza-timeline.json" with { type: "json" };
import GZNUM from "../../../public/gaza-numbers.json" with { type: "json" };

test("the Gaza Now box keeps its topics and the desk's words", () => {
  assert.ok(GAZA_TOPICS.length >= 5);
  assert.ok(gazaNowShape(GAZA_NOW_BASE.summary, GAZA_NOW_BASE.detail));
  const noIsf = GAZA_NOW_BASE.detail.split(/\n\n/).filter((p) => !p.startsWith("ISF:")).join("\n\n");
  assert.equal(gazaNowShape(GAZA_NOW_BASE.summary, noIsf), false);
  assert.doesNotMatch(GAZA_NOW_BASE.detail, /West Bank|settlers/);
});

test("no hostages category in the Gaza numbers", () => {
  assert.ok(!(GZNUM as { sets: { key: string }[] }).sets.some((s) => s.key === "hostages"));
});

test("a running count's chart only grows, one point a day", () => {
  assert.deepEqual(dayMax([{ d: "2026-10-24", v: 5 }, { d: "2026-10-24", v: 9 }, { d: "2026-10-23", v: 3 }]), [{ d: "2026-10-23", v: 3 }, { d: "2026-10-24", v: 9 }]);
  assert.deepEqual(keepRising([{ d: "2026-10-22", v: 1538 }, { d: "2026-10-23", v: 153 }, { d: "2026-10-25", v: 1551 }]).map((p) => p.v), [1538, 1551]);
});

test("every Gaza explainer's era and every era's explainer exists, and each link goes both ways", () => {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const eras = [...GZTL.phases, GZTL.now] as { title: string; explainers?: string[] }[];
  const items = GZEX.items as { title: string; timeline?: string[] }[];
  for (const e of items) for (const t of e.timeline ?? []) {
    const p = eras.find((x) => slug(x.title) === slug(t));
    assert.ok(p, `${e.title} -> ${t}`);
    assert.ok((p!.explainers ?? []).includes(e.title), `${t} does not lead back to ${e.title}`);
  }
  for (const p of eras) for (const x of p.explainers ?? []) {
    const e = items.find((i) => slug(i.title) === slug(x));
    assert.ok(e, `${p.title} -> ${x}`);
    assert.ok((e!.timeline ?? []).includes(p.title), `${x} does not lead back to ${p.title}`);
  }
});

test("the aid trucks' chart takes a day's whole count only, as the crossings authority or COGAT told it", async () => {
  const { gazaNumbers } = await import("./gaza-numbers.ts");
  const c = (fp: string, at: string, source: string, summary: string) => ({ fp, at, source, url: `https://t.me/x/${fp}`, summary, flags: ["arena:aid"] });
  const g = gazaNumbers([
    c("a", "2026-10-23T14:11:00Z", "Al-Shati News", "Gaza crossings authority: 12 aid trucks entered Gaza on 23 October, all via Kerem Shalom; Zikim and Kissufim closed"),
    c("b", "2026-10-24T16:03:00Z", "Muthana al-Najjar", "32 aid trucks enter Gaza, carrying shelter supplies, food and household items"),
    c("c", "2026-10-24T13:54:00Z", "Al-Shati News", "136 vegetable and fruit trucks to enter Gaza tomorrow, 8 per trader for 17 traders"),
    c("d", "2026-10-25T18:32:00Z", "Quds News Network", "Gaza crossings authority: 248 trucks entered Gaza Sunday, 128 commercial, 100 aid, 20 fuel via Kerem Shalom"),
  ]);
  const trucks = g.boxes.find((b) => b.title === "Aid trucks, latest report");
  assert.deepEqual(trucks?.series, [{ d: "2026-10-23", v: 12 }, { d: "2026-10-25", v: 248 }]);
});
