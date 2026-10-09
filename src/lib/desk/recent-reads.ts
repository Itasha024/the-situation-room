/**
 * What the site read in the last two days, from every source, kept in the
 * server's memory: the first place the original of a relay is looked for
 * (user, 9 Oct: "why take UKMTO from Iran International? we literally have
 * so many sources including UKMTO"). The site reads UKMTO's, CENTCOM's and
 * the officials' own posts every few minutes; a relay of one of them is
 * matched to the post the scan already holds, with no Google search, and a
 * picture post is matched by the words read off its picture.
 *
 * Memory only: after a restart it fills again from the next scans, and an
 * original not found here is still looked for the old way.
 */
import { shared } from "./originals.ts";

export type Read = { source: string; url: string; text: string; at: number };

const KEEP_MS = 48 * 3600_000;
const MAX = 8000;
const TEXT = 1500;
const reads = new Map<string, Read>();

/** The scan's items, as read (a picture post with its picture's words). */
export function remember(rows: { source: string; url: string; text: string; at: string; title?: string }[], now = Date.now()): void {
  for (const r of rows) {
    const at = Date.parse(r.at);
    if (!r.url || !Number.isFinite(at) || now - at > KEEP_MS) continue;
    const text = `${r.title ? `${r.title}\n` : ""}${r.text}`.slice(0, TEXT);
    const had = reads.get(r.url);
    if (!had || text.length > had.text.length) reads.set(r.url, { source: r.source, url: r.url, text, at });
  }
  if (reads.size <= MAX * 1.1) return;
  for (const [u, r] of reads) if (now - r.at > KEEP_MS) reads.delete(u);
  const over = reads.size - MAX;
  if (over > 0) [...reads.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, over).forEach(([u]) => reads.delete(u));
}

export function forgetAll(): void {
  reads.clear();
}

/** Is this item the body's or the speaker's own: its X account, its site, its name as the desk reads it? */
export type Owner = { names: string[]; x?: string; site?: string };
export function ownedBy(r: Pick<Read, "source" | "url">, o: Owner): boolean {
  const url = r.url.toLowerCase();
  if (o.x && new RegExp(`^https?://(?:www\\.|mobile\\.)?(?:x|twitter)\\.com/${o.x.toLowerCase()}/`).test(url)) return true;
  if (o.site) {
    try {
      const h = new URL(r.url).hostname.replace(/^www\./, "");
      const s = o.site.replace(/^www\./, "").split("/")[0];
      if (h === s || h.endsWith(`.${s}`)) return true;
    } catch {
      // not a link
    }
  }
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return o.names.some((n) => n.length >= 3 && norm(r.source) === norm(n));
}

/**
 * The owner's own item that carries the relay's story: between two days
 * before the relay and an hour after it, sharing two of its telling words. A
 * word in most of the owner's posts ("UKMTO", "vessel", "incident") tells
 * nothing of which post it is; a place, a distance or a figure does.
 */
export function ownRead(o: Owner, keys: string[], reportAt: number, notUrl = "", now = Date.now()): Read | null {
  const mine = [...reads.values()].filter((r) => r.url !== notUrl && ownedBy(r, o) && now - r.at <= KEEP_MS);
  if (!mine.length) return null;
  const telling = mine.length >= 5 ? keys.filter((k) => mine.filter((r) => shared(r.text, [k])).length <= mine.length * 0.4) : keys;
  const fit = mine
    .filter((r) => r.at >= reportAt - KEEP_MS && r.at <= reportAt + 3600_000 && shared(r.text, telling) >= 2)
    .sort((a, b) => shared(b.text, telling) - shared(a.text, telling) || a.at - b.at);
  return fit[0] ?? null;
}
