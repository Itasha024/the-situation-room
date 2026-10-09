// NNA's strike headlines -> candidate places (1-3 words after a trigger); the geocoder picks the longest real town.
const fs = require('fs');
const L = fs.readFileSync('tg/NNA_Leb.jsonl', 'utf8').trim().split('\n').map(JSON.parse).sort((a, b) => a.id - b.id);
const beirutDay = (iso) => new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(0, 10);
const STRIKE = /غارة|غارات|قصف|استهدف|(?:مسيّرة|مسيرة)\s+(?:معادية|إسرائيلية|اسرائيلية)|قذائف|المدفعية/;
const NOT = /^لا |لا غارة|نفى|ينفي|نفي |إنذار|انذار|يحذر|تحذير|تهديد|يهدد|المقاومة|حزب الله|بيان|نحو الأراضي|المستوطنات|الجليل|كريات|نتنياهو|كاتس|أدرعي|اعتراض|العدد الإجمالي|حصيلة|منذ بدء|منذ بداية|الأسبوع|إيران|طهران|اليمن|غزة|العراق|سوريا|دمشق|الضفة|رسالة|الرئيس|وزير|اتصال|يستنكر|استنكر|تفقد|يدين|أدان|دان |سيادة|غارات وهمية|وهمية|خرق جدار الصوت|جدار الصوت|هدد|تحلق|تحليق|قوى الامن|قوى الأمن|انتهاء|الانقاض|الأنقاض|أمس|بالونات/;
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
  const tw = (/https:\/\/(?:twitter|x)\.com\/NNALeb\/status\/\d+/.exec(p.text) || [])[0];
  const url = tw || `https://t.me/NNA_Leb/${p.id}`;
  const kind = /قصف|قذائف|المدفعية/.test(head) && !/غارة|غارات/.test(head) ? 'shell' : /مسيّرة|مسيرة/.test(head) ? 'drone' : 'air';
  const label = kind === 'shell' ? 'Israeli shelling of {place}, Lebanon' : kind === 'drone' ? 'Israeli drone strike on {place}, Lebanon' : 'Israeli air strike on {place}, Lebanon';
  const w = head.split(/\s+/).map((x) => x.replace(/^[«"(]+|[»")،,.:؟!]+$/g, ''));
  const starts = new Set();
  w.forEach((x, i) => {
    if (TRIG.test(x) && !w.slice(Math.max(0, i - 3), i).some((y) => NOT_BEFORE.test(y))) {
      // "X في النبطية", "في منطقة جزين": a district after a place or an area is where it lies, not a second strike.
      const next = w[i + 1] === 'منطقة' ? w[i + 2] : w[i + 1];
      if (DISTRICT.test(next || '') && (w[i + 1] === 'منطقة' || (x === 'في' && i > 0 && !/^(?:غارة|غارات|قصف|استهداف|غارتان|شهيد|شهداء|جرحى)$/.test(w[i - 1])))) return;
      starts.add(i + 1);
    }
    // "X وY": the place after "و" next to a place.
    if (/^و\S{2,}/.test(x) && i > 0 && !STOP.has(x.slice(1))) starts.add(i);
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
  for (const cands of groups) out.push({ day: beirutDay(p.at), actor: 'israel', cands, country: 'Lebanon', label, source: 'NNA', url, text: p.text, kind, head });
}
fs.writeFileSync('nna-cands.jsonl', out.map((e) => JSON.stringify(e)).join('\n'));
const all = new Set(out.flatMap((e) => e.cands));
console.log(out.length, 'place groups', all.size, 'candidate names');
