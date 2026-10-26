import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";

/**
 * The desks' guide pages (user, 26 Oct: "the full explainer page … looks nice with all the diagrams"; later the same
 * day: "much more nice to look at — clear colours, diagrams, even photos — very professional from beginning to end"):
 * a long read's parts shared by the three guides, so they match: the hero, the contents by category, the section
 * heads, the charts' boxes and rows with a key, callouts and key figures, photos from Wikimedia Commons with their
 * credit, and the explainers' sections (public/<desk>-explain.json), each under its category, so a desk's
 * Explainers panel can link to its section. The categories' colours and icons are the panel's (public/app.js EX_CAT).
 */

/* ---------- Icons: one stroke set, drawn in the text's colour. ---------- */
const IC: Record<string, ReactNode> = {
  person: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" /></>,
  people: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" /><circle cx="16.5" cy="7.5" r="2.5" /><path d="M15.6 12.6c2.6-.2 4.5 1.4 4.9 4.4" /></>,
  body: <><path d="M3.5 9.5 12 4l8.5 5.5z" /><path d="M5.5 10v7.5M9.5 10v7.5M14.5 10v7.5M18.5 10v7.5M3.5 20h17" /></>,
  shield: <path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />,
  target: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2.6" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" /></>,
  flag: <><path d="M5.5 21V4" /><path d="M5.5 4.5h11l-2 3.5 2 3.5h-11" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5z" /></>,
  scale: <><path d="M12 4v16M7.5 20h9M5 7.5h14" /><path d="M5 7.5 2.5 13a2.6 2.6 0 0 0 5 0zM19 7.5 16.5 13a2.6 2.6 0 0 0 5 0z" /></>,
  ballot: <><rect x="4.5" y="10.5" width="15" height="9.5" rx="1" /><path d="M8.5 10.5 10.5 4h5l-1.5 6.5M8 15.5h8" /></>,
  hourglass: <><path d="M6.5 3.5h11M6.5 20.5h11" /><path d="M7.5 3.5c0 5 9 5 9 8.5s-9 3.5-9 8.5M16.5 3.5c0 5-9 5-9 8.5s9 3.5 9 8.5" /></>,
  anchor: <><circle cx="12" cy="5.5" r="2" /><path d="M12 7.5v13M8 11h8M4.5 13.5c0 4 3.4 7 7.5 7s7.5-3 7.5-7" /></>,
  coins: <><ellipse cx="9" cy="7" rx="5.5" ry="2.5" /><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5" /><ellipse cx="15" cy="13" rx="5.5" ry="2.5" /><path d="M9.5 13v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4" /></>,
  map: <><path d="M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  book: <><path d="M4 5.5c2.7-1 5.3-1 8 .8v13c-2.7-1.8-5.3-1.8-8-.8z" /><path d="M20 5.5c-2.7-1-5.3-1-8 .8v13c2.7-1.8 5.3-1.8 8-.8z" /></>,
  words: <><path d="M4 6h9M4 10.5h6" /><path d="M12.5 20l3.75-9 3.75 9M13.9 17h4.7" /></>,
  clock: <><path d="M6 4v16" /><circle cx="6" cy="7.5" r="1.6" fill="currentColor" /><circle cx="6" cy="14" r="1.6" fill="currentColor" /><path d="M10 7.5h9M10 14h7M10 19h5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.6v.2" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
};
export function Icon({ n, className = "" }: { n: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`pg-ic ${className}`}>
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{IC[n] || IC.book}</g>
    </svg>
  );
}

/* ---------- The categories' colours and icons (the panel's, public/app.js EX_CAT). ---------- */
const CAT_STYLE: Record<string, [string, string]> = {
  "Who's who": ["#e0a43c", "people"],
  "The structure": ["#e0a43c", "people"],
  History: ["#9b7ff0", "hourglass"],
  Military: ["#e0564b", "shield"],
  Economy: ["#3fae7a", "coins"],
  "Economy and society": ["#3fae7a", "coins"],
  "The war at sea": ["#3b9edd", "anchor"],
  "Land and people": ["#2bb3a3", "map"],
  Politics: ["#d06aa0", "ballot"],
  "Politics and money": ["#d06aa0", "ballot"],
  Reference: ["#8a939d", "words"],
  Background: ["#8a939d", "book"],
};
export const catStyle = (cat?: string) => {
  const s = CAT_STYLE[cat || "Background"] || CAT_STYLE.Background;
  return { color: s[0], icon: s[1] };
};
const cVar = (c: string) => ({ "--c": c }) as CSSProperties;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---------- The charts. ---------- */
/** A box's icon when it names none: by its tone, the kind of body it is. */
const TONE_IC: [RegExp, string][] = [
  [/\b(sec|irgc|artesh|snsc)\b/, "shield"],
  [/\b(arm|aqap)\b/, "target"],
  [/\b(judiciary)\b/, "scale"],
  [/\b(elected)\b/, "ballot"],
  [/\b(clan)\b/, "people"],
  [/\b(saudi|uae|iran|gone)\b/, "globe"],
  [/\b(fatah|hamas|pij|left|hzb|houthi|iraq|islah|south|west)\b/, "flag"],
];
const initials = (s: string) => {
  const w = s.split(/[\s-]+/).filter((x) => /^[A-Z]/.test(x));
  return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase() : "";
};

/**
 * One body or person in a chart: a badge (a person's initials, else an icon by the body's kind), the name and a line
 * under it. `person`: true takes the initials from the name, a string from that string.
 */
export function Box({ name, sub, tone = "", ic, person, children }: { name: ReactNode; sub?: ReactNode; tone?: string; ic?: string; person?: boolean | string; children?: ReactNode }) {
  const who = typeof person === "string" ? person : person && typeof name === "string" ? name : "";
  const ini = who ? initials(who) : "";
  const icon = ic || (TONE_IC.find(([re]) => re.test(tone)) || [null, "body"])[1];
  return (
    <div className={`pg-box ${tone}${ini ? " is-person" : ""}`}>
      <span className="pg-av" aria-hidden="true">{ini || <Icon n={icon} />}</span>
      <div className="pg-bt">
        <b>{name}</b>
        {sub ? <small>{sub}</small> : null}
        {children}
      </div>
    </div>
  );
}

/** One level of a chart: its boxes side by side, a line down to the next. */
export function Row({ children, down = true }: { children: ReactNode; down?: boolean }) {
  return <div className={`pg-row${down ? " down" : ""}`}>{children}</div>;
}

/** A chart in a frame: its name over it, the key under it (tone class, words). */
export function Chart({ label, title, legend, children }: { label: string; title?: ReactNode; legend?: [string, string][]; children: ReactNode }) {
  return (
    <figure className="pg-chart">
      {title ? <figcaption className="pg-chart-h">{title}</figcaption> : null}
      <div className="pg-chart-body" role="img" aria-label={label}>{children}</div>
      {legend?.length ? (
        <ul className="pg-legend" aria-label="Key">
          {legend.map(([tone, l]) => <li key={l} className={tone}><i />{l}</li>)}
        </ul>
      ) : null}
    </figure>
  );
}

/* ---------- The long read's parts. ---------- */
export type Photo = { src: string; alt: string; caption: ReactNode; credit: string; licence: string; page: string; ratio?: string };

/** A photo from Wikimedia Commons, hot-linked, with its caption and its credit and licence. */
export function Figure({ p, className = "", eager = false }: { p: Photo; className?: string; eager?: boolean }) {
  return (
    <figure className={`pg-fig ${className}`}>
      <img src={p.src} alt={p.alt} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" style={p.ratio ? ({ aspectRatio: p.ratio } as CSSProperties) : undefined} />
      <figcaption>
        {p.caption}
        <span className="pg-credit">Photo: {p.credit} · {p.licence} · <a href={p.page} target="_blank" rel="noopener">Wikimedia Commons</a></span>
      </figcaption>
    </figure>
  );
}

/** Key figures in a row of tiles. */
export function Facts({ items }: { items: { v: ReactNode; l: ReactNode }[] }) {
  return (
    <dl className="pg-facts">
      {items.map((f, i) => (
        <div key={i}>
          <dt>{f.l}</dt>
          <dd>{f.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A boxed note: a key fact, the short version, a word of caution. */
export function Callout({ label, icon = "info", tone, children }: { label: ReactNode; icon?: string; tone?: string; children: ReactNode }) {
  return (
    <aside className="pg-call" style={tone ? cVar(tone) : undefined}>
      <p className="pg-call-h"><Icon n={icon} />{label}</p>
      {children}
    </aside>
  );
}

/** The page's head: the desk, the title, a line on what it holds, the date it is correct to, a photo and key figures. */
export function GuideHero({ kicker, title, standfirst, asOf, accent, photo, facts, desk }: {
  kicker: string;
  title: string;
  standfirst: ReactNode;
  asOf: string;
  accent: string;
  photo?: Photo;
  facts?: { v: ReactNode; l: ReactNode }[];
  desk: { href: string; name: string };
}) {
  return (
    <header className={`pg-hero${photo ? " has-fig" : ""}`} style={{ "--acc": accent } as CSSProperties}>
      <div className="pg-hero-t">
        <p className="pg-kicker"><Icon n="book" />{kicker}</p>
        <h2 className="pg-h1">{title}</h2>
        <p className="pg-stand">{standfirst}</p>
        <p className="pg-meta">
          <span className="pg-asof"><i />Correct as of {asOf}</span>
          <a className="pg-btn" href={desk.href}>← The {desk.name} desk</a>
          <a className="pg-btn" href={`${desk.href}#tl=now`}><Icon n="clock" />The desk's Timeline</a>
        </p>
      </div>
      {photo ? <Figure p={photo} className="pg-hero-fig" eager /> : null}
      {facts?.length ? <Facts items={facts} /> : null}
    </header>
  );
}

/** A section's head, in its category's colour, with its icon. */
export function H3({ id, cat, kicker, children }: { id: string; cat?: string; kicker?: ReactNode; children: ReactNode }) {
  const s = catStyle(cat);
  return (
    <h3 id={id} className="pg-h3" style={cVar(s.color)}>
      <span className="pg-h3-ic"><Icon n={s.icon} /></span>
      <span className="pg-h3-t">
        {kicker ? <small>{kicker}</small> : null}
        {children}
      </span>
    </h3>
  );
}

export type TocGroup = { title: string; cat?: string; items: { id: string; label: string }[] };

/**
 * The contents, by category, beside the text on a wide screen (it stays in view and marks the part being read) and
 * a strip across the top on a phone; then the text.
 */
export function GuideBody({ toc, children }: { toc: TocGroup[]; children: ReactNode }) {
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const links = [...el.querySelectorAll<HTMLAnchorElement>("a[href^='#']")];
    const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter((t): t is HTMLElement => !!t);
    const seen = new Map<Element, boolean>();
    const mark = () => {
      // The last part whose head has passed the top third of the screen.
      let cur: HTMLElement | null = targets[0] || null;
      for (const t of targets) if (t.getBoundingClientRect().top < innerHeight / 3) cur = t;
      links.forEach((a) => {
        const on = !!cur && a.hash === `#${cur.id}`;
        a.classList.toggle("on", on);
        if (on) {
          a.setAttribute("aria-current", "true");
          // On a phone the strip scrolls sideways to the part being read.
          if (el.scrollWidth > el.clientWidth + 4) el.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" });
        } else a.removeAttribute("aria-current");
      });
    };
    const io = new IntersectionObserver((es) => { es.forEach((e) => seen.set(e.target, e.isIntersecting)); mark(); }, { rootMargin: "0px 0px -60% 0px" });
    targets.forEach((t) => io.observe(t));
    mark();
    return () => io.disconnect();
  }, []);
  return (
    <div className="pg-layout">
      <nav className="pg-toc" aria-label="Contents" ref={nav}>
        <p className="pg-toc-h">Contents</p>
        {toc.map((g) => {
          const s = catStyle(g.cat || g.title);
          return (
            <div key={g.title} className="pg-toc-g" style={cVar(s.color)}>
              <p className="pg-toc-gh"><Icon n={s.icon} />{g.title}</p>
              <ol>
                {g.items.map((i) => (
                  <li key={i.id}><a href={`#${i.id}`}>{i.label}</a></li>
                ))}
              </ol>
            </div>
          );
        })}
      </nav>
      <div className="pg-main">{children}</div>
    </div>
  );
}

export const GUIDE_CSS = `
.pg{--pg-bg:var(--o-bg,var(--t-bg,#0b0e11));--pg-panel:var(--o-panel,var(--t-surface-1,#11151a));--pg-raised:var(--o-raised,var(--t-surface-2,#171c22));--pg-line:var(--o-line,var(--t-line,#242a31));--pg-line2:var(--o-line-2,var(--t-line-strong,#323a43));--pg-text:var(--o-text,var(--t-text,#d7dce1));--pg-dim:var(--o-dim,var(--t-muted,#8a939d));--pg-faint:var(--o-faint,var(--t-faint,#5f6873));--pg-strong:var(--o-strong,var(--t-strong,#f3f5f7));--pg-sel:var(--o-sel,var(--accent-ui,#e0a43c));--pg-hover:var(--o-hover,rgba(148,163,184,.08));--pg-cond:var(--ops-cond,"Barlow Condensed","Arial Narrow",sans-serif);--pg-mono:var(--ops-mono,ui-monospace,Consolas,monospace);
  color:var(--pg-text);font:400 16px/1.65 var(--ops-ui,system-ui,sans-serif)}
.doc-root main.doc.doc-guide,html[data-view] .doc-root main.doc.doc-guide{max-width:78rem;margin:20px auto 28px;padding:0 20px;background:none;border:0}
.doc-root .doc-foot.doc-guide{max-width:78rem;padding-left:20px;padding-right:20px}
.pg a{color:inherit;text-decoration-color:color-mix(in srgb,currentColor 40%,transparent);text-underline-offset:3px}
.pg a:hover{color:var(--pg-sel)}
.pg-ic{width:1em;height:1em;flex:none;vertical-align:-.15em}
.pg [dir=rtl]{unicode-bidi:isolate}
.pg p,.pg li{margin:0 0 10px}
.pg ul{padding-left:20px;margin:0 0 12px}
.pg-main>p,.pg-main>ul,.pg-main>ol,.pg-main>.pg-call,.pg-ex>p,.pg-ex>ul{max-width:46rem}
.pg-main b,.pg-main strong{color:var(--pg-strong)}

/* The hero. */
.pg-hero{position:relative;display:grid;grid-template-columns:minmax(0,1fr);gap:22px 30px;align-items:center;margin:0 0 26px;padding:30px 30px 24px;border:1px solid var(--pg-line);border-top:3px solid var(--acc,var(--pg-sel));border-radius:6px;overflow:hidden;
  background:radial-gradient(110% 120% at 0% 0%,color-mix(in srgb,var(--acc,var(--pg-sel)) 15%,transparent),transparent 62%),
  repeating-linear-gradient(0deg,transparent 0 31px,color-mix(in srgb,var(--pg-line) 50%,transparent) 31px 32px),
  repeating-linear-gradient(90deg,transparent 0 31px,color-mix(in srgb,var(--pg-line) 50%,transparent) 31px 32px),var(--pg-panel)}
.pg-hero.has-fig{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr)}
.pg-kicker{display:flex;align-items:center;gap:8px;margin:0 0 10px!important;font:700 12.5px/1 var(--pg-cond);letter-spacing:.18em;text-transform:uppercase;color:var(--pg-sel)}
.pg-kicker .pg-ic{font-size:16px}
.pg-h1{margin:0 0 12px;font:700 clamp(32px,4.6vw,50px)/1.02 var(--pg-cond);letter-spacing:.005em;color:var(--pg-strong);text-wrap:balance}
.pg-stand{margin:0 0 16px!important;font-size:17.5px;line-height:1.55;color:var(--pg-text);max-width:40rem;text-wrap:pretty}
.pg-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin:0!important}
.pg-asof{display:inline-flex;align-items:center;gap:7px;margin-right:6px;font:500 12.5px var(--pg-mono);color:var(--pg-dim)}
.pg-asof i{width:7px;height:7px;border-radius:50%;background:var(--o-ok,#46b37a);box-shadow:0 0 0 3px color-mix(in srgb,var(--o-ok,#46b37a) 25%,transparent)}
.pg-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border:1px solid var(--pg-line2);border-radius:3px;background:var(--pg-raised);font:700 12px var(--pg-cond);letter-spacing:.12em;text-transform:uppercase;text-decoration:none;color:var(--pg-strong)!important}
.pg-btn:hover{border-color:var(--pg-sel);color:var(--pg-sel)!important}
.pg-fig{margin:0}
.pg-fig img{display:block;width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:4px;border:1px solid var(--pg-line);background:var(--pg-raised)}
.pg-fig figcaption{margin-top:7px;font-size:13px;line-height:1.45;color:var(--pg-dim)}
.pg-credit{display:block;margin-top:2px;font-size:11.5px;color:var(--pg-faint)}
.pg-credit a{color:inherit}
.pg-ex .pg-fig{margin:4px 0 16px;max-width:46rem}
.pg-ex .pg-fig img{aspect-ratio:16/9}
.pg-facts{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;margin:2px 0 0;border:1px solid var(--pg-line);border-radius:4px;overflow:hidden;background:var(--pg-line)}
.pg-facts>div{padding:12px 14px 11px;background:color-mix(in srgb,var(--pg-panel) 88%,transparent)}
.pg-facts dt{font:700 11px/1.25 var(--pg-cond);letter-spacing:.14em;text-transform:uppercase;color:var(--pg-dim)}
.pg-facts dd{margin:5px 0 0;font:600 21px/1.1 var(--pg-mono);color:var(--pg-strong)}

/* The contents beside the text. */
.pg-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:36px;align-items:start}
.pg-toc{position:sticky;top:14px;max-height:calc(100vh - 28px);overflow-y:auto;scrollbar-width:thin;padding:14px 0 14px;border-top:1px solid var(--pg-line)}
.pg-toc-h{margin:0 0 10px!important;font:700 12px var(--pg-cond);letter-spacing:.18em;text-transform:uppercase;color:var(--pg-dim)}
.pg-toc-g{margin:0 0 14px}
.pg-toc-gh{display:flex;align-items:center;gap:7px;margin:0 0 4px!important;font:700 12.5px/1.2 var(--pg-cond);letter-spacing:.12em;text-transform:uppercase;color:color-mix(in srgb,var(--c) 70%,var(--pg-strong))}
.pg-toc-gh .pg-ic{font-size:15px;color:var(--c)}
.pg-toc ol{list-style:none;margin:0;padding:0 0 0 7px;border-left:1px solid var(--pg-line)}
.pg-toc li{margin:0}
.pg-toc a{display:block;margin-left:-1px;padding:4px 0 4px 13px;border-left:2px solid transparent;font-size:13.5px;line-height:1.35;color:var(--pg-dim);text-decoration:none}
.pg-toc a:hover{color:var(--pg-strong)}
.pg-toc a.on{border-left-color:var(--c);color:var(--pg-strong);font-weight:600}
.pg-main{min-width:0}

/* Section heads. */
.pg-h3{display:flex;align-items:center;gap:12px;margin:44px 0 14px;padding:0 0 10px;border-bottom:1px solid var(--pg-line);font:700 25px/1.12 var(--pg-cond);letter-spacing:.01em;color:var(--pg-strong);scroll-margin-top:16px}
.pg-main>.pg-h3:first-child,.pg-main>div:first-child>.pg-h3:first-child{margin-top:0}
.pg-h3-ic{display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:4px;background:color-mix(in srgb,var(--c) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 45%,transparent);color:var(--c);font-size:21px}
.pg-h3-t small{display:block;margin-bottom:3px;font:700 11.5px/1 var(--pg-cond);letter-spacing:.18em;text-transform:uppercase;color:color-mix(in srgb,var(--c) 72%,var(--pg-strong))}
.pg h4{margin:28px 0 10px;font:700 19px/1.2 var(--pg-cond);letter-spacing:.02em;color:var(--pg-strong);scroll-margin-top:16px}

/* Callouts. */
.pg-call{margin:14px 0 18px;padding:14px 18px 6px;border:1px solid color-mix(in srgb,var(--c,var(--pg-sel)) 35%,var(--pg-line));border-left:3px solid var(--c,var(--pg-sel));border-radius:4px;background:color-mix(in srgb,var(--c,var(--pg-sel)) 7%,var(--pg-panel))}
.pg-call-h{display:flex;align-items:center;gap:8px;margin:0 0 8px!important;font:700 12.5px var(--pg-cond);letter-spacing:.16em;text-transform:uppercase;color:color-mix(in srgb,var(--c,var(--pg-sel)) 75%,var(--pg-strong))}
.pg-call-h .pg-ic{font-size:16px}
.pg-call ul{padding-left:18px}
.pg-call li::marker{color:var(--c,var(--pg-sel))}

/* Charts. */
.pg-chart{margin:16px 0 20px;padding:0;border:1px solid var(--pg-line);border-radius:6px;background:var(--pg-panel);overflow:hidden}
.pg-chart-h{padding:10px 16px;border-bottom:1px solid var(--pg-line);font:700 12.5px var(--pg-cond);letter-spacing:.16em;text-transform:uppercase;color:var(--pg-dim);background:var(--pg-raised)}
.pg-chart-body{padding:18px 16px;overflow-x:auto;background-image:radial-gradient(color-mix(in srgb,var(--pg-line2) 70%,transparent) 1px,transparent 1.2px);background-size:16px 16px}
.pg-row{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;position:relative}
.pg-row.down{padding-bottom:28px}
.pg-row.down::after{content:"";position:absolute;left:50%;bottom:6px;height:16px;border-left:1.5px solid var(--pg-line2)}
.pg-row.down::before{content:"";position:absolute;left:calc(50% - 4px);bottom:2px;width:7px;height:7px;border-radius:50%;background:var(--pg-panel);box-shadow:inset 0 0 0 1.5px var(--pg-line2)}
.pg-box{--tone:var(--pg-dim);flex:1 1 150px;max-width:250px;display:flex;align-items:flex-start;gap:10px;padding:10px 11px;border:1px solid color-mix(in srgb,var(--tone) 32%,var(--pg-line));border-top:3px solid var(--tone);border-radius:4px;background:color-mix(in srgb,var(--tone) 7%,var(--pg-raised));font-size:13px;line-height:1.4}
.pg-av{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:50%;background:color-mix(in srgb,var(--tone) 20%,var(--pg-panel));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--tone) 70%,transparent);color:color-mix(in srgb,var(--tone) 70%,var(--pg-strong));font:700 12px/1 var(--pg-mono);letter-spacing:.02em}
.pg-av .pg-ic{font-size:16px}
.pg-box:not(.is-person) .pg-av{border-radius:4px}
.pg-bt{min-width:0;flex:1}
.pg-box b{display:block;color:var(--pg-strong);font-size:14px;line-height:1.3}
.pg-box small{display:block;margin-top:3px;color:var(--pg-dim);font-size:12.5px;line-height:1.4}
.pg-box.wide{max-width:none;flex-basis:100%}
.pg-sub{list-style:none;margin:8px 0 0!important;padding:6px 0 0!important;border-top:1px solid color-mix(in srgb,var(--tone) 25%,var(--pg-line))}
.pg-sub li{position:relative;margin:0 0 3px!important;padding-left:12px;font-size:12.5px;line-height:1.4;color:var(--pg-dim)}
.pg-sub li::before{content:"";position:absolute;left:0;top:.6em;width:6px;height:1.5px;background:var(--tone)}
.pg-sub b{display:inline!important;font-size:12.5px!important}
.pg-group{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:10px;padding:12px;border:1px dashed var(--pg-line2);border-radius:6px;background:color-mix(in srgb,var(--pg-panel) 70%,transparent)}
.pg-group>.pg-label{flex-basis:100%;font:700 11.5px var(--pg-cond);letter-spacing:.16em;text-transform:uppercase;color:var(--pg-dim)}
.pg-chart-body.pg-people{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 18px;border:1px solid var(--pg-line);border-radius:6px;background-color:var(--pg-panel)}
.pg-people .pg-box{flex:1 1 220px;max-width:none}
.pg-legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin:0;padding:10px 16px;border-top:1px solid var(--pg-line);list-style:none;font-size:12.5px;color:var(--pg-dim)}
.pg-legend li{display:inline-flex;align-items:center;gap:7px;margin:0}
.pg-legend i{width:12px;height:12px;border-radius:2px;background:color-mix(in srgb,var(--tone) 30%,transparent);box-shadow:inset 0 0 0 1.5px var(--tone)}
.pg .plo{--tone:#eab308}.pg .pa{--tone:#f59e0b}.pg .fatah{--tone:#facc15}.pg .hamas{--tone:#16a34a}.pg .pij{--tone:#0f9488}.pg .left{--tone:#ef4444}.pg .sec{--tone:#3b82f6}.pg .arm{--tone:#a855f7}.pg .clan{--tone:#b7791f}

/* Tables, bars, the short timeline. */
.pg-wrap{overflow-x:auto;margin:10px 0 18px;border:1px solid var(--pg-line);border-radius:6px;background:var(--pg-panel)}
.pg-table{width:100%;border-collapse:collapse;margin:0;font-size:14px;line-height:1.45}
.pg-table th,.pg-table td{padding:9px 12px;border-bottom:1px solid var(--pg-line);text-align:left;vertical-align:top}
.pg-table tbody tr:last-child td{border-bottom:0}
.pg-table tbody tr:nth-child(even) td{background:color-mix(in srgb,var(--pg-hover) 60%,transparent)}
.pg-table th{background:var(--pg-raised);font:700 11.5px var(--pg-cond);letter-spacing:.14em;text-transform:uppercase;color:var(--pg-dim)}
.pg-table td:first-child{color:var(--pg-strong);font-weight:600}
.pg-bar{display:flex;height:38px;margin:12px 0 8px;border-radius:4px;overflow:hidden;font:700 14px var(--pg-mono);color:#0b1220;max-width:46rem}
.pg-bar span{display:flex;align-items:center;justify-content:center;gap:6px}
.pg-bar small{font:600 11.5px var(--pg-mono);opacity:.8}
.pg-time{list-style:none;padding:0;margin:14px 0 18px;max-width:46rem}
.pg-time li{position:relative;margin:0;padding:0 0 16px 28px}
.pg-time li::before{content:"";position:absolute;left:5px;top:6px;bottom:-6px;width:2px;background:var(--pg-line2)}
.pg-time li:last-child::before{display:none}
.pg-time li::after{content:"";position:absolute;left:0;top:4px;width:8px;height:8px;border-radius:50%;background:var(--pg-panel);box-shadow:0 0 0 2px var(--pg-dim)}
.pg-time li.now::after{background:var(--pg-sel);box-shadow:0 0 0 2px var(--pg-sel),0 0 0 6px color-mix(in srgb,var(--pg-sel) 22%,transparent)}
.pg-time li>b:first-child{display:block;margin-bottom:2px;font:600 12.5px var(--pg-mono);letter-spacing:.02em;color:var(--pg-sel)}
.pg-note{font-size:13.5px;color:var(--pg-dim)}

/* An explainer in full. */
.pg-ex{position:relative;margin:0 0 22px;padding:20px 22px 14px;border:1px solid var(--pg-line);border-left:3px solid var(--c,var(--pg-dim));border-radius:5px;background:var(--pg-panel);scroll-margin-top:16px}
.pg-ex:target{box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 55%,transparent)}
.pg-ex-k{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px!important;font:700 11.5px/1 var(--pg-cond);letter-spacing:.16em;text-transform:uppercase;color:color-mix(in srgb,var(--c) 72%,var(--pg-strong))}
.pg-ex-k .pg-ic{font-size:15px;color:var(--c)}
.pg-chip{display:inline-flex;align-items:center;height:21px;padding:0 8px;border:1px solid var(--pg-line2);border-radius:999px;font:500 11.5px var(--pg-mono);letter-spacing:0;text-transform:none;color:var(--pg-dim);background:var(--pg-raised)}
.pg-ex h4{margin:0 0 10px;font:700 24px/1.15 var(--pg-cond);letter-spacing:.01em;color:var(--pg-strong);text-wrap:balance}
.pg-ex-sum{font-size:17px;line-height:1.55;color:var(--pg-strong)}
.pg-ex p b{color:var(--pg-strong)}
.pg-xref{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:4px 0 12px}
.pg-xh{margin-right:4px;font:700 11px var(--pg-cond);letter-spacing:.16em;text-transform:uppercase;color:var(--pg-dim)}
.pg-xchip{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:3px 10px;border:1px solid color-mix(in srgb,var(--pg-sel) 40%,var(--pg-line2));border-radius:999px;background:color-mix(in srgb,var(--pg-sel) 8%,var(--pg-raised));font-size:12.5px;line-height:1.25;text-decoration:none;color:var(--pg-strong)!important}
.pg-xchip .pg-ic{font-size:14px;color:var(--pg-sel)}
.pg-xchip:hover{border-color:var(--pg-sel)}
.pg-src{margin:14px 0 4px;padding:10px 0 0;border-top:1px dashed var(--pg-line2)}
.pg-src-h{margin:0 0 6px!important;font:700 11px var(--pg-cond);letter-spacing:.16em;text-transform:uppercase;color:var(--pg-dim)}
.pg-src ol{margin:0;padding:0 0 0 22px;columns:2 18rem;column-gap:28px;font-size:13px;line-height:1.4}
.pg-src li{margin:0 0 5px;break-inside:avoid;color:var(--pg-faint)}
.pg-src li::marker{font:500 11px var(--pg-mono)}
.pg-src a{color:var(--pg-text);text-decoration:none}
.pg-src a:hover{text-decoration:underline;color:var(--pg-sel)}
.pg-src small{margin-left:6px;font:400 11px var(--pg-mono);color:var(--pg-faint)}

/* Phones and narrow screens: the contents a strip across the top that stays in view. */
@media (max-width:980px){
  .pg-layout{grid-template-columns:minmax(0,1fr);gap:0}
  .pg-toc{top:0;z-index:5;display:flex;align-items:stretch;gap:0;max-height:none;margin:0 -20px 8px;padding:0 12px;overflow-x:auto;overflow-y:hidden;border-bottom:1px solid var(--pg-line);background:var(--pg-bg);scrollbar-width:none}
  .pg-toc::-webkit-scrollbar{display:none}
  .pg-toc-h,.pg-toc-gh{display:none!important}
  .pg-toc-g{display:contents}
  .pg-toc ol{display:contents}
  .pg-toc li{flex:none;display:flex}
  .pg-toc a{margin:0;padding:11px 10px 9px;border-left:0;border-bottom:2px solid transparent;white-space:nowrap;font-size:13px}
  .pg-toc a::before{content:"";display:inline-block;width:6px;height:6px;margin-right:7px;border-radius:50%;background:var(--c);vertical-align:1px}
  .pg-toc a.on{border-bottom-color:var(--c)}
  .pg-h3{scroll-margin-top:52px}.pg h4,.pg-ex{scroll-margin-top:52px}
}
@media (max-width:760px){
  .doc-root main.doc.doc-guide,html[data-view] .doc-root main.doc.doc-guide{margin:12px auto 20px;padding:0 12px}
  .pg-toc{margin:0 -12px 8px}
  .pg-hero,.pg-hero.has-fig{grid-template-columns:minmax(0,1fr);padding:22px 16px 16px}
  .pg-hero-fig{order:-1;margin:-22px -16px 0}
  .pg-hero-fig img{border-radius:0;border:0;aspect-ratio:16/9}
  .pg-hero-fig figcaption{padding:0 16px}
  .pg-stand{font-size:16px}
  .pg-facts{grid-template-columns:1fr 1fr}
  .pg-facts dd{font-size:18px}
  .pg-h3{font-size:21px;margin-top:34px}.pg-h3-ic{width:32px;height:32px;font-size:18px}
  .pg-ex{padding:16px 14px 10px}
  .pg-ex h4{font-size:21px}
  .pg-chart-body{padding:12px 10px}
  .pg-box{flex-basis:100%;max-width:none}
  .pg-group{padding:10px 8px}
}
@media print{
  .pg-toc,.pg-meta .pg-btn,.doc-root .mast,.doc-root .doc-top{display:none!important}
  .pg-layout{display:block}
  .pg,.pg-hero,.pg-ex,.pg-chart,.pg-wrap,.pg-box{background:#fff!important;color:#000!important;box-shadow:none!important}
  .pg-ex,.pg-chart,.pg-box{break-inside:avoid}
  .pg-src ol{columns:1}
  .pg-src a::after{content:" — " attr(href);font:400 9pt ui-monospace,monospace;color:#555;word-break:break-all}
}
`;

export const ar = (t: string) => <span dir="rtl" lang="ar">{t}</span>;
export const he = (t: string) => <span dir="rtl" lang="he">{t}</span>;

/** `timeline`: the desk's Timeline eras the explainer leads to, by their titles. */
export type Explainer = { title: string; cat?: string; dates?: string; sum: string; detail?: string; sources?: { name: string; url: string }[]; timeline?: string[] };
/** The id of an explainer's section on its desk's guide page; the panel's links use the same. */
export const exId = (title: string) => "ex-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const catId = (cat: string) => "cat-" + cat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** The contents' entries for a category's explainers. */
export const exToc = (items: Explainer[]) => items.map((e) => ({ id: exId(e.title), label: e.title }));

const host = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};

/**
 * One explainer in full: its category and dates, its title, the summary as its standfirst, a photo where there is
 * one, the paragraphs (a leading "Label:" in bold), the desk's Timeline eras it leads to (`desk`: the desk's
 * address; the desk opens its Timeline at the era, public/app.js installTlHash) and its sources, numbered.
 */
export function ExplainerSection({ e, desk, photo }: { e: Explainer; desk?: string; photo?: Photo }) {
  const s = catStyle(e.cat);
  const tl = Array.isArray(e.timeline) ? e.timeline.filter((t) => typeof t === "string" && t) : [];
  return (
    <article id={exId(e.title)} className="pg-ex" style={cVar(s.color)}>
      <p className="pg-ex-k"><Icon n={s.icon} />{e.cat || "Background"}{e.dates ? <span className="pg-chip">{e.dates}</span> : null}</p>
      <h4>{e.title}</h4>
      <p className="pg-ex-sum">{e.sum}</p>
      {photo ? <Figure p={photo} /> : null}
      {String(e.detail || "").split(/\n\n+/).filter(Boolean).map((p, i) => {
        const m = /^([^:.]{3,40}):\s*(.*)$/s.exec(p);
        return <p key={i}>{m ? <><b>{m[1]}:</b> {m[2]}</> : p}</p>;
      })}
      {tl.length && desk ? (
        <p className="pg-xref">
          <span className="pg-xh">On the desk's Timeline</span>
          {tl.map((t) => (
            <a key={t} className="pg-xchip" href={`${desk}#tl=${slug(t)}`}><Icon n="clock" />{t}</a>
          ))}
        </p>
      ) : null}
      {e.sources?.length ? (
        <footer className="pg-src">
          <p className="pg-src-h">Sources</p>
          <ol>
            {e.sources.map((x) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noopener">{x.name}</a>{host(x.url) ? <small>{host(x.url)}</small> : null}</li>
            ))}
          </ol>
        </footer>
      ) : null}
    </article>
  );
}
