/**
 * A picture or video on a card, from the X or Telegram post it was written
 * from. Server-only.
 *
 * A post having media is not a reason to show it. What goes in: launch
 * footage, strikes and impacts at a named place, interceptions, a ship hit or
 * burning, battlefield footage (a position taken, vehicles destroyed), damage
 * to a named site, satellite images and front-line maps from OSINT accounts.
 * What stays out: speeches and interviews, a video over a minute and a half (a
 * TV package, not the moment), logos and "breaking" cards, portraits, meetings
 * and handshakes, the wounded in hospital, file or
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

/** A post's pictures after the first, at most this many. */
const MAX_MORE = 9;

/** The first video of an X post (else its photos), as FxTwitter lists it. */
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
  const photos = all
    .filter((m) => m.type === "photo" && m.url)
    .map((p) => ({ thumb: String(p.url).replace(/\?name=orig$/, "?name=medium"), ...(p.width && p.height ? { w: p.width, h: p.height } : {}) }));
  if (!photos.length) return undefined;
  const [first, ...more] = photos;
  return { kind: "photo", from: "x", post, ...first, ...(more.length ? { more: more.slice(0, MAX_MORE) } : {}) };
}

/** The video (else the photos) of one post's block on a t.me/s page. */
export function tgMedia(block: string, post: string): Media | undefined {
  const bg = (cls: string) => new RegExp(`${cls}[^>]*background-image:url\\('([^']+)'\\)`).exec(block)?.[1];
  // Its shape: the box's width, and its height as a share of it ("width:624px;padding-top:67.3%").
  const shape = (width: RegExp, pad: RegExp) => {
    const w = Number(width.exec(block)?.[1]);
    const p = Number(pad.exec(block)?.[1]);
    return w > 0 && p > 0 ? { w, h: Math.round((w * p) / 100) } : {};
  };
  const video = /tgme_widget_message_video_player/.test(block);
  if (video) {
    const thumb = bg("tgme_widget_message_video_thumb");
    if (!thumb) return undefined;
    const d = /message_video_duration[^>]*>(\d+):(\d{2})</.exec(block);
    const m = /\/([^/]+)\/(\d+)$/.exec(post);
    // The file itself, when Telegram puts it on the page (not for a big video).
    const src = /<video[^>]*\ssrc="(https:\/\/[^"]+)"/.exec(block)?.[1]?.replace(/&amp;/g, "&");
    return {
      kind: "video",
      from: "tg",
      post,
      thumb,
      ...(src ? { src } : {}),
      ...(m ? { embed: `https://t.me/${m[1]}/${m[2]}?embed=1&mode=tme` } : {}),
      ...(d ? { duration: Number(d[1]) * 60 + Number(d[2]) } : {}),
      ...shape(/message_video_wrap"[^>]*width:(\d+)px/, /message_video_wrap"[^>]*padding-top:([\d.]+)%/),
    };
  }
  const photo = bg("tgme_widget_message_photo_wrap");
  if (!photo) return undefined;
  // An album: each picture in its own box, its shape given as width / height.
  if (/tgme_widget_message_grouped_wrap/.test(block)) {
    const photos = [...block.matchAll(/<a class="tgme_widget_message_photo_wrap[^"]*"[^>]*>/g)].flatMap((a) => {
      const thumb = /background-image:url\('([^']+)'\)/.exec(a[0])?.[1];
      const r = Number(/data-ratio="([\d.]+)"/.exec(a[0])?.[1]);
      return thumb ? [{ thumb, ...(r > 0 ? { w: 1000, h: Math.round(1000 / r) } : {}) }] : [];
    });
    if (photos.length > 1) {
      const [first, ...more] = photos;
      return { kind: "photo", from: "tg", post, ...first, more: more.slice(0, MAX_MORE) };
    }
  }
  return { kind: "photo", from: "tg", post, thumb: photo, ...shape(/message_photo_wrap[^>]*width:(\d+)px/, /message_photo"[^>]*padding-top:([\d.]+)%/) };
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
/** Footage is the moment itself: a longer video is a TV package or a talk. */
export const MAX_VIDEO_SECONDS = 90;
/** A card written about the footage itself may show a longer clip. */
const MAX_FOOTAGE_SECONDS = 240;

/**
 * A card whose news IS the picture: "Footage shows a failed Houthi Asif
 * launch", "Video: smoke over Jazan port", "Satellite images show …". Such a
 * card goes out with its footage or not at all — without it the reader is
 * told about a video he cannot see.
 */
const ABOUT_FOOTAGE =
  /^(?:(?:new |purported |unverified )?(?:footage|video|videos|images|photos|pictures|satellite (?:images?|imagery))\b)|\b(?:footage|video|videos|images|photos|pictures|satellite (?:images?|imagery)) (?:shows?|showing|appears? to show|purports? to show|of the|captures?|reveals?)\b|\bon (?:camera|video)\b|\bfilmed\b/i;
export function aboutFootage(r: Pick<LiveReport, "summary">): boolean {
  return ABOUT_FOOTAGE.test(String(r.summary || ""));
}

/** Too long to be the moment itself. */
export function tooLong(m: Pick<Media, "kind" | "duration">, footage = false): boolean {
  return m.kind === "video" && (m.duration ?? 0) > (footage ? MAX_FOOTAGE_SECONDS : MAX_VIDEO_SECONDS);
}

/** Could this card show its post's media? The still is looked at after. */
export function mediaCandidate(r: Pick<LiveReport, "type" | "summary" | "text">, postText: string): boolean {
  if (aboutFootage(r)) return true;
  const t = `${r.summary}\n${r.text ?? ""}\n${postText}`;
  if (NOT_FOOTAGE.test(t)) return false;
  if (r.type === "strike" || r.type === "combat" || r.type === "vessel" || r.type === "port") return true;
  if (MAP.test(t)) return true;
  // A speech, a statement or a meeting never shows its video.
  if (r.type === "statement" || r.type === "diplomacy") return false;
  return FOOTAGE.test(postText);
}

/* ------------------------------------------------------------------ *
 * One look at the still
 * ------------------------------------------------------------------ */

export const VISION_KEY = "media-vision";
/**
 * Looks a day, and a tick. Groq's Qwen, the first to look, allows about a
 * thousand calls a day on the free tier; the reader leans on it only when
 * Google's models are out, so a quarter of that is safe.
 */
const VISION_DAY = 250;
const VISION_TICK = 8;
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
    signal: AbortSignal.timeout(12_000),
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
    signal: AbortSignal.timeout(12_000),
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

const KEEP = new Set(["launch", "strike", "interception", "ship", "battlefield", "damage", "satellite", "map"]);

const PROMPT = `You look at the still of a video or photo attached to a news post about the war in Yemen, and say what it shows.
Classes: launch (a missile or drone launch), strike (an explosion, impact or smoke at a place), interception (air defence, a missile shot down), ship (a ship attacked, burning or seized), battlefield (fighters at a position, captured ground, destroyed vehicles), damage (a damaged building or site), satellite (satellite imagery), map (a map of the front), speech (a leader or spokesman speaking to camera), interview (someone talking to a reporter or a microphone, a witness), hospital (the wounded or patients in a hospital), portrait (a person posing or a headshot), meeting (officials meeting, handshakes, a conference), studio (a TV studio or presenter), logo (a logo, a text card, an infographic of text), crowd (a rally or funeral), other.
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

/** A still that is only a card, a studio or a headshot: never shown, whatever the text says. */
const NEVER = new Set(["logo", "studio", "portrait"]);

/**
 * Does the look keep it? The in-classes, never graphic. A card written about
 * the footage keeps any still that is not a text card, a studio or a
 * headshot: the man with the rifle in front of a failed launch is the story.
 */
export function keeps(look: { cls: string; graphic: boolean }, r?: Pick<LiveReport, "type" | "summary">): boolean {
  if (look.graphic) return false;
  if (r && aboutFootage(r)) return !NEVER.has(look.cls);
  return KEEP.has(look.cls);
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
  // The cards written about their footage are looked at first: without it they do not go out.
  const order = [...cards].sort((a, b) => Number(aboutFootage(b.r)) - Number(aboutFootage(a.r)));
  // The looks this tick, chosen first; then looked at four at a time (one by
  // one they took over a minute of a five-minute scan).
  const picked: typeof cards = [];
  const thumbs = new Set<string>();
  for (const c of order) {
    if (c.r.media || usedThumbs.has(c.media.thumb) || thumbs.has(c.media.thumb) || tooLong(c.media, aboutFootage(c.r)) || !mediaCandidate(c.r, c.postText)) continue;
    if (looked >= VISION_TICK || log.n >= VISION_DAY) break;
    looked += 1;
    log.n += 1;
    thumbs.add(c.media.thumb);
    picked.push(c);
  }
  for (let i = 0; i < picked.length; i += 4) {
    const batch = picked.slice(i, i + 4);
    const looks = await Promise.all(batch.map((c) => lookAt(c.media.thumb, c.postText)));
    batch.forEach((c, k) => {
      const look = looks[k];
      if (!look || !keeps(look, c.r) || usedThumbs.has(c.media.thumb)) return;
      c.r.media = c.media;
      usedThumbs.add(c.media.thumb);
      given += 1;
    });
  }
  if (looked) await store.putJson(VISION_KEY, log);
  return given;
}

/* ------------------------------------------------------------------ *
 * A warning that is a picture (UKMTO, JMIC)
 * ------------------------------------------------------------------ */

/** Gemini's lite model reads a warning card in seconds; Gemma, slower, when it is out. */
const NOTICE_MODELS: { provider: "groq" | "gemini"; id: string }[] = [
  { provider: "gemini", id: "gemini-3.1-flash-lite" },
  { provider: "gemini", id: "gemma-4-26b-a4b-it" },
];

const NOTICE_PROMPT = `This picture is a maritime security warning or advisory (UKMTO or JMIC). Copy out its text exactly, in plain lines, top to bottom: the title, number, dates, the whole message, and any position or place written on its map. Leave out the contact lines (email, phone numbers, website) and the logo.`;

/**
 * The words of a warning posted as a picture: UKMTO's X account posts each
 * warning as a card whose text is only in the image ("Click here to view the
 * full warning" is all the post says, and its site is behind Cloudflare). Null
 * when no model read it.
 */
export async function readNotice(imageUrl: string): Promise<string | null> {
  if (!readerKey()) return null;
  let bytes: string;
  let mime = "image/png";
  try {
    const res = await fetch(imageUrl.replace(/\?name=orig$/, "?name=medium"), { signal: AbortSignal.timeout(8000), headers: { "user-agent": "YemenDesk/2.0 (OSINT desk)" } });
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
  for (const model of NOTICE_MODELS) {
    try {
      const text = (await askGemini(model.id, NOTICE_PROMPT, mime, bytes)).trim();
      if (text.length > 40) return text.replace(/\n{2,}/g, "\n");
    } catch {
      // The next model.
    }
  }
  return null;
}
