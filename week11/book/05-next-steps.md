# 5. Next steps

What I have is a real agent, just a tiny one. Ideas, roughly from easiest to hardest:

1. **Do the ch. 3 exercise** (`word_count`).
2. **Streaming:** print tokens as they arrive instead of waiting.
3. **Write tools, carefully:** e.g. `write_file`. Ask the human "allow? [y/N]" before anything that changes things.
4. **History trimming:** keep the last N turns, or summarise old ones.
5. **System prompt:** give the agent a role and rules (`system=` parameter).
6. **Evaluate:** a small list of questions plus expected answers, run each week, and see if changes help.
7. **Only then** look at frameworks/SDKs and notice they are this same loop with more parts.

## Self-check
- Which next step adds the most risk, and why?
- What would I need to test before adding a write tool?

## Still confusing
- When is a framework worth it over 20 lines of my own loop?
- How do agents run tools in parallel safely?
