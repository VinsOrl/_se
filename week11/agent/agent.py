"""The agent: LLM + tools + loop.  python agent/agent.py "your question" """
import os
import sys

from tools import SCHEMAS, run_tool

MAX_STEPS = 10


def run_agent(question, client, model, verbose=False):
    messages = [{"role": "user", "content": question}]  # API is stateless: we resend all of this
    for _ in range(MAX_STEPS):
        resp = client.messages.create(model=model, max_tokens=1024, tools=SCHEMAS, messages=messages)
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")
        results = []
        for b in resp.content:
            if b.type == "tool_use":
                out = run_tool(b.name, b.input)
                if verbose:
                    print(f"[tool] {b.name}({b.input}) -> {out[:200]!r}")
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": out,
                                "is_error": out.startswith("ERROR")})
        messages.append({"role": "user", "content": results})  # all results in ONE user turn
    return f"Stopped: hit MAX_STEPS={MAX_STEPS} without a final answer."


if __name__ == "__main__":
    import anthropic
    from dotenv import load_dotenv

    load_dotenv()
    q = " ".join(sys.argv[1:]) or "What is 17*23, and what files are in this folder?"
    print(run_agent(q, anthropic.Anthropic(), os.getenv("MODEL", "claude-sonnet-5-5"), verbose=True))
