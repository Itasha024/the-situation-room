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
