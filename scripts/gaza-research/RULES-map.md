# Reading posts into map events — Gaza and Judea & Samaria, 10 Oct 2025 – 22 Oct 2026

You read one batch file of Telegram posts and write the map events they tell. Accuracy is everything: a wrong
side, a wrong place or a non-event on the map is worse than a missing pin. When unsure, leave it out.

## Input
Lines grouped under `=== YYYY-MM-DD` (the day the post was published, Israel time). Each line:
`channel:postId [places our gazetteer matched in the post] text (cut at 300 chars)`

Channels and who they are:
- Israeli: `manniefabian` (Times of Israel military reporter: IDF/police/Shin Bet statements), `IDFofficial` (IDF English), `mdaisrael` (Magen David Adom, Hebrew), `AbuAliExpress` (Hebrew, Arab affairs), `cogatonline` (COGAT).
- Palestinian: `QudsNen` (Quds News Network, English), `qudsn` (same, Arabic), `SafaPs` (Safa agency, Hamas-aligned), `WAFAgency` (WAFA, the PA's agency), `palmoh` (PA Health Ministry, Ramallah), `MOHMediaGaza` (Gaza Health Ministry, Hamas-run), `dcdgaza` (Gaza Civil Defence, Hamas-run), `mediagovps` (Gaza Government Media Office, Hamas-run), `osama1984osama` (Gaza journalist), `jeninnews1`, `TulkaremNet`, `TubasTimes` (local J&S news).

## What is an event (keep)
One physical act, on one day, at one place in Gaza or Judea and Samaria (East Jerusalem included), or a Palestinian attack on Israelis inside Israel:
- IDF/police/Shin Bet: air or drone strikes, shelling, gunfire at people, raids, arrests, demolitions, bulldozing, closures/sieges of a town, troops killing or wounding someone, a "terrorist eliminated".
- Palestinian attacks: shootings, stabbings, rammings, explosive devices, rockets, stones/firebombs at cars, armed clashes with troops.
- Israeli citizens' acts in Judea and Samaria: extremists' attacks on Palestinians, arson, crops/olive trees cut, livestock stolen, homes or cars torched, assaults; also an outpost set up by force.
- Inside Gaza: Hamas vs clans/militias (Popular Forces, Abu Shabab etc.) clashes, Hamas executions or shootings of people.
- PA security forces' operations (raids, arrests, clashes with gunmen).
- Funerals of people killed that day or the day before: kind "funeral" (only if the killing itself is not already an event at the same place and day).

## Not an event (drop)
Tallies and totals ("since the ceasefire", "in the past 24 hours", "the toll rises to"), lists of names, recaps (حصاد، ملخص، أبرز), statements, condemnations, threats, calls, plans and foiled plots with no place-and-day act, court rulings, demolition ORDERS (only actual demolitions), "body recovered from the rubble" of the war before the ceasefire, hostage body handovers, aid trucks, crossings, weather, prices, protests abroad, opinion, features, interviews, anniversaries, old events retold, "first-time footage" of an earlier attack, Temple Mount visits by Israelis with no violence, road accidents and crime inside Israel (most MDA posts), the war with Iran/Lebanon/Yemen/Syria.

## The day
The day the act happened: "last night", "yesterday", "overnight" in a morning post = the day before (Israel time). A post that tells an event more than 2 days back: drop it.

## The place
- Use a name from the post's `[...]` list when it is truly where the act happened. The list is a machine match and can be wrong (e.g. "Temple Mount" matched from "شهداء الأقصى" in a hospital name, "Gaza" for the whole Strip). Pick the most precise right one: a camp, neighbourhood or village over its town; the town over "Gaza".
- If the right place is not in the list, write `NEW:<English name>|<Arabic or Hebrew name as written>|<town it is near>`.
- "The Gaza Strip" with no nearer place, or no place at all: drop the event.
- A hospital is where the wounded were taken, not where the act happened; use the act's place.

## The side (who ACTED)
- `israel`: IDF, police, Border Police, Shin Bet, COGAT, Israeli aircraft, drones, tanks, bulldozers, naval boats. A Palestinian report that someone was killed/wounded/arrested by gunfire, a strike or a raid with no other actor named = israel.
- `israeli_citizens`: Israeli civilians (Palestinian sources: مستوطنون، مستعمرون، "settlers", "colonists"). ONLY in Judea and Samaria and Jerusalem, never in Gaza. A mixed attack by Israeli civilians with troops present = israeli_citizens (mention the troops in the label).
- `hamas`: Hamas, the Qassam Brigades, Hamas's internal security / Sahm / Rade'a units in Gaza.
- `factions`: Islamic Jihad / Saraya al-Quds, the other armed groups and local battalions (Jenin, Tulkarm, Nur Shams battalions), and unnamed Palestinian attackers (a stabbing, ramming, shooting at Israelis).
- `pa`: PA security forces.
- `clans`: Gaza clans and militias (Popular Forces, Abu Shabab, Hilles, Al-Mujaida, Doghmush etc.) when THEY act.
- `other`: funerals, or when the actor truly cannot be told (rare; prefer dropping).
An IDF strike on Hamas members is `israel`. Hamas executing "collaborators" is `hamas`. A gunman shot by troops after an attack: two events if both acts are clear (factions' attack, israel's fire), else the attack.

## The kind
`strike` (air/drone strike, shelling, explosion, rockets), `clash` (ground acts: raids, arrests, gunfire, stabbings, rammings, demolitions, arson, assaults, clashes), `funeral`.

## The label (English, one line, ≤ 160 chars)
Who did what, where. The desk's words, always:
- "Judea and Samaria", never "West Bank"; "Israeli citizens" or "Israeli extremists" (for violent ones), never "settlers"/"colonists"; "attacks", never "ceasefire violations".
- Never "occupation", "occupation forces" (say "Israeli forces" / "IDF"), "martyr(ed)" (say "killed"), "massacre", "aggression", "genocide", "Zionist", "storm Al-Aqsa", "resistance" for gunmen.
- A Palestinian source's account is its claim: start the label with its teller — "WAFA: ", "Palestinian media: " (QNN, Safa, local channels, journalists), "Gaza Health Ministry (Hamas-run): ", "Gaza Civil Defence (Hamas-run): ", "PA Health Ministry: ".
- An Israeli official account needs no prefix when it is the IDF/police/Shin Bet's own statement ("IDF: troops kill gunman who approached the yellow line in Beit Lahia").
- Name people only when the post names them. No adjectives.

## Merging and sources
One event = one entry, even if several posts tell it. `src`: every post that tells it, `channel:postId`, the lead first. The lead: for an Israeli act or an attack on Israelis, the Israeli official source if present; for an Israeli citizens' act or an event only Palestinian channels report, the most specific Palestinian post. If an Israeli and a Palestinian source tell the same event differently (e.g. "gunman approached troops" vs "civilian shot"), keep ONE event, label it with the Israeli official account, and still list both posts. Two different acts at one place on one day (an IDF raid and an attack by Israeli extremists in the same village) are two events.

## Output
Write a JSON array to the output path you were given, nothing else in the file:
`[{"day":"2026-10-02","place":"Khan Younis","side":"israel","kind":"strike","label":"IDF: strike in Khan Younis kills Hamas sniper Tamer Hamaida","src":["IDFofficial:19304","manniefabian:59302","qudsn:740663"]}]`
Check it parses (`node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" <file>`). Reply only: the number of events and the number of posts dropped as non-events, plus any doubt worth a human look (one line each, at most 5).
