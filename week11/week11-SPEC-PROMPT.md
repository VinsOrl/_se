# Week 11 SPEC — Build an Agent from an LLM API (learn it with AI)

Repo: VinsOrl/_se, folder `week11/` at repo root, commit on main.

## Goal
Teach myself how an agent is built from a plain LLM API. Learning cycle:
conversation -> programming -> conversation -> writing a book -> ...
Keep everything SIMPLE. No frameworks, no over-engineering.

## Deliverables (inside week11/)

```
week11/
├── README.md              # the cycle, layout, how to run, one-line core idea
├── book/                  # 5 short chapters, my-words style, each with self-check + "still confusing"
│   ├── 01-what-is-an-agent.md
│   ├── 02-calling-the-llm-api.md
│   ├── 03-tool-use.md
│   ├── 04-the-agent-loop.md
│   └── 05-next-steps.md
├── conversations/
│   ├── 00-how-to-ask.md   # question templates
│   └── log.md             # Q -> Insight -> Next action, per cycle
├── agent/
│   ├── step1_chat.py      # plain LLM call, no tools
│   ├── step2_one_tool.py  # model requests ONE tool call, print raw blocks
│   ├── tools.py           # functions + JSON schemas + run_tool dispatcher
│   └── agent.py           # the loop (MAX_STEPS cap)
├── tests/test_agent.py    # offline, FakeClient replaces the LLM
├── requirements.txt       # anthropic, python-dotenv, pytest
├── .env.example           # ANTHROPIC_API_KEY, MODEL=claude-sonnet-5-5
└── .gitignore             # .env, .venv, __pycache__, .pytest_cache
```

## Requirements
- Python, official `anthropic` SDK, Messages API with tool use. Model from env, default `claude-sonnet-5-5`.
- Core idea to teach: agent = LLM + tools + loop (call -> tool_use? run tool, append tool_result -> repeat -> final text).
- tools.py: calculator (AST-based, NO eval), list_dir, read_file (sandboxed to start folder, output capped), tool errors returned as "ERROR: ..." text, never raised.
- agent.py: `run_agent(question, client, model, verbose)`; client injected so tests can fake it; MAX_STEPS = 10.
- Tests (pytest, no API key): calculator ok, calculator rejects code, sandbox blocks `../`, unknown tool no crash, loop runs tool then answers, loop stops at MAX_STEPS.
- Book chapters explain: stateless API + resending messages, stop_reason values, the tool_use/tool_result dance and its rules, safety choices in tools.py, loop concerns table. End ch3 with exercise: add `word_count` tool.
- README has a checklist for the learning cycle.

## Workflow rules
- Use the /ponytail skill when coding.
- Consult /advisor when a problem comes up, when done, and before the next step (advisor checks/commands, executor does the work).
- When done: use /code-review-skill to review, then /security-audit and fix anything needed (key handling, sandbox, no eval).
- Run `pytest -q`; must pass.
- Git: commit authored as me (GitHub VinsOrl). NO Claude co-author, NO Claude attribution lines in commits.
- Put reports, findings and questions in `week11/REPORT.md`. Text replies: 1-2 lines telling me to read it.
