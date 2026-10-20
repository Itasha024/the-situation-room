import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { deskParam } from "@/lib/desk/desk-route";
import { checkLinks } from "@/lib/desk/links";
import { type DeskId, deskById } from "@/lib/desks";
import { unglue } from "@/lib/desk/reader";
import { respell } from "@/lib/desk/spelling";
import { rightOffice } from "@/lib/desk/offices";
import { getStore } from "@/lib/desk/store";
import { gzipped, respond } from "@/lib/desk/microcache";
import { iranLeanOfSource } from "@/lib/yemen-scan.server";
import { houthiAttack, pinSideOf } from "@/lib/desk/dev-marks";
import { cardsOnTheirPins, serveIranPins, serveYemenPins } from "@/lib/desk/serve-map-pins";
import { exclusivesOut, idOrderTimes, postTimes, serveCard } from "@/lib/desk/copy-rules";
import { type Card as SameCard, foldServed } from "@/lib/desk/fold-same";

/**
 * The accumulated desk — every report the clock has collected, newest first.
 *
 * WHY THIS EXISTS
 * ---------------
 * The page used to build its feed from two things: `data.json`, baked at build
 * time, and `/api/scan`, which returns only the LAST scan cycle. Deployed, that
 * made the feed a rolling snapshot rather than a stream — the tick dutifully
 * wrote every report into `desk_report`, nothing ever read them back, and a
 * report that scrolled out of a Telegram channel's recent window vanished from
 * the public desk while still sitting in the database.
 *
 * This is the read that fixes it. `/api/scan` keeps its job (what the last
 * cycle saw, plus scanner health for the live scan box); this serves the feed
 * itself.
 *
 * A READ, never a scan — a page view must never trigger outbound fetches.
 */
/**
 * The edge asks each region's copy anew; one instance serves several regions.
 * The same answer is kept here: a minute fresh, and after that still served at
 * once while a new one is read behind it, so a visitor never waits on the
 * database (a miss took over two seconds).
 */
const MEMO_MS = 60_000;
const PINS_MEMO_MS = 4 * 60_000;
const STALE_MS = 30 * 60_000;
const memo = new Map<string, { at: number; body: string; gz?: Uint8Array }>();
const reading = new Map<string, Promise<{ at: number; body: string }>>();

async function readDesk(limit: number, before: string | undefined, desk: DeskId, since?: string) {
  const store = await getStore();
  // `since`: the map's pins alone, back to that day — the whole war's map.
  const floor = deskById(desk).feedFrom;
  const slice = await store.recentDesk(limit, before, since ? { desk, since, reports: false } : { desk, floor });
  // Cards stored before the link rules keep their row; a link that
  // breaks the rules is just not shown (links.ts).
  checkLinks(slice.reports as never[], slice.reports as never[]);
  // The review of 18 Oct's rules on stored cards (copy-rules.ts): not news, Iran's home affairs and
  // the other desk's cards are not shown here; Houthi and partisan words, offices and types are fixed.
  if (!since) slice.reports = (slice.reports as Record<string, unknown>[]).filter((r) => serveCard(r, desk)) as typeof slice.reports;
  // A word a model glued to a name is shown split, and a name in the
  // desk's one spelling; the row is left as it is.
  for (const r of slice.reports) {
    r.summary = rightOffice(respell(unglue(String(r.summary ?? ""))));
    if (r.text) r.text = rightOffice(respell(String(r.text)));
    // The Iran desk's filter buttons go by the source's group.
    if (desk === "iran") (r as Record<string, unknown>).lean = iranLeanOfSource(String(r.source ?? ""));
    // Who acted, for its map pin's colour (user, 17 Oct): the Yemen map draws its pins from the cards.
    if (desk === "yemen") {
      const x = { type: String(r.type ?? ""), label: String(r.summary ?? ""), text: String(r.text ?? ""), source: String(r.source ?? ""), place: String(r.place ?? "") };
      const a = r.actor as string | null | undefined;
      // An alert, an interception or an attack in Saudi Arabia is the Houthis' whatever was stored (17 Oct).
      (r as Record<string, unknown>).actor = houthiAttack(x) ? "houthi" : a && a !== "unclear" ? a : pinSideOf(x) ?? "unclear";
    }
  }
  // One event, one card (fold-same.ts): copies stored before the rules fold into their card as
  // the desk is read, the way the pins' rules apply; the rows stay as they are.
  // A card's time against its lead's own (copy-rules.ts, Round 4 of 20 Oct): a late post that took over
  // another story's card is split off at its own time, old news relayed late is shown at its post's time,
  // and a numbered article timed before the one numbered below it takes that one's time.
  if (!since && slice.reports.length) {
    slice.reports = exclusivesOut(idOrderTimes(postTimes(slice.reports as Record<string, unknown>[]))) as typeof slice.reports;
  }
  if (slice.reports.length) {
    slice.reports = foldServed(slice.reports as unknown as SameCard[]).reports as unknown as typeof slice.reports;
  }
  // The Iran map's own pins pass its scope as they are served, so a pin stored under older rules never shows.
  // The Iran map's own pins pass its scope as they are served (serve-map-pins.ts).
  if (desk === "iran" && Array.isArray((slice as { events?: unknown[] }).events)) {
    const s = slice as unknown as { events: Parameters<typeof serveIranPins>[0] };
    s.events = serveIranPins(s.events);
    // A card shows the place its pin is served on (20 Oct: "Oil tanker hit by projectile near Jubail, Saudi Arabia" was
    // stored at Byblos, Lebanon's Jbeil; its pin moves to Jubail as it is served, the card kept saying Byblos).
    cardsOnTheirPins(slice.reports as Record<string, unknown>[], s.events);
  }
  // The Yemen map's pins: on the place a report names, one per event, no analysis or visits (serve-map-pins.ts).
  if (desk === "yemen" && Array.isArray((slice as { events?: unknown[] }).events)) {
    const s = slice as unknown as { events: Parameters<typeof serveYemenPins>[0] };
    const stored = s.events;
    s.events = serveYemenPins(stored);
    // The page also draws a pin from each card with a place: a card whose pin was folded into another
    // event's, or is no event, is drawn by none; the rest take their pin's place and side. Only cards
    // as late as the pins read here are judged; older ones are judged when their own day is read.
    type Served = { fp?: string; lat?: number; lng?: number; place?: string | null; actor?: string | null; twins?: string[] };
    const kept = new Map((s.events as Served[]).map((e) => [String(e.fp ?? ""), e]));
    const headOf = new Map<string, string>();
    for (const e of s.events as Served[]) for (const t of e.twins ?? []) headOf.set(t, String(e.fp));
    const oldest = stored.reduce((m, e) => Math.min(m, Date.parse(String((e as { at?: string }).at)) || Infinity), Infinity);
    for (const r of slice.reports as Record<string, unknown>[]) {
      if (typeof r.lat !== "number" || !(Date.parse(String(r.at)) >= oldest)) continue;
      const k = kept.get(String(r.fp));
      if (!k) {
        r.noMap = true;
        // "Show on map" on a card told by others too opens the one pin of their event.
        const head = headOf.get(String(r.fp));
        if (head) r.pinFp = head;
        continue;
      }
      if (typeof k.lat === "number") Object.assign(r, { lat: k.lat, lng: k.lng, place: k.place ?? r.place });
      if (k.actor) r.actor = k.actor;
    }
  }
  const body = JSON.stringify({ ok: true, store: store.kind, ...slice });
  // Gzipped once here for the edge, which asks for gzip (microcache.ts).
  return { at: Date.now(), body, gz: await gzipped(body) };
}

function renew(key: string, limit: number, before: string | undefined, desk: DeskId, since?: string) {
  let p = reading.get(key);
  if (!p) {
    p = readDesk(limit, before, desk, since)
      .then((hit) => {
        // The oldest answer goes, never all of them: a reader paging back (?before=) once cleared the
        // desks' main answers too, and the next visitors waited on a rebuild (20 Oct).
        memo.delete(key);
        if (memo.size >= 20) memo.delete(memo.keys().next().value as string);
        memo.set(key, hit);
        return hit;
      })
      .finally(() => reading.delete(key));
    reading.set(key, p);
  }
  return p;
}

export const Route = createFileRoute("/api/desk")({
  server: {
    handlers: {
      GET: ({ request }) => metered("desk", async () => {
        try {
          const url = new URL(request.url);
          const asked = Number(url.searchParams.get("limit") || NaN);
          // Bounded so a crafted query cannot ask the desk to serialise the
          // entire archive on every request.
          // The map's pins since a day (?since=YYYY-MM-DD): the whole war, no
          // cards. Pins are small; the bound only stops a runaway.
          const sinceDay = url.searchParams.get("since") || "";
          const since = /^\d{4}-\d{2}-\d{2}$/.test(sinceDay) ? `${sinceDay}T00:00:00+03:00` : undefined;
          const cap = since ? 20_000 : 1000;
          const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), cap) : since ? cap : 400;

          // Paging back: rows strictly older than this ISO time.
          const before = url.searchParams.get("before") || undefined;

          // Which desk's cards (Round 30); none asked is Yemen's, as before.
          const desk = deskParam(url.searchParams.get("desk"));

          const key = `${desk}|${limit}|${before ?? ""}|${since ?? ""}`;
          let hit = memo.get(key);
          const age = hit ? Date.now() - hit.at : Infinity;
          if (!hit || age > STALE_MS) hit = await renew(key, limit, before, desk, since);
          // The whole war's pins (?since=) are the heaviest answer and change only with a scan (every 5 minutes).
          else if (age > (since ? PINS_MEMO_MS : MEMO_MS)) renew(key, limit, before, desk, since).catch(() => {});

          return respond(
            {
              ...hit,
              status: 200,
              // New cards reach the page through /api/scan within minutes; this
              // is the archive behind them, so the edge keeps it a minute (the war's pins four).
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "public, max-age=30",
                "cdn-cache-control": `public, s-maxage=${since ? 240 : 60}, stale-while-revalidate=86400`,
              },
            },
            request.headers.get("accept-encoding"),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "desk read failed";
          // Reported, not swallowed. A feed that silently serves nothing is the
          // exact failure this endpoint exists to end.
          return json({ ok: false, error: message, reports: [], events: [] }, {}, 500);
        }
      }),
    },
  },
});

function json(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return raw(JSON.stringify(body), headers, status);
}

function raw(body: string, headers: Record<string, string> = {}, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
