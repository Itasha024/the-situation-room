/**
 * The Gaza desk's kinds of event (user, 26 Oct: "the clash type … doesn't represent the wide variety of pins under it"):
 * what was done, told apart; who did it is the pin's colour. public/app.js has the same list (gaza-desk.test.ts checks
 * they match), for the live pins; the researched ones carry the kind by name (scripts/gaza-research/pins-build.mts).
 */
export const GAZA_KINDS = ["strike", "gunfire", "raid", "demolition", "property", "assault", "attack", "combat", "funeral", "vessel"] as const;
export type GazaKind = (typeof GAZA_KINDS)[number];
const FUNERAL_RE = /\b(?:funerals?|mourners|burial|buried|laid to rest)\b/i;
export const GAZA_KIND_RES: [GazaKind, RegExp][] = [
  ['funeral', FUNERAL_RE],
  ['vessel', /\b(?:fishing boats?|fishermen|fisherman|gunboats?|navy|naval|at sea|off the coast)\b/i],
  ['attack', /\b(?:stab(?:s|bed|bing|bings)?|rams|ramm(?:ed|ing|ings)|car-ramming|shooting attack|terror attack|explosive devices?|IEDs?|roadside bomb|car bomb|bombs? (?:was|were)? ?(?:planted|thrown|hurled|detonated)|rockets? (?:was |were )?(?:fired|launched)|rocket fire|mortars? (?:was |were )?(?:fired|launched)|mortar fire|firebombs?|molotov\w*|hand grenades?|grenade attack|(?:threw|hurled|throws|hurls) (?:an? )?(?:grenade|explosive)|(?:opened|open|opens) fire (?:on|at|toward) (?:troops|soldiers|forces|an? Israeli|Israelis|a checkpoint|a bus|cars|vehicles|a car)|attack(?:ed|s)? (?:on )?(?:troops|soldiers|Israeli (?:forces|vehicles|soldiers|troops|citizens|civilians)|an army post|a checkpoint)|ambush\w*)\b/i],
  ['strike', /\b(?:air ?strikes?|airstrikes?|drones?|quadcopters?|shell(?:s|ed|ing)?|artillery|tank (?:fire|shells?|rounds?)|missiles?|warplanes?|aircraft|helicopters?|strikes?|struck|bombard\w*|bombing)\b/i],
  ['demolition', /\b(?:demolish\w*|bl(?:ow|ows|ew|own) up|blow(?:s|n)? up (?:\w+ )?(?:homes?|houses?|buildings?)|demolition\w*|bulldoz\w*|raz(?:e|ed|es|ing)|blew up (?:a |the |two |several )?(?:homes?|houses?|buildings?)|blow up (?:a |the )?(?:homes?|houses?|buildings?)|levell?(?:ed|ing))\b/i],
  ['property', /\b(?:torch\w*|damag\w*|wreck\w*|slogans|spray\w* (?:slogans|graffiti)|set up (?:an? |the )?(?:new )?(?:house|structure|tent|caravan|outpost|road|gate)|put up|gates?|set (?:fire|alight)|set (?:\w+ ){1,3}(?:on fire|ablaze|alight)|attack\w* (?:farmland|land|crops|fields|olive groves)|cattle|cows|crops|graz\w*|sets fire|arson|burn(?:s|ed|t|ing)?|vandali[sz]\w*|uproot\w*|cut down|chop\w* down|stole|steal\w*|theft|loot\w*|livestock|sheep|goats|olive trees|graffiti|outposts?|smash\w*|seiz(?:e|ed|es|ing) (?:land|a |the |their )|take over|took over|fence|caravans?)\b/i],
  ['assault', /\b(?:beat(?:s|en|ing)?|assault\w*|extremists? attack\w*|attacks? by (?:Israeli )?extremists|attack(?:s|ed|ing)? (?:shepherds|farmers|residents|olive pickers|pickers|a family|families|homes?|a home|houses?|villagers|a (?:man|woman|boy|girl|shepherd|farmer|youth|journalist)|journalists|activists|people|worshippers|a school)|ston(?:e|es|ed|ing)|pepper[- ]spray\w*|ran over|run over|runs over|abduct\w*|kidnap\w*|chas(?:e|ed|es|ing)|harass\w*|(?:drive|drives|drove|driving) \w+ off|attack\w* (?:\w+ )?(?:vehicles|cars|workers))\b/i],
  ['gunfire', /\b(?:shot|shots|vehicles fire|shoot\w*|gunfire|machine[- ]?guns?|heavy fire|fire heavily|Israeli fire|(?:fire|fires|fired|firing) (?:machine guns?|heavily|shots|flares|toward|towards)|killed (?:an?|two|three|four|five|\d+) (?:armed )?(?:operatives?|gunm[ae]n|Palestinians?|suspects?) who|live (?:fire|rounds|ammunition)|sniper\w*|bullets?|opened fire|open fire|opens fire|fire[sd]? (?:at|on|toward|towards)|by (?:Israeli )?fire|(?:IDF|army|vehicle|tank|naval) fire|(?:troops'?|tanks?|forces'?) fire|killed by (?:Israeli )?(?:troops|forces)|grenades?|gunshot)\b/i],
  ['raid', /\b(?:raid\w*|storm\w*|seal\w*|surround\w*|operations?|block\w*|disrupt\w*|prevent\w*|expel\w*|arrest\w*|detain\w*|detention|incursions?|search\w*|clos(?:e|ed|es|ing|ure)|checkpoints?|siege|besieg\w*|curfew|summon\w*|enter(?:s|ed|ing)?|interrogat\w*|abduction|shut\w*|tear gas|gas|suffocat\w*|advanc\w*|dismantl\w*|(?:force|forces|forced|order|orders|ordered) (?:\w+ ){1,4}out)\b/i],
  // Any other attack (on people, vehicles, workers): an assault, not a clash.
  ['assault', /\battack\w*\b/i],
  ['combat', /\b(?:clash\w*|confront\w*|exchange of fire|gunfights?|firefights?|fighting|militias?|clan)\b/i],
];
export function gazaKindOf(text: string): GazaKind {
  for (const [k, re] of GAZA_KIND_RES) if (re.test(text)) return k;
  return "combat";
}
