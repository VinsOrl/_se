# slugread

Tiny zero-dependency text helpers. Same behavior in Rust, Python and JavaScript.

```toml
[dependencies]
slugread = "0.1"
```

```rust
use slugread::{slugify, truncate, word_count, reading_time, DEFAULT_WPM};

assert_eq!(slugify("Crème Brûlée!"), "creme-brulee");
assert_eq!(truncate("Hello world", 5), "Hello…");
assert_eq!(word_count("我爱Rust和Python"), 5); // each CJK character is one word
assert_eq!(reading_time("one two three", DEFAULT_WPM), 1); // minutes, rounded up
```

- `slugify` keeps only `a-z0-9` after stripping accents (`ß`→`ss`, `æ`→`ae`, `ø`→`o`, `œ`→`oe`, `đ`→`d`, `ł`→`l`); other characters become `-`.
  Accents are stripped for the Latin blocks (U+00C0–U+024F, U+1E00–U+1EFF) plus combining marks.
- `truncate` counts Unicode code points.
- `reading_time` panics if `wpm` is 0.

MIT license.
