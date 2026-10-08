/** Who leads a card on a leader's words (user, 8 Oct). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { nearerToSpeaker, pressNation, speakerNation } from "./speaker-press.ts";

test("a leader's words are led by his own country's press", () => {
  const h = "Trump says US will not attack Iran before November 3 midterm elections, holds constructive talks";
  assert.equal(speakerNation(h), "us");
  const ajm = { source: "Al Jazeera Mubasher", lean: "gulf" };
  assert.ok(nearerToSpeaker(h, { source: "CNN", lean: "us" }, ajm));
  assert.ok(nearerToSpeaker(h, { source: "Bloomberg.com", lean: "intl" }, ajm));
  assert.ok(!nearerToSpeaker(h, { source: "VOA Farsi", lean: "us" }, ajm), "the US government's Persian service relays");
  assert.ok(!nearerToSpeaker(h, ajm, { source: "CNN", lean: "us" }), "never the other way");
  assert.ok(nearerToSpeaker("Araghchi says Iran will answer within days", { source: "Tasnim", lean: "axis" }, { source: "Al Arabiya", lean: "gulf" }));
  assert.equal(pressNation("Al Mayadeen", "axis"), null, "Beirut relays Tehran");
  assert.ok(!nearerToSpeaker("Explosions heard in Isfahan", { source: "Tasnim", lean: "axis" }, ajm), "no speaker, no rule");
});
