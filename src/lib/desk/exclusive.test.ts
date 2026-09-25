import { test } from "node:test";
import assert from "node:assert/strict";
import { isExclusive } from "./exclusive.ts";

test("an outlet's own exclusive is known, in English and Arabic", () => {
  assert.equal(isExclusive("Exclusive: Houthis reinforce Hodeidah defenses as new Red Sea attack is prepared", "Sheba Intelligence"), true);
  assert.equal(isExclusive("Egypt seeks Yemen de-escalation as Saudi options narrow, Egyptian sources told Al-Akhbar", "Al-Akhbar"), true);
  assert.equal(isExclusive("علمت «الأخبار» أن الرياض طلبت من القاهرة التوسط", "Al-Akhbar"), true);
  assert.equal(isExclusive("قالت مصادر عسكرية لـ«سهيل» إن القوات تقدمت في الوازعية", "Suhail"), true);
  assert.equal(isExclusive("حصري | وثائق تكشف شحنات أسلحة إلى الحديدة", "Almashhad"), true);
  assert.equal(isExclusive("Sheba Intelligence has learned that a senior commander was flown out", "Sheba Intelligence"), true);
});

test("an ordinary report is not an exclusive", () => {
  assert.equal(isExclusive("Houthi drone hits government positions in Al-Dhale", "Suhail"), false);
  assert.equal(isExclusive("وأكد بشكل خاص على أهمية دعم القوات", "Suhail"), false);
  assert.equal(isExclusive("A US official told Reuters the talks stalled", "Al-Akhbar"), false);
  assert.equal(isExclusive("قالت مصادر لـ«العربية» إن الهجوم فشل", "Al-Akhbar"), false);
});

test("the six sites give only their own information: exclusives, their sources, words said to them", async () => {
  const { ownInformation } = await import("./exclusive.ts");
  assert.equal(ownInformation("Houthi missile hits Jizan, Saudi Press Agency says", "Arab News"), false);
  assert.equal(ownInformation("A senior Yemeni official told Arab News the offensive would resume", "Arab News"), true);
  assert.equal(ownInformation("Reuters: talks stall in Muscat", "Asharq Al-Awsat"), false);
  assert.equal(ownInformation("Anything at all", "Reuters"), true);
  assert.equal(ownInformation("وقال مصدر عسكري لـ«الشرق الأوسط» إن القوات تقدمت في حيس", "Asharq Al-Awsat"), true);
  assert.equal(ownInformation("وأكد مسؤول حكومي للشرق الأوسط أن الهجوم فشل", "Asharq Al-Awsat"), true);
  assert.equal(ownInformation("قال وزير الخارجية في حديث خاص لإرم نيوز إن المفاوضات متوقفة", "Erem News"), true);
  assert.equal(ownInformation("أعلنت وكالة الأنباء السعودية اعتراض صاروخ فوق جيزان", "Erem News"), false);
  assert.equal(ownInformation("علمت «الأخبار» أن الوفد السعودي وصل إلى مسقط", "Al-Akhbar"), true);
  assert.equal(ownInformation("قال المتحدث في مقابلة مع الحرة إن الضربات ستستمر", "Alhurra"), true);
});
