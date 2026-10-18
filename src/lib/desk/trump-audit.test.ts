/**
 * The Trump column's audit of 18 Oct, on real posts, clips, transcripts and
 * relay cards of 8-17 Oct: each missed statement is now picked up, and each
 * relay is linked to the Truth Social post whose words it tells, or to none.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { addFactbase, factbaseTime, foldClips, parseFactbaseList, sameAppearance, toldByOther, truthFits, truthMatch } from "./trump-said.ts";
import { type TrumpStatement, clipStatement, clipWords, plainCard, shownYet } from "./trump.ts";

const T = (iso: string) => Date.parse(iso);
const post = (n: number, at: string, text: string) => ({ url: `https://www.trumpstruth.org/statuses/${n}`, at: T(at), text });

// His Truth Social posts of 13-15 Oct, as trumpstruth.org has them (cut short).
const POSTS = [
  post(42306, "2026-10-13T16:04:08Z", "The Houthis are behaving very badly. I thought they learned their lesson a year ago when we bombed the HELL out of them and, at their request, stopped. They’ve been silent for a long time, but now they’ve emerged again, probably at the behest of Iran, which is a Failing Nation, with No Navy, No Airforce, the World’s Worst Economy, and 301% Inflation, in a very nasty way, hitting Saudi Arabia, and purposefully trying to drive up Oil Prices, probably prior to the U.S. Elections — NOT NICE."),
  post(42308, "2026-10-13T20:25:56Z", "Why did Ilhan Omar report a Net Worth of up to 30 Million Dollars just a short time ago, and then immediately say, “Oh, I made a mistake! It’s really $100,000.” Could it be that her highly paid accountant actually reported the money that was stolen from her fraudulent activities in Minnesota?"),
  post(42314, "2026-10-13T22:08:00Z", "Dave Bronson of Alaska begged me for my support and Endorsement, but I wouldn’t do it because he didn’t win the Primary and, therefore, wasn’t deserving of it. I then asked him to get out of the Race, and he agreed! I said, “Too many Republicans, three, are running against one Dumocrat, and you won’t be able to win!” Bernadette Wilson is outstanding. She will make a GREAT Governor."),
  post(42327, "2026-10-14T04:17:00Z", "Massive Oil, Gas, and Mineral Exploration is getting ready to begin in our new and beautiful Greenland! There are Experts that are saying that the amount of easily available Oil is far greater than that of almost any land, anywhere in the World and, even more importantly, from a Security Purpose in the Defense and Offense of both the United States of America, and Europe, is second to none. Any future attack on the United States will have to come across Greenland, where our Defense will routinely knock down drones, missiles, or any other form of weapon not yet even conceived."),
  post(42355, "2026-10-14T16:29:18Z", "I was just in Alaska launching the largest Energy Infrastructure Project in Alaska History— The Alaska LNG Project. This 50 Billion Dollar Infrastructure Investment from The Republic of Korea is part of their Trade and Investment Deal with me. I am also announcing today that my Commerce Secretary, Howard Lutnick, has secured an Offtake Commitment from Taiwan of between 70 to 80 Billion Dollars for Alaska LNG — That is 30% of the Pipeline for the next 20 years. This is the largest Offtake Agreement in History."),
  post(42372, "2026-10-15T14:06:46Z", "Nidal Malik Hasan, a former U.S. Army Major turned traitor, is a very bad and evil man, who killed 13 people, including a pregnant soldier. Barack Hussein Obama’s Federal Bureau of Investigation (FBI) intercepted electronic communications between Hasan and the radical Yemeni-American cleric, Anwar al-Awlaki. He will die, as scheduled, by firing squad, but this event will not be streamed."),
  post(42379, "2026-10-15T23:17:00Z", "Hello Iowa! I am going to be coming to your Great State, which I won in Landslides all three times, with the Highest Vote ever obtained by a Political Candidate (for any Office!), on Thursday, October 22nd, and Sunday, November 1st. The reason I’ll be there is to get truly fantastic Warriors elected. They are all spectacular people, and have my Complete and Total Endorsement."),
  post(42366, "2026-10-15T06:00:00Z", "Jon Husted, who is running for the Senate in the Great State of Ohio, is an ALL AMERICAN FOOTBALL PLAYER! He played Safety and, in one season, had 17 Interceptions, a record. As everyone knows, he has, and always will have, my Complete and Total Endorsement!"),
];

test("18 Oct: relays linked to the wrong post are linked to none (live cards of 14-17 Oct)", () => {
  // Each was linked to the post in brackets.
  const wrong: [string, string, string][] = [
    ["Trump: Iran's military destroyed, its leaders gone, and no one left to negotiate with; US controls Hormuz and will push oil prices back down", "2026-10-15T02:45:51Z", "42314 Alaska"],
    ["Trump says Iran will never have a nuclear weapon and its military capability is destroyed", "2026-10-14T21:06:15Z", "42327 Greenland"],
    ["US officials say Pentagon presents Trump with military options against Iran including possible use of GBU-43/B bomb on energy and nuclear sites\nThe United States is considering using its biggest non-nuclear bomb, the GBU-43/B Massive Ordnance Air Blast (MOAB), against Iran if President Donald Trump decides to renew combat.", "2026-10-14T20:55:44Z", "42308 a CNN story"],
    ["Khatibzadeh: No difference whether Trump speaks to the American people or tries to rely on deceit or move other groups", "2026-10-16T18:04:01Z", "42372 Hasan"],
    ["Trump: the Islamic Republic's leaders now ask, 'please let us stay alive'", "2026-10-15T13:02:00Z", "42314 Alaska"],
    ["Trump: Iranian negotiators ask US officials to spare their lives in talks to end the conflict", "2026-10-15T07:53:00Z", "42314 Alaska"],
    ["Trump: killing Iran's leaders has made it hard to know who to negotiate with\nSpeaking at a rally in Montana on Wednesday", "2026-10-15T08:46:00Z", "42366 Husted"],
    ["Trump at Arizona rally: 'Who would like to be the president of Iran?' says he may have gone too far", "2026-10-14T21:06:15Z", "42307 Husted"],
    ["Trump: war in Iran will end soon, Iran will never get a nuclear weapon", "2026-10-16T07:20:00Z", "42379 Iowa"],
    ["Trump: Our country is in great shape and the war with Iran will end soon", "2026-10-16T22:07:00Z", "42379 Iowa"],
    ["Trump keeps U.S. firepower out of Saudi Arabia's war with Houthis and eases Russian diesel sanctions", "2026-10-16T12:30:00Z", "42379 Iowa"],
    ["Egypt: ready to assist Saudi Arabia as US weighs direct involvement and Trump accuses Iran of directing Houthi attacks", "2026-10-14T00:02:00Z", "42306 Houthis"],
  ];
  for (const [story, at, was] of wrong) assert.equal(truthMatch(POSTS, story, T(at)), null, `${story} (was ${was})`);
});

test("18 Oct: a relay of his post is linked to that post", () => {
  const right: [string, string, number][] = [
    ["Trump calls Houthi behaviour very bad, hints at Turkish help for Saudi interests and says decision on Iran coming very soon", "2026-10-14T05:54:00Z", 42306],
    ["Trump: Iran decision coming soon, accuses Tehran of directing Houthi attacks on Saudi Arabia", "2026-10-13T19:31:00Z", 42306],
    // Retold an hour after it, in words of the relay's own.
    ["Trump: The Houthis have resurfaced, possibly at the instigation of Iran", "2026-10-13T17:03:00Z", 42306],
    ["Trump announces $70–80 billion Taiwan LNG deal from Alaska, citing dangerous Strait of Hormuz", "2026-10-14T21:00:00Z", 42355],
  ];
  for (const [story, at, n] of right) assert.equal(truthMatch(POSTS, story, T(at))?.url, `https://www.trumpstruth.org/statuses/${n}`, story);
});

test("someone else telling of Trump is not his words", () => {
  assert.equal(toldByOther("Khatibzadeh: No difference whether Trump speaks to the American people"), true);
  assert.equal(toldByOther("US officials say Pentagon presents Trump with military options"), true);
  assert.equal(toldByOther("Trump: Iran will never have a nuclear weapon"), false);
  assert.equal(toldByOther("Iran's Houthi card complicates Trump's midterm calculations"), false);
  // Named at a rally: never a post, even one on the same subject.
  assert.equal(truthFits(POSTS[0].text, "Trump at Arizona rally: the Houthis are behaving very badly at Iran's behest"), false);
});

// Factbase's list of 18 Oct, its first page ending on 9 Oct and its second reaching 8 Oct.
const rec = (title: string, type: string, date: string) => {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { record_title: title, record_type: type, date, slug, factbase_url: `https://rollcall.com/factbase/trump/transcript/${slug}/` };
};
const GAGGLE_13 =
  "Question 00:01:00-00:01:05 (5 sec) No Signal (0) --> What will be your next step regarding Iran? Are you hopeful for peace? Sentiment Readability Grade 3 Donald Trump 00:01:06-00:01:20 (14 sec) No Signal (0.1) --> Iran is a failed country. They have no economy, they have 300 percent inflation, they have no money, they're not paying their troops, they're not paying their -- they're not paying anybody. We'll make a decision on Iran very soon. Sentiment Readability Grade 3 Question 00:01:21-00:01:25 (4 sec) No Signal (0) --> Have you made a decision on striking the Houthis? Sentiment Readability Grade 3 Donald Trump 00:01:26-00:01:40 (14 sec) No Signal (0.1) --> They're behaving very badly. If I told you I made a decision, that wouldn't be good. Sentiment Readability Grade 3";

test("18 Oct: every appearance from the feed's first day is read, however late; its clip is shown once, there", async () => {
  const { readFactbase } = await import("../trump-feed.server.ts");
  const page1 = { data: [rec("Speech: Donald Trump Holds a Midterm Political Rally in Dalton, Georgia - October 16, 2026", "Speech", "2026-10-16"), rec("Press Gaggle: Donald Trump Speaks to Reporters Before Marine One Departure - October 13, 2026", "Press Gaggle", "2026-10-13"), rec("Speech: Donald Trump Addresses a Columbus Day Celebration at the White House - October 9, 2026", "Speech", "2026-10-09")] };
  const page2 = { data: [rec("Remarks: Donald Trump Holds a Virtual Tele-Rally for MAGA Majority Force - October 8, 2026", "Remarks", "2026-10-08")] };
  const asked: string[] = [];
  const fetchPage = async (url: string) => {
    asked.push(url);
    return JSON.stringify(/page=1&/.test(url) ? page1 : /page=2&/.test(url) ? page2 : { data: [] });
  };
  const words = async (url: string) => (/october-13/.test(url) ? GAGGLE_13 : "Donald Trump 00:00:01-00:00:05 (4 sec) No Signal (0) --> Thank you very much. Sentiment");
  const kv = new Map<string, unknown>();
  const store = { getJson: async (k: string) => kv.get(k) ?? null, putJson: async (k: string, v: unknown) => void kv.set(k, structuredClone(v)) } as never;
  const now = T("2026-10-17T22:00:00Z");
  const entries = await readFactbase(store, now, fetchPage, words);
  // The list's second page is read: the first does not reach 8 Oct.
  assert.ok(asked.some((u) => /page=2&/.test(u)));
  const gaggle = entries.find((e) => /october-13/.test(e.slug));
  assert.ok(gaggle && /failed country/.test(gaggle.text) && /Houthis/.test(gaggle.text), "the 13 Oct gaggle, four days old, is read");
  // Read days late, a gaggle is dated by its day, not the night after it.
  assert.equal(new Date(gaggle!.at).toISOString(), "2026-10-13T19:00:00.000Z");

  // The column of 17 Oct: the gaggle's clips of 13 Oct, and the hand-typed rally entries.
  const clip = (url: string, at: string, text: string) => clipStatement({ url, at, text })!;
  const failed = clip("https://x.com/RapidResponse47/status/2110036935628738623", "2026-10-13T15:56:22Z", '.@POTUS: "Iran is a failed country. They have no economy. They have 300% inflation. They have no money. They\'re not paying their troops. They\'re not paying anybody. We\'ll make a decision on Iran very soon." https://t.co/rgSXdh32FK');
  const houthis = clip("https://x.com/RapidResponse47/status/2110035064407076969", "2026-10-13T15:48:56Z", '"Have you made a decision on striking the Houthis?"\n\n@POTUS: "They\'re behaving very badly... If I told you I made a decision, that wouldn\'t be good." https://t.co/XutOay4vu9');
  assert.ok(failed && houthis, "both clips are his words; the second opens with the reporter's question");
  // Live, only the first clip was in the column: the Houthi one came before the reader took question-first clips.
  const only: TrumpStatement[] = [{ ...failed }];
  addFactbase(only, entries);
  assert.deepEqual(only.filter((s) => s.id.startsWith("fb-") && s.id.includes("october-13")).map((s) => s.at), ["2026-10-13T15:56:22.000Z", "2026-10-13T15:56:22.000Z"]);
  const column: TrumpStatement[] = [failed, houthis];
  addFactbase(column, entries);
  const iran = column.find((s) => s.id === `fb-${gaggle!.slug}`)!;
  const yemen = column.find((s) => s.id === `fb-${gaggle!.slug}-yemen`)!;
  assert.equal(failed.in, iran.id);
  assert.equal(houthis.in, yemen.id);
  // The clip went out as he spoke: the appearance takes the first clip's time, on both desks.
  assert.equal(iran.at, "2026-10-13T15:48:56.000Z");
  assert.equal(yemen.at, "2026-10-13T15:48:56.000Z");
  assert.equal(shownYet(failed), false);
});

test("a clip of the same lines at another appearance stays its own (15 Oct diesel clip, 14 Oct Montana rally)", () => {
  const diesel = clipStatement({ url: "https://x.com/RapidResponse47/status/2110744475253588019", at: "2026-10-15T14:47:53Z", text: '.@POTUS on suspending the federal diesel tax: "It is something I may support... We\'re going to have Iran defeated very quickly, and as soon as that happens, oil and diesel will be falling like a rock. It\'s going to be coming down very fast, but it\'s something I may do anyway." https://t.co/z7QWFWG9oC' })!;
  const rally: TrumpStatement = { id: "fb-kalispell", at: "2026-10-15T00:00:00.000Z", url: "https://rollcall.com/x/", source: "Rally in Montana", text: "We're going to knock this Iran thing off fast. It's going to be over very quickly. And this is going to end very quickly, one way -- by the way, one way or the other, it's going to end very quickly. And when that happens, the oil is going to come way down. But it's going to end and it's going to end very, very soon. And when that happens, it's -- the oil is going to drop like a rock. Your prices have come way down." };
  foldClips([diesel, rally], rally);
  assert.equal(diesel.in, undefined);
});

test("a clip's question is for the writer, never shown as his words", () => {
  const c = clipStatement({ url: "https://x.com/RapidResponse47/status/2110035064407076969", at: "2026-10-13T15:48:56Z", text: '"Have you made a decision on striking the Houthis?"\n\n@POTUS: "They\'re behaving very badly... If I told you I made a decision, that wouldn\'t be good." https://t.co/x' })!;
  assert.equal(clipWords(c.text), "Question: Have you made a decision on striking the Houthis?\nThey're behaving very badly... If I told you I made a decision, that wouldn't be good.");
  assert.doesNotMatch(plainCard(c).headline, /Question|decision on striking/);
  // A clip of someone else's words is still not his.
  assert.equal(clipStatement({ url: "https://x.com/RapidResponse47/status/1", at: "2026-10-13T15:00:00Z", text: '.@SecRubio on Iran: "We will not allow it."' }), null);
});

test("a transcript entry waits for its writer; Truth Social posts and clips do not", () => {
  const base = { at: "2026-10-13T19:00:00Z", url: "u", source: "s", text: "Question: Are you hopeful? Iran is a failed country." };
  assert.equal(shownYet({ ...base, id: "fb-x" }), false);
  assert.equal(shownYet({ ...base, id: "fb-x", headline: "Trump: Iran is a failed country" }), true);
  assert.equal(shownYet({ ...base, id: "fb-x", tries: 3 }), true);
  assert.equal(shownYet({ ...base, id: "ts-1" }), true);
  assert.doesNotMatch(plainCard({ ...base, id: "fb-x", tries: 3 }).headline, /Question/);
});

test("hand-typed entries of 16 Oct give way to their transcripts", () => {
  const e = (label: string, at: string) => ({ label, at: T(at) });
  const kalispell: TrumpStatement = { id: "rally-20261014-kalispell", at: "2026-10-15T04:00:00.000Z", source: "Rally in Kalispell, Montana", url: "u", text: "", headline: "Trump: Iran's leaders are gone" };
  const newsmax: TrumpStatement = { id: "nm-20261015-finnerty-iran", at: "2026-10-15T23:00:00.000Z", source: "Newsmax", url: "u", text: "", headline: "Trump: The Iran war will be over very soon" };
  const arizona: TrumpStatement = { id: "rally-20261014-arizona", at: "2026-10-14T21:00:00.000Z", source: "Rally in Arizona", url: "u", text: "" };
  assert.equal(sameAppearance(kalispell, e("Rally in Montana", "2026-10-15T00:00:00Z")), true);
  assert.equal(sameAppearance(kalispell, e("Rally in Arizona", "2026-10-15T00:00:00Z")), false);
  assert.equal(sameAppearance(newsmax, e("Interview with Newsmax", "2026-10-15T19:00:00Z")), true);
  assert.equal(sameAppearance(arizona, e("Rally in Arizona", "2026-10-15T00:00:00Z")), true);
  // His own post or clip is never replaced, nor a remark of another day.
  assert.equal(sameAppearance({ ...newsmax, id: "ts-1" }, e("Interview with Newsmax", "2026-10-15T19:00:00Z")), false);
  assert.equal(sameAppearance(newsmax, e("Interview with Newsmax", "2026-10-17T19:00:00Z")), false);
  const list = parseFactbaseList({ data: [rec("Speech: Donald Trump Holds a Midterm Political Rally in Kalispell, Montana - October 14, 2026", "Speech", "2026-10-14")] });
  assert.equal(new Date(factbaseTime(list[0], T("2026-10-18T00:00:00Z"))).toISOString(), "2026-10-15T00:00:00.000Z");
});
