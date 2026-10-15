import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";
import { getStore, type DeskStore } from "@/lib/desk/store";
import { serveSlice } from "@/lib/desk/serve";
import { facetsOf, storyKey } from "@/lib/desk/facets";
import { BRIEF_KEY, type StoredBrief } from "@/lib/desk/brief-store";
import { IRAN_BRIEF_KEY, type IranBrief } from "@/lib/desk/iran-brief";
import { deskById, type DeskId } from "@/lib/desks";
import { focusById, warDeskById } from "@/lib/region";

/**
 * The main desk (option C): both desks' cards and pins as one wire, each
 * tagged with its place, the countries it is about, its desks and its kind.
 * The same story written by both desks is served once, with both desks.
 *
 *   /api/region                     the whole region
 *   /api/region?focus=lebanon       one country or sea
 *   /api/region?desk=yemen          one desk (war)
 *   &limit=400&before=<ISO>         paging back
 *   /api/region?pins=2026-07-13     the map's pins alone back to a day, as
 *                                   short rows, for the replay strip
 *
 * A read, never a scan, and never a brief build: the desks' saved briefs are
 * served as they are.
 */
const MEMO_MS = 60_000;
const STALE_MS = 30 * 60_000;
const memo = new Map<string, { at: number; body: string }>();
const reading = new Map<string, Promise<{ at: number; body: string }>>();

type Row = Record<string, unknown>;

/** The fields the page uses; the rest of a row stays in the store. */
const KEEP = ["fp", "at", "source", "url", "type", "summary", "text", "place", "lat", "lng", "tier", "alsoReportedBy", "replyTo", "flags", "media", "lean", "exclusive"];

function slim(r: Row): Row {
  const o: Row = {};
  for (const k of KEEP) if (r[k] !== undefined && r[k] !== null && r[k] !== "") o[k] = r[k];
  return o;
}

async function briefs(store: DeskStore) {
  const out: Record<string, unknown> = {};
  const y = await store.getJson<StoredBrief>(BRIEF_KEY).catch(() => null);
  if (y?.brief) {
    const b = y.brief;
    out.yemen = {
      updatedAt: b.updatedAt,
      line: b.situation?.line ?? "",
      points: b.situation?.points ?? [],
      refs: b.situation?.refs ?? [],
      sections: (b.fronts ?? []).filter((f) => Array.isArray((f as { points?: unknown[] }).points) && (f as { points: unknown[] }).points.length)
        .map((f) => ({ id: f.id, name: f.name, points: (f as { points?: string[] }).points ?? [], refs: (f as { refs?: unknown[] }).refs ?? [] })),
    };
  }
  const i = await store.getJson<IranBrief>(IRAN_BRIEF_KEY).catch(() => null);
  if (i) {
    out.iran = {
      updatedAt: i.updatedAt,
      line: i.situation?.line ?? "",
      points: i.situation?.points ?? [],
      refs: i.situation?.refs ?? [],
      sections: (i.arenas ?? []).filter((a) => a.points?.length).map((a) => ({ id: (a as { id?: string }).id ?? a.name, name: a.name, points: a.points, refs: a.refs ?? [] })),
    };
  }
  return out;
}

async function readRegion(limit: number, before: string | undefined, focus: string | null, desk: string | null) {
  const store = await getStore();
  const byStory = new Map<string, Row>();
  const pins: Row[] = [];
  const seenPin = new Set<string>();
  for (const id of ["yemen", "iran"] as DeskId[]) {
    // One country or desk: read deeper, so a quieter place still fills its page.
    const depth = focus || desk ? Math.min(1000, limit * 3) : limit;
    const slice = serveSlice(await store.recentDesk(depth, before, { desk: id, floor: deskById(id).feedFrom }), id);
    for (const r of slice.reports as Row[]) {
      const key = storyKey(r.fp);
      const f = facetsOf(r, id);
      const had = byStory.get(key);
      if (had) {
        // The same story on both desks: one card, every desk and country it has.
        had.desks = [...new Set([...(had.desks as string[]), ...f.desks])];
        had.countries = [...new Set([...(had.countries as string[]), ...f.countries])];
        continue;
      }
      byStory.set(key, { ...slim(r), countries: f.countries, desks: f.desks, cat: f.category, where: f.where });
    }
    for (const e of slice.events as unknown as Row[]) {
      const k = `${storyKey(e.fp)}|${e.lat}|${e.lng}`;
      if (seenPin.has(k) || typeof e.lat !== "number") continue;
      seenPin.add(k);
      const f = facetsOf({ summary: e.label, place: e.place, lat: e.lat, lng: e.lng, type: e.type, desks: e.desks }, id);
      pins.push({ fp: e.fp, at: e.at, type: e.type, cat: f.category, lat: e.lat, lng: e.lng, place: e.place, label: e.label, source: e.source, url: e.url, actor: e.actor, sea: e.sea, where: f.where, countries: f.countries, desks: f.desks });
    }
  }
  const keep = (x: Row) =>
    (!focus || (x.countries as string[]).includes(focus)) && (!desk || (x.desks as string[]).includes(desk));
  const byAt = (a: Row, b: Row) => String(b.at).localeCompare(String(a.at));
  const reports = [...byStory.values()].filter(keep).sort(byAt).slice(0, limit);
  const events = pins.filter(keep).sort(byAt);
  return {
    at: Date.now(),
    body: JSON.stringify({ ok: true, store: store.kind, focus, desk, reports, events, briefs: before ? undefined : await briefs(store) }),
  };
}

/**
 * Every pin of both desks back to a day, as [at, category, lat, lng, where]:
 * the replay strip's history. Iran's pins pass the same rules they are shown by.
 */
async function readPins(since: string) {
  const store = await getStore();
  const rows: [string, string, number, number, string | null][] = [];
  const seen = new Set<string>();
  for (const id of ["yemen", "iran"] as DeskId[]) {
    const slice = serveSlice(await store.recentDesk(20_000, undefined, { desk: id, since, reports: false }), id);
    for (const e of slice.events as unknown as Row[]) {
      if (typeof e.lat !== "number" || typeof e.lng !== "number") continue;
      const k = `${storyKey(e.fp)}|${e.lat}|${e.lng}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const f = facetsOf({ summary: e.label, place: e.place, lat: e.lat, lng: e.lng, type: e.type, desks: e.desks }, id);
      rows.push([String(e.at).slice(0, 16), f.category, Math.round(e.lat * 1000) / 1000, Math.round(e.lng * 1000) / 1000, f.where]);
    }
  }
  rows.sort((a, b) => b[0].localeCompare(a[0]));
  return { at: Date.now(), body: JSON.stringify({ ok: true, since, pins: rows }) };
}

function renew(key: string, ...a: Parameters<typeof readRegion>) {
  let p = reading.get(key);
  if (!p) {
    p = (key.startsWith("pins|") ? readPins(a[1] as string) : readRegion(...a))
      .then((hit) => {
        if (memo.size > 40) memo.clear();
        memo.set(key, hit);
        return hit;
      })
      .finally(() => reading.delete(key));
    reading.set(key, p);
  }
  return p;
}

export const Route = createFileRoute("/api/region")({
  server: {
    handlers: {
      GET: ({ request }) => metered("region", async () => {
        try {
          const url = new URL(request.url);
          // The replay strip's history: pins alone, back to a day (never before the Iran war's first).
          const pinsDay = url.searchParams.get("pins") || "";
          if (pinsDay) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(pinsDay)) return json({ ok: false, error: "bad pins day" }, 400);
            const since = `${pinsDay < "2026-02-28" ? "2026-02-28" : pinsDay}T00:00:00+03:00`;
            const key = `pins|${since}`;
            let hit = memo.get(key);
            const age = hit ? Date.now() - hit.at : Infinity;
            if (!hit || age > STALE_MS) hit = await renew(key, 0, since, null, null);
            else if (age > MEMO_MS) renew(key, 0, since, null, null).catch(() => {});
            return new Response(hit.body, {
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "public, max-age=300",
                "cdn-cache-control": "public, s-maxage=600, stale-while-revalidate=1800",
              },
            });
          }
          const asked = Number(url.searchParams.get("limit") || NaN);
          const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), 800) : 400;
          const before = url.searchParams.get("before") || undefined;
          if (before && !Number.isFinite(Date.parse(before))) return json({ ok: false, error: "bad before" }, 400);
          // Only known places and desks; anything else is the whole region.
          const focus = focusById(url.searchParams.get("focus") ?? "")?.id ?? null;
          const desk = warDeskById(url.searchParams.get("desk") ?? "")?.id ?? null;
          const key = `${focus}|${desk}|${limit}|${before ?? ""}`;
          let hit = memo.get(key);
          const age = hit ? Date.now() - hit.at : Infinity;
          if (!hit || age > STALE_MS) hit = await renew(key, limit, before, focus, desk);
          else if (age > MEMO_MS) renew(key, limit, before, focus, desk).catch(() => {});
          return new Response(hit.body, {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "public, max-age=30",
              "cdn-cache-control": "public, s-maxage=60, stale-while-revalidate=600",
            },
          });
        } catch (err) {
          return json({ ok: false, error: err instanceof Error ? err.message : "region read failed", reports: [], events: [] }, 500);
        }
      }),
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
