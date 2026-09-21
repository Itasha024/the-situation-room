/**
 * Proof-of-concept for the reading layer, run against the two items the audit
 * caught the deterministic composer getting wrong.
 *
 * Success = the Saree post names Taiz/Al-Jawf/Marib as targets and Khamis
 * Mushait/Taif as ORIGINS, and the al-Mashat post surfaces the Mecca
 * accusation-and-denial rather than "the other side's account is false".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "C:\\Users\\itama\\Desktop\\The Desk";

function key() {
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = /^\s*GEMINI_API_KEY\s*=\s*(.*)$/.exec(line);
    if (m) return m[1].trim();
  }
  throw new Error("GEMINI_API_KEY not in .env");
}

const SYSTEM = `You are the wire editor of an OSINT desk covering the war in Yemen.
You read one raw source item and return ONE JSON object. No prose, no markdown.

SCOPE — what belongs on this desk:
(a) Launches, strikes, impacts, warnings and sirens, inside Yemen, inside Saudi
    Arabia, and at sea.
(b) Statements, official or unofficial, from any party to this conflict:
    the Yemeni legitimate government, the Houthis, Saudi Arabia, Iran, the US,
    Europe, Pakistan, Turkey. Arms sales to a party (e.g. US F-35s to Saudi
    Arabia) are in scope. A party invoking "unity of fronts" tying Yemen to
    Lebanon, Gaza or Hormuz is in scope.
(c) Exclusives and source-based reporting about this conflict.
Gaza, Lebanon, Ukraine or Hormuz as the SUBJECT is out of scope. The test is
whether this conflict is the frame, not merely the backdrop.

THE RULE THAT MATTERS MOST — grammatical role.
Distinguish where a weapon came FROM, where it was AIMED, and where it LANDED.
An airbase that aircraft took off from is an ORIGIN, never a target. If you
cannot tell the roles apart with confidence, set confident_roles=false and name
no target at all. A missing target is correct; an invented one is a false report.

GROUNDING. Every number, place and proper noun in your output must appear in the
source text. Never add context, cause, casualties or attribution the source did
not give. If the source does not say, list it in notes_absent.

SPEAKER. For a statement, lead the headline with the speaker, e.g. "Trump: ...".
Use a bare surname only for a figure an international reader knows (Trump,
al-Mashat, Saree). Otherwise use the title alone ("Yemen's defence minister"),
or affiliation alone ("A Houthi official"). Never publish an unfamiliar name.

STYLE. English wire style. headline <= 110 chars. body = 2-3 sentences carrying
the substance, no padding. A thin source yields a short body; that is correct.

Return exactly:
{"relevant":bool,"category":"a"|"b"|"c"|null,"confident_roles":bool,
 "event_type":"strike"|"launch"|"ground"|"alert"|"maritime"|"statement"|"diplomacy"|"other",
 "speaker":string|null,"actor":string|null,"targets":[string],"origins":[string],
 "places_to_pin":[string],"figures":{},"headline":string,"body":string,
 "notes_absent":[string]}`;

const ITEMS = [
  {
    label: "SAREE STRIKE POST (was inverted: bases became targets)",
    source: "Shajab News (Telegram, Houthi-aligned)",
    text: `العميد يحيى سريع: شن الطيران الحربي السعودي خلال الـ24 ساعة الماضية 28 غارة جوية من خلال طائرات "F15" و "تايفون" أقلعت من قاعدتي خميس مشيط والطائف استهدفت محافظات تعز والجوف ومأرب ليبلغ إجمالي الغارات منذ بدء التصعيد السعودي على بلدِنا وشعبنا 760 غارة جوية.`,
  },
  {
    label: "AL-MASHAT SPEECH (news was discarded; dateline invented as MECCA)",
    source: "Mohammed Abdulsalam (Telegram, Houthi-aligned)",
    text: `🟥 الرئيس مهدي المشاط: ♦️ نشيد بأبناء القوات المسلحة والأمن على انضباطهم والتزامهم الأخلاقي والديني امتداداً لخط الثورة في تعاملهم مع الأسرى والجرحى والمخدوعين ♦️ نستهجن الافتراء الكاذب من النظام السعودي باستهداف جيشنا لمكة المكرمة، ونقول له خسئت وخاب مسعاك الدنيء والعالم أجمع يع`,
  },
  {
    label: "OUT-OF-SCOPE CONTROL (Gaza as subject — must be rejected)",
    source: "Al Jazeera (Telegram)",
    text: `عاجل | الاحتلال الإسرائيلي يقصف مناطق في شمال قطاع غزة ويوقع عشرات الشهداء والجرحى`,
  },
];

const MODEL = process.argv[2] || "gemini-flash-latest";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function read(item, apiKey, attempt = 0) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [
          {
            role: "user",
            parts: [{ text: `SOURCE: ${item.source}\nTEXT:\n${item.text}` }],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    },
  );
  // 503 "high demand" and 429 are routine on the free tier. Backing off is the
  // difference between a desk that skips a report and one that carries it.
  if ((res.status === 503 || res.status === 429) && attempt < 4) {
    await sleep(1500 * 2 ** attempt);
    return read(item, apiKey, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text();
    return { error: `HTTP ${res.status}: ${body.slice(0, 400)}` };
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
  try {
    return JSON.parse(text);
  } catch {
    return { error: "unparseable", raw: text.slice(0, 600) };
  }
}

const apiKey = key();
console.log(`model: ${MODEL}\n`);
for (const item of ITEMS) {
  const t0 = Date.now();
  const out = await read(item, apiKey);
  console.log("=".repeat(72));
  console.log(item.label, `(${Date.now() - t0}ms)`);
  console.log(JSON.stringify(out, null, 2));
}
