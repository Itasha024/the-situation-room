/**
 * Try free models as card readers: the same recent Telegram posts read by
 * Gemini and by each candidate, and how often the candidate agrees (publish or
 * not, the side, the kind of event, the places). Publishes nothing.
 *   node --experimental-strip-types scripts/model-trial.mts <service>/<model> [...]
 * Needs GEMINI_API_KEY and the candidates' keys in the environment.
 */
import { FALLBACKS, readBatch, type ReaderItem, type Reading } from "../src/lib/desk/reader.ts";

const CHANNELS: [string, string, string][] = [
  ["army21ye", "Yahya Saree", "Houthi-aligned"],
  ["almasirah2", "Al-Masirah", "Houthi-aligned"],
  ["Alibk3", "Ali Bk", "Houthi-aligned"],
  ["alhadath_brk", "Al Hadath", "Saudi/government-aligned"],
  ["bin_1saeed", "Bin Saeed", "Saudi/government-aligned"],
  ["AjaNews", "Al Jazeera", "no declared alignment"],
];

const strip = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

async function posts(): Promise<ReaderItem[]> {
  const out: ReaderItem[] = [];
  for (const [ch, name, alignment] of CHANNELS) {
    const html = await (await fetch(`https://t.me/s/${ch}`, { headers: { "user-agent": "Mozilla/5.0" } })).text();
    const blocks = html.split('class="tgme_widget_message_wrap').slice(1);
    const got = blocks
      .map((b) => ({ text: strip((/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/.exec(b) || [])[1] ?? ""), at: (/datetime="([^"]+)"/.exec(b) || [])[1] ?? "" }))
      .filter((p) => p.text.length > 60)
      .slice(-4);
    got.forEach((p, i) => out.push({ id: `${ch}-${i}`, source: name, alignment, postedAt: p.at, text: p.text }));
  }
  return out;
}

const places = (r?: Reading) => new Set((r?.targets ?? []).map((t) => t.toLowerCase().split(/[ ,]/)[0]));

const items = await posts();
console.log(`${items.length} posts`);
const gemini = await readBatch(items, process.env.GEMINI_API_KEY || "");
console.log(`reference: ${gemini.model ?? gemini.error}`);
const ref = gemini.readings;

for (const arg of process.argv.slice(2)) {
  const [svc, ...rest] = arg.split("/");
  const model = rest.join("/");
  const p = FALLBACKS.find((f) => f.name === svc);
  if (!p || !p.key()) {
    console.log(`${arg}: no key`);
    continue;
  }
  for (const f of FALLBACKS) f.models = f === p ? [model] : [];
  p.ms = Number(process.env.TRIAL_MS || 180_000);
  const started = Date.now();
  // The service reads `batch` posts a call: every post is read, a call at a time.
  const got = { readings: new Map<string, Reading>(), error: "" };
  for (let i = 0; i < items.length; i += p.batch) {
    const r = await readBatch(items.slice(i, i + p.batch), "", new Set(), [], []);
    for (const [k, v] of r.readings) got.readings.set(k, v);
    if (r.error) got.error = r.error;
    if (!r.readings.size) break;
  }
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  if (!got.readings.size) {
    console.log(`${arg}: nothing (${got.error}) ${secs}s`);
    continue;
  }
  let pub = 0, side = 0, kind = 0, where = 0, both = 0, n = 0;
  const off: string[] = [];
  for (const it of items) {
    const a = ref.get(it.id);
    const b = got.readings.get(it.id);
    if (!a) continue;
    n += 1;
    if (!!b?.publish === !!a.publish) pub += 1;
    else off.push(`${it.id} publish ${a.publish}->${b?.publish}`);
    if (a.publish && b?.publish) {
      both += 1;
      if (a.actor_side === b.actor_side) side += 1;
      else off.push(`${it.id} side ${a.actor_side}->${b.actor_side}`);
      if (a.event_type === b.event_type) kind += 1;
      const pa = places(a), pb = places(b);
      if ((!pa.size && !pb.size) || [...pa].some((x) => pb.has(x))) where += 1;
    }
  }
  console.log(`${arg}: publish ${pub}/${n}, side ${side}/${both}, kind ${kind}/${both}, places ${where}/${both}, ${secs}s`);
  for (const o of off) console.log(`   ${o}`);
}
process.exit(0);
