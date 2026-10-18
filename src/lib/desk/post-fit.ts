/**
 * Stored cards whose Telegram link is the post beside their own get their own (18 Oct).
 *
 * A channel that sends several posts at once was read in one batch, and a reading
 * could land under its neighbour's id: the card's link opened the post one or two
 * before or after the one it tells. New cards are checked as they are read
 * (reader.ts `misplaced`); this goes over the cards already stored, a few a tick,
 * newest first. Each card's channel page around its post is read once; when the
 * linked post does not fit the card and a neighbour clearly does, the card and its
 * pins take the neighbour's link.
 */

import { fitScore } from "./reader.ts";
import type { DeskStore } from "./store.ts";

/** fp → 1 once a card was looked at, so each card is read once. */
export const POST_FIT_KEY = "post-fit-checked";
/** Cards looked at a tick: each costs one read of a channel page. */
export const POST_FIT_PER_TICK = 6;
/** How far back stored cards are checked. */
const SINCE_DAYS = 14;
/** The ids beside the linked one that a reading could have landed on. */
const REACH = 2;

export type ChannelPost = { id: number; text: string };

const TME = /^https?:\/\/t\.me\/(?:s\/)?([A-Za-z0-9_]{4,})\/(\d+)(?:[/?#].*)?$/;
export function tmePost(url: string): { ch: string; id: number } | null {
  const m = TME.exec(String(url || "").trim());
  return m ? { ch: m[1], id: Number(m[2]) } : null;
}

const decode = (s: string) =>
  s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").trim();

/** The posts on a channel's public page (t.me/s/…): id and text. */
export function channelPosts(html: string, ch: string): ChannelPost[] {
  const out: ChannelPost[] = [];
  const parts = String(html || "").split(/(?=<div class="tgme_widget_message_wrap)/);
  for (const p of parts) {
    const id = new RegExp(`data-post="${ch}/(\\d+)"`, "i").exec(p);
    if (!id) continue;
    const t = /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(p);
    out.push({ id: Number(id[1]), text: t ? decode(t[1]) : "" });
  }
  return out;
}

/**
 * The neighbour's id a card belongs under, or null when its own post fits (or none clearly
 * fits better). The same bar as a new card's (reader.ts `misplaced`): its own post shares at most
 * one word, number or name with it, and a neighbour shares three or more.
 */
export function betterPost(card: { headline: string; body: string }, own: ChannelPost | undefined, near: ChannelPost[]): number | null {
  if (!own || !own.text) return null;
  const mine = fitScore(card, own.text);
  if (mine > 1) return null;
  let best: ChannelPost | null = null;
  let score = 0;
  for (const p of near) {
    if (p.id === own.id || !p.text) continue;
    const s = fitScore(card, p.text);
    if (s > score) { score = s; best = p; }
  }
  return best && score >= 3 && score > mine + 1 ? best.id : null;
}

export type PostFitDeps = { page: (url: string) => Promise<string | null> };

/** Moves a few stored cards to their own post; returns how many moved. */
export async function fixStoredPosts(store: DeskStore, deps: PostFitDeps, now = Date.now(), perTick = POST_FIT_PER_TICK): Promise<number> {
  if (!store.tmeLinks || !store.repost) return 0;
  const seen = (await store.getJson<Record<string, number>>(POST_FIT_KEY)) ?? {};
  const since = new Date(now - SINCE_DAYS * 86400_000).toISOString();
  const rows = await store.tmeLinks(since, perTick, Object.keys(seen));
  if (!rows.length) return 0;
  let moved = 0;
  for (const r of rows) {
    seen[r.fp] = 1;
    const at = tmePost(r.url);
    if (!at) continue;
    const html = await deps.page(`https://t.me/s/${at.ch}?before=${at.id + REACH + 1}`);
    // A page that did not come is not tried again: the queue never stalls on one channel.
    if (!html) continue;
    const posts = channelPosts(html, at.ch);
    const own = posts.find((p) => p.id === at.id);
    const near = posts.filter((p) => p.id !== at.id && Math.abs(p.id - at.id) <= REACH);
    const id = betterPost({ headline: r.headline, body: r.body }, own, near);
    if (id == null) continue;
    const url = `https://t.me/${at.ch}/${id}`;
    if (await store.repost(r.fp, r.url, url)) {
      moved++;
      console.log(`[post-fit] ${r.fp}: ${r.url} -> ${url}`);
    }
  }
  // Only the last few thousand are remembered; older cards are past the window anyway.
  const keys = Object.keys(seen);
  const keep = keys.length > 5000 ? Object.fromEntries(keys.slice(-5000).map((k) => [k, 1])) : seen;
  await store.putJson(POST_FIT_KEY, keep);
  return moved;
}
