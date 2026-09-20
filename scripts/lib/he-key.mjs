/**
 * Stable lookup key for a Hebrew archive string.
 *
 * The archive is full of pointed Hebrew (niqqud), geresh variants and bidi
 * control marks. Keying a translation table on the raw string is brittle — one
 * invisible codepoint and the lookup misses. This strips everything that does
 * not change the words.
 */
export function heKey(s) {
  return String(s || "")
    .normalize("NFC")
    .replace(/[֑-ׇ]/g, "") // niqqud, cantillation
    .replace(/[‎‏‪-‮⁦-⁩]/g, "") // bidi controls
    .replace(/[׳'׳]/g, "'") // geresh variants
    .replace(/[״"״]/g, '"') // gershayim variants
    .replace(/[־–—]/g, "-")
    .replace(/[«»“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
