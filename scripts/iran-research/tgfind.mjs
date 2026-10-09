// The first post id on or after a date, by binary search over t.me/s pages.
import { page } from './tgpage.mjs';
const [ch, day] = process.argv.slice(2);
const top = await page(ch, 0); let hi = Math.max(...top.map(p => p.id)), lo = 1;
while (hi - lo > 20) { const mid = Math.floor((lo + hi) / 2); const ps = await page(ch, mid); if (!ps.length) { lo = mid; continue; } const at = ps[0].at; if (at < day) lo = mid; else hi = mid; await new Promise(s => setTimeout(s, 300)); }
console.log(ch, lo, hi, 'latest', Math.max(...top.map(p => p.id)));
