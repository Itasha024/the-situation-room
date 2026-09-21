/**
 * Is one report a copy of another? Kept apart from the scanner so it can be
 * tested without the store. `public/app.js` carries the same rule.
 */

/** Content words of a headline, without the speaker it opens with. */
function headWords(summary: string): Set<string> {
  const said = String(summary || "").replace(/^[^:]{2,60}:\s/, "");
  return new Set(
    (said.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !HEAD_STOP.has(w)).map((w) => w.replace(/s$/, "")),
  );
}
const HEAD_STOP = new Set("the and for with from that this into over after amid near its his her their has have had was were are will been says said say".split(" "));

/**
 * Two headlines tell the same event when most of their words are shared. Only
 * such copies fold into one card: two strikes on one front, or two lines of
 * one speech, are different reports.
 */
export function sameWords(a: string, b: string): boolean {
  const x = headWords(a);
  const y = headWords(b);
  if (!x.size || !y.size) return false;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return both / (x.size + y.size - both) >= 0.4;
}

/** Words that tell nothing about which story a report is: roles, sides, days. */
const STORY_STOP = new Set(
  (
    "the and for with from that this into over after amid near its his her their has have had was were are will been " +
    "says said say stated state also sunday monday tuesday wednesday thursday friday saturday today yemen yemeni houthi " +
    "houthis saudi arabia leader president head according officials official sources source reuters"
  ).split(" "),
);
function storyWords(s: string): Set<string> {
  return new Set(
    (s.toLowerCase().replace(/\bal-/g, "").match(/[a-z][a-z'-]{2,}/g) || [])
      .filter((w) => !STORY_STOP.has(w))
      .map((w) => w.replace(/(?:ing|ed|s)$/, "")),
  );
}
function storyNames(s: string): Set<string> {
  return new Set(
    (s.match(/\b[A-Z][a-z]{2,}(?:-[A-Z][a-z]+)?\b/g) || [])
      .map((w) => w.toLowerCase().replace(/^al-/, ""))
      .filter((w) => !STORY_STOP.has(w)),
  );
}

/**
 * Two statement or diplomacy reports tell the same story: most of the smaller
 * one's words are in the other, or they name the same three people and share
 * a good part of their words. Five outlets' takes on one Reuters story fold
 * into one card; two lines of one speech do not (their words differ).
 */
export function sameStory(a: { summary: string; text?: string }, b: { summary: string; text?: string }): boolean {
  const ta = `${a.summary} ${a.text ?? ""}`;
  const tb = `${b.summary} ${b.text ?? ""}`;
  const x = storyWords(ta);
  const y = storyWords(tb);
  if (x.size < 3 || y.size < 3) return false;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  const overlap = both / Math.min(x.size, y.size);
  if (overlap >= 0.5) return true;
  const na = storyNames(ta);
  let names = 0;
  for (const w of storyNames(tb)) if (na.has(w)) names += 1;
  return names >= 3 && overlap >= 0.3;
}
