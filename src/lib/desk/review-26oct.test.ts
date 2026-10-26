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

test("the Gaza desk's numbers count single events by area and side, never a tally", async () => {
  const { gazaNumbers, hurtIn } = await import("./gaza-numbers.ts");
  assert.deepEqual(hurtIn("Israeli fire kills three, including a girl, wounds over 10 in Al-Mawasi"), { dead: 3, hurt: 10 });
  const c = (fp: string, at: string, source: string, summary: string, flags: string[] = []) => ({ fp, at, source, url: `https://t.me/x/${fp}`, summary, flags });
  const g = gazaNumbers([
    c("a", "2026-10-26T04:00:00Z", "Safa", "Israeli fire kills three, wounds 10 in Al-Mawasi, Khan Younis", ["arena:gaza", "actor:israel"]),
    c("b", "2026-10-26T05:00:00Z", "WAFA", "Israeli extremists raid Awarta near Nablus; two Palestinians killed south of Khan Younis", ["arena:judea_samaria", "actor:israeli_citizens"]),
    c("c", "2026-10-26T06:00:00Z", "Gaza Health Ministry", "4 killed, 14 wounded in Israeli attacks on Gaza in past 24 hours; 1,551 killed since ceasefire", ["arena:gaza"]),
    c("d", "2026-10-26T07:00:00Z", "Sama", "Kerem Shalom crossing opens; Rafah, Zikim and Kissufim remain closed", ["arena:aid"]),
  ]);
  const cas = g.boxes.find((b) => b.title === "Killed and wounded")!;
  assert.equal(cas.type, "claims");
  if (cas.type === "claims") {
    assert.equal(cas.rows[0].unoff?.v, 5);
    assert.equal(cas.rows[2].unoff, null);
  }
  const running = g.boxes.find((b) => b.title === "Killed in Gaza since the ceasefire");
  assert.ok(running && running.type === "stat" && running.value.v === "1,551");
  const cross = g.boxes.find((b) => b.title === "The crossings");
  assert.ok(cross && cross.type === "table");
  if (cross && cross.type === "table") assert.deepEqual(cross.rows.map((r) => `${r.label}:${r.cells[0]?.v}`), ["Kerem Shalom:Open", "Zikim:Closed", "Kissufim:Closed", "Rafah:Closed"]);
});
