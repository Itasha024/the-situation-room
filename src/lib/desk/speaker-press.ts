/**
 * Who leads a card on a leader's words: the press of the speaker's own
 * country before a third country's relay (user, 8 Oct: Trump's words on the
 * midterms led by Al Jazeera Mubasher while CNN and Bloomberg sat in "Also").
 */
import type { IranLean } from "./iran-sources.ts";

export type Nation = "us" | "iran" | "israel";

const US_SPEAKER =
  /^(?:the )?(?:US|U\.S\.|American|Trump|Vance|Rubio|Hegseth|Witkoff|Leavitt|Bessent|Waltz|Kushner|White House|Pentagon|State Department|Treasury|CENTCOM|US Central Command)\b/i;
const IRAN_SPEAKER =
  /^(?:the )?(?:Iran|Iranian|Tehran|IRGC|Revolutionary Guards?|Khamenei|Pezeshkian|Araghchi|Baghaei|Ghalibaf|Larijani|Vahidi|Hatami|Mohajerani|Gharibabadi|Velayati|Jalili|Mohseni-Ejei|Khatam al-Anbiya)\b/i;
const ISRAEL_SPEAKER = /^(?:the )?(?:Israel|Israeli|IDF|Netanyahu|Katz|Saar|Zamir|Mossad)\b/i;

/** Whose words a headline opens with, when it opens with a speaker of the three. */
export function speakerNation(headline: string): Nation | null {
  const h = String(headline || "").trim();
  if (US_SPEAKER.test(h)) return "us";
  if (IRAN_SPEAKER.test(h)) return "iran";
  if (ISRAEL_SPEAKER.test(h)) return "israel";
  return null;
}

/** US outlets that are not their own speakers' press: the government's Persian and Arabic services. */
const US_FOREIGN_SERVICES = /^(?:VOA Farsi|Radio Farda|Alhurra)$/;
/** Axis-aligned outlets outside Iran: they relay Tehran, they are not its press. */
const AXIS_ABROAD = /Mayadeen|Al-Akhbar|Hezbollah|Manar|Masirah|Saba|Houthi|Ansar|Kataib|Nujaba|Sabereen|Iraq|Unews|Yemen/i;
const US_REPORTERS = /^(?:Barak Ravid|Bloomberg\.com|Jennifer Jacobs|Jacqui Heinrich|Peter Doocy)$/;

/** The country whose own press `source` is, by its group on the Iran desk. */
export function pressNation(source: string, lean: IranLean | string): Nation | null {
  const s = String(source || "");
  if (US_REPORTERS.test(s)) return "us";
  if (lean === "us") return US_FOREIGN_SERVICES.test(s) ? null : "us";
  if (lean === "israel") return "israel";
  if (lean === "axis") return AXIS_ABROAD.test(s) ? null : "iran";
  return null;
}

/**
 * Does the newcomer `r` carry the speaker's words from his own country's
 * press, where the card's lead does not?
 */
export function nearerToSpeaker(
  headline: string,
  r: { source: string; lean: IranLean | string },
  home: { source: string; lean: IranLean | string },
): boolean {
  const who = speakerNation(headline);
  if (!who) return false;
  return pressNation(r.source, r.lean) === who && pressNation(home.source, home.lean) !== who;
}
