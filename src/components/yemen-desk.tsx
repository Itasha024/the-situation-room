"use client";

import { useEffect } from "react";

/**
 * The desk shell. Kept byte-for-byte in step with public/desk.html: the same
 * markup is served statically and through the app router, and public/app.js
 * drives both.
 */
const DESK_HTML = `
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
    <h1 class="desk-label"><span class="dl-pre">Desk:</span> <span class="dl-name">Yemen conflict</span></h1>
  </div>
  <div class="stamp">
    <span class="ye-clock" title="The time in Yemen (Sanaa and Aden)"><span class="yc-label">Sanaa</span><time id="ye-clock">--:--:--</time></span>
    <span class="pulse" aria-hidden="true"></span>
    <span id="updated">Connecting…</span>
  </div>
</header>
<section class="bars" id="bars"></section>
<section class="situation" id="situation" tabindex="-1"></section>
<section class="live-scan" id="live-scan-box">
  <details id="live-scan-details">
    <summary>
      <span class="ls-title">Live scan</span>
    </summary>
    <div class="ls-list" id="live-scan-list"></div>
  </details>
</section>
<div class="toolbar">
  <div class="time-filter" id="time-filter" title="Pick a day, or show the whole conflict">
    <span class="tf-label">Map:</span>
    <button type="button" id="btn-day-prev" class="day-nav" aria-label="Previous day"><span class="day-nav-arr" aria-hidden="true">←</span><span class="day-nav-txt">Back</span></button>
    <input type="date" id="map-date" min="2026-07-13" />
    <button type="button" id="btn-day-next" class="day-nav" aria-label="Next day"><span class="day-nav-txt">Forward</span><span class="day-nav-arr" aria-hidden="true">→</span></button>
    <button type="button" id="btn-day-today">Today</button>
    <span class="tf-sep" aria-hidden="true"></span>
    <button type="button" id="btn-conflict-all" aria-label="Whole conflict"><span class="tf-long">Whole conflict</span><span class="tf-short">All</span></button>
  </div>
    <button type="button" class="rel-btn map-meth" id="btn-map-meth" aria-expanded="false" aria-haspopup="dialog">Map methodology<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.6"/><path d="M10 9v5M10 6.2v.1"/></svg></button>
</div>
<main class="stage" id="stage">
  <section class="map-wrap" id="map-wrap">
    <div id="map"></div>
      <button type="button" class="map-full" id="btn-focus-map" aria-pressed="false" aria-label="Full screen map" title="Full screen"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="mf-open" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path class="mf-close" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg></button>
    <div class="legend" id="legend"></div>
    <div class="map-chip" id="map-chip">Click a province or a mark for detail</div>
  </section>
  <div class="rail-splitter" id="rail-splitter" role="separator" aria-orientation="vertical" aria-label="Resize the report column" title="Drag to widen the report column"></div>
  <aside class="rail" id="rail">
    <div class="rail-head"><h2>Latest reports</h2><button type="button" class="feed-search-btn" id="btn-feed-search" aria-label="Search all reports" aria-expanded="false" aria-controls="feed-search" title="Search all reports"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.6"/><path d="M12.8 12.8l4.6 4.6"/></svg></button></div>
    <form class="feed-search" id="feed-search" role="search" hidden><input type="search" id="feed-q" placeholder="Search all reports: a place, a person, a weapon" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Search all reports" maxlength="120"/><button type="submit" class="fs-go">Search</button></form>
    <div class="feed-fresh" id="feed-fresh" aria-live="polite"></div>
    <div class="feed-legend lf" id="feed-legend">
      <button type="button" class="lf-btn" aria-expanded="false" aria-haspopup="true" aria-controls="lf-menu"><span class="lf-sws" aria-hidden="true"></span><span class="lf-label">All sources</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5"/></svg></button>
      <div class="lf-menu" id="lf-menu" role="group" aria-label="Show only reports from" hidden>
      <button type="button" class="lf-all" aria-pressed="true">All sources</button>
      <button type="button" class="lean-f" data-lean="houthi" aria-pressed="false" title="Show only Houthi-aligned outlets"><span class="sw" style="background:#c45c26"></span>Houthi-aligned outlet</button>
      <button type="button" class="lean-f" data-lean="gov" aria-pressed="false" title="Show only government or Saudi-aligned outlets"><span class="sw" style="background:#22c55e"></span>Government or Saudi-aligned</button>
      <button type="button" class="lean-f" data-lean="indep" aria-pressed="false" title="Show only outlets with no declared alignment"><span class="sw" style="background:#94a3b8"></span>No declared alignment</button>
      </div>
    </div>
    <div class="feed-rel"><button type="button" class="rel-btn" id="btn-rel" aria-expanded="false" aria-controls="rel-pop" aria-haspopup="dialog">Sources reliability methodology<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.6"/><path d="M10 9v5M10 6.2v.1"/></svg></button></div>
    <div class="feed-note" id="feed-note" aria-live="polite" hidden></div>
    <div id="feed" class="feed"></div>
    <button type="button" class="more" id="btn-more-reports" hidden>Show earlier reports</button>
  </aside>
</main>
<section class="fronts-wrap" id="fronts-wrap">
  <h2>Fronts</h2>
  <div id="fronts-stamp"></div>
  <div id="fronts"></div>
</section>
<section class="cas-wrap" id="cas-wrap">
  <h2>The conflict in numbers</h2>
  <div id="casualties"></div>
</section>
<section class="timeline-wrap" id="timeline-wrap">
  <h2>Timeline</h2>
  <div id="timeline"></div>
</section>
<footer>
  <span id="attrib"></span>
</footer>
<div id="media-float" hidden></div>
`;

declare global {
  interface Window {
    startYemenDesk?: () => Promise<void>;
    L?: unknown;
  }
}

export function YemenDesk() {
  useEffect(() => {
    const boot = window.startYemenDesk;
    if (boot) void boot();
  }, []);

  return (
    <div
      id="yemen-desk-root"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: DESK_HTML }}
    />
  );
}
