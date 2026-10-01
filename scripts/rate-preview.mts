/** Ratings from a local copy of the cards (a JSON list), for review: node --experimental-strip-types scripts/rate-preview.mts <reports.json> */
import fs from "node:fs";
import { rateSources, withSeed, GROUP_LABEL, type RatedCard } from "../src/lib/desk/source-rating.ts";
import { sourceCatalogue } from "../src/lib/yemen-scan.server.ts";
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const cards: RatedCard[] = rows.map((r: any) => ({ fp: r.fp, at: r.at, source: r.source, type: r.type, summary: r.summary, lat: r.lat, lng: r.lng, also: r.also ?? r.alsoReportedBy ?? [] }));
const out = rateSources(cards, sourceCatalogue(), withSeed(null), Date.parse("2026-10-02T06:00:00Z"));
for (const g of ["houthi", "gov", "nonaligned"] as const) {
  console.log(`\n## ${GROUP_LABEL[g]}`);
  for (const s of out.filter((x) => x.group === g).sort((a, b) => b.rating - a.rating || b.n - a.n)) console.log(`${s.rating.toFixed(1)}  ${s.name}  (start ${s.start}, ${s.n} scored)`);
}
process.exit(0);
