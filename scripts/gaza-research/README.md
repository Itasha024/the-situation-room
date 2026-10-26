# The Gaza – Judea & Samaria desk's research (26 Oct 2026)

User, 26 Oct: everything on the desk counts from the ceasefire of 10 Oct 2025 — the map's events, the numbers in
every category — with the timeline from 7 Oct 2023 and explainers further back. The desk itself began reading on
23 Oct 2026; what came before is researched here, once.

1. **Map** — second pass, 26 Oct (user: "it needs to be very accurate … more and more sources palestinian and
   israeli"). The first pass (`read.mts`, rules only) misplaced and misattributed too many; it is kept for reference.
   - Dump: each channel's t.me/s pages from 10 Oct 2025 (`scripts/iran-research/tgpage.mjs`, one JSON line a post).
     Israeli: Emanuel Fabian, IDF, Magen David Adom, Abu Ali Express. Palestinian: Quds News Network (English), Safa,
     WAFA, the PA and Gaza health ministries, Gaza Civil Defence, the Gaza Media Office, Osama al-Kahlout, Jenin News,
     Tulkarm Net, Tubas Times. (QNN's Arabic channel repeats its English one and is left out.)
   - Pre-filter: a post with an act (English, Arabic or Hebrew words) and a place the gazetteer knows, by its Latin or
     its Arabic/Hebrew name; at most a few posts per place and day, Israeli and Palestinian channels in turn.
   - Read: batches of whole days, each read by a model with the rules in `RULES-map.md` (what is an event, its day,
     place, side, kind and label in the desk's words, Palestinian accounts as claims, one entry per event, every
     post that tells it).
   - Build (`pins-build.mts`): the place from the gazetteer, else the town the reader named; Israeli citizens' acts
     in Judea and Samaria only; the label in the desk's words, or dropped. Out: `public/gaza-map-pins.json`
     `[day, side, lat, lng, kind, place, label, source, url, also]` (kind: 0 strike, 1 clash, 2 funeral), read by
     app.js `loadGazaPast` for the days before the desk's first live pin.
2. **Numbers** (`numbers-build.cjs`): research files (web OSINT, every figure with its source, date and link) —
   casualties, aid, the day after, security, Judea and Samaria, the PA, the PA's money, sanctions, hostages — into
   `public/gaza-numbers.json`. It refuses a file that breaks the desk's words. The live boxes
   (`/api/gaza-numbers`: the Health Ministry's running count, the crossings, the latest aid trucks with their span)
   take the place of a researched box of the same title; the page adds the map's events by side and area and the
   IDF-held share.
3. **Timeline** `public/gaza-timeline.json` (7 Oct 2023 – now) and **explainers** `public/gaza-explain.json`
   (before 7 Oct 2023: Oslo to 2023, Areas A/B/C, UNRWA, Jerusalem), shown in full on the desk's guide page.
