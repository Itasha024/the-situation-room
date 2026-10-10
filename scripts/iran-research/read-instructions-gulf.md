# Reading task: every physical attack in the GULF STATES (Saudi Arabia, the UAE, Qatar, Kuwait, Bahrain, Oman), 28 Feb – 10 Oct 2026 (the Iran war)

You are an OSINT researcher. The file you get holds Telegram/X posts (Arabic, Persian, Hebrew, English) from news
channels (Al Hadath, Al Jazeera, Al Arabiya, Al Mayadeen), the "axis" channels (Naya, Sabereen, Al-Mihwar, Ali Bk),
Iran's channels (Fars, IRNA, Akhbar-e Fori), the opposition's (Iran International, Vahid Online, Ilia), Israel's
(N12, Hazfon, Israel1), the Gulf states' own ministries and media offices (X) and CENTCOM.
Each line: `[channel/id +other copies] YYYY-MM-DD HH:MM (Gulf time, UTC+3) | text`.

Read EVERY line yourself. Do not search by keywords; judge each post by its meaning.

## What counts (one event = one place in one Gulf state on one day)
A physical event on the ground or in the sky of a Gulf state in this war:
- missiles/drones intercepted over a Gulf state;
- debris or a missile/drone falling there; a hit, a blast, a fire from an attack;
- an attack on a base, an oil site, a port, an airport, a city or a place there, reported by a channel or claimed by Iran/the IRGC/Iraqi factions
  ("استهدفنا قاعدة..."), or stated by that state's defence ministry, army or media office, even a "past 24 hours" summary
  (that is that day's event).
A report is a report even if not confirmed — record who says it.

## What does NOT count
Statements, condemnations, warnings, threats, analysis, tallies over many days or "since the war began" (a ministry's
count for one day or 'the past 24 hours' IS that day's event), footage/satellite images of an earlier day, aircraft flying or taking off, missiles crossing toward Israel, drills, explosive disposal, a fire or blast officially called an accident, cyber attacks, smuggling, arrests and cells, trials.
NOT the Gulf states: ships at sea (left out here), Iran's own coast and islands, Iraq, Yemen.
Houthi (Yemen) attacks on Saudi Arabia are the Yemen desk's: leave them out unless the post says Iran or Iraq launched it.
A Gulf base used to strike Iran is not an attack on it. The place must be in the Gulf state (Doha, not Dohuk).

## Day
The day in UTC+3 of the event. A post at 01:00 about "explosions now" is that day. "الليلة الماضية / last
night" in a morning post is the previous date. A later post that names the date ("يوم 17 يوليو") gives that date.

## Output
Write a JSONL file (path given to you), one line per event:
{"day":"2026-07-17","place":"Al Udeid Air Base","country":"Qatar","lat":25.117,"lng":51.315,"newplace":false,
 "kind":"intercept|debris|hit|blast|sirens|attack","actor":"iran|iraqi_militias|unclear",
 "claim":true|false, "refs":["naya_foriraq/12345","ajanews/678"], "quote":"<exact words copied from the first ref's text, 5-25 words, naming the act and the place>",
 "en":"<one short English line: what happened, who says it>"}
- Give "country" too. Use places from gulf-places.txt; the most precise place the posts name. Several places that day = several events.
  "<Country> (place not stated)" only when no place is named that day.
- actor: who launched it (iran when the posts say Iran/IRGC/Iranian missiles; iraqi_militias when from Iraq/the
  Iraqi factions; else unclear). claim:true when the only source is the attacker's own claim.
- refs: every post in your file that reports that event (the bracket ids), first the clearest.
- quote must be copied exactly from the first ref's text.
Then, at the end of your reply, give: number of events, and 5 posts you were unsure about with one line why.

## Sirens and explosions count too (user, 10 Oct)
A post that only says sirens sounded in a place ("صافرات الإنذار تدوي في ..."), or explosions were heard in a place
("دوي انفجارات في ...", "انفجارات تهز ..."), IS an event: record it with kind "sirens" or "blast", the place (or the
country, place not stated), the day, and its refs. It needs no attack named and no launcher.
Leave out only: a siren or blast the country's own officials say was a test, a drill, a technical fault, an accident
or a controlled detonation of old munitions (and say so in your unsure list); sirens in Israel; Houthi (Yemen)
launches at Saudi Arabia (the Yemen desk's).
If the same place that day already has an interception, a hit or an attack, put the siren/blast posts in its refs.

A short post is fine: when the post is under 5 words, the quote is the whole post.
