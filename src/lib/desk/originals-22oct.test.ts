import { test } from "node:test";
import assert from "node:assert/strict";
import { countryIn, earlierTellers, firstHand, isRelayChannel, leadCountry, pressOf } from "./state-press.ts";
import { moreOriginal } from "./fold-same.ts";
import { passesIraqiMediaGate, passesLebaneseMediaGate, isIranWar } from "./iran-reader.ts";
import { msnNames } from "./full-text.ts";

// User, 22 Oct (second message): relays that name no source, the original never under "Also",
// Iran's officials' own accounts, Russia's media, NNA and INA, and Lebanon's and Iraq's politics.

test("Iran's officials' own accounts and Russia's media are their countries' own", () => {
  assert.ok(pressOf("Abbas Araghchi", "IR") >= 0);
  assert.ok(pressOf("Esmaeil Baghaei (foreign ministry spokesman)", "IR") >= 0);
  assert.ok(pressOf("Mohammad Bagher Ghalibaf (speaker)", "IR") >= 0);
  assert.equal(pressOf("Al-Manar", "IR"), -1); // Lebanese, though on the axis
  assert.ok(pressOf("RT Arabic", "RU") >= 0);
  assert.ok(pressOf("Maria Zakharova", "RU") >= 0);
  assert.ok(pressOf("NNA", "LB") >= 0);
  assert.ok(pressOf("INA", "IQ") >= 0);
});

test("the teller's country is the first one named", () => {
  assert.equal(leadCountry("Lebanese minister on Iran ties: talks go on"), "LB");
  assert.equal(leadCountry("Lavrov: Russia and Iran will keep working together"), "RU");
  assert.equal(leadCountry("SNSC secretary Rezaei: any move against Iran will have a cost"), "IR");
  assert.equal(countryIn("nothing here"), undefined);
});

test("a relay channel's unnamed item is matched to who told it first, the country's own media first", () => {
  assert.ok(isRelayChannel("Khabar Fori") && isRelayChannel("Akhbar-e Fori") && !isRelayChannel("IRNA"));
  const at = Date.parse("2026-10-22T08:00:00Z");
  const reads = [
    { source: "Iran International", url: "https://x.com/IranIntl/status/1", text: "Rezaei any move against Iran cost energy markets", at: at - 50 * 60_000 },
    { source: "SNN", url: "https://t.me/snntv/1", text: "رضایی: هر اقدامی علیه ایران هزینه دارد بازار انرژی", at: at - 40 * 60_000 },
    { source: "Khabari Plus", url: "https://t.me/khabari/1", text: "رضایی: هر اقدامی علیه ایران هزینه دارد بازار انرژی", at: at - 30 * 60_000 },
  ];
  const keys = ["Rezaei", "Iran", "energy", "markets", "cost", "رضایی", "ایران", "هزینه", "انرژی"];
  const got = earlierTellers(reads, { country: "IR", notSource: "Khabar Fori" }, keys, at);
  assert.deepEqual(got.map((c) => c.source), ["SNN", "Iran International"]); // no relay channel; Iran's own media first
});

test("the original leads the folded card and the relay goes under Also", () => {
  // The cited outlet itself.
  assert.ok(moreOriginal({ source: "WSJ", summary: "Iran's shadow fleet has run out of crude" }, { source: "Iran International", summary: "Iran's shadow fleet has run out of crude", citing: "WSJ" }));
  // The speaker's country's media over a relay channel or a foreign outlet.
  assert.ok(moreOriginal({ source: "Nour News", summary: "x" }, { source: "Akhbar-e Fori", summary: "SNSC secretary Rezaei: Iran's goal is to end the war" }));
  assert.ok(moreOriginal({ source: "IRNA", summary: "x" }, { source: "Al Mayadeen", summary: "Iranian defence minister: initiatives will bring progress" }));
  // Anyone who reports, over a relay channel.
  assert.ok(moreOriginal({ source: "Reuters", summary: "x" }, { source: "Akhbar-e Fori", summary: "Oil passes $111" }));
  // Never the other way round.
  assert.ok(!moreOriginal({ source: "Akhbar-e Fori", summary: "x" }, { source: "Nour News", summary: "SNSC secretary Rezaei: Iran's goal is to end the war" }));
  assert.ok(!moreOriginal({ source: "MTV Lebanon", summary: "x" }, { source: "Al-Manar", summary: "Israeli air strike hits Kfar Tibnit" }));
});

test("Lebanon's politics around Hezbollah and Iraq's militias pass their outlets' gates; routine news does not", () => {
  assert.ok(passesLebaneseMediaGate("مجلس الوزراء يناقش خطة الجيش لحصر السلاح"));
  assert.ok(passesLebaneseMediaGate("الرئيس نبيه بري استقبل السفير الأميركي"));
  assert.ok(passesLebaneseMediaGate("التحقيقات في قضية شاحنة المتفجرات"));
  assert.ok(!passesLebaneseMediaGate("نقابة عمال أوجيرو تعلن الإضراب الشامل غداً"));
  assert.ok(!passesLebaneseMediaGate("بريطانيا تعلن عن منحة للمدارس")); // "بري" inside another word
  assert.ok(passesIraqiMediaGate("البرلمان يؤجل التصويت على قانون الحشد الشعبي"));
  assert.ok(passesIraqiMediaGate("الإطار التنسيقي يحسم مرشحه لتشكيل الحكومة"));
  assert.ok(!passesIraqiMediaGate("الإعمار: توزيع الأراضي يشمل 4 محافظات"));
  // Russia's media in Russian.
  assert.ok(isIranWar("Лавров: Россия и Иран продолжат сотрудничество"));
});

test("MSN carries the Post, Times of Israel and Newsmax in full", () => {
  assert.ok(msnNames("https://www.washingtonpost.com/world/2026/10/21/x/", "Washington Post"));
  assert.ok(msnNames("https://www.timesofisrael.com/liveblog_entry/x/", "Times of Israel"));
  assert.ok(msnNames("https://www.newsmax.com/world/x/", "Newsmax"));
});

// User, 22 Oct: relays "can be og source if they report an exclusive thing, or in sirens attacks and stuff like that".
test("a relay channel's own exclusive, sirens or strike is its own", () => {
  assert.ok(firstHand({ summary: "Sirens sound in Haifa after launches from Lebanon" }));
  assert.ok(firstHand({ summary: "Explosions heard in Isfahan; air defence active" }));
  assert.ok(firstHand({ summary: "Exclusive: IRGC moved missile launchers to the coast" }));
  assert.ok(firstHand({ summary: "x", flags: ["exclusive"] }));
  assert.ok(firstHand({ text: "دوي انفجارات في أصفهان" }));
  assert.ok(!firstHand({ summary: "Araghchi: the attack on our facilities was a crime" }));
  assert.ok(!firstHand({ summary: "Oil passes $111" }));
  // A relay telling sirens first keeps the lead over the outlet that told it after.
  assert.ok(!moreOriginal({ source: "Reuters", summary: "x" }, { source: "Sabereen News", summary: "Sirens sound in Haifa after launches from Lebanon" }));
  assert.ok(moreOriginal({ source: "Reuters", summary: "x" }, { source: "Sabereen News", summary: "Oil passes $111" }));
  // Its item is matched only to one who told it before.
  const at = Date.parse("2026-10-22T10:00:00Z");
  const keys = ["sirens", "haifa", "launches", "lebanon"];
  const reads = [{ source: "Al Mayadeen", url: "https://t.me/almayadeen/1", text: "Sirens in Haifa after launches from Lebanon", at: at + 5 * 60_000 }];
  assert.equal(earlierTellers(reads, { notSource: "Sabereen News", onlyBefore: true }, keys, at).length, 0);
  assert.equal(earlierTellers(reads, { notSource: "Sabereen News" }, keys, at).length, 1);
  // Another relay's earlier first-hand item counts as a teller; its relayed words do not.
  const relays = [
    { source: "Khabar Fori", url: "https://t.me/khabarfori/1", text: "Sirens in Haifa after launches from Lebanon", at: at - 60_000 },
    { source: "Akhbar-e Fori", url: "https://t.me/akhbarefori/1", text: "Oil passes $111 a barrel in Asia trade", at: at - 60_000 },
  ];
  assert.deepEqual(earlierTellers(relays, { notSource: "Sabereen News" }, keys, at).map((c) => c.source), ["Khabar Fori"]);
});
