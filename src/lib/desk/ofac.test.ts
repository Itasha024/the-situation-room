import assert from "node:assert/strict";
import test from "node:test";

import { addedWords, liveSanctionBoxes, OFAC_KEY, type OfacStore, parseAction, parseRecentActions, pressWhy, refreshOfac, US_BOX, worthOpening } from "./ofac.ts";
import { ACTION_20261002, ACTION_20261005, ACTION_20261013, ACTION_20261015, LIST_17OCT } from "./ofac-fixtures.ts";
import NUMBERS from "../../../public/iran-numbers.json" with { type: "json" };

const list = parseRecentActions(LIST_17OCT);
const item = (id: string) => list.find((x) => x.id === id)!;

test("OFAC's Recent Actions list: every row with its date, newest first", () => {
  assert.equal(list.length, 10);
  assert.deepEqual(list.slice(0, 2).map((x) => [x.id, x.date]), [["20261016", "2026-10-16"], ["20261015", "2026-10-15"]]);
  assert.match(item("20261015").title, /^Iran-related Designations; Cuba Designation/);
  assert.equal(item("20261015").url, "https://ofac.treasury.gov/recent-actions/20261015");
  assert.equal(item("20261015").category, "Sanctions List Updates");
});

test("only actions that may be Iran's or Hezbollah's are opened", () => {
  assert.ok(worthOpening(item("20261015")));
  assert.ok(worthOpening(item("20261013")), "counter terrorism designations may be Hezbollah's");
  assert.ok(!worthOpening(item("20261014")), "a Venezuela designation removal");
  assert.ok(!worthOpening(item("20261013_33")), "a settlement");
});

// The miss (user, 17 Oct): the Treasury's 15 Oct sanctions never reached the numbers.
test("15 Oct: 16 people and 10 firms put under Iran sanctions are counted; the Cuban bank is not Iran's listing", () => {
  const a = parseAction(item("20261015"), ACTION_20261015);
  assert.equal(a.date, "2026-10-15");
  assert.ok(a.iran);
  assert.deepEqual(a.added, { people: 16, firms: 10, vessels: 0, aircraft: 0 });
  assert.equal(addedWords(a.added), "16 people, 10 firms");
  assert.equal(a.names[0], "Chabahar International Bank Overseas Company");
  assert.ok(a.names.includes("International Development Bank for Investment and Finance"));
  assert.ok(!a.names.some((n) => /Comercio/.test(n)));
  assert.deepEqual(a.press.map((p) => p.url.replace(/.*\/\/([^/]+).*\/([^/]+)$/, "$1 $2")), [
    "home.treasury.gov sb0661",
    "home.treasury.gov sb0660",
    "www.state.gov sanctioning-cuban-state-owned-banco-internacional-de-comercio-s-a-bicsa",
  ]);
});

test("13 Oct cartel and 2 Oct Hamas designations are not Iran's", () => {
  const narco = parseAction(item("20261013"), ACTION_20261013);
  assert.equal(narco.iran, false);
  assert.equal(addedWords(narco.added), "");
  const hamas = parseAction(item("20261002"), ACTION_20261002);
  assert.equal(hamas.iran, false);
});

test("5 Oct: an Iran alert with no listings is a measure, by its own name", () => {
  const a = parseAction(item("20261005"), ACTION_20261005);
  assert.ok(a.iran);
  assert.equal(addedWords(a.added), "");
  assert.deepEqual(a.measures, ["OFAC alert: Notice to Foreign Financial Institutions Conducting Business with Iran"]);
});

test("a Hezbollah financier under the terrorism program counts", () => {
  const html = `<div class="field__label visually-hidden">Release Date</div><div class="field__item">11/02/2026</div><div class="field__label">Press Release Link</div><div class="field__items"><div class="field__item"><a href="https://home.treasury.gov/news/press-releases/sb0700/">Treasury Targets Hizballah Financiers</a></div></div></div><div class="field__item"><h4>The following individuals have been added to OFAC's SDN List:</h4><p><a><font>HAMDAN, Ali, Beirut, Lebanon; DOB 01 Jan 1970 (individual) [SDGT] (Linked To: HIZBALLAH).</font></a><br><br><a><font>DOE, John, Caracas, Venezuela; DOB 01 Jan 1971 (individual) [SDGT].</font></a></p></div>`;
  const a = parseAction({ id: "20261102", url: "u", title: "Counter Terrorism Designations", date: "2026-11-02", category: "" }, html);
  assert.ok(a.iran);
  assert.equal(a.date, "2026-11-02");
  assert.deepEqual(a.added, { people: 2, firms: 0, vessels: 0, aircraft: 0 }, "every press release is on Hezbollah: the whole action is");
});

test("press titles in plain, neutral words", () => {
  assert.equal(pressWhy("Operation Economic Outcast Targets Iranian Regime’s Abuse of Religious Charity Networks"), "Iran's Abuse of Religious Charity Networks");
  assert.equal(pressWhy("Operation Economic Outcast Neutralizes Iranian Regime's Remaining Shadow Fleet Network"), "Iran's Remaining Shadow Fleet Network");
});

const fakeStore = () => {
  const mem = new Map<string, unknown>();
  return { mem, store: { getJson: async (k: string) => mem.get(k) ?? null, putJson: async (k: string, v: unknown) => void mem.set(k, v) } as never };
};
const pages: Record<string, string> = {
  "https://ofac.treasury.gov/recent-actions": LIST_17OCT,
  "https://ofac.treasury.gov/recent-actions/20261015": ACTION_20261015,
  "https://ofac.treasury.gov/recent-actions/20261013": ACTION_20261013,
  "https://ofac.treasury.gov/recent-actions/20261005": ACTION_20261005,
  "https://ofac.treasury.gov/recent-actions/20261002": ACTION_20261002,
};

test("dry run: a read of OFAC on 17 Oct puts the 15 Oct sanctions on top of the numbers' US box", async () => {
  const { mem, store } = fakeStore();
  const opened: string[] = [];
  const got = await refreshOfac(store, new Date("2026-10-17T12:00:00Z"), async (u) => (opened.push(u), pages[u] ?? null));
  assert.ok(got);
  assert.ok(mem.get(OFAC_KEY));
  assert.ok(!opened.includes("https://ofac.treasury.gov/recent-actions/20261014"), "removals are not opened");
  const live = liveSanctionBoxes(NUMBERS as never, got);
  assert.ok(live);
  const us = live.boxes.find((b) => b.title === US_BOX)!;
  const top = us.rows[0] as [{ v: string; date: string; url: string }, string, string];
  assert.equal(top[0].v, "15 Oct");
  assert.equal(top[0].url, "https://home.treasury.gov/news/press-releases/sb0661");
  assert.match(top[1], /^16 people, 10 firms: among them Chabahar International Bank/);
  assert.match(top[2], /Religious Charity Networks/);
  // The research ends with 8 Oct; that day is the research's, never added twice.
  assert.equal((us.rows[1] as [{ v: string }])[0].v, "8 Oct");
  const stat = Object.fromEntries(us.stats!.map(([c, l]) => [l, c]));
  assert.equal(stat["Since 28 Feb"].v, "747");
  assert.equal(stat["Economic Outcast"].v, "262");
  assert.equal(stat["Economic Outcast"].note, "24 Aug – 15 Oct");
  assert.equal(stat["Economic Fury"].v, "469", "a closed campaign does not move");
  assert.equal(live.through, "2026-10-15");
});

test("OFAC is read once an hour; a failed read keeps what was stored", async () => {
  const { store } = fakeStore();
  const t = new Date("2026-10-17T12:00:00Z");
  const first = await refreshOfac(store, t, async (u) => pages[u] ?? null);
  let asked = 0;
  const again = await refreshOfac(store, new Date(t.getTime() + 10 * 60_000), async () => (asked++, null));
  assert.equal(asked, 0);
  assert.equal(again, first);
  const later = await refreshOfac(store, new Date(t.getTime() + 2 * 3600_000), async () => null);
  assert.deepEqual(later, first);
});

test("no live read: the researched boxes stand", () => {
  assert.equal(liveSanctionBoxes(NUMBERS as never, null), null);
  assert.equal(liveSanctionBoxes(NUMBERS as never, { checkedAt: "", actions: [] } satisfies OfacStore), null);
});

test("the plain why comes from the press release's own opening, quotes left out (23 Oct)", async () => {
  const { pressLead, iranTitle } = await import("./ofac.ts");
  const html = `<meta name=description content="WASHINGTON—Today x"><div><p style=text-align:center><em>Law Firms, Shipping Agents, and Vessels Helped Conceal and Transport Iranian Commodities</em></p><p><strong>WASHINGTON</strong>—Today, the U.S. Department of the Treasury sanctioned Panama- and Greece-based law firm Karnakis and Karnakis, which has supported illicit Iranian shipping activity for years.</p><p>“Whether you are conducting illegal oil transfers at sea, we will find you,” said Secretary of the Treasury Scott Bessent.</p><p>OPERATION ECONOMIC OUTCAST IS ISOLATING THE IRANIAN REGIME and more words here to pass the length.</p></div>`;
  const lead = pressLead(html);
  assert.match(lead, /^Law Firms, Shipping Agents/);
  assert.match(lead, /Panama- and Greece-based law firm/);
  assert.doesNotMatch(lead, /Bessent|OPERATION/);
  // With no press release yet, only the title's Iran parts, in plain words.
  assert.equal(iranTitle("Iran-related Designations; Belarus and North Korea Designations Removals; Issuance of Iran-related and Russia-related General Licenses and Amended Frequently Asked Questions"), "New sanctions on Iran-linked people, firms or ships; Licences to wind down dealings with those sanctioned");
});
