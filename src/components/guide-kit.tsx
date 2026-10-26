import type { ReactNode } from "react";

/**
 * The desks' guide pages (user, 26 Oct: "the full explainer page … looks nice with all the diagrams"): the boxes and
 * rows of their charts, their look, and the explainers' sections (public/<desk>-explain.json), each under its
 * category, so a desk's Explainers panel can link to its section.
 */
export function Box({ name, sub, tone = "", children }: { name: ReactNode; sub?: ReactNode; tone?: string; children?: ReactNode }) {
  return (
    <div className={`pg-box ${tone}`}>
      <b>{name}</b>
      {sub ? <small>{sub}</small> : null}
      {children}
    </div>
  );
}

/** One level of a chart: its boxes side by side, a line down to the next. */
export function Row({ children, down = true }: { children: ReactNode; down?: boolean }) {
  return <div className={`pg-row${down ? " down" : ""}`}>{children}</div>;
}

export const GUIDE_CSS = `
.pg{--pg-line:var(--o-line,#334155);--pg-dim:var(--o-dim,#94a3b8);--pg-strong:var(--o-strong,#f1f5f9);--pg-panel:var(--o-hover,rgba(148,163,184,.08));font:400 15px/1.55 var(--ops-ui,system-ui,sans-serif)}
.pg h3{margin:30px 0 8px;font:700 18px/1.2 var(--ops-cond,inherit);letter-spacing:.1em;text-transform:uppercase;color:var(--pg-strong)}
.pg h4{margin:18px 0 6px;font-size:15px;color:var(--pg-strong)}
.pg p,.pg li{margin:0 0 8px}
.pg ul{padding-left:20px;margin:0 0 10px}
.pg-toc{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px;padding:0;list-style:none}
.pg-toc a{display:inline-block;padding:3px 9px;border:1px solid var(--pg-line);border-radius:4px;font-size:13px;color:inherit;text-decoration:none}
.pg-toc a:hover{background:var(--pg-panel)}
.pg-chart{margin:12px 0 16px;padding:12px;border:1px solid var(--pg-line);border-radius:6px;overflow-x:auto}
.pg-row{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;position:relative}
.pg-row.down{padding-bottom:18px}
.pg-row.down::after{content:"";position:absolute;left:50%;bottom:3px;height:12px;border-left:1px solid var(--pg-dim)}
.pg-box{flex:1 1 120px;max-width:230px;padding:7px 9px;border:1px solid var(--pg-line);border-left:3px solid var(--tone,var(--pg-dim));border-radius:4px;background:var(--pg-panel);font-size:13px;line-height:1.35}
.pg-box b{display:block;color:var(--pg-strong);font-size:13.5px}
.pg-box small{display:block;color:var(--pg-dim);font-size:12px;margin-top:2px}
.pg-box.wide{max-width:none;flex-basis:100%}
.pg-box.plo{--tone:#eab308}.pg-box.pa{--tone:#f59e0b}.pg-box.fatah{--tone:#facc15}.pg-box.hamas{--tone:#16a34a}.pg-box.pij{--tone:#0f766e}.pg-box.left{--tone:#ef4444}.pg-box.sec{--tone:#3b82f6}.pg-box.arm{--tone:#a855f7}.pg-box.clan{--tone:#a16207}
.pg-group{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:8px;padding:8px;border:1px dashed var(--pg-line);border-radius:6px}
.pg-group>.pg-label{flex-basis:100%;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--pg-dim)}
.pg-table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:13.5px}
.pg-table th,.pg-table td{padding:6px 8px;border-bottom:1px solid var(--pg-line);text-align:left;vertical-align:top}
.pg-table th{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--pg-dim);font-weight:600}
.pg-wrap{overflow-x:auto}
.pg-bar{display:flex;height:30px;margin:8px 0 4px;border-radius:4px;overflow:hidden;font-size:12.5px;font-weight:700;color:#0b1220}
.pg-bar span{display:flex;align-items:center;justify-content:center}
.pg-time{list-style:none;padding:0;margin:8px 0;border-left:2px solid var(--pg-line)}
.pg-time li{position:relative;padding:0 0 10px 14px}
.pg-time li::before{content:"";position:absolute;left:-6px;top:7px;width:10px;height:10px;border-radius:50%;background:var(--pg-dim)}
.pg-time li.now::before{background:#eab308}
.pg-time b{color:var(--pg-strong)}
.pg-note{font-size:13px;color:var(--pg-dim)}
.pg-ex{margin:0 0 16px;padding:12px 14px;border:1px solid var(--pg-line);border-radius:6px;background:var(--pg-panel);scroll-margin-top:12px}
.pg-ex h4{margin:0 0 6px;font-size:16px}
.pg-ex-dates{font-weight:400;color:var(--pg-dim);font-size:13px}
.pg-ex-sum{font-weight:600;color:var(--pg-strong)}
.pg h3{scroll-margin-top:12px}
.pg [dir=rtl]{unicode-bidi:isolate}
@media (max-width:520px){.pg-box{flex-basis:100%;max-width:none}.pg-chart{padding:8px}}
`;

export const ar = (t: string) => <span dir="rtl" lang="ar">{t}</span>;
export const he = (t: string) => <span dir="rtl" lang="he">{t}</span>;


export type Explainer = { title: string; cat?: string; dates?: string; sum: string; detail?: string; sources?: { name: string; url: string }[] };
/** The id of an explainer's section on its desk's guide page; the panel's links use the same. */
export const exId = (title: string) => "ex-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const catId = (cat: string) => "cat-" + cat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** One explainer in full: its dates, summary, paragraphs (a leading "Label:" in bold) and sources. */
export function ExplainerSection({ e }: { e: Explainer }) {
  return (
    <section id={exId(e.title)} className="pg-ex">
      <h4>{e.title}{e.dates ? <span className="pg-ex-dates"> · {e.dates}</span> : null}</h4>
      <p className="pg-ex-sum">{e.sum}</p>
      {String(e.detail || "").split(/\n\n+/).filter(Boolean).map((p, i) => {
        const m = /^([^:.]{3,40}):\s*(.*)$/s.exec(p);
        return <p key={i}>{m ? <><b>{m[1]}:</b> {m[2]}</> : p}</p>;
      })}
      {e.sources?.length ? (
        <p className="pg-note">Sources: {e.sources.map((s, i) => <span key={s.url}>{i ? " · " : ""}<a href={s.url} target="_blank" rel="noopener">{s.name}</a></span>)}</p>
      ) : null}
    </section>
  );
}
