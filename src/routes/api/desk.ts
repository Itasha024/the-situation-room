import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { deskParam } from "@/lib/desk/desk-route";
import { checkLinks } from "@/lib/desk/links";
import { type DeskId, deskById } from "@/lib/desks";
import { unglue } from "@/lib/desk/reader";
import { respell } from "@/lib/desk/spelling";
import { rightOffice } from "@/lib/desk/offices";
import { getStore } from "@/lib/desk/store";
import { iranLeanOfSource } from "@/lib/yemen-scan.server";
import { districtSeat, heardInside, iranEventAllowed, ownSkyOnly, seaPlace } from "@/lib/desk/iran-places";
import { countryPin, onePinPerEvent, servePins } from "@/lib/desk/yemen-pins";
import { houthiAttack, pinSideOf } from "@/lib/desk/dev-marks";

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
const STALE_MS = 30 * 60_000;
const memo = new Map<string, { at: number; body: string }>();
const reading = new Map<string, Promise<{ at: number; body: string }>>();

async function readDesk(limit: number, before: string | undefined, desk: DeskId, since?: string) {
  const store = await getStore();
  // `since`: the map's pins alone, back to that day — the whole war's map.
  const floor = deskById(desk).feedFrom;
  const slice = await store.recentDesk(limit, before, since ? { desk, since, reports: false } : { desk, floor });
  // Cards stored before the link rules keep their row; a link that
  // breaks the rules is just not shown (links.ts).
  checkLinks(slice.reports as never[], slice.reports as never[]);
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
  // The Iran map's own pins pass its scope as they are served, so a pin stored under older rules never shows.
  if (desk === "iran" && Array.isArray((slice as { events?: unknown[] }).events)) {
    const s = slice as unknown as { events: { desks?: string[]; actor?: string | null; place?: string | null; label?: string | null }[] };
    s.events = s.events.filter((e) => (e.desks ?? []).includes("yemen") || iranEventAllowed(e));
    // A pin on a place heard inside a longer one's name: a card's extra pin goes, its own pin moves to the longer place.
    s.events = s.events.flatMap((e) => {
      const host = (e.desks ?? []).includes("yemen") ? null : heardInside(e);
      if (!host) return [e];
      const x = e as typeof e & { fp?: string; lat?: number; lng?: number };
      return String(x.fp ?? "").includes("-pin-") ? [] : [{ ...x, place: host.name, lat: host.lat, lng: host.lng }];
    });
    // A pin on a district's seat moves to the village its label names.
    s.events = s.events.map((e) => {
      if ((e.desks ?? []).includes("yemen")) return e;
      const v = districtSeat(e);
      return v ? { ...e, place: v.name, lat: v.lat, lng: v.lng } : e;
    });
    // Iran's own air defence and alarms, with no attacker named: side not stated.
    s.events = s.events.map((e) => (ownSkyOnly(e) ? { ...e, actor: "unclear" } : e));
    // "Hostile artillery fire targeted…": the Lebanese outlets' word for Israel's fire in Lebanon (17 Oct).
    s.events = s.events.map((e) => {
      const x = e as typeof e & { lat?: number; lng?: number };
      const inLebanon = typeof x.lat === "number" && typeof x.lng === "number" && x.lat > 33.03 && x.lat < 34.7 && x.lng > 35.1 && x.lng < 36.65;
      return inLebanon && (!e.actor || e.actor === "unclear") && /\b(?:hostile|enemy)\b/i.test(String(e.label ?? "")) ? { ...e, actor: "israel" } : e;
    });
    // At sea or on land, a sea pin in its sea and off the land: the researched pins' rule.
    s.events = s.events.map((e) => {
      const x = e as typeof e & { lat?: number; lng?: number; type?: string | null };
      if ((e.desks ?? []).includes("yemen") || typeof x.lat !== "number" || typeof x.lng !== "number") return e;
      const w = seaPlace({ ...x, lat: x.lat, lng: x.lng });
      return { ...e, lat: w.lat, lng: w.lng, sea: w.sea };
    });
    // No pin on a whole country's centre, and one pin per event (yemen-pins.ts).
    s.events = onePinPerEvent(s.events.filter((e) => !countryPin(e)) as Parameters<typeof onePinPerEvent>[0]) as typeof s.events;
  }
  // The Yemen map's pins: on the district a report names, one per event, no analysis or visits (yemen-pins.ts).
  if (desk === "yemen" && Array.isArray((slice as { events?: unknown[] }).events)) {
    const s = slice as unknown as { events: Parameters<typeof servePins>[0] };
    s.events = servePins(s.events);
    // Who acted, for the pin's colour (user, 17 Oct); "unclear" when the report does not say.
    s.events = s.events.map((e) => {
      const x = e as typeof e & { actor?: string | null; type?: string | null; label?: string | null; text?: string | null; place?: string | null };
      if (houthiAttack(x)) return { ...e, actor: "houthi" };
      return x.actor && x.actor !== "unclear" ? e : { ...e, actor: pinSideOf(x) ?? "unclear" };
    });
  }
  return { at: Date.now(), body: JSON.stringify({ ok: true, store: store.kind, ...slice }) };
}

function renew(key: string, limit: number, before: string | undefined, desk: DeskId, since?: string) {
  let p = reading.get(key);
  if (!p) {
    p = readDesk(limit, before, desk, since)
      .then((hit) => {
        if (memo.size > 20) memo.clear();
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
          else if (age > MEMO_MS) renew(key, limit, before, desk, since).catch(() => {});

          return raw(
            hit.body,
            // New cards reach the page through /api/scan within minutes; this
            // is the archive behind them, so the edge keeps it five minutes.
            {
              "cache-control": "public, max-age=30",
              "cdn-cache-control": "public, s-maxage=60, stale-while-revalidate=600",
            },
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
