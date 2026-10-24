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
