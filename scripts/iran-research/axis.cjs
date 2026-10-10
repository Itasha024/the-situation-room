// Research stage B (user, 10 Oct): attacks in and from Iraq read from the axis's own Telegram channels
// (Sabreen, Naya, Al-Mihwar, Ali Bk; tg/<channel>.jsonl from tg-dump.mjs) -> hand events.
// A post's opening line is read when it tells one attack, today, at a place:
// - an attack word (استهداف, قصف, غارة, هجوم, سقوط مسيرة, اعتراض ...), or blasts at a named base or airport;
// - a place: a base, airport or consulate on the list below, a town of Iraq from GeoNames after a word that
//   makes it a place (في, قرب, قضاء, مدينة ...), or a province after "محافظة" (pinned at its middle);
// - not a doubt (أنباء عن, دون معرفة الأسباب), a threat, a denial, a tally of operations, a mine or an IED,
//   an attack weeks back; footage only with its own date written in it.
// Who: the Iraqi resistance named as the attacker; American or Zionist aircraft; the IRGC, or Kurdish
// opposition parties' bases as the target (Iran's war on them); else not stated.
//   node axis.cjs gn/IQ.txt axis-events.jsonl
const fs = require('fs');
const CH = { SabrenNewss: 'Sabereen', naya_foriraq: 'Naya', Alomhoar: 'Al-Mihwar', Alibk3: 'Ali Bk' };
const norm = (s) => s.replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

// Bases, airports and missions, Iraq's and those the Iraqi factions struck abroad (Syria only for them).
const SITES = [
  [/ف[يى]?كتوريا/, 'Victory Base, Baghdad airport', 33.2797, 44.2347, 'Iraq', 'the US Victory base by Baghdad airport'],
  [/مطار بغداد/, 'Baghdad International Airport', 33.2585, 44.2329, 'Iraq', 'Baghdad airport'],
  [/عين الاسد|عين الأسد/, 'Ain al-Asad', 33.7856, 42.4411, 'Iraq', 'the Ain al-Asad base'],
  [/حرير/, 'Harir Base', 36.5326, 44.3519, 'Iraq', 'the Harir base'],
  [/مطار (?:ا|أ)ربيل/, 'Erbil International Airport', 36.2376, 43.9632, 'Iraq', 'Erbil airport'],
  [/قنصلي(?:ة|ه)[^.]{0,30}(?:ا|أ)ربيل|(?:ا|أ)ربيل[^.]{0,20}قنصلي/, 'US consulate, Erbil', 36.1911, 44.0092, 'Iraq', 'the US consulate in Erbil'],
  [/(?:السفارة الامريكية|السفارة الأمريكية|السفارة الأميركية|سفارة (?:العدو|الشر|الاحتلال))(?=[^.]{0,40}(?:بغداد|الخضراء))|(?:بغداد|الخضراء)[^.]{0,40}(?:السفارة الا?مريكية|السفارة الأمريكية|السفارة الأميركية)/, 'US embassy, Baghdad', 33.2985, 44.3923, 'Iraq', 'the US embassy in Baghdad'],
  [/مطار السليمانية/, 'Sulaymaniyah International Airport', 35.5618, 45.3167, 'Iraq', 'Sulaymaniyah airport'],
  [/مطار البصرة/, 'Basra International Airport', 30.5522, 47.6639, 'Iraq', 'Basra airport'],
  [/جرف الصخر|جرف النصر/, 'Jurf al-Sakhar', 32.87, 44.11, 'Iraq', 'Jurf al-Sakhar'],
  [/بلد الجوية|قاعدة بلد/, 'Balad Air Base', 33.9473, 44.3711, 'Iraq', 'the Balad air base'],
  [/التاجي/, 'Taji', 33.5236, 44.2569, 'Iraq', 'Taji'],
  [/حقل كورمور|كورمور/, 'Khor Mor gas field', 35.1167, 44.9167, 'Iraq', 'the Khor Mor gas field'],
  [/حقل مجنون|مجنون النفطي/, 'Majnoon oil field', 31.03, 47.6, 'Iraq', 'the Majnoon oil field'],
  [/لاناز/, 'Lanaz refinery', 36.2, 43.85, 'Iraq', 'the Lanaz refinery by Erbil'],
  [/علي السالم/, 'Ali Al Salem Air Base', 29.3467, 47.5208, 'Kuwait', 'the Ali Al Salem air base in Kuwait'],
  [/عريفجان/, 'Camp Arifjan', 28.893, 48.159, 'Kuwait', 'Camp Arifjan in Kuwait'],
  [/بيورينغ|بوهرينغ|العديري/, 'Camp Buehring', 29.67, 47.41, 'Kuwait', 'Camp Buehring in Kuwait'],
  [/موفق السلطي|قاعدة الأزرق|قاعدة الازرق/, 'Muwaffaq Salti Air Base', 31.8267, 36.7822, 'Jordan', 'the Muwaffaq Salti air base in Jordan'],
  [/الامير سلطان|الأمير سلطان/, 'Prince Sultan Air Base', 24.0627, 47.5805, 'Saudi Arabia', 'the Prince Sultan air base in Saudi Arabia'],
  [/(?:هجوم|هجمات|استهداف|انفجار|انفجارات|قصف|ضربات|ضربة|تدك|يدك)[^.]{0,40}(?:في|ب)\s*(?:دويلة |دولة )?الكويت/, 'Kuwait', 29.31, 47.48, 'Kuwait', 'Kuwait (place not stated)'],
  [/التنف/, 'Al-Tanf', 33.4983, 38.6181, 'Syria', 'the al-Tanf base in Syria'],
  [/قسرك/, 'Qasrak', 36.73, 40.93, 'Syria', 'the Qasrak base in Syria'],
  [/الشدادي/, 'Al-Shaddadi', 36.0567, 40.73, 'Syria', 'the al-Shaddadi base in Syria'],
  [/خراب الجير|رميلان/, 'Rmelan', 36.86, 41.97, 'Syria', 'the Rmelan base in Syria'],
  [/حقل العمر/, 'Al-Omar oil field', 35.07, 40.47, 'Syria', 'the al-Omar field base in Syria'],
  [/كونيكو/, 'Conoco gas field', 35.18, 40.4, 'Syria', 'the Conoco field base in Syria'],
];

// Iraq's towns from GeoNames: Arabic names of populated places, the largest of any shared name; provinces apart.
const towns = new Map(), provs = new Map();
for (const l of fs.readFileSync(process.argv[2] || 'gn/IQ.txt', 'utf8').split('\n')) {
  const c = l.split('\t');
  if (c.length < 15) continue;
  const ar = c[3].split(',').filter((n) => /[ء-ي]/.test(n) && n.length >= 3);
  const pop = +c[14] || 0;
  // A real town: one with people counted, or a district's seat; not a hamlet whose name is a word.
  if (c[6] === 'P' && pop < 1000 && !/^PPL(?:A|A2|A3|C)$/.test(c[7])) continue;
  const into = c[6] === 'P' ? towns : c[6] === 'A' && c[7] === 'ADM1' ? provs : null;
  if (!into) continue;
  for (const n of ar) {
    const k = norm(n);
    if (!into.has(k) || into.get(k).pop < pop) into.set(k, { name: c[1], lat: +c[4], lng: +c[5], pop, said: n });
  }
}
// Names that are also common words, or a whole region, are not towns here.
const NOT_TOWNS = new Set(['مدينه', 'المدينه', 'الطيران', 'طيران', 'لبنان', 'فلسطين', 'المشروع', 'القدس', 'الكويت', 'الجولان', 'السفينه', 'المرحله', 'النفط', 'الغرب', 'قلعه', 'علي', 'الجنوبيه', 'الشرقيه', 'الشده', 'الفجر', 'كوردستان', 'واسط', 'وسط', 'العاصمه', 'الحزم', 'الجوف', 'الدير', 'المطار', 'القاعده', 'العراق', 'الشمال', 'الجنوب', 'الوسط', 'المنطقه', 'الحدود', 'السفاره', 'النصر', 'الشهداء', 'السلام', 'الحريه', 'الصدر', 'الجمهوريه', 'المقاومه', 'الحشد', 'الحرس', 'الاحتلال', 'العدو', 'كردستان', 'الاقليم'].map(norm));
const CUE = '(?:في|ب|قرب|محيط|منطقة|منطقه|قضاء|ناحية|ناحيه|قرية|قريه|مدينة|مدينه|شمال|جنوب|غرب|شرق|اطراف|أطراف|على|باتجاه)\\s*';

// The post is about Iraq: it names Iraq, an Iraqi province or city, or a site there; and no other front.
const IRAQ = /العراق|عراقي|بغداد|اربيل|أربيل|البصرة|الموصل|كركوك|السليمانية|الأنبار|الانبار|ديالى|صلاح الدين|بابل|كربلاء|النجف|ميسان|ذي قار|واسط|دهوك|حلبجة|نينوى|القائم|جرف|الحشد|فكتوريا|فيكتوريا|عين الأسد|عين الاسد|حرير|خليفان|سوران|كويسنجق|كويا|طوزخورماتو|تكريت|سامراء|الفلوجة|الرمادي|الكوت|العمارة|الناصرية|الديوانية|الحلة|بيجي|سنجار|زاخو|عكاشات|الرطبة/;
const ELSE = /لبنان|فلسطين|اليمن|ايران|إيران|الإيرانية|الايرانية|سوريا|السعودية|الكويت|الأردن|الاردن|البحرين|قطر|الإمارات|الامارات|تل أبيب|تل ابيب|حيفا|الخليج|هرمز|سفينة|ناقلة|طهران|غزة|صنعاء|عدن|الحديدة|مأرب|حزب الله|الكيان|المحتلة/;
const ATTACK = /استهداف|استهدف|قصف|غارة|غارات|ضربة|ضربات|هجوم|هجمات|يهاجم|تهاجم|تدك|يدك|سقوط (?:طائرة|مسيرة|مسيّرة|صاروخ)|اعتراض|إسقاط|اسقاط/;
const BLAST = /انفجار|انفجارات/;
const NOT = /تحت السيطرة|تنويه|اظن|أظن|؟|\?|امس|أمس|تغادر|التركي|تركي|تركيا|الاتراك|داعش|مخلف|جسم غريب|نفايات|يزعم|مزاعم|زعم|محتمل|صدى|تكشف|هوية|ارتفاع عدد|خلال \d+ ساعة|يوم \d+|ندين|يدين|تدين|إدانة|ادانة|الخارجية|المتحدث|يزف|تزف|زفت|تشييع|انباء عن|أنباء عن|دون معرفة|غير معروف|مجهول|سنستهدف|ستستهدف|سوف|تهدد|يهدد|تحذر|يحذر|توعد|تنفي|ينفي|نفى|لا صحة|عبوة|لغم|ناسفة|اغتيال|اعتقال|تفكيك|مناورة|تمرين|احباط|إحباط|نفذ مجاهدو|عملية خلال|عمليات|\d+\s*عملية|خلال الأربع والعشرين|الشهر الماضي|الأسبوع الماضي|منذ بداية|من بداية|خلال مواجهات|صور الأقمار|صور الاقمار|حريق|حرائق/;
const FOOT = /لقطات|توثيق|مشاهد|لحظة|لحظه|سمح بالنشر|سمح_بالنشر|سُمحَ بالنشر|فيديو|تظهر/;
const AR_DIG = (s) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

const MIL = /المقاومة الإسلامية في العراق|المقاومة الاسلامية في العراق|المقاومة العراقية|المقاومة الإسلامية العراقية|المقاومة الاسلامية العراقية|أولياء الدم|اولياء الدم|كتائب حزب الله|النجباء|جيش الغضب|البأس الشديد|فصائل المقاومة|الضربة الحيدرية|الفصائل العراقية|الفصائل المسلحة/;
const US = /(?:طيران|الطيران|غارة|غارات|قصف|ضربة|ضربات|مروحي|المروحي|العدوان|عدوان)\s+(?:(?:جوي|الجوي|حربي|الحربي|مسير|المسير|المروحي)\s+)?(?:ال)?(?:أمريكا|امريكا|أمريكي|امريكي|أميركي|اميركي)(?:ة|ه)?(?!\s*ال?صهيون)/;
const IL = /(?:طيران|الطيران|غارة|غارات|قصف|ضربة|ضربات|العدوان|عدوان)\s+(?:(?:جوي|الجوي|حربي|الحربي|مسير|المسير)\s+)?(?:ال)?(?:صهيوني|إسرائيلي|اسرائيلي)(?:ة|ه)?/;
const BOTH = /صهيوني [اأ]مريكي|صهيوني و[اأ]مريكي|صهيو\s?[اأ]مريك|صهيو\s?[اأ]ميرك|الأمريكي الصهيوني|الامريكي الصهيوني|الأمريكي والصهيوني/;
const IRAN = /الحرس الثوري|حرس الثورة|(?:ال)?(?:إيراني|ايراني)(?:ة)?\s|الاحزاب (?:الكردية|المخربة|الانفصالية|الارهابية)|الأحزاب (?:الكردية|المخربة|الانفصالية|الإرهابية)|العصابات الكردية|مقرات الاحزاب|مقرات الأحزاب|المعارضة الكردية|المعارضة الانفصالية|الانفصالية|الانفصالي|البيجاك|بيجاك|الكوملة|كوملة|كومله|حزب باك|حزب حرية كردستان/;
const KIND = (t) => /انتحاري|الانتحاري|الإنتحاري|مسير|مسيّر|FPV|محلّقة|محلقة|طائرات? مسيرة/.test(t) ? 'drone' : /صاروخ|صواريخ|صاروخي/.test(t) ? 'missile' : /غارة|غارات|الطيران الحربي|طيران حربي|قصف جوي|ضربات جوية|ضربة جوية|مروحي|F-15|F-35/.test(t) ? 'air' : /اعتراض|إسقاط|اسقاط/.test(t) ? 'intercept' : 'attack';

const iqDay = (iso) => new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(0, 10);
const out = [], tally = {};
for (const ch of Object.keys(CH)) {
  if (!fs.existsSync(`tg/${ch}.jsonl`)) continue;
  for (const p of fs.readFileSync(`tg/${ch}.jsonl`, 'utf8').trim().split('\n').map(JSON.parse)) {
    if (!p.text || p.at < '2026-02-28') continue;
    const head = p.text.split('\n').find((l) => l.replace(/[^ء-ي]/g, '').length > 8) || '';
    const h = head.slice(0, 220);
    if (NOT.test(h)) continue;
    let day = iqDay(p.at);
    if (FOOT.test(h)) {
      const d = AR_DIG(p.text.slice(0, 400)).match(/(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*2026/);
      if (!d) continue;
      day = `2026-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
      if (!/^2026-(0[2-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(day) || day < '2026-02-28') continue;
    }
    const attack = ATTACK.test(h);
    // The place: a listed site first; else a town after a place word; else a province.
    let place = null;
    for (const [re, name, lat, lng, country, en] of SITES) {
      const m = h.match(re);
      if (m) { place = { said: m[0], name, lat, lng, country, en, site: true }; break; }
    }
    if (!place && attack && IRAQ.test(h) && !ELSE.test(h)) {
      const words = h.split(/[\s،,.:;!؟()«»"“”-]+/);
      const nh = norm(h);
      let best = null;
      for (let i = 0; i < words.length; i++) {
        for (const len of [3, 2, 1]) {
          const raw = words.slice(i, i + len).join(' ');
          for (const w of [raw, raw.replace(/^(?:ب|ل|و|وب|في)(?=ال)/, ''), raw.replace(/^(?:ب|ل|و)(?=[^ا])/, '')]) {
            const k = norm(w);
            if (k.length < 3 || NOT_TOWNS.has(k)) continue;
            const prev = norm(words[i - 1] || '');
            const prov = /^(?:محافظه|بمحافظه|لمحافظه)$/.test(prev);
            const t = prov ? provs.get(k) || provs.get(norm('ال') + k) : towns.get(k) || towns.get(norm('ال') + k);
            if (!t) continue;
            const cued = prov || new RegExp(norm(CUE) + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(nh) || t.pop >= 50000;
            if (!cued) continue;
            if (!best || (best.prov && !prov) || (!!best.prov === !!prov && w.length > best.said.length)) best = { said: words.slice(i, i + len).join(' ').match(/[ء-ي][ء-ي ]*/)?.[0] || w, name: prov ? `${t.name}` : t.name, lat: t.lat, lng: t.lng, country: 'Iraq', en: prov ? `${t.name.replace(/ Governorate$/, '').replace(/^Muhafazat (?:al )?/, '')} province` : t.name, prov };
          }
        }
      }
      if (best && !best.prov) {
        const pv = [...provs.entries()].find(([k]) => new RegExp('محافظه\\s*' + k.replace(/^ال/, '(?:ال)?')).test(nh));
        if (pv && Math.hypot(pv[1].lat - best.lat, (pv[1].lng - best.lng) * 0.83) > 1.4) best = { said: words.find((x) => norm(x).includes(pv[0].replace(/^ال/, ''))) || pv[1].said, name: pv[1].name, lat: pv[1].lat, lng: pv[1].lng, country: 'Iraq', en: pv[1].name.replace(/ Governorate$/, '').replace(/^Muhafazat /, '') + ' province', prov: true };
      }
      place = best;
    }
    if (!place || !(attack || (BLAST.test(h) && place.site))) continue;
    if (!h.includes(place.said)) { const k = h.indexOf(place.said.replace(/^ال/, '')); if (k < 0) continue; place.said = place.said.replace(/^ال/, ''); }
    const t = h;
    let actor = BOTH.test(t) ? 'unclear' : US.test(t) ? 'us' : IL.test(t) ? 'israel' : MIL.test(t) ? 'iraqi_militias' : IRAN.test(t) ? 'iran' : 'unclear';
    if (actor === 'unclear' && place.country === 'Syria') continue;
    const kind = attack ? KIND(h) : 'blast';
    const who = { us: 'US', israel: 'Israeli', iraqi_militias: 'Iraqi militia', iran: 'Iranian', unclear: '' }[actor];
    const what = { drone: 'drone attack', missile: 'missile attack', air: 'air strike', intercept: 'drone or missile intercepted', attack: 'attack', blast: 'blasts' }[kind];
    const target = /الاحزاب|الأحزاب|العصابات الكردية|المعارضة الكردية|الانفصالي|مقرات المعارضة|البيجاك|الكوملة|كوملة|حزب باك/.test(h) ? `Kurdish opposition party bases in ${place.en}` : !place.site && /القواعد الا?مريكية|القواعد الأ?ميركية|قاعدة[^.]{0,25}(?:ا|أ)مريك|(?:ا|أ)مريك[^.]{0,6}قاعدة|القوات الا?مريكية|القوات الأمريكية|مصالح[^.]{0,20}(?:ا|أ)مريك|المصالح الا?مريكية|قواعد الاحتلال|قاعدة للاحتلال|قاعدة الاحتلال|معاقل الاحتلال/.test(h) ? `US forces in ${place.en}` : /الاحزاب|الأحزاب|العصابات الكردية/.test(h) ? `Kurdish opposition party bases in ${place.en}` : /الحشد|كتائب|لواء|فصائل/.test(h) && actor !== 'iraqi_militias' ? `a PMF or faction site in ${place.en}` : place.site ? place.en : place.prov ? place.en : place.en;
    const lead = (who ? `${who} ${what}` : what[0].toUpperCase() + what.slice(1)).replace(/^Blasts$/, 'Blasts');
    const label = kind === 'intercept' ? `${who ? who + ' ' : ''}Drone or missile intercepted over ${target}` : kind === 'blast' ? `Blasts at ${target}` : `${lead} on ${target}`;
    const k = `${day} ${place.name}`;
    tally[place.country] = (tally[place.country] || 0) + 1;
    out.push({ day, actor, said: place.said, country: place.country, label: label.replace(/^(\w)/, (c) => c.toUpperCase()), source: CH[ch], url: `https://t.me/${ch}/${p.id}`, text: p.text, en: place.name, lat: place.lat, lng: place.lng, key: k, head: h });
  }
}
fs.writeFileSync(process.argv[3] || 'axis-events.jsonl', out.map(({ key, head, ...e }) => JSON.stringify(e)).join('\n'));
fs.writeFileSync((process.argv[3] || 'axis-events.jsonl') + '.review.txt', out.map((e) => `${e.day} ${e.actor} | ${e.en} | ${e.label} | ${e.url}\n   ${e.head}`).join('\n'));
console.log(out.length, 'events', tally, new Set(out.map((e) => e.key)).size, 'place-days');
