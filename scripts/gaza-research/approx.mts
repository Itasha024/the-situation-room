/**
 * The IDF's own reports that name no nearer place than a part of the Strip ("troops eliminated a terrorist who crossed
 * the Yellow Line in the southern Gaza Strip"): the readers left them out (RULES-map.md), but they are acts on a day,
 * so they go on the map near the line in that part of the Strip, labelled "place not given" (user, 26 Oct: "to reflect
 * everything that happened on the map"). Only posts no read event already cites.
 *
 *   npx tsx scripts/gaza-research/approx.mts <dump folder> <folder of read batches> <out.json>
 */
import fs from "node:fs";
import path from "node:path";
import { gazaPlacesIn } from "../../src/lib/desk/gaza-places.ts";

const [dumps, reads, outFile] = process.argv.slice(2);
const FROM = "2025-10-10", TO = "2026-10-23";
const cited = new Set<string>();
for (const f of fs.readdirSync(reads).filter((f) => f.endsWith(".json"))) {
  try { for (const e of JSON.parse(fs.readFileSync(path.join(reads, f), "utf8"))) for (const s of e.src ?? []) cited.add(s); } catch { /* skip */ }
}
// Points just inside the line in each part, the IDF-held side's edge (not a town).
const PARTS: [RegExp, string, number, number][] = [
  [/\bnorthern Gaza\b|\bnorth(?:ern)? (?:of the )?(?:Gaza )?Strip\b/i, "northern Gaza", 31.535, 34.52],
  [/\bGaza City\b/i, "Gaza City, eastern edge", 31.5, 34.475],
  [/\bcentral Gaza\b|\bcentral (?:Gaza )?Strip\b/i, "central Gaza", 31.43, 34.4],
  [/\bsouthern Gaza\b|\bsouth(?:ern)? (?:of the )?(?:Gaza )?Strip\b/i, "southern Gaza", 31.335, 34.33],
];
const ACT = /\b(?:eliminat\w*|killed|struck|strike|shot|opened fire|fired at|neutrali[sz]\w*)\b/i;
const NAMES: Record<string, string> = { IDFofficial: "IDF", manniefabian: "Emanuel Fabian" };
const pins: unknown[][] = [];
const seen = new Set<string>();
for (const ch of Object.keys(NAMES)) {
  const f = path.join(dumps, `${ch}.jsonl`);
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    if (!l) continue;
    const p = JSON.parse(l);
    let day = new Date(p.at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
    if (day < FROM || day >= TO || cited.has(`${ch}:${p.id}`)) continue;
    const head = String(p.text || "").replace(/https?:\/\/\S+/g, "").split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
    if (!/\bGaza\b/.test(head) || !ACT.test(head) || /\b(?:Lebanon|Hezbollah|Iran|Yemen|Syria|Judea|Samaria|West Bank|Hebron|Jenin|Nablus|Tulkarm)\b/i.test(head)) continue;
    // Not a tally, a look back or a plan.
    if (/\b(?:since the (?:ceasefire|start)|so far|in total|over the past|last week|last month|planned|planning|plotted|complet\w* (?:its|their) (?:mission|activity)|over \d+|dozens of|hundreds of|summary)\b/i.test(head)) continue;
    // A place the IDF names ("the Al-Shati area in the northern Gaza Strip") is the pin's, when the gazetteer has it in Gaza.
    const named = gazaPlacesIn(head, head).find((g) => g.area === "Gaza" && g.name !== "Gaza");
    const part = named ? ([null, named.name, named.lat, named.lng] as const) : PARTS.find(([re]) => re.test(head));
    if (!part) continue;
    if (/\b(?:yesterday|last night|overnight)\b/i.test(head)) day = new Date(Date.parse(`${day}T12:00:00Z`) - 86400_000).toISOString().slice(0, 10);
    // One pin a day and part from these reports: the IDF and Fabian tell the same strike.
    const place = named ? named.name : `${part[1]} (place not given)`;
    const key = `${day}|${place}`;
    if (seen.has(key)) { const q = pins.find((x) => x[0] === day && x[5] === place); if (q && NAMES[ch] !== q[7]) (q[9] as [string, string][]).push([NAMES[ch], `https://t.me/${ch}/${p.id}`]); continue; }
    seen.add(key);
    // The IDF's words as its own, but not "terrorists" in the desk's voice (gaza-reader.ts): its operatives, by group.
    const said = head.replace(/^IDF:\s*/i, "").replace(/\bthe (Hamas|Islamic Jihad) terrorist organi[sz]ations?\b/gi, "$1").replace(/\bterrorist organi[sz]ations?\b/gi, "groups").replace(/\bterrorists\b/gi, "operatives").replace(/\bterrorist\b/gi, "operative").replace(/\bterror\b/gi, "armed");
    const label = `IDF: ${said.slice(0, 150)}${said.length > 150 ? "…" : ""}`;
    const kind = /\b(?:struck|strike|air ?strike|drone)\b/i.test(head) ? 0 : 1;
    pins.push([day, "israel", +(+part[2]).toFixed(5), +(+part[3]).toFixed(5), kind, place, label, NAMES[ch], `https://t.me/${ch}/${p.id}`, []]);
  }
}
fs.writeFileSync(outFile, JSON.stringify(pins));
console.log(`approximate pins ${pins.length}`);
