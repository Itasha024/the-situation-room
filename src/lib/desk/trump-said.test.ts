import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type DayAppearance,
  type SaidItem,
  appearanceOf,
  appearancesNear,
  carriesStory,
  enqueueSaid,
  factbaseGuesses,
  findTrumpWords,
  inColumn,
  iranParts,
  matchAppearance,
  mergeQueue,
  sibling,
  tellingKeys,
  trumpSaid,
  trumpSource,
  whereSaid,
} from "./trump-said.ts";

// The Iran desk's cards of 14-16 Oct (user's review, 16 Oct): his words, told by relays.
const VOA = { summary: "Trump: the Islamic Republic's leaders now ask, 'please let us stay alive'", at: "2026-10-15T13:02:00.000Z", url: "https://t.me/farsivoa/233827", source: "VOA Farsi" };
const FARDA = { summary: "Trump: killing Iran's leaders has made it hard to know who to negotiate with", text: "Speaking at a rally in Montana on Wednesday, Trump said killing Iran's leaders made it hard to know who to negotiate with.", at: "2026-10-15T08:46:00.000Z", url: "https://x.com/RadioFarda_/status/2110653426614907025", source: "Radio Farda" };
const ARAB_NEWS = { summary: "Trump: Iranian negotiators ask US officials to spare their lives in talks to end the conflict", at: "2026-10-15T07:53:00.000Z", url: "https://x.com/arabnews/status/2110640293519462820", source: "Arab News" };
const ASHARQ = { summary: "Trump: I would not use nuclear weapons against Iran, do not expect to send US ground troops", at: "2026-10-16T00:27:00.000Z", url: "https://t.me/asharqnews/37161", source: "Asharq News" };
const IRAN_INTL = { summary: "Trump describes 'mother of all bombs' as very powerful but non-nuclear weapon", at: "2026-10-16T01:07:00.000Z", url: "https://x.com/IranIntlbrk/status/2110900364396613748", source: "Iran International" };
const AJM1 = { summary: "Trump says US must work to ensure Iran does not obtain a nuclear weapon", at: "2026-10-14T20:55:44.000Z", url: "https://t.me/ajMubasher/510747", source: "Al Jazeera Mubasher" };
const AJM2 = { summary: "Trump says US attacked Iran in defence to prevent it acquiring a weapon capable of killing millions", at: "2026-10-14T20:55:44.000Z", url: "https://t.me/ajMubasher/510746", source: "Al Jazeera Mubasher" };
const SAWT = { summary: "Trump calls Houthi behaviour very bad, hints at Turkish help for Saudi interests and says decision on Iran coming very soon", at: "2026-10-14T05:54:00.000Z", url: "https://www.sawt-alasima.net/news/122820", source: "Sawt al-Asima" };

const ALASKA_POST = "Dave Bronson of Alaska begged me for my support and Endorsement, but I wouldn’t do it because he didn’t win the Primary. Now is the time for all Republicans to unite behind Bernadette. Support our Brave Military, Veterans, and Law Enforcement. Bernadette Wilson truly deserves to WIN — SHE WILL NEVER LET YOU DOWN!";
const HOUTHI_POST = "The Houthis are behaving very badly. I thought they learned their lesson a year ago when we bombed the HELL out of them and, at their request, stopped. They’ve emerged again, probably at the behest of Iran, which is a Failing Nation, hitting Saudi Arabia, and purposefully trying to drive up Oil Prices. Turkey has been very helpful. A decision on Iran is coming very soon.";
const KALISPELL = "We hit them hard. I should have probably left the leaders because I don't know who the hell we're negotiating with. They had their first-string leaders, they're all gone. Their second-string leaders are all gone. Half of their third-string leaders are gone, and now their main thing that they ask in negotiation is, \"Will you please allow us to live?\" This is -- no, they do. They don't want us to go after them. Iran will never have a nuclear weapon.";
const BULLHEAD = "Iran will never have a nuclear weapon, because you know they are considered for many years the number one state sponsor of terror. If they had a nuclear weapon, within 24 hours they would use it. They'll knock out the Middle East. Then they'll start hitting us on the West Coast. We attacked in defence, to prevent a weapon that could kill millions. If they have a nuclear weapon, the whole world could be blown up, and we have to stop them.";

const h = (n: number) => n * 3600_000;
const T = (iso: string) => Date.parse(iso);
const item = (title: string, at: string, source = "Fox News", url = `https://www.foxnews.com/${encodeURIComponent(title)}`) => ({ url, source, title, text: title, at: T(at) });

test("16 Oct: reports of his words go to the Trump column; reports about him stay in the feed", () => {
  for (const c of [VOA, FARDA, ARAB_NEWS, ASHARQ, IRAN_INTL, AJM1, AJM2, SAWT]) assert.equal(trumpSaid(c), true, c.summary);
  assert.equal(trumpSaid({ summary: "Trump weighing fresh strikes on Iran without nuclear weapons or ground troops" }), false);
  assert.equal(trumpSaid({ summary: "US officials: Trump weighed strikes on Iran before the midterms" }), false);
  assert.equal(trumpSaid({ summary: "Trump's approval rating hits lowest level in both terms" }), false);
});

test("16 Oct: the Montana rally's words are never his Alaska endorsement; the Houthi post is his", () => {
  const story = `${VOA.summary}`;
  assert.equal(carriesStory(ALASKA_POST, tellingKeys(story), story, true), false);
  const s2 = `${ARAB_NEWS.summary}`;
  assert.equal(carriesStory(ALASKA_POST, tellingKeys(s2), s2, true), false);
  const s3 = SAWT.summary;
  assert.equal(carriesStory(HOUTHI_POST, tellingKeys(s3), s3, true), true);
});

test("sources of his words: his own, Clash Report and American outlets in English; not the US Persian services", () => {
  assert.equal(trumpSource({ source: "Clash Report", url: "https://x.com/clashreport/status/1", text: "Trump: Iran will never have a nuclear weapon" }), true);
  assert.equal(trumpSource({ source: "CBS", url: "https://x.com/CBSNews/status/2", text: "Trump says leakers should be shot" }), true);
  assert.equal(trumpSource({ source: "VOA Farsi", url: "https://t.me/farsivoa/1", text: "ترامپ: ..." }), false);
  assert.equal(trumpSource({ source: "Iran International", url: "https://x.com/IranIntlbrk/status/3", text: "Trump says" }), false);
});

test("where he said it, from the American headlines", () => {
  assert.equal(appearanceOf(["Speech: Donald Trump Holds a Midterm Political Rally in Kalispell, Montana - October 14, 2026"]).label, "Rally in Montana");
  assert.equal(appearanceOf(["Speech: Donald Trump Holds a Midterm Political Rally in Bullhead City, Arizona - October 14, 2026"]).label, "Rally in Arizona");
  assert.equal(appearanceOf(['Trump says "leakers should be shot" during Arizona rally']).label, "Rally in Arizona");
  assert.equal(appearanceOf(["Trump to Newsmax: Non-Nuclear Mother of All Bombs Option in Iran"]).label, "Interview with Newsmax");
  assert.equal(appearanceOf(["Trump to Newsmax on Netanyahu: 'I Don't Trust Anybody'"]).label, "Interview with Newsmax");
  assert.equal(appearanceOf(["Press Gaggle: Donald Trump Speaks to Reporters Before Air Force One Departure - October 14, 2026"]).label, "Remarks to reporters");
});

test("Factbase transcripts are reached from their titles, without Google", () => {
  assert.ok(factbaseGuesses("Speech: Donald Trump Holds a Midterm Political Rally in Kalispell, Montana - October 14, 2026").includes("https://rollcall.com/factbase/trump/transcript/donald-trump-speech-midterm-political-rally-kalispell-montana-october-14-2026/"));
  assert.ok(factbaseGuesses("Speech: Donald Trump Holds a Midterm Political Rally in Bullhead City, Arizona - October 14, 2026").includes("https://rollcall.com/factbase/trump/transcript/donald-trump-speech-midterm-political-rally-bullhead-city-arizona-october-14-2026/"));
  assert.deepEqual(factbaseGuesses("Trump touts economy at Montana rally"), []);
});

test("a transcript keeps his words on Iran and the war", () => {
  const t = iranParts(`Thank you, Montana. The economy is booming. Gas is coming down. ${KALISPELL} We love our farmers. Montana is beautiful. The ranchers are doing great. Beef prices are high. We have a great senator. Corn is up.`);
  assert.match(t, /please allow us to live/);
  assert.match(t, /never have a nuclear weapon/);
  assert.doesNotMatch(t, /Corn is up/);
});

const APPS = (): DayAppearance[] => [
  { kind: "rally", label: "Rally in Alaska", items: [item("Trump pardons two vehicle repair shop owners during Alaska rally", "2026-10-14T05:00:00Z", "NBC News"), item("Trump invites mechanics onstage at Alaska rally", "2026-10-14T05:30:00Z")] },
  { kind: "rally", label: "Rally in Arizona", items: [item("Speech: Donald Trump Holds a Midterm Political Rally in Bullhead City, Arizona - October 14, 2026", "2026-10-14T23:00:00Z", "Roll Call"), item('Trump says "leakers should be shot" during Arizona rally', "2026-10-14T22:30:00Z", "CBS News")], transcript: { url: "https://rollcall.com/factbase/trump/transcript/donald-trump-speech-midterm-political-rally-bullhead-city-arizona-october-14-2026/", text: BULLHEAD } },
  { kind: "rally", label: "Rally in Montana", items: [item("WATCH LIVE: Trump delivers remarks at campaign rally in Montana", "2026-10-15T01:40:00Z"), item("Speech: Donald Trump Holds a Midterm Political Rally in Kalispell, Montana - October 14, 2026", "2026-10-15T06:00:00Z", "Roll Call")], transcript: { url: "https://rollcall.com/factbase/trump/transcript/donald-trump-speech-midterm-political-rally-kalispell-montana-october-14-2026/", text: KALISPELL } },
  { kind: "interview", label: "Interview with Newsmax", items: [item("Trump to Newsmax on Netanyahu: 'I Don't Trust Anybody'", "2026-10-16T00:27:00Z", "Newsmax"), item("Trump to Newsmax: Non-Nuclear Mother of All Bombs Option in Iran", "2026-10-16T01:20:00Z", "Yahoo")] },
];

test("16 Oct: each relay is matched to where he said it", () => {
  const apps = APPS();
  assert.equal(whereSaid(FARDA, apps, [])?.label, "Rally in Montana"); // it names Montana
  assert.equal(whereSaid(ARAB_NEWS, apps, [])?.label, "Rally in Montana"); // the transcript holds it
  assert.equal(whereSaid(IRAN_INTL, apps, [])?.label, "Interview with Newsmax"); // the headline holds it
  assert.equal(whereSaid(AJM1, apps, [])?.label, "Rally in Arizona");
  // Retold too freely to match: the rally of the sixteen hours before.
  const voa = whereSaid(VOA, apps, []);
  assert.equal(voa?.label, "Rally in Montana");
  assert.equal(voa?.byTime, true);
});

test("a story about a rally is not an appearance of his", async () => {
  const deps = {
    reads: () => [],
    truth: async () => [],
    resolve: async (l: string) => l,
    search: async () => [
      { title: "Trump rally protester attacked in act of ‘senseless’ political violence, Ohio mayor says", link: "https://www.nbcnews.com/a", at: T("2026-10-15T10:00:00Z"), outlet: "NBC News", site: "https://www.nbcnews.com" },
      { title: "Trump will rally Georgia Republicans despite party divisions", link: "https://apnews.com/b", at: T("2026-10-15T09:00:00Z"), outlet: "AP News", site: "https://apnews.com" },
      { title: "Trump touts military action in Iran at Montana rally", link: "https://www.foxnews.com/c", at: T("2026-10-15T03:00:00Z"), outlet: "Fox News", site: "https://www.foxnews.com" },
    ],
  };
  const apps = await appearancesNear(T("2026-10-15T12:00:00Z"), deps);
  assert.deepEqual(apps.map((a) => a.label), ["Rally in Montana"]);
});

test("a Truth Social post found among his posts is his, a wrong one never", async () => {
  const deps = {
    reads: () => [],
    truth: async () => [
      { url: "https://www.trumpstruth.org/statuses/42314", at: T("2026-10-13T22:08:00Z"), text: ALASKA_POST },
      { url: "https://www.trumpstruth.org/statuses/42306", at: T("2026-10-13T16:04:00Z"), text: HOUTHI_POST },
    ],
    search: async () => [],
    resolve: async (l: string) => l,
  };
  assert.equal((await findTrumpWords(SAWT, deps)).found[0]?.url, "https://www.trumpstruth.org/statuses/42306");
  assert.equal((await findTrumpWords({ ...VOA, at: "2026-10-14T02:45:00Z" }, deps)).found.length, 0);
});

test("lines of one speech from one channel are one appearance", () => {
  const q: SaidItem[] = [{ ...AJM1, fp: "a", firstAt: 0, tries: 1, label: "Rally in Arizona", done: "column" }];
  assert.equal(sibling({ ...AJM2, fp: "b" }, q), "Rally in Arizona");
  assert.equal(sibling({ ...AJM2, fp: "b", source: "Asharq News" }, q), null);
});

test("already in the column: the hand-added Newsmax entry of 16 Oct", () => {
  const col = [{ id: "nm-20261015-finnerty-iran", at: "2026-10-15T23:00:00.000Z", source: "Newsmax", url: "https://www.yahoo.com/x", text: "", headline: "Trump: The Iran war will be over very soon", body: "“I wouldn't use nuclear, we don't have to.” On US ground troops: “No, I don't see that.” “The mother of all bombs is not nuclear. This is just an extremely large bomb.”" }];
  const story = ASHARQ.summary;
  assert.equal(inColumn(col, tellingKeys(story), story, T(ASHARQ.at))?.id, "nm-20261015-finnerty-iran");
  assert.equal(inColumn(col, tellingKeys(AJM2.summary), AJM2.summary, T(AJM2.at)), null);
});

test("the queue keeps each report once, and what the scan added while it was settled", () => {
  const q1 = enqueueSaid([], [{ ...VOA, fp: "v" }, { ...VOA, fp: "v" }], 1);
  assert.equal(q1.length, 1);
  const settled = [{ ...q1[0], done: "column" as const }];
  const stored = enqueueSaid(q1, [{ ...FARDA, fp: "f" }], 2);
  const merged = mergeQueue(stored, settled);
  assert.deepEqual(merged.map((x) => [x.fp, x.done]), [["v", "column"], ["f", undefined]]);
  void matchAppearance;
});

test("Factbase pages give his own words only: no host, no crowd, no scores", async () => {
  const { factbaseWords } = await import("./trump-said.ts");
  const page = `Header menu Rob Finnerty 00:01:02-00:01:10 (8 sec) Neutral (0.1) --> Do you trust Netanyahu? Sentiment Readability Flesch-Kincaid Grade 3 Donald Trump 00:01:10-00:01:30 (20 sec) Weak (1.151) --> I don't trust anybody, honestly. Iran is negotiating with us. Sentiment Readability Flesch-Kincaid Grade 3.1 Dale-Chall 2.2 Footer`;
  assert.equal(factbaseWords(page), "I don't trust anybody, honestly. Iran is negotiating with us.");
});

test("15 Oct: a line both speeches could hold goes to the latest one before it", () => {
  const apps = APPS();
  apps[1].transcript!.text += " The Islamic Republic's leaders are all gone. They ask us to stay.";
  assert.equal(whereSaid(VOA, apps, [])?.label, "Rally in Montana");
});

test("time: a speech posted live goes to that speech; a morning line is never an evening speech's", () => {
  const apps = APPS();
  // Al Jazeera Mubasher posted the Arizona lines at 20:55, before the reports of the rally (22:30).
  assert.equal(whereSaid({ ...AJM2, text: "" }, apps, [])?.label, "Rally in Arizona");
  // The Houthi line of 14 Oct 05:54 came before the Arizona rally: with no post found, it is no rally's.
  assert.notEqual(whereSaid(SAWT, apps, [])?.label, "Rally in Arizona");
  // Asharq's Newsmax lines at 00:27, as the Newsmax reports came out.
  assert.equal(whereSaid(ASHARQ, apps, [])?.label, "Interview with Newsmax");
});

test("Factbase topic tags are not his words", async () => {
  const { factbaseWords } = await import("./trump-said.ts");
  assert.equal(factbaseWords("Donald Trump 00:16:50-00:17:17 (27 sec) No Signal (0.04) --> Iran is going to be over very quickly. Sentiment Topics Topic: Science and Technology Score: 0.536"), "Iran is going to be over very quickly.");
});

// 17 Oct: the Georgia rally and the gaggle before Marine One of 16 Oct never reached the column.
const FB_LIST = {
  data: [
    { record_title: "Remarks: Donald Trump Addresses an RNC Event at Mar-a-Lago - October 16, 2026", record_type: "Remarks", date: "2026-10-16", slug: "donald-trump-remarks-rnc-event-mar-a-lago-october-16-2026", factbase_url: "https://rollcall.com/factbase/trump/transcript/donald-trump-remarks-rnc-event-mar-a-lago-october-16-2026/", location: { state: "Florida" } },
    { record_title: "Press Gaggle: Donald Trump Speaks to Reporters Before Marine One Departure - October 16, 2026", record_type: "Press Gaggle", date: "2026-10-16", slug: "donald-trump-press-gaggle-before-marine-one-departure-october-16-2026", factbase_url: "https://rollcall.com/factbase/trump/transcript/donald-trump-press-gaggle-before-marine-one-departure-october-16-2026/", location: { state: "District of Columbia" } },
    { record_title: "Speech: Donald Trump Holds a Midterm Political Rally in Dalton, Georgia - October 16, 2026", record_type: "Speech", date: "2026-10-16", slug: "donald-trump-speech-midterm-political-rally-dalton-georgia-october-16-2026", factbase_url: "https://rollcall.com/factbase/trump/transcript/donald-trump-speech-midterm-political-rally-dalton-georgia-october-16-2026/", location: { state: "Georgia" } },
    { record_title: "Interview: Rob Finnerty of Newsmax Interviews Donald Trump at the White House - October 15, 2026", record_type: "Interview", date: "2026-10-15", slug: "donald-trump-interview-newsmax-rob-finnerty-october-15-2026", factbase_url: "https://rollcall.com/factbase/trump/transcript/donald-trump-interview-newsmax-rob-finnerty-october-15-2026/" },
    { record_title: "Remarks: Donald Trump Holds a Virtual Tele-Rally for Iowa GOP Candidates - October 15, 2026", record_type: "Remarks", date: "2026-10-15", slug: "tele", factbase_url: "https://rollcall.com/factbase/trump/transcript/tele/" },
    { record_title: "Remarks: JD Vance Holds a Midterm Political Rally in Monroe, Michigan - October 15, 2026", record_type: "Remarks", date: "2026-10-15", slug: "vance", factbase_url: "https://rollcall.com/factbase/trump/transcript/vance/" },
    { record_title: "Interview: No Transcript - Phil Howard Interviews Donald Trump for NBC Montana - October 14, 2026", record_type: "Interview", date: "2026-10-14", slug: "nbc", factbase_url: "https://rollcall.com/factbase/trump/transcript/nbc/" },
    { record_title: "Donald Trump Vlog: Abdul El-Sayed - October 15, 2026", record_type: "Vlog", date: "2026-10-15", slug: "vlog", factbase_url: "https://rollcall.com/factbase/trump/transcript/vlog/" },
  ],
};

test("Factbase's list: his appearances only, each named as the column names it", async () => {
  const { parseFactbaseList, factbaseLabel } = await import("./trump-said.ts");
  const list = parseFactbaseList(FB_LIST);
  // Not Vance's rally, not an interview with no transcript, not a vlog.
  assert.deepEqual(list.map((r) => r.slug), ["donald-trump-remarks-rnc-event-mar-a-lago-october-16-2026", "donald-trump-press-gaggle-before-marine-one-departure-october-16-2026", "donald-trump-speech-midterm-political-rally-dalton-georgia-october-16-2026", "donald-trump-interview-newsmax-rob-finnerty-october-15-2026", "tele"]);
  assert.deepEqual(list.map((r) => factbaseLabel(r).label), ["Addresses an RNC Event at Mar-a-Lago", "Remarks to reporters", "Rally in Georgia", "Interview with Newsmax", "Tele-rally"]);
});

test("Factbase's day is US time: the desk's first sight of it is kept inside that day and its night", async () => {
  const { parseFactbaseList, factbaseTime } = await import("./trump-said.ts");
  const ga = parseFactbaseList(FB_LIST)[2];
  // Seen at 23:30 UTC on the 16th, during the rally: that time.
  assert.equal(new Date(factbaseTime(ga, Date.parse("2026-10-16T23:30:00Z"))).toISOString(), "2026-10-16T23:30:00.000Z");
  // First seen days later (the first run): no later than 02:00 the next morning, US Eastern.
  assert.equal(new Date(factbaseTime(ga, Date.parse("2026-10-19T10:00:00Z"))).toISOString(), "2026-10-17T06:00:00.000Z");
});

const GAGGLE =
  "Question 00:10:34-00:10:40 (6 sec) No Signal (0) --> Mr. President, do you think Saudi Arabia should accept the help that Israel is offering to fight the Houthi rebels? Sentiment Topics Topic: Politics Score: 0.68 Difficult Word Count 2 Donald Trump 00:10:44-00:10:53 (9 sec) No Signal (0.433) --> I think they will, sure. Israel's been very helpful to Saudi Arabia. And, uh, yeah, uh, they certainly would do that. Yeah. Sentiment Readability Flesch-Kincaid Grade 3.2 Question 00:10:54-00:10:56 (2 sec) No Signal (0) --> Are the Abraham Accords back on the table with Saudi Arabia? Sentiment Readability Grade 1 Donald Trump 00:10:56-00:11:10 (14 sec) No Signal (0.082) --> Yeah, I think so. Maybe more than ever. Sentiment Readability Grade 3.8 Donald Trump 00:12:00-00:12:10 (10 sec) No Signal (0.1) --> The car is very impressive. Sentiment Readability Grade 2";

test("a gaggle keeps the reporter's question beside his short answer, and his Houthi words reach the Yemen desk", async () => {
  const { factbaseWords } = await import("./trump-said.ts");
  const { desksOf } = await import("./trump.ts");
  const w = factbaseWords(GAGGLE, true);
  assert.match(w, /^Question: Mr\. President, do you think Saudi Arabia should accept the help that Israel is offering to fight the Houthi rebels\?\nI think they will, sure\./);
  assert.match(w, /\nQuestion: Are the Abraham Accords back on the table with Saudi Arabia\?\nYeah, I think so\. Maybe more than ever\. The car is very impressive\./);
  // Without questions, only his words, as before.
  assert.equal(factbaseWords(GAGGLE), "I think they will, sure. Israel's been very helpful to Saudi Arabia. And, uh, yeah, uh, they certainly would do that. Yeah. Yeah, I think so. Maybe more than ever. The car is very impressive.");
  const parts = iranParts(w);
  assert.match(parts, /Houthi rebels\? I think they will, sure\. Israel's been very helpful to Saudi Arabia\./);
  assert.deepEqual(desksOf(parts), ["yemen"]);
  assert.deepEqual(desksOf("the stock market is much higher now than when we first went after Iran"), ["iran"]);
});

test("each appearance with his words on the wars is an entry; the entry from reports of it gives way", async () => {
  const { addFactbase } = await import("./trump-said.ts");
  const statements = [
    { id: "ap-2026-10-17-rally-in-georgia", at: "2026-10-16T23:51:00.000Z", text: "Trump: stock market", url: "https://example.com", source: "Rally in Georgia", headline: "Trump: x" },
    { id: "ts-1", at: "2026-10-16T20:00:00.000Z", text: "Iran post", url: "https://truthsocial.com/x", source: "Truth Social" },
  ];
  const ga = { kind: "rally" as const, label: "Rally in Georgia", slug: "ga", title: "Speech", url: "https://rollcall.com/factbase/trump/transcript/ga/", at: Date.parse("2026-10-17T01:00:00Z"), text: "And we're doing just as well in Iran. That will be over very, very soon and they will never have a nuclear weapon. The stock market is much higher now than when we first went after Iran." };
  const rnc = { kind: "remarks" as const, label: "Addresses an RNC Event at Mar-a-Lago", slug: "rnc", title: "Remarks", url: "https://rollcall.com/x/", at: Date.parse("2026-10-17T02:00:00Z"), text: "" };
  assert.equal(addFactbase(statements, [ga, rnc]), 1);
  assert.deepEqual(statements.map((s) => s.id), ["ts-1", "fb-ga"]);
  assert.deepEqual((statements[1] as { desks?: string[] }).desks, ["iran"]);
  // Read again with more of the transcript: rewritten; unchanged: left alone.
  const more = { ...ga, text: `${ga.text} Iran asks us, please allow us to live.` };
  assert.equal(addFactbase(statements, [more]), 1);
  assert.equal(addFactbase(statements, [more]), 0);
});
