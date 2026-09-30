import type { DevKind, DevMark, DevSide } from "./prose.ts";
import type { LiveReport } from "./types.ts";
import { captureConfirmed } from "./control-live.ts";
import { governorateAt } from "./adm1.ts";
import { placesIn } from "./gazetteer.ts";

/*
 * Every event the desk recorded at a place, read from the cards themselves, so
 * the developments' map and each front's map leave nothing out. The prose's
 * own list (captures, launch areas) is laid over these (brief-store.ts).
 */

const MILITARY = new Set(["strike", "combat", "vessel", "port"]);
const ALERT_RE = /\b(sirens?|air[- ]raid (?:alerts?|warnings?)|air[- ]defen[cs]e alerts?|missile alerts?|take shelter|shelters?)\b|صفارات|صافرات/i;
const HIT_RE = /\b(intercept\w*|shot down|shoots? down|downed|hit|struck|strikes?|kill\w*|wound\w*|impact\w*|crash\w*)\b/i;

/** What happened, from the headline and body; null when it is no event at a place. */
export function kindOf(r: Pick<LiveReport, "type" | "summary" | "text">): DevKind | null {
  const h = String(r.summary || "");
  // Sirens or an air-defence alert: a warning at that place, not yet a hit.
  if (ALERT_RE.test(h) && !HIT_RE.test(h)) return "alert";
  if (!MILITARY.has(r.type)) return null;
  const t = `${h} ${String(r.text || "").slice(0, 300)}`;
  const test = (re: RegExp) => re.test(h) || re.test(t);
  // Flights halted or an airport closed is no strike at that place.
  if (/\b(air traffic|flights?|air ?space|airports?)\b.{0,40}\b(suspend\w*|halt\w*|resum\w*|divert\w*|clos\w*|disrupt\w*|delay\w*)\b|\b(suspend\w*|halt\w*|clos\w*|disrupt\w*)\b.{0,30}\b(air traffic|flights?|air ?space)\b/i.test(h)) return null;
  if (test(/\b(intercept\w*|shot down|shoots? down|downed)\b/i)) return "interception";
  if (r.type === "vessel" || r.type === "port" || /\b(ship|vessel|tanker|boat|frigate|destroyer|navy|naval)\b/i.test(h)) return "naval";
  if (test(/\b(drones?|UAVs?|unmanned)\b/i)) return "drone";
  if (test(/\b(missiles?|ballistic|rockets?)\b/i)) return "missile";
  if (test(/\b(captur\w*|seiz\w*|took control|takes? control|recaptur\w*|liberat\w*|overr[au]n)\b/i)) return "capture";
  if (test(/\b(repel\w*|repuls\w*|foil\w*|thwart\w*|beat back|beats back|failed attack)\b/i)) return "repelled";
  if (test(/\b(air ?strikes?|air ?raids?|warplanes?|fighter jets?|jets? (?:struck|hit|bomb\w*)|bomb(?:ed|ing|s)?)\b/i)) return "airstrike";
  if (test(/\b(shell\w*|artillery|mortars?|howitzers?|tanks? fire)\b/i)) return "shelling";
  if (test(/\b(advanc\w*|push(?:ed|es)? (?:into|toward|towards))\b/i)) return "advance";
  if (r.type === "strike") return "airstrike";
  if (r.type === "combat") return "fighting";
  return null;
}

const SIDE_RE: [DevSide, RegExp][] = [
  ["houthi", /\b(Houthis?|Ansar ?Allah|Saree)\b/gi],
  ["southern", /\b(STC|Southern Transitional|southern forces|Security Belt|Hadrami Elite|Shabwa Defen[cs]e)\b/gi],
  ["saudi", /\b(Saudi|coalition)\b/gi],
  ["us", /\b(US|U\.S\.|American|CENTCOM|Pentagon)\b/g],
  ["government", /\b(government|pro-government|Giants|National Resistance|Tareq|army|PLC|Presidential Leadership|Yemeni forces)\b/gi],
];
/** A name after these words is the target, not the one who acted. */
const OBJECT_BEFORE = /\b(on|at|against|targeting|targets?|hits?|struck|strikes?|kills?|killed|of|into|toward|towards|repels?|repelled|near|by)\s+(?:the |a |an )?(?:[\w-]+ )?$/i;

/** Who acted: the first side named as a subject in the headline, else in the body. */
export function actorOf(r: Pick<LiveReport, "summary" | "text">, kind: DevKind): DevSide {
  const find = (s: string) => {
    let best: { side: DevSide; at: number } | null = null;
    for (const [side, re] of SIDE_RE) {
      for (const m of s.matchAll(re)) {
        const at = m.index ?? 0;
        if (OBJECT_BEFORE.test(s.slice(Math.max(0, at - 30), at))) continue;
        if (!best || at < best.at) best = { side, at };
        break;
      }
    }
    return best?.side ?? null;
  };
  const h = String(r.summary || "");
  const all = `${h} ${String(r.text || "").slice(0, 300)}`;
  let side = find(h) ?? find(all);
  // Only the coalition, the US and Israel fly strike aircraft over Yemen.
  if (kind === "airstrike" && (side === "houthi" || !side)) side = /\b(US|U\.S\.|American)\b/.test(all) ? "us" : "saudi";
  // An interception's side is the one that fired what was shot down: the side
  // named on the thing itself ("shoot down Saudi drone"), else whoever did not
  // do the shooting.
  const downed = kind === "interception" ? DOWNED_RE.exec(all) : null;
  if (downed) side = sideOfName(downed[1]);
  else if (kind === "interception") side = /\bHouthi\w*\b.{0,40}\b(intercept\w*|shot down|shoots? down|downed)\b/i.test(all) ? (/\b(US|MQ-9|Reaper)\b/.test(all) ? "us" : "saudi") : "houthi";
  if (!side) side = kind === "missile" || kind === "drone" || kind === "naval" ? "houthi" : "houthi";
  return side;
}

/** "shoot down a Saudi ScanEagle drone", "intercepted two Houthi missiles". */
const DOWNED_RE = /\b(?:shot|shoots?|shooting|downed|downs?|intercept\w*)\s+(?:down\s+)?(?:an?\s+|the\s+|two\s+|three\s+|several\s+|\d+\s+)?(Saudi|coalition|US|U\.S\.|American|Houthis?|Emirati)\b/i;
const SIDE_NAME = "(Houthis?|Ansar ?Allah|government|pro-government|army|Giants(?: Brigades)?|National Resistance|Nation'?s Shield|Yemeni forces|southern|STC|Security Belt|Saudi|coalition)";
const sideOfName = (w: string): DevSide =>
  /^(?:US|U\.S\.|American)$/i.test(w) ? "us" : /^emirati$/i.test(w) ? "saudi" : /^(houthi|ansar)/i.test(w) ? "houthi" : /^(southern|stc|security belt)/i.test(w) ? "southern" : /^(saudi|coalition)/i.test(w) ? "saudi" : "government";
const REPEL = String.raw`(?:repel\w*|repuls\w*|foil\w*|thwart\w*|beats? back|push(?:ed|es)? back|fend\w* off|fought off)`;
const AFTER_REPEL = new RegExp(String.raw`\b${REPEL}\s+(?:(?:an?|the|several|wide-scale|repeated|multiple|renewed|fresh|major|large-scale|multi-axis|\d+)\s+)*${SIDE_NAME}`, "i");
const ATTACK_THEN = new RegExp(String.raw`\b${SIDE_NAME}(?:\s+[\w'-]+){0,2}\s+(?:attack|infiltration|assault|advance|offensive|incursion|attempt)\w*\b.{0,60}\b(?:${REPEL}|fail\w*)`, "i");
const SUBJECT_REPELS = new RegExp(String.raw`\b${SIDE_NAME}(?:\s+[\w'-]+){0,2}\s+${REPEL}`, "i");

/**
 * A repelled attack is drawn from the ATTACKER's side, everywhere (the prose's
 * map and the cards'). "Giants repel Houthi infiltration" -> houthi; "Houthi
 * attack on X repelled" -> houthi; "Southern forces repel an attack" -> the
 * other side, houthi. Null when the text does not say.
 */
export function repelAttacker(text: string): DevSide | null {
  const t = String(text || "");
  let m = AFTER_REPEL.exec(t);
  if (m) return sideOfName(m[1]);
  m = ATTACK_THEN.exec(t);
  if (m) return sideOfName(m[1]);
  m = SUBJECT_REPELS.exec(t);
  if (m) return sideOfName(m[1]) === "houthi" ? "government" : "houthi";
  return null;
}

/** Each place a card is pinned to. */
function pinsOf(r: LiveReport): { name: string; ll: [number, number] }[] {
  const ok = (a?: number, b?: number) => Number.isFinite(a) && Number.isFinite(b);
  // Only places inside the governorates the headline names: "Al-Mansurah mountain
  // in Al-Mudaribah, Lahj" is not the Al-Mansurah on the Mocha coast.
  const homes = new Set(
    placesIn(String(r.summary || ""))
      .filter((p) => p.kind === "governorate")
      .map((p) => governorateAt(p.lat, p.lng))
      .filter(Boolean),
  );
  const fits = (lat: number, lng: number) => {
    const gov = governorateAt(lat, lng);
    return !homes.size || !gov || homes.has(gov);
  };
  if (Array.isArray(r.places) && r.places.length) {
    return r.places.filter((p) => ok(p.lat, p.lng) && fits(p.lat, p.lng)).map((p) => ({ name: p.name, ll: [p.lat, p.lng] }));
  }
  return ok(r.lat, r.lng) && fits(r.lat as number, r.lng as number) ? [{ name: String(r.place || ""), ll: [r.lat as number, r.lng as number] }] : [];
}

const km = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * Math.cos((a[0] * Math.PI) / 180));

const GROUND = new Set(["capture", "advance", "fighting", "repelled", "shelling"]);
export const SEA_RE = /\b(sea|gulf|strait|bab[ -]al[ -]mand[ae]b|waters|coast(?:al)? waters|offshore)\b|البحر|خليج|باب المندب/i;

/** One mark per kind, side and spot (within 3 km). */
export function addMark(list: DevMark[], m: DevMark, near = 3): void {
  if (!m.ll) return;
  // Ground fighting happens on land: a ground mark named after a sea is a misread report.
  if (GROUND.has(m.kind) && SEA_RE.test(String(m.place || ""))) return;
  if (list.some((x) => x.kind === m.kind && (x.side === m.side || m.kind === "fighting") && x.ll && km(x.ll, m.ll as [number, number]) <= near)) return;
  list.push(m);
}

const FIRED = new Set(["missile", "drone", "interception"]);
/** "launch two ballistic missiles from Sanaa", "drones fired from Saada towards Jazan". */
const FROM_RE = /\b(?:launch\w*|fire[sd]?|fired|flew|flown|sent|came|coming)\b[^.]{0,80}?\bfrom\s+((?:the\s+)?[A-Z][^.,;]{1,50})/;

/** The launch area a missile or drone card names, in Yemen; null when it names none. */
export function launchOf(r: Pick<LiveReport, "summary" | "text">): { name: string; ll: [number, number] } | null {
  const h = String(r.summary || "");
  const m = FROM_RE.exec(h) ?? FROM_RE.exec(`${h} ${String(r.text || "").slice(0, 300)}`);
  if (!m) return null;
  const p = placesIn(m[1]).find((x) => x.country === "Yemen");
  return p ? { name: p.name, ll: [p.lat, p.lng] } : null;
}

export type Launch = { kind: DevKind; side: DevSide; ll: [number, number]; at: number };

/** Every event of the cards at a place, each front's, and the launches reported with no target. */
export function cardMarks(reports: LiveReport[], frontsOf: (r: LiveReport) => string[]): { all: DevMark[]; byFront: Record<string, DevMark[]>; launches: Launch[] } {
  const all: DevMark[] = [];
  const byFront: Record<string, DevMark[]> = {};
  // Launches with no target named, and the fired marks still without a launch area.
  const launches: Launch[] = [];
  const fired: { m: DevMark; at: number }[] = [];
  for (const r of reports) {
    let kind = kindOf(r);
    if (!kind) continue;
    // One side's word that it took ground is drawn as its advance; the flag waits for confirmation.
    if (kind === "capture" && !captureConfirmed(r)) kind = "advance";
    const side = kind === "repelled" ? repelAttacker(String(r.summary || "")) ?? repelAttacker(String(r.text || "").slice(0, 300)) ?? actorOf(r, kind) : actorOf(r, kind);
    // A missile or drone flies in from the launch area its report names; the launch
    // area itself is no target ("launch two ballistic missiles from Sanaa").
    const from = FIRED.has(kind) ? launchOf(r) : null;
    const at = Date.parse(String(r.at || "")) || 0;
    const pins = pinsOf(r).filter((p) => !from || km(p.ll, from.ll) > 10);
    if (from && !pins.length) {
      launches.push({ kind, side, ll: from.ll, at });
      continue;
    }
    for (const p of pins) {
      const m: DevMark = { place: p.name, kind, side, ll: p.ll };
      if (kind === "interception") m.shot = /\b(drones?|UAVs?|unmanned|ScanEagle|MQ-9|Reaper)\b/i.test(`${r.summary} ${r.text ?? ""}`) ? "drone" : "missile";
      if (from && km(from.ll, p.ll) >= 30) m.fromLl = from.ll;
      const before = all.length;
      addMark(all, m);
      for (const id of frontsOf(r)) addMark((byFront[id] ??= []), m);
      if (all.length > before && FIRED.has(kind) && !m.fromLl) fired.push({ m, at });
    }
  }
  // A launch reported alone, and a hit of the same kind by the same side within
  // three hours: one attack, drawn from where it was fired to where it fell.
  for (const { m, at } of fired) {
    const l = launches
      .filter((x) => x.kind === m.kind && x.side === m.side && Math.abs(x.at - at) <= 3 * 3600e3 && km(x.ll, m.ll as [number, number]) >= 30)
      .sort((a, b) => Math.abs(a.at - at) - Math.abs(b.at - at))[0];
    if (l) m.fromLl = l.ll;
  }
  return { all, byFront, launches };
}

/**
 * The launch area of a fired mark the prose drew with none: the one place the
 * window's cards say that side fired that kind from (at least 30 km off). Two
 * or more launch areas and it cannot say which.
 */
export function launchFor(m: DevMark, launches: Launch[]): [number, number] | undefined {
  if (!m.ll || !FIRED.has(m.kind)) return undefined;
  const spots: [number, number][] = [];
  for (const l of launches) {
    if (l.kind !== m.kind || l.side !== m.side || km(l.ll, m.ll) < 30) continue;
    if (!spots.some((x) => km(x, l.ll) <= 10)) spots.push(l.ll);
  }
  return spots.length === 1 ? spots[0] : undefined;
}

/** A prose mark is kept on a front's map only near a spot that front's cards name. */
export function nearAny(m: DevMark, spots: DevMark[], within = 40): boolean {
  return !!m.ll && spots.some((x) => x.ll && km(x.ll, m.ll as [number, number]) <= within);
}
