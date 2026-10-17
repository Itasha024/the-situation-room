import { createFileRoute } from "@tanstack/react-router";

import { metered } from "@/lib/desk/cpu-meter";

/**
 * Oil prices for the home page's "Oil prices" story (user, 17 Oct: read
 * automatically, nothing hand-filled): Brent, WTI and Henry Hub gas, each the
 * front-month future's last price from Yahoo Finance's chart API, with its
 * change on the day and on the week, and the highest close it is the highest
 * since. Read at most every ten minutes; a failed read keeps the last good one.
 */
const SYMBOLS = [
  { k: "Brent", symbol: "BZ=F" },
  { k: "WTI", symbol: "CL=F" },
  { k: "Natural gas", symbol: "NG=F", note: "Henry Hub" },
] as const;

type Row = { k: string; v: number; day: number | null; week: number | null; since: string | null; note?: string; at: string; url: string };

const MEMO_MS = 10 * 60_000;
let memo: { at: number; body: string } | null = null;
let reading: Promise<{ at: number; body: string }> | null = null;

const quoteUrl = (s: string) => `https://finance.yahoo.com/quote/${encodeURIComponent(s)}/`;
const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);

async function readOne(s: (typeof SYMBOLS)[number]): Promise<Row | null> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?range=1y&interval=1d`, {
    headers: { "user-agent": "Mozilla/5.0 (OSINT desk)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { chart?: { result?: { meta?: Record<string, number>; timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] } };
  const r = j.chart?.result?.[0];
  const meta = r?.meta ?? {};
  const ts = r?.timestamp ?? [];
  const cl = r?.indicators?.quote?.[0]?.close ?? [];
  const days = ts.map((t, i) => ({ t, v: cl[i] })).filter((p): p is { t: number; v: number } => typeof p.v === "number" && Number.isFinite(p.v));
  const v = Number(meta.regularMarketPrice);
  if (!Number.isFinite(v) || days.length < 6) return null;
  // The last bar is today's when the market traded today; the close before it is the day's base.
  const lastIsToday = Math.abs(days[days.length - 1].t - Number(meta.regularMarketTime)) < 20 * 3600;
  const prev = lastIsToday ? days[days.length - 2] : days[days.length - 1];
  const weekAgo = days[days.length - (lastIsToday ? 6 : 5)];
  // "Highest since": the last day before this one that closed higher.
  let since: string | null = null;
  const past = lastIsToday ? days.slice(0, -1) : days;
  for (let i = past.length - 1; i >= 0; i--) {
    if (past[i].v > v) { since = new Date(past[i].t * 1000).toISOString().slice(0, 10); break; }
  }
  const top = since && past.length - past.findIndex((p) => new Date(p.t * 1000).toISOString().slice(0, 10) === since) > 15 ? since : null;
  return {
    k: s.k,
    v,
    // The exchange's own change on the day when it gives one (a contract roll makes the bars' disagree).
    day: Number.isFinite(Number(meta.regularMarketChangePercent)) ? Number(meta.regularMarketChangePercent) : prev ? pct(v, prev.v) : null,
    week: weekAgo ? pct(v, weekAgo.v) : null,
    since: top,
    ...("note" in s ? { note: s.note } : {}),
    at: new Date(Number(meta.regularMarketTime) * 1000).toISOString(),
    url: quoteUrl(s.symbol),
  };
}

async function read() {
  const rows = (await Promise.all(SYMBOLS.map((s) => readOne(s).catch(() => null)))).filter((r): r is Row => !!r);
  if (!rows.length) throw new Error("no prices read");
  return { at: Date.now(), body: JSON.stringify({ ok: true, src: "Yahoo Finance", rows }) };
}

export const Route = createFileRoute("/api/oil")({
  server: {
    handlers: {
      GET: () => metered("oil", async () => {
        try {
          if (!memo || Date.now() - memo.at > MEMO_MS) {
            reading ??= read().finally(() => { reading = null; });
            try { memo = await reading; } catch (e) { if (!memo) throw e; }
          }
          return new Response(memo.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300", "cdn-cache-control": "public, s-maxage=600, stale-while-revalidate=600" } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "oil read failed", rows: [] }), { status: 502, headers: { "content-type": "application/json" } });
        }
      }),
    },
  },
});
