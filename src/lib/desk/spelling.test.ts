import { test } from "node:test";
import assert from "node:assert/strict";
import { respell, spellingHints } from "./spelling.ts";

test("a known person or place is written the desk's one way", () => {
  assert.equal(
    respell("Houthi leader Abdel-Malek al-Houthi says Yahya Sarea announced strikes on Hudaydah and Al Jawf"),
    "Houthi leader Abdul-Malik al-Houthi says Yahya Saree announced strikes on Hodeidah and Al-Jawf",
  );
  assert.equal(respell("Clashes in al-Jawf, Ma'rib and Sa'dah; Jizan hit; Tarek Saleh visits Mokha"), "Clashes in Al-Jawf, Marib and Saada; Jazan hit; Tareq Saleh visits Mocha");
  assert.equal(respell("Aidroos al-Zubaidi meets Rashad al-Aleemi; Muammar al-Iryani condemns"), "Aidarous al-Zubaidi meets Rashad al-Alimi; Muammar al-Eryani condemns");
  assert.equal(respell("Mohamed Abdul Salam: talks with Khaled bin Salman; Bab el-Mandeb"), "Mohammed Abdulsalam: talks with Khalid bin Salman; Bab al-Mandab");
});

test("respelling leaves right spellings, other names and words alone", () => {
  const ok = "Houthi forces shelled Al-Jawf and Hodeidah; Perim island; Hodeidah port";
  assert.equal(respell(ok), ok);
  assert.equal(respell("The Jawfi tribe"), "The Jawfi tribe");
});

test("the reader is told how the post's names are written", () => {
  const h = spellingHints("قال العميد يحيى سريع إن القوات استهدفت الحديدة وبمأرب، وأكد عيدروس الزبيدي");
  assert.match(h, /يحيى سريع = Yahya Saree/);
  assert.match(h, /عيدروس الزبيدي = Aidarous al-Zubaidi/);
  assert.match(h, /الحديدة = Hodeidah/);
  assert.match(h, /مأرب = Marib/);
  assert.equal(spellingHints("An English post about Sanaa"), "");
});
