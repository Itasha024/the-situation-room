# The Gaza – Judea & Samaria desk's research (26 Oct 2026)

User, 26 Oct: everything on the desk counts from the ceasefire of 10 Oct 2025 — the map's events, the numbers in
every category — with the timeline from 7 Oct 2023 and explainers further back. The desk itself began reading on
23 Oct 2026; what came before is researched here, once.

1. **Map** (`read.mts`): the sources' Telegram history (t.me/s pages, `scripts/iran-research/tgpage.mjs`, dumped from
   10 Oct 2025): Emanuel Fabian (the IDF's and the police's own word, attacks on Israelis), the IDF's English channel,
   Quds News Network in English (the Palestinian accounts, labelled "Palestinian media:"). Read by rule, no model:
   an act and an actor in the post's first lines, a place from the desk's gazetteer (`gaza-places.ts`), the desk's
   words (`gaza-words.ts`). Not: other fronts, history, footage, statements, threats, plans, visits to the Temple
   Mount. One event one pin: same day, side and place within 1.5 km; the second source its "also".
   Out: `public/gaza-map-pins.json` `[day, side, lat, lng, kind, place, label, source, url, also]`, read by app.js
   `loadGazaPast` for the days before the desk's first live pin.
2. **Numbers** (`numbers-build.cjs`): research files (web OSINT, every figure with its source, date and link) —
   casualties, aid, the day after, security, Judea and Samaria, the PA, the PA's money, sanctions, hostages — into
   `public/gaza-numbers.json`. It refuses a file that breaks the desk's words. The live boxes
   (`/api/gaza-numbers`: the Health Ministry's running count, the crossings, the latest aid trucks with their span)
   take the place of a researched box of the same title; the page adds the map's events by side and area and the
   IDF-held share.
3. **Timeline** `public/gaza-timeline.json` (7 Oct 2023 – now) and **explainers** `public/gaza-explain.json`
   (Oslo to 2021, Areas A/B/C, UNRWA, Jerusalem), with the who's-who guide first.
