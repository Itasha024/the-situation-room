/**
 * The Gaza – Judea & Samaria map's places (user, 23 Oct): a card's pin is a place its copy names that
 * its source names too, found the way the Iran map finds its villages (iran-places.ts): any spelling the
 * lists know, or one that sounds like the Arabic or Hebrew name the source gives.
 */
import { GAZA_GAZ } from "./gaza-gazetteer.ts";
import { isName, latinSound, latinWords, nativeSound, nativeWords, skeleton, tallyNotEvent, windows } from "./iran-places.ts";

export type GazaPlace = { name: string; lat: number; lng: number; area: string };

/** Names that are words before they are places ("Beach" camp, "Camp Number One"). */
const NOT_A_NAME = /^(?:beach|camp|camp number one|center|centre|east|west|north|south|new|old|city|al|jihad|fatah|hamas|aqsa|quds|nasr|salam|tahrir|karama|awda|wahda|amal)$/i;

const GAZ = GAZA_GAZ.map(([name, lat, lng, area, latin, native]) => ({
  place: { name, lat, lng, area } as GazaPlace,
  latin: latin.filter((n) => !NOT_A_NAME.test(latinWords(n).join(" "))),
  native,
}))
  .filter((g) => g.latin.length)
  .map((g) => ({
    ...g,
    skeletons: new Set(g.latin.map((n) => skeleton(latinWords(n))).filter((k) => k.length >= 3)),
    sounds: new Set(g.native.map(nativeSound).filter((k) => k.length >= 3)),
  }));
type Entry = (typeof GAZ)[number];

const BY_LATIN = new Map<string, Entry[]>();
const BY_NATIVE = new Map<string, Entry[]>();
for (const g of GAZ) {
  for (const n of g.latin) {
    const key = latinWords(n).join(" ");
    if (key) (BY_LATIN.get(key) ?? BY_LATIN.set(key, []).get(key)!).push(g);
  }
  for (const n of g.native) {
    const key = nativeWords(n).join(" ");
    if (key) (BY_NATIVE.get(key) ?? BY_NATIVE.set(key, []).get(key)!).push(g);
  }
}

/** The places the copy names that the source names too, in the copy's order; a longer name over a shorter inside it. */
export function gazaPlacesIn(copy: string, sourceText: string): GazaPlace[] {
  const named = new Set<Entry>();
  const inNative = new Set<Entry>();
  windows(latinWords(`${sourceText}\n${copy}`), (k) => BY_LATIN.get(k)?.forEach((g) => named.add(g)));
  windows(nativeWords(sourceText), (k) => {
    for (const key of [k, k.replace(/^(?:[وبلف]?ال|[ובלמהש]|[وبلف])/, "")]) BY_NATIVE.get(key)?.forEach((g) => (named.add(g), inNative.add(g)));
  });
  if (!named.size) return [];
  const hits: { p: GazaPlace; at: number; n: number }[] = [];
  windows(latinWords(copy), (_k, at, run) => {
    if (!isName(copy, run)) return;
    const s = skeleton(run);
    const sound = latinSound(run);
    // One place per name: a spelling the lists know as it is ("Jenin", too short for a skeleton), else the
    // biggest the name fits by its consonants or its sound (the list is biggest first).
    const exact = BY_LATIN.get(run.join(" "))?.find((x) => named.has(x));
    const g = exact ?? [...named].find((x) => x.skeletons.has(s) || (inNative.has(x) && sound.length >= 3 && x.sounds.has(sound)));
    if (g && !hits.some((h) => h.p === g.place)) hits.push({ p: g.place, at, n: run.length });
  });
  const inside = (h: (typeof hits)[number]) => hits.some((o) => o !== h && o.n > h.n && o.at <= h.at && h.at + h.n <= o.at + o.n);
  return hits.filter((h) => !inside(h)).sort((a, b) => a.at - b.at).map((h) => h.p);
}

/** A card's pins: the places its targets and headline name, never a tally of days or weeks. */
export function gazaPins(copy: string, sourceText: string, headline = copy): GazaPlace[] {
  if (tallyNotEvent(headline)) return [];
  const all = gazaPlacesIn(copy, sourceText);
  // "Yatta, south of Hebron": the second place only says where the first is.
  // "…Kamal Adwan Hospital in northern Gaza": the region is a locator too.
  const locator = (p: GazaPlace) => new RegExp(String.raw`\b(?:north|south|east|west|north-?east|north-?west|south-?east|south-?west|near|outside|close to|northern|southern|central|eastern|western)\s+(?:of\s+)?(?:the\s+)?${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`, "i").test(copy);
  // "Nasser Medical Complex in Khan Younis": after a landmark, the town it is in says where it is.
  const landmark = /\b(?:Hospital|Medical Complex|corridor|crossing|Camp)\b/i.test(all[0]?.name ?? "");
  const inTown = (p: GazaPlace) => landmark && new RegExp(String.raw`\bin\s+(?:the\s+)?${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`, "i").test(copy);
  return all.length > 1 ? [all[0], ...all.slice(1).filter((p) => !locator(p) && !inTown(p))] : all;
}

/** A place for a card stored with none, from its own headline and body. */
export function gazaPlaceFromWords(summary: string, _type: string, card?: { body?: string }): { name: string; lat: number; lng: number } | null {
  const p = gazaPins(summary, `${summary}\n${card?.body ?? ""}`)[0];
  return p ? { name: p.name, lat: p.lat, lng: p.lng } : null;
}
