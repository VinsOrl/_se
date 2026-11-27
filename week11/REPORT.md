# Week 11 report: agent from a plain LLM API

Built everything in `week10-SPEC.md` inside `week11/`. The core idea is **agent = LLM + tools + loop**.

## Deviations from the spec
- The spec says `week10/` and `week10/REPORT.md`. Following your instruction, everything is in `week11/`. `week10/` (slugread) was not touched.

## Results
- `anthropic` 2.14.0, `python-dotenv` and `pytest` are installed in `week11/.venv` (gitignored).
- `pytest -q` → **6 passed**, offline, with no API key. The FakeClient replaces the LLM.
- Tests cover: calculator ok, calculator rejects code, sandbox blocks `../`, unknown tool no crash, loop runs tool then answers, loop stops at MAX_STEPS.
- The `stop_reason` values in ch. 2 come from the installed SDK (`anthropic/types/stop_reason.py`), not from memory.
- **Live run: not done.** There's no Anthropic key on this machine. I tried the local Ollama at `127.0.0.1:11434` with `ANTHROPIC_BASE_URL`, and the connection was refused because Ollama isn't running. To try it yourself, add a key to `.env` and run `python agent/agent.py "What is 17*23?"`.

## Advisor checkpoints
1. **Before coding:** use a venv, check the real stop_reason values, import the SDK only in `__main__` so tests need no SDK, use an AST whitelist with a power bound, sandbox with `resolve()` + `is_relative_to`, and commit with `git add week11/` only.
2. **Before review:** found that the sandbox let the model read `.env`, which is the API key (see F1). Also fixed the ch. 2 table wording.

## Code review findings (code-review-skill) → fixed
| # | Severity | Finding | Fix |
|---|---|---|---|
| R1 | 🟡 | `(-8)**0.5` returned a complex-number string | calculator rejects complex results |
| R2 | 🟢 | failed tool results were not flagged to the API | `tool_result` now sets `is_error` when the output starts with `ERROR` |
| R4 | 🟡 | the ch. 3 `word_count` exercise returns an int, which would crash `out.startswith` in the loop | `run_tool` wraps the result in `str()` |
| R3 | 🟢 | a test read `messages[-1]` from a list that keeps growing | the test reads by index |
| — | 📚 | non-`tool_use` stops (`max_tokens`, `refusal`, `pause_turn`) are returned as final text | kept on purpose for simplicity, documented in ch. 2 and ch. 4 |

## Security audit findings (security-audit, focused guidance mode) → fixed
Trust boundary: model output, which can be steered by prompt injection from a file it reads, drives the tools.

| # | Severity | Finding | Fix |
|---|---|---|---|
| F1 | **high** | `read_file(".env")` passed the sandbox because `.env` sits in the start folder. The API key would go to the model and be printed in verbose mode. | `_safe` blocks any hidden path part (`.env`, `.git`, `.venv`), checked after `resolve()`, so a symlink to `.env` is blocked too. `list_dir` hides dotfiles. Tests added. |
| F2 | low | `read_file` on a FIFO inside the sandbox would hang forever | only regular files are read (test with `mkfifo`) |
| F3 | ok | calculator DoS (`9**9**9`, nested powers) | exponent ≤ 100, base ≤ 1e100, input ≤ 200 chars. `((9**100)**100)**100` is rejected in under 30 ms. |
| F4 | ok | no `eval`/`exec`/`subprocess` anywhere | confirmed with grep |
| F5 | ok | key handling | key only in `.env`, which is gitignored (checked with `git check-ignore`). `.env.example` has a placeholder. The key is never printed. |
| — | note | anything that isn't hidden under the start folder is readable | run the agent from `week11/`, not from your home folder (README says so) |

## Git
- Committed as you (VinsOrl), with **no** Claude co-author or attribution lines. Only `week11/` is staged; `../code recovery/` was left alone.
- **Not pushed.**

## Questions for you
1. Should I push to `origin/main` (VinsOrl/_se)?
2. Do you want a real live run? It needs either an Anthropic key in `week11/.env` or `ollama serve` started locally.
3. Should the `word_count` exercise (end of ch. 3) be left for you to do, as the spec suggests? I left it undone.
