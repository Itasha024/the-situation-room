/**
 * The Gaza – Judea & Samaria map's pins: who ACTED, from the pin's own headline (user, 27 Oct: "in gaza you have
 * israeli action as hamas pin... be accurate with classifying sides and types of events in maps"). The reader's side
 * is who acted or spoke, so "Gaza Health Ministry says a man died of wounds from Israeli shelling" came out Hamas's,
 * "Israeli fire wounds one near Khan Younis" unclear and "Israeli extremists attack olive pickers" the PA's. Here the
 * teller is set aside ("X says", "Palestinian source:") and the first actor the headline names decides; a teller who
 * says it acted itself ("Hamas's Rad' force says it clashed …") is the actor. With no actor named, the reader's side
 * stands. Applied as the desk is served, so stored pins are read the same way.
 */

type Side = "israel" | "israeli_citizens" | "hamas" | "factions" | "pa" | "clans";

/** Each side's words as an actor, the first in the headline deciding. Israeli citizens before Israel ("Israeli extremists"). */
const ACTORS: [Side, RegExp][] = [
  ["israeli_citizens", /\b(?:Israeli )?(?:extremists?|settlers?)\b(?! (?:road|roads|bypass))|\bIsraeli (?:citizens|civilians)\b|\boutpost residents\b/i],
  ["israel", /\b(?:Israeli (?:forces?|army|troops|soldiers|military|police|border police|special forces|undercover (?:forces|unit)|occupation|shelling|fire|gunfire|strikes?|air ?strikes?|airstrikes?|bombardment|drones?|aircraft|warplanes?|jets?|helicopters?|artillery|tanks?|vehicles|military vehicles|bulldozers|gunboats?|navy|naval forces|quadcopters?|snipers?|raids?|incursions?|missiles?)|IDF|Shin Bet|COGAT|Border Police|(?:air|drone) ?strikes?|airstrikes?|shelling|artillery (?:shells?|fire)|warplanes?|tank fire|quadcopters?|gunboats?)\b/i],
  ["pa", /\b(?:(?:PA|Palestinian Authority|Palestinian) (?:security(?: forces| services)?|intelligence|police|forces|Preventive Security|General Intelligence)|PA intelligence|Preventive Security|General Intelligence Service)\b/i],
  ["hamas", /\b(?:Hamas|Qassam|Al-Qassam|Rad'?[ae]?a? force|Sahm unit|internal security|Gaza(?:'s)? (?:police|security forces))\b/i],
  ["factions", /\b(?:Islamic Jihad|Saraya al-Quds|Al-Quds Brigades|Al-Aqsa Martyrs|PFLP|DFLP|Abu Ali Mustafa Brigades|Popular Resistance Committees|Nasser Salah al-Din Brigades|[A-Z][a-z]+ Battalion|resistance fighters|gunmen)\b/i],
  ["clans", /\b(?:clans?|militias?|Popular Forces|Abu Shabab|collaborators|armed gangs?)\b/i],
];

/** "Gaza Health Ministry says …", "Palestinian source: …": the teller and the rest. */
function teller(h: string): { who: string; rest: string; self: boolean } {
  const colon = /^([^:]{2,70}):\s+(.*)$/s.exec(h);
  if (colon && !/\d$/.test(colon[1])) return { who: colon[1], rest: colon[2], self: false };
  const says = /^(.{2,70}?)\s+(?:says|said|reports|reported|claims|claimed|announces|announced)(?: that)?\s+(.*)$/is.exec(h);
  if (says) return { who: says[1], rest: says[2], self: /^(?:it|its|they|their|we|our)\b/i.test(says[2]) };
  return { who: "", rest: h, self: false };
}

/** Forces named without a side ("troops", "the army"): the teller's ("IDF: troops killed two gunmen"), else Israel's. */
const BARE = /\b(?:troops|soldiers|forces|the army|army|jets|aircraft)\b/i;
/** "… killed by Israeli fire", "… attacked by extremists": the one after "by" acted. */
const BY = /\b(?:killed|wounded|injured|shot|hit|arrested|detained|attacked|targeted|struck|abducted|run over|assaulted|beaten|chased|expelled)\b[^.;]{0,30}?\bby\b([^.;]{0,60})/i;

const TARGET_BEFORE = /\b(?:at|on|toward|towards|against|targeting|near)\s+(?:an?\s+|the\s+|two\s+|three\s+)?$/i;

function firstActor(s: string, bare: Side | null = null): Side | null {
  const by = BY.exec(s);
  if (by) {
    const a = firstActor(by[1], bare);
    if (a) return a;
  }
  let best: [number, Side] | null = null;
  if (bare) {
    const m = BARE.exec(s);
    if (m) best = [m.index, bare];
  }
  for (const [side, re] of ACTORS) {
    // A side named as the target is not the actor ("youths throw stones at Israeli vehicles").
    const g = new RegExp(re.source, "gi");
    for (let m = g.exec(s); m; m = g.exec(s)) {
      if (TARGET_BEFORE.test(s.slice(Math.max(0, m.index - 16), m.index))) continue;
      if (!best || m.index < best[0]) best = [m.index, side];
      break;
    }
  }
  return best ? best[1] : null;
}

/** The side a Gaza pin is drawn in: the actor its headline names, else the stored one. */
export function gazaPinSide(label: string, stored: string | null | undefined): string {
  const h = String(label || "").trim();
  if (!h) return stored || "unclear";
  const t = teller(h);
  const own = t.who ? firstActor(t.who) : null;
  if (t.self) return own ?? stored ?? "unclear";
  return firstActor(t.rest, own === "israel" || own === "pa" || own === "hamas" ? own : "israel") ?? stored ?? "unclear";
}

/**
 * Not an event to pin (the same audit): a roundup of many attacks in many places, an event held, a campaign, a
 * standing situation ("residents face ongoing closures").
 */
const NOT_A_PIN = /\b(?:\d+|dozens of|hundreds of) (?:(?:Israeli|extremists?|settlers?|army|military|occupation|and|forces)\s+){0,4}(?:attacks|violations|assaults)\b(?! on olive pickers documented)|\bsolidarity (?:event|visit|stand|vigil)|\bevent (?:held|organi[sz]ed)\b|\b(?:solidarity|awareness|support|volunteer|national) campaign\b|\bface (?:ongoing|continuing|daily)\b|\bweekly (?:report|toll)\b|\bmonthly (?:report|toll)\b|\bfollow-up committee\b/i;
/** Aircraft or drones seen overhead, nothing struck: a watch, not an event ("Reconnaissance drones over Nuseirat"). */
const OVERHEAD = /\b(?:drones?|quadcopters?|helicopters?|aircraft|warplanes?|jets|Heron|reconnaissance|loitering munitions?)\b[^.;]{0,40}?\b(?:over|circl\w*|fly|flies|flying|flew|hover\w*|airspace)\b/i;
const HIT = /\b(?:strikes?|struck|hit|hits|kill\w*|wound\w*|injur\w*|fire[sd]?|firing|shell\w*|bomb\w*|missiles?|blast|explo\w*|demolish\w*|raid\w*|arrest\w*)\b/i;
export function gazaNotAPin(label: string): boolean {
  const l = String(label || "");
  return NOT_A_PIN.test(l) || (OVERHEAD.test(l) && !HIT.test(l));
}
