//! Tiny text helpers: [`slugify`], [`truncate`], [`word_count`], [`reading_time`].
//!
//! Zero dependencies. Same behavior as the Python and JavaScript `slugread` packages.

/// Words per minute used by the Python/JS default.
pub const DEFAULT_WPM: usize = 200;

// ASCII base letter after NFD for U+00C0..=U+024F and U+1E00..=U+1EFF ('_' = none).
// Generated from Python's unicodedata so it matches the Python/JS NFD path exactly.
// ponytail: Latin blocks only (incl. pinyin tones, Vietnamese); other scripts become '-' anyway.
const LATIN: &[u8; 400] = b"aaaaaa_ceeeeiiii_nooooo__uuuuy__aaaaaa_ceeeeiiii_nooooo__uuuuy_yaaaaaaccccccccdd__eeeeeeeeeegggggggghh__iiiiiiiii___jjkk_llllll____nnnnnn___oooooo__rrrrrrsssssssstttt__uuuuuuuuuuuuwwyyyzzzzzz_________________________________oo_____________uu____________________________aaiioouuuuuuuuuu_aaaa____ggkkoooo__j___gg__nnaa____aaaaeeeeiiiioooorrrruuuusstt__hh______aaeeooooooooyy____________________________";
const LATIN_ADD: &[u8; 256] = b"aabbbbbbccddddddddddeeeeeeeeeeffgghhhhhhhhhhiiiikkkkkkllllllllmmmmmmnnnnnnnnoooooooopppprrrrrrrrssssssssssttttttttuuuuuuuuuuvvvvwwwwwwwwwwxxxxyyzzzzzzhtwy______aaaaaaaaaaaaaaaaaaaaaaaaeeeeeeeeeeeeeeeeiiiioooooooooooooooooooooooouuuuuuuuuuuuuuyyyyyyyy______";

fn base_letter(c: char) -> Option<char> {
    if c.is_ascii_alphanumeric() {
        return Some(c);
    }
    let cp = c as usize;
    let b = match cp {
        0xC0..=0x24F => LATIN[cp - 0xC0],
        0x1E00..=0x1EFF => LATIN_ADD[cp - 0x1E00],
        _ => b'_',
    };
    (b != b'_').then_some(b as char)
}

/// Lowercase, strip accents (`ß`→`ss`, `æ`→`ae`, `ø`→`o`, `œ`→`oe`, `đ`→`d`, `ł`→`l`),
/// turn every run of non `[a-z0-9]` into `-`, trim `-`.
///
/// ```
/// assert_eq!(slugread::slugify("Crème Brûlée!"), "creme-brulee");
/// ```
pub fn slugify(text: &str) -> String {
    let mut out = String::new();
    let mut gap = false;
    for c in text.to_lowercase().chars() {
        if ('\u{300}'..='\u{36f}').contains(&c) {
            continue; // combining accent: drop it
        }
        let mut buf = [0u8; 4];
        // Letters NFD can't split into base + accent (incl. accented forms ǣ ǽ ǿ).
        let piece = match c {
            'ß' => Some("ss"),
            'æ' | 'ǣ' | 'ǽ' => Some("ae"),
            'œ' => Some("oe"),
            'ø' | 'ǿ' => Some("o"),
            'đ' => Some("d"),
            'ł' => Some("l"),
            _ => base_letter(c).map(|b| &*b.encode_utf8(&mut buf)),
        };
        match piece {
            Some(p) => {
                if gap && !out.is_empty() {
                    out.push('-');
                }
                gap = false;
                out.push_str(p);
            }
            None => gap = true,
        }
    }
    out
}

/// Cut to `n` characters (code points) and append `…` if anything was cut.
///
/// ```
/// assert_eq!(slugread::truncate("Hello world", 5), "Hello…");
/// ```
pub fn truncate(text: &str, n: usize) -> String {
    match text.char_indices().nth(n) {
        Some((i, _)) => format!("{}\u{2026}", &text[..i]),
        None => text.to_string(),
    }
}

fn is_cjk(c: char) -> bool {
    matches!(c,
        '\u{3040}'..='\u{30FF}' | '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}'
        | '\u{F900}'..='\u{FAFF}' | '\u{20000}'..='\u{2FFFF}')
}

/// Count words; each CJK character (Han, Hiragana, Katakana) counts as one.
///
/// ```
/// assert_eq!(slugread::word_count("我爱Rust和Python"), 5);
/// ```
pub fn word_count(text: &str) -> usize {
    let cjk = text.chars().filter(|&c| is_cjk(c)).count();
    let rest: String = text.chars().map(|c| if is_cjk(c) { ' ' } else { c }).collect();
    cjk + rest
        .split_whitespace()
        .filter(|w| w.chars().any(char::is_alphanumeric))
        .count()
}

/// Minutes to read `text` at `wpm` words per minute, rounded up.
///
/// # Panics
/// If `wpm` is 0.
///
/// ```
/// assert_eq!(slugread::reading_time("one two three", 2), 2);
/// ```
pub fn reading_time(text: &str, wpm: usize) -> usize {
    assert!(wpm > 0, "wpm must be > 0");
    word_count(text).div_ceil(wpm)
}
