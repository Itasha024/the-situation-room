// NNA's strike headlines -> candidate places (1-3 words after a trigger); the geocoder picks the longest real town.
const fs = require('fs');
// The news channels' strike headlines on Lebanon too (user, 10 Oct: "any attack in this conflict"):
//   node nna.cjs [out.jsonl part/hd0.jsonl part2/aj0.jsonl ...]; with no files, NNA alone into nna-cands.jsonl.
const [OUT = 'nna-cands.jsonl', ...FILES] = process.argv.slice(2);
const chOf = (f) => { const b = f.replace(/^.*[\\/]/, '').replace(/\.jsonl$/, ''); return /^hd\d$/.test(b) ? 'AlHadath_Brk' : /^aj\d$/.test(b) ? 'ajanews' : /^ar\d$/.test(b) ? 'AlArabiya' : b.replace(/-\d+$/, ''); };
const SRC = { NNA_Leb: 'NNA', AlHadath_Brk: 'Al Hadath', ajanews: 'Al Jazeera', AlArabiya: 'Al Arabiya', naya_foriraq: 'Naya', SabrenNewss: 'Sabereen', Alomhoar: 'Al-Mihwar', Alibk3: 'Ali Bk', almanarnews: 'Al-Manar', almayadeen: 'Al Mayadeen' };
const L = (FILES.length ? FILES : ['tg/NNA_Leb.jsonl']).flatMap((f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => ({ ...JSON.parse(l), ch: FILES.length ? chOf(f) : 'NNA_Leb' }))).sort((a, b) => (a.at < b.at ? -1 : 1));
// Outside NNA, a headline is Lebanon's when it names Lebanon or a Lebanese region, and no other front.
const LEB = /لبنان|اللبناني|البقاع|الهرمل|بعلبك|النبطية|صيدا|الضاحية|بيروت|مرجعيون|بنت جبيل|جزين|حاصبيا|الزهراني|إقليم التفاح|اقليم التفاح|قضاء صور|مدينة صور/;
const OTHER_FRONT = /غزة|القطاع|خان يونس|رفح|دير البلح|جباليا|الضفة|جنين|طولكرم|نابلس|سوريا|السوري|دمشق|القنيطرة|درعا|حمص|إيران|ايران|طهران|اليمن|صنعاء|الحديدة|العراق|بغداد/;
const beirutDay = (iso) => new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(0, 10);
const STRIKE = /غارة|غارات|قصف|استهدف|(?:مسيّرة|مسيرة)\s+(?:معادية|إسرائيلية|اسرائيلية)|قذائف|المدفعية/;
const NOT = /المحتلة|المطلة|صافرات|اعترض|قواتنا|الجيش الإسرائيلي:|الجيش الاسرائيلي:|من لبنان|^لا |لا غارة|نفى|ينفي|نفي |إنذار|انذار|يحذر|تحذير|تهديد|يهدد|المقاومة|حزب الله|بيان|نحو الأراضي|المستوطنات|الجليل|كريات|نتنياهو|كاتس|أدرعي|اعتراض|العدد الإجمالي|حصيلة|منذ بدء|منذ بداية|الأسبوع|إيران|طهران|اليمن|غزة|العراق|سوريا|دمشق|الضفة|رسالة|الرئيس|وزير|اتصال|يستنكر|استنكر|تفقد|يدين|أدان|دان |سيادة|غارات وهمية|وهمية|خرق جدار الصوت|جدار الصوت|هدد|تحلق|تحليق|قوى الامن|قوى الأمن|انتهاء|الانقاض|الأنقاض|أمس|بالونات/;
// Words that are places only by chance: a park, orchards, a citadel, a bridge, a roundabout, the vicinity, a hill.
const GENERIC = new Set(['منتزه', 'البساتين', 'بساتين', 'القلعة', 'قلعة', 'جسر', 'الجسر', 'الدوار', 'دوار', 'الجوار', 'جوار', 'دوحة', 'الدوحة', 'الرابية', 'رابية', 'العين', 'الخلة', 'الخلّة', 'الفنار', 'الحي', 'الساحة', 'السهل', 'الوادي', 'التلة', 'تلة', 'ضفاف', 'حقل', 'الحقل', 'المرج', 'البلدة', 'الضيعة', 'المدينة', 'الجبل', 'النهر', 'المطار', 'الميناء', 'الشاطئ', 'المخيم']);
// A place named after these is no strike's: "demolitions in", "the centre in", "its head in".
const NOT_BEFORE = /^و?(?:قضاء|قضاءي|قرى|تفجير|تفجيرات|توغل|جرف|حرق|إحراق|احراق|مركز|رئيس|تحليق|منسق|مسؤول)$/;
const STOP = new Set(['سيارة', 'منزل', 'منزلا', 'منازل', 'المنطقة', 'منطقة', 'الجنوب', 'جنوب', 'لبنان', 'البقاع', 'عدد', 'عدة', 'أطراف', 'اطراف', 'محيط', 'مرتفعات', 'بين', 'يين', 'ما', 'دفعات', 'مبنى', 'شقة', 'دراجة', 'نارية', 'سلسلة', 'طريق', 'الطريق', 'قرى', 'بلدات', 'بلدة', 'بلدتي', 'مدينة', 'قرية', 'قضاء', 'الغارة', 'غارة', 'غارات', 'شاحنة', 'فان', 'مجموعة', 'مواطنين', 'مواطن', 'شبان', 'شاب', 'حي', 'ساحة', 'خراج', 'مدخل', 'وسط', 'جبانة', 'حسينية', 'مسجد', 'كنيسة', 'مستشفى', 'مركز', 'محطة', 'معمل', 'مدرسة', 'فجرا', 'فجراً', 'ليلا', 'صباحا', 'مجددا', 'جديدة', 'ثانية', 'ثالثة', 'رابعة', 'عنيفة', 'معادية', 'إسرائيلية', 'اسرائيلية', 'مسيرة', 'مسيّرة', 'في', 'على', 'من', 'الى', 'إلى', 'و', 'مع', 'بعد', 'قرب', 'عند', '-', '–', '—']);
const TRIG = /^(?:بلدة|بلدتي|بلدات|مدينة|قرية|على|استهدفت|استهدف|تستهدف|يستهدف|في|بين|يين|خراج|أطراف|اطراف|محيط|مرتفعات|طالت|طال)$/;
const DISTRICT = /^(?:النبطية|صور|بنت|مرجعيون|حاصبيا|جزين|صيدا|الزهراني|بعلبك|الهرمل|البقاع)$/;
const out = [];
for (const p of L) {
  const head = p.text.replace(/https?:\/\/\S+/g, '').replace(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,\s+2026\s+at\s+[\d:]+\s*[AP]M/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (!STRIKE.test(head) || NOT.test(head)) continue;
  if (p.ch !== 'NNA_Leb' && (!LEB.test(head) || OTHER_FRONT.test(head) || /تقرير مصور|بالصورة|بالفيديو|فيديو|مشاهد|لقطات|توثيق|آثار|اثار/.test(head))) continue;
  const tw = (/https:\/\/(?:twitter|x)\.com\/NNALeb\/status\/\d+/.exec(p.text) || [])[0];
  const url = tw || `https://t.me/${p.ch}/${p.id}`;
  const kind = /قصف|قذائف|المدفعية/.test(head) && !/غارة|غارات/.test(head) ? 'shell' : /مسيّرة|مسيرة/.test(head) ? 'drone' : 'air';
  const label = kind === 'shell' ? 'Israeli shelling of {place}, Lebanon' : kind === 'drone' ? 'Israeli drone strike on {place}, Lebanon' : 'Israeli air strike on {place}, Lebanon';
  const w = head.split(/\s+/).map((x) => x.replace(/^[«"(]+|[»")،,.:؟!]+$/g, ''));
  const starts = new Set();
  // One strike between two villages is one attack ("غارة بين بلدتي فرون والغندورية", one strike on "أطراف بلدتي X
  // وY"): the second village is no place of its own, and the pin is near the first. Strikes in the plural stay two.
  const single = !/غارات|غارتين|غارتان|بغارتين|قذائف|ضربات/.test(head);
  const pairAt = new Set();
  w.forEach((x, i) => {
    if (TRIG.test(x) && !w.slice(Math.max(0, i - 3), i).some((y) => NOT_BEFORE.test(y))) {
      // "X في النبطية", "في منطقة جزين": a district after a place or an area is where it lies, not a second strike.
      if (/^(?:قضاء|محافظة|منطقة|قضاءي)$/.test(w[i + 1] || '') && x === 'في') return;
      const next = w[i + 1] === 'منطقة' ? w[i + 2] : w[i + 1];
      if (DISTRICT.test(next || '') && (w[i + 1] === 'منطقة' || (x === 'في' && i > 0 && !/^(?:غارة|غارات|قصف|استهداف|غارتان|شهيد|شهداء|جرحى)$/.test(w[i - 1])))) return;
      starts.add(i + 1);
      if (x === 'بين' || (single && /^(?:أطراف|اطراف|محيط|خراج)$/.test(x) && w[i + 1] === 'بلدتي')) {
        const j = w.findIndex((y, k) => k > i + 1 && /^و\S{2,}/.test(y));
        if (j > 0 && j <= i + 5) pairAt.add(j);
      }
    }
    // "X وY": the place after "و" next to a place.
    if (/^و\S{2,}/.test(x) && i > 0 && !STOP.has(x.slice(1)) && !pairAt.has(i)) starts.add(i);
  });
  const groups = [];
  for (let s of starts) {
    while (s < w.length && STOP.has(w[s])) s++;
    if (s >= w.length) continue;
    const cands = [];
    for (let n = 3; n >= 1; n--) {
      const g = w.slice(s, s + n);
      if (g.length < n || g.some((x) => STOP.has(x) || /^\d/.test(x))) continue;
      const said = g.join(' ').replace(/^و(?!ادي)(?=\S{2,})/, '').replace(/^ب(?=ال)/, '');
      if (said.length >= 3 && !GENERIC.has(said) && p.text.includes(said)) cands.push(said);
    }
    if (cands.length) groups.push(cands);
  }
  for (const cands of groups) out.push({ day: beirutDay(p.at), actor: 'israel', cands, country: 'Lebanon', label, source: SRC[p.ch] || p.ch, url, text: p.text, kind, head });
}
fs.writeFileSync(OUT, out.map((e) => JSON.stringify(e)).join('\n'));
const all = new Set(out.flatMap((e) => e.cands));
console.log(out.length, 'place groups', all.size, 'candidate names');
