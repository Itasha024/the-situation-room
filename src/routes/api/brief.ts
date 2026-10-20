import { createFileRoute } from "@tanstack/react-router";
import type { Brief } from "@/lib/desk/brief";
import { briefWindow } from "@/lib/desk/brief";
import { refreshBrief } from "@/lib/desk/brief-store";
import { IRAN_BRIEF_KEY, type IranBrief } from "@/lib/desk/iran-brief";
import { IRAN_NOW_KEY, type IranTimelineNow } from "@/lib/desk/iran-timeline-now";
import { liveSanctionBoxes, OFAC_KEY, type OfacStore } from "@/lib/desk/ofac";
import { type Box, IRAN_LIVE_KEY, type IranLive, liveNumbers } from "@/lib/desk/iran-live";
import IRAN_NUMBERS from "../../../public/iran-numbers.json" with { type: "json" };
import { metered } from "@/lib/desk/cpu-meter";
import { cachedResponse } from "@/lib/desk/microcache";
import { deskParam } from "@/lib/desk/desk-route";
import { deskById } from "@/lib/desks";
import { getStore } from "@/lib/desk/store";
import { mergeNumbers } from "@/lib/desk/numbers";
import { band, dropEmpty } from "@/lib/desk/rank-points";
import { officeTitles } from "@/lib/desk/copy-rules";
import { type Claims, readClaims, readTally, type Tally } from "@/lib/desk/tally";
import { type Ledger, readLedger, readTransits, type Transits } from "@/lib/desk/ledger";
import { TIMELINE_NOW_KEY, type TimelineNow } from "@/lib/desk/timeline-now";
import { CONTROL_LIVE_KEY, type ControlLive } from "@/lib/desk/control-live";

/**
 * The 6-hour brief: the general status, the fronts and the numbers.
 *
 * The clock builds it (see `refreshBrief`, called from every tick), so it moves
 * whether or not anyone has the page open. This route only reads it — and
 * builds it itself only if the clock has not reached the new window yet, so a
 * visitor never sees last window's brief labelled as current.
 */
export const Route = createFileRoute("/api/brief")({
  server: {
    handlers: {
      GET: ({ request }) => metered("brief", async () => {
        const desk = deskParam(new URL(request.url).searchParams.get("desk"));
        // Built once per 30 seconds, not per visitor (20 Oct, microcache.ts): the brief changes with a
        // tick or a 6-hour window, and each read was a handful of database reads and the points' rules.
        return cachedResponse(`brief|${desk}`, 30_000, 30 * 60_000, async () => {
          const res = await briefAnswer(desk);
          return { status: res.status, body: await res.text(), headers: Object.fromEntries(res.headers) };
        }, request.headers.get("accept-encoding"));
      }),
    },
  },
});

async function briefAnswer(desk: ReturnType<typeof deskParam>): Promise<Response> {
        try {
          // The Iran desk's brief is built from stage 4 of Round 30; until then it has none.
          if (desk !== "yemen") {
            const st = desk === "iran" ? await getStore() : null;
            const ib = st ? await st.getJson<IranBrief>(IRAN_BRIEF_KEY) : null;
            // The Timeline's Now box rides with the brief, as on the Yemen desk.
            // The US sanctions boxes as OFAC's own list stands (ofac.ts), over the researched file.
            const sanctions = st ? liveSanctionBoxes(IRAN_NUMBERS as Parameters<typeof liveSanctionBoxes>[0], await st.getJson<OfacStore>(OFAC_KEY).catch(() => null)) : null;
            // Every other box its reader has made (iran-live.ts), the sanctions boxes among them.
            const numbers = st ? liveNumbers(await st.getJson<IranLive>(IRAN_LIVE_KEY).catch(() => null), (sanctions?.boxes ?? []) as unknown as Box[]) : null;
            if (ib) return json({ ...ib, situation: banded(ib.situation), arenas: servedLists(ib.arenas), timelineNow: (await st!.getJson<IranTimelineNow>(IRAN_NOW_KEY)) ?? null, sanctions, numbers }, 200, "public, max-age=60", "public, s-maxage=120, stale-while-revalidate=86400");
            return json({ ok: true, desk, pending: true, ...briefWindow(new Date(), deskById(desk).cadenceHours) }, 200, "public, max-age=60", "public, s-maxage=300");
          }
          const store = await getStore();
          const { brief } = await refreshBrief(store);
          const timelineNow = (await store.getJson<TimelineNow>(TIMELINE_NOW_KEY)) ?? null;
          const live = (await store.getJson<ControlLive>(CONTROL_LIVE_KEY)) ?? null;
          // The changes let a past day on the map undo what came after it.
          const controlLive = live ? { districts: live.districts, changes: (live.changes ?? []).map((c) => ({ at: c.at, district: c.district, from: c.from, to: c.to })), asOf: live.asOf } : null;
          return ok(brief, await readTally(store), await readClaims(store), timelineNow, controlLive, await readLedger(store), await readTransits(store));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "brief failed";
          return json({ ok: false, error: msg, ...briefWindow() }, 500);
        }
}

function ok(brief: Brief, tally: Tally, claims: Claims, timelineNow: TimelineNow | null, controlLive: (Pick<ControlLive, "districts" | "asOf"> & { changes: Pick<ControlLive["changes"][number], "at" | "district" | "from" | "to">[] }) | null, ledger: Ledger, transits: Transits | null) {
  const secondsLeft = Math.max(60, Math.round((Date.parse(brief.nextUpdateAt) - Date.now()) / 1000));
  const age = Math.min(secondsLeft, 600);
  // The edge holds it until the window turns (at most ten minutes), so visitors
  // never each cost a function call and a database read. A browser keeps it one
  // minute only: the page asks again every ten, and a brief rebuilt inside a
  // window (district control, a rewrite) must reach an open page without a
  // reload — held for half an hour, it did not.
  return json({ ...brief, situation: banded(brief.situation), fronts: servedLists(brief.fronts), tally, claims, figures: mergeNumbers(tally, claims), timelineNow, controlLive, ledger, transits }, 200, "public, max-age=60", `public, s-maxage=${age}, stale-while-revalidate=86400`);
}

/** Each point's importance band (rank-points.ts), so the home page can rank both desks' points as one list. */
function banded<T>(s: T): T {
  const pts = (s as { points?: unknown } | null | undefined)?.points;
  if (!Array.isArray(pts)) return s;
  const points = servedPoints(pts.map(String));
  return { ...s, points, bands: points.map((p) => band(p)) };
}

/**
 * A stored brief's points as served (user, 18 Oct): a point with no new fact
 * goes when one with a fact is there, and a speaker a reader does not know
 * is named by role. The stored brief is left as it is.
 */
function servedPoints(points: string[]): string[] {
  return dropEmpty(points).map((p) => officeTitles(p));
}

/** Every list of points in a brief (the arenas', the fronts'), served the same way. */
function servedLists<T extends { points?: string[] }>(list: T[] | undefined): T[] | undefined {
  return Array.isArray(list) ? list.map((a) => (Array.isArray(a.points) ? { ...a, points: servedPoints(a.points) } : a)) : list;
}

function json(body: unknown, status = 200, cache = "no-store", cdn?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, ...(cdn ? { "cdn-cache-control": cdn } : {}) },
  });
}
