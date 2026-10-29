/**
 * Headline-only cards made whole (user, 29 Oct: Reuters' investigation of Iran's 5,000-agency supply network and an
 * Al-Akhbar article went out as headlines: "make full reports from relevant articles and not just take the headline
 * … that's lazy and won't be accepted"). The server cannot open some articles (Reuters answers 401, Al-Akhbar shows
 * a bot check, which the desk never gets around); other outlets the site reads often tell the same article whole,
 * naming it. Every half hour, each card of the last 12 hours with an article's link and no body is looked for in
 * those reads (origin.ts `toldByOthers`); when one tells it, a model writes the body from that text, every figure
 * checked against it, and the card keeps its own outlet, link and headline. Server-only.
 */

import type { DeskId } from "../desks.ts";
import { isPostUrl } from "./full-text.ts";
import { askChain, WRITER_MODELS } from "./models.ts";
import { toldByOthers } from "./origin.ts";
import { figuresIn } from "./reader.ts";
import type { DeskStore } from "./store.ts";

const TRIED_KEY = "thin-cards-tried";
const EVERY_MS = 30 * 60_000;
const WITHIN_MS = 12 * 3600_000;
const TRIES = 4;
const PER_RUN = 6;

const SYSTEM = `You write the body of a news card. The card's outlet could not be opened; another outlet told the same article, citing it, and its text is below (in any language).
Write the body in English: every newsworthy fact of the article, in short paragraphs (2-6), most important first, from the text only. Never invent a place, number, name or claim; keep who said what. Write it as the cited outlet's report ("The investigation found …", "According to the report, …"), never as the relaying outlet's. Plain words, past tense for what happened.
Answer with JSON only: {"body":"…"} or {"body":""} when the text does not tell the card's story.`;

const lastRun: Partial<Record<DeskId, number>> = {};

/** Fill the bodies of today's headline-only cards. Safe to call every tick; runs every half hour. */
export async function fillThinCards(store: DeskStore, desk: DeskId, now = Date.now()): Promise<number> {
  if (!store.setBody || now - (lastRun[desk] ?? 0) < EVERY_MS / 3) return 0;
  lastRun[desk] = now;
  const tried = (await store.getJson<Record<string, { n: number; at: number }>>(`${TRIED_KEY}:${desk}`).catch(() => null)) ?? {};
  const { reports } = await store.recentDesk(400, undefined, { events: false, desk });
  const thin = (reports as { fp: string; url?: string; source?: string; summary?: string; text?: string; at?: string }[])
    .filter((r) => !String(r.text ?? "").trim() && /^https?:\/\//.test(String(r.url ?? "")) && !isPostUrl(String(r.url)) && now - Date.parse(String(r.at)) <= WITHIN_MS)
    .filter((r) => (tried[r.fp]?.n ?? 0) < TRIES && now - (tried[r.fp]?.at ?? 0) >= EVERY_MS)
    .slice(0, PER_RUN);
  let filled = 0;
  for (const r of thin) {
    tried[r.fp] = { n: (tried[r.fp]?.n ?? 0) + 1, at: now };
    const text = await toldByOthers(String(r.source), String(r.summary), String(r.url), Date.parse(String(r.at)));
    if (!text) continue;
    const answer = await askChain("thin-body", SYSTEM, `CARD: ${r.source}: ${r.summary}\n\nTEXT:\n${text.slice(0, 6000)}`, { models: WRITER_MODELS, timeoutMs: 60_000 });
    const body = String(answer?.json.body ?? "").trim();
    if (body.length < 120) continue;
    // Every figure from the text (reader.ts's own check).
    const have = figuresIn(text, true);
    const extra = [...figuresIn(body)].filter((n) => !have.has(n) && !figuresIn(String(r.summary), true).has(n));
    if (extra.length) {
      console.log(`[thin-cards] ${r.fp}: body refused, figures not in the text: ${extra.slice(0, 3).join(", ")}`);
      continue;
    }
    if (await store.setBody(r.fp, body)) {
      filled += 1;
      delete tried[r.fp];
      console.log(`[thin-cards] ${r.fp}: body written from another outlet's account (${body.length} chars)`);
    }
  }
  // Only the last day's tries are kept.
  for (const [fp, t] of Object.entries(tried)) if (now - t.at > 24 * 3600_000) delete tried[fp];
  await store.putJson(`${TRIED_KEY}:${desk}`, tried);
  return filled;
}
