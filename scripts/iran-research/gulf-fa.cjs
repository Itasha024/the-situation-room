// Research (user, 10 Oct: "you took attacks in gulf states from axis channels and iran channels too right? if not then
// do"): attacks in the Gulf states, Jordan, Iraq and at sea, read from Iran's Persian channels (Fars, IRNA, Akhbar-e
// Fori) and the opposition's (Iran International, Vahid Online, Ilia) -> hand events. gulf.cjs reads the Arabic ones.
// A post's opening line is read when it tells one attack that day at a place named:
// - an act: a strike, a hit, blasts heard, an interception ("حمله", "هدف قرار", "اصابت", "انفجار", "رهگیری");
// - a place: a base, port, plant or city of a Gulf state, Jordan or Iraq on the list below; none named, the country
//   in general; at sea, a ship struck in Hormuz, the Gulf, the Gulf of Oman or the Arabian Sea;
// - not: footage, before-and-after pictures, tallies, digests ("اخبار مهم ۴ ساعت گذشته"), threats, arrests,
//   cyber attacks, closures, analysis, someone's words, launches crossing toward Israel, denials.
// Who: Iran when its forces claim it or Iran is named as the attacker; the Iraqi factions when they claim it; the US
// or Israel when named as the striker; else not stated. A report on a pin of that day nearby is its second source.
//   node gulf-fa.cjs out.jsonl --base public/iran-strikes-baseline.json ir/farsna-0.jsonl ...
const fs = require('fs');
const countryAt = require('./country-at.cjs');
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = bi >= 0 ? JSON.parse(fs.readFileSync(argv.splice(bi, 2)[1], 'utf8')) : [];
const [out, ...files] = argv;
const SRC = { farsna: 'Fars', irna_1313: 'IRNA', akhbarefori: 'Akhbar-e Fori', iranintltv: 'Iran International', VahidOnline: 'Vahid Online', iliaen: 'Ilia' };

// Persian and Arabic spellings are one: ي ی, ك ک, ة ه, أإآ ا; no vowel marks or half-spaces.
const norm = (s) => s.normalize('NFC').replace(/[ً-ْٰـ]/g, '').replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[‌‍​]/g, ' ').replace(/&#33;|&rlm;/g, ' ');
const L = '؀-ۿ';
const word = (re) => new RegExp(`(?<![${L}])(?:[وب]|ال|بال|وال)?(?:${re.source})(?![${L}])`);

const C = {
  sa: { name: 'Saudi Arabia', gen: [24.0, 45.0], re: /عربستان/ },
  ae: { name: 'UAE', country: 'United Arab Emirates', gen: [23.9, 54.3], re: /امارات/ },
  qa: { name: 'Qatar', gen: [25.3, 51.2], re: /قطر/ },
  kw: { name: 'Kuwait', gen: [29.31, 47.48], re: /کویت/ },
  bh: { name: 'Bahrain', gen: [26.07, 50.55], re: /بحرین/ },
  jo: { name: 'Jordan', gen: [31.25, 36.5], re: /اردن/ },
  om: { name: 'Oman', gen: [21.5, 57.0], re: /(?<!دریای |خلیج |دریا ی )عمان/ },
  iq: { name: 'Iraq', gen: null, re: /عراق/ },
};
const P = {
  sa: [
    [/سفارت (?:امریکا|ایالات متحده) در ریاض/, 'US embassy, Riyadh', 24.6797, 46.6244, 'the US embassy in Riyadh'],
    [/راس تنوره/, 'Ras Tanura refinery', 26.64, 50.16, 'the Ras Tanura refinery'],
    [/(?:پایگاه|پایگاه هوایی) (?:شاهزاده |امیر |پرنس |الامیر )?سلطان|(?:پایگاه|پایگاه هوایی) السلطان|شاهزاده سلطان|پرنس سلطان/, 'Prince Sultan Air Base', 24.0627, 47.5805, 'the Prince Sultan air base'],
    [/الخرج/, 'Al-Kharj', 24.155, 47.334, 'Al-Kharj'],
    [/شیبه/, 'Shaybah oil field', 22.51, 53.97, 'the Shaybah oil field'],
    [/ابقیق|بقیق/, 'Abqaiq', 25.93, 49.67, 'Abqaiq'],
    [/جبیل|الجبیل/, 'Jubail', 27.01, 49.66, 'Jubail'],
    [/ظهران/, 'Dhahran', 26.29, 50.11, 'Dhahran'],
    [/دمام/, 'Dammam', 26.43, 50.1, 'Dammam'],
    [/قطیف/, 'Qatif', 26.56, 50.01, 'Qatif'],
    [/ینبع/, 'Yanbu', 24.09, 38.06, 'Yanbu'],
    [/جده/, 'Jeddah', 21.54, 39.17, 'Jeddah'],
    [/حفر الباطن/, 'Hafr al-Batin', 28.43, 45.96, 'Hafr al-Batin'],
    [/تبوک/, 'Tabuk', 28.38, 36.57, 'Tabuk'],
    [/ریاض/, 'Riyadh', 24.7136, 46.6753, 'Riyadh'],
  ],
  kw: [
    [/علی السالم|السالم/, 'Ali Al Salem Air Base', 29.3467, 47.5208, 'the Ali Al Salem air base'],
    [/عریفجان/, 'Camp Arifjan', 28.893, 48.159, 'Camp Arifjan'],
    [/بیورینگ|بوهرینگ|بیورینگ/, 'Camp Buehring', 29.67, 47.41, 'Camp Buehring'],
    [/فرودگاه کویت/, 'Kuwait International Airport', 29.2266, 47.9689, 'Kuwait airport'],
    [/میناء عبدالله|مینا عبدالله/, 'Mina Abdullah refinery', 29.0, 48.15, 'the Mina Abdullah refinery'],
    [/الاحمدی|احمدی/, 'Ahmadi', 29.08, 48.08, 'Ahmadi'],
    [/الزور/, 'Al-Zour refinery', 28.73, 48.37, 'the Al-Zour refinery'],
    [/شعیبه|الشعیبه/, 'Shuaiba', 29.04, 48.16, 'Shuaiba'],
    [/بوبیان/, 'Bubiyan Island', 29.83, 48.25, 'Bubiyan island'],
  ],
  ae: [
    [/الظفره|ظفره/, 'Al Dhafra Air Base', 24.248, 54.547, 'the Al Dhafra air base'],
    [/فرودگاه دبی/, 'Dubai International Airport', 25.2532, 55.3657, 'Dubai airport'],
    [/فرودگاه ابوظبی|فرودگاه زاید/, 'Zayed International Airport', 24.433, 54.651, 'Abu Dhabi airport'],
    [/برج العرب/, 'Burj Al Arab, Dubai', 25.1412, 55.1853, 'the Burj Al Arab in Dubai'],
    [/نخل جمیرا|پالم جمیرا|جزیره نخل/, 'Palm Jumeirah', 25.1124, 55.139, 'the Palm Jumeirah'],
    [/جبل علی/, 'Jebel Ali', 25.01, 55.06, 'Jebel Ali'],
    [/خورفکان|خور فکان/, 'Khor Fakkan', 25.34, 56.36, 'Khor Fakkan'],
    [/فجیره/, 'Fujairah', 25.12, 56.33, 'Fujairah'],
    [/الرویس|رویس/, 'Ruwais', 24.11, 52.73, 'Ruwais'],
    [/براکه/, 'Barakah nuclear plant', 23.96, 52.26, 'the Barakah nuclear plant'],
    [/مصفح/, 'Mussafah', 24.35, 54.5, 'Mussafah'],
    [/شارجه/, 'Sharjah', 25.35, 55.39, 'Sharjah'],
    [/راس الخیمه/, 'Ras al-Khaimah', 25.79, 55.94, 'Ras al-Khaimah'],
    [/عجمان/, 'Ajman', 25.41, 55.45, 'Ajman'],
    [/ام القیوین/, 'Umm al-Quwain', 25.56, 55.55, 'Umm al-Quwain'],
    [/دبی/, 'Dubai', 25.2, 55.27, 'Dubai'],
    [/ابوظبی|ابو ظبی/, 'Abu Dhabi', 24.45, 54.38, 'Abu Dhabi'],
  ],
  qa: [
    [/العدید|عدید/, 'Al Udeid Air Base', 25.117, 51.315, 'the Al Udeid air base'],
    [/راس لفان/, 'Ras Laffan', 25.91, 51.55, 'Ras Laffan'],
    [/مسیعید/, 'Mesaieed', 24.99, 51.55, 'Mesaieed'],
    [/دوحه/, 'Doha', 25.285, 51.531, 'Doha'],
  ],
  bh: [
    [/ناوگان پنجم|الجفیر|جفیر/, 'NSA Bahrain, Juffair', 26.208, 50.607, 'the US Fifth Fleet base at Juffair'],
    [/پایگاه (?:هوایی )?(?:شیخ )?عیسی/, 'Isa Air Base', 25.918, 50.591, 'the Isa air base'],
    [/محرق|فرودگاه بحرین/, 'Muharraq', 26.27, 50.63, 'Muharraq'],
    [/سترا|سیتره|بابکو/, 'Sitra', 26.15, 50.62, 'Sitra'],
    [/منامه/, 'Manama', 26.2235, 50.5876, 'Manama'],
  ],
  jo: [
    [/موفق السلطی|موفق سلطی|الازرق/, 'Muwaffaq Salti Air Base', 31.8267, 36.7822, 'the Muwaffaq Salti air base'],
    [/برج ?22|برج ?۲۲/, 'Tower 22', 33.32, 38.7, 'the Tower 22 base'],
    [/رویشد/, 'Ruwaished', 32.5, 38.2, 'Ruwaished'],
    [/اربد/, 'Irbid', 32.55, 35.85, 'Irbid'],
    [/مفرق/, 'Mafraq', 32.34, 36.21, 'Mafraq'],
    [/زرقا/, 'Zarqa', 32.07, 36.09, 'Zarqa'],
    [/عقبه/, 'Aqaba', 29.53, 35.0, 'Aqaba'],
  ],
  om: [
    [/الدقم|دقم/, 'Duqm', 19.66, 57.7, 'Duqm'],
    [/صلاله/, 'Salalah', 17.02, 54.09, 'Salalah'],
    [/صحار/, 'Sohar', 24.36, 56.75, 'Sohar'],
    [/مسقط/, 'Muscat', 23.59, 58.41, 'Muscat'],
  ],
  iq: [
    [/فرودگاه (?:بین المللی )?اربیل/, 'Erbil airport', 36.2376, 43.9632, 'Erbil airport'],
    [/حریر/, 'Harir Air Base', 36.53, 44.33, 'the Harir air base'],
    [/عین الاسد/, 'Ain al-Asad Air Base', 33.8, 42.44, 'the Ain al-Asad air base'],
    [/سفارت (?:امریکا|ایالات متحده) در بغداد/, 'US embassy, Baghdad', 33.3, 44.38, 'the US embassy in Baghdad'],
    [/فرودگاه بغداد|ویکتوریا|ویکتوری/, 'Victory Base, Baghdad airport', 33.26, 44.23, 'the Victory base at Baghdad airport'],
    [/جرف الصخر|جرف النصر/, 'Jurf al-Sakhar', 32.88, 44.12, 'Jurf al-Sakhar'],
    [/کوی سنجق|کویه|کوی سنجاق/, 'Koya', 36.08, 44.63, 'Koya'],
    [/پنجوین/, 'Penjwen', 35.62, 45.95, 'Penjwen'],
    [/التاجی|تاجی/, 'Camp Taji', 33.53, 44.26, 'Camp Taji'],
    [/کرکوک/, 'Kirkuk', 35.47, 44.39, 'Kirkuk'],
    [/سلیمانیه/, 'Sulaymaniyah', 35.56, 45.43, 'Sulaymaniyah'],
    [/بصره/, 'Basra', 30.51, 47.78, 'Basra'],
    [/اربیل/, 'Erbil', 36.19, 44.01, 'Erbil'],
    [/بغداد/, 'Baghdad', 33.31, 44.36, 'Baghdad'],
  ],
};
for (const c of Object.keys(P)) for (const x of P[c]) x[0] = word(x[0]);
for (const c of Object.keys(C)) C[c].re = word(C[c].re);
const WEAK = new Set(['Ahmadi', 'Aqaba', 'Zarqa', 'Sitra', 'Koya', 'Camp Taji']);
const BROAD = new Set(['Riyadh', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Doha', 'Manama', 'Muharraq', 'Muscat', 'Erbil', 'Baghdad', 'Sulaymaniyah', 'Basra', 'Kirkuk', 'Ahmadi', 'Fujairah']);
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));

const ACT = /حمله|حملات|هدف قرار|مورد اصابت|اصابت|انفجار|انفجارها|رهگیری|رهگیر|سرنگون|منهدم|بمباران|موج .{0,30}عملیات|زیر ضرب|ضربه|ضربات|درهم کوبید|کوبیده/;
const NOT0 = /یحیی سریع|رمز موفقیت|موفقیت|بیروت|ضاحیه|نامه|دستور|تحقیق|پرچم دروغ|ادعای|اذعان|شبیه سازی|ماجرای|اثار|ویرانی|بزرگترین|مشاور|در جنگ اخیر|جنگ اخیر|اجازه|اعتبار|تضعیف|صنعت نفت|پس از شش ماه|شمار|امار|تابعیت|شهرک نشینان|نابلس|فلسطینی|صعده|رازح|حدیده|ربطی|ارتباطی ندارد|نقشی نداشت|چگونه|؟|\?|میزان تخریب|معرفی|جنگ رمضان|در طول جنگ|جزئیات|تلاش ناموفق|به دنبال حمل|بدنبال حمل|درپی حمل|در پی حمل|پس از حمل|پس از اصابت|بعد از اصابت|در واکنش|واکنش|لحظات|انتشار|فوتبال|تیم|بازی|داعش|تروریستی داعش|سفر|به تعویق|فیلم|ویدیو|ویدئو|تصاویر|تصویر|عکس|صحنه|لحظه|قبل و بعد|ماهواره|🎥|📹|مجموع|تاکنون|تا کنون|از آغاز|از ابتدای|روزهای اخیر|روزهای گذشته|روز گذشته|دیروز|دیشب(?! ساعت)|هفته گذشته|ماه گذشته|ساعت گذشته|اخبار مهم|مهمترین|pinned|تهدید|خواهد|خواهیم|خواهند|هشدار|احتمال|اگر|در صورت|بازداشت|دستگیر|زندان|اتهام|سایبری|هکر|تعطیل|لغو پرواز|پروازها|بورس|قیمت|نفت خام|تحلیل|کارشناس|ریاضیات|اراضی اشغالی|سرزمین های اشغالی|سرزمینهای اشغالی|فلسطین اشغالی|به سوی اسرائیل|به سمت اسرائیل|تل اویو|حیفا|تکذیب|شایعه|صحت ندارد|نادرست|ادعای دروغ|محکوم|محکومیت|مذاکره|تماس تلفنی|گفتگو|دیدار|نشست|بیانیه مشترک|اتحادیه عرب|شورای همکاری|شورای امنیت|سازمان ملل|بزرگداشت|سالگرد|جولان|پرواز|مشاهده شد|مشاهده شدند|در حال حرکت|مانور|رزمایش|تمرین|غرامت|خسارت ها|بیمه|حزب الله|لبنان|غزه|یمن|حوثی|انصارالله|صنعا|سوریه|دمشق|اوکراین|روسیه|ونزوئلا/;
const NOT = new RegExp(`(?<![${L}])(?:[وبل]|ال|بال|وال|می ?)?(?:${NOT0.source})`);
// Someone's words: a minister, a leader, a spokesman for politics; Iran's forces' own claims are not that.
const SPEAKER = /حاکم|پادشاه|ولیعهد|امیر قطر|سفیر|منابع اگاه|منبع اگاه|مقام های|مقامهای|مقام امریکایی|سناتور|بنیاد|مدیر|نخست وزیر|شهروند|وزارت خارجه|خبرگزاری فرانسه|نشریه|روزنامه|معاون|سرلشکر|سردار|سرتیپ|دریادار|فرمانده|وزیر|عراقچی|بقایی|پزشکیان|قالیباف|لاریجانی|ولایتی|خامنه ای|رئیس جمهور|رییس جمهور|ترامپ|نتانیاهو|روبیو|هگست|ونس|سخنگوی وزارت خارجه|سخنگوی دولت|نماینده|مجلس|کاخ سفید|پنتاگون|وال استریت|نیویورک تایمز|واشنگتن پست|اکسیوس|سی ان ان|رویترز|بلومبرگ|فایننشال|گاردین|تلگراف|نیوزویک|اسکای نیوز|فاکس/;
const CLAIM_IR = /سپاه|قرارگاه|خاتم الانبیا|نیروهای مسلح (?:جمهوری اسلامی|ایران|کشورمان|ج\.ا\.ا)|حملات (?:پهپادی |موشکی )?ارتش|پهپادهای ارتش|موشک های ارتش|ارتش جمهوری اسلامی|ارتش ایران|نیروی هوافضا|هوافضای سپاه|نیروی دریایی سپاه|نیروی دریایی ارتش|وعده صادق/;
const CLAIM_IQ = /مقاومت اسلامی عراق|مقاومت عراق|گروه عراقی|گروه های عراقی|گروه مقاومت عراقی|کتائب حزب الله|نجباء|سرایا اولیاء الدم/;
// The US or Israel as the striker: "حمله آمریکا به", "جنگنده های آمریکایی ... بمباران کردند".
const US_STRIKE = /(?:حمله|حملات|بمباران|ضربه|ضربات|تجاوز)(?: هوایی| پهپادی| موشکی)? (?:امریکا|امریکایی|ایالات متحده|تروریستهای امریکایی|ارتش امریکا)|(?:جنگنده|جنگنده های|پهپاد|پهپادهای|هواپیماهای|بالگردهای|ناوهای) (?:امریکایی|امریکا|ارتش امریکا)|(?:امریکا|ارتش امریکا|سنتکام|سنتکوم|فرماندهی مرکزی امریکا) .{0,40}(?:را )?(?:هدف قرار داد|بمباران کرد|حمله کرد|منهدم کرد|غرق کرد)/;
const IL_STRIKE = /(?:حمله|حملات|بمباران|ضربه|تجاوز)(?: هوایی| پهپادی)? (?:اسرائیل|رژیم صهیونیستی|صهیونیستها|اسرائیلی)/;
const IRAN = /ایران|ایرانی|سپاه|جمهوری اسلامی|ج\.ا\.ا/;
const IRAQ_FROM = /از عراق|از خاک عراق|عراقی ها|مقاومت عراق|مقاومت اسلامی عراق|گروه عراقی/;

// At sea.
const SHIPW = /نفتکش|کشتی|ناو(?![ا-ی])|ناوشکن|ناوچه|ناو هواپیمابر|شناور|قایق|کشتیهای|کشتی های|ناوگروه|ناوگان (?!پنجم)/;
const SHIPW_ = new RegExp(`(?<![${L}])(?:[وب]|ال)?(?:${SHIPW.source})(?![${L}])`);
// An Iranian ship or boat struck: the US's or Israel's attack, not Iran's.
const IR_TARGET = /(?:نفتکش|کشتی|شناور|قایق|قایق های|ناوچه|ناوشکن|ناو)(?:های)? (?:\S+ )?(?:ایرانی|سپاه|نیروی دریایی سپاه|نیروی دریایی ارتش|جمهوری اسلامی)/;
const SHIPNOT = /توقیف|توقیف شد|ضبط|مصادره|عبور|عبور کرد|تردد|اسکورت|مین|مین روبی|پهلو|لنگر|بیمه|کرایه|حمل|صادرات|بارگیری|ترانزیت/;
const SEAS = [
  [/تنگه هرمز|هرمز(?![گ])/, 'Strait of Hormuz', 26.55, 56.45, 'the Strait of Hormuz'],
  [/دریای عمان|خلیج عمان/, 'Gulf of Oman', 24.9, 58.2, 'the Gulf of Oman'],
  [/دریای عرب|دریای عربی/, 'Arabian Sea', 17.5, 60.5, 'the Arabian Sea'],
  [/اقیانوس هند/, 'Indian Ocean', 5.6, 80.2, 'the Indian Ocean off Sri Lanka'],
  [/خلیج فارس|اب های خلیج|اب های سرزمینی/, 'Persian Gulf', 27.0, 51.5, 'the Gulf'],
  // Off Iran's own coast: the sea it lies in.
  [/بندرعباس|بندر عباس|قشم|لارک|هرمز|سیریک|ابوموسی|ابو موسی|تنب/, 'Strait of Hormuz', 26.55, 56.45, 'the Strait of Hormuz'],
  [/جاسک|چابهار|کنارک/, 'Gulf of Oman', 24.9, 58.2, 'the Gulf of Oman'],
  [/بوشهر|خارک|عسلویه|کنگان|بندر لنگه|بندر دیر/, 'Persian Gulf', 27.0, 51.5, 'the Gulf'],
];
for (const x of SEAS) x[0] = word(x[0]);
const RED = /دریای سرخ|دریای احمر|باب المندب|خلیج عدن|ایلات|حدیده/;
const SHIPLAB = /\b(?:tanker|vessel|ship|carrier|tug|nautical miles)\b/i;
const dayN = (d) => Date.parse(d) / 864e5;
const snap = (e, r) => {
  // On land, only a pin in the same country, never an alert in Israel (a report of Jordan in general is not Ein Gedi's).
  const own = (p) => { if (/alerts in/.test(p.label)) return false; const c = countryAt(p.lat, p.lng); return c === e.country || (!c && km(p, e) < 40); };
  const near = BASE.filter((p) => (r.ship ? SHIPLAB.test(p.label) && Math.abs(dayN(p.day) - dayN(e.day)) <= 1 : p.day === e.day && !SHIPLAB.test(p.label) && own(p)) && km(p, e) < r.km)
    .sort((a, b) => Math.abs(dayN(a.day) - dayN(e.day)) - Math.abs(dayN(b.day) - dayN(e.day)) || km(a, e) - km(b, e))[0];
  if (near) Object.assign(e, { lat: near.lat, lng: near.lng, day: near.day, snapped: near.place });
};
const weapons = (t) => {
  const w = [];
  if (/بالستیک|بالیستیک/.test(t)) w.push('ballistic missiles');
  if (/کروز/.test(t)) w.push('cruise missiles');
  if (!w.length && /موشک/.test(t)) w.push('missiles');
  if (/پهپاد|پهباد|شاهد ?۱۳۶|شاهد ?136/.test(t)) w.push('drones');
  return w.length ? (w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w.at(-1) : w[0]) : null;
};

const rows = [];
for (const f of files) {
  const ch = f.replace(/^.*[\\/]/, '').replace(/\.jsonl$/, '').replace(/-\d+$/, '');
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l) rows.push({ ...JSON.parse(l), ch });
}
rows.sort((a, b) => (a.at < b.at ? -1 : 1));
const ev = [], skip = {}, seen = new Set();
let CUR = '';
const no = (k) => { skip[k] = (skip[k] || 0) + 1; if (process.env.GDEBUG && k === process.env.GDEBUG) console.error(CUR.slice(0, 170)); };
const keep = (e) => {
  const had = ev.find((x) => x.key === e.key);
  if (had) {
    if (had.actor === 'unclear' && e.actor !== 'unclear') { const also = had.also; Object.assign(had, e, { also }); return; }
    if (had.source !== e.source && !had.also.some((a) => a.source === e.source) && had.also.length < 4) had.also.push({ source: e.source, url: e.url });
    return;
  }
  ev.push({ ...e, also: [] });
};
for (const r of rows) {
  if (!r.text || r.at < '2026-02-28' || seen.has(r.ch + r.id)) continue;
  seen.add(r.ch + r.id);
  const line = (r.text.split('\n').find((x) => x.replace(/[^ء-ی]/g, '').length > 8) || '').trim();
  const h = norm(line.split(/(?<=[.!؟])\s+|\s+🔹|\s+🔸/)[0]).replace(/[🔴♦️🔺🔹🔸⭕️❗️🚨⚡️📌🔻▪️●•]/gu, ' ').replace(/^\s*(?:#?فوری|عاجل)\s*[|:]*\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 260);
  CUR = h;
  if (!h || !ACT.test(h)) { no('not an attack'); continue; }
  if (NOT.test(h)) { no('not one attack that day'); continue; }
  const lead = h.split(/[:：]/)[0];
  if (lead !== h && lead.length < 70 && SPEAKER.test(lead) && !CLAIM_IR.test(lead)) { no("someone's words"); continue; }
  const open = h.slice(0, 70);
  if (SPEAKER.test(open) && /گزارش داد|گزارش کرد|اعلام کرد|گفت|نوشت|به نقل از|در گفتگو|در پیامی/.test(h) && !CLAIM_IR.test(open)) { no("someone's words"); continue; }
  const src = SRC[r.ch] || r.ch;
  const url = `https://t.me/${r.ch}/${r.id}`;
  const day = new Date(Date.parse(r.at) + 3 * 3600e3).toISOString().slice(0, 10);
  const claimIr = CLAIM_IR.test(h) && /هدف قرار (?:داد|دادند|گرفت|گرفتند)|مورد اصابت|منهدم|درهم کوبید|کوبیده|حمله (?:کرد|کردند)|زیر ضرب/.test(h);
  const claimIq = CLAIM_IQ.test(h);
  const irAgent = /(?:پهپاد|موشک|پهپادهای|موشک های|پرتابه)(?: \S+)? ایرانی|سپاه|ارتش جمهوری اسلامی|نیروهای مسلح (?:جمهوری اسلامی|ایران)|حمله ایران|حملات ایران|ایران به/.test(h);
  const actor = !irAgent && US_STRIKE.test(h) ? 'us' : !irAgent && IL_STRIKE.test(h) ? 'israel' : claimIq || IRAQ_FROM.test(h) ? 'iraqi_militias' : claimIr || IRAN.test(h) ? 'iran' : 'unclear';
  const by = claimIr ? 'Iran says' : claimIq ? 'the Iraqi factions say' : `${src} reports`;
  const w = weapons(h);

  // At sea: a ship struck.
  if (SHIPW_.test(h)) {
    // A blast in an Iranian port city, its governor's word: Iran's land, read by iran.cjs.
    if (/شهر|فرماندار|استاندار|شهرستان/.test(h) && !/نفتکش|کشتی/.test(h)) { no("Iran's own coast"); continue; }
    if (SHIPNOT.test(h)) { no('at sea, not an attack'); continue; }
    if (!/هدف قرار|اصابت|حمله|انفجار|غرق|اتش گرفت|منهدم|اسیب|ضربه/.test(h)) { no('at sea, not an attack'); continue; }
    if (RED.test(h)) { no('Red Sea (Yemen desk)'); continue; }
    const s = SEAS.map(([re, place, lat, lng, en]) => { const m = h.match(re); return m && { said: m[0], place, lat, lng, en }; }).find(Boolean);
    if (!s) { no('at sea, no sea named'); continue; }
    const irT = IR_TARGET.test(h);
    const subj = /ناو هواپیمابر/.test(h) ? 'an aircraft carrier' : /ناوشکن|ناوچه|ناو(?![ا-ی])/.test(h) ? 'a warship' : /نفتکش/.test(h) ? 'a tanker' : /قایق|شناور/.test(h) ? 'boats' : 'a ship';
    const us = /امریکا|امریکایی/.test(h.slice(h.search(SHIPW), h.search(SHIPW) + 40));
    const vessel = (irT && subj !== 'boats' ? subj.replace(/^an? /, 'an Iranian ') : irT ? 'Iranian boats' : us && subj !== 'boats' ? subj.replace(/^an? /, 'a US ') : subj).replace('boats', 'vessels');
    const sActor = irT ? (US_STRIKE.test(h) || /امریکا|امریکایی/.test(h) ? 'us' : IL_STRIKE.test(h) || /اسرائیل|صهیونیست/.test(h) ? 'israel' : 'unclear') : actor;
    const label = claimIr && !irT ? `Iran says it struck ${vessel} in ${s.en}` : `${vessel[0].toUpperCase() + vessel.slice(1)} attacked in ${s.en}, ${by}`;
    const e = { key: `${day}|sea|${s.place}|${vessel}`, day, actor: sActor, said: s.said, country: 'sea', label, source: src, url, text: line, en: s.place, lat: s.lat, lng: s.lng };
    snap(e, { ship: true, km: 150 });
    keep(e);
    continue;
  }

  // On land: the places named, else the countries.
  const places = [];
  for (const c of Object.keys(P)) for (const [re, place, lat, lng, en] of P[c]) { const m = h.match(re); if (m && !(WEAK.has(place) && !C[c].re.test(h))) places.push({ said: m[0], place, lat, lng, en, cc: c }); }
  for (let i = places.length - 1; i >= 0; i--) if (BROAD.has(places[i].place) && places.some((q) => q !== places[i] && !BROAD.has(q.place) && km(q, places[i]) < 80)) places.splice(i, 1);
  const gens = places.length ? [] : Object.keys(C).filter((c) => C[c].gen && C[c].re.test(h)).map((c) => ({ cc: c, said: h.match(C[c].re)[0] }));
  if (!places.length && !gens.length) { no('no place'); continue; }
  // An attack on Iran told beside a Gulf name ("from the UAE") is Iran's reader's.
  if (/از (?:خاک |پایگاه .{0,20})?(?:امارات|کویت|قطر|بحرین|عربستان|اردن|عراق)/.test(h) && !claimIr) { no('launched from there'); continue; }
  const kind = /رهگیری|رهگیر|سرنگون/.test(h) ? 'intercept' : /اصابت|منهدم|اسیب|اتش|ویران|کشته|زخمی/.test(h) || claimIr ? 'hit' : /انفجار/.test(h) && !/حمله|هدف قرار/.test(h) ? 'blast' : 'attack';
  const who = actor === 'iraqi_militias' && !claimIq ? ', launched from Iraq,' : actor === 'iran' && !claimIr ? ' from Iran' : '';
  const W = w ? w[0].toUpperCase() + w.slice(1) : null;
  const mk = (p, g) => {
    const cn = C[p ? p.cc : g.cc];
    const at = p ? p.en : cn.name + ' (place not stated)';
    const near = p ? (/base|refinery|field|embassy|plant|airport|port|Camp|Victory/.test(p.en) ? 'near ' : 'over ') + p.en : 'over ' + cn.name + ' (place not stated)';
    const label = actor === 'us' || actor === 'israel' ? `${actor === 'us' ? 'US' : 'Israeli'} strike on ${at}, ${src} reports`
      : claimIr ? `Iran says it struck ${at}${w ? ' with ' + w : ''}`
      : claimIq ? `The Iraqi factions say they struck ${at}${w ? ' with ' + w : ''}`
      : kind === 'intercept' ? `${W ? W + who + ' intercepted' : 'Interceptions'} ${near}, ${by}`
      : kind === 'hit' ? `${W || 'An attack'}${who} hit ${at}, ${by}`
      : kind === 'blast' ? `Explosions in ${at}, ${by}`
      : `${w ? w.replace(/missiles/, 'missile').replace(/drones/, 'drone')[0].toUpperCase() + w.replace(/missiles/, 'missile').replace(/drones/, 'drone').slice(1) + ' attack' : 'Attack'}${who} on ${at}, ${by}`;
    const e = { key: `${day}|${p ? p.place : g.cc}`, cc: p ? p.cc : g.cc, day, actor, said: p ? p.said : g.said, country: cn.country || cn.name, label, source: src, url, text: line, en: p ? p.place : cn.name, lat: p ? p.lat : cn.gen[0], lng: p ? p.lng : cn.gen[1] };
    snap(e, { km: p ? (BROAD.has(p.place) ? 40 : 5) : { sa: 400, ae: 120, om: 300, jo: 150 }[e.cc] || 60 });
    keep(e);
  };
  if (places.length) places.forEach((p) => mk(p, null)); else gens.forEach((g) => mk(null, g));
}
// A country in general only on a day with no place of it named.
for (let i = ev.length - 1; i >= 0; i--) if (ev[i].cc && ev[i].key.endsWith('|' + ev[i].cc) && ev.some((e) => e !== ev[i] && e.cc === ev[i].cc && e.day === ev[i].day)) ev.splice(i, 1);
// "said" must be in "text" as the merge reads it.
for (const e of ev) if (!e.text.includes(e.said)) { const i = norm(e.text).indexOf(e.said); e.said = i >= 0 ? e.text.slice(i, i + e.said.length) : e.text.slice(0, 20); }
fs.writeFileSync(out, ev.map(({ key, cc, snapped, ...e }) => JSON.stringify(e)).join('\n') + '\n');
fs.writeFileSync(out + '.review.txt', ev.map((e) => `${e.day} ${e.actor} ${e.en}${e.snapped ? ' =>' + e.snapped : ''} | ${e.label}\n   ${e.text.slice(0, 200)}\n   ${e.url}`).join('\n'));
const byc = {};
for (const e of ev) { const k = e.country + (e.snapped ? ' (on a pin)' : ''); byc[k] = (byc[k] || 0) + 1; }
console.log(ev.length, 'events', byc, 'skipped', skip);
