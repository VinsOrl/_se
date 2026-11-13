# slugread

One tiny zero-dependency text library, four ways: PyPI, npm, crates.io and a Cloudflare Worker.

| Live | Link |
|---|---|
| PyPI | https://pypi.org/project/slugread/ |
| npm | https://www.npmjs.com/package/slugread |
| crates.io | https://crates.io/crates/slugread |
| Cloudflare Worker | https://slugread.kelvin277orlin.workers.dev/slugify?text=Hello,%20World! |

| Function | Behavior |
|---|---|
| `slugify(text)` | lowercase, strip accents (`ß`→`ss`, `æ`→`ae`, `ø`→`o`, `œ`→`oe`, `đ`→`d`, `ł`→`l`), every run of non `a-z0-9` → `-`, trim `-` |
| `truncate(text, n)` | cut to `n` code points, add `…` if cut |
| `word_count(text)` | count words; each CJK character (Han, Hiragana, Katakana) is one word |
| `reading_time(text, wpm=200)` | minutes, rounded up |

JavaScript uses camelCase (`wordCount`, `readingTime`). Rust has no default arguments: pass `slugread::DEFAULT_WPM`.

All implementations must pass the same [`tests/cases.json`](tests/cases.json).

| Dir | Test | Build |
|---|---|---|
| `python/` | `PYTHONPATH=src python3 -m unittest discover -s tests` | `python -m build` |
| `node/` | `npm test` | `npm pack --dry-run` |
| `rust/` | `cargo test` | `cargo package` |
| `worker/` | `npm test` / `npm run dev` | `npm run deploy` |

Worker API (GET, JSON `{"result": ...}`): `/slugify?text=`, `/truncate?text=&n=`, `/word_count?text=`, `/reading_time?text=&wpm=`. `text` is capped at 10,000 characters.

MIT license.
