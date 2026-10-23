import { test } from "node:test";
import assert from "node:assert/strict";
import { SWEEP_GROUPS, SWEEP_QUERIES } from "./online-search.server.ts";

// User, 23 Oct: "automated regular searches in all social media platforms by many hundreds of keywords".
test("hundreds of searches, grouped for the engines that charge", () => {
  assert.ok(SWEEP_QUERIES.length > 400);
  assert.ok(SWEEP_GROUPS.length > 100);
  assert.ok(SWEEP_GROUPS.every((g) => / OR /.test(g) && /فلسطين/.test(g)));
});
