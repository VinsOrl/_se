# Cycle log (Q → Insight → Next action)

## Cycle 1: what is an agent
- **Q:** Is an agent something special inside the model?
- **Insight:** No. Agent = LLM + tools + loop, and the loop is my code.
- **Next action:** make one plain API call (`step1_chat.py`).

## Cycle 2: the API
- **Q:** Why does the model forget my earlier message?
- **Insight:** The API is stateless. I must resend the whole `messages` list every call.
- **Next action:** offer one tool and print the raw blocks (`step2_one_tool.py`).

## Cycle 3: tools
- **Q:** What happens when the model "calls" a tool?
- **Insight:** It only returns a `tool_use` block. I run it and reply with a `tool_result` that has the same id.
- **Next action:** write `tools.py` safely (no eval, sandbox, error text).

## Cycle 4: the loop
- **Q:** How do I keep going until it's done, and not forever?
- **Insight:** Loop while `stop_reason == "tool_use"`, with a hard `MAX_STEPS` cap.
- **Next action:** `agent.py` + offline tests with a FakeClient. Then do the `word_count` exercise.
