# Week 10 — slugread: One Tiny Library, Published Four Ways

Every blog, docs site and CMS ends up needing the same four small text helpers: turn a title into a URL slug, cut a long string down with an ellipsis, count the words, and say how long the post takes to read. People write these again in each project and each language, and the copies never quite agree.

**slugread** is those four helpers as a zero-dependency library that behaves the same in Python, JavaScript and Rust, plus a public HTTP API on Cloudflare. The code is small on purpose. This week was really about **publishing**: getting one library onto PyPI, npm, crates.io and Cloudflare Workers, and making sure all four versions give the same answer for the same input.

---

Live Worker: https://slugread.kelvin277orlin.workers.dev/slugify?text=Hello,%20World!

| Where | Package | Install |
|-------|---------|---------|
| PyPI | [slugread 0.1.0](https://pypi.org/project/slugread/) | `pip install slugread` |
| npm | [slugread 0.1.0](https://www.npmjs.com/package/slugread) | `npm install slugread` |
| crates.io | [slugread 0.1.0](https://crates.io/crates/slugread) | `cargo add slugread` |
| Cloudflare | [slugread Worker](https://slugread.kelvin277orlin.workers.dev/slugify?text=Hello,%20World!) | nothing to install, just call it |

Source is also mirrored at [VinsOrl/_alg › homework/slugread](https://github.com/VinsOrl/_alg/tree/main/homework/slugread).

---

## Table of contents

1. [What it does](#what-it-does)
2. [Using it](#using-it)
3. [How it works](#how-it-works)
4. [One test file for every language](#one-test-file-for-every-language)
5. [The Worker API](#the-worker-api)
6. [Publishing](#publishing)
7. [Security](#security)
8. [Known limitations](#known-limitations)
9. [Running it locally](#running-it-locally)
10. [Project layout](#project-layout)

---

## What it does

| Function | Behavior | Example |
|----------|----------|---------|
| `slugify(text)` | lowercase, strip accents, every run of non `a-z0-9` becomes `-`, trim `-` from the ends | `"Crème Brûlée"` → `"creme-brulee"` |
| `truncate(text, n)` | keep the first `n` characters, add `…` if anything was cut | `("Hello world", 5)` → `"Hello…"` |
| `word_count(text)` | count words; every Chinese/Japanese character counts as one word | `"你好 world"` → `3` |
| `reading_time(text, wpm=200)` | minutes to read, rounded up | 450 words → `3` |

A few details worth knowing:

- **Letters that don't decompose still get transliterated.** `ß`→`ss`, `æ`→`ae`, `ø`→`o`, `œ`→`oe`, `đ`→`d`, `ł`→`l`. So `"Straße"` → `"strasse"` and `"Łódź"` → `"lodz"`.
- **Non-Latin text disappears from slugs.** `"你好 world"` → `"world"`. Slugs are ASCII only; transliterating Chinese or Cyrillic needs a dictionary, and that would break the zero-dependency rule.
- **`truncate` counts real characters, not bytes or UTF-16 units.** An emoji is one character, so `truncate("😀😀😀", 2)` → `"😀😀…"` and never cuts an emoji in half.
- **Punctuation is not a word.** `"Hello — world"` is 2 words, not 3. `"don't"` and `"stop-me"` each count as one.
- **Bad input fails loudly.** A negative `n` or a `wpm` of 0 raises an error (`ValueError` in Python, `RangeError` in JS, a panic in Rust) instead of returning nonsense.

---

## Using it

**Python**

```python
from slugread import slugify, truncate, word_count, reading_time

slugify("Hello, World!")        # 'hello-world'
truncate("Hello world", 5)      # 'Hello…'
word_count("你好 world")         # 3
reading_time("word " * 450)     # 3
```

**JavaScript** (ESM, Node 18+). Same functions, camelCase names:

```js
import { slugify, truncate, wordCount, readingTime } from "slugread";

slugify("Hello, World!");       // "hello-world"
readingTime("word ".repeat(450), 300); // 2
```

**Rust**. Rust has no default arguments, so pass `DEFAULT_WPM`:

```rust
use slugread::{slugify, reading_time, DEFAULT_WPM};

assert_eq!(slugify("Hello, World!"), "hello-world");
let mins = reading_time(&"word ".repeat(450), DEFAULT_WPM); // 3
```

**HTTP**

```bash
curl "https://slugread.kelvin277orlin.workers.dev/slugify?text=Cr%C3%A8me%20Br%C3%BBl%C3%A9e"
# {"result":"creme-brulee"}
```

---

## How it works

### slugify

```
lowercase
  → NFD normalize       "é" becomes "e" + a combining accent
  → drop accents        remove U+0300–U+036F
  → transliterate       ß→ss, æ→ae, ø→o, œ→oe, đ→d, ł→l
  → [^a-z0-9]+ → "-"
  → trim "-" from both ends
```

Python and JavaScript have Unicode normalization built in (`unicodedata.normalize`, `String.prototype.normalize`). Rust's standard library doesn't, and pulling in a crate would break the zero-dependency rule. So the Rust version carries two small lookup tables that map every accented Latin letter (U+00C0–U+024F and U+1E00–U+1EFF, which includes Vietnamese) to its base letter. The tables were generated from Python's own `unicodedata`, so they agree with the other two languages by construction.

### word_count

1. Count every Han, Hiragana and Katakana character as one word, then replace each with a space.
2. Split what's left on whitespace.
3. Count the pieces that contain at least one letter or digit.

"Whitespace" means one explicit list of characters, written out the same way in all three languages. Each language's built-in idea of whitespace is slightly different (Python's `split()` treats some control characters as spaces, JavaScript's `\s` includes U+FEFF), so relying on the built-ins made the three versions disagree on odd inputs.

Korean (Hangul) is left out on purpose: Korean puts spaces between words, so it is counted like English.

### reading_time

`ceil(word_count / wpm)`. Empty text is 0 minutes.

---

## One test file for every language

[`slugread/tests/cases.json`](slugread/tests/cases.json) holds 38 input/output pairs:

```json
{"fn": "slugify",  "args": ["Straße"],          "out": "strasse"}
{"fn": "truncate", "args": ["Hello world", 5],  "out": "Hello…"}
```

The Python, Node and Rust test runners each read that same file and run every case. If one language drifts, its tests fail. The Worker tests go one step further and call the real HTTP handler.

The shared file only catches what someone thought to write a case for, so there was also a **fuzz check**: run `slugify`, `truncate` and `word_count` in all three languages on `"a" + c + "b"` for every code point `c` from U+0000 to U+2FFFF, then compare the outputs. The first run found real differences (Rust missing Vietnamese letters, the three whitespace definitions not matching). After the fixes it reports **0 differences**.

---

## The Worker API

The Worker imports the Node package directly, so it can't drift from the npm version.

| Endpoint | Params | Returns |
|----------|--------|---------|
| `GET /slugify` | `text` | `{"result": "hello-world"}` |
| `GET /truncate` | `text`, `n` | `{"result": "Hello…"}` |
| `GET /word_count` | `text` | `{"result": 2}` |
| `GET /reading_time` | `text`, optional `wpm` (default 200) | `{"result": 1}` |

Errors are JSON too:

| Status | When |
|--------|------|
| 400 | `text` missing, `n` not a whole number ≥ 0, or `wpm` not a whole number > 0 |
| 404 | unknown path (the response lists the valid endpoints) |
| 405 | anything other than GET |
| 413 | `text` longer than 10,000 characters |

Every response has `access-control-allow-origin: *`, so a web page on any site can call it from the browser. That's safe here because the API has no cookies, no login and no stored data.

---

## Publishing

The order was PyPI → npm → crates.io → Cloudflare, and the rule was: if any step fails, stop.

| Target | Command | What happened |
|--------|---------|---------------|
| PyPI | `twine upload dist/*` | No token in the shell, so I ran the upload myself. Published hashes match the local build. |
| npm | `npm publish --access public` | Needed a 2FA code, so I ran it myself. |
| crates.io | `cargo publish` | First try failed: the crates.io account had no verified email. Verified it, then it went through. |
| Cloudflare | `npx wrangler deploy` | Worked first try; checked live with real requests. |

What I learned:

- **Publishing can't be undone.** A version can be yanked or deprecated, but the number `0.1.0` can never be reused. That's why everything was tested, built and reviewed before the first upload.
- **Each registry has its own gate.** PyPI wants an API token, npm wants 2FA on every publish, crates.io wants a verified email. None of them showed up until the real publish.
- **Tokens never touch the repo.** No `.npmrc`, no `.pypirc`, no `.env`. The `.gitignore` blocks them anyway.
- **Ship only what's needed.** `package.json` has a `files` list and `Cargo.toml` has an `include` list, so tests and lock files stay out of the published packages.

The full log of every step, including the failures, is in [REPORT.md](REPORT.md).

---

## Security

Before publishing, the project went through a security audit. Findings:

- **No secrets** anywhere in the code or the git history.
- **Zero runtime dependencies** in all three libraries, so there's nothing to get hijacked upstream. The only dev dependencies are `serde_json` (Rust tests), `hatchling` (Python build) and a pinned `wrangler` (Worker deploy).
- **Worker input is limited.** `text` is capped at 10,000 characters so one request can't burn a lot of CPU, and `n`/`wpm` must match `^\d{1,9}$`, so odd values like `1e9`, `-1` or `0x10` are rejected.
- **Responses can't be misread as HTML.** They're always `application/json` with `x-content-type-options: nosniff`.

There's no rate limiting. Cloudflare's free plan limits requests per day, and the API returns nothing worth abusing.

---

## Known limitations

- **ASCII slugs only.** Chinese, Japanese, Cyrillic, Arabic and so on are dropped from slugs instead of transliterated.
- **`word_count` is a heuristic.** Each CJK character counts as one word, which overcounts Chinese words like `電腦` (one word, two characters). Doing it properly needs a dictionary.
- **`truncate` counts code points, not what you see on screen.** A flag emoji or a letter with a separate combining accent is more than one code point, so it can be split.
- **The npm page briefly showed `0.0.0-stage`.** That's an npm placeholder that appeared while the real `0.1.0` was still processing. `latest` points to `0.1.0`.

---

## Running it locally

```bash
cd week10/slugread

# Python
cd python && PYTHONPATH=src python3 -m unittest discover -s tests && cd ..

# Node
cd node && npm test && cd ..

# Rust
cd rust && cargo test && cd ..

# Worker
cd worker && npm install && npm test
npm run dev          # local server at http://localhost:8787
```

Builds without publishing:

| Dir | Command |
|-----|---------|
| `python/` | `python -m build` |
| `node/` | `npm pack --dry-run` |
| `rust/` | `cargo package` |

---

## Project layout

```
week10/
├── README.md                  # This file
├── REPORT.md                  # Every step, finding and publish log
├── publish-package-spec.md    # The assignment spec
└── slugread/
    ├── README.md
    ├── LICENSE                # MIT
    ├── tests/cases.json       # 38 shared test cases
    ├── python/
    │   ├── pyproject.toml
    │   ├── src/slugread/__init__.py
    │   └── tests/test_cases.py
    ├── node/
    │   ├── package.json
    │   ├── index.js           # The JS implementation
    │   ├── index.d.ts         # TypeScript types
    │   └── test.js
    ├── rust/
    │   ├── Cargo.toml
    │   ├── src/lib.rs         # Rust implementation + accent tables
    │   └── tests/cases.rs
    └── worker/
        ├── wrangler.toml
        ├── src/index.js       # HTTP wrapper around node/index.js
        └── test.js
```

Each implementation is one source file. Python's is under 50 lines, Node's under 40, and Rust's (about 110) is longer only because of the accent tables.
