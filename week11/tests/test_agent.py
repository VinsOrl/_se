"""Offline tests: FakeClient stands in for the LLM. No API key needed."""
import os
import sys
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "agent"))

import tools  # noqa: E402
from agent import MAX_STEPS, run_agent  # noqa: E402


class FakeClient:
    """Returns canned responses in order; records what it was sent."""

    def __init__(self, responses):
        self.responses, self.calls = list(responses), []
        self.messages = self

    def create(self, **kw):
        self.calls.append(kw)
        return self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]


def text(t):
    return NS(type="text", text=t)


def tool_use(name, inp, id="t1"):
    return NS(type="tool_use", name=name, input=inp, id=id)


def test_calculator_ok():
    assert tools.run_tool("calculator", {"expression": "2*(3+4)"}) == "14"


def test_calculator_rejects_code():
    for bad in ["__import__('os').system('ls')", "open('x')", "9**9**9", "True+1", "'a'*3", "(-8)**0.5", "1/0"]:
        assert tools.run_tool("calculator", {"expression": bad}).startswith("ERROR")


def test_sandbox_blocks_parent(tmp_path, monkeypatch):
    monkeypatch.setattr(tools, "ROOT", tmp_path)
    (tmp_path / "ok.txt").write_text("hi")
    assert tools.run_tool("read_file", {"path": "ok.txt"}) == "hi"
    (tmp_path / ".env").write_text("ANTHROPIC_API_KEY=secret")
    (tmp_path / "notes.txt").symlink_to(tmp_path / ".env")
    os.mkfifo(tmp_path / "pipe")
    for bad in ["../secret", "/etc/passwd", ".env", "notes.txt", ".git/config", "pipe", "."]:
        assert tools.run_tool("read_file", {"path": bad}).startswith("ERROR")
    assert tools.run_tool("list_dir", {"path": ".."}).startswith("ERROR")


def test_unknown_tool_no_crash():
    assert tools.run_tool("rm_rf", {}).startswith("ERROR")
    assert tools.run_tool("calculator", {"wrong": 1}).startswith("ERROR")


def test_loop_runs_tool_then_answers():
    fake = FakeClient([
        NS(stop_reason="tool_use", content=[tool_use("calculator", {"expression": "6*7"})]),
        NS(stop_reason="end_turn", content=[text("It is 42.")]),
    ])
    assert run_agent("6*7?", fake, "m") == "It is 42."
    last = fake.calls[1]["messages"][2]  # user, assistant(tool_use), user(tool_result), ...
    assert last["role"] == "user"
    assert last["content"][0] == {"type": "tool_result", "tool_use_id": "t1", "content": "42", "is_error": False}


def test_loop_stops_at_max_steps():
    fake = FakeClient([NS(stop_reason="tool_use", content=[tool_use("calculator", {"expression": "1"})])])
    assert run_agent("loop forever", fake, "m").startswith("Stopped")
    assert len(fake.calls) == MAX_STEPS
