import { useState } from "react";
import { DeskDoc } from "@/components/desk-doc";

/**
 * A desk's sources by group, each with its 1–5 rating (user, 1 Oct): the
 * Yemen desk's three groups, the Iran desk's six filter groups (22 Oct).
 */
export type SourceRow = { name: string; url: string; group: string; rating: number };

function Dots({ rating }: { rating: number }) {
  return (
    <span className="sr-dots" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="sr-dot"
          style={{
            ["--f" as string]: `${Math.round(Math.max(0, Math.min(1, rating - (i - 1))) * 100)}%`,
          }}
        />
      ))}
    </span>
  );
}

export function SourcesList({ sources, groups, back }: { sources: SourceRow[]; groups: [string, string][]; back: { href: string; label: string } }) {
  // Every group starts closed (user, 2 Oct); each opens on its own, or all at once.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const shown = groups.filter(([g]) => sources.some((s) => s.group === g));
  const allOpen = shown.length > 0 && shown.every(([g]) => open[g]);
  const setAll = (v: boolean) => setOpen(Object.fromEntries(shown.map(([g]) => [g, v])));
  return (
    <DeskDoc title="Sources list" back={back}>
      <div className="sr-top">
        <p className="sr-stamp">Sources reliability updates every 24h</p>
        {/* The same quiet line as on the maps (user, 27 Oct). */}
        <p className="sr-stamp sr-discl">A report is only as accurate as the source that reported it; a rating is its record so far, not a promise.</p>
        {shown.length ? (
          <button
            type="button"
            className="sr-all"
            aria-pressed={allOpen}
            onClick={() => setAll(!allOpen)}
          >
            {allOpen ? "Close all" : "Open all"}
          </button>
        ) : null}
      </div>
      {groups.map(([g, label]) => {
        const rows = sources
          .filter((s) => s.group === g)
          .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
        if (!rows.length) return null;
        return (
          <section key={g} className={`sr-group sr-${g}${open[g] ? " open" : ""}`}>
            <h3>
              <button
                type="button"
                className="sr-head"
                aria-expanded={!!open[g]}
                aria-controls={`sr-${g}-list`}
                onClick={() => setOpen((o) => ({ ...o, [g]: !o[g] }))}
              >
                <span className="sw" />
                <span className="sr-name">{label}</span>
                <span className="sr-count">{rows.length}</span>
                <svg className="sr-chev" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 7.5l5 5 5-5" />
                </svg>
              </button>
            </h3>
            <div className="sr-body" id={`sr-${g}-list`} inert={!open[g] || undefined}>
              <div>
                <table className="sr-table">
                  <thead>
                    <tr>
                      <th scope="col">Source</th>
                      <th scope="col">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.name}>
                        <td>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer">
                              {s.name}
                            </a>
                          ) : (
                            s.name
                          )}
                        </td>
                        <td className="sr-rate" aria-label={`${s.rating.toFixed(1)} out of 5`}>
                          <b>{s.rating.toFixed(1)}</b>
                          <Dots rating={s.rating} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })}
      {!sources.length ? (
        <p className="sr-empty">The ratings are being worked out. Please look again shortly.</p>
      ) : null}
    </DeskDoc>
  );
}
