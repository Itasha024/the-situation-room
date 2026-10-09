"use client";

import { useEffect } from "react";

/**
 * The Iran desk's shell (Round 30). The same parts as the Yemen desk, by the
 * same class names, so desk.css and themes.css dress both; public/app.js reads
 * data-desk="iran" and fills what is ready. Parts still being built say so.
 */
const SOON = (what: string) => `<p class="soon">Coming soon: ${what}</p>`;

const LEANS: [string, string, string][] = [
  ["iran", "#c45c26", "Iran and Axis-aligned"],
  ["opp", "#a855f7", "Iranian opposition"],
  ["il", "#3b82f6", "Israeli"],
  ["us", "#ef4444", "US"],
  ["gulf", "#22c55e", "Gulf and Arab"],
  ["intl", "#94a3b8", "International"],
];

const ARENAS: [string, string][] = [
  ["Strait of Hormuz", "The war at sea and around the Gulf: ship attacks, seizures, the US blockade, Iran's rules for passage, mines, transits, escorts, insurance."],
  ["Talks", "Iran–US, Oman, Qatar and any other channel; the MoU's terms; mediators' statements."],
  ["Nuclear file", "The IAEA, enrichment, the sites, inspections, NPT moves."],
  ["Inside Iran", "Fuel and gas, the economy and the rial, imports and exports, protests, arrests, executions, power struggles."],
  ["Sanctions", "New US, EU and UN sanctions, waivers, enforcement, shadow-fleet seizures."],
  ["Lebanon", "Israel's strikes and ground war in Lebanon, Hezbollah, the Lebanese dead and wounded, Israeli–Lebanese talks."],
  ["Axis of Resistance", "The Iraqi and Syrian militias, the Houthis' Iran side."],
  ["The U.S.", "What the US itself does and says on the war, in the region and at home: forces, the blockade, Congress, polls, gasoline prices."],
];

const NUMBERS = [
  "Killed, by country",
  "Maritime incidents",
  "Crude oil through Hormuz",
  "LNG through Hormuz",
  "Ships through Hormuz",
  "Attacks on energy sites inside Iran",
  "Iran crude exports",
  "Gulf crude exports",
  "Crude oil price",
  "The rial's open-market rate",
  "US gasoline price",
];

const IRAN_HTML = `
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
    <h1 class="desk-label"><span class="dl-pre">Desk:</span> <span class="dl-name">Iran conflict</span></h1>
  </div>
  <div class="stamp">
    <span class="ye-clock" title="The time in Iran (Tehran)"><span class="yc-label">Tehran</span><time id="ye-clock">--:--:--</time></span>
    <span class="pulse" aria-hidden="true"></span>
    <span id="updated">Being built</span>
  </div>
</header>
<section class="situation" id="situation" tabindex="-1">
  <h2>Latest developments</h2>
  ${SOON("the main developments, most important first, every 3 hours.")}
</section>
<section class="live-scan" id="live-scan-box">
  <details id="live-scan-details">
    <summary>
      <span class="ls-title">Live scan</span>
    </summary>
    <div class="ls-list" id="live-scan-list">${SOON("the sources the desk reads, as it reads them.")}</div>
  </details>
</section>
<div class="toolbar">
  <div class="time-filter" id="time-filter" title="Pick a day, or show the whole war">
    <span class="tf-label">Map:</span>
    <button type="button" id="btn-day-prev" class="day-nav" aria-label="Previous day"><span class="day-nav-arr" aria-hidden="true">←</span><span class="day-nav-txt">Back</span></button>
    <input type="date" id="map-date" min="2026-02-28" aria-label="Day" />
    <button type="button" id="btn-day-next" class="day-nav" aria-label="Next day"><span class="day-nav-txt">Forward</span><span class="day-nav-arr" aria-hidden="true">→</span></button>
    <button type="button" id="btn-day-today">Today</button>
    <span class="tf-sep" aria-hidden="true"></span>
    <button type="button" id="btn-conflict-all" class="on" aria-label="The whole war, since 28 Feb 2026"><span class="tf-long">Whole war</span><span class="tf-short">All</span></button>
  </div>
</div>
<main class="stage" id="stage">
  <section class="map-wrap" id="map-wrap">
    <div id="map"></div>
    <button type="button" class="map-full" id="btn-focus-map" aria-pressed="false" aria-label="Full screen map" title="Full screen"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="mf-open" d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path class="mf-close" d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg></button>
    <div class="legend" id="legend">
      <div class="leg-head"><span class="leg-title">Attacks legend</span></div>
      <div class="leg-body">
        ${[
          ["#dc2626", "Iran"],
          ["#eab308", "Hezbollah"],
          ["#f97316", "Iraqi and Syrian militias"],
          ["#2563eb", "US"],
          ["#60a5fa", "Israel"],
          ["#a855f7", "Gulf states"],
        ]
          .map(([c, n]) => `<span class="leg-item on" aria-disabled="true"><span class="sw" style="background:${c}"></span>${n}</span>`)
          .join("")}
      </div>
    </div>
    <div class="map-chip" id="map-chip">Every attack since 28 Feb 2026: coming soon</div>
  </section>
  <div class="rail-splitter" id="rail-splitter" role="separator" aria-orientation="vertical" aria-label="Resize the report column" title="Drag to widen the report column"></div>
  <aside class="rail" id="rail">
    <div class="rail-head"><h2>Latest reports</h2></div>
    <div class="trump-pin" id="trump-pin"><div class="tp-head"><b>Trump's latest</b></div></div>
    <div class="feed-legend lf" id="feed-legend">
      <button type="button" class="lf-btn" aria-expanded="false" aria-haspopup="true" aria-controls="lf-menu"><span class="lf-sws" aria-hidden="true"></span><span class="lf-label">All sources</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5"/></svg></button>
      <div class="lf-menu" id="lf-menu" role="group" aria-label="Show only reports from" hidden>
      <button type="button" class="lf-all" aria-pressed="true">All sources</button>
      ${LEANS.map(([k, c, n]) => `<button type="button" class="lean-f" data-lean="${k}" aria-pressed="false" disabled><span class="sw" style="background:${c}"></span>${n}</button>`).join("\n      ")}
      </div>
    </div>
    <div id="feed" class="feed">${SOON("reports from every side, each with its source's rating.")}</div>
  </aside>
</main>
<section class="fronts-wrap" id="fronts-wrap">
  <h2>Arenas</h2>
  ${SOON("a short overview of each arena, every 3 hours.")}
  <dl class="soon-list">${ARENAS.map(([n, d]) => `<dt>${n}</dt><dd>${d}</dd>`).join("")}</dl>
</section>
<section class="cas-wrap" id="cas-wrap">
  <h2>The conflict in numbers</h2>
  ${SOON("each number from 28 Feb 2026, with its source.")}
  <ul class="soon-list">${NUMBERS.map((n) => `<li>${n}</li>`).join("")}</ul>
</section>
<section class="timeline-wrap" id="timeline-wrap">
  <h2>Timeline</h2>
  ${SOON("from the nuclear deal of July 2015 to today.")}
</section>
<footer>
  <span id="attrib"></span>
</footer>
`;

declare global {
  interface Window {
    startYemenDesk?: () => Promise<void>;
  }
}

export function IranDesk() {
  useEffect(() => {
    const boot = window.startYemenDesk;
    if (boot) void boot();
  }, []);

  return (
    <div
      id="yemen-desk-root"
      data-desk="iran"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: IRAN_HTML }}
    />
  );
}
