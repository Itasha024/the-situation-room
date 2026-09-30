"use client";

import { useEffect } from "react";

/**
 * The desk's own pages beside the live one (Methodology, About): the same
 * masthead and themes, a back link to the desk, and the text. public/app.js
 * fills the masthead date and adds the theme button (window.startDeskDoc).
 */
declare global {
  interface Window {
    startDeskDoc?: () => void;
  }
}

export type DocSection = { id: string; title: string; html: string };

export function DeskDoc({ title, lede, sections, toc = true }: { title: string; lede: string; sections: DocSection[]; toc?: boolean }) {
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
            <h1 className="desk-label">Yemen Conflict Desk</h1>
          </a>
        </div>
        <nav className="doc-nav" aria-label="Desk pages">
          <a href="/yemen-conflict-desk">Live desk</a>
          <a href="/yemen-conflict-desk/methodology">Methodology</a>
          <a href="/yemen-conflict-desk/about">About</a>
        </nav>
      </header>
      <main className="doc">
        <h2 className="doc-title">{title}</h2>
        <p className="doc-lede">{lede}</p>
        {toc && sections.length > 3 ? (
          <nav className="doc-toc" aria-label="On this page">
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="doc-sec">
            <h3>
              {s.title}
              <a className="doc-anchor" href={`#${s.id}`} aria-label={`Link to ${s.title}`}>
                #
              </a>
            </h3>
            <div dangerouslySetInnerHTML={{ __html: s.html }} />
          </section>
        ))}
      </main>
      <footer className="doc-foot">
        <a href="/yemen-conflict-desk">Back to the live desk</a> · <a href="/yemen-conflict-desk/methodology">Methodology</a> ·{" "}
        <a href="/yemen-conflict-desk/about">About</a>
      </footer>
    </div>
  );
}
