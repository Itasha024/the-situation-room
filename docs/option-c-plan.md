# Option C: one main desk, countries in focus, desks per war

Built on the `option-c` branch. Nothing goes live until the user says so. `main` stays deployable for the daily desk work.

## The shape

- **Main desk** `/`: one map and one wire for the whole region.
- **Countries and seas** (focus): `/yemen`, `/saudi-arabia`, `/red-sea`, `/iran`, `/hormuz`, `/israel`, `/lebanon`, `/iraq`, `/gulf-states`, `/united-states`. Each has the same map and wire narrowed to that place, plus its categories, who is active, places, latest developments and timing.
- **Desks** (one per war, today's pages):
  - Yemen desk `/yemen-conflict-desk`
  - Iran desk `/iran-conflict-desk`: the Iran war and every country in it
  - Gaza and Judea and Samaria desk (planned: a regular desk plus social-media monitoring; it gets its own build)
- **One report = one card**, tagged with its place, its countries, its desks and a category. It shows wherever it belongs, never copied.
- Report `/r/<id>`, place `/place/<name>`, dated brief `/brief/<desk>/<date>`.

## Stages (stop after each so the user can review and compact)

1. **Data.** Tags for every report (countries, desks, category, sea or land) as it is served. A new `/api/region` merges both desks: same story once, the newest first, filters by focus and desk. Tests. A local preview copies the live public feed into the local store (read-only) so the preview shows real reports.
2. **Main desk page** `/`: masthead, focus bar, key event, lead, the map under the headline (modes, replay strip, minimap, selected-report card, semantic zoom), the wire (cards, log, table, developing stories, threads) and "Across the region". Day and night themes from the site's own theme file.
3. **Country and sea pages**: the map flies to the focus, neighbours dim, category tabs, latest developments from the desks' briefs, who is active, places, the hour clock, a figures strip. A real title and description per page for search.
4. **Desks as war pages**: the Yemen and Iran desks keep their full layout and gain the shared masthead and focus bar. `/` stops being the Yemen desk. The menus in app.js point to the new pages. The Gaza and Judea and Samaria desk appears as "coming".
5. **Report, place and dated-brief pages**, server-rendered, with a sitemap.
6. **Tools**: following, share this view, compare two dates, guided tour, daily map card, embed, glossary tooltips, the opening replay, keys.
7. **Checks**: tests, typecheck, build, browser check on desktop and phone. Then the user reviews it locally. Live only on the user's word.

## Rules carried over

- Copy rules unchanged: cards are shown as stored, no sourcing labels in copy.
- No counts on the main page (user, 9 Oct). Figures only on country and desk pages.
- No sound, no scores, no red-vs-blue sides; a hollow pin = one side's account so far (legend only).
- Free tiers only; the region API is a read, never a scan.
