# Reading task: every physical event of the Iran war, in every country, from one source (28 Feb – 10 Oct 2026)

You are an OSINT researcher. Your file holds posts of ONE channel (or a stretch of it), in time order, every post
that has a word of war in it. Lines: `[channel/id +copies in other channels] YYYY-MM-DD HH:MM (UTC+3) | text`.
Read EVERY line yourself, by meaning, not by keywords. Most posts are not events; that is expected.

## What to record: every physical event, in any country but Israel
One event = one place on one day. Countries: Iran, Iraq (Kurdistan too), Lebanon, Syria, Jordan, Saudi Arabia, the
UAE, Qatar, Kuwait, Bahrain, Oman, Turkey, Azerbaijan, Cyprus, Egypt, and the sea (the Gulf, Hormuz, the Gulf of
Oman, the Arabian Sea).
- strikes, air strikes, shelling, drone strikes, missile attacks, raids (Israel's on Lebanon, the US's and Israel's on
  Iran and Iraq, Iran's and the Iraqi factions' on the Gulf, Jordan, Iraq, Hezbollah's on Israeli troops in Lebanon);
- interceptions, missiles or drones shot down, debris falling; a hit, a fire or a blast from an attack;
- SIRENS sounding in a place, EXPLOSIONS HEARD in a place: these count on their own, no attack named needed;
- a ship attacked at sea (place = the sea, or "off <port>");
- an attacker's own claim ("استهدفنا ...", "IRGC: we struck ..."), stated as a claim; a channel's report is a report
  even if unconfirmed.

## What NOT to record
Israel's own ground and sky (its alerts are pinned from the Home Front Command); Gaza, the West Bank; Yemen and the
Houthis' attacks on Saudi Arabia (the Yemen desk's); Sudan, Ukraine and other wars. Statements, condemnations,
threats, warnings to evacuate, analysis, tallies over several days, footage or satellite images of an earlier day
(but footage of that day's event, "now / قبل قليل", is a report of it), aircraft flying or taking off, missiles
merely crossing a sky, launches from Iran with no place they reached, arrests, police clashes, criminal shootings,
executions, accidents a country's officials call an accident, tests, drills, controlled detonations.

## Day
The day in UTC+3 when it happened. "last night / الليلة الماضية / دیشب" in a morning post = the date before. A date
named in the post wins.

## Output: a JSONL file (path given to you), one line per event
{"day":"2026-07-17","country":"Lebanon","said":"<the place's name EXACTLY as written in the post, in its language>",
 "place":"<the place's name in English>","kind":"strike|intercept|debris|hit|blast|sirens|attack|clash|ship",
 "actor":"israel|us|iran|hezbollah|iraqi_militias|gulf|unclear","claim":true|false,
 "refs":["<channel/id>", "..."],"quote":"<5-25 words copied EXACTLY from the first ref's text (all of it if shorter)>"}
- "said" must appear in the quote. The most precise place named (a village, a base, a quarter of a city). Several
  places in one post = several events. No place, only the country: "said" = the country's name as written, "place" =
  "<Country> (place not stated)".
- actor: who struck. For sirens/blasts with no one named: "unclear". claim: true when only the attacker says it.
- refs: every post in YOUR file telling that event that day.
Check with a short node script that each quote is in its first ref's line and that "said" is in the quote.
Reply in at most 4 lines: the count of events by country, and the 3 posts you were least sure of.
