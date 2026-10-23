/**
 * The Gaza – Judea & Samaria desk's own words (user, 23 Oct), on every card, the brief, the map and the
 * numbers: never "West Bank" but "Judea and Samaria"; never "settlers" but "Israeli citizens"; "settler
 * violence" is "extremists' violence"; never "ceasefire violations" but "attacks". The reader is told so;
 * this puts it right wherever a model or a stored card says otherwise.
 */

const RULES: [RegExp, string][] = [
  // The longer phrases first, so their parts are not rewritten on their own.
  [/\b(?:settler|colonist)(?:s'|'s)? (?:violence|attacks?|terror(?:ism)?)\b/gi, "extremists' violence"],
  // Settlers doing violence are extremists; the rest are citizens.
  [/\b(?:Israeli )?(?:settlers|colonists)'? (?:attack(?:ed|s)?|assault(?:ed|s)?|torch(?:ed|es)?|burn(?:ed|s|t)?|set fire|raid(?:ed|s)?|storm(?:ed|s)?|vandali[sz](?:ed|e|es)|uproot(?:ed|s)?|cut down|beat(?:s|en)?|ston(?:ed|e|es)|sho(?:ot|ot|t|ots)|injur(?:ed|e|es)|wound(?:ed|s)?|kill(?:ed|s)?|assault)\b/gi, "Israeli extremists $&"],
  [/\b(?:ceasefire|cease-fire|truce) (?:violations?|breach(?:es)?)\b/gi, "attacks"],
  [/\b(?:violations?|breach(?:es)?) of the (?:ceasefire|cease-fire|truce)\b/gi, "attacks"],
  [/\b(?:violated|violating|violates|breached|breaching|breaches) the (?:ceasefire|cease-fire|truce)\b/gi, "attacked"],
  [/\b(?:the )?(?:Israeli-)?(?:occupied )?West Bank\b/gi, "Judea and Samaria"],
  [/\bIsraeli settlers\b/gi, "Israeli citizens"],
  [/\bsettlers\b/gi, "Israeli citizens"],
  [/\bsettler\b/gi, "Israeli citizen"],
  // WAFA's word for them ("مستعمرون", 23 Oct), as a model writes it in English.
  [/\b(?:Israeli )?colonists\b/gi, "Israeli citizens"],
  [/\bcolonist\b/gi, "Israeli citizen"],
];

export function gazaWords(s: string): string {
  let out = String(s || "");
  for (const [re, to] of RULES) out = out.replace(re, to);
  // The phrase rule above leaves "Israeli extremists settlers attacked": the citizens rule then makes it whole.
  out = out.replace(/\bIsraeli extremists (?:Israeli )?(?:Israeli citizens|settlers|colonists)\b/gi, "Israeli extremists");
  return out.replace(/^judea and samaria/, "Judea and Samaria").replace(/(^|[.:!?]\s+)israeli/g, (m, p) => `${p}Israeli`);
}

/** The rules as the reader is told them. */
export const GAZA_WORD_RULES = `- The desk's own words, always: "Judea and Samaria", never "West Bank" (nor "occupied West Bank"); "Israeli citizens", never "settlers" or "colonists" (WAFA's "مستعمرون"); their attacks are "extremists' violence" or "Israeli extremists attacked …", never "settler violence"; "attacks", never "ceasefire violations" or "breaches of the truce" (the IDF sees its strikes as responses, so neither side's word is used). Jerusalem's neighbourhoods by their names.`;
