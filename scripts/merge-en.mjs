/**
 * Merge a batch of hand translations into scripts/lib/archive-en.json.
 *
 * Entries are addressed by their position in the same pending pool that
 * he-batch.mjs prints, so the Hebrew key never has to be retyped — which is
 * where niqqud and bidi marks used to silently break the lookup.
 *
 *   node scripts/merge-en.mjs <batch.json> [kind]
 *
 * batch.json is [{ "i": 0, "en": "..." }, ...] with i the index printed by
 * `node scripts/he-batch.mjs 0 <size> <kind>` (0-based, within that pool).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { heKey } from "./lib/he-key.mjs";

const d = JSON.parse(readFileSync("public/data.he.json", "utf8"));
const raw = existsSync("scripts/lib/archive-en.json")
  ? JSON.parse(readFileSync("scripts/lib/archive-en.json", "utf8"))
  : {};
const have = new Set();
for (const k of Object.keys(raw)) {
  if (k === "_note") continue;
  have.add(heKey(k));
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
  .filter(([he]) => !have.has(heKey(he)))
  .sort((a, b) => String(b[1].at).localeCompare(String(a[1].at)) || a[1].kind.localeCompare(b[1].kind));

const kind = process.argv[3];
const pool = kind ? pending.filter(([, m]) => m.kind === kind) : pending;

const batch = JSON.parse(readFileSync(process.argv[2], "utf8"));
let added = 0;
const out = { ...raw };
for (const { i, en } of batch) {
  const row = pool[i];
  if (!row) {
    console.error(`! no pending entry at index ${i}`);
    continue;
  }
  const [he] = row;
  if (have.has(heKey(he))) {
    console.error(`! already translated at index ${i}`);
    continue;
  }
  out[he] = String(en).trim();
  have.add(heKey(he));
  added++;
}

writeFileSync("scripts/lib/archive-en.json", JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`merged ${added} · pool was ${pool.length} · now pending ${pool.length - added}`);
