import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarHints, findCalendarDates, fromCalendar, toCalendar } from "./calendars.ts";

test("Iran's solar calendar to the ordinary one, and back", () => {
  assert.equal(fromCalendar("persian", 1405, 7, 7)?.toISOString().slice(0, 10), "2026-09-29");
  assert.equal(fromCalendar("persian", 1405, 1, 1)?.toISOString().slice(0, 10), "2026-03-21");
  assert.deepEqual(toCalendar("persian", new Date(Date.UTC(2026, 8, 28))), [1405, 7, 6]);
});

test("the lunar Hijri date Al-Masirah prints", () => {
  const d = fromCalendar("islamic-umalqura", 1447, 4, 17);
  assert.ok(d);
  const found = findCalendarDates("الاثنين 17-04-1447هـ 28-09-2026م");
  assert.equal(found.length, 1);
  assert.equal(found[0].cal, "islamic-umalqura");
});

test("Persian dates in a post, with Persian digits and the ماه suffix", () => {
  const now = new Date(Date.UTC(2026, 8, 28));
  const f = findCalendarDates("حمله در ۷ مهرماه ۱۴۰۵ و همچنین ۵ مهر", now);
  assert.deepEqual(f.map((x) => x.en), ["29 September 2026", "27 September 2026"]);
  assert.match(calendarHints("۱۴۰۵/۰۷/۰۷", now), /29 September 2026/);
});
