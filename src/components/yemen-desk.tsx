"use client";

import { useEffect } from "react";

/**
 * The desk shell. Kept byte-for-byte in step with public/desk.html: the same
 * markup is served statically and through the app router, and public/app.js
 * drives both.
 */
const DESK_HTML = `
<header class="top">
  <div class="brand">
    <h1>Yemen War Desk</h1>
    <p class="sub">Open-source intelligence, updated continuously</p>
  </div>
  <div class="stamp">
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
      <span class="ls-meta" id="live-scan-meta">Not scanned yet</span>
    </summary>
    <div class="ls-list" id="live-scan-list"></div>
  </details>
</section>
<div class="toolbar">
  <div class="time-filter" id="time-filter" title="Pick a day, or show the whole conflict">
    <span class="tf-label">Map:</span>
    <button type="button" id="btn-day-prev" class="day-nav" aria-label="Previous day"><span class="day-nav-arr" aria-hidden="true">←</span><span class="day-nav-txt">Back</span></button>
    <input type="date" id="map-date" min="2026-07-01" />
    <button type="button" id="btn-day-next" class="day-nav" aria-label="Next day"><span class="day-nav-txt">Forward</span><span class="day-nav-arr" aria-hidden="true">→</span></button>
    <button type="button" id="btn-day-today">Today</button>
    <span class="tf-sep" aria-hidden="true"></span>
    <button type="button" id="btn-conflict-all" aria-label="Whole conflict"><span class="tf-long">Whole conflict</span><span class="tf-short">All</span></button>
  </div>
  <button type="button" class="ghost" id="btn-focus-map">Expand map</button>
</div>
<main class="stage" id="stage">
  <section class="map-wrap" id="map-wrap">
    <div id="map"></div>
    <div class="legend" id="legend"></div>
    <div class="map-chip" id="map-chip">Click a province or a mark for detail</div>
  </section>
  <div class="rail-splitter" id="rail-splitter" role="separator" aria-orientation="vertical" aria-label="Resize the report column" title="Drag to widen the report column"></div>
  <aside class="rail" id="rail">
    <div class="rail-head"><h2>Latest reports</h2></div>
    <div class="feed-fresh" id="feed-fresh" aria-live="polite"></div>
    <div class="feed-legend" id="feed-legend" aria-label="What the card colours mean">
      <span><span class="sw" style="background:#c45c26"></span>Houthi-aligned outlet</span>
      <span><span class="sw" style="background:#22c55e"></span>Government or Saudi-aligned</span>
      <span><span class="sw" style="background:#94a3b8"></span>No declared alignment</span>
    </div>
    <div id="feed" class="feed"></div>
    <button type="button" class="more" id="btn-more-reports" hidden>Show earlier reports</button>
  </aside>
</main>
<section class="fronts-wrap" id="fronts-wrap">
  <h2>Fronts</h2>
  <div id="fronts"></div>
</section>
<section class="cas-wrap" id="cas-wrap">
  <h2>The conflict in numbers</h2>
  <div id="casualties"></div>
</section>
<section class="timeline-wrap">
  <div class="timeline-head">
    <div><h2>Timeline</h2></div>
    <button type="button" id="btn-now" class="ghost" title="Select the current phase and reset the map to today">Jump to now</button>
  </div>
  <div class="timeline" id="timeline"></div>
  <div class="phase" id="phase"></div>
</section>
<footer>
  <span id="attrib"></span>
  <span id="disclaimer"></span>
</footer>
<div id="front-float" hidden></div>
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
      dir="ltr"
      lang="en"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: DESK_HTML }}
    />
  );
}
