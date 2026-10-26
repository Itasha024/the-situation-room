/**
 * The Gaza – Judea & Samaria map's events from the ceasefire of 10 Oct 2025 to the desk's first day (user, 26 Oct:
 * "deep osint research in all our relevant sources … for events on map … since the cease fire"), read by rule from
 * the sources' Telegram history, as the Iran map's were (scripts/iran-research): no model quota.
 *
 *   npx tsx scripts/gaza-research/read.mts <dump folder> [out.json]
 *
 * The dumps are t.me/s pages (scripts/iran-research/tgpage.mjs), one JSON line a post: Emanuel Fabian
 * (manniefabian: the IDF's and the police's own statements, the attacks on Israelis), the IDF's English channel,
 * and Quds News Network in English (QudsNen: the Palestinian accounts, told as their claims).
 * One event, one pin: the same day, side and place (within 1.5 km) is one pin, the second source its "also".
 */
import fs from "node:fs";
import path from "node:path";
import { gazaPins } from "../../src/lib/desk/gaza-places.ts";
import { gazaWords } from "../../src/lib/desk/gaza-words.ts";

const [dir, outFile = "public/gaza-map-pins.json"] = process.argv.slice(2);
const FROM = "2025-10-10", TO = "2026-10-23";

type Post = { id: number; at: string; text: string };
type Src = { ch: string; name: string; side: "israel" | "palestinian" };
const SOURCES: Src[] = [
  { ch: "manniefabian", name: "Emanuel Fabian", side: "israel" },
  { ch: "IDFofficial", name: "IDF", side: "israel" },
  { ch: "QudsNen", name: "Quds News Network", side: "palestinian" },
];

/** Other fronts and other news: no pin on this map. */
const ELSEWHERE = /\b(?:Lebanon|Lebanese|Hezbollah|Beirut|Litani|Nabatieh|Nabatiyeh|Tyre|Sidon|Bint Jbeil|Khiam|Marjayoun|Bekaa|Baalbek|Dahiyeh|Syria\w*|Iran\w*|Tehran|Houthis?|Yemen\w*|Iraq\w*|Sanaa|Hodeidah|Damascus|Golan|Qatar|Doha|Cairo|Turkey|Ankara|London|Paris|Washington|New York|Europe\w*)\b/i;
const NOT_EVENT = /\b(?:(?:past|last) (?:24|48|72) hours|death toll|toll (?:has )?(?:risen|rose|climbs?)|across the (?:Gaza )?Strip|since the (?:ceasefire|truce|start)|surgery|honou?red|reunit\w*|meets her|meets his|October 7,? 2023|7 October 2023|Nova (?:music )?festival|body was|bodies of|death was|murdered (?:on|at) |anniversary|years? (?:ago|after|since)|remember\w*|recounts?|testimon\w*|leaked|photograph\w*|footage (?:shows|from)|video (?:shows|from)|watch\b|photos? (?:show|of)|interview|op-ed|podcast|poll|court|trial|indict\w*|sentenc\w*|funeral of|laid to rest|named as|identified as|cleared for publication|investigation|probe|recovered (?:the )?(?:body|remains)|hostage|remains of|Board of Peace|aid trucks?|statement|condemn\w*|warns?|threat\w*|vows?|said|says|claims? that|will |would |plans? to|expected to|may |could )\b/i;
// What happened, and who did it.
const ISR_ACT = /\b(?:IDF|Israeli (?:forces|army|troops|soldiers|air ?strikes?|strikes?|drones?|fire|gunfire|tanks?|artillery|shelling|navy|gunboats?|bulldozers?|military|police|aircraft|warplanes?|quadcopters?)|troops|soldiers|the military|air ?strikes?|drone strike|Israeli Air Force|IAF|Border Police|Shin Bet|police)\b/i;
const CITIZEN_ACT = /\b(?:settlers?|colonists?|Israeli (?:civilians|citizens|extremists)|extremists|Jewish (?:extremists|youths|rioters)|hilltop youth|rioters)\b/i;
const PAL_ATTACK = /\b(?:terrorists?|gunm[ae]n|assailants?|attackers?|stabbing|ramming|car-ramming|shooting attack|terror attack|opened fire (?:on|at) (?:troops|soldiers|Israelis|a checkpoint|an? Israeli)|rocket (?:was )?(?:fired|launched)|explosive device|IED|sniper (?:fire|attack) on troops|Palestinian (?:gunman|attacker|assailant|terrorist))\b/i;
const CLANS = /\b(?:clans?|Popular Forces|Abu Shabab|militias?|gangs?|armed (?:group|family)|Hamas (?:security|gunmen|forces) (?:clash|execut|kill)|executions?|executed)\b/i;
const PA_ACT = /\b(?:PA (?:security )?forces|Palestinian (?:Authority )?security forces|Preventive Security)\b/i;
const VERB = /\b(?:kill\w*|dead|wound\w*|injur\w*|struck|strikes?|striking|hit|bomb\w*|shell\w*|fire[ds]?|firing|opened fire|shot|shoot\w*|raid\w*|storm\w*|arrest\w*|detain\w*|abduct\w*|demolish\w*|bulldoz\w*|raz(?:e|ed|es|ing)|blew up|blow\w* up|torch\w*|set fire|burn\w*|attack\w*|assault\w*|beat\w*|ston(?:e|ed|ing)|stab\w*|ram(?:med|ming)|clash\w*|eliminat\w*|thwart\w*|foil\w*|uproot\w*|seiz\w*|confiscat\w*|incursion|advanc\w*|invad\w*|explosion|blast)\b/i;
const STRIKE = /\b(?:struck|strikes?|striking|air ?strikes?|drone|bomb\w*|shell\w*|artillery|missile|rocket|tank fire|naval fire|gunboats?|quadcopter|explosion|blast|blew up|detonat\w*)\b/i;

/** The post's first lines, the headline of it: "Breaking |", "IDF:" and links off. */
function headOf(text: string): string {
  const t = text.replace(/https?:\/\/\S+/g, " ").replace(/^\s*(?:🔴|⭕️|❗️|‼️|🚨|⚡️)?\s*(?:Breaking|BREAKING|Watch|Update|Urgent)\s*[|:]\s*/i, "").trim();
  const first = t.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  return first.length > 260 ? first.slice(0, 257).replace(/\s+\S*$/, "") + "…" : first;
}

function sideOf(h: string, src: Src): string | null {
  const israelHit = /\bIsraeli (?:strikes?|air ?strikes?|forces|drones?|army|troops|fire|aircraft|tanks?|artillery)\b|\bIDF\b/i.test(h);
  if (CLANS.test(h) && !israelHit && /\bGaza|Khan Y(?:ou|u|o)nis|Rafah|Deir al-Balah|Jabalia|Nuseirat|Bureij|Maghazi|Netzarim\b/i.test(h)) return "clans";
  if (PA_ACT.test(h)) return "pa";
  if (CITIZEN_ACT.test(h) && !/\b(?:attack|stab|ram|shoot)\w* (?:on|at|against) (?:settlers|Israeli (?:civilians|citizens))\b/i.test(h)) return "israeli_citizens";
  // Their attack, not the IDF's strike on "terrorists": "Hamas terrorists … struck by the IDF" is Israel's act.
  const theirAct = /\b(?:stabbing|ramming|car-ramming|shooting attack|terror attack|opened fire (?:on|at|toward)|hurled|threw (?:an? )?(?:explosive|grenade|stones?|firebomb)|rocket (?:was )?(?:fired|launched)|explosive device (?:exploded|detonated)|attacked (?:troops|soldiers))\b/i.test(h) && !/\b(?:planned|planning|plotted|intended|on (?:their|his) way to|was preparing|were preparing|in the immediate timeframe)\b/i.test(h);
  if (PAL_ATTACK.test(h) && (theirAct || !ISR_ACT.test(h))) return /\bHamas\b/.test(h) ? "hamas" : "factions";
  if (ISR_ACT.test(h)) return "israel";
  // A Palestinian account of an event with no actor named is Israel's act ("A Palestinian was killed east of Khan Younis").
  if (src.side === "palestinian" && /\b(?:killed|wounded|injured|shot|arrested|detained|demolished)\b/i.test(h)) return "israel";
  return null;
}

type Pin = { day: string; side: string; lat: number; lng: number; kind: number; place: string; label: string; source: string; url: string; also: [string, string][] };
const pins: Pin[] = [];
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 94.5);
let seen = 0, kept = 0;
for (const src of SOURCES) {
  const f = path.join(dir, `${src.ch}.jsonl`);
  if (!fs.existsSync(f)) { console.warn("no dump", f); continue; }
  const posts: Post[] = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  posts.sort((a, b) => a.id - b.id);
  for (const p of posts) {
    const day = new Date(p.at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
    if (day < FROM || day >= TO || !p.text) continue;
    seen++;
    const head = headOf(p.text);
    if (head.length < 25 || ELSEWHERE.test(head) || NOT_EVENT.test(head) || !VERB.test(head)) continue;
    const side = sideOf(head, src);
    if (!side) continue;
    const places = gazaPins(head, p.text, head);
    if (!places.length) continue;
    const at = places[0];
    // Visits to the Temple Mount ("settlers storm Al-Aqsa", daily) are no event; violence there is.
    if (/Temple Mount|Aqsa/i.test(at.name) && !/\b(?:kill|wound|injur|beat|assault|attack|arrest|detain|clash|stab|shot|shoot|fire)\w*/i.test(head)) continue;
    // Israel itself is on this map only for an attack on Israelis there.
    if (at.area === "Israel" && !["hamas", "factions"].includes(side)) continue;
    let label = gazaWords(head);
    // A post still in its side's words after the rewrite is a feature, not a report of one event (26 Oct: 55 of 4,034).
    if (/West Bank|settler|occupation|occupied|martyr|massacre|Zionist|colonist|genocide/i.test(label)) continue;
    if (src.side === "palestinian" && !/^[^:]{2,40}:\s/.test(label)) label = `Palestinian media: ${label}`;
    const kind = STRIKE.test(head) && !/\b(?:raid|arrest|clash|stab|ram)\w*/i.test(head) ? 0 : 1;
    const url = `https://t.me/${src.ch}/${p.id}`;
    const same = pins.find((x) => x.day === day && x.side === side && km(x, at) < 1.5);
    if (same) {
      if (same.source !== src.name && !same.also.some(([s]) => s === src.name)) same.also.push([src.name, url]);
      // The Israeli official account leads over a relay of it.
      continue;
    }
    pins.push({ day, side, lat: +at.lat.toFixed(5), lng: +at.lng.toFixed(5), kind, place: at.name, label, source: src.name, url, also: [] });
    kept++;
  }
}
pins.sort((a, b) => a.day.localeCompare(b.day));
const out = { from: FROM, to: TO, note: "Researched 26 Oct 2026 from the sources' Telegram history (scripts/gaza-research/read.mts): one pin per event, its day only.", n: pins.length, pins: pins.map((p) => [p.day, p.side, p.lat, p.lng, p.kind, p.place, p.label, p.source, p.url, p.also]) };
fs.writeFileSync(outFile, JSON.stringify(out));
const by: Record<string, number> = {};
for (const p of pins) by[`${p.side}`] = (by[p.side] || 0) + 1;
console.log(`posts ${seen}, pins ${kept}`, by);
