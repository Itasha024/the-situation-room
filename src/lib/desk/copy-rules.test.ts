/**
 * The review of 18 Oct (latest 400 cards per desk): each kind of fault, with
 * the real headlines it found, and good cards that must pass untouched.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cleanBody,
  garbled,
  gulfCoastShip,
  homeAffairs,
  houthiClaim,
  houthiWords,
  lebanonContext,
  notNews,
  officeTitles,
  partisanWords,
  relayOf,
  rightType,
  serveCard,
  ungarble,
  wrongSource,
  xPostTime,
  yemenOnIran,
} from "./copy-rules.ts";

test("non-news: round-ups, price ticks, market wraps, analysis, sermons, rhetoric (Iran 2-4, 16, 24, 77, 151, 244, 293, 308, 317, 346, 359, 360, 72, 76, 79, 343, 391)", () => {
  const out: [string, string, string?][] = [
    ["Summary of recent maritime attacks in the region", "vessel"],
    ["Brent crude oil price reaches $110", "economy"],
    ["Brent crude oil price exceeds 109 dollars per barrel", "statement"],
    ["Oil price reaches 107 dollars per barrel", "economy"],
    ["Exchange rate: dollar price announced at Iran's exchange centre today", "economy"],
    ["Oil prices stay high as Iran war keeps supply tight into 2027", "economy"],
    ["Oil prices ease but head for another weekly gain on Middle East supply concerns", "economy"],
    ["Oil prices head for weekly gain as Hormuz attacks rattle markets", "economy"],
    ["Oil edges down as investors weigh possible US sanctions on 'shadow fleet'", "statement"],
    ["WTI outpaces Brent as US crude draw ignites fresh buying amid Hormuz tanker attacks", "economy"],
    ["Dubai crude spreads hit six-month low as Gulf exports recover", "economy"],
    ["VLCC tanker rates from the Middle East to China top $1 million a day amid Iran war", "statement"],
    ["Sanctions relief unlikely to ease tanker crisis", "economy"],
    ["US war has cost average household almost $2,000", "economy"],
    ["Brazil-China trade hits record $143bn in first nine months of 2026, driven by Brazilian oil exports as Hormuz war disrupts Gulf supply", "economy"],
    ["Tehran Friday prayer Imam: US said Iran's economy would collapse in two weeks, but it is now more vibrant", "statement"],
    ["Tehran interim Friday prayer Imam: Fighters who targeted three vessels in Strait of Hormuz after MoU deserve gratitude", "statement"],
    ["Iran's deputy executive of the army for executive affairs: Iranian people will respond with unity and cohesion to opponents's ambitions", "statement"],
    ["Iran's deputy executive of the army: Armed forces are on high alert to respond to any threat", "statement"],
    ["IRGC: Despite war damages, we have witnessed many achievements, creations and great works", "statement"],
    ["Hatami: opponents thought Iran depends on one person but missed that the Imam built society and institutions", "statement"],
  ];
  for (const [h, type] of out) assert.ok(notNews(h, "", type), h);
});

test("non-news on the Yemen desk: analysts, protocol, clerics and tribes, features, old news, off-topic (Yemen 12, 31, 51, 83, 106, 136, 150, 162, 166, 215, 234, 242, 252, 262, 273, 289, 308, 317, 337, 347, 363, 365, 376, 382, 386)", () => {
  const out: [string, string, string?][] = [
    ["Danny Citrinowicz: Iran provides intelligence and advanced weapons to support Houthi attacks", "statement"],
    ["Andreas Craig: Iran and Hezbollah initially gave Houthis missile system knowledge and operation", "statement"],
    ["Dr Lynette Nusbacher: Saudi Arabia needs more air defence systems from Britain, France, Italy and US to counter Houthi attacks", "statement", "Dr Lynette Nusbacher, a former military intelligence officer, said Saudi Arabia remains in urgent need."],
    ["Brigadier General Khalid Al-Nasi: Saudi Arabia made catastrophic errors in Yemen since 2015 and is paying the price today", "statement"],
    ["Former Prime Minister: western security is at stake in the battles around Taiz", "statement"],
    ["Battle for Taiz is for whole of western Yemen, warns ex-PM Maeen Abdelmalik Saeed", "statement"],
    ["Yemeni writer Ali al-Asali urges Egyptian President Sisi to expand mandate to protect Yemen from Houthis", "statement"],
    ["Journalist Nasser Ali: Houthi missiles will not break Aden's will", "statement"],
    ["Reuters warns of Houthi efforts to seize Taiz, says resistance would be fierce", "statement"],
    ["Ahmed Obeid bin Dagher: Head of Shura Council offers condolences for death of Brigadier Ahmed Behbeh al-Muradi", "statement"],
    ["Yemeni foreign minister Afrah al-Zouba attends OIC Council of Foreign Ministers session in Baghdad", "diplomacy"],
    ["Yemen's foreign minister discusses regional developments with Maldivian counterpart", "diplomacy"],
    ["Saudi foreign minister discusses regional security with Jordanian counterpart", "diplomacy"],
    ["Yemen's Association of Scholars calls for public mobilization against Saudi Arabia", "statement"],
    ["Moza Directorate tribes in Taiz declare general mobilization against Saudi forces", "statement"],
    ["Jabal Ras tribes in Hodeidah affirm continued general mobilization to confront Saudi forces", "statement"],
    ["Yemeni tribal figure Sheikh Ali Masad: we support Yemen's president's decisions on general amnesty and state restoration", "statement"],
    ["Riyadh pet owners seek advice to calm animals during Houthi attacks", "economy"],
    ["Riyadh airport attack survivor Khaled Zaal recalls helping evacuate women and children", "statement"],
    ["Houthis close in on key Yemen city of Taiz: Why a global trade route is at risk", "combat"],
    ["Houthi leader: our military operations against the US and UK will continue", "statement", "Houthi leader Abdul-Malik al-Houthi said in a message to Yahya Sinwar that Yemen is in an open confrontation."],
    ["Satellite imagery shows damage at Riyadh refinery, Jazan airport and Sultan air base", "statement"],
    ["Yemeni Center for Monitoring and Studying Earthquakes and Volcanoes records 3 minor earthquakes west of the Gulf of Aden", "statement"],
    ["Yemen meteorology centre warns of thunderstorms, strong winds and rough seas", "economy"],
    ["Saudi Interior Ministry executes five citizens for terrorist crimes", "statement"],
    ["National Blood Transfusion and Research Centre launches blood donation campaign in Al-Buraiqah district of Aden for wounded fighters", "economy"],
    ["Houthi official: Saudi Arabia has waged war on Yemen for over 12 years", "statement"],
  ];
  for (const [h, type, body] of out) assert.ok(notNews(h, body, type), h);
});

test("news stays news", () => {
  const keep: [string, string][] = [
    ["Oil tanker hit by projectile near Jubail, Saudi Arabia", "vessel"],
    ["IRGC Navy: a second supertanker caught fire after hitting a naval mine while attempting to illegally cross the Strait of Hormuz", "economy"],
    ["Yemen's human rights minister discusses Houthi violations with German officials in Berlin", "diplomacy"],
    ["Araghchi: US and Israel cannot cover up these crimes", "statement"],
    ["Houthi missile strikes Saudi forces command headquarters in Badr camp in Aden", "strike"],
    ["US Central Command: we rerouted 138 commercial vessels since resuming maritime blockade on Iran", "statement"],
    ["Saudi air strikes on Dhamar kill three children and wound 17", "strike"],
    ["Iran's foreign minister Araghchi met Iraqi Prime Minister Ali al-Zaidi in Baghdad", "diplomacy"],
    ["Trump: I would not use nuclear weapons against Iran, do not expect to send US ground troops", "statement"],
    ["Iran recalls ambassador from Baku", "diplomacy"],
    ["Houthi forces repel attack on Jabal Han in Taiz", "combat"],
    ["Sanctions: US Treasury designates 16 people and 10 firms over Iran oil sales", "economy"],
  ];
  for (const [h, type] of keep) assert.equal(notNews(h, "", type), null, h);
});

test("Iran's home affairs are not the war; its war at home is (Iran 110, 134, 136, 139, 141, 161, 165, 166, 260, 394)", () => {
  for (const h of [
    "Rain in a Bashagard village in Hormozgan",
    "Pezeshkian: Educational methods must not lag behind global standards",
    "Tehran governor: Tehran province has increased its educational capacity",
    "Ahvaz municipality workers protested against nepotism and bribery in employment status changes",
    "Mazandaran prosecutor: Suspect arrested in killing of cleric Yasser Taheri in Sari",
    "University of Tehran President: Water crisis has reached a sensitive stage, authorities failing to cooperate",
    "Iran Minister of Roads and Urban Development Farzaneh Sadegh: Iran-Afghanistan-Tajikistan corridor provides access to open seas",
    "Pezeshkian: Strategic and long-term Iran-Armenia economic cooperation program being drafted",
    "Prison guards raided Evin prison and beat political prisoners",
    "Ilam Province Intelligence Department: 11 arrested in Malekshahi for January 2026 protest-related violence",
  ]) assert.ok(homeAffairs(h), h);
  for (const h of [
    "IRGC arrests 6 accused of spying for Mossad in Kermanshah",
    "Explosion reported in Sirik and heard in Kuhestak, southern Iran",
    "Iran executes man convicted of spying for Israel",
    "US strikes hit Isfahan university district",
  ]) assert.equal(homeAffairs(h), null, h);
});

test("relays: US bodies, Trump, UKMTO and Israel retold; Iranian outlets on the Yemen desk (Iran 19, 20, 21, 36, 106, 108, 125, 153, 192, 197, 198, 200, 202, 224, 247, 268, 279, 365, 371, 396; Yemen 11, 72, 75, 115, 139, 193, 213, 232, 235, 261, 296, 336, 340, 395, 396)", () => {
  const iran: [string, string][] = [
    ["US Central Command: we rerouted 138 commercial vessels since resuming maritime blockade on Iran", "Al Jazeera"],
    ["USS Rafael Peralta supports naval blockade of Iranian ports, CENTCOM says forces redirected 138 commercial vessels as of Oct 17", "Shin Persian"],
    ["CENTCOM releases imagery of US Air Force KC-46 tanker preparing to launch from a Middle East base", "VOA Farsi"],
    ["US Central Command: IRGC unable to pay its forces' salaries due to economic pressure", "VOA Farsi"],
    ["US military: Iranian Revolutionary Guard Corps unable to pay its forces' salaries", "Al Hadath"],
    ["CENTCOM Commander: US naval blockade blocked $25 billion in Iranian oil exports and $350 million in crypto", "Radio Farda"],
    ["US Treasury warns of Islamic Republic abuse of religious charities and khums to finance terrorism", "VOA Farsi"],
    ["US Treasury cancels authorization for financial transactions of Iraq Development Bank with entities linked to Iran", "MEK"],
    ["US Treasury Secretary says the squeeze is tightening on Iran's economy and its allies cannot save it", "Al Jazeera"],
    ["US: Vance says 20 US soldiers and troops from other services lost in Iran conflict", "Clash Report"],
    ["Trump: I might have gone too far with Iran's leaders. I have nobody to talk to", "Clash Report"],
    ["Trump: Our country is in great shape and the war with Iran will end soon", "MTV Lebanon"],
    ["Trump: US stock market records levels much higher than at start of operations against Iran", "Al Jazeera Mubasher"],
    ["Trump: I would not use nuclear weapons against Iran, do not expect to send US ground troops", "Asharq News"],
    ["UK Maritime Trade Organisation reports 12 attacks on ships near Strait of Hormuz in past week, highest since March", "Ali Bk"],
    ["UKMTO warns of two tanker attacks northeast of Al Jubayl, Saudi Arabia", "OSINTdefender"],
    ["UKMTO: containership attacked in Strait of Hormuz sustaining minor damages", "Hellenic Shipping News"],
    ["Netanyahu likens Islamic Republic to cancer, says it will return if not eradicated", "Vahid Online"],
    ["Israeli media report heightened army readiness ahead of elections, citing possible escalation with Hezbollah", "VOA Farsi"],
  ];
  for (const [headline, source] of iran) assert.ok(relayOf({ headline, source, desk: "iran" }), `${source}: ${headline}`);
  const yemen: [string, string, string?][] = [
    ["Rubio: Houthi attacks on Saudi Arabia adding to pressure on global energy supplies", "Clash Report"],
    ["Hegseth: Houthi forces have not targeted US ships since Operation Raw Raider", "Bin Saeed"],
    ["US Secretary of Defense: Houthi forces have not fired on US ships during Operation Epic Fury", "Naya"],
    ["Houthi parliament speaker: we hope Cairo will take a brave stance", "Al-Alam"],
    ["Houthi official: UN Security Council's solidarity with Saudi Arabia reveals double standards", "IRNA"],
    ["Houthi forces give Riyadh-backed forces a 48-hour deadline to withdraw from Taiz and Yemen", "ISNA"],
    ["Houthi-aligned Al-Masirah publishes classified Saudi documents on military presence in Mocha", "IRIB News"],
    ["Israel provided direct intelligence assistance to Saudi Arabia in its efforts against Yemen", "Tasnim"],
    ["Yemen's health ministry says Saudi-led coalition killed 124 and wounded 327 since September 3", "Press TV"],
    ["Saudi assistant foreign minister: Saudi Arabia requested a meeting with the Houthis in Oman but Sanaa rejected it", "Tasnim"],
    ["UK Maritime Trade Operations reports maritime incident off Yemen's coast", "IRIB News"],
    ["UKTMO: LNG tanker fired on by boat off Hadramawt coast", "Yemenat"],
    ["Armed men in small boat fire on LNG tanker off Hadramawt coast", "Sawt al-Asima", "HADRAMAWT — The UK Maritime Trade Operations (UKMTO) reported that seven armed men fired."],
    ["Tanker hit by unknown projectile 68 nautical miles north-east of Al-Jubail in Saudi Arabia", "Al-Ayyam", "The United Kingdom Maritime Trade Operations said the crew members are safe."],
  ];
  for (const [headline, source, body] of yemen) assert.ok(relayOf({ headline, body, source, desk: "yemen" }), `${source}: ${headline}`);
  // The original, the US's own press, Iran's own words, a wire, an exclusive.
  const keep: [string, string, "yemen" | "iran", boolean?][] = [
    ["US Central Command: we rerouted 138 commercial vessels since resuming maritime blockade on Iran", "CENTCOM", "iran"],
    ["Tanker struck by unknown projectile 68NM northeast of Al Jubayl, Saudi Arabia", "UKMTO", "iran"],
    ["US official says White House halted strikes on Iranian missiles", "Axios", "iran"],
    ["Trump: Our country is in great shape and the war with Iran will end soon", "Reuters", "iran"],
    ["Mohammad Mokhber: Saudi Arabia is playing into US hands and wasting lives in Yemen", "Iran International", "yemen"],
    ["Iran says it is ready to assist in resolving Saudi-Yemen conflict through dialogue", "Tasnim", "yemen"],
    ["State Department official to Al Hadath: Washington will not let the Houthis threaten shipping", "Al Hadath", "yemen", true],
    ["IDF: strike on Hezbollah commander in Tyre", "IDF", "iran"],
  ];
  for (const [headline, source, desk, own] of keep) assert.equal(relayOf({ headline, source, desk, own }), null, `${source}: ${headline}`);
});

test("wrong source: a Truth Social card is Trump's; the speaker is in the page (Iran 232, 388)", () => {
  assert.ok(wrongSource("Khatibzadeh: No difference whether Trump speaks to the American people or tries to rely on deceit", "Truth Social (Trump)"));
  assert.equal(wrongSource("Trump: Iran will pay a very big price", "Truth Social (Trump)"), null);
  const page = "Secretary of War Pete Hegseth welcomed his British counterpart to the Pentagon on Thursday. ".repeat(8);
  assert.ok(wrongSource("US officials: Ousted Army Chief of Staff Gen. Randy George warned missile defense shortage would last until 2030", "Pentagon", page));
  assert.equal(wrongSource("Hegseth welcomes Healey to the Pentagon, discusses Hormuz", "Pentagon", page), null);
});

test("Houthi wording: 'Yemeni' for Houthis, 'Saudi build-ups', 'liberate', 'Iran-backed' (Yemen 4, 8, 49, 59, 108, 205, 226, 231, 246, 345, 370)", () => {
  const cases: [string, boolean, string][] = [
    ["Yemeni attack by drone targets Eastern Province of Saudi Arabia", true, "Houthi attack by drone targets Eastern Province of Saudi Arabia"],
    ["Yemeni ballistic missiles strike Riyadh, Abha and Khamis Mushait", true, "Houthi ballistic missiles strike Riyadh, Abha and Khamis Mushait"],
    ["Air traffic suspended at Dammam airport following Yemeni missile and drone attack", false, "Air traffic suspended at Dammam airport following Houthi missile and drone attack"],
    ["Houthi forces: Yemeni air blockade on Saudi Arabia causes disruption and halt of air traffic at Jeddah airport", true, "Houthi forces: Houthi air blockade on Saudi Arabia causes disruption and halt of air traffic at Jeddah airport"],
    ["Yemeni ballistic missiles target a military gathering of Saudi-backed forces in Lahj", true, "Houthi ballistic missiles target a military gathering of Saudi-backed forces in Lahj"],
    ["Yemeni ballistic missiles and forces strike Abha and Khamis Mushait in Saudi Arabia", false, "Houthi ballistic missiles and forces strike Abha and Khamis Mushait in Saudi Arabia"],
    ["Clashes continue between Ansar Allah and Saudi government forces around Taiz city", false, "Clashes continue between Ansar Allah and government forces around Taiz city"],
    ["Strikes hit Saudi build-ups in Al-Yatemah in Al-Jawf", true, "Strikes hit Saudi forces in Al-Yatemah in Al-Jawf"],
    ["Houthi forces liberate strategic Kahbub mountains", true, "Houthi forces capture strategic Kahbub mountains"],
    ["Iran-backed Houthis shell Al-Aradha village in Taiz, killing a woman and injuring a child", false, "Houthis shell Al-Aradha village in Taiz, killing a woman and injuring a child"],
  ];
  for (const [s, houthi, want] of cases) assert.equal(houthiWords(s, houthi), want);
  // The government's own forces stay the government's.
  assert.equal(houthiWords("Yemeni government forces repel Houthi attack in Taiz", false), "Yemeni government forces repel Houthi attack in Taiz");
});

test("Houthi outlets' own claims get their teller (Yemen 0, 22, 207, 385)", () => {
  assert.equal(houthiClaim("Houthi missiles strike Saudi facilities in Eastern Province causing fires", "strike", "Alfaqaar"), "Houthi-aligned media: Houthi missiles strike Saudi facilities in Eastern Province causing fires");
  assert.equal(houthiClaim("Houthi forces shoot down Saudi Karayel drone over Hajjah", "strike", "Yahya Saree"), "Houthi military spokesman: Houthi forces shoot down Saudi Karayel drone over Hajjah");
  assert.equal(houthiClaim("Houthi forces take Mudirat and Al-Rajmah in Taiz", "combat", "Ali Bk"), "Houthi-aligned media: Houthi forces take Mudirat and Al-Rajmah in Taiz");
  assert.equal(houthiClaim("Houthi missile pierces air defense and strikes target in eastern Saudi Arabia", "strike", "Alfaqaar"), "Houthi-aligned media: Houthi missile pierces air defense and strikes target in eastern Saudi Arabia");
  // Already told, or not a claim.
  assert.equal(houthiClaim("Houthi claim they shot down Saudi Apache helicopter near Najran", "strike", "Yahya Saree"), "Houthi claim they shot down Saudi Apache helicopter near Najran");
  assert.equal(houthiClaim("Houthi official: Saudi Arabia has waged war", "statement", "Al-Masirah"), "Houthi official: Saudi Arabia has waged war");
});

test("partisan words: hostile artillery is Israeli; 'opponents' is the speaker's; 'non-compliant' is quoted (Iran 70, 72, 118, 170, 171, 242, 292, 306, 307, 340, 391, 398)", () => {
  assert.equal(partisanWords("Hostile artillery fire targeted outskirts of Zoutar al-Sharqiya", lebanonContext("", "NBN")), "Israeli artillery fire targeted outskirts of Zoutar al-Sharqiya");
  assert.equal(partisanWords("Hostile artillery shelling targeted Nabatieh al-Fawqa town", lebanonContext("Hostile artillery shelling targeted Nabatieh al-Fawqa town", "Ali Shoaib's page")), "Israeli artillery shelling targeted Nabatieh al-Fawqa town");
  assert.equal(
    partisanWords("Two explosions in Kfar Tibnit and Zoutar al-Sharqiya in south Lebanon at dawn, with opponents mechanized advance toward Kfar Shouba", true, true),
    "Two explosions in Kfar Tibnit and Zoutar al-Sharqiya in south Lebanon at dawn, with Israeli mechanized advance toward Kfar Shouba",
  );
  assert.equal(partisanWords("Iranian people will respond with unity and cohesion to opponents's ambitions", false, true), 'Iranian people will respond with unity and cohesion to the "enemy\'s" ambitions');
  assert.equal(partisanWords("Hatami: opponents thought Iran depends on one person", false, true), 'Hatami: the "enemy" thought Iran depends on one person');
  assert.equal(partisanWords("IRGC Quds Force commander: Iran's opponents have no choice but to accept defeat", false, true), "IRGC Quds Force commander: Iran's enemies have no choice but to accept defeat");
  assert.equal(partisanWords("Iran's army navy monitored a non-compliant oil tanker that caught fire", false, true), 'Iran\'s army navy monitored a "non-compliant" oil tanker that caught fire');
  assert.equal(partisanWords("Iran fires missiles at non-compliant ships in Strait of Hormuz", false, true), 'Iran fires missiles at "non-compliant" ships in Strait of Hormuz');
  assert.equal(partisanWords("Army says it identified a burning smuggled oil tanker in Gulf of Oman", false, true), 'Army says it identified a burning "smuggled" oil tanker in Gulf of Oman');
  assert.equal(partisanWords("IRGC-N unauthorized tanker disabled tracking systems", false, true), 'IRGC-N "unauthorized" tanker disabled tracking systems');
  assert.equal(partisanWords("Hostile Israeli drone dropped two rockets on a residential building in Mifdun", true), "Israeli drone dropped two rockets on a residential building in Mifdun");
  // Elsewhere, "hostile" and quoted words stay.
  assert.equal(partisanWords("Hostile takeover bid for shipping firm", false), "Hostile takeover bid for shipping firm");
  assert.equal(partisanWords('IRGC seizes "non-compliant" tanker', false, true), 'IRGC seizes "non-compliant" tanker');
});

test("type by what the headline says (Iran 10, 32, 41, 56, 65, 70, 71, 81, 138, 205, 250, 292, 307; Yemen 33, 46, 68, 103, 128, 132, 143, 200, 343, 372, 373)", () => {
  const cases: [string, string, string][] = [
    ["economy", "IRGC Navy: a second supertanker caught fire after hitting a naval mine while attempting to illegally cross the Strait of Hormuz", "vessel"],
    ["economy", "Iran's army navy monitored a non-compliant oil tanker that caught fire and was disabled in the Sea of Oman today", "vessel"],
    ["economy", "Army's naval monitoring team finds a drifting burning oil tanker east of Strait of Hormuz", "vessel"],
    ["economy", "Iranian Navy: rogue VLCC caught fire after turning off AIS and attempting to cross restricted zone east of Strait of Hormuz", "vessel"],
    ["statement", "Two oil tankers attacked off Saudi coast in Gulf, one hit by projectile northeast of Jubail, second damaged by RPG from small craft", "vessel"],
    ["diplomacy", "UKMTO reports 12 attacks on commercial shipping around Strait of Hormuz in week ending October 16, with one vessel lost and two disabled", "statement"],
    ["diplomacy", "IMO says mines not removed from Strait of Hormuz, will resume clearance after conflict ends", "statement"],
    ["statement", "Explosion heard in outskirts of Erbil, Iraq", "strike"],
    ["statement", "Explosion occurred in eastern Baghdad", "strike"],
    ["statement", "Israeli army carried out a large explosion in Zoutar al-Sharqiya town", "strike"],
    ["statement", "9 killed in Saudi airstrikes on Taiz", "strike"],
    ["statement", "Houthi foreign ministry reports nine killed and 16 injured in Saudi airstrikes on homes in Maqbanah district, Taiz", "strike"],
    ["statement", "Saudi forces bombing with cluster bombs caused people killed and injuries including children in several Yemeni governorates", "strike"],
    ["statement", "Saada subjected to six air strikes, missile attacks and artillery shelling targeting residential areas last night", "strike"],
    ["combat", "Yemeni government forces and security call on personnel in Houthi-controlled areas not to respond to conscription calls", "statement"],
    ["combat", "Houthi forces deploy security personnel to frontlines in Taiz", "statement"],
    ["combat", "Houthi forces block travelers at Al-Hangar-Dhabab checkpoint in Taiz", "statement"],
    ["combat", "Houthi security supervisor Majli al-Jawfi storms citizen's home in Al-Bayda", "statement"],
    ["strike", "Yemeni government forces report 1,292 strikes against Houthi targets in 24 hours", "statement"],
  ];
  for (const [type, h, want] of cases) assert.equal(rightType(type as never, h), want, h);
  const keep: [string, string][] = [
    ["statement", "Yemen's health ministry says Saudi-led coalition killed 124 and wounded 327 since September 3"],
    ["statement", "Saudi foreign ministry condemns Houthi air strikes that killed two in Jazan"],
    ["combat", "Clashes intensify in Wadi Al-Arin, Taiz"],
    ["combat", "Israeli Merkava tank targeted area between Haddatha and Aita al-Jabal in south Lebanon"],
    ["combat", "Israeli army conducted machine gun sweeps toward Kfar Tibnit"],
    ["combat", "Yemeni government forces inflict heavy losses on Houthi forces in Old Airport and Mudirat districts west of Taiz"],
    ["combat", "Houthi reinforcements move toward Taiz via Dhamar-Ibb road"],
    ["statement", "Iraqi prime minister orders investigation into explosion at a Popular Mobilization Forces headquarters in Baghdad"],
    ["statement", "Hegseth: Houthi forces have not targeted US ships since Operation Raw Raider"],
    ["economy", "Ship attacks in Strait of Hormuz hit record high this month, surpassing March peak, maritime data shows"],
    ["diplomacy", "Araghchi: Iran presented a seven-day plan to reopen the Strait of Hormuz to the US via Qatar"],
    ["combat", "Houthi forces take Mudirat and Al-Rajmah in Taiz"],
    ["diplomacy", "Araghchi met Iraqi Prime Minister Ali al-Zaidi in Baghdad"],
    ["vessel", "Tanker struck by unknown projectile 68NM northeast of Al Jubayl, Saudi Arabia"],
    ["economy", "Iraq's oil exports via Basra fall to 2.1 million barrels a day"],
  ];
  for (const [type, h] of keep) assert.equal(rightType(type as never, h), type, h);
});

test("wrong desk: the Houthis' war without Iran in the lead is not the Iran desk's; Jubail ships are not Yemen's (Iran 117, 216, 333, 372, 373, 382; Yemen 296, 327, 348, 358, 359)", () => {
  for (const [s, t] of [
    ["Yemen's human rights minister discusses Houthi violations with German officials in Berlin", "Minister Mashdal Omar urged European support for designating the Houthi forces as a terrorist organization. Iran arms them."],
    ["Yemen's deputy foreign minister briefs Swiss official on Houthi siege of Taiz, Iranian arms", ""],
    ["Saudi soldier killed, coalition reports 19 dead and 364 wounded, and 5 killed at Aden's Maashiq Palace in Houthi attacks", ""],
    ["Coalition: Houthis attempted to attack dozens of Saudi facilities", ""],
    ["Loud sounds of multiple explosions heard in Aden", ""],
  ]) assert.ok(yemenOnIran(s, t), s);
  for (const [s, t] of [
    ["Iran offers political mediation to end Yemen war, urges ceasefire and lifting of siege", ""],
    ["Houthi Armed Forces spokesperson: Iran provides intelligence and targeting data for attacks on Saudi Arabia", ""],
    ["Hezbollah: strike on Tyre", ""],
  ]) assert.equal(yemenOnIran(s, t), false, s);
  for (const s of [
    "Tanker hit by unknown projectile 68 nautical miles north-east of Al-Jubail in Saudi Arabia",
    "Tanker struck by unknown projectile 68NM northeast of Al Jubayl, Saudi Arabia",
    "Ship targeted off eastern coast of Saudi Arabia yesterday",
    "Second ship targeted off eastern coast of Saudi Arabia by RPG",
  ]) assert.ok(gulfCoastShip("vessel", s), s);
  assert.equal(gulfCoastShip("vessel", "LNG tanker fired on by boat off Hadramawt coast"), false);
  assert.equal(gulfCoastShip("strike", "Houthi missiles strike Aramco in Jubail"), false);
});

test("titles: Araghchi's office, a bare surname's office, Sardar, Iraq's prime minister (Iran 3, 69, 144, 162, 223)", () => {
  assert.equal(officeTitles("Iran's UN ambassador Araghchi says US and Israel to blame for Strait of Hormuz situation"), "Iran's foreign minister Araghchi says US and Israel to blame for Strait of Hormuz situation");
  assert.equal(officeTitles("Acting defence minister Sardar Ebnolreza: Iranian missiles determine the equation"), "Acting defence minister Ebnolreza: Iranian missiles determine the equation");
  assert.equal(officeTitles("Sardar Ebnolreza: The titles and sizes of bombs are irrelevant"), "General Ebnolreza: The titles and sizes of bombs are irrelevant");
  assert.equal(officeTitles("Khatibzadeh: US must accept respect for our people's rights"), "Iran's deputy foreign minister Khatibzadeh: US must accept respect for our people's rights");
  assert.equal(officeTitles("Gharibabadi: contacts with Persian Gulf littoral states continue"), "Iran's deputy foreign minister Gharibabadi: contacts with Persian Gulf littoral states continue");
  assert.equal(officeTitles("Iranian Foreign Minister Araghchi met Iraqi Prime Minister Al-Sudani in Baghdad"), "Iranian Foreign Minister Araghchi met Iraqi Prime Minister Ali al-Zaidi in Baghdad");
  assert.equal(officeTitles("Former Iraqi leader Sudani visits Tehran"), "Former Iraqi leader Sudani visits Tehran");
});

test("garbling: the speaker twice, phrases twice, mashups, polarity, empty bodies, the outlet calling itself aligned media (Iran 355, 362; Yemen 46, 49, 69, 98, 128, 141, 186, 305)", () => {
  assert.equal(ungarble("Houthi forces: Houthi missile and drone attacks target Saudi airports, causing casualties"), "Houthi forces: missile and drone attacks target Saudi airports, causing casualties");
  assert.equal(ungarble("Yemen's information ministry: Yemeni government denies reports of arrest of defence minister's security chief"), "Yemen's information ministry denies reports of arrest of defence minister's security chief");
  assert.equal(ungarble("Yemeni government: Yemen calls on Organization of Islamic Cooperation to designate Houthis as terrorist group"), "Yemeni government calls on Organization of Islamic Cooperation to designate Houthis as terrorist group");
  assert.equal(ungarble("Houthi official: Saudi Arabia has waged war"), "Houthi official: Saudi Arabia has waged war");
  assert.equal(ungarble("Araghchi: Iran will not negotiate under threat"), "Araghchi: Iran will not negotiate under threat");
  assert.equal(ungarble("US Secretary of State Rubio: the US can carry out any operation against Iran"), "US Secretary of State Rubio: the US can carry out any operation against Iran");
  assert.equal(yemenOnIran("Houthis say they fired a missile at Eilat"), false);
  assert.ok(garbled("Clash in Abyan linked to vehicle linked to former Al-Qaeda leader"));
  assert.ok(garbled("Houthis missile attack hits Aden presidential palace, kills two guards; coalition says dozens of attacks on Saudi infrastructure, Iran says it is stepping up strikes"));
  assert.ok(garbled("Oil edges down as investors weigh possible US sanctions on 'shadow fleet'", "Oil prices edged down on Friday as investors weighed a possible easing of US sanctions on the shadow fleet."));
  assert.equal(garbled("US imposes sanctions on 'shadow fleet' tankers", "The Treasury imposed new sanctions on 12 tankers."), null);
  assert.equal(garbled("Houthi forces take control of Jabal Han in Taiz"), null);
  assert.equal(cleanBody("KING FAHD INTERNATIONAL AIRPORT — ", "Bin Saeed"), "");
  assert.equal(cleanBody("WADI AL `ARIN — ", "Bin Saeed"), "");
  assert.equal(
    cleanBody("DHAMAR — Houthi-aligned media said Saudi aircraft targeted citizens' homes in Al-Arri.", "Al-Thawrah"),
    "DHAMAR — Saudi aircraft targeted citizens' homes in Al-Arri.",
  );
  assert.equal(cleanBody("DHAMAR — Houthi-aligned media said Saudi aircraft targeted homes.", "Reuters"), "DHAMAR — Houthi-aligned media said Saudi aircraft targeted homes.");
});

test("late times: an X post's time is in its id (Kpler's 16 Oct post carded on 18 Oct; Baghaei's 15 Oct post on 16 Oct)", () => {
  assert.equal(new Date(xPostTime("https://x.com/Kpler/status/2111019358310809837")!).toISOString(), "2026-10-16T09:00:10.521Z");
  assert.equal(new Date(xPostTime("https://x.com/IRIMFA_SPOX/status/2110787269544067311")!).toISOString(), "2026-10-15T17:37:56.247Z");
  assert.equal(xPostTime("https://t.me/Tasnimnews_en/43659"), null);
});

test("stored cards as served: hidden when off this desk, fixed in place otherwise", () => {
  const hide: [Record<string, unknown>, "yemen" | "iran"][] = [
    [{ summary: "Brent crude oil price reaches $110", type: "economy", source: "Khabari Plus" }, "iran"],
    [{ summary: "Rain in a Bashagard village in Hormozgan", type: "statement", source: "Khabari Plus" }, "iran"],
    [{ summary: "Coalition: Houthis attempted to attack dozens of Saudi facilities", type: "economy", source: "Reuters" }, "iran"],
    [{ summary: "Khatibzadeh: No difference whether Trump speaks to the American people", type: "statement", source: "Truth Social (Trump)" }, "iran"],
    [{ summary: "Ship targeted off eastern coast of Saudi Arabia yesterday", type: "vessel", source: "Ali Bk" }, "yemen"],
    [{ summary: "Moza Directorate tribes in Taiz declare general mobilization against Saudi forces", type: "statement", source: "Saba (Houthi-run)" }, "yemen"],
  ];
  for (const [r, desk] of hide) assert.equal(serveCard(r, desk), false, String(r.summary));
  const nbn: Record<string, unknown> = { summary: "Hostile artillery fire targeted outskirts of Kfar Shuba", type: "combat", source: "NBN" };
  assert.ok(serveCard(nbn, "iran"));
  assert.equal(nbn.summary, "Israeli artillery fire targeted outskirts of Kfar Shuba");
  const mine: Record<string, unknown> = { summary: "IRGC Navy: a second supertanker caught fire after hitting a naval mine", type: "economy", source: "Press TV" };
  assert.ok(serveCard(mine, "iran"));
  assert.equal(mine.type, "vessel");
  const naya: Record<string, unknown> = { summary: "Yemeni ballistic missiles strike Riyadh, Abha and Khamis Mushait", type: "strike", source: "Naya", side: "houthi" };
  assert.ok(serveCard(naya, "yemen"));
  assert.equal(naya.summary, "Houthi-aligned media: Houthi ballistic missiles strike Riyadh, Abha and Khamis Mushait");
  const empty: Record<string, unknown> = { summary: "Clashes intensify in Wadi Al-Arin, Taiz", text: "WADI AL `ARIN — ", type: "combat", source: "Bin Saeed" };
  assert.ok(serveCard(empty, "yemen"));
  assert.equal(empty.text, "");
  const ar: Record<string, unknown> = { summary: "US investigation links IRGC to Houthi operations against Saudi Arabia", type: "statement", source: "وردنا" };
  serveCard(ar, "yemen");
  assert.ok(/^[A-Za-z]/.test(String(ar.source)), String(ar.source));
  const good: Record<string, unknown> = { summary: "Saudi air strikes on Dhamar kill three children and wound 17", text: "DHAMAR — Saba said warplanes struck homes.", type: "strike", source: "The New Arab", side: "neutral" };
  assert.ok(serveCard(good, "yemen"));
  assert.equal(good.summary, "Saudi air strikes on Dhamar kill three children and wound 17");
});

/* Through the readers, the desks and the spellings. */
import { decideForTest, decideIranForTest } from "./editor.ts";
import type { Reading } from "./reader.ts";
import { desksOf } from "./desk-route.ts";
import { respell } from "./spelling.ts";
import { seaPlace } from "./maritime.ts";
import { placesIn } from "./gazetteer.ts";
import { bodyPlaceOnly } from "./copy-rules.ts";

const reading = (o: Partial<Reading>): Reading =>
  ({ id: "a", publish: true, event_type: "statement", headline: "", body: "", speaker_lead: "", actor_side: "iran", arenas: [], targets: [], origins: [], has_time: false, confident_roles: true, follows_up: "", duplicate_of: "", reject_reason: "", interest: "neutral", ...o }) as Reading;

test("the Iran reader turns away price ticks, home affairs, relays and the Houthis' war, and fixes the words", () => {
  const away: [string, string, string, string, string?][] = [
    ["Brent crude oil price reaches $110", "economy", "Khabari Plus", "axis"],
    ["Rain in a Bashagard village in Hormozgan", "statement", "Khabari Plus", "axis"],
    ["US Central Command: IRGC unable to pay its forces' salaries due to economic pressure", "statement", "VOA Farsi", "opposition"],
    ["Coalition: Houthis attempted to attack dozens of Saudi facilities", "statement", "Reuters", "intl"],
  ];
  for (const [headline, event_type, source, lean] of away) {
    const v = decideIranForTest(reading({ headline, event_type: event_type as never }), `${headline} 110`, source, lean);
    assert.equal(v.kind, "reject", headline);
  }
  const nbn = decideIranForTest(reading({ headline: "Hostile artillery fire targeted outskirts of Kfar Shuba", event_type: "shelling", actor_side: "israel" }), "قصف مدفعي معادي استهدف أطراف كفرشوبا", "NBN", "axis");
  if (nbn.kind === "publish") assert.equal(nbn.report.summary, "Israeli artillery fire targeted outskirts of Kfar Shuba");
  const mine = decideIranForTest(reading({ headline: "IRGC Navy: a second supertanker caught fire after hitting a naval mine in the Strait of Hormuz", event_type: "economy", speaker_lead: "IRGC Navy" }), "IRGC Navy: a second supertanker caught fire after hitting a naval mine in the Strait of Hormuz", "Press TV", "axis");
  assert.equal(mine.kind, "publish");
  if (mine.kind === "publish") assert.equal(mine.report.type, "vessel");
});

test("the Yemen reader: Houthi words and the teller on a Houthi outlet's claim", () => {
  const v = decideForTest(reading({ headline: "Yemeni ballistic missiles strike Riyadh, Abha and Khamis Mushait", event_type: "missile_launch", actor_side: "unclear" as never, targets: [] }), "صواريخ باليستية يمنية تضرب الرياض وأبها وخميس مشيط");
  assert.equal(v.kind, "publish");
  if (v.kind === "publish") assert.equal(v.report.summary, "Houthi media: Houthi ballistic missiles strike Riyadh, Abha and Khamis Mushait");
  const tribes = decideForTest(reading({ headline: "Moza Directorate tribes in Taiz declare general mobilization against Saudi forces", actor_side: "houthi" }), "قبائل مديرية موزع تعلن النفير العام");
  assert.equal(tribes.kind, "reject");
});

test("ships off Jubail are the Iran desk's; the Gulf of Aden is not Aden; a body's seat is not the place; one spelling", () => {
  const card = { fp: "j", at: "2026-10-17T10:10:00Z", source: "Al-Ayyam", url: "u", type: "vessel", summary: "Tanker hit by unknown projectile 68 nautical miles north-east of Al-Jubail in Saudi Arabia", text: "The UKMTO said the crew are safe.", live: true } as never;
  assert.deepEqual(desksOf(card), ["iran"]);
  const pick = seaPlace(placesIn("Attack on a ship in the Gulf of Aden"));
  assert.ok(pick && /Gulf of Aden/.test(pick.name), pick?.name);
  assert.ok(bodyPlaceOnly("Sanaa", "Sanaa health official: 7 wounded in shelling and sniper fire in Taiz"));
  assert.ok(bodyPlaceOnly("Sanaa", "Anis al-Asbahi, a spokesman for Sanaa’s Health Ministry, said seven people were wounded"));
  assert.equal(bodyPlaceOnly("Sanaa", "Saudi air strikes hit Sanaa airport"), false);
  assert.equal(respell("Acting defence minister Ebnelreza"), "Acting defence minister Ebnolreza");
  assert.equal(respell("Explosion heard in Kohestak"), "Explosion heard in Kuhestak");
  assert.equal(respell("Broojerdi: If US uses mother of all bombs"), "Boroujerdi: If US uses mother of all bombs");
  assert.equal(respell("Lebanese Foreign Minister Yusuf Raji in Baghdad"), "Lebanese Foreign Minister Yusuf Raggi in Baghdad");
});

/* Round 2 of 18 Oct: footage, titles, who congratulated whom, two verbs. */
import { roleInCopy, rightWayRound, speakerByRole, twoVerbs } from "./copy-rules.ts";

test("a card about its footage is served with its video or not at all (Shajab News, 18 Oct)", () => {
  const bare: Record<string, unknown> = { summary: "Houthi media publishes new footage of attacks on Saudi Aramco facilities", type: "strike", source: "Shajab News" };
  assert.equal(serveCard(bare, "yemen"), false);
  for (const summary of [
    "Saudi-led coalition publishes footage of targeted Houthi ballistic missile launchers",
    "Nation's Shield forces release footage of clashes with Houthis in Al-Subayhah",
    "Iranian state TV aired footage claiming to show an oil tanker exploding after hitting a naval mine in the Strait of Hormuz",
    "Houthi forces broadcast footage of an AH-6i attack helicopter downed off Najran",
  ]) assert.equal(serveCard({ summary, type: "strike", source: "X" }, "yemen"), false, summary);
  const shown: Record<string, unknown> = { ...bare, media: { kind: "video", from: "tg", post: "u", thumb: "t" } };
  assert.ok(serveCard(shown, "yemen"));
  assert.ok(serveCard({ summary: "Houthi missiles strike Saudi Aramco facilities in Jazan", type: "strike", source: "Masirah" }, "yemen"));
});

test("a speaker a reader does not know is named by role; a famous name stays bare (Dar, Ghaempanah, Vahidi, 18 Oct)", () => {
  assert.equal(officeTitles("Dar: discussed regional issues during a phone call with Iranian Foreign Minister Araghchi[[3]]."), "Pakistani FM Dar: discussed regional issues during a phone call with Iranian Foreign Minister Araghchi[[3]].");
  assert.equal(officeTitles("Ghaempanah: Iran's daily gas shortfall reaches 530 million cubic metres"), "Iran's executive vice president Ghaempanah: Iran's daily gas shortfall reaches 530 million cubic metres");
  assert.equal(officeTitles("Mohammad Jafar Ghaempanah: despite US and Israeli threats, Iran will remain united"), "Iran's executive vice president Ghaempanah: despite US and Israeli threats, Iran will remain united");
  assert.equal(officeTitles("Vahidi: the IRGC is ready"), "IRGC commander Vahidi: the IRGC is ready");
  assert.equal(officeTitles("Akhlaghi: let our people be assured Israel will not dare attack us"), "Iran's defence minister Akhlaghi: let our people be assured Israel will not dare attack us");
  assert.equal(officeTitles("Qashqavi: All claims about opening the Strait of Hormuz are pure lies"), "Iran's parliament security committee spokesman Qashqavi: All claims about opening the Strait of Hormuz are pure lies");
  assert.equal(officeTitles("Sanders: we will do whatever it takes to stop the illegal war with Iran"), "Sanders: we will do whatever it takes to stop the illegal war with Iran");
  assert.equal(officeTitles("Araghchi: Iran will not negotiate under threat"), "Araghchi: Iran will not negotiate under threat");
  assert.equal(officeTitles("Araghchi holds phone call with Pakistani foreign minister Dar"), "Araghchi holds phone call with Pakistani foreign minister Dar");
  // Not in the table: the role the card's own copy gives.
  assert.equal(roleInCopy("Naderi", "Iran's deputy defence minister, Ahmad Naderi, said the missiles were ready."), "Iran's deputy defence minister");
  assert.equal(speakerByRole("Naderi: our missiles are ready", "Iran's deputy defence minister Ahmad Naderi said the missiles were ready."), "Iran's deputy defence minister Naderi: our missiles are ready");
  assert.equal(speakerByRole("Netanyahu: Israel will act", "Israeli Prime Minister Benjamin Netanyahu said"), "Netanyahu: Israel will act");
  assert.equal(speakerByRole("Hezbollah: fighters struck a tank", ""), "Hezbollah: fighters struck a tank");
  assert.equal(speakerByRole("Naderi: our missiles are ready", "He spoke in Tehran."), "Naderi: our missiles are ready");
  // Stored cards as served.
  const card: Record<string, unknown> = { summary: "Ghaempanah: despite US and Israeli threats, Iran will remain united and steadfast", type: "statement", source: "SNN" };
  assert.ok(serveCard(card, "iran"));
  assert.equal(card.summary, "Iran's executive vice president Ghaempanah: despite US and Israeli threats, Iran will remain united and steadfast");
});

test("who congratulated whom: the IRGC commander Vahidi congratulated the new defence minister (ILNA, 18 Oct)", () => {
  const wrong = "IRGC commander congratulates Vahidi on appointment as defence minister";
  assert.equal(rightWayRound(wrong), "IRGC commander Vahidi congratulates new defence minister on his appointment");
  assert.equal(rightWayRound("IRGC commander Vahidi congratulates Akhlaghi on appointment as defence minister"), "IRGC commander Vahidi congratulates Akhlaghi on appointment as defence minister");
  assert.equal(rightWayRound("Pezeshkian congratulates Akhlaghi on appointment as defence minister"), "Pezeshkian congratulates Akhlaghi on appointment as defence minister");
  const card: Record<string, unknown> = { summary: wrong, type: "statement", source: "ILNA" };
  assert.ok(serveCard(card, "iran"));
  assert.equal(card.summary, "IRGC commander Vahidi congratulates new defence minister on his appointment");
  // A new card: the reader's copy is turned the right way round.
  const v = decideIranForTest(reading({ headline: wrong, speaker_lead: "" }), "فرمانده کل سپاه انتصاب وزیر دفاع و پشتیبانی نیروهای مسلح را تبریک گفت سرلشکر وحیدی، فرمانده کل سپاه پاسداران انقلاب اسلامی با صدور پیامی ضمن تبریک انتصاب آقای مهرداد اخلاقی به سمت وزیر دفاع", "ILNA", "state");
  if (v.kind === "publish") assert.ok(!/congratulates Vahidi/.test(v.report.summary), v.report.summary);
});

test("two verbs with no joiner: the name before the first is the speaker (Iran International, 17 Oct)", () => {
  const h = "Institute for Science and International Security restricted access to Kuh-e Kolang nuclear site strengthens speculation on stored materials";
  assert.equal(twoVerbs(h), "Institute for Science and International Security: restricted access to Kuh-e Kolang nuclear site strengthens speculation on stored materials");
  assert.equal(ungarble(h), twoVerbs(h));
  const card: Record<string, unknown> = { summary: h, type: "statement", source: "Iran International" };
  assert.ok(serveCard(card, "iran"));
  assert.equal(card.summary, twoVerbs(h));
  // Joined clauses and plain sentences pass untouched.
  for (const ok of [
    "IAEA said access to Fordow was restricted, which raises concern",
    "US Treasury sanctioned 12 tankers and signals more to come",
    "Saudi air defences intercepted a missile over Jazan",
    "Iran restricted access to Kuh-e Kolang site",
    "Araghchi: restricted access suggests nothing",
  ]) assert.equal(twoVerbs(ok), null, ok);
});
