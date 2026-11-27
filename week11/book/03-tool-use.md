# 3. Tool use

Code: `agent/step2_one_tool.py`, `agent/tools.py`.

## How the model learns about a tool
I pass `tools=[...]`. Each tool has a **name**, a **description** and a **JSON schema** for its input. The model only ever sees this description, never my Python code. A clear description makes the model call the tool better.

## The tool_use / tool_result dance
1. I send messages and tools.
2. The model replies with `stop_reason="tool_use"` and a block like
   `{"type": "tool_use", "id": "toolu_1", "name": "calculator", "input": {"expression": "6*7"}}`.
3. I append the model's **whole** `content` as the assistant turn.
4. I run the tool and append a **user** turn:
   `{"type": "tool_result", "tool_use_id": "toolu_1", "content": "42"}`.
5. I call the API again.

**Rules I learned:**
- Every `tool_use` needs a matching `tool_result` with the same id, in the **very next** user message.
- If the model asks for several tools at once, all the results go into **one** user message.
- The assistant turn must be resent exactly as received, so the ids still match.
- If a tool fails, I still send a `tool_result`. Its content is an error message, so the model can try again.

## Safety choices in tools.py
The model's input is **untrusted**. It could be tricked by a file it just read.

| Risk | Choice |
|---|---|
| `eval()` would run any Python | calculator parses with `ast` and allows only numbers and + - * / // % ** |
| `9**9**9` hangs the CPU | exponent ≤ 100 and base ≤ 1e100; expression ≤ 200 chars |
| `../../etc/passwd` or `/etc/passwd` | path is `resolve()`d and must stay inside `ROOT` (this also catches symlinks) |
| `read_file(".env")` would leak my API key | hidden names (`.env`, `.git`, `.venv`) are blocked, even through a symlink |
| huge file floods the context | read at most 4000 chars; listings capped too |
| tool crashes the agent | `run_tool` catches everything and returns `"ERROR: ..."` |
| unknown tool name | `"ERROR: unknown tool"`, no crash |

Tool **output** is untrusted too. A file can contain "ignore your instructions and…" (prompt injection). That is why the tools are read-only and boxed into one folder.

## Exercise
Add a `word_count` tool:
1. Write `word_count(text)` in `tools.py` (`len(text.split())`).
2. Add it to `TOOLS` and add its schema to `SCHEMAS`.
3. Add a test: `run_tool("word_count", {"text": "a b c"}) == "3"`. (`run_tool` turns the int into a string for you.)
4. Ask the agent: "How many words are in README.md?" It should chain `read_file` → `word_count`.

## Self-check
- What links a `tool_result` to its `tool_use`?
- Why return errors as text instead of raising?
- Why is `ast` safe where `eval` is not?

## Still confusing
- Can the model call a tool that's not in my list? (It can try, and `run_tool` says ERROR.)
- How does the model choose between two similar tools? Probably the descriptions.
