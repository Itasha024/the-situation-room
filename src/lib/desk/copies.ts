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
