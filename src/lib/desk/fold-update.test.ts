/**
 * A later account folded into a card (user, 24 Oct): what it adds is written into the card; hours after the
 * card, it is a card of its own following that one up; a lead never changes hands against the side rules.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const base = { live: true, text: "", score: 1, tags: [] } as const;

test("a later account with a new figure hours after the card is its own card, following it up", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const home = { ...base, fp: "a", url: "https://t.me/alhadath_brk/1", source: "Al Hadath", at: "2026-10-23T15:00:00Z", type: "diplomacy", summary: "US pressed Lebanese army to confront Hezbollah in Tampa talks, sources say" };
  const later = { ...base, fp: "b", url: "https://en.al-akhbar.com/news/tampa-talks-fail", source: "Al-Akhbar", at: "2026-10-24T06:00:00Z", type: "diplomacy", summary: "Tampa talks fail: US presses Lebanon's army to give up 3 border hills and disarm Hezbollah", duplicateOf: "a" };
  const reports = [home, later] as never[];
  foldIntoPublished(reports, new Set(["a"]));
  assert.equal(reports.length, 2);
  const b = (reports as { fp: string; replyTo?: string; flags?: string[] }[]).find((r) => r.fp === "b")!;
  assert.equal(b.replyTo, "a");
  assert.ok(b.flags?.includes("update"));
});

test("the same account an hour later folds, and its new figure is written into the card", async () => {
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  const home = { ...base, fp: "a", url: "https://t.me/alhadath_brk/1", source: "Al Hadath", at: "2026-10-23T15:00:00Z", type: "diplomacy", summary: "US pressed Lebanese army to confront Hezbollah in Tampa talks, sources say" };
  const later = { ...home, fp: "b", url: "https://t.me/AlArabiya_Brk/2", source: "Al Arabiya", at: "2026-10-23T16:00:00Z", summary: "US pressed Lebanese army in Tampa talks to confront Hezbollah within 30 days, sources say", duplicateOf: "a" };
  const reports = [home, later] as never[];
  const enrich: [unknown, unknown][] = [];
  foldIntoPublished(reports, new Set(["a"]), [], enrich as never);
  assert.equal(reports.length, 1);
  assert.equal(enrich.length, 1);
  // Nothing new hours later: still a copy, folded.
  const copy = { ...home, fp: "c", url: "https://t.me/AlArabiya_Brk/3", source: "Al Arabiya", at: "2026-10-23T21:00:00Z", summary: "Sources: US pressed Lebanese army to confront Hezbollah in Tampa talks", duplicateOf: "a" };
  const two = [home, copy] as never[];
  foldIntoPublished(two, new Set(["a"]));
  assert.equal(two.length, 1);
});

test("a date is no new figure; an Iran or Gaza desk place is a new fact", async () => {
  const { addsFacts } = await import("./combine.ts");
  const home = { ...base, fp: "a", url: "u1", source: "Safa", at: "2026-10-24T06:00:00Z", type: "combat", summary: "Israeli forces raid Jalazone camp", desks: ["gaza"], place: "Jalazone" };
  const dated = { ...home, fp: "b", url: "u2", summary: "Israeli forces raid Jalazone camp on 24 October" };
  assert.equal(addsFacts(home as never, dated as never), false);
  const more = { ...home, fp: "c", url: "u3", place: "Ramallah", summary: "Israeli forces raid Jalazone camp" };
  assert.equal(addsFacts(home as never, more as never), true);
});

test("on Gaza, another outlet's article never takes a Palestinian or Israeli source's card; an exclusive does", async () => {
  const { sideRefusesLead } = await import("./site-articles.ts");
  const home = { url: "https://t.me/safaps/1", source: "Safa", summary: "Israeli air strike kills two in Khan Yunis", type: "strike", desks: ["gaza"] };
  const aj = { url: "https://www.aljazeera.net/news/1", source: "Al Jazeera", summary: "Israeli air strike kills two in Khan Yunis", type: "strike", desks: ["gaza"] };
  assert.equal(sideRefusesLead(home, aj), true);
  assert.equal(sideRefusesLead(home, { ...aj, flags: ["exclusive"] }), false);
  // On the Iran desk the same rule holds for Judea and Samaria.
  const modon = { url: "https://www.almodon.com/arabworld/1", source: "Al-Modon", summary: "Israeli army launches major operation in Judea and Samaria", type: "combat", desks: ["iran"] };
  assert.equal(sideRefusesLead({ ...home, desks: ["iran"], summary: modon.summary, type: "combat" }, modon), true);
});

test("the served fold leaves an update apart from the card it follows", async () => {
  const { foldServed } = await import("./fold-same.ts");
  const a = { ...base, fp: "a", url: "https://t.me/a/1", source: "Al Hadath", at: "2026-10-23T15:00:00Z", type: "statement", summary: "Netanyahu: Israel will keep its positions in southern Lebanon" };
  const b = { ...a, fp: "b", url: "https://t.me/b/2", source: "Kan", at: "2026-10-23T19:00:00Z", summary: "Netanyahu: Israel will keep its five positions in southern Lebanon until Hezbollah is disarmed", replyTo: "a", flags: ["update"] };
  assert.equal(foldServed([a, b] as never[]).reports.length, 2);
});

test("Israel's and the Palestinians' speakers are known to the remarks rule", async () => {
  const { remarksOwner } = await import("./fold-same.ts");
  assert.equal(remarksOwner({ summary: "Netanyahu: Hamas will be disarmed", type: "statement" }), "netanyahu");
  assert.equal(remarksOwner({ summary: "Basem Naim: the occupation is stalling the second phase", type: "statement" }), "basem naim");
  assert.equal(remarksOwner({ summary: "Kushner: talks on Gaza disarmament reset", type: "diplomacy" }), "kushner");
});
