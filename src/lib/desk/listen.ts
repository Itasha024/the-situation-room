/**
 * Listening to videos. Server-only.
 *
 * Much of this war is reported by video: a commander's statement filmed at a
 * position, a minister's words to a camera, a spokesman's briefing posted with
 * a one-line caption. The caption alone is often "watch" or a name; what was
 * said is in the sound. Before the gate and the reader, a post's video is
 * written out by Groq's free Whisper, and the words go after the post's own
 * text as "[Said in the video]", so the reader judges and writes from them.
 *
 * Which videos: a post the gate already keeps (its words add to it), and a
 * short-captioned video from a source that is mostly this war (its words may
 * be the whole report). Not every video of every channel: Iran's and the
 * regional channels post hundreds a day about other things.
 *
 * Limits: X's videos are always reachable (FxTwitter gives the file);
 * Telegram gives the file of a small video only ("Media is too big" past about
 * 20 MB), and a file past Whisper's 25 MB is not sent. A post is listened to
 * once: the words are kept by its address.
 */

import { createHash } from "node:crypto";
import { groqKey } from "./reader.ts";
import { breadthOf, gate } from "./relevance.ts";
import type { DeskStore } from "./store.ts";
import type { Media } from "./types.ts";

export const SAID = "[Said in the video]";
const PREFIX = "listen";
const YEMEN_DAY_KEY = "listen-day";
/** Whisper's free tier: 2,000 files and 28,800 seconds of sound a day. Half of it, at most. */
const DAY_FILES = 600;
const DAY_SECONDS = 14_000;
const TICK_FILES = 8;
/** A statement, a briefing, a field report: not a whole programme. */
const MAX_SECONDS = 420;
const MAX_BYTES = 24_000_000;
const MODEL = "whisper-large-v3-turbo";

type Heard = { text: string; at: number; secs?: number } | { none: string; at: number };
type DayLog = { day: string; files: number; secs: number };

type Hit = { source: string; url: string; text: string; lean: string; media?: Media };

const idOf = (url: string) => createHash("sha256").update(url).digest("hex").slice(0, 24);

/** The caption without its links, tags and signature: how much the post itself says. */
function captionLength(text: string): number {
  return String(text || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@][\w؀-ۿ_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/**
 * What Whisper hears in music or silence: the subtitle credits and channel
 * sign-offs it learned from the internet. Such a transcript is thrown away.
 */
const HALLUCINATION = /ترجمة\s+نانسي|اشتركوا?\s+في\s+القناة|شكرا\s+للمشاهدة|subscribe to|thanks for watching|amara\.org|سبحان الله وبحمده/i;

export function usableTranscript(t: string): string | null {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  if (s.length < 40) return null;
  if (HALLUCINATION.test(s) && s.length < 200) return null;
  // One phrase over and over is a stuck model, not speech.
  const words = s.split(" ");
  if (words.length >= 12 && new Set(words).size / words.length < 0.25) return null;
  return s.slice(0, 5000);
}

/** Is this post's video worth listening to? */
/** A video that can be heard at all: a file, short enough, not heard already. */
export function hearable(h: Hit): boolean {
  const m = h.media;
  return !!m && m.kind === "video" && !!m.src && (m.duration ?? 0) <= MAX_SECONDS && !h.text.includes(SAID);
}

export function worthListening(h: Hit): boolean {
  if (!hearable(h)) return false;
  const v = gate({ source: h.source, url: h.url, text: h.text, agency: false });
  // Excluded by name (a ceremony, a cleric, commentary, a relay): the words would not change that.
  if (v.outcome === "exclude" && !["empty", "off-topic"].includes(v.reason)) return false;
  if (v.outcome !== "exclude") return true;
  // Excluded for saying too little: a short caption, from a source that is mostly this war.
  return captionLength(h.text) < 220 && (breadthOf(h.source) === "focused" || h.lean === "houthi" || h.lean === "gov" || h.lean === "south");
}

async function fetchVideo(src: string): Promise<Blob | null> {
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(30_000), headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)" } });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES || buf.byteLength < 10_000) return null;
    return new Blob([buf], { type: "video/mp4" });
  } catch {
    return null;
  }
}

/** The words of one video, or why there are none. */
export async function transcribe(src: string): Promise<{ text: string } | { none: string }> {
  const key = groqKey();
  if (!key) return { none: "no key" };
  const file = await fetchVideo(src);
  if (!file) return { none: "file not reachable or too big" };
  const form = new FormData();
  form.append("file", file, "video.mp4");
  form.append("model", MODEL);
  form.append("response_format", "json");
  form.append("temperature", "0");
  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const err = (await res.text().catch(() => "")).slice(0, 120);
      return { none: `whisper ${res.status} ${err}` };
    }
    const j = (await res.json()) as { text?: string };
    const t = usableTranscript(j.text ?? "");
    return t ? { text: t } : { none: "no speech" };
  } catch (err) {
    return { none: err instanceof Error ? err.message : "whisper failed" };
  }
}

/**
 * Write out this scan's videos worth hearing and add their words to the posts,
 * in place. Returns how many posts gained words.
 */
export async function listenToVideos(store: DeskStore, hits: Hit[], now = Date.now(), opts: { worth?: (h: Hit) => boolean; dayKey?: string } = {}): Promise<number> {
  if (!groqKey()) return 0;
  const DAY_KEY = opts.dayKey ?? YEMEN_DAY_KEY;
  const want = hits.filter(opts.worth ?? worthListening);
  if (!want.length) return 0;
  const ids = want.map((h) => idOf(h.url));
  const known = await store.getMany<Heard>(PREFIX, ids);
  const day = new Date(now).toISOString().slice(0, 10);
  const log = (await store.getJson<DayLog>(DAY_KEY)) ?? { day, files: 0, secs: 0 };
  if (log.day !== day) Object.assign(log, { day, files: 0, secs: 0 });

  const add = (h: Hit, text: string) => {
    h.text = `${h.text.trim()}\n\n${SAID} ${text}`;
  };
  let gained = 0;
  const fresh: Record<string, Heard> = {};
  // Sources that are mostly this war first, the shortest clips first.
  const order = want
    .map((h, i) => ({ h, id: ids[i] }))
    .sort((a, b) => Number(breadthOf(b.h.source) === "focused") - Number(breadthOf(a.h.source) === "focused") || (a.h.media?.duration ?? 0) - (b.h.media?.duration ?? 0));
  let sent = 0;
  for (const { h, id } of order) {
    const had = known[id];
    if (had) {
      if ("text" in had) {
        add(h, had.text);
        gained += 1;
      }
      continue;
    }
    if (sent >= TICK_FILES || log.files >= DAY_FILES || log.secs >= DAY_SECONDS) continue;
    sent += 1;
    const secs = h.media?.duration ?? 60;
    log.files += 1;
    log.secs += secs;
    const heard = await transcribe(h.media?.src as string);
    if ("text" in heard) {
      fresh[id] = { text: heard.text, at: now, secs };
      add(h, heard.text);
      gained += 1;
      console.log(`[listen] ${h.source} ${secs}s: ${heard.text.slice(0, 90)}`);
    } else {
      fresh[id] = { none: heard.none, at: now };
      console.log(`[listen] ${h.source} ${h.url}: ${heard.none}`);
    }
  }
  if (Object.keys(fresh).length) await store.putMany(PREFIX, fresh);
  // A post is listened to once; after a week its address will not come round again.
  if (Math.random() < 0.05) await store.prune(PREFIX, 7 * 24 * 3600_000).catch(() => 0);
  if (sent) await store.putJson(DAY_KEY, log);
  return gained;
}
