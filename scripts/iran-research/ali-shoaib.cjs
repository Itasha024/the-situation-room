const fs = require('fs');
const AR = '٠١٢٣٤٥٦٧٨٩';
const digits = (s) => s.replace(/[٠-٩]/g, (d) => AR.indexOf(d));
const L = fs.readFileSync(process.argv[2] || 'tg/alichoeib1970.jsonl', 'utf8').trim().split('\n').map(JSON.parse).sort((a, b) => a.id - b.id);
const beirutDay = (iso) => new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(0, 10);
const KEEP = [
  [/المسير|المسيّر|المسيرة|المسيّرة/, 'drone', 'Israeli drone strike on {place}, Lebanon'],
  [/الطيران الحربي|الغارات الحربية|الغارات الجوية|^\s*(?:الغارات|غارات)/, 'air', 'Israeli air strike on {place}, Lebanon'],
  [/القصف المدفعي|قصف مدفعي|القصف المعادي|القصف الفوسفوري/, 'shell', 'Israeli shelling of {place}, Lebanon'],
];
const SKIP = /^#|مضيئ|قنابل|صوتي|تفجير|تمشيط|إحراق|احراق|حرائق|مناشير|تحركات|تحرك|آليات|جرف|توغل|رشاش|محلّق|محلق|غالونات|أخرى/;
const REGION = /^(?:الجنوب|البقاع[^:\n]{0,20}|الضاحية الجنوبية|لبنان|بيروت|جنوب لبنان)\s*:?\s*$/;
function clean(it) {
  // An illumination round in a shelling list is a flare, not a strike.
  if (/مضيء|مضيئة/.test(it) && !/مدفعي|فوسفوري|فسفوري/.test(it)) return '';
  it = it.replace(/&nbsp;/g, ' ').replace(/[🔅✅️✔]/g, '').replace(/\s*\/.*$/, '').replace(/\s(?:القصف|التفجيرات|القنابل|الغارات|المحلّقات|المحلقات|التحركات|الاعتداءات|مسيرة|مسيّرة|قذائف)(?:\s.*)?$/, '').replace(/\s+/g, ' ').trim();
  if (/^(?:القصف|التفجيرات|القنابل|الغارات|المحلّقات|المحلقات|التحركات|الاعتداءات)/.test(it)) return '';
  if (/\sو\s?/.test(it) && it.split(/\s+/).length <= 4) it = it.split(/\s+و\s*/)[0];
  if (REGION.test(it)) return '';
  const m = /(?:بلدة|بلدتي|مدينة|قرية)\s+([^\s،.,–\-—(]+(?:\s+(?:ال)?[^\s،.,–\-—(]+)?)/.exec(it);
  if (m && it.split(/\s+/).length > 3) return m[1];
  const b = /^(?:المنطقة\s+(?:الواقعة\s+)?)?بين\s+(\S+(?:\s+ال\S+)?)\s*(?:و|-|–)/.exec(it);
  if (b) it = b[1];
  it = it.split(/[(،,+—–]|\s-\s|-/)[0];
  it = it.replace(/\s+(?:مدفعي|فوسفوري|فسفوري|حربي|مسير|غارتان|غارة|غارات|بقذائف.*|قنبلة.*)$/g, '').replace(/[.،:]+$/, '').trim();
  for (let i = 0; i < 2; i++) it = it.replace(/^(?:المنطقة|منطقة|مرتفعات|أطراف|اطراف|محيط|خراج|مشاع|حرش|تلة|طريق|مفرق|بين|بلدة|مدينة|قرية)\s+/, '');
  it = it.replace(/^و(?!ادي)(?=\S{3,})/, '').replace(/\s+(?:لجهة|جهة)(?:\s.*)?$/, '').trim();
  if (it.split(/\s+/).length > 3) return '';
  return it;
}
// Names learned from the summaries written one place a line.
const known = new Set();
const out = [];
const posts = L.filter((p) => /ملخص/.test(p.text)).map((p) => ({ p, t: digits(p.text) }));
// A list's heading, with or without a marker before it ("القصف المدفعي:").
const LABEL = /(?:الغارات|غارات|القصف|قصف مدفعي|التفجيرات|القنابل|عمليات التمشيط|التمشيط|المحلّقات|المحلقات|الاعتداءات|اعتداءات|إحراق|احراق|إشعال|إلقاء|تحركات|التحركات)[^:\n•]{0,60}:/g;
// Every line ending in a colon heads a list; a hashtag ("#إعلام_العدو", the enemy's media) ends one.
const sectionsOf = (t) => t.replace(/&nbsp;/g, ' ').replace(/[🔅✅️]\s*[^\n:]{2,25}:/g, '\n').replace(/(^|\n)\s*#[^\n]*/g, '\n🟠#:').replace(/(^|\n)[ \t]*([^\n•:🟠●○◾🔸🔹]{3,70}):[ \t]*(?=\n|$)/g, '\n🟠$2:').replace(LABEL, (x) => (x.startsWith('🟠') ? x : '🟠' + x)).split(/🟠|●|○○|◾️|🔸|🔹/).slice(1);
for (const pass of [1, 2]) for (const { p, t } of posts) {
  const dm = /بتاريخ\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  const day = dm ? `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}` : beirutDay(p.at);
  for (const sec of sectionsOf(t)) {
    const ci = sec.indexOf(':');
    if (ci < 0 || ci > 70) continue;
    const label = sec.slice(0, ci);
    if (SKIP.test(label)) continue;
    const kind = KEEP.find(([re]) => re.test(label));
    if (!kind) continue;
    const body = sec.slice(ci + 1).trim();
    const lined = /\n|•/.test(body);
    if (pass === 1 && lined) for (const it of body.split(/\n|•/)) { const c = clean(it.trim()); if (c) known.add(c); }
    if (pass === 1) continue;
    let items;
    if (lined) items = body.split(/\n|•/).map((x) => clean(x.trim())).filter(Boolean);
    else {
      // One line of names: the longest known names first, word by word.
      const w = body.split(/\s+/).filter(Boolean); items = [];
      for (let i = 0; i < w.length;) {
        let hit = '';
        for (let n = 3; n >= 1 && !hit; n--) { const s = w.slice(i, i + n).join(' '); if (known.has(s)) hit = s; }
        if (hit) { items.push(hit); i += hit.split(' ').length; } else i++;
      }
    }
    for (const said of items) if (said.length >= 3 && p.text.includes(said)) out.push({ day, actor: 'israel', said, country: 'Lebanon', label: kind[2], source: "Ali Shoaib's page", url: `https://t.me/alichoeib1970/${p.id}`, text: p.text, kind: kind[1] });
  }
}
fs.writeFileSync('ali-events.jsonl', out.map((e) => JSON.stringify(e)).join('\n'));
const byKind = {}; out.forEach((e) => byKind[e.kind] = (byKind[e.kind] || 0) + 1);
const days = new Set(out.map((e) => e.day));
console.log(out.length, byKind, new Set(out.map((e) => e.said)).size, 'places', days.size, 'days', [...days].sort()[0]);
