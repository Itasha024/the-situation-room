/** The Arab sites' sweep (user, 24 Oct): every site listed, each article for a desk sent to it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SWEEP_FEEDS, desksFor } from "../site-sweep.server.ts";
import { feedById } from "../yemen-scan.server.ts";

test("every swept site has a listing", () => {
  for (const id of SWEEP_FEEDS) assert.ok(feedById(id), id);
});

test("an article goes to the desks its headline is for", () => {
  assert.deepEqual(desksFor({ source: "Asharq Al-Awsat", title: "مصادر: إيران ترفض شروط واشنطن لاستئناف المفاوضات", text: "" }), ["iran"]);
  assert.deepEqual(desksFor({ source: "Al-Araby Al-Jadeed", title: "مصادر: حماس تسلم الوسطاء ردها على خطة نزع السلاح في غزة", text: "" }), ["gaza"]);
});

// 24 Oct: Al-Akhbar English's front page links pieces of September and March with no date.
test("a Next.js page's own date, escaped or not", async () => {
  const { pageDate } = await import("./sitemap.ts");
  assert.equal(pageDate(String.raw`"seo":{"type":"article","publishedTime\":\"2026-09-09T12:58:18+03:00\",`), Date.parse("2026-09-09T12:58:18+03:00"));
  assert.equal(pageDate(`{"publishedTime":"2026-10-23T11:25:00+03:00"}`), Date.parse("2026-10-23T11:25:00+03:00"));
});
