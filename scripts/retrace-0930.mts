/**
 * Look again, once, for the originals of the relays the user named on 30 Sep
 * (the Pakistani defence minister and Grundberg via Almashhad, Aspides via
 * Sawt al-Asima, the British government via Saudi News), with the new
 * official-body rules: each goes back on the day-long retry, and the next
 * scans swap in the original when they find it. LIVE DATABASE WRITE.
 */
import { findCitation, searchKeys } from "../src/lib/desk/origin.ts";
import { speakerOf } from "../src/lib/desk/speakers.ts";
import { getStore } from "../src/lib/desk/store.ts";
import type { LiveReport } from "../src/lib/desk/types.ts";

const FPS = [
  "live-www-almashhad-news-news-497310",
  "live-www-almashhad-news-news-497286",
  "live-www-sawt-alasima-net-news-120416",
  "live-x-com-saudinews50-status-2104864394064654409",
  "live-x-com-saudinews50-status-2104864117844762974",
  "live-x-com-saudinews50-status-2104863885421388075",
];
const CACHE_KEY = "origin-cache-v3";
const store = await getStore();
const cache = (await store.getJson<Record<string, unknown>>(CACHE_KEY)) ?? {};
const { reports } = await store.recentDesk(800, undefined, { events: false });
const now = Date.now();
for (const fp of FPS) {
  const r = (reports as unknown as LiveReport[]).find((x) => x.fp === fp);
  if (!r) {
    console.log(fp, "not found");
    continue;
  }
  const copy = `${r.summary}\n${r.text ?? ""}`;
  const sp = speakerOf(r.summary, r.text ?? "");
  const cited = findCitation(copy, r.source, "") ?? (sp ? { name: sp.name, site: sp.official ?? "", lang: "en" as const, kind: "official" as const, country: sp.country, speaker: sp.name } : null);
  if (!cited) {
    console.log(fp, "no citation:", r.summary);
    continue;
  }
  const keys = searchKeys(copy, cited);
  console.log(fp, "->", cited.name, cited.x ?? "", cited.site, keys.slice(0, 5).join(" "));
  cache[fp] = { cited, keys, arKeys: [], firstAt: now, lastAt: 0, report: { ...r, citing: cited.name }, released: true };
}
await store.putJson(CACHE_KEY, cache);
process.exit(0);
