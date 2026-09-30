import assert from "node:assert/strict";
import test from "node:test";
import { findCitation, majorCarrier } from "./origin.ts";

test("any country's ministry is traced to its own account and site (Egypt via Almashhad, 30 Sep)", () => {
  const c = findCitation("قالت وزارة الخارجية المصرية في بيان إنها تتابع أوضاع البحارة", "Almashhad", "https://www.almashhad-alyemeni.com/497323");
  assert.equal(c?.name, "Egypt Foreign Ministry");
  assert.equal(c?.site, "mfa.gov.eg");
  assert.equal(c?.x, "MfaEgypt");
  const en = findCitation("Egypt's Foreign Ministry said on Tuesday it was following the case", "Almashhad", "https://t.me/x/1");
  assert.equal(en?.name, "Egypt Foreign Ministry");
});

test("a post names its country: Pakistan's defence minister, the British government", () => {
  const pk = findCitation("وزير الدفاع الباكستاني: أي اعتداء على السعودية اعتداء على باكستان", "Almashhad", "https://t.me/x/2");
  assert.equal(pk?.name, "Pakistan Defence Ministry");
  assert.equal(pk?.country, "PK");
  const uk = findCitation("The British government said it was sending a destroyer to the Red Sea", "Saudi News", "https://x.com/SaudiNews50/status/1");
  assert.equal(uk?.name, "UK Government");
  // "us" is no country.
  assert.equal(findCitation("they told us government forces said nothing", "Almashhad", "https://t.me/x/3")?.country, undefined);
});

test("a body's own account carrying its words is the original, not a relay", () => {
  assert.equal(findCitation("Egypt's Foreign Ministry said it was following the case", "Egypt Foreign Ministry", "https://x.com/MfaEgypt/status/9"), null);
});

test("the EU's naval mission is Aspides, looked up on its own account", () => {
  const c = findCitation("قالت بعثة أسبيدس الأوروبية إن 260 سفينة طلبت الحماية", "Sawt al-Asima", "https://t.me/x/4");
  assert.equal(c?.name, "EUNAVFOR Aspides");
});

test("a carrier is a wire, a big paper or the country's own press, never an aggregator", () => {
  assert.equal(majorCarrier("www.reuters.com"), true);
  assert.equal(majorCarrier("ahram.org.eg", "EG"), true);
  assert.equal(majorCarrier("dawn.com", "PK"), true);
  assert.equal(majorCarrier("ua.news", "EG"), false);
  assert.equal(majorCarrier("yemenonline.info", "UN"), false);
});
