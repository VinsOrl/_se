# Spec: one tiny package, published 4 ways

Goal: build ONE small utility library and publish it on PyPI, npm, crates.io, and as a Cloudflare Worker. Keep it simple. No over-engineering.

Reference examples (same style: small, no dependencies, focused):
- https://pypi.org/project/rstatistics/
- https://crates.io/crates/rucloud

## Default concept (swap if you prefer another)

Name: `NAME` (pick at step 0; must be free on all three registries).
Functions, identical behavior in every language:

| Function | Behavior |
|---|---|
| `slugify(text)` | lowercase, strip accents, non-alphanumerics -> `-`, trim `-` |
| `truncate(text, n)` | cut to n chars, add `…` if cut |
| `word_count(text)` | count words (CJK chars each count as one word) |
| `reading_time(text, wpm=200)` | minutes, rounded up |

Zero dependencies. One shared `tests/cases.json` of input/output pairs that all 4 implementations must pass.

## Layout

```
NAME/
  tests/cases.json
  python/    pyproject.toml, src/NAME/__init__.py, tests/, README.md
  node/      package.json, index.js, index.d.ts, test.js, README.md
  rust/      Cargo.toml, src/lib.rs, README.md
  worker/    wrangler.toml, src/index.js   (GET /slugify?text=..., etc.)
  LICENSE (MIT), README.md
```

## Steps

0. Check name availability: `pip index versions NAME`, `npm view NAME`, `cargo search NAME`. If taken, pick another and use it everywhere.
1. Write `tests/cases.json`, then implement Python, Node, Rust against it.
2. Run all tests locally. Build: `python -m build`, `npm pack --dry-run`, `cargo package`.
3. Worker: wraps the Node implementation; test with `npx wrangler dev`.
4. Report in `REPORT.md` (results, versions, anything blocked). Do not publish until I confirm.

## Publishing (I do the logins; Claude Code does the rest)

| Target | My one-time setup | Command |
|---|---|---|
| PyPI | account + API token (pypi.org/manage/account/token) | `twine upload dist/*` with `TWINE_USERNAME=__token__`, `TWINE_PASSWORD=<token>` |
| npm | `npm login` (2FA on) | `npm publish --access public` |
| crates.io | login with GitHub, token at crates.io/settings/tokens | `cargo login <token>` then `cargo publish` |
| Cloudflare | `npx wrangler login` | `npx wrangler deploy` |

Tokens are never written to files or committed. Publishing is irreversible (a version can be yanked but never reused), so publish only after I say go.

## Git rules

- Commits authored as me (GitHub: VinsOrl). No Claude co-author or attribution lines.
- `.gitignore` covers `dist/`, `target/`, `node_modules/`, `.venv/`, `.wrangler/`, `.env`.
