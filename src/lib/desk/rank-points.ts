/*
 * Latest developments, most important first, five or six at most (user, 17 Oct).
 *
 * The writers are asked to rank their points, and some do not: on 17 Oct the
 * Iran desk opened on Araghchi's remark on Hormuz, with two tanker attacks
 * under it. This puts the points in four bands and keeps the writer's order
 * inside each band, so a writer that ranks well is left as it is:
 *   0  deaths, attacks on ships, energy sites or Saudi Arabia; Trump's own words
 *   1  other attacks and fighting; decisions: sanctions, mobilisation, talks, a ceasefire
 *   2  meetings, visits, calls; prices and costs
 *   3  what someone said, rejected or warned, with no act in it
 */

export const MAX_POINTS = 6;

const DEATHS = /\b(?:killed|kills|killing|dead|deaths?|wounded|wounding|injured|injuring|casualt(?:y|ies))\b/i;
const ATTACK = /\b(?:struck|strikes?|striking|attack(?:s|ed|ing)?|hit|hits|missiles?|drones?|rockets?|projectiles?|shell(?:ed|ing|s)?|artillery|bombard\w*|air ?strikes?|raids?|seiz(?:ed|es|ing)|sank|sunk|sinking|explosions?|intercept\w*|shot down|clash(?:es|ed)?|fighting|advanc(?:ed|es|ing)|captur(?:ed|es|ing)|siege|offensive|assault)\b/i;
const HIGH_TARGET = /\b(?:ships?|tankers?|vessels?|carriers?|shipping|Hormuz|Red Sea|Bab al-Mandab|oil|gas|LNG|energy|Aramco|refiner(?:y|ies)|pipelines?|power (?:station|plant)s?|Saudi|Riyadh|Jeddah|Abha|Khamis Mushait|Jazan|Jizan|Najran|Yanbu|Dhahran|airport)\b/i;
const DECISION = /\b(?:sanction(?:s|ed)?|blockade|mobili[sz](?:ation|ed)|declared|ordered|announced|approved|ceasefire|truce|talks|negotiat\w*|deal|agreement|agreed|resolution|deployed|deployment)\b/i;
const MEETING = /\b(?:met|meets|meeting|visit(?:s|ed)?|to visit|call(?:ed)? with|phone call|spoke (?:with|to)|envoy|summit|price[sd]?|costs?|billion|million|per barrel)\b/i;
/** A deed told by its doer: "IRGC Navy: it struck two LPG carriers…". */
const DEED = /\b(?:struck|seized|sank|launched|fired|shot down|intercepted|captured|targeted|hit|killed|imposed|declared|ordered|announced|deployed)\b/i;
const WORDS = /\b(?:rejects?|rejected|denies|denied|condemn(?:s|ed)?|prais(?:es|ed)|warns?|warned|says?|said|claims?|claimed|calls? for|urged?|vows?|vowed|threaten(?:s|ed)?|insists?|stresses|stressed|footage)\b/i;

const plain = (p: string) => p.replace(/\s*\[[^\]]*\]/g, "").trim();

/** The band a point falls in, 0 (most important) to 3. */
export function band(point: string): number {
  const p = plain(point);
  const speaker = p.match(/^([^:.]{2,60}):\s/);
  if (/^Trump\b/.test(p)) return 0;
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
  return points
    .map((p, i) => ({ p, i, b: band(p) }))
    .sort((a, b) => a.b - b.b || a.i - b.i)
    .slice(0, max)
    .map((x) => x.p);
}
