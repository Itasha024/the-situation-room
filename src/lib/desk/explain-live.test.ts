// The weekly explainer check (user, 27 Oct: "make explainers update every 7 days if there's something to update").
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyExplain, currentExplain, EXPLAIN_FILES, explainDocs } from "./explain-live.ts";

const old = { title: "Hamas", cat: "Background", sum: "Hamas runs Gaza. Its leader in Gaza is A.", detail: "Leaders: A leads in Gaza.\n\nMoney: From Qatar and Iran.", sources: [{ name: "x", url: "https://x.org/a" }] };
const docs = explainDocs([
  { at: "2026-10-25T10:00:00Z", source: "Reuters", url: "https://reuters.com/b", summary: "Hamas names B its leader in Gaza after A is killed" },
  { at: "2026-10-24T10:00:00Z", source: "AP", url: "https://ap.org/c", summary: "Strike in Khan Yunis" },
]);

test("a change that cites a report is kept, its report joins the sources", () => {
  const got = applyExplain("gaza", [old], { updates: [{ title: "Hamas", sum: "Hamas runs Gaza. Its leader in Gaza is B since October 2026.", detail: "Leaders: B leads in Gaza since A was killed in October 2026.\n\nMoney: From Qatar and Iran.", docs: [0] }] }, docs);
  assert.equal(got.length, 1);
  assert.match(got[0].sum, /B since October 2026/);
  assert.deepEqual(got[0].sources?.map((s) => s.url), ["https://x.org/a", "https://reuters.com/b"]);
});

test("no report cited, an unknown title, a cut text or no change: nothing", () => {
  const u = { title: "Hamas", sum: "Hamas runs Gaza. Its leader in Gaza is B since October 2026.", detail: "Leaders: B leads in Gaza since A was killed in October 2026.\n\nMoney: From Qatar and Iran." };
  assert.equal(applyExplain("gaza", [old], { updates: [{ ...u, docs: [] }] }, docs).length, 0);
  assert.equal(applyExplain("gaza", [old], { updates: [{ ...u, title: "Fatah", docs: [0] }] }, docs).length, 0);
  assert.equal(applyExplain("gaza", [old], { updates: [{ ...u, detail: "B leads.", docs: [0] }] }, docs).length, 0);
  assert.equal(applyExplain("gaza", [old], { updates: [{ title: "Hamas", sum: old.sum, detail: old.detail, docs: [0] }] }, docs).length, 0);
});

test("the Gaza desk's words are kept in a change", () => {
  const got = applyExplain("gaza", [old], { updates: [{ title: "Hamas", sum: "Hamas runs Gaza and has cells in the West Bank. Its leader is B.", detail: "Leaders: B leads in Gaza and the West Bank since October 2026.\n\nMoney: From Qatar and Iran.", docs: [0] }] }, docs);
  assert.doesNotMatch(got[0].sum + got[0].detail, /West Bank/);
});

test("the stored version is served only when it is as new as the file", () => {
  const file = EXPLAIN_FILES.iran;
  const t = file.items[0].title;
  const live = { asOf: "2099-01-01", items: [{ ...file.items[0], sum: "NEW" }] };
  const cur = currentExplain("iran", live);
  assert.equal(cur.items.length, file.items.length);
  assert.equal(cur.items.find((e) => e.title === t)?.sum, "NEW");
  assert.equal(currentExplain("iran", { asOf: "2000-01-01", items: live.items }).items[0].sum, file.items[0].sum);
});
