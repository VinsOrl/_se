# 1. What is an agent?

A chatbot answers. An agent **does things** and then answers.

As I understand it now, an agent is just three parts:

1. **An LLM.** It reads text and writes text. That is all it can do.
2. **Tools.** These are normal functions in my code: a calculator, list a folder, read a file.
3. **A loop.** My code keeps calling the LLM. Each time the model asks for a tool, my code runs it and hands back the result.

The model never runs anything itself. It writes "please call `calculator` with `6*7`". **My** program decides whether to run it, runs it, and reports back. All the "agency" lives in that small loop I write.

```
question → LLM → wants a tool? ──yes──> run tool → result back to LLM ─┐
                     │ no                                              │
                     ▼                                                 │
               final answer  <──────────── (loop) ─────────────────────┘
```

## Self-check
- Who actually executes a tool: the model or my code?
- What are the three parts of an agent?
- Why would an agent without a loop only ever do one tool call?

## Still confusing
- How does the model "know" a tool exists? (Answered in ch. 3: I send it a JSON schema.)
- Is "agent" different from "workflow"? My guess: in a workflow I fix the steps, while in an agent the model picks them.
