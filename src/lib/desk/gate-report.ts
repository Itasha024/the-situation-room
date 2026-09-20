/**
 * Scoring the gate against the labelled fixtures.
 *
 * Kept separate from the test so it can also be run by hand while tuning:
 *   node --experimental-strip-types src/lib/desk/gate-report.ts
 *
 * Reports BOTH directions deliberately. A change that rescues dropped reports
 * almost always lets something in; this is what makes that cost visible instead
 * of discovering it on the live desk.
 */

import { GATE_FIXTURES, type GateFixture, type GateLabel } from "./gate-fixtures.ts";
import { gate } from "./relevance.ts";

export type Scored = GateFixture & { got: GateLabel; reason: string; score: number };

/** Map a verdict onto a label. Until the scorer lands, keep/drop is all there is. */
export function classify(f: GateFixture): Scored {
  const v = gate({ text: f.text, source: f.source, url: "https://example.com/a/1", agency: !!f.agency });
  const got: GateLabel =
    (v as { outcome?: GateLabel }).outcome ?? (v.keep ? "feed" : "exclude");
  return { ...f, got, reason: v.reason, score: v.score };
}

export type Counts = { feed: number; tray: number; exclude: number };

export type Report = {
  rows: Scored[];
  /** Carried when it should have been: feed+tray both count as "not lost". */
  recall: number;
  /** Of what reached the feed, how much belonged there. */
  precision: number;
  /** Excluded items correctly excluded. */
  specificity: number;
  exact: number;
  lost: Scored[];
  leaked: Scored[];
};

export function runReport(fixtures: GateFixture[] = GATE_FIXTURES): Report {
  const rows = fixtures.map(classify);

  const wanted = rows.filter((r) => r.label === "feed" || r.label === "tray");
  const unwanted = rows.filter((r) => r.label === "exclude");

  // "Lost" is the failure that matters most: something relevant excluded outright.
  const lost = wanted.filter((r) => r.got === "exclude");
  // "Leaked" is the other half: noise that reached the feed.
  const leaked = unwanted.filter((r) => r.got === "feed");

  const inFeed = rows.filter((r) => r.got === "feed");
  const rightInFeed = inFeed.filter((r) => r.label === "feed" || r.label === "tray");

  return {
    rows,
    recall: wanted.length ? (wanted.length - lost.length) / wanted.length : 1,
    precision: inFeed.length ? rightInFeed.length / inFeed.length : 1,
    specificity: unwanted.length ? (unwanted.length - leaked.length) / unwanted.length : 1,
    exact: rows.filter((r) => r.got === r.label).length / (rows.length || 1),
    lost,
    leaked,
  };
}

export function formatReport(r: Report): string {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const out: string[] = [];
  out.push("");
  out.push(`recall      ${pct(r.recall)}   relevant items not excluded`);
  out.push(`precision   ${pct(r.precision)}   of what reached the feed, how much belonged`);
  out.push(`specificity ${pct(r.specificity)}   noise correctly kept out of the feed`);
  out.push(`exact       ${pct(r.exact)}   label matched exactly (feed/tray/exclude)`);

  if (r.lost.length) {
    out.push("");
    out.push(`LOST — relevant, but excluded (${r.lost.length}):`);
    for (const x of r.lost) out.push(`  [${x.reason}] ${x.name}`);
  }
  if (r.leaked.length) {
    out.push("");
    out.push(`LEAKED — noise that reached the feed (${r.leaked.length}):`);
    for (const x of r.leaked) out.push(`  [score ${x.score}] ${x.name}`);
  }

  const misTray = r.rows.filter((x) => x.label !== x.got && x.got !== "exclude" && !r.leaked.includes(x));
  if (misTray.length) {
    out.push("");
    out.push(`feed/tray placement differences (${misTray.length}):`);
    for (const x of misTray) out.push(`  want ${x.label} / got ${x.got} — ${x.name}`);
  }
  out.push("");
  return out.join("\n");
}

if (process.argv[1]?.endsWith("gate-report.ts")) {
  console.log(formatReport(runReport()));
}
