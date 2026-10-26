/**
 * The Gaza – Judea & Samaria map's researched events (user, 26 Oct: "it needs to be very accurate … more and more
 * sources palestinian and israeli, to reflect everything that happened on the map"): every post of the sources'
 * Telegram history that names a place and an act was read by a model with the rules in RULES-map.md (one event, one
 * entry, its day, place, side, kind and label, the posts that tell it); this checks and places them.
 *
 *   npx tsx scripts/gaza-research/pins-build.mts <folder of read batches> [out.json] [geocode cache]
 *
 * A place is the gazetteer's (gaza-gazetteer.ts) or it is dropped and listed; Israeli citizens' acts are in Judea and
 * Samaria only; the label is in the desk's words (gaza-words.ts) and a label still in either side's words is dropped.
 */
import fs from "node:fs";
import path from "node:path";
import { GAZA_GAZ } from "../../src/lib/desk/gaza-gazetteer.ts";
import { gazaPlacesIn } from "../../src/lib/desk/gaza-places.ts";
import { gazaWords } from "../../src/lib/desk/gaza-words.ts";
import { gazaKindOf } from "../../src/lib/desk/gaza-kinds.ts";
import { nativeWords } from "../../src/lib/desk/iran-places.ts";

const [dir, outFile = "public/gaza-map-pins.json", geoFile = "", approxFile = ""] = process.argv.slice(2);
/** geocode.mjs's cache: the readers' new places as OpenStreetMap has them. */
const GEO: Record<string, [number, number][] | null> = geoFile && fs.existsSync(geoFile) ? JSON.parse(fs.readFileSync(geoFile, "utf8")) : {};
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
  // OpenStreetMap's place of that name (geocode.mjs), the one near the town named.
  const geo = (GEO[s] ?? []).filter(([lat, lng]) => nearP && km({ name: "", area: "", lat, lng }, nearP) <= 25)[0];
  if (geo && nearP) return { name: en, lat: geo[0], lng: geo[1], area: nearP.area };
  // A street, a square or a hamlet the lists don't have: the town it is in, under its own name.
  return nearP ? { ...nearP, name: `${en}, ${nearP.name}` } : null;
}

/** The desk's words (gaza-words.ts), and no "terrorists" for a party's men in its voice (gaza-reader.ts): operatives, by group. */
const deskVoice = (s: string) =>
  gazaWords(s)
    .replace(/\bthe (Hamas|Islamic Jihad) terrorist organi[sz]ations?\b/gi, "$1")
    .replace(/\bterrorist organi[sz]ations?\b/gi, "groups")
    .replace(/\bterrorists\b/gi, "operatives")
    .replace(/\bterrorist\b/gi, "operative")
    .replace(/\b([Aa]) (operative|armed)/g, "$1n $2");

/** Every gazetteer entry of a name ("Burqa" east of Ramallah and north-west of Nablus). */
const ALL_OF = new Map<string, Place[]>();
for (const [name, lat, lng, area] of GAZA_GAZ) (ALL_OF.get(name.toLowerCase()) ?? ALL_OF.set(name.toLowerCase(), []).get(name.toLowerCase())!).push({ name, lat, lng, area });
const TOWNS = ["Gaza", "Khan Younis", "Rafah", "Deir al-Balah", "Jabalia", "Beit Lahia", "Beit Hanoun", "Nuseirat", "Bureij", "Maghazi", "Hebron", "Nablus", "Jenin", "Ramallah", "Tulkarm", "Qalqilya", "Bethlehem", "Jericho", "Tubas", "Salfit", "Jerusalem"];
const TOWN_RE = new RegExp(String.raw`\b(${TOWNS.join("|").replace(/Gaza/, "Gaza City")})\b`, "i");
/**
 * The place checked against the town the label tells it by (batch 66, 26 Oct: a Khan Younis strike put at An Nasr from the
 * machine-matched list; "Burqa" of Ramallah read as Nablus's): the entry of that name nearest the town, else the town itself
 * when the place is too far from it (9 km in Gaza, 30 in Judea and Samaria).
 */
function nearTown(p: Place | null, label: string, asked: string): Place | null {
  if (!p) return p;
  // A town is its own place ("Jerusalem Street, east of Nablus"); so is a named place the label names too, unless the name is a
  // common one many towns have ("An-Nasr", "the Old City", "al-Jabal").
  if (TOWNS.includes(p.name)) return p;
  const common = /^(?:Al|An|As|Ad|Ar|At|Az|Hayy|Old|Ash)\b/i.test(p.name);
  if (!common && new RegExp(String.raw`\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`, "i").test(label)) return p;
  const m = TOWN_RE.exec(label);
  if (!m) return p;
  const town = BY_NAME.get(m[1].toLowerCase() === "gaza city" ? "gaza" : m[1].toLowerCase());
  if (!town || p.name === town.name) return p;
  const same = (ALL_OF.get(p.name.toLowerCase()) ?? [p]).map((q) => ({ q, d: km(q, town) })).sort((a, b) => a.d - b.d)[0];
  // Gaza's towns are a few km across; Judea and Samaria's villages are told by a town 20 km off ("Sinjil, north of Ramallah").
  if (same.d <= (town.area === "Gaza" ? 9 : 30)) return same.q;
  // A town named only as the region ("south of Hebron" for a village 20 km off) stays the reader's place when it was looked up as new.
  if (asked.startsWith("NEW:")) return p;
  townMoves.push(`${p.name} → ${town.name} | ${label}`);
  return { ...town, name: `${town.name}` };
}
const townMoves: string[] = [];

/**
 * The pin's kind by name (gaza-kinds.ts, user, 26 Oct: "clash" covered too much): what the label says was done; the
 * reader's own "strike" or "funeral" when the label's words say no more than a clash.
 */
function kindOf(readerKind: string, label: string): string {
  if (readerKind === "funeral") return "funeral";
  const k = gazaKindOf(label);
  return k === "combat" && readerKind === "strike" ? "strike" : k;
}

type Ev = { day: string; place: string; side: string; kind: string; label: string; src: string[] };
const BAD = /West Bank|\bsettlers?\b|\boccupation\b|\boccupied\b|martyr|massacre|Zionist|colonist|genocide|ceasefire violation|aggression/i;
const pins: (string | number | [string, string][])[][] = [];
const dropped: Record<string, string[]> = { place: [], words: [], side: [], form: [] };
let read = 0, merged = 0;
/** The batch each pin came from, row for row. */
const pinFile: string[] = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  let evs: Ev[] = [];
  try { evs = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { console.warn("bad file", f); continue; }
  for (const e of evs) {
    read++;
    const kind = KINDS.indexOf(e.kind);
    if (!/^\d{4}-\d\d-\d\d$/.test(e.day) || e.day < FROM || e.day >= TO || !SIDES.has(e.side) || kind < 0 || !e.label || !e.src?.length) { dropped.form.push(`${f} ${JSON.stringify(e).slice(0, 140)}`); continue; }
    const at = nearTown(placeOf(String(e.place || "")), e.label, String(e.place || ""));
    if (!at) { dropped.place.push(`${e.day} ${e.place} | ${e.label}`); continue; }
    if (e.side === "israeli_citizens" && at.area === "Gaza") { dropped.side.push(`${e.day} ${at.name} | ${e.label}`); continue; }
    if (at.area === "Israel" && !["hamas", "factions"].includes(e.side)) { dropped.side.push(`${e.day} ${at.name} (Israel) ${e.side} | ${e.label}`); continue; }
    const label = deskVoice(e.label.trim());
    if (BAD.test(label)) { dropped.words.push(label); continue; }
    const srcs = e.src.map((s) => s.split(":")).filter(([ch, id]) => NAMES[ch] && /^\d+$/.test(id ?? ""));
    if (!srcs.length) { dropped.form.push(`${f} no source ${e.label}`); continue; }
    const [[ch, id], ...rest] = srcs;
    const also: [string, string][] = [];
    for (const [c, i] of rest) if (!also.some(([n]) => n === NAMES[c]) && NAMES[c] !== NAMES[ch]) also.push([NAMES[c], `https://t.me/${c}/${i}`]);
    const url = `https://t.me/${ch}/${id}`;
    // Batches end on whole days, but a later post can tell an earlier day: the same day, side and place read in another
    // batch, or the same lead post, is the same event, one pin with the other's sources.
    const twin = pins.find((q, i) => (pinFile[i] !== f && q[0] === e.day && q[1] === e.side && q[5] === at.name) || q[8] === url);
    if (twin) {
      const tw = twin[9] as [string, string][];
      for (const a of [[NAMES[ch], url] as [string, string], ...also]) if (a[0] !== twin[7] && !tw.some(([n]) => n === a[0])) tw.push(a);
      merged++;
      continue;
    }
    pins.push([e.day, e.side, +at.lat.toFixed(5), +at.lng.toFixed(5), kindOf(e.kind, label), at.name, label, NAMES[ch], url, also]);
    pinFile.push(f);
  }
}
// The IDF's reports that name only a part of the Strip (approx.mts), near the line there.
// A named place's report the readers may have pinned from other posts: not twice (same day, Israel's act, within 3 km).
let approxN = 0;
if (approxFile && fs.existsSync(approxFile))
  for (const p of JSON.parse(fs.readFileSync(approxFile, "utf8"))) {
    const at = { name: "", area: "", lat: p[2], lng: p[3] };
    if (!/place not given/.test(p[5]) && pins.some((q) => q[0] === p[0] && q[1] === "israel" && km({ name: "", area: "", lat: q[2] as number, lng: q[3] as number }, at) < 3)) continue;
    pins.push([...p.slice(0, 4), kindOf(p[4] === 0 ? "strike" : "clash", p[6]), p[5], deskVoice(p[6]), ...p.slice(7)]);
    approxN++;
  }
console.log(`approximate pins added ${approxN}`);
pins.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
const out = { from: FROM, to: TO, note: "Researched 26 Oct 2026: the sources' Telegram history, every post naming a place and an act read by a model (scripts/gaza-research/pins-build.mts): one pin per event, its day only.", n: pins.length, pins };
fs.writeFileSync(outFile, JSON.stringify(out));
const by: Record<string, number> = {};
for (const p of pins) by[String(p[1])] = (by[String(p[1])] || 0) + 1;
console.log(`read ${read}, merged across batches ${merged}, pins ${pins.length}`, by);
console.log(`moved to the named town ${townMoves.length}`); townMoves.slice(0, 25).forEach((x) => console.log("   ", x));
for (const [k, v] of Object.entries(dropped)) { console.log(`dropped ${k}: ${v.length}`); v.slice(0, 15).forEach((x) => console.log("   ", x)); }
fs.writeFileSync(path.join(dir, "..", "dropped.json"), JSON.stringify(dropped, null, 1));
