/**
 * The Gaza – Judea & Samaria desk's own words (user, 23 Oct), on every card, the brief, the map and the
 * numbers: never "West Bank" but "Judea and Samaria"; never "settlers" but "Israeli citizens"; "settler
 * violence" is "extremists' violence"; never "ceasefire violations" but "attacks". The reader is told so;
 * this puts it right wherever a model or a stored card says otherwise.
 */

const RULES: [RegExp, string | ((m: string) => string)][] = [
  // The longer phrases first, so their parts are not rewritten on their own.
  // Quds News's "Israeli settler militias", "extremist settler gangs", "colonial settlers" (26 Oct).
  [/\b(?:extremist )?(?:Israeli )?(?:extremist )?(?:colonial )?(?:settler|colonist)s?['’]? (?:militias?|gangs?|groups?|mobs?|herds?)\b/gi, "Israeli extremists"],
  [/\b(?:extremist|radical) (?:Israeli )?(?:settlers|colonists)\b/gi, "Israeli extremists"],
  [/\bcolonial (?=(?:Israeli |extremist |settlers?|colonists?))/gi, ""],
  // "An Israeli settler attacks journalists": one man's act, not "settler attacks".
  [/\b(an?|one) (?:Israeli )?(?:settler|colonist) (attacks|assaults|beats|stabs|shoots|torches|rams|runs over)\b/gi, "$1 Israeli extremist $2"],
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
  // Their side's words against Israel are not the desk's (user, 26 Oct): "occupation forces", "martyrs",
  // "massacre", "aggression", "storm Al-Aqsa", "genocide".
  [/\b(?:the )?(?:Israeli )?occupation(?:'s)? (?:forces|army|soldiers|troops)\b/gi, "Israeli forces"],
  [/\b(?:the )?(?:Israeli )?occupation (?:authorities|government)\b/gi, "the Israeli authorities"],
  [/\b(?:the )?(?:Israeli )?occupation (?:bulldozers|drones?|aircraft|warplanes|tanks?|artillery|vehicles|police|navy|gunboats)\b/gi, (m: string) => `Israeli ${m.split(/\s+/).pop()}`],
  // "The Israeli occupation demolished …", "Israeli occupation gunfire", "the occupation municipality" (QNN, 26 Oct).
  [/\b(?:the )?(?:Israeli )?occupation (?=(?:demolish|raid|arrest|kill|storm|bulldoz|seiz|clos|block|detain|shoot|shot|fire[ds]?\b|open|attack|destroy|confiscat|issue|order|abduct|prevent|impos|withdr|advanc|bomb|shell|target)\w*)/gi, "Israeli forces "],
  [/\b(?:the )?Israeli occupation (?=[a-z])/g, "Israeli "],
  [/\boccupation (municipality|court|prison|jails?|authorities|government|police)\b/gi, "Israeli $1"],
  [/\b(\w+(?:-\w+)?) family massacre\b/gi, "killing of the $1 family"],
  [/\bin (?:the )?occupied (?:Palestine|Palestinian territor(?:y|ies))\b/gi, "in Gaza and Judea and Samaria"],
  [/\b(?:occupied|Israeli-occupied) (?:East )?Jerusalem\b/gi, "East Jerusalem"],
  [/\b(?:the )?occupied (Hebron|Nablus|Jenin|Tulkarm|Ramallah|Bethlehem|Jericho|Qalqilya|Tubas|Salfit)\b/gi, "$1"],
  [/\bmartyrdom of\b/gi, "killing of"],
  [/\bwere martyred\b/gi, "were killed"],
  [/\bwas martyred\b/gi, "was killed"],
  [/\bmartyred\b/gi, "killed"],
  [/\bmartyrs\b/gi, "dead"],
  [/\bmartyr\b/gi, "person killed"],
  [/\b(?:Israeli|occupation|Zionist) massacres\b/gi, "deadly Israeli strikes"],
  [/\b(?:Israeli|occupation|Zionist) massacre\b/gi, "deadly Israeli strike"],
  [/\b(?:Israeli|occupation|Zionist) aggression\b/gi, "Israeli strikes"],
  [/\b(?:Israeli|occupation|Zionist) genocide\b/gi, "the war"],
  [/\bgenocide in (?:the )?Gaza(?: Strip)?\b/gi, "war in Gaza"],
  [/\bZionist (?:enemy|entity|regime)\b/gi, "Israel"],
  [/\bZionists?\b/g, "Israeli"],
  [/\b(stormed|storming|storms|storm) (?:the )?(?:Al-Aqsa|al-Aqsa|Aqsa)(?: Mosque)?(?: compound)?\b/gi, (m: string) => `${({ stormed: "entered", storming: "entering", storms: "enter", storm: "enter" } as Record<string, string>)[m.split(/\s+/)[0].toLowerCase()]} the Temple Mount (Al-Aqsa) compound`],
  [/\bresistance fighters\b/gi, "gunmen"],
  // No "occupation" or "occupied" anywhere on the site (user, 29 Oct: "Occupation machines begin paving…" from
  // Radio Alam): whatever the noun after it, it is Israel's; the Houthis' "occupied provinces" are the government's.
  [/\b(?:the )?(?:Israeli )?occupation(?:'s)? (?:machines|machinery|equipment|diggers|excavators|cranes)\b/gi, "Israeli bulldozers"],
  [/\b(end(?:ing|s|ed)?|end (?:of|to)) (?:the )?(?:Israeli )?occupation\b/gi, "$1 Israeli rule"],
  [/["“]?\boccupied["”]? (provinces|governorates|areas of Yemen|southern provinces)\b/gi, "government-held $1"],
  [/\b(?:the )?(?:1948 )?occupied (?:interior|lands|land of 1948|territories of 1948)\b/gi, "Israel"],
  [/\b(?:the )?occupied (?:Palestinian )?territor(?:y|ies)\b/gi, "Gaza and Judea and Samaria"],
  [/\b(?:the )?(?:Israeli-)?occupied (?:Syrian )?Golan(?: Heights)?\b/gi, "the Golan Heights"],
  [/\b(?:Israeli-)?occupied (?=[A-Z]|(?:Lebanese|Syrian|Palestinian|Arab) |(?:land|lands|areas?|positions?|points?|hills?|villages?|towns?)\b)/g, "Israeli-held "],
  [/\b(?:by|from|with|against|on|of) (?:the )?(?:Israeli )?occupation\b/gi, (m: string) => `${m.split(/\s+/)[0]} Israel`],
  [/\b(?:the )?(?:Israeli )?occupation(?:'s)? (?=[a-z])/gi, "Israeli "],
  [/\b(?:the )?(?:Israeli )?occupation\b/gi, "Israel"],
];

export function gazaWords(s: string): string {
  let out = String(s || "");
  for (const [re, to] of RULES) out = typeof to === "string" ? out.replace(re, to) : out.replace(re, to);
  // The phrase rule above leaves "Israeli extremists settlers attacked": the citizens rule then makes it whole.
  out = out.replace(/\bIsraeli extremists (?:Israeli )?(?:Israeli citizens|settlers|colonists)\b/gi, "Israeli extremists");
  // "Israeli Israeli citizens", "Extremist Israeli extremists": one word once.
  out = out.replace(/\b(Israeli)\s+Israeli\b/gi, "$1").replace(/\bextremist (Israeli extremists)\b/gi, "$1");
  out = out.replace(/\b([Aa]) (Israeli?)\b/g, "$1n $2");
  return out.replace(/^judea and samaria/, "Judea and Samaria").replace(/(^|[.:!?]\s+)israeli/g, (m, p) => `${p}Israeli`).replace(/^(?:deadly|dead|the war)\b/, (m) => m[0].toUpperCase() + m.slice(1));
}

/** The rules as the reader is told them. */
export const GAZA_WORD_RULES = `- The desk's own words, always: "Judea and Samaria", never "West Bank" (nor "occupied West Bank"); "Israeli citizens", never "settlers" or "colonists" (WAFA's "مستعمرون"); their attacks are "extremists' violence" or "Israeli extremists attacked …", never "settler violence"; "attacks", never "ceasefire violations" or "breaches of the truce" (the IDF sees its strikes as responses, so neither side's word is used). Jerusalem's neighbourhoods by their names.
- A Palestinian source's account (the Gaza or Ramallah health ministries, Civil Defence, WAFA, Safa, Shehab, Quds News, local journalists, the factions) is its claim, never the desk's fact: the headline names its teller ("Gaza's Hamas-run Health Ministry says …", "Palestinian media report …", "WAFA: …"). Their words against Israel are never the desk's: not "occupation"/"occupation forces" (say "Israeli forces"), "martyrs" (say "killed"), "massacre", "aggression", "genocide", "Zionist", "resistance" for armed groups (say "Hamas", "gunmen"), "storming Al-Aqsa" (say "entered the Temple Mount compound"), "colonists".`;
