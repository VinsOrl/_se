# Week 10 report: `slugread`, one tiny package published 4 ways

Status: **steps 0–4 done. Nothing published.** Everything is waiting for your "go".

Code lives in [`slugread/`](slugread/). The layout follows the spec, plus `worker/package.json` and `worker/test.js` (see the security section for why).

## Step 0: name

`slugread` is free on all three registries (checked 2026-11-13):

| Registry | Check | Result |
|---|---|---|
| PyPI | `pip index versions slugread` + `pypi.org/pypi/slugread/json` | not found (404) |
| npm | `npm view slugread` | E404 |
| crates.io | `crates.io/api/v1/crates/slugread` | 404 |

`cargo search` hung on this machine, so I queried the crates.io API directly. Names can be taken at any moment, so re-check right before publishing.

## Step 1: shared cases + 3 implementations

- [`tests/cases.json`](slugread/tests/cases.json) has 33 input/output pairs covering accents, `İ`, decomposed accents, emoji, CJK, CJK punctuation, empty strings and edge values of `n`/`wpm`.
- Python (`slugify`, `truncate`, `word_count`, `reading_time`), Node (`slugify`, `truncate`, `wordCount`, `readingTime`, ESM + `index.d.ts`), Rust (same names as Python, plus `DEFAULT_WPM` because Rust has no default arguments).
- Zero runtime dependencies in all three. The Rust tests use `serde_json` as a **dev-dependency** to read `cases.json`. It does not ship to users, but crates.io will list it under "dev-dependencies".

**Identical behavior.** Besides the shared cases, I ran a throwaway check feeding `"a" + c + "b"` for every code point U+0000–U+2FFFF through all three languages. `slugify` and `word_count` match exactly (0 differences). Getting there took two fixes:
- Rust has no Unicode normalization in its stdlib, so it uses a small generated table of NFD base letters for the Latin blocks (U+00C0–U+024F, U+1E00–U+1EFF). That covers pinyin tones (`ǎ`) and Vietnamese.
- Python `split()`, JS `\s` and Rust `split_whitespace` disagree on 6 obscure characters, so all three now use one explicit whitespace set.

**Behavior choices you may want to change** (all pinned by test cases):
1. `slugify` only keeps `a-z0-9`. Letters with no accent to strip become `-`: `straße` → `stra-e`, `Æsir` → `sir`, and Chinese is dropped (`你好 world` → `world`). Adding `ß→ss, æ→ae, ø→o, œ→oe, đ→d, ł→l` would take about 3 lines per language.
2. `truncate(text, n)` returns `n` characters **plus** `…` (so `n+1` total). Lengths count Unicode code points, so an emoji is 1.
3. `word_count`: Han + Hiragana + Katakana count one word per character. **Hangul is not included**, because Korean puts spaces between words. A whitespace-separated token counts only if it contains a letter or digit, so `—` and `，` are not words.
4. `reading_time("")` = 0. Invalid input fails loudly: negative `n` or `wpm <= 0` raises `ValueError` in Python and `RangeError` in JS, and Rust panics on `wpm == 0`.

## Step 2: tests and builds (all pass)

| Target | Tests | Build |
|---|---|---|
| Python 3.12 | `unittest`: 2 tests (33 cases + bad args) OK | `python -m build` → `slugread-0.1.0.tar.gz` + `py3-none-any.whl`. `twine check` PASSED. The wheel installs and imports in a clean venv |
| Node 24 | `npm test`: 33 cases OK | `npm pack --dry-run`: 5 files (LICENSE, README, index.js, index.d.ts, package.json), about 4.4 kB |
| Rust 1.99 | `cargo test`: 2 integration + 4 doctests OK | `cargo package`: 7 files, 4.2 KiB compressed, verify build OK |

All versions are **0.1.0**. `cargo package` currently needs `--allow-dirty` only because the files weren't committed yet. It is fine now that they are.

## Step 3: Worker

`worker/src/index.js` imports `../../node/index.js` and exposes 4 GET endpoints that return `{"result": ...}`:
`/slugify?text=`, `/truncate?text=&n=`, `/word_count?text=`, `/reading_time?text=&wpm=` (wpm defaults to 200).

Tested with `npx wrangler dev` (wrangler 4.156.0) on 127.0.0.1. All 4 endpoints returned the right results, and 400/404/405 behaved as expected. `worker/test.js` (`npm test`) runs the same checks without wrangler, including the bad inputs.

## Code review (`/code-review-skill`)

Fixed:
- The `\u` escapes in the Python/JS regexes had been written into the files as raw invisible combining characters. The code worked, but you couldn't read or safely edit it. They are now ASCII escapes (`̀-ͯ` and so on), and the fuzz output is byte-identical before and after.
- The Worker parsed `n` twice. It now parses once.

No open review issues. The code is about 40 lines per language, with no abstractions.

## Security audit (`/security-audit`, focused)

| Area | Result |
|---|---|
| Leaked secrets | None. I scanned every file to be committed. Tokens stay out of files: no `.pypirc` or cargo credentials exist, and `~/.npmrc` has no auth token (mode 600). `.gitignore` covers `dist/ target/ node_modules/ .venv/ .wrangler/ .env` plus `.dev.vars`, `__pycache__/` and `*.tgz` (verified with `git check-ignore`) |
| Worker input | GET only (405 otherwise). Unknown path → 404. `text` is required and capped at 10,000 chars (413) to bound CPU. `n`/`wpm` must match `^\d{1,9}$` (rejects `-1`, `1.5`, `1e3`, `abc` and huge values) and `wpm > 0`. Responses are always JSON with `nosniff` and never echo stack traces. All regexes are simple character classes, so there is no ReDoS. No state, secrets, bindings or outbound requests |
| Dependencies | Runtime: none in any package. Dev only: `wrangler` **pinned exactly to 4.156.0** (released 2026-10-29). I avoided yesterday's 4.161.0 on purpose, since a two-week-old release is safer against freshly compromised versions. A `package-lock.json` is committed. `npm audit`: 0 vulnerabilities. No unreviewed install scripts. Rust dev-dep `serde_json = "1"` is test-only |
| Publish config | Each package ships only an allowlist: npm `files`, hatch sdist `include`, cargo `include`. Tests, venvs and build output are excluded, and the tarball listings above show only the expected files. LICENSE in each package is MIT, `Copyright (c) 2026 VinsOrl` |

Nothing needed fixing beyond the review items above.

## Blockers (yours, from the spec)

1. **PyPI**: account + API token. After the first upload, replace it with a token scoped to `slugread` only.
2. **npm**: `npm login` with 2FA on.
3. **crates.io**: GitHub login + token, then `cargo login`. Give the token the `publish-new`/`publish-update` scope only.
4. **Cloudflare**: `npx wrangler login` (from `worker/`, so the pinned version is used).

Once you say go, I'll run, in order: `twine upload dist/*`, `npm publish --access public`, `cargo publish`, `npx wrangler deploy`. Remember that a version number can never be reused.

## Questions

1. **Copyright holder**: the repo-root LICENSE says `ccc115b` (the course template). I used `VinsOrl` for the package LICENSE files. Is that OK?
2. **slugify for `ß/æ/ø/œ/đ/ł`**: keep them as `-` (current behavior) or transliterate them? Decide before 0.1.0, because changing it later changes output.
3. **Hangul in word_count**: leave it out (current) or count each syllable?
4. **Worker CORS**: currently no `Access-Control-Allow-Origin`, so browsers on other sites can't call it. Add `*`? It's safe here (no cookies or auth).
5. **Worker rate limiting**: none. On the free plan, abuse can only use up the daily request quota, with no bill. Add a Cloudflare rate-limit rule after deploy if you care.
6. **Repository URL** in the metadata points at `github.com/VinsOrl/_se` (this course repo). Change it if you want a dedicated repo.

## Git

Committed locally as you (your git config: VinsOrl) with no co-author or attribution lines. **Not pushed.**
