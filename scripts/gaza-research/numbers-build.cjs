/**
 * The Gaza desk's researched numbers (user, 26 Oct: "many many numbers categories … deep osint research on all"),
 * from the research files (one per subject, the boxes of public/app.js irBox) into public/gaza-numbers.json, in the
 * order the categories show. The live boxes (/api/gaza-numbers) and the map's count join them on the page.
 *
 *   node scripts/gaza-research/numbers-build.cjs <research folder>
 */
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const read = (f) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).sets : []);
const all = [...read("gaza.json"), ...read("js.json"), ...read("pa.json"), ...read("sanctions.json")];
const set = (k) => all.find((s) => s.key === k) || { boxes: [] };
const take = (k, title) => {
  const s = set(k);
  const i = s.boxes.findIndex((b) => b.title === title);
  return i >= 0 ? s.boxes.splice(i, 1)[0] : null;
};
// Casualties first, from the sets that hold them.
const cas = [take("hostages", "Casualties: Gaza war"), take("security", "IDF soldiers killed in Gaza since the ceasefire"), take("js", "Palestinians killed in Judea and Samaria")].filter(Boolean);
if (cas[0]) cas[0].title = "Killed and wounded";
// The crossings' box is the live one's title, so the latest report's states take its place when there are some.
for (const b of set("aid").boxes) if (b.title === "Crossings: latest status") b.title = "The crossings";
const ORDER = [["cas", "Casualties"], ["aid", "Aid"], ["dayafter", "Day after"], ["security", "Security"], ["js", "Judea & Samaria"], ["pa", "The PA"], ["money", "PA money"], ["sanc", "Sanctions"]]; // No Hostages: all are back (user, 26 Oct).
const sets = ORDER.map(([key, name]) => ({ key, name, boxes: key === "cas" ? cas : set(key).boxes })).filter((s) => s.boxes.length);
// The desk's words everywhere (gaza-words.ts), checked, not rewritten: a research file that breaks them is fixed by hand.
const BAD = /West Bank|\bsettlers?\b|settlements?\b|\boccupation\b|occupied|martyr|ceasefire violation|massacre|genocide|colonist|Zionist/i;
const bad = [];
const walk = (v, where) => {
  if (typeof v === "string") { if (BAD.test(v) && !/^https?:/.test(v)) bad.push(`${where}: ${v.slice(0, 120)}`); }
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "url" && k !== "src") walk(x, `${where}.${k}`);
};
sets.forEach((s) => walk(s, s.key));
if (bad.length) { console.error("words to fix:\n" + bad.join("\n")); process.exit(1); }
fs.writeFileSync("public/gaza-numbers.json", JSON.stringify({ asOf: "2026-10-26", from: "2025-10-10", sets }));
console.log(sets.map((s) => `${s.name} ${s.boxes.length}`).join(", "));
