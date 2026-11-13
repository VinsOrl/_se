const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2ffff}]/gu;
// Same whitespace set as Rust's char::is_whitespace, so all languages split identically.
const WS = /[\t-\r \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/;
const ALNUM = /[\p{L}\p{N}]/u;

/** Lowercase, strip accents, turn every run of non [a-z0-9] into '-', trim '-'. */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Cut to n characters (code points) and append an ellipsis if anything was cut. */
export function truncate(text, n) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("n must be an integer >= 0");
  const chars = Array.from(text);
  return chars.length > n ? chars.slice(0, n).join("") + "\u2026" : text;
}

/** Count words; each CJK character (Han, Hiragana, Katakana) counts as one. */
export function wordCount(text) {
  const cjk = (text.match(CJK) || []).length;
  return cjk + text.replace(CJK, " ").split(WS).filter((w) => ALNUM.test(w)).length;
}

/** Minutes to read text at wpm words per minute, rounded up. */
export function readingTime(text, wpm = 200) {
  if (!(wpm > 0)) throw new RangeError("wpm must be > 0");
  return Math.ceil(wordCount(text) / wpm);
}
