# The Iran map's research by hand (9 Oct 2026)

One-time reading of the desk's own sources' history, no model quota (user, 9 Oct).
Run from a scratch folder; outputs are JSONL lines for `scripts/iran-research.mts`.

1. `node tg-dump.mjs <channel> <first id> <last id>` — a Telegram channel's posts (t.me/s pages), line breaks kept.
   Read: Ali Shoaib's page (alichoeib1970), NNA (NNA_Leb), IDF Arabic, IDF Farsi.
2. Places: Lebanon's towns and villages from OpenStreetMap (Overpass, `place=*` and admin boundaries) into `osm-lb.json`;
   `node lebanon-places.cjs` adds the villages OSM misses or spells otherwise, by hand from GeoNames.
3. Readers:
   - `ali-shoaib.cjs` — the page's daily summary of Israel's attacks, village by village: air and drone strikes and
     shelling only (no flares, sound bombs, gunfire sweeps, demolitions, burnings, leaflets, troop moves).
   - `nna.cjs` — NNA's strike headlines; the names after a trigger word, longest first, the first that is a town wins.
     No warnings, threats, denials, hovering drones, police detonations or next-day reports; no district named as a region.
   - `idf.mts` — strikes the IDF says it carried out at a place on the desk's list (not its warnings).
4. `npx tsx scripts/iran-research.mts --events <file> --gaz Lebanon=osm-lb.json` merges each into
   `public/iran-strikes-baseline.json`: grounded in the source's text, a town not a province, inside the map's scope,
   one pin per place and day (a second source is its "also").

Each reader's output was read in samples by hand against its posts before merging.

## Round 2 (9 Oct night): Israel, the sea, CENTCOM

- **Home Front Command:** every alert since 28 Feb, from the public dataset of its alert history
  (github.com/dleshem/israel-alerts-data, `israel-alerts.csv`; checked against oref.org.il's own history API),
  with each locality's position from Tzeva Adom's `cities.json`.
  - `node oref-salvos.cjs`: chains alerts of one kind within 5 minutes into a salvo, then splits it into
    12 regions. Each salvo and region is one pin, at the alerted place nearest the region's centre.
  - `node oref.cjs`: says who fired, from Israeli channels' flashes within 25 minutes before and 20 after
    (N12chat, hazfon1, israel1, read with `tg-dump.mjs`).
    - Only short posts count. Hedged posts don't, and neither do posts about launches at another country.
    - The posts in the window vote.
    - Lebanon's own warning counts. A short-range attack on the north with no long-range warning is Lebanon's.
    - Gaza's are left off this map (Yemen's are on it since the second pass).
- **UKMTO:** the 2026 warnings (PDFs) found through the site's own archive search, read in a browser (the
  site's protection blocks plain downloads), plus its incident list (positions for 104 on) and two warnings
  posted only as pictures on X.
  - Read by hand into `ukmto-hand.txt`; `node ukmto.cjs` builds the events, each linked to its PDF (`ukmto-pdfs.txt`).
  - Gulf, Hormuz, Gulf of Oman and Arabian Sea only. The Red Sea and the Gulf of Aden are the Yemen
    desk's, and piracy is no part of this war.
- **CENTCOM:** its site blocks readers, so its X posts are read by id.
  - `xids.mjs`: reads the posts through FxTwitter, taking the ids from the Wayback Machine's index of
    x.com/CENTCOM/status. (`xdump.mjs` reads only an account's latest 20, since FxTwitter's timeline has no paging.)
  - Read by hand into `centcom.cjs`: only attacks with a named place and a day.
- Pins can carry `at` (their own time) and `lat`/`lng` (the source's position). One attack, one pin:
  - Two timed reports from one source are two attacks.
  - A ship attack reported a day apart is one attack when within 25 km, or at the same distance off the same town.

## Round 2, second pass (9 Oct, user's corrections)

- **Salvos minutes apart are separate pins.** `oref-salvos.cjs` also ends a salvo when a place already
  alerted in it is warned or alerted again 3 minutes or more later, or after its "event over" message.
  Checked against the Israeli flashes per day: 2,029 salvos instead of 1,817.
- **Who fired** (`oref.cjs`):
  - A flash naming both the alerted area and the weapon decides alone (a drone from Yemen at Eilat amid
    flashes about Iran's missiles).
  - The IDF's or the Home Front Command's own word ("צה"ל: ...", with the colon) weighs most, and its
    word on alerts after them counts up to an hour later.
  - Where the long-range warning sounded, flashes about Lebanon don't count; Yemen never reaches the north;
    a short-range alert on the Gaza border is Gaza's unless a flash names the south and the weapon.
- **Yemen's launches at Israel are on the map** (user: since 28 Feb). Iran-places scope: the Houthis in
  Israel only; their war at sea and in Yemen stays the Yemen desk's.
- **CENTCOM again** (`centcom2.cjs`): an area it names counts ("Iran's coastline near the Strait of Hormuz",
  "eastern Iraq"). Its posts link to press releases on centcom.mil, which refuses readers; the releases
  are read in full on DVIDS (dvidshub.net, the US military's media site), and one from late May on the
  Wayback Machine. Still out: strikes with no place, tallies, redirected ships.
- **UKMTO's missing numbers**, from its own daily summaries (pictures on X): 027 was never issued, 058 is
  "not in the public domain", 042 was an incident with no warning at the owner's request. 033 and 040 are
  in no Gulf or Gulf of Oman summary. 095, 097 and 098 are in the Red Sea (the Yemen desk's), 096 is the
  US disabling the tanker Lavine, 125 is an advisory. 099 and 100 are not posted; the IRGC's own claim of
  three tankers attacked that night is pinned.
- **`hand.cjs`**: attacks read by hand from any dumped Telegram channel, one line each, the post's text
  kept with it (`hand-a2.txt`: the F-15E shot down over south-west Iran and the rescue fighting,
  Yemen's drone at Eilat stopped before alerts).
- `scripts/iran-countries.mjs`: Judea and Samaria (the West Bank) joined to Israel's shape in its colour.

## Stage B part 3 and stage C (10 Oct): the news, the axis, Iran's channels and the opposition's

Reports count, not only official statements (user: "of course its a report not a confirmation"). One attack, one
pin: a report that falls on a pin of that day nearby (the city, or the country when it names no place) takes that
pin's point, so the merge makes it a second source.

- **Read** with `dumpto.mjs` (t.me/s pages, in parallel ranges): Al Hadath, Al Jazeera (ajanews), Al Arabiya,
  Al Mayadeen; Fars, IRNA, Akhbar-e Fori; Iran International, Vahid Online; the axis channels already dumped.
  The UAE's own accounts on X by Wayback ids (`cdx.mjs`, `xids2.mjs`): its defence ministry and the Dubai, Abu
  Dhabi, Sharjah, Ras al-Khaimah and Ajman media offices.
- **`gulf.cjs`**, the Gulf states, Jordan and the sea: the channels' own reports beside the officials' words
  ("انفجارات تهز دبي", "مراسل الجزيرة: اعتراضات صاروخية في المفرق", Iran's and the Iraqi factions' claims).
  Places as whole words ("جدة" is not in "المتواجدة"); a weak name ("العين", "العقبة") only with its country named;
  a city dropped when a site in it is named. Not: sirens alone, launches toward Israel crossing Jordan, someone
  else's words (Israel's officials, ministers; Israel's media do count), satellite pictures and other later
  reports, Yemen's front. Ships: attacks, blasts at sea, carriers struck, UKMTO or not; Red Sea and Aden left
  to the Yemen desk, Iran's own coast to Iran's sources.
- **`axis.cjs`** on the news channels for Iraq; sites as whole words ("حرير" is not in "التحرير": 9 old pins of
  Lebanon's and Yemen's "liberation" at the Harir base removed), hashtags read as words.
- **`nna.cjs`** on the news and axis channels for Lebanon: a headline naming Lebanon and no other front; no
  footage, no attack on Israel or its troops, no district read as a strike of its own ("X في قضاء بنت جبيل").
- **`iran.cjs`**, attacks on Iran: towns from GeoNames (20,000 people or a seat) and Tehran's quarters, a site
  list (Natanz, Fordow, Parchin, Kharg ...). The act must be told of the place itself (within nine words before
  it or four after). Not: someone's words, footage, warnings, controlled blasts of old munitions, mines,
  accidents, weather, Iran's own launches, armed attacks inside Iran, the war elsewhere. Who: Israel or the US
  when named; Iran's air defences when they are what was seen.

## Round 31, more sources and one event one pin (10 Oct, user's corrections)

- **Ilia** (t.me/iliaen, an opposition channel) read by `iran.cjs` with the other Persian channels.
- **Israel's channels for attacks in Iran** (N12, Hazfon, Israel1, in Hebrew), read by `iran.cjs`: Iran's towns
  and sites as Israel's media spell them, glued to "ב" or after a cue; a name that is a word or a place in Israel
  too ("קום", "רשת", "משהד") only with Iran named. Not: launches from Iran, alerts, threats, analysis, footage,
  arrests, someone's words in quotes, Lebanon and the other fronts.
- **`gulf-fa.cjs`**: attacks in the Gulf states, Jordan, Iraq and at sea from Iran's Persian channels and the
  opposition's (Fars, IRNA, Akhbar-e Fori, Iran International, Vahid Online, Ilia). Iran's forces' claims are
  "Iran says it struck"; an Iranian ship struck is the US's or Israel's attack. Not: footage, digests, tallies,
  history, a commander's or a paper's words, the Yemen and Lebanon fronts.
- **Snapping in one country only** (`country-at.cjs`, the map's own borders): a report snaps onto a pin of that
  day only inside its own country, and never onto an Israeli alert pin. Before, Irbid's 40 km reached Tirat Zvi and
  Jordan "in general" reached Ein Gedi: 18 such second sources removed, and those reports are Jordan's pins now.
- **One strike between two villages is one pin** (`lb-between.cjs`, and `nna.cjs` from now on): "غارة بين بلدتي
  فرون والغندورية", or one strike on "the outskirts of the two villages", had been pinned at both. The second
  folds into the first ("between Froun and Ghanduriyah"); a pin another report also holds stays that report's.
  Strikes in the plural on two villages stay two.

## Round 31, the reading method (user, 10 Oct: "search by words is not very smart")
Word readers miss what is said another way and catch what only looks like an attack. Beside them now:
1. **Broad candidates** (`cands.cjs <country> out.jsonl <dumps...>`): every post since 28 Feb, from every channel
   dumped (the news channels, the axis's, Iran's, the opposition's, Israel's, the country's own: for Jordan, Petra,
   Jfra News and Roya TV), that names the country or one of its places in any language and any word of war. Copies
   across channels are one candidate with their refs.
2. **Reading**: the candidates are read post by post by Claude readers (not the site's AI quota), in date batches,
   with `read-instructions-<country>.md` and the country's place list: each physical attack, a place a day, its
   refs and a quote copied from the first.
3. **Grounding and merge** (`read-merge.cjs <Country> <cands> <baseline> <out> <events...>`): the quote must be in
   the post, the refs must be candidates; a reading on a pin of that day nearby is its second source.
4. **Checking the old pins**: a pin whose post no reader took as an attack is read again; wrong ones go.
Jordan, the first country read this way: 4,516 candidates; 20 old pins removed (a missile painted blue, "الأزرق",
read as Azraq; a CH5 drone read as the H5 base; the Blue Stream pipeline; a C-17's emergency call; a WSJ report of
an earlier hit), 33 added (Iraqi factions' claims on King Faisal, King Abdullah II and Queen Alia bases, Ruwaished,
Tower 22, Amman's interceptions...). 171 Jordan pins. The word reader's place patterns are fixed to match.
5. **Sirens and explosions heard** are events of their own (user, 10 Oct), in every country but Israel (its alerts are
   the Home Front Command's): a second reading pass over the posts that tell sirens or blasts (`sirsub.cjs`). The map
   no longer treats "sirens" as no attack, except in Israel (iran-places.ts). Out: a test, a drill, a fault or an
   accident by the country's own word; Saudi Arabia's unattributed blasts on the Houthi front (the Yemen desk's).
6. **Source by source** (`src-cands.cjs`, `read-instructions-src.md`, `src-merge.cjs`): every post of every channel
   with a word of war in any language, no country asked, read whole channel by channel; the reader names the place
   as written and the merge's gazetteers place it. Copies across channels are one line with their refs.
The Gulf read (26,932 candidates, 51 batches, then 8 siren batches): 97 old pins that were no attack removed ("طريف",
funny, read as Turaif; an investment "targeting" schools; Yemen's launches; later reports; flights), the readings
merged as new pins or second sources. Jordan with its sirens: 205 pins.
