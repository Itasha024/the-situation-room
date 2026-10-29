/**
 * A story the desk told days ago is not news when an outlet retells it (user, 29 Oct: "Saudi Arabia, Turkey and
 * Pakistan held talks with Iranian officials in Tehran" stood in the brief three days after the meeting, told some
 * twenty times on 26 Oct). Talk only (meetings, statements, talks): a strike or a raid in the same village is a new
 * one each time.
 */
const TALK = new Set(["statement", "diplomacy", "politics", "analysis", "economy", "humanitarian"]);
const STOP = new Set(
  "the and for with from that this into over after amid near its their have has had was were will would been being about against between during while than then them they what when where which who whom says said also more most other some such only very just held hold holds says".split(" "),
);
const WEEK_MS = 7 * 86400_000;

export function storyWords(s: string): Set<string> {
  return new Set(
    String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/[\s-]+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
      // "pakistani" and "pakistan", "talks" and "talk" are one word here.
      .map((w) => w.replace(/(?:ian|i|s)$/, "")),
  );
}

/** Do two headlines tell the same story? Most of the shorter one's words are in the other. */
export function sameStory(a: string, b: string): boolean {
  const x = storyWords(a);
  const y = storyWords(b);
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  if (small.size < 4) return false;
  let shared = 0;
  for (const w of small) if (big.has(w)) shared++;
  return shared >= 4 && shared / small.size >= 0.6;
}

type Card = { at?: string; summary?: string; type?: string | null };

/** The window's cards less the talk the desk already told in the week before the window. */
export function newsOnly<T extends Card>(cards: T[], all: Card[], start: number): T[] {
  const earlier = all.filter((r) => {
    const t = Date.parse(String(r.at || ""));
    return Number.isFinite(t) && t < start && t >= start - WEEK_MS && TALK.has(String(r.type ?? ""));
  });
  return cards.filter((c) => !TALK.has(String(c.type ?? "")) || !earlier.some((e) => sameStory(String(c.summary ?? ""), String(e.summary ?? ""))));
}
