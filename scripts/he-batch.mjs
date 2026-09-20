/**
 * One-off migration helper: prints the next batch of untranslated Hebrew strings
 * from data.json, and reports coverage against scripts/lib/archive-en.json.
 *
 *   node scripts/he-batch.mjs <batchIndex> [size]
 *   node scripts/he-batch.mjs stats
 */
import { readFileSync, existsSync } from "node:fs";
import { heKey } from "./lib/he-key.mjs";

// The Hebrew original, preserved beside the English file the site now serves.
const d = JSON.parse(readFileSync("public/data.he.json", "utf8"));
const raw = existsSync("scripts/lib/archive-en.json")
  ? JSON.parse(readFileSync("scripts/lib/archive-en.json", "utf8"))
  : {};
const store = new Map();
for (const [k, v] of Object.entries(raw)) {
  if (k === "_note") continue;
  store.set(heKey(k), v);
}

const TEMPLATE = [
  /^התקפה חות׳ית על קווי מגע/,
  /^עימותים בין/,
  /^השתלטות /,
  /^תקיפה אווירית/,
  /^התרעות /,
  /^שיגור /,
  /^הופל /,
  /^פגיעה בנמל/,
  /^תקרית ימית/,
  /^ביזה/,
  /^עצרת/,
];
const isTemplate = (s) => TEMPLATE.some((re) => re.test(String(s || "").trim()));

const items = new Map();
const add = (s, kind, at) => {
  const t = String(s || "").trim();
  if (!t || !/[֐-׿]/.test(t)) return;
  if (!items.has(t)) items.set(t, { kind, at: at || "" });
};

for (const r of d.reports || []) {
  if (isTemplate(r.summary)) continue;
  add(r.summary, "head", r.at);
  const body = String(r.text || "").replace(/^לפי [^:]{1,40}:\s*/, "");
  if (body.length > String(r.summary || "").length + 70) add(r.text, "body", r.at);
}
for (const e of d.events || []) {
  if (isTemplate(e.labelHe)) continue;
  add(e.labelHe, "label", e.at);
  const body = String(e.text || "").replace(/^לפי [^:]{1,40}:\s*/, "");
  if (body.length > String(e.labelHe || "").length + 70) add(e.text, "body", e.at);
}

const pending = [...items.entries()]
  .filter(([he]) => !store.has(heKey(he)))
  .sort((a, b) => String(b[1].at).localeCompare(String(a[1].at)) || a[1].kind.localeCompare(b[1].kind));

if (process.argv[2] === "stats") {
  const total = items.size;
  console.log(`total ${total} · translated ${total - pending.length} · pending ${pending.length}`);
  const chars = pending.reduce((n, [he]) => n + he.length, 0);
  console.log(`pending chars ${chars}`);
  for (const k of ["head", "label", "body"]) {
    const xs = pending.filter(([, m]) => m.kind === k);
    console.log(`  ${k}: ${xs.length} (${xs.reduce((n, [he]) => n + he.length, 0)} chars)`);
  }
  process.exit(0);
}

const kind = process.argv[4];
const pool = kind ? pending.filter(([, m]) => m.kind === kind) : pending;
const size = Number(process.argv[3] || 30);
const idx = Number(process.argv[2] || 0);
const batch = pool.slice(idx * size, (idx + 1) * size);
console.log(`# pool ${pool.length}${kind ? ` (kind=${kind})` : ""}`);
console.log(`# batch ${idx} — ${batch.length} of ${pending.length} pending`);
for (const [he, meta] of batch) {
  console.log(`\n[${meta.kind}] ${he}`);
}
