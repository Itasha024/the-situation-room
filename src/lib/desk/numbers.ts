/**
 * The conflict in numbers, as the panel shows it: three boxes (Killed, Injured,
 * Humanitarian), each row a group of people and each column who counts them —
 * Official (UN agencies, WHO, ministries' formal counts, agencies' own
 * tallies), Houthi sources, and government or Saudi sources.
 *
 * Every cell is the live figure the clock keeps (`tally`, `tally-claims`) or,
 * where the clock has none or an older one, the hand-researched baseline below.
 * Per cell the newer figure wins. A cell nobody has published stays empty and
 * the panel says so.
 */
import { outletSide } from "./credibility.ts";
import type { Claims, Qualifier, Tally, TallySource } from "./tally.ts";

export type Column = "official" | "houthi" | "gov";
export type Cell = TallySource & { value: number; note?: string };
export type Numbers = { cells: Record<string, Partial<Record<Column, Cell>>>; asOf: string };

export const ROWS = {
  killed: ["houthi", "gov", "saudi", "civilians", "total"],
  injured: ["houthi", "gov", "saudi", "civilians", "total"],
  humanitarian: ["idp", "refugees", "food"],
} as const;

const c = (value: number, name: string, url: string, date: string, q?: Qualifier, note?: string): Cell => ({
  value, name, url, date, ...(q ? { q } : {}), ...(note ? { note } : {}),
});

/**
 * Researched cell by cell on 25 September 2026 from the originals (the WHO,
 * UN, IOM, UNHCR and WFP releases, the government's displaced-camps unit,
 * each side's own channels). Only cumulative counts for this round: a day's
 * or one battle's toll is not a total.
 */
export const BASELINE: Numbers = {
  asOf: "2026-09-25",
  cells: {
    "killed.total": {
      official: c(674, "WHO", "https://www.almashhad.news/news/496321", "2026-09-24", undefined, "Killed in the escalation, all sides"),
    },
    "injured.total": {
      official: c(2998, "WHO", "https://www.almashhad.news/news/496321", "2026-09-24", undefined, "Wounded in the escalation, all sides"),
    },
    "killed.houthi": {
      // The movement's own death notices, added up by Almashhad: the Houthis' own count.
      houthi: c(693, "Houthi death notices (Almashhad count)", "https://www.almashhad.news/news/496403", "2026-09-24", "at least", "Dead the movement's own media announced, 1 July to 22 September"),
      gov: c(1000, "National Resistance", "https://www.2dec.net/last83440.html", "2026-09-13", "more than", "West Coast only, 9 August to 10 September"),
    },
    "killed.gov": {
      gov: c(500, "National Resistance", "https://www.2dec.net/last83440.html", "2026-09-13", "more than", "Its own dead on the West Coast, 9 August to 10 September"),
    },
    "injured.gov": {
      gov: c(1500, "National Resistance", "https://www.2dec.net/last83440.html", "2026-09-13", "about", "Its own wounded on the West Coast, 9 August to 10 September"),
    },
    "killed.saudi": {
      official: c(1, "Saudi Civil Defense", "https://saudigazette.com.sa/article/664646/saudi-arabia/civil-defense-one-killed-two-injured-as-houthi-drone-intercepted-in-taif", "2026-09-17", undefined, "A resident killed by a downed drone's debris in Taif"),
    },
    "killed.civilians": {
      official: c(150, "Yemeni human rights ministry", "https://aa.com.tr/en/middle-east/150-civilians-killed-by-houthi-fire-since-sept-3-yemeni-government-says/4056487", "2026-09-14", undefined, "Killed by Houthi fire in Taiz, Hodeidah and Marib since 3 September"),
      houthi: c(343, "Ein al-Insaniyah Center", "https://t.me/almasirah2/299800", "2026-09-23", "at least", "Hays and Al-Khokha only"),
      gov: c(51, "Yemeni Network for Rights and Freedoms", "https://www.almashhad.news/news/495171", "2026-09-17", "at least", "Taiz, 3 to 15 September"),
    },
    "injured.civilians": {
      houthi: c(344, "Ein al-Insaniyah Center", "https://t.me/almasirah2/299800", "2026-09-23", "at least", "Hays and Al-Khokha only"),
      gov: c(62, "Yemeni Network for Rights and Freedoms", "https://www.almashhad.news/news/495171", "2026-09-17", "at least", "Taiz, 3 to 15 September"),
    },
    "injured.saudi": {
      official: c(73, "Coalition", "https://www.aljazeera.com/news/2026/9/8/houthi-attacks-on-saudi-arabia-have-wounded-73-civilians-official-says", "2026-09-08", "at least", "Civilians wounded in Houthi attacks on the kingdom"),
    },
    idp: {
      gov: c(169074, "Displaced camps unit (government)", "https://www.almashhad.news/news/496161", "2026-09-23", undefined, "25,116 families in 10 governorates, to 21 September"),
    },
    food: {
      official: c(5_400_000, "IPC / WFP", "https://www.wfp.org/news/nearly-half-population-government-controlled-areas-yemen-face-acute-food-insecurity", "2026-06-03", undefined, "Government-held areas only, June to September 2026 (IPC 3+); no analysis published for Houthi-held areas"),
    },
  },
};

/** Who an outlet speaks for, from its name alone. */
function sideOf(name: string): "houthi" | "gov" | "" {
  const s = outletSide(name, "");
  if (s === "houthi" || s === "gov") return s;
  if (/Erem|Sky News Arabia|Al-?Ain|Aden al-?Ghad|Yemeni army|Government|Coalition|Saudi/i.test(name)) return "gov";
  if (/Sanaa|Ansar Allah|Ein al-?Insaniyah|Eye of Humanity|Houthi/i.test(name)) return "houthi";
  return "";
}

const newer = (a: Cell | undefined, b: Cell | undefined): Cell | undefined => {
  if (!a) return b;
  if (!b) return a;
  // One figure from two records: keep the one that links to its source.
  if (a.value === b.value && Boolean(a.url) !== Boolean(b.url)) return a.url ? a : b;
  const d = String(a.date).localeCompare(String(b.date));
  if (d) return d > 0 ? a : b;
  return a.value >= b.value ? a : b;
};

/** One day's or one battle's toll, filed as if it were a total. */
const tooSmall = (cell: Cell) => cell.value < 20;

/**
 * The panel's cells: the baseline under the live figures, newer wins. A claim
 * filed under the wrong side (an outlet of one side in the other's column) is
 * moved to its own side's column, and a count under 20 is not a total.
 */
export function mergeNumbers(tally: Tally | null, claims: Claims | null, base: Numbers = BASELINE): Numbers {
  const cells: Numbers["cells"] = structuredClone(base.cells);
  const put = (key: string, col: Column, cell: Cell | undefined) => {
    if (!cell || !Number.isFinite(cell.value)) return;
    const row = (cells[key] ??= {});
    row[col] = newer(row[col], cell);
  };
  if (tally) {
    for (const group of ["killed", "injured"] as const) {
      for (const k of ROWS[group]) {
        const v = (tally[group] as Record<string, number | null | undefined>)[k];
        const from = tally.from?.[`${group}.${k}`];
        if (Number.isFinite(v) && from) put(`${group}.${k}`, "official", { ...from, value: v as number });
      }
    }
    for (const k of ["idp", "refugees"] as const) {
      const v = tally[k];
      if (Number.isFinite(v) && tally.from?.[k]) put(k, "official", { ...tally.from[k], value: v as number });
    }
  }
  for (const [key, bySide] of Object.entries(claims?.fields ?? {})) {
    for (const [col, claim] of Object.entries(bySide ?? {}) as [Column, Cell][]) {
      if (!claim || tooSmall(claim)) continue;
      const side = sideOf(claim.name);
      put(key, side && side !== col ? side : col, claim);
    }
  }
  const dates = Object.values(cells).flatMap((r) => Object.values(r).map((x) => String(x?.date || "")));
  return { cells, asOf: dates.sort().at(-1) || base.asOf };
}
