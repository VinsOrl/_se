# Week 11: building an agent from scratch

"AI agent" sounds like something big and mysterious. It isn't. Take away the frameworks and an agent is a model that can ask for tools, plus a short loop in your own code that runs those tools and reports back. This week was about seeing that for myself by building one with nothing but the plain Anthropic API.

There's no LangChain, no agent SDK and no magic. It's about 20 lines of loop, three small tools, and a lot of reading and writing to make sure I understand what's actually going on.

> **The whole idea in one line:** agent = LLM + tools + loop.

---

## How I learned it

The week ran as a cycle, not a straight line:

**conversation → programming → conversation → writing a book → …**

I asked questions first, wrote a little code, asked about whatever confused me, and then wrote it up in my own words. Writing it down is where the gaps show up. Each round goes through this checklist:

- [O] **Ask.** Pick a template from `conversations/00-how-to-ask.md` and ask one clear question.
- [O] **Log it.** Write down the question, the insight and the next action in `conversations/log.md`.
- [O] **Code.** Change something in `agent/` and run it.
- [O] **Test.** Run `pytest -q`. It has to pass.
- [O] **Ask again.** Whatever surprised me or broke becomes the next question.
- [O] **Write.** Explain it in `book/` in plain words, then answer the self-check.
- [O] **Repeat.** Take the next "still confusing" item and go round again.

---

## What it does

You ask the agent a question. If it can answer straight away, it does. If it needs to work something out or look at a file, it asks for a tool, my code runs it, and the result goes back to the model. That repeats until it has an answer.

It has three tools:

| Tool | What it does | Why it's safe |
|------|--------------|---------------|
| `calculator` | Does arithmetic like `2*(3+4)` | Parsed with Python's `ast`, never `eval()`. Only numbers and `+ - * / // % **` are allowed, and huge powers like `9**9**9` are refused. |
| `list_dir` | Lists the files in a folder | Can't leave the folder you started in, and hidden files are skipped |
| `read_file` | Reads a text file | Same sandbox, capped at 4000 characters, and `.env` / `.git` are off limits |

If a tool fails, it doesn't crash anything. The model just gets back `ERROR: ...` as text and can try something else.

---

## How an agent is built from an LLM API

This is the main thing I wanted to understand, so here it is step by step. Each step adds exactly one idea on top of the last, and by the end the plain API call has turned into an agent. Nothing gets hidden behind a library.

### Step 0: what the LLM API actually gives you

An LLM API is one function: **send messages in, get one reply out.** That's it. It can't run code, open files or browse anything. It reads text and writes text.

```python
import anthropic

client = anthropic.Anthropic()          # reads ANTHROPIC_API_KEY from the environment
resp = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=300,
    messages=[{"role": "user", "content": "In one sentence: what is an AI agent?"}],
)
print(resp.content[0].text)
```

Two things in the reply matter for everything after this:

- `resp.content` is a **list of blocks**, not a single string. For now there's just one `text` block.
- `resp.stop_reason` tells you **why** the model stopped. A plain answer comes back as `"end_turn"`.

This is `agent/step1_chat.py`.

### Step 1: the API has no memory, so you are the memory

This surprised me. The server remembers nothing between calls. If I ask a follow-up in a second call, the model has never seen the first one.

The fix is that **I** keep the conversation in a Python list and send the whole list every time:

```python
messages = [
    {"role": "user",      "content": "My name is Alex."},
    {"role": "assistant", "content": "Nice to meet you, Alex!"},
    {"role": "user",      "content": "What's my name?"},   # only works because turns 1–2 are resent
]
```

The roles alternate: `user`, `assistant`, `user`, … That list is the agent's entire memory. Every step it gets longer, and every call costs more tokens because the whole thing gets sent again. Hold onto this, because the agent loop is basically "keep appending to this list."

### Step 2: describe a tool to the model

The model can't run my Python, but I can tell it that a tool exists. A tool description is a name, a sentence explaining it, and a JSON schema for its input:

```python
{
    "name": "calculator",
    "description": "Evaluate an arithmetic expression like '2*(3+4)'.",
    "input_schema": {
        "type": "object",
        "properties": {"expression": {"type": "string"}},
        "required": ["expression"],
    },
}
```

I pass a list of these as `tools=[...]` on the call. The model **never sees my code**, only this description, which is why a clear description makes the model use the tool better.

### Step 3: the model asks for a tool (and runs nothing)

Now ask something the tool helps with, like "What is 1234 × 5678?", and the reply changes shape:

```python
resp.stop_reason   # "tool_use"   ← new!
resp.content       # [
                   #   TextBlock(type="text", text="Let me calculate that."),
                   #   ToolUseBlock(type="tool_use", id="toolu_01A…",
                   #                name="calculator", input={"expression": "1234*5678"})
                   # ]
```

This was the "aha" moment for me. **The model doesn't call the tool. It writes a request** saying "please run `calculator` with this input, and here's an id so you can tell me the answer." It's like a manager writing a note: the model decides *what* should happen, and my code decides *whether* and *how* it happens.

`agent/step2_one_tool.py` stops right here and prints those raw blocks, so you can see the request before anything runs.

### Step 4: run the tool and send the result back

Now my code does the work, and the conversation has to follow some strict rules:

```python
# 1. Save the model's turn exactly as it came back (ids included)
messages.append({"role": "assistant", "content": resp.content})

# 2. Run the tool myself
output = run_tool("calculator", {"expression": "1234*5678"})   # → "7006652"

# 3. Reply as the *user* with a tool_result that carries the same id
messages.append({"role": "user", "content": [
    {"type": "tool_result", "tool_use_id": "toolu_01A…", "content": output}
]})

# 4. Call the API again with the longer history
resp = client.messages.create(model=..., tools=..., messages=messages)
# → stop_reason "end_turn", text "1234 × 5678 = 7,006,652"
```

The rules I learned (the API rejects the conversation if you break them):

| Rule | Why |
|------|-----|
| Append the assistant's `content` **unchanged** | the `tool_use` ids have to stay intact |
| Every `tool_use` gets a `tool_result` with the **same id** | that's how the model matches answers to requests |
| Results go in the **very next** `user` message | nothing can sit between a request and its answer |
| Several tool calls at once → **all** results in **one** user message | one turn asks, the next turn answers everything |
| A failed tool still sends a `tool_result` (`"ERROR: …"`, `is_error: true`) | the model can read the error and try something else |

### Step 5: put it in a loop, and that's the agent

Steps 3–4 handle one tool call. But the model might want to read a file, *then* do some maths on what it read, *then* answer. Each round can lead to another tool call. So wrap it in a loop that keeps going until the model stops asking:

```python
MAX_STEPS = 10

def run_agent(question, client, model, verbose=False):
    messages = [{"role": "user", "content": question}]
    for _ in range(MAX_STEPS):
        resp = client.messages.create(model=model, max_tokens=1024,
                                      tools=SCHEMAS, messages=messages)
        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason != "tool_use":          # no more tools wanted → done
            return "".join(b.text for b in resp.content if b.type == "text")

        results = []
        for b in resp.content:                       # run every tool it asked for
            if b.type == "tool_use":
                out = run_tool(b.name, b.input)
                results.append({"type": "tool_result", "tool_use_id": b.id,
                                "content": out, "is_error": out.startswith("ERROR")})
        messages.append({"role": "user", "content": results})

    return f"Stopped: hit MAX_STEPS={MAX_STEPS} without a final answer."
```

That's the **whole** agent in `agent/agent.py`, line for line. Looking at it, "agency" just means:

1. **LLM:** `client.messages.create(...)` decides what to do next.
2. **Tools:** `run_tool(...)` actually does things.
3. **Loop:** the `for` keeps feeding results back until the model is satisfied.

The `MAX_STEPS` cap matters. Without it, a confused model could keep asking for tools forever and quietly run up the bill.

### Step 6: what one real run looks like

Here's how the message list grows for *"How many characters are in README.md, times 2?"* (the numbers are just for illustration):

```
call 1  →  [user: question]
        ←  tool_use  read_file {"path": "README.md"}            (stop_reason: tool_use)

call 2  →  [user, assistant(tool_use), user(tool_result: file text)]
        ←  tool_use  calculator {"expression": "8123*2"}        (stop_reason: tool_use)

call 3  →  [user, assistant, user, assistant(tool_use), user(tool_result: "16246")]
        ←  text "README.md has 8123 characters, so ×2 = 16246." (stop_reason: end_turn)
```

There were three API calls, and each one resent everything before it. Nobody wrote "read the file, then calculate." The model worked out the order by itself, and that is what makes it an agent rather than a script.

### Step 7: the tools are just normal functions

`agent/tools.py` holds three plain Python functions, a dict that maps names to functions, and one dispatcher:

```python
TOOLS = {"calculator": calculator, "list_dir": list_dir, "read_file": read_file}

def run_tool(name, args):
    if name not in TOOLS:
        return f"ERROR: unknown tool {name!r}"
    try:
        return str(TOOLS[name](**args))
    except Exception as e:
        return f"ERROR: {type(e).__name__}: {e}"   # never raise, the model gets to see it
```

`run_tool` **never raises**. A bad path, a divide by zero or a made-up tool name all come back as text the model can read and react to, so the loop never crashes halfway through.

### Step 8: making it testable

`run_agent` takes `client` as a parameter instead of creating one inside. That one small choice means the tests can pass in a **fake client** that returns replies I wrote by hand:

```python
fake = FakeClient([
    NS(stop_reason="tool_use", content=[tool_use("calculator", {"expression": "6*7"})]),
    NS(stop_reason="end_turn", content=[text("It is 42.")]),
])
assert run_agent("6*7?", fake, "m") == "It is 42."
```

So the loop logic gets tested offline, with no API key, no network and no cost, and it gives the same result every time.

### The whole picture

```
                 ┌──────────────────────────────────────────────┐
                 │              messages (the memory)           │
                 └──────────────────────────────────────────────┘
                        │ send all                     ▲ append
                        ▼                              │
  question ──► [ LLM API call ] ──► stop_reason?       │
                                     │                 │
                     "tool_use" ─────┤                 │
                                     ▼                 │
                              [ run_tool() ] ──► tool_result
                                     │
                     anything else ──┴──► final answer
                     (or MAX_STEPS)  ───► "Stopped"
```

Every agent framework I've looked at since is this same loop with more parts bolted on: streaming, memory trimming, parallel tools, retries. Once you've built the small version yourself, the big ones stop looking like magic.

---

## The book

Five short chapters, written the way I'd explain it to a classmate. Each one ends with a self-check and a "still confusing" list, because being honest about what I don't get yet is half the point.

| Chapter | About |
|---------|-------|
| [01 – What is an agent?](book/01-what-is-an-agent.md) | The three parts, and who actually runs the tools |
| [02 – Calling the LLM API](book/02-calling-the-llm-api.md) | Stateless calls, message lists, every `stop_reason` value |
| [03 – Tool use](book/03-tool-use.md) | Schemas, the tool_use/tool_result rules, the safety choices, plus a `word_count` exercise |
| [04 – The agent loop](book/04-the-agent-loop.md) | The loop line by line and a table of everything that can go wrong |
| [05 – Next steps](book/05-next-steps.md) | Where to go from here, roughly easiest to hardest |

---

## Known limitations

- **No live run yet.** All the tests are offline. Running it for real needs a working Anthropic API key in `.env`.
- **Odd stop reasons count as "done".** If the answer is cut off by `max_tokens`, you just get the cut-off text.
- **History never gets trimmed.** A really long session would eventually run out of context.
- **Read-only on purpose.** A tool that writes files would need a "are you sure?" prompt first, and that's chapter 5 material.

---

## Running it locally

```bash
cd week11
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

pytest -q                     # 6 offline tests, no key needed
```

To talk to the real model, copy `.env.example` to `.env`, put your key in it, and run the steps in order:

```bash
python agent/step1_chat.py          # one plain call, no tools
python agent/step2_one_tool.py      # watch the model ask for a tool
python agent/agent.py "What is 17*23 and what's in README.md?"
```

Run it from inside `week11/`. The tools can only see files under the folder you start in.

---

## Project layout

```
week11/
├── README.md                  # This file
├── PROMPT.md                  # The assignment spec
├── book/                      # 5 short chapters in my own words
├── conversations/
│   ├── 00-how-to-ask.md       # Question templates
│   └── log.md                 # Question → insight → next action, per cycle
├── agent/
│   ├── step1_chat.py          # Plain LLM call
│   ├── step2_one_tool.py      # One tool, raw blocks printed
│   ├── tools.py               # The three tools + schemas + run_tool
│   └── agent.py               # The loop (max 10 steps)
├── tests/test_agent.py        # Offline tests with a fake client
├── requirements.txt           # anthropic, python-dotenv, pytest
└── .env.example               # Where your key goes (copy to .env)
```

The agent is two small files. Most of this folder is writing, which is how it should be, since the goal was to understand agents, not just to have one.
