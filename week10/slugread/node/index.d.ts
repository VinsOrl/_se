/** Lowercase, strip accents (ß→ss, æ→ae, ø→o, œ→oe, đ→d, ł→l), turn every run of non [a-z0-9] into '-', trim '-'. */
export function slugify(text: string): string;
/** Cut to n characters (code points) and append '…' if anything was cut. Throws RangeError if n < 0. */
export function truncate(text: string, n: number): string;
/** Count words; each CJK character (Han, Hiragana, Katakana) counts as one. */
export function wordCount(text: string): number;
/** Minutes to read text at wpm words per minute (default 200), rounded up. Throws RangeError if wpm <= 0. */
export function readingTime(text: string, wpm?: number): number;
