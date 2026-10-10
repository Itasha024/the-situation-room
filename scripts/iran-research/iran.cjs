// Research stage C (user, 10 Oct: "Iran's own channels and the opposition's"; "do that for any attack in this
// conflict instead of against israel"): attacks on Iran read from Iran's channels (Fars, IRNA, Akhbar-e Fori),
// the opposition's (Iran International, Vahid Online), and the Arabic news and axis channels -> hand events.
// A post's opening line is read when it tells one attack, that day, at a place in Iran:
// - an attack word: blasts heard, a strike, a hit, a drone or missile falling, air defences firing;
// - a place: a site on the list below, a town of Iran from GeoNames (20,000 people or a province's seat), or a
//   quarter of Tehran, after a word that makes it a place ("در", "به", "شهر", "حوالی", "في", "على" ...) or as a
//   hashtag (#اصفهان);
// - not: a warning, a threat, a claim denied, footage, a drill, a controlled blast of old munitions, an
//   accident, Iran's own launches, Iran's internal security (police, militants, unrest), the war elsewhere
//   (Lebanon, Gaza, Iraq, Israel).
// Who: Israel or the US when named as the attacker; Iran's air defences when they are what was seen; else not stated.
//   node iran.cjs gn/IR.txt iran-events.jsonl ir/*.jsonl part/hd?.jsonl part2/aj?.jsonl ...
const fs = require('fs');
const [GN, OUT, ...FILES] = process.argv.slice(2);
const BASE = process.env.BASE ? JSON.parse(fs.readFileSync(process.env.BASE, 'utf8')) : [];
const SRC = {
  farsna: 'Fars', irna_1313: 'IRNA', akhbarefori: 'Akhbar-e Fori', iranintltv: 'Iran International', VahidOnline: 'Vahid Online', iliaen: 'Ilia',
  N12chat: 'N12', hazfon1: 'Hazfon', israel1: 'Israel1', almayadeen: 'Al Mayadeen', AlHadath_Brk: 'Al Hadath', ajanews: 'Al Jazeera', AlArabiya: 'Al Arabiya', naya_foriraq: 'Naya', SabrenNewss: 'Sabereen', Alomhoar: 'Al-Mihwar', Alibk3: 'Ali Bk',
};
const chOf = (f) => { const b = f.replace(/^.*[\\/]/, '').replace(/\.jsonl$/, ''); return /^hd\d$/.test(b) ? 'AlHadath_Brk' : /^aj\d$/.test(b) ? 'ajanews' : /^ar\d$/.test(b) ? 'AlArabiya' : b.replace(/-\d+$/, ''); };

// Persian and Arabic spellings are one: ي ی, ك ک, ة ه; no vowel marks, no half-spaces, no spaces in a key.
const norm = (s) => s.normalize('NFC').replace(/[ً-ْٰـ]/g, '').replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[‌‍​]/g, '');
const key = (s) => norm(s).replace(/\s+/g, '');
const L = '؀-ۿ';

// Sites: [pattern on the normalised text, place, lat, lng, English].
const SITES = [
  [/نطنز/, 'Natanz', 33.7246, 51.7275, 'the Natanz enrichment site'],
  [/فردو/, 'Fordow', 34.8845, 50.9958, 'the Fordow enrichment site'],
  [/پارچین|بارشین/, 'Parchin', 35.52, 51.77, 'the Parchin military site'],
  [/خنداب|آب سنگین|راکتور اراک|رآکتور اراک|مفاعل اراک|المفاعل النووی فی اراک/, 'Arak heavy-water site', 34.37, 49.24, 'the Arak heavy-water site'],
  [/نیروگاه بوشهر|محطه بوشهر|مفاعل بوشهر/, 'Bushehr nuclear plant', 28.83, 50.89, 'the Bushehr nuclear plant'],
  [/خارک|جزیره خرج/, 'Kharg Island', 29.25, 50.32, 'Kharg island'],
  [/عسلویه|پارس جنوبی|بارس الجنوبی|عسلوییه/, 'Asaluyeh, South Pars', 27.48, 52.6, 'the South Pars gas plants at Asaluyeh'],
  [/مهرآباد|مهراباد|مهر اباد/, 'Mehrabad Airport', 35.6892, 51.3134, 'Mehrabad airport in Tehran'],
  [/فرودگاه امام|مطار الامام الخمینی|فرودگاه بین المللی امام/, 'Imam Khomeini Airport', 35.4161, 51.1522, 'Imam Khomeini airport'],
  [/انبار نفت شهران|مستودع شهران|شهران/, 'Shahran oil depot', 35.78, 51.29, 'the Shahran oil depot in Tehran'],
  [/پالایشگاه آبادان|مصفاه عبادان|مصفی عبادان/, 'Abadan refinery', 30.35, 48.28, 'the Abadan refinery'],
  [/پالایشگاه تبریز|مصفاه تبریز/, 'Tabriz refinery', 38.05, 46.18, 'the Tabriz refinery'],
  [/بندر شهید رجایی|میناء الشهید رجائی|میناء رجائی/, 'Shahid Rajaee port', 27.11, 56.07, 'the Shahid Rajaee port at Bandar Abbas'],
  [/ساختمان صدا و سیما|ساختمان صداوسیما|ساختمان شیشه ای صدا و سیما|مبنی الاذاعه والتلفزیون|مبنی التلفزیون الایرانی/, 'IRIB headquarters, Tehran', 35.7835, 51.413, "the state broadcaster's building in Tehran"],
  [/زندان اوین|سجن ایفین|اوین/, 'Evin prison', 35.796, 51.385, 'Evin prison in Tehran'],
  [/پایگاه شکاری|قاعده الشکاری|قاعده نوژه|پایگاه نوژه/, 'airbase', null, null, null],
];

for (const x of SITES) x[0] = new RegExp(`(?<![${L}])(?:[وب]|ال|بال|وال)?(?:${x[0].source})(?![${L}])`);
// Towns of Iran from GeoNames, and Tehran's quarters.
const towns = new Map();
for (const l of fs.readFileSync(GN, 'utf8').split('\n')) {
  const c = l.split('\t');
  if (c.length < 15 || c[6] !== 'P') continue;
  const lat = +c[4], lng = +c[5], pop = +c[14] || 0;
  const tehranQuarter = c[7] === 'PPLX' && lat > 35.55 && lat < 35.85 && lng > 51.2 && lng < 51.65;
  if (!(pop >= 20000 || /^PPL(?:A|A2|C)$/.test(c[7]) || tehranQuarter)) continue;
  for (const n of c[3].split(',').filter((x) => /[ء-ی]/.test(x))) {
    const k = key(n);
    if (k.length < 3) continue;
    const t = { name: tehranQuarter ? `${c[1]}, Tehran` : c[1], lat, lng, pop: tehranQuarter ? 1 : pop, quarter: tehranQuarter };
    if (!towns.has(k) || towns.get(k).pop < t.pop) towns.set(k, t);
  }
}
for (const [ar, fa] of [['عبادان', 'آبادان'], ['تشابهار', 'چابهار'], ['جابهار', 'چابهار'], ['کرمنشاه', 'کرمانشاه'], ['خرم اباد', 'خرمآباد'], ['الاهواز', 'اهواز'], ['اصفهان', 'اصفهان'], ['ارومیه', 'ارومیه'], ['شهریار', 'شهریار'], ['بندر عباس', 'بندرعباس'], ['عسلویه', 'عسلویه'], ['کنارک', 'کنارک'], ['قشم', 'قشم'], ['بوشهر', 'بوشهر']]) {
  const t = towns.get(key(fa));
  if (t && !towns.has(key(ar))) towns.set(key(ar), t);
}
// Names that are words too, or not a town on their own here.
for (const w of ['ایران', 'جمهوری', 'اسلامی', 'شهر', 'مرکز', 'شرق', 'غرب', 'شمال', 'جنوب', 'نور', 'بم', 'امید', 'پارس', 'آزادی', 'انقلاب', 'دولت', 'ملت', 'سپاه', 'ارتش', 'امام', 'شهید', 'گلستان', 'بهار', 'آفتاب', 'زمین', 'کوثر', 'نصر', 'فتح', 'قدس', 'المقدس', 'الامام', 'الاسلامیه', 'الجمهوریه', 'الشرق', 'الغرب', 'خلیج', 'خلیجفارس', 'دریا', 'شاه', 'کرد', 'قلعه', 'میدان', 'محله', 'تپه', 'باغ', 'سعادت', 'خیابان', 'پاسداران', 'الحرس', 'الثوری', 'النصر', 'شاهد', 'شهرک', 'بندر', 'جزیره', 'المدینه', 'العاصمه', 'بنیه', 'البنیه', 'میانه', 'مهر', 'وکاله', 'خبرگزاری', 'البنیه التحتیه'].map(key)) towns.delete(w);

const FUNC = new Set(['را', 'بر', 'به', 'در', 'از', 'و', 'که', 'با', 'این', 'آن', 'تا', 'یا', 'هم', 'نیز', 'برای', 'شد', 'شده', 'است', 'بود', 'می', 'فی', 'من', 'علی', 'الی', 'عن', 'مع', 'بعد', 'قبل']);
const CUE = /^(?:فرودگاه|پالایشگاه|بندر|اسکله|شهرک|شهرستان|حومه|مناطق|محله|عوارضی|اتوبان|بزرگراه|بازار|پایگاه|آسمان|اسمان|مطار|میناء|قاعده|ضواحی|سماء|اجواء|مدینتی|در|به|بر|شهر|شهرهای|استان|حوالی|اطراف|نزدیک|نزدیکی|منطقه|محدوده|سمت|جنوب|شمال|غرب|شرق|مرکز|في|فی|ب|علی|على|مدینه|مدينة|محافظه|محافظة|قرب|محیط|محيط|اطراف|أطراف|شرقی|غربی|جنوبی|شمالی|شرق|غرب|جنوب|شمال)$/;
const ATTACK = /انفجار|حمله|حملات|اصابت|بمباران|هدف قرار|مورد حمله|ضربه هوایی|ضربات|سقوط (?:پهپاد|موشک|صاروخ|مسیره)|(?:فعالیت|شلیک|صدای|درگیری) پدافند|پدافند (?:فعال|شلیک|درگیر)|غاره|غارات|قصف|استهداف|هجوم|انفجارات|دوی|(?:تفعیل|تتصدی|تصدت|تصدی) (?:ال)?(?:دفاعات|دفاع)|الدفاعات الجویه (?:تتصدی|تصدت|تتعامل|تعاملت)/;
// Iran in an Arabic post: its name, a city of it, or its people.
const IRAN_AR = /ایران|الایرانی|طهران|اصفهان|شیراز|تبریز|مشهد|الاهواز|کرمانشاه|بندر عباس|قم|کرج|همدان|یزد|بوشهر|خرمشهر|عبادان|نطنز|فوردو|اراک|کرمان|زاهدان|ارومیه|سنندج|خرم اباد|قزوین|زنجان|رشت|ساری|جزیره|قشم|خارک/;
// Not one attack on Iran that day.
const NOT0 = /ارهابی|الارهابیه|ارهابیین|مسلح|الشرطه|امحا|امحای|تاهیل|منظمه الصحه|سفیر|المندوب|بازگشته|انفجار مین|مین به جا|مین های|مینهای|صحت ندارد|صحت|نادرست|مسلحانه|گروهی با نام|تحقیق|التحقیق|سازمان ملل|بازدید|مادری|سوگ|مزار|یادش|زادروز|جاویدنام|معترض|سرکوبگر|کیهان|روزنامه|مقاله|بلومبرگ|توییت|در طول|طی جنگ|پس از جنگ|تاب آوری|سایبری|غیر صحیح|مسیطر علیها|آتش نشانی|نه انفجار|ناشی از آتش|سوران|اربیل|السلیمانیه|کویه|کردستان عراق|اقلیم کردستان|شمال عراق|نقطه امنیه|اطلاق صواریخ|اطلاق الصواریخ|رشقه|بزرگداشت|مجروحیت|بعد از \d+ روز|المحتله|فلسطین|هنگ کنگ|نمایش|ورزش|هتل|درخت|طوفان|باد|زلزله|سیل|هشدار|تهدید|خواهد|خواهیم|احتمال|ادعا|ادعای|تکذیب|شایعه|رد ادعا|فیلم|ویدیو|ویدئو|🎥|📹|تصاویر|تصویر|عکس|لحظه|سالگرد|یادبود|سخنرانی|مذاکره|توافق|آتش بس|آتشبس|کنترل شده|کنترلشده|خنثی|مهمات عمل نکرده|مانور|رزمایش|تمرین|تست|آزمایش|حادثه|تصادف|آتش سوزی|آتشسوزی|نشت گاز|نشت|ترکیدن|کپسول|سیلندر|پلیس|اشرار|تروریست|جیش|درگیری|اغتشاش|اعتراضات|تجمع|بازداشت|دستگیری|اعدام|شلیک موشک|پرتاب|عملیات وعده صادق|شلیک به سمت|به سوی اراضی|اراضی اشغالی|سرزمینهای اشغالی|فلسطین اشغالی|تل آویو|تلآویو|حیفا|اسرائیل را|لبنان|غزه|عراق|سوریه|یمن|حزب الله|حزبالله|الضاحیه|بیروت|کویت|قطر|امارات|بحرین|عربستان|اردن|تنگه هرمز|نفتکش|کشتی|ناو|گزارش داد که در جنگ|در جنگ اخیر|جنگ ۱۲ روزه|جنگ دوازده روزه|خرداد ۱۴۰۴|سال گذشته|ماه گذشته|هفته گذشته|دیروز|دیشب(?! ساعت)|بازسازی|تلفات جنگ|شهدای جنگ|تشییع|تشیع|جنازه|ترحیم|تحلیل|کارشناس|نظرسنجی|تذکر|تبریک|قیمت|بورس|دلار|طلا|تحریم|فیفا|جام جهانی|فوتبال|لیگ|تحذیر|تهدد|یهدد|سوف|محتمل|تکذب|ینفی|نفی|فیدیو|مشاهد|لقطات|صور|لبنان|غزه|العراق|سوریا|الیمن|الاراضی المحتله|تل ابیب|حیفا|الخلیج|الکویت|قطر|الامارات|البحرین|السعودیه|الاردن|هرمز|ناقله|سفینه|الحوثی|حزب الله/;
const SPEAKER = /وزیر|سخنگو|رئیس|رییس|نماینده|بقایی|قالیباف|ترامپ|ترمب|فانس|کاتس|نتانیاهو|عراقچی|پزشکیان|لاریجانی|ولایتی|خامنه ای|روبیو|هگست|هگزث|کاخ سفید|پنتاگون|البنتاغون|البیت الابیض|المتحدث|وزیر الخارجیه|الخارجیه|حماس|حزب الله|روسیه|روسیا|الکرملین|چین|الصین|سازمان ملل|الامم المتحده|واشینگتن پست|نیویورک تایمز|وال استریت|آکسیوس|اکسیوس|سی ان ان|رویترز عن|کانال ۱۲|کانال ۱۳|القناه 12|القناه 13/;
// Words start a word: "باد" (wind) is not inside "آباد".
const NOT = new RegExp(`(?<![${L}])(?:[وبل]|ال|بال|وال)?(?:${NOT0.source})`);
const ACT = /انفجار|حمله|حملات|اصابت|بمباران|هدف|ضربه|ضربات|پدافند|غاره|غارات|قصف|استهداف|هجوم|دوی|الدفاعات|الدفاع|اعتراض|تصدی|تتصدی/;
const BLAST = /صدای انفجار|انفجار|انفجارها|انفجارات|دوی|صدای جنگنده/;
const AD = /پدافند|الدفاعات الجویه|الدفاع الجوی|المضادات/;
const IL = /اسرائیل|صهیونیست|صهیونی|رژیم صهیونی|الاسرائیلی|الاسرائیلیه|الصهیونی|اسرائیلیه/;
const US = /آمریکا|آمریکایی|امریکا|امریکایی|ایالات متحده|الامریکی|الامریکیه|الامیرکی|الامیرکیه|امریکیه/;

// Israel's channels (user, 10 Oct: "use israeli channels for attacks in iran if needed"): N12, Hazfon, Israel1, in
// Hebrew. Iran's towns and sites as Israel's media spell them; a name counts glued to "ב"/"ל"/"מ" or after a cue
// ("העיר", "אזור", "ליד"), with the act within nine words before it or four after.
const HE_TOWNS = [
  [/טהרן|טהראן/, 'Tehran', 35.6944, 51.4215], [/אספהאן|איספהאן|אצפהאן/, 'Isfahan', 32.6525, 51.6746], [/שיראז/, 'Shiraz', 29.6036, 52.5388],
  [/תבריז|טבריז|טאבריז/, 'Tabriz', 38.08, 46.2919], [/משהד/, 'Mashhad', 36.297, 59.6062], [/כרמאנשאה|כרמנשאה|קרמאנשאה|כרמאנשה/, 'Kermanshah', 34.3142, 47.065],
  [/אהוואז|אחוואז|אהואז/, 'Ahvaz', 31.3203, 48.6693], [/בנדר עבאס|בנדר אבאס/, 'Bandar Abbas', 27.1865, 56.2808], [/בושהר|בושהאר/, 'Bushehr', 28.9684, 50.8385],
  [/כרג'|כראג'|כאראג'|כאראג/, 'Karaj', 35.8355, 50.9915], [/קום/, 'Qom', 34.6401, 50.8764], [/חמדאן|המדאן/, 'Hamadān', 34.7992, 48.5146], [/יזד/, 'Yazd', 31.8974, 54.3569],
  [/קזווין|קאזווין/, 'Qazvin', 36.2797, 50.0049], [/זנג'אן|זנגאן/, 'Zanjan', 36.6736, 48.4787], [/סנאנדג'|סננדג'/, 'Sanandaj', 35.3142, 46.9923], [/אורמיה|אורומיה/, 'Orūmīyeh', 37.5527, 45.0761],
  [/כרמאן|כירמאן|קרמאן/, 'Kerman', 30.2832, 57.0788], [/זאהדאן|זהדאן/, 'Zahedan', 29.4963, 60.8629], [/רשת/, 'Rasht', 37.2808, 49.5832], [/ארדביל/, 'Ardabil', 38.2498, 48.2933],
  [/צ'אבהאר|צ'בהאר/, 'Chabahar', 25.2919, 60.643], [/ג'אסק/, 'Jask', 25.6438, 57.7745], [/קשם|קישם|קשאם/, 'Qeshm', 26.9581, 56.2719], [/דזפול/, 'Dezful', 32.3811, 48.4058],
  [/אסלאמשהר|איסלאמשהר/, 'Eslamshahr', 35.5522, 51.235], [/סיריק|סירייק|סיריכ/, 'Sirik', 26.5198, 57.1058], [/מאהשהר|מהשהר|משהאר|מאהשאהר/, 'Bandar-e Mahshahr', 30.5589, 49.1981],
  [/אבאדאן|אבדאן/, 'Abadan', 30.3392, 48.3043], [/ח'ורמשהר|חורמשהר/, 'Khorramshahr', 30.4397, 48.1664], [/אראק|אראכ/, 'Arāk', 34.0917, 49.6892], [/סמנאן/, 'Semnan', 35.5729, 53.3971],
  [/לאראק|לארק/, 'Larak Island', 26.85, 56.36], [/ח'ורמאבאד|חורם אבאד|ח'רם אבאד/, 'Khorramabad', 33.4878, 48.3558], [/איילאם|אילאם/, 'Ilam', 33.6374, 46.4227], [/בנדר לנגה/, 'Bandar Lengeh', 26.5579, 54.8807],
];
const HE_SITES = [
  [/נתנז/, 'Natanz', 33.7246, 51.7275, 'the Natanz enrichment site'], [/פורדו/, 'Fordow', 34.8845, 50.9958, 'the Fordow enrichment site'],
  [/פרצ'ין|פארצ'ין/, 'Parchin', 35.52, 51.77, 'the Parchin military site'], [/ח'ארג|חארג|ח'רג|האי חרג/, 'Kharg Island', 29.25, 50.32, 'Kharg island'],
  [/עסלויה|עסלואייה|דרום פארס/, 'Asaluyeh, South Pars', 27.48, 52.6, 'the South Pars gas plants at Asaluyeh'], [/מהראבאד|מהרבאד/, 'Mehrabad Airport', 35.6892, 51.3134, 'Mehrabad airport in Tehran'],
  [/(?:הכור|כור הגרעין) (?:ב|של )?בושהר/, 'Bushehr nuclear plant', 28.83, 50.89, 'the Bushehr nuclear plant'], [/כלא אווין|אווין/, 'Evin prison', 35.796, 51.385, 'Evin prison in Tehran'],
  [/(?:הכור|כור המים הכבדים) (?:ב|של )?אראק/, 'Arak heavy-water site', 34.37, 49.24, 'the Arak heavy-water site'], [/שהראן/, 'Shahran oil depot', 35.78, 51.29, 'the Shahran oil depot in Tehran'],
];
const HE = 'א-ת';
const HPRE = '(?:ו?[בלמ]|ו|ה|ש|וה|מה)?';
for (const x of HE_TOWNS) x[0] = new RegExp(`(?<![${HE}'])(${HPRE})(${x[0].source})(?![${HE}])`, 'g');
for (const x of HE_SITES) x[0] = new RegExp(`(?<![${HE}'])${HPRE}(?:${x[0].source})(?![${HE}])`);
const HE_AMBIG = new Set(['Qom', 'Rasht', 'Mashhad', 'Arāk', 'Kerman', 'Yazd', 'Semnan', 'Ilam', 'Larak Island']);
const HE_IRAN = /איראן|האיראני|טהרן|טהראן|משמרות המהפכה/;
const HE_CUE = /(?:העיר|בעיר|באי|האי|אזור|באזור|ליד|סמוך ל|במחוז|מחוז|בסביבת|בפאתי|מעל|בנמל|נמל|בבסיס|בירת|הבירה)\s*$/;
const HE_ACT = /תקיפ|תקף|תקפו|תוקף|תוקפים|הותקפ|פיצוץ|פיצוצים|פיצוצ|הפצצ|הופצצ|נפגע|פגיעה|פגיעות|פגעו|חיסול|חוסל|הושמד|השמדת|נשמעו|הגנה האווירית|ההגנה האווירית|נ"מ|נ״מ|הפלנו|הופל|יירטו/;
const HE_NOT0 = /אזעק|שיגור|שיגורים|שוגרו|שוגר|שיגרה|שיגרו|לעבר ישראל|לעבר הארץ|מאיראן לעבר|מאיראן ל|נורו מאיראן|יירוט|יורט|מיירט|טילים מאיראן|איום|מאיים|מאיימת|איימ|אם |במידה ו|עלול|עלולה|יתקוף|יתקפו|תתקוף|נתקוף|נתקיפ|נשקול|שוקל|שוקלת|תכנית|תוכנית|פרשנ|ניתוח|הערכה|הערכות|סרטון|תיעוד|צפו|תמונות|תצלומ|לוויין|לווין|אתמול|שלשום|בשבוע שעבר|בחודש שעבר|מאז תחילת|במהלך המלחמה|במלחמה האחרונה|מבצע עם כלביא|ב-12 הימים|סה"כ|סה״כ|סיכום|תחקיר|ראיון|הכחיש|הכחישה|מכחיש|מכחישה|הכחשה|שמועות|לא נכון|פייק|ביירות|לבנון|דאחיה|דאחייה|עזה|תימן|חות'י|עיראק|סוריה|ירדן|סעודיה|קטאר|כווית|בחריין|בחרין|אמירויות|דובאי|אבו דאבי|הורמוז|מכלית|ספינה|ספינות|כלי שיט|אוניה|אנייה|ישראלים|בישראל|בארץ|חיפה|תל אביב|דימונה|באר שבע|אילת|ראיון|נאום|הצהרה|מסיבת עיתונאים|ציוץ|פוסט|בחירות|תקיפה פיזית|לא הייתה|לא היו|לא נפגע|לא בוצעה|מגנה|גינה|גינוי|בתגובה ל|מעבירה|רכיבים|משלוח|שנותרה|שנותרו|פיצוץ תחמושת|שר(?= )|שרת(?= )|אמר(?![א-ת])|אמרה|בריאיון|כלכלי|סנקציות|פטורים|נעצר|נעצרו|בחשד|שוטר|משטרה|מחאה|הפגנה|מפגינים|נאמרו|אלימות|מד"א|מד״א|מחירי|נפט עולה|בורסה|שווקים/;
// Words start a word: "צפו" (watch) is not "צפון" (north), "בארץ" (in Israel) is not "בארצות הברית".
const HE_NOT = new RegExp(`(?<![א-ת])(?:ו?[בלמהש]|ו|וה|מה|שה)?(?:${HE_NOT0.source.replace("|צפו|", "|צפו(?![א-ת])|").replace("|בארץ|", "|ארץ(?![א-ת])|").replace("|אם |", "|אם(?= )|")})`);
const HE_IL = /צה"ל|צה״ל|חיל האוויר הישראלי|חיל האוויר של ישראל|(?<!חדשות )ישראל(?!ים| ביתנו| ללא)|ישראלי|הישראלי|הישראלית|המוסד/;
const HE_US = /ארה"ב|ארה״ב|ארצות הברית|אמריקא|אמריקנ|האמריקאים|פיקוד המרכז|סנטקום|CENTCOM|B-2|טראמפ הורה/;
const HE_SPEAKER = /^(?:[^:]{0,40}(?:נתניהו|טראמפ|כ"ץ|כ״ץ|ראש הממשלה|הנשיא|שר |שרת |דובר |הדובר|ערוץ|עראקצ'י|פזשכיאן|ח'מינאי|חמינאי|לריג'אני|קאליבאף|בכיר|גורם|מקור|רמטכ"ל|רמטכ״ל|הרמטכ"ל)[^:]{0,40}):/;
const readHebrew = (line) => {
  const h = line.replace(/🚫.*$/u, '').replace(/[֑-ׇ]/g, '').replace(/[׳’`]/g, "'").replace(/[״“”]/g, '"').replace(/\s+/g, ' ').slice(0, 260);
  if (!HE_ACT.test(h)) return { no: 'not an attack' };
  if (HE_NOT.test(h)) return { no: 'not one attack on Iran that day' };
  if (HE_SPEAKER.test(h) || /^[^:"]{3,80}: ?"/.test(h)) return { no: "someone's words" };
  const places = [];
  const near = (i, len) => { const before = h.slice(0, i).split(' ').slice(-9).join(' '), after = h.slice(i + len).split(' ').slice(0, 5).join(' '); return HE_ACT.test(before + ' ' + after); };
  for (const [re, place, lat, lng, en] of HE_SITES) { const m = h.match(re); if (m && near(m.index, m[0].length)) places.push({ said: m[0], place, lat, lng, en, site: true }); }
  for (const [re, place, lat, lng] of HE_TOWNS) {
    for (const m of h.matchAll(re)) {
      // A bare name only after a cue word or as a hashtag; "קום" (get up), "רשת" (a network) need "ב"/"ל" or a cue.
      const glued = /[בלמ]$/.test(m[1]);
      const cued = HE_CUE.test(h.slice(0, m.index)) || h[m.index - 1] === '#';
      const big = ['Tehran', 'Isfahan', 'Shiraz', 'Tabriz', 'Mashhad', 'Kermanshah', 'Ahvaz', 'Bandar Abbas', 'Bushehr'].includes(place);
      if (!(glued || cued || (big && !m[1]))) continue;
      if (HE_AMBIG.has(place) && (!HE_IRAN.test(h) || !(cued || (/^ו?ב$/.test(m[1]) && place !== 'Rasht')))) continue;
      if (place === 'Arāk' && /אי $/.test(h.slice(0, m.index))) continue;
      if (!near(m.index, m[0].length)) continue;
      if (!places.some((q) => km(q, { lat, lng }) < 1.5)) places.push({ said: m[0], place, lat, lng, en: place });
    }
  }
  for (let i = places.length - 1; i >= 0; i--) if (!places[i].site && places.some((q) => q !== places[i] && q.site && km(q, places[i]) < 40)) places.splice(i, 1);
  if (!places.length) return { no: 'no place in Iran' };
  const il = HE_IL.test(h), us = HE_US.test(h);
  const actor = il && us ? 'unclear' : il ? 'israel' : us ? 'us' : /הגנה האווירית|ההגנה האווירית|נ"מ/.test(h) && !/תקיפ|תקף|תקפו|הפצצ|פגיעה|פיצוץ|פיצוצים/.test(h) ? 'iran' : 'unclear';
  const kind = actor === 'iran' ? 'ad' : /הפצצ|הופצצ|חיל האוויר|מטוסי קרב|תקיפה אווירית|תקיפות אוויריות/.test(h) ? 'air' : /כטב"מ|רחפן/.test(h) ? 'drone' : /טיל/.test(h) ? 'missile' : /תקיפ|תקף|תקפו|הותקפ|פגיעה|פגעו|נפגע|חיסול|חוסל|הושמד/.test(h) ? 'attack' : 'blast';
  return { places, actor, both: il && us, kind, h };
};

const iranDay = (iso) => new Date(Date.parse(iso) + 3.5 * 3600e3).toISOString().slice(0, 10);
const km = (a, b) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const ev = [], skip = {};
let CUR = '';
const no = (k) => { skip[k] = (skip[k] || 0) + 1; if (process.env.GDEBUG && k === process.env.GDEBUG) console.error(CUR.slice(0, 170)); };
const seen = new Set();
for (const f of FILES) {
  const ch = chOf(f);
  const persian = ['farsna', 'irna_1313', 'akhbarefori', 'iranintltv', 'VahidOnline', 'iliaen'].includes(ch);
  const hebrew = ['N12chat', 'hazfon1', 'israel1'].includes(ch);
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!l) continue;
    const p = JSON.parse(l);
    if (!p.text || p.at < '2026-02-28' || seen.has(ch + p.id)) continue;
    seen.add(ch + p.id);
    // The opening line, without its marks; the first that says something.
    const line = hebrew ? (p.text.split('\n').find((x) => x.replace(/[^א-ת]/g, '').length > 12) || '').trim() : (p.text.split('\n').find((x) => x.replace(/[^ء-ی]/g, '').length > 8) || '').replace(/&rlm;|&#33;|[🔴♦️🔺🔹⭕️❗️🚨⚡️]/gu, ' ').replace(/^\s*(?:#?عاجل|فوری|فوری:)\s*[|:]*\s*/, '').trim();
    let places, actor, both, kind;
    if (hebrew) {
      CUR = line;
      const r = readHebrew(line);
      if (r.no) { no(r.no); continue; }
      ({ places, actor, both, kind } = r);
    }
    const h = hebrew ? '' : norm(line).slice(0, 260);
    if (!hebrew) {
    CUR = h;
    if (!h || !ATTACK.test(h)) { no('not an attack'); continue; }
    if (!persian && !IRAN_AR.test(h)) { no('Arabic, not Iran'); continue; }
    if (NOT.test(h)) { no('not one attack on Iran that day'); continue; }
    const lead = h.split(/[:：]/)[0];
    if (lead !== h && lead.length < 60 && SPEAKER.test(lead)) { no("someone's words"); continue; }
    const words = h.replace(/#/g, ' # ').split(/[\s،,.:;!؟()«»"“”'\/|-]+/).filter(Boolean);
    // The place: a site; else a town or a Tehran quarter after a cue word or as a hashtag.
    places = [];
    for (const [re, place, lat, lng, en] of SITES) { const m = h.match(re); if (m && lat && ACT.test(h.slice(Math.max(0, m.index - 50), m.index + m[0].length + 40))) places.push({ said: m[0], place, lat, lng, en, site: true }); }
    for (let i = 0; i < words.length; i++) {
      const prev = words[i - 1] || '';
      const glued = !persian && /^(?:ب|بال|وب)(?=..)/.test(words[i]) && !CUE.test(prev);
      const big = (towns.get(key(words[i])) || {}).pop >= 200000;
      if (!(CUE.test(prev) || prev === '#' || glued || big || i === 0)) continue;
      let best = null;
      for (const n of [3, 2, 1]) {
        const g = words.slice(i, i + n);
        if (g.length < n || (n > 1 && g.some((x) => FUNC.has(x)))) continue;
        for (const w of persian ? [g.join(' ')] : [g.join(' '), g.join(' ').replace(/^(?:ب|ال|بال|و|ل)(?=..)/, '')]) {
          const t = towns.get(key(w));
          if (t && t.quarter && !/تهران|طهران/.test(h)) continue;
          if (t && !best) best = { said: w, place: t.name, lat: t.lat, lng: t.lng, en: t.name, quarter: t.quarter };
        }
        if (best) break;
      }
      const near = words.slice(Math.max(0, i - 9), i).concat(words.slice(i + 1, i + 5)).join(' ');
      if (best && !ACT.test(near)) best = null;
      if (best && !places.some((q) => km(q, best) < 1.5)) places.push(best);
    }
    // A quarter of Tehran is finer than Tehran; a site is finer than its town.
    for (let i = places.length - 1; i >= 0; i--) if (!places[i].site && !places[i].quarter && places.some((q) => q !== places[i] && (q.site || q.quarter) && km(q, places[i]) < 40)) places.splice(i, 1);
    if (!places.length) { no('no place in Iran'); continue; }
    // Who: the attacker named; air defences seen; else not stated.
    both = IL.test(h) && US.test(h);
    actor = both ? 'unclear' : IL.test(h) ? 'israel' : US.test(h) ? 'us' : AD.test(h) && !/حمله|اصابت|بمباران|غاره|غارات|قصف|استهداف|انفجار/.test(h) ? 'iran' : 'unclear';
    kind = actor === 'iran' ? 'ad' : /بمباران|حمله هوایی|غاره|غارات|جنگنده|قصف جوی/.test(h) ? 'air' : /پهپاد|مسیر/.test(h) ? 'drone' : /موشک|صاروخ|صواریخ/.test(h) ? 'missile' : /حمله|اصابت|هدف قرار|استهداف|هجوم|ضربه|ضربات|قصف/.test(h) ? 'attack' : BLAST.test(h) ? 'blast' : 'attack';
    }
    const who = { israel: 'Israeli', us: 'US', unclear: both ? 'US and Israeli' : '' }[actor] ?? '';
    const src = SRC[ch] || ch;
    const day = iranDay(p.at);
    const url = `https://t.me/${ch}/${p.id}`;
    for (const q of places) {
      const at = q.en;
      const label = kind === 'ad' ? `Air defences fire over ${at}, ${src} reports`
        : kind === 'blast' ? `Explosions heard in ${at}, ${src} reports`
        : `${who ? who + ' ' : ''}${{ air: 'air strike', drone: 'drone strike', missile: 'missile strike', attack: 'attack' }[kind]} on ${at}, ${src} reports`.replace(/^./, (c) => c.toUpperCase());
      const e = { day, actor: actor === 'iran' ? 'iran' : actor, said: q.said, country: 'Iran', label, source: src, url, text: line, en: q.place, lat: q.lat, lng: q.lng, also: [] };
      // A city's report on a day it is already pinned: that attack's other source.
      if (!q.site && !q.quarter) {
        const near = BASE.filter((b) => b.day === day && km(b, e) < 15).sort((a, b) => km(a, e) - km(b, e))[0];
        if (near) Object.assign(e, { lat: near.lat, lng: near.lng, snapped: near.place });
      }
      const k = `${day}|${q.place}`;
      const had = ev.find((x) => x.k === k);
      if (had) {
        if (had.actor === 'unclear' && e.actor !== 'unclear' && e.actor !== 'iran') Object.assign(had, { ...e, k, also: had.also });
        else if (had.source !== src && !had.also.some((a) => a.source === src) && had.also.length < 4) had.also.push({ source: src, url });
        continue;
      }
      ev.push({ ...e, k });
    }
  }
}
// "said" must be in "text" as the merge reads it.
for (const e of ev) if (!e.text.includes(e.said)) { const i = norm(e.text).indexOf(e.said); e.said = i >= 0 ? e.text.slice(i, i + e.said.length) : e.text.slice(0, 20); }
fs.writeFileSync(OUT, ev.map(({ k, snapped, ...e }) => JSON.stringify(e)).join('\n') + '\n');
fs.writeFileSync(OUT + '.review.txt', ev.map((e) => `${e.day} ${e.actor} ${e.en}${e.snapped ? ' =>' + e.snapped : ''} | ${e.label}\n   ${e.text.slice(0, 200)}\n   ${e.url}`).join('\n'));
const by = {};
for (const e of ev) by[e.source + (e.snapped ? ' (on a pin)' : '')] = (by[e.source + (e.snapped ? ' (on a pin)' : '')] || 0) + 1;
console.log(ev.length, 'events', by, 'skipped', skip);
