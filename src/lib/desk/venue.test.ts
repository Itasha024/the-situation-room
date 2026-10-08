import { test } from "node:test";
import assert from "node:assert/strict";
import { findVenue, urlDay, venueCandidates } from "./venue.ts";
import { leadSpeaker, speakerOf } from "./speakers.ts";

const hegseth = { name: "Pete Hegseth" };
const at = Date.parse("2026-10-08T18:51:20Z");
const israeli = (h: string) => /jfeed\.com|co\.il/.test(h);

test("the venue is a headline naming him and an interview, from the day, not a relay", () => {
  const got = venueCandidates(
    [
      { url: "https://www.jfeed.com/news-world/tmkyrx", title: "Hegseth tells US gave Iran navy the bottom half" },
      { url: "https://www.godlikeproductions.com/forum1/message6212747/pg1", title: "Pete Hegseth Tells Jack Posobiec The Major Hasan Execution Will be Public" },
      { url: "https://humanevents.com/2026/10/08/exclusive-pete-hegseth-tells-jack-posobiec", title: "EXCLUSIVE: PETE HEGSETH TELLS JACK POSOBIEC THE MAJOR HASAN EXECUTION WILL BE PUBLIC" },
      { url: "https://humanevents.com/2026/09/30/hegseth-interview", title: "Hegseth interview" },
      { url: "https://www.nytimes.com/2026/10/08/podcasts/retreat-trump-hegseth.html", title: "A Forced Retreat for Trump and Hegseth" },
      { url: "https://x.com/JackPosobiec/status/2108264835855036877", title: "Jack Posobiec on X: EXCLUSIVE: PETE HEGSETH TELLS ..." },
    ],
    hegseth,
    at,
    israeli,
  );
  assert.deepEqual(got.map((r) => r.url), [
    "https://humanevents.com/2026/10/08/exclusive-pete-hegseth-tells-jack-posobiec",
    "https://x.com/JackPosobiec/status/2108264835855036877",
  ]);
  assert.equal(urlDay("https://a.com/2026-10-08-x"), "2026-10-08");
});

test("an outlet's own article found by the venue search leads under the outlet's name", async () => {
  const v = await findVenue(hegseth, at, israeli, async (q) =>
    q.endsWith("tells") ? [{ url: "https://humanevents.com/2026/10/08/exclusive-pete-hegseth-tells-jack-posobiec", title: "EXCLUSIVE: PETE HEGSETH TELLS JACK POSOBIEC" }] : [],
  );
  assert.equal(v?.source, "Human Events");
  assert.equal(v?.told, true);
});

test("the speaker is the one named first, not the one first on the list", () => {
  assert.equal(speakerOf("Hegseth: Trump wants peace but will do whatever it takes")?.name, "Pete Hegseth");
  assert.equal(speakerOf("Trump says Hegseth will brief Congress")?.name, "Donald Trump");
  assert.equal(leadSpeaker("Hegseth: Trump wants peace")?.name, "Pete Hegseth");
  assert.equal(leadSpeaker("US Defence Secretary Hegseth says Iran chooses the hard way")?.name, "Pete Hegseth");
  assert.equal(leadSpeaker("Iran's foreign ministry spokesman: talks are off"), null);
});
