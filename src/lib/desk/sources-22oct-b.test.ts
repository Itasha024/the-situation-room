import { test } from "node:test";
import assert from "node:assert/strict";
import { LATER_RANK, earlierTellers, leadCountry, pressCandidates, pressOf } from "./state-press.ts";
import { moreOriginal } from "./fold-same.ts";
import { officeTitles } from "./copy-rules.ts";
import { LEBANESE_MEDIA, IRAN_TG, IRAN_X } from "./iran-sources.ts";

// User, 22 Oct (third message): the order an original is looked for in, per country; three Lebanese
// outlets; Israel's and Iraq's leaders' own accounts; Lebanon's prime minister is not Mikati.

test("an official's own, then his state's media, then the later tier", () => {
  assert.ok(pressOf("Tasnim", "IR") >= 0 && pressOf("Tasnim", "IR") < LATER_RANK);
  assert.equal(pressOf("Khabar Fori", "IR"), -1);
  assert.ok(pressOf("Iran International", "IR") >= LATER_RANK);
  assert.ok(pressOf("Sabereen News", "IQ") >= LATER_RANK);
  assert.ok(pressOf("Iraq's prime minister's office", "IQ") < pressOf("INA", "IQ"));
  // Clash Report after the White House and Trump's own posts, with the American outlets (user, 22 Oct, fourth message).
  assert.ok(pressOf("Rapid Response 47", "US") < pressOf("Clash Report", "US") && pressOf("Clash Report", "US") < LATER_RANK);
  assert.ok(pressOf("Clash Report", "US") < pressOf("Reuters", "US"));
  // Saudi Arabia: its official channels, then Saudi media, then the Gulf's.
  assert.ok(pressOf("Saudi Foreign Ministry", "SA") < pressOf("Al Arabiya", "SA"));
  assert.ok(pressOf("Al Hadath", "SA") < LATER_RANK && pressOf("Sky News Arabia", "SA") >= LATER_RANK);
  assert.ok(pressOf("Benjamin Netanyahu", "IL") >= 0 && pressOf("Benjamin Netanyahu", "IL") < pressOf("N12", "IL"));
  const at = Date.parse("2026-10-22T10:00:00Z");
  const keys = ["araghchi", "talks", "under", "fire"];
  const reads = [
    { source: "Iran International", url: "https://t.me/IranintlTV/1", text: "Araghchi: no talks under fire", at: at - 60_000 },
    { source: "Tasnim", url: "https://t.me/Tasnimnews_EN/1", text: "Araghchi says no talks under fire", at: at - 30_000 },
    { source: "Abbas Araghchi", url: "https://x.com/araghchi/status/1", text: "No talks under fire, says Araghchi", at: at - 90_000 },
  ];
  const own = (r: { source: string }) => r.source === "Abbas Araghchi";
  assert.deepEqual(pressCandidates(reads, { own, country: "IR" }, keys, at).map((c) => c.source), ["Abbas Araghchi", "Tasnim", "Iran International"]);
  // Another official's account before the regime's media, however well the medium matches.
  const spokesman = { source: "Esmaeil Baghaei (foreign ministry spokesman)", url: "https://x.com/IRIMFA_SPOX/status/1", text: "Araghchi talks", at: at - 20_000 };
  assert.deepEqual(pressCandidates([reads[1], spokesman], { own: () => false, country: "IR" }, ["araghchi", "talks"], at).map((c) => c.source)[0], spokesman.source);
  assert.deepEqual(earlierTellers(reads.slice(0, 2), { country: "IR", notSource: "Khabar Fori" }, keys, at).map((c) => c.source), ["Tasnim", "Iran International"]);
});

test("a US official's words: an American relay leads over a foreign one", () => {
  assert.equal(leadCountry("Trump: deal is close"), "US");
  assert.equal(leadCountry("Netanyahu: we will topple the regime"), "IL");
  assert.ok(moreOriginal({ source: "Clash Report", summary: "x" }, { source: "Iran International", summary: "Trump: deal is close" }));
  assert.ok(moreOriginal({ source: "White House", summary: "x" }, { source: "Clash Report", summary: "Trump: deal is close" }));
  assert.ok(!moreOriginal({ source: "Reuters", summary: "x" }, { source: "Clash Report", summary: "Trump: deal is close" }));
});

test("Lebanon Debate, Elnashra and Al-Joumhouria; the leaders' own accounts", () => {
  for (const n of ["Lebanon Debate", "Elnashra", "Al-Joumhouria"]) {
    assert.ok(LEBANESE_MEDIA.has(n), n);
    assert.ok(pressOf(n, "LB") >= 0, n);
  }
  const ids = new Set([...IRAN_X, ...IRAN_TG].map((s) => s.id));
  for (const id of ["netanyahu", "Israel_katz", "gidonsaar", "IraqiPMO", "IraqiGovt", "IDFofficial", "lebanondebate"]) assert.ok(ids.has(id), id);
});

test("Lebanon's prime minister is Nawaf Salam, not Mikati", () => {
  assert.equal(officeTitles("Lebanese PM Mikati: state has exclusive authority over weapons"), "Lebanese PM Nawaf Salam: state has exclusive authority over weapons");
  assert.equal(officeTitles("Lebanon's Prime Minister Najib Mikati said X. Mikati added Y."), "Lebanon's Prime Minister Nawaf Salam said X. Salam added Y.");
  assert.equal(officeTitles("Former Lebanese PM Najib Mikati met Berri"), "Former Lebanese PM Najib Mikati met Berri");
});
