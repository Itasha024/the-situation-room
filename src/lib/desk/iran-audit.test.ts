/**
 * The Iran desk's audit of 8 Oct: cards that went out against the site's
 * rules, replayed through the Iran editor. Each is now rejected (and the
 * repairable ones sent back with the fault), or its words fixed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { decideIranForTest } from "./editor.ts";
import { repairable, type Reading } from "./reader.ts";

const reading = (o: Partial<Reading>): Reading =>
  ({ id: "a", publish: true, event_type: "statement", headline: "", body: "", speaker_lead: "", actor_side: "iran", arenas: [], targets: [], origins: [], has_time: false, confident_roles: true, follows_up: "", duplicate_of: "", reject_reason: "", interest: "neutral", ...o }) as Reading;
const verdict = (headline: string, text: string, o: Partial<Reading> = {}) => decideIranForTest(reading({ headline, ...o }), text, "Vahid Online", "opposition");

test("an outlet never tells the story", () => {
  for (const h of [
    "Reuters says Iran executed at least 34 people linked to protests",
    "Iran International reports public anger over alleged $200m aid to Hezbollah",
    "CNN cites Congress report: US lost $3.3bn in aircraft in war with Iran",
    "Akhbar-e Fori posts Rubio quote: no action against Iran we cannot do",
    "Iran International poll: 68% say US pressure hurts people more than the government",
    "WiWo reports: Iranian intelligence targets US military bases in Germany",
  ]) {
    const v = verdict(h, "رويترز ۳۴ اعدام 200 مليون 3.3 مليار 68 Rubio WiWo");
    assert.equal(v.kind, "reject", h);
    assert.ok(v.kind === "reject" && repairable(v.note), `sent back to be rewritten: ${h}`);
  }
  // A party's media as the teller of its claim is the prompt's own form.
  assert.equal(verdict("Iranian media: US strike hit a school in Minab, killing 5", "رسانه‌های ایران: حمله آمریکا به مدرسه‌ای در میناب ۵ کشته").kind, "publish");
  assert.equal(verdict("Araghchi says Iran will respond to US proposals within days", "عراقچی: ایران ظرف چند روز پاسخ می‌دهد", { event_type: "diplomacy" }).kind, "publish");
});

test("commentary is not a report", () => {
  for (const h of ["Iran International analyst says Pezeshkian's plan shows preparation for confrontation", "Atwan: Trump seeks to shift Iran war costs onto Arab states", "Hochstein says a 'secret war' is under way in Iran"]) {
    const v = verdict(h, "تحلیلگر Atwan Hochstein Pezeshkian Trump");
    assert.equal(v.kind, "reject", h);
    assert.equal(v.kind === "reject" && v.reason, "reader", "a rejection, not a rewrite");
  }
});

test("the Houthis' war with Saudi Arabia goes to the Yemen desk", () => {
  assert.equal(verdict("Lufthansa and Air India suspend flights to Riyadh after Houthi ballistic missile attack on King Khalid airport", "لوفت‌هانزا ریاض حوثی ملک خالد", { event_type: "economy" }).kind, "reject");
  assert.equal(verdict("Saudi civil defence says intercepted missile debris damaged a nursery in Riyadh", "الدفاع المدني ریاض", { event_type: "air_strike" }).kind, "reject");
  assert.equal(verdict("Houthis say they fired a missile at Eilat", "الحوثي إيلات صاروخ", { event_type: "missile_launch" }).kind, "publish");
});

test("no million the text never gave", () => {
  const v = verdict("Trump says 22 million barrels of oil passed through Hormuz last night", "ترمب: 22 برميل من النفط عبر مضيق هرمز الليلة الماضية وحدها");
  assert.equal(v.kind, "reject");
  assert.equal(verdict("Trump says 22 million barrels of oil passed through Hormuz last night", "ترمب: 22 مليون برميل من النفط عبر مضيق هرمز").kind, "publish");
});

test("a statement keeps the teller its text opens with", () => {
  const v = verdict("Hezbollah has brought only misery to Lebanon", "‏الخارجية الأميركية للحدث:  حزب الله لم يجلب سوى البؤس للبنان");
  assert.equal(v.kind, "reject");
  assert.ok(v.kind === "reject" && /does not lead with its speaker/i.test(v.note) && /الخارجية الأميركية للحدث/.test(v.note));
  assert.equal(verdict("US State Department: Hezbollah has brought only misery to Lebanon", "‏الخارجية الأميركية للحدث:  حزب الله لم يجلب سوى البؤس للبنان", { speaker_lead: "US State Department" }).kind, "publish");
});

test("the sources' loaded words are reworded; \"Iranian regime\" stays", () => {
  const v = verdict("UAE bans 472 vessels linked to Iranian regime from its ports", "472 شناور مرتبط با رژیم ایران", { event_type: "economy" });
  assert.equal(v.kind, "publish");
  assert.equal(v.kind === "publish" && v.report.summary, "UAE bans 472 vessels linked to Iranian regime from its ports");
  const w = verdict("Basij says Hormuz shows Islamic Iran's capability", "منظمة تعبئة المستضعفين: مضيق هرمز يظهر اقتدار إيران الإسلامية", { speaker_lead: "Basij" });
  assert.ok(w.kind === "publish" && !/Islamic Iran/.test(w.report.summary), w.kind === "publish" ? w.report.summary : w.note);
});

test("missiles intercepted over Riyadh with no attacker named are the Yemen desk's; Iran's fire on Saudi Arabia is not", () => {
  assert.equal(verdict("Saudi Arabia intercepted two ballistic missiles over Riyadh", "اعتراض صاروخين باليستيين في سماء الرياض", { event_type: "interception" }).kind, "reject");
  assert.equal(verdict("Saudi Arabia intercepts Iranian missiles over Riyadh", "اعتراض صواريخ إيرانية في سماء الرياض", { event_type: "interception" }).kind, "publish");
});

test("Syria's own affairs are not this desk's; Israel's strikes there are, never from an Iranian outlet (user, 9 Oct)", () => {
  const strike = "Israeli artillery strikes abandoned military base in Suweiseh area, Quneitra province, Syria";
  assert.equal(decideIranForTest(reading({ headline: strike, event_type: "shelling" }), "القنيطرة السويسة قصف مدفعي إسرائيلي", "Reuters", "intl").kind, "publish");
  for (const h of ["Israeli forces advance in southern Syria, close road between Jaba and Umm Batna in Quneitra countryside", strike]) {
    const v = verdict(h, "القنيطرة جباتا أم باطنة السويسة", { event_type: "ground_clash" });
    assert.equal(v.kind, "reject", h);
    assert.equal(v.kind === "reject" && v.reason, "reader", "a rejection, not a rewrite");
  }
  assert.equal(decideIranForTest(reading({ headline: "Israel strikes IRGC weapons depot near Damascus, Syria", event_type: "air_strike" }), "الحرس الثوري دمشق", "Reuters", "intl").kind, "publish");
  // An Iranian outlet, either side, never tells Israel's attacks.
  assert.equal(verdict("Israel strikes IRGC weapons depot near Damascus, Syria", "الحرس الثوري دمشق", { event_type: "air_strike" }).kind, "reject");
});

test("Houthi fire on Saudi airports is the Yemen desk's, whoever relays it", () => {
  const v = verdict("Hezbollah says it struck Riyadh, Najran and Khamis Mushait airports with missiles", "القوات المسلحة اليمنية مطار الرياض نجران خميس مشيط t.me/army21ye", { event_type: "missile_launch" });
  assert.equal(v.kind, "reject");
});
