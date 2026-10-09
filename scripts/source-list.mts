// Every source of the site, by the desks it feeds: the list for the user.
import { yemenSourceKeys } from "../src/lib/yemen-scan.server.ts";
import { IRAN_RSS, IRAN_TG, IRAN_X, SHARED_RSS, SHARED_TG, SHARED_X } from "../src/lib/desk/iran-sources.ts";
const k = yemenSourceKeys();
const both: string[] = [];
const yOnly: string[] = [];
const seen = new Set<string>();
const add = (kind: string, id: string, name: string, shared: boolean) => {
  const key = `${kind}:${name}`;
  if (seen.has(key)) return;
  seen.add(key);
  (shared ? both : yOnly).push(`${name} (${kind}${kind === "Web" ? "" : ` ${id}`})`);
};
for (const s of k.tg) add("Telegram", s.id, s.name, s.id in SHARED_TG);
for (const s of k.x) add("X", s.id, s.name, s.id in SHARED_X);
for (const s of k.rss) add("Web", s.name, s.id, s.id in SHARED_RSS);
const iOnly = [...IRAN_TG.map((s) => `${s.name} (Telegram ${s.id})`), ...IRAN_X.map((s) => `${s.name} (X ${s.id})`), ...IRAN_RSS.map((s) => `${s.name} (Web)`)];
console.log(`BOTH ${both.length}\n${both.join("\n")}\n\nYEMEN ONLY ${yOnly.length}\n${yOnly.join("\n")}\n\nIRAN ONLY ${iOnly.length}\n${iOnly.join("\n")}`);
process.exit(0);
