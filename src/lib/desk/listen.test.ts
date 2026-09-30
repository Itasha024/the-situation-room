import { test } from "node:test";
import assert from "node:assert/strict";
import { usableTranscript, worthListening } from "./listen.ts";

test("a transcript of music or a stuck model is thrown away", () => {
  assert.equal(usableTranscript("ترجمة نانسي قنقر"), null);
  assert.equal(usableTranscript("short"), null);
  assert.equal(usableTranscript(Array(30).fill("الله").join(" ")), null);
  assert.ok(usableTranscript("نحن في جبهة الوازعية وقد تقدمت قواتنا إلى جبل الأغبر بعد معارك استمرت ثلاثة أيام"));
});

test("which videos are listened to: kept posts, and short captions from sources on this war", () => {
  const video = { kind: "video" as const, from: "x" as const, post: "p", thumb: "t", src: "https://video.twimg.com/a.mp4", duration: 40 };
  assert.equal(worthListening({ source: "Yemeni Army Media", url: "u1", text: "شاهد", lean: "gov", media: video }), true);
  assert.equal(worthListening({ source: "Yemeni Army Media", url: "u1", text: "شاهد", lean: "gov", media: { ...video, duration: 1800 } }), false);
  assert.equal(worthListening({ source: "Yemeni Army Media", url: "u1", text: "شاهد", lean: "gov", media: { ...video, src: undefined } }), false);
  // An Iranian channel's video about something else is not sent.
  assert.equal(worthListening({ source: "Fars News", url: "u2", text: "بازدید رئیس جمهور از نمایشگاه کتاب", lean: "intl", media: video }), false);
});
