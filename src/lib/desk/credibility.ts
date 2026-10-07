/**
 * The trust figure on a card: 1.0–5.0, "Confidence 3.4/5".
 *
 * WHY THIS EXISTS: the figure used to be the gate's INTEREST score plus a bump
 * for agency outlets — how relevant an item was, presented as how far it could
 * be trusted. This scores what a careful desk editor actually weighs:
 *
 *   who reported it        a wire agency or neutral outlet over a party's own
 *                          media
 *   against interest?      a party claiming its own gains is weak evidence; a
 *                          party admitting its own losses is strong evidence
 *   how specific           a place, a figure, a time can be checked and
 *                          contradicted; a vague claim cannot
 *   who else carried it    counted by SIDE, not by post — five Houthi channels
 *                          repeating one claim are one source. The other side
 *                          confirming it is the strongest signal there is.
 *
 * For a statement, the question is only whether it was said, which a party's
 * own outlet reporting its own official settles well.
 */

export type OutletSide = "houthi" | "gov" | "neutral" | "agency";

export type CredibilityInput = {
  side: OutletSide;
  /** A statement: the fact at stake is that it was said. */
  statement: boolean;
  /** Does the report favour the side of the outlet carrying it? */
  interest: "for" | "against" | "neutral";
  hasPlace: boolean;
  hasFigure: boolean;
  hasTime: boolean;
  /** Sides of OTHER outlets that carried the same story. */
  corroboratedBy: OutletSide[];
  /** How far the outlet's own record has moved it from where it started (source-rating.ts). */
  record?: number;
};

const BASE: Record<OutletSide, number> = { agency: 3.6, neutral: 3.0, gov: 2.4, houthi: 2.4 };

export function credibility(x: CredibilityInput): number {
  if (x.statement) {
    const s = x.side === "agency" ? 4.3 : x.side === "neutral" ? 3.9 : 3.7;
    return clamp(s + (x.corroboratedBy.length ? 0.3 : 0));
  }

  let s = BASE[x.side] + (x.record ?? 0);
  if (x.interest === "for") s -= 0.4;
  if (x.interest === "against") s += 0.7;
  if (x.hasPlace) s += 0.2;
  if (x.hasFigure) s += 0.2;
  if (x.hasTime) s += 0.1;
  if (!x.hasPlace && !x.hasFigure) s -= 0.3;

  // Independent confirmation, one step per distinct side.
  const others = new Set(x.corroboratedBy.filter((c) => c !== x.side));
  const opposite = x.side === "houthi" ? "gov" : x.side === "gov" ? "houthi" : null;
  for (const c of others) s += c === opposite ? 0.9 : c === "agency" ? 0.7 : 0.5;

  return clamp(s);
}

function clamp(n: number): number {
  return Math.round(Math.min(5, Math.max(1, n)) * 10) / 10;
}

/**
 * A party's own outlet, as against a paper that merely takes its side.
 *
 * Al-Masirah is the Houthis' own channel and Saree their own spokesman;
 * Al-Akhbar is a Lebanese daily sympathetic to them. Both come out as
 * "houthi" from `outletSide`, which is right for weighing a claim and wrong
 * for deciding who a statement belongs to. When the movement's own outlet
 * carries a statement a sympathetic paper reported first, the statement is
 * the movement's, and the paper is relaying it.
 */
export function homeOutlet(source: string): boolean {
  return /^(?:Al-?Masirah|Saba(?! \(government\))|Yahya Saree|Mohammed Abdulsalam|Al-?Thawrah|SPA)\b/i.test(String(source || "").trim());
}
/**
 * Fast aggregators, never a primary source (user, 3 Oct: Clash Report). First
 * with a story, their card stands only until a source of its own tells it.
 */
export function isAggregator(source: string): boolean {
  return /^(?:Clash Report|OSINTdefender)$/i.test(String(source || "").trim());
}
/** Which side an outlet is on, from its catalogue lean and name. */
export function outletSide(source: string, lean: string): OutletSide {
  if (
    /^(Reuters|AP|AFP|BBC|WSJ|NYT|Washington Post|CNN|CBS|ABC|NBC News|Axios|Bloomberg|Politico|Financial Times|The Guardian|The Telegraph|France 24|US media|UKMTO)$/i.test(
      source.trim(),
    )
  ) {
    return "agency";
  }
  if (lean === "houthi") return "houthi";
  if (lean === "gov" || lean === "south") return "gov";
  if (/Saba(?! \(government\))|Masirah|Saree|Abdulsalam|Al-?Thawrah|Mayadeen|Akhbar|Yemen Press Agency/i.test(source)) return "houthi";
  if (/SPA|Arab News|Asharq|Okaz|Hadath|Arabiya|Almashhad|Bin Saeed|Saba \(government\)|Sawt al-Asima|Mareb Press|Al-Masdar Online|Aden al-Ghad|Saudi Gazette/i.test(source)) return "gov";
  return "neutral";
}
