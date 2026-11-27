# Week 11: build an agent from a plain LLM API

**Core idea: agent = LLM + tools + loop.**
Call the model. If it asks for a tool, run the tool, send back the result, and call again. Repeat until it answers in text.

## The learning cycle

conversation → programming → conversation → writing a book → …

- [ ] **Conversation:** ask a question using a template from `conversations/00-how-to-ask.md`.
- [ ] **Log it:** add the Q → Insight → Next action to `conversations/log.md`.
- [ ] **Programming:** write or change the code in `agent/` and run it.
- [ ] **Test:** run `pytest -q` (must pass).
- [ ] **Conversation:** ask about whatever surprised or broke.
- [ ] **Book:** write it up in my own words in `book/`, then answer the self-check.
- [ ] **Next:** pick the next "still confusing" item and go round again.

## Layout

```
book/           5 short chapters (what, API, tools, loop, next)
conversations/  how-to-ask templates + the cycle log
agent/          step1_chat.py → step2_one_tool.py → tools.py + agent.py
tests/          offline tests (a FakeClient replaces the LLM)
```

## How to run

```bash
cd week11
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # put your real key in .env (it is gitignored)
pytest -q                     # offline, no key needed
python agent/step1_chat.py    # plain call
python agent/step2_one_tool.py
python agent/agent.py "What is 17*23 and what is in README.md?"
```

The tools only see files under the folder you start from.
