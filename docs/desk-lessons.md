# Desk lessons

Every mistake the operator (or a review) found, the rule that now catches it, and its test.
Newest round first.

## Round 29 (operator's review of 3 Oct)

| Mistake | Rule now | Where | Test |
|---|---|---|---|
| Animated maps planted "ground taken" flags for a peak or positions (Jabal Habashi, Al-Wazi'iyah, 6 Oct) | A flag needs control's whole rule: combat, ground not kit or a building, the whole district, the place named, two sides or a wire. Anything less is an advance | `control-live.ts captureConfirmed`, `dev-marks.ts kindOf` | `round29.test.ts` |
| Nation's Shield's gains drawn as Houthi | Nation's Shield / Homeland Shield are government forces on the maps | `dev-marks.ts SIDE_RE` | `round29.test.ts` |
| A pin removed by hand still showed on the developments' maps | `map-fixes.json` is applied to the card marks too | `dev-marks.ts fixedPins`, `scripts/build-control.mjs` | (data) |
| Methodology pop-ups had the browser's default scroll bar | Same scroll bar as the report column | `themes.css` (.rail, .rel-pop) | (visual) |
| Maritime 14 Aug: "two dhows" | "two dhow boats"; a hand-checked row's words beat a stored copy | `ledger-baseline.ts`, `ledger.ts withBaseline` | `round29.test.ts` |
| Energy: a later report of a strike became a new attack (21 Sep, 27 Sep, 2 Oct, 4–6 Oct) | A hit is dated by the strike; the model marks `retold` (a day-later claim, fires still burning, satellite pictures, a reaction); one side's such word within 7 days of a hit is that hit | `ledger.ts applyLedger`, `RETOLD_RE`, SYSTEM | `round29.test.ts` |
| Energy: 3 Oct's one Riyadh attack in nine rows ("oil site in Riyadh", "Aramco refinery"...) | Known names for Riyadh's Aramco site, Khurais, Rabigh, the Saudi oil pipeline, the Medina power plant; airports, bases and placeless names are never sites | `ledger.ts KNOWN_SITES`, `notEnergySite` | `round29.test.ts` |
| Energy: a hand-checked link lost to a stored one (30 Sep, 1 Oct) | `fixes` in the baseline stand over stored rows; `wrong` works for ships too | `ledger-baseline.ts`, `withBaseline` | `round29.test.ts` |
| Maritime: one tanker attack in three rows (4 Oct UKMTO, an aligned channel, Seatrade next day) | `retold` ship reports join the attack within 3 days, never a new row | `ledger.ts applyLedger` | `round29.test.ts` |
| Feed cards put Yanbu, Abqaiq and Khurais in Saree's 3 Oct statement, which named Riyadh only | (for Stage 3/4: statements are summed up from their own text) | — | — |
| "Show earlier reports" and the map's past days skipped 22 Sep–5 Oct | Paging starts from the oldest stored card, not the built-in July ones; the map fetches the days it shows | `app.js pullOlderDesk`, `fillArchiveTo` | (live check) |
| Half the readers got the site as of 1 Oct | The old PC server and tunnel had come back at sign-in; stopped, scripts parked | `desk-live\bin` | (live check) |
