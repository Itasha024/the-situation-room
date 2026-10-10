# Reading task: every physical attack in JORDAN, 28 Feb – 10 Oct 2026 (the Iran war)

You are an OSINT researcher. The file you get holds Telegram/X posts (Arabic, Persian, Hebrew, English) from news
channels (Al Hadath, Al Jazeera, Al Arabiya, Al Mayadeen), the "axis" channels (Naya, Sabereen, Al-Mihwar, Ali Bk),
Iran's channels (Fars, IRNA, Akhbar-e Fori), the opposition's (Iran International, Vahid Online, Ilia), Israel's
(N12, Hazfon, Israel1), Jordan's own (Petra = official agency, Jfra News, Roya TV) and CENTCOM.
Each line: `[channel/id +other copies] YYYY-MM-DD HH:MM (Jordan time) | text`.

Read EVERY line yourself. Do not search by keywords; judge each post by its meaning.

## What counts (one event = one place in Jordan on one day)
A physical event on Jordanian ground or in Jordan's sky in this war:
- missiles/drones intercepted over Jordan (also ones heading for Israel, when they are brought down over Jordan);
- debris or a missile/drone falling in Jordan; a hit, a blast, a fire from an attack;
- an attack on a base or a place in Jordan, reported by a channel or claimed by Iran/the IRGC/Iraqi factions
  ("استهدفنا قاعدة..."), or stated by Jordan's army (Petra "القوات المسلحة ..."), even a "past 24 hours" summary
  (that is that day's event).
A report is a report even if not confirmed — record who says it.

## What does NOT count
Statements, condemnations, warnings, threats, analysis, tallies over many days or "since the war began",
footage/satellite images of an earlier day (but footage posted the same day, "قبل قليل", of that day's attack is a
report of it), sirens with nothing else, aircraft or drones flying or taking off, missiles merely crossing Jordan's
sky to Israel, drones smuggling drugs or weapons, the Jordanian army's raids on smugglers in Syria, cyber attacks,
Sudan's Blue Nile (النيل الأزرق), events in Israel/West Bank (the Jordan Valley on the Israeli side, Eilat), Lebanon's
"العقبة" hill, trials, deaths announced later of soldiers wounded on an earlier day (the event is the earlier day:
record it on that day only if the post says which day).

## Day
The day in Jordan time of the event. A post at 01:00 about "explosions now" is that day. "الليلة الماضية / last
night" in a morning post is the previous date. A later post that names the date ("يوم 17 يوليو") gives that date.

## Output
Write a JSONL file (path given to you), one line per event:
{"day":"2026-07-17","place":"Muwaffaq Salti Air Base","lat":31.8267,"lng":36.7822,"newplace":false,
 "kind":"intercept|debris|hit|blast|attack","actor":"iran|iraqi_militias|unclear",
 "claim":true|false, "refs":["naya_foriraq/12345","ajanews/678"], "quote":"<exact words copied from the first ref's text, 5-25 words, naming the act and the place>",
 "en":"<one short English line: what happened, who says it>"}
- Use places from jo-places.txt; the most precise place the posts name. Several places that day = several events.
  "Jordan (place not stated)" only when no place is named that day.
- actor: who launched it (iran when the posts say Iran/IRGC/Iranian missiles; iraqi_militias when from Iraq/the
  Iraqi factions; else unclear). claim:true when the only source is the attacker's own claim.
- refs: every post in your file that reports that event (the bracket ids), first the clearest.
- quote must be copied exactly from the first ref's text.
Then, at the end of your reply, give: number of events, and 5 posts you were unsure about with one line why.
