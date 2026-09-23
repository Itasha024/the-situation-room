// Lists live map pins worth a second look, the way the 23 September audit
// found Kamaran filed as a ship attack. Read-only: prints suspects, and the
// fixes go into public/map-fixes.json by hand.
//   node scripts/audit-map.mjs [days=3]
import { readFileSync } from "node:fs";

import { COUNTRY_PLACE_RE, classifyForMap } from "./lib/map-classify.mjs";

const days = Number(process.argv[2] || 3);
const fixes = JSON.parse(readFileSync(new URL("../public/map-fixes.json", import.meta.url), "utf8")).fixes || {};
const res = await fetch("https://yemen-war-desk.vercel.app/api/desk?limit=1000");
const { reports } = await res.json();
const since = Date.now() - days * 86400_000;
const NOT_EVENT = /\b(?:plans?|reinforcements?|sends?|visits?|meets?|discuss|warns?|says|said|claims? of|reveals?|denies|arrest|missing|footage|satellite|toll|in two days|traffic|cross(?:ed)?|transit)\b/i;
const out = [];
for (const r of reports) {
  if (Date.parse(r.at) < since || typeof r.lat !== "number" || fixes[r.fp]?.remove) continue;
  const blob = [r.summary, r.text, r.place].filter(Boolean).join("\n");
  const cat = fixes[r.fp]?.cat || classifyForMap(blob, r.type);
  if (!cat || cat === "statement") continue;
  const why = [];
  if (COUNTRY_PLACE_RE.test(String(r.place || ""))) why.push("country centre");
  if (cat === "vessel" || cat === "port") why.push(`${cat} pin`);
  const name = String(r.place || "").replace(/ (?:district|governorate)$/i, "").split(/[\s'`-]+/).filter((w) => w.length > 3)[0];
  if (name && !blob.slice(0, blob.length - String(r.place).length).toLowerCase().includes(name.toLowerCase())) why.push(`place "${r.place}" not in text`);
  if (NOT_EVENT.test(r.summary)) why.push("maybe not an event");
  if (why.length) out.push(`${r.at.slice(0, 16)} ${cat.padEnd(6)} ${r.fp}\n    ${r.summary}\n    -> ${why.join("; ")}`);
}
console.log(out.join("\n") || "No suspects.");
