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


/** The places the copy names that the source names too, in the copy's order, each with every entry its name fits. */
function placesIn(copy: string, sourceText: string): { cands: Entry[]; at: number; n: number }[] {
  const named = new Set<Entry>();
  const inNative = new Set<Entry>();
  windows(latinWords(`${sourceText}\n${copy}`), (k) => BY_LATIN.get(k)?.forEach((g) => named.add(g)));
  windows(nativeWords(sourceText), (k) => {
    for (const key of [k, k.replace(/^(?:[وبلف]?ال|[ובלמהש]|[وبلف])/, "")]) BY_NATIVE.get(key)?.forEach((g) => (named.add(g), inNative.add(g)));
  });
  if (!named.size) return [];
  const hits: { cands: Entry[]; at: number; n: number }[] = [];
  // "al-Nasr neighborhood", "Shati camp": a name and the word for what it is.
  const kindWord = /^(?:neighbou?rhood|camp|street|village|town|area|district|quarter)$/;
  windows(latinWords(copy), (_k, at, run) => {
    if (!isName(copy, run) && !(run.length >= 2 && kindWord.test(run[run.length - 1]) && isName(copy, run.slice(0, -1)))) return;
    const s = skeleton(run);
    const sound = latinSound(run);
    // A spelling the lists know as it is ("Jenin", too short for a skeleton), else those the name fits by its
    // consonants or its sound; the list is biggest first.
    const exact = (BY_LATIN.get(run.join(" ")) ?? []).filter((x) => named.has(x));
    const cands = exact.length ? exact : [...named].filter((x) => x.skeletons.has(s) || (inNative.has(x) && sound.length >= 3 && x.sounds.has(sound)));
    if (cands.length && !hits.some((h) => h.cands[0] === cands[0])) hits.push({ cands, at, n: run.length });
  });
  const inside = (h: (typeof hits)[number]) => hits.some((o) => o !== h && o.n > h.n && o.at <= h.at && h.at + h.n <= o.at + o.n);
  return hits.filter((h) => !inside(h)).sort((a, b) => a.at - b.at);
}

export function gazaPlacesIn(copy: string, sourceText: string): GazaPlace[] {
  return placesIn(copy, sourceText).map((h) => h.cands[0].place);
}

/** The cities and towns other places are told by ("south of Nablus", "western Gaza City"). */
const CITY = new Set(["Gaza", "Khan Younis", "Rafah", "Deir al-Balah", "Jabalia", "Beit Lahia", "Beit Hanoun", "Hebron", "Nablus", "Jenin", "Ramallah", "Al-Bireh", "Tulkarm", "Qalqilya", "Bethlehem", "East Jerusalem", "Jerusalem", "Jericho", "Tubas"]);
const GAZA_WORDS = /\b(?:Gaza|Khan Y[ou]nis|Rafah|Jabalia|Deir al-Balah|Nuseirat|Bureij|Maghazi|Beit Lahia|Beit Hanoun|Mawasi|yellow line)\b/i;
const JS_WORDS = /\b(?:Judea|Samaria|Hebron|Nablus|Jenin|Ramallah|Tulkarm|Qalqilya|Bethlehem|Jericho|Tubas|Jerusalem|Jordan Valley)\b/i;
/** "…wounds from air strikes yesterday": not today's event. */
const PAST = /\b(?:yesterday|last night|last week|days ago|weeks ago|earlier this (?:week|month))\b/i;
/** A trend told by sources, not one event (23 Oct: "infighting, defections and drone killings hit … gangs"). */
const TREND = /\b(?:infighting|defections|wave of|series of|campaign of|rising|surge in|increase in|growing)\b/i;
const km = (a: GazaPlace, b: GazaPlace) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A card's pins: the places its targets and headline name, never a tally, a past day or a trend; each place
 * in the part (Gaza or Judea and Samaria) the copy is about, near the town it is told by; the town itself
 * and the region only when nothing nearer is named (pin audit of 23 Oct).
 */
export function gazaPins(copy: string, sourceText: string, headline = copy): GazaPlace[] {
  if (tallyNotEvent(headline) || PAST.test(headline) || TREND.test(headline)) return [];
  const hits = placesIn(copy, sourceText);
  if (!hits.length) return [];
  const inGaza = GAZA_WORDS.test(copy), inJs = JS_WORDS.test(copy);
  const areaOk = (g: Entry) => g.place.area === "Israel" || (inGaza && !inJs ? g.place.area === "Gaza" : inJs && !inGaza ? g.place.area !== "Gaza" : true);
  // The towns named, as the anchors the other places are told by.
  const anchors = hits.map((h) => h.cands.find((g) => CITY.has(g.place.name) && areaOk(g))).filter((g): g is Entry => !!g).map((g) => g.place);
  const chosen: { p: GazaPlace; city: boolean }[] = [];
  for (const h of hits) {
    const ok = h.cands.filter(areaOk);
    if (!ok.length) continue;
    const city = CITY.has(ok[0].place.name);
    if (city || !anchors.length) {
      chosen.push({ p: ok[0].place, city });
      continue;
    }
    // Of the places of that name, the one nearest a town the copy names; none more than 25 km from all of them (Turmus Ayya is 17 km north of Ramallah).
    const best = ok.map((g) => ({ g, d: Math.min(...anchors.map((a) => km(g.place, a))) })).sort((a, b) => a.d - b.d)[0];
    if (best.d <= 25) chosen.push({ p: best.g.place, city: false });
  }
  if (!chosen.length) return [];
  const smaller = chosen.some((c) => !c.city);
  // "Yatta, south of Hebron", "western Gaza City", "south of Mawasi, Khan Younis", "Nasser Medical Complex in Khan Younis":
  // a town after a nearer place only says where it is.
  const told = (p: GazaPlace) => {
    const n = esc(p.name);
    return new RegExp(String.raw`\b(?:north|south|east|west|north-?east|north-?west|south-?east|south-?west|near|outside|close to|northern|southern|central|eastern|western)\s+(?:of\s+)?(?:the\s+)?${n}\b|,\s*${n}\b|\b(?:in|of)\s+(?:the\s+)?${n}\b|\b${n} City\b`, "i").test(copy);
  };
  const out = chosen.filter((c) => !(smaller && c.city && (c.p.name === "Gaza" || told(c.p)))).map((c) => c.p);
  // "Air strikes on the Gaza Strip kill one": the whole Strip is no place for a pin (pin audit, 23 Oct).
  if (out.length === 1 && out[0].name === "Gaza" && /\bGaza Strip\b|\bthe Strip\b/i.test(copy) && !/\bGaza City\b/i.test(copy)) return [];
  // A landmark's town is only its address.
  const landmark = /\b(?:Hospital|Medical Complex|corridor|crossing|Camp)\b/i.test(out[0]?.name ?? "");
  return landmark ? [out[0], ...out.slice(1).filter((p) => !new RegExp(String.raw`\bin\s+(?:the\s+)?${esc(p.name)}\b`, "i").test(copy))] : out;
}

/** A funeral is an event at its place on this desk (user, 23 Oct: "funerals should be pinned"). */
export const FUNERAL_RE = /\b(?:funerals?|mourners|burial|buried|laid to rest|funeral procession)\b/i;

/** A place for a card stored with none, from its own headline and body. */
export function gazaPlaceFromWords(summary: string, _type: string, card?: { body?: string }): { name: string; lat: number; lng: number } | null {
  const p = gazaPins(summary, `${summary}\n${card?.body ?? ""}`)[0];
  return p ? { name: p.name, lat: p.lat, lng: p.lng } : null;
}
