/**
 * The desk's feed as served (moved from routes/api/desk.ts, 27 Oct): built by the site on a miss, and by the worker
 * after each scan for the answers most asked (the All page's, the desk pages' and the maps'), stored so the site only
 * hands them out. On the small server a rebuild in the site held every other visitor up for seconds.
 */
import { checkLinks } from "./links.ts";
import { type DeskId, deskById } from "../desks.ts";
import { unglue } from "./reader.ts";
import { respell } from "./spelling.ts";
import { rightOffice } from "./offices.ts";
import { getStore } from "./store.ts";
import { iranLeanOfSource } from "../yemen-scan.server.ts";
import { gazaLeanOf } from "./gaza-sources.ts";
import { gazaWords } from "./gaza-words.ts";
import { houthiAttack, pinSideOf } from "./dev-marks.ts";
import { cardsOnTheirPins, serveIranPins, serveYemenPins } from "./serve-map-pins.ts";
import { gazaNotAPin, gazaPinSide } from "./gaza-pin-side.ts";

/** A pin of the Gaza – Judea & Samaria map: on its desk, or the desk's own pin on another page. */
const isGazaPin = (e: Record<string, unknown>, desk: string) => desk === "gaza" || (Array.isArray(e.desks) && (e.desks as string[]).includes("gaza"));
import { exclusivesOut, idOrderTimes, postTimes, serveCard } from "./copy-rules.ts";
import { type Card as SameCard, foldServed } from "./fold-same.ts";
import { gzipped } from "./microcache.ts";
import type { DeskStore } from "./store.ts";

export type Served = { at: number; body: string };
/** How long the worker's copy is served without a rebuild by the site: two scans (every 10 minutes). */
export const SERVED_FRESH_MS = 25 * 60_000;
export const deskKey = (desk: DeskId, limit: number, before?: string, since?: string) => `${desk}|${limit}|${before ?? ""}|${since ?? ""}`;
export const servedKey = (key: string) => `served:${key}`;

export async function readDesk(limit: number, before: string | undefined, desk: DeskId, since?: string) {
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
  // The map's pins in the site's words too (audit of 24 Oct: "West Bank" on a pin's label).
  for (const e of ((slice as { events?: Record<string, unknown>[] }).events ?? [])) {
    if (typeof e.label === "string") e.label = gazaWords(e.label);
    if (typeof e.text === "string") e.text = gazaWords(e.text);
    // The Gaza map's side is who acted, from the pin's headline (gaza-pin-side.ts; user, 27 Oct).
    if (isGazaPin(e, desk)) e.actor = gazaPinSide(String(e.label ?? ""), e.actor as string | null);
  }
  // No pin for a roundup, an event held or a standing situation (the same audit).
  const evs = (slice as { events?: Record<string, unknown>[] }).events;
  if (Array.isArray(evs)) (slice as { events?: Record<string, unknown>[] }).events = evs.filter((e) => !(isGazaPin(e, desk) && gazaNotAPin(String(e.label ?? ""))));
  // A word a model glued to a name is shown split, and a name in the
  // desk's one spelling; the row is left as it is.
  for (const r of slice.reports) {
    r.summary = rightOffice(respell(unglue(String(r.summary ?? ""))));
    if (r.text) r.text = rightOffice(respell(String(r.text)));
    // The Iran desk's filter buttons go by the source's group.
    if (desk === "iran") (r as Record<string, unknown>).lean = iranLeanOfSource(String(r.source ?? ""));
    // One Palestinian group in the filter (user, 23 Oct): the PA's and the factions' media with the rest.
    if (desk === "gaza") {
      const l = gazaLeanOf(String(r.source ?? ""));
      (r as Record<string, unknown>).lean = l === "pa" || l === "factions" ? "palestinian" : l;
    }
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
    const folded = foldServed(slice.reports as unknown as SameCard[]);
    slice.reports = folded.reports as unknown as typeof slice.reports;
    // Each folded card to the card it joined, so a brief's link to it opens that card (user, 27 Oct).
    if (folded.into.size) (slice as Record<string, unknown>).foldedInto = Object.fromEntries(folded.into);
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

/** The answers the pages ask most: the All page's (400), a desk page's (300) and the map's pins since its start. */
export function hotKeys(desk: DeskId): { limit: number; since?: string }[] {
  return [{ limit: 400 }, { limit: 300 }, { limit: 20_000, since: `${deskById(desk).mapFrom}T00:00:00+03:00` }];
}

/** Run by the worker after a desk's scan. */
export async function prebuildDesk(store: DeskStore, desk: DeskId): Promise<void> {
  for (const h of hotKeys(desk)) {
    const got = await readDesk(h.limit, undefined, desk, h.since);
    await store.putJson(servedKey(deskKey(desk, h.limit, undefined, h.since)), { at: got.at, body: got.body } satisfies Served);
  }
}
