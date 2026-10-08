/**
 * Round 30 stage 4c: the Israeli outlets on the Iran desk. Israel's own
 * reporting on the Iran war passes; Israel's other news and relays of foreign
 * outlets do not; exclusives do.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { passesIsraeliMediaGate } from "./iran-reader.ts";
import { IRAN_NOT_READ, IRAN_RSS, IRAN_TG, ISRAELI_MEDIA, iranLeanOf } from "./iran-sources.ts";

test("Israeli media: the Iran war passes, in Hebrew with its prefixes and in English", () => {
  assert.ok(passesIsraeliMediaGate("בכיר ישראלי: באיראן נערכים לסבב נוסף"));
  assert.ok(passesIsraeliMediaGate("צה\"ל תקף מטרות של חיזבאללה בדרום לבנון"));
  assert.ok(passesIsraeliMediaGate("הערכה בישראל: ויטקוף ייפגש עם עראקצ'י בשבוע הבא"));
  assert.ok(passesIsraeliMediaGate("Israeli officials: Tehran rebuilding missile launchers"));
});

test("Israeli media: Israel's other news does not pass", () => {
  assert.ok(!passesIsraeliMediaGate("הכנסת אישרה בקריאה ראשונה את חוק התקציב"));
  assert.ok(!passesIsraeliMediaGate("תאונה קטלנית בכביש 6"));
  assert.ok(!passesIsraeliMediaGate("שיעורי העשרה לתלמידים בחופשה"));
  assert.ok(!passesIsraeliMediaGate("הגרעין הקשה של הליכוד נגד המהלך"));
});

test("Israeli media: a relay of a foreign outlet is dropped, an exclusive is kept", () => {
  assert.ok(!passesIsraeliMediaGate("לפי רויטרס, איראן מעבירה טילים לעיראק"));
  assert.ok(!passesIsraeliMediaGate("דיווח באל-ג'זירה: איראן הציבה תנאים חדשים"));
  assert.ok(!passesIsraeliMediaGate("כך דווח בניו יורק טיימס: טהרן שוקלת את ההצעה"));
  assert.ok(!passesIsraeliMediaGate("Axios: Iran rejected the US proposal"));
  assert.ok(!passesIsraeliMediaGate("Iran is moving missiles to Iraq, according to Reuters"));
  assert.ok(passesIsraeliMediaGate("פרסום ראשון: ישראל העבירה לוושינגטון מידע על אתר גרעיני באיראן, לפי רויטרס"));
  // An outlet named far down an Israeli report does not make it a relay.
  assert.ok(passesIsraeliMediaGate(`גורם ביטחוני: איראן משקמת את מערך הטילים. ${"פרטים נוספים. ".repeat(20)} לפי רויטרס, גם ארה"ב יודעת על כך`));
  // "map" is not AP.
  assert.ok(passesIsraeliMediaGate("IDF map reports strikes near Isfahan"));
});

test("Israeli media: every outlet is in the Israeli group, and the blocked ones are listed", () => {
  for (const n of ["N12", "Walla", "Ynet", "Jerusalem Post", "Haaretz", "Channel 14", "Israel Hayom", "Kan", "Channel 13", "i24 News", "Amit Segal"]) {
    assert.ok(ISRAELI_MEDIA.has(n), n);
    assert.equal(iranLeanOf(n), "israel", n);
  }
  assert.ok(!ISRAELI_MEDIA.has("IDF Farsi"), "the IDF speaks for itself, not as an outlet");
  assert.ok(IRAN_RSS.some((f) => f.id === "iaea"));
  assert.ok(IRAN_TG.some((t) => t.id === "i24news_he"));
  for (const w of ["ukmto.org", "now14.co.il", "the IAEA's Iran page"]) assert.ok(IRAN_NOT_READ.some((n) => n.what.includes(w)), w);
  const ids = [...IRAN_TG, ...IRAN_RSS].map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "no source twice");
});

test("Israeli media: a foreign government's words or acts are a relay; Israel's own side passes", () => {
  // N12's post of 8 Oct, 20:06: the US Treasury's sanctions, from its foreign desk.
  assert.ok(!passesIsraeliMediaGate(`דסק החוץ ארה"ב הטילה סנקציות על 17 כלי שיט בגין העברת נפט איראני גולמי. בכיר במשרד האוצר האמריקני אמר כי ארה"ב מעריכה שלאיראן נותרו 20 מיליון חביות נפט`));
  assert.ok(!passesIsraeliMediaGate(`ארה"ב הטילה סנקציות חדשות על צי הצללים של איראן`));
  assert.ok(!passesIsraeliMediaGate("טראמפ: איראן תשלם מחיר כבד אם תתקוף"));
  assert.ok(!passesIsraeliMediaGate("שיט במצרי הורמוז: מכלית נעצרה"));
  assert.ok(passesIsraeliMediaGate("גורמים ביטחוניים: איראן מעבירה טילים לעיראק"));
  assert.ok(passesIsraeliMediaGate("נתניהו כינס את הקבינט לדיון על איראן"));
});
