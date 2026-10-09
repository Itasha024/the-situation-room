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
