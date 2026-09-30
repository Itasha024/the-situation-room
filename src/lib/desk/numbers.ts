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
/** `via`: the site an official figure was read on, when it is not the body's own. */
export type Cell = TallySource & { value: number; note?: string; via?: string };
export type Numbers = { cells: Record<string, Partial<Record<Column, Cell>>>; asOf: string };

export const ROWS = {
  killed: ["houthi", "gov", "saudi", "civilians", "total"],
  injured: ["houthi", "gov", "saudi", "civilians", "total"],
  humanitarian: ["idp", "refugees", "food"],
} as const;

const WHO_SITREP_5 = "https://reliefweb.int/report/yemen/conflict-escalation-yemen-situation-report-5-reporting-period-19-26-september-2026-issued-27-september-2026";

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
    // The WHO-led Health Cluster's own report on ReliefWeb (4,481 casualties since 6 August, 838 of them deaths).
    "killed.total": {
      official: c(838, "WHO (Health Cluster)", WHO_SITREP_5, "2026-09-27", undefined, "Killed in the escalation, all sides, since 6 August"),
    },
    "injured.total": {
      official: c(3643, "WHO (Health Cluster)", WHO_SITREP_5, "2026-09-27", undefined, "Wounded in the escalation, all sides, since 6 August"),
    },
    "killed.houthi": {
      // Almashhad (government side) adds up the movement's own death notices. Its
      // 29 Sep count starts with the war (13 July to 27 September); its 24 Sep
      // one (693) ran from 1 July, so it counted days before the war.
      gov: c(568, "Almashhad (count of Houthi death notices)", "https://www.almashhad.news/news/497120", "2026-09-29", "at least", "Houthi fighters whose deaths the movement announced, 13 July to 27 September"),
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

/**
 * Official means an official body: a UN agency, the WHO, a ministry, a
 * government, the coalition, civil defence, a health authority. A journalist,
 * an outlet or anyone's X account is not, whatever figure they post; their
 * numbers go in their side's column.
 */
const OFFICIAL_BODY =
  /\b(?:WHO|World Health Organi[sz]ation|Health Cluster|UN|United Nations|OCHA|UNHCR|IOM|UNICEF|UNFPA|OHCHR|WFP|IPC|FAO|ICRC|Red Crescent|Red Cross|ministry|ministries|minister|government|coalition|civil defen[cs]e|health (?:office|authorit(?:y|ies)|bureau)|governorate|local authorit(?:y|ies)|Saudi officials|Saudi Press Agency|SPA|displaced camps unit|executive unit)\b|وزارة|منظمة الصحة/i;
export function isOfficialBody(name: string): boolean {
  return OFFICIAL_BODY.test(String(name || ""));
}

/** An official body's own site (or a wire it is not). */
const OWN_SITE = /(?:^|\.)(?:reliefweb\.int|who\.int|un\.org|unocha\.org|iom\.int|unhcr\.org|wfp\.org|ipcinfo\.org|unicef\.org|ohchr\.org|unfpa\.org|icrc\.org|fao\.org|spa\.gov\.sa|sabanew\.net|x\.com|twitter\.com|t\.me)$|\.gov(?:\.[a-z]{2})?$|\.gov\.[a-z]{2}$|\.int$/i;
/** The site an official figure was read on, when it is not the body's own (shown as "via"). */
export function viaOf(url: string | undefined): string {
  const h = host(url);
  return h && !OWN_SITE.test(h) ? h : "";
}

/** Who an outlet speaks for, from its name alone. */
function sideOf(name: string): "houthi" | "gov" | "" {
  const s = outletSide(name, "");
  if (s === "houthi" || s === "gov") return s;
  if (/Erem|Sky News Arabia|Al-?Ain|Aden al-?Ghad|Yemeni army|Government|Coalition|Saudi|Hemyari|Rougui|National Resistance|Giants|Nation.?s Shield|Sheba|Suhail|South24|2 December|Almashhad/i.test(name)) return "gov";
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

const host = (url: string | undefined) => {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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
  // The official tally's figure from someone who is no official body goes to
  // that source's side, or nowhere when it has none (Fares al-Hemyari, 1 Oct).
  const putTally = (key: string, cell: Cell) => {
    if (isOfficialBody(cell.name)) return put(key, "official", cell);
    const side = sideOf(cell.name);
    if (side && !tooSmall(cell)) put(key, side, cell);
  };
  if (tally) {
    for (const group of ["killed", "injured"] as const) {
      for (const k of ROWS[group]) {
        const v = (tally[group] as Record<string, number | null | undefined>)[k];
        const from = tally.from?.[`${group}.${k}`];
        if (Number.isFinite(v) && from) putTally(`${group}.${k}`, { ...from, value: v as number });
      }
    }
    for (const k of ["idp", "refugees"] as const) {
      const v = tally[k];
      if (Number.isFinite(v) && tally.from?.[k]) putTally(k, { ...tally.from[k], value: v as number });
    }
  }
  for (const [key, bySide] of Object.entries(claims?.fields ?? {})) {
    for (const [col, claim] of Object.entries(bySide ?? {}) as [Column, Cell][]) {
      if (!claim || tooSmall(claim)) continue;
      // The same figure from the same site already stands in another column.
      if (Object.values(cells[key] ?? {}).some((x) => x && x.value === claim.value && host(x.url) && host(x.url) === host(claim.url))) continue;
      const side = sideOf(claim.name);
      put(key, side && side !== col ? side : col, claim);
    }
  }
  for (const row of Object.values(cells)) {
    const off = row.official;
    if (off) {
      const via = viaOf(off.url);
      if (via) row.official = { ...off, via };
    }
  }
  const dates = Object.values(cells).flatMap((r) => Object.values(r).map((x) => String(x?.date || "")));
  return { cells, asOf: dates.sort().at(-1) || base.asOf };
}
