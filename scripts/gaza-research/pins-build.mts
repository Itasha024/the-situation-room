/**
 * The Gaza – Judea & Samaria map's researched events (user, 26 Oct: "it needs to be very accurate … more and more
 * sources palestinian and israeli, to reflect everything that happened on the map"): every post of the sources'
 * Telegram history that names a place and an act was read by a model with the rules in RULES-map.md (one event, one
 * entry, its day, place, side, kind and label, the posts that tell it); this checks and places them.
 *
 *   npx tsx scripts/gaza-research/pins-build.mts <folder of read batches> [out.json]
 *
 * A place is the gazetteer's (gaza-gazetteer.ts) or it is dropped and listed; Israeli citizens' acts are in Judea and
 * Samaria only; the label is in the desk's words (gaza-words.ts) and a label still in either side's words is dropped.
 */
import fs from "node:fs";
import path from "node:path";
import { GAZA_GAZ } from "../../src/lib/desk/gaza-gazetteer.ts";
import { gazaPlacesIn } from "../../src/lib/desk/gaza-places.ts";
import { gazaWords } from "../../src/lib/desk/gaza-words.ts";
import { nativeWords } from "../../src/lib/desk/iran-places.ts";

const [dir, outFile = "public/gaza-map-pins.json"] = process.argv.slice(2);
const FROM = "2025-10-10", TO = "2026-10-23";
const SIDES = new Set(["israel", "israeli_citizens", "hamas", "factions", "pa", "clans", "other"]);
const KINDS = ["strike", "clash", "funeral"]; // app.js GAZA_KINDS: strike, combat (Clashes), funeral
const NAMES: Record<string, string> = {
  manniefabian: "Emanuel Fabian", IDFofficial: "IDF", mdaisrael: "Magen David Adom", AbuAliExpress: "Abu Ali Express", cogatonline: "COGAT",
  QudsNen: "Quds News Network", qudsn: "Quds News Network (Arabic)", SafaPs: "Safa", WAFAgency: "WAFA", palmoh: "PA Health Ministry",
  MOHMediaGaza: "Gaza Health Ministry", dcdgaza: "Gaza Civil Defence", mediagovps: "Gaza Government Media Office", osama1984osama: "Osama al-Kahlout",
  jeninnews1: "Jenin News", TulkaremNet: "Tulkarm Net", TubasTimes: "Tubas Times",
};

type Place = { name: string; lat: number; lng: number; area: string };
const BY_NAME = new Map<string, Place>();
const BY_NATIVE = new Map<string, Place>();
for (const [name, lat, lng, area, latin, native] of GAZA_GAZ) {
  const p = { name, lat, lng, area };
  if (!BY_NAME.has(name.toLowerCase())) BY_NAME.set(name.toLowerCase(), p);
  for (const n of latin) if (!BY_NAME.has(n.toLowerCase())) BY_NAME.set(n.toLowerCase(), p);
  for (const n of native) { const k = nativeWords(n).join(" "); if (k && !BY_NATIVE.has(k)) BY_NATIVE.set(k, p); }
}
const km = (a: Place, b: Place) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 94.5);
function placeOf(s: string): Place | null {
  if (!s.startsWith("NEW:")) return BY_NAME.get(s.toLowerCase()) ?? null;
  const [en = "", nat = "", near = ""] = s.slice(4).split("|").map((x) => x.trim());
  const nearP = near ? placeOf(near) ?? gazaPlacesIn(near, near)[0] ?? null : null;
  const bare = en.replace(/\s+(?:checkpoint|junction|road|street|square|area|camp|village|neighbou?rhood)$/i, "");
  const nw = nativeWords(nat);
  const cands = [BY_NAME.get(en.toLowerCase()), BY_NAME.get(bare.toLowerCase()), BY_NATIVE.get(nw.join(" ")), BY_NATIVE.get(nw.join(" ").replace(/^ال/, "")), ...gazaPlacesIn(en, `${en} ${nat}`), ...gazaPlacesIn(bare, `${bare} ${nat}`)].filter((p): p is Place => !!p);
  // The one near the town the reader named, none more than 25 km off it.
  const ok = nearP ? cands.filter((p) => km(p, nearP) <= 25) : cands;
  if (ok[0]) return ok[0];
  // A street, a square or a hamlet the lists don't have: the town it is in, under its own name.
  return nearP ? { ...nearP, name: `${en}, ${nearP.name}` } : null;
}

type Ev = { day: string; place: string; side: string; kind: string; label: string; src: string[] };
const BAD = /West Bank|\bsettlers?\b|\boccupation\b|\boccupied\b|martyr|massacre|Zionist|colonist|genocide|ceasefire violation|aggression/i;
const pins: (string | number | [string, string][])[][] = [];
const dropped: Record<string, string[]> = { place: [], words: [], side: [], form: [] };
let read = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  let evs: Ev[] = [];
  try { evs = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { console.warn("bad file", f); continue; }
  for (const e of evs) {
    read++;
    const kind = KINDS.indexOf(e.kind);
    if (!/^\d{4}-\d\d-\d\d$/.test(e.day) || e.day < FROM || e.day >= TO || !SIDES.has(e.side) || kind < 0 || !e.label || !e.src?.length) { dropped.form.push(`${f} ${JSON.stringify(e).slice(0, 140)}`); continue; }
    const at = placeOf(String(e.place || ""));
    if (!at) { dropped.place.push(`${e.day} ${e.place} | ${e.label}`); continue; }
    if (e.side === "israeli_citizens" && at.area === "Gaza") { dropped.side.push(`${e.day} ${at.name} | ${e.label}`); continue; }
    if (at.area === "Israel" && !["hamas", "factions"].includes(e.side)) { dropped.side.push(`${e.day} ${at.name} (Israel) ${e.side} | ${e.label}`); continue; }
    const label = gazaWords(e.label.trim());
    if (BAD.test(label)) { dropped.words.push(label); continue; }
    const srcs = e.src.map((s) => s.split(":")).filter(([ch, id]) => NAMES[ch] && /^\d+$/.test(id ?? ""));
    if (!srcs.length) { dropped.form.push(`${f} no source ${e.label}`); continue; }
    const [[ch, id], ...rest] = srcs;
    const also: [string, string][] = [];
    for (const [c, i] of rest) if (!also.some(([n]) => n === NAMES[c]) && NAMES[c] !== NAMES[ch]) also.push([NAMES[c], `https://t.me/${c}/${i}`]);
    pins.push([e.day, e.side, +at.lat.toFixed(5), +at.lng.toFixed(5), kind, at.name, label, NAMES[ch], `https://t.me/${ch}/${id}`, also]);
  }
}
pins.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
const out = { from: FROM, to: TO, note: "Researched 26 Oct 2026: the sources' Telegram history, every post naming a place and an act read by a model (scripts/gaza-research/pins-build.mts): one pin per event, its day only.", n: pins.length, pins };
fs.writeFileSync(outFile, JSON.stringify(out));
const by: Record<string, number> = {};
for (const p of pins) by[String(p[1])] = (by[String(p[1])] || 0) + 1;
console.log(`read ${read}, pins ${pins.length}`, by);
for (const [k, v] of Object.entries(dropped)) { console.log(`dropped ${k}: ${v.length}`); v.slice(0, 15).forEach((x) => console.log("   ", x)); }
fs.writeFileSync(path.join(dir, "..", "dropped.json"), JSON.stringify(dropped, null, 1));
