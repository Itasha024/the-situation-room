/**
 * The site's scan (Round 30 stage 4b-2). Server-only.
 *
 * The site reads its sources, not a desk (user, 8 Oct). One scan reads every
 * source of every desk, each once, and hands each item to the desks it is
 * about, through each desk's inbox:
 *
 *   - the sources first read for Yemen (yemen-scan's fetchYemenSources) →
 *     the Yemen inbox; every one of their items about the war with Iran
 *     (the Iran gate) goes on to the Iran inbox once the Yemen reader has
 *     read them, so one post is not written up on both desks;
 *   - the sources added with the Iran desk (iran-scan's scanIranSources),
 *     through the Iran desk's own gate → the Iran inbox; what of theirs names
 *     Yemen's war → the Yemen inbox (user, 9 Oct: "make the sources belong
 *     to the site and not to the desk").
 *
 * Each desk's reader then reads only its inbox: the Yemen reader straight
 * after the scan, in the same 5-minute cycle (so Yemen's cards come no later
 * than before); the Iran reader on its own clock, 2½ minutes later.
 *
 * A third desk is its sources, its gate and its reader: its sources join this
 * scan, its items go to its inbox, its reader reads that.
 *
 * The switch (`site-scan-mode` in the store, so it moves without a deploy):
 *   off    — the old path: each desk's cycle reads its own sources.
 *   shadow — the old path, and each Yemen read also goes through the inbox
 *            on the side, to check the reader would get the same items.
 *   on     — this scan.
 */
import { getStore } from "./desk/store.ts";
import type { ScanPayload, ScanState, SourceStatus } from "./desk/types.ts";
import { scanIranSources } from "./iran-scan.server.ts";
import { type RawHit, type TickResult, type YemenFetch, fetchYemenSources, readYemen, runScanCycle, yemenCandidates } from "./yemen-scan.server.ts";

export type SiteMode = "off" | "shadow" | "on";
export const SITE_MODE_KEY = "site-scan-mode";
export const YEMEN_INBOX = "yemen-inbox";
const SHADOW_INBOX = "yemen-inbox-test";
export const SHADOW_LOG_KEY = "site-scan-shadow";

type Store = Awaited<ReturnType<typeof getStore>>;

export async function siteMode(store?: Store): Promise<SiteMode> {
  try {
    const m = (await (store ?? (await getStore())).getJson<{ mode?: string }>(SITE_MODE_KEY))?.mode;
    return m === "on" || m === "shadow" ? m : "off";
  } catch {
    return "off";
  }
}

/** The 5-minute cycle: the scan, then the Yemen reader (tick.ts). */
export async function runSiteCycle(): Promise<TickResult> {
  const mode = await siteMode();
  if (mode === "on") return runScanCycle(scanThenReadYemen);
  if (mode === "shadow") return runScanCycle(shadowCycle);
  return runScanCycle();
}

/**
 * Reads of the Yemen sources left in the inbox, as one. Normally there is one,
 * this cycle's; a read whose reader failed leaves its items for the next.
 */
export function mergeFetches(rows: YemenFetch[]): YemenFetch | null {
  // A row of another desk's sources' items (`extra`) brings its items only: the cycle's time and status are the Yemen read's.
  const main = rows.filter((r) => !r.extra);
  if (!main.length) return null;
  const sorted = [...main, ...rows.filter((r) => r.extra)].sort((a, b) => a.at - b.at);
  const last = [...main].sort((a, b) => a.at - b.at)[main.length - 1];
  const hits = new Map<string, RawHit>();
  const status = new Map<string, SourceStatus>();
  const shared = new Map<string, RawHit>();
  for (const r of sorted) {
    for (const h of r.hits) hits.set(h.url, h);
    for (const st of r.status) status.set(st.id, st);
    for (const h of r.iranShared) shared.set(h.url, h);
  }
  return { ...last, extra: undefined, hits: [...hits.values()], status: [...status.values()], iranShared: [...shared.values()] };
}

async function scanThenReadYemen(state: ScanState, prev: ScanPayload | null): Promise<ScanPayload> {
  const store = await getStore();
  // The Iran desk's own sources are read beside Yemen's; Yemen's reader never waits for them.
  // What of theirs is on Yemen's war joins the Yemen inbox, read by the next cycle's Yemen reader.
  const iran = scanIranSources(store, Date.now())
    .then(async ({ n, yemen }) => {
      if (yemen.length) await store.putMany(YEMEN_INBOX, { [`iran-${Date.now()}`]: { at: Date.now(), hits: yemen, status: [], sourcesOk: 0, learnedIds: [], iranShared: [], extra: true } satisfies YemenFetch });
      console.log(`[site] Iran sources: ${n} item(s) to the Iran inbox, ${yemen.length} to the Yemen inbox`);
    })
    .catch((err) => console.error("[site] Iran sources:", err instanceof Error ? err.message : err));
  const got = await fetchYemenSources(state, prev);
  let mine: YemenFetch = got;
  try {
    await store.putMany(YEMEN_INBOX, { [String(got.at)]: got });
    mine = mergeFetches(await store.takeMany<YemenFetch>(YEMEN_INBOX)) ?? got;
  } catch (err) {
    // The inbox unwritable: this cycle's read goes to the reader by hand.
    console.error("[site] Yemen inbox:", err instanceof Error ? err.message : err);
  }
  try {
    return await readYemen(state, prev, mine);
  } finally {
    await iran;
  }
}

/** One item as the reader gets it: what a difference between two paths would show. */
const itemKey = (c: { url: string; fp: string; text: string; at: string; lean?: string; score: number; tags?: string[] }) =>
  [c.url, c.fp, c.text, c.at, c.lean ?? "", c.score, (c.tags ?? []).join(",")].join("\u0001");

export type ShadowCheck = { at: string; hits: number; candidates: number; sameHits: boolean; sameCandidates: boolean; missing: string[]; extra: string[]; kb: number; ms: number };

/** Two reads of the Yemen sources, compared as the Yemen reader would get them. */
export function compareFetches(direct: YemenFetch, viaInbox: YemenFetch | null): Omit<ShadowCheck, "at" | "kb" | "ms"> {
  const a = yemenCandidates(direct.hits, direct.status).candidates;
  const b = viaInbox ? yemenCandidates(viaInbox.hits, viaInbox.status).candidates : [];
  const ka = new Set(a.map(itemKey));
  const kb = new Set(b.map(itemKey));
  const hitKey = (h: RawHit) => `${h.url}\u0001${h.text}\u0001${h.at}\u0001${h.source}\u0001${h.lean ?? ""}\u0001${!!h.picked}`;
  const ha = direct.hits.map(hitKey).sort();
  const hb = (viaInbox?.hits ?? []).map(hitKey).sort();
  return {
    hits: direct.hits.length,
    candidates: a.length,
    sameHits: ha.length === hb.length && ha.every((k, i) => k === hb[i]),
    sameCandidates: ka.size === kb.size && [...ka].every((k) => kb.has(k)),
    missing: a.filter((c) => !kb.has(itemKey(c))).map((c) => c.url).slice(0, 10),
    extra: b.filter((c) => !ka.has(itemKey(c))).map((c) => c.url).slice(0, 10),
  };
}

/**
 * The old path stays live; this cycle's read also goes through a test inbox,
 * and what the reader would get each way is compared and logged.
 */
async function shadowCycle(state: ScanState, prev: ScanPayload | null): Promise<ScanPayload> {
  const got = await fetchYemenSources(state, prev);
  try {
    const store = await getStore();
    const t0 = Date.now();
    await store.putMany(SHADOW_INBOX, { [String(got.at)]: got });
    const back = (await store.takeMany<YemenFetch>(SHADOW_INBOX)).find((r) => r.at === got.at) ?? null;
    const check: ShadowCheck = { at: new Date(got.at).toISOString(), ...compareFetches(got, back), kb: Math.round(JSON.stringify(got).length / 1024), ms: Date.now() - t0 };
    console.log(`[site] shadow: ${check.hits} items, ${check.candidates} to the reader, ${check.sameHits && check.sameCandidates ? "the same through the inbox" : `DIFFERENT (missing ${check.missing.length}, extra ${check.extra.length})`}, ${check.kb} KB`);
    const log = (await store.getJson<ShadowCheck[]>(SHADOW_LOG_KEY)) ?? [];
    await store.putJson(SHADOW_LOG_KEY, [check, ...log].slice(0, 48));
  } catch (err) {
    console.error("[site] shadow:", err instanceof Error ? err.message : err);
  }
  return readYemen(state, prev, got);
}
