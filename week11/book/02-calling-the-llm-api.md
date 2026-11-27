# 2. Calling the LLM API

Code: `agent/step1_chat.py`.

```python
resp = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=300,
    messages=[{"role": "user", "content": "..."}],
)
```

## The API is stateless
The server remembers **nothing** between calls. For a conversation, I keep a `messages` list myself and send the **whole list** every time:

```python
messages = [
  {"role": "user", "content": "hi"},
  {"role": "assistant", "content": "hello!"},
  {"role": "user", "content": "what did I just say?"},   # works only because I resent turn 1
]
```

So "memory" is just my list growing. Longer list = more tokens = more cost. One day it won't fit.

## What comes back
`resp.content` is a **list of blocks**, not one string. A block can be `text` or `tool_use`.
`resp.stop_reason` says *why* the model stopped. These are the values in the SDK I installed (`anthropic` 2.14):

| stop_reason | meaning | what a client should do |
|---|---|---|
| `end_turn` | finished normally | show the text |
| `tool_use` | wants me to run a tool | run it, loop again |
| `max_tokens` | hit my `max_tokens` cap mid-answer | answer is cut off: raise the cap or continue |
| `stop_sequence` | hit a stop string I gave | treat as done |
| `pause_turn` | server paused a long turn | send it back to continue |
| `refusal` | model declined | show/handle it, don't retry blindly |
| `model_context_window_exceeded` | the conversation got too long | trim history |

**My agent:** anything but `tool_use` → return the text. That keeps it simple, but a cut-off `max_tokens` answer is returned as-is.

## Key handling
The key lives in `.env` (gitignored) and `load_dotenv()` loads it. The SDK reads `ANTHROPIC_API_KEY` from the environment. The key never goes in code and never gets committed.

## Self-check
- If I don't resend the earlier messages, what does the model see?
- Why is `content` a list?
- Which `stop_reason` means "you should run a tool now"?

## Still confusing
- Is `max_tokens` the limit for the answer only, or for the input too? (I think the answer only.)
- What exactly makes the server pause a turn (`pause_turn`)?
