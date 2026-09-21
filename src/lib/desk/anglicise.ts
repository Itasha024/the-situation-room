/**
 * The reader sometimes leaves a place in Arabic inside its English copy
 * ("strikes on مديرية حيفان"). Throwing the whole report away for that lost
 * real events, so the code swaps each Arabic run for English first: the
 * gazetteer's name when it knows the place, otherwise a plain transliteration.
 */

import { placesIn } from "./gazetteer.ts";

const LETTERS: Record<string, string> = {
  ا: "a", أ: "a", إ: "i", آ: "a", ٱ: "a", ء: "", ؤ: "u", ئ: "i", ب: "b", ت: "t", ث: "th",
  ج: "j", ح: "h", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s",
  ض: "d", ط: "t", ظ: "dh", ع: "", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m",
  ن: "n", ه: "h", ة: "a", و: "w", ي: "y", ى: "a", "ـ": "",
};

/** Words that say what kind of place follows, and their English. */
const KIND: Record<string, string> = {
  مديرية: "district", مديريه: "district", محافظة: "governorate", محافظه: "governorate",
  مدينة: "city", مدينه: "city", منطقة: "area", منطقه: "area", قرية: "village", قريه: "village",
  جبهة: "front", جبهه: "front", جبل: "Mount", وادي: "Wadi",
};

function titleCase(s: string): string {
  return s.replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

export function transliterate(word: string): string {
  let w = word.replace(/[ً-ْٰ]/g, "");
  let out = "";
  if (w.startsWith("ال")) {
    out = "al-";
    w = w.slice(2);
  }
  for (const ch of w) out += LETTERS[ch] ?? "";
  // A bare "y" between consonants is the "ay" of Haydan, not "Hydan".
  out = out.replace(/yy/g, "iy").replace(/ww/g, "uw").replace(/^((?:al-)?[^aeiouy-])y(?=[^aeiouy])/, "$1ay");
  return titleCase(out);
}

function englishFor(run: string): string {
  const words = run.split(/\s+/).filter(Boolean);
  let kind = "";
  if (words.length > 1 && KIND[words[0]]) kind = KIND[words.shift()!];
  const rest = words.join(" ");
  const known = placesIn(rest)[0];
  const name = known ? known.name : words.map(transliterate).join(" ");
  if (!kind) return name;
  if (kind === "Mount" || kind === "Wadi") return `${kind} ${name}`;
  return `${name} ${kind}`;
}

/** Replace every Arabic run in English copy with an English rendering. */
export function anglicise(text: string): string {
  return String(text || "")
    .replace(/[؀-ۿ]+(?:\s+[؀-ۿ]+)*/g, (run) => englishFor(run))
    .replace(/\s{2,}/g, " ");
}
