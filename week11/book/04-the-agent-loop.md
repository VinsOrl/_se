# 4. The agent loop

Code: `agent/agent.py`. The whole agent is about 20 lines:

```python
for _ in range(MAX_STEPS):
    resp = client.messages.create(model=model, tools=SCHEMAS, messages=messages, ...)
    messages.append({"role": "assistant", "content": resp.content})
    if resp.stop_reason != "tool_use":
        return final text
    run every tool_use block → collect tool_results
    messages.append({"role": "user", "content": results})
return "Stopped: hit MAX_STEPS"
```

`client` is passed **in** (injected). In real use it is `anthropic.Anthropic()`. In the tests it is a `FakeClient` that returns canned replies, so the tests need no key or network and give the same result every run.

## Loop concerns

| Concern | What can go wrong | What I did |
|---|---|---|
| Never stops | model keeps asking for tools | `MAX_STEPS = 10`, then return a "Stopped" message |
| Tool crashes | an exception kills the run | `run_tool` returns `"ERROR: ..."` text |
| Broken history | forgot `tool_result` or mismatched id → API error | append the full assistant content; one result per id |
| Context grows | each step resends everything (cost, limit) | small tool outputs (4000-char cap); trimming is future work |
| Cost | 10 steps = 10 paid calls | step cap; `max_tokens=1024` |
| Dangerous tools | model or an injected file asks for something bad | read-only tools, sandboxed folder, no eval |
| Debugging | can't see what happened | `verbose=True` prints each tool call |
| Odd stop reasons | `max_tokens`, `refusal`… | treated as final; just return the text |

## Self-check
- What two things get appended to `messages` per tool step?
- Why inject the client instead of creating it inside `run_agent`?
- What does the test for MAX_STEPS check?

## Still confusing
- Should `max_tokens` mid-answer continue instead of returning cut-off text?
- How do real agents trim history without losing important facts?
