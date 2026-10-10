// Research stage B, part 2 (user, 10 Oct): the Gulf states' and Jordan's own defence statements -> hand events.
// Read: the ministries' X posts (Saudi MoD, Kuwait's army, Qatar's MoD, Bahrain's BDF; x/<handle>.jsonl), Jordan's
// Petra agency (tg/petranews), and Al Hadath's breaking channel where it quotes one of those bodies by name
// ("الدفاع السعودية: ...", "الجيش الكويتي: ..."). A statement is pinned when it tells an attack that day: an
// interception, a fall, a hit, air defences engaging now. Not: tallies over days, footage, explosive disposal,
// drills, denials, yesterday's news. Every place the statement names on the country's list gets a pin; none named,
// the country in general. Who: Iran when the statement names Iran; the militias when it says from Iraq; a Yemen
// launch is the Yemen desk's and left out; else not stated. Saudi Arabia's south (the Houthi front) only with Iran named.
//
// Stage B, part 3 (user, 10 Oct: "you can take stuff from alhadath or alarabiya or aljazeera too, and from the axis
// channels... of course its a report not a confirmation"): the UAE's own accounts (its defence ministry, the
// emirates' media offices), and the news channels' and axis channels' own reports with no official speaker
// ("انفجارات تهز دبي", "مراسل الجزيرة: اعتراضات صاروخية في المفرق", "الحرس الثوري: هجوم على قاعدة الأمير حسن").
// A report is pinned at the places it names in a Gulf state or Jordan, or the country in general; it says who
// reports it. A report that falls on a pin already made that day nearby (the city, or the country for a report
// that names none) is that attack's second source, not a new one.
// Ships: an attack on a ship, explosions at sea, a carrier struck, in the Gulf, Hormuz, the Gulf of Oman or the
// Arabian Sea, whether UKMTO confirmed it or not; a report beside a ship pin of that day or the next (150 km) is the
// same attack. The Red Sea and the Gulf of Aden are the Yemen desk's; Iran's own coast and islands are Iran's.
//   node gulf.cjs gulf-events.jsonl [--base public/iran-strikes-baseline.json] x/modgovksa.jsonl ... part/hd0.jsonl
const fs = require('fs');
const countryAt = require('./country-at.cjs');
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = bi >= 0 ? JSON.parse(fs.readFileSync(argv.splice(bi, 2)[1], 'utf8')) : [];
const [out, ...files] = argv;

const C = {
  sa: { name: 'Saudi Arabia', gen: [24.0, 45.0] },
  ae: { name: 'UAE', country: 'United Arab Emirates', gen: [23.9, 54.3] },
  qa: { name: 'Qatar', gen: [25.3, 51.2] },
  kw: { name: 'Kuwait', gen: [29.31, 47.48] },
  bh: { name: 'Bahrain', gen: [26.07, 50.55] },
  jo: { name: 'Jordan', gen: [31.25, 36.5] },
  om: { name: 'Oman', gen: [21.5, 57.0] },
};
// Who speaks: an account of its own, or Al Hadath / Petra quoting the body by name before a colon.
const SPEAKER = [
  [/^(?:السعودية|المملكة)$|(?:وزارة )?الدفاع السعودية|(?:لل?ـ?)?دفاع السعودية?|الدفاع السعودي|تركي المالكي/, 'sa'],
  [/^(?:الإمارات|الامارات)$|(?:وزارة )?الدفاع الإماراتية|(?:وزارة )?الدفاع الاماراتية|الدفاعات الجوية الإماراتية/, 'ae'],
  [/^قطر$|(?:وزارة )?الدفاع القطرية|الدفاع الجوي القطري|الدفاعات الجوية القطرية|الداخلية القطرية/, 'qa'],
  [/^الكويت$|الجيش الكويتي|الأركان (?:العامة )?الكويتية|(?:وزارة )?الدفاع الكويتية|الدفاعات الجوية الكويتية|الحرس الوطني الكويتي/, 'kw'],
  [/^البحرين$|قوة دفاع البحرين|الدفاع البحرينية|(?:وزارة )?الداخلية البحرينية/, 'bh'],
  [/^(?:الأردن|الاردن)$|الجيش الأردني|القوات المسلحة الأردنية|الجيش العربي|الأمن العام الأردني|الامن العام الاردني|الأمن الأردني|الامن الاردني|التلفزيون الأردني|التلفزيون الاردني|الإعلام الأردني|المملكة عن القوات المسلحة|مديرية الأمن العام|الدفاع المدني الأردني|سلاح الجو الأردني/, 'jo'],
  [/^(?:عمان|سلطنة عمان)$|(?:وزارة )?الدفاع العمانية|الجيش العماني/, 'om'],
];
const OWN = { modgovksa: 'sa', KuwaitArmyGHQ: 'kw', MOD_Qatar: 'qa', BDF_Bahrain: 'bh', modgovae: 'ae', DXBMediaOffice: 'ae', ADMediaOffice: 'ae', sharjahmedia: 'ae', RAKMediaOffice: 'ae', ajmanmedia: 'ae' };
const SRC = {
  modgovksa: 'Saudi Ministry of Defence', KuwaitArmyGHQ: 'Kuwait Army General Staff', MOD_Qatar: 'Qatar Ministry of Defence', BDF_Bahrain: 'Bahrain Defence Force',
  modgovae: 'UAE Ministry of Defence', DXBMediaOffice: 'Dubai Media Office', ADMediaOffice: 'Abu Dhabi Media Office', sharjahmedia: 'Sharjah Media Office', RAKMediaOffice: 'Ras Al Khaimah Media Office', ajmanmedia: 'Ajman Media Office',
  petranews: 'Petra', AlHadath_Brk: 'Al Hadath', ajanews: 'Al Jazeera', AlArabiya: 'Al Arabiya', almayadeen: 'Al Mayadeen',
  naya_foriraq: 'Naya', SabrenNewss: 'Sabereen', Alomhoar: 'Al-Mihwar', Alibk3: 'Ali Bk',
};
// Channels whose own reports are read, with no official speaker; an emirate's office speaks for its own emirate.
const REPORTS = new Set(['AlHadath_Brk', 'ajanews', 'AlArabiya', 'almayadeen', 'naya_foriraq', 'SabrenNewss', 'Alomhoar', 'Alibk3']);
// Who claims a strike: Iran's forces and media, the Iraqi factions.
const CLAIM = [
  [/الحرس الثوري|حرس الثورة|خاتم الأنبياء|خاتم الانبياء|الجيش الإيراني|الجيش الايراني|القوات المسلحة الإيرانية|البحرية الإيرانية|تسنيم|وكالة فارس|إعلام إيراني|اعلام ايراني|التلفزيون الإيراني|التلفزيون الايراني|الإذاعة الإيرانية/, 'iran', 'Iran'],
  [/الجيش الأمريكي|الجيش الأميركي|القيادة المركزية|القيادة الوسطى|سنتكوم|البنتاغون|البحرية الأمريكية|البحرية الأميركية/, 'us', 'The US military'],
  [/المقاومة الإسلامية في العراق|المقاومة الاسلامية في العراق|المقاومة العراقية|فصائل المقاومة|كتائب حزب الله|النجباء|فصيل عراقي|فصائل عراقية|سرايا أولياء الدم|سرايا اولياء الدم/, 'iraqi_militias', 'the Iraqi factions'],
];

// Places, by country: [pattern, place, lat, lng, English for the label].
const P = {
  sa: [
    [/ر[اأ]س تنورة/, 'Ras Tanura refinery', 26.64, 50.16, 'the Ras Tanura refinery'],
    [/الأمير سلطان|الامير سلطان/, 'Prince Sultan Air Base', 24.0627, 47.5805, 'the Prince Sultan air base'],
    [/السفارة الأمريكية في الرياض|السفارة الأميركية في الرياض|السفارة الامريكية في الرياض/, 'US embassy, Riyadh', 24.6797, 46.6244, 'the US embassy in Riyadh'],
    [/الحي الدبلوماسي|حي السفارات/, 'Diplomatic Quarter, Riyadh', 24.6833, 46.6197, "Riyadh's diplomatic quarter"],
    [/الخرج/, 'Al-Kharj', 24.155, 47.334, 'Al-Kharj'],
    [/شيبة/, 'Shaybah oil field', 22.51, 53.97, 'the Shaybah oil field'],
    [/حفر الباطن/, 'Hafr al-Batin', 28.43, 45.96, 'Hafr al-Batin'],
    [/الملك خالد العسكرية/, 'King Khalid Military City', 27.9, 45.53, 'King Khalid Military City'],
    [/الملك عبدالعزيز الجوية|الملك عبد العزيز الجوية/, 'King Abdulaziz Air Base', 26.265, 50.152, 'the King Abdulaziz air base, Dhahran'],
    [/الجبيل/, 'Jubail', 27.01, 49.66, 'Jubail'],
    [/الظهران/, 'Dhahran', 26.29, 50.11, 'Dhahran'],
    [/الدمام/, 'Dammam', 26.43, 50.1, 'Dammam'],
    [/[اأ]?بقيق/, 'Abqaiq', 25.93, 49.67, 'Abqaiq'],
    [/القطيف/, 'Qatif', 26.56, 50.01, 'Qatif'],
    [/الأحساء|الاحساء|الهفوف/, 'Al-Ahsa', 25.38, 49.59, 'Al-Ahsa'],
    [/الخفجي/, 'Khafji', 28.42, 48.49, 'Khafji'],
    [/ر[اأ]س الخير/, "Ras al-Khair", 27.48, 49.27, 'Ras al-Khair'],
    [/ينبع/, 'Yanbu', 24.09, 38.06, 'Yanbu'],
    [/عرعر|منطقة الحدود الشمالية/, 'Arar', 30.98, 41.04, 'the Northern Borders region'],
    [/الجوف|سكاكا/, 'Al-Jawf', 29.97, 40.2, 'the Al-Jawf region'],
    [/القريات/, 'Qurayyat', 31.33, 37.34, 'Qurayyat'],
    [/طريف/, 'Turaif', 31.67, 38.66, 'Turaif'],
    [/تبوك/, 'Tabuk', 28.38, 36.57, 'Tabuk'],
    [/حائل/, "Ha'il", 27.52, 41.69, "Ha'il"],
    [/القصيم|بريدة/, 'Qassim', 26.33, 43.97, 'the Qassim region'],
    [/جدة/, 'Jeddah', 21.54, 39.17, 'Jeddah'],
    [/المدينة المنورة/, 'Medina', 24.47, 39.61, 'Medina'],
    [/الرياض/, 'Riyadh', 24.7136, 46.6753, 'Riyadh'],
    [/المنطقة الشرقية|الشرقية/, 'Eastern Province', 26.3, 49.9, 'the Eastern Province'],
  ],
  kw: [
    [/علي السالم/, 'Ali Al Salem Air Base', 29.3467, 47.5208, 'the Ali Al Salem air base'],
    [/عريفجان/, 'Camp Arifjan', 28.893, 48.159, 'Camp Arifjan'],
    [/بيورينغ|بوهرينغ|العديري/, 'Camp Buehring', 29.67, 47.41, 'Camp Buehring'],
    [/بوبيان/, 'Bubiyan Island', 29.83, 48.25, 'Bubiyan island'],
    [/مطار الكويت/, 'Kuwait International Airport', 29.2266, 47.9689, 'Kuwait airport'],
    [/ميناء عبدالله|ميناء عبد الله/, 'Mina Abdullah refinery', 29.0, 48.15, 'the Mina Abdullah refinery'],
    [/مجمع الوزارات/, 'Ministries Complex, Kuwait City', 29.37, 47.98, "the government's ministries complex in Kuwait City"],
    [/الأحمدي|الاحمدي/, 'Ahmadi', 29.08, 48.08, 'Ahmadi'],
    [/(?<!دير )الزور/, 'Al-Zour refinery', 28.73, 48.37, 'the Al-Zour refinery'],
    [/الشعيبة/, 'Shuaiba', 29.04, 48.16, 'Shuaiba'],
    [/الجهراء/, 'Jahra', 29.34, 47.66, 'Jahra'],
  ],
  ae: [
    [/الظفرة/, 'Al Dhafra Air Base', 24.248, 54.547, 'the Al Dhafra air base'],
    [/قاعدة السلام/, 'Al Salam base, Abu Dhabi', 24.525, 54.385, 'the Al Salam military base in Abu Dhabi'],
    [/ميناء زايد/, 'Mina Zayed, Abu Dhabi', 24.52, 54.38, 'the Mina Zayed port in Abu Dhabi'],
    [/ميناء خليفة/, 'Khalifa Port', 24.81, 54.65, 'Khalifa Port'],
    [/مطار دبي/, 'Dubai International Airport', 25.2532, 55.3657, 'Dubai airport'],
    [/مطار (?:[أا]بوظبي|[أا]بو ظبي|زايد)/, 'Zayed International Airport', 24.433, 54.651, 'Abu Dhabi airport'],
    [/مركز دبي المالي/, 'DIFC, Dubai', 25.2125, 55.2795, 'the Dubai International Financial Centre'],
    [/ميناء راشد/, 'Port Rashid', 25.27, 55.28, 'Port Rashid'],
    [/خورفكان|خور فكان/, 'Khor Fakkan', 25.34, 56.36, 'Khor Fakkan'],
    [/(?:ال)?مصفح/, 'Mussafah', 24.35, 54.5, 'Mussafah'],
    [/برج العرب/, 'Burj Al Arab, Dubai', 25.1412, 55.1853, 'the Burj Al Arab in Dubai'],
    [/[أا]براج الاتحاد/, 'Etihad Towers, Abu Dhabi', 24.4585, 54.3226, 'the Etihad Towers in Abu Dhabi'],
    [/نخلة جميرا/, 'Palm Jumeirah', 25.1124, 55.139, 'the Palm Jumeirah'],
    [/قرية الحمراء|الجزيرة الحمراء/, 'Al Hamra, Ras al-Khaimah', 25.69, 55.78, 'Al Hamra in Ras al-Khaimah'],
    [/كلباء/, 'Kalba', 25.05, 56.35, 'Kalba'],
    [/[أا]م القيوين/, 'Umm al-Quwain', 25.56, 55.55, 'Umm al-Quwain'],
    [/عجمان/, 'Ajman', 25.41, 55.45, 'Ajman'],
    [/جبل علي/, 'Jebel Ali', 25.01, 55.06, 'Jebel Ali'],
    [/الفجيرة|فوز البترولية/, 'Fujairah', 25.12, 56.33, 'Fujairah'],
    [/الرويس/, 'Ruwais', 24.11, 52.73, 'Ruwais'],
    [/براكة/, 'Barakah nuclear plant', 23.96, 52.26, 'the Barakah nuclear plant'],
    [/الشارقة/, 'Sharjah', 25.35, 55.39, 'Sharjah'],
    [/ر[اأ]س الخيمة/, 'Ras al-Khaimah', 25.79, 55.94, 'Ras al-Khaimah'],
    [/العين/, 'Al Ain', 24.21, 55.74, 'Al Ain'],
    [/دبي/, 'Dubai', 25.2, 55.27, 'Dubai'],
    [/[أا]بوظبي|[أا]بو ظبي/, 'Abu Dhabi', 24.45, 54.38, 'Abu Dhabi'],
  ],
  qa: [
    [/قاعدة العديد|العديد الجوية|العديد (?:في|ب)قطر|العديد القطرية/, 'Al Udeid Air Base', 25.117, 51.315, 'the Al Udeid air base'],
    [/ر[اأ]س لفان/, 'Ras Laffan', 25.91, 51.55, 'Ras Laffan'],
    [/مسيعيد/, 'Mesaieed', 24.99, 51.55, 'Mesaieed'],
    [/الوكرة/, 'Al Wakrah', 25.17, 51.6, 'Al Wakrah'],
    [/الدوحة/, 'Doha', 25.285, 51.531, 'Doha'],
  ],
  bh: [
    [/الجفير|الأسطول الخامس|الاسطول الخامس/, 'NSA Bahrain, Juffair', 26.208, 50.607, 'the US Fifth Fleet base at Juffair'],
    [/عيسى الجوية|قاعدة عيسى/, 'Isa Air Base', 25.918, 50.591, 'the Isa air base'],
    [/المحرق|مطار البحرين/, 'Muharraq', 26.27, 50.63, 'Muharraq'],
    [/سترة|بابكو/, 'Sitra', 26.15, 50.62, 'Sitra'],
    [/مدينة سلمان الصناعية/, 'Salman Industrial City', 26.21, 50.66, 'the Salman Industrial City'],
    [/مدينة حمد/, 'Hamad Town', 26.11, 50.5, 'Hamad Town'],
    [/الرفاع/, 'Riffa', 26.13, 50.55, 'Riffa'],
    [/المنامة/, 'Manama', 26.2235, 50.5876, 'Manama'],
  ],
  jo: [
    [/موفق السلطي|(?:قاعدة|قاعدتي|مدينة|منطقة|في|ب|و)\s?(?:ال)?(?:أزرق|ازرق)(?! (?:اللون|الدولي|الصافي))|(?:الأزرق|الازرق) (?:الأردني|الاردني|الجوية|في الأردن|في الاردن|بالأردن|بالاردن|شرق)/, 'Muwaffaq Salti Air Base', 31.8267, 36.7822, 'the Muwaffaq Salti air base'],
    [/مطار (?:الملك حسين|العقبة)/, 'Aqaba airport', 29.6116, 35.0181, 'the Aqaba airport'],
    [/(?:قاعدة|قاعدتي) الملك حسين|الملك حسين الجوية|(?:قاعدة|قاعدتي|و)الملك حسين/, 'King Hussein Air Base', 32.356, 36.259, 'the King Hussein air base, Mafraq'],
    [/الملك فيصل|(?:قاعدة )?الجفر/, 'King Faisal Air Base', 30.32, 36.15, 'the King Faisal air base, Al-Jafr'],
    [/المنطقة الحرة (?:\S+ ){0,2}(?:السورية|الأردنية|الاردنية)|جابر الحدودي/, 'Jordanian-Syrian free zone', 32.47, 36.2, 'the Jordanian-Syrian free zone'],
    [/طريبيل|منفذ الكرامة/, 'Karameh border crossing', 33.0, 38.82, 'the Karameh crossing on the Iraqi border'],
    [/الأمير حسن|الامير حسن|(?<![A-Za-z-])H-?5(?![\d])/, 'Prince Hassan Air Base', 32.16, 37.15, 'the Prince Hassan air base'],
    [/البرج 22|برج 22|Tower 22|الركبان/, 'Tower 22', 33.32, 38.7, 'the Tower 22 base'],
    [/الرويشد/, 'Ruwaished', 32.5, 38.2, 'Ruwaished'],
    [/الرمثا/, 'Ramtha', 32.56, 36.0, 'Ramtha'],
    [/كفرسوم|كفر سوم/, 'Kufr Soum', 32.69, 35.8, 'Kufr Soum'],
    [/الزميلة/, 'Al-Zameelah', 31.5436, 36.0439, 'Al-Zameelah'],
    [/الأغوار|الاغوار/, 'Jordan Valley', 32.1, 35.57, 'the Jordan Valley'],
    [/الصفاوي/, 'Safawi', 32.2, 37.13, 'Safawi'],
    [/الكرك/, 'Karak', 31.18, 35.7, 'Karak'],
    [/إربد|اربد/, 'Irbid', 32.55, 35.85, 'Irbid'],
    [/الزرقاء/, 'Zarqa', 32.07, 36.09, 'Zarqa'],
    [/المفرق/, 'Mafraq', 32.34, 36.21, 'Mafraq'],
    [/معان/, "Ma'an", 30.19, 35.73, "Ma'an"],
    [/العقبة/, 'Aqaba', 29.53, 35.0, 'Aqaba'],
    [/الطفيلة/, 'Tafilah', 30.84, 35.6, 'Tafilah'],
    [/مادبا/, 'Madaba', 31.72, 35.79, 'Madaba'],
    [/البلقاء|السلط(?![ةهاـ])/, 'Salt', 32.04, 35.73, 'the Balqa province'],
    [/جرش/, 'Jerash', 32.28, 35.9, 'Jerash'],
    [/عجلون/, 'Ajloun', 32.33, 35.75, 'Ajloun'],
    [/عمّان|العاصمة عمان|العاصمة الأردنية|العاصمة الاردنية|في عمان(?=\s|$)/, 'Amman', 31.95, 35.93, 'Amman'],
  ],
  om: [
    [/الدقم/, 'Duqm', 19.67, 57.7, 'Duqm'],
    [/صلالة/, 'Salalah', 17.02, 54.09, 'Salalah'],
    [/صحار/, 'Sohar', 24.36, 56.75, 'Sohar'],
    [/خصب/, 'Khasab', 26.18, 56.25, 'Khasab'],
    [/مسقط/, 'Muscat', 23.59, 58.41, 'Muscat'],
  ],
};
const AR = '\u0621-\u064A';
const word = (re) => new RegExp(String.raw`(?<![${AR}])(?:[وبلف]|وب|ول)?(?:${re.source})(?![${AR}])`);
for (const c of Object.keys(P)) for (const x of P[c]) x[0] = word(x[0]);
// Words start a word: "يدين" (condemns) is not inside "جديدين" (two new ones).
const start = (re) => new RegExp(`(?<![${AR}])(?:[وبلف]|ال|وال|بال|لل|وب|ول)?(?:${re.source})`);
const SAUDI_SOUTH = /جازان|جيزان|نجران|خميس مشيط|[أا]بها|ظهران الجنوب|عسير/;
// A city, an emirate or a province: dropped when a finer place within 80 km of it is named.
const BROAD = new Set(['Riyadh', 'Eastern Province', 'Al-Kharj', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Fujairah', 'Ras al-Khaimah', 'Ajman', 'Umm al-Quwain', 'Al Ain', 'Doha', 'Manama', 'Muharraq', 'Amman', 'Irbid', 'Zarqa', 'Mafraq', 'Karak', "Ma'an", 'Salt', 'Jordan Valley', 'Ahmadi', 'Jahra', 'Muscat', 'Al-Ahsa', 'Qassim', 'Al-Jawf', 'Arar']);
// Names that are words too ("العين" an eye, "العقبة" an obstacle, "مسقط رأس" a birthplace): a report needs its
// country named beside them.
const WEAK = new Set(['Jordan Valley', 'Amman', 'Al Ain', 'Eastern Province', "Ma'an", 'Sitra', 'Khasab', 'Muscat', 'Mafraq', 'Zarqa', 'Shuaiba', "Ha'il", 'Shaybah oil field', 'Salt', 'Riffa', 'Al-Jawf', 'Muharraq']);
// A country by its name in a report (not its adjective: "من الجنسية الأردنية" is a person, not a place).
const CW = [
  [/السعودية|المملكة العربية/, 'sa'], [/الإمارات(?!ي)|الامارات(?!ي)/, 'ae'], [/(?:^|[\s#])قطر(?![يا])/, 'qa'], [/القوات المسلحة الأردنية|الجيش الأردني|الجيش الاردني|الإعلام العسكري الأردني|الحياري|المجال الجوي الأردني|المجال الجوي الاردني|الأجواء الأردنية|الاجواء الاردنية|الأراضي الأردنية|الاراضي الاردنية|(?:الدفاعات|الدفاع الجوي|القوات|الدفاعات الجوية|العاصمه|العاصمة|سماء|أجواء|اجواء|المدن|القواعد|قاعدة) (?:الجوية )?(?:ال)?(?:أردني|اردني)(?:ة|ه)?|المسلحة ?(?:الأردنية|الاردنية)|المملكة (?:الأردنية|الاردنية)/, 'jo'], [/الكويت(?!ي)/, 'kw'],
  [/البحرين(?!ي)/, 'bh'], [/الأردن(?!ي)|الاردن(?!ي)/, 'jo'], [/سلطنة ع[ُ]?مان|عُمان/, 'om'],
];
// The same, any form, for a weak place's check.
const CWANY = { sa: /سعودي/, ae: /[إا]مارات/, qa: /قطر/, kw: /كويت/, bh: /بحرين/, jo: /[أا]ردن/, om: /ع[ُ]?مان|العماني/ };

// An attack word with a weapon or an act of war in it: a fire at a factory is not one.
const ATTACK = start(/(?:تعاملت|تتعامل|تصدت|تتصدى|اعترضت|تعترض) (?:ال)?دفاعات|الدفاعات الجوية (?:\S+ ){0,2}(?:تتعامل|تعاملت|تتصدى|تصدت|تعترض|اعترضت)|تسقط|يسقط|يعترض|تعترض|نعترض|سقوط مباشر|[أا]صاب(?:ت|ا)? (?:\S+ )?(?:القاعدة|قاعدة|هدف|بشكل مباشر)|(?:ال)?اعتداء (?:ال)?(?:صاروخي|بالصواريخ|بالمسيرات)|هاجم|هاجمنا|هاجمت|تستهدف|يستهدف|استهدفت|إصابة مباشرة|اصابة مباشرة|سقط صاروخ|سقطت|اعتراض|اعترض|تدمير|دمرنا|إسقاط|اسقاط|[أا]سقط|تحييد|تصد[تي]|تتصدى|التصدي|يتصدى|نتصدى|التعامل مع (?:صاروخ|صواريخ|مسير|هجم|الهجم|تهديد|[أا]هداف)|تعامل(?:نا|ت) مع|تتعامل مع|نتعامل مع|هجوم|هجمات|هجمة|استهداف|استهدف|عدوان|اعتداء|شظايا|حطام|سقوط (?:\d+ )?(?:صاروخ|صواريخ|مسير|طائرة|جسم|[أا]جسام|بقايا|شظايا|حطام)/);
// A report may tell it by what was heard and seen: blasts, a strike, shelling.
const BLAST = start(/يهز|تهز|هزت|رشقة|رشقات|[أا]طلقت|إطلاق|اطلاق|انفجار|انفجارات|دوي(?!ل)|قصف|يدك|تدك|ضربة|ضربات|هجوم صاروخي|اعتراضات/);
// A report's attack is told in the words of war: a missile, a drone, blasts, an interception, a base.
const WAR = start(/صاروخ|صواريخ|مسير|طائرة|طائرات|شظايا|حطام|جسم|[أا]جسام|انفجار|دوي(?!ل)|قصف|غارة|غارات|اعتراض|باليستي|الدفاع(?:ات)? الجوي|قاعدة|قاعدت(?:ي|ين|ان)|قواعد|مطار|سقوط مباشر/);
// The words of a report that is not an attack: after the fact, or of something else.
const SIRENS = /(?:صافرات|صفارات) (?:الإنذار|الانذار)(?: تدوي)?|دوي (?:صافرات|صفارات)(?: الإنذار| الانذار)?/g;
// Not one day's attack: tallies over days, footage, notices, drills, denials, yesterday's news; condemnations,
// warnings, meetings and other words about the war; the army's own raids on smugglers; a technical fault.
const NOT = start(/منذ بد[ءا]|منذ بداية|إجمالي|اجمالي|حصيلة|خلال (?:الـ?\s*)?\d+ (?:يوم|أيام|ايام)|خلال (?:الـ?\s*)?(?:48|72|96) ساعة|في \d+ (?:يوم|يومًا|يوما)|خلال (?:الأيام|الايام|الأسبوع|الاسبوع|الشهر)|مشاهد|فيديو|لقطات|صور ل|التخلص من|تمرين|مناورة|لا صحة|تنفي|ينفي|نفت|نفى|شائعات|(?:^|\s)(?:أمس|امس)(?=\s|$|،|\.)|البارحة|سابق|تحذر|تحذير|يرجى|ترجو|تدعو|غرفة عمليات|تدريب|وفد|اجتماع|اتصال|بحث|يلتقي|التقى|يشارك|زيارة|يدين|تدين|ندين|[أا]دان|إدانة|ادانة|استنكار|تستنكر|نستنكر|نحمل|تحمل|رفض|ترفض|انتهاك|سافر|تبرير|ذريعة|سيادت|القانون الدولي|مخزون|نحتفظ|تحتفظ|حق الرد|لن نتردد|نعمل على|سنرد|سفير|السفير|مجلس الأمن|الأمم المتحدة|عزاء|نعي|ينعى|جنازة|تشييع|تجار|مخدرات|تهريب|مهرب|عطل فني|تسرب|ضمن منظومة|الجاهزية|اشتراطات|حج |يثمن|يشيد|حفل|اليوم الوطني|عروض|نقف مع|القوة الباكستانية|تهديد(?:ا)? (?:مباشر|خطير)|يمثل|جنوب بارس|براكة النووية تهديد|لم يتم|احتجاج|الخطوط الحمراء|مواصلة|العمل المشترك|لمواجهة|وزير الدفاع|كلمة|خطاب|«/);
// A report's own doubts and its words about the war: a threat, a warning, what may come, a launch from a Gulf
// base at Iran, missiles crossing on their way to Israel, Hebrew media's speculation.
const RNOT = start(/يهدد|تهدد|تهديد|توعد|يتوعد|إذا|اذا |في حال|سيتم|سنستهدف|ستستهدف|سوف|محتمل|تحليل|الإعلام العبري|الاعلام العبري|؟|كاذب|مزاعم|انطلاق[اًا]* من|من (?:قاعدة|قواعد) [^ ]+ (?:في|ب)|متجهة (?:نحو|إلى|الى) (?:إسرائيل|اسرائيل|الكيان|الأراضي المحتلة|الاراضي المحتلة|فلسطين)|نحو (?:الأراضي المحتلة|الاراضي المحتلة|الكيان)|يستعد|تستعد|أسعار|اسعار|البورصة|الأسهم|تناقش|يناقش|مباحثات|يبحث|تبحث|يطالب|تطالب|يعزي|تعزي|منجم|غير صحيح|تداول|تشويش|الأقمار الصناعية|الاقمار الصناعية|مجلة|يوثق|لحظة|ستحترق|ستطال|سيطال|ستشمل|ستضرب|سنضرب|مقامرة|تنسحب|انسحاب|ضبط|حادثة|يتهم|تتهم|اتهم|التحقيق|تحقيق|تقرير|تكشف|يكشف|كشفت|مظهرا|تستأنف|استأنف|استئناف|بعد نحو|قبل نحو|قبل أيام|الشهر الماضي|الأسبوع الماضي|الاسبوع الماضي|لم تتعرض|لم تصب|لتجنب|لا توجد|[أا]قمار صناعية|صور[ةه]|توثيق|يوثق|تحديد هوية|يعتقد أنه|يعتقد انه/);
// Someone else's words quoted: Israel's army, Hezbollah, a minister, a president.
const OTHERS = start(/إسرائيل|اسرائيل|الإسرائيلي|الاسرائيلي|حزب الله|ترامب|البيت الأبيض|البنتاغون|الخارجية|وزير|رئيس|المتحدث|الكرملين|نتنياهو|قاليباف|عراقجي/);
// Another theatre named: Lebanon, Gaza, Syria, Sudan; the Gulf's places are not theirs.
const ELSE = start(/لبنان|غزة|سوريا|السودان|الدعم السريع|ليبيا|أوكرانيا|اوكرانيا|روسيا|فنزويلا/);
const SEA = /ناقل|سفين|زورق|قبالة|منصة حفر|ميلا|ميل بحري|الممر الملاحي/;
const IRAN = /إيران|ايران|الإيراني|الايراني|إيرانية|ايرانية|الحرس الثوري/;
const IRAQ = /من العراق|الأراضي العراقية|الاراضي العراقية|من الأجواء العراقية|عراقية المصدر|انطلقت من العراق|جاءت من العراق|المقاومة الإسلامية في العراق|المقاومة الاسلامية في العراق/;
const YEMEN0 = /اليمن|الحوثي|حوثي|اليمنية|صنعاء|أنصار الله|انصار الله|يمني|يحيى سريع|يحيى السريع|العدو السعودي|مأرب|تعز|المخا|المخأ|صعدة|الحديدة/;
const YEMEN = new RegExp(`(?<![${AR}])(?:[وبلف]|ال|وال|بال|لل)?(?:${YEMEN0.source})(?![${AR}])`);
// A tally: a count of a hundred or more, not today's.
const bigCount = (t) => !/اليوم/.test(t) && (t.match(/\d+/g) || []).some((n) => +n >= 100 && +n < 1900);

// The seas: [pattern, place, lat, lng, English]. Red Sea and Aden are the Yemen desk's; Iran's coast is Iran's.
const SEAS = [
  [/مضيق هرمز|(?:في|قرب|عند|بمضيق) هرمز(?![غج])/, 'Strait of Hormuz', 26.55, 56.45, 'the Strait of Hormuz'],
  [/خليج ع[ُ]?مان|(?:قبالة|سواحل|ساحل|مياه) (?:سلطنة )?ع[ُ]?مان/, 'Gulf of Oman', 24.9, 58.2, 'the Gulf of Oman'],
  [/بحر العرب/, 'Arabian Sea', 17.5, 60.5, 'the Arabian Sea'],
  [/المحيط الهندي|سريلانكا|سيريلانكا/, 'Indian Ocean', 5.6, 80.2, 'the Indian Ocean off Sri Lanka'],
  [/(?<!دويلات |دول |بلدان |قواعد |عواصم |مشيخات |[أا]نظمة )الخليج (?:العربي|الفارسي)|مياه الخليج/, 'Persian Gulf', 27.0, 51.5, 'the Gulf'],
];
const SHIPW = /ناقل|سفين|سفن|زورق|زوارق|حاملة|مدمرة|باخرة|بارجة|فرقاطة|بوارج/;
const RED = /البحر الأحمر|البحر الاحمر|باب المندب|خليج عدن|المخا|الحديدة|ينبع|جدة|إيلات|ايلات|العقبة/;
const IRAN_COAST = /بندر عباس|قشم|جاسك|هرمزغان|هرمزجان|كيش|لارك|[أا]بو موسى|طنب|بوشهر|تشابهار|جابهار|سيريك|كنارك|عسلوية|خارك|كرجان|بندر لنجة/;
const SHIPACT = /استهداف|استهدف|تستهدف|يستهدف|هجوم(?!ي)|قصف|ضرب|إصابة|اصابة|[أا]صيبت|انفجار|انفجارات|دوي(?!ل)|اشتعال|حريق|النيران|غرق|إغراق|اغراق|[أا]غرق|صاروخ|مسير|تدمير|دمرت|مقذوف/;
const SHIPNOT = /احتجاز|احتجزت|مصادرة|توقيف|السيطرة على|[أا]لغام|إزالة|ازالة|مرافقة|عبور|عبرت|تعبر|حركة الملاحة|التأمين|صورة|القمر الصناعي|حتى الآن|حتى الان|ترسو|وصول|تصل|تتجه|متجهة|إرسال|ارسال|نشر|مرور|المرور|توقف|يتحدى|تتحدى/;
// The US or Israel striking at sea: their forces named as the ones who struck.
const US_STRIKE = /(?:القيادة (?:المركزية|الوسطى)|سنتكوم|البحرية الأمريكية|البحرية الأميركية|الجيش الأمريكي|الجيش الأميركي|القوات الأمريكية|القوات الأميركية|ترامب|البنتاغون|الطيران الأمريكي|مروحيات أمريكية|طائرات أمريكية|مقاتلات أمريكية)[^.]{0,40}(?:تدمير|دمر|إغراق|اغراق|[أا]غرق|استهداف|استهدف|ضرب|قصف|تعلن|تدعي|يعلن)/;
const US = /الأمريكي|الأمريكية|الأميركي|الأميركية|أمريكي|أمريكية|أميركي|القيادة الوسطى|سنتكوم|البحرية الأمريكية/;
const ISR = /الإسرائيلي|الاسرائيلي|إسرائيلية|اسرائيلية|الاحتلال/;
const IR_TARGET = /(?:زورق|زوارق|سفين[ةه]|سفن|ناقل[ةه]|مدمر[ةه]|فرقاط[ةه]|بارج[ةه])\S* (?:\S+ )?(?:إيراني|ايراني|الإيراني|الايراني|للحرس|الحرس)/;
const IR_ATTACK = /الحرس الثوري|حرس الثورة|صواريخ إيرانية|صاروخ إيراني|مسيرة إيرانية|مسيرات إيرانية|ضربة [اإ]يرانية|البحرية الإيرانية|بحرية الحرس|إيران تستهدف|ايران تستهدف|استهداف [اإ]يراني|هجوم [اإ]يراني|خاتم الأنبياء/;

const weapons = (t) => {
  const w = [];
  if (/باليستي/.test(t)) w.push('ballistic missiles');
  if (/كروز|جوال/.test(t)) w.push('cruise missiles');
  if (!w.length && /صاروخ|صواريخ/.test(t)) w.push('missiles');
  if (/مسير|مسيّر|مسيَّر|طائرات? بدون طيار|درون/.test(t)) w.push('drones');
  return w.length ? (w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w.at(-1) : w[0]) : 'an attack';
};

const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const SHIPLAB = /\b(?:tanker|vessel|ship|carrier|tug|nautical miles)\b/i;
const dayN = (d) => Date.parse(d) / 864e5;
// A report beside a pin already made: that attack's second source. It takes the pin's point, so the merge folds it.
const snap = (e, r) => {
  // On land, only a pin in the same country, never an alert in Israel (a report of Jordan in general is not Ein Gedi's).
  const own = (p) => { if (/alerts in/.test(p.label)) return false; const c = countryAt(p.lat, p.lng); return c === e.country || (!c && km(p, e) < 40); };
  const near = BASE.filter((p) => (r.ship ? SHIPLAB.test(p.label) && Math.abs(dayN(p.day) - dayN(e.day)) <= 1 : p.day === e.day && !SHIPLAB.test(p.label) && own(p)) && km(p, e) < r.km)
    .sort((a, b) => Math.abs(dayN(a.day) - dayN(e.day)) - Math.abs(dayN(b.day) - dayN(e.day)) || km(a, e) - km(b, e))[0];
  if (near) Object.assign(e, { lat: near.lat, lng: near.lng, day: near.day, snapped: near.place });
};

const norm = (s) => s.replace(/&rlm;|[‌‎‏]/g, '').replace(/[ً-ْ]/g, '');
const rows = [];
for (const f of files) {
  const base = f.replace(/^.*[\\/]/, '').replace(/\.jsonl$/, '');
  const handle = /^hd\d$/.test(base) ? 'AlHadath_Brk' : /^aj\d$/.test(base) ? 'ajanews' : /^ar\d$/.test(base) ? 'AlArabiya' : base === 'petra' ? 'petranews' : base.replace(/-\d$/, '');
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l) rows.push({ ...JSON.parse(l), handle });
}
const ev = [];
const skip = {};
let CUR = '';
const no = (k) => { skip[k] = (skip[k] || 0) + 1; if (process.env.GDEBUG && new RegExp(process.env.GDEBUG).test(CUR)) console.error(k, '|', CUR.slice(0, 150)); };
rows.sort((a, b) => (a.at < b.at ? -1 : 1));
const seenId = new Set();
const keep = (e, url, source) => {
  const had = ev.find((x) => x.key === e.key);
  // One pin a place a day; a later statement that names who launched it gives the pin its side.
  if (had) {
    if (had.actor === 'unclear' && e.actor !== 'unclear') { const also = had.also; Object.assign(had, e, { also }); return; }
    if (had.source !== source && !had.also.some((a) => a.source === source) && had.also.length < 4) had.also.push({ source, url });
    return;
  }
  ev.push({ ...e, also: [] });
};
for (const r of rows) {
  if (!r.at || r.at < '2026-02-28') continue;
  const id = r.handle + r.id;
  if (seenId.has(id)) continue;
  seenId.add(id);
  const raw = norm(r.text || '').replace(/https?:\/\/\S+|\S+\.(?:gov\.jo|tv|com|net)\/\S*/g, '');
  // The opening line or sentence carries the news; Petra and Al Hadath put it all in one line. An account's own
  // statement is read to the end of its news, before the tally and the explanation that follow.
  const title = raw.split('\n')[0].trim();
  let head = OWN[r.handle] && title.length >= 30 && title.length < 300 && ATTACK.test(title) ? title
    : OWN[r.handle]
    ? raw.replace(/^\s*(?:#?بيان(?: رقم)? ?\(?\d*\)?|#بيان \|)\s*/, '').split(/\s*(?:وتؤكد|وتهيب|ويرجى|يرجى|تنوه|#الجيش)/)[0].replace(/\s+/g, ' ').slice(0, 500)
      .split(/(?<=[.،])\s*(?=و?(?:أوضحت|اوضحت|أشارت|اشارت|أضافت|اضافت|منذ بد|وبذلك|يذكر أن|كما |بلغ|ليصل|ليرتفع))/)[0]
    : raw.split(/\n\s*\n|(?<=[.!])\s+(?=وتؤكد|وتهيب|ويرجى)/)[0];
  head = head.replace(/^[^؀-ۿA-Za-z0-9"«]+/u, '').replace(/^#?عاجل\s*[|:]*\s*/, '').replace(/^[^؀-ۿA-Za-z0-9"«]+/u, '').trim();
  if (!head) continue;
  CUR = head;
  const body = raw.slice(0, 900);
  const source = SRC[r.handle] || r.handle;
  const url = r.url || `https://t.me/${r.handle}/${r.id}`;
  const lt = new Date(Date.parse(r.at) + 3 * 3600e3);
  const lastNight = /الليلة الماضية|ليلة (?:أمس|امس)/.test(head) && lt.getUTCHours() < 14;
  const local = new Date(lt - (lastNight ? 864e5 : 0)).toISOString().slice(0, 10);
  // Who speaks: the account itself, an official quoted by name, a claimant, or the channel's own report.
  // A first line that is only a speaker ("الإعلام الأجنبي:"): its words are on the lines after.
  if (/[:：]$/.test(head)) head = raw.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').slice(0, 400).replace(/^[^\u0600-\u06FFA-Za-z0-9"«]+/u, '').replace(/^#?عاجل\s*[|:]*\s*/, '').trim();
  let cc = OWN[r.handle], mode = cc ? 'official' : null, claim = null;
  const lead = head.split(/[:：]|\.\./)[0].trim();
  const quoted = lead !== head && lead.length <= 70;
  if (!cc) {
    const s = quoted && (r.handle === 'petranews' && /القوات المسلحة|سلاح الجو|الأمن العام|الامن العام|الجيش/.test(lead) ? [null, 'jo'] : SPEAKER.find(([re]) => re.test(lead.replace(/^["«]|["»]$/g, ''))));
    if (s) { cc = s[1]; mode = 'official'; }
    else if (quoted && (claim = CLAIM.find(([re]) => re.test(lead)))) mode = 'claim';
    else if (REPORTS.has(r.handle) || r.handle === 'petranews') mode = 'report';
    else { no('no speaker'); continue; }
  }
  const report = mode !== 'official';
  if (YEMEN.test(body) && !IRAN.test(body)) { no('from Yemen (Yemen desk)'); continue; }

  // At sea.
  if (report && quoted && !claim && OTHERS.test(lead) && !/القناة|إذاعة|اذاعة|صحيفة|معاريف|يديعوت|هآرتس|هارتس|وسائل إعلام|وسائل اعلام|مراسل|موقع/.test(lead)) { no("someone else's words"); continue; }
  if (report && ELSE.test(head)) { no('another theatre'); continue; }
  if (SHIPW.test(head) || (SEAS.some(([re]) => re.test(head)) && /انفجار|دوي(?!ل)/.test(head))) {
    if (mode === 'official' && OWN[r.handle] && !/ناقل|سفين/.test(head)) { no('at sea'); continue; }
    if (!SHIPACT.test(head) || SHIPNOT.test(head) || NOT.test(head) || RNOT.test(head.replace(/تهديد/g, '')) || bigCount(head)) { no('at sea, not an attack'); continue; }
    if (RED.test(head)) { no('Red Sea (Yemen desk)'); continue; }
    if (IRAN_COAST.test(head)) { no("Iran's coast (Iran's sources)"); continue; }
    // A port or a town named: off it; else the sea it is in.
    let at = null;
    for (const c of Object.keys(P)) for (const [re, place, lat, lng, en] of P[c]) {
      if (at || WEAK.has(place)) continue;
      const m = head.match(new RegExp(String.raw`(?:قبالة|سواحل|ساحل|ميناء|مرفأ|قرب|بالقرب من) (?:\S+ ){0,2}?(?:` + re.source + ')'));
      if (m) at = { said: m[0], place: 'off ' + place, lat, lng, en: 'off ' + en.replace(/^the /, '') };
    }
    for (const [re, place, lat, lng, en] of SEAS) {
      if (at) break;
      const m = head.match(re);
      if (m) at = { said: m[0], place, lat, lng, en };
    }
    if (!at) { no('at sea, no sea named'); continue; }
    if (claim && !/استهدف|استهداف|ضرب|هاجم|هجوم|قصف|[أا]صب|دمر|تدمير|[أا]غرق/.test(head)) { no('claim, no strike'); continue; }
    const actor = claim ? claim[1] : US_STRIKE.test(head) ? 'us' : (US.test(head) || ISR.test(head)) && IR_TARGET.test(head) ? (ISR.test(head) && !US.test(head) ? 'israel' : 'us') : IR_ATTACK.test(head) ? 'iran' : 'unclear';
    const subj = /حاملة (?:ال)?طائرات (?:ال)?(?:أمريكية|امريكية|أميركية)/.test(head) ? 'a US aircraft carrier' : /حاملة/.test(head) ? 'an aircraft carrier' : /مدمرة|فرقاطة|بارجة|بوارج/.test(head) ? 'a warship' : /ناقل/.test(head) ? 'a tanker' : /زورق|زوارق/.test(head) ? 'boats' : SHIPW.test(head) ? 'a ship' : null;
    const iranian = IR_TARGET.test(head) ? 'Iranian ' : '';
    const S = subj ? (iranian ? iranian + subj.replace(/^an? /, '') : subj) : null;
    const vessel = S && S.replace(/boats/, 'vessels');
    const by = mode === 'official' ? `${C[cc].name} says` : claim ? null : `${source} reports`;
    const label = claim ? `${claim[2]} says it struck ${vessel || 'targets at sea'} ${at.en.startsWith('off ') ? '' : 'in '}${at.en}`
      : vessel ? `${vessel[0].toUpperCase() + vessel.slice(1)} attacked ${at.en.startsWith('off ') ? '' : 'in '}${at.en}, ${by}`
      : `Explosions at sea ${at.en.startsWith('off ') ? '' : 'in '}${at.en}, ${by}`;
    const e = { key: `${local}|sea|${at.place}|${vessel || 'blast'}`, day: local, actor, said: at.said, country: '', label, source, url, text: head, en: at.place, lat: at.lat, lng: at.lng };
    snap(e, { ship: true, km: at.place.startsWith('off ') ? 60 : 150 });
    keep(e, url, source);
    continue;
  }

  // The US military on land in the Gulf is a witness, not the striker: its words are a report of Iran's attack.
  if (claim && claim[1] === 'us') claim = null;
  const act = report ? head.replace(SIRENS, '') : head;
  const actA = act.replace(/(?:عدوان|اعتداء|العدوان|الاعتداء)(?! (?:ال)?(?:صاروخي|بالصواريخ|بالمسيرات))/g, '');
  if (!(report ? (ATTACK.test(actA) || BLAST.test(act)) && WAR.test(act) : ATTACK.test(head))) { no('not an attack'); continue; }
  const hq = head.replace(/«[^»]{1,20}»/g, '').replace(/(?:البيان|بيان رقم|المرحلة|الموجة|الموجه)\s*(?:رقم\s*)?\d+/g, '');
  // Missiles brought down over a Gulf state or Jordan on their way to Israel fall there: an event of its own.
  const down = /اعتراض|اعترض|يعترض|تعترض|تسقط|يسقط|[أا]سقط|إسقاط|اسقاط|سقوط|شظايا|حطام/.test(head);
  const rq = down ? hq.replace(/(?:متجه[ةه]?|في طريقها|في طريقه|باتجاه)? ?(?:نحو|إلى|الى) (?:إسرائيل|اسرائيل|الكيان|الأراضي المحتلة|الاراضي المحتلة|فلسطين)/g, '') : hq;
  if (NOT.test(hq) || bigCount(hq) || (report && RNOT.test(rq))) { no('tally, footage, notice or statement'); continue; }
  if (SEA.test(head.replace(/قبالة (?:إيلات|ايلات|إسرائيل|اسرائيل)/g, ''))) { no('at sea'); continue; }
  const ccs = cc ? [cc] : Object.keys(P);
  if (ccs.includes('sa') && SAUDI_SOUTH.test(head) && !IRAN.test(body)) { no('Saudi south, Houthi front'); continue; }
  const actor = claim ? claim[1] : IRAQ.test(body) ? 'iraqi_militias' : IRAN.test(body) ? 'iran' : 'unclear';
  // What happened, as the statement or the report tells it.
  const kind = /شظايا|حطام|بقايا|سقوط (?:جسم|[أا]جسام)/.test(act) ? 'debris' : !report && /محاولة|محاولات|إحباط|احباط|حاولت|حاول /.test(act) ? 'foiled'
    : /اعتراض|اعترض|إسقاط|اسقاط|[أا]سقط|تحييد|تصد[تي]|تتصدى|التصدي|يتصدى|نتصدى|التعامل مع|تعامل(?:نا|ت) مع|تتعامل|نتعامل|(?<!تم )تدمير (?:\d+ )?(?:صاروخ|صواريخ|مسير|طائر)|دمرنا/.test(head) ? 'intercept'
    : /سقوط|حريق|[أا]ضرار|إصاب|مقتل|وفاة|قتيل|[أا]صابت|تدمير|دمار|طال/.test(head) || (!report && /انفجار/.test(head)) ? 'hit'
    : report && /انفجار|دوي(?!ل)/.test(act) ? 'blast' : 'attack';
  // The places named, of the speaker's country, or of any Gulf state and Jordan in a report.
  const places = [];
  for (const c of ccs) for (const [re, place, lat, lng, en] of P[c]) {
    const m = head.match(re);
    if (!m) continue;
    if (report && WEAK.has(place) && !CWANY[c].test(head)) continue;
    places.push({ said: m[0], place, lat, lng, en, cc: c });
  }
  for (let i = places.length - 1; i >= 0; i--) if (BROAD.has(places[i].place) && places.some((q) => q !== places[i] && !BROAD.has(q.place) && km(q, places[i]) < 80)) places.splice(i, 1);
  // None named: the country in general, the speaker's, or each the report names.
  const gens = places.length ? [] : cc ? [{ cc, said: null }] : CW.flatMap(([re, c]) => { const m = head.match(re); return m ? [{ cc: c, said: m[0].trim() }] : []; });
  if (!places.length && !gens.length) { no(report ? 'report, no Gulf place' : 'no place'); continue; }
  const who = actor === 'iraqi_militias' ? (claim ? '' : ', launched from Iraq,') : actor === 'iran' && !claim ? ' from Iran' : '';
  const w = weapons(head);
  // "Attacks" with no weapon, no place and nothing intercepted or hit are words about the war, not an event.
  if (kind === 'attack' && !places.length && w === 'an attack') { no('words about attacks'); continue; }
  const adj = w === 'an attack' ? '' : w.replace(/missiles/g, 'missile').replace(/drones/g, 'drone') + ' ';
  const mk = (p, g) => {
    const cn = C[p ? p.cc : g.cc];
    const say = mode === 'official' ? `${cn.name} says` : `${source} reports`;
    const at = p ? p.en : cn.name + ' (place not stated)';
    const near = p ? (/base|refinery|field|embassy|plant|Military City|Riyadh's|airport|port|Port|Centre/.test(p.en) ? 'near ' : 'over ') + p.en : '(place not stated)';
    const W = w === 'an attack' ? 'Attack' : w[0].toUpperCase() + w.slice(1);
    const label = claim ? `${claim[2]} says it struck ${at}${w === 'an attack' ? '' : ' with ' + w}`
      : kind === 'debris' ? `Debris from ${w === 'an attack' ? 'an interception' : 'intercepted ' + w}${who} falls on ${at}, ${say}`
      : kind === 'foiled' ? `${say} it foiled ${adj ? 'a ' + adj : 'an '}attack${who} on ${at}`
      : kind === 'intercept' ? (mode === 'official' ? `${say} it intercepted ${w}${who} ${near}` : `${w === 'an attack' ? 'Interceptions' : W + who + ' intercepted'} ${near}, ${say}`)
      : kind === 'hit' ? `${W}${who} hit ${at}, ${say}`
      : kind === 'blast' ? `Explosions in ${at}, ${say}`
      : `${adj ? adj[0].toUpperCase() + adj.slice(1) : ''}${adj ? 'attack' : 'Attack'}${who} on ${at}, ${say}`;
    const e = { key: `${local}|${p ? p.place : g.cc}`, cc: p ? p.cc : g.cc, day: local, actor, said: p ? p.said : g.said || head.split(/[:：]/)[0].trim().slice(0, 40) || cn.name, country: cn.country || cn.name, label, source, url, text: head, en: p ? p.place : cn.name, lat: p ? p.lat : cn.gen[0], lng: p ? p.lng : cn.gen[1] };
    // A report on a place already pinned that day nearby: that attack's other source.
    if (report) snap(e, { km: p ? (BROAD.has(p.place) ? 40 : 5) : { sa: 400, ae: 120, om: 300, jo: 150 }[e.cc] || 60 });
    keep(e, url, source);
  };
  if (places.length) places.forEach((p) => mk(p, null)); else gens.forEach((g) => mk(null, g));
}
// A country in general only on a day with no place of it named (the follow-ups: fire from the debris, and so on).
for (let i = ev.length - 1; i >= 0; i--) if (ev[i].cc && ev[i].key.endsWith('|' + ev[i].cc) && ev.some((e) => e !== ev[i] && e.cc === ev[i].cc && e.day === ev[i].day)) ev.splice(i, 1);
// "said" must be in "text": for a statement with no place, it is the speaker's words before the colon, or the
// first words of an account's own post.
for (const e of ev) if (!e.text.includes(e.said)) e.said = e.text.slice(0, 30);
const outEv = ev.map(({ key, cc, snapped, ...e }) => ({ ...e, country: e.country || 'sea' }));
fs.writeFileSync(out, outEv.map((e) => JSON.stringify(e)).join('\n') + '\n');
fs.writeFileSync(out + '.review.txt', ev.map((e) => `${e.day} ${e.actor} ${e.en}${e.snapped ? ' =>' + e.snapped : ''} | ${e.label}\n   ${e.text.slice(0, 200)}\n   ${e.url}`).join('\n'));
const by = {};
for (const e of ev) by[(e.country || 'sea') + (e.snapped ? ' (on a pin)' : '')] = (by[(e.country || 'sea') + (e.snapped ? ' (on a pin)' : '')] || 0) + 1;
console.log(ev.length, 'events', by, 'skipped', skip);
