// A pin on a place whose name the label only has inside a longer place's name (user, 11 Oct: an
// artillery strike in Bint Jbeil drawn again at Byblos, "Jbeil"). Lists them in the baseline and,
// with a /api/desk?desk=iran dump, among the live pins.
// Usage: npx tsx scripts/iran-research/inside-check.mts <live.json|-> <out.jsonl>
import fs from "node:fs";
import { IRAN_PLACES } from "../../src/lib/desk/iran-places.ts";
import { IRAN_GAZ } from "../../src/lib/desk/iran-gazetteer.ts";

const LATIN = /^[\x20-\x7e]+$/;
const names = new Map<string, string[]>();
for (const p of IRAN_PLACES) names.set(p.name, [p.name, ...(p.alt ?? [])].filter((n) => LATIN.test(n)));
for (const [name, , , , latin] of IRAN_GAZ as unknown as [string, number, number, string, string[]][]) if (!names.has(name)) names.set(name, [name, ...latin]);
const all = [...new Set([...names.values()].flat())].filter((n) => n.length >= 3);
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const escRe = (s: string) => s.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
const cache = new Map<string, RegExp>();
const wordRe = (n: string) => {
  let re = cache.get(n);
  if (!re) cache.set(n, (re = new RegExp("(?<![\\p{L}\\p{N}])" + escRe(norm(n)) + "(?![\\p{L}\\p{N}])", "gu")));
  re.lastIndex = 0;
  return re;
};
function inside(place: string, label: string): string | null {
  const L = norm(label);
  const own = names.get(place) ?? [place];
  const spans: [number, number][] = [];
  for (const n of own) for (const m of L.matchAll(wordRe(n))) spans.push([m.index!, m.index! + m[0].length]);
  if (!spans.length) return null;
  const hosts = all.filter((o) => !own.includes(o) && L.includes(norm(o)));
  let host = "";
  const free = spans.some(([a, b]) => {
    const h = hosts.find((o) => o.length > b - a && [...L.matchAll(wordRe(o))].some((m) => m.index! <= a && b <= m.index! + m[0].length));
    if (h) host = h;
    return !h;
  });
  return free ? null : host;
}
const base = JSON.parse(fs.readFileSync(new URL("../../public/iran-strikes-baseline.json", import.meta.url), "utf8"));
const live = process.argv[2] && process.argv[2] !== "-" ? JSON.parse(fs.readFileSync(process.argv[2], "utf8")).events ?? [] : [];
const out: Record<string, string>[] = [];
for (const [kind, list] of [["base", base], ["live", live]] as const)
  for (const p of list) {
    const h = inside(p.place, p.label || "");
    if (h) out.push({ kind, fp: p.fp, day: String(p.day || p.at).slice(0, 10), place: p.place, host: h, label: p.label });
  }
if (process.argv[3]) fs.writeFileSync(process.argv[3], out.map((o) => JSON.stringify(o)).join("\n"));
console.log(out.length, "flagged; baseline", base.length, "live", live.length);
for (const o of out) console.log(o.kind, o.day, o.place, "<in>", o.host, "|", o.label.slice(0, 90));

// The same fault by sound (the live lookup hears "Jbeil" in "جبيل"): a pin whose own name the label
// lacks, while a longer place the label names has a part that sounds like it, far from the pin.
const SOUND: Record<string, string> = { ب: "B", پ: "B", ت: "T", ث: "T", ط: "T", ج: "J", چ: "C", خ: "K", د: "D", ذ: "D", ض: "D", ظ: "D", ر: "R", ز: "Z", ژ: "Z", س: "S", ش: "S", ص: "S", غ: "G", ف: "F", ق: "K", ك: "K", ک: "K", گ: "G", ل: "L", م: "M", ن: "N" };
const nativeSound = (n: string) => n.replace(/[ً-ٟـ]/g, "").split(/[^\p{L}]+/u).filter(Boolean).map((w) => w.replace(/^ال/, "")).join("").split("").map((c) => SOUND[c] ?? "").join("").replace(/(.)\1+/g, "$1");
const latinSound = (w: string) => norm(w).replace(/[^a-z]/g, "").replace(/ch/g, "C").replace(/h/g, "").replace(/[qck]/g, "K").replace(/[pb]/g, "B").replace(/[vf]/g, "F").replace(/[aeiouyw']/g, "").toUpperCase().replace(/(.)\1+/g, "$1");
const where = new Map<string, { lat: number; lng: number; sounds: Set<string> }>();
for (const p of IRAN_PLACES) where.set(p.name, { lat: p.lat, lng: p.lng, sounds: new Set([p.name, ...(p.alt ?? [])].map((n) => (LATIN.test(n) ? latinSound(n) : nativeSound(n))).filter((s) => s.length >= 3)) });
for (const [name, lat, lng, , latin, native] of IRAN_GAZ as unknown as [string, number, number, string, string[], string[]][])
  if (!where.has(name)) where.set(name, { lat, lng, sounds: new Set([...latin.map(latinSound), ...native.map(nativeSound)].filter((s) => s.length >= 3)) });
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const multi = [...where.keys()].filter((n) => n.includes(" ") || n.includes("-"));
const byName = new Map<string, string>();
for (const [p, ns] of names) for (const n of ns) if (/[ -]/.test(n)) byName.set(n, p);
const far: Record<string, string>[] = [];
for (const [kind, list] of [["base", base], ["live", live]] as const)
  for (const p of list) {
    const me = where.get(p.place);
    if (!me) continue;
    const L = norm(p.label || "");
    if ((names.get(p.place) ?? [p.place]).some((n) => [...L.matchAll(wordRe(n))].length)) continue;
    for (const [n, host] of byName) {
      if (host === p.place || !L.includes(norm(n)) || ![...L.matchAll(wordRe(n))].length) continue;
      const parts = n.split(/[ -]+/);
      const h = where.get(host);
      if (h && km(h, p) > 15 && parts.some((w) => me.sounds.has(latinSound(w)))) { far.push({ kind, fp: p.fp, day: String(p.day || p.at).slice(0, 10), place: p.place, host, km: String(Math.round(km(h, p))), label: p.label }); break; }
    }
  }
console.log(far.length, "pins on a place heard inside a longer one, far away");
for (const o of far) console.log(o.kind, o.day, o.place, "<in>", o.host, o.km + " km", "|", o.label.slice(0, 90));
if (process.argv[3]) fs.appendFileSync(process.argv[3], "\n" + far.map((o) => JSON.stringify({ ...o, sound: true })).join("\n"));
void multi;
