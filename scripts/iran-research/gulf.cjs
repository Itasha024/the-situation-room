// Research stage B, part 2 (user, 10 Oct): the Gulf states' and Jordan's own defence statements -> hand events.
// Read: the ministries' X posts (Saudi MoD, Kuwait's army, Qatar's MoD, Bahrain's BDF; x/<handle>.jsonl), Jordan's
// Petra agency (tg/petranews), and Al Hadath's breaking channel where it quotes one of those bodies by name
// ("الدفاع السعودية: ...", "الجيش الكويتي: ..."). A statement is pinned when it tells an attack that day: an
// interception, a fall, a hit, air defences engaging now. Not: tallies over days, footage, explosive disposal,
// drills, denials, yesterday's news. Every place the statement names on the country's list gets a pin; none named,
// the country in general. Who: Iran when the statement names Iran; the militias when it says from Iraq; a Yemen
// launch is the Yemen desk's and left out; else not stated. Saudi Arabia's south (the Houthi front) only with Iran named.
//   node gulf.cjs gulf-events.jsonl x/modgovksa.jsonl x/KuwaitArmyGHQ.jsonl ... tg/petranews.jsonl tg/AlHadath_Brk.jsonl
const fs = require('fs');
const [out, ...files] = process.argv.slice(2);

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
  [/^(?:الأردن|الاردن)$|الجيش الأردني|القوات المسلحة الأردنية|الجيش العربي/, 'jo'],
  [/^(?:عمان|سلطنة عمان)$|(?:وزارة )?الدفاع العمانية|الجيش العماني/, 'om'],
];
const OWN = { modgovksa: 'sa', KuwaitArmyGHQ: 'kw', MOD_Qatar: 'qa', BDF_Bahrain: 'bh' };
const SRC = { modgovksa: 'Saudi Ministry of Defence', KuwaitArmyGHQ: 'Kuwait Army General Staff', MOD_Qatar: 'Qatar Ministry of Defence', BDF_Bahrain: 'Bahrain Defence Force', petranews: 'Petra', AlHadath_Brk: 'Al Hadath' };

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
    [/عرعر|الحدود الشمالية/, 'Arar', 30.98, 41.04, 'the Northern Borders region'],
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
    [/الزور/, 'Al-Zour refinery', 28.73, 48.37, 'the Al-Zour refinery'],
    [/الشعيبة/, 'Shuaiba', 29.04, 48.16, 'Shuaiba'],
    [/الجهراء/, 'Jahra', 29.34, 47.66, 'Jahra'],
  ],
  ae: [
    [/الظفرة/, 'Al Dhafra Air Base', 24.248, 54.547, 'the Al Dhafra air base'],
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
    [/العديد/, 'Al Udeid Air Base', 25.117, 51.315, 'the Al Udeid air base'],
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
    [/موفق السلطي|الأزرق|الازرق/, 'Muwaffaq Salti Air Base', 31.8267, 36.7822, 'the Muwaffaq Salti air base'],
    [/الكرك/, 'Karak', 31.18, 35.7, 'Karak'],
    [/إربد|اربد/, 'Irbid', 32.55, 35.85, 'Irbid'],
    [/الزرقاء/, 'Zarqa', 32.07, 36.09, 'Zarqa'],
    [/المفرق/, 'Mafraq', 32.34, 36.21, 'Mafraq'],
    [/معان/, "Ma'an", 30.19, 35.73, "Ma'an"],
    [/العقبة/, 'Aqaba', 29.53, 35.0, 'Aqaba'],
    [/الطفيلة/, 'Tafilah', 30.84, 35.6, 'Tafilah'],
    [/مادبا/, 'Madaba', 31.72, 35.79, 'Madaba'],
    [/البلقاء|السلط/, 'Salt', 32.04, 35.73, 'the Balqa province'],
    [/جرش/, 'Jerash', 32.28, 35.9, 'Jerash'],
    [/عجلون/, 'Ajloun', 32.33, 35.75, 'Ajloun'],
    [/عمّان|العاصمة عمان|في عمان(?=\s|$)/, 'Amman', 31.95, 35.93, 'Amman'],
  ],
  om: [
    [/الدقم/, 'Duqm', 19.67, 57.7, 'Duqm'],
    [/صلالة/, 'Salalah', 17.02, 54.09, 'Salalah'],
    [/صحار/, 'Sohar', 24.36, 56.75, 'Sohar'],
    [/خصب/, 'Khasab', 26.18, 56.25, 'Khasab'],
    [/مسقط/, 'Muscat', 23.59, 58.41, 'Muscat'],
  ],
};
const SAUDI_SOUTH = /جازان|جيزان|نجران|خميس مشيط|[أا]بها|ظهران الجنوب|عسير/;

// An attack word with a weapon or an act of war in it: a fire at a factory is not one.
const ATTACK = /اعتراض|اعترض|تدمير|دمرنا|إسقاط|اسقاط|[أا]سقط|تحييد|تصد|التعامل مع (?:صاروخ|صواريخ|مسير|هجم|الهجم|تهديد|[أا]هداف)|تعامل(?:نا|ت) مع|تتعامل مع|نتعامل مع|هجوم|هجمات|هجمة|استهداف|استهدف|عدوان|اعتداء|شظايا|حطام|سقوط (?:صاروخ|مسير|طائرة مسير)/;
// Not one day's attack: tallies over days, footage, notices, drills, denials, yesterday's news; condemnations,
// warnings, meetings and other words about the war; the army's own raids on smugglers; a technical fault.
const NOT = /منذ بد[ءا]|منذ بداية|إجمالي|اجمالي|حصيلة|خلال (?:الـ?\s*)?\d+ (?:يوم|أيام|ايام)|خلال (?:الـ?\s*)?(?:48|72|96) ساعة|في \d+ (?:يوم|يومًا|يوما)|خلال (?:الأيام|الايام|الأسبوع|الاسبوع|الشهر)|مشاهد|فيديو|لقطات|صور ل|التخلص من|بقايا|تمرين|مناورة|لا صحة|تنفي|ينفي|نفت|نفى|شائعات|(?:^|\s)(?:أمس|امس)(?=\s|$|،|\.)|البارحة|سابق|تحذر|تحذير|يرجى|ترجو|تدعو|غرفة عمليات|تدريب|وفد|اجتماع|اتصال|بحث|يلتقي|التقى|يشارك|زيارة|يدين|تدين|ندين|[أا]دان|إدانة|ادانة|استنكار|تستنكر|نستنكر|نحمل|تحمل|رفض|ترفض|انتهاك|سافر|تبرير|ذريعة|سيادت|القانون الدولي|مخزون|نحتفظ|تحتفظ|حق الرد|لن نتردد|نعمل على|سنرد|سفير|السفير|مجلس الأمن|الأمم المتحدة|عزاء|نعي|ينعى|جنازة|تشييع|تجار|مخدرات|تهريب|مهرب|عطل فني|تسرب|ضمن منظومة|الجاهزية|اشتراطات|حج |يثمن|يشيد|حفل|اليوم الوطني|عروض|نقف مع|القوة الباكستانية|تهديد(?:ا)? (?:مباشر|خطير)|يمثل|جنوب بارس|براكة النووية تهديد|لم يتم|احتجاج|الخطوط الحمراء|مواصلة|العمل المشترك|لمواجهة|وزير الدفاع|كلمة|خطاب|«/;
// At sea: a ship or a rig off the coast is UKMTO's and the sea's, not a place on land.
const SEA = /ناقل|سفين|زورق|قبالة|منصة حفر|ميلا|ميل بحري|الممر الملاحي/;
const IRAN = /إيران|ايران|الإيراني|الايراني|إيرانية|ايرانية|الحرس الثوري/;
const IRAQ = /من العراق|الأراضي العراقية|الاراضي العراقية|من الأجواء العراقية|عراقية المصدر|انطلقت من العراق|جاءت من العراق/;
const YEMEN = /اليمن|الحوثي|حوثي|اليمنية|صنعاء/;
// A tally: a count of a hundred or more, not today's.
const bigCount = (t) => !/اليوم/.test(t) && (t.match(/\d+/g) || []).some((n) => +n >= 100 && +n < 1900);

const weapons = (t) => {
  const w = [];
  if (/باليستي/.test(t)) w.push('ballistic missiles');
  if (/كروز|جوال/.test(t)) w.push('cruise missiles');
  if (!w.length && /صاروخ|صواريخ/.test(t)) w.push('missiles');
  if (/مسير|مسيّر|مسيَّر|طائرات? بدون طيار|درون/.test(t)) w.push('drones');
  return w.length ? (w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w.at(-1) : w[0]) : 'an attack';
};

const norm = (s) => s.replace(/&rlm;|[\u200c\u200e\u200f]/g, '').replace(/[\u064B-\u0652]/g, '');
const rows = [];
for (const f of files) {
  const handle = f.replace(/^.*[\\/]/, '').replace(/\.jsonl$/, '').replace(/^hd\d$/, 'AlHadath_Brk');
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l) rows.push({ ...JSON.parse(l), handle });
}
const ev = [], seen = new Set();
const skip = {};
const no = (k) => { skip[k] = (skip[k] || 0) + 1; };
rows.sort((a, b) => (a.at < b.at ? -1 : 1));
for (const r of rows) {
  if (!r.at || r.at < '2026-02-28') continue;
  const raw = norm(r.text || '');
  // The opening line or sentence carries the news; Petra and Al Hadath put it all in one line.
  const head = OWN[r.handle]
    ? raw.replace(/^\s*(?:#?بيان(?: رقم)? ?\(?\d*\)?|#بيان \|)\s*/, '').split(/\s*(?:وتؤكد|وتهيب|ويرجى|يرجى|تنوه|#الجيش)/)[0].replace(/\s+/g, ' ').slice(0, 500)
    : raw.split(/\n\s*\n|(?<=[.!])\s+(?=وتؤكد|وتهيب|ويرجى)/)[0];
  const body = raw.slice(0, 900);
  let cc = OWN[r.handle];
  if (!cc) {
    const lead = head.split(/[:：]|\.\./)[0].trim();
    if (lead === head.trim() || lead.length > 70) { no('no speaker'); continue; }
    // Petra speaks for Jordan: its army, air force and public security need no country name.
    const s = r.handle === 'petranews' && /القوات المسلحة|سلاح الجو|الأمن العام|الامن العام|الجيش/.test(lead) ? [null, 'jo'] : SPEAKER.find(([re]) => re.test(lead.replace(/^#?عاجل\s*\|*\s*/, '').replace(/^["«]|["»]$/g, '')));
    if (!s) { no('no speaker'); continue; }
    cc = s[1];
  }
  if (!ATTACK.test(head)) { no('not an attack'); continue; }
  if (NOT.test(head) || bigCount(head)) { no('tally, footage, notice or statement'); continue; }
  if (SEA.test(head)) { no('at sea'); continue; }
  if (YEMEN.test(body) && !IRAN.test(body)) { no('from Yemen (Yemen desk)'); continue; }
  if (cc === 'sa' && SAUDI_SOUTH.test(head) && !IRAN.test(body)) { no('Saudi south, Houthi front'); continue; }
  const actor = IRAQ.test(body) ? 'iraqi_militias' : IRAN.test(body) ? 'iran' : 'unclear';
  // What happened, as the statement tells it.
  const kind = /شظايا|حطام/.test(head) ? 'debris' : /محاولة|محاولات|إحباط|احباط|حاولت|حاول /.test(head) ? 'foiled'
    : /اعتراض|اعترض|تدمير|دمرنا|إسقاط|اسقاط|[أا]سقط|تحييد|تصد|التعامل مع|تعامل(?:نا|ت) مع|تتعامل|نتعامل/.test(head) ? 'intercept'
    : /سقوط|حريق|[أا]ضرار|إصاب|مقتل|وفاة|قتيل|[أا]صابت|انفجار/.test(head) ? 'hit' : 'attack';
  const local = new Date(Date.parse(r.at) + 3 * 3600e3).toISOString().slice(0, 10);
  const cn = C[cc];
  const places = [];
  for (const [re, place, lat, lng, en] of P[cc]) {
    const m = head.match(re);
    if (!m) continue;
    // A region only when nothing finer in it is named.
    if (place === 'Eastern Province' && places.some((q) => q.lat > 25 && q.lng > 48.4)) continue;
    if (place === 'Riyadh' && places.some((q) => /Riyadh/.test(q.place))) continue;
    if (place === 'Al-Kharj' && places.some((q) => q.place === 'Prince Sultan Air Base')) continue;
    places.push({ said: m[0], place, lat, lng, en });
  }
  const who = actor === 'iraqi_militias' ? ', launched from Iraq,' : actor === 'iran' ? ' from Iran' : '';
  const w = weapons(head);
  const url = r.url || `https://t.me/${r.handle}/${r.id}`;
  const say = `${cn.name} says`;
  // "Attacks" with no weapon, no place and nothing intercepted or hit are words about the war, not an event.
  if (kind === 'attack' && !places.length && w === 'an attack') { no('words about attacks'); continue; }
  const adj = w === 'an attack' ? '' : w.replace(/missiles/g, 'missile').replace(/drones/g, 'drone') + ' ';
  const mk = (p) => {
    const at = p ? p.en : cn.name + ' (place not stated)';
    const near = p ? (/base|refinery|field|embassy|plant|Military City|Riyadh's/.test(p.en) ? 'near ' : 'over ') + p.en : '(place not stated)';
    const label = kind === 'debris' ? `Debris from ${w === 'an attack' ? 'an interception' : 'intercepted ' + w}${who} falls on ${at}, ${say}`
      : kind === 'foiled' ? `${say} it foiled ${adj ? 'a ' + adj : 'an '}attack${who} on ${at}`
      : kind === 'intercept' ? `${say} it intercepted ${w}${who} ${near}`
      : kind === 'hit' ? `${w === 'an attack' ? 'Attack' : w[0].toUpperCase() + w.slice(1)}${who} hit ${at}, ${say}`
      : `${adj ? adj[0].toUpperCase() + adj.slice(1) : ''}${adj ? 'attack' : 'Attack'}${who} on ${at}, ${say}`;
    const key = `${local}|${p ? p.place : cc}`;
    const had = ev.find((e) => e.key === key);
    // One pin a place a day; a later statement that names who launched it gives the pin its side.
    if (had) { if (had.actor === 'unclear' && actor !== 'unclear') Object.assign(had, { actor, label, url, text: head, source: SRC[r.handle] || r.handle, said: p ? p.said : had.said }); return; }
    ev.push({ key, cc, day: local, actor, said: p ? p.said : head.split(/[:：]/)[0].trim().slice(0, 40) || cn.name, country: cn.country || cn.name, label, source: SRC[r.handle] || r.handle, url, text: head, en: p ? p.place : cn.name, lat: p ? p.lat : cn.gen[0], lng: p ? p.lng : cn.gen[1] });
  };
  if (places.length) places.forEach(mk); else mk(null);
}
// A country in general only on a day with no place of it named (the follow-ups: fire from the debris, and so on).
for (let i = ev.length - 1; i >= 0; i--) if (ev[i].key.endsWith('|' + ev[i].cc) && ev.some((e) => e !== ev[i] && e.cc === ev[i].cc && e.day === ev[i].day)) ev.splice(i, 1);
for (const e of ev) { delete e.key; delete e.cc; }
// "said" must be in "text": for a statement with no place, it is the speaker's words before the colon, or the
// first words of an account's own post.
for (const e of ev) if (!e.text.includes(e.said)) e.said = e.text.slice(0, 30);
fs.writeFileSync(out, ev.map((e) => JSON.stringify(e)).join('\n') + '\n');
fs.writeFileSync(out + '.review.txt', ev.map((e) => `${e.day} ${e.actor} ${e.en} | ${e.label}\n   ${e.text.slice(0, 200)}\n   ${e.url}`).join('\n'));
const by = {};
for (const e of ev) by[e.country] = (by[e.country] || 0) + 1;
console.log(ev.length, 'events', by, 'skipped', skip);
