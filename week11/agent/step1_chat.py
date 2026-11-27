"""Step 1: one plain LLM call. No tools, no loop."""
import os

import anthropic
from dotenv import load_dotenv

load_dotenv()  # reads ANTHROPIC_API_KEY and MODEL from .env
client = anthropic.Anthropic()
resp = client.messages.create(
    model=os.getenv("MODEL", "claude-sonnet-5-5"),
    max_tokens=300,
    messages=[{"role": "user", "content": "In one sentence: what is an AI agent?"}],
)
print("stop_reason:", resp.stop_reason)
print(resp.content[0].text)
