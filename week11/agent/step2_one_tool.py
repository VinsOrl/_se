"""Step 2: offer ONE tool, see the model ask for it. We print the raw blocks; nothing runs yet."""
import os

import anthropic
from dotenv import load_dotenv

from tools import SCHEMAS

load_dotenv()
client = anthropic.Anthropic()
resp = client.messages.create(
    model=os.getenv("MODEL", "claude-sonnet-5-5"),
    max_tokens=300,
    tools=[SCHEMAS[0]],  # calculator only
    messages=[{"role": "user", "content": "What is 1234 * 5678?"}],
)
print("stop_reason:", resp.stop_reason)  # expect "tool_use"
for block in resp.content:
    print(block)  # a TextBlock and/or a ToolUseBlock(id=..., name="calculator", input={...})
