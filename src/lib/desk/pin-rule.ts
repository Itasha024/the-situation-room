/**
 * What earns a map pin (user, 1 Oct): a new physical event of one of the
 * legend's four kinds — fighting on the ground; a launch, strike,
 * interception or alert; an attack on a ship; an attack on an energy site.
 * Pictures of earlier damage, maps and analysis, build-ups, parades and
 * drills, threats, visits, funerals, protests and arrests stay in the feed,
 * off the map. The same patterns are in public/app.js (buildMapPins); a test
 * keeps the two alike.
 */

/** Pictures or footage of damage already done: never a new attack. */
export const OLD_PICTURE_RE = /\bsatellite (?:images?|imagery|photos?|pictures?|footage)\b|\b(?:images?|imagery|photos?|pictures?|footage|videos?)\b[^.]{0,40}\b(?:show(?:s|ing|ed)?|reveal\w*|document\w*|captur\w*)\b[^.]{0,40}\b(?:damage\w*|aftermath|destruction|destroyed|wreckage|ruins|smoke|charred|burn(?:t|ed|ing)?)\b|\baftermath of\b|\bdamage assessment\b/i;

/** Not an event at a place: maps, analysis, build-ups, drills, threats, visits, funerals, protests, arrests. */
export const NOT_EVENT_RE = /\b(?:maps? (?:of|shows?)|front[- ]line maps?|analys[ie]s|explainer|what we know|deploy(?:s|ed|ing|ment|ments)?|redeploy\w*|reinforcements?|reinforc(?:es|ed|ing)|mobili[sz]\w*|build-?up|military parade|parades?|drills?|military exercises?|manoeuvres|maneuvers|graduat\w*|threat(?:s|en|ens|ened)?|warn(?:s|ed)|vows?|vowed|ultimatum|visit(?:s|ed|ing)?|tours?|inspect\w*|funerals?|mourn\w*|burial|protests?|protesters?|rall(?:y|ies)|demonstrat\w*|sit-in|arrest\w*|detain\w*)\b/i;

/** A new hit or fight named alongside: "warplanes strike Houthi reinforcements" is still the strike. */
export const NEW_HIT_RE = /\b(?:air ?strikes?|air ?raids?|strikes?|struck|hit|hits|kills?|killed|wounded|gunfire|clash(?:es|ed)?|fighting|intercept\w*|shot down|shell(?:s|ed|ing)?|bomb(?:s|ed|ing)|target(?:s|ed|ing)?|repel\w*|seiz\w*|captur\w*|storm(?:s|ed)?|explosions?|attack(?:s|ed)? (?:on|at|in)|launch(?:es|ed)? (?:a |an |two |three )?(?:\w+ )?(?:missiles?|drones?))\b/i;
/** "threatens to strike", "warns of attacks": the hit is not (yet) done. */
export const FUTURE_RE = /\b(?:threat\w*|warn\w*|vow\w*|ultimatum)\b[^.]{0,30}\b(?:to|of|against)\b/i;
/**
 * A round-up joining two hits ("…drone attack on Medina power station as Taiz
 * air strikes surge", user 2 Oct): an overview of the day, not one event at
 * one place, so it is not pinned. A single event in the same words still is.
 */
export const ROUNDUP_RE = /\s(?:as|while|amid|meanwhile)\s/i;
export function roundup(headline: string): boolean {
  const h = String(headline || "");
  const m = h.match(ROUNDUP_RE);
  return !!m && m.index !== undefined && NEW_HIT_RE.test(h.slice(0, m.index)) && NEW_HIT_RE.test(h.slice(m.index + m[0].length));
}
/** Sirens and civil-defence warnings are the legend's alerts, threat or not. */
export const ALERT_RE = /\b(?:sirens?|alerts?|civil defen[cs]e)\b/i;

/**
 * A picture of damage already done, with no new hit before it (Stage D, user
 * 2 Oct): it adds nothing anywhere: no pin, no numbers, no line in Latest
 * developments or the fronts.
 */
export function oldPicture(headline: string): boolean {
  const h = String(headline || "");
  const pic = h.search(OLD_PICTURE_RE);
  return pic >= 0 && !NEW_HIT_RE.test(h.slice(0, pic));
}

/**
 * Whether a report is not a new event of the four kinds, from its headline.
 * A picture after a new hit ("missiles hit the air base; satellite images show
 * an impact") is still the hit; the body is not read, since a card on a new
 * attack often goes on to earlier pictures.
 */
export function notNewEvent(headline: string): boolean {
  const h = String(headline || "");
  if (roundup(h)) return true;
  const pic = h.search(OLD_PICTURE_RE);
  if (pic >= 0) return !NEW_HIT_RE.test(h.slice(0, pic));
  if (!NOT_EVENT_RE.test(h) || ALERT_RE.test(h)) return false;
  return !NEW_HIT_RE.test(h) || FUTURE_RE.test(h);
}
