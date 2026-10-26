"use client";

import { type ReactNode, useEffect } from "react";

/**
 * The desk's own pages beside the live one (the Sources list): the same
 * masthead and themes, a back link to the desk, and the text. public/app.js
 * fills the masthead and adds the theme button (window.startDeskDoc).
 */
declare global {
  interface Window {
    startDeskDoc?: () => void;
  }
}

/**
 * `back`: where the foot's link goes, the desk the page belongs to or, for the site's own pages, every desk.
 * `guide`: a desk's guide, wider, its own head (guide-kit.tsx GuideHero) in place of the title and lede.
 */
export function DeskDoc({ title, lede, children, guide = false, back = { href: "/yemen-conflict-desk", label: "Back to the live desk" } }: { title?: string; lede?: ReactNode; children: ReactNode; guide?: boolean; back?: { href: string; label: string } }) {
  useEffect(() => {
    let tries = 0;
    const boot = () => {
      if (window.startDeskDoc) return window.startDeskDoc();
      // app.js loads after the page; try again for a few seconds.
      if (tries++ < 40) setTimeout(boot, 150);
    };
    boot();
  }, []);

  return (
    <div className="doc-root" dir="ltr" lang="en">
      <div className="mast">
        <span className="mast-date" />
        <div className="mast-mid">
          <a className="mast-name" href="/" aria-label="The Situation Room">
            <span className="mn">The Situation Room</span>
          </a>
          <span className="mast-line">Open-source intelligence</span>
        </div>
        <span className="mast-end" />
      </div>
      <header className="top doc-top">
        <div className="brand">
          {/* "Desks:" and a button per desk (public/app.js installDeskPicker). */}
          <h1 className="desk-label"><span className="dl-pre">Desks:</span></h1>
        </div>
      </header>
      <main className={guide ? "doc doc-guide" : "doc"}>
        {title ? <h2 className="doc-title">{title}</h2> : null}
        {lede ? <p className="doc-lede">{lede}</p> : null}
        {children}
      </main>
      <footer className={guide ? "doc-foot doc-guide" : "doc-foot"}>
        <a href={back.href}>{back.label}</a>
      </footer>
    </div>
  );
}
