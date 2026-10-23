"use client";

import { useEffect } from "react";

/**
 * The Gaza – Judea & Samaria desk's shell (user, 23 Oct). The Iran desk's parts by the same class names,
 * so desk.css, themes.css and ops.js dress it; public/app.js reads data-desk="gaza" and draws it with the
 * Iran desk's code and this desk's own sides and source groups. Parts still being built say so.
 */
const SOON = (what: string) => `<p class="soon">Coming soon: ${what}</p>`;

const LEANS: [string, string, string][] = [
  ["israel", "#3b82f6", "Israeli"],
  ["pa", "#eab308", "Palestinian Authority"],
  ["factions", "#16a34a", "Hamas and the factions"],
  ["palestinian", "#ef4444", "Palestinian"],
  ["arab", "#c45c26", "Arab"],
  ["intl", "#94a3b8", "International"],
];

const GAZA_HTML = `
<div class="mast">
  <span class="mast-date"></span>
  <div class="mast-mid">
    <a class="mast-name" href="/" aria-label="The Situation Room"><span class="mn">The Situation Room</span></a>
    <span class="mast-line">Open-source intelligence</span>
  </div>
  <span class="mast-end"></span>
</div>
<header class="top">
  <div class="brand">
    <h1 class="desk-label"><span class="dl-pre">Desk:</span> <span class="dl-name">Gaza – Judea &amp; Samaria</span></h1>
  </div>
  <div class="stamp">
    <span class="ye-clock" title="The time in Jerusalem"><span class="yc-label">Jerusalem</span><time id="ye-clock">--:--:--</time></span>
    <span class="pulse" aria-hidden="true"></span>
    <span id="updated">Being built</span>
  </div>
</header>
<div class="toolbar">
  <div class="time-filter" id="time-filter" title="Pick a day, or show every day since the desk began">
    <span class="tf-label">Map:</span>
    <button type="button" id="btn-day-prev" class="day-nav" aria-label="Previous day"><span class="day-nav-arr" aria-hidden="true">←</span><span class="day-nav-txt">Back</span></button>
    <input type="date" id="map-date" min="2026-10-23" aria-label="Day" />
    <span class="tf-range" id="tf-range" hidden><span class="tf-to" aria-hidden="true">to</span><input type="date" id="map-to" min="2026-10-23" aria-label="To" /></span>
    <button type="button" id="btn-day-next" class="day-nav" aria-label="Next day"><span class="day-nav-txt">Forward</span><span class="day-nav-arr" aria-hidden="true">→</span></button>
    <button type="button" id="btn-day-today">Today</button>
    <span class="tf-sep" aria-hidden="true"></span>
    <button type="button" id="btn-conflict-all" class="on" aria-label="Every day since the desk began, 23 Oct 2026"><span class="tf-long">Since 23 Oct</span><span class="tf-short">All</span></button>
    <button type="button" id="btn-period" aria-expanded="false" aria-controls="tf-range" aria-label="Pick your own dates">Custom</button>
  </div>
</div>
<main class="stage" id="stage">
  <section class="map-wrap" id="map-wrap">
    <div id="map"></div>
    <button type="button" class="map-full" id="btn-focus-map" aria-pressed="false" aria-label="Full screen map" title="Full screen"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="mf-open" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path class="mf-close" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg></button>
    <div class="legend" id="legend"><div class="leg-head"><span class="leg-title">Legend</span></div></div>
  </section>
  <div class="rail-splitter" id="rail-splitter" role="separator" aria-orientation="vertical" aria-label="Resize the report column" title="Drag to widen the report column"></div>
  <aside class="rail" id="rail">
    <div class="rail-head"><h2>Latest reports</h2><button type="button" class="feed-search-btn" id="btn-feed-search" aria-label="Search all reports" aria-expanded="false" aria-controls="feed-search" title="Search all reports"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.6"/><path d="M12.8 12.8l4.6 4.6"/></svg></button></div>
    <form class="feed-search" id="feed-search" role="search" hidden><input type="search" id="feed-q" placeholder="Search all reports: a place, a person, a weapon" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Search all reports" maxlength="120"/><button type="submit" class="fs-go">Search</button></form>
    <div class="feed-sub" id="feed-sub" aria-hidden="true"><span>All reports</span><small>Newest first</small></div>
    <div class="feed-legend lf" id="feed-legend">
      <button type="button" class="lf-btn" aria-expanded="false" aria-haspopup="true" aria-controls="lf-menu"><span class="lf-sws" aria-hidden="true"></span><span class="lf-label">All sources</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5"/></svg></button>
      <div class="lf-menu" id="lf-menu" role="group" aria-label="Show only reports from" hidden>
      <button type="button" class="lf-all" aria-pressed="true">All sources</button>
      ${LEANS.map(([k, c, n]) => `<button type="button" class="lean-f" data-lean="${k}" aria-pressed="false" disabled><span class="sw" style="background:${c}"></span>${n}</button>`).join("\n      ")}
      </div>
    </div>
    <div class="feed-note" id="feed-note" aria-live="polite" hidden></div>
    <div id="feed" class="feed">${SOON("reports from every side, from 23 October 2026.")}</div>
    <button type="button" class="more" id="btn-more-reports" hidden>Show more results</button>
  </aside>
</main>
<section class="situation" id="situation" tabindex="-1">
  <h2>Latest developments</h2>
  ${SOON("the main developments in Gaza and in Judea and Samaria, each its own list, most important first, every 3 hours.")}
</section>
<section class="cas-wrap" id="cas-wrap">
  <h2>In numbers</h2>
  <div id="gaza-numbers">${SOON("casualties, territory, aid, attacks and incidents, sanctions and the Palestinian Authority's money, counted from 23 October 2026.")}</div>
</section>
<footer>
  <span id="attrib"></span>
</footer>
`;

export function GazaDesk() {
  useEffect(() => {
    const boot = window.startYemenDesk;
    if (boot) void boot();
  }, []);

  return <div id="yemen-desk-root" data-desk="gaza" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: GAZA_HTML }} />;
}
