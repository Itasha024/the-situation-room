/*
 * Latest developments, most important first, five or six at most (user, 17 Oct).
 *
 * The writers are asked to rank their points, and some do not: on 17 Oct the
 * Iran desk opened on Araghchi's remark on Hormuz, with two tanker attacks
 * under it. This puts the points in five bands and keeps the writer's order
 * inside each band, so a writer that ranks well is left as it is:
 *   0  deaths, attacks on ships, energy sites or Saudi Arabia; Trump's own words
 *   1  other attacks and fighting; decisions: sanctions, mobilisation, talks, a ceasefire
 *   2  meetings, visits, calls; prices and costs
 *   3  what someone said, rejected or warned, with no act in it
 *   4  no new fact: condemned, congratulated, discussed issues, solidarity (18 Oct);
 *      dropped whenever a point of a stronger band is there
 */

// Up to 8 (user, 21 Oct: "more reports, up to 8, but interesting and the most important since the last update").
export const MAX_POINTS = 8;

const DEATHS = /\b(?:killed|kills|killing|dead|deaths?|wounded|wounding|injured|injuring|casualt(?:y|ies))\b/i;
const ATTACK = /\b(?:struck|strikes?|striking|attack(?:s|ed|ing)?|hit|hits|missiles?|drones?|rockets?|projectiles?|shell(?:ed|ing|s)?|artillery|bombard\w*|air ?strikes?|raids?|seiz(?:ed|es|ing)|sank|sunk|sinking|explosions?|intercept\w*|shot down|clash(?:es|ed)?|fighting|advanc(?:ed|es|ing)|captur(?:ed|es|ing)|siege|offensive|assault)\b/i;
const HIGH_TARGET = /\b(?:ships?|tankers?|vessels?|carriers?|shipping|Hormuz|Red Sea|Bab al-Mandab|oil|gas|LNG|energy|Aramco|refiner(?:y|ies)|pipelines?|power (?:station|plant)s?|Saudi|Riyadh|Jeddah|Abha|Khamis Mushait|Jazan|Jizan|Najran|Yanbu|Dhahran|airport)\b/i;
const DECISION = /\b(?:sanction(?:s|ed)?|blockade|mobili[sz](?:ation|ed)|declared|ordered|announced|approved|ceasefire|truce|talks|negotiat\w*|deal|agreement|agreed|resolution|deployed|deployment)\b/i;
const MEETING = /\b(?:met|meets|meeting|visit(?:s|ed)?|to visit|call(?:ed)? with|phone call|spoke (?:with|to)|envoy|summit|price[sd]?|costs?|billion|million|per barrel)\b/i;
/** A deed told by its doer: "IRGC Navy: it struck two LPG carriers…". */
const DEED = /\b(?:struck|seized|sank|launched|fired|shot down|intercepted|captured|targeted|hit|killed|imposed|declared|ordered|announced|deployed)\b/i;
const WORDS = /\b(?:rejects?|rejected|denies|denied|condemn(?:s|ed)?|prais(?:es|ed)|warns?|warned|says?|said|claims?|claimed|calls? for|urged?|vows?|vowed|threaten(?:s|ed)?|insists?|stresses|stressed|footage)\b/i;

/**
 * Words that carry no new fact (user, 18 Oct: "Condemned navigation
 * disruptions in the Strait of Hormuz and Bab al-Mandab", "Dar: discussed
 * regional issues during a phone call with Araghchi"): a condemnation, a
 * talk on "issues", congratulations, support, solidarity, a slogan.
 */
const EMPTY =
  /\b(?:condemn(?:s|ed|ing)?|denounc(?:es|ed|ing)|deplor(?:es|ed)|congratulat(?:es|ed|ing)|discuss(?:es|ed|ing) (?:the )?(?:regional|bilateral|recent|latest|mutual|common|current|international)? ?(?:issues|ties|relations|developments|situation|matters|cooperation|topics)|exchang(?:es|ed) views|express(?:es|ed) (?:its |his |her |their )?(?:support|solidarity|concern|condolences|sympathy|appreciation|gratitude)|(?:re)?affirm(?:s|ed) (?:its |his |her |their )?(?:support|solidarity|commitment|stance|position)|stress(?:es|ed) the (?:importance|need)|will remain (?:united|steadfast|strong|firm)|stands? (?:with|by)|in solidarity with)\b/i;
/** A fact that makes such a point news after all: a toll, a deed, a decision. */
const NEWS_IN_IT = /\b(?:killed|killing|dead|deaths?|wounded|injured|\d[\d,.]*\s*(?:people|civilians|soldiers|killed|dead|wounded|ships|tankers|missiles|drones|per ?cent|%|billion|million)|agreed|agreement|deal|ceasefire|truce|sanction(?:s|ed)?|ordered|announced|declared|decided|approved|imposed|expelled|recalled|suspended|closed|deadline|proposal|withdr[ae]w\w*)\b/i;

const plain = (p: string) => p.replace(/\s*\[[^\]]*\]+/g, "").trim();

/** A point with no new fact in it: band 4, dropped when any stronger point is there. */
export function emptyPoint(point: string): boolean {
  const p = plain(point);
  const said = p.replace(/^[^:.]{2,60}:\s/, "");
  return EMPTY.test(said) && !NEWS_IN_IT.test(said) && !DEED.test(said);
}

/** The band a point falls in, 0 (most important) to 4 (no new fact). */
export function band(point: string): number {
  const p = plain(point);
  const speaker = p.match(/^([^:.]{2,60}):\s/);
  if (/^Trump\b/.test(p)) return 0;
  if (emptyPoint(p)) return 4;
  // Someone's words: a band of their own, unless they tell a deed of theirs or a decision.
  if (speaker && !DEED.test(p.slice(speaker[0].length)) && !DECISION.test(p.slice(speaker[0].length))) return 3;
  // A claim with no deed in it ("spokesmen claim increased defence capabilities") is words.
  if (/\bclaim(?:s|ed)?\b/i.test(p) && !DEED.test(p)) return 3;
  if (DEATHS.test(p)) return 0;
  if (ATTACK.test(p) && HIGH_TARGET.test(p)) return 0;
  if (ATTACK.test(p) || DECISION.test(p)) return 1;
  if (MEETING.test(p)) return 2;
  if (WORDS.test(p)) return 3;
  return 2;
}

/** The points from the most important to the least, the writer's order kept inside a band, at most `max`. */
export function rankPoints(points: string[], max = MAX_POINTS): string[] {
  return dropEmpty(points)
    .map((p, i) => ({ p, i, b: band(p) }))
    .sort((a, b) => a.b - b.b || a.i - b.i)
    .slice(0, max)
    .map((x) => x.p);
}

/** The points with no new fact go when a point with one is there; a list of only such points is kept. */
export function dropEmpty<T extends string>(points: T[]): T[] {
  const kept = points.filter((p) => !emptyPoint(p));
  return kept.length ? kept : points;
}
