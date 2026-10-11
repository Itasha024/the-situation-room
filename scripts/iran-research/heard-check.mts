// Every baseline pin through the served check (heardInside): pins on a place heard inside a longer one.
import fs from "node:fs";
import { heardInside } from "../../src/lib/desk/iran-places.ts";
const b = JSON.parse(fs.readFileSync(new URL("../../public/iran-strikes-baseline.json", import.meta.url), "utf8"));
let n = 0;
for (const p of b) { const h = heardInside(p); if (h) { n++; console.log(p.day, p.place, "->", h.name, "|", p.label.slice(0, 80)); } }
console.log("baseline flagged", n, "of", b.length);
