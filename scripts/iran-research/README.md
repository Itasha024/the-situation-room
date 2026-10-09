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
    - Yemen's and Gaza's are left off this map.
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
