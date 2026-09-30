// Research helper: reads UKMTO warning pictures (vision) from a JSON list of posts.
import fs from "node:fs";
import { readNotice } from "../src/lib/desk/media.ts";
const [inp, outp] = process.argv.slice(2);
const posts = JSON.parse(fs.readFileSync(inp, "utf8")) as { id: string; at: string; text: string; media: string[] }[];
const done: Record<string, string> = fs.existsSync(outp) ? JSON.parse(fs.readFileSync(outp, "utf8")) : {};
for (const p of posts) {
  if (done[p.id] || Date.parse(p.at) < Date.parse("2026-07-13") || !/WARNING/i.test(p.text) || !p.media[0]) continue;
  const t = await readNotice(p.media[0]);
  if (t) done[p.id] = `${p.at} | ${t}`;
  console.log(p.id, t ? t.replace(/\s+/g, " ").slice(0, 160) : "(unread)");
  fs.writeFileSync(outp, JSON.stringify(done, null, 1));
}
