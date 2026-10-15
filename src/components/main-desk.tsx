"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { focusById, type FocusId } from "@/lib/region";
import { placeHeadHtml } from "@/lib/main-desk/place-head";
import type { MainDeskHandle } from "@/lib/main-desk/engine";

/**
 * The main desk (option C): the whole region on one map, then one wire for
 * every desk. The markup is a shell; src/lib/main-desk/engine.ts fills it
 * from /api/region. A country or sea page (/lebanon) is the same page with
 * its place in focus, so moving between places only flies the map. The masthead is the site's own (public/app.js adds its
 * menu and theme switch), so every page reads as one paper.
 */
const mainHtml = (focus: FocusId | "region") => {
  const f = focus === "region" ? undefined : focusById(focus);
  return `
<div class="mast">
  <span class="mast-date"></span>
  <div class="mast-mid">
    <a class="mast-name" href="/" aria-label="The Situation Room"><span class="mn">The Situation Room</span></a>
    <span class="mast-line">Open-source intelligence</span>
  </div>
  <span class="mast-end"></span>
</div>
<div class="md-dateline"><span id="md-dateline"></span><span class="md-clocks" id="md-clocks"></span></div>
<nav class="md-focusbar" id="md-focusbar" aria-label="Countries, seas and desks"></nav>
<section class="md-place" id="md-place"${f ? ` data-focus="${f.id}"` : " hidden"}>${f ? placeHeadHtml(f) : ""}</section>
<div id="md-key"></div>
<section class="md-lead" id="md-lead"><div class="md-loading">Loading the region…</div></section>
<section class="md-stage" id="md-stage" aria-label="Map of the region">
  <div id="md-map"></div>
  <div class="md-hud md-glass md-modes" id="md-modes"></div>
  <div class="md-hud md-alerts">
    <button type="button" class="md-glass md-hbtn" id="md-latest" title="Fly to the newest report on the map; again for the one before">Latest</button>
    <div id="md-chips" style="display:flex;flex-direction:column;gap:4px;align-items:flex-end"></div>
  </div>
  <div class="md-hud md-glass md-mini" id="md-mini" title="Click to move the map"><canvas id="md-miniC" width="360" height="252"></canvas><span class="lbl">Region</span></div>
  <div class="md-hud md-glass md-legend" id="md-legend"></div>
  <div class="md-hud md-glass md-sel" id="md-sel" role="dialog" aria-label="Selected report"></div>
  <div class="md-hud md-glass md-scrub">
    <button type="button" class="md-play" id="md-play" title="Replay the last weeks" aria-label="Replay">▶</button>
    <button type="button" class="md-sp" id="md-speed" title="Replay speed">1 day/s</button>
    <div class="md-track"><canvas id="md-trackC" height="60"></canvas><input type="range" id="md-range" min="0" max="1000" value="1000" aria-label="Day shown on the map"><div class="md-thumb" id="md-thumb"><span id="md-thumbLbl">Now</span></div></div>
    <span class="md-when"><button type="button" class="md-pill" id="md-span" title="How far back the map shows">24 h</button></span>
  </div>
</section>
<section class="md-below">
  <div class="md-col" id="md-feed"></div>
  <div class="md-col" id="md-sidecol"></div>
</section>
<div class="md-toast" id="md-toast" role="status"></div>
`;
};

export function MainDesk({ focus = "region" }: { focus?: FocusId | "region" }) {
  const navigate = useNavigate();
  const engine = useRef<MainDeskHandle | null>(null);
  const want = useRef(focus);
  want.current = focus;
  // Written once, as one object: React 19 rewrites the shell (and the map in it) whenever
  // this object is new, even with the same text.
  const [html] = useState(() => ({ __html: mainHtml(focus) }));

  useEffect(() => {
    let gone = false;
    // The old /yemen address carried the Yemen desk's card links (#n=…, #r=…): they go to the desk.
    if (focus === "yemen" && /^#(n|r)=/.test(location.hash)) {
      location.replace(`/yemen-conflict-desk${location.hash}`);
      return;
    }
    // The site's masthead menu and theme switch, from public/app.js (window.startDeskDoc,
    // typed in desk-doc.tsx); app.js loads after the page, so try again for a few seconds.
    let tries = 0;
    const mast = () => {
      if (gone) return;
      if (window.startDeskDoc) return window.startDeskDoc();
      if (tries++ < 40) setTimeout(mast, 150);
    };
    mast();
    void import("@/lib/main-desk/engine").then((m) => {
      if (gone) return;
      engine.current = m.startMainDesk({
        focus: want.current,
        onFocus: (f) =>
          void navigate(f ? { to: "/$place", params: { place: f.slug }, resetScroll: false } : { to: "/", resetScroll: false }),
      });
    });
    return () => {
      gone = true;
      engine.current?.stop();
      engine.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The address changed (a place picked, or Back): the map flies there.
  useEffect(() => {
    engine.current?.focus(focus);
  }, [focus]);

  return <div id="main-desk" className="md" suppressHydrationWarning dangerouslySetInnerHTML={html} />;
}
