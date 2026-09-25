/**
 * A picture or video on a card, from the X or Telegram post it was written
 * from. Server-only.
 *
 * A post having media is not a reason to show it. What goes in: launch
 * footage, strikes and impacts at a named place, interceptions, a ship hit or
 * burning, battlefield footage (a position taken, vehicles destroyed), damage
 * to a named site, satellite images, front-line maps from OSINT accounts, and a
 * leader's speech only when the speech is the card's news. What stays out:
 * logos and "breaking" cards, portraits, meetings and handshakes, file or
 * archive footage, studio clips, montages set to music, text-only graphics,
 * anything graphic (bodies, blood, the wounded), prisoners' faces, and a
 * duplicate of media on another card.
 *
 * The text and the card's type pick the candidates; one look by a free model
 * (Groq's Qwen, else Google's) at the still decides. No model, no media. Articles' pictures are
 * never used.
 */

import type { LiveReport, Media } from "./types.ts";
import { groqKey, readerKey } from "./reader.ts";
import type { DeskStore } from "./store.ts";

/* ------------------------------------------------------------------ *
 * What a post carries
 * ------------------------------------------------------------------ */

type FxMedia = {
  type?: string;
  url?: string;
  thumbnail_url?: string;
  duration?: number;
  width?: number;
  height?: number;
  formats?: { url?: string; container?: string; bitrate?: number }[];
};

/** The first video of an X post (else its first photo), as FxTwitter lists it. */
export function xMedia(media: { all?: FxMedia[] } | undefined, post: string): Media | undefined {
  const all = media?.all ?? [];
  const v = all.find((m) => m.type === "video" || m.type === "gif");
  if (v?.url && v.thumbnail_url) {
    // The 640-wide file: sharp enough for a card, a fraction of the full one.
    const mp4 = (v.formats ?? []).filter((f) => f.container === "mp4" && f.url).sort((a, b) => (a.bitrate ?? 0) - (b.bitrate ?? 0));
    const mid = mp4.find((f) => (f.bitrate ?? 0) >= 600_000) ?? mp4[mp4.length - 1];
    return {
      kind: "video",
      from: "x",
      post,
      thumb: v.thumbnail_url,
      src: mid?.url ?? v.url,
      ...(v.duration ? { duration: Math.round(v.duration) } : {}),
      ...(v.width && v.height ? { w: v.width, h: v.height } : {}),
    };
  }
  const p = all.find((m) => m.type === "photo" && m.url);
  if (p?.url) return { kind: "photo", from: "x", post, thumb: p.url.replace(/\?name=orig$/, "?name=medium"), ...(p.width && p.height ? { w: p.width, h: p.height } : {}) };
  return undefined;
}

/** The video (else the first photo) of one post's block on a t.me/s page. */
export function tgMedia(block: string, post: string): Media | undefined {
  const bg = (cls: string) => new RegExp(`${cls}[^>]*background-image:url\\('([^']+)'\\)`).exec(block)?.[1];
  const video = /tgme_widget_message_video_player/.test(block);
  if (video) {
    const thumb = bg("tgme_widget_message_video_thumb");
    if (!thumb) return undefined;
    const d = /message_video_duration[^>]*>(\d+):(\d{2})</.exec(block);
    const m = /\/([^/]+)\/(\d+)$/.exec(post);
    return {
      kind: "video",
      from: "tg",
      post,
      thumb,
      ...(m ? { embed: `https://t.me/${m[1]}/${m[2]}?embed=1&mode=tme` } : {}),
      ...(d ? { duration: Number(d[1]) * 60 + Number(d[2]) } : {}),
    };
  }
  const photo = bg("tgme_widget_message_photo_wrap");
  return photo ? { kind: "photo", from: "tg", post, thumb: photo } : undefined;
}

/* ------------------------------------------------------------------ *
 * Which cards may show it
 * ------------------------------------------------------------------ */

/** Words that say the post is footage of the event. */
const FOOTAGE = /شاهد|مشاهد|لحظة|لحظات|فيديو|بالفيديو|مصور|صور(?:ة)? (?:من|تظهر|توثق)|يوثق|توثق|footage|video (?:shows|of)|watch:|filmed|satellite (?:image|imagery)|صور الأقمار/i;
/** Words that say it is not: a meeting, a portrait, a studio, an archive. */
const NOT_FOOTAGE = /يستقبل|استقبل|يلتقي|التقى|لقاء|اجتماع|يترأس|ترأس|مؤتمر صحفي|أرشيف|ارشيفية|صورة أرشيفية|meets?\b|met with|meeting|received|receives|handshake|press conference|archive|file (?:photo|image)|portrait|condolence|تعزية|عزاء|نعي|mourn/i;
/** A map of the front from an OSINT account. */
const MAP = /خريطة|map of|frontline map|control map|situation map/i;
/** A speech that is itself the news. */
const SPEECH = /Houthi leader|Armed Forces spokesperson|Houthi spokesperson|كلمة|خطاب|بيان/i;

/** Could this card show its post's media? The still is looked at after. */
export function mediaCandidate(r: Pick<LiveReport, "type" | "summary" | "text">, postText: string): boolean {
  const t = `${r.summary}\n${r.text ?? ""}\n${postText}`;
  if (NOT_FOOTAGE.test(t)) return false;
  if (r.type === "strike" || r.type === "combat" || r.type === "vessel" || r.type === "port") return true;
  if (MAP.test(t)) return true;
  if ((r.type === "statement" || r.type === "diplomacy") && SPEECH.test(r.summary) && FOOTAGE.test(t)) return true;
  return FOOTAGE.test(postText);
}

/* ------------------------------------------------------------------ *
 * One look at the still
 * ------------------------------------------------------------------ */

export const VISION_KEY = "media-vision";
/** Looks a day, and a tick: the free quota is shared with the reader. */
const VISION_DAY = 40;
const VISION_TICK = 4;
/** Groq's Qwen sees pictures and has room to spare; Gemini's free flash is 20 a day, the reader's. */
const VISION_MODELS: { provider: "groq" | "gemini"; id: string }[] = [
  { provider: "groq", id: "qwen/qwen3.8-27b" },
  { provider: "gemini", id: "gemma-4-26b-a4b-it" },
  { provider: "gemini", id: "gemini-flash-latest" },
];

async function askGroq(model: string, prompt: string, mime: string, bytes: string): Promise<string> {
  const key = groqKey();
  if (!key) return "";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${mime};base64,${bytes}` } }] }],
    }),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return "";
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? "";
}

async function askGemini(model: string, prompt: string, mime: string, bytes: string): Promise<string> {
  const key = readerKey();
  if (!key) return "";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: bytes } }] }],
      generationConfig: { temperature: 0 },
    }),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return "";
  }
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  return (j.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
}

const KEEP = new Set(["launch", "strike", "interception", "ship", "battlefield", "damage", "satellite", "map", "speech"]);

const PROMPT = `You look at the still of a video or photo attached to a news post about the war in Yemen, and say what it shows.
Classes: launch (a missile or drone launch), strike (an explosion, impact or smoke at a place), interception (air defence, a missile shot down), ship (a ship attacked, burning or seized), battlefield (fighters at a position, captured ground, destroyed vehicles), damage (a damaged building or site), satellite (satellite imagery), map (a map of the front), speech (a leader or spokesman speaking to camera), portrait (a person posing or a headshot), meeting (officials meeting, handshakes, a conference), studio (a TV studio or presenter), logo (a logo, a text card, an infographic of text), crowd (a rally or funeral), other.
graphic: true if it shows bodies, blood, wounded people close up, or a prisoner's face.
Answer ONLY JSON {"class":"...","graphic":true|false}.`;

type VisionLog = { day: string; n: number };

/** The still, looked at by a free model: what it shows, and whether it is graphic. Null when no model answered. */
export async function lookAt(imageUrl: string, caption: string): Promise<{ cls: string; graphic: boolean } | null> {
  if (!groqKey() && !readerKey()) return null;
  let bytes: string;
  let mime = "image/jpeg";
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)" } });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    mime = res.headers.get("content-type")?.split(";")[0] || mime;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    bytes = Buffer.from(buf).toString("base64");
  } catch {
    return null;
  }
  const ask = `${PROMPT}
The post says: ${caption.slice(0, 400)}`;
  for (const model of VISION_MODELS) {
    try {
      const text = model.provider === "groq" ? await askGroq(model.id, ask, mime, bytes) : await askGemini(model.id, ask, mime, bytes);
      if (!text) continue;
      // The answer's last object: a model that thinks aloud writes others first.
      const objs = text.match(/\{[^{}]*\}/g) ?? [];
      const a = JSON.parse(objs[objs.length - 1] ?? "") as { class?: string; graphic?: boolean };
      return { cls: String(a.class ?? "other").toLowerCase(), graphic: a.graphic === true };
    } catch {
      // The next model.
    }
  }
  return null;
}

/** Does the look keep it? The in-classes, never graphic; a speech only on a speech card. */
export function keeps(look: { cls: string; graphic: boolean }, r: Pick<LiveReport, "type" | "summary">): boolean {
  if (look.graphic || !KEEP.has(look.cls)) return false;
  if (look.cls === "speech") return (r.type === "statement" || r.type === "diplomacy") && SPEECH.test(r.summary);
  return true;
}

/**
 * Give this tick's new cards their media: candidates by text and type, then
 * one look each, within the day's and the tick's allowance. A still already on
 * another card is not used twice.
 */
export async function attachMedia(
  store: DeskStore,
  cards: { r: LiveReport; media: Media; postText: string }[],
  usedThumbs: Set<string>,
  now = new Date(),
): Promise<number> {
  const day = now.toISOString().slice(0, 10);
  const log = (await store.getJson<VisionLog>(VISION_KEY)) ?? { day, n: 0 };
  if (log.day !== day) Object.assign(log, { day, n: 0 });
  let looked = 0;
  let given = 0;
  for (const c of cards) {
    if (c.r.media || usedThumbs.has(c.media.thumb) || !mediaCandidate(c.r, c.postText)) continue;
    if (looked >= VISION_TICK || log.n >= VISION_DAY) break;
    looked += 1;
    log.n += 1;
    const look = await lookAt(c.media.thumb, c.postText);
    if (!look || !keeps(look, c.r)) continue;
    c.r.media = c.media;
    usedThumbs.add(c.media.thumb);
    given += 1;
  }
  if (looked) await store.putJson(VISION_KEY, log);
  return given;
}
