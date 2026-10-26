/**
 * 26 Oct, 21:34: "NY Post: Saudi Arabia and allies travel to Iran for talks on ending Houthi attacks, wider
 * war" went out on the Iran and Yemen desks, the X post's line alone, 24 hours into the Tehran talks that
 * some 40 cards had told (user: "it should have gone to the article … remove this card and learn").
 *
 * - A newspaper's post with a picture has no link card: the link in its words stands for the article.
 * - "travel to Iran" is the Tehran visit: the country stands for its capital.
 * - An account with nothing the story's cards have not told is a copy, never an update card.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// The post as fxtwitter gives it.
const NYPOST = {
  url: "https://x.com/nypost/status/2114802887951855764",
  id: "2114802887951855764",
  text: "Saudi Arabia and allies travel to Iran for talks on ending Houthi attacks, wider war https://trib.al/F0gt50a",
  raw_text: {
    text: "Saudi Arabia and allies travel to Iran for talks on ending Houthi attacks, wider war https://t.co/ascUPIeKa3 https://t.co/NCjUzxQXlH",
    facets: [
      { type: "url", original: "https://t.co/ascUPIeKa3", replacement: "https://trib.al/F0gt50a" },
      { type: "media", original: "https://t.co/NCjUzxQXlH", replacement: "https://x.com/nypost/status/2114802887951855764/photo/1" },
    ],
  },
  author: { screen_name: "nypost" },
  created_timestamp: 1793043274,
  media: { all: [{ type: "photo", url: "https://pbs.twimg.com/media/HVlKA9NWYAACro0.jpg?name=orig" }] },
};

test("a newspaper's post with a picture is read as the article it links, not as its line", async () => {
  const { parseFxStatuses, postArticleLink, withoutLinks } = await import("../yemen-scan.server.ts");
  assert.equal(postArticleLink(NYPOST), "https://trib.al/F0gt50a");
  assert.equal(withoutLinks(NYPOST.text), "Saudi Arabia and allies travel to Iran for talks on ending Houthi attacks, wider war");
  const acct = { handle: "nypost", name: "NY Post", lean: "intl", cadence: { everyMin: 30 }, article: true } as never;
  const [hit] = parseFxStatuses({ results: [NYPOST] }, acct) as { url: string; fromTg: boolean; xPost?: string; title?: string }[];
  assert.equal(hit.url, "https://trib.al/F0gt50a", "the article's link, followed to nypost.com and opened");
  assert.equal(hit.fromTg, false);
  assert.equal(hit.xPost, NYPOST.url);
  assert.equal(hit.title, "Saudi Arabia and allies travel to Iran for talks on ending Houthi attacks, wider war");
  // An account that is no newspaper keeps its post as a post (its link is opened later, with the post).
  const plain = { handle: "nypost", name: "NY Post", lean: "intl", cadence: { everyMin: 30 } } as never;
  assert.equal((parseFxStatuses({ results: [NYPOST] }, plain)[0] as { fromTg: boolean }).fromTg, true);
});

test("travel to Iran is the Tehran visit", async () => {
  const { visitOf } = await import("./fold-same.ts");
  assert.equal(visitOf("NY Post: Saudi Arabia and allies travel to Iran for talks on ending Houthi attacks, wider war"), "saudi>tehran");
  assert.equal(visitOf("Iranian foreign minister travels to Saudi Arabia for talks"), "iran>riyadh");
  assert.equal(visitOf("Qatari mediators hold talks in Washington"), "qatar>washington");
});

const base = { live: true, text: "", score: 1, tags: [] } as const;
const story = [
  { ...base, fp: "a", url: "https://t.me/Tehran_Fouri/295296", source: "Tehran Fori", at: "2026-10-25T19:59:26Z", type: "diplomacy", summary: "Saudi negotiation delegation arrives at Tehran's Mehrabad airport for talks with Iranian officials" },
  {
    ...base,
    fp: "b",
    url: "https://www.spa.gov.sa/N2710749",
    source: "SPA",
    at: "2026-10-26T14:15:05Z",
    type: "diplomacy",
    summary: "Saudi Defence Minister Prince Khalid bin Salman joins regional talks in Tehran with Iranian President Masoud Pezeshkian",
    text: "The four-way talks of Saudi Arabia, Turkey, Pakistan and Iran discussed the Houthi attacks on the kingdom and de-escalation in the region.",
  },
];
const xCard = { ...base, fp: "x", url: NYPOST.url, source: "NY Post", at: "2026-10-26T19:34:34Z", type: "diplomacy", summary: "NY Post: Saudi Arabia and allies travel to Iran for talks on ending Houthi attacks, wider war" };

test("nothing the story's cards have not told: a copy, folded, not an update card", async () => {
  const { addsFacts, bringsNews } = await import("./combine.ts");
  const { foldIntoPublished } = await import("../yemen-scan.server.ts");
  // Beside the card alone its other words looked new: this is how it went out.
  assert.equal(addsFacts(story[1] as never, xCard as never), true);
  assert.equal(bringsNews(story as never, xCard as never), false);
  const reports = [...story.map((c) => ({ ...c })), { ...xCard }] as never[];
  foldIntoPublished(reports, new Set(["a", "b"]));
  assert.deepEqual((reports as { fp: string }[]).map((r) => r.fp), ["a", "b"], "the NY Post post folds");
});

test("a named speaker, a figure or a quote the story never had is still news", async () => {
  const { bringsNews } = await import("./combine.ts");
  const said = { ...xCard, fp: "y", summary: "Baghaei: the Tehran talks are a prelude to a new regional security framework" };
  assert.equal(bringsNews(story as never, said as never), true);
  const figure = { ...xCard, fp: "z", summary: "Saudi Arabia and allies travel to Iran with 40 officials for talks on Houthi attacks" };
  assert.equal(bringsNews(story as never, figure as never), true);
  const quote = { ...xCard, fp: "q", text: 'The Saudi minister said "we came to end this war before it widens" on landing.' };
  assert.equal(bringsNews(story as never, quote as never), true);
});
