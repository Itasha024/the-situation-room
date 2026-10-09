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

test("a public statement a site labels its own is not an exclusive; one given to it alone is (user, 9 Oct)", () => {
  assert.equal(isExclusive("خاص | وزارة الخارجية السورية في بيان: سوريا تدين الهجمات الحوثية على السعودية", "Aden al-Ghad"), false);
  assert.equal(isExclusive("Exclusive: Trump posted on Truth Social that Iran must surrender", "Human Events"), false);
  assert.equal(isExclusive("خاص | قال وزير الدفاع في حديث خاص لـ«عدن الغد» إن البيان الحكومي جاهز", "Aden al-Ghad"), true);
  assert.equal(isExclusive("Exclusive: Hegseth tells Jack Posobiec the US is not nation-building in Iran", "Human Events"), true);
  // "Outlet/خاص" is a staff byline, not a label.
  assert.equal(isExclusive("المصدر: عدن الغد /خاص هزت انفجارات عنيفة، مساء الخميس، العاصمة صنعاء", "Aden al-Ghad"), false);
  assert.equal(isExclusive("كريتر سكاي/خاص: هزّت ثلاثة انفجارات متتالية معسكر الأمن والمخابرات", "Crater Sky"), false);
  assert.equal(isExclusive("حصري | وثائق تكشف شحنات أسلحة إلى الحديدة", "Almashhad"), true);
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

test("own information is read loosely: outlets word it many ways", async () => {
  const { ownInformation } = await import("./exclusive.ts");
  assert.equal(ownInformation("Officials speaking with Arab News said the talks had stalled", "Arab News"), true);
  assert.equal(ownInformation("Documents reviewed by Asharq Al-Awsat show the shipments", "Asharq Al-Awsat"), true);
  assert.equal(ownInformation("Arab News understands the delegation arrived on Monday", "Arab News"), true);
  assert.equal(ownInformation("Alhurra's correspondent in Marib reported heavy clashes", "Alhurra"), true);
  assert.equal(ownInformation("وأبلغ مصدر عسكري «إرم نيوز» أن القوات تقدمت", "Erem News"), true);
  assert.equal(ownInformation("ونفى المتحدث في اتصال مع «العربي الجديد» الأنباء", "Al-Araby Al-Jadeed"), true);
  assert.equal(ownInformation("وأفاد مراسل الحرة بأن الاشتباكات تجددت", "Alhurra"), true);
  assert.equal(ownInformation("وثيقة اطلعت عليها «الشرق الأوسط» تظهر الخطة", "Asharq Al-Awsat"), true);
  assert.equal(ownInformation("وقال شهود لـ«العربي الجديد» إن الغارات استهدفت المدينة", "Al-Araby Al-Jadeed"), true);
  assert.equal(ownInformation("ذكرت وكالة رويترز أن المحادثات توقفت", "Al-Araby Al-Jadeed"), false);
  assert.equal(ownInformation("The Saudi-led coalition said it intercepted a drone", "Arab News"), false);
});

test("Al-Akhbar's morning exclusive on Telegram, with the outlet as the verb's object, is its own", () => {
  const post = "أفادت مصادر استخباراتية في صنعاء، «الأخبار»، بأن «أنصار الله» نفّذت، فجر أمس، عملية أخرى في منطقة الملاحيط";
  assert.equal(isExclusive(post, "Al-Akhbar"), true);
  // "the news" as a plain word is not the outlet.
  assert.equal(isExclusive("أفادت مصادر محلية بأن الأخبار الواردة من صعدة تتحدث عن غارات", "Al-Akhbar"), false);
});
