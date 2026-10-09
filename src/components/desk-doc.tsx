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

export function DeskDoc({ title, lede, children }: { title: string; lede?: ReactNode; children: ReactNode }) {
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
          <a className="desk-label-link" href="/yemen-conflict-desk">
            <h1 className="desk-label"><span className="dl-pre">Desk:</span> <span className="dl-name">Yemen conflict</span></h1>
          </a>
        </div>
      </header>
      <main className="doc">
        <h2 className="doc-title">{title}</h2>
        {lede ? <p className="doc-lede">{lede}</p> : null}
        {children}
      </main>
      <footer className="doc-foot">
        <a href="/yemen-conflict-desk">Back to the live desk</a>
      </footer>
    </div>
  );
}
