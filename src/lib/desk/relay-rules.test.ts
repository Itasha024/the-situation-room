import { test } from "node:test";
import assert from "node:assert/strict";
import { decideIranForTest } from "./editor.ts";
import { parseTruthFeed, truthMatch } from "./originals.ts";
import { repairable } from "./reader.ts";
import { attackTeller } from "./speaker-press.ts";

const at = Date.parse("2026-10-08T19:44:56Z");
const feed = `<rss><channel><pubDate>Thu, 08 Oct 2026 18:59:10 +0000</pubDate>
<item><title><![CDATA[The Fake and Artificial News is out there…]]></title><link>https://www.trumpstruth.org/statuses/42204</link>
<description><![CDATA[<p>The Fake and Artificial News is out there trying to say that I’m inviting the enemy to bomb San Diego and Los Angeles when, in actuality, what I was talking about was that a temporary increase in the price of Gasoline is a small price to pay for Iran not having a Nuclear Weapon</p>]]></description><pubDate>Thu, 08 Oct 2026 18:59:10 +0000</pubDate></item>
<item><title><![CDATA[TalaFREAKo has been missing for 12 days!]]></title><link>https://www.trumpstruth.org/statuses/42203</link>
<description><![CDATA[<p>TalaFREAKo has been missing for 12 days! We need a Senator like Ken Paxton.</p>]]></description><pubDate>Thu, 08 Oct 2026 17:01:09 +0000</pubDate></item>
</channel></rss>`;

test("Trump's words relayed are traced to his own Truth Social post", () => {
  const posts = parseTruthFeed(feed);
  assert.equal(posts.length, 2);
  const hit = truthMatch(posts, ["gasoline", "price", "nuclear", "temporary", "Iran"], at);
  assert.equal(hit?.url, "https://www.trumpstruth.org/statuses/42204");
  assert.equal(hit?.source, "Truth Social (Trump)");
  // Another day's words, or a post on something else, are not his original.
  assert.equal(truthMatch(posts, ["gasoline", "price", "nuclear", "temporary", "Iran"], at + 3 * 86400_000), null);
  assert.equal(truthMatch(posts, ["Hormuz", "tanker", "blockade"], at), null);
});

test("a government's own post turned away as commentary is sent back as its words", () => {
  const v = decideIranForTest({ publish: false, reject_reason: "commentary" } as never, "a temporary increase in the price of Gasoline is a small price to pay for Iran not having a Nuclear Weapon", "Truth Social (Trump)", "us");
  assert.equal(v.kind, "reject");
  assert.equal((v as { reason: string }).reason, "reader-check");
  assert.ok(repairable((v as { note: string }).note));
  // An outlet's commentary stays commentary.
  const o = decideIranForTest({ publish: false, reject_reason: "commentary" } as never, "Iran nuclear", "Vahid Online", "opposition");
  assert.equal((o as { reason: string }).reason, "reader");
});

test("Israel's attacks in Lebanon come from Lebanon's own sources only", () => {
  assert.match(attackTeller("Israeli shelling targets Baraashit town in Bint Jbeil district, south Lebanon", "Al-Alam", "israel", true) ?? "", /Lebanon's own sources/);
  assert.equal(attackTeller("Israeli strike hits a car in Nabatieh, south Lebanon", "Al Mayadeen", "israel", true), null);
  assert.equal(attackTeller("Israeli army shelling hits outskirts of Khiam", "Lebanese Army", "israel", true), null);
  assert.equal(attackTeller("IDF: struck Hezbollah launchers in south Lebanon", "IDF Arabic", "israel", true), null);
  // Not an attack, or not Israel's: other rules decide.
  assert.equal(attackTeller("Israel says Lebanon talks resume", "Al-Alam", "israel", false), null);
  const v = decideIranForTest(
    { publish: true, headline: "Israeli shelling targets Baraashit town in Bint Jbeil district, south Lebanon", body: "", event_type: "shelling", actor_side: "israel", targets: ["Baraashit"], confident_roles: true } as never,
    "قصف مدفعي إسرائيلي يستهدف بلدة برعشيت في قضاء بنت جبيل جنوب لبنان",
    "Al-Alam",
  );
  assert.equal(v.kind, "reject");
});

test("another war is not the Iran desk's", () => {
  const v = decideIranForTest(
    { publish: true, headline: "Kremlin spokesman: Russia agrees with US Secretary of State assessment that the Ukraine war has reached a deadlock", body: "", event_type: "statement", speaker_lead: "Kremlin spokesman", actor_side: "other", arenas: ["talks"], confident_roles: true } as never,
    "Kremlin spokesman Peskov: Russia agrees with the US Secretary of State that the Ukraine war has reached a deadlock",
    "Iran International",
    "opposition",
  );
  assert.equal(v.kind, "reject");
  assert.match((v as { note: string }).note, /Ukraine/);
});

test("Israel is told from its own sources, whoever retells it; air strikes in Lebanon too (live cards, 9 Oct)", async () => {
  const { rivalRelay } = await import("./speaker-press.ts");
  const { israelAbroad, isIranDeskItem, passesIsraeliMediaGate } = await import("./iran-reader.ts");
  // Tasnim's air strike on Al-Mansouri: a strike, not shelling, went past the Lebanon rule.
  const v = decideIranForTest(
    { publish: true, headline: "Israeli airstrike reported on Al-Mansouri in southern Lebanon", body: "", event_type: "air_strike", actor_side: "israel", targets: ["Al-Mansouri"], confident_roles: true } as never,
    "غارة إسرائيلية على بلدة المنصوري جنوب لبنان",
    "Tasnim",
  );
  assert.equal(v.kind, "reject");
  assert.match(rivalRelay("IDF confirms Maj. Elyav Haim Tzlafmos killed in helicopter crash in south Lebanon", "Al-Alam", "axis") ?? "", /relay/);
  assert.match(rivalRelay("Israeli Channel 12: US officials told Eyal Zamir the White House issued a prepare-to-strike order", "Iran International", "opposition") ?? "", /relay/);
  assert.match(rivalRelay("Israeli army: struck Hezbollah sites", "Al Arabiya", "gulf") ?? "", /relay/);
  assert.equal(rivalRelay("IDF: struck Hezbollah launchers in south Lebanon", "N12", "israel"), null);
  assert.equal(rivalRelay("Israeli officials: Iran is rebuilding its launchers", "Al Arabiya", "gulf", true), null);
  // Israel's war beyond its borders is the Iran desk's; its home affairs are not.
  assert.ok(israelAbroad("Israeli airstrike kills four in Khan Younis, Gaza"));
  assert.ok(isIranDeskItem("غارة إسرائيلية تستهدف سيارة في النبطية جنوب لبنان"));
  assert.ok(!isIranDeskItem("Israeli court delays Netanyahu testimony"));
  assert.ok(passesIsraeliMediaGate("צה\"ל תקף מטרות של חמאס ברצועת עזה"));
  assert.ok(!passesIsraeliMediaGate("צה\"ל: גיוס חרדים יורחב בשנה הבאה"));
});
