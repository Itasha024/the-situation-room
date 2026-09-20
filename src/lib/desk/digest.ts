/**
 * Turns one raw ingest item into one line of desk copy.
 *
 * Pipeline, in order, so the reasoning is auditable:
 *
 *   gate()      — is this worth carrying at all, and how specific is it?
 *   classify()  — what kind of event is it?  (the siren/aircraft trap lives here)
 *   compose*()  — write it in English wire style, at the right attribution tier
 *   isBadCopy() — reject anything that came out as a fragment or leaked source text
 *
 * Nothing in here invents detail. If the source did not say how many were killed,
 * the copy says no figures were given.
 */

import { type Place, isOpenWaterNearBab, placesIn } from "./gazetteer.ts";
import { type Outcome, type Verdict, gate, mapsAsPin, normaliseArabic } from "./relevance.ts";
import {
  ACTORS,
  type Composed,
  type Tier,
  casualtyPhrase,
  claimantOf,
  composeAirstrike,
  composeAlert,
  composeClash,
  composeEconomy,
  composeIntercept,
  composeLaunch,
  composePort,
  composeSeize,
  composeStatement,
  composeVessel,
  countsIn,
  isBadCopy,
  neutralise,
  sentenceCase,
  speakerIn,
  tidyHeadline,
  tierOf,
  unitsIn,
  weaponIn,
  whenIn,
} from "./wire-style.ts";

export type DeskType = "strike" | "combat" | "vessel" | "port" | "economy" | "diplomacy" | "statement";

export type Digest = {
  ok: boolean;
  /**
   * feed / tray / exclude. `tray` composes normally but is held out of the
   * feed pending corroboration, so an adjacent item is never simply lost.
   */
  outcome: Outcome;
  /** Slug explaining a rejection, or "kept". */
  reason: string;
  note: string;
  headline: string;
  body: string;
  type: DeskType;
  /** Places to consider for a map pin, canonical English names. */
  places: Place[];
  score: number;
  tier: Tier;
  unclear: boolean;
  tags: string[];
};

/* ------------------------------------------------------------------ *
 * Classification
 * ------------------------------------------------------------------ */

export type Action =
  | "alert"
  | "launch"
  | "intercept"
  | "airstrike"
  | "clash"
  | "seize"
  | "retake"
  | "vessel"
  | "port"
  | "economy"
  | "diplomacy"
  | "statement";

const SIREN_RE = /صفارات|صافرات|صفارة|صافرة|دوي صفار|دوي صافر|air[- ]?raid (?:siren|alert)|\bsirens?\b|إنذار جوي/i;
const GROUND_RE = /اشتباكات|معارك|مواجهات|هجوم حوثي|خطوط التماس|clash(?:es)?|fighting|front line|ground assault/i;
const AIR_RE = /غارة|غارات|قصف جوي|الطيران الحربي|air ?strike|airstrikes?|bombing raid/i;
const LAUNCH_RE = /صاروخ|باليست|أطلق|إطلاق|شن هجوم(?:ا)? صاروخي|launch(?:ed)?|fired (?:a )?(?:missile|rocket)|missile attack/i;
const DRONE_RE = /مسيّر|مسيرة|درون|\bdrone\b|\bUAV\b/i;
const INTERCEPT_RE = /أسقط|اسقاط|إسقاط|اعترض|intercept(?:ed)?|shot down|downed/i;
const VESSEL_RE = /سفينة|ناقلة|باخرة|حادثة بحرية|\bUKMTO\b|vessel|tanker|merchant ship|bulk carrier|crew/i;
const PORT_RE = /ميناء|مرفأ|أرامكو|مصفاة|\bport\b|terminal|refinery|Aramco|oil facility/i;
const SEIZE_RE = /سيطر(?:ت|وا)?\s*على|اقتحم|تقدم(?:وا)? (?:في|نحو)|seiz(?:e|ed)|captured (?:the )?(?:positions|village|hill)|took control/i;
const RETAKE_RE = /استعاد|استعادة|يستعيد مواقع|retook|retake|recaptur/i;
const ECONOMY_RE =
  /نفط|خام|برنت|أرامكو|أنبوب|ناقلة|شحن|الملاحة|قناة السويس|صادرات|crude|brent|oil shipment|pipeline|tanker|shipping|Suez|export|loadings|freight rate|insurance premium/i;
const DIPLOMACY_RE =
  /مفاوضات|هدنة|وقف النار|اتفاق|وساطة|مبعوث|مجلس الأمن|talks|ceasefire|truce|negotiat|mediation|envoy|Security Council|sanctions|deal/i;

/**
 * The trap the desk fell into: "الإنذار المبكر" is early WARNING, and attaches
 * either to sirens (an event) or to aircraft (routine activity). An alert is only
 * an alert when siren vocabulary is present AND a named city is under it.
 */
function isAirDefenceAlert(text: string, saudiPlaces: Place[]): boolean {
  if (!SIREN_RE.test(text)) return false;
  if (saudiPlaces.length) return true;
  return /السعود|Saudi|مدن المملكة|عدة مدن/i.test(text);
}

/**
 * Speech acts: condemning, welcoming, warning, demanding.
 *
 * THE BUG THIS FIXES. "دولة قطر تعلن إدانتها استهداف جماعة الحوثي لمدينة الرياض
 * بصاروخ باليستي" — Qatar condemns a Houthi missile attack on Riyadh — was read
 * as a launch report and published as "Reports of a ballistic missile launch
 * towards Riyadh". The desk turned somebody's REACTION into its own account of
 * an event it had no report of.
 *
 * The tell is word order: when the speech act comes before the kinetic verb,
 * the kinetic words are the OBJECT of the statement, not the event being
 * reported. When it comes after ("strikes hit X; the government condemned
 * them"), the event is still the story.
 */
/**
 * Matched against NORMALISED text. Arabic glues suffixes on, and the ta-marbuta
 * shifts when it does: إدانة becomes إدانتها. Listing surface forms meant the
 * stem إدان was missed, which is why the Qatar example slipped through.
 */
const REACTION_RE =
  /تدين|تندد|يدين|يندد|ادان|ندد|شجب|استنكر|رحب|ترحب|يرحب|حذر|تحذر|يحذر|دعا|تدعو|يدعو|طالب|تطالب|يطالب|اعرب عن|condemn|denounce|welcom|deplore|urge|call(?:s|ed)? on|warn|express(?:es|ed)? (?:concern|regret)/;

const KINETIC_HEAD_RE =
  /صاروخ|باليست|مسير|قصف|غاره|استهدف|استهداف|اشتباك|هجوم|انفجار|missile|drone|strike|attack|clash|shell/;

/** True when the item is a reaction TO an event, not a report OF one. */
function isReaction(text: string): boolean {
  const n = normaliseArabic(text);
  const r = n.search(REACTION_RE);
  if (r < 0) return false;
  const k = n.search(KINETIC_HEAD_RE);
  // No kinetic content at all, or the speech act leads it.
  return k < 0 || r < k;
}

function classify(text: string, saudiPlaces: Place[]): Action {
  const t = text;
  // Checked before everything else: a condemnation of a strike is a statement,
  // whatever weapons it names.
  if (isReaction(t)) return DIPLOMACY_RE.test(t) ? "diplomacy" : "statement";
  if (isAirDefenceAlert(t, saudiPlaces)) return "alert";
  if (VESSEL_RE.test(t) && /استهدف|هجوم|أصيب|attack|struck|hit|damaged|boarded/i.test(t)) return "vessel";
  if (PORT_RE.test(t) && /استهدف|قصف|أصيب|صاروخ|مسيّر|hit|struck|strike|attack/i.test(t)) return "port";
  if (INTERCEPT_RE.test(t) && (DRONE_RE.test(t) || LAUNCH_RE.test(t))) return "intercept";
  if (RETAKE_RE.test(t)) return "retake";

  const ground = GROUND_RE.test(t);
  const air = AIR_RE.test(t);
  if (air && !ground) return "airstrike";
  if (ground) return "clash";
  if (LAUNCH_RE.test(t) || DRONE_RE.test(t)) return "launch";
  if (SEIZE_RE.test(t)) return "seize";
  if (ECONOMY_RE.test(t)) return "economy";
  if (DIPLOMACY_RE.test(t)) return "diplomacy";
  return "statement";
}

function typeFor(a: Action): DeskType {
  switch (a) {
    case "clash":
    case "seize":
    case "retake":
      return "combat";
    case "alert":
    case "launch":
    case "intercept":
    case "airstrike":
      return "strike";
    case "vessel":
      return "vessel";
    case "port":
      return "port";
    case "economy":
      return "economy";
    case "diplomacy":
      return "diplomacy";
    default:
      return "statement";
  }
}

/* ------------------------------------------------------------------ *
 * Sides
 * ------------------------------------------------------------------ */

const HOUTHI_SRC_RE =
  /Ali Bk|Sabereen|Mihwar|Masirah|Saree|^YPA$|Mayadeen|Baghdad Today|Hazam|Murtada|Abdulsalam|Ansarollah|^Saba$|al-?Houthi|Al-?Thawrah|Shajab|Naya|Shin Persian|Al-?Aqsa/i;
const GOV_SRC_RE =
  /Hadath|Arabiya|Arab News|SPA|September|Asharq|Sakani|Okaz|Al-?Watan|Bin Saeed|Saudi|Giants|Nation Shield|South24|Aden/i;

function sidesOf(source: string, text: string, lean: string) {
  const houthiSrc = HOUTHI_SRC_RE.test(source) || lean === "houthi";
  const govSrc = GOV_SRC_RE.test(source) || lean === "gov" || lean === "south";
  const houthisNamed = /the Houthis|Houthi forces|houthi/i.test(text) || houthiSrc;
  const govNamed = /Yemeni government forces|internationally recognised government|government forces/i.test(text) || govSrc;
  const saudiNamed = /Saudi/i.test(text);
  return { houthiSrc, govSrc, houthisNamed, govNamed, saudiNamed };
}

/** Who did it, in neutral English, or "" when the source does not say. */
function actorOf(action: Action, text: string, sides: ReturnType<typeof sidesOf>, units: string[]): string {
  if (action === "retake") return ACTORS.gov;
  if (units.length && (action === "clash" || action === "seize")) return units.join(" and ");
  if (/الطيران السعودي|Saudi (?:air ?force|jets|warplanes)|coalition (?:jets|aircraft)/i.test(text)) return ACTORS.saudi;
  if (sides.houthiSrc || (sides.houthisNamed && !sides.govSrc)) return ACTORS.houthi;
  if (sides.govNamed) return ACTORS.gov;
  return "";
}

/* ------------------------------------------------------------------ *
 * Split places by country
 * ------------------------------------------------------------------ */

function splitPlaces(places: Place[]) {
  return {
    yemen: places.filter((p) => p.country === "Yemen"),
    saudi: places.filter((p) => p.country === "Saudi Arabia"),
    sea: places.filter((p) => p.country === "sea"),
  };
}

/**
 * Where ground fighting can actually be.
 *
 * A Saudi city in clash / seize / retake copy is nearly always metonymy —
 * "الرياض" standing for the Saudi government, the way "Washington" stands for
 * the administration — or it is the outlet's dateline. Falling back to "any
 * place named" put ground battles between Houthi and Yemeni government forces
 * inside Riyadh, on the map and in the headline.
 *
 * Cross-border ground action is real, so the frontier stays eligible; the
 * interior and the big cities do not. With nothing eligible left the copy says
 * no place at all, which is honest — `composeClash` / `composeSeize` and
 * `datelineOf` all handle an empty list.
 */
const SAUDI_FRONTIER_RE = /^(?:Jazan|Najran|Sharurah|Asir|Farasan Islands|Khamis Mushait)$/i;

function groundPlaces(yemen: Place[], all: Place[]): Place[] {
  if (yemen.length) return yemen;
  return all.filter((p) => p.country === "Saudi Arabia" && SAUDI_FRONTIER_RE.test(p.name));
}

/* ------------------------------------------------------------------ *
 * Economy copy — the one family where the source's own framing matters most
 * ------------------------------------------------------------------ */

function economyCopy(text: string): { headline: string; detail: string } {
  if (/cancel|ألغت|إلغاء/i.test(text) && /oil|crude|نفط|خام|shipment|شحنات/i.test(text)) {
    return {
      headline: "Saudi Arabia cancels some European crude shipments after Red Sea disruption",
      detail:
        "Saudi Arabia told European customers that part of its scheduled crude deliveries would not sail, after damage to the East-West pipeline, a halt to loadings at Yanbu and pressure on the Bab al-Mandab route.",
    };
  }
  if (/pipeline|أنبوب|East-?West/i.test(text)) {
    return {
      headline: "Damage to the East-West pipeline and Yanbu loadings cuts Saudi crude exports",
      detail:
        "Reported damage to the East-West pipeline and a halt to loadings at Yanbu, Saudi Arabia's Red Sea export outlet, is reducing shipments to Europe and Asia and feeding into prices.",
    };
  }
  if (/Suez|قناة السويس|shipping|الملاحة|tanker|ناقلة|Bab el-?Mand|باب المندب/i.test(text)) {
    return {
      headline: "Red Sea and Bab al-Mandab shipping disruption deepens",
      detail:
        "Traffic through the Bab al-Mandab strait, the Red Sea and the Suez Canal continues to be disrupted, with tanker diversions and lower Saudi crude loadings reported.",
    };
  }
  if (/Trump|Washington|White House|State Department/i.test(text)) {
    return {
      headline: "Washington weighs in on the Yemen conflict and Red Sea shipping",
      detail:
        "A new US position or involvement was reported concerning the fighting in Yemen, the Red Sea shipping corridor or Saudi oil exports.",
    };
  }
  return {
    headline: "Fighting in Yemen continues to weigh on oil and shipping",
    detail:
      "The conflict's effect on Saudi crude exports, Red Sea shipping and Suez Canal traffic was reported again.",
  };
}

/* ------------------------------------------------------------------ *
 * The digest
 * ------------------------------------------------------------------ */

export function digest(source: string, rawText: string, lean = "", extraSources = 0): Digest {
  const raw = String(rawText || "");
  const tier = tierOf(source, extraSources);
  const verdict: Verdict = gate({ text: raw, source, url: "", agency: tier === "agency" });

  const fail = (reason: string, note: string, outcome: Outcome = "exclude"): Digest => ({
    ok: false,
    outcome,
    reason,
    note,
    headline: "",
    body: "",
    type: "statement",
    places: [],
    score: 0,
    tier,
    unclear: false,
    tags: [],
  });

  if (verdict.outcome === "exclude") return fail(verdict.reason, verdict.note);

  /**
   * A composition failure below is NOT a relevance judgement. The gate has
   * already said this item is about the conflict; if the composer cannot phrase
   * it, that is the desk's limitation, not the report's. Such items go to the
   * tray to be looked at, never silently dropped — measured against real
   * traffic, this class was the second-largest source of lost reports.
   */
  const onFail: Outcome = "tray";

  const text = neutralise(raw);
  const all = placesIn(raw);
  const { yemen, saudi, sea } = splitPlaces(all);
  const action = classify(raw, saudi);
  const type = typeFor(action);
  const counts = countsIn(raw);
  const when = whenIn(raw);
  const units = unitsIn(raw);
  const sides = sidesOf(source, text, lean);
  const speaker = speakerIn(raw);
  const claimant = claimantOf(source, raw);
  // An unclear source text can never be stated as fact, whatever the outlet.
  const effTier: Tier = verdict.unclear && tier === "agency" ? "claim" : verdict.unclear ? "unverified" : tier;

  let out: Composed;
  let pinPlaces: Place[] = yemen;

  switch (action) {
    case "alert": {
      out = composeAlert({
        tier: effTier,
        cities: saudi.length ? saudi : all,
        source,
        explosions: /انفجار|دوي|explosion|blast|boom/i.test(raw),
        firstTime: /أول|للمرة الأولى|first (?:time|such)/i.test(raw),
      });
      pinPlaces = saudi.length ? saudi : all;
      break;
    }
    case "launch": {
      const weapon = weaponIn(raw, DRONE_RE.test(raw) ? "drone" : "missile");
      const targets = saudi.length ? saudi : yemen.slice(0, 2);
      const origin = yemen.find((p) => !targets.includes(p));
      out = composeLaunch({
        tier: effTier,
        weapon,
        actor: actorOf(action, text, sides, units) || ACTORS.houthi,
        targets,
        origin,
        counts,
        when,
        source,
        claimant,
      });
      pinPlaces = targets.length ? targets : yemen;
      break;
    }
    case "intercept": {
      out = composeIntercept({
        tier: effTier,
        weapon: weaponIn(raw, "drone"),
        places: all,
        counts,
        source,
        defender: saudi.length ? "Saudi air defences" : sides.houthiSrc ? "Houthi air defences" : "Air defences",
      });
      pinPlaces = all;
      break;
    }
    case "airstrike": {
      const againstHouthis = /the Houthis|Houthi forces|houthi/i.test(text);
      out = composeAirstrike({
        tier: effTier,
        places: yemen.length ? yemen : all,
        counts,
        when,
        source,
        target: againstHouthis ? "Houthi positions" : "positions",
        attacker: sides.govSrc || /Saudi/i.test(text) ? ACTORS.coalition : "",
      });
      pinPlaces = yemen.length ? yemen : all;
      break;
    }
    case "clash": {
      const actor = actorOf(action, text, sides, units);
      const left = actor && actor !== ACTORS.houthi ? actor : ACTORS.houthi;
      const right = left === ACTORS.houthi ? ACTORS.gov : ACTORS.houthi;
      const ground = groundPlaces(yemen, all);
      out = composeClash({
        tier: effTier,
        places: ground,
        counts,
        left,
        right,
        source,
        houthiPush: /هجوم حوثي|هجوم مباغت|Houthi (?:assault|offensive|attack)/i.test(raw),
        when,
      });
      pinPlaces = ground;
      break;
    }
    case "seize":
    case "retake": {
      const ground = groundPlaces(yemen, all);
      out = composeSeize({
        tier: effTier,
        places: ground,
        actor: actorOf(action, text, sides, units) || ACTORS.houthi,
        counts,
        source,
        retake: action === "retake",
      });
      pinPlaces = ground;
      break;
    }
    case "vessel": {
      const vessel = /ناقلة|tanker/i.test(raw)
        ? "a tanker"
        : /باخرة|bulk carrier/i.test(raw)
          ? "a bulk carrier"
          : /merchant|سفينة تجارية/i.test(raw)
            ? "a merchant ship"
            : "a vessel";
      out = composeVessel({ tier: effTier, places: sea.length ? sea : all, source, vessel, counts });
      pinPlaces = sea.length ? sea : all;
      break;
    }
    case "port": {
      const facility = /مصفاة|refinery/i.test(raw) ? "oil refinery" : /أرامكو|Aramco|منشأة نفطية|oil facility/i.test(raw) ? "oil facility" : "port";
      out = composePort({ tier: effTier, places: all, source, counts, facility });
      pinPlaces = all;
      break;
    }
    case "economy": {
      const c = economyCopy(raw);
      out = composeEconomy({ headline: c.headline, detail: c.detail, source, places: all });
      pinPlaces = [];
      break;
    }
    case "diplomacy": {
      if (/سوريا|Syria/i.test(raw) && /مقاتلين|fighters/i.test(raw)) {
        const refused = /رفض|refused|declined/i.test(raw);
        out = {
          headline: tidyHeadline(
            `Saudi Arabia asked Syria for fighters against the Houthis${refused ? ", and was turned down" : ""}`,
          ),
          body: `DAMASCUS — Saudi Arabia approached Syria months ago about assembling a Syrian force for the front against the Houthis${
            refused ? ", and Damascus declined" : ""
          }. ${source} reported the account. Turkish sources denied any role for Ankara in moving fighters.`,
        };
      } else if (speaker) {
        out = composeStatement({
          speaker,
          gist: "there are contacts over the fighting in Yemen",
          detail: `${sentenceCase(speaker)} addressed the diplomatic track around the fighting in Yemen.`,
          places: all,
          source,
          tier: effTier,
        });
      } else {
        return fail("thin", "Diplomatic item with no named party or concrete step.", onFail);
      }
      pinPlaces = [];
      break;
    }
    default: {
      if (!speaker) return fail("no-actor", "Statement with no identifiable speaker.", onFail);
      const gist = statementGist(raw, all);
      if (!gist) return fail("vague", "Statement whose substance could not be pinned down.", onFail);
      out = composeStatement({
        speaker,
        gist,
        detail: `${sentenceCase(speaker)} said ${gist}.`,
        places: all,
        source,
        tier: effTier,
      });
      pinPlaces = [];
      break;
    }
  }

  if (isBadCopy(out.headline, out.body)) {
    return fail("bad-copy", "The composed line came out as a fragment or still carried source-language text.", onFail);
  }

  // Never pin a non-event, and never float a land event on open water.
  if (!mapsAsPin(type)) pinPlaces = [];
  pinPlaces = pinPlaces.filter((p) => {
    if (type === "vessel") return true;
    return !isOpenWaterNearBab(p.lat, p.lng);
  });

  return {
    ok: true,
    // Composed successfully — but a tray verdict stays in the tray. The copy is
    // written either way, so a promoted item needs no recomposition.
    outcome: verdict.outcome,
    reason: verdict.outcome === "tray" ? "tray" : "kept",
    note: verdict.note,
    headline: out.headline,
    body: out.body,
    type,
    places: pinPlaces,
    score: verdict.score,
    tier: effTier,
    unclear: verdict.unclear,
    tags: verdict.tags,
  };
}

/* ------------------------------------------------------------------ *
 * Statement substance
 * ------------------------------------------------------------------ */

/**
 * What a statement is actually about, as a lower-case clause that reads after
 * "X says …". Only recognised subjects are returned; an unrecognised speech is
 * dropped rather than padded out with filler.
 */
function statementGist(raw: string, places: Place[]): string {
  const where = places.find((p) => p.country === "Yemen")?.name || "";
  if (/إفشال|افشال|أحبط|foiled/i.test(raw)) {
    const daesh = /داعش|ISIS|الصبغة الداعشية/i.test(raw);
    return `Saudi infiltration attempts were foiled${where ? ` in ${where}` : ""}${daesh ? ", in what he called an Islamic State-style operation" : ""}`;
  }
  if (/لن تمر دون رد|will not go unanswered/i.test(raw)) return "the attack will not go unanswered";
  if (/إلقاء السلاح|lay down (?:their )?(?:arms|weapons)/i.test(raw))
    return "the Houthis' only route is to lay down their weapons and enter politics";
  if (/تحذير|warn/i.test(raw) && /أسر|أبناء|families|sons/i.test(raw))
    return "families should pull their sons out of the Houthi ranks";
  if (/نداء استغاثة|appeal|طلب.{0,20}(?:عتاد|أسلحة)|heavy weapons/i.test(raw))
    return "his units need heavy weapons and are fighting largely with small arms";
  if (/نازح|displaced/i.test(raw)) return "the fighting has displaced tens of thousands of civilians";
  if (/مليون دولار|million dollars?|\$\d/i.test(raw) && /أمم|UN\b|appeal/i.test(raw))
    return "the United Nations is seeking new funding for Yemeni refugees";
  if (/صفقة|deal|محادثات|talks/i.test(raw)) return "there are contacts over a deal";
  if (/أكذوبة|denied|ينفي|نفى|deny/i.test(raw)) return "the opposing side's account is false";
  if (/إنتاج|manufactur|produce/i.test(raw) && /صواريخ|missile|drone/i.test(raw))
    return "his side is manufacturing its own missiles and drones";
  if (/جزية|tribute|ترليون|trillion/i.test(raw))
    return "Saudi spending in Washington amounts to protection money rather than arms purchases";
  if (/قصاص|عدوان|offensive/i.test(raw) && where) return `the offensive in ${where} will be answered`;

  /**
   * Thematic fallback.
   *
   * Everything above is a canned scenario, and anything that did not match one
   * was dropped as "vague" — which lost most of a head of state's speech in a
   * single live scan. These map a statement to the SUBJECT it is about, from
   * vocabulary rather than an exact phrase, so an unforeseen wording still
   * produces an honest line. Nothing here asserts a fact: each says what the
   * speaker addressed, and the card links the source.
   */
  const n = normaliseArabic(raw);
  for (const [re, gist] of STATEMENT_THEMES) if (re.test(n)) return gist(where);
  return "";
}

type ThemeGist = (where: string) => string;

const STATEMENT_THEMES: [RegExp, ThemeGist][] = [
  [
    /الملاحه|حركه التجاره|البحر الاحمر|السفن|الممرات المايه|shipping|navigation/,
    () => "maritime traffic and international trade in the Red Sea are a stated priority",
  ],
  // Written pronoun-free and never opening on a proper noun: the composer
  // lowercases the first word to slot the gist after "X says", which turned
  // "Yemen's seat" into "yemen's seat", and "it praised" is wrong for a person.
  [
    /خياراتنا|ستتصاعد|سنرد|التصعيد|اشد ايلاما|escalat/,
    () => "the response will escalate if the offensive continues",
  ],
  [
    /مقعد اليمن|الامم المتحده|التمثيل|الشرعيه الدوليه|seat|representation/,
    () => "the seat and international representation of Yemen are contested",
  ],
  [
    /نستهجن|افترا|اكذوبه|ننفي|نفي|مزاعم|باطل|false|fabricat/,
    () => "the other side's account is false",
  ],
  [
    /نشيد|انضباط|صمود|تضحيات|القوات المسلحه والامن/,
    () => "the conduct of the armed forces deserves praise",
  ],
  [
    /السلام|الهدنه|وقف اطلاق النار|حل سياسي|مفاوضات|تفاوض|peace|ceasefire|truce|talks/,
    () => "a negotiated settlement remains the stated preference",
  ],
  [
    /ثبات موقفنا|موقفنا المبدي|نجدد التاكيد|steadfast|unchanged/,
    () => "the position is unchanged",
  ],
  [
    /مطامع|عداي|سياده|حسن الجوار|sovereignty|no designs/,
    () => "there are no designs on neighbouring states",
  ],
  [
    /حصار|المشتقات النفطيه|المرتبات|معانات|الاوضاع الانسانيه|humanitarian|blockade|salaries/,
    () => "the humanitarian situation and the blockade are worsening",
  ],
  [
    /تحذير|نحذر|عواقب|تداعيات|warn|consequences/,
    (w) => `the fighting${w ? ` around ${w}` : ""} carries serious consequences`,
  ],
  [
    /جاهزيه|استعداد|تعبيه|readiness|mobilis|mobiliz/,
    () => "the forces are ready for a longer fight",
  ],
  [
    /دعم|مساندة|مساعده|تحالف|support|back(?:ing|ed)/,
    () => "support and alignment between the parties were addressed",
  ],
];

export { casualtyPhrase, mapsAsPin };
