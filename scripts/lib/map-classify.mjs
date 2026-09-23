// The map's classifier, lifted from public/app.js so tests and the audit run
// the same code the page runs (no copy to drift out of step).
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../public/app.js", import.meta.url), "utf8");
const from = src.indexOf("const GROUND_RE");
const to = src.indexOf("function jitter(");
if (from < 0 || to < 0) throw new Error("classifier not found in public/app.js");
const body = src.slice(from, to);
// eslint-disable-next-line no-new-func
const make = new Function(`${body}; return { classifyForMap, COUNTRY_PLACE_RE, VESSEL_ATTACK_RE };`);
export const { classifyForMap, COUNTRY_PLACE_RE, VESSEL_ATTACK_RE } = make();
